// scripts/utils.ts
import { ethers } from "hardhat";
import hre from "hardhat";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import inquirer from "inquirer";
import { deployGovernance } from "./scripts/deploy";
import axios from "axios";
//import { networkProvider } from "./index"; // or your utils imports
import GrantRegistryArtifact from "./abis/GrantRegistry.json";

const PINATA_API_KEY = process.env.PINATA_API_KEY!;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY!;
const DEFAULT_PRIVATE_KEY = process.env.PRIVATE_KEY!;

function canonicalStringify(obj: Record<string, any>): string {
  const ordered = Object.keys(obj).sort().reduce((acc, key) => {
    acc[key] = obj[key];
    return acc;
  }, {} as Record<string, any>);
  return JSON.stringify(ordered);
}

/**
 * Uploads metadata (grant, review, or vote) to Pinata, signs it, and anchors its hash on-chain.
 * Automatically detects type based on fields in the metadata.
 * Returns CID, its keccak256 hash, signature, and optional tx hash.
 */
 
export async function uploadToPinata(
  metadata: Record<string, any>,
  relatedId: string, // proposalId or grantId
  addresses: Record<string, string>,
  networkName: string,
  rating?: number,
  privateKey?: string): Promise<{
  cid: string;
  cidHash: string;
  signature: string;
  txHash: string;}> {
  if (!PINATA_API_KEY || !PINATA_SECRET_API_KEY) {
    return {
      state: "failed",
      error: "⚠️ Missing Pinata API credentials in environment variables.",
    } as any;
  }

  // Detect metadata type
  const isGrant = "applicant" in metadata;
  const isVote = "choice" in metadata && "voter" in metadata;
  const isReview = "rating" in metadata;

  try {
    // -------------------------
    // 1️⃣ Prepare signer & sign metadata
    // -------------------------
    let dataToSign;
    const key = privateKey || DEFAULT_PRIVATE_KEY;
    const wallet = new ethers.Wallet(key, networkProvider);
    
    // Include message hash
    if(isGrant){
      dataToSign = `${metadata.name} ${relatedId}`;
    }
    if(isVote){
      dataToSign = `${metadata.proposalId} ${metadata.choice} ${metadata.feedback}`;
    }
    if(isReview){
      dataToSign = `${metadata.proposalId} ${metadata.rating} ${metadata.feedback}`;
    }
    const messageHash = ethers.keccak256(ethers.toUtf8Bytes(dataToSign));
    const signature = await wallet.signMessage(ethers.getBytes(messageHash));

    const signedMetadata = {
      ...metadata,
      signer: wallet.address,
      signature,
      messageHash,
      timestamp: new Date().toISOString(),
    };

    // -------------------------
    // 2️⃣ Upload signed JSON to Pinata
    // -------------------------
    console.log(chalk.bold("⚠️ Uploading metadata to Pinata (signed)..."));
    const res = await axios.post(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      signedMetadata,
      {
        headers: {
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_SECRET_API_KEY,
        },
      }
    );

    const cid = res.data.IpfsHash;
    console.log(chalk.green("✔ Metadata uploaded:"), `ipfs://${cid}`);

    // -------------------------
    // 3️⃣ Compute CID hash
    // -------------------------
    const cidHash = ethers.keccak256(
      ethers.toUtf8Bytes(canonicalStringify(metadata)));

    // -------------------------
    // 4️⃣ Detect & submit to chain
    // -------------------------
    if (isGrant) {
      const grantRegistry = new ethers.Contract(
      addresses.GrantRegistry,
      GrantRegistryArtifact.abi,
      wallet);
      
      console.log(chalk.yellow("⚙️ Registering grant on-chain..."));
      const metadataURI = `ipfs://${cid}`;
      const tx = await grantRegistry.submitGrant(relatedId, metadataURI, cidHash);
      const receipt = await tx.wait();
      console.log(chalk.green(`✔ Grant successfuly registered on-chain.`));
      return { cid, messageHash, signature, txHash: receipt.hash };
    }

    if (isReview) {
      const governor = await getGovernor(addresses, wallet);
      const score = rating ?? metadata.rating ?? 0;
      const tx = await governor.submitReview(relatedId, score, cid, cidHash);
      const receipt = await tx.wait();
      return { cid, messageHash, signature, txHash: receipt.hash };
    }

    if (isVote) {
      const governor = await getGovernor(addresses, wallet);
      const voteType = metadata.choice;
      const tx = await governor.castVoteWithReason(relatedId, voteType, cid);
      const receipt = await tx.wait();
      return { cid, messageHash, signature, txHash: receipt.hash };
    }

    // -------------------------
    // Default (upload only)
    // -------------------------
    return { cid, cidHash, signature, txHash: "" };
  } 
  catch (err: any) {
    return { state: "failed", error: err?.response?.data || err.message } as any;
  }
}



