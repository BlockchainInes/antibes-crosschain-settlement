import { JsonRpcProvider } from "ethers";
import {
  FinalityResult,
  SourceEvent,
} from "./types.js";

export class FinalityChecker {
  constructor(
    private readonly provider: JsonRpcProvider,
    private readonly requiredConfirmations: number,
  ) {
    if (!Number.isInteger(requiredConfirmations) || requiredConfirmations < 1) {
      throw new Error(
        "Required confirmations must be a positive integer",
      );
    }
  }

  async check(sourceEvent: SourceEvent): Promise<FinalityResult> {
    const latestBlockNumber = await this.provider.getBlockNumber();

    if (latestBlockNumber < sourceEvent.blockNumber) {
      return {
        finalized: false,
        confirmations: 0,
      };
    }

    const canonicalBlock = await this.provider.getBlock(
      sourceEvent.blockNumber,
    );

    if (!canonicalBlock) {
      return {
        finalized: false,
        confirmations: 0,
      };
    }

    if (
      canonicalBlock.hash.toLowerCase() !==
      sourceEvent.blockHash.toLowerCase()
    ) {
      return {
        finalized: false,
        confirmations: 0,
        canonicalBlockHash: canonicalBlock.hash,
      };
    }

    const confirmations =
      latestBlockNumber - sourceEvent.blockNumber + 1;

    return {
      finalized: confirmations >= this.requiredConfirmations,
      confirmations,
      canonicalBlockHash: canonicalBlock.hash,
    };
  }
}