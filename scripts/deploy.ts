import { ethers } from "hardhat";

// async function main() {
//   const currentTimestampInSeconds = Math.round(Date.now() / 1000);
//   const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
//   const unlockTime = currentTimestampInSeconds + ONE_YEAR_IN_SECS;

//   const lockedAmount = ethers.utils.parseEther("1");

//   const Lock = await ethers.getContractFactory("Lock");
//   const lock = await Lock.deploy(unlockTime, { value: lockedAmount });

//   await lock.deployed();

//   console.log(`Lock with 1 ETH and unlock timestamp ${unlockTime} deployed to ${lock.address}`);
// }

// async function main() {
//     const Token = await ethers.getContractFactory("Token");
//     const myToken = await Token.deploy();
//     await myToken.deployed();

//     console.log(`deployed at addreess ${myToken.address}`);

//     const total_supply = await myToken.totalSupply();
//     console.log(`total supply ${total_supply}`);
// }

async function main() {
   const OptionPrice = await ethers.getContractFactory("OptionPrice");
   const opt_price = await OptionPrice.deploy();
   await opt_price.deployed();

   console.log(`deployed at addreess ${opt_price.address}`);

   const num = await opt_price.sqrt(17);
   console.log(num);

   const currentTimestampInSeconds = Math.round(Date.now() / 1000);
   console.log(currentTimestampInSeconds);

   const prob1 = await opt_price.optionPrice(true , 1500 , currentTimestampInSeconds+1800);
   console.log(prob1);

   const prob2 = await opt_price.optionPrice(true , 1600 , currentTimestampInSeconds+1800);
   console.log(prob2);

   const prob3 = await opt_price.optionPrice(true , 1610 , currentTimestampInSeconds+1800);
   console.log(prob3);

   const prob4 = await opt_price.optionPrice(true , 1650 , currentTimestampInSeconds+1800);
   console.log(prob4);

   const prob5 = await opt_price.optionPrice(false , 1700 , currentTimestampInSeconds+1800);
   console.log(prob5);

   const prob6 = await opt_price.optionPrice(false , 1600 , currentTimestampInSeconds+1800);
   console.log(prob6);

   const prob7 = await opt_price.optionPrice(false , 1590 , currentTimestampInSeconds+1800);
   console.log(prob7);

   const prob8 = await opt_price.optionPrice(false , 1580 , currentTimestampInSeconds+1800);
   console.log(prob8);
}




// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
