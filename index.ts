import hre from "hardhat";
import chalk from "chalk";
import inquirer from "inquirer";

import { registerGrant } from "./lib/register-grant";
import { proposeGrant } from "./scripts/propose";
import { castVote } from "./scripts/vote";
import { queueProposals } from "./scripts/queue";
import { executeProposals } from "./scripts/execute";
import { reviewProposal } from "./scripts/review";
import { loadAddresses } from "./utils";

export let DEV_MODE: boolean;
export let addresses: any;
export const networkName: string = hre.network.name;

export type ActionResult = "ok" | "back" | "exit";

// ----------------------------------------------------
// Action handler
// ----------------------------------------------------
async function handleAction(action: string): Promise<ActionResult> {
  switch (action) {
    case "register": return await registerGrant();
    case "propose":  return await proposeGrant();
    case "vote":     return await castVote();
    case "queue":    return await queueProposals();
    case "execute":  return await executeProposals();
    case "review":   return await reviewProposal();
    case "exit":
      console.log(chalk.red.bold("✔ Goodbye!\n"));
      return "exit";
    default:
      return "back";
  }
}

// ----------------------------------------------------
// Main Menu Loop
// ----------------------------------------------------
async function mainMenu() {
  const devMode = process.env.DEV_MODE;
  console.log(chalk.yellow.bold(
    "\n\n*********************************************************************"));
  console.log(chalk.yellow.bold(
    "********   OPEN RESEARCH ACTIVISM for NETWORKED KNOWLEDGE    ********"));
  console.log(chalk.yellow.bold(
    `********           “Expanding the frontier models"           ********`));
  console.log(chalk.yellow.bold(
    "*********************************************************************\n"));

  // Load deployed contract addresses
  const addresses = await loadAddresses(networkName);
  if (addresses === "exit") {
    console.log(chalk.red.bold("Goodbye for not willing to deploy contracts right now.\n"));
    process.exit(0);
  }

  // Action loop
  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: chalk.blue("What do you want to do?"),
        choices: [
          { name: "  Register grant", value: "register" },
          { name: "  Make proposal", value: "propose" },
          { name: "  Vote on proposal", value: "vote" },
          { name: "  Queue proposals", value: "queue" },
          { name: "  Execute proposals", value: "execute" },
          { name: "  Review a proposal", value: "review" },
          { name: chalk.yellow("  Exit"), value: "exit" },
        ],
      },
    ]);

    const result = await handleAction(action);
    if (result === "exit") break;
  }

  process.exit(0);
}

// Entrypoint
mainMenu().catch(err => {
  console.error(err);
  process.exit(1);
});
