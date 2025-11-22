// fund-voters.js
require("dotenv").config();
const { ethers } = require("ethers");

// Amount required for each voter
const REQUIRED_BALANCE = "0.02";

// Load deployer key
const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) throw new Error("Missing PRIVATE_KEY in .env");

// Load voter keys
const voterKeysRaw = process.env.VOTER_KEYS;
if (!voterKeysRaw) throw new Error("Missing VOTER_KEYS in .env");

const voterPrivateKeys = voterKeysRaw
  .split(",")
  .map((k) => k.trim())
  .filter((k) => k.length > 0);

// Provider
const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_URL);

// Deployer wallet
const deployer = new ethers.Wallet(PRIVATE_KEY, provider);

// --------------------------
// Helpers
// --------------------------
function roundUp8(num) {
  return Math.ceil(num * 1e8) / 1e8;
}

function convertNumber(num) {
  return num
    .toFixed(18)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

// --------------------------
// Fund logic
// --------------------------
async function fundVoter(privateKey) {
  const wallet = new ethers.Wallet(privateKey, provider);
  const address = wallet.address;

  const keySlice = `${privateKey.slice(0, 6)}...${privateKey.slice(-4)}`;

  try {
    const balanceWei = await provider.getBalance(address);
    const balanceEth = parseFloat(ethers.formatEther(balanceWei));
    const required = parseFloat(REQUIRED_BALANCE);

    console.log(`\n💡 Checking voter key ${keySlice}`);
    console.log(`   ⭐ Address:   ${address}`);
    console.log(`   📦 Balance:   ${balanceEth.toFixed(18)} ETH`);

    const balRounded = roundUp8(balanceEth);
    const reqRounded = roundUp8(required);

    const diff = balRounded - reqRounded;

    // ---------------------------------------------
    // CASE 1: balance within safe margin, do nothing
    // ---------------------------------------------
    if (diff >= 0 && diff <= 0.000001) {
      console.log(`   👍 Recommended balance, no action required.`);
      return;
    }

    // ---------------------------------------------
    // CASE 2: Refund excess if any
    // ---------------------------------------------
    if (diff > 0.000001) {
      const excess = roundUp8(balanceEth - required);

      // Get current gas price
      const fee = await provider.getFeeData();
      const gasPriceWei = fee.gasPrice;

      if (!gasPriceWei) {
        throw new Error("Failed to fetch gas price from provider");
      }

      // Estimate gas (basic transfer)
      const gasLimit = 21000n;

      // Total fee in Wei
      const gasCostWei = gasLimit * gasPriceWei;

      // Convert to ETH
      const gasCostEth = parseFloat(ethers.formatEther(gasCostWei));

      // Minimum excess must be gas fee + 0.000001
      const requiredExcess = roundUp8(gasCostEth + 0.000001);
      if (excess < requiredExcess) {
        console.log(`   👍 Recommended balance, no action required.`);
        return;
      }

      // Safe refund amount ensuring at least requiredExcess remains
      const refundAmount = roundUp8(excess - requiredExcess);
      if (refundAmount <= 0) {
        console.log(`   👍 Recommended balance, no action required.`);
        return;
      }

      const refundAmountStr = convertNumber(refundAmount);

      console.log(`   ⛽ Gas price:  ${ethers.formatUnits(gasPriceWei, "gwei")} gwei`);
      console.log(`   ⛽ Gas cost:   ${gasCostEth.toFixed(18)} ETH`);
      console.log(`   ❗ Excess:     ${excess} ETH`);
      console.log(`   🚀 Refunding ${refundAmountStr} ETH back to deployer...`);

      const voterWallet = wallet.connect(provider);
      const txn = await voterWallet.sendTransaction({
        to: deployer.address,
        value: ethers.parseEther(refundAmountStr),
      });

      await txn.wait();

      console.log(`   🎉 Refunded successfully.`);
      console.log(`   🔐 Txn hash: ${txn.hash}`);
      return;
    }

    // ---------------------------------------------
    // CASE 3: Balance too low → send required top-up
    // ---------------------------------------------
    const needed = roundUp8(required - balanceEth);
    const neededStr = convertNumber(needed);

    console.log(`   ❗ Required:  ${neededStr} ETH`);
    console.log(`   🚀 Sending ${neededStr} ETH to ${address}`);

    const tx = await deployer.sendTransaction({
      to: address,
      value: ethers.parseEther(neededStr),
    });

    await tx.wait();
    console.log(`   🎉 Funded successfully.`);
    console.log(`   🔐 Txn hash: ${tx.hash}`);

  } catch (err) {
    console.error(`   ❌ Failed to process ${keySlice}:`, err.message);
  }
}

// --------------------------
// Main
// --------------------------
async function main() {
  console.log("💼 Funding voters using deployer:", await deployer.getAddress());
  console.log("🔑 Total voter private keys:", voterPrivateKeys.length);

  for (const pk of voterPrivateKeys) {
    await fundVoter(pk);
  }

  console.log("\n✔️  Done checking all voters.\n");
}

main();
