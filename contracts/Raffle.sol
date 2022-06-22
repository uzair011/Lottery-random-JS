// Raffle
// enter tht lottery by paying the entry fee
// pick a random winner (varifiably random)
// winner has to be selected automatically in X minutes
// chainlink oracle -> randomness/ automated execution (cianlink keeper)

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";

error Raffle__notEnoughEthEntrance();

contract Raffle is VRFConsumerBaseV2 {
    /** State variabels */
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;

    /** events */
    event RaffleEnter(address indexed player);

    constructor(uint256 entranceFee, address vrfCoordinatorV2) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = entranceFee;
    }

    function enterRaffle() public payable {
        if (msg.value > i_entranceFee) {
            revert Raffle__notEnoughEthEntrance();
        }
        s_players.push(payable(msg.sender));
        // emiit an event when we update a dynamic array / mapping
        // Named events with the function names reversed...
        emit RaffleEnter(msg.sender);
    }

    function requestARandomWinner() external {
        // request a random winner
        // do the process with the random number
        // 2 transaction process
    }

    // function fulFillRandomWords(uint256 requestId, uint256[] memory randomWords)
    //     internal
    //     override
    // {}
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords)
        internal
        virtual
        override
    {}

    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }
}
