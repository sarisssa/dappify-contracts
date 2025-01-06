const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("LaunchModule", (m) => {
  const tokenLauncher = m.contract("TokenLauncher");
  return { tokenLauncher };
});
