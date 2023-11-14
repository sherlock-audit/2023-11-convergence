import {ethers} from "hardhat";
import {IContractsUser} from "../../../utils/contractInterface";
import {SdtBlackHole} from "../../../typechain-types/contracts/Rewards/StakeDAO/SdtBlackHole.sol";
import {GlobalHelper} from "../../../utils/GlobalHelper";
import {deployProxy} from "../../../utils/global/deployProxy";
import {WITHDRAW_SDT_BLACKHOLE} from "../../../resources/signatures";

export async function deploySdtBlackHole(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const {users, contracts} = contractsUsers;
    const cvgControlTower = contractsUsers.contracts.base.cvgControlTower;
    const cloneFactory = contractsUsers.contracts.base.cloneFactory;

    const sigParams = "address";
    const params = [await cvgControlTower.getAddress()];
    const sdtBlackHole = await deployProxy<SdtBlackHole>(sigParams, params, "SdtBlackHole", contracts.base.proxyAdmin);

    await (await cvgControlTower.connect(users.treasuryDao).setSdtBlackHole(sdtBlackHole)).wait();

    const withdrawCallInfo = {
        addr: await sdtBlackHole.getAddress(),
        signature: WITHDRAW_SDT_BLACKHOLE, //sdtBlackHole.withdraw(msg.sender, amount);
    };

    await (await cloneFactory.connect(users.treasuryDao).setWithdrawCallInfo(withdrawCallInfo)).wait();

    return {
        ...contractsUsers,
        contracts: {
            ...contracts,
            stakeDao: {
                ...contracts.stakeDao,
                sdtBlackHole: sdtBlackHole,
            },
        },
    };
}
