// lib/review.ts
import { ethers } from "ethers";
import {
  getGovernor,
  loadProposals,
  saveProposals,
  getProposalState,
  updateProposalState,
  networkProvider,
  uploadToPinata,
} from "../utils";
import { Review } from "./types";

export async function reviewProposalCore(
  proposalId: string,
  reviewerKey: string,
  rating: number,
  feedback: string,
  addresses: Record<string, string>,
  networkName: string) {

  // -----------------------------
  // Load local proposal
  // -----------------------------
  const proposals = loadProposals(networkName);
  const p = proposals.find((p) => p.proposalId === proposalId);
  if (!p) {
    console.log(chalk.red("⚠️ Proposal not found"));
    return "ok";
  }

  const wallet = new ethers.Wallet(reviewerKey, networkProvider);
  const governor = await getGovernor(addresses, wallet);
  const onChainState = await getProposalState(governor, proposalId);

  if (onChainState === "Pending") return onChainState;
  if (onChainState !== "Active" || feedback === "" ) {
    const update = updateProposalState(proposals, proposalId, onChainState);
    if (update === "successful") saveProposals(networkName, proposals);
    return `Proposal is in a ${onChainState} state`;
  }

  // -----------------------------
  // Submit review via Pinata + chain
  // -----------------------------
  const reviewData = {
    proposalId, reviewer: wallet.address, rating,
    feedback, timestamp: new Date().toISOString(),
  };
  
  const upload = await uploadToPinata(
    reviewData, proposalId, addresses, networkName,
    rating, reviewerKey
  );

  if ("state" in upload && upload.state === "failed") {
    return upload.error;
  }

  const { cid, cidHash, txHash } = upload

  // -----------------------------
  // Update local storage
  // -----------------------------
  const reviewer = `${reviewerKey.slice(0, 6)}...${reviewerKey.slice(-4)}`;
  const review: Review = {
    reviewer, rating, feedback, ipfsHash: cid, txHash,
    timestamp: new Date().toISOString(),
  };
  
  if (!p.reviews) p.reviews = [];
  p.reviews.push(review);

  // Compute safe numeric average and store as a Number rounded to 2 decimals
  const sum = p.reviews.reduce((acc, r) => {
    const rating = Number(r?.rating);            // coerce to number
    return acc + (Number.isFinite(rating) ? rating : 0); // ignore invalid ratings
  }, 0);

  const avgRaw = p.reviews.length ? (sum / p.reviews.length) : 0;
  p.averageScore = avgRaw.toFixed(2);

  saveProposals(networkName, proposals);
  return "successful";
}
