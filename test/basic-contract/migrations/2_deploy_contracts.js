const BasicContract = artifacts.require("BasicContract");

module.exports = function (deployer) {
  deployer.deploy(BasicContract, 3);
};
