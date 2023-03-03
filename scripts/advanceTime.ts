require("@nomicfoundation/hardhat-toolbox");
import { time } from "@nomicfoundation/hardhat-network-helpers";
task("advanceTime", "Moves Time 6 hours")
  .setAction(async(hre) => {
    const ethers = hre.ethers;
    let six_hours = 60 * 60 * 6
    let now = await time.latest()
    await time.increaseTo(now + six_hours)

    // await hre.network.request({
    //   method: 'evm_incraseTime',
    //   params: six_hours
    // })

  })
