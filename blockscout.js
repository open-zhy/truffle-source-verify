const axios = require("axios");
const cliLogger = require("cli-logger");
const delay = require("delay");
const fs = require("fs");
const path = require("path");
const querystring = require("querystring");
const { merge } = require("sol-merger");
const { plugins } = require("sol-merger/dist/lib/plugins");

const API_URLS = {
  1: "https://blockscout.com/eth/mainnet/api",
  77: "https://blockscout.com/poa/sokol/api",
  100: "https://blockscout.com/poa/xdai/api",
};

const EXPLORER_URLS = {
  1: "https://blockscout.com/poa/sokol/address",
  77: "https://blockscout.com/poa/sokol/address",
  100: "https://blockscout.com/poa/xdai/address",
};

const VerificationStatus = {
  FAILED: "Fail - Unable to verify",
  VERIFIED: "Verified",
  ALREADY_VERIFIED: "Already verified",
};

const { enforce, enforceOrThrow } = require("./util");
const { version } = require("./package.json");

const logger = cliLogger({ level: "info" });

module.exports = async (config) => {
  const options = parseConfig(config);

  // Set debug logging
  if (config.debug) logger.level("debug");
  logger.debug("DEBUG logging is turned ON");
  logger.debug(`Running truffle-source-verify v${version}`);

  // Verify each contract
  const contractNameAddressPairs = config._.slice(1);

  // Track which contracts failed verification
  const failedContracts = [];
  for (const contractNameAddressPair of contractNameAddressPairs) {
    logger.info(`Verifying ${contractNameAddressPair}`);
    try {
      const [contractName, contractAddress] = contractNameAddressPair.split(
        "@"
      );

      const artifact = getArtifact(contractName, options);

      if (contractAddress) {
        logger.debug(`Custom address ${contractAddress} specified`);
        if (!artifact.networks[`${options.networkId}`]) {
          artifact.networks[`${options.networkId}`] = {};
        }
        artifact.networks[`${options.networkId}`].address = contractAddress;
      }

      let status = await verifyContract(artifact, options);

      if (status === VerificationStatus.FAILED) {
        failedContracts.push(`${contractNameAddressPair}`);
      } else {
        // Add link to verified contract on Blockscout
        const explorerUrl = `${EXPLORER_URLS[options.networkId]}/${
          artifact.networks[`${options.networkId}`].address
        }/contracts`;
        status += `: ${explorerUrl}`;
      }
      logger.info(status);
    } catch (error) {
      logger.error(error.message);
      failedContracts.push(contractNameAddressPair);
    }
    logger.info();
  }

  enforce(
    failedContracts.length === 0,
    `Failed to verify ${
      failedContracts.length
    } contract(s): ${failedContracts.join(", ")}`,
    logger
  );

  logger.info(
    `Successfully verified ${contractNameAddressPairs.length} contract(s).`
  );
};

const parseConfig = (config) => {
  // Truffle handles network stuff, just need to get network_id
  const networkId = config.network_id;
  const apiUrl = API_URLS[networkId];
  enforce(
    apiUrl,
    `No support for network ${config.network} with id ${networkId}`,
    logger
  );

  enforce(config._.length > 1, "No contract name(s) specified", logger);

  const workingDir = config.working_directory;
  const contractsBuildDir = config.contracts_build_directory;
  const solcSettings = config.compilers.solc.settings;

  return {
    apiUrl,
    networkId,
    workingDir,
    contractsBuildDir,
    optimizationUsed: solcSettings.optimizer.enabled ? true : false,
    runs: solcSettings.optimizer.runs,
    evmVersion: solcSettings.evmTarget,
    license: config.license,
  };
};

const getArtifact = (contractName, options) => {
  const artifactPath = path.resolve(
    options.contractsBuildDir,
    `${contractName}.json`
  );

  logger.debug(`Reading artifact file at ${artifactPath}`);
  enforceOrThrow(
    fs.existsSync(artifactPath),
    `Could not find ${contractName} artifact at ${artifactPath}`
  );

  // Stringify + parse to make a deep copy (to avoid bugs with PR #19)
  return JSON.parse(JSON.stringify(require(artifactPath)));
};

