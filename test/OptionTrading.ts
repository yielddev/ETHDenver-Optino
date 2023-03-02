import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
const {
    BN,
    constants,
    ether,
} = require("@openzeppelin/test-helpers")

describe("Test Option Trading", function() {
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
          admin, lp1, lp2, lp3, lp4, lp5, 
          buyer1, buyer2, buyer3, buyer4, buyer5, buyer6, buyer7
      ] = await ethers.getSigners();

      const OptionPrice = await ethers.getContractFactory("OptionPrice")
      oracle_contract = await OptionPrice.attach("0x2a8cEabFE96Cd8E780c84296AE9a0E100fc12B93");

      const USDC = await ethers.getContractFactory("USDC");
      usd = await USDC.deploy();

      const Optino = await ethers.getContractFactory("Optino")
      optino = await Optino.deploy(usd.address)
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
  it("Simulates a full epoch and rollover", async function() {
    let epoch = await optino.currentEpoch()
    let pre_balance1 = await usd.balanceOf(buyer1.address)
    let pre_balance2 = await usd.balanceOf(buyer2.address)
    await buyOptions(buyer1, calls.six_hours.expiry, calls.six_hours.ten_delta, 100, true);  
    await buyOptions(buyer1, puts.six_hours.expiry, puts.six_hours.ten_delta, 100, false);  

    await buyOptions(buyer2, calls.six_hours.expiry, calls.six_hours.twenty_five_delta, 100, true);  
    await buyOptions(buyer2, puts.six_hours.expiry, puts.six_hours.fifty_delta, 100, false);  

    let post_balance1 = await usd.balanceOf(buyer1.address)
    let post_balance2 = await usd.balanceOf(buyer2.address)

    expect(post_balance1).to.equal((pre_balance1.sub(ethers.BigNumber.from(ether("20").toString()))))
    expect(post_balance2).to.equal((pre_balance2.sub(ethers.BigNumber.from(ether("75").toString()))))

    await time.increaseTo(calls.six_hours.expiry) 
    await optino.connect(admin).resolveExpiredOptions(calls.six_hours.expiry, ether("1750").toString())

    let call_id1 = await option_contract.getOptionTokenId(calls.six_hours.expiry, calls.six_hours.ten_delta, true)
    let put_id1 = await option_contract.getOptionTokenId(puts.six_hours.expiry, puts.six_hours.ten_delta, false)

    let call_id2 = await option_contract.getOptionTokenId(calls.six_hours.expiry, calls.six_hours.twenty_five_delta, true)
    let put_id2 = await option_contract.getOptionTokenId(puts.six_hours.expiry, puts.six_hours.fifty_delta, false)

    await optino.connect(buyer1).exerciseOption(call_id1, 100)
    await expect(
      optino.connect(buyer1).exerciseOption(put_id1, 100)
    ).to.be.revertedWith("Option expired out of the money")

    // try batch exercise
    await optino.connect(buyer2).exerciseBatch([call_id2], [100]);

    let expected_post_exercise_balance1 = post_balance1.add(ether("100").toString())
    let post_exercise_balance1 = await usd.balanceOf(buyer1.address)

    let expected_post_exercise_balance2 = post_balance2.add(ether("100").toString())
    let post_exercise_balance2 = await usd.balanceOf(buyer2.address)

    expect(post_exercise_balance1).to.equal(expected_post_exercise_balance1)
    expect(post_exercise_balance2).to.equal(expected_post_exercise_balance2)

    //
    
    await buyOptions(buyer3, calls.twelve_hours.expiry, calls.twelve_hours.fifty_delta, 100, true);

    await time.increaseTo(calls.twelve_hours.expiry) 
  
    await expect(
      buyOptions(buyer3, calls.twelve_hours.expiry, calls.twelve_hours.fifty_delta, 100, true)
    ).to.be.revertedWith("Option Already Expired")

    await buyOptions(buyer4, calls.twenty_four_hours.expiry, calls.twenty_four_hours.fifty_delta, 100, true);

    await time.increaseTo(calls.twenty_four_hours.expiry)

    await optino.connect(admin).resolveExpiredOptions(calls.twelve_hours.expiry, ether("1755").toString());
    await optino.connect(admin).resolveExpiredOptions(calls.twenty_four_hours.expiry, ether("1749").toString());

    console.log(epoch)
    let new_epoch = await optino.currentEpoch() 
    console.log(new_epoch)
    expect(new_epoch[0] > epoch).to.equal(true)

    let events_resolved_ITM = await optino.filters.OptionResolved(null, true)
    let events_options_purchased = await optino.filters.OptionPurchased()
    console.log()
    let current_block = (await ethers.provider.getBlock("latest")).number
    let rangeStart = current_block - 5000
    console.log( (await optino.queryFilter(events_resolved_ITM, rangeStart)) )
    console.log( (await optino.queryFilter(events_options_purchased, rangeStart)) )


    

  })
})
