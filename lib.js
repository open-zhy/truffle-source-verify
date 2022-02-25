const { spawn } = require("child_process");

async function verify(contractNames, network, options = {}) {
  const commandOptions = [
    '--network', network,
  ];

  if (options.license) {
    commandOptions.push('--license', options.license)
  }

  if (options.debug) {
    commandOptions.push('--debug')
  }

  if (options.forceConstructorArgs) {
    commandOptions.push('--forceConstructorArgs', options.forceConstructorArgs)
  }

  let explorer;
  if (["mainnet", "rinkeby", "kovan", "ropsten", "goerli"].includes(network)) {
    explorer = "etherscan";
  } else if (["xdai", "sokol"].includes(network)) {
    explorer = "blockscout";
  } else {
    console.error(
      `truffle-source-verify does not support network "${network}"`
    );
    return;
  }
  return new Promise((resolve, reject) => {
    console.log(
      `Verifying ${contractNames.length} contracts on ${explorer}...`
    );
    const cmd = `truffle run ${explorer} ${contractNames.join(
      " "
    )} --network ${network} --license ${license}`;
    const p = spawn("npx", cmd.split(" "), {
      stdio: "inherit",
    });
    console.log(`npx ${cmd}`);
    p.on("exit", (code) => resolve(code));
    p.on("error", (code) => reject(code));
  });
}

module.exports = { verify };
