import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
  SOURCE_RPC_URL: z.string().url(),
  DESTINATION_RPC_URL: z.string().url(),
  SOURCE_CONTRACT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  DESTINATION_CONTRACT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  RELAYER_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  SOURCE_CHAIN_ID: z.coerce.bigint().positive(),
  DESTINATION_CHAIN_ID: z.coerce.bigint().positive(),
  REQUIRED_CONFIRMATIONS: z.coerce.number().int().positive().default(12),
  POLLING_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  MAX_RETRY_ATTEMPTS: z.coerce.number().int().positive().default(5),
});

const environment = environmentSchema.parse(process.env);

export interface RelayerConfig {
  sourceRpcUrl: string;
  destinationRpcUrl: string;
  sourceContractAddress: string;
  destinationContractAddress: string;
  relayerPrivateKey: string;
  sourceChainId: bigint;
  destinationChainId: bigint;
  requiredConfirmations: number;
  pollingIntervalMs: number;
  maxRetryAttempts: number;
}

export const config: RelayerConfig = {
  sourceRpcUrl: environment.SOURCE_RPC_URL,
  destinationRpcUrl: environment.DESTINATION_RPC_URL,
  sourceContractAddress: environment.SOURCE_CONTRACT_ADDRESS,
  destinationContractAddress: environment.DESTINATION_CONTRACT_ADDRESS,
  relayerPrivateKey: environment.RELAYER_PRIVATE_KEY,
  sourceChainId: environment.SOURCE_CHAIN_ID,
  destinationChainId: environment.DESTINATION_CHAIN_ID,
  requiredConfirmations: environment.REQUIRED_CONFIRMATIONS,
  pollingIntervalMs: environment.POLLING_INTERVAL_MS,
  maxRetryAttempts: environment.MAX_RETRY_ATTEMPTS,
};