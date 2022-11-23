import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { BigNumber } from "ethers";

describe("ProdeToken", function () {
  async function deployContracts() {
    const [prodeTokenOwner, address1, address2, address3] = await ethers.getSigners();

    const ProdeToken = await ethers.getContractFactory("ProdeToken", prodeTokenOwner);
    const prodeToken = await ProdeToken.deploy();

    return { prodeToken, prodeTokenOwner, address1, address2, address3 };
  }

  describe("Deployment", function () {
    it("Should set the right owner, name and symbol", async function () {
      const { prodeToken, prodeTokenOwner } = await loadFixture(deployContracts);

      expect(await prodeToken.owner()).to.equal(prodeTokenOwner.address);
      expect(await prodeToken.name()).to.equal("ProdeToken");
      expect(await prodeToken.symbol()).to.equal("PTO");
    });
  });

  describe("Storage", function () {
    it("Should store bets and ownership correctly", async function () {
        const { prodeToken, prodeTokenOwner, address1 } = await loadFixture(deployContracts);

        const bet1 = 55;

        const id1 = await prodeToken.callStatic.mintBet(address1.address, bet1); // Call off chain to assert the id
        expect(id1).to.equal(1);

        await prodeToken.mintBet(address1.address, bet1); // Call on chain

        expect(await prodeToken.getBet(id1)).to.equal(bet1);
        expect(await prodeToken.ownerOf(id1)).to.equal(address1.address);
    });
  });

  describe("Transfer", function () {
    it("Should revert if there is a try to transfer an nft from an address that is not the owner", async function () {
      const { prodeToken, prodeTokenOwner, address1, address2, address3 } = await loadFixture(deployContracts);

      const bet1:Number = 55;
      const id:Number = 1;

      await prodeToken.mintBet(address1.address, bet1); // Call on chain

      expect(await prodeToken.ownerOf(id)).to.equal(address1.address);

      await expect(prodeToken.connect(address2)["safeTransferFrom(address,address,uint256)"](address2.address, address3.address, id)).to.be
              .revertedWith("ERC721: caller is not token owner nor approved");
    });

    it("Should transfer an nft from an address that is the current owner", async function () {
      const { prodeToken, prodeTokenOwner, address1, address2, address3 } = await loadFixture(deployContracts);

      const bet1:Number = 55;
      const id:Number = 1;

      await prodeToken.mintBet(address1.address, bet1); // Call on chain

      expect(await prodeToken.ownerOf(id)).to.equal(address1.address);

      await prodeToken.connect(address1)["safeTransferFrom(address,address,uint256)"](address1.address, address3.address, id);

      expect(await prodeToken.ownerOf(id)).to.equal(address3.address);
    });
  });
});