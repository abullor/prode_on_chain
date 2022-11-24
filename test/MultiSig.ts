import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { BigNumber } from "ethers";

describe("MultiSig", function () {
  async function deployContracts() {
    const [multiSigOwner, exampleOwner, address1, address2, address3] = await ethers.getSigners();

    const MultiSig = await ethers.getContractFactory("MultiSig", multiSigOwner);
    const multiSig = await MultiSig.deploy([address1.address, address2.address], 2);

    return { multiSig, multiSigOwner, address1, address2, address3 };
  }


  describe("Txn management", function () {
    it("Should revert if a txn is not submitted by an owner", async function () {
      const { multiSig, multiSigOwner, address1, address2, address3 } = await loadFixture(deployContracts);

      await expect(multiSig.connect(address3).submit(address1.address, [])).to.be.revertedWith("Not owner");
    });

    it("Should revert if a txn is tried to be approved by not an owner", async function () {
      const { multiSig, multiSigOwner, address1, address2, address3 } = await loadFixture(deployContracts);

      await multiSig.connect(address1).submit(address1.address, []);
      await expect(multiSig.connect(address3).approve(0)).to.be.revertedWith("Not owner");
    });

    it("Should revert if a non existent txn is tried to be approved", async function () {
      const { multiSig, multiSigOwner, address1, address2 } = await loadFixture(deployContracts);

      await multiSig.connect(address1).submit(address1.address, []);
      await expect(multiSig.connect(address1).approve(1)).to.be.revertedWith("Txn does not exist");
    });

    it("Should revert if a txn is tried to be approved more than once", async function () {
      const { multiSig, multiSigOwner, address1, address2 } = await loadFixture(deployContracts);

      await multiSig.connect(address1).submit(address1.address, []);
      await multiSig.connect(address1).approve(0);
      await expect(multiSig.connect(address1).approve(0)).to.be.revertedWith("Txn already approved");
    });

    it("Should revert if a txn already executed is tried to be approved", async function () {
      const { multiSig, multiSigOwner, address1, address2 } = await loadFixture(deployContracts);

      await multiSig.connect(address1).submit(address1.address, []);
      await multiSig.connect(address1).approve(0);
      await multiSig.connect(address2).approve(0);
      await multiSig.connect(address1).execute(0);
      await expect(multiSig.connect(address1).approve(0)).to.be.revertedWith("Txn already executed");
    });

    it("Should revert if a txn is tried to be execute without the proper approvals", async function () {
      const { multiSig, multiSigOwner, address1, address2 } = await loadFixture(deployContracts);

      await multiSig.connect(address1).submit(address1.address, []);
      await multiSig.connect(address1).approve(0);
      await expect(multiSig.connect(address1).execute(0)).to.be.revertedWith("Not enough approvals");
    });

    it("Should revert if an invalid txn is tried to be executed", async function () {
      const { multiSig, multiSigOwner, address1, address2 } = await loadFixture(deployContracts);

      await multiSig.connect(address1).submit(multiSig.address, []);
      await multiSig.connect(address1).approve(0);
      await multiSig.connect(address2).approve(0);
        await expect(multiSig.connect(address1).execute(0)).to.be.revertedWithoutReason;
    });
  });
});