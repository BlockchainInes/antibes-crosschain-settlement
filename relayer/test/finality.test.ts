import { expect } from "chai";
import { JsonRpcProvider } from "ethers";

import {
  FinalityChecker,
} from "../src/finality.js";

import {
  SourceEvent,
} from "../src/types.js";

describe("FinalityChecker", () => {
  let sourceEvent: SourceEvent;

  beforeEach(() => {
    sourceEvent = {
      settlementId:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      initiator:
        "0x1111111111111111111111111111111111111111",
      beneficiary:
        "0x2222222222222222222222222222222222222222",
      asset:
        "0x3333333333333333333333333333333333333333",
      amount: 1000n,
      sourceChainId: 11155111n,
      destinationChainId: 80002n,
      sourceNonce: 1n,
      transactionHash:
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      blockNumber: 100,
      blockHash:
        "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      logIndex: 0,
    };
  });

  function createProviderMock(
    latestBlockNumber: number,
    block:
      | {
          hash: string;
        }
      | null,
  ): JsonRpcProvider {
    return {
      getBlockNumber: async () => latestBlockNumber,
      getBlock: async () => block,
    } as unknown as JsonRpcProvider;
  }

  it("marks a settlement as finalized when the required confirmations are reached", async () => {
    const provider = createProviderMock(
      111,
      {
        hash: sourceEvent.blockHash,
      },
    );

    const checker = new FinalityChecker(
      provider,
      12,
    );

    const result = await checker.check(
      sourceEvent,
    );

    expect(result.finalized).to.equal(true);
    expect(result.confirmations).to.equal(12);

    expect(
      result.canonicalBlockHash,
    ).to.equal(
      sourceEvent.blockHash,
    );
  });

  it("does not finalize a settlement before the confirmation threshold", async () => {
    const provider = createProviderMock(
      110,
      {
        hash: sourceEvent.blockHash,
      },
    );

    const checker = new FinalityChecker(
      provider,
      12,
    );

    const result = await checker.check(
      sourceEvent,
    );

    expect(result.finalized).to.equal(false);
    expect(result.confirmations).to.equal(11);
  });

  it("returns zero confirmations when the chain head is behind the event block", async () => {
    const provider = createProviderMock(
      99,
      {
        hash: sourceEvent.blockHash,
      },
    );

    const checker = new FinalityChecker(
      provider,
      12,
    );

    const result = await checker.check(
      sourceEvent,
    );

    expect(result.finalized).to.equal(false);
    expect(result.confirmations).to.equal(0);
  });

  it("does not finalize when the canonical block cannot be retrieved", async () => {
    const provider = createProviderMock(
      111,
      null,
    );

    const checker = new FinalityChecker(
      provider,
      12,
    );

    const result = await checker.check(
      sourceEvent,
    );

    expect(result.finalized).to.equal(false);
    expect(result.confirmations).to.equal(0);
  });

  it("detects a reorg when the canonical block hash differs from the observed block hash", async () => {
    const canonicalHash =
      "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";

    const provider = createProviderMock(
      111,
      {
        hash: canonicalHash,
      },
    );

    const checker = new FinalityChecker(
      provider,
      12,
    );

    const result = await checker.check(
      sourceEvent,
    );

    expect(result.finalized).to.equal(false);
    expect(result.confirmations).to.equal(0);

    expect(
      result.canonicalBlockHash,
    ).to.equal(
      canonicalHash,
    );
  });

  it("compares block hashes case-insensitively", async () => {
    const provider = createProviderMock(
      111,
      {
        hash: sourceEvent.blockHash.toUpperCase(),
      },
    );

    const checker = new FinalityChecker(
      provider,
      12,
    );

    const result = await checker.check(
      sourceEvent,
    );

    expect(result.finalized).to.equal(true);
    expect(result.confirmations).to.equal(12);
  });

  it("calculates confirmations inclusively from the event block", async () => {
    const provider = createProviderMock(
      100,
      {
        hash: sourceEvent.blockHash,
      },
    );

    const checker = new FinalityChecker(
      provider,
      1,
    );

    const result = await checker.check(
      sourceEvent,
    );

    expect(result.finalized).to.equal(true);
    expect(result.confirmations).to.equal(1);
  });

  it("rejects zero required confirmations", () => {
    const provider = createProviderMock(
      111,
      {
        hash: sourceEvent.blockHash,
      },
    );

    expect(
      () =>
        new FinalityChecker(
          provider,
          0,
        ),
    ).to.throw(
      "Required confirmations must be a positive integer",
    );
  });

  it("rejects negative required confirmations", () => {
    const provider = createProviderMock(
      111,
      {
        hash: sourceEvent.blockHash,
      },
    );

    expect(
      () =>
        new FinalityChecker(
          provider,
          -1,
        ),
    ).to.throw(
      "Required confirmations must be a positive integer",
    );
  });

  it("rejects non-integer required confirmations", () => {
    const provider = createProviderMock(
      111,
      {
        hash: sourceEvent.blockHash,
      },
    );

    expect(
      () =>
        new FinalityChecker(
          provider,
          1.5,
        ),
    ).to.throw(
      "Required confirmations must be a positive integer",
    );
  });
});