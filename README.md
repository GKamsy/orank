# ORANK Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a Hardhat Ignition module that deploys that contract.

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

*Run the following commands on your terminal (shell) to set up the project*
```
node generate-voters.js
npx hardhat run index.ts --network sepolia


```
