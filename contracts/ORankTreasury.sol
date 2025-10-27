// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ORankTreasury
 * @notice Escrow / treasury contract for ORank grants.
 *
 * Features:
 *  - Create an escrow for a grant (onlyGovernor)
 *  - Deposit ERC20 or native funds into the contract (anyone can fund)
 *  - Release tranche payouts to the grant applicant (onlyGovernor)
 *  - Cancel an escrow and allow admin to recover remaining funds (onlyGovernor)
 *  - View helpers for escrow state and tranche details
 *
 * Security / UX notes:
 *  - createEscrow only sets the escrow metadata and the tranche schedule.
 *    Funds must be deposited separately via depositNative or depositERC20.
 *  - release pays the specified tranche amount to the payee (pull semantics from escrow).
 *  - All sensitive actions (createEscrow, release, cancel, emergencyWithdraw) are restricted
 *    to the governor address provided at deployment. In a production deployment this should
 *    point to the TimelockController so governance controls treasury actions.
 *
 * Dependencies: OpenZeppelin SafeERC20, ReentrancyGuard
 */

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
//import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract ORankTreasury is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// Governor address (typically the Timelock or Governor via Timelock)
    address public immutable governor;

    /// Escrow structure
    struct Escrow {
        address payee;         // grant recipient
        address token;         // token address (address(0) for native ETH)
        uint256 totalAmount;   // total expected amount in smallest units
        uint256 released;      // total released so far
        bool active;           // active flag
        bool canceled;         // canceled flag
    }

    /// Mapping grantId => Escrow data
    mapping(bytes32 => Escrow) private _escrows;

    /// Mapping grantId => tranche amounts
    mapping(bytes32 => uint256[]) private _tranches;

    /// Events
    event EscrowCreated(bytes32 indexed grantId, address indexed payee, address indexed token, uint256 totalAmount);
    event DepositedERC20(bytes32 indexed grantId, address indexed funder, address indexed token, uint256 amount);
    event DepositedNative(bytes32 indexed grantId, address indexed funder, uint256 amount);
    event TrancheReleased(bytes32 indexed grantId, uint256 indexed trancheIndex, address indexed payee, uint256 amount);
    event EscrowCanceled(bytes32 indexed grantId);
    event EmergencyWithdraw(address indexed to, address indexed token, uint256 amount);

    /// Reverts unless caller is governor
    modifier onlyGovernor() {
        require(msg.sender == governor, "ORankTreasury: not governor");
        _;
    }

    constructor(address _governor) {
        require(_governor != address(0), "ORankTreasury: zero governor");
        governor = _governor;
    }

    // -------------------------
    // Create / Manage Escrow
    // -------------------------

    /**
     * @notice Create an escrow for a grant with optional tranche distribution.
     * @dev Only governor may call. Does NOT move funds. Funds should be deposited separately.
     * @param grantId Identifier for the grant (bytes32)
     * @param payee Recipient address for releases
     * @param token Token address to use for escrow (address(0) => native ETH)
     * @param totalAmount Total expected amount for the grant (sum of tranches is recommended)
     * @param tranches Array of tranche amounts (may be empty; then releases can still use arbitrary amounts up to total)
     */
    function createEscrow(
        bytes32 grantId,
        address payee,
        address token,
        uint256 totalAmount,
        uint256[] calldata tranches
    ) external onlyGovernor {
        require(payee != address(0), "ORankTreasury: zero payee");
        require(totalAmount > 0, "ORankTreasury: zero total");
        Escrow storage e = _escrows[grantId];
        require(!e.active && !e.canceled && e.totalAmount == 0, "ORankTreasury: already exists");

        // Store escrow metadata
        e.payee = payee;
        e.token = token;
        e.totalAmount = totalAmount;
        e.released = 0;
        e.active = true;
        e.canceled = false;

        // Store tranche schedule
        if (tranches.length > 0) {
            uint256 sum = 0;
            for (uint256 i = 0; i < tranches.length; ++i) {
                require(tranches[i] > 0, "ORankTreasury: zero tranche");
                _tranches[grantId].push(tranches[i]);
                sum += tranches[i];
            }
            // Sum of tranche amounts should not exceed totalAmount
            require(sum <= totalAmount, "ORankTreasury: tranche sum > total");
        }

        emit EscrowCreated(grantId, payee, token, totalAmount);
    }

    /**
     * @notice Deposit ERC20 tokens to the treasury for a grant
     * @param grantId grant identifier
     * @param token ERC20 token address
     * @param amount Amount to deposit
     */
    function depositERC20(bytes32 grantId, address token, uint256 amount) external nonReentrant {
        require(amount > 0, "ORankTreasury: zero amount");
        Escrow storage e = _escrows[grantId];
        require(e.active && !e.canceled, "ORankTreasury: escrow not active");
        require(e.token == token, "ORankTreasury: token mismatch");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit DepositedERC20(grantId, msg.sender, token, amount);
    }

    /**
     * @notice Deposit native ETH for a grant. Send ETH with transaction.
     * @param grantId grant identifier
     */
    function depositNative(bytes32 grantId) external payable nonReentrant {
        require(msg.value > 0, "ORankTreasury: zero value");
        Escrow storage e = _escrows[grantId];
        require(e.active && !e.canceled, "ORankTreasury: escrow not active");
        require(e.token == address(0), "ORankTreasury: token mismatch (not native)");

        emit DepositedNative(grantId, msg.sender, msg.value);
    }

    // -------------------------
    // Release / Cancel
    // -------------------------

    /**
     * @notice Release a tranche payout to the payee.
     * @dev Only governor may call. Transfers funds from contract to payee.
     *      If tranches are defined, the trancheIndex must be valid and unreleased.
     * @param grantId grant identifier
     * @param trancheIndex index of the tranche to release (use 0..n-1 if tranches were set).
     *                     If no tranches set, pass type(uint256).max and provide `amount` as the amount to release.
     * @param amount amount to release (if trancheIndex != type(uint256).max this param is ignored)
     */
    function release(
        bytes32 grantId,
        uint256 trancheIndex,
        uint256 amount
    ) external onlyGovernor nonReentrant {
        Escrow storage e = _escrows[grantId];
        require(e.active && !e.canceled, "ORankTreasury: not active");

        uint256 releaseAmount;

        if (trancheIndex == type(uint256).max) {
            // free-form release (ensure does not exceed total - released)
            require(amount > 0, "ORankTreasury: zero amount");
            require(e.released + amount <= e.totalAmount, "ORankTreasury: exceeds total");
            releaseAmount = amount;
        } else {
            // tranche-based release
            require(trancheIndex < _tranches[grantId].length, "ORankTreasury: tranche OOB");

            // compute how many have been released already to ensure idempotence
            // We'll consider released tranches as tracked by cumulative released amount.
            // Release the tranche amount if the cumulative released is less than sum of tranches up to index.
            uint256 trancheAmount = _tranches[grantId][trancheIndex];

            // We must ensure this exact tranche hasn't been previously released.
            // To do that, compute sum of previous tranches and ensure released equals that sum.
            uint256 sumPrev = 0;
            for (uint256 i = 0; i < trancheIndex; ++i) {
                sumPrev += _tranches[grantId][i];
            }
            require(e.released == sumPrev, "ORankTreasury: tranche already released or out of order");

            releaseAmount = trancheAmount;
        }

        // Check contract balance for the token
        if (e.token == address(0)) {
            // native
            require(address(this).balance >= releaseAmount, "ORankTreasury: insufficient native balance");
            (bool sent, ) = e.payee.call{value: releaseAmount}("");
            require(sent, "ORankTreasury: native transfer failed");
        } else {
            uint256 bal = IERC20(e.token).balanceOf(address(this));
            require(bal >= releaseAmount, "ORankTreasury: insufficient token balance");
            IERC20(e.token).safeTransfer(e.payee, releaseAmount);
        }

        e.released += releaseAmount;

        // If we've released totalAmount then mark inactive
        if (e.released >= e.totalAmount) {
            e.active = false;
        }

        emit TrancheReleased(grantId, trancheIndex, e.payee, releaseAmount);
    }

    /**
     * @notice Cancel an escrow. Only governor may call.
     * @dev Canceling does not automatically refund to any specific user. It marks the escrow canceled;
     *      admin can later call emergencyWithdraw to retrieve funds back to a given address.
     * @param grantId grant identifier
     */
    function cancelEscrow(bytes32 grantId) external onlyGovernor {
        Escrow storage e = _escrows[grantId];
        require(e.active && !e.canceled, "ORankTreasury: not active");
        e.canceled = true;
        e.active = false;
        emit EscrowCanceled(grantId);
    }

    // -------------------------
    // Admin Emergency Withdraw
    // -------------------------

    /**
     * @notice Emergency withdrawal of tokens or native from the contract to an address.
     * @dev Only governor. Use with care. Intended to recover leftover funds from canceled escrows or owner-managed corrections.
     * @param to recipient address
     * @param token token address (address(0) => native)
     * @param amount amount to withdraw
     */
    function emergencyWithdraw(address to, address token, uint256 amount) external onlyGovernor nonReentrant {
        require(to != address(0), "ORankTreasury: zero to");
        require(amount > 0, "ORankTreasury: zero amount");

        if (token == address(0)) {
            require(address(this).balance >= amount, "ORankTreasury: insufficient native balance");
            (bool sent, ) = to.call{value: amount}("");
            require(sent, "ORankTreasury: native transfer failed");
        } else {
            uint256 bal = IERC20(token).balanceOf(address(this));
            require(bal >= amount, "ORankTreasury: insufficient token balance");
            IERC20(token).safeTransfer(to, amount);
        }

        emit EmergencyWithdraw(to, token, amount);
    }

    // -------------------------
    // View Helpers
    // -------------------------

    /**
     * @notice Get escrow metadata for a grantId.
     */
    function getEscrow(bytes32 grantId) external view returns (
        address payee,
        address token,
        uint256 totalAmount,
        uint256 released,
        bool active,
        bool canceled
    ) {
        Escrow storage e = _escrows[grantId];
        return (e.payee, e.token, e.totalAmount, e.released, e.active, e.canceled);
    }

    /**
     * @notice Get number of tranches for a grant
     */
    function trancheCount(bytes32 grantId) external view returns (uint256) {
        return _tranches[grantId].length;
    }

    /**
     * @notice Get tranche amount at index
     */
    function trancheAt(bytes32 grantId, uint256 index) external view returns (uint256) {
        require(index < _tranches[grantId].length, "ORankTreasury: tranche OOB");
        return _tranches[grantId][index];
    }

    /**
     * @notice Convenience: get contract balance for a token (address(0) -> native)
     */
    function contractBalance(address token) external view returns (uint256) {
        if (token == address(0)) {
            return address(this).balance;
        } else {
            return IERC20(token).balanceOf(address(this));
        }
    }

    // -------------------------
    // Receive fallback to accept native deposits
    // -------------------------
    receive() external payable {
        // Accept direct native transfers — they are not tied to a grantId.
    }

    fallback() external payable {
        // Accept direct native transfers
    }
}
