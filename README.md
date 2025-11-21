# ORANK Project 
 by Goodwell Kamwendo

This is a blockchain-based governance ranking protocol built with Hardhat, Ethers.js, and TypeScript. It provides a foundation for DAOs to automate ranking, verify proposal outcomes, and maintain trustworthy governance records on the EVM chain. This ensures transparent proposal evaluation, verifiable voting, and on-chain accountability.

DAO governance often lacks verifiable ranking and transparent verification mechanisms. Voting systems are frequently off-chain or opaque. ORank addresses this by providing **on-chain voting** with verification logic, **automatic ranking** via proposal queue, and immutable **result tracking**. I can proudly assure you that the project can be easily integrated into the education and research systems.


# Prequisites
**Before doing anything else, make sure that you have the following:**
1. MetaMask wallet from https://metamask.io for storing coins.
2. Router address from https://www.alchemy.com for project identification.
3. IPFS account from https://app.pinata.cloud for uploading data.


**This will enable you to have the following:**
1. PUBLIC KEY: Your wallet address from the MetaMask wallet.
2. PRIVATE KEY: Your wallet private key from the MetaMask wallet.
3. PROJECT URL: Your Alchemy project address.
4. IPFS API KEY: Your PINATA API key.
5. IPFS SECRET KEY: Your PINATA secret API key.
6. IPFS GATEWAY: Your PINATA private gateway.


# Installation
**Run the following commands on your terminal/shell to install this project (Press Ctr + Alt + T to open the terminal):**
```
sudo apt-get install nodejs npm
git clone https://github.com/GKamsy/orank.git
cd orank
npm install --save-dev $(cat dev-dependencies.txt)
npm install $(cat prod-dependencies.txt)
npx hardhat compile
npm shrinkwrap
```

# Environmental Setup
**Use the following websites to claim faucets for testing:**
1. https://cloud.google.com/application/web3/faucet/ethereum/sepolia
2. https://faucet.metana.io
3. https://www.alchemy.com/faucets/ethereum-sepolia

**Run the following commands on your terminal (shell) to set up the project. You must have at least 0.2 SepoliaETH in your MetaMask wallet.**
```
node generate-voters.js
node fund-voters.js
npx hardhat run index.ts --network sepolia


```
