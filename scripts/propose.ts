/******************************************************************
 * scripts/propose.ts
 * -----------------------------------------------------------------
 * CLI script to propose a grant using ORankGovernor
 * Fully compatible with lib/proposals.ts (createProposal wrapper)
 * -----------------------------------------------------------------
 * Features:
 *  - Loads available grants from submitted-grants.json
 *  - Allows selection via interactive prompt
 *  - Builds calldata and proposal data
 *  - Submits proposal on-chain
 *  - Saves locally with enhanced schema
 *  - Supports dual-mode: standalone CLI or imported as helper
 ******************************************************************/

import inquirer from "inquirer";
import chalk from "chalk";
import { ethers } from "hardhat";
import { ActionResult, loadAddresses, backOrExitOpt, backOrExit, confirmContinue } from "../utils";
import { buildProposalData, createProposal, SubmittedGrant } from "../lib/proposals";
import fs from "fs";
import path from "path";
import { networkName } from "../index";

/**
 * Helper: Load submitted grants for the current network
 */
function loadSubmittedGrants(networkName: string): SubmittedGrant[] {
  const grantsPath = path.join(__dirname, "../data/submitted-grants.json");
  if (!fs.existsSync(grantsPath)) {
    throw new Error(chalk.red(`❌ submitted-grants.json not found at ${grantsPath}`));
  }
  const submitted: Record<string, SubmittedGrant[]> = JSON.parse(fs.readFileSync(grantsPath, "utf8"));
  return submitted[networkName] || [];
}

/**
 * Main CLI wrapper for proposing a grant
 */
export async function proposeGrant(): Promise<ActionResult> {

  // Load addresses and grants
  const addresses = await loadAddresses(networkName);
  const grants = loadSubmittedGrants(networkName).filter((g) => g.state === "Available");

  if (!grants.length) {
    console.log(chalk.yellow("✔ All grants have already been proposed.\n"));
    return "back";
  }

  // Load proposer keys from ENV
  const rawKeys = process.env.VOTER_KEYS?.split(",").map(k => k.trim()) || [];
  if (!rawKeys.length) {
    console.log(chalk.red("❌ Missing VOTER_KEYS in .env file.\n"));
    return "back";
  }
  const proposerKey = rawKeys[0]; // pick first key by default

  // -----------------------------
  // Ask user to select a grant
  // -----------------------------
  const answer = await inquirer.prompt([
    {
      type: "list",
      name: "grantId",
      message: chalk.blue("Select a grant to propose:"),
      choices: [
        ...grants.map((g) => ({
          name: `${g.metadata.name} (${g.id})`,
          value: g.id,
        })),
        ...backOrExitOpt,
      ],
    },
  ]);

  const result: ActionResult = await backOrExit(answer.grantId);
  if (result !== "ok") return result;

  const selectedGrant = grants.find((g) => g.id === answer.grantId) as SubmittedGrant;

  console.log(chalk.yellow(`\nPreparing proposal for grant: ${selectedGrant.metadata.name} (${selectedGrant.id})\n`));

  const confirm = await confirmContinue();
  if (confirm === "back") return "back";

  // -----------------------------
  // Build proposal data
  // -----------------------------
  const { targets, values, calldata } = await buildProposalData(selectedGrant, addresses);

  // -----------------------------
  // Submit proposal using createProposal()
  // -----------------------------
  const proposal = await createProposal(
    {
      grantId: selectedGrant.grantId,
      grantName: selectedGrant.metadata.name,
      description: `Approve grant and release funds for ${selectedGrant.metadata.name} (${selectedGrant.id})`,
      targets,
      values,
      calldata,
    },
    proposerKey,
    addresses,
    networkName
  );

  console.log(chalk.green(`\n✔ Proposal submitted successfully! Proposal ID: ${proposal.proposalId.slice(0, 6)}...\n`));

  return "ok";
}

// -----------------------------
// Standalone CLI execution
// -----------------------------
if (require.main === module) {
  proposeGrant().catch((err) => {
    console.error(chalk.red("❌ Error submitting proposal:"), err);
    process.exit(1);
  });
}
