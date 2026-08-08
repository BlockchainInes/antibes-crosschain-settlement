import {
  Contract,
  JsonRpcProvider,
  Wallet,
} from "ethers";

import {
  ExecutionResult,
  SignedSettlementMessage,
} from "./types.js";

const destinationAbi = [
  "function executions(bytes32 settlementId) view returns (address initiator,address beneficiary,address asset,uint256 amount,uint256 sourceChainId,uint256 sourceNonce,bool executed)",
  "function executeSettlement(bytes32 settlementId,address initiator,address beneficiary,address asset,uint256 amount,uint256 sourceChainId,uint256 destinationChainId,uint256 sourceNonce)",
];

export class SettlementExecutor {
  private readonly contract: Contract;

  constructor(
    destinationContractAddress: string,
    provider: JsonRpcProvider,
    wallet: Wallet,
  ) {
    const connectedWallet = wallet.connect(provider);

    this.contract = new Contract(
      destinationContractAddress,
      destinationAbi,
      connectedWallet,
    );
  }

  async isProcessed(
    settlementId: string,
  ): Promise<boolean> {
    const execution = await this.contract.executions(
      settlementId,
    );

    return execution.executed;
  }

  async execute(
    signedSettlement: SignedSettlementMessage,
  ): Promise<ExecutionResult> {
    const { message } = signedSettlement;

    const alreadyProcessed = await this.isProcessed(
      message.settlementId,
    );

    if (alreadyProcessed) {
      throw new Error(
        `Settlement ${message.settlementId} has already been processed`,
      );
    }

    const transaction =
      await this.contract.executeSettlement(
        message.settlementId,
        message.initiator,
        message.beneficiary,
        message.asset,
        message.amount,
        message.sourceChainId,
        message.destinationChainId,
        message.sourceNonce,
      );

    const receipt = await transaction.wait();

    if (!receipt) {
      throw new Error(
        `No receipt returned for settlement ${message.settlementId}`,
      );
    }

    if (receipt.status !== 1) {
      throw new Error(
        `Settlement transaction failed for ${message.settlementId}`,
      );
    }

    return {
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    };
  }
}