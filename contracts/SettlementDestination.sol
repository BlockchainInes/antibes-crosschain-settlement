// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IComplianceRegistry {
    function isSettlementAllowed(
        address initiator,
        address beneficiary,
        address asset
    ) external view returns (bool);
}

contract SettlementDestination {
    struct SettlementExecution {
        address initiator;
        address beneficiary;
        address asset;
        uint256 amount;
        uint256 sourceChainId;
        uint256 sourceNonce;
        bool executed;
    }

    error UnauthorizedRelayer();
    error ZeroAddress();
    error InvalidAmount();
    error InvalidSourceChain();
    error InvalidDestinationChain();
    error NonCompliantSettlement();
    error SettlementAlreadyExecuted();

    address public owner;
    address public relayer;
    IComplianceRegistry public immutable complianceRegistry;

    mapping(bytes32 => SettlementExecution) public executions;

    event RelayerUpdated(
        address indexed previousRelayer,
        address indexed newRelayer
    );

    event SettlementExecuted(
        bytes32 indexed settlementId,
        address indexed initiator,
        address indexed beneficiary,
        address asset,
        uint256 amount,
        uint256 sourceChainId,
        uint256 sourceNonce
    );

    constructor(
        address complianceRegistryAddress,
        address initialRelayer
    ) {
        if (
            complianceRegistryAddress == address(0) ||
            initialRelayer == address(0)
        ) {
            revert ZeroAddress();
        }

        owner = msg.sender;
        complianceRegistry = IComplianceRegistry(complianceRegistryAddress);
        relayer = initialRelayer;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert UnauthorizedRelayer();
        }

        _;
    }

    modifier onlyRelayer() {
        if (msg.sender != relayer) {
            revert UnauthorizedRelayer();
        }

        _;
    }

    function setRelayer(address newRelayer) external onlyOwner {
        if (newRelayer == address(0)) {
            revert ZeroAddress();
        }

        address previousRelayer = relayer;
        relayer = newRelayer;

        emit RelayerUpdated(previousRelayer, newRelayer);
    }

    function executeSettlement(
        bytes32 settlementId,
        address initiator,
        address beneficiary,
        address asset,
        uint256 amount,
        uint256 sourceChainId,
        uint256 destinationChainId,
        uint256 sourceNonce
    ) external onlyRelayer {
        if (
            initiator == address(0) ||
            beneficiary == address(0) ||
            asset == address(0)
        ) {
            revert ZeroAddress();
        }

        if (amount == 0) {
            revert InvalidAmount();
        }

        if (sourceChainId == 0) {
            revert InvalidSourceChain();
        }

        if (destinationChainId != block.chainid) {
            revert InvalidDestinationChain();
        }

        if (executions[settlementId].executed) {
            revert SettlementAlreadyExecuted();
        }

        if (
            !complianceRegistry.isSettlementAllowed(
                initiator,
                beneficiary,
                asset
            )
        ) {
            revert NonCompliantSettlement();
        }

        executions[settlementId] = SettlementExecution({
            initiator: initiator,
            beneficiary: beneficiary,
            asset: asset,
            amount: amount,
            sourceChainId: sourceChainId,
            sourceNonce: sourceNonce,
            executed: true
        });

        emit SettlementExecuted(
            settlementId,
            initiator,
            beneficiary,
            asset,
            amount,
            sourceChainId,
            sourceNonce
        );
    }
}