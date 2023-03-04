require("@nomicfoundation/hardhat-toolbox");

const {
  ether
} = require("@openzeppelin/test-helpers");


task("OptinoInfo", "Gets Info from Optino Contract")
  .addPositionalParam("optinoAddress")
  .setAction(async(taskArgs, hre) => {
    const ethers = hre.ethers;
    
    const Optino = await ethers.getContractFactory("Optino");
    const optino = await Optino.attach(taskArgs.optinoAddress);

    const OptionContract = await ethers.getContractFactory("OptionContract");
    const option_contract = await OptionContract.attach((await optino.OptionCollection()))

    const Oracle = await ethers.getContractFactory("OptionPrice");
    const oracle = await Oracle.attach((await optino.oracle()))
    console.log(oracle.address)

    let calls_expiry6 = await optino.calls(0)
    let calls_expiry12 = await optino.calls(1)
    let calls_expiry24 = await optino.calls(2)


    let puts_expiry6 = await optino.puts(0)
    let puts_expiry12 = await optino.puts(1)
    let puts_expiry24 = await optino.puts(2)
    //const print_price = async function()
    const print_option_price = async function(option, isCall) {
      if (isCall) {

        console.log("1 Delta strike : ", option.one_delta.toString())
        console.log("1 Delta price  : ", ethers.utils.formatEther((await optino.getPrice(option.expiry, option.one_delta, isCall))))
        console.log("1 Delta TokenId: ", (await option_contract.getOptionTokenId(option.expiry, option.one_delta, isCall)), "\n")
        // console.log("1 Delta price: ", (await optino.getPrice(option.expiry, option.one_delta, isCall)))

        console.log("10 Delta strike: ", option.ten_delta.toString())
        console.log("10 Delta price : ", ethers.utils.formatEther((await optino.getPrice(option.expiry, option.ten_delta, isCall))))
        console.log("10 Delta TokenId: ", (await option_contract.getOptionTokenId(option.expiry, option.ten_delta, isCall)), "\n")

        console.log("25 Delta strike: ", option.twenty_five_delta.toString())
        console.log("25 Delta price : ", ethers.utils.formatEther((await optino.getPrice(option.expiry, option.twenty_five_delta, isCall))))
        console.log("25 Delta TokenId: ", (await option_contract.getOptionTokenId(option.expiry, option.twenty_five_delta, isCall)), "\n")

        console.log("50 Delta strike: ", option.fifty_delta.toString())
        console.log("50 Delta price : ", ethers.utils.formatEther((await optino.getPrice(option.expiry, option.fifty_delta, isCall))))
        console.log("50 Delta TokenId: ", (await option_contract.getOptionTokenId(option.expiry, option.fifty_delta, isCall)), "\n")
        
      } else {
        console.log("50 Delta strike: ", option.fifty_delta.toString())
        console.log("50 Delta price : ", ethers.utils.formatEther((await optino.getPrice(option.expiry, option.fifty_delta, isCall))))
        console.log("50 Delta TokenId: ", (await option_contract.getOptionTokenId(option.expiry, option.fifty_delta, isCall)),"\n")

        console.log("25 Delta strike: ", option.twenty_five_delta.toString())
        console.log("25 Delta price : ", ethers.utils.formatEther((await optino.getPrice(option.expiry, option.twenty_five_delta, isCall))))
        console.log("25 Delta TokenId: ", (await option_contract.getOptionTokenId(option.expiry, option.twenty_five_delta, isCall)), "\n")

        console.log("10 Delta strike: ", option.ten_delta.toString())
        console.log("10 Delta price : ", ethers.utils.formatEther((await optino.getPrice(option.expiry, option.ten_delta, isCall))))
        console.log("10 Delta TokenId: ", (await option_contract.getOptionTokenId(option.expiry, option.ten_delta, isCall)), "/n")

        console.log("1 Delta strike : ", option.one_delta.toString())
        console.log("1 Delta price  : ", ethers.utils.formatEther((await optino.getPrice(option.expiry, option.one_delta, isCall))))
        console.log("1 Delta TokenId: ", (await option_contract.getOptionTokenId(option.expiry, option.one_delta, isCall)), "/n")
        // console.log("1 Delta price: ", (await optino.getPrice(option.expiry, option.one_delta, isCall)))
        

      }
    }
    const printOptionInfo = async function(call, put) {
      console.log("Calls: \n")
      await print_option_price(call, true)
      console.log("=====================================")
      console.log("Puts: \n")
      await print_option_price(put, false)
      
    }


    console.log("=====================================")
    console.log("Current Eth Price: ", ethers.utils.formatEther((await oracle.getPrice())))
    console.log("=====================================")

    console.log("6 Hour Expiry: ", calls_expiry6.expiry)
    console.log("=====================================")
    await printOptionInfo(calls_expiry6, puts_expiry6)
    console.log("=====================================")
    console.log("12 Hour Expiry: ", calls_expiry12.expiry)
    console.log("=====================================")
    await printOptionInfo(calls_expiry12, puts_expiry12)
    console.log("=====================================")
    console.log("24 Hour Expiry: ", calls_expiry24.expiry)
    console.log("=====================================")
    await printOptionInfo(calls_expiry24, puts_expiry24)
    console.log("=====================================")
  })
