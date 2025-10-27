import { ethers } from "hardhat";
import fs from "fs";

async function main() {
  const addresses = JSON.parse(fs.readFileSync("addresses.json", "utf8"));
  const [deployer] = await ethers.getSigners();

  console.log("Deployer:", deployer.address);
  console.log("Treasury:", addresses.ORankTreasury);

  // Load contracts
  //const token = await ethers.getContractAt("ERC20Votes", addresses.ORankToken);
  const token = await ethers.getContractAt("ORankToken", addresses.ORankToken);

// Safer: check explicitly
if (typeof token.getVotes !== "function") {
  throw new Error("ABI mismatch: ORankToken artifact missing ERC20Votes methods");
}


  const governor = await ethers.getContractAt("ORankGovernor", addresses.ORankGovernor);

  // Delegate votes to self (if not already done)
  const delegateTx = await token.connect(deployer).delegate(deployer.address);
  await delegateTx.wait();
  console.log("Delegated voting power.");

  // Check voting power before proceeding
  const votes = await token.getVotes(deployer.address);
  console.log("Deployer voting power:", votes.toString());

  if (votes.eq(0)) {
    throw new Error("❌ Deployer has zero voting power. Cannot create proposals.");
  }

  // Encode mint() proposal to send ORK into the Treasury
  const amount = ethers.parseEther("1000");
  const calldata = token.interface.encodeFunctionData("mint", [
    addresses.ORankTreasury,
    amount,
  ]);
  const description = "Mint 1000 ORK into the Treasury";

  // Submit proposal
  const proposeTx = await governor.propose(
    [addresses.ORankToken],
    [0],
    [calldata],
    description
  );
  const proposeReceipt = await proposeTx.wait();
  console.log("Propose tx mined in block:", proposeReceipt.blockNumber);

  // Try to get ProposalCreated from queryFilter
  const currentBlock = proposeReceipt.blockNumber ?? (await ethers.provider.getBlockNumber());
  const startBlock = currentBlock > 50 ? currentBlock - 50 : 0;
  const filter = governor.filters.ProposalCreated();
  const events = await governor.queryFilter(filter, startBlock, "latest");

  let proposalId;
  if (events.length > 0) {
    proposalId = events[events.length - 1].args.proposalId;
    console.log("✅ Proposal created with ID (via filter):", proposalId.toString());
  } else {
    console.warn("⚠️ ProposalCreated not found in queryFilter, falling back to logs…");
    // Manual log scan
    for (const log of proposeReceipt.logs) {
      try {
        const parsed = governor.interface.parseLog(log);
        if (parsed.name === "ProposalCreated") {
          proposalId = parsed.args.proposalId;
          console.log("✅ Proposal created with ID (via logs):", proposalId.toString());
          break;
        }
      } catch {}
    }
  }

  if (!proposalId) {
    console.log("Raw logs for debugging:", proposeReceipt.logs);
    throw new Error("❌ ProposalCreated event not found in both filter and logs");
  }

  // Cast vote
  const voteTx = await governor.castVote(proposalId, 1); // 1 = For
  await voteTx.wait();
  console.log("Voted FOR proposal.");

  // Advance blocks for voting delay + voting period
  await ethers.provider.send("evm_mine", []);
  for (let i = 0; i < 10; i++) {
    await ethers.provider.send("evm_mine", []);
  }

  // Queue
  const descriptionHash = ethers.id(description);
  const queueTx = await governor.queue(
    [addresses.ORankToken],
    [0],
    [calldata],
    descriptionHash
  );
  await queueTx.wait();
  console.log("Proposal queued.");

  // Mine timelock delay
  for (let i = 0; i < 5; i++) {
    await ethers.provider.send("evm_mine", []);
  }

  // Execute
  const execTx = await governor.execute(
    [addresses.ORankToken],
    [0],
    [calldata],
    descriptionHash
  );
  await execTx.wait();
  console.log("✅ Proposal executed.");

  // Check Treasury balance
  const balance = await token.balanceOf(addresses.ORankTreasury);
  console.log("Treasury ORK balance:", balance.toString());
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exitCode = 1;
});
