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
              await deployments.fixture(["all"])
              raffle = await ethers.getContract("Raffle", deployer)
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
              raffleEntranceFee = await raffle.getEntranceFee()
              interval = await raffle.getInterval()
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
                  raffle.enterRaffle({ value: "raffleEntranceFee" })
                  const playerFromContract = await raffle.getPlayer(0)
                  assert.equal(playerFromContract, deployer)
              })

              it("emit events on enter", async () => {
                  await expect(raffle.enterRaffle({ value: "raffleEntranceFee" })).to.be.emit(
                      raffle,
                      "RaffleEnter"
                  )
              })

              it("Doesn't allow entrance when the state is calculating...", async () => {
                  await raffle.enterRaffle({ value: "raffleEntranceFee" })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  // pretend to be a chainlink keeper
                  await raffle.performUpkeep([])

                  await expect(
                      raffle.enterRaffle({ value: "raffleEntranceFee" })
                  ).to.be.revertedWith("Raffle_NotOpen")
              })
          })
          describe("checkUpKeep", () => {
              it("return false if people didn't send ETH...!", async () => {
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const { upKeepNeeded } = await raffle.callStatic.checkUpKeep([])
                  assert(!upKeepNeeded)
              })

              it("Returns false if raffle is closed", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  await raffle.performUpkeep("0x")
                  const raffleState = await raffle.getRaffleState()
                  const { upKeepNeeded } = await raffle.callStatic.checkUpKeep([])
                  assert.equal(raffleState.toString(), "1")
                  assert.equal(upKeepNeeded, false)
              })

              it("Returns false if enough time hasn't passed", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() - 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const { upKeepNeeded } = await raffle.callStatic.checkUpKeep("0x")
                  assert(!upKeepNeeded)
              })

              it("Returns true if enough time has passed, has players, eth, and is open", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const { upKeepNeeded } = await raffle.callStatic.checkUpKeep("0x")
                  assert(upKeepNeeded)
              })
          })

          describe("PerformUpkeep", () => {
              it("Can only run if checkupkeep is true", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send({ method: "evm_mine", params: [] })
                  const transaction = await raffle.performUpkeep([])
                  assert(transaction)
              })

              it("reverts if checkUpKeep is false", async () => {
                  await expect(raffle.performUpkeep([])).to.be.revertedWith(
                      "Raffle__UpKeepNotNeeded"
                  )
              })

              it("Updates the raffle state, emits and event, and calls the vrfcoordinator", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send({ method: "evm_mine", params: [] })
                  const transactionResponse = await raffle.performUpkeep([])
                  const transactionreceipt = await transactionResponse.wait(1)
                  const requestId = transactionreceipt.events[1].args.requestId
                  const raffleState = await raffle.getRaffleState()
                  assert(requestId.toNumber() > 0)
                  assert(raffleState.toString() == "1")
              })
          })

          describe("fulFillRandomWords", () => {})
      })
