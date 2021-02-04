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

### On the command-line

Before running verification, make sure that you have actually deployed your contracts to a public network with Truffle.

To verify your contracts on Etherscan, run:

```
npx truffle run etherscan SomeContractName AnotherContractName --network networkName [--debug]
```

Supported networks: `mainnet`, `kovan`, `rinkeby`, `ropsten`, `goerli`.

To verify your contracts on Blockscout, run:

```
npx truffle run blockscout SomeContractName AnotherContractName --network networkName --license UNLICENSED [--debug]
```

Supported networks: `mainnet`, `xdai`, `sokol`.

See [truffle-plugin-verify](https://github.com/rkalis/truffle-plugin-verify) for more information.

### In Javascript

```
// file: ./scripts/test_verify.js
// Usage: npx truffle exec ./scripts/test_verify.js --network rinkeby

const { verify } = require("truffle-source-verify/lib");

async function main() {
  const idx = process.argv.indexOf("--network");
  const network = process.argv[idx + 1];
  await verify(["BasicContract"], network, "UNLICENSED");
}

module.exports = (cb) => main().then(cb).catch(cb);
```
