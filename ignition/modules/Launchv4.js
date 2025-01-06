const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("LaunchV4Module", (m) => {
  const tokenLauncher = m.contract("TokenLauncher");
  return { tokenLauncher };
});

const contract = await ethers.getContractAt(
  "TokenLauncher",
  "0x696C7ED992C6efD0A9f08f24Cf647E284eB29890"
);

// // Helper to get timestamp for dates
// const now = Math.floor(Date.now() / 1000);
// const oneDay = 24 * 60 * 60;
