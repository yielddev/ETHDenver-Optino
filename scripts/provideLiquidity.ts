require("@nomicfoundation/hardhat-toolbox");

const {
  ether
} = require("@openzeppelin/test-helpers");


task("provideLiquidity", "LPs into pool")
  .addPositionalParam("optinoAddress")
  .setAction(async(taskArgs, hre) => {
    const ethers = hre.ethers;
    
    const user = (await ethers.getSigners())[0]
    const Optino = await ethers.getContractFactory("Optino");
    const optino = await Optino.attach(taskArgs.optinoAddress);

    const USDC = await ethers.getContractFactory("USDC")
    const usdc = await USDC.attach((await optino.USDC()))

    const LPShares = await ethers.getContractFactory("OptinoLPShares")
    const lp_shares = await LPShares.attach((await optino.LPShares()))


    let isSuspended = await optino.isSuspended()

    console.log("Is Suspended?: ", isSuspended)
    if(isSuspended) {
      console.log("Is Suspended Temorarily")
    } else {
      await usdc.approve(optino.address, ether("10000").toString())
      await optino.liquidityDeposit(ether("10000").toString())
      let shares_bal = await lp_shares.balanceOf(user.address)
      console.log("LP SHARES: ", ethers.utils.formatEther(shares_bal))
    }
})
