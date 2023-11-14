import {ethers} from "hardhat";
import {
    CNC_ORACLE_PARAMS,
    CRVUSD_ORACLE_PARAMS,
    CRV_ORACLE_PARAMS,
    CVX_ORACLE_PARAMS,
    DAI_ORACLE_PARAMS,
    FRAX_ORACLE_PARAMS,
    FXS_ORACLE_PARAMS,
    SDT_ORACLE_PARAMS,
    USDC_ORACLE_PARAMS,
    USDT_ORACLE_PARAMS,
    WETH_ORACLE_PARAMS,
} from "../../../resources/oracle_config";
import {
    TOKEN_ADDR_CNC,
    TOKEN_ADDR_CRV,
    TOKEN_ADDR_CRVUSD,
    TOKEN_ADDR_CVX,
    TOKEN_ADDR_DAI,
    TOKEN_ADDR_FRAX,
    TOKEN_ADDR_FXS,
    TOKEN_ADDR_SDT,
    TOKEN_ADDR_USDC,
    TOKEN_ADDR_USDT,
    TOKEN_ADDR_WETH,
} from "../../../resources/tokens/common";
import {IContractsUser} from "../../../utils/contractInterface";
import {AddressLike, parseEther} from "ethers";

export async function deployOracleContract(contractsUsers: IContractsUser, isIbo: boolean): Promise<IContractsUser> {
    const {users, contracts} = contractsUsers;

    const CvgOracleFactory = await ethers.getContractFactory("CvgOracle");

    const cvgOracle = await CvgOracleFactory.deploy();
    await cvgOracle.waitForDeployment();

    //transfer ownership
    await cvgOracle.transferOwnership(users.treasuryDao);
    await cvgOracle.connect(users.treasuryDao).acceptOwnership();

    const tokenOraclized = [
        {token: TOKEN_ADDR_DAI, oracleParams: DAI_ORACLE_PARAMS},
        {token: TOKEN_ADDR_FRAX, oracleParams: FRAX_ORACLE_PARAMS},
        {token: TOKEN_ADDR_WETH, oracleParams: WETH_ORACLE_PARAMS},
        {token: TOKEN_ADDR_CRV, oracleParams: CRV_ORACLE_PARAMS},
        {token: TOKEN_ADDR_CVX, oracleParams: CVX_ORACLE_PARAMS},
        {token: TOKEN_ADDR_FXS, oracleParams: FXS_ORACLE_PARAMS},
        {token: TOKEN_ADDR_SDT, oracleParams: SDT_ORACLE_PARAMS},
        {token: TOKEN_ADDR_CNC, oracleParams: CNC_ORACLE_PARAMS},
        {token: TOKEN_ADDR_USDC, oracleParams: USDC_ORACLE_PARAMS},
        {token: TOKEN_ADDR_CRVUSD, oracleParams: CRVUSD_ORACLE_PARAMS},
        {token: TOKEN_ADDR_USDT, oracleParams: USDT_ORACLE_PARAMS},
    ];

    for (const param of tokenOraclized) {
        await cvgOracle.connect(users.treasuryDao).setTokenOracleParams(param.token, {
            poolType: param.oracleParams.poolType,
            poolAddress: param.oracleParams.poolAddress,
            isReversed: param.oracleParams.isReversed,
            isEthPriceRelated: param.oracleParams.isEthPriceRelated,
            aggregatorOracle: param.oracleParams.aggregatorOracle,
            deltaLimitOracle: param.oracleParams.deltaLimitOracle, // 10% delta error allowed
            twapOrK: param.oracleParams.twapOrK,
            maxLastUpdate: 900000000,
            stablesToCheck: param.oracleParams.stablesToCheck,
            minPrice: 1,
            maxPrice: parseEther("1000000"),
        });
    }

    if (!isIbo) {
        await cvgOracle.connect(users.treasuryDao).setCvg(contracts.tokens.cvg);
        await cvgOracle.connect(users.treasuryDao).setTokenOracleParams(contracts.tokens.cvg, {
            poolType: 3,
            poolAddress: contracts.lp.poolCvgFraxBp,
            isReversed: false,
            isEthPriceRelated: false,
            aggregatorOracle: ethers.ZeroAddress,
            deltaLimitOracle: 1000, // 10% delta error allowed
            twapOrK: 0,
            maxLastUpdate: 800_600_400,
            stablesToCheck: [TOKEN_ADDR_USDC, TOKEN_ADDR_FRAX],
            minPrice: 1,
            maxPrice: parseEther("1000000"),
        });
        await (await contracts.base.cvgControlTower.connect(users.treasuryDao).setOracle(cvgOracle)).wait();
    }

    return {
        users: users,
        contracts: {
            ...contracts,
            bonds: {
                ...contracts.bonds,
                cvgOracle: cvgOracle,
            },
        },
    };
}
