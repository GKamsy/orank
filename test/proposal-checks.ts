import { ethers } from "hardhat";
import { expect } from "chai";
import {
  parseEvents,
  snapshotProposalState,
  compareStates
} from "../utils/proposalUtils";

describe("Proposal lifecycle with snapshot comparisons", function () {
  let governor: any;
  let token: any;
  let escrow: any;
  let proposer: any, voter: any, payee: any;

  beforeEach(async () => {
    const accounts = await ethers.getSigners();
    [proposer, voter, payee] = accounts;

    const Token = await ethers.getContractFactory("ORankToken");
    token = await Token.deploy(
	  "ORank Token",   // name
	  "ORK",           // symbol
	  ethers.parseEther("1000000"), // maxSupply = 1,000,000 tokens
	  ethers.parseEther("1000")     // initialSeed = 1,000 tokens minted to deployer
    );
    await token.waitForDeployment();
    await token.mint(voter.address, ethers.parseEther("1000"));

    const Escrow = await ethers.getContractFactory("ORankTreasury");
    escrow = await Escrow.deploy();
    await escrow.waitForDeployment();

    const Governor = await ethers.getContractFactory("ORankGovernor");
	governor = await Governor.deploy(
		tokenAddress,
		timelockAddress,
		votingDelay,
		votingPeriod,
		proposalThreshold,
		quorumFraction);
    await governor.waitForDeployment();
  });

  it("compares state before and after execution", async () => {
    const targets = [governor.target, escrow.target];
    const values = [0, 0];

    const markApprovedCalldata = governor.interface.encodeFunctionData(
      "markApproved",
      [ethers.id("grant1"), 1n]
    );
    const createEscrowCalldata = escrow.interface.encodeFunctionData(
      "createEscrow",
      [ethers.id("grant1"), payee.address, token.target, ethers.parseEther("100"), [10, 20]]
    );
    const calldatas = [markApprovedCalldata, createEscrowCalldata];
    const description = "Proposal: approve and create escrow";

    // Propose
    const proposeTx = await governor.connect(proposer).propose(
      targets,
      values,
      calldatas,
      description
    );
    const proposeReceipt = await proposeTx.wait();
    const proposalId = proposeReceipt.logs[0].args.proposalId;

    // Vote
    await governor.connect(voter).castVote(proposalId, 1);
    await ethers.provider.send("evm_increaseTime", [7 * 24 * 3600]);
    await ethers.provider.send("evm_mine", []);

    // Snapshot BEFORE queue
    const beforeQueue = await snapshotProposalState(governor, escrow, proposalId, "grant1");

    // Queue
    const queueTx = await governor.queue(targets, values, calldatas, ethers.id(description));
    const queueReceipt = await queueTx.wait();
    console.log("Queue events:", parseEvents(queueReceipt, governor.interface, ["ProposalQueued"]));

    // Snapshot BEFORE execution
    const beforeExec = await snapshotProposalState(governor, escrow, proposalId, "grant1");

    // Execute
    const execTx = await governor.execute(targets, values, calldatas, ethers.id(description));
    const execReceipt = await execTx.wait();
    console.log("Exec events:", parseEvents(execReceipt, governor.interface, ["ProposalExecuted"]));

    // Snapshot AFTER execution
    const afterExec = await snapshotProposalState(governor, escrow, proposalId, "grant1");

    // Compare snapshots
    compareStates(beforeQueue, beforeExec);
    compareStates(beforeExec, afterExec);

    // Assertions
    expect(afterExec.state).to.equal(7); // Executed
    expect(afterExec.escrowInfo.payee).to.equal(payee.address);
  });
});
