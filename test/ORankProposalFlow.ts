import { ethers } from "hardhat";
import { expect } from "chai";
import { ORankToken, ORankGovernor, GrantRegistry, ORankTreasury } from "../typechain-types";

describe("ORank Governance Flow", function () {
  let token: ORankToken;
  let governor: ORankGovernor;
  let grantRegistry: GrantRegistry;
  let treasury: ORankTreasury;

  let deployer: any;
  let voter1: any;
  let recipient: string;

  const proposalIdNum = 1;
  const escrowAmount = ethers.parseEther("100");

  beforeEach(async function () {
    [deployer, voter1] = await ethers.getSigners();
    recipient = voter1.address;

    // --- Deploy Token ---
    const Token = await ethers.getContractFactory("ORankToken");
    token = (await Token.deploy()) as ORankToken;
    await token.waitForDeployment();

    // Mint tokens to voter
    await token.mint(voter1.address, ethers.parseEther("1000"));
    // Delegate voting power to self
    await token.connect(voter1).delegate(voter1.address);

    // --- Deploy Treasury ---
    const Treasury = await ethers.getContractFactory("ORankTreasury");
    treasury = (await Treasury.deploy()) as ORankTreasury;
    await treasury.waitForDeployment();

    // --- Deploy GrantRegistry ---
    const Registry = await ethers.getContractFactory("GrantRegistry");
    grantRegistry = (await Registry.deploy()) as GrantRegistry;
    await grantRegistry.waitForDeployment();

    // --- Deploy Governor ---
    const Governor = await ethers.getContractFactory("ORankGovernor");
    governor = (await Governor.deploy(
      token.getAddress(),
      treasury.getAddress(),
      grantRegistry.getAddress()
    )) as ORankGovernor;
    await governor.waitForDeployment();

    // Transfer ownerships if needed
    await treasury.transferOwnership(governor.getAddress());
    await grantRegistry.transferOwnership(governor.getAddress());
  });

  it("should run full governance lifecycle", async function () {
    // --- Encode Proposal ---
    const markApprovedCalldata = grantRegistry.interface.encodeFunctionData("markApproved", [proposalIdNum]);
    const createEscrowCalldata = treasury.interface.encodeFunctionData("createEscrow", [
      proposalIdNum,
      recipient,
      escrowAmount,
    ]);

    const targets = [await grantRegistry.getAddress(), await treasury.getAddress()];
    const values = [0, 0];
    const calldatas = [markApprovedCalldata, createEscrowCalldata];
    const description = `Proposal #${proposalIdNum}: Approve grant + create escrow`;
    const descriptionHash = ethers.id(description);

    // --- Propose ---
    const proposeTx = await governor.connect(voter1).propose(targets, values, calldatas, description);
    const proposeReceipt = await proposeTx.wait();
    const proposalId = proposeReceipt.logs
      .map((log: any) => {
        try {
          return governor.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .filter((e: any) => e && e.name === "ProposalCreated")[0].args.proposalId;

    expect(proposalId).to.not.equal(0);

    // Move forward to start voting
    await ethers.provider.send("evm_mine", []); // mine 1 block

    // --- Vote ---
    const voteTx = await governor.connect(voter1).castVoteWithReason(proposalId, 1, "Research is good");
    await voteTx.wait();

    // Fast-forward beyond voting period
    for (let i = 0; i < 20; i++) {
      await ethers.provider.send("evm_mine", []);
    }

    // Verify proposal succeeded
    const stateSucceeded = await governor.state(proposalId);
    expect(stateSucceeded).to.equal(4); // 4 = Succeeded

    // --- Queue ---
    const queueTx = await governor.queue(targets, values, calldatas, descriptionHash);
    await queueTx.wait();

    // Simulate timelock delay
    await ethers.provider.send("evm_increaseTime", [3600]);
    await ethers.provider.send("evm_mine", []);

    // --- Execute ---
    const execTx = await governor.execute(targets, values, calldatas, descriptionHash);
    await execTx.wait();

    // --- Validate outcomes ---
    const proposal = await grantRegistry.getProposal(proposalIdNum);
    expect(proposal.approved).to.be.true;

    const escrow = await treasury.escrows(proposalIdNum);
    expect(escrow.recipient).to.equal(recipient);
    expect(escrow.amount).to.equal(escrowAmount);
  });
});
