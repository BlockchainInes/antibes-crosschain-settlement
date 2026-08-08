import {
  SettlementMessage,
  SourceEvent,
  ValidationResult,
} from "./types.js";

export class SettlementValidator {
  constructor(
    private readonly expectedSourceChainId: bigint,
    private readonly expectedDestinationChainId: bigint,
  ) {}

  validate(sourceEvent: SourceEvent): ValidationResult {
    if (sourceEvent.sourceChainId !== this.expectedSourceChainId) {
      return {
        valid: false,
        reason: "Unexpected source chain",
      };
    }

    if (
      sourceEvent.destinationChainId !==
      this.expectedDestinationChainId
    ) {
      return {
        valid: false,
        reason: "Unexpected destination chain",
      };
    }

    if (sourceEvent.sourceChainId === sourceEvent.destinationChainId) {
      return {
        valid: false,
        reason: "Source and destination chains must differ",
      };
    }

    if (sourceEvent.amount <= 0n) {
      return {
        valid: false,
        reason: "Settlement amount must be greater than zero",
      };
    }

    if (sourceEvent.sourceNonce < 0n) {
      return {
        valid: false,
        reason: "Source nonce cannot be negative",
      };
    }

    if (!this.isBytes32(sourceEvent.settlementId)) {
      return {
        valid: false,
        reason: "Invalid settlement ID",
      };
    }

    if (!this.isAddress(sourceEvent.initiator)) {
      return {
        valid: false,
        reason: "Invalid initiator address",
      };
    }

    if (!this.isAddress(sourceEvent.beneficiary)) {
      return {
        valid: false,
        reason: "Invalid beneficiary address",
      };
    }

    if (!this.isAddress(sourceEvent.asset)) {
      return {
        valid: false,
        reason: "Invalid asset address",
      };
    }

    return {
      valid: true,
    };
  }

  buildMessage(sourceEvent: SourceEvent): SettlementMessage {
    const validation = this.validate(sourceEvent);

    if (!validation.valid) {
      throw new Error(
        validation.reason ?? "Settlement validation failed",
      );
    }

    return {
      settlementId: sourceEvent.settlementId,
      initiator: sourceEvent.initiator,
      beneficiary: sourceEvent.beneficiary,
      asset: sourceEvent.asset,
      amount: sourceEvent.amount,
      sourceChainId: sourceEvent.sourceChainId,
      destinationChainId: sourceEvent.destinationChainId,
      sourceNonce: sourceEvent.sourceNonce,
    };
  }

  private isAddress(value: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(value);
  }

  private isBytes32(value: string): boolean {
    return /^0x[a-fA-F0-9]{64}$/.test(value);
  }
}