const { ethers, network } = require("hardhat")
const fs = require("fs")
//const { networkInterfaces } = require("os")

const FRONT_END_ADDRESSES_FILE = "../next_smart-contract_lottery/Constants/contractAddress.json"
const FRONT_END_ABI_FILE = "../next_smart-contract_lottery/Constants/abi.json"

module.exports = async () => {
    if (process.env.UPDATE_FRONT_END) {
        console.log(`Front end updating...`)
        updateContractAddresses()
        updateAbi()
        console.log(`Front end updated!!!`)
    }
}

async function updateContractAddresses() {
    const raffle = await ethers.getContract("Raffle")
    const chainId = network.config.chainId.toString()
    const currentAddresses = JSON.parse(fs.readFileSync(FRONT_END_ADDRESSES_FILE, "utf8"))
    if (chainId in currentAddresses) {
        if (!currentAddresses[chainId].includes(raffle.address)) {
            currentAddresses[chainId].push(raffle.address)
        }
    } else {
        currentAddresses[chainId] = [raffle.address]
    }
    fs.writeFileSync(FRONT_END_ADDRESSES_FILE, JSON.stringify(currentAddresses))
}

async function updateAbi() {
    const raffle = await ethers.getContract("Raffle")
    fs.writeFileSync(FRONT_END_ABI_FILE, raffle.interface.format(ethers.utils.FormatTypes.json))
}

module.exports.tags = ["all", "frontend "]
