// Raffle
// enter tht lottery by paying the entry fee
// pick a random winner (varifiably random)
// winner has to be selected automatically in X minutes
// chainlink oracle -> randomness/ automated execution (cianlink keeper)

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";

error Raffle__NotEnoughEthEntrance();
error Raffle__TransferFailed();
error Raffle_NotOpen();
error Raffle__UpKeepNotNeeded(uint256 currentBalance, uint256 totalPlayers, uint256 stateRaffle);

/**
    @title - Sample Raffle/lottery contract
    @author - Uzair
    @notice - This contract is for creating an untamperable decentralized smart contract
    @dev - This implements Chainlink VRF V2 and Chainlink keepers
 */

contract Raffle is VRFConsumerBaseV2, KeeperCompatibleInterface {
    /** Type declarations */
    enum RaffleState {
        OPEN,
        CLACULATING
    } // uint256 open = 0, claculating = 1

    /** State variabels */
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane; // keyHash
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callBackGasLimit;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    /** lottery variables - recent */
    address private s_recentWinner;
    // bool private s_isOpen; // true if open otherwise false...
    RaffleState private s_raffleState;
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval;

    /** events */
    event RaffleEnter(address indexed player);
    event RequestedRaffleWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner); // keep track of all the winners...

    /** Functions */
    constructor(
        address vrfCoordinatorV2,
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callBackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callBackGasLimit = callBackGasLimit;
        s_raffleState = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
    }

    function enterRaffle() public payable {
        if (msg.value > i_entranceFee) {
            revert Raffle__NotEnoughEthEntrance();
        }
        if (s_raffleState != RaffleState.OPEN) {
            revert Raffle_NotOpen();
        }
        s_players.push(payable(msg.sender));
        // emiit an event when we update a dynamic array / mapping
        // Named events with the function names reversed...
        emit RaffleEnter(msg.sender);
    }

    /**
     * @dev - This is the function that the chainlink keeper nodes call tey
       look for the 'upKeepNeeded' to return true.
     => The following should be true inorder to return true...
        1. our time interval should be passed.
        2. the lottery should atleast have 1 player and some ETH
        3. our subscription shuld be funded with link
        4. the lottery should be in an 'open' state.
     */

    function checkUpkeep(
        bytes memory /** checkData */
    )
        public
        override
        returns (
            bool upKeepNeeded,
            bytes memory /** performData */
        )
    {
        bool isOpen = (RaffleState.OPEN == s_raffleState);
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool hasPlayers = (s_players.length > 0);
        bool hasBalance = address(this).balance > 0;
        upKeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
    }

    //    function requestARandomWinner() external {
    function performUpkeep(
        bytes calldata /* performData */
    ) external override {
        // request a random winner
        // do the process with the random number
        // 2 transaction process

        (bool upKeepNeeded, ) = checkUpkeep("");

        if (!upKeepNeeded) {
            revert Raffle__UpKeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_raffleState)
            );
        }

        s_raffleState = RaffleState.CLACULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callBackGasLimit,
            NUM_WORDS
        );
        emit RequestedRaffleWinner(requestId);
    }

    // * randomWords => random word is the random number
    function fulfillRandomWords(
        uint256, /**  requestId */
        uint256[] memory randomWords
    ) internal override {
        // pick a random winner from the array of s_players...
        uint256 indexOfWinner = randomWords[0] % s_players.length; // randomWords[0] ==> because, we get only one reandom word...
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        s_raffleState = RaffleState.OPEN; // reset the state
        s_players = new address payable[](0); // resetting the s_players array after picking a winner
        s_lastTimeStamp = block.timestamp; // reset the timestamp for new players

        // sending the money to the winner
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        if (!success) {
            revert Raffle__TransferFailed();
        }

        emit WinnerPicked(recentWinner);
    }

    /** view / pure functions - getters */

    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    function getNumberOfWords() public pure returns (uint256) {
        return NUM_WORDS;
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function latestTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getRequestConfirmations() public pure returns (uint256) {
        return REQUEST_CONFIRMATIONS;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }
}
