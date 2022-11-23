import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { BigNumber } from "ethers";

const DUE_DATE:Number = 1668902400;
const ONE_DAY:Number = 86400;
const CORRECT_PRICE:String = "1";

describe("ProdeLogic", function () {
  async function deployContracts() {
    const [prodeLogicOwner, prodeTokenOwner, multiSigOwner, multiSigOwner1, address1, address2, address3] = await ethers.getSigners();

    const multiSigRequiredSigners:Number = 1;

    const ProdeToken = await ethers.getContractFactory("ProdeToken", prodeTokenOwner);
    const prodeToken = await ProdeToken.deploy();

    const ProdeLogic = await ethers.getContractFactory("ProdeLogic", prodeLogicOwner);
    const prodeLogic = await ProdeLogic.deploy(prodeToken.address, DUE_DATE + (ONE_DAY * 4)); //20-11-2022 00:00:00 GMT-0 + 3 days

    const MultiSig = await ethers.getContractFactory("MultiSig", multiSigOwner);
    const multiSig = await MultiSig.deploy([multiSigOwner1.address], multiSigRequiredSigners);

    await prodeToken.transferOwnership(prodeLogic.address);
    await prodeLogic.transferOwnership(multiSig.address);

    return { prodeLogic, prodeLogicOwner, prodeToken, prodeTokenOwner, multiSig, multiSigOwner1, address1, address2, address3 };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { prodeLogic, prodeLogicOwner, prodeToken, prodeTokenOwner, multiSig, multiSigOwner1 } = await loadFixture(deployContracts);

      expect(await prodeLogic.owner()).to.equal(multiSig.address);
      expect(await prodeToken.owner()).to.equal(prodeLogic.address);
      expect(await multiSig.owners(0)).to.equal(multiSigOwner1.address);
    });
  });

  describe("Bet checking", function () {
      it("Should validate the right ticket price.", async function () {
        const { prodeLogic, prodeLogicOwner, prodeToken, prodeTokenOwner } = await loadFixture(deployContracts);

        const bet:Number = 55;
        const price:String = "0";

        await expect(prodeLogic.bet(bet, { value: ethers.utils.parseEther(price) })).to.be.revertedWith("Invalid price");
      });

      it("Should validate the bet is a valid one.", async function () {
        const { prodeLogic, prodeLogicOwner, prodeToken, prodeTokenOwner } = await loadFixture(deployContracts);

        const bet:Number = 0;

        await expect(prodeLogic.bet(bet, { value: ethers.utils.parseEther(CORRECT_PRICE) })).to.be.revertedWith("There are matches without score");
      });

      it("Should validate the bet is before the limit date.", async function () {
        const { prodeLogic, prodeLogicOwner, prodeToken, prodeTokenOwner } = await loadFixture(deployContracts);

        const bet:Number = 0;

        mine(DUE_DATE + (ONE_DAY * 3) + 100); // Simulate a bet after the world cup started

        await expect(prodeLogic.bet(bet, { value: ethers.utils.parseEther(CORRECT_PRICE) })).to.be.revertedWith("Date limit is already due");
      });
  });

  describe("Balance checking", function () {
    it("Should validate the balance is updated after a valid bet", async function () {
      const { prodeLogic, prodeLogicOwner, prodeToken, prodeTokenOwner, address1, address2, address3 } = await loadFixture(deployContracts);

      const bet:BigNumber = BigNumber.from("26409387504754779197847983445");
      const balance:Number = (Number(CORRECT_PRICE) * 3).toFixed(1);

      await prodeLogic.bet(bet, { value: ethers.utils.parseEther(CORRECT_PRICE) });
      await prodeLogic.bet(bet, { value: ethers.utils.parseEther(CORRECT_PRICE) });
      await prodeLogic.bet(bet, { value: ethers.utils.parseEther(CORRECT_PRICE) });

      expect(ethers.utils.formatEther(await prodeLogic.getBalance())).to.equal(balance);
    });
  });

  describe("Prize checking", function () {
    it("Should validate the prize is updated after a valid bet", async function () {
      const { prodeLogic, prodeLogicOwner, prodeToken, prodeTokenOwner } = await loadFixture(deployContracts);

      const bet:BigNumber = BigNumber.from("26409387504754779197847983445");
      const prize:Number = (Number(CORRECT_PRICE) * 3 * 0.8).toFixed(1);

      await prodeLogic.bet(bet, { value: ethers.utils.parseEther(CORRECT_PRICE) });
      await prodeLogic.bet(bet, { value: ethers.utils.parseEther(CORRECT_PRICE) });
      await prodeLogic.bet(bet, { value: ethers.utils.parseEther(CORRECT_PRICE) });

      expect(ethers.utils.formatEther(await prodeLogic.getPrize())).to.equal(prize);
    });
  });

  describe("BetStoredEvent checking", function () {
    it("Should emit BetStoredEvent after a valid bet", async function () {
      const { prodeLogic, prodeLogicOwner, prodeToken, prodeTokenOwner, address1 } = await loadFixture(deployContracts);

      const bet:BigNumber = BigNumber.from("26409387504754779197847983445");

      const nftId = await prodeLogic.connect(address1).callStatic.bet(bet, { value: ethers.utils.parseEther(CORRECT_PRICE) });

      await expect(prodeLogic.connect(address1).bet(bet, { value: ethers.utils.parseEther(CORRECT_PRICE) }))
            .to.emit(prodeLogic, "BetStoredEvent")
            .withArgs(address1.address, nftId, bet);
    });
  });

  describe("MultiSig behavior checking", function () {
    it("Should validate that scores can only be injected by multiSig", async function () {
      const { prodeLogic, prodeLogicOwner, prodeToken, prodeTokenOwner, address1 } = await loadFixture(deployContracts);

      const matchId:Number = 0;
      const score:Number = 0;

      await expect(prodeLogic.setMatchScore(matchId, score)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should validate the match id is valid", async function () {
      const { prodeLogic, prodeLogicOwner, prodeToken, prodeTokenOwner, multiSig, multiSigOwner1, address1 } = await loadFixture(deployContracts);

      const matchId:Number = 50;
      const score:Number = 1;

      const ABI = ["function setMatchScore(uint8 _matchId, uint8 _score)"];
      const _interface = new ethers.utils.Interface(ABI);
      const txn = _interface.encodeFunctionData("setMatchScore", [ matchId, score ]);

      const txnId = await multiSig.connect(multiSigOwner1).callStatic.submit(prodeLogic.address, txn);

      await multiSig.connect(multiSigOwner1).submit(prodeLogic.address, txn);
      await multiSig.connect(multiSigOwner1).approve(txnId);

      await expect(multiSig.connect(multiSigOwner1).execute(txnId)).to.be.revertedWith("Invalid match id.");
    });

    it("Should validate the match is not already completed", async function () {
      const { prodeLogic, prodeLogicOwner, prodeToken, prodeTokenOwner, multiSig, multiSigOwner1, address1 } = await loadFixture(deployContracts);

      const matchId:Number = 47; // Last one
      const score:Number = 1;

      const ABI = ["function setMatchScore(uint8 _matchId, uint8 _score)"];
      const _interface = new ethers.utils.Interface(ABI);
      const txn = _interface.encodeFunctionData("setMatchScore", [ matchId, score ]);

      const txnId = await multiSig.connect(multiSigOwner1).callStatic.submit(prodeLogic.address, txn);

      await multiSig.connect(multiSigOwner1).submit(prodeLogic.address, txn);
      await multiSig.connect(multiSigOwner1).approve(txnId);

      await expect(multiSig.connect(multiSigOwner1).execute(txnId)).to.be.revertedWith("Match may not be finished yet.");
    });

    it("Should validate the score is valid", async function () {
      const { prodeLogic, prodeLogicOwner, prodeToken, prodeTokenOwner, multiSig, multiSigOwner1, address1 } = await loadFixture(deployContracts);

      const matchId:Number = 0;
      const score:Number = 5;

      const ABI = ["function setMatchScore(uint8 _matchId, uint8 _score)"];
      const _interface = new ethers.utils.Interface(ABI);
      const txn = _interface.encodeFunctionData("setMatchScore", [ matchId, score ]);

      const txnId = await multiSig.connect(multiSigOwner1).callStatic.submit(prodeLogic.address, txn);

      await multiSig.connect(multiSigOwner1).submit(prodeLogic.address, txn);
      await multiSig.connect(multiSigOwner1).approve(txnId);

      await expect(multiSig.connect(multiSigOwner1).execute(txnId)).to.be.revertedWith("Invalid score.");
    });

    it("Should validate a score cannot be entered more than once", async function () {
      const { prodeLogic, prodeLogicOwner, prodeToken, prodeTokenOwner, multiSig, multiSigOwner1, address1 } = await loadFixture(deployContracts);

      const matchId:Number = 0;
      const score:Number = 1;

      const ABI = ["function setMatchScore(uint8 _matchId, uint8 _score)"];
      const _interface = new ethers.utils.Interface(ABI);
      const txn1 = _interface.encodeFunctionData("setMatchScore", [ matchId, score ]);

      const txnId1 = await multiSig.connect(multiSigOwner1).callStatic.submit(prodeLogic.address, txn1);
      await multiSig.connect(multiSigOwner1).submit(prodeLogic.address, txn1);
      await multiSig.connect(multiSigOwner1).approve(txnId1);
      await multiSig.connect(multiSigOwner1).execute(txnId1);

      const txn2 = _interface.encodeFunctionData("setMatchScore", [ matchId, score ]);
      const txnId2 = await multiSig.connect(multiSigOwner1).callStatic.submit(prodeLogic.address, txn2);
      await multiSig.connect(multiSigOwner1).submit(prodeLogic.address, txn2);
      await multiSig.connect(multiSigOwner1).approve(txnId2);

      await expect(multiSig.connect(multiSigOwner1).execute(txnId2)).to.be.revertedWith("Score already entered.");
    });

    it("Should update matches processed and emit MatchScoreStoredEvent after a valid MultiSig call", async function () {
      const { prodeLogic, prodeLogicOwner, prodeToken, prodeTokenOwner, multiSig, multiSigOwner1, address1 } = await loadFixture(deployContracts);

      const matchId:Number = 0;
      const score:Number = 1;
      const matchesProcessed:Number = 1;

      mine(DUE_DATE + (ONE_DAY * 3)); // Simulate the game is already finished

      const ABI = ["function setMatchScore(uint8 _matchId, uint8 _score)"];
      const _interface = new ethers.utils.Interface(ABI);
      const txn1 = _interface.encodeFunctionData("setMatchScore", [ matchId, score ]);

      const txnId = await multiSig.connect(multiSigOwner1).callStatic.submit(prodeLogic.address, txn1);
      await multiSig.connect(multiSigOwner1).submit(prodeLogic.address, txn1);
      await multiSig.connect(multiSigOwner1).approve(txnId);

      await expect(multiSig.connect(multiSigOwner1).execute(txnId))
            .to.emit(prodeLogic, "MatchScoreStoredEvent")
            .withArgs(multiSig.address, matchId, score);
      expect(await prodeLogic.getMatchesProcessed()).to.be.equal(matchesProcessed);
    });
  });

  describe("Points calculations checking", function () {
    it("Should revert if the caller is not the owner", async function () {
      const { prodeLogic, prodeLogicOwner, prodeToken, prodeTokenOwner, address1 } = await loadFixture(deployContracts);

      await expect(prodeLogic.connect(address1).calculatePoints()).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert if not all the matches are completed", async function () {
      const { prodeLogic, prodeLogicOwner, prodeToken, prodeTokenOwner, multiSig, multiSigOwner1, address1 } = await loadFixture(deployContracts);

      const ABI = ["function calculatePoints()"];
      const _interface = new ethers.utils.Interface(ABI);
      const txn1 = _interface.encodeFunctionData("calculatePoints", []);

      const txnId = await multiSig.connect(multiSigOwner1).callStatic.submit(prodeLogic.address, txn1);
      await multiSig.connect(multiSigOwner1).submit(prodeLogic.address, txn1);
      await multiSig.connect(multiSigOwner1).approve(txnId);

      await expect(multiSig.connect(multiSigOwner1).execute(txnId)).to.be
        .revertedWith("There are still pending scores");
    });

    it("Should revert if winners were requested and the process was not completed", async function () {
      const { prodeLogic, prodeLogicOwner, prodeToken, prodeTokenOwner, address1 } = await loadFixture(deployContracts);

      await expect(prodeLogic.connect(prodeLogicOwner).getWinnerTokens()).to.be
        .revertedWith("Process is not completed");
    });

    it("Should revert if prize for winners was requested and the process was not completed", async function () {
      const { prodeLogic, prodeLogicOwner, prodeToken, prodeTokenOwner, address1 } = await loadFixture(deployContracts);

      await expect(prodeLogic.connect(prodeLogicOwner).getPrizeForWinners()).to.be
        .revertedWith("Process is not completed");
    });

    it("Should calculate points and assigned winners correctly with suspended matches", async function () {
      const { prodeLogic, prodeLogicOwner, prodeToken, prodeTokenOwner, multiSig, multiSigOwner1, address1 } = await loadFixture(deployContracts);

      const bet1:BigNumber = BigNumber.from("52818775009509558395695966890"); // ALL LOCALS
      const numberOfWinners:Number = 1;
      const winnerToken:Number = 1;
      const winnerTokenPoints:Number = 2;

      await prodeLogic.connect(address1).bet(bet1, { value: ethers.utils.parseEther(CORRECT_PRICE) });

      const scores:Array<Number> = [1, 4, 4, 2, 2, 2, 2, 4, 2, 2, 2, 4, 2, 2, 2, 4, 2, 2, 2, 4, 2, 2, 2, 4, 2, 2, 2, 4, 2, 2, 2, 4, 2, 2, 2, 4, 2, 2, 2, 4, 2, 2, 2, 4, 2, 2, 1, 4]; // HOME - ... - HOME - SUSPENDED

      mine(DUE_DATE + (ONE_DAY * 10)); // Simulate the game is already finished

      const ABI = ["function setMatchScore(uint8 _matchId, uint8 _score)"];
      const _interface = new ethers.utils.Interface(ABI);

      for (let i = 0; i < scores.length; i++) {
        const txn = _interface.encodeFunctionData("setMatchScore", [ i, scores[i]]);
        const txnId = await multiSig.connect(multiSigOwner1).callStatic.submit(prodeLogic.address, txn);
        await multiSig.connect(multiSigOwner1).submit(prodeLogic.address, txn);
        await multiSig.connect(multiSigOwner1).approve(txnId);
        await multiSig.connect(multiSigOwner1).execute(txnId);
      }

      const ABI2 = ["function calculatePoints()"];
      const _interface2 = new ethers.utils.Interface(ABI2);
      const txn = _interface2.encodeFunctionData("calculatePoints", []);
      const txnId = await multiSig.connect(multiSigOwner1).callStatic.submit(prodeLogic.address, txn);
      await multiSig.connect(multiSigOwner1).submit(prodeLogic.address, txn);
      await multiSig.connect(multiSigOwner1).approve(txnId);
      await expect(multiSig.connect(multiSigOwner1).execute(txnId)).to.emit(prodeLogic, "PointsCalculatedEvent")
        .withArgs(multiSig.address, 1);

      expect(await prodeLogic.getPointsForToken(winnerToken)).to.be.equal(winnerTokenPoints);

      expect(await prodeLogic.getWinnerTokens()).to.deep.equal([numberOfWinners]);
    });

    it("Should calculate points and assigned winners correctly with only one winner", async function () {
      const { prodeLogic, prodeLogicOwner, prodeToken, prodeTokenOwner, multiSig, multiSigOwner1, address1, address2 } = await loadFixture(deployContracts);

      const bet1:Number = BigNumber.from("52818775009509558395695966890"); // ALL LOCALS
      const bet2:Number = BigNumber.from("79228162514264337593543950335"); // ALL VISITORS
      const numberOfWinners:Number = 1;
      const token1Points:Number = 1;
      const token2Points:Number = 3;
      const winnerToken:Number = 2;

      const scores:Array<Number> = [1, 2, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3]; // HOME - TIE - VISITOR - ... - VISITOR - VISITOR

      await prodeLogic.connect(address1).bet(bet1, { value: ethers.utils.parseEther(CORRECT_PRICE) });
      await prodeLogic.connect(address2).bet(bet2, { value: ethers.utils.parseEther(CORRECT_PRICE) });

      mine(DUE_DATE + (ONE_DAY * 10)); // Simulate the game is already finished

      const ABI = ["function setMatchScore(uint8 _matchId, uint8 _score)"];
      const _interface = new ethers.utils.Interface(ABI);

      for (let i = 0; i < scores.length; i++) {
        const txn = _interface.encodeFunctionData("setMatchScore", [ i, scores[i]]);
        const txnId = await multiSig.connect(multiSigOwner1).callStatic.submit(prodeLogic.address, txn);
        await multiSig.connect(multiSigOwner1).submit(prodeLogic.address, txn);
        await multiSig.connect(multiSigOwner1).approve(txnId);
        await multiSig.connect(multiSigOwner1).execute(txnId);
      }

      const ABI2 = ["function calculatePoints()"];
      const _interface2 = new ethers.utils.Interface(ABI2);
      const txn = _interface2.encodeFunctionData("calculatePoints", []);
      const txnId = await multiSig.connect(multiSigOwner1).callStatic.submit(prodeLogic.address, txn);
      await multiSig.connect(multiSigOwner1).submit(prodeLogic.address, txn);
      await multiSig.connect(multiSigOwner1).approve(txnId);
      await expect(multiSig.connect(multiSigOwner1).execute(txnId)).to.emit(prodeLogic, "PointsCalculatedEvent")
        .withArgs(multiSig.address, numberOfWinners);

      expect(await prodeLogic.getPointsForToken(1)).to.be.equal(token1Points);
      expect(await prodeLogic.getPointsForToken(2)).to.be.equal(token2Points);

      expect(await prodeLogic.getWinnerTokens()).to.deep.equal([winnerToken]);
    });

    it("Should calculate points and don't assign winners", async function () {
      const { prodeLogic, prodeLogicOwner, prodeToken, prodeTokenOwner, multiSig, multiSigOwner1, address1, address2 } = await loadFixture(deployContracts);

      const bet1:Number = BigNumber.from("79228162514264337593543950335"); // ALL VISITORS
      const bet2:Number = BigNumber.from("79228162514264337593543950335"); // ALL VISITORS
      const token1Points:Number = 0;
      const token2Points:Number = 0;
      const numberOfWinners:Number = 0;

      await prodeLogic.connect(address1).bet(bet1, { value: ethers.utils.parseEther(CORRECT_PRICE) });
      await prodeLogic.connect(address2).bet(bet2, { value: ethers.utils.parseEther(CORRECT_PRICE) });

      const scores:Array<Number> = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]; // ALL HOMES

      mine(DUE_DATE + (ONE_DAY * 10)); // Simulate the game is already finished

      const ABI = ["function setMatchScore(uint8 _matchId, uint8 _score)"];
      const _interface = new ethers.utils.Interface(ABI);

      for (let i = 0; i < scores.length; i++) {
        const txn = _interface.encodeFunctionData("setMatchScore", [ i, scores[i]]);
        const txnId = await multiSig.connect(multiSigOwner1).callStatic.submit(prodeLogic.address, txn);
        await multiSig.connect(multiSigOwner1).submit(prodeLogic.address, txn);
        await multiSig.connect(multiSigOwner1).approve(txnId);
        await multiSig.connect(multiSigOwner1).execute(txnId);
      }

      const ABI2 = ["function calculatePoints()"];
      const _interface2 = new ethers.utils.Interface(ABI2);
      const txn = _interface2.encodeFunctionData("calculatePoints", []);
      const txnId = await multiSig.connect(multiSigOwner1).callStatic.submit(prodeLogic.address, txn);
      await multiSig.connect(multiSigOwner1).submit(prodeLogic.address, txn);
      await multiSig.connect(multiSigOwner1).approve(txnId);
      await expect(multiSig.connect(multiSigOwner1).execute(txnId)).to.emit(prodeLogic, "PointsCalculatedEvent")
        .withArgs(multiSig.address, numberOfWinners);

      expect(await prodeLogic.getPointsForToken(1)).to.be.equal(token1Points);
      expect(await prodeLogic.getPointsForToken(2)).to.be.equal(token2Points);

      expect(await prodeLogic.getWinnerTokens()).to.deep.equal([]);
    });

    it("Should calculate points and assigned winners correctly with more than one winner", async function () {
      const { prodeLogic, prodeLogicOwner, prodeToken, prodeTokenOwner, multiSig, multiSigOwner1,
        address1, address2, address3 } = await loadFixture(deployContracts);

      const bet1:Number = BigNumber.from("59421121885698253195157962750"); // HOME - ALL VISITORS - HOME
      const bet2:Number = BigNumber.from("26409387504754779197847983445"); // ALL TIES
      const bet3:Number = BigNumber.from("74276402357122816493947453435"); // VISITOR - HOME - ALL VISITORS - HOME - VISITOR
      const numberOfWinners:Number = 2;
      const token1Points:Number = 2;
      const token2Points:Number = 0;
      const token3Points:Number = 2;
      const winnerTokens:Array<Number> = [1, 3];

      await prodeLogic.connect(address1).bet(bet1, { value: ethers.utils.parseEther(CORRECT_PRICE) });
      await prodeLogic.connect(address2).bet(bet2, { value: ethers.utils.parseEther(CORRECT_PRICE) });
      await prodeLogic.connect(address3).bet(bet3, { value: ethers.utils.parseEther(CORRECT_PRICE) });

      const scores:Array<Number> = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]; // ALL HOMES

      mine(DUE_DATE + (ONE_DAY * 10)); // Simulate the game is already finished

      const ABI = ["function setMatchScore(uint8 _matchId, uint8 _score)"];
      const _interface = new ethers.utils.Interface(ABI);

      for (let i = 0; i < scores.length; i++) {
        const txn = _interface.encodeFunctionData("setMatchScore", [ i, scores[i]]);
        const txnId = await multiSig.connect(multiSigOwner1).callStatic.submit(prodeLogic.address, txn);
        await multiSig.connect(multiSigOwner1).submit(prodeLogic.address, txn);
        await multiSig.connect(multiSigOwner1).approve(txnId);
        await multiSig.connect(multiSigOwner1).execute(txnId);
      }

      const ABI2 = ["function calculatePoints()"];
      const _interface2 = new ethers.utils.Interface(ABI2);
      const txn = _interface2.encodeFunctionData("calculatePoints", []);
      const txnId = await multiSig.connect(multiSigOwner1).callStatic.submit(prodeLogic.address, txn);
      await multiSig.connect(multiSigOwner1).submit(prodeLogic.address, txn);
      await multiSig.connect(multiSigOwner1).approve(txnId);
      await expect(multiSig.connect(multiSigOwner1).execute(txnId)).to.emit(prodeLogic, "PointsCalculatedEvent")
        .withArgs(multiSig.address, numberOfWinners);

      expect(await prodeLogic.getPointsForToken(1)).to.be.equal(token1Points);
      expect(await prodeLogic.getPointsForToken(2)).to.be.equal(token2Points);
      expect(await prodeLogic.getPointsForToken(3)).to.be.equal(token3Points);

      expect(await prodeLogic.getWinnerTokens()).to.deep.equal(winnerTokens);
    });
  });

  describe("Prize claim checking", function () {
    it("Should revert if the claim is for a non winner token", async function () {
      const { prodeLogic, prodeLogicOwner, prodeToken, prodeTokenOwner, multiSig, multiSigOwner1,
        address1, address2, address3 } = await loadFixture(deployContracts);

      const bet1:Number = BigNumber.from("59421121885698253195157962750"); // HOME - ALL VISITORS - HOME
      const bet2:Number = BigNumber.from("26409387504754779197847983445"); // ALL TIES
      const bet3:Number = BigNumber.from("74276402357122816493947453435"); // VISITOR - HOME - ALL VISITORS - HOME - VISITOR
      const numberOfWinners:Number = 2;
      const token1Points:Number = 2;
      const token2Points:Number = 0;
      const token3Points:Number = 2;
      const winnerTokens:Array<Number> = [1, 3];

      await prodeLogic.connect(address1).bet(bet1, { value: ethers.utils.parseEther(CORRECT_PRICE) });
      await prodeLogic.connect(address2).bet(bet2, { value: ethers.utils.parseEther(CORRECT_PRICE) });
      await prodeLogic.connect(address3).bet(bet3, { value: ethers.utils.parseEther(CORRECT_PRICE) });

      const scores:Array<Number> = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]; // ALL HOMES

      mine(DUE_DATE + (ONE_DAY * 10)); // Simulate the game is already finished

      const ABI = ["function setMatchScore(uint8 _matchId, uint8 _score)"];
      const _interface = new ethers.utils.Interface(ABI);

      for (let i = 0; i < scores.length; i++) {
        const txn = _interface.encodeFunctionData("setMatchScore", [ i, scores[i]]);
        const txnId = await multiSig.connect(multiSigOwner1).callStatic.submit(prodeLogic.address, txn);
        await multiSig.connect(multiSigOwner1).submit(prodeLogic.address, txn);
        await multiSig.connect(multiSigOwner1).approve(txnId);
        await multiSig.connect(multiSigOwner1).execute(txnId);
      }

      const ABI2 = ["function calculatePoints()"];
      const _interface2 = new ethers.utils.Interface(ABI2);
      const txn = _interface2.encodeFunctionData("calculatePoints", []);
      const txnId = await multiSig.connect(multiSigOwner1).callStatic.submit(prodeLogic.address, txn);
      await multiSig.connect(multiSigOwner1).submit(prodeLogic.address, txn);
      await multiSig.connect(multiSigOwner1).approve(txnId);
      await expect(multiSig.connect(multiSigOwner1).execute(txnId)).to.emit(prodeLogic, "PointsCalculatedEvent")
        .withArgs(multiSig.address, numberOfWinners);

      expect(await prodeLogic.getPointsForToken(1)).to.be.equal(token1Points);
      expect(await prodeLogic.getPointsForToken(2)).to.be.equal(token2Points);
      expect(await prodeLogic.getPointsForToken(3)).to.be.equal(token3Points);

      expect(await prodeLogic.getWinnerTokens()).to.deep.equal(winnerTokens);

      await expect(prodeLogic.connect(address2).claimPrize(2)).to.be
        .revertedWith("Token is not a winner");
    });

    it("Should revert if the claim is not made by the token owner", async function () {
      const { prodeLogic, prodeLogicOwner, prodeToken, prodeTokenOwner, multiSig, multiSigOwner1,
        address1, address2, address3 } = await loadFixture(deployContracts);

      const bet1:Number = BigNumber.from("59421121885698253195157962750"); // HOME - ALL VISITORS - HOME
      const bet2:Number = BigNumber.from("26409387504754779197847983445"); // ALL TIES
      const bet3:Number = BigNumber.from("74276402357122816493947453435"); // VISITOR - HOME - ALL VISITORS - HOME - VISITOR
      const numberOfWinners:Number = 2;
      const token1Points:Number = 2;
      const token2Points:Number = 0;
      const token3Points:Number = 2;
      const winnerTokens:Array<Number> = [1, 3];

      await prodeLogic.connect(address1).bet(bet1, { value: ethers.utils.parseEther(CORRECT_PRICE) });
      await prodeLogic.connect(address2).bet(bet2, { value: ethers.utils.parseEther(CORRECT_PRICE) });
      await prodeLogic.connect(address3).bet(bet3, { value: ethers.utils.parseEther(CORRECT_PRICE) });

      const scores:Array<Number> = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]; // ALL HOMES

      mine(DUE_DATE + (ONE_DAY * 10)); // Simulate the game is already finished

      const ABI = ["function setMatchScore(uint8 _matchId, uint8 _score)"];
      const _interface = new ethers.utils.Interface(ABI);

      for (let i = 0; i < scores.length; i++) {
        const txn = _interface.encodeFunctionData("setMatchScore", [ i, scores[i]]);
        const txnId = await multiSig.connect(multiSigOwner1).callStatic.submit(prodeLogic.address, txn);
        await multiSig.connect(multiSigOwner1).submit(prodeLogic.address, txn);
        await multiSig.connect(multiSigOwner1).approve(txnId);
        await multiSig.connect(multiSigOwner1).execute(txnId);
      }

      const ABI2 = ["function calculatePoints()"];
      const _interface2 = new ethers.utils.Interface(ABI2);
      const txn = _interface2.encodeFunctionData("calculatePoints", []);
      const txnId = await multiSig.connect(multiSigOwner1).callStatic.submit(prodeLogic.address, txn);
      await multiSig.connect(multiSigOwner1).submit(prodeLogic.address, txn);
      await multiSig.connect(multiSigOwner1).approve(txnId);
      await expect(multiSig.connect(multiSigOwner1).execute(txnId)).to.emit(prodeLogic, "PointsCalculatedEvent")
        .withArgs(multiSig.address, numberOfWinners);

      expect(await prodeLogic.getPointsForToken(1)).to.be.equal(token1Points);
      expect(await prodeLogic.getPointsForToken(2)).to.be.equal(token2Points);
      expect(await prodeLogic.getPointsForToken(3)).to.be.equal(token3Points);

      expect(await prodeLogic.getWinnerTokens()).to.deep.equal(winnerTokens);

      await expect(prodeLogic.connect(address2).claimPrize(1)).to.be
        .revertedWith("Caller is not token owner");
    });

    it("Should emit PrizedClaimedEvent when the claim is valid and revert if the claim is made more than once", async function () {
      const { prodeLogic, prodeLogicOwner, prodeToken, prodeTokenOwner, multiSig, multiSigOwner1,
        address1, address2, address3 } = await loadFixture(deployContracts);

      const bet1:Number = BigNumber.from("59421121885698253195157962750"); // HOME - ALL VISITORS - HOME
      const bet2:Number = BigNumber.from("26409387504754779197847983445"); // ALL TIES
      const bet3:Number = BigNumber.from("26409387504754779197847983445"); // ALL TIES
      const numberOfWinners:Number = 2;
      const token1Points:Number = 0;
      const token2Points:Number = 48;
      const token3Points:Number = 48;
      const winnerTokens:Array<Number> = [2, 3];

      await prodeLogic.connect(address1).bet(bet1, { value: ethers.utils.parseEther(CORRECT_PRICE) });
      await prodeLogic.connect(address2).bet(bet2, { value: ethers.utils.parseEther(CORRECT_PRICE) });
      await prodeLogic.connect(address3).bet(bet3, { value: ethers.utils.parseEther(CORRECT_PRICE) });

      const scores:Array<Number> = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]; // ALL TIES

      mine(DUE_DATE + (ONE_DAY * 10)); // Simulate the game is already finished

      const ABI = ["function setMatchScore(uint8 _matchId, uint8 _score)"];
      const _interface = new ethers.utils.Interface(ABI);

      for (let i = 0; i < scores.length; i++) {
        const txn = _interface.encodeFunctionData("setMatchScore", [ i, scores[i]]);
        const txnId = await multiSig.connect(multiSigOwner1).callStatic.submit(prodeLogic.address, txn);
        await multiSig.connect(multiSigOwner1).submit(prodeLogic.address, txn);
        await multiSig.connect(multiSigOwner1).approve(txnId);
        await multiSig.connect(multiSigOwner1).execute(txnId);
      }

      const ABI2 = ["function calculatePoints()"];
      const _interface2 = new ethers.utils.Interface(ABI2);
      const txn = _interface2.encodeFunctionData("calculatePoints", []);
      const txnId = await multiSig.connect(multiSigOwner1).callStatic.submit(prodeLogic.address, txn);
      await multiSig.connect(multiSigOwner1).submit(prodeLogic.address, txn);
      await multiSig.connect(multiSigOwner1).approve(txnId);
      await expect(multiSig.connect(multiSigOwner1).execute(txnId)).to.emit(prodeLogic, "PointsCalculatedEvent")
        .withArgs(multiSig.address, numberOfWinners);

      expect(await prodeLogic.getPointsForToken(1)).to.be.equal(token1Points);
      expect(await prodeLogic.getPointsForToken(2)).to.be.equal(token2Points);
      expect(await prodeLogic.getPointsForToken(3)).to.be.equal(token3Points);

      expect(await prodeLogic.getWinnerTokens()).to.deep.equal(winnerTokens);

      await expect(prodeLogic.connect(address2).claimPrize(2)).to.emit(prodeLogic, "PrizedClaimedEvent")
        .withArgs(address2.address, 2, await prodeLogic.getPrizeForWinners());

      await expect(prodeLogic.connect(address2).claimPrize(2)).to.be
        .revertedWith("Token was already payed");
    });
  });
});