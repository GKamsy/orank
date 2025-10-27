// lib/votes.ts
import { ethers } from "hardhat";
import {
  getGovernor,
  loadProposals,
  saveProposals,
  getProposalState,
  updateProposalState,
  networkProvider,
  uploadToPinata,
} from "../utils";

export async function castVoteCore(
  proposalId: string,
  voterKey: string,
  voteType: number,
  feedback: string,
  addresses: Record<string, string>,
  networkName: string
) {
  // -----------------------------
  // Load local proposal
  // -----------------------------
  const proposals = loadProposals(networkName);
  const p = proposals.find((p) => p.proposalId === proposalId);
  if (!p) return "not-found";

  const voter = `${voterKey.slice(0, 6)}...${voterKey.slice(-4)}`;
  const wallet = new ethers.Wallet(voterKey, networkProvider);
  const governor = await getGovernor(addresses, wallet);
  const onChainState = await getProposalState(governor, proposalId);

  if (onChainState === "Pending") return onChainState;
  if (onChainState !== "Active" || feedback === "" ) {
    const update = updateProposalState(proposals, proposalId, onChainState);
    if (update === "successful") saveProposals(networkName, proposals);
    return `Proposal is in a ${onChainState} state`;
  }

  // -----------------------------
  // Prepare metadata for upload
  // -----------------------------
  const metadata = {
    type: "vote",
    proposalId,
    voter,
    choice: voteType,
    feedback,
    timestamp: new Date().toISOString(),
  };

  const upload = await uploadToPinata(
    metadata,
    proposalId,
    addresses,
    networkName,
    voteType,
    voterKey
  );

  if ("state" in upload && upload.state === "failed") {
    return upload.error;
  }

  // -----------------------------
  // Record vote metadata locally
  // -----------------------------
  p.votes[voter] = {
    choice: voteType,
    feedback,
    metadataCid: upload.cid,
    metadataHash: upload.cidHash,
    signature: upload.signature,
    txHash: upload.txHash,
  };

  // -----------------------------
  // Update proposal state locally
  // -----------------------------
  const update = await updateProposalState(proposals, proposalId, onChainState);
  if (update === "successful") saveProposals(networkName, proposals);
  return update;
}
