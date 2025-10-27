import inquirer from "inquirer";
import chalk from "chalk";
import { networkName } from "../index";
import { executeProposalCore } from "../lib/execute";
import { loadProposals, loadAddresses } from "../utils";

export async function executeProposals() {
  const devMode = process.env.DEV_MODE;
  const executerKey = process.env.PRIVATE_KEY
  const addresses = await loadAddresses(networkName);
  const proposals = loadProposals(networkName).filter(p => p.state === "Queued");
  if (!proposals.length) {
    console.log(chalk.red("✔ No proposals to be executed.\n"));
    return "back";
  }
  
  // -----------------------------------
  // Loop over proposals and queue them
  // -----------------------------------
  for (const proposal of proposals) {
    console.log(chalk.green(`✔ Executing proposal ${proposal.id}...`));
    const execute = await executeProposalCore(proposal.proposalId,
      proposal.description, executerKey, proposal.targets, proposal.values,
      proposal.calldata, addresses, networkName);
    if(execute === "successful") {
      console.log(chalk.green(`✔ Proposal ${proposal.id} executed successfully.`));
    }
    else{
      console.log(chalk.red(`✔ Failed to execute proposal ${proposal.id}.`));
    }
  }

  return "ok";
}

if (require.main === module) {
  queueProposals().catch(err => { console.error(err); process.exit(1); });
}
