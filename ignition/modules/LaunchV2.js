const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("LaunchV2Module", (m) => {
  const tokenLauncher = m.contract("TokenLauncher");
  return { tokenLauncher };
});
