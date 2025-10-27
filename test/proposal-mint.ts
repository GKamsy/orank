// scripts/proposal-mint.ts
import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  // Load saved contract addresses
  const filePath = path.join(__dirname, "../addresses.json");
  if (!fs.existsSync(filePath)) {
    throw new Error("❌ addresses.json not found — please deploy first.");
  }

  const networkName = hre.network.name;
  const networkAddresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  const addresses = networkAddresses[networkName];
  
  if (!addresses) {
    throw new Error(`No addresses found for network: ${networkName}`);
  }

  // Validate required addresses
  const required = ["ORankToken", "ORankGovernor", "ORankTreasury"];
  for (const key of required) {
    if (!addresses[key]) {
      throw new Error(`❌ Missing ${key} address in addresses.json`);
    }
  }

  // Get deployer signer
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Treasury:", addresses.ORankTreasury);

  // Attach contracts with signer
  const token = await ethers.getContractAt("ORankToken", addresses.ORankToken, deployer);
  const governor = await ethers.getContractAt("ORankGovernor", addresses.ORankGovernor, deployer);
  const treasury = await ethers.getContractAt("ORankTreasury", addresses.ORankTreasury, deployer);

  // Delegate voting power to deployer (required to propose)
  const txDelegate = await token.delegate(deployer.address);
  await txDelegate.wait();
  console.log("Delegated voting power to deployer.");

  // Proposal details
  const amount = ethers.parseEther("1000"); // 1000 ORK
  const description = "Proposal #1: Mint 1000 ORK into Treasury";

  // Encode function call (mint to Treasury)
  const encodedFunctionCall = token.interface.encodeFunctionData("mint", [
    addresses.ORankTreasury,
    amount,
  ]);

  console.log("Creating proposal...");
  const proposeTx = await governor.propose(
    [addresses.ORankToken],        // targets
    [0],                           // values
    [encodedFunctionCall],         // calldatas
    description                    // description
  );
  const receipt = await proposeTx.wait();

  // Get ProposalCreated event
  const events = await governor.queryFilter(
    governor.filters.ProposalCreated(),
    receipt.blockNumber,
    receipt.blockNumber
  );

  if (events.length === 0) {
    throw new Error("❌ ProposalCreated event not found");
  }

  const proposalId = events[0].args.proposalId;
  console.log(`✅ Proposal created with ID: ${proposalId.toString()}`);
  
  // Save proposalId to file
  const filePath = path.join(__dirname, "../proposal.json");
  fs.writeFileSync(filePath, JSON.stringify({ proposalId }, null, 2));
  console.log("📂 Proposal ID saved to proposal.json");
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exitCode = 1;
});
