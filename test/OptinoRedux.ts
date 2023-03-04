import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
const {
    BN,
    constants,
    ether,
} = require("@openzeppelin/test-helpers")

describe("Test Complete Flow", function() {
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

        await usd.mint(buyer1.address, ether("100").toString())
        await usd.mint(buyer2.address, ether("100").toString())
        await usd.mint(buyer3.address, ether("100").toString())
        await usd.mint(buyer4.address, ether("100").toString())
        await usd.mint(buyer5.address, ether("100").toString())
        await usd.mint(buyer6.address, ether("100").toString())
        await usd.mint(buyer7.address, ether("100").toString())
    }) 
    // it("Sets up Epoch", async function() {
    //     await usd.connect(lp1).approve(optino.address, ether("50").toString())
    //     await optino.connect(admin).startNewEpoch(startTime);
    //     await optino.connect(lp1).liquidityDeposit(ether("50").toString())
    //     let one_day_fifty_delta_strike = (await optino.currentEpoch())[3][3]
    //     console.log(one_day_fifty_delta_strike.toString())
    // })
    const getLPPoolAccounting = async function() {
      let liquidityAvailable = await optino.liquidityAvailable();
      let poolCollateral = await optino.poolCollateral();
      let realizedLoss = await optino.realizedLoss();

      return {
        liquidityAvailable: liquidityAvailable,
        poolCollateral: poolCollateral,
        realizedLoss: realizedLoss
      }
    }   
    const eth = function(amount: string) {
      return ethers.BigNumber.from(ether(amount).toString())
    }
    describe("With Epoch Set and liquidity seeded", function() {
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
        var all_options;
        var one_day_expiry: any;
        var purchased_strike: any;
        beforeEach(async function() {
            // await optino.connect(admin).startNewEpoch(startTime);
            await usd.connect(lp1).approve(optino.address, ether("50").toString())
            await optino.connect(lp1).liquidityDeposit(ether("50").toString())
        })
        it("Buys an option", async function() {
            await usd.connect(buyer1).approve(optino.address, ether("50").toString())
            all_options = await getEpochOptions()
            one_day_expiry = all_options.twenty_four_hours.expiry;
            purchased_strike = all_options.twenty_four_hours.twenty_five_delta;
            let balance_pre = await usd.balanceOf(buyer1.address)
            // console.log(await optino.getDelta(true, one_day_expiry, purchased_strike))
            console.log(await optino.getPrice(one_day_expiry, purchased_strike, true))
            await optino.connect(buyer1).buyOption(one_day_expiry, purchased_strike, 10, true)
            let balance_post = await usd.balanceOf(buyer1.address);
            let option_cost = balance_pre.sub(balance_post)
            console.log(option_cost)
            let price = await optino.connect(buyer1).getPrice(one_day_expiry, purchased_strike, true)
            console.log();
            let cost_calculated = price.mul(ethers.BigNumber.from("10"))
            // Cost calculated from getPrice() is equal to amount taken from user
            expect(option_cost).to.equal(cost_calculated)
        })

        describe("Options Outstanding", function() {
            var option_purchased: any;
            var liquidityPoolDelta: any;
            var liquidityPoolStart: any;
            beforeEach(async function() {
                
                all_options = await getEpochOptions()
                one_day_expiry = all_options.twenty_four_hours.expiry;
                purchased_strike = all_options.twenty_four_hours.twenty_five_delta;

                liquidityPoolStart = await optino.liquidityAvailable();
                await usd.connect(buyer1).approve(optino.address, ether("50").toString())
                console.log(one_day_expiry, purchased_strike)
                await optino.connect(buyer1).buyOption(one_day_expiry, purchased_strike, 10, true)

                let price = await optino.connect(buyer1).getPrice(one_day_expiry, purchased_strike, true)
                //console.log(ethers.utils.formatEther(price))
                let collateral_per_contract = (ethers.BigNumber.from("1000000000000000000")).sub(price)
                let cost_calculated = price.mul(ethers.BigNumber.from("10"))
                liquidityPoolDelta = collateral_per_contract.mul(ethers.BigNumber.from("10"))
            })
            it("Resolves an outstanding option", async function() {
                await time.increaseTo(one_day_expiry)
                // await optino.connect(admin).resolveOption(one_day_expiry, purchased_strike, true, true)
                await optino.connect(admin).resolveExpiredOptions(one_day_expiry, ether("1715").toString())
                
                let option_token_id = await option_contract.getOptionTokenId(one_day_expiry, purchased_strike, true);
                let isITM = await optino.optionExpiredITM(option_token_id)
                expect(isITM).to.equal(true)

                let realizedLoss = await optino.realizedLoss()
                expect(realizedLoss).to.equal(ether("10"));

                let poolCollateral = await optino.poolCollateral();
                expect(poolCollateral).to.equal(ether("0"))

                let currentLiquidityAvailable = await optino.liquidityAvailable()
                let expected_liquidity = ethers.BigNumber.from(liquidityPoolStart).sub(ethers.BigNumber.from(liquidityPoolDelta));
                expect(expected_liquidity).to.equal(currentLiquidityAvailable)

            })
          
          describe("Outstanding Option is Resolved", function() {
            beforeEach(async function() {
              all_options = await getEpochOptions()
              one_day_expiry = all_options.twenty_four_hours.expiry;
              purchased_strike = all_options.twenty_four_hours.twenty_five_delta;

              await usd.connect(buyer1).approve(optino.address, ether("50").toString())
              console.log(one_day_expiry, purchased_strike)
              // await optino.connect(buyer1).buyOption(one_day_expiry, purchased_strike, 10, true)
              await time.increaseTo(one_day_expiry)
              await optino.connect(admin).resolveExpiredOptions(one_day_expiry, ether("1715").toString())
              console.log( (await getLPPoolAccounting()) )
            })
            it("Exercises A Winning Option", async function() {
              let buyer_usdc_pre_balance = await usd.balanceOf(buyer1.address);
              let option_token_id = await option_contract.getOptionTokenId(one_day_expiry, purchased_strike, true);
              let buyer1_option_balance = await option_contract.balanceOf(buyer1.address, option_token_id)
              console.log(buyer1_option_balance)
              await option_contract.connect(buyer1).setApprovalForAll(optino.address, true);
              await optino.connect(buyer1).exerciseOption(option_token_id, 10);
              let buyer_usdc_post_balance = await usd.balanceOf(buyer1.address)
              expect(buyer_usdc_post_balance).to.equal(buyer_usdc_pre_balance.add(ethers.BigNumber.from(ether("10").toString())))
              console.log( (await getLPPoolAccounting()) )
            })
          }) 
        })
      const approveUSD = async function(user: ethers.Signer, amount: string) {
        await usd.connect(user).approve(optino.address, ether(amount).toString());
      }
      const approveAndLP = async function(user: ethers.Signer, amount: string) {
        await approveUSD(user, amount);
        await optino.connect(user).liquidityDeposit(ether(amount).toString())
      }
      const getAllCalls = async function() {
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
      const buyOptions = async function(
        user: ethers.Signer, exp: ethers.BigNumber, strike: ethers.BigNumber, amount: number, isCall: boolean
      ) {
        await usd.connect(user).approve(optino.address, ether("100").toString())
        await optino.connect(user).buyOption(exp, strike, amount, isCall);
      }
      const resolveOption = async function(option: any, delta: ethers.BigNumber, isCall: boolean, itm: boolean) {
        await optino.connect(admin).resolveOption(option.expiry, delta, isCall, itm)
      }
      describe("LP Accounting", function() {

        beforeEach(async function() {
          // already has lp1 with $50 deposit
          await approveAndLP(lp1, "50");
          await approveAndLP(lp2, "100");
          await approveAndLP(lp3, "100");
          await approveAndLP(lp4, "100");
          await approveAndLP(lp5, "100");
          
        })
        it("Checks LP Share Balances", async function() {
          let lp1_shares_bal = await lp_shares.balanceOf(lp1.address)
          expect(lp1_shares_bal).to.equal(ether("100"))
          let lp2_shares_bal = await lp_shares.balanceOf(lp2.address)
          expect(lp2_shares_bal).to.equal(ether("100"))
          let lp3_shares_bal = await lp_shares.balanceOf(lp3.address)
          expect(lp3_shares_bal).to.equal(ether("100"))
          let lp4_shares_bal = await lp_shares.balanceOf(lp4.address)
          expect(lp4_shares_bal).to.equal(ether("100"))
          let lp5_shares_bal = await lp_shares.balanceOf(lp5.address)
          expect(lp5_shares_bal).to.equal(ether("100"))
        })
        it("Checks LP Accounting", async function() {
          let liq_avail = (await getLPPoolAccounting()).liquidityAvailable
          expect(liq_avail).to.equal(eth("500"))
        })
        it("Checks LP Accounting after options purchased", async function() {
          let calls = await getAllCalls()
          let puts = await getAllPuts()
          let expected_liq_avail = (await getLPPoolAccounting()).liquidityAvailable.sub(eth("90"))
          let expected_collateral = eth("100")
          await buyOptions(buyer1, calls.six_hours.expiry, calls.six_hours.ten_delta, 100, true)

          let pool = await getLPPoolAccounting()
          expect(expected_liq_avail).to.equal(pool.liquidityAvailable)
          expect(expected_collateral).to.equal(pool.poolCollateral)
          console.log(pool)

          let price_25 = await oracle_contract.optionPrice(true, calls.twelve_hours.twenty_five_delta, calls.twelve_hours.expiry)
          let price_25_contract = await optino.getPrice(calls.twelve_hours.expiry, calls.twelve_hours.twenty_five_delta, true)
          console.log(price_25)
          console.log(price_25_contract)
          expected_liq_avail = pool.liquidityAvailable.sub(
            (eth("1").sub(price_25_contract).mul(ethers.BigNumber.from("100")))
          )
          console.log(expected_liq_avail)
          expected_collateral = eth("200")
          await buyOptions(buyer2, calls.twelve_hours.expiry, calls.twelve_hours.twenty_five_delta, 100, true)

          pool = await getLPPoolAccounting()
          console.log(pool)
          expect(expected_liq_avail).to.equal(pool.liquidityAvailable)
          expect(expected_collateral).to.equal(pool.poolCollateral)

          expected_collateral = ether("250")
          let price_50_contract = await optino.getPrice(calls.twenty_four_hours.expiry, calls.twenty_four_hours.fifty_delta, true)
          console.log(price_50_contract)
          expected_liq_avail = pool.liquidityAvailable.sub(
            (eth("1").sub(price_50_contract).mul(ethers.BigNumber.from("50")))
          )
          await buyOptions(buyer3, calls.twenty_four_hours.expiry, calls.twenty_four_hours.fifty_delta, 50, true)
          
          /// Resolve 
          // Advance time to 6 hour expiry
          await time.increaseTo(calls.six_hours.expiry)

          await optino.resolveExpiredOptions(calls.six_hours.expiry, ether("1750").toString())

          // This value is 8 too high
          console.log(
            ethers.utils.formatEther((await optino.getPrice(calls.twelve_hours.expiry, calls.twelve_hours.twenty_five_delta, true)))
          )
          console.log( "LP Value of Options Post: ", (await optino.LPValueOfOptions()) )
          
          let price_10 = await optino.getPrice(calls.six_hours.expiry, calls.six_hours.ten_delta, true)
          console.log("10 delta price: ", ethers.utils.formatEther(price_10))

          let nav = await optino.navByStrike(calls.six_hours.expiry, calls.six_hours.ten_delta, true)
          console.log("Post resolution nav: ", nav)

          let new_lp_equity = await optino.LPEquity()
          console.log(new_lp_equity)

          //let expected_equity = pre_lp_equity.sub(eth("90"))
         //  console.log(expected_equity)

          //expect(new_lp_equity).to.equal(expected_equity)
        })
      })
    })
    
})
