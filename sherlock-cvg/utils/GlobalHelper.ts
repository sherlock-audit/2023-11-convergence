import {ethers, upgrades} from "hardhat";
import {MerkleTree} from "merkletreejs";
import {time} from "@nomicfoundation/hardhat-network-helpers";
import fs from "fs";
import keccak256 from "keccak256";
import {AddressLike, Signer} from "ethers";

export class GlobalHelper {
    static erc20ArtifactName = "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20";

    static countDecimals(value: number) {
        if (Math.floor(value) === value) return 0;
        return value.toString().split(".")[1].length || 0;
    }

    static priceToBigNumber(number: number, decimals: number) {
        return ethers.parseUnits(number.toString(), decimals);
    }
    static bigNumberFactory(number: number, decimals: number) {
        return BigInt(number) * BigInt(10) ** BigInt(decimals);
    }

    static convertEthersToNumber(bigNumber: bigint) {
        return Number(ethers.formatEther(bigNumber));
    }

    static getProofMerkle(arrayAddress: string[], addressWallet: string) {
        const leafNodes = arrayAddress.map((addr) => keccak256(addr));
        const merkleTree = new MerkleTree(leafNodes, keccak256, {sortPairs: true});
        const rootHash = merkleTree.getRoot();
        const hexString = rootHash.toString("hex");
        const claimingAddress = keccak256(addressWallet);
        return merkleTree.getHexProof(claimingAddress);
    }

    static getRoot = (arrayAddress: string[]) => {
        const leafNodes = arrayAddress.map((addr) => keccak256(addr));
        const merkleTree = new MerkleTree(leafNodes, keccak256, {sortPairs: true});
        const rootHash = merkleTree.getRoot();
        const hexString = rootHash.toString("hex");
        return "0x" + hexString;
    };

    static render_svg(output: string, name: string, pathRender: string) {
        const raw_slice = output.slice(29);
        const decoded_json = atob(raw_slice);
        const json = JSON.parse(decoded_json);
        const image_base64 = json.image;
        let url = image_base64.replace("data:image/svg+xml;base64,", "");
        var svg = decodeURIComponent(escape(atob(url)));
        fs.writeFile(pathRender + `logo_${name}.svg`, svg, function (err) {
            if (err) throw err;
            // console.log("File is created successfully.");
        });
    }

    static calculateStorageSlotEthersSolidity = async (addressKey: string, mappingSlot: number) => {
        const paddedAddress = ethers.zeroPadValue(addressKey, 32);
        const paddedSlot = ethers.zeroPadValue(ethers.toBeHex(mappingSlot), 32);
        const concatenated = ethers.concat([paddedAddress, paddedSlot]);
        const hash = ethers.keccak256(concatenated);
        return hash;
    };

    static calculateStorageSlotEthersVyper = async (addressKey: string, mappingSlot: number) => {
        const paddedSlot = ethers.zeroPadValue(ethers.toBeHex(mappingSlot), 32);
        const paddedAddress = ethers.zeroPadValue(addressKey, 32);
        const concatenated = ethers.concat([paddedSlot, paddedAddress]);
        const hash = ethers.keccak256(concatenated);
        return hash;
    };
}
