# truffle-source-verify

This truffle plugin allows you to automatically verify your smart contracts' source code on Etherscan/Blockscout, straight from the Truffle CLI.

It extends [truffle-plugin-verify](https://github.com/rkalis/truffle-plugin-verify) to also support Blockscout.

## Installation

1. Install the plugin with npm or yarn
   ```
   npm i -D truffle-source-verify
   ```
2. Add the plugin to your `truffle-config.js` file

   ```js
   module.exports = {
     /* ... rest of truffle-config */

     plugins: ["truffle-source-verify"],
   };
   ```

3. Generate an API Key on your Etherscan account (see the [Etherscan website](https://etherscan.io/apis))
4. Add your Etherscan API key to your truffle config (make sure to use something like `dotenv` so you don't commit the api key)

   ```js
   module.exports = {
     /* ... rest of truffle-config */

     api_keys: {
       etherscan: "MY_API_KEY",
     },
   };
   ```

## Usage

Before running verification, make sure that you have actually deployed your contracts to a public network with Truffle.

To verify your contracts on Etherscan, run:

```
truffle run etherscan SomeContractName AnotherContractName --network networkName [--debug]
```

Supported networks: `mainnet`, `kovan`, `rinkeby`, `ropsten`, `goerli`.

To verify your contracts on Blockscout, run:

```
truffle run blockscout SomeContractName AnotherContractName --network networkName --license UNLICENSED [--debug]
```

Supported networks: `mainnet`, `xdai`, `sokol`.

See [truffle-plugin-verify](https://github.com/rkalis/truffle-plugin-verify) for more information.
