import { expect } from "chai";
import { Wallet } from "ethers";

import {
  SettlementSigner,
} from "../src/signer.js";

import {
  SettlementMessage,
} from "../src/types.js";

describe("SettlementSigner", () => {
  let wallet: Wallet;
  let signer: SettlementSigner;
  let message: SettlementMessage;

  beforeEach(() => {
    wallet = Wallet.createRandom();

    signer = new SettlementSigner(
      wallet,
    );

    message = {
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
    };
  });

  it("produces a deterministic digest for the same settlement message", () => {
    const firstDigest = signer.hashMessage(
      message,
    );

    const secondDigest = signer.hashMessage(
      message,
    );

    expect(firstDigest).to.equal(
      secondDigest,
    );
  });

  it("produces different digests when the amount changes", () => {
    const originalDigest = signer.hashMessage(
      message,
    );

    const modifiedDigest = signer.hashMessage({
      ...message,
      amount: 1001n,
    });

    expect(modifiedDigest).to.not.equal(
      originalDigest,
    );
  });

  it("produces different digests when the destination chain changes", () => {
    const originalDigest = signer.hashMessage(
      message,
    );

    const modifiedDigest = signer.hashMessage({
      ...message,
      destinationChainId: 10n,
    });

    expect(modifiedDigest).to.not.equal(
      originalDigest,
    );
  });

  it("produces different digests when the beneficiary changes", () => {
    const originalDigest = signer.hashMessage(
      message,
    );

    const modifiedDigest = signer.hashMessage({
      ...message,
      beneficiary:
        "0x4444444444444444444444444444444444444444",
    });

    expect(modifiedDigest).to.not.equal(
      originalDigest,
    );
  });

  it("signs a settlement message with the configured wallet", async () => {
    const signedMessage = await signer.sign(
      message,
    );

    expect(signedMessage.message).to.deep.equal(
      message,
    );

    expect(signedMessage.digest).to.equal(
      signer.hashMessage(message),
    );

    expect(
      signedMessage.signer.toLowerCase(),
    ).to.equal(
      wallet.address.toLowerCase(),
    );

    expect(signedMessage.signature).to.match(
      /^0x[a-fA-F0-9]+$/,
    );
  });

  it("verifies a valid signed settlement message", async () => {
    const signedMessage = await signer.sign(
      message,
    );

    expect(
      signer.verify(signedMessage),
    ).to.equal(true);
  });

  it("rejects a message whose digest was altered", async () => {
    const signedMessage = await signer.sign(
      message,
    );

    signedMessage.digest =
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    expect(
      signer.verify(signedMessage),
    ).to.equal(false);
  });

  it("rejects a message whose settlement data was altered after signing", async () => {
    const signedMessage = await signer.sign(
      message,
    );

    signedMessage.message = {
      ...signedMessage.message,
      amount: 9999n,
    };

    expect(
      signer.verify(signedMessage),
    ).to.equal(false);
  });

  it("rejects a signature attributed to the wrong signer", async () => {
    const signedMessage = await signer.sign(
      message,
    );

    const otherWallet = Wallet.createRandom();

    signedMessage.signer =
      otherWallet.address;

    expect(
      signer.verify(signedMessage),
    ).to.equal(false);
  });

  it("rejects a signature produced by another wallet", async () => {
    const otherWallet = Wallet.createRandom();

    const otherSigner = new SettlementSigner(
      otherWallet,
    );

    const signedMessage =
      await otherSigner.sign(message);

    signedMessage.signer =
      wallet.address;

    expect(
      signer.verify(signedMessage),
    ).to.equal(false);
  });
});