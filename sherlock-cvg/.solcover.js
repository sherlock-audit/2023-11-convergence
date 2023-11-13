module.exports = {
  skipFiles: [
    "mocks",
    "PresaleVesting/SeedPresaleCvg.sol",
    "PresaleVesting/Ibo.sol",
    "PresaleVesting/SBT.sol",
    "PresaleVesting/WlPresaleCvg.sol",
    "libs",
    "CvgPepe",
    "poc",
    "Upgradeable",
    "DAO",
  ],
  configureYulOptimizer: true,
  solcOptimizerDetails: {
    peephole: false,
    inliner: false,
    jumpdestRemover: false,
    orderLiterals: true, // <-- TRUE! Stack too deep when false
    deduplicate: false,
    cse: false,
    constantOptimizer: false,
    yul: false,
  },
};
