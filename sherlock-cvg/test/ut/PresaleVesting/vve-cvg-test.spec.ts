import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deployPresaleVestingFixture} from "../../fixtures/fixtures";
import {Signer} from "ethers";
import {ERC20} from "../../../typechain-types/@openzeppelin/contracts/token/ERC20";
import {SeedPresaleCvg, WlPresaleCvg, VestingCvg, Ibo} from "../../../typechain-types/contracts/PresaleVesting";
import {Cvg} from "../../../typechain-types/contracts/Token";
import {bedTestIboMinting, bedTestVestingDistributeInitTokens, bedTestVestingMintWlTokens} from "../../Beds/bedTest-vesting";
import {ethers, network} from "hardhat";
import {time} from "@nomicfoundation/hardhat-network-helpers";
import {VveCvgCalculator} from "../../../typechain-types/contracts/Locking/VveCVGCalculator.sol";
import {TREASURY_RUNWAY} from "../../../resources/cvg-mainnet";
chai.use(chaiAsPromised).should();
const expect = chai.expect;

describe("Vve Cvg test", () => {
    let presaleContractSeed: SeedPresaleCvg, presaleContractWl: WlPresaleCvg, vestingContract: VestingCvg, iboContract: Ibo, vveCvgCalculator: VveCvgCalculator;
    let owner: Signer,
        user1: Signer,
        user3: Signer,
        user5: Signer,
        user7: Signer,
        user8: Signer,
        user10: Signer,
        user4: Signer,
        treasuryDao: Signer,
        treasuryAirdrop: Signer;
    let dai: ERC20, frax: ERC20, cvg: Cvg;
    let TEAM: Signer, DAO: Signer;

    let SHARE_VVECVG: bigint, TOTAL_VESTING_SUPPLY_SEED_TEAM: bigint, MAX_SUPPLY_TEAM: bigint;

    let firstSeedOwner: string;
    let OwnerOfTwoSeeds: string;
    let timestampBefore: number;

    async function computeVveCvg(address: string, vestingContract: string, treasuryAirdrop: string) {
        const totalSupply = await cvg.totalSupply();
        const totalVestingSchedules = await cvg.balanceOf(vestingContract);
        const balanceAirdrop = await cvg.balanceOf(treasuryAirdrop);
        const totalEmissions = totalSupply - totalVestingSchedules - balanceAirdrop;
        return (SHARE_VVECVG * totalEmissions * (await computeTotalCvgVestedForSeedAndTeam(address))) / (TOTAL_VESTING_SUPPLY_SEED_TEAM * BigInt(10 ** 4));
    }

    async function computeTotalCvgVestedForSeedAndTeam(address: string) {
        if (address === (await TEAM.getAddress())) {
            return MAX_SUPPLY_TEAM;
        } else {
            const balanceOfTokenSeed = await presaleContractSeed.balanceOf(address);
            let totalCvgValue = BigInt(0);
            for (let index = 0; index < balanceOfTokenSeed; index++) {
                const tokenId = await presaleContractSeed.tokenOfOwnerByIndex(address, index);
                const cvgValue = (await presaleContractSeed.presaleInfoTokenId(tokenId)).cvgAmount;
                totalCvgValue = totalCvgValue + cvgValue;
            }
            return totalCvgValue;
        }
    }

    before(async () => {
        const {contracts, users} = await loadFixture(deployPresaleVestingFixture);

        await bedTestVestingDistributeInitTokens({contracts, users});

        const tokens = contracts.tokens;
        const presaleContracts = contracts.presaleVesting;
        cvg = tokens.cvg;
        presaleContractSeed = presaleContracts.seedPresale;
        presaleContractWl = presaleContracts.wlPresaleCvg;
        vestingContract = presaleContracts.vestingCvg;
        iboContract = presaleContracts.ibo;
        owner = users.owner;
        user1 = users.user1;
        user3 = users.user3;
        user4 = users.user4;

        user5 = users.user5;
        user7 = users.user7;
        user8 = users.user8;
        user4 = users.user4;
        user10 = users.user10;
        user1 = users.user1;
        treasuryDao = users.treasuryDao;
        treasuryAirdrop = users.treasuryAirdrop;
        vveCvgCalculator = contracts.locking.vveCVGCalculator;

        TEAM = user7;
        DAO = user8;

        SHARE_VVECVG = await vveCvgCalculator.SHARE_VVECVG();
        TOTAL_VESTING_SUPPLY_SEED_TEAM = await vveCvgCalculator.TOTAL_VESTING_SUPPLY_SEED_TEAM();
        MAX_SUPPLY_TEAM = await vestingContract.MAX_SUPPLY_TEAM();

        await presaleContractWl.connect(treasuryDao).setSaleState(1);
        await bedTestVestingMintWlTokens({contracts, users});
        await bedTestIboMinting({contracts, users});

        firstSeedOwner = await presaleContractSeed.ownerOf(1);
        OwnerOfTwoSeeds = await presaleContractSeed.ownerOf(2); //this user has tokenId 2 and 4
        timestampBefore = await time.latest();
    });

    it("Success close the sale state of both WL & Presale", async () => {
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [TREASURY_RUNWAY],
        });

        await owner.sendTransaction({
            to: TREASURY_RUNWAY,
            value: ethers.parseEther("1.0"), // Sends exactly 1.0 ether
        });
        await presaleContractSeed.connect(await ethers.getSigner(TREASURY_RUNWAY)).setSaleState(3);
        await network.provider.request({
            method: "hardhat_stopImpersonatingAccount",
            params: [TREASURY_RUNWAY],
        });
        await presaleContractWl.connect(treasuryDao).setSaleState(2);
    });
    it("Success: set/open vesting", async () => {
        await vestingContract.connect(treasuryDao).setVesting(cvg);
        await vestingContract.connect(treasuryDao).openVesting();
    });
    it("Set Team address for vesting", async () => {
        await vestingContract.connect(treasuryDao).setWhitelistTeam(TEAM);
        expect(await vestingContract.whitelistedTeam()).to.be.equal(await TEAM.getAddress());
    });
    it("Before start of vesting vveCvg should be zero", async () => {
        const vveCvgTeam = await vveCvgCalculator.calculateVveCvg(await TEAM.getAddress());
        const vveCvgSeedOne = await vveCvgCalculator.calculateVveCvg(firstSeedOwner);
        const vestingVotingPower = await vveCvgCalculator.vestingVotingPowerPerAddress(await TEAM.getAddress());

        expect(vveCvgTeam).to.be.equal(0);
        expect(vveCvgSeedOne).to.be.equal(0);
        expect(vestingVotingPower).to.be.equal(0);
    });
    //DAY0
    it("Start vesting should compute right amount of vveCvg", async () => {
        expect(await vveCvgCalculator.calculateVveCvg(TEAM)).to.be.eq(
            await computeVveCvg(await TEAM.getAddress(), await vestingContract.getAddress(), await treasuryAirdrop.getAddress())
        );
        expect(await vveCvgCalculator.vestingVotingPowerPerAddress(TEAM)).to.be.eq(
            await computeVveCvg(await TEAM.getAddress(), await vestingContract.getAddress(), await treasuryAirdrop.getAddress())
        );

        expect(await vveCvgCalculator.calculateVveCvg(firstSeedOwner)).to.be.eq(
            await computeVveCvg(firstSeedOwner, await vestingContract.getAddress(), await treasuryAirdrop.getAddress())
        );
        expect(await vveCvgCalculator.vestingVotingPowerPerAddress(firstSeedOwner)).to.be.eq(
            await computeVveCvg(firstSeedOwner, await vestingContract.getAddress(), await treasuryAirdrop.getAddress())
        );

        expect(await vveCvgCalculator.calculateVveCvg(OwnerOfTwoSeeds)).to.be.eq(
            await computeVveCvg(OwnerOfTwoSeeds, await vestingContract.getAddress(), await treasuryAirdrop.getAddress())
        );
        expect(await vveCvgCalculator.vestingVotingPowerPerAddress(OwnerOfTwoSeeds)).to.be.eq(
            await computeVveCvg(OwnerOfTwoSeeds, await vestingContract.getAddress(), await treasuryAirdrop.getAddress())
        );
    });

    it("Calculate vveCvg for a non investor should return 0", async () => {
        const vveCvgUser = await vveCvgCalculator.calculateVveCvg(user1);
        expect(vveCvgUser).to.be.equal("0");
    });

    it("Mid daysBeforeCliff should compute right amount of vveCvg", async () => {
        await time.increase(60 * 86400);

        expect(await vveCvgCalculator.calculateVveCvg(TEAM)).to.be.eq(
            await computeVveCvg(await TEAM.getAddress(), await vestingContract.getAddress(), await treasuryAirdrop.getAddress())
        );
        expect(await vveCvgCalculator.vestingVotingPowerPerAddress(TEAM)).to.be.eq(
            await computeVveCvg(await TEAM.getAddress(), await vestingContract.getAddress(), await treasuryAirdrop.getAddress())
        );

        expect(await vveCvgCalculator.calculateVveCvg(firstSeedOwner)).to.be.eq(
            await computeVveCvg(firstSeedOwner, await vestingContract.getAddress(), await treasuryAirdrop.getAddress())
        );
        expect(await vveCvgCalculator.vestingVotingPowerPerAddress(firstSeedOwner)).to.be.eq(
            await computeVveCvg(firstSeedOwner, await vestingContract.getAddress(), await treasuryAirdrop.getAddress())
        );

        expect(await vveCvgCalculator.calculateVveCvg(OwnerOfTwoSeeds)).to.be.eq(
            await computeVveCvg(OwnerOfTwoSeeds, await vestingContract.getAddress(), await treasuryAirdrop.getAddress())
        );
        expect(await vveCvgCalculator.vestingVotingPowerPerAddress(OwnerOfTwoSeeds)).to.be.eq(
            await computeVveCvg(OwnerOfTwoSeeds, await vestingContract.getAddress(), await treasuryAirdrop.getAddress())
        );
    });

    it("cliffTime for seed should compute right amounts", async () => {
        await time.increase(30 * 86400);

        expect(await vveCvgCalculator.calculateVveCvg(TEAM)).to.be.eq(
            await computeVveCvg(await TEAM.getAddress(), await vestingContract.getAddress(), await treasuryAirdrop.getAddress())
        );
        expect(await vveCvgCalculator.vestingVotingPowerPerAddress(TEAM)).to.be.eq(
            await computeVveCvg(await TEAM.getAddress(), await vestingContract.getAddress(), await treasuryAirdrop.getAddress())
        );

        expect(await vveCvgCalculator.calculateVveCvg(firstSeedOwner)).to.be.eq(
            await computeVveCvg(firstSeedOwner, await vestingContract.getAddress(), await treasuryAirdrop.getAddress())
        );
        expect(await vveCvgCalculator.vestingVotingPowerPerAddress(firstSeedOwner)).to.be.eq(
            await computeVveCvg(firstSeedOwner, await vestingContract.getAddress(), await treasuryAirdrop.getAddress())
        );

        expect(await vveCvgCalculator.calculateVveCvg(OwnerOfTwoSeeds)).to.be.eq(
            await computeVveCvg(OwnerOfTwoSeeds, await vestingContract.getAddress(), await treasuryAirdrop.getAddress())
        );
        expect(await vveCvgCalculator.vestingVotingPowerPerAddress(OwnerOfTwoSeeds)).to.be.eq(
            await computeVveCvg(OwnerOfTwoSeeds, await vestingContract.getAddress(), await treasuryAirdrop.getAddress())
        );
    });
    it("Jump before end of SEED cliff to check amount", async () => {
        await time.increase(29 * 86400);

        expect(await vveCvgCalculator.calculateVveCvg(TEAM)).to.be.eq(
            await computeVveCvg(await TEAM.getAddress(), await vestingContract.getAddress(), await treasuryAirdrop.getAddress())
        );
        expect(await vveCvgCalculator.vestingVotingPowerPerAddress(TEAM)).to.be.eq(
            await computeVveCvg(await TEAM.getAddress(), await vestingContract.getAddress(), await treasuryAirdrop.getAddress())
        );

        expect(await vveCvgCalculator.calculateVveCvg(firstSeedOwner)).to.be.eq(
            await computeVveCvg(firstSeedOwner, await vestingContract.getAddress(), await treasuryAirdrop.getAddress())
        );
        expect(await vveCvgCalculator.vestingVotingPowerPerAddress(firstSeedOwner)).to.be.eq(
            await computeVveCvg(firstSeedOwner, await vestingContract.getAddress(), await treasuryAirdrop.getAddress())
        );

        expect(await vveCvgCalculator.calculateVveCvg(OwnerOfTwoSeeds)).to.be.eq(
            await computeVveCvg(OwnerOfTwoSeeds, await vestingContract.getAddress(), await treasuryAirdrop.getAddress())
        );
        expect(await vveCvgCalculator.vestingVotingPowerPerAddress(OwnerOfTwoSeeds)).to.be.eq(
            await computeVveCvg(OwnerOfTwoSeeds, await vestingContract.getAddress(), await treasuryAirdrop.getAddress())
        );
    });
    it("cliffTime for SEED should finish and compute amounts for TEAM", async () => {
        await time.increase(86400);

        expect(await vveCvgCalculator.calculateVveCvg(TEAM)).to.be.eq(
            await computeVveCvg(await TEAM.getAddress(), await vestingContract.getAddress(), await treasuryAirdrop.getAddress())
        );
        expect(await vveCvgCalculator.vestingVotingPowerPerAddress(TEAM)).to.be.eq(
            await computeVveCvg(await TEAM.getAddress(), await vestingContract.getAddress(), await treasuryAirdrop.getAddress())
        );

        expect(await vveCvgCalculator.calculateVveCvg(firstSeedOwner)).to.be.eq(0);
        expect(await vveCvgCalculator.vestingVotingPowerPerAddress(firstSeedOwner)).to.be.eq(0);

        expect(await vveCvgCalculator.calculateVveCvg(OwnerOfTwoSeeds)).to.be.eq(0);
        expect(await vveCvgCalculator.vestingVotingPowerPerAddress(OwnerOfTwoSeeds)).to.be.eq(0);
    });

    it("cliffTime for SEED should finish and compute amounts for TEAM", async () => {
        await time.increase(59 * 86400);

        expect(await vveCvgCalculator.calculateVveCvg(TEAM)).to.be.eq(
            await computeVveCvg(await TEAM.getAddress(), await vestingContract.getAddress(), await treasuryAirdrop.getAddress())
        );
        expect(await vveCvgCalculator.vestingVotingPowerPerAddress(TEAM)).to.be.eq(
            await computeVveCvg(await TEAM.getAddress(), await vestingContract.getAddress(), await treasuryAirdrop.getAddress())
        );

        expect(await vveCvgCalculator.calculateVveCvg(firstSeedOwner)).to.be.eq(0);
        expect(await vveCvgCalculator.vestingVotingPowerPerAddress(firstSeedOwner)).to.be.eq(0);

        expect(await vveCvgCalculator.calculateVveCvg(OwnerOfTwoSeeds)).to.be.eq(0);
        expect(await vveCvgCalculator.vestingVotingPowerPerAddress(OwnerOfTwoSeeds)).to.be.eq(0);
    });

    it("vveCvg is equal to 0 for everyone", async () => {
        await time.increase(59 * 86400);

        expect(await vveCvgCalculator.calculateVveCvg(TEAM)).to.be.eq(0);
        expect(await vveCvgCalculator.vestingVotingPowerPerAddress(TEAM)).to.be.eq(0);

        expect(await vveCvgCalculator.calculateVveCvg(firstSeedOwner)).to.be.eq(0);
        expect(await vveCvgCalculator.vestingVotingPowerPerAddress(firstSeedOwner)).to.be.eq(0);

        expect(await vveCvgCalculator.calculateVveCvg(OwnerOfTwoSeeds)).to.be.eq(0);
        expect(await vveCvgCalculator.vestingVotingPowerPerAddress(OwnerOfTwoSeeds)).to.be.eq(0);
    });
});
