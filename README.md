# ORANK Project 
 by Goodwell Kamwendo

This is a blockchain-based governance ranking protocol built with Hardhat, Ethers.js, and TypeScript. It provides a foundation for DAOs to automate ranking, verify proposal outcomes, and maintain trustworthy governance records on the EVM chain. This ensures transparent proposal evaluation, verifiable voting, and on-chain accountability.

DAO governance often lacks verifiable ranking and transparent verification mechanisms. Voting systems are frequently off-chain or opaque. ORank addresses this by providing **on-chain voting** with verification logic, **automatic ranking** via proposal queue, and immutable **result tracking**. I can proudly assure you that the project can be easily integrated into the education and research systems.

**Prequisties**

Before doing anything else, make sure that you have the following:
```
PUBLIC_KEY=your_wallet_address
PRIVATE_KEY=your_private_key
SEPOLIA_URL=https://eth-sepolia.g.alchemy.com/v2/your_project_ID
VOTER_KEYS=generated_for_testing

PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_API_KEY=your_pinata_secret_api_key
IPFS_GATEWAY=https://your_pinata_user_name.mypinata.cloud/ipfs/
```
    

**Installation**

*Run the following commands on your terminal (shell) to install this project*
```
git clone https://github.com/GKamsy/orank.git
cd orank
npm install --save-dev $(cat dev-dependencies.txt)
npm install $(cat prod-dependencies.txt)
npx hardhat compile
npm shrinkwrap
```

**Environmental Setup**

*Run the following commands on your terminal (shell) to set up the project*
```
node generate-voters.js
npx hardhat run index.ts --network sepolia


```
