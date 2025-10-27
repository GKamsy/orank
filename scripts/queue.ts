// scripts/queue.ts
import inquirer from "inquirer";
import chalk from "chalk";
import { queueProposalCore } from "../lib/queue";
import { loadProposals, loadAddresses } from "../utils";
import { networkName } from "../index";

export async function queueProposals() {
  const devMode = process.env.DEV_MODE;
  const queuerKey = process.env.PRIVATE_KEY
  const addresses = await loadAddresses(networkName);
  const proposals = loadProposals(networkName).filter(p => p.state === "Succeeded");
  if (!proposals.length) {
    console.log(chalk.red("✔ No proposals to be queued.\n"));
    return "back";
  }
  
  // -----------------------------------
  // Loop over proposals and queue them
  // -----------------------------------
  for (const proposal of proposals) {
    console.log(chalk.green(`\n✔ Queuing proposal ${proposal.id}...`));
    const queue = await queueProposalCore(proposal.proposalId,
      proposal.description, queuerKey, proposal.targets, proposal.values,
      proposal.calldata, addresses, networkName);
    if(queue === "successful") {
      console.log(chalk.green(`✔ Proposal ${proposal.id} queued successfully.\n`));
    }
    else if(queue === "Defeated") {
      console.log(chalk.red(`⚠️ Proposal ${proposal.id} failed to satisfy the quorum or majority.\n`));
    }
    else{
      console.log(chalk.red(`⚠️ Failed to queue proposal ${proposal.id}: ${queue}\n`));
    }
  }

  return "ok";
}

if (require.main === module) {
  queueProposals().catch(err => { console.error(err); process.exit(1); });
}
