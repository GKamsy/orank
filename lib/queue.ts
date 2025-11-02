// lib/queue.ts
import { ethers } from "hardhat";
import axios from "axios";
import chalk from "chalk";
import {
  getGovernor,
  descriptionHash,
  loadProposals,
  networkProvider,
  updateProposalState,
  saveProposals,
  verifyUpload,
} from "../utils";

function toBigInt(x: any): bigint {
  if (typeof x === "bigint") return x;
  if (x && typeof x.toBigInt === "function") return x.toBigInt(); // ethers v5 BigNumber
  return BigInt(x);
}

export async function queueProposalCore(
  proposalId: string,
  description: string,
  queuerKey: string,
  targets: Record<string, string>,
  values: Record<number, number>,
  calldata: Record<string, string>,
  addresses: Record<string, string>,
  networkName: string) {
  // -----------------------------
  // Setup and load proposal
  // -----------------------------
  const wallet = new ethers.Wallet(queuerKey, networkProvider);
  const governor = await getGovernor(addresses, wallet);
  const descHash = descriptionHash(description);

  const proposals = loadProposals(networkName);
  const p = proposals.find((x) => x.proposalId === proposalId);
  if (!p) {
    console.log(`⚠️ Proposal ${proposalId} not found locally.`);
    return "not-found";
  }

  try {
    //const currentBlock = await ethers.provider.getBlockNumber();
    const currentBlock = (await ethers.provider.getBlockNumber()) - 1;

    // -----------------------------
    // STEP 1: Verify all votes’ metadata (with caching)
    // -----------------------------
    if (p.votes && Object.keys(p.votes).length > 0) {
      console.log(chalk.yellow(`\n⚙️ Checking ${Object.keys(p.votes).length} votes...`));
      for (const [voter, vote] of Object.entries(p.votes)) {
        if (!vote.metadataCid) continue;

        const skip =
          vote.verified === true &&
          vote.metadataCid === vote.lastVerifiedCid &&
          vote.verifiedBlock &&
          vote.verifiedBlock >= currentBlock - 10000; // Optional: reverify every ~10k blocks

        if (skip) {
          console.log(chalk.gray(`⏩ Skipped re-verification for ${voter} (cached)`));
          continue;
        }

        const result = await verifyUpload(vote.metadataCid);
        p.votes[voter].verified = result.valid;
        p.votes[voter].signer = result.signer;
        p.votes[voter].recovered = result.recovered;
        p.votes[voter].verificationError = result.error || null;
        p.votes[voter].verifiedAt = new Date().toISOString();
        p.votes[voter].verifiedBlock = currentBlock;
        p.votes[voter].lastVerifiedCid = vote.metadataCid;

        if (!result.valid) {
          console.log(
            chalk.red(`❌ Vote from ${voter} failed verification:`),
            result.error || "Unknown reason"
          );
        } else {
          console.log(chalk.green(`✔ Verified vote from ${voter} (${result.signer})`));
        }
      }
    }

    // -----------------------------
    // STEP 2: Verify reviews (with caching)
    // -----------------------------
    if (p.reviews && Array.isArray(p.reviews) && p.reviews.length > 0) {
      console.log(chalk.yellow(`⚙️ Checking ${p.reviews.length} reviews...`));
      for (const r of p.reviews) {
        if (!r.ipfsHash) {
          console.log(chalk.red(`⚙️ ipfsHash not found in this review.`));
          continue;
        }

        const skip =
          r.verified === true &&
          r.ipfsHash === r.lastVerifiedCid &&
          r.verifiedBlock &&
          r.verifiedBlock >= currentBlock - 10000;

        if (skip) {
          console.log(
            chalk.gray(`⏩ Skipped re-verification for review by ${r.reviewer || "unknown"} (cached)`)
          );
          continue;
        }

        const result = await verifyUpload(r.ipfsHash);
        r.verified = result.valid;
        r.signer = result.signer;
        r.recovered = result.recovered;
        r.verificationError = result.error || null;
        r.verifiedAt = new Date().toISOString();
        r.verifiedBlock = currentBlock;
        r.lastVerifiedCid = r.ipfsHash;

        if (!result.valid) {
          console.log(
            chalk.red(`❌ Review from ${r.reviewer || "unknown"} failed verification:`),
            result.error || "Unknown reason"
          );
        } else {
          console.log(
            chalk.green(`✔ Verified review from ${r.reviewer || "unknown"} (${result.signer})`)
          );
        }
      }
    }

    // -----------------------------
    // STEP 3: Calculate quorum & majority using verified votes (with on-chain fallback)
    // -----------------------------
    const allVotes = Object.values(p.votes || {});
    const verifiedVotes = allVotes.filter((v: any) => v.verified);

    let av = 0n,
      fv = 0n,
      ab = 0n;

    if (verifiedVotes.length > 0) {
      av = BigInt(verifiedVotes.filter((v: any) => v.choice === 0).length);
      fv = BigInt(verifiedVotes.filter((v: any) => v.choice === 1).length);
      ab = BigInt(verifiedVotes.filter((v: any) => v.choice === 2).length);
    } else {
      console.log(chalk.gray("⚙️ No verified off-chain votes found — using on-chain tallies."));
      const { againstVotes, forVotes, abstainVotes } = await governor.proposalVotes(proposalId);
      av = toBigInt(againstVotes);
      fv = toBigInt(forVotes);
      ab = toBigInt(abstainVotes);
    }

    const quorum = await governor.quorum(currentBlock);
    const q = toBigInt(quorum);

    const totalVotes = av + fv + ab;
    const downVotes = av + ab;
    const quorumMet = totalVotes >= q;
    const majorityPassed = fv > downVotes;

    // -----------------------------
    // STEP 4: Record analytics and cache verification results
    // -----------------------------
    const verifiedCount = verifiedVotes.length;
    const totalCount = allVotes.length;
    const verifiedPct = totalCount > 0 ? (verifiedCount / totalCount) * 100 : 0;

    p.analytics = {
      quorum: q.toString(),
      forVotes: fv.toString(),
      againstVotes: av.toString(),
      abstainVotes: ab.toString(),
      totalVotes: totalVotes.toString(),
      //quorumMet,
      majorityPassed,
      verifiedVotes: verifiedCount,
      totalVotesRecorded: totalCount,
      verifiedPercentage: `${verifiedPct.toFixed(1)}%`,
      lastCheckedBlock: currentBlock,
      lastCheckedAt: new Date().toISOString(),
    };

    // -----------------------------
    // STEP 5: Validate quorum & majority
    if (!majorityPassed) {
      const update = updateProposalState(proposals, proposalId, "Defeated");
      if (update === "successful") saveProposals(networkName, proposals);
      return "Defeated";
    }

    // -----------------------------
    // STEP 6: Queue proposal on-chain
    // -----------------------------
    const tx = await governor.queue(targets, values, calldata, descHash);
    const receipt = await tx.wait();

    // -----------------------------
    // STEP 7: Update local state & persist cached verification
    // -----------------------------
    const update = updateProposalState(proposals, proposalId, "Queued");
    if (update === "successful") saveProposals(networkName, proposals);
    return update;
  } catch (err: any) {
    return err.message;
  }
}
