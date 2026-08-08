// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

contract ComplianceRegistry {
    address public owner;

    mapping(address => bool) public approvedParticipants;
    mapping(address => bool) public approvedAssets;

    error Unauthorized();
    error ZeroAddress();

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    event ParticipantApprovalUpdated(
        address indexed participant,
        bool approved
    );

    event AssetApprovalUpdated(
        address indexed asset,
        bool approved
    );

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert Unauthorized();
        }

        _;
    }

    function setParticipantApproval(
        address participant,
        bool approved
    ) external onlyOwner {
        if (participant == address(0)) {
            revert ZeroAddress();
        }

        approvedParticipants[participant] = approved;

        emit ParticipantApprovalUpdated(
            participant,
            approved
        );
    }

    function setAssetApproval(
        address asset,
        bool approved
    ) external onlyOwner {
        if (asset == address(0)) {
            revert ZeroAddress();
        }

        approvedAssets[asset] = approved;

        emit AssetApprovalUpdated(
            asset,
            approved
        );
    }

    function transferOwnership(
        address newOwner
    ) external onlyOwner {
        if (newOwner == address(0)) {
            revert ZeroAddress();
        }

        address previousOwner = owner;
        owner = newOwner;

        emit OwnershipTransferred(
            previousOwner,
            newOwner
        );
    }

    function isSettlementAllowed(
        address initiator,
        address beneficiary,
        address asset
    ) external view returns (bool) {
        return
            approvedParticipants[initiator] &&
            approvedParticipants[beneficiary] &&
            approvedAssets[asset];
    }
}