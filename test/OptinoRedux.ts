import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
const {
    BN,
    constants,
    ether
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
    var lp_shares: ethers.Contract;
    beforeEach(async function() {
        const ONE_DAY_IN_SECONDS = 24 * 60 * 60;
        expiry = (await time.latest()) + ONE_DAY_IN_SECONDS;
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
    it("Sets up Epoch", async function() {
        await usd.connect(lp1).approve(optino.address, ether("50").toString())
        await optino.connect(lp1).liquidityDeposit(ether("50").toString())
        await optino.connect(admin).startNewEpoch();
        let one_day_fifty_delta_strike = (await optino.currentEpoch())[3][3]
        console.log(one_day_fifty_delta_strike.toString())
    })
    
    describe("With Epoch Set and liquidity seeded", function() {
        const getOptions = function(expiry: any) {
            return {
            expiry: expiry[0],
            ten_delta: expiry[1],
            twenty_five_delta: expiry[2],
            fifty_delta: expiry[3]
            }
        }
        const getEpochOptions = async function() {
            let epoch = await optino.currentEpoch()
            return {
                six_hours: getOptions(epoch[1]),
                twelve_hours: getOptions(epoch[2]),
                twenty_four_hours: getOptions(epoch[3])
            }
        }
        beforeEach(async function() {
            await optino.connect(admin).startNewEpoch();
            await usd.connect(lp1).approve(optino.address, ether("50").toString())
            await optino.connect(lp1).liquidityDeposit(ether("50").toString())
        })
        it("Buys an option", async function() {
            await usd.connect(buyer1).approve(optino.address, ether("50").toString())
            let all_options = await getEpochOptions()
            let one_day = all_options.twenty_four_hours;
            await optino.connect(buyer1).buyOption(one_day.expiry, one_day.fifty_delta, 10, true)
            let price = await optino.connect(buyer1).getPrice(one_day.expiry, one_day.fifty_delta, true)
            //console.log((await getEpochOptions()))

        })

    })
})
