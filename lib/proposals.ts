// lib/proposals.ts
import { ethers } from "hardhat";
import inquirer from "inquirer";
import chalk from "chalk";
import {
  getGovernor,
  descriptionHash,
  loadProposals,
  saveProposals,
  updateGrantStatus,
  networkProvider,
} from "../utils";
import { Proposal, SubmittedGrant } from "./types";

export async function buildProposalData(
  grant: SubmittedGrant,
  addresses: Record<string, string>
) {
  const treasury = addresses.ORankTreasury;

  const iface = new ethers.Interface([
    "function releaseGrant(bytes32 grantId, address recipient)",
  ]);

  const calldata = [
    iface.encodeFunctionData("releaseGrant", [
      grant.grantId,
      grant.metadata.applicant,
    ]),
  ];

  const targets = [treasury];
  const values = [0];

  return { targets, values, calldata };
}

/**
 * Create a proposal through the ORankGovernor contract.
 * Properly detects the indexed ProposalCreated event introduced in OZ Governor v5.
 */
export async function createProposal(
  proposalData: {
    grantId: string;
    grantName: string;
    description: string;
    targets: string[];
    values: number[];
    calldata: string[];
  },
  proposerKey: string,
  addresses: Record<string, string>,
  networkName: string
): Promise<Proposal> {
  const wallet = new ethers.Wallet(proposerKey, networkProvider);
  const governor = await getGovernor(addresses, wallet);

  console.log("✔ Proposer:", wallet.address);
  console.log(
    "✔ Balance:",
    ethers.formatEther(await networkProvider.getBalance(wallet.address))
  );

  console.log(chalk.yellow("Submitting proposal..."));
  const tx = await governor.propose(
    proposalData.targets,
    proposalData.values,
    proposalData.calldata,
    proposalData.description
  );

  const receipt = await tx.wait();
  let proposalId: string | undefined;

  // -----------------------------
  // Decode event safely
  // -----------------------------
  try {
    const parsed = receipt.logs
      .map((log) => {
        try {
          return governor.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .filter((e) => e && e.name === "ProposalCreated")[0];

    if (parsed) {
      proposalId = parsed.args?.proposalId?.toString();
      console.log("✔ Found ProposalCreated event:", proposalId);
    } else {
      throw new Error("No ProposalCreated event found");
    }
  } catch (err) {
    console.warn("⚠️ Could not decode ProposalCreated event:", err);
    console.log(receipt.logs);
    throw err;
  }

  // -----------------------------
  // Save proposal locally
  // -----------------------------
  const proposals = loadProposals(networkName);
  const newProposal: Proposal = {
    id: proposals.length + 1,
    name: proposalData.grantName,
    proposalId,
    description: proposalData.description,
    state: "Pending",
    targets: proposalData.targets,
    values: proposalData.values,
    calldata: proposalData.calldata,
    votes: {},
    reviews: [],
    stateHistory: [
      {
        state: "Created",
        timestamp: new Date().toISOString(),
      },
    ],
  };

  proposals.push(newProposal);
  saveProposals(networkName, proposals);
  updateGrantStatus(networkName, proposalData.grantId, { state: "Proposed" });

  console.log(chalk.green(`✔ Proposal created successfully with ID ${proposalId}\n`));
  return newProposal;
}
