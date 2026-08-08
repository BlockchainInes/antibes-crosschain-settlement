import { expect } from "chai";
import { network } from "hardhat";

describe("SettlementSource", function () {
  this.slow(2000);

  async function deployFixture() {
    const { ethers } = await network.connect();
    const [initiator, beneficiary, asset] = await ethers.getSigners();

    const settlementSource = await ethers.deployContract("SettlementSource");
    await settlementSource.waitForDeployment();

    return {
      ethers,
      initiator,
      beneficiary,
      asset,
      settlementSource,
    };
  }

  it("creates a deterministic settlement identifier and persists the settlement", async function () {
    const {
      ethers,
      initiator,
      beneficiary,
      asset,
      settlementSource,
    } = await deployFixture();

    const sourceNetwork = await ethers.provider.getNetwork();
    const destinationChainId = 11155420n;
    const amount = 1_000_000n;
    const nonce = 0n;

    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      [
        "uint256",
        "address",
        "address",
        "address",
        "address",
        "uint256",
        "uint256",
        "uint256",
      ],
      [
        sourceNetwork.chainId,
        await settlementSource.getAddress(),
        initiator.address,
        beneficiary.address,
        asset.address,
        amount,
        destinationChainId,
        nonce,
      ],
    );

    const expectedSettlementId = ethers.keccak256(encoded);

    await expect(
      settlementSource
        .connect(initiator)
        .initiateSettlement(
          beneficiary.address,
          asset.address,
          amount,
          destinationChainId,
        ),
    ).to.emit(settlementSource, "SettlementInitiated");

    const stored = await settlementSource.settlements(expectedSettlementId);

    expect(stored.initiator).to.equal(initiator.address);
    expect(stored.beneficiary).to.equal(beneficiary.address);
    expect(stored.asset).to.equal(asset.address);
    expect(stored.amount).to.equal(amount);
    expect(stored.destinationChainId).to.equal(destinationChainId);
    expect(stored.nonce).to.equal(nonce);
    expect(stored.status).to.equal(1n);
    expect(await settlementSource.nextNonce()).to.equal(1n);
  });

  it("produces different settlement identifiers for repeated economically identical requests", async function () {
    const {
      ethers,
      initiator,
      beneficiary,
      asset,
      settlementSource,
    } = await deployFixture();

    const destinationChainId = 11155420n;
    const amount = 1_000_000n;
    const sourceNetwork = await ethers.provider.getNetwork();
    const contractAddress = await settlementSource.getAddress();
    const coder = ethers.AbiCoder.defaultAbiCoder();

    const firstId = ethers.keccak256(
      coder.encode(
        [
          "uint256",
          "address",
          "address",
          "address",
          "address",
          "uint256",
          "uint256",
          "uint256",
        ],
        [
          sourceNetwork.chainId,
          contractAddress,
          initiator.address,
          beneficiary.address,
          asset.address,
          amount,
          destinationChainId,
          0n,
        ],
      ),
    );

    const secondId = ethers.keccak256(
      coder.encode(
        [
          "uint256",
          "address",
          "address",
          "address",
          "address",
          "uint256",
          "uint256",
          "uint256",
        ],
        [
          sourceNetwork.chainId,
          contractAddress,
          initiator.address,
          beneficiary.address,
          asset.address,
          amount,
          destinationChainId,
          1n,
        ],
      ),
    );

    await settlementSource
      .connect(initiator)
      .initiateSettlement(
        beneficiary.address,
        asset.address,
        amount,
        destinationChainId,
      );

    await settlementSource
      .connect(initiator)
      .initiateSettlement(
        beneficiary.address,
        asset.address,
        amount,
        destinationChainId,
      );

    expect(firstId).to.not.equal(secondId);
    expect((await settlementSource.settlements(firstId)).status).to.equal(1n);
    expect((await settlementSource.settlements(secondId)).status).to.equal(1n);
    expect(await settlementSource.nextNonce()).to.equal(2n);
  });

  it("rejects zero beneficiary and asset addresses", async function () {
    const {
      ethers,
      beneficiary,
      asset,
      settlementSource,
    } = await deployFixture();

    await expect(
      settlementSource.initiateSettlement(
        ethers.ZeroAddress,
        asset.address,
        1n,
        11155420n,
      ),
    ).to.be.revertedWithCustomError(
      settlementSource,
      "ZeroAddress",
    );

    await expect(
      settlementSource.initiateSettlement(
        beneficiary.address,
        ethers.ZeroAddress,
        1n,
        11155420n,
      ),
    ).to.be.revertedWithCustomError(
      settlementSource,
      "ZeroAddress",
    );
  });

  it("rejects zero-value settlements", async function () {
    const {
      beneficiary,
      asset,
      settlementSource,
    } = await deployFixture();

    await expect(
      settlementSource.initiateSettlement(
        beneficiary.address,
        asset.address,
        0n,
        11155420n,
      ),
    ).to.be.revertedWithCustomError(
      settlementSource,
      "ZeroAmount",
    );
  });

  it("rejects settlement to the source chain", async function () {
    const {
      ethers,
      beneficiary,
      asset,
      settlementSource,
    } = await deployFixture();

    const sourceNetwork = await ethers.provider.getNetwork();

    await expect(
      settlementSource.initiateSettlement(
        beneficiary.address,
        asset.address,
        1n,
        sourceNetwork.chainId,
      ),
    ).to.be.revertedWithCustomError(
      settlementSource,
      "InvalidDestinationChain",
    );
  });
});