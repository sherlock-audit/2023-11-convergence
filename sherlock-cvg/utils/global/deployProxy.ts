import {AddressLike} from "ethers";
import {ethers, upgrades} from "hardhat";

export async function deployProxy<T>(
    sigParams: string,
    params: any[],
    interfaceString: string,
    adminAddress: AddressLike,
    isCheckValidate = true,
    baseContractAddress: null | AddressLike = null
): Promise<T> {
    let contractImplementationAddress = baseContractAddress;
    if (isCheckValidate) {
        await upgrades.validateImplementation(await ethers.getContractFactory(interfaceString));
    }
    if (baseContractAddress === null) {
        const contractImplementation = await ethers.deployContract(interfaceString, []);
        await contractImplementation.waitForDeployment();
        contractImplementationAddress = await contractImplementation.getAddress();
    }
    //proxy
    let data;
    if (params.length) {
        const abi = [`function initialize(${sigParams})`];
        const iface = new ethers.Interface(abi);
        data = iface.encodeFunctionData("initialize", params);
    } else {
        data = [];
    }
    const proxy = await ethers.deployContract("TransparentUpgradeableProxy", [contractImplementationAddress, adminAddress, data]);
    await proxy.waitForDeployment();

    return (await ethers.getContractAt(interfaceString, proxy)) as unknown as Promise<T>;
}
