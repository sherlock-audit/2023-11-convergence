import {ethers} from "hardhat";
import {IContractsUser} from "../../utils/contractInterface";

export async function bedTestSdtStaking(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const users = contractsUsers.users;
    const contracts = contractsUsers.contracts;
    const owner = users.owner;
    const user1 = users.user1;
    const user2 = users.user2;
    const user3 = users.user3;
    const user4 = users.user4;
    const treasuryDao = users.treasuryDao;
    const veSdtMultisig = users.veSdtMultisig;
    const tokens = contracts.tokens;
    const tokensStakeDao = contracts.tokensStakeDao;
    const controlTowerContract = contracts.base.cvgControlTower;

    const lockingPositionServiceContract = contracts.locking.lockingPositionService;
    const gaugeControllerContract = contracts.locking.gaugeController;
    const cvgContract = contracts.tokens.cvg;

    const stakingContracts = contracts.stakeDao.sdAssetsStaking;
    const veSdtContract = contracts.stakeDao.veSdt;

    const cvgSdtStakingContract = contracts.stakeDao.cvgSdtStaking;
    const sdCRVStaking = stakingContracts.sdCRVStaking;
    const sdPENDLEStaking = stakingContracts.sdPENDLEStaking;
    const sdFXSStaking = stakingContracts.sdFXSStaking;
    const sdBALStaking = stakingContracts.sdBALStaking;
    const sdANGLEStaking = stakingContracts.sdANGLEStaking;

    /// @dev create veSDT position for veSdtMultisig (warning here this is a wallet so we can lock,
    /// but in reality the multisig cannot create a lock directly, need to be wl)
    await tokens.sdt.connect(veSdtMultisig).approve(veSdtContract, ethers.MaxUint256);
    const timestamp = (await ethers.provider.getBlock("latest"))?.timestamp;
    const MAX_TIME = 4 * 365 * 86400;
    await veSdtContract.connect(veSdtMultisig).create_lock(ethers.parseEther("1000"), (timestamp as number) + MAX_TIME);
    await tokensStakeDao.sdFrax3Crv.transfer(contracts.stakeDao.feeDistributor, ethers.parseEther("20000"));
    await tokensStakeDao.sdFrax3Crv.connect(veSdtMultisig).approve(contracts.stakeDao.cvgSdtBuffer, ethers.MaxUint256);

    await tokensStakeDao.sdCrv.approve(tokensStakeDao.sdCrvGauge, ethers.MaxUint256);
    await tokensStakeDao.sdBal.approve(tokensStakeDao.sdBalGauge, ethers.MaxUint256);
    await tokensStakeDao.sdAngle.approve(tokensStakeDao.sdAngleGauge, ethers.MaxUint256);
    await tokensStakeDao.sdFxs.approve(tokensStakeDao.sdFxsGauge, ethers.MaxUint256);
    await tokensStakeDao.sdPendle.approve(tokensStakeDao.sdPendleGauge, ethers.MaxUint256);

    await tokensStakeDao.sdCrvGauge["deposit(uint256,address)"](ethers.parseEther("20000000"), user1);
    await tokensStakeDao.sdCrvGauge["deposit(uint256,address)"](ethers.parseEther("20000000"), user2);

    await tokensStakeDao.sdPendleGauge["deposit(uint256,address)"](ethers.parseEther("20000000"), user1);
    await tokensStakeDao.sdPendleGauge["deposit(uint256,address)"](ethers.parseEther("20000000"), user2);

    await tokensStakeDao.sdBalGauge["deposit(uint256,address)"](ethers.parseEther("20000000"), user1);
    await tokensStakeDao.sdBalGauge["deposit(uint256,address)"](ethers.parseEther("20000000"), user2);

    await tokensStakeDao.sdAngleGauge["deposit(uint256,address)"](ethers.parseEther("20000000"), user1);
    await tokensStakeDao.sdAngleGauge["deposit(uint256,address)"](ethers.parseEther("20000000"), user2);

    await tokensStakeDao.sdFxsGauge["deposit(uint256,address)"](ethers.parseEther("20000000"), user1);
    await tokensStakeDao.sdFxsGauge["deposit(uint256,address)"](ethers.parseEther("20000000"), user2);

    // GIVE ASSETS TO OTHER USERS
    await cvgContract.transfer(user1, ethers.parseEther("300000"));
    await cvgContract.transfer(user2, ethers.parseEther("500000"));
    // stake sdCRVGauge
    await tokensStakeDao.sdCrvGauge.connect(user1).approve(sdCRVStaking, ethers.MaxUint256);
    await sdCRVStaking.connect(user1).deposit(0, ethers.parseEther("20000"), ethers.ZeroAddress);

    // stake sdANGLE
    await tokensStakeDao.sdAngleGauge.connect(user2).approve(sdANGLEStaking, ethers.MaxUint256);
    await sdANGLEStaking.connect(user2).deposit(0, ethers.parseEther("15000"), ethers.ZeroAddress);

    const amount10M = ethers.parseEther("10000000");

    // stake sdBALGauge
    await tokensStakeDao.sdBalGauge.connect(user1).approve(sdBALStaking, ethers.MaxUint256);
    await sdBALStaking.connect(user1).deposit(0, amount10M, ethers.ZeroAddress);

    // MINT NFT LOCKING POSITION
    await cvgContract.approve(lockingPositionServiceContract, ethers.parseEther("100000"));
    await cvgContract.connect(user1).approve(lockingPositionServiceContract, ethers.MaxUint256);
    await cvgContract.connect(user2).approve(lockingPositionServiceContract, ethers.MaxUint256);
    await lockingPositionServiceContract.mintPosition(47, ethers.parseEther("100000"), 0, owner, true);
    await lockingPositionServiceContract.connect(user1).mintPosition(95, ethers.parseEther("100000"), 0, user1, true);
    await lockingPositionServiceContract.connect(user1).mintPosition(23, ethers.parseEther("100000") * 2n, 0, user1, true);
    await lockingPositionServiceContract.connect(user2).mintPosition(95, ethers.parseEther("100000") * 4n, 0, user2, true);
    // ADD GAUGE TYPE
    await gaugeControllerContract.connect(treasuryDao).add_type("A", "2");
    await gaugeControllerContract.connect(treasuryDao).add_type("B", "1");
    await gaugeControllerContract.connect(treasuryDao).add_type("C", "3");
    // ADD cvgSDT STAKING CONTRACT AS GAUGE
    await (await controlTowerContract.connect(treasuryDao).toggleStakingContract(cvgSdtStakingContract)).wait();
    await gaugeControllerContract.connect(treasuryDao).add_gauge(cvgSdtStakingContract, 0, 0);
    // ADD sdAssetsGauge STAKING CONTRACTS AS GAUGE
    await gaugeControllerContract.connect(treasuryDao).add_gauge(sdCRVStaking, 0, 0);

    await gaugeControllerContract.connect(treasuryDao).add_gauge(sdANGLEStaking, 0, 0);

    await gaugeControllerContract.connect(treasuryDao).add_gauge(sdFXSStaking, 1, 0);

    await gaugeControllerContract.connect(treasuryDao).add_gauge(sdBALStaking, 1, 0);

    await gaugeControllerContract.connect(treasuryDao).add_gauge(sdPENDLEStaking, 2, 0);

    await gaugeControllerContract
        .connect(treasuryDao)
        .toggle_votes_pause([cvgSdtStakingContract, sdCRVStaking, sdANGLEStaking, sdPENDLEStaking, sdFXSStaking, sdBALStaking]);

    const votesOwner = [
        {
            tokenId: 1,
            votes: [
                {gauge_address: sdCRVStaking, weight: "5000"},
                {gauge_address: cvgSdtStakingContract, weight: "3000"},
                {gauge_address: sdANGLEStaking, weight: "2000"},
            ],
        },
    ];

    await gaugeControllerContract.connect(owner).multi_vote(votesOwner);

    const votesUser1 = [
        {
            tokenId: 2,
            votes: [{gauge_address: sdCRVStaking, weight: "10000"}],
        },
        {
            tokenId: 3,
            votes: [
                {gauge_address: sdBALStaking, weight: "5000"},
                {gauge_address: sdFXSStaking, weight: "5000"},
            ],
        },
    ];

    await gaugeControllerContract.connect(user1).multi_vote(votesUser1);

    const votesUser2 = [
        {
            tokenId: 4,
            votes: [
                {gauge_address: cvgSdtStakingContract, weight: "8000"},
                {gauge_address: sdCRVStaking, weight: "2000"},
            ],
        },
    ];

    await gaugeControllerContract.connect(user2).multi_vote(votesUser2);

    return contractsUsers;
}
