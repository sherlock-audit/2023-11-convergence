import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers, network} from "hardhat";
import {Signer} from "ethers";
import {deployPresaleVestingFixture} from "../../fixtures/fixtures";
import {bedTestVestingDistributeInitTokens} from "../../Beds/bedTest-vesting";
import {Ibo, SeedPresaleCvg, VestingCvg, WlPresaleCvg} from "../../../typechain-types/contracts/PresaleVesting";
import {Cvg} from "../../../typechain-types/contracts/Token";
import {GlobalHelper} from "../../../utils/GlobalHelper";
import {ERC20} from "../../../typechain-types/@openzeppelin/contracts/token/ERC20";

describe("Presale Wl", () => {
    let presaleContractSeed: SeedPresaleCvg, presaleContractWl: WlPresaleCvg, vestingContract: VestingCvg, iboContract: Ibo;
    let owner: Signer, user1: Signer, user3: Signer, user5: Signer, user7: Signer, user8: Signer, user4: Signer, user10: Signer;
    let treasuryDao: Signer;
    let dai: ERC20, frax: ERC20, cvg: Cvg;
    let wlAddressesS: string[], wlAddressesM: string[], wlAddressesL: string[];

    before(async () => {
        let {contracts, users} = await loadFixture(deployPresaleVestingFixture);

        await bedTestVestingDistributeInitTokens({contracts, users});

        const tokens = contracts.tokens;
        const presaleContracts = contracts.presaleVesting;
        dai = tokens.dai;
        cvg = tokens.cvg;
        presaleContractSeed = presaleContracts.seedPresale;
        presaleContractWl = presaleContracts.wlPresaleCvg;
        vestingContract = presaleContracts.vestingCvg;
        iboContract = presaleContracts.ibo;
        wlAddressesS = presaleContracts.wl.S_wlAddresses;
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
    });
    it("invest with user 7 before start of presale should revert", async () => {
        const merkleProof7 = GlobalHelper.getProofMerkle(wlAddressesS, await user7.getAddress());
        await expect(presaleContractWl.connect(user7).investMint(merkleProof7, ethers.parseEther("200"), true, 2)).to.be.revertedWith("PRESALE_NOT_STARTED");
    });
    it("go to OVER state presale wl", async () => {
        await presaleContractWl.connect(treasuryDao).setSaleState(2);
    });
    it("invest with user 7 when presale is OVER should revert", async () => {
        const merkleProof7 = GlobalHelper.getProofMerkle(wlAddressesS, await user7.getAddress());
        await expect(presaleContractWl.connect(user7).investMint(merkleProof7, ethers.parseEther("200"), true, 2)).to.be.revertedWith("PRESALE_ROUND_FINISHED");
    });

    it("START presale wl", async () => {
        await presaleContractWl.connect(treasuryDao).setSaleState(1);
    });

    it("invest with user 7 before start of presale should revert", async () => {
        const merkleProof7 = GlobalHelper.getProofMerkle(wlAddressesS, await user7.getAddress());
        await expect(presaleContractWl.connect(user7).investMint(merkleProof7, "0", true, 2)).to.be.revertedWith("INVALID_AMOUNT");
    });
    it("invest with user 7 with wrong proof should revert", async () => {
        const merkleProof7 = GlobalHelper.getProofMerkle(wlAddressesS, await user8.getAddress());
        await expect(presaleContractWl.connect(user7).investMint(merkleProof7, ethers.parseEther("200"), true, 2)).to.be.revertedWith("INVALID_PROOF");
    });
    it("invest with user 7 with less than min amount should revert", async () => {
        const merkleProof7 = GlobalHelper.getProofMerkle(wlAddressesS, await user7.getAddress());
        await expect(presaleContractWl.connect(user7).investMint(merkleProof7, ethers.parseEther("100"), true, 2)).to.be.revertedWith("INSUFFICIENT_AMOUNT");
    });
    it("invest with user 7 with more than max amount should revert", async () => {
        const merkleProof7 = GlobalHelper.getProofMerkle(wlAddressesS, await user7.getAddress());
        await expect(presaleContractWl.connect(user7).investMint(merkleProof7, ethers.parseEther("900"), true, 2)).to.be.revertedWith("TOO_MUCH_Q_WL");
    });

    it("invest with user 7 should compute right infos", async () => {
        const merkleProof7 = GlobalHelper.getProofMerkle(wlAddressesS, await user7.getAddress());
        await presaleContractWl.connect(user7).investMint(merkleProof7, ethers.parseEther("200"), true, 2);
        const presaleInfo = await presaleContractWl.presaleInfos(1);
        expect(presaleInfo.vestingType).to.be.equal("2");
        expect(presaleInfo.cvgAmount).to.be.equal("909090909090909090909");
        expect(presaleInfo.stableInvested).to.be.equal("200000000000000000000");
    });
    it("check infos", async () => {
        const tokenIds = await presaleContractWl.getTokenIdsForWallet(await user7.getAddress());
        const tokenIdAndType = await presaleContractWl.getTokenIdAndType(await user7.getAddress(), 0);
        const remainingCvgSupply = await presaleContractWl.getAmountCvgForVesting();
        expect(tokenIds[0]).to.be.equal("1");
        expect(tokenIdAndType[0]).to.be.equal("1");
        expect(tokenIdAndType[1]).to.be.equal("2");
        expect(remainingCvgSupply).to.be.equal("909090909090909090909");
    });
    it("re-invest with user 7 should revert", async () => {
        const merkleProof7 = GlobalHelper.getProofMerkle(wlAddressesS, await user7.getAddress());
        await expect(presaleContractWl.connect(user7).investMint(merkleProof7, ethers.parseEther("200"), true, 2)).to.be.revertedWith("ALREADY_MINTED");
    });

    it("refill with wrong owner should revert", async () => {
        await expect(presaleContractWl.connect(user8).refillToken(1, ethers.parseEther("100"), true)).to.be.revertedWith("NOT_OWNED");
    });

    it("refill with more than the max amount should revert", async () => {
        await expect(presaleContractWl.connect(user7).refillToken(1, ethers.parseEther("700"), true)).to.be.revertedWith("TOO_MUCH_Q_WL");
    });

    it("refill with max allocation remaining should compute right infos", async () => {
        await presaleContractWl.connect(user7).refillToken(1, ethers.parseEther("570"), true);
        const presaleInfo = await presaleContractWl.presaleInfos(1);
        expect(presaleInfo.vestingType).to.be.equal("2");
        expect(presaleInfo.cvgAmount).to.be.equal("3499999999999999999999");
        expect(presaleInfo.stableInvested).to.be.equal("770000000000000000000");
    });
    it("refill one more time should revert", async () => {
        await expect(presaleContractWl.connect(user7).refillToken(1, ethers.parseEther("100"), true)).to.be.revertedWith("TOO_MUCH_Q_WL");
    });
    it("withdraw all dai balance", async () => {
        expect(await dai.balanceOf(presaleContractWl)).to.be.equal("770000000000000000000");
        await presaleContractWl.connect(treasuryDao).withdrawToken(dai);
        expect(await dai.balanceOf(presaleContractWl)).to.be.equal("0");
        expect(await dai.balanceOf(treasuryDao)).to.be.equal("770000000000000000000");
    });
    it("set merkle root should compute right infos", async () => {
        await presaleContractWl.connect(treasuryDao).setMerkleRootWl(ethers.ZeroHash, 1);
    });
    it("set baseURI should compute right infos", async () => {
        await presaleContractWl.connect(treasuryDao).setBaseURI("");
        expect(await presaleContractWl.tokenURI(1)).to.be.equal("");
    });
});
