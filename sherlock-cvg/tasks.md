npm run clean-contracts && npm run deploy-protocol-local

npx hardhat cvgCycleUpdate --cycle 1 --network localhost

npx hardhat stakeDaoDistribute --network localhost

npx hardhat genInterface --contract <nameContract> (ex: --contract Cvg)

(fill the distribution.json before)
