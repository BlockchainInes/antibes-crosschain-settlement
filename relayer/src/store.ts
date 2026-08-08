import {
  SettlementRecord,
  SettlementStatus,
  SourceEvent,
} from "./types.js";

export class SettlementStore {
  private readonly records = new Map<string, SettlementRecord>();

  create(sourceEvent: SourceEvent): SettlementRecord {
    const existing = this.records.get(sourceEvent.settlementId);

    if (existing) {
      return existing;
    }

    const now = Date.now();

    const record: SettlementRecord = {
      settlementId: sourceEvent.settlementId,
      status: SettlementStatus.Detected,
      sourceEvent,
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.records.set(sourceEvent.settlementId, record);

    return record;
  }

  get(settlementId: string): SettlementRecord | undefined {
    return this.records.get(settlementId);
  }

  has(settlementId: string): boolean {
    return this.records.has(settlementId);
  }

  update(
    settlementId: string,
    updates: Partial<
      Omit<SettlementRecord, "settlementId" | "createdAt">
    >,
  ): SettlementRecord {
    const existing = this.records.get(settlementId);

    if (!existing) {
      throw new Error(
        `Settlement ${settlementId} does not exist`,
      );
    }

    const updated: SettlementRecord = {
      ...existing,
      ...updates,
      settlementId: existing.settlementId,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    };

    this.records.set(settlementId, updated);

    return updated;
  }

  transition(
    settlementId: string,
    status: SettlementStatus,
  ): SettlementRecord {
    return this.update(settlementId, {
      status,
      lastError: undefined,
    });
  }

  recordFailure(
    settlementId: string,
    error: string,
    retryable: boolean,
  ): SettlementRecord {
    const existing = this.require(settlementId);

    return this.update(settlementId, {
      status: retryable
        ? SettlementStatus.RetryableFailure
        : SettlementStatus.Failed,
      attempts: existing.attempts + 1,
      lastError: error,
    });
  }

  incrementAttempts(
    settlementId: string,
  ): SettlementRecord {
    const existing = this.require(settlementId);

    return this.update(settlementId, {
      attempts: existing.attempts + 1,
    });
  }

  listByStatus(
    status: SettlementStatus,
  ): SettlementRecord[] {
    return Array.from(this.records.values()).filter(
      (record) => record.status === status,
    );
  }

  listRecoverable(): SettlementRecord[] {
    const recoverableStatuses = new Set<SettlementStatus>([
      SettlementStatus.Detected,
      SettlementStatus.FinalityPending,
      SettlementStatus.Validated,
      SettlementStatus.Signed,
      SettlementStatus.Submitted,
      SettlementStatus.RetryableFailure,
    ]);

    return Array.from(this.records.values()).filter(
      (record) =>
        recoverableStatuses.has(record.status),
    );
  }

  listAll(): SettlementRecord[] {
    return Array.from(this.records.values());
  }

  private require(
    settlementId: string,
  ): SettlementRecord {
    const record = this.records.get(settlementId);

    if (!record) {
      throw new Error(
        `Settlement ${settlementId} does not exist`,
      );
    }

    return record;
  }
}