/**
 * Verifies the authenticity and integrity of uploaded grant/review metadata.
 * - Fetches metadata from IPFS
 * - Recomputes messageHash
 * - Confirms ECDSA signature validity
 * - Ensures signer matches recovered address
 */
export async function verifyUpload(cid: string): Promise<{
  valid: boolean; signer: string; recovered: string;
  messageHash: string; error?: string;}> {
  try {
    // Fetch from Pinata public gateway
    const GATEWAY = process.env.IPFS_GATEWAY || "https://gateway.pinata.cloud/ipfs/";
    const url = `${GATEWAY}${cid}`;
    const res = await axios.get(url);
    const data = res.data;

    if (!data.signature || !data.signer || !data.messageHash) {
      return {
        valid: false, signer: data.signer || "N/A",
        recovered: "N/A", messageHash: "N/A",
        error: "Missing signature fields in metadata.",
      };
    }

    // Detect metadata type
    let dataToSign;
    const { signature, signer, messageHash, ...myData } = data;
    const isGrant = "applicant" in myData;
    const isReview = "rating" in myData;
    const isVote = "choice" in myData && "voter" in myData;
    
    
    // Recompute message hash from the original data (excluding signature fields)
    if(isVote){
      dataToSign = `${myData.proposalId} ${myData.choice} ${myData.feedback}`;
    }
    if(isReview){
      dataToSign = `${myData.proposalId} ${myData.rating} ${myData.feedback}`;
    }
    const recomputedHash = ethers.keccak256(ethers.toUtf8Bytes(dataToSign));

    // Check hash consistency
    if (messageHash !== recomputedHash) {
      console.log(chalk.bold(`    messageHash: ${messageHash}\n    recomputedHash: ${recomputedHash}`));
      return {
        valid: false, signer, recovered: "N/A",
        messageHash: recomputedHash,
        error: "Message hash mismatch (data modified).",
      };
    }

    // Recover signer
    const recovered = ethers.verifyMessage(
      ethers.getBytes(messageHash), signature );
    const valid = recovered.toLowerCase() === signer.toLowerCase();
    return { 
      valid, signer, recovered, messageHash,
      error: valid ? undefined : "Signature verification failed.",
    };
  }
  catch (err: any) {
    return { valid: false, signer: "N/A", recovered: "N/A",
      messageHash: "N/A", error: err.message,
    };
  }
}


// Reuse the ActionResult type so everything is consistent
export type ActionResult = "ok" | "back" | "exit";

export const networkProvider: string = new ethers.JsonRpcProvider(
    process.env.SEPOLIA_URL);

/**
 * Reusable options for menus that want "back" and "exit".
 */
export const backOrExitOpt = [
  { name: "\t↩️ Go back", value: "back" },
  { name: "\t❌Exit", value: "exit" },
];

/**
 * Handle "back" or "exit" results.
 */
export async function backOrExit(option: string): Promise<ActionResult> {
  if (option === "exit") {
    console.log(chalk.red.bold("❌Goodbye!\n"));
    return "exit";
  }
  if (option === "back") {
    return "back";
  }
  return "ok";
}


