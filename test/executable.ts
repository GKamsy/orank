import { ethers } from "hardhat";
import hre from "hardhat";
import { loadAddresses, loadProposals, getGovernor, getProposalState } from "./utils";

// Minimal ERC20 ABI for balanceOf
const erc20Abi = ["function balanceOf(address) view returns (uint256)"];

async function main() {
  const networkName = hre.network.name;
  const addresses = loadAddresses(networkName);
  const proposals = loadProposals(networkName);

  if (proposals.length === 0) {
    console.log("⚠️ No proposals found.");
    return;
  }

  const governor = await getGovernor(addresses);
  const treasury = addresses.Treasury;
  if (!treasury) throw new Error(`❌ Treasury address ${treasury} not set in addresses.json`);

  console.log(`🔍 Checking treasury balances before execution...`);
  console.log(`Treasury: ${treasury}`);

  for (const proposal of proposals) {
    const state = await getProposalState(governor, proposal.proposalId);
    if (state !== "Succeeded" && state !== "Queued") continue;

    console.log(`\n📝 Proposal ${proposal.id} (state: ${state})`);

    // Loop through each target in the proposal
    for (let i = 0; i < proposal.targets.length; i++) {
      const target = proposal.targets[i];
      const calldata = proposal.calldatas[i];

      // Example: decode createEscrow(bytes32,address,address,uint256,uint256[])
      // Adjust ABI to match your contract
      const iface = new ethers.Interface([
        "function createEscrow(bytes32 grantId,address payee,address token,uint256 totalAmount,uint256[] tranches)"
      ]);

      try {
        const decoded = iface.decodeFunctionData("createEscrow", calldata);
        const token = decoded.token;
        const totalAmount = decoded.totalAmount;

        const erc20 = new ethers.Contract(token, erc20Abi, ethers.provider);
        const bal = await erc20.balanceOf(treasury);

        if (bal.lt(totalAmount)) {
          console.log(
            `❌ Insufficient funds for token ${token}. Required: ${ethers.formatUnits(totalAmount, 18)}, Treasury: ${ethers.formatUnits(bal, 18)}`
          );
        } else {
          console.log(
            `✅ Sufficient funds for token ${token}. Required: ${ethers.formatUnits(totalAmount, 18)}, Treasury: ${ethers.formatUnits(bal, 18)}`
          );
        }
      } catch (err) {
        console.log(`ℹ️ Could not decode calldata at index ${i}, skipping check.`);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
