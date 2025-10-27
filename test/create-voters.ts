import { ethers } from "hardhat";
import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import {
  loadAddresses,
  loadProposals,
  saveProposals,
  loadVoters,
  getGovernor,
  getProposalState,
} from "./utils";

type VoteMapping = Record<string, number>;
const voteMapping: VoteMapping = { against: 0, for: 1, abstain: 2 };

const VOTERS_FILE = path.join(__dirname, "../voters.json");

function createVotersIfMissing(networkName: string, count: number = 3): string[] {
  let allVoters: Record<string, string[]> = {};
  if (fs.existsSync(VOTERS_FILE)) {
    allVoters = JSON.parse(fs.readFileSync(VOTERS_FILE, "utf8"));
  }

  if (!allVoters[networkName] || allVoters[networkName].length === 0) {
    console.log(`⚠️ No voters found for ${networkName}. Generating ${count} new wallets...`);
    const wallets: ethers.Wallet[] = [];
    const privKeys: string[] = [];
    for (let i = 0; i < count; i++) {
      const wallet = ethers.Wallet.createRandom();
      wallets.push(wallet);
      privKeys.push(wallet.privateKey);
      console.log(`🆕 Created voter ${i + 1}: ${wallet.address}`);
    }

    allVoters[networkName] = privKeys;
    fs.writeFileSync(VOTERS_FILE, JSON.stringify(allVoters, null, 2));
    console.log(`✅ Saved ${count} voters to voters.json`);

    return privKeys;
  }

  return allVoters[networkName];
}

async function main() {
  const networkName = hre.network.name;

  // --------------------------
  // Ensure voters exist
  // --------------------------
  const voters = createVotersIfMissing(networkName, 10);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
