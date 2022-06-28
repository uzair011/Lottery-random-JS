const { assert, expect } = require("chai")
const { getNamedAccounts, deployments, ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

// testing only on development chains
developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle STAGING test", function () {
          let deployer, raffle, raffleEntranceFee

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              raffle = await ethers.getContract("Raffle", deployer)
              raffleEntranceFee = await raffle.getEntranceFee()
          })

          describe("fulfillRandomWords", () => {
              it("Works with live chainlink keepers and chainlink vrf, and we get a random winner ", async () => {
                  // enter the rafle
                  const startingTimeStamp = await raffle.getLatestTimeStamp()
                  const accounts = await raffle.ethers.getSigners()

                  await new Promise(async (resolve, reject) => {
                      raffle.once("Winner picked", async () => {
                          console.log("Winner picked and event fired!")
                          try {
                              const recentWinner = await raffle.getRecentWinner()
                              const raffleState = await raffle.getRaffleState()
                              const winnerEndingBalance = await accounts[0].getBalance() // deployer
                              const endingTimeStamp = await raffle.getLatestTimeStamp()

                              await expect(raffle.getPlayer(0)).to.be.reverted
                              assert.equal(recentWinner.toString(), accounts[0].address)
                              assert.equal(raffleState, 0)
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalnce.add(raffleEntranceFee).toString()
                              )
                              assert.equal(endingTimeStamp > startingTimeStamp)
                              resolve()
                          } catch (e) {
                              console.log(e)
                              reject(e)
                          }
                      })
                      await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee })
                      const winnerStartingBalnce = await accounts[0].getBalance()
                  })

                  // setup listner before we enter the raffle
              })
          })
      })

// 1. get our subId for chainlink vrf
// 2. deploy the contract using subId
// 3. register the contract with chainlink vrf and subId
// 4. register the contract witn chainlink keepers
// 5. run staging tests
