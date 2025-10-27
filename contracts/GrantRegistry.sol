// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GrantRegistry
 * @notice Registry for ORank research grants. Supports submission, approval via governance,
 *         and tracking of grant metadata with IPFS hash verification.
 */
contract GrantRegistry {
    /// Governor address (typically Timelock)
    address public immutable governor;

    /// Grant struct
    struct Grant {
        address applicant;       // submitter
        string metadataURI;      // IPFS metadata URI
        bytes32 cidHash;         // keccak256 hash of CID for verification
        bool approved;           // approval status
        uint256 proposalId;      // Governor proposal ID that approved
        uint256 timestamp;       // submission timestamp
    }

    /// Mapping grantId => Grant
    mapping(bytes32 => Grant) private _grants;

    /// Track all grant IDs
    bytes32[] private _grantIds;

    /// Events
    event GrantSubmitted(
        bytes32 indexed grantId,
        address indexed applicant,
        string metadataURI,
        bytes32 cidHash,
        uint256 timestamp
    );

    event GrantApproved(
        bytes32 indexed grantId,
        uint256 indexed proposalId,
        address indexed governor,
        uint256 timestamp
    );

    /// Modifier to restrict to governor
    modifier onlyGovernor() {
        require(msg.sender == governor, "GrantRegistry: not governor");
        _;
    }

    constructor(address _governor) {
        require(_governor != address(0), "GrantRegistry: zero governor");
        governor = _governor;
    }

    // -------------------------
    // Grant Submission
    // -------------------------

    function submitGrant(bytes32 grantId, string calldata metadataURI, bytes32 cidHash) external {
        require(grantId != bytes32(0), "GrantRegistry: zero grantId");
        require(_grants[grantId].timestamp == 0, "GrantRegistry: grant exists");
        require(cidHash != bytes32(0), "GrantRegistry: invalid cidHash");

        _grants[grantId] = Grant({
            applicant: msg.sender,
            metadataURI: metadataURI,
            cidHash: cidHash,
            approved: false,
            proposalId: 0,
            timestamp: block.timestamp
        });

        _grantIds.push(grantId);

        emit GrantSubmitted(grantId, msg.sender, metadataURI, cidHash, block.timestamp);
    }

    // -------------------------
    // Grant Approval
    // -------------------------

    function markApproved(bytes32 grantId, uint256 proposalId) external onlyGovernor {
        Grant storage g = _grants[grantId];
        require(g.timestamp != 0, "GrantRegistry: not found");
        require(!g.approved, "GrantRegistry: already approved");

        g.approved = true;
        g.proposalId = proposalId;

        emit GrantApproved(grantId, proposalId, msg.sender, block.timestamp);
    }

    // -------------------------
    // Views
    // -------------------------

    function getGrant(bytes32 grantId)
        external
        view
        returns (
            address applicant,
            string memory metadataURI,
            bytes32 cidHash,
            bool approved,
            uint256 proposalId,
            uint256 timestamp
        )
    {
        Grant storage g = _grants[grantId];
        require(g.timestamp != 0, "GrantRegistry: not found");
        return (g.applicant, g.metadataURI, g.cidHash, g.approved, g.proposalId, g.timestamp);
    }

    function cidHashOf(bytes32 grantId) external view returns (bytes32) {
        Grant storage g = _grants[grantId];
        require(g.timestamp != 0, "GrantRegistry: not found");
        return g.cidHash;
    }

    function isApproved(bytes32 grantId) external view returns (bool) {
        return _grants[grantId].approved;
    }

    function applicantOf(bytes32 grantId) external view returns (address) {
        Grant storage g = _grants[grantId];
        require(g.timestamp != 0, "GrantRegistry: not found");
        return g.applicant;
    }

    // Indexing
    function totalGrants() external view returns (uint256) {
        return _grantIds.length;
    }

    function getGrantId(uint256 index) external view returns (bytes32) {
        require(index < _grantIds.length, "GrantRegistry: out of bounds");
        return _grantIds[index];
    }

    function latestGrantId() external view returns (bytes32) {
        require(_grantIds.length > 0, "GrantRegistry: none");
        return _grantIds[_grantIds.length - 1];
    }
}
