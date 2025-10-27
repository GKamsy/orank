// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PeerReview is Ownable {
    struct Review {
        address reviewer;
        string content;
        uint256 upvotes;
        bool rewarded;
    }

    IERC20 public token; // ORK token
    mapping(uint256 => Review[]) public grantReviews; // grantId => reviews

    event ReviewSubmitted(uint256 indexed grantId, uint256 reviewId, address reviewer);
    event ReviewUpvoted(uint256 indexed grantId, uint256 reviewId, address voter);
    event ReviewRewarded(uint256 indexed grantId, uint256 reviewId, address reviewer, uint256 amount);

    constructor(address _token) {
        token = IERC20(_token);
    }

    function submitReview(uint256 grantId, string memory content) external {
        grantReviews[grantId].push(Review(msg.sender, content, 0, false));
        emit ReviewSubmitted(grantId, grantReviews[grantId].length - 1, msg.sender);
    }

    function upvoteReview(uint256 grantId, uint256 reviewId) external {
        require(reviewId < grantReviews[grantId].length, "Invalid reviewId");
        grantReviews[grantId][reviewId].upvotes++;
        emit ReviewUpvoted(grantId, reviewId, msg.sender);
    }

    /// @notice Called by Timelock/Governor after governance vote
    function rewardTopReview(uint256 grantId, uint256 reviewId, uint256 amount) external onlyOwner {
        Review storage review = grantReviews[grantId][reviewId];
        require(!review.rewarded, "Already rewarded");

        token.transfer(review.reviewer, amount);
        review.rewarded = true;
        emit ReviewRewarded(grantId, reviewId, review.reviewer, amount);
    }

    function getReviews(uint256 grantId) external view returns (Review[] memory) {
        return grantReviews[grantId];
    }
}
