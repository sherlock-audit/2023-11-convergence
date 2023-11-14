import {ethers} from "hardhat";
import {IContractsUser} from "../../../utils/contractInterface";
import {GlobalHelper} from "../../../utils/GlobalHelper";
import {SdtStakingPositionService} from "../../../typechain-types/contracts/Staking/StakeDAO";
import {deployProxy} from "../../../utils/global/deployProxy";
import {TRANSFER_ERC20} from "../../../resources/signatures";

export async function deployCvgSdtStakingContract(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const {users, contracts} = contractsUsers;
    const cvgControlTower = contracts.base.cvgControlTower;
    const sigWithdraw = TRANSFER_ERC20; //cvgSdt.transfer(msg.sender, amount);
    const cvgSdtAddress = await contracts.tokens.cvgSdt.getAddress();

    const sigParams = "address,address,string,bool,(address,bytes)";
    const params = [await cvgControlTower.getAddress(), cvgSdtAddress, "STK-cvgSDT", false, [cvgSdtAddress, sigWithdraw]];
    const cvgSdtStaking = await deployProxy<SdtStakingPositionService>(sigParams, params, "SdtStakingPositionService", contracts.base.proxyAdmin);

    await (await cvgControlTower.connect(users.treasuryDao).setCvgSdtStaking(cvgSdtStaking)).wait();

    return {
        ...contractsUsers,
        contracts: {
            ...contracts,
            stakeDao: {
                ...contracts.stakeDao,
                cvgSdtStaking: cvgSdtStaking,
            },
        },
    };
}
