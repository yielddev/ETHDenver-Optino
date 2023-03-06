import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
const {
    BN,
    constants,
    ether,
} = require("@openzeppelin/test-helpers")

describe("Test LP", function() {
    var usd: ethers.Contract;
    var optino: ethers.Contract;
    var option_contract: ethers.Contract;
    var oracle_contract: ethers.Contract;
    var admin: ethers.SignerWithAddress;
    var lp1: ethers.SignerWithAddress;
    var lp2: ethers.SignerWithAddress;
    var lp3: ethers.SignerWithAddress;
    var lp4: ethers.SignerWithAddress;
    var lp5: ethers.SignerWithAddress;
    var lp6: ethers.SignerWithAddress;
    var buyer1: ethers.SignerWithAddress;
    var buyer2: ethers.SignerWithAddress;
    var buyer3: ethers.SignerWithAddress;
    var buyer4: ethers.SignerWithAddress;
    var buyer5: ethers.SignerWithAddress;
    var buyer6: ethers.SignerWithAddress;
    var buyer7: ethers.SignerWithAddress;
    var expiry: number
    var startTime: number
    var lp_shares: ethers.Contract;
    var calls: any;
    var puts: any;
    const approveUSD = async function(user: ethers.Signer, amount: string) {
      await usd.connect(user).approve(optino.address, ether(amount).toString());
    }
    const approveAndLP = async function(user: ethers.Signer, amount: string) {
      await approveUSD(user, amount);
      await optino.connect(user).liquidityDeposit(ether(amount).toString())
    }

    const buyOptions = async function(
        user: ethers.Signer, exp: ethers.BigNumber, strike: ethers.BigNumber, amount: number, isCall: boolean
    ) {
      await usd.connect(user).approve(optino.address, ether("100").toString())
      await optino.connect(user).buyOption(exp, strike, amount, isCall);
    }
    const getAllCalls = async function() {
      return {
        six_hours: getOptions((await optino.calls(0))),
        twelve_hours: getOptions((await optino.calls(1))),
        twenty_four_hours: getOptions((await optino.calls(2)))
      }
    }
    const getOptions = function(expiry: any) {
      return {
        expiry: expiry[0],
        one_delta: expiry[1],
        ten_delta: expiry[2],
        twenty_five_delta: expiry[3],
        fifty_delta: expiry[4]
      }
    }
    const getEpochOptions = async function() {
            // let epoch = await optino.calls(1)
      return {
        six_hours: getOptions((await optino.calls(0))),
        twelve_hours: getOptions((await optino.calls(1))),
        twenty_four_hours: getOptions((await optino.calls(2)))
      }
    }
    const getAllPuts = async function() {
      return {
        six_hours: getOptions((await optino.puts(0))),
        twelve_hours: getOptions((await optino.puts(1))),
        twenty_four_hours: getOptions((await optino.puts(2)))
      }
    }
    beforeEach(async function() {
      const ONE_DAY_IN_SECONDS = 24 * 60 * 60;
      
      [
          admin, lp1, lp2, lp3, lp4, lp5, lp6,
          buyer1, buyer2, buyer3, buyer4, buyer5, buyer6, buyer7
      ] = await ethers.getSigners();

      const OptionPrice = await ethers.getContractFactory("OptionPrice")
      oracle_contract = await OptionPrice.attach("0x2a8cEabFE96Cd8E780c84296AE9a0E100fc12B93");

      const USDC = await ethers.getContractFactory("USDC");
      usd = await USDC.deploy();

      const Optino = await ethers.getContractFactory("Optino")
      optino = await Optino.deploy(usd.address, oracle_contract.address)
      startTime = (await optino.currentEpoch()).startTime
      expiry = startTime + ONE_DAY_IN_SECONDS;

      const OptionContract = await ethers.getContractFactory("OptionContract")
      const option_contract_address = await optino.OptionCollection();
      option_contract = await OptionContract.attach(option_contract_address);
      
      let lp_shares_address = await optino.LPShares();
      const LPShares = await ethers.getContractFactory("OptinoLPShares")
      lp_shares = await LPShares.attach(lp_shares_address)

      await usd.mint(lp1.address, ether("100").toString())
      await usd.mint(lp2.address, ether("100").toString())
      await usd.mint(lp3.address, ether("100").toString())
      await usd.mint(lp4.address, ether("100").toString())
      await usd.mint(lp5.address, ether("100").toString())
      await usd.mint(lp6.address, ether("100").toString())

      await usd.mint(buyer1.address, ether("100").toString())
      await usd.mint(buyer2.address, ether("100").toString())
      await usd.mint(buyer3.address, ether("100").toString())
      await usd.mint(buyer4.address, ether("100").toString())
      await usd.mint(buyer5.address, ether("100").toString())
      await usd.mint(buyer6.address, ether("100").toString())
      await usd.mint(buyer7.address, ether("100").toString())

      await approveAndLP(lp1, "100")
      await approveAndLP(lp2, "100")
      await approveAndLP(lp3, "100")
      await approveAndLP(lp4, "100")
      await approveAndLP(lp5, "100")

      calls = await getAllCalls();
      puts = await getAllPuts();



            
  })
  it("Tests deposits liquidity a splits shares", async function() {
    expect((await lp_shares.balanceOf(lp3.address))).to.equal(ether("100"))
    console.log("Usd balance: ", (await usd.balanceOf(lp6.address)))
    // 400 options get sold
    await buyOptions(buyer1, calls.six_hours.expiry, calls.six_hours.ten_delta, 100, true);  

    await buyOptions(buyer2, calls.six_hours.expiry, calls.six_hours.twenty_five_delta, 100, true);  

    //advance time to change price
    let three_hours = 60 * 60 * 5
    await time.increase(three_hours)
    let lp_equity = await optino.LPEquity()
    let total_lp_shares = await lp_shares.totalSupply()
    // add 100 more usdc
    await approveAndLP(lp6, "100")
    // expected calculation
    let expected_lp_price = lp_equity.div(total_lp_shares)
    console.log(expected_lp_price)
    let new_shares = expected_lp_price.mul(ethers.BigNumber.from(ether("100").toString()))
    console.log(new_shares)
    expect((await lp_shares.balanceOf(lp6.address))).to.equal(new_shares)
    console.log("Usd balance: ", (await usd.balanceOf(lp6.address)))

    await time.increaseTo(calls.six_hours.expiry) 
    await optino.connect(admin).resolveExpiredOptions(calls.six_hours.expiry, ether("1750").toString())

    let lp_equity_after_loss = await optino.LPEquity() 
    let total_lp_shares_after_loss = await lp_shares.totalSupply()
    let expected_lp_price_after_loss = lp_equity_after_loss.div(total_lp_shares_after_loss)
    console.log(expected_lp_price_after_loss)

    console.log(lp_equity_after_loss)
    console.log(total_lp_shares_after_loss)
    await time.increaseTo(calls.twelve_hours.expiry) 
    // halfway through lp requests withdraw
    console.log("Breaks here 0")
    await optino.connect(lp6).requestLiquidityWithdraw(ether("100").toString()) 
    await optino.connect(lp5).requestLiquidityWithdraw(ether("100").toString()) 
    await optino.connect(lp4).requestLiquidityWithdraw(ether("100").toString()) 
    await optino.connect(lp3).requestLiquidityWithdraw(ether("100").toString()) 
    await optino.connect(lp2).requestLiquidityWithdraw(ether("100").toString()) 
    await optino.connect(lp1).requestLiquidityWithdraw(ether("100").toString()) 

    await optino.connect(admin).resolveExpiredOptions(calls.twelve_hours.expiry, ether("1755").toString());
    await time.increaseTo(calls.twenty_four_hours.expiry)
    await optino.connect(admin).resolveExpiredOptions(calls.twenty_four_hours.expiry, ether("1749").toString());

    // actually withdraw liquidity
    await optino.connect(lp6).withdrawLiquidity()
    await optino.connect(lp5).withdrawLiquidity()
    await optino.connect(lp4).withdrawLiquidity()
    await optino.connect(lp3).withdrawLiquidity()
    await optino.connect(lp2).withdrawLiquidity()
    await optino.connect(lp1).withdrawLiquidity()

    let lp_equity_after_withdraw = await optino.LPEquity()
    console.log(ethers.utils.formatEther(lp_equity_after_withdraw))
    console.log("Usd balance: ", ethers.utils.formatEther((await usd.balanceOf(lp6.address))))
    console.log("Usd balance: ", ethers.utils.formatEther((await usd.balanceOf(lp5.address))))
    console.log("Usd balance: ", ethers.utils.formatEther((await usd.balanceOf(lp4.address))))
    console.log("Usd balance: ", ethers.utils.formatEther((await usd.balanceOf(lp3.address))))
    console.log("Usd balance: ", ethers.utils.formatEther((await usd.balanceOf(lp2.address))))
    console.log("Usd balance: ", ethers.utils.formatEther((await usd.balanceOf(lp1.address))))

    expect((await lp_shares.balanceOf(lp6.address))).to.equal(ethers.BigNumber.from("0"))

    

  })
})
