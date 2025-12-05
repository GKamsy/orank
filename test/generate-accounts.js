// generate-accounts.js
const secp = require("ethereum-cryptography/secp256k1");
const { keccak256 } = require("ethereum-cryptography/keccak");
const { toHex } = require("ethereum-cryptography/utils");

// Convert public key to Ethereum-style address
function pubKeyToAddress(publicKey) {
  const hash = keccak256(publicKey.slice(1)); // remove 0x04 prefix
  return "0x" + toHex(hash.slice(-20));
}

// Generate n accounts
function generateAccounts(n = 5) {
  const accounts = [];
  for (let i = 0; i < n; i++) {
    const privateKey = secp.utils.randomPrivateKey();
    const publicKey = secp.getPublicKey(privateKey);
    const address = pubKeyToAddress(publicKey);
    accounts.push({
      privateKey: toHex(privateKey),
      address,
    });
  }
  return accounts;
}

// Print accounts
const accounts = generateAccounts(5);
console.log("Generated Test Accounts:");
accounts.forEach((acc, i) => {
  console.log(`${i + 1}. Address: ${acc.address}`);
  console.log(`   Private Key: ${acc.privateKey}\n`);
});
