import { expect } from "chai";
import {
  SettlementStore,
} from "../src/store.js";
import {
  SettlementStatus,
  SourceEvent,
} from "../src/types.js";

describe("SettlementStore", () => {
  let store: SettlementStore;
  let sourceEvent: SourceEvent;

  beforeEach(() => {
    store = new SettlementStore();

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

  it("creates a detected settlement record", () => {
    const record = store.create(sourceEvent);

    expect(record.settlementId).to.equal(
      sourceEvent.settlementId,
    );

    expect(record.status).to.equal(
      SettlementStatus.Detected,
    );

    expect(record.attempts).to.equal(0);
  });

  it("returns the existing record when the same settlement is created twice", () => {
    const first = store.create(sourceEvent);
    const second = store.create(sourceEvent);

    expect(second).to.equal(first);
    expect(store.listAll()).to.have.length(1);
  });

  it("transitions a settlement to another lifecycle state", () => {
    store.create(sourceEvent);

    const updated = store.transition(
      sourceEvent.settlementId,
      SettlementStatus.FinalityPending,
    );

    expect(updated.status).to.equal(
      SettlementStatus.FinalityPending,
    );
  });

  it("records a retryable failure", () => {
    store.create(sourceEvent);

    const updated = store.recordFailure(
      sourceEvent.settlementId,
      "Destination RPC unavailable",
      true,
    );

    expect(updated.status).to.equal(
      SettlementStatus.RetryableFailure,
    );

    expect(updated.attempts).to.equal(1);

    expect(updated.lastError).to.equal(
      "Destination RPC unavailable",
    );
  });

  it("records a permanent failure", () => {
    store.create(sourceEvent);

    const updated = store.recordFailure(
      sourceEvent.settlementId,
      "Invalid settlement",
      false,
    );

    expect(updated.status).to.equal(
      SettlementStatus.Failed,
    );

    expect(updated.attempts).to.equal(1);
  });

  it("lists only settlements with the requested status", () => {
    store.create(sourceEvent);

    store.transition(
      sourceEvent.settlementId,
      SettlementStatus.Validated,
    );

    const records = store.listByStatus(
      SettlementStatus.Validated,
    );

    expect(records).to.have.length(1);

    expect(records[0].settlementId).to.equal(
      sourceEvent.settlementId,
    );
  });

  it("includes unfinished settlements in the recoverable set", () => {
    store.create(sourceEvent);

    const records = store.listRecoverable();

    expect(records).to.have.length(1);

    expect(records[0].status).to.equal(
      SettlementStatus.Detected,
    );
  });

  it("excludes confirmed settlements from the recoverable set", () => {
    store.create(sourceEvent);

    store.transition(
      sourceEvent.settlementId,
      SettlementStatus.Confirmed,
    );

    expect(store.listRecoverable()).to.have.length(0);
  });

  it("throws when updating an unknown settlement", () => {
    expect(() =>
      store.transition(
        "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        SettlementStatus.Validated,
      ),
    ).to.throw("does not exist");
  });
});