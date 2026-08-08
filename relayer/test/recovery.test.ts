import { expect } from "chai";

import {
  SettlementRecovery,
} from "../src/recovery.js";

import {
  SettlementStore,
} from "../src/store.js";

import {
  SettlementMessage,
  SettlementStatus,
  SignedSettlementMessage,
  SourceEvent,
} from "../src/types.js";

describe("SettlementRecovery", () => {
  let store: SettlementStore;
  let recovery: SettlementRecovery;
  let sourceEvent: SourceEvent;

  beforeEach(() => {
    store = new SettlementStore();
    recovery = new SettlementRecovery(store, 3);

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

  it("marks detected settlements as recoverable from finality pending", () => {
    const record = store.create(sourceEvent);

    const decision = recovery.evaluate(record);

    expect(decision.recoverable).to.equal(true);
    expect(decision.nextStatus).to.equal(
      SettlementStatus.FinalityPending,
    );
  });

  it("keeps finality-pending settlements recoverable", () => {
    store.create(sourceEvent);

    const record = store.transition(
      sourceEvent.settlementId,
      SettlementStatus.FinalityPending,
    );

    const decision = recovery.evaluate(record);

    expect(decision.recoverable).to.equal(true);
    expect(decision.nextStatus).to.equal(
      SettlementStatus.FinalityPending,
    );
  });

  it("resumes validated settlements from the validated state", () => {
    store.create(sourceEvent);

    const record = store.transition(
      sourceEvent.settlementId,
      SettlementStatus.Validated,
    );

    const decision = recovery.evaluate(record);

    expect(decision.recoverable).to.equal(true);
    expect(decision.nextStatus).to.equal(
      SettlementStatus.Validated,
    );
  });

  it("resumes signed settlements from the signed state", () => {
    store.create(sourceEvent);

    const record = store.transition(
      sourceEvent.settlementId,
      SettlementStatus.Signed,
    );

    const decision = recovery.evaluate(record);

    expect(decision.recoverable).to.equal(true);
    expect(decision.nextStatus).to.equal(
      SettlementStatus.Signed,
    );
  });

  it("keeps submitted settlements recoverable for confirmation checks", () => {
    store.create(sourceEvent);

    const record = store.transition(
      sourceEvent.settlementId,
      SettlementStatus.Submitted,
    );

    const decision = recovery.evaluate(record);

    expect(decision.recoverable).to.equal(true);
    expect(decision.nextStatus).to.equal(
      SettlementStatus.Submitted,
    );
  });

  it("does not recover confirmed settlements", () => {
    store.create(sourceEvent);

    const record = store.transition(
      sourceEvent.settlementId,
      SettlementStatus.Confirmed,
    );

    const decision = recovery.evaluate(record);

    expect(decision.recoverable).to.equal(false);
    expect(decision.reason).to.equal(
      "Settlement is already confirmed",
    );
  });

  it("does not recover permanently failed settlements", () => {
    store.create(sourceEvent);

    const record = store.transition(
      sourceEvent.settlementId,
      SettlementStatus.Failed,
    );

    const decision = recovery.evaluate(record);

    expect(decision.recoverable).to.equal(false);
    expect(decision.reason).to.equal(
      "Settlement is permanently failed",
    );
  });

  it("stops recovery when the maximum retry count is reached", () => {
    store.create(sourceEvent);

    store.recordFailure(
      sourceEvent.settlementId,
      "Temporary failure",
      true,
    );

    store.recordFailure(
      sourceEvent.settlementId,
      "Temporary failure",
      true,
    );

    const record = store.recordFailure(
      sourceEvent.settlementId,
      "Temporary failure",
      true,
    );

    const decision = recovery.evaluate(record);

    expect(decision.recoverable).to.equal(false);
    expect(decision.reason).to.equal(
      "Maximum retry attempts reached",
    );
  });

  it("resumes retryable failures from signed state when a signed message exists", () => {
    const record = store.create(sourceEvent);

    const message: SettlementMessage = {
      settlementId: sourceEvent.settlementId,
      initiator: sourceEvent.initiator,
      beneficiary: sourceEvent.beneficiary,
      asset: sourceEvent.asset,
      amount: sourceEvent.amount,
      sourceChainId: sourceEvent.sourceChainId,
      destinationChainId: sourceEvent.destinationChainId,
      sourceNonce: sourceEvent.sourceNonce,
    };

    const signedMessage: SignedSettlementMessage = {
      message,
      digest:
        "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      signature: "0x1234",
      signer:
        "0x4444444444444444444444444444444444444444",
    };

    store.update(record.settlementId, {
      message,
      signedMessage,
    });

    const failedRecord = store.recordFailure(
      record.settlementId,
      "Destination RPC unavailable",
      true,
    );

    const decision = recovery.evaluate(
      failedRecord,
    );

    expect(decision.recoverable).to.equal(true);
    expect(decision.nextStatus).to.equal(
      SettlementStatus.Signed,
    );
  });

  it("resumes retryable failures from validated state when only a message exists", () => {
    const record = store.create(sourceEvent);

    const message: SettlementMessage = {
      settlementId: sourceEvent.settlementId,
      initiator: sourceEvent.initiator,
      beneficiary: sourceEvent.beneficiary,
      asset: sourceEvent.asset,
      amount: sourceEvent.amount,
      sourceChainId: sourceEvent.sourceChainId,
      destinationChainId: sourceEvent.destinationChainId,
      sourceNonce: sourceEvent.sourceNonce,
    };

    store.update(record.settlementId, {
      message,
    });

    const failedRecord = store.recordFailure(
      record.settlementId,
      "Temporary failure",
      true,
    );

    const decision = recovery.evaluate(
      failedRecord,
    );

    expect(decision.recoverable).to.equal(true);
    expect(decision.nextStatus).to.equal(
      SettlementStatus.Validated,
    );
  });

  it("resumes retryable failures from finality pending when no message exists", () => {
    const record = store.create(sourceEvent);

    const failedRecord = store.recordFailure(
      record.settlementId,
      "Source RPC unavailable",
      true,
    );

    const decision = recovery.evaluate(
      failedRecord,
    );

    expect(decision.recoverable).to.equal(true);
    expect(decision.nextStatus).to.equal(
      SettlementStatus.FinalityPending,
    );
  });

  it("returns only recoverable records", () => {
    const first = store.create(sourceEvent);

    const secondEvent: SourceEvent = {
      ...sourceEvent,
      settlementId:
        "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    };

    const second = store.create(secondEvent);

    store.transition(
      first.settlementId,
      SettlementStatus.Confirmed,
    );

    store.transition(
      second.settlementId,
      SettlementStatus.Validated,
    );

    const records =
      recovery.recoverableRecords();

    expect(records).to.have.length(1);
    expect(records[0].settlementId).to.equal(
      second.settlementId,
    );
  });

  it("marks a settlement as permanently failed", () => {
    store.create(sourceEvent);

    const record = recovery.markPermanentFailure(
      sourceEvent.settlementId,
      "Reorg invalidated source event",
    );

    expect(record.status).to.equal(
      SettlementStatus.Failed,
    );

    expect(record.lastError).to.equal(
      "Reorg invalidated source event",
    );
  });

  it("prepares a recoverable settlement for retry", () => {
    store.create(sourceEvent);

    store.recordFailure(
      sourceEvent.settlementId,
      "Source RPC unavailable",
      true,
    );

    const record = recovery.prepareRetry(
      sourceEvent.settlementId,
    );

    expect(record.status).to.equal(
      SettlementStatus.FinalityPending,
    );

    expect(record.lastError).to.equal(undefined);
  });

  it("rejects retry preparation for a confirmed settlement", () => {
    store.create(sourceEvent);

    store.transition(
      sourceEvent.settlementId,
      SettlementStatus.Confirmed,
    );

    expect(() =>
      recovery.prepareRetry(
        sourceEvent.settlementId,
      ),
    ).to.throw(
      "Settlement is already confirmed",
    );
  });

  it("rejects retry preparation for an unknown settlement", () => {
    expect(() =>
      recovery.prepareRetry(
        "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      ),
    ).to.throw(
      "does not exist",
    );
  });

  it("rejects zero maximum retry attempts", () => {
    expect(
      () =>
        new SettlementRecovery(
          store,
          0,
        ),
    ).to.throw(
      "Maximum retry attempts must be a positive integer",
    );
  });

  it("rejects negative maximum retry attempts", () => {
    expect(
      () =>
        new SettlementRecovery(
          store,
          -1,
        ),
    ).to.throw(
      "Maximum retry attempts must be a positive integer",
    );
  });

  it("rejects non-integer maximum retry attempts", () => {
    expect(
      () =>
        new SettlementRecovery(
          store,
          1.5,
        ),
    ).to.throw(
      "Maximum retry attempts must be a positive integer",
    );
  });
});