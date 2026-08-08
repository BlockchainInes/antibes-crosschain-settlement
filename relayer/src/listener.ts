import {
  Interface,
  JsonRpcProvider,
  Log,
} from "ethers";

import {
  SourceEvent,
} from "./types.js";

const sourceAbi = [
  "event SettlementInitiated(bytes32 indexed settlementId,address indexed initiator,address indexed beneficiary,address asset,uint256 amount,uint256 sourceChainId,uint256 destinationChainId,uint256 nonce)",
];

export class SettlementListener {
  private readonly contractInterface = new Interface(sourceAbi);
  private readonly eventTopic: string;

  constructor(
    private readonly provider: JsonRpcProvider,
    private readonly sourceContractAddress: string,
    private readonly expectedSourceChainId: bigint,
  ) {
    const event = this.contractInterface.getEvent(
      "SettlementInitiated",
    );

    if (!event) {
      throw new Error(
        "SettlementInitiated event definition is unavailable",
      );
    }

    this.eventTopic = event.topicHash;
  }

  async getEvents(
    fromBlock: number,
    toBlock: number | "latest",
  ): Promise<SourceEvent[]> {
    if (
      !Number.isInteger(fromBlock) ||
      fromBlock < 0
    ) {
      throw new Error(
        "fromBlock must be a non-negative integer",
      );
    }

    const logs = await this.provider.getLogs({
      address: this.sourceContractAddress,
      topics: [this.eventTopic],
      fromBlock,
      toBlock,
    });

    const events: SourceEvent[] = [];

    for (const log of logs) {
      events.push(
        await this.parseLog(log),
      );
    }

    return events;
  }

  async getEvent(
    transactionHash: string,
    logIndex: number,
  ): Promise<SourceEvent> {
    const receipt =
      await this.provider.getTransactionReceipt(
        transactionHash,
      );

    if (!receipt) {
      throw new Error(
        `Transaction receipt ${transactionHash} was not found`,
      );
    }

    const log = receipt.logs.find(
      (candidate) =>
        candidate.index === logIndex &&
        candidate.address.toLowerCase() ===
          this.sourceContractAddress.toLowerCase(),
    );

    if (!log) {
      throw new Error(
        `Settlement event ${transactionHash}:${logIndex} was not found`,
      );
    }

    return this.parseLog(log);
  }

  private async parseLog(
    log: Log,
  ): Promise<SourceEvent> {
    const parsed =
      this.contractInterface.parseLog({
        topics: log.topics,
        data: log.data,
      });

    if (
      !parsed ||
      parsed.name !== "SettlementInitiated"
    ) {
      throw new Error(
        "Unexpected source event",
      );
    }

    const block = await this.provider.getBlock(
      log.blockNumber,
    );

    if (!block) {
      throw new Error(
        `Block ${log.blockNumber} was not found`,
      );
    }

    const sourceChainId =
      BigInt(parsed.args.sourceChainId);

    if (
      sourceChainId !==
      this.expectedSourceChainId
    ) {
      throw new Error(
        `Unexpected source chain ${sourceChainId.toString()}`,
      );
    }

    return {
      settlementId: parsed.args.settlementId,
      initiator: parsed.args.initiator,
      beneficiary: parsed.args.beneficiary,
      asset: parsed.args.asset,
      amount: BigInt(parsed.args.amount),
      sourceChainId,
      destinationChainId: BigInt(
        parsed.args.destinationChainId,
      ),
      sourceNonce: BigInt(parsed.args.nonce),
      transactionHash: log.transactionHash,
      blockNumber: log.blockNumber,
      blockHash: block.hash,
      logIndex: log.index,
    };
  }
}