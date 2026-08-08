import { expect } from "chai";
import {
  JsonRpcProvider,
  Wallet,
} from "ethers";

import {
  SettlementExecutor,
} from "../src/executor.js";

import {
  SignedSettlementMessage,
} from "../src/types.js";

describe("SettlementExecutor", () => {
  const destinationContractAddress =
    "0x9999999999999999999999999999999999999999";

  let provider: JsonRpcProvider;
  let wallet: Wallet;
  let executor: SettlementExecutor;
  let signedSettlement: SignedSettlementMessage;

  beforeEach(() => {
    provider = new JsonRpcProvider(
      "http://127.0.0.1:8545",
    );

    wallet = Wallet.createRandom();

    executor = new SettlementExecutor(
      destinationContractAddress,
      provider,
      wallet,
    );

    signedSettlement = {
      message: {
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
        sourceNonce: 7n,
      },
      digest:
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      signature: "0x1234",
      signer: wallet.address,
    };
  });

  function replaceContract(
    contractMock: unknown,
  ): void {
    (
      executor as unknown as {
        contract: unknown;
      }
    ).contract = contractMock;
  }

  it("reports an unprocessed settlement", async () => {
    replaceContract({
      executions: async () => ({
        executed: false,
      }),
    });

    const processed = await executor.isProcessed(
      signedSettlement.message.settlementId,
    );

    expect(processed).to.equal(false);
  });

  it("reports an already processed settlement", async () => {
    replaceContract({
      executions: async () => ({
        executed: true,
      }),
    });

    const processed = await executor.isProcessed(
      signedSettlement.message.settlementId,
    );

    expect(processed).to.equal(true);
  });

  it("rejects execution when the settlement was already processed", async () => {
    replaceContract({
      executions: async () => ({
        executed: true,
      }),
    });

    let error: unknown;

    try {
      await executor.execute(
        signedSettlement,
      );
    } catch (caught) {
      error = caught;
    }

    expect(error).to.be.instanceOf(
      Error,
    );

    expect(
      (error as Error).message,
    ).to.equal(
      `Settlement ${signedSettlement.message.settlementId} has already been processed`,
    );
  });

  it("submits the exact settlement payload to the destination contract", async () => {
    const submittedArguments: unknown[] = [];

    replaceContract({
      executions: async () => ({
        executed: false,
      }),

      executeSettlement: async (
        ...args: unknown[]
      ) => {
        submittedArguments.push(
          ...args,
        );

        return {
          wait: async () => ({
            status: 1,
            hash:
              "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            blockNumber: 200,
          }),
        };
      },
    });

    await executor.execute(
      signedSettlement,
    );

    const { message } =
      signedSettlement;

    expect(
      submittedArguments,
    ).to.deep.equal([
      message.settlementId,
      message.initiator,
      message.beneficiary,
      message.asset,
      message.amount,
      message.sourceChainId,
      message.destinationChainId,
      message.sourceNonce,
    ]);
  });

  it("returns the confirmed destination transaction details", async () => {
    const transactionHash =
      "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

    replaceContract({
      executions: async () => ({
        executed: false,
      }),

      executeSettlement: async () => ({
        wait: async () => ({
          status: 1,
          hash: transactionHash,
          blockNumber: 200,
        }),
      }),
    });

    const result = await executor.execute(
      signedSettlement,
    );

    expect(
      result.transactionHash,
    ).to.equal(
      transactionHash,
    );

    expect(
      result.blockNumber,
    ).to.equal(
      200,
    );
  });

  it("rejects execution when no transaction receipt is returned", async () => {
    replaceContract({
      executions: async () => ({
        executed: false,
      }),

      executeSettlement: async () => ({
        wait: async () => null,
      }),
    });

    let error: unknown;

    try {
      await executor.execute(
        signedSettlement,
      );
    } catch (caught) {
      error = caught;
    }

    expect(error).to.be.instanceOf(
      Error,
    );

    expect(
      (error as Error).message,
    ).to.equal(
      `No receipt returned for settlement ${signedSettlement.message.settlementId}`,
    );
  });

  it("rejects a reverted destination transaction", async () => {
    replaceContract({
      executions: async () => ({
        executed: false,
      }),

      executeSettlement: async () => ({
        wait: async () => ({
          status: 0,
          hash:
            "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
          blockNumber: 201,
        }),
      }),
    });

    let error: unknown;

    try {
      await executor.execute(
        signedSettlement,
      );
    } catch (caught) {
      error = caught;
    }

    expect(error).to.be.instanceOf(
      Error,
    );

    expect(
      (error as Error).message,
    ).to.equal(
      `Settlement transaction failed for ${signedSettlement.message.settlementId}`,
    );
  });

  it("performs the processed-settlement check before submission", async () => {
    let executionsChecked = false;
    let executionSubmitted = false;

    replaceContract({
      executions: async () => {
        executionsChecked = true;

        return {
          executed: false,
        };
      },

      executeSettlement: async () => {
        executionSubmitted = true;

        expect(
          executionsChecked,
        ).to.equal(true);

        return {
          wait: async () => ({
            status: 1,
            hash:
              "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
            blockNumber: 202,
          }),
        };
      },
    });

    await executor.execute(
      signedSettlement,
    );

    expect(
      executionsChecked,
    ).to.equal(true);

    expect(
      executionSubmitted,
    ).to.equal(true);
  });
});