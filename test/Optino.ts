import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
const {
    BN,
    constants,
    ether
} = require("@openzeppelin/test-helpers")

describe("Mock USDC", function () {
    var usd: ethers.Contract;
    var user1: ethers.SignerWithAddress;
    beforeEach(async function() {
        [user1] = await ethers.getSigners();
        const USDC = await ethers.getContractFactory("USDC")
        usd = await USDC.deploy()
    })
    it("Should Mint Mock USDC Tokens", async function() {
        await usd.mint(user1.address, ether("1").toString());
        let balance = await usd.balanceOf(user1.address);
        expect(balance).to.equal(ether("1"));

    })
})
// describe("Optino", function () { // // //     describe("Deployment", function() { // 
//     })
// })
//
describe("Optino", function() {
    var optino: ethers.Contract;
    var usd: ethers.Contact;
    var option_contract: ethers.Contract;
    var user1: ethers.SignerWithAddress;
    var buyer1: ethers.SignerWithAddress;
    var user2: ethers.SignerWithAddress;
    var user3: ethers.SignerWithAddress;
    beforeEach(async function() {
        [user1, buyer1, user2, user3] = await ethers.getSigners();
        const USDC = await ethers.getContractFactory("USDC")
        usd = await USDC.deploy();
        const Optino = await ethers.getContractFactory("Optino");
        optino = await Optino.deploy(usd.address);

        const OptionContract = await ethers.getContractFactory("OptionContract")
        const option_contract_address = await optino.OptionCollection();
        option_contract = await OptionContract.attach(option_contract_address);



        //Mint Mock USDC to test user1
        await usd.mint(user1.address, ether("25").toString())
        await usd.mint(buyer1.address, ether("25").toString())
        await usd.mint(user2.address, ether("100").toString())
        await usd.mint(user3.address, ether("150").toString())
    })

    it("Executes liquidityDeposit function", async function() {
        await usd.connect(user1).approve(optino.address, ether("10").toString());
        await optino.connect(user1).liquidityDeposit(ether("5").toString());

        let balance_pool = await usd.balanceOf(optino.address);
        expect(balance_pool).to.equal(ether("5"));


    })
    it("Checks maxContractsAvailable at current price", async function() {
        await usd.connect(user1).approve(optino.address, ether("10").toString());
        await optino.connect(user1).liquidityDeposit(ether("5").toString());

        let max_contracts = await optino.maxContractsAvailable();
        expect(max_contracts).to.equal(10);

        //This part will break when currentPrice method changes
        await optino.setPrice(ether("0.75").toString())
        let max_contracts2 = await optino.maxContractsAvailable();
        expect(max_contracts2).to.equal(20);
        await optino.setPrice(ether("0.30").toString())
        let max_contracts3 = await optino.maxContractsAvailable();
        expect(max_contracts3).to.equal(7);
    })
    it("Tests getOptionCode", async function() {
        let option_code = await option_contract.getOptionCode(23948, 1750, true);
        let option_token_id = await option_contract.getOptionTokenId(23948, 1750, true);
        let option_token_id_js = await ethers.BigNumber.from(option_token_id)
        console.log("Option Code: ", option_code)
        console.log("Option Token Id: ", option_token_id.toString())
        console.log("ethers converted token id: ", option_token_id_js.toString())
        expect(option_token_id.toString()).to.equal(option_token_id_js.toString())
    })
    it("Tests buyOption Function", async function() {
        await usd.connect(user1).approve(optino.address, ether("25").toString())
        await optino.connect(user1).liquidityDeposit(ether("25").toString());

        await usd.connect(buyer1).approve(optino.address, ether("25").toString())
        await optino.connect(buyer1).buyOption(23948, 1750, 50, true)
        let option_token_id = await option_contract.getOptionTokenId(23948, 1750, true);
        let option_balance = await option_contract.balanceOf(buyer1.address, option_token_id);

        expect(option_balance.toString()).to.be.equal("50")
    })
    it("tests liquidityAvailabel balances properly() function", async function() {
        await usd.connect(user1).approve(optino.address, ether("25").toString())
        await optino.connect(user1).liquidityDeposit(ether("25").toString());
        let available_value = await optino.liquidityAvailable()
        expect(available_value).to.equal(ether("25"))
        await usd.connect(buyer1).approve(optino.address, ether("25").toString())
        await optino.connect(buyer1).buyOption(23948, 1750, 50, true)
        let available_value2 = await optino.liquidityAvailable()
        expect(available_value2).to.equal(ether("0"))
    })
    it("test LiquidityDeposit share distribution", async function() {
        await usd.connect(user1).approve(optino.address, ether("25").toString())
        await optino.connect(user1).liquidityDeposit(ether("25").toString())
        let lp_shares = await optino.LPShares();
        const LPShares = await ethers.getContractFactory("OptinoLPShares")
        const lp_shares_instance = await LPShares.attach(lp_shares)
        let lp_share_balance = await lp_shares_instance.balanceOf(user1.address);
        expect(lp_share_balance).to.equal(ether("25"))
        // Second entry 
        
        await usd.connect(user2).approve(optino.address, ether("100").toString())
        await optino.connect(user2).liquidityDeposit(ether("100").toString())
        expect(await lp_shares_instance.balanceOf(user2.address)).to.equal(ether("100"))

        await usd.connect(user3).approve(optino.address, ether("100").toString())
        await optino.connect(user3).liquidityDeposit(ether("50").toString())
        expect(await lp_shares_instance.balanceOf(user2.address)).to.equal(ether("100"))
        
    })

})

describe("Test on LP Share Pricing and distribution", function() {
    var usd: ethers.Contract;
    var optino: ethers.Contract;
    var option_contract: ethers.Contract;
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

    it("Tests supply liquidity mid option period", async function() {
        // Pool Kicks Off
        await usd.connect(lp1).approve(optino.address, ether("50").toString())
        await optino.connect(lp1).liquidityDeposit(ether("50").toString())
        expect(await lp_shares.balanceOf(lp1.address)).to.equal(ether("50").toString())

    })


})
describe("Temporal Tests", function() {
    async function OneDayOptionFixture() {
        const ONE_DAY_IN_SECONDS = 24 * 60 * 60;
        const expiry = (await time.latest()) + ONE_DAY_IN_SECONDS
    }

    var usd: ethers.Contract;
    var optino: ethers.Contract;
    var option_contract: ethers.Contract;
    var admin: ethers.SignerWithAddress;
    var lp1: ethers.SignerWithAddress;
    var buyer1: ethers.SignerWithAddress;
    var expiry: number
    beforeEach(async function() {
        const ONE_DAY_IN_SECONDS = 24 * 60 * 60;
        expiry = (await time.latest()) + ONE_DAY_IN_SECONDS;
        [admin, lp1, buyer1] = await ethers.getSigners();
        const USDC = await ethers.getContractFactory("USDC");
        usd = await USDC.deploy();
        const Optino = await ethers.getContractFactory("Optino")
        optino = await Optino.deploy(usd.address)

        const OptionContract = await ethers.getContractFactory("OptionContract")
        const option_contract_address = await optino.OptionCollection();
        option_contract = await OptionContract.attach(option_contract_address);

        await usd.mint(lp1.address, ether("1000").toString())
        await usd.mint(buyer1.address, ether("1000").toString())

        await usd.connect(lp1).approve(optino.address, ether("100").toString());
        // 100 usdc provided Liquidity
        await optino.connect(lp1).liquidityDeposit(ether("100").toString());
        // 50 Options bought at .5 ==> 25 in premium 25 from liquidity as collateral
        await usd.connect(buyer1).approve(optino.address, ether("100").toString())
        await optino.connect(buyer1).buyOption(expiry, 1750, 50, true);
        // Option Expired
        await time.increaseTo(expiry)


    })

    it("Tests resolveOption Function", async function() {
        await optino.connect(admin).resolveOption(expiry, 1750, true, true);
        let option_token_id = await option_contract.getOptionTokenId(expiry, 1750, true);

        let isITM = await optino.optionExpiredITM(option_token_id)
        console.log(isITM)
        expect(isITM).to.equal(true)
        let realizedLoss = await optino.realizedLoss()
        console.log(ethers.utils.formatEther(realizedLoss))
        expect(realizedLoss).to.equal(ether("50"));
        
        let liquidity_available = await optino.liquidityAvailable()
        expect(liquidity_available).to.equal(ether("75"))

        let pool_collateral = await optino.poolCollateral()
        expect(pool_collateral).to.equal(ether("0"))
        
    })

    it("Tests Excercise Options", async function() {
        await optino.connect(admin).resolveOption(expiry, 1750, true, true);
        let option_token_id = await option_contract.getOptionTokenId(expiry, 1750, true);
        
        await option_contract.connect(buyer1).setApprovalForAll(optino.address, true)
        await optino.connect(buyer1).exerciseOption(option_token_id, 50)
        let buyer_usdc_balance = await usd.balanceOf(buyer1.address)
        // USER Balance 1000 - 25 = 975 --> After win: 975 + 50 = 1025
        expect(buyer_usdc_balance).to.equal(ether("1025"))
    })
    // Check if ITM check returns false prior to expiry
    // 


})
