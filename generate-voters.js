// generate-accounts.js
const fs = require("fs");
const path = require("path");
const { randomBytes } = require("crypto");
const { secp256k1 } = require("ethereum-cryptography/secp256k1");
const { keccak256 } = require("ethereum-cryptography/keccak");
const { toHex } = require("ethereum-cryptography/utils");

// --- Generate Ethereum-style address ---
function pubKeyToAddress(publicKey) {
  const hash = keccak256(publicKey.slice(1)); // remove 0x04 prefix
  return "0x" + toHex(hash.slice(-20));
}

// --- Generate accounts ---
function generateAccounts(n = 5) {
  const accounts = [];
  for (let i = 0; i < n; i++) {
    const privateKey = randomBytes(32);
    const publicKey = secp256k1.getPublicKey(privateKey);
    const address = pubKeyToAddress(publicKey);
    accounts.push({
      privateKey: toHex(privateKey),
      address,
    });
  }
  return accounts;
}

// --- Update .env file ---
function updateEnvFile(voterKeys) {
  const envPath = path.resolve(__dirname, ".env");
  let envContent = "";

  try {
    envContent = fs.readFileSync(envPath, "utf8");
  } catch (err) {
    console.warn(".env not found.");
  }

  const newLine = `VOTER_KEYS=${voterKeys.join(",")}`;
  const regex = /^VOTER_KEYS=(.*)$/m; // capture current value if exists
  let updated = false;

  const match = envContent.match(regex);

  if (match) {
    const currentValue = match[1].trim();

    // Only replace if it's the placeholder or empty
    if (currentValue === "generated_for_testing" || currentValue === "") {
      envContent = envContent.replace(regex, newLine);
      updated = true;
    } else {
      console.log("✔ Voter Keys already set — no changes made.");
    }
  }/* else {
    // append new line if not found
    if (!envContent.endsWith("\n")) envContent += "\n";
    envContent += newLine + "\n";
    updated = true;
  }*/

  if (updated) {
    fs.writeFileSync(envPath, envContent, "utf8");
    console.log(`✔ Updated .env with ${voterKeys.length} voter keys.`);
  }
}

// --- Run ---
const accounts = generateAccounts(5);
const privateKeys = accounts.map(acc => acc.privateKey);
updateEnvFile(privateKeys);