/**
 * Ask user to confirm whether to continue or go back.
 * Returns:
 *  - "ok" if they choose to continue
 *  - "back" if they choose to go back
 */
export async function confirmContinue(): Promise<ActionResult> {
  const answer = await inquirer.prompt([
    {
      type: "list",
      name: "confirm",
      message: chalk.blue("Should we continue with this?"),
      choices: [
        { name: "\t✔ Yes, continue", value: "continue" },
        { name: "\t↩️ No, skip", value: "back" },
      ],
    },
  ]);

  if (answer.confirm === "back") return "back";
  return "ok";
}


export type ProposalData = {
  id: number;
  name: string;
  grantId: string;
  proposalId: string;
  targets: string[];
  values: number[];
  calldata: string[];
  state: string;
  description: string;
  votes?: Record<string, number>; // voter address -> vote choice
};

export const ADDRESSES_FILE = path.join(__dirname, "./data/addresses.json");
export const PROPOSAL_FILE = path.join(__dirname, "./data/proposal.json");
export const VOTERS_FILE = path.join(__dirname, "./data/voters.json");

// Load addresses for network
export async function loadAddresses(networkName: string): Promise<any> {
  if (!fs.existsSync(ADDRESSES_FILE)) {
    console.log(chalk.green.bold(`\n⚠️ No addresses.json found, deploying fresh...`));
    await deployGovernance();
  }
  const data = JSON.parse(fs.readFileSync(ADDRESSES_FILE, "utf8"));
  let addresses = data[networkName];
  if (!addresses) {
    console.log(chalk.green.bold(`\n⚠️ No addresses for ${networkName}, deploying fresh...`));
    
    // ask for confirmation
    const confirm2 = await confirmContinue();
    if (confirm2 === "back") return "exit";
    await deployGovernance();
    
    const newData = JSON.parse(fs.readFileSync(ADDRESSES_FILE, "utf8"));
    addresses = newData[networkName];
  }
  if (!addresses) {
    throw new Error(chalk.red.bold(`❌Still no addresses found for ${networkName}`));
  }
  return addresses;
}



// Load all proposals
export function loadProposals(networkName: string): ProposalData[] {
  if (!fs.existsSync(PROPOSAL_FILE)) return [];
  const all = JSON.parse(fs.readFileSync(PROPOSAL_FILE, "utf8"));
  return all[networkName] ?? [];
}

// Save all proposals
export function saveProposals(networkName: string, proposals: ProposalData[]) {
  let all: Record<string, ProposalData[]> = {};
  if (fs.existsSync(PROPOSAL_FILE)) all = JSON.parse(fs.readFileSync(PROPOSAL_FILE, "utf8"));
  all[networkName] = proposals;
  fs.writeFileSync(PROPOSAL_FILE, JSON.stringify(all, null, 2));
}

// Load voters
export function loadVoters(networkName: string): string[] {
  if (!fs.existsSync(VOTERS_FILE)) return [];
  const all: Record<string, string[]> = JSON.parse(fs.readFileSync(VOTERS_FILE, "utf8"));
  return all[networkName] ?? [];
}

// Save voters
export function saveVoters(networkName: string, voters: string[]) {
  let all: Record<string, string[]> = {};
  if (fs.existsSync(VOTERS_FILE)) all = JSON.parse(fs.readFileSync(VOTERS_FILE, "utf8"));
  all[networkName] = voters;
  fs.writeFileSync(VOTERS_FILE, JSON.stringify(all, null, 2));
}

// Governor contract instance
export async function getGovernor(addresses: any, runner?: any) {
  const artifact = await hre.artifacts.readArtifact("ORankGovernor");

  // Default to ethers.provider (read-only) if no runner provided
  const usedRunner = runner ?? ethers.provider;

  return new ethers.Contract(addresses.ORankGovernor, artifact.abi, usedRunner);
}


// Compute description hash
export function descriptionHash(description: string): string {
  return ethers.id(description);
}