const verifyContract = async (artifact, options) => {
  enforceOrThrow(
    artifact.networks && artifact.networks[`${options.networkId}`],
    `No instance of contract ${artifact.contractName} found for network id ${options.networkId}`
  );

  const res = await sendVerifyRequest(artifact, options);
  enforceOrThrow(
    res.data,
    `Failed to connect to verification API at url ${options.apiUrl}`
  );

  if (
    res.data.message
      .toLowerCase()
      .includes(VerificationStatus.ALREADY_VERIFIED.toLowerCase())
  ) {
    return VerificationStatus.ALREADY_VERIFIED;
  }

  enforceOrThrow(res.data.status === "1", res.data.result);
  if (hasSourceCode(res)) return VerificationStatus.VERIFIED;

  const contractAddress = artifact.networks[`${options.networkId}`].address;
  return verificationStatus(contractAddress, options);
};

const sendVerifyRequest = async (artifact, options) => {
  const compilerVersion = extractCompilerVersion(artifact);
  const mergedSource = await fetchMergedSource(artifact, options);

  const postQueries = {
    module: "contract",
    action: "verify",
    addressHash: artifact.networks[`${options.networkId}`].address,
    contractSourceCode: mergedSource,
    name: artifact.contractName,
    compilerVersion,
    optimization: options.optimizationUsed,
    optimizationRuns: options.runs,
    autodetectConstructorArguments: true,
    evmVersion: options.evmVersion || "default",
  };

  // Link libraries as specified in the artifact
  const libraries = artifact.networks[`${options.networkId}`].links || {};
  Object.entries(libraries).forEach(([key, value], i) => {
    logger.debug(`Adding ${key} as a linked library at address ${value}`);
    enforceOrThrow(
      i < 5,
      "Can not link more than 5 libraries with Blockscout API"
    );
    postQueries[`library${i + 1}Name`] = key;
    postQueries[`library${i + 1}Address`] = value;
  });

  try {
    logger.debug("Sending verify request with POST arguments:");
    logger.debug(JSON.stringify(postQueries, null, 2));
    return axios.post(`${options.apiUrl}`, querystring.stringify(postQueries));
  } catch (error) {
    logger.debug(error.message);
    throw new Error(
      `Failed to connect to Blockscout API at url ${options.apiUrl}`
    );
  }
};

const fetchMergedSource = async (artifact, options) => {
  enforceOrThrow(
    fs.existsSync(artifact.sourcePath),
    `Could not find ${artifact.contractName} source file at ${artifact.sourcePath}`
  );

  logger.debug(`Flattening source file ${artifact.sourcePath}`);

  // If a license is provided, we remove all other SPDX-License-Identifiers
  const pluginList = options.license ? [plugins.SPDXLicenseRemovePlugin] : [];
  let mergedSource = await merge(artifact.sourcePath, {
    removeComments: false,
    exportPlugins: pluginList,
  });

  if (options.license) {
    mergedSource = `// SPDX-License-Identifier: ${options.license}\n\n${mergedSource}`;
  }

  // Make sure we don't have multiple SPDX-License-Identifier statements
  enforceOrThrow(
    (mergedSource.match(/SPDX-License-Identifier:/g) || []).length <= 1,
    "Found duplicate SPDX-License-Identifiers in the Solidity code, please provide the correct license with --license <license identifier>"
  );

  return mergedSource;
};

const extractCompilerVersion = (artifact) => {
  const metadata = JSON.parse(artifact.metadata);
  const compilerVersion = `v${metadata.compiler.version}`;
  return compilerVersion;
};

const hasSourceCode = (verificationResult) =>
  verificationResult.data &&
  verificationResult.data.result &&
  verificationResult.data.result.SourceCode &&
  verificationResult.data.result.SourceCode.length > 0;

const verificationStatus = async (address, options) => {
  logger.debug(`Checking status of verification request for ${address}`);
  // Retry API call every second until source code is found
  while (true) {
    await delay(1000);

    try {
      const qs = querystring.stringify({
        module: "contract",
        action: "getsourcecode",
        address,
        ignoreProxy: 1,
      });

      const verificationResult = await axios.get(`${options.apiUrl}?${qs}`);
      if (hasSourceCode(verificationResult)) {
        console.debug(`Contract at ${address} verified`);
        return VerificationStatus.VERIFIED;
      }
    } catch (error) {
      logger.debug(error.message);
      throw new Error(
        `Failed to connect to Etherscan API at url ${options.apiUrl}`
      );
    }
  }
};
