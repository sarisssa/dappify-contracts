const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("LaunchV3Module", (m) => {
  const tokenLauncher = m.contract("TokenLauncher");
  return { tokenLauncher };
});

const contract = await ethers.getContractAt(
  "TokenLauncher",
  "0xe6827cdA70AA7E7d3D9eB2f28d6c6B75A8C98Cb4"
);

// Helper to get timestamp for dates
const now = Math.floor(Date.now() / 1000);
const oneDay = 24 * 60 * 60;

// Parameters for launching the token with immediate start
const launchParams = {
  name: "Degen Token V2",
  symbol: "DGENV2",
  totalSupply: 10_000_000, // 10 million tokens
  projectName: "Degen Finance V2",
  projectDescription:
    "Revolutionary DeFi platform for the degen community - V2",
  startDate: now, // Starts immediately
  endDate: now + oneDay * 60, // Ends in 60 days
  tokenPrice: hre.ethers.parseEther("0.0001"), // 0.0001 ETH
};

// Call the function to launch the token
let tx = await contract.launchToken(
  launchParams.name,
  launchParams.symbol,
  launchParams.totalSupply,
  launchParams.projectName,
  launchParams.projectDescription,
  launchParams.startDate,
  launchParams.endDate,
  launchParams.tokenPrice
);

// Wait for the transaction to be mined and log the transaction hash
const receipt = await tran.wait();
console.log("Token launched! Transaction hash:", receipt.transactionHash);

// Project ID from your output
let projectId = 1724215706462492266084032522n;

// Calculate cost for 10 tokens at 0.0001 ETH each
let totalCost = hre.ethers.parseEther("0.001"); // 10 * 0.0001 = 0.001 ETH

// Buy tokens
let purchaseTran = await contract.buyTokens(projectId, {
  value: totalCost,
  gasLimit: 500000,
});

// Wait for confirmation
let buyReceipt = await purchaseTran.wait();
console.log("Tokens purchased! Transaction hash:", buyReceipt.transactionHash);