// Get proposal state as string
export async function getProposalState(governor: any, proposalId: string): Promise<string> {
  const stateNum = await governor.state(proposalId);
  const stateMapping = [
    "Pending", "Active", "Canceled", "Defeated",
    "Succeeded", "Queued", "Expired", "Executed"
  ];
  return stateMapping[stateNum];
}

// Update proposal state
export function updateProposalState(
  proposals: any[],
  proposalId: string,
  newState: string) {
  const proposal = proposals.find((p) => p.proposalId === proposalId);
  if (!proposal) return "";

  proposal.state = newState;
  
  if (!proposal.votes) {
    proposal.votes = {};
  }

  if (!proposal.reviews) {
    proposal.reviews = [];
  }
  
  if (!proposal.stateHistory) {
    proposal.stateHistory = [];
  }

  if(newState !== proposal.stateHistory[
    proposal.stateHistory.length - 1].state) {
    proposal.stateHistory.push({ state: newState,
    updatedAt: new Date().toISOString(),
    });
  }
  return "successful";
}

// Governor contract instance 
export async function getGovernor(addresses: any, runner?: any) { 
  const artifact = await hre.artifacts.readArtifact("ORankGovernor"); 
  // Default to ethers.provider (read-only) if no runner provided 
  const usedRunner = runner ?? ethers.provider; 
  return new ethers.Contract(addresses.ORankGovernor, artifact.abi, usedRunner); 
}


// -----------------------------
// Grants persistence helpers
// -----------------------------
export const GRANTS_FILE = path.join(__dirname, "./data/submitted-grants.json");

export type GrantData = {
  id: number;
  grantId: string;
  metadataURI: string;
  metadata: any;
  state: string;
  timestamp: string;
};

// Load submitted grants
export function loadSubmittedGrants(networkName: string): GrantData[] {
  if (!fs.existsSync(GRANTS_FILE)) return [];
  const all = JSON.parse(fs.readFileSync(GRANTS_FILE, "utf8"));
  return all[networkName] ?? [];
}

// Save submitted grants
export function saveSubmittedGrants(networkName: string, grants: GrantData[]) {
  let all: Record<string, GrantData[]> = {};
  if (fs.existsSync(GRANTS_FILE)) {
    all = JSON.parse(fs.readFileSync(GRANTS_FILE, "utf8"));
  }
  all[networkName] = grants;
  fs.writeFileSync(GRANTS_FILE, JSON.stringify(all, null, 2));
}

// Update any property of a specific grant
export function updateGrantStatus(
  networkName: string,
  grantId: string,
  updates: Partial<GrantData>) {
  let all: Record<string, GrantData[]> = {};

  if (fs.existsSync(GRANTS_FILE)) {
    all = JSON.parse(fs.readFileSync(GRANTS_FILE, "utf8"));
  }
  const idx = all[networkName].findIndex((g) => g.grantId === grantId);

  all[networkName][idx] = {
    ...all[networkName][idx],
    ...updates,
  };

  fs.writeFileSync(GRANTS_FILE, JSON.stringify(all, null, 2));
}

// Make prompt show a live word count as the user types
export async function promptFeedback() {
  let feedback = "";
  await inquirer.prompt([{
    type: "input",
    name: "feedback",
    message: chalk.blue("Your feedback (type and press Enter):"),
    transformer: (input: string) => {
      const wordCount = input.trim().split(/\s+/).filter(Boolean).length;
      return `${input} ${chalk.gray(`(${wordCount} word${wordCount !== 1 ? "s" : ""})`)}`;
    },
    
    validate: (feed: string) => { 
      const text = feed.trim();
      const words = feed.trim().split(/\s+/).filter(Boolean);
      const wordCount = words.filter(w => w.length > 0).length;

      if (wordCount < 3 || wordCount > 20)
      return "Feedback must be between 3 and 20 words.";
      if (text.length < 15)
      return "Feedback is too short — please add more detail.";
      return true;
    },
  }]).then((answers) => {
    feedback = answers.feedback.trim();
  });
  return feedback;
}
