const { assert, expect } = require("chai")
const { recoverAddress } = require("ethers/lib/utils")
const { getNamedAccounts, deployments, ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

// testing only on development chains
!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle UNIT test", function () {
          let deployer, raffle, vrfCoordinatorV2Mock, raffleEntranceFee, interval
          const chainId = network.config.chainId

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              //deployer = accounts[0]
              await deployments.fixture(["all"])
              raffle = await ethers.getContract("Raffle", deployer)
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
              raffleEntranceFee = await raffle.getEntranceFee()
              interval = await raffle.getInterval()
              //player = accounts[1]
          })

          describe("Constructor function", function () {
              it("Initialises the raffle correctly.", async function () {
                  // usually we have 1 assert per 1 it()
                  const raffleState = await raffle.getRaffleState()

                  assert.equal(raffleState.toString(), "0")
                  assert.equal(interval.toString(), networkConfig[chainId]["interval"])
              })
          })

          describe("enterRaffle function", function () {
              it("Revert when you don't pay enough", async () => {
                  await expect(raffle.enterRaffle()).to.be.revertedWith(
                      "Raffle__NotEnoughEthEntrance"
                  )
              })

              it("Records players when they enter", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  const playerFromContract = await raffle.getPlayer(0)
                  assert.equal(playerFromContract, deployer)
              })

              it("emit events on enter", async () => {
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
                      raffle,
                      "RaffleEnter"
                  )
              })

              it("Doesn't allow entrance when the state is calculating...", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  // pretend to be a chainlink keeper
                  await raffle.performUpkeep([])

                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith(
                      "Raffle_NotOpen"
                  )
              })
          })

          //! ======================
          describe("checkUpkeep", () => {
              it("return false if people didn't send ETH...!", async () => {
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const { upKeepNeeded } = await raffle.callStatic.checkUpkeep([])
                  assert(!upKeepNeeded)
              })

              it("Returns false if raffle is closed", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  await raffle.performUpkeep("0x")
                  const raffleState = await raffle.getRaffleState()
                  const { upKeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
                  assert.equal(raffleState.toString(), "1")
                  assert.equal(upKeepNeeded, false)
              })

              it("Returns false if enough time hasn't passed", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() - 1])
                  await network.provider.send("evm_mine", [])
                  const { upKeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
                  assert(!upKeepNeeded)
              })

              it("Returns true if enough time has passed, has players, eth, and is open", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const { upKeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
                  assert(upKeepNeeded)
              })
          })

          describe("PerformUpkeep", () => {
              it("Can only run if checkUpkeep is true", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const transaction = await raffle.performUpkeep([])
                  assert(transaction)
              })

              it("reverts if checkUpkeep is false", async () => {
                  await expect(raffle.performUpkeep([])).to.be.revertedWith(
                      "Raffle__UpKeepNotNeeded"
                  )
              })

              it("Updates the raffle state, emits and event, and calls the vrfcoordinator", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const transactionResponse = await raffle.performUpkeep([])
                  const transactionreceipt = await transactionResponse.wait(1)
                  const requestId = transactionreceipt.events[1].args.requestId
                  const raffleState = await raffle.getRaffleState()
                  assert(requestId.toNumber() > 0)
                  assert(raffleState.toString() == "1")
              })
          })

          describe("fulFillRandomWords", () => {
              beforeEach(async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
              })

              it("Can only be called after performUpkeep", async () => {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
                  ).to.be.revertedWith("nonexistent request")
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)
                  ).to.be.revertedWith("nonexistent request")
              })

              it("Picks a winner, resets the lottery, Send the money ", async () => {
                  const additionalEntrances = 3
                  const staritngAccountIndex = 1
                  const accounts = await ethers.getSigners()
                  for (
                      let i = staritngAccountIndex;
                      i < staritngAccountIndex + additionalEntrances;
                      i++
                  ) {
                      const accountConnectedRaffle = raffle.connect(accounts[i])
                      await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee })
                  }
                  // total = 4 accounts
                  const startingTimeStamp = await raffle.getLatestTimeStamp()

                  //? PerformUpkeep(mock being a chainlink keeper)
                  //? fulfillRandomWords(mock being chainlink vrf)
                  //? will have to wait for the fulfillRandomWords to be called

                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async () => {
                          console.log(`Found the event...`)
                          try {
                              const recentWinner = await raffle.getRecentWinner()
                              //   console.log(recentWinner)

                              const raffleState = await raffle.getRaffleState()
                              const endigTimeStamp = await raffle.getLatestTimeStamp()
                              const numberOfPlayers = await raffle.getNumberOfPlayers()
                              const winnerEndingBalance = await accounts[1].getBalance()

                              assert.equal(numberOfPlayers.toString(), "0")
                              assert.equal(raffleState.toString(), "0")
                              assert(endigTimeStamp > startingTimeStamp)

                              // Final
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalnce.add(
                                      raffleEntranceFee
                                          .mul(additionalEntrances)
                                          .add(raffleEntranceFee)
                                          .toString()
                                  )
                              )
                          } catch (e) {
                              reject(e)
                          }
                          resolve()
                      })
                      const transaction2 = await raffle.performUpkeep([])
                      const transaction2receipt = await transaction2.wait(1)
                      const winnerStartingBalnce = await accounts[1].getBalance()
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          transaction2receipt.events[1].args.requestId,
                          raffle.address
                      )
                  })
              })
          })
      })
