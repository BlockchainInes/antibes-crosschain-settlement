import { expect } from "chai";
import {
  Interface,
  JsonRpcProvider,
  Log,
} from "ethers";

import {
  SettlementListener,
} from "../src/listener.js";

const sourceAbi = [
  "event SettlementInitiated(bytes32 indexed settlementId,address indexed initiator,address indexed beneficiary,address asset,uint256 amount,uint256 sourceChainId,uint256 destinationChainId,uint256 nonce)",
];

describe("SettlementListener", () => {
  const sourceContractAddress =
    "0x9999999999999999999999999999999999999999";

  const sourceChainId = 11155111n;
  const destinationChainId = 80002n;

  const settlementId =
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  const initiator =
    "0x1111111111111111111111111111111111111111";

  const beneficiary =
    "0x2222222222222222222222222222222222222222";

  const asset =
    "0x3333333333333333333333333333333333333333";

  const transactionHash =
    "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

  const blockHash =
    "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

  const blockNumber = 100;
  const logIndex = 2;

  const contractInterface = new Interface(
    sourceAbi,
  );

  function createSettlementLog(
    overrides?: {
      sourceChainId?: bigint;
      destinationChainId?: bigint;
    },
  ): Log {
    const event = contractInterface.getEvent(
      "SettlementInitiated",
    );

    if (!event) {
      throw new Error(
        "SettlementInitiated event definition is unavailable",
      );
    }

    const encoded = contractInterface.encodeEventLog(
      event,
      [
        settlementId,
        initiator,
        beneficiary,
        asset,
        1000n,
        overrides?.sourceChainId ?? sourceChainId,
        overrides?.destinationChainId ?? destinationChainId,
        7n,
      ],
    );

    return {
      address: sourceContractAddress,
      blockHash,
      blockNumber,
      data: encoded.data,
      index: logIndex,
      removed: false,
      topics: encoded.topics,
      transactionHash,
      transactionIndex: 0,
    } as Log;
  }

  function createProviderMock(
    logs: Log[],
  ): JsonRpcProvider {
    return {
      getLogs: async () => logs,
      getBlock: async () => ({
        hash: blockHash,
      }),
      getTransactionReceipt: async () => ({
        logs,
      }),
    } as unknown as JsonRpcProvider;
  }

  it("decodes a SettlementInitiated event into the SourceEvent model", async () => {
    const log = createSettlementLog();

    const provider = createProviderMock([
      log,
    ]);

    const listener = new SettlementListener(
      provider,
      sourceContractAddress,
      sourceChainId,
    );

    const events = await listener.getEvents(
      blockNumber,
      blockNumber,
    );

    expect(events).to.have.length(1);

    const event = events[0];

    expect(event.settlementId).to.equal(
      settlementId,
    );

    expect(event.initiator).to.equal(
      initiator,
    );

    expect(event.beneficiary).to.equal(
      beneficiary,
    );

    expect(event.asset).to.equal(
      asset,
    );

    expect(event.amount).to.equal(
      1000n,
    );

    expect(event.sourceChainId).to.equal(
      sourceChainId,
    );

    expect(
      event.destinationChainId,
    ).to.equal(
      destinationChainId,
    );

    expect(event.sourceNonce).to.equal(
      7n,
    );

    expect(event.transactionHash).to.equal(
      transactionHash,
    );

    expect(event.blockNumber).to.equal(
      blockNumber,
    );

    expect(event.blockHash).to.equal(
      blockHash,
    );

    expect(event.logIndex).to.equal(
      logIndex,
    );
  });

  it("returns multiple source events", async () => {
    const firstLog = createSettlementLog();

    const secondSettlementId =
      "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";

    const event = contractInterface.getEvent(
      "SettlementInitiated",
    );

    if (!event) {
      throw new Error(
        "SettlementInitiated event definition is unavailable",
      );
    }

    const encoded = contractInterface.encodeEventLog(
      event,
      [
        secondSettlementId,
        initiator,
        beneficiary,
        asset,
        2000n,
        sourceChainId,
        destinationChainId,
        8n,
      ],
    );

    const secondLog = {
      ...firstLog,
      data: encoded.data,
      topics: encoded.topics,
      index: 3,
    } as Log;

    const provider = createProviderMock([
      firstLog,
      secondLog,
    ]);

    const listener = new SettlementListener(
      provider,
      sourceContractAddress,
      sourceChainId,
    );

    const events = await listener.getEvents(
      blockNumber,
      blockNumber,
    );

    expect(events).to.have.length(2);

    expect(events[0].settlementId).to.equal(
      settlementId,
    );

    expect(events[1].settlementId).to.equal(
      secondSettlementId,
    );
  });

  it("rejects a negative fromBlock", async () => {
    const provider = createProviderMock(
      [],
    );

    const listener = new SettlementListener(
      provider,
      sourceContractAddress,
      sourceChainId,
    );

    let error: unknown;

    try {
      await listener.getEvents(
        -1,
        "latest",
      );
    } catch (caught) {
      error = caught;
    }

    expect(error).to.be.instanceOf(
      Error,
    );

    expect(
      (error as Error).message,
    ).to.equal(
      "fromBlock must be a non-negative integer",
    );
  });

  it("rejects a non-integer fromBlock", async () => {
    const provider = createProviderMock(
      [],
    );

    const listener = new SettlementListener(
      provider,
      sourceContractAddress,
      sourceChainId,
    );

    let error: unknown;

    try {
      await listener.getEvents(
        1.5,
        "latest",
      );
    } catch (caught) {
      error = caught;
    }

    expect(error).to.be.instanceOf(
      Error,
    );

    expect(
      (error as Error).message,
    ).to.equal(
      "fromBlock must be a non-negative integer",
    );
  });

  it("rejects events from an unexpected source chain", async () => {
    const log = createSettlementLog({
      sourceChainId: 1n,
    });

    const provider = createProviderMock([
      log,
    ]);

    const listener = new SettlementListener(
      provider,
      sourceContractAddress,
      sourceChainId,
    );

    let error: unknown;

    try {
      await listener.getEvents(
        blockNumber,
        blockNumber,
      );
    } catch (caught) {
      error = caught;
    }

    expect(error).to.be.instanceOf(
      Error,
    );

    expect(
      (error as Error).message,
    ).to.equal(
      "Unexpected source chain 1",
    );
  });

  it("throws when the event block cannot be retrieved", async () => {
    const log = createSettlementLog();

    const provider = {
      getLogs: async () => [
        log,
      ],
      getBlock: async () => null,
    } as unknown as JsonRpcProvider;

    const listener = new SettlementListener(
      provider,
      sourceContractAddress,
      sourceChainId,
    );

    let error: unknown;

    try {
      await listener.getEvents(
        blockNumber,
        blockNumber,
      );
    } catch (caught) {
      error = caught;
    }

    expect(error).to.be.instanceOf(
      Error,
    );

    expect(
      (error as Error).message,
    ).to.equal(
      `Block ${blockNumber} was not found`,
    );
  });

  it("retrieves a specific settlement event from a transaction receipt", async () => {
    const log = createSettlementLog();

    const provider = createProviderMock([
      log,
    ]);

    const listener = new SettlementListener(
      provider,
      sourceContractAddress,
      sourceChainId,
    );

    const event = await listener.getEvent(
      transactionHash,
      logIndex,
    );

    expect(event.settlementId).to.equal(
      settlementId,
    );

    expect(event.logIndex).to.equal(
      logIndex,
    );
  });

  it("rejects a missing transaction receipt", async () => {
    const provider = {
      getTransactionReceipt:
        async () => null,
    } as unknown as JsonRpcProvider;

    const listener = new SettlementListener(
      provider,
      sourceContractAddress,
      sourceChainId,
    );

    let error: unknown;

    try {
      await listener.getEvent(
        transactionHash,
        logIndex,
      );
    } catch (caught) {
      error = caught;
    }

    expect(error).to.be.instanceOf(
      Error,
    );

    expect(
      (error as Error).message,
    ).to.equal(
      `Transaction receipt ${transactionHash} was not found`,
    );
  });

  it("rejects a receipt without the requested settlement log", async () => {
    const log = createSettlementLog();

    const provider = createProviderMock([
      log,
    ]);

    const listener = new SettlementListener(
      provider,
      sourceContractAddress,
      sourceChainId,
    );

    let error: unknown;

    try {
      await listener.getEvent(
        transactionHash,
        99,
      );
    } catch (caught) {
      error = caught;
    }

    expect(error).to.be.instanceOf(
      Error,
    );

    expect(
      (error as Error).message,
    ).to.equal(
      `Settlement event ${transactionHash}:99 was not found`,
    );
  });
});