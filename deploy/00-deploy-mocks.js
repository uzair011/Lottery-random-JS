const { developmentChains } = require("../helper-hardhat-config")
const { getNamedAccounts, deployments, network, ethers } = require("hardhat")

const BASE_FEE = ethers.utils.parseEther("0.25") // premium LINK - 0.25  ==> consts 0.25 links per request.
const GAS_PRICE_LINK = 1e9 // 1000000000 // LINK per gas.

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    // const chainId = network.config.chainId // deploy on development chain
    const args = [BASE_FEE, GAS_PRICE_LINK]

    if (developmentChains.includes(network.name)) {
        console.log("Development chain detected! Deploying mocks")
        // deploy a mock vrfcoordinator
        await deploy("VRFCoordinatorV2Mock", {
            //contract: "VRFCoordinatorV2Mock",
            from: deployer,
            log: true,
            args: args,
        })
        console.log("Mocks deployed!!!...")
        console.log("---------------------!--!--!---------------------")
    }
}

module.exports.tags = ["all", "mocks"]
