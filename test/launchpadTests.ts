import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("TokenLauncher", function () {
  let tokenLauncher: any;
  let owner: SignerWithAddress;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
    const TokenLauncher = await ethers.getContractFactory("TokenLauncher");
    tokenLauncher = await TokenLauncher.deploy();
    await tokenLauncher.waitForDeployment();
  });

  it("Should emit the TokenLaunched event with the correct parameters upon successful token launch", async function () {
    const totalSupply = 1000000;
    const startDate = (await time.latest()) + 3600;
    const endDate = startDate + 30 * 24 * 60 * 60;
    const tokenPrice = ethers.parseEther("0.01");
    const name = "Test Token";
    const symbol = "TTK";
    const projectName = "Test Token Project";
    const projectDescription = "A test token project";

    await expect(
      tokenLauncher.launchToken(
        totalSupply,
        startDate,
        endDate,
        tokenPrice,
        name,
        symbol,
        projectName,
        projectDescription
      )
    )
      .to.emit(tokenLauncher, "TokenLaunched")
      .withArgs(
        (address: string) => address !== ethers.ZeroAddress,
        symbol,
        totalSupply,
        projectName,
        projectDescription,
        startDate,
        endDate,
        tokenPrice,
        owner.address,
        (id: number) => id > 0
      );
  });

  it("Should initialize launched token with the correct parameters", async function () {
    const totalSupply = 1000000;
    const startDate = (await time.latest()) + 3600;
    const endDate = startDate + 30 * 24 * 60 * 60;
    const tokenPrice = ethers.parseEther("0.01");
    const name = "Test Token";
    const symbol = "TTK";
    const projectName = "Test Token Project";
    const projectDescription = "A test token project";

    await tokenLauncher.launchToken(
      totalSupply,
      startDate,
      endDate,
      tokenPrice,
      name,
      symbol,
      projectName,
      projectDescription
    );

    const projects = await tokenLauncher.getAllProjects();
    const latestProject = projects[projects.length - 1];

    const token = await ethers.getContractAt(
      "LaunchedToken",
      latestProject.tokenAddress
    );

    const launchpadBalance = await token.balanceOf(tokenLauncher.getAddress());
    expect(launchpadBalance).to.equal(totalSupply);

    expect(await token.startDate()).to.equal(startDate);
    expect(await token.endDate()).to.equal(endDate);
    expect(await token.tokenPrice()).to.equal(tokenPrice);
    expect(await token.projectName()).to.equal(projectName);
    expect(await token.projectDescription()).to.equal(projectDescription);
    expect(await token.name()).to.equal(name);
    expect(await token.symbol()).to.equal(symbol);
    expect(await token.totalSupply()).to.equal(totalSupply);
    expect(await token.creator()).to.equal(owner.address);
  });

  it("Should store the project with the correct parameters after launching the token", async function () {
    const totalSupply = 1000000;
    const startDate = (await time.latest()) + 3600;
    const endDate = startDate + 30 * 24 * 60 * 60;
    const tokenPrice = ethers.parseEther("0.01");
    const name = "Test Token";
    const symbol = "TTK";
    const projectName = "Test Token Project";
    const projectDescription = "A test token project";

    await tokenLauncher.launchToken(
      totalSupply,
      startDate,
      endDate,
      tokenPrice,
      name,
      symbol,
      projectName,
      projectDescription
    );

    const projects = await tokenLauncher.getAllProjects();
    const latestProject = projects[projects.length - 1];

    expect(latestProject.tokenAddress).to.not.equal(ethers.ZeroAddress);
    expect(latestProject.startDate).to.equal(startDate);
    expect(latestProject.endDate).to.equal(endDate);
    expect(latestProject.tokenPrice).to.equal(tokenPrice);
    expect(latestProject.totalSupply).to.equal(totalSupply);
    expect(latestProject.creator).to.equal(owner.address);
    expect(latestProject.projectName).to.equal(projectName);
    expect(latestProject.projectDescription).to.equal(projectDescription);
  });

  it("Should revert when attempting to launch a token with empty string parameters", async function () {
    const totalSupply = 1000000;
    const startDate = (await time.latest()) + 3600;
    const endDate = startDate + 30 * 24 * 60 * 60;
    const tokenPrice = ethers.parseEther("0.01");
    const name = "";
    const symbol = "";
    const projectName = "";
    const projectDescription = "";

    await expect(
      tokenLauncher.launchToken(
        totalSupply,
        startDate,
        endDate,
        tokenPrice,
        name,
        symbol,
        projectName,
        projectDescription
      )
    ).to.be.revertedWithCustomError(tokenLauncher, "InvalidStringParameters");
  });

  it("Should revert when attempting to launch a token with a start date in the past", async function () {
    const totalSupply = 1000000;
    const startDate = (await time.latest()) - 3600;
    const endDate = startDate + 30 * 24 * 60 * 60;
    const tokenPrice = ethers.parseEther("0.01");
    const name = "Test Token";
    const symbol = "TTK";
    const projectName = "Test Token Project";
    const projectDescription = "A test token project";

    await expect(
      tokenLauncher.launchToken(
        totalSupply,
        startDate,
        endDate,
        tokenPrice,
        name,
        symbol,
        projectName,
        projectDescription
      )
    ).to.be.revertedWithCustomError(tokenLauncher, "StartDateMustBeFuture");
  });

  it("Should revert when attempting to launch a token with an end date before the start date", async function () {
    const totalSupply = 1000000;
    const startDate = (await time.latest()) + 3600;
    const endDate = startDate - 1;
    const tokenPrice = ethers.parseEther("0.01");
    const name = "Test Token";
    const symbol = "TTK";
    const projectName = "Test Token Project";
    const projectDescription = "A test token project";

    await expect(
      tokenLauncher.launchToken(
        totalSupply,
        startDate,
        endDate,
        tokenPrice,
        name,
        symbol,
        projectName,
        projectDescription
      )
    ).to.be.revertedWithCustomError(tokenLauncher, "MinimumDurationNotMet");
  });

  it("Should revert when attempting to launch a token with a duration shorter than the minimum required", async function () {
    const totalSupply = 1000000;
    const startDate = (await time.latest()) + 3600;
    const endDate = startDate + 1 * 24 * 60 * 60;
    const tokenPrice = ethers.parseEther("0.01");
    const name = "Test Token";
    const symbol = "TTK";
    const projectName = "Test Token Project";
    const projectDescription = "A test token project";

    await expect(
      tokenLauncher.launchToken(
        totalSupply,
        startDate,
        endDate,
        tokenPrice,
        name,
        symbol,
        projectName,
        projectDescription
      )
    ).to.be.revertedWithCustomError(tokenLauncher, "MinimumDurationNotMet");
  });

  it("Should revert when attempting to launch a token with a total supply of zero", async function () {
    const totalSupply = 0;
    const startDate = (await time.latest()) + 3600;
    const endDate = startDate + 30 * 24 * 60 * 60;
    const tokenPrice = ethers.parseEther("0.01");
    const name = "Test Token";
    const symbol = "TTK";
    const projectName = "Test Token Project";
    const projectDescription = "A test token project";

    await expect(
      tokenLauncher.launchToken(
        totalSupply,
        startDate,
        endDate,
        tokenPrice,
        name,
        symbol,
        projectName,
        projectDescription
      )
    ).to.be.revertedWithCustomError(tokenLauncher, "InvalidTotalSupply");
  });

  it("Should revert when attempting to launch a token with a token price of zero", async function () {
    const totalSupply = 1000000;
    const startDate = (await time.latest()) + 3600;
    const endDate = startDate + 30 * 24 * 60 * 60;
    const tokenPrice = 0;
    const name = "Test Token";
    const symbol = "TTK";
    const projectName = "Test Token Project";
    const projectDescription = "A test token project";

    await expect(
      tokenLauncher.launchToken(
        totalSupply,
        startDate,
        endDate,
        tokenPrice,
        name,
        symbol,
        projectName,
        projectDescription
      )
    ).to.be.revertedWithCustomError(tokenLauncher, "InvalidTokenPrice");
  });

  it("Should increment project IDs correctly for multiple launches", async function () {
    const baseParams = {
      totalSupply: 1000000,
      startDate: (await time.latest()) + 3600,
      endDate: (await time.latest()) + 3600 + 30 * 24 * 60 * 60,
      tokenPrice: ethers.parseEther("0.01"),
      name: "Test Token",
      symbol: "TTK",
      projectName: "Test Token Project",
      projectDescription: "A test token project",
    };

    await tokenLauncher.launchToken(
      baseParams.totalSupply,
      baseParams.startDate,
      baseParams.endDate,
      baseParams.tokenPrice,
      baseParams.name,
      baseParams.symbol + "1",
      baseParams.projectName,
      baseParams.projectDescription
    );

    await tokenLauncher.launchToken(
      baseParams.totalSupply,
      baseParams.startDate,
      baseParams.endDate,
      baseParams.tokenPrice,
      baseParams.name,
      baseParams.symbol + "2",
      baseParams.projectName,
      baseParams.projectDescription
    );

    const projects = await tokenLauncher.getAllProjects();
    expect(projects.length).to.equal(2);
    expect(projects[0].projectId).to.equal(1);
    expect(projects[1].projectId).to.equal(2);
  });

  describe("Token Allocation", function () {
    let tokenLauncher: any;
    let owner: SignerWithAddress;
    let user1: SignerWithAddress;
    let projectId: number;
    let tokenPrice: bigint;
    let totalSupply: number;

    beforeEach(async function () {
      [owner, user1] = await ethers.getSigners();
      const TokenLauncher = await ethers.getContractFactory("TokenLauncher");
      tokenLauncher = await TokenLauncher.deploy();
      await tokenLauncher.waitForDeployment();

      totalSupply = 1000000;
      const startDate = (await time.latest()) + 3600;
      const endDate = startDate + 30 * 24 * 60 * 60;
      tokenPrice = ethers.parseEther("0.01");

      await tokenLauncher.launchToken(
        totalSupply,
        startDate,
        endDate,
        tokenPrice,
        "Test Token",
        "TTK",
        "Test Project",
        "A test project"
      );

      const projects = await tokenLauncher.getAllProjects();
      projectId = projects[projects.length - 1].projectId;

      await time.increaseTo(startDate + 1);
    });

    it("Should successfully allocate tokens when sending correct ETH amount", async function () {
      const totalSupply = 1000000;
      const startDate = (await time.latest()) + 3600;
      const endDate = startDate + 30 * 24 * 60 * 60;
      const tokenPrice = ethers.parseEther("0.01");
      const name = "Test Token";
      const symbol = "TTK";
      const projectName = "Test Token Project";
      const projectDescription = "A test token project";

      await tokenLauncher.launchToken(
        totalSupply,
        startDate,
        endDate,
        tokenPrice,
        name,
        symbol,
        projectName,
        projectDescription
      );

      const projects = await tokenLauncher.getAllProjects();
      const projectId = projects[0].projectId;

      const ethAmount = ethers.parseEther("1");
      const expectedTokenAmount = ethAmount / tokenPrice;

      await expect(
        tokenLauncher.connect(user1).allocateTokens(projectId, {
          value: ethAmount,
        })
      )
        .to.emit(tokenLauncher, "TokensAllocated")
        .withArgs(projectId, user1.address, expectedTokenAmount, ethAmount);

      const tokenAllocationAmount = await tokenLauncher.tokenAllocations(
        projectId,
        user1.address
      );
      expect(tokenAllocationAmount).to.equal(expectedTokenAmount);
    });

    it("Should update project metadata after multiple allocations", async function () {
      const ethAmount = ethers.parseEther("1");
      const expectedTokenAmount = ethAmount / tokenPrice;

      await tokenLauncher.connect(user1).allocateTokens(projectId, {
        value: ethAmount,
      });

      await tokenLauncher.connect(user1).allocateTokens(projectId, {
        value: ethAmount,
      });

      const projectInfo = await tokenLauncher.getProjectWithUserInfo(
        projectId,
        user1.address
      );

      expect(projectInfo.project.amountRaised).to.equal(ethAmount * BigInt(2));
      expect(projectInfo.project.participantCount).to.equal(1);

      const allocation = await tokenLauncher.tokenAllocations(
        projectId,
        user1.address
      );
      expect(allocation).to.equal(expectedTokenAmount * BigInt(2));
      expect(projectInfo.tokenAllocationAmount).to.equal(
        expectedTokenAmount * BigInt(2)
      );
    });

    it("Should revert when attempting to allocate tokens before sale starts", async function () {
      const startDate = (await time.latest()) + 3600;
      const endDate = startDate + 30 * 24 * 60 * 60;

      await tokenLauncher.launchToken(
        totalSupply,
        startDate,
        endDate,
        tokenPrice,
        "Future Token",
        "FTK",
        "Future Project",
        "A future project"
      );

      const projects = await tokenLauncher.getAllProjects();
      const futureProjectId = projects[projects.length - 1].projectId;

      const ethAmount = ethers.parseEther("1");

      await expect(
        tokenLauncher.connect(user1).allocateTokens(futureProjectId, {
          value: ethAmount,
        })
      ).to.be.revertedWithCustomError(tokenLauncher, "SaleNotStarted");
    });

    it("Should revert when attempting to allocate tokens after sale ends", async function () {
      const projectInfo = await tokenLauncher.getProjectWithUserInfo(
        projectId,
        user1.address
      );
      await time.increaseTo(projectInfo.project.endDate + BigInt(1));

      const ethAmount = ethers.parseEther("1");

      await expect(
        tokenLauncher.connect(user1).allocateTokens(projectId, {
          value: ethAmount,
        })
      ).to.be.revertedWithCustomError(tokenLauncher, "SaleEnded");
    });

    it("Should revert when attempting to allocate tokens with zero ETH", async function () {
      await time.increaseTo((await time.latest()) + 3600 + 1);

      await expect(
        tokenLauncher.connect(user1).allocateTokens(projectId, {
          value: 0,
        })
      ).to.be.revertedWithCustomError(tokenLauncher, "InvalidTokenAmount");
    });

    it("Should revert when attempting to allocate tokens for non-existent project", async function () {
      await time.increaseTo((await time.latest()) + 3600 + 1); // Move past start time
      const nonExistentProjectId = 999;
      const ethAmount = ethers.parseEther("1");

      await expect(
        tokenLauncher.connect(user1).allocateTokens(nonExistentProjectId, {
          value: ethAmount,
        })
      ).to.be.revertedWithCustomError(tokenLauncher, "ProjectNotFound");
    });

    it("Should revert when attempting to allocate more tokens than available", async function () {
      const smallTotalSupply = 1000;
      const currentTime = await time.latest();
      const startDate = currentTime + 3600;
      const endDate = startDate + 30 * 24 * 60 * 60;

      await tokenLauncher.launchToken(
        smallTotalSupply,
        startDate,
        endDate,
        tokenPrice,
        "Small Token",
        "STK",
        "Small Project",
        "A test project with small supply"
      );

      const projects = await tokenLauncher.getAllProjects();
      const smallProjectId = projects[projects.length - 1].projectId;

      await time.increaseTo(startDate + 1);

      const initialAllocation = 900;
      const initialEthAmount = BigInt(initialAllocation) * tokenPrice;

      await tokenLauncher.connect(user1).allocateTokens(smallProjectId, {
        value: initialEthAmount,
      });

      const remainingTokens = 100;
      const excessAmount = 150;
      const ethAmount = BigInt(excessAmount) * tokenPrice;

      await expect(
        tokenLauncher.connect(user1).allocateTokens(smallProjectId, {
          value: ethAmount,
        })
      )
        .to.be.revertedWithCustomError(tokenLauncher, "InsufficientTokens")
        .withArgs(remainingTokens, excessAmount);
    });

    it("Should maintain correct state after failed allocation attempt", async function () {
      await time.increaseTo((await time.latest()) + 3600 + 1); // Move past start time

      const beforeProjectInfo = await tokenLauncher.getProjectWithUserInfo(
        projectId,
        user1.address
      );
      4;
      const beforeAllocation = await tokenLauncher.tokenAllocations(
        projectId,
        user1.address
      );

      await expect(
        tokenLauncher.connect(user1).allocateTokens(projectId, {
          value: 0,
        })
      ).to.be.revertedWithCustomError(tokenLauncher, "InvalidTokenAmount");

      const afterProjectInfo = await tokenLauncher.getProjectWithUserInfo(
        projectId,
        user1.address
      );
      const afterAllocation = await tokenLauncher.tokenAllocations(
        projectId,
        user1.address
      );

      expect(afterProjectInfo.project.amountRaised).to.equal(
        beforeProjectInfo.project.amountRaised
      );
      expect(afterProjectInfo.project.participantCount).to.equal(
        beforeProjectInfo.project.participantCount
      );
      expect(afterAllocation).to.equal(beforeAllocation);
    });
  });

  describe("Token Claim", function () {
    let claimTokenLauncher: any;
    let claimUser: SignerWithAddress;
    let claimProjectId: number;
    let claimTokenPrice: bigint;
    let claimTotalSupply: number;
    let claimTokenAddress: string;
    let claimStartDate: number;
    let claimEndDate: number;

    beforeEach(async function () {
      [claimUser] = await ethers.getSigners();
      const TokenLauncher = await ethers.getContractFactory("TokenLauncher");
      claimTokenLauncher = await TokenLauncher.deploy();
      await claimTokenLauncher.waitForDeployment();

      claimTotalSupply = 1000;
      claimStartDate = (await time.latest()) + 3600;
      claimEndDate = claimStartDate + 30 * 24 * 60 * 60;
      claimTokenPrice = ethers.parseEther("0.0001");

      await claimTokenLauncher.launchToken(
        claimTotalSupply,
        claimStartDate,
        claimEndDate,
        claimTokenPrice,
        "Test Token",
        "TTK",
        "Test Project",
        "A test project"
      );

      const projects = await claimTokenLauncher.getAllProjects();
      claimProjectId = projects[projects.length - 1].projectId;
      claimTokenAddress = projects[projects.length - 1].tokenAddress;
    });

    it("Should allow user to claim allocated tokens after sale ends", async function () {
      await time.increaseTo(claimStartDate + 1);
      const targetRaise = BigInt(claimTotalSupply) * claimTokenPrice;
      await claimTokenLauncher
        .connect(claimUser)
        .allocateTokens(claimProjectId, {
          value: targetRaise,
        });

      await time.increaseTo(claimEndDate + 1);

      const expectedTokenAmount = targetRaise / claimTokenPrice;
      const token = await ethers.getContractAt(
        "LaunchedToken",
        claimTokenAddress
      );

      const beforeBalance = await token.balanceOf(claimUser.address);

      await expect(
        claimTokenLauncher.connect(claimUser).claimTokens(claimProjectId)
      )
        .to.emit(claimTokenLauncher, "TokensClaimed")
        .withArgs(claimProjectId, claimUser.address, expectedTokenAmount);

      const afterBalance = await token.balanceOf(claimUser.address);
      expect(afterBalance - beforeBalance).to.equal(expectedTokenAmount);
    });

    it("Should clear user allocation after successful claim", async function () {
      await time.increaseTo(claimStartDate + 1);
      const targetRaise = BigInt(claimTotalSupply) * claimTokenPrice;
      await claimTokenLauncher
        .connect(claimUser)
        .allocateTokens(claimProjectId, {
          value: targetRaise,
        });

      await time.increaseTo(claimEndDate + 1);

      await claimTokenLauncher.connect(claimUser).claimTokens(claimProjectId);

      const userAllocationAmount = await claimTokenLauncher.tokenAllocations(
        claimProjectId,
        claimUser.address
      );
      expect(userAllocationAmount).to.equal(0);
    });

    it("Should allow multiple users to claim their tokens", async function () {
      const [_, claimUser1, claimUser2] = await ethers.getSigners();
      const targetRaise = BigInt(claimTotalSupply) * claimTokenPrice;
      const perUserAmount = targetRaise / BigInt(2);
      const expectedTokenAmount = perUserAmount / claimTokenPrice;
      const token = await ethers.getContractAt(
        "LaunchedToken",
        claimTokenAddress
      );

      await time.increaseTo(claimStartDate + 1);

      await claimTokenLauncher
        .connect(claimUser1)
        .allocateTokens(claimProjectId, {
          value: perUserAmount,
        });
      await claimTokenLauncher
        .connect(claimUser2)
        .allocateTokens(claimProjectId, {
          value: perUserAmount,
        });

      await time.increaseTo(claimEndDate + 1);

      await claimTokenLauncher.connect(claimUser1).claimTokens(claimProjectId);
      await claimTokenLauncher.connect(claimUser2).claimTokens(claimProjectId);

      expect(await token.balanceOf(claimUser1.address)).to.equal(
        expectedTokenAmount
      );
      expect(await token.balanceOf(claimUser2.address)).to.equal(
        expectedTokenAmount
      );
    });

    it("Should revert when attempting to claim for non-existent project", async function () {
      const nonExistentProjectId = 999;
      await time.increaseTo(claimEndDate + 1);

      await expect(
        claimTokenLauncher.connect(claimUser).claimTokens(nonExistentProjectId)
      ).to.be.revertedWithCustomError(claimTokenLauncher, "ProjectNotFound");
    });

    it("Should revert when attempting to claim tokens before sale ends", async function () {
      await time.increaseTo(claimStartDate + 1);
      const targetRaise = BigInt(claimTotalSupply) * claimTokenPrice;
      await claimTokenLauncher
        .connect(claimUser)
        .allocateTokens(claimProjectId, {
          value: targetRaise,
        });

      await expect(
        claimTokenLauncher.connect(claimUser).claimTokens(claimProjectId)
      ).to.be.revertedWithCustomError(claimTokenLauncher, "SaleNotEnded");
    });

    it("Should revert when attempting to claim tokens when target raise not met", async function () {
      await time.increaseTo(claimStartDate + 1);
      const partialRaise =
        (BigInt(claimTotalSupply) * claimTokenPrice) / BigInt(2);
      await claimTokenLauncher
        .connect(claimUser)
        .allocateTokens(claimProjectId, {
          value: partialRaise,
        });

      await time.increaseTo(claimEndDate + 1);

      await expect(
        claimTokenLauncher.connect(claimUser).claimTokens(claimProjectId)
      ).to.be.revertedWithCustomError(claimTokenLauncher, "TargetRaiseNotMet");
    });

    it("Should revert when attempting to claim tokens without allocation", async function () {
      await time.increaseTo(claimStartDate + 1);
      const targetRaise = BigInt(claimTotalSupply) * claimTokenPrice;
      const [_, otherUser] = await ethers.getSigners();

      await claimTokenLauncher
        .connect(otherUser)
        .allocateTokens(claimProjectId, {
          value: targetRaise,
        });

      await time.increaseTo(claimEndDate + 1);

      await expect(
        claimTokenLauncher.connect(claimUser).claimTokens(claimProjectId)
      ).to.be.revertedWithCustomError(claimTokenLauncher, "NoTokensToClaim");
    });

    it("Should revert when attempting to claim tokens twice", async function () {
      await time.increaseTo(claimStartDate + 1);
      const targetRaise = BigInt(claimTotalSupply) * claimTokenPrice;
      await claimTokenLauncher
        .connect(claimUser)
        .allocateTokens(claimProjectId, {
          value: targetRaise,
        });

      await time.increaseTo(claimEndDate + 1);

      await claimTokenLauncher.connect(claimUser).claimTokens(claimProjectId);

      await expect(
        claimTokenLauncher.connect(claimUser).claimTokens(claimProjectId)
      ).to.be.revertedWithCustomError(claimTokenLauncher, "NoTokensToClaim");
    });
  });

  describe("Token Refund", function () {});

  describe("Withdraw Funds", function () {});
});
