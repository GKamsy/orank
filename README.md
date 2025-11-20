# ORANK Project

This is a blockchain-based governance ranking protocol built with Hardhat, Ethers.js, and TypeScript. It provides a foundation for DAOs to automate ranking, verify proposal outcomes, and maintain trustworthy governance records on the EVM chain. This ensures transparent proposal evaluation, verifiable voting, and on-chain accountability.

**Prequisties**

Before doing anything else, make sure that you have the following:

    

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
