export enum SettlementStatus {
  Detected = "DETECTED",
  FinalityPending = "FINALITY_PENDING",
  Validated = "VALIDATED",
  Signed = "SIGNED",
  Submitted = "SUBMITTED",
  Confirmed = "CONFIRMED",
  RetryableFailure = "RETRYABLE_FAILURE",
  Failed = "FAILED",
}

export interface SourceEvent {
  settlementId: string;
  initiator: string;
  beneficiary: string;
  asset: string;
  amount: bigint;
  sourceChainId: bigint;
  destinationChainId: bigint;
  sourceNonce: bigint;
  transactionHash: string;
  blockNumber: number;
  blockHash: string;
  logIndex: number;
}

export interface SettlementMessage {
  settlementId: string;
  initiator: string;
  beneficiary: string;
  asset: string;
  amount: bigint;
  sourceChainId: bigint;
  destinationChainId: bigint;
  sourceNonce: bigint;
}

export interface SignedSettlementMessage {
  message: SettlementMessage;
  digest: string;
  signature: string;
  signer: string;
}

export interface SettlementRecord {
  settlementId: string;
  status: SettlementStatus;
  sourceEvent: SourceEvent;
  message?: SettlementMessage;
  signedMessage?: SignedSettlementMessage;
  destinationTransactionHash?: string;
  attempts: number;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
}

export interface FinalityResult {
  finalized: boolean;
  confirmations: number;
  canonicalBlockHash?: string;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export interface ExecutionResult {
  transactionHash: string;
  blockNumber: number;
}

export interface RelayerError {
  code: string;
  message: string;
  retryable: boolean;
  cause?: unknown;
}