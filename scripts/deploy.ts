import { network } from "hardhat";

const { ethers } = await network.connect({
  network: "sepolia",
});

const [deployer] = await ethers.getSigners();

console.log("Deployer:", deployer.address);

const settlementSource = await ethers.deployContract(
  "SettlementSource",
);

await settlementSource.waitForDeployment();

const settlementSourceAddress =
  await settlementSource.getAddress();

console.log(
  "SettlementSource:",
  settlementSourceAddress,
);

const complianceRegistry =
  await ethers.deployContract(
    "ComplianceRegistry",
  );

await complianceRegistry.waitForDeployment();

const complianceRegistryAddress =
  await complianceRegistry.getAddress();

console.log(
  "ComplianceRegistry:",
  complianceRegistryAddress,
);

const settlementDestination =
  await ethers.deployContract(
    "SettlementDestination",
    [
      complianceRegistryAddress,
      deployer.address,
    ],
  );

await settlementDestination.waitForDeployment();

const settlementDestinationAddress =
  await settlementDestination.getAddress();

console.log(
  "SettlementDestination:",
  settlementDestinationAddress,
);

console.log("");
console.log("Deployment complete");
console.log("-------------------");
console.log(
  "Deployer:",
  deployer.address,
);
console.log(
  "SettlementSource:",
  settlementSourceAddress,
);
console.log(
  "ComplianceRegistry:",
  complianceRegistryAddress,
);
console.log(
  "SettlementDestination:",
  settlementDestinationAddress,
);