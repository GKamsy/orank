# ORANK Project  
by Goodwell Kamwendo
 
 # PART 1: About

This is a blockchain-based governance ranking protocol built with Hardhat, Ethers.js, and TypeScript. It provides a foundation for DAOs to automate ranking, verify proposal outcomes, and maintain trustworthy governance records on the EVM chain. This ensures transparent proposal evaluation, verifiable voting, and on-chain accountability.

DAO governance often lacks verifiable ranking and transparent verification mechanisms. Voting systems are frequently off-chain or opaque. ORank addresses this by providing **on-chain voting** with verification logic, **automatic ranking** via proposal queue, and immutable **result tracking**. Please follow the instructions below for easy setup.


# PART 2: Prerequisites
**A. Before doing anything else, make sure that you have the following:**
1. MetaMask wallet from https://metamask.io for storing coins.
2. Router address from https://www.alchemy.com for project identification.
3. IPFS account from https://app.pinata.cloud for uploading data.

**B: This will enable you to have the following:**
1. PUBLIC KEY: Your wallet address from the MetaMask wallet.
2. PRIVATE KEY: Your wallet private key from the MetaMask wallet.
3. PROJECT URL: Your Alchemy project address.
4. IPFS API KEY: Your PINATA API key.
5. IPFS SECRET KEY: Your PINATA secret API key.
6. IPFS GATEWAY: Your PINATA private gateway.

# PART 3: Environmental Setup
**A. Use the following websites to claim faucets for testing (make sure to collect more than 0.2 SepoliaETH in your MetaMask wallet):**
1. https://cloud.google.com/application/web3/faucet/ethereum/sepolia
2. https://faucet.metana.io
3. https://www.alchemy.com/faucets/ethereum-sepolia

**B. Run the command below to open the .env file for editing:**
```
mousepad .env      # (You may use any text editor)
```

**C. You will see a file like this:**
```
# .env file

DEV_MODE=true

PUBLIC_KEY=your_wallet_address
PRIVATE_KEY=your_wallet_private_key
SEPOLIA_URL=https://eth-sepolia.g.alchemy.com/v2/your_project_ID
VOTER_KEYS=generated_for_testing

PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_API_KEY=your_pinata_secret_api_key
IPFS_GATEWAY=https://your_pinata_user_name.mypinata.cloud/ipfs/
```
**D. Fill in all the values that begin with** *your* **in the .env file, for example:**
```
# .env file

DEV_MODE=true

PUBLIC_KEY=0x50B4...8220ba
PRIVATE_KEY=0x543dd7...c9d1213304
SEPOLIA_URL=https://eth-sepolia.g.alchemy.com/v2/012345
VOTER_KEYS=generated_for_testing

PINATA_API_KEY=abcdef123456
PINATA_SECRET_API_KEY=abcde12345fghijkl6789
IPFS_GATEWAY=https://web3tester.mypinata.cloud/ipfs/

```


# PART 4: Installations
**Open your terminal/shell (Press Ctr + Alt + T) and run the following commands:**
1. *To install  Node.js and npm:*
```
sudo apt-get install nodejs
sudo apt-get install npm
```

2. *To install the project:*
```
git clone https://github.com/GKamsy/orank.git
```

3. *To install dependencies:*
```
cd orank
npm install --save-dev $(cat dev-dependencies.txt)
npm install $(cat prod-dependencies.txt)
```

4. *To compile the project code:*
```
npx hardhat compile
npm shrinkwrap
```

# PART 5: Running the program
**A. Run the command below to generate the voters:**
```
node generate-voters.js
```

**B. Run the command below to fund the voters:**
```
node fund-voters.js
```

**C. Run the command below to fire up the project:**
```
npx hardhat run index.ts --network sepolia
```

# PART 6: Conlusion
I can proudly confirm that this project can be easily integrated into the education and research systems. It fits all angles of top security with a little justification. I invite all those who are willing to help me improve my work.
