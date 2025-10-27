// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ORankToken (ERC20Votes + Permit + capped mint)
/// @notice ERC20 token with on-chain voting support (ERC20Votes), EIP-2612 permit, and an owner-only mint
///         function constrained by a MAX_SUPPLY cap. Intended to be deployed then owned by a Timelock
///         (transferOwnership(timelock)) so governance can control minting via proposals.

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ORankToken is ERC20, ERC20Permit, ERC20Votes, Ownable {
    /// @notice Maximum token supply (cap)
    uint256 public immutable MAX_SUPPLY;

    /// @param name Token name
    /// @param symbol Token symbol
    /// @param maxSupply Maximum total supply (in wei-units, e.g., 1_000_000 * 1e18)
    /// @param initialSeed amount to mint to deployer on deploy (can be 0)
    constructor(
        string memory name,
        string memory symbol,
        uint256 maxSupply,
        uint256 initialSeed
    ) ERC20(name, symbol) ERC20Permit(name) {
        require(maxSupply > 0, "MAX_SUPPLY>0");
        MAX_SUPPLY = maxSupply;

        if (initialSeed > 0) {
            require(initialSeed <= maxSupply, "seed>max");
            _mint(msg.sender, initialSeed);
        }
    }

    /// @notice Mint new tokens. Restricted to owner (recommended: Timelock after deployment).
    /// @dev Respects MAX_SUPPLY cap.
    /// @param to recipient
    /// @param amount amount in token base units
    function mint(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "cap exceeded");
        _mint(to, amount);
    }

    /// @notice Burn tokens from caller.
    /// @param amount amount to burn
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    // --------------------------
    // ERC20Votes overrides
    // --------------------------

    /// @dev Required override for ERC20 + ERC20Permit + ERC20Votes
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Votes) {
        super._afterTokenTransfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._burn(account, amount);
    }
}
