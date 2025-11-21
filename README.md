# ORANK Project 
 by Goodwell Kamwendo

This is a blockchain-based governance ranking protocol built with Hardhat, Ethers.js, and TypeScript. It provides a foundation for DAOs to automate ranking, verify proposal outcomes, and maintain trustworthy governance records on the EVM chain. This ensures transparent proposal evaluation, verifiable voting, and on-chain accountability.

DAO governance often lacks verifiable ranking and transparent verification mechanisms. Voting systems are frequently off-chain or opaque. ORank addresses this by providing **on-chain voting** with verification logic, **automatic ranking** via proposal queue, and immutable **result tracking**. I can proudly assure you that the project can be easily integrated into the education and research systems.



# Prequisties
**Before doing anything else, make sure that you have the following:**

 1. MetaMask wallet from https://metamask.io for storing coins.

 2. Router address from https://eth-sepolia.g.alchemy.com for project identification.

 3. IPFS account from https://app.pinata.cloud for uploading data.



**This will enable you to have the following:**

 a. PUBLIC KEY: Your wallet address from MetaMask wallet.

 b. PRIVATE KEY: Your wallet private key from MetaMask wallet.

 c. PROJECT URL: Your project address from the router address.

 d. IPFS API KEY: Your IPFS API key from PINATA.

 e. IPFS SECRET KEY: Your IPFS secret API key from PINATA.

 f. IPFS GATEWAY: Your IPFS user_name.mypinata.cloud/ipfs from PINATA.



# Installation
**Run the following commands on your terminal (shell) to install this project**
```
git clone https://github.com/GKamsy/orank.git
cd orank
npm install --save-dev $(cat dev-dependencies.txt)
npm install $(cat prod-dependencies.txt)
npx hardhat compile
npm shrinkwrap
```

# Environmental Setup

**Run the following commands on your terminal (shell) to set up the project**
```
node generate-voters.js
npx hardhat run index.ts --network sepolia


```
