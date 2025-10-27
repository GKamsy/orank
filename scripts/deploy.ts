import chalk from "chalk";
import { deployGovernanceStack, saveAddresses } from "../lib/deploy";
import { networkName } from "../index";

export async function deployGovernance() {
  const devMode = process.env.DEV_MODE;
  console.log(chalk.bold(`⚠️ Deploying contracts on ${networkName} network. Please wait...`));

  try {
    const addresses = await deployGovernanceStack(devMode, networkName);

    console.log(chalk.green("✔ Contracts deployed successfully:"));
    Object.entries(addresses).forEach(([name, addr]) => {
      console.log(`   ${name.padEnd(15)} → ${addr}`);
    });

    saveAddresses(networkName, addresses);
    console.log(chalk.green(`✔ Addresses saved to addresses.json for ${networkName}\n`));

    return "ok";
  } catch (err) {
    console.error(chalk.red("❌ Deployment failed:\n"), err);
    return "back";
  }
}

// CLI standalone
if (require.main === module) {
  deployGovernance().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
