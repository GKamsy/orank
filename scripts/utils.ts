// scripts/utils.ts
import { ethers } from "hardhat";
import hre from "hardhat";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import inquirer from "inquirer";
import { deployGovernance } from "./deploy";// utils.ts

// Reuse the ActionResult type so everything is consistent
export type ActionResult = "ok" | "back" | "exit";

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
    console.log(chalk.red.bold("❌Goodbye! Thank you for your precious time.\n"));
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

export const ADDRESSES_FILE = path.join(__dirname, "../addresses.json");
export const PROPOSAL_FILE = path.join(__dirname, "../proposal.json");
export const VOTERS_FILE = path.join(__dirname, "../voters.json");

// Load addresses for network
export async function loadAddresses(networkName: string): Promise<any> {
  if (!fs.existsSync(ADDRESSES_FILE)) {
    console.log(chalk.green.bold(`\n⚠️ No addresses.json found, deploying fresh...`));
    
    // ask for confirmation
    const confirm1 = await confirmContinue();
    if (confirm1 === "back") return "exit";
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
  newState: string
) {
  const proposal = proposals.find((p) => p.proposalId === proposalId);
  if (!proposal) return;

  proposal.state = newState;
  if (!proposal.stateHistory) {
    proposal.stateHistory = [];
  }

  proposal.stateHistory.push({
    state: newState,
    updatedAt: new Date().toISOString(),
  });
}
