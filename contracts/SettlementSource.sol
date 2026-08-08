// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

contract SettlementSource {
    enum SettlementStatus {
        None,
        Initiated
    }

    struct Settlement {
        address initiator;
        address beneficiary;
        address asset;
        uint256 amount;
        uint256 destinationChainId;
        uint256 nonce;
        SettlementStatus status;
    }

    error ZeroAddress();
    error ZeroAmount();
    error InvalidDestinationChain();

    uint256 public nextNonce;

    mapping(bytes32 => Settlement) public settlements;

    event SettlementInitiated(
        bytes32 indexed settlementId,
        address indexed initiator,
        address indexed beneficiary,
        address asset,
        uint256 amount,
        uint256 sourceChainId,
        uint256 destinationChainId,
        uint256 nonce
    );

    function initiateSettlement(
        address beneficiary,
        address asset,
        uint256 amount,
        uint256 destinationChainId
    ) external returns (bytes32 settlementId) {
        if (beneficiary == address(0) || asset == address(0)) {
            revert ZeroAddress();
        }

        if (amount == 0) {
            revert ZeroAmount();
        }

        if (destinationChainId == block.chainid) {
            revert InvalidDestinationChain();
        }

        uint256 nonce = nextNonce++;

        settlementId = keccak256(
            abi.encode(
                block.chainid,
                address(this),
                msg.sender,
                beneficiary,
                asset,
                amount,
                destinationChainId,
                nonce
            )
        );

        settlements[settlementId] = Settlement({
            initiator: msg.sender,
            beneficiary: beneficiary,
            asset: asset,
            amount: amount,
            destinationChainId: destinationChainId,
            nonce: nonce,
            status: SettlementStatus.Initiated
        });

        emit SettlementInitiated(
            settlementId,
            msg.sender,
            beneficiary,
            asset,
            amount,
            block.chainid,
            destinationChainId,
            nonce
        );
    }
}