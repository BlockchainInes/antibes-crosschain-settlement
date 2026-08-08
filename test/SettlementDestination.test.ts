import { expect } from "chai";
import { network } from "hardhat";

describe("SettlementDestination", function () {
  this.slow(2000);

  async function deployFixture() {
    const { ethers } = await network.connect();

    const [
      owner,
      relayer,
      unauthorized,
      initiator,
      beneficiary,
      asset,
      newRelayer,
    ] = await ethers.getSigners();

    const registry = await ethers.deployContract("ComplianceRegistry");
    await registry.waitForDeployment();

    const destination = await ethers.deployContract(
      "SettlementDestination",
      [
        await registry.getAddress(),
        relayer.address,
      ],
    );

    await destination.waitForDeployment();

    return {
      ethers,
      owner,
      relayer,
      unauthorized,
      initiator,
      beneficiary,
      asset,
      newRelayer,
      registry,
      destination,
    };
  }

  async function approveSettlementParticipants(
    registry: any,
    initiator: any,
    beneficiary: any,
    asset: any,
  ) {
    await registry.setParticipantApproval(
      initiator.address,
      true,
    );

    await registry.setParticipantApproval(
      beneficiary.address,
      true,
    );

    await registry.setAssetApproval(
      asset.address,
      true,
    );
  }

  describe("Deployment", function () {
    it("configures the deployer, relayer and compliance registry", async function () {
      const {
        owner,
        relayer,
        registry,
        destination,
      } = await deployFixture();

      expect(await destination.owner()).to.equal(
        owner.address,
      );

      expect(await destination.relayer()).to.equal(
        relayer.address,
      );

      expect(
        await destination.complianceRegistry(),
      ).to.equal(
        await registry.getAddress(),
      );
    });

    it("rejects a zero compliance registry address", async function () {
      const {
        ethers,
        relayer,
      } = await deployFixture();

      await expect(
        ethers.deployContract(
          "SettlementDestination",
          [
            ethers.ZeroAddress,
            relayer.address,
          ],
        ),
      ).to.be.revertedWithCustomError(
        await ethers.getContractFactory(
          "SettlementDestination",
        ),
        "ZeroAddress",
      );
    });

    it("rejects a zero initial relayer address", async function () {
      const {
        ethers,
        registry,
      } = await deployFixture();

      await expect(
        ethers.deployContract(
          "SettlementDestination",
          [
            await registry.getAddress(),
            ethers.ZeroAddress,
          ],
        ),
      ).to.be.revertedWithCustomError(
        await ethers.getContractFactory(
          "SettlementDestination",
        ),
        "ZeroAddress",
      );
    });
  });

  describe("Relayer administration", function () {
    it("allows the owner to replace the relayer", async function () {
      const {
        relayer,
        newRelayer,
        destination,
      } = await deployFixture();

      await expect(
        destination.setRelayer(
          newRelayer.address,
        ),
      )
        .to.emit(
          destination,
          "RelayerUpdated",
        )
        .withArgs(
          relayer.address,
          newRelayer.address,
        );

      expect(
        await destination.relayer(),
      ).to.equal(
        newRelayer.address,
      );
    });

    it("rejects relayer changes from non-owners", async function () {
      const {
        unauthorized,
        newRelayer,
        destination,
      } = await deployFixture();

      await expect(
        destination
          .connect(unauthorized)
          .setRelayer(
            newRelayer.address,
          ),
      ).to.be.revertedWithCustomError(
        destination,
        "UnauthorizedRelayer",
      );
    });

    it("rejects a zero relayer address", async function () {
      const {
        ethers,
        destination,
      } = await deployFixture();

      await expect(
        destination.setRelayer(
          ethers.ZeroAddress,
        ),
      ).to.be.revertedWithCustomError(
        destination,
        "ZeroAddress",
      );
    });
  });

  describe("Settlement execution", function () {
    it("executes a compliant settlement exactly once", async function () {
      const {
        ethers,
        relayer,
        initiator,
        beneficiary,
        asset,
        registry,
        destination,
      } = await deployFixture();

      await approveSettlementParticipants(
        registry,
        initiator,
        beneficiary,
        asset,
      );

      const destinationNetwork =
        await ethers.provider.getNetwork();

      const settlementId = ethers.id(
        "ANTIBES-SETTLEMENT-001",
      );

      const amount = 1_000_000n;
      const sourceChainId = 11155111n;
      const sourceNonce = 0n;

      await expect(
        destination
          .connect(relayer)
          .executeSettlement(
            settlementId,
            initiator.address,
            beneficiary.address,
            asset.address,
            amount,
            sourceChainId,
            destinationNetwork.chainId,
            sourceNonce,
          ),
      )
        .to.emit(
          destination,
          "SettlementExecuted",
        )
        .withArgs(
          settlementId,
          initiator.address,
          beneficiary.address,
          asset.address,
          amount,
          sourceChainId,
          sourceNonce,
        );

      const execution =
        await destination.executions(
          settlementId,
        );

      expect(execution.initiator).to.equal(
        initiator.address,
      );

      expect(execution.beneficiary).to.equal(
        beneficiary.address,
      );

      expect(execution.asset).to.equal(
        asset.address,
      );

      expect(execution.amount).to.equal(
        amount,
      );

      expect(
        execution.sourceChainId,
      ).to.equal(
        sourceChainId,
      );

      expect(
        execution.sourceNonce,
      ).to.equal(
        sourceNonce,
      );

      expect(execution.executed).to.equal(
        true,
      );
    });

    it("rejects execution from an unauthorized account", async function () {
      const {
        ethers,
        unauthorized,
        initiator,
        beneficiary,
        asset,
        destination,
      } = await deployFixture();

      const destinationNetwork =
        await ethers.provider.getNetwork();

      await expect(
        destination
          .connect(unauthorized)
          .executeSettlement(
            ethers.id(
              "ANTIBES-SETTLEMENT-002",
            ),
            initiator.address,
            beneficiary.address,
            asset.address,
            1_000_000n,
            11155111n,
            destinationNetwork.chainId,
            0n,
          ),
      ).to.be.revertedWithCustomError(
        destination,
        "UnauthorizedRelayer",
      );
    });

    it("rejects a non-compliant settlement", async function () {
      const {
        ethers,
        relayer,
        initiator,
        beneficiary,
        asset,
        destination,
      } = await deployFixture();

      const destinationNetwork =
        await ethers.provider.getNetwork();

      await expect(
        destination
          .connect(relayer)
          .executeSettlement(
            ethers.id(
              "ANTIBES-SETTLEMENT-003",
            ),
            initiator.address,
            beneficiary.address,
            asset.address,
            1_000_000n,
            11155111n,
            destinationNetwork.chainId,
            0n,
          ),
      ).to.be.revertedWithCustomError(
        destination,
        "NonCompliantSettlement",
      );
    });

    it("rejects a settlement targeting the wrong destination chain", async function () {
      const {
        ethers,
        relayer,
        initiator,
        beneficiary,
        asset,
        registry,
        destination,
      } = await deployFixture();

      await approveSettlementParticipants(
        registry,
        initiator,
        beneficiary,
        asset,
      );

      const destinationNetwork =
        await ethers.provider.getNetwork();

      const wrongDestinationChainId =
        destinationNetwork.chainId + 1n;

      await expect(
        destination
          .connect(relayer)
          .executeSettlement(
            ethers.id(
              "ANTIBES-SETTLEMENT-004",
            ),
            initiator.address,
            beneficiary.address,
            asset.address,
            1_000_000n,
            11155111n,
            wrongDestinationChainId,
            0n,
          ),
      ).to.be.revertedWithCustomError(
        destination,
        "InvalidDestinationChain",
      );
    });

    it("rejects settlement execution with zero-value addresses", async function () {
      const {
        ethers,
        relayer,
        beneficiary,
        asset,
        destination,
      } = await deployFixture();

      const destinationNetwork =
        await ethers.provider.getNetwork();

      await expect(
        destination
          .connect(relayer)
          .executeSettlement(
            ethers.id(
              "ANTIBES-SETTLEMENT-005",
            ),
            ethers.ZeroAddress,
            beneficiary.address,
            asset.address,
            1_000_000n,
            11155111n,
            destinationNetwork.chainId,
            0n,
          ),
      ).to.be.revertedWithCustomError(
        destination,
        "ZeroAddress",
      );
    });

    it("rejects a zero settlement amount", async function () {
      const {
        ethers,
        relayer,
        initiator,
        beneficiary,
        asset,
        destination,
      } = await deployFixture();

      const destinationNetwork =
        await ethers.provider.getNetwork();

      await expect(
        destination
          .connect(relayer)
          .executeSettlement(
            ethers.id(
              "ANTIBES-SETTLEMENT-006",
            ),
            initiator.address,
            beneficiary.address,
            asset.address,
            0n,
            11155111n,
            destinationNetwork.chainId,
            0n,
          ),
      ).to.be.revertedWithCustomError(
        destination,
        "InvalidAmount",
      );
    });

    it("rejects a zero source chain identifier", async function () {
      const {
        ethers,
        relayer,
        initiator,
        beneficiary,
        asset,
        destination,
      } = await deployFixture();

      const destinationNetwork =
        await ethers.provider.getNetwork();

      await expect(
        destination
          .connect(relayer)
          .executeSettlement(
            ethers.id(
              "ANTIBES-SETTLEMENT-007",
            ),
            initiator.address,
            beneficiary.address,
            asset.address,
            1_000_000n,
            0n,
            destinationNetwork.chainId,
            0n,
          ),
      ).to.be.revertedWithCustomError(
        destination,
        "InvalidSourceChain",
      );
    });

    it("prevents replay of an already executed settlement", async function () {
      const {
        ethers,
        relayer,
        initiator,
        beneficiary,
        asset,
        registry,
        destination,
      } = await deployFixture();

      await approveSettlementParticipants(
        registry,
        initiator,
        beneficiary,
        asset,
      );

      const destinationNetwork =
        await ethers.provider.getNetwork();

      const settlementId = ethers.id(
        "ANTIBES-SETTLEMENT-008",
      );

      const amount = 1_000_000n;
      const sourceChainId = 11155111n;
      const sourceNonce = 7n;

      await destination
        .connect(relayer)
        .executeSettlement(
          settlementId,
          initiator.address,
          beneficiary.address,
          asset.address,
          amount,
          sourceChainId,
          destinationNetwork.chainId,
          sourceNonce,
        );

      await expect(
        destination
          .connect(relayer)
          .executeSettlement(
            settlementId,
            initiator.address,
            beneficiary.address,
            asset.address,
            amount,
            sourceChainId,
            destinationNetwork.chainId,
            sourceNonce,
          ),
      ).to.be.revertedWithCustomError(
        destination,
        "SettlementAlreadyExecuted",
      );
    });
  });
});