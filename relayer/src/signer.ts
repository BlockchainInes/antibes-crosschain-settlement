import {
  AbiCoder,
  Wallet,
  keccak256,
  verifyMessage,
} from "ethers";

import {
  SettlementMessage,
  SignedSettlementMessage,
} from "./types.js";

export class SettlementSigner {
  constructor(
    private readonly wallet: Wallet,
  ) {}

  async sign(
    message: SettlementMessage,
  ): Promise<SignedSettlementMessage> {
    const digest = this.hashMessage(message);

    const signature = await this.wallet.signMessage(
      this.hexToBytes(digest),
    );

    return {
      message,
      digest,
      signature,
      signer: this.wallet.address,
    };
  }

  verify(
    signedMessage: SignedSettlementMessage,
  ): boolean {
    const expectedDigest = this.hashMessage(
      signedMessage.message,
    );

    if (
      expectedDigest.toLowerCase() !==
      signedMessage.digest.toLowerCase()
    ) {
      return false;
    }

    const recoveredSigner = verifyMessage(
      this.hexToBytes(signedMessage.digest),
      signedMessage.signature,
    );

    return (
      recoveredSigner.toLowerCase() ===
      signedMessage.signer.toLowerCase()
    );
  }

  hashMessage(
    message: SettlementMessage,
  ): string {
    const encoded = AbiCoder.defaultAbiCoder().encode(
      [
        "bytes32",
        "address",
        "address",
        "address",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
      ],
      [
        message.settlementId,
        message.initiator,
        message.beneficiary,
        message.asset,
        message.amount,
        message.sourceChainId,
        message.destinationChainId,
        message.sourceNonce,
      ],
    );

    return keccak256(encoded);
  }

  private hexToBytes(hex: string): Uint8Array {
    return Uint8Array.from(
      Buffer.from(
        hex.slice(2),
        "hex",
      ),
    );
  }
}
