import { expect } from "chai";
import { network } from "hardhat";

describe("ComplianceRegistry", function () {
  this.slow(2000);

  async function deployFixture() {
    const { ethers } = await network.connect();
    const [owner, participantA, participantB, asset, newOwner] =
      await ethers.getSigners();

    const registry = await ethers.deployContract("ComplianceRegistry");
    await registry.waitForDeployment();

    return {
      ethers,
      owner,
      participantA,
      participantB,
      asset,
      newOwner,
      registry,
    };
  }

  describe("Deployment", function () {
    it("assigns the deployer as owner", async function () {
      const { owner, registry } = await deployFixture();

      expect(await registry.owner()).to.equal(owner.address);
    });
  });

  describe("Participant approvals", function () {
    it("allows the owner to approve and revoke a participant", async function () {
      const { participantA, registry } = await deployFixture();

      await expect(
        registry.setParticipantApproval(participantA.address, true),
      )
        .to.emit(registry, "ParticipantApprovalUpdated")
        .withArgs(participantA.address, true);

      expect(
        await registry.approvedParticipants(participantA.address),
      ).to.equal(true);

      await expect(
        registry.setParticipantApproval(participantA.address, false),
      )
        .to.emit(registry, "ParticipantApprovalUpdated")
        .withArgs(participantA.address, false);

      expect(
        await registry.approvedParticipants(participantA.address),
      ).to.equal(false);
    });

    it("rejects participant approval changes from non-owners", async function () {
      const { participantA, participantB, registry } =
        await deployFixture();

      await expect(
        registry
          .connect(participantA)
          .setParticipantApproval(participantB.address, true),
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });

    it("rejects the zero address as a participant", async function () {
      const { ethers, registry } = await deployFixture();

      await expect(
        registry.setParticipantApproval(ethers.ZeroAddress, true),
      ).to.be.revertedWithCustomError(registry, "ZeroAddress");
    });
  });

  describe("Asset approvals", function () {
    it("allows the owner to approve and revoke an asset", async function () {
      const { asset, registry } = await deployFixture();

      await expect(
        registry.setAssetApproval(asset.address, true),
      )
        .to.emit(registry, "AssetApprovalUpdated")
        .withArgs(asset.address, true);

      expect(await registry.approvedAssets(asset.address)).to.equal(true);

      await expect(
        registry.setAssetApproval(asset.address, false),
      )
        .to.emit(registry, "AssetApprovalUpdated")
        .withArgs(asset.address, false);

      expect(await registry.approvedAssets(asset.address)).to.equal(false);
    });

    it("rejects asset approval changes from non-owners", async function () {
      const { participantA, asset, registry } = await deployFixture();

      await expect(
        registry
          .connect(participantA)
          .setAssetApproval(asset.address, true),
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });

    it("rejects the zero address as an asset", async function () {
      const { ethers, registry } = await deployFixture();

      await expect(
        registry.setAssetApproval(ethers.ZeroAddress, true),
      ).to.be.revertedWithCustomError(registry, "ZeroAddress");
    });
  });

  describe("Settlement compliance", function () {
    it("returns true only when both participants and the asset are approved", async function () {
      const {
        participantA,
        participantB,
        asset,
        registry,
      } = await deployFixture();

      await registry.setParticipantApproval(participantA.address, true);
      await registry.setParticipantApproval(participantB.address, true);
      await registry.setAssetApproval(asset.address, true);

      expect(
        await registry.isSettlementAllowed(
          participantA.address,
          participantB.address,
          asset.address,
        ),
      ).to.equal(true);
    });

    it("returns false when any required approval is missing", async function () {
      const {
        participantA,
        participantB,
        asset,
        registry,
      } = await deployFixture();

      await registry.setParticipantApproval(participantA.address, true);
      await registry.setParticipantApproval(participantB.address, true);

      expect(
        await registry.isSettlementAllowed(
          participantA.address,
          participantB.address,
          asset.address,
        ),
      ).to.equal(false);

      await registry.setAssetApproval(asset.address, true);
      await registry.setParticipantApproval(participantB.address, false);

      expect(
        await registry.isSettlementAllowed(
          participantA.address,
          participantB.address,
          asset.address,
        ),
      ).to.equal(false);
    });
  });

  describe("Ownership", function () {
    it("transfers ownership and enforces the new owner", async function () {
      const {
        owner,
        participantA,
        newOwner,
        registry,
      } = await deployFixture();

      await expect(
        registry.transferOwnership(newOwner.address),
      )
        .to.emit(registry, "OwnershipTransferred")
        .withArgs(owner.address, newOwner.address);

      expect(await registry.owner()).to.equal(newOwner.address);

      await expect(
        registry.setParticipantApproval(participantA.address, true),
      ).to.be.revertedWithCustomError(registry, "Unauthorized");

      await registry
        .connect(newOwner)
        .setParticipantApproval(participantA.address, true);

      expect(
        await registry.approvedParticipants(participantA.address),
      ).to.equal(true);
    });

    it("rejects transfer of ownership to the zero address", async function () {
      const { ethers, registry } = await deployFixture();

      await expect(
        registry.transferOwnership(ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(registry, "ZeroAddress");
    });

    it("rejects ownership transfer from non-owners", async function () {
      const { participantA, newOwner, registry } =
        await deployFixture();

      await expect(
        registry
          .connect(participantA)
          .transferOwnership(newOwner.address),
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });
  });
});