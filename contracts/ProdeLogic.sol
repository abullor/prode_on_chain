// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ProdeToken.sol";

contract ProdeLogic is Ownable {
    struct Match {
        uint8 home;
        uint8 visitor;
        uint8 score;
        uint256 date;
    }

    struct Winner {
        bool valid;
        bool payed;
    }

    uint8 private constant PENDING = 0;
    uint8 private constant HOME = 1;
    uint8 private constant TIE = 2;
    uint8 private constant VISITOR = 3;
    uint8 private constant SUSPENDED = 4;
    uint8 private constant TOTAL_GAMES = 48;
    uint8 private constant FEE = 20;
    uint8 matchesProcessed;
    uint8 private maxPoints;
    bool processCompleted;

    uint256 immutable private dateLimit; //20-11-2022 00:00:00 GMT-0 (1668902400)
    uint256 private constant TICKET_PRICE = 1 ether;
    uint256 private prize;
    uint256 private prizeForWinners;

    mapping (uint256 => uint8) private pointsByToken;
    mapping (uint256 => Winner) private prizeByToken;

    string[32] public countries;
    Match[48] public fixture;
    uint256[] private tokens;
    uint256[] private winnerTokens;

    ProdeToken immutable private prodeToken;

    // Modifiers
    modifier isProcessCompleted() {
        _isProcessCompleted();
        _;
    }

    modifier betChecks(uint96 _bet) {
        _betChecks(_bet);
        _;
    }

    modifier scoreChecks(uint8 _matchId, uint8 _score) {
        _scoreChecks(_matchId, _score);
        _;
    }

    modifier claimChecks(uint256 _nftId) {
        _claimChecks(_nftId);
        _;
    }

    // Events
    event BetStoredEvent(address indexed _sender, uint256 indexed _nftId, uint96 indexed _bet);
    event MatchScoreStoredEvent(address indexed _sender, uint8 indexed _matchId, uint8 indexed _score);
    event PrizedClaimedEvent(address indexed _sender, uint256 indexed _nftId, uint256 indexed _amount);
    event PointsCalculatedEvent(address indexed _sender, uint256 indexed _numberOfWiners);

    constructor(address _prodeTokenAddress, uint256 _dateLimit) {
        prodeToken = ProdeToken(_prodeTokenAddress);
        dateLimit = _dateLimit;

        // Group A
        countries[0] = "Qatar";
        countries[1] = "Ecuador";
        countries[2] = "Senegal";
        countries[3] = "Netherlands";

        // Group B
        countries[4] = "England";
        countries[5] = "Iran";
        countries[6] = "United States";
        countries[7] = "Wales";

        // Group C
        countries[8] = "Argentina";
        countries[9] = "Saudi Arabia";
        countries[10] = "Mexico";
        countries[11] = "Poland";

        // Group D
        countries[12] = "France";
        countries[13] = "Australia";
        countries[14] = "Denmark";
        countries[15] = "Tunisia";

        // Group E
        countries[16] = "Spain";
        countries[17] = "Costa Rica";
        countries[18] = "Germany";
        countries[19] = "Japan";

        // Group F
        countries[20] = "Belgium";
        countries[21] = "Canada";
        countries[22] = "Morocco";
        countries[23] = "Croatia";

        // Group G
        countries[24] = "Brazil";
        countries[25] = "Serbia";
        countries[26] = "Switzerland";
        countries[27] = "Cameroon";

        // Group H
        countries[28] = "Portugal";
        countries[29] = "Ghana";
        countries[30] = "Uruguay";
        countries[31] = "South Korea";

        // 20-11-2022
        fixture[0] = Match(0, 1, 0, 1668960000); // Qatar - Ecuador - 20-11-2022 16:00:00 GMT-0
        // 21-11-2022
        fixture[1] = Match(4, 5, 0, 1669035600); // England - Iran - 21-11-2022 13:00:00 GMT-0
        fixture[2] = Match(2, 3, 0, 1669046400); // Senegal - Netherlands - 21-11-2022 16:00:00 GMT-0
        fixture[3] = Match(6, 7, 0, 1669057200); // United States - Wales - 20-11-2022 19:00:00 GMT-0
        // 22-11-2022
        fixture[4] = Match(8, 9, 0, 1669111200); // Argentina - Saudi Arabia - 22-11-2022 10:00:00 GMT-0
        fixture[5] = Match(14, 15, 0, 1669122000); // Denmark - Tunisia - 22-11-2022 13:00:00 GMT-0
        fixture[6] = Match(10, 11, 0, 1669132800); // Mexico - Poland - 22-11-2022 16:00:00 GMT-0
        fixture[7] = Match(12, 13, 0, 1669143600); // France - Australia - 22-11-2022 19:00:00 GMT-0
        // 23-11-2022
        fixture[8] = Match(22, 23, 0, 1669197600); // Morocco - Croatia - 23-11-2022 10:00:00 GMT-0
        fixture[9] = Match(18, 19, 0, 1669208400); // Germany - Japan - 23-11-2022 13:00:00 GMT-0
        fixture[10] = Match(16, 17, 0, 1669219200); // Spain - Costa Rica - 23-11-2022 16:00:00 GMT-0
        fixture[11] = Match(20, 21, 0, 1669230000); // Belgium - Canada - 23-11-2022 19:00:00 GMT-0
        // 24-11-2022
        fixture[12] = Match(26, 27, 0, 1669284000); // Switzerland - Cameroon - 24-11-2022 10:00:00 GMT-0
        fixture[13] = Match(30, 31, 0, 1669294800); // Uruguay - South Korea - 24-11-2022 13:00:00 GMT-0
        fixture[14] = Match(28, 29, 0, 1669305600); // Portugal - Ghana - 24-11-2022 16:00:00 GMT-0
        fixture[15] = Match(24, 25, 0, 1669316400); // Brazil - Serbia - 24-11-2022 19:00:00 GMT-0
        // 25-11-2022
        fixture[16] = Match(7, 5, 0, 1669370400); // Wales - Iran - 25-11-2022 10:00:00 GMT-0
        fixture[17] = Match(0, 2, 0, 1669381200); // Qatar - Senegal - 25-11-2022 13:00:00 GMT-0
        fixture[18] = Match(3, 1, 0, 1669392000); // Netherlands - Ecuador - 25-11-2022 16:00:00 GMT-0
        fixture[19] = Match(4, 6, 0, 1669402800); // England - United States - 25-11-2022 19:00:00 GMT-0
        // 26-11-2022
        fixture[20] = Match(15, 13, 0, 1669456800); // Tunisia - Australia - 26-11-2022 10:00:00 GMT-0
        fixture[21] = Match(11, 9, 0, 1669467600); // Poland - Saudi Arabia - 26-11-2022 13:00:00 GMT-0
        fixture[22] = Match(12, 14, 0, 1669478400); // France - Denmark - 26-11-2022 16:00:00 GMT-0
        fixture[23] = Match(8, 10, 0, 1669489200); // Argentina - Mexico - 26-11-2022 19:00:00 GMT-0
        // 27-11-2022
        fixture[24] = Match(19, 17, 0, 1669543200); // Japan - Costa Rica - 27-11-2022 10:00:00 GMT-0
        fixture[25] = Match(20, 22, 0, 1669554000); // Belgium - Morocco - 27-11-2022 13:00:00 GMT-0
        fixture[26] = Match(23, 21, 0, 1669564800); // Croatia - Canada - 27-11-2022 16:00:00 GMT-0
        fixture[27] = Match(16, 18, 0, 1669575600); // Spain - Germany - 27-11-2022 19:00:00 GMT-0
        // 28-11-2022
        fixture[28] = Match(27, 25, 0, 1669629600); // Cameroon - Serbia - 28-11-2022 10:00:00 GMT-0
        fixture[29] = Match(31, 29, 0, 1669640400); // South Korea - Ghana - 28-11-2022 13:00:00 GMT-0
        fixture[30] = Match(24, 26, 0, 1669651200); // Brazil - Switzerland - 28-11-2022 16:00:00 GMT-0
        fixture[31] = Match(28, 30, 0, 1669662000); // Portugal - Uruguay - 28-11-2022 19:00:00 GMT-0
        // 29-11-2022
        fixture[32] = Match(3, 0, 0, 1669734000); // Netherlands - Qatar - 29-11-2022 15:00:00 GMT-0
        fixture[33] = Match(1, 2, 0, 1669734000); // Ecuador - Senegal - 29-11-2022 15:00:00 GMT-0
        fixture[34] = Match(7, 4, 0, 1669748400); // Wales - England - 29-11-2022 19:00:00 GMT-0
        fixture[35] = Match(5, 6, 0, 1669748400); // Iran - United States - 29-11-2022 19:00:00 GMT-0
        // 30-11-2022
        fixture[36] = Match(15, 12, 0, 1669820400); // Tunisia - France - 30-11-2022 15:00:00 GMT-0
        fixture[37] = Match(13, 14, 0, 1669820400); // Australia - Denmark - 30-11-2022 15:00:00 GMT-0
        fixture[38] = Match(11, 8, 0, 1669834800); // Poland - Argentina - 30-11-2022 19:00:00 GMT-0
        fixture[39] = Match(9, 10, 0, 1669834800); // Saudi Arabia - Mexico - 30-11-2022 19:00:00 GMT-0
        // 01-12-2022
        fixture[40] = Match(23, 20, 0, 1669906800); // Croatia - Belgium - 01-12-2022 15:00:00 GMT-0
        fixture[41] = Match(21, 22, 0, 1669906800); // Canada - Morocco - 01-12-2022 15:00:00 GMT-0
        fixture[42] = Match(19, 16, 0, 1669921200); // Japan - Spain - 01-12-2022 19:00:00 GMT-0
        fixture[43] = Match(17, 18, 0, 1669921200); // Costa Rica - Germany - 01-12-2022 19:00:00 GMT-0
        // 02-12-2022
        fixture[44] = Match(31, 28, 0, 1669993200); // South Korea - Portugal - 02-12-2022 15:00:00 GMT-0
        fixture[45] = Match(29, 30, 0, 1669993200); // Ghana - Uruguay - 02-12-2022 15:00:00 GMT-0
        fixture[46] = Match(27, 24, 0, 1670007600); // Cameroon - Brazil - 02-12-2022 19:00:00 GMT-0
        fixture[47] = Match(25, 26, 0, 1670007600); // Serbia - Switzerland - 02-12-2022 19:00:00 GMT-0
    }

    function bet(uint96 _bet) external betChecks(_bet) payable returns (uint256) {
        uint256 nftId = prodeToken.mintBet(msg.sender, _bet);

        prize += (100 - FEE) * msg.value / 100;

        tokens.push(nftId);

        emit BetStoredEvent(msg.sender, nftId, _bet);

        return nftId;
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getPrize() public view returns (uint256) {
        return prize;
    }

    function getMatchesProcessed() external view returns (uint8) {
        return matchesProcessed;
    }

    function getPointsForToken(uint256 _nftId) external view returns (uint8) {
        return pointsByToken[_nftId];
    }

    function getWinnerTokens() external view isProcessCompleted returns (uint256[] memory) {
        return winnerTokens;
    }

    function getPrizeForWinners() external view isProcessCompleted returns (uint256) {
        return prizeForWinners;
    }

    function isValidBet(uint96 _bet) private pure returns(bool) {
        for (uint8 i = 0; i < TOTAL_GAMES; i++) {
            uint8 firstIndex = i * 2;

            bool bit1 = isBitSet(_bet, firstIndex);
            bool bit2 = isBitSet(_bet, firstIndex + 1);

            if (!bit1 && !bit2) {
                return false;
            }
        }

        return true;
    }

    function setMatchScore(uint8 _matchId, uint8 _score) external onlyOwner scoreChecks(_matchId, _score) {
        fixture[_matchId].score = _score;

        unchecked {
            matchesProcessed++;
        }

        emit MatchScoreStoredEvent(msg.sender, _matchId, _score);
    }

    function calculatePoints() external onlyOwner {
        require(matchesProcessed == TOTAL_GAMES, "There are still pending scores");

        uint256 tokensLength = tokens.length;
        uint256[] memory _tokens = tokens;

        for (uint256 i = 0; i < tokensLength; i++) {
            calculatePointsForToken(_tokens[i]);
        }

        if (winnerTokens.length > 0) {
            setWinners();
        }

        processCompleted = true;

        emit PointsCalculatedEvent(msg.sender, winnerTokens.length);
    }

    function calculatePointsForToken(uint256 _nftId) private {
        uint96 storedBet = prodeToken.getBet(_nftId);

        uint8 points;

        for (uint8 i = 0; i < TOTAL_GAMES; i++) {
            uint8 firstIndex = i * 2;

            bool bit1 = isBitSet(storedBet, firstIndex);
            bool bit2 = isBitSet(storedBet, firstIndex + 1);

            uint8 result = fixture[i].score;

            if (result != SUSPENDED &&
                ((result == HOME && !bit1 && bit2)
                    || (result == TIE && bit1 && !bit2)
                    || (result == VISITOR && bit1 && bit2))) {
                    points++;
            }
        }

        pointsByToken[_nftId] = points;

        if (points > 0) {
            checkPoints(_nftId, points);
        }
    }

    function setWinners() internal {
        uint256 winnerTokensLength = winnerTokens.length;

        prizeForWinners = winnerTokensLength == 1 ? getPrize() : getPrize() / winnerTokensLength;

        for (uint256 i = 0; i < winnerTokensLength; i++) {
            prizeByToken[winnerTokens[i]] = Winner(true, false);
        }
    }

    function checkPoints(uint256 _nftId, uint8 _points) private {
        if (_points > maxPoints) {
            maxPoints = _points;

            delete winnerTokens;

            winnerTokens.push(_nftId);
        } else if (_points == maxPoints) {
            winnerTokens.push(_nftId);
        }
    }

    function claimPrize(uint256 _nftId) external claimChecks(_nftId) {
        prizeByToken[_nftId].payed = true;

        require(payable(msg.sender).send(prizeForWinners), "Error trying to send funds");

        emit PrizedClaimedEvent(msg.sender, _nftId, prizeForWinners);
    }

    function isBitSet(uint96 n, uint8 pos) private pure returns (bool) {
        return ((n >> pos) & 1) == 1;
    }

    // Modifier impls
    function _isProcessCompleted() private view {
        require(processCompleted, "Process is not completed");
    }

    function _betChecks(uint96 _bet) private view {
        require(block.timestamp < dateLimit, "Date limit is already due");
        require(msg.value == TICKET_PRICE, "Invalid price");
        require(isValidBet(_bet), "There are matches without score");
    }

    function _scoreChecks(uint8 _matchId, uint8 _score) private view {
        require (_matchId >= 0 && _matchId <= 47, "Invalid match id.");
        require (fixture[_matchId].date + 6 hours < block.timestamp, "Match may not be finished yet.");
        require (fixture[_matchId].score == PENDING, "Score already entered.");
        require (_score >= 1 && _score <= 4, "Invalid score.");
    }

    function _claimChecks(uint256 _nftId) private view {
        require(prizeByToken[_nftId].valid, "Token is not a winner");
        require(msg.sender == prodeToken.ownerOf(_nftId), "Caller is not token owner");
        require(!prizeByToken[_nftId].payed, "Token was already payed");
    }
}