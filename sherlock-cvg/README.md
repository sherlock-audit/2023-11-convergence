# Convergence Finance Hardhat

# Repo archi

- **archive** : Archived contracts & tests already deployed on the mainnet
- **contracts** : Convergence Protocol

  - **interfaces** : Smart Contract interfaces
  - **mock** : Mocked contracts, ONLY FOR TESTING PURPOSE
  - **poc** : POC for Mainnet, ONLY FOR TESTING PURPOSE
  - **utils** : Libraries used in the project
  - Any other folder sorts contracts per feature

- **docs** : Generated doc by _hardhat-docgen_
- **scripts** : Deployment & utility scripts interacting with contracts \*\*DeployHelper.js\*\* containing the deployment script context
- **tasks** : Hardhat tasks
- **technical-docs** : Sequential diagrams & Description of complex functions
- **test** : Unit & Integration testing. **TestHelper** containing the deployment script context
- **utils** : Utility classes & functions

# To run the project

```shell
npm i
```

# To run a local network forking the mainnet :

```shell
npm run mainnet-forking
```

# Test

Unit testing are located in `test` folder.
To run the full test :

```
npm run test
```

Single test:

```shell
npm run test --grep path/to/file
```

Entire folder:

```shell
npm run test --grep path/to/folder/**
```

If you have 15 min in front of you, run the coverage with:

```shell
npm run coverage
```
