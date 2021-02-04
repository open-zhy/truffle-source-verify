// Usage: npx truffle exec ./scripts/test_verify.js --network rinkeby

const { verify } = require("truffle-source-verify/lib");

async function main() {
  const idx = process.argv.indexOf("--network");
  const network = process.argv[idx + 1];
  await verify(["BasicContract"], network);
  console.log("Done");
}

module.exports = (cb) => main().then(cb).catch(cb);
