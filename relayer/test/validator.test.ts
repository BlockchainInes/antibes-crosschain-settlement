import { expect } from "chai";

import {
  SettlementValidator,
} from "../src/validator.js";

import {
  SourceEvent,
} from "../src/types.js";

describe("SettlementValidator", () => {
  const sourceChainId = 11155111n;
  const destinationChainId = 80002n;

  let validator: SettlementValidator;
  let sourceEvent: SourceEvent;

  beforeEach(() => {
    validator = new SettlementValidator(
      sourceChainId,
      destinationChainId,
    );

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
      sourceChainId,
      destinationChainId,
      sourceNonce: 1n,
      transactionHash:
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      blockNumber: 100,
      blockHash:
        "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      logIndex: 0,
    };
  });

  it("accepts a valid settlement event", () => {
    const result = validator.validate(sourceEvent);

    expect(result.valid).to.equal(true);
    expect(result.reason).to.equal(undefined);
  });

  it("builds a settlement message from a valid event", () => {
    const message = validator.buildMessage(sourceEvent);

    expect(message).to.deep.equal({
      settlementId: sourceEvent.settlementId,
      initiator: sourceEvent.initiator,
      beneficiary: sourceEvent.beneficiary,
      asset: sourceEvent.asset,
      amount: sourceEvent.amount,
      sourceChainId: sourceEvent.sourceChainId,
      destinationChainId: sourceEvent.destinationChainId,
      sourceNonce: sourceEvent.sourceNonce,
    });
  });

  it("rejects an unexpected source chain", () => {
    sourceEvent.sourceChainId = 1n;

    const result = validator.validate(sourceEvent);

    expect(result.valid).to.equal(false);
    expect(result.reason).to.equal(
      "Unexpected source chain",
    );
  });

  it("rejects an unexpected destination chain", () => {
    sourceEvent.destinationChainId = 10n;

    const result = validator.validate(sourceEvent);

    expect(result.valid).to.equal(false);
    expect(result.reason).to.equal(
      "Unexpected destination chain",
    );
  });

  it("rejects identical source and destination chains", () => {
    const sameChainValidator = new SettlementValidator(
      sourceChainId,
      sourceChainId,
    );

    sourceEvent.destinationChainId = sourceChainId;

    const result = sameChainValidator.validate(
      sourceEvent,
    );

    expect(result.valid).to.equal(false);
    expect(result.reason).to.equal(
      "Source and destination chains must differ",
    );
  });

  it("rejects zero-value settlements", () => {
    sourceEvent.amount = 0n;

    const result = validator.validate(sourceEvent);

    expect(result.valid).to.equal(false);
    expect(result.reason).to.equal(
      "Settlement amount must be greater than zero",
    );
  });

  it("rejects negative settlement amounts", () => {
    sourceEvent.amount = -1n;

    const result = validator.validate(sourceEvent);

    expect(result.valid).to.equal(false);
    expect(result.reason).to.equal(
      "Settlement amount must be greater than zero",
    );
  });

  it("rejects a negative source nonce", () => {
    sourceEvent.sourceNonce = -1n;

    const result = validator.validate(sourceEvent);

    expect(result.valid).to.equal(false);
    expect(result.reason).to.equal(
      "Source nonce cannot be negative",
    );
  });

  it("rejects an invalid settlement ID", () => {
    sourceEvent.settlementId = "0x1234";

    const result = validator.validate(sourceEvent);

    expect(result.valid).to.equal(false);
    expect(result.reason).to.equal(
      "Invalid settlement ID",
    );
  });

  it("rejects an invalid initiator address", () => {
    sourceEvent.initiator = "0x1234";

    const result = validator.validate(sourceEvent);

    expect(result.valid).to.equal(false);
    expect(result.reason).to.equal(
      "Invalid initiator address",
    );
  });

  it("rejects an invalid beneficiary address", () => {
    sourceEvent.beneficiary = "0x1234";

    const result = validator.validate(sourceEvent);

    expect(result.valid).to.equal(false);
    expect(result.reason).to.equal(
      "Invalid beneficiary address",
    );
  });

  it("rejects an invalid asset address", () => {
    sourceEvent.asset = "0x1234";

    const result = validator.validate(sourceEvent);

    expect(result.valid).to.equal(false);
    expect(result.reason).to.equal(
      "Invalid asset address",
    );
  });

  it("throws when building a message from an invalid event", () => {
    sourceEvent.amount = 0n;

    expect(() =>
      validator.buildMessage(sourceEvent),
    ).to.throw(
      "Settlement amount must be greater than zero",
    );
  });
});