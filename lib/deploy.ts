import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

/**
 * Deploys the governance stack and returns deployed addresses.
 */
export async function deployGovernanceStack(devMode: boolean, networkName: string) {
  const [deployer] = await ethers.getSigners();

  // 1. Deploy ORankToken
  const Token = await ethers.getContractFactory("ORankToken");
  const token = await Token.deploy(
    "ORank Token",
    "ORK",
    ethers.parseEther("1000000"), // MAX_SUPPLY
    devMode ? ethers.parseEther("1000") : 0 // seed in devMode
  );
  await token.waitForDeployment();
  if (devMode) {
    await (await token.delegate(deployer.address)).wait();
  }

  // 2. Deploy Timelock
  const minDelay = devMode ? 1 : 86400;
  const Timelock = await ethers.getContractFactory("TimelockController");
  const timelock = await Timelock.deploy(minDelay, [], [], deployer.address);
  await timelock.waitForDeployment();

  // 3. Deploy GrantRegistry
  const Registry = await ethers.getContractFactory("GrantRegistry");
  const registry = await Registry.deploy(await timelock.getAddress());
  await registry.waitForDeployment();

  // 4. Deploy Treasury
  const Treasury = await ethers.getContractFactory("ORankTreasury");
  const treasury = await Treasury.deploy(await timelock.getAddress());
  await treasury.waitForDeployment();

  // 5. Deploy PeerReview
  const PeerReview = await ethers.getContractFactory("PeerReview");
  const peerReview = await PeerReview.deploy(await token.getAddress());
  await peerReview.waitForDeployment();

  // 6. Deploy Governor
  const votingDelay = devMode ? 1 : 10;
  const votingPeriod = devMode ? 100 : 45818;
  const proposalThreshold = ethers.parseEther(devMode ? "1" : "100");
  const quorumFraction = 4;

  const Governor = await ethers.getContractFactory("ORankGovernor");
  const governor = await Governor.deploy(
    await token.getAddress(),
    await timelock.getAddress(),
    votingDelay,
    votingPeriod,
    proposalThreshold,
    quorumFraction
  );
  await governor.waitForDeployment();

  // 7. Setup Roles
  const proposerRole = await timelock.PROPOSER_ROLE();
  const executorRole = await timelock.EXECUTOR_ROLE();
  const adminRole = await timelock.DEFAULT_ADMIN_ROLE();

  await (await timelock.grantRole(proposerRole, await governor.getAddress())).wait();
  await (await timelock.grantRole(executorRole, ethers.ZeroAddress)).wait();

  if (!devMode) {
    const hasAdmin = await timelock.hasRole(adminRole, deployer.address);
    if (hasAdmin) {
      await (await timelock.revokeRole(adminRole, deployer.address)).wait();
    }
  }

  // Transfer PeerReview ownership to Timelock
  await (await peerReview.transferOwnership(await timelock.getAddress())).wait();

  // Return addresses
  return {
    ORankToken: await token.getAddress(),
    Timelock: await timelock.getAddress(),
    ORankGovernor: await governor.getAddress(),
    GrantRegistry: await registry.getAddress(),
    ORankTreasury: await treasury.getAddress(),
    PeerReview: await peerReview.getAddress(),
  };
}

/**
 * Save addresses.json for the given network.
 */
export function saveAddresses(networkName: string, addresses: Record<string, string>) {
  const filePath = path.join(__dirname, "../data/addresses.json");

  let all: Record<string, any> = {};
  if (fs.existsSync(filePath)) {
    all = JSON.parse(fs.readFileSync(filePath, "utf8"));
  }

  all[networkName] = addresses;
  fs.writeFileSync(filePath, JSON.stringify(all, null, 2));
}
