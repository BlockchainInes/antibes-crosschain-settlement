import { expect } from "chai";
import {
  Interface,
  JsonRpcProvider,
  Log,
  Wallet,
} from "ethers";

import {
  SettlementExecutor,
} from "../src/executor.js";

import {
  FinalityChecker,
} from "../src/finality.js";

import {
  SettlementListener,
} from "../src/listener.js";

import {
  SettlementSigner,
} from "../src/signer.js";

import {
  SettlementStore,
} from "../src/store.js";

import {
  SettlementStatus,
} from "../src/types.js";

import {
  SettlementValidator,
} from "../src/validator.js";

const sourceAbi = [
  "event SettlementInitiated(bytes32 indexed settlementId,address indexed initiator,address indexed beneficiary,address asset,uint256 amount,uint256 sourceChainId,uint256 destinationChainId,uint256 nonce)",
];

describe("Cross-chain settlement lifecycle", () => {
  it("processes a finalized source event through validation, signing, execution and confirmation", async () => {
    const sourceContractAddress =
      "0x9999999999999999999999999999999999999999";

    const destinationContractAddress =
      "0x8888888888888888888888888888888888888888";

    const initiator =
      "0x1111111111111111111111111111111111111111";

    const beneficiary =
      "0x2222222222222222222222222222222222222222";

    const asset =
      "0x3333333333333333333333333333333333333333";

    const settlementId =
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    const transactionHash =
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    const sourceBlockHash =
      "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

    const destinationTransactionHash =
      "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";

    const sourceChainId = 11155111n;
    const destinationChainId = 80002n;
    const sourceBlockNumber = 100;
    const requiredConfirmations = 12;

    const contractInterface = new Interface(
      sourceAbi,
    );

    const event = contractInterface.getEvent(
      "SettlementInitiated",
    );

    if (!event) {
      throw new Error(
        "SettlementInitiated event definition is unavailable",
      );
    }

    const encoded = contractInterface.encodeEventLog(
      event,
      [
        settlementId,
        initiator,
        beneficiary,
        asset,
        1000n,
        sourceChainId,
        destinationChainId,
        7n,
      ],
    );

    const sourceLog = {
      address: sourceContractAddress,
      blockHash: sourceBlockHash,
      blockNumber: sourceBlockNumber,
      data: encoded.data,
      index: 0,
      removed: false,
      topics: encoded.topics,
      transactionHash,
      transactionIndex: 0,
    } as Log;

    const sourceProvider = {
      getLogs: async () => [
        sourceLog,
      ],

      getBlock: async () => ({
        hash: sourceBlockHash,
      }),

      getBlockNumber: async () => 111,
    } as unknown as JsonRpcProvider;

    const listener = new SettlementListener(
      sourceProvider,
      sourceContractAddress,
      sourceChainId,
    );

    const finalityChecker = new FinalityChecker(
      sourceProvider,
      requiredConfirmations,
    );

    const validator = new SettlementValidator(
      sourceChainId,
      destinationChainId,
    );

    const relayerWallet = Wallet.createRandom();

    const signer = new SettlementSigner(
      relayerWallet,
    );

    const store = new SettlementStore();

    const observedEvents = await listener.getEvents(
      sourceBlockNumber,
      sourceBlockNumber,
    );

    expect(observedEvents).to.have.length(1);

    const sourceEvent = observedEvents[0];

    const detectedRecord = store.create(
      sourceEvent,
    );

    expect(detectedRecord.status).to.equal(
      SettlementStatus.Detected,
    );

    store.transition(
      settlementId,
      SettlementStatus.FinalityPending,
    );

    const finalityResult =
      await finalityChecker.check(
        sourceEvent,
      );

    expect(finalityResult.finalized).to.equal(
      true,
    );

    expect(finalityResult.confirmations).to.equal(
      requiredConfirmations,
    );

    const validationResult =
      validator.validate(
        sourceEvent,
      );

    expect(validationResult.valid).to.equal(
      true,
    );

    const message =
      validator.buildMessage(
        sourceEvent,
      );

    store.update(
      settlementId,
      {
        message,
        status: SettlementStatus.Validated,
      },
    );

    const signedMessage =
      await signer.sign(
        message,
      );

    expect(
      signer.verify(
        signedMessage,
      ),
    ).to.equal(true);

    store.update(
      settlementId,
      {
        signedMessage,
        status: SettlementStatus.Signed,
      },
    );

    const destinationProvider =
      new JsonRpcProvider(
        "http://127.0.0.1:8545",
      );

    const executor = new SettlementExecutor(
      destinationContractAddress,
      destinationProvider,
      relayerWallet,
    );

    (
      executor as unknown as {
        contract: unknown;
      }
    ).contract = {
      executions: async () => ({
        executed: false,
      }),

      executeSettlement: async (
        receivedSettlementId: string,
        receivedInitiator: string,
        receivedBeneficiary: string,
        receivedAsset: string,
        receivedAmount: bigint,
        receivedSourceChainId: bigint,
        receivedDestinationChainId: bigint,
        receivedSourceNonce: bigint,
      ) => {
        expect(
          receivedSettlementId,
        ).to.equal(
          settlementId,
        );

        expect(
          receivedInitiator,
        ).to.equal(
          initiator,
        );

        expect(
          receivedBeneficiary,
        ).to.equal(
          beneficiary,
        );

        expect(
          receivedAsset,
        ).to.equal(
          asset,
        );

        expect(
          receivedAmount,
        ).to.equal(
          1000n,
        );

        expect(
          receivedSourceChainId,
        ).to.equal(
          sourceChainId,
        );

        expect(
          receivedDestinationChainId,
        ).to.equal(
          destinationChainId,
        );

        expect(
          receivedSourceNonce,
        ).to.equal(
          7n,
        );

        return {
          wait: async () => ({
            status: 1,
            hash: destinationTransactionHash,
            blockNumber: 200,
          }),
        };
      },
    };

    store.transition(
      settlementId,
      SettlementStatus.Submitted,
    );

    const executionResult =
      await executor.execute(
        signedMessage,
      );

    store.update(
      settlementId,
      {
        status: SettlementStatus.Confirmed,
        destinationTransactionHash:
          executionResult.transactionHash,
      },
    );

    const confirmedRecord =
      store.get(
        settlementId,
      );

    expect(confirmedRecord).to.not.equal(
      undefined,
    );

    expect(
      confirmedRecord?.status,
    ).to.equal(
      SettlementStatus.Confirmed,
    );

    expect(
      confirmedRecord?.destinationTransactionHash,
    ).to.equal(
      destinationTransactionHash,
    );

    expect(
      confirmedRecord?.message,
    ).to.deep.equal(
      message,
    );

    expect(
      confirmedRecord?.signedMessage?.digest,
    ).to.equal(
      signedMessage.digest,
    );
  });
});