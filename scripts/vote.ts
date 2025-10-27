// scripts/vote.ts
import inquirer from "inquirer";
import chalk from "chalk";
import { castVoteCore } from "../lib/votes";
import { networkName } from "../index";
import { getGovernor, loadProposals, loadAddresses, networkProvider } from "../utils";

export async function castVote() {
  const devMode = process.env.DEV_MODE;
  const addresses = await loadAddresses(networkName);

  // ----------------------------
  // Select all new proposals
  // ----------------------------
  const activeProposals = loadProposals(networkName).filter(
    p => p.state === "Active" || p.state === "Pending" );
  if (!activeProposals.length) {
    console.log(chalk.red("✔ No active proposals to vote.\n"));
    return "back";
  }
  
  // ------------------------------------------
  // Select remaining proposals to vote
  // ------------------------------------------
  let voterKey = process.env.PRIVATE_KEY;
  const voterKeySlice = `${voterKey.slice(0, 6)}...${voterKey.slice(-4)}`;
  const remainProposals = activeProposals.filter(
    p => !p.votes || !(voterKeySlice in p.votes));
  if (!remainProposals.length && !devMode ) {
    console.log(chalk.red("✔ No proposal remains to vote.\n"));
    return "back";
  }

  /* 
   * Now we select a proposal to vote based on the mode we are using.
   * The choices will map to "activeProposals" if in a dev (testing) mode.
   * It will map to "remainProposals" if in the production mode.
  */
  const sourceProposals = devMode ? activeProposals : remainProposals;
  const { pid } = await inquirer.prompt([{
    type: "list",
    name: "pid",
    message: chalk.blue("Select a proposal to vote:"),
    choices: sourceProposals.map(p => ({
      name: p.description,
      value: p.proposalId
    }))
  }]);
  const proposal = sourceProposals.find(p => p.proposalId === pid);
  
  // ---------------------
  // Load the voter key
  // ---------------------
  if (devMode) {
    const rawKeys = process.env.VOTER_KEYS?.split(",").map(k => k.trim()) || [];
    if (!rawKeys.length) {
      console.log(chalk.red("✔ Missing VOTER_KEYS.\n"));
      return "back";
    }
    
    const validVoters: { name: string; key: string }[] = [];
    for (let i = 0; i < rawKeys.length; i++) {
      const key = rawKeys[i];
      const keySlice = `${key.slice(0, 6)}...${key.slice(-4)}`; // safe display
      if (proposal.votes[keySlice] === undefined) {
        validVoters.push({name: `Voter ${i + 1}: ${keySlice}`, key});
      }
    }
    
    // -----------------------------
    // Select a voter interactively
    // -----------------------------
    if (validVoters.length === 0 ) {
      await castVoteCore(pid, voterKey, 0, "", addresses, networkName);
      console.log(chalk.yellow(`✔ Voters exhausted.\n`));
      return "ok";
    }
    const voter = await inquirer.prompt([{
      type: "list",
      name: "voterKey",
      message: chalk.blue("Select a key to use as a voter:"),
      choices: [
        ...validVoters.map((v) => ({ name: `  ${v.name}`, value: v.key,
        })),
      ],
    }]);
    voterKey = voter.voterKey;
  }

  // -----------------------------
  // Select a vote type interactively
  // -----------------------------
  const { voteType } = await inquirer.prompt([{
    type: "list",
    name: "voteType",
    message: chalk.blue("Choose vote type:"),
    choices: [
      { name: "For", value: 1 },
      { name: "Against", value: 0 },
      { name: "Abstain", value: 2 }
    ]
  }]);
  
  let { feedback } = await inquirer.prompt([{
    type: "input",
    name: "feedback",
    message: chalk.blue("Give your feedback (optional):"),
    default: "",
  }]);
  if(feedback === "") feedback = "No feedback";

  const vote = await castVoteCore(pid, voterKey, voteType, feedback, addresses, networkName);
  if(vote === "successful") {
    console.log(chalk.green("✔ Vote casted successfully.\n"));
  }
  else{
    console.log(chalk.red(`✔ Voting failed: ${vote}\n`));
  }

  return "ok";
}

if (require.main === module) {
  castVote().catch(err => { console.error(err); process.exit(1); });
}
