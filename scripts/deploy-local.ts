import { ethers } from "hardhat";

async function main() {
  const [prodeLogicOwner, prodeTokenOwner, multiSigOwner, multiSigOwner1,
        address1, address2, address3] = await ethers.getSigners();

  const MultiSig = await ethers.getContractFactory("MultiSig");
  const multiSig = await MultiSig.deploy([address1.address, address2.address], 2);

  await multiSig.deployed();

  console.log("MultiSig deployed to:", multiSig.address);

  const ProdeToken = await ethers.getContractFactory("ProdeToken");
  const prodeToken = await ProdeToken.deploy();

  await prodeToken.deployed();

  console.log("ProdeToken deployed to:", prodeToken.address);

  const ProdeLogic = await ethers.getContractFactory("ProdeLogic");
  const prodeLogic = await ProdeLogic.deploy(prodeToken.address, 1668902400);

  await prodeLogic.deployed();

  console.log("ProdeLogic deployed to:", prodeLogic.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
