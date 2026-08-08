import {
  SettlementRecord,
  SettlementStatus,
} from "./types.js";

import {
  SettlementStore,
} from "./store.js";

export interface RecoveryDecision {
  recoverable: boolean;
  nextStatus?: SettlementStatus;
  reason?: string;
}

export class SettlementRecovery {
  constructor(
    private readonly store: SettlementStore,
    private readonly maxRetryAttempts: number,
  ) {
    if (
      !Number.isInteger(maxRetryAttempts) ||
      maxRetryAttempts < 1
    ) {
      throw new Error(
        "Maximum retry attempts must be a positive integer",
      );
    }
  }

  evaluate(
    record: SettlementRecord,
  ): RecoveryDecision {
    if (
      record.status === SettlementStatus.Confirmed
    ) {
      return {
        recoverable: false,
        reason: "Settlement is already confirmed",
      };
    }

    if (
      record.status === SettlementStatus.Failed
    ) {
      return {
        recoverable: false,
        reason: "Settlement is permanently failed",
      };
    }

    if (
      record.attempts >= this.maxRetryAttempts
    ) {
      return {
        recoverable: false,
        reason: "Maximum retry attempts reached",
      };
    }

    switch (record.status) {
      case SettlementStatus.Detected:
      case SettlementStatus.FinalityPending:
        return {
          recoverable: true,
          nextStatus: SettlementStatus.FinalityPending,
        };

      case SettlementStatus.Validated:
        return {
          recoverable: true,
          nextStatus: SettlementStatus.Validated,
        };

      case SettlementStatus.Signed:
        return {
          recoverable: true,
          nextStatus: SettlementStatus.Signed,
        };

      case SettlementStatus.Submitted:
        return {
          recoverable: true,
          nextStatus: SettlementStatus.Submitted,
        };

      case SettlementStatus.RetryableFailure:
        return {
          recoverable: true,
          nextStatus: this.resolveRetryTarget(record),
        };

      default:
        return {
          recoverable: false,
          reason: `Unsupported settlement status: ${record.status}`,
        };
    }
  }

  recoverableRecords(): SettlementRecord[] {
    return this.store
      .listRecoverable()
      .filter(
        (record) =>
          this.evaluate(record).recoverable,
      );
  }

  markPermanentFailure(
    settlementId: string,
    reason: string,
  ): SettlementRecord {
    return this.store.update(
      settlementId,
      {
        status: SettlementStatus.Failed,
        lastError: reason,
      },
    );
  }

  prepareRetry(
    settlementId: string,
  ): SettlementRecord {
    const record = this.store.get(
      settlementId,
    );

    if (!record) {
      throw new Error(
        `Settlement ${settlementId} does not exist`,
      );
    }

    const decision = this.evaluate(
      record,
    );

    if (
      !decision.recoverable ||
      !decision.nextStatus
    ) {
      throw new Error(
        decision.reason ??
          `Settlement ${settlementId} is not recoverable`,
      );
    }

    return this.store.update(
      settlementId,
      {
        status: decision.nextStatus,
        lastError: undefined,
      },
    );
  }

  private resolveRetryTarget(
    record: SettlementRecord,
  ): SettlementStatus {
    if (record.signedMessage) {
      return SettlementStatus.Signed;
    }

    if (record.message) {
      return SettlementStatus.Validated;
    }

    return SettlementStatus.FinalityPending;
  }
}