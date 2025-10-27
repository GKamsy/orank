import { ethers } from "hardhat";
import { getGovernor, descriptionHash, loadProposals,
  networkProvider, updateProposalState, saveProposals } from "../utils";

export async function executeProposalCore(
  proposalId: string,
  description: string,
  executerKey: string,
  targets: Record<string, string>,
  values: Record<number, number>,
  calldata: Record<string, string>,
  addresses: Record<string, string>,
  networkName: string) {

  // -----------------------------
  // Queue a proposal
  // -----------------------------
  const wallet = new ethers.Wallet(executerKey, networkProvider);
  const governor = await getGovernor(addresses, wallet);
  const descHash = descriptionHash(description);
  const tx = await governor.execute(targets, values, calldata, descHash);
  await tx.wait();

  // --------------------------------
  // Update a local proposal state
  // --------------------------------
  const proposals = loadProposals(networkName);
  const update = await updateProposalState(proposals, proposalId, "Executed");
  if(update === "successful") saveProposals(networkName, proposals);
  return update;
}
