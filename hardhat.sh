#!/bin/bash
# setup-hardhat.sh
# Script to install and initialize Hardhat environment with dependency checks and auto-generated dependency list

set -e
set -o pipefail

DEPENDENCY_FILE="dependencies.txt"

echo -e "\n⚙️ Starting Hardhat environment setup..."

# Step 1: Initialize npm if not already done
if [ ! -f package.json ]; then
  echo -e "\n⚙️ Initializing npm project..."
  npm init -y
fi

# Step 2: Create dependency file if it doesn’t exist
if [ ! -f "$DEPENDENCY_FILE" ]; then
  echo -e "\n⚙️ Creating $DEPENDENCY_FILE..."
  cat <<EOF > "$DEPENDENCY_FILE"
# Dev dependencies
--save-dev @nomicfoundation/hardhat-toolbox@6.1.0
--save-dev hardhat@2.26.3 prettier@3.6.2
--save-dev --legacy-peer-deps axios@1.12.2
--save-dev dotenv@17.2.2 ethers@6.15.0
--save-dev inquirer@12.9.6
--save-dev chalk
--save-dev typescript

# Runtime dependencies
@openzeppelin/contracts@^4.9.0
EOF
  echo "✔ Created $DEPENDENCY_FILE with default dependency list."
else
  echo -e "\n⚙️ Using existing $DEPENDENCY_FILE..."
fi

# Step 3: Install dependencies only if missing
echo -e "\n⚙️ Checking and installing dependencies..."

while IFS= read -r line || [ -n "$line" ]; do
  # Skip comments or empty lines
  [[ -z "$line" || "$line" =~ ^# ]] && continue

  # Extract package names only (skip flags)
  packages=($(echo "$line" | grep -oE '@?[a-zA-Z0-9./_-]+(@[0-9a-zA-Z.^~-]+)?'))

  install_needed=false
  for pkg in "${packages[@]}"; do
    if ! npm list "$pkg" &>/dev/null; then
      install_needed=true
      break
    fi
  done

  if [ "$install_needed" = true ]; then
    echo -e "\n⚙️ Installing: npm install $line"
    npm install $line
  else
    echo -e "✔ Already installed: ${packages[*]}"
  fi
done < "$DEPENDENCY_FILE"

# Step 4: Lock dependency tree
echo -e "\n⚙️ Generating npm shrinkwrap..."
npm shrinkwrap

# Step 5: Initialize Hardhat if not already done
if [ ! -f "hardhat.config.js" ] && [ ! -f "hardhat.config.ts" ]; then
  echo -e "\n⚡ Initializing Hardhat..."
  npx hardhat
else
  echo -e "\n⚡ Hardhat already initialized."
fi
echo -e "\n✔ Hardhat setup complete!"

# Step 6: Optional — run index.ts if it exists
if [ -f "index.ts" ]; then
  echo -e "\n⚙️ Running Hardhat script on Sepolia..."
  npx hardhat run index.ts --network sepolia
fi
