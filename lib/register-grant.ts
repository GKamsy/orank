// lib/register-grant.ts
import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import {
  confirmContinue,
  loadSubmittedGrants,
  saveSubmittedGrants,
  loadAddresses,
  uploadToPinata,
  GrantData,
} from "../utils";
import { networkName } from "../index";

/**
 * Core function: Register a new grant
 */
export async function registerGrant(): Promise<"ok" | "back"> {
  const devMode = process.env.DEV_MODE;
  const addresses = await loadAddresses(networkName);
  const [signer] = await ethers.getSigners();

  if (!addresses) {
    throw new Error(chalk.red.bold(`No addresses found for network: ${networkName}`));
  }

  const grantRegistry = await ethers.getContractAt("GrantRegistry", addresses.GrantRegistry);

  // 1️⃣ Load metadata JSON
  const metadataFilePath = path.join(__dirname, "../data/metadata.json");
  if (!fs.existsSync(metadataFilePath)) {
    throw new Error(chalk.red.bold(`Metadata file not found: ${metadataFilePath}`));
  }
  const metadata = JSON.parse(fs.readFileSync(metadataFilePath, "utf8"));

  // Attach applicant + timestamp
  metadata.applicant = signer.address;
  metadata.timestamp = Date.now();

  // 2️⃣ Load existing grants
  const grants = loadSubmittedGrants(networkName);
  const grantNum = grants.length + 1;

  // 3️⃣ Generate unique grantId
  const grantId = ethers.keccak256(ethers.toUtf8Bytes(`${Date.now()}-${signer.address}`));

  // 4️⃣ Confirm with user
  console.log(chalk.red.bold("\n⚠️ PLEASE CONFIRM REGISTERING A NEW GRANT"));
  console.log(`\t→ Grant name    :  ${metadata.name} ${grantNum}`);
  console.log(`\t→ Grant ID      :  ${grantId.slice(0, 6)}...${grantId.slice(-4)}`);
  const confirm = await confirmContinue();
  if (confirm === "back") return "back";

  // 5️⃣ Upload + anchor metadata
  const result = await uploadToPinata(
    metadata, grantId, addresses, networkName,
    0, // rating not applicable (use neutral value)
    process.env.PRIVATE_KEY);

  if ("state" in result && result.state === "failed") {
    console.log(chalk.red(`❌ Metadata upload failed: ${result.error}`));
    return "ok";
  }
  const { cid, cidHash, signature, txHash } = result;

  // 6️⃣ Submit on-chain (if not already handled in uploadToPinata)
  //     We’ll check if txHash was returned to skip double submission.
  let receiptHash = txHash;
  if (!txHash) {
    console.log(chalk.yellow("⚙️ Registering grant on-chain..."));
    const metadataURI = `ipfs://${cid}`;

    // NOTE: If ABI differs, update the function name/signature below
    const tx = await grantRegistry.submitGrant(relatedId, metadataURI, cidHash);
    const receipt = await tx.wait();
    receiptHash = receipt.hash;
    console.log(chalk.green(`✔ Grant successfully registered on-chain.`));
  }

  // 7️⃣ Save locally
  const newGrant: GrantData = {
    id: grantNum,
    grantId,
    metadataURI: `ipfs://${cid}`,
    metadata,
    state: "Available",
    timestamp: new Date().toISOString(),
  };

  grants.push(newGrant);
  saveSubmittedGrants(networkName, grants);
  console.log(chalk.green(`✔ Grant saved locally in submitted-grants.json\n`));
  return "ok";
}
