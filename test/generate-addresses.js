const secp = require("ethereum-cryptography/secp256k1");
const { keccak256 } = require("ethereum-cryptography/keccak");
const { toHex } = require("ethereum-cryptography/utils");

// Convert public key to Ethereum-style address
function pubKeyToAddress(publicKey) {
  const hash = keccak256(publicKey.slice(1)); // drop 0x04 prefix
  return "0x" + toHex(hash.slice(-20)); // last 20 bytes
}

// Hardcoded list of private keys
const privateKeys = [
  "0x3457f25baa23f539177c09ce78f0738313bcf62aeed796938c4e66d779cf19da",
  "0x4304da5e201723fb39753567c3c6d8d4318378e9c07a6f22eb72466ffdab9563"
  // Add more keys here
];

// Generate addresses
privateKeys.forEach((privHex, i) => {
  try {
    const publicKey = secp.getPublicKey(privHex);
    const address = pubKeyToAddress(publicKey);
    console.log(`Private Key ${i + 1}: ${privHex}`);
    console.log(`Address ${i + 1}:     ${address}\n`);
  } catch (err) {
    console.error(`❌ Invalid private key at index ${i}: ${privHex}`);
  }
});
