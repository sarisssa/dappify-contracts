import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("TokenLauncher", function () {
  async function deployTokenLauncherFixture() {
    const [owner, user1, user2] = await ethers.getSigners();
    const TokenLauncher = await ethers.getContractFactory("TokenLauncher");
    const tokenLauncher = await TokenLauncher.deploy();
    await tokenLauncher.waitForDeployment();

    return { tokenLauncher, owner, user1, user2 };
  }

  async function launchedTokenFixture() {
    const { tokenLauncher, owner, user1, user2 } =
      await deployTokenLauncherFixture();

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
    const projectId = projects[projects.length - 1].projectId;
    const tokenAddress = projects[projects.length - 1].tokenAddress;

    return {
      tokenLauncher,
      owner,
      user1,
      user2,
      projectId,
      tokenAddress,
      totalSupply,
      startDate,
      endDate,
      tokenPrice,
      name,
      symbol,
      projectName,
      projectDescription,
    };
  }
  async function smallSupplyTokenFixture() {
    const { tokenLauncher, owner, user1, user2 } =
      await deployTokenLauncherFixture();

    const totalSupply = 1000;
    const startDate = (await time.latest()) + 3600;
    const endDate = startDate + 30 * 24 * 60 * 60;
    const tokenPrice = ethers.parseEther("0.01");
    const name = "Small Token";
    const symbol = "STK";
    const projectName = "Small Project";
    const projectDescription = "A test project with small supply";

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
    const projectId = projects[projects.length - 1].projectId;
    const tokenAddress = projects[projects.length - 1].tokenAddress;

    return {
      tokenLauncher,
      owner,
      user1,
      user2,
      projectId,
      tokenAddress,
      totalSupply,
      startDate,
      endDate,
      tokenPrice,
      name,
      symbol,
      projectName,
      projectDescription,
    };
  }

  it("Should emit the TokenLaunched event with the correct parameters upon successful token launch", async function () {
    const { tokenLauncher, owner } = await loadFixture(
      deployTokenLauncherFixture
    );

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
    const {
      tokenLauncher,
      owner,
      tokenAddress,
      totalSupply,
      startDate,
      endDate,
      tokenPrice,
      name,
      symbol,
      projectName,
      projectDescription,
    } = await loadFixture(launchedTokenFixture);

    const token = await ethers.getContractAt("LaunchedToken", tokenAddress);
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
    const {
      tokenLauncher,
      owner,
      tokenAddress,
      totalSupply,
      startDate,
      endDate,
      tokenPrice,
      projectName,
      projectDescription,
    } = await loadFixture(launchedTokenFixture);

    const projects = await tokenLauncher.getAllProjects();
    const latestProject = projects[projects.length - 1];

    expect(latestProject.tokenAddress).to.equal(tokenAddress);
    expect(latestProject.startDate).to.equal(startDate);
    expect(latestProject.endDate).to.equal(endDate);
    expect(latestProject.tokenPrice).to.equal(tokenPrice);
    expect(latestProject.totalSupply).to.equal(totalSupply);
    expect(latestProject.creator).to.equal(owner.address);
    expect(latestProject.projectName).to.equal(projectName);
    expect(latestProject.projectDescription).to.equal(projectDescription);
  });

  it("Should revert when attempting to launch a token with empty string parameters", async function () {
    const { tokenLauncher } = await loadFixture(deployTokenLauncherFixture);

    const totalSupply = 1000000;
    const startDate = (await time.latest()) + 3600;
    const endDate = startDate + 30 * 24 * 60 * 60;
    const tokenPrice = ethers.parseEther("0.01");

    await expect(
      tokenLauncher.launchToken(
        totalSupply,
        startDate,
        endDate,
        tokenPrice,
        "",
        "",
        "",
        ""
      )
    ).to.be.revertedWithCustomError(tokenLauncher, "InvalidStringParameters");
  });

  it("Should revert when attempting to launch a token with a start date in the past", async function () {
    const { tokenLauncher, totalSupply, endDate, tokenPrice } =
      await loadFixture(launchedTokenFixture);

    const pastStartDate = (await time.latest()) - 3600;

    await expect(
      tokenLauncher.launchToken(
        totalSupply,
        pastStartDate,
        endDate,
        tokenPrice,
        "Test Token",
        "TTK",
        "Test Token Project",
        "A test token project"
      )
    ).to.be.revertedWithCustomError(tokenLauncher, "StartDateMustBeFuture");
  });
  it("Should revert when attempting to launch a token with an end date before the start date", async function () {
    const { tokenLauncher, totalSupply, startDate, tokenPrice } =
      await loadFixture(launchedTokenFixture);

    const invalidEndDate = startDate - 1;

    await expect(
      tokenLauncher.launchToken(
        totalSupply,
        startDate,
        invalidEndDate,
        tokenPrice,
        "Test Token",
        "TTK",
        "Test Token Project",
        "A test token project"
      )
    ).to.be.revertedWithCustomError(tokenLauncher, "MinimumDurationNotMet");
  });

  it("Should revert when attempting to launch a token with a duration shorter than the minimum required", async function () {
    const { tokenLauncher, totalSupply, startDate, tokenPrice } =
      await loadFixture(launchedTokenFixture);

    const shortEndDate = startDate + 1 * 24 * 60 * 60; // Only 1 day duration

    await expect(
      tokenLauncher.launchToken(
        totalSupply,
        startDate,
        shortEndDate,
        tokenPrice,
        "Test Token",
        "TTK",
        "Test Token Project",
        "A test token project"
      )
    ).to.be.revertedWithCustomError(tokenLauncher, "MinimumDurationNotMet");
  });
  it("Should revert when attempting to launch a token with a total supply of zero", async function () {
    const { tokenLauncher, startDate, endDate, tokenPrice } = await loadFixture(
      launchedTokenFixture
    );

    await expect(
      tokenLauncher.launchToken(
        0,
        startDate,
        endDate,
        tokenPrice,
        "Test Token",
        "TTK",
        "Test Token Project",
        "A test token project"
      )
    ).to.be.revertedWithCustomError(tokenLauncher, "InvalidTotalSupply");
  });

  it("Should revert when attempting to launch a token with a token price of zero", async function () {
    const { tokenLauncher, totalSupply, startDate, endDate } =
      await loadFixture(launchedTokenFixture);

    await expect(
      tokenLauncher.launchToken(
        totalSupply,
        startDate,
        endDate,
        0,
        "Test Token",
        "TTK",
        "Test Token Project",
        "A test token project"
      )
    ).to.be.revertedWithCustomError(tokenLauncher, "InvalidTokenPrice");
  });

  it("Should increment project IDs correctly for multiple launches", async function () {
    const {
      tokenLauncher,
      totalSupply,
      startDate,
      endDate,
      tokenPrice,
      name,
      symbol,
      projectName,
      projectDescription,
    } = await loadFixture(launchedTokenFixture);

    await tokenLauncher.launchToken(
      totalSupply,
      startDate,
      endDate,
      tokenPrice,
      name,
      symbol + "1",
      projectName,
      projectDescription
    );

    await tokenLauncher.launchToken(
      totalSupply,
      startDate,
      endDate,
      tokenPrice,
      name,
      symbol + "2",
      projectName,
      projectDescription
    );

    const projects = await tokenLauncher.getAllProjects();
    expect(projects.length).to.equal(3); // Original + 2 new launches
    expect(projects[0].projectId).to.equal(1);
    expect(projects[1].projectId).to.equal(2);
    expect(projects[2].projectId).to.equal(3);
  });

  describe("Token Allocation", function () {
    it("Should successfully allocate tokens when sending correct ETH amount", async function () {
      const { tokenLauncher, user1, projectId, startDate, tokenPrice } =
        await loadFixture(launchedTokenFixture);

      await time.increaseTo(startDate + 1);

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
      const { tokenLauncher, user1, projectId, startDate, tokenPrice } =
        await loadFixture(launchedTokenFixture);

      await time.increaseTo(startDate + 1);

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
      const { tokenLauncher, user1, projectId } = await loadFixture(
        launchedTokenFixture
      );

      const ethAmount = ethers.parseEther("1");

      await expect(
        tokenLauncher.connect(user1).allocateTokens(projectId, {
          value: ethAmount,
        })
      ).to.be.revertedWithCustomError(tokenLauncher, "SaleNotStarted");
    });

    it("Should revert when attempting to allocate tokens after sale ends", async function () {
      const { tokenLauncher, user1, projectId, endDate } = await loadFixture(
        launchedTokenFixture
      );

      await time.increaseTo(endDate + 1);
      const ethAmount = ethers.parseEther("1");

      await expect(
        tokenLauncher.connect(user1).allocateTokens(projectId, {
          value: ethAmount,
        })
      ).to.be.revertedWithCustomError(tokenLauncher, "SaleEnded");
    });

    it("Should revert when attempting to allocate tokens with zero ETH", async function () {
      const { tokenLauncher, user1, projectId, startDate } = await loadFixture(
        launchedTokenFixture
      );

      await time.increaseTo(startDate + 1);

      await expect(
        tokenLauncher.connect(user1).allocateTokens(projectId, {
          value: 0,
        })
      ).to.be.revertedWithCustomError(tokenLauncher, "InvalidTokenAmount");
    });

    it("Should revert when attempting to allocate tokens with zero ETH", async function () {
      const { tokenLauncher, user1, projectId, startDate } = await loadFixture(
        launchedTokenFixture
      );

      await time.increaseTo(startDate + 1);

      await expect(
        tokenLauncher.connect(user1).allocateTokens(projectId, {
          value: 0,
        })
      ).to.be.revertedWithCustomError(tokenLauncher, "InvalidTokenAmount");
    });

    it("Should revert when attempting to allocate tokens for non-existent project", async function () {
      const { tokenLauncher, user1, startDate } = await loadFixture(
        launchedTokenFixture
      );

      await time.increaseTo(startDate + 1);
      const nonExistentProjectId = 999;
      const ethAmount = ethers.parseEther("1");

      await expect(
        tokenLauncher.connect(user1).allocateTokens(nonExistentProjectId, {
          value: ethAmount,
        })
      ).to.be.revertedWithCustomError(tokenLauncher, "ProjectNotFound");
    });

    it("Should revert when attempting to allocate more tokens than available", async function () {
      const { tokenLauncher, user1, startDate, tokenPrice } = await loadFixture(
        smallSupplyTokenFixture
      );

      await time.increaseTo(startDate + 1);

      // First allocation
      const initialAllocation = 900;
      const initialEthAmount = BigInt(initialAllocation) * tokenPrice;
      await tokenLauncher.connect(user1).allocateTokens(1, {
        value: initialEthAmount,
      });

      // Try to allocate more tokens than remaining
      const remainingTokens = 100;
      const excessAmount = 150;
      const ethAmount = BigInt(excessAmount) * tokenPrice;

      await expect(
        tokenLauncher.connect(user1).allocateTokens(1, {
          value: ethAmount,
        })
      )
        .to.be.revertedWithCustomError(tokenLauncher, "InsufficientTokens")
        .withArgs(remainingTokens, excessAmount);
    });

    it("Should maintain correct state after failed allocation attempt", async function () {
      const { tokenLauncher, user1, projectId, startDate } = await loadFixture(
        launchedTokenFixture
      );

      await time.increaseTo(startDate + 1);

      const beforeProjectInfo = await tokenLauncher.getProjectWithUserInfo(
        projectId,
        user1.address
      );
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
    it("Should allow user to claim allocated tokens after sale ends", async function () {
      const {
        tokenLauncher,
        user1,
        projectId,
        tokenAddress,
        startDate,
        endDate,
        tokenPrice,
        totalSupply,
      } = await loadFixture(smallSupplyTokenFixture);

      await time.increaseTo(startDate + 1);
      const targetRaise = BigInt(totalSupply) * tokenPrice;
      await tokenLauncher.connect(user1).allocateTokens(projectId, {
        value: targetRaise,
      });

      await time.increaseTo(endDate + 1);

      const expectedTokenAmount = targetRaise / tokenPrice;
      const token = await ethers.getContractAt("LaunchedToken", tokenAddress);
      const beforeBalance = await token.balanceOf(user1.address);

      await expect(tokenLauncher.connect(user1).claimTokens(projectId))
        .to.emit(tokenLauncher, "TokensClaimed")
        .withArgs(projectId, user1.address, expectedTokenAmount);

      const afterBalance = await token.balanceOf(user1.address);
      expect(afterBalance - beforeBalance).to.equal(expectedTokenAmount);
    });

    it("Should clear user allocation after successful claim", async function () {
      const {
        tokenLauncher,
        user1,
        projectId,
        startDate,
        endDate,
        tokenPrice,
        totalSupply,
      } = await loadFixture(smallSupplyTokenFixture);

      await time.increaseTo(startDate + 1);
      const targetRaise = BigInt(totalSupply) * tokenPrice;
      await tokenLauncher.connect(user1).allocateTokens(projectId, {
        value: targetRaise,
      });

      await time.increaseTo(endDate + 1);
      await tokenLauncher.connect(user1).claimTokens(projectId);

      const userAllocationAmount = await tokenLauncher.tokenAllocations(
        projectId,
        user1.address
      );
      expect(userAllocationAmount).to.equal(0);
    });

    it("Should allow multiple users to claim their tokens", async function () {
      const {
        tokenLauncher,
        user1,
        user2,
        projectId,
        tokenAddress,
        startDate,
        endDate,
        tokenPrice,
        totalSupply,
      } = await loadFixture(smallSupplyTokenFixture);

      await time.increaseTo(startDate + 1);
      const targetRaise = BigInt(totalSupply) * tokenPrice;
      const perUserAmount = targetRaise / BigInt(2);
      const expectedTokenAmount = perUserAmount / tokenPrice;

      await tokenLauncher.connect(user1).allocateTokens(projectId, {
        value: perUserAmount,
      });
      await tokenLauncher.connect(user2).allocateTokens(projectId, {
        value: perUserAmount,
      });

      await time.increaseTo(endDate + 1);
      const token = await ethers.getContractAt("LaunchedToken", tokenAddress);

      await tokenLauncher.connect(user1).claimTokens(projectId);
      await tokenLauncher.connect(user2).claimTokens(projectId);

      expect(await token.balanceOf(user1.address)).to.equal(
        expectedTokenAmount
      );
      expect(await token.balanceOf(user2.address)).to.equal(
        expectedTokenAmount
      );
    });

    it("Should revert when attempting to claim for non-existent project", async function () {
      const { tokenLauncher, user1, endDate } = await loadFixture(
        smallSupplyTokenFixture
      );

      await time.increaseTo(endDate + 1);
      const nonExistentProjectId = 999;

      await expect(
        tokenLauncher.connect(user1).claimTokens(nonExistentProjectId)
      ).to.be.revertedWithCustomError(tokenLauncher, "ProjectNotFound");
    });

    it("Should revert when attempting to claim tokens before sale ends", async function () {
      const {
        tokenLauncher,
        user1,
        projectId,
        startDate,
        tokenPrice,
        totalSupply,
      } = await loadFixture(smallSupplyTokenFixture);

      await time.increaseTo(startDate + 1);
      const targetRaise = BigInt(totalSupply) * tokenPrice;
      await tokenLauncher.connect(user1).allocateTokens(projectId, {
        value: targetRaise,
      });

      await expect(
        tokenLauncher.connect(user1).claimTokens(projectId)
      ).to.be.revertedWithCustomError(tokenLauncher, "SaleNotEnded");
    });

    it("Should revert when attempting to claim tokens when target raise not met", async function () {
      const {
        tokenLauncher,
        user1,
        projectId,
        startDate,
        endDate,
        tokenPrice,
        totalSupply,
      } = await loadFixture(smallSupplyTokenFixture);

      await time.increaseTo(startDate + 1);
      const partialRaise = (BigInt(totalSupply) * tokenPrice) / BigInt(2);
      await tokenLauncher.connect(user1).allocateTokens(projectId, {
        value: partialRaise,
      });

      await time.increaseTo(endDate + 1);

      await expect(
        tokenLauncher.connect(user1).claimTokens(projectId)
      ).to.be.revertedWithCustomError(tokenLauncher, "TargetRaiseNotMet");
    });

    it("Should revert when attempting to claim tokens without allocation", async function () {
      const {
        tokenLauncher,
        user1,
        user2,
        projectId,
        startDate,
        endDate,
        tokenPrice,
        totalSupply,
      } = await loadFixture(smallSupplyTokenFixture);

      await time.increaseTo(startDate + 1);
      const targetRaise = BigInt(totalSupply) * tokenPrice;

      await tokenLauncher.connect(user2).allocateTokens(projectId, {
        value: targetRaise,
      });

      await time.increaseTo(endDate + 1);

      await expect(
        tokenLauncher.connect(user1).claimTokens(projectId)
      ).to.be.revertedWithCustomError(tokenLauncher, "NoTokensToClaim");
    });

    it("Should revert when attempting to claim tokens twice", async function () {
      const {
        tokenLauncher,
        user1,
        projectId,
        startDate,
        endDate,
        tokenPrice,
        totalSupply,
      } = await loadFixture(smallSupplyTokenFixture);

      await time.increaseTo(startDate + 1);
      const targetRaise = BigInt(totalSupply) * tokenPrice;
      await tokenLauncher.connect(user1).allocateTokens(projectId, {
        value: targetRaise,
      });

      await time.increaseTo(endDate + 1);
      await tokenLauncher.connect(user1).claimTokens(projectId);

      await expect(
        tokenLauncher.connect(user1).claimTokens(projectId)
      ).to.be.revertedWithCustomError(tokenLauncher, "NoTokensToClaim");
    });
  });

  describe("Token Refund", function () {
    it("Should allow user to refund tokens when sale fails to meet target", async function () {
      const {
        tokenLauncher,
        user1,
        projectId,
        startDate,
        endDate,
        tokenPrice,
        totalSupply,
      } = await loadFixture(smallSupplyTokenFixture);

      await time.increaseTo(startDate + 1);
      const partialAmount = (BigInt(totalSupply) * tokenPrice) / BigInt(2);
      await tokenLauncher.connect(user1).allocateTokens(projectId, {
        value: partialAmount,
      });

      await time.increaseTo(endDate + 1);

      const beforeBalance = await ethers.provider.getBalance(user1.address);
      const tx = await tokenLauncher.connect(user1).refundTokens(projectId);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const afterBalance = await ethers.provider.getBalance(user1.address);
      expect(afterBalance + gasUsed - beforeBalance).to.equal(partialAmount);
    });

    it("Should clear user allocation after a successful refund", async function () {
      const {
        tokenLauncher,
        user1,
        projectId,
        startDate,
        endDate,
        tokenPrice,
        totalSupply,
      } = await loadFixture(smallSupplyTokenFixture);

      await time.increaseTo(startDate + 1);
      const partialAmount = (BigInt(totalSupply) * tokenPrice) / BigInt(2);
      await tokenLauncher.connect(user1).allocateTokens(projectId, {
        value: partialAmount,
      });

      await time.increaseTo(endDate + 1);
      await tokenLauncher.connect(user1).refundTokens(projectId);

      const allocation = await tokenLauncher.tokenAllocations(
        projectId,
        user1.address
      );
      expect(allocation).to.equal(0);
    });

    it("Should update project amountRaised after refund", async function () {
      const {
        tokenLauncher,
        user1,
        projectId,
        startDate,
        endDate,
        tokenPrice,
        totalSupply,
      } = await loadFixture(smallSupplyTokenFixture);

      await time.increaseTo(startDate + 1);
      const partialAmount = (BigInt(totalSupply) * tokenPrice) / BigInt(2);
      await tokenLauncher.connect(user1).allocateTokens(projectId, {
        value: partialAmount,
      });

      await time.increaseTo(endDate + 1);

      const beforeProject = await tokenLauncher.getProjectWithUserInfo(
        projectId,
        user1.address
      );
      await tokenLauncher.connect(user1).refundTokens(projectId);
      const afterProject = await tokenLauncher.getProjectWithUserInfo(
        projectId,
        user1.address
      );

      expect(afterProject.project.amountRaised).to.equal(
        beforeProject.project.amountRaised - partialAmount
      );
    });

    it("Should revert when attempting to refund before minimum duration", async function () {
      const {
        tokenLauncher,
        user1,
        projectId,
        startDate,
        tokenPrice,
        totalSupply,
      } = await loadFixture(smallSupplyTokenFixture);

      await time.increaseTo(startDate + 1);
      const partialAmount = (BigInt(totalSupply) * tokenPrice) / BigInt(2);
      await tokenLauncher.connect(user1).allocateTokens(projectId, {
        value: partialAmount,
      });

      // Attempt refund before MIN_DURATION (30 days) has passed
      await time.increaseTo(startDate + 25 * 24 * 60 * 60); // Only 25 days

      await expect(
        tokenLauncher.connect(user1).refundTokens(projectId)
      ).to.be.revertedWithCustomError(tokenLauncher, "RefundTooEarly");
    });

    it("Should revert when attempting to refund from a successful sale", async function () {
      const {
        tokenLauncher,
        user1,
        projectId,
        startDate,
        tokenPrice,
        totalSupply,
      } = await loadFixture(smallSupplyTokenFixture);

      await time.increaseTo(startDate + 1);
      const fullAmount = BigInt(totalSupply) * tokenPrice;
      await tokenLauncher.connect(user1).allocateTokens(projectId, {
        value: fullAmount,
      });

      // Move past minimum duration
      await time.increaseTo(startDate + 31 * 24 * 60 * 60);

      await expect(
        tokenLauncher.connect(user1).refundTokens(projectId)
      ).to.be.revertedWithCustomError(tokenLauncher, "TargetRaiseAchieved");
    });

    it("Should revert when attempting to refund without allocation", async function () {
      const { tokenLauncher, user1, projectId, startDate } = await loadFixture(
        smallSupplyTokenFixture
      );

      // Move past minimum duration
      await time.increaseTo(startDate + 31 * 24 * 60 * 60);

      await expect(
        tokenLauncher.connect(user1).refundTokens(projectId)
      ).to.be.revertedWithCustomError(tokenLauncher, "NoTokensToRefund");
    });

    it("Should revert when attempting to refund for a non-existent project", async function () {
      const { tokenLauncher, user1, startDate } = await loadFixture(
        smallSupplyTokenFixture
      );

      await time.increaseTo(startDate + 31 * 24 * 60 * 60);
      const nonExistentProjectId = 999;

      await expect(
        tokenLauncher.connect(user1).refundTokens(nonExistentProjectId)
      ).to.be.revertedWithCustomError(tokenLauncher, "ProjectNotFound");
    });

    it("Should revert when attempting to refund twice", async function () {
      const {
        tokenLauncher,
        user1,
        projectId,
        startDate,
        tokenPrice,
        totalSupply,
      } = await loadFixture(smallSupplyTokenFixture);

      await time.increaseTo(startDate + 1);
      const partialAmount = (BigInt(totalSupply) * tokenPrice) / BigInt(2);
      await tokenLauncher.connect(user1).allocateTokens(projectId, {
        value: partialAmount,
      });

      await time.increaseTo(startDate + 31 * 24 * 60 * 60);

      await tokenLauncher.connect(user1).refundTokens(projectId);

      await expect(
        tokenLauncher.connect(user1).refundTokens(projectId)
      ).to.be.revertedWithCustomError(tokenLauncher, "NoTokensToRefund");
    });
  });

  describe("Withdraw Funds", function () {
    it("Should allow creator to withdraw funds after successful sale", async function () {
      const {
        tokenLauncher,
        owner,
        projectId,
        startDate,
        tokenPrice,
        totalSupply,
      } = await loadFixture(smallSupplyTokenFixture);

      await time.increaseTo(startDate + 1);
      const targetRaise = BigInt(totalSupply) * tokenPrice;

      // Fund the sale
      await tokenLauncher.connect(owner).allocateTokens(projectId, {
        value: targetRaise,
      });

      // Move past sale end date
      await time.increaseTo(startDate + 31 * 24 * 60 * 60);

      const beforeBalance = await ethers.provider.getBalance(owner.address);
      const tx = await tokenLauncher.connect(owner).withdrawFunds(projectId);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const expectedCreatorAmount = (targetRaise * BigInt(99)) / BigInt(100); // CREATOR_FEE_NUMERATOR / LAUNCHPAD_FEE_DENOMINATOR
      const afterBalance = await ethers.provider.getBalance(owner.address);

      expect(afterBalance + gasUsed - beforeBalance).to.equal(
        expectedCreatorAmount
      );
    });

    it("Should emit CreatorWithdraw event with correct values", async function () {
      const {
        tokenLauncher,
        owner,
        projectId,
        startDate,
        tokenPrice,
        totalSupply,
      } = await loadFixture(smallSupplyTokenFixture);

      await time.increaseTo(startDate + 1);
      const targetRaise = BigInt(totalSupply) * tokenPrice;
      await tokenLauncher.connect(owner).allocateTokens(projectId, {
        value: targetRaise,
      });

      await time.increaseTo(startDate + 31 * 24 * 60 * 60);

      const expectedCreatorAmount = (targetRaise * BigInt(99)) / BigInt(100);
      const expectedLaunchpadFee = targetRaise - expectedCreatorAmount;

      await expect(tokenLauncher.connect(owner).withdrawFunds(projectId))
        .to.emit(tokenLauncher, "CreatorWithdraw")
        .withArgs(
          projectId,
          owner.address,
          expectedCreatorAmount,
          expectedLaunchpadFee
        );
    });

    it("Should mark project as withdrawn after a successful withdrawal", async function () {
      const {
        tokenLauncher,
        owner,
        projectId,
        startDate,
        tokenPrice,
        totalSupply,
      } = await loadFixture(smallSupplyTokenFixture);

      await time.increaseTo(startDate + 1);
      const targetRaise = BigInt(totalSupply) * tokenPrice;
      await tokenLauncher.connect(owner).allocateTokens(projectId, {
        value: targetRaise,
      });

      await time.increaseTo(startDate + 31 * 24 * 60 * 60);
      await tokenLauncher.connect(owner).withdrawFunds(projectId);

      const projectInfo = await tokenLauncher.getProjectWithUserInfo(
        projectId,
        owner.address
      );
      expect(projectInfo.project.hasCreatorWithdrawn).to.be.true;
    });
    it("Should revert when attempting to withdraw from a non-existent project", async function () {
      const { tokenLauncher, owner } = await loadFixture(
        smallSupplyTokenFixture
      );

      const nonExistentProjectId = 999;

      await expect(
        tokenLauncher.connect(owner).withdrawFunds(nonExistentProjectId)
      )
        .to.be.revertedWithCustomError(tokenLauncher, "ProjectNotFound")
        .withArgs(nonExistentProjectId);
    });

    it("Should revert with NotProjectCreator when non-creator attempts to withdraw", async function () {
      const {
        tokenLauncher,
        owner,
        user1,
        projectId,
        startDate,
        endDate,
        tokenPrice,
        totalSupply,
      } = await loadFixture(smallSupplyTokenFixture);

      // Fund the project to meet target raise
      await time.increaseTo(startDate + 1);
      const targetRaise = BigInt(totalSupply) * tokenPrice;
      await tokenLauncher.connect(user1).allocateTokens(projectId, {
        value: targetRaise,
      });

      await time.increaseTo(endDate + 1);

      // User1 attempts to withdraw instead of owner (creator)
      await expect(tokenLauncher.connect(user1).withdrawFunds(projectId))
        .to.be.revertedWithCustomError(tokenLauncher, "NotProjectCreator")
        .withArgs(user1.address, owner.address);
    });

    it("Should revert when attempting to withdraw before target raise is met", async function () {
      const {
        tokenLauncher,
        owner,
        projectId,
        startDate,
        tokenPrice,
        totalSupply,
      } = await loadFixture(smallSupplyTokenFixture);

      await time.increaseTo(startDate + 1);
      const partialRaise = (BigInt(totalSupply) * tokenPrice) / BigInt(2);
      await tokenLauncher.connect(owner).allocateTokens(projectId, {
        value: partialRaise,
      });

      await time.increaseTo(startDate + 31 * 24 * 60 * 60);

      const targetRaise = BigInt(totalSupply) * tokenPrice;
      await expect(tokenLauncher.connect(owner).withdrawFunds(projectId))
        .to.be.revertedWithCustomError(tokenLauncher, "TargetRaiseNotMet")
        .withArgs(partialRaise, targetRaise);
    });

    it("Should revert when attempting to withdraw twice", async function () {
      const {
        tokenLauncher,
        owner,
        projectId,
        startDate,
        tokenPrice,
        totalSupply,
      } = await loadFixture(smallSupplyTokenFixture);

      await time.increaseTo(startDate + 1);
      const targetRaise = BigInt(totalSupply) * tokenPrice;
      await tokenLauncher.connect(owner).allocateTokens(projectId, {
        value: targetRaise,
      });

      await time.increaseTo(startDate + 31 * 24 * 60 * 60);
      await tokenLauncher.connect(owner).withdrawFunds(projectId);

      await expect(
        tokenLauncher.connect(owner).withdrawFunds(projectId)
      ).to.be.revertedWithCustomError(tokenLauncher, "CreatorAlreadyWithdrew");
    });
  });
  describe("Project Information Views", function () {
    describe("getAllProjects", function () {
      it("Should return empty array when no projects exist", async function () {
        const { tokenLauncher } = await loadFixture(deployTokenLauncherFixture);
        const projects = await tokenLauncher.getAllProjects();
        expect(projects.length).to.equal(0);
      });

      it("Should return all created projects", async function () {
        const {
          tokenLauncher,
          owner,
          totalSupply,
          startDate,
          endDate,
          tokenPrice,
          name,
          symbol,
          projectName,
          projectDescription,
        } = await loadFixture(launchedTokenFixture);

        await tokenLauncher.launchToken(
          totalSupply,
          startDate,
          endDate,
          tokenPrice,
          name,
          symbol + "2",
          projectName,
          projectDescription
        );

        await tokenLauncher.launchToken(
          totalSupply,
          startDate,
          endDate,
          tokenPrice,
          name,
          symbol + "3",
          projectName,
          projectDescription
        );

        const projects = await tokenLauncher.getAllProjects();
        expect(projects.length).to.equal(3);
        expect(projects[0].projectId).to.equal(1);
        expect(projects[1].projectId).to.equal(2);
        expect(projects[2].projectId).to.equal(3);

        for (let i = 0; i < projects.length; i++) {
          expect(projects[i].tokenAddress).to.not.equal(ethers.ZeroAddress);
          expect(projects[i].totalSupply).to.equal(totalSupply);
          expect(projects[i].startDate).to.equal(startDate);
          expect(projects[i].endDate).to.equal(endDate);
          expect(projects[i].tokenPrice).to.equal(tokenPrice);
          expect(projects[i].creator).to.equal(owner.address);
        }
      });

      it("Should handle deleted or non-existent projects", async function () {
        const {
          tokenLauncher,
          totalSupply,
          startDate,
          endDate,
          tokenPrice,
          name,
          symbol,
          projectName,
          projectDescription,
        } = await loadFixture(launchedTokenFixture);

        await tokenLauncher.launchToken(
          totalSupply,
          startDate,
          endDate,
          tokenPrice,
          name,
          symbol + "2",
          projectName,
          projectDescription
        );

        const projects = await tokenLauncher.getAllProjects();
        expect(projects.length).to.equal(2);
        expect(projects[0].projectId).to.equal(1);
        expect(projects[1].projectId).to.equal(2);
      });
    });

    describe("getProjectWithUserInfo", function () {
      it("Should return correct project info for user with allocation", async function () {
        const {
          tokenLauncher,
          user1,
          projectId,
          startDate,
          tokenPrice,
          totalSupply,
        } = await loadFixture(smallSupplyTokenFixture);

        await time.increaseTo(startDate + 1);
        const allocationAmount = (BigInt(totalSupply) * tokenPrice) / BigInt(2);
        await tokenLauncher.connect(user1).allocateTokens(projectId, {
          value: allocationAmount,
        });

        const projectInfo = await tokenLauncher.getProjectWithUserInfo(
          projectId,
          user1.address
        );

        expect(projectInfo.totalSpent).to.equal(allocationAmount);
        expect(projectInfo.tokenAllocationAmount).to.equal(
          allocationAmount / tokenPrice
        );
        expect(projectInfo.availableTokens).to.equal(
          BigInt(totalSupply) - allocationAmount / tokenPrice
        );
      });

      it("Should return correct project info for user without allocation", async function () {
        const { tokenLauncher, user1, projectId } = await loadFixture(
          smallSupplyTokenFixture
        );

        const projectInfo = await tokenLauncher.getProjectWithUserInfo(
          projectId,
          user1.address
        );

        expect(projectInfo.totalSpent).to.equal(0);
        expect(projectInfo.tokenAllocationAmount).to.equal(0);
        expect(projectInfo.availableTokens).to.equal(
          projectInfo.project.totalSupply
        );
      });

      it("Should return correct project info for zero address", async function () {
        const { tokenLauncher, projectId } = await loadFixture(
          smallSupplyTokenFixture
        );

        const projectInfo = await tokenLauncher.getProjectWithUserInfo(
          projectId,
          ethers.ZeroAddress
        );

        expect(projectInfo.totalSpent).to.equal(0);
        expect(projectInfo.tokenAllocationAmount).to.equal(0);
        expect(projectInfo.availableTokens).to.equal(
          projectInfo.project.totalSupply
        );
      });

      it("Should return correct available tokens after multiple allocations", async function () {
        const {
          tokenLauncher,
          user1,
          user2,
          projectId,
          startDate,
          tokenPrice,
          totalSupply,
        } = await loadFixture(smallSupplyTokenFixture);

        await time.increaseTo(startDate + 1);
        const allocationAmount = (BigInt(totalSupply) * tokenPrice) / BigInt(4); // 25% each

        await tokenLauncher.connect(user1).allocateTokens(projectId, {
          value: allocationAmount,
        });
        await tokenLauncher.connect(user2).allocateTokens(projectId, {
          value: allocationAmount,
        });

        const projectInfo = await tokenLauncher.getProjectWithUserInfo(
          projectId,
          user1.address
        );
        const expectedAvailable =
          BigInt(totalSupply) - (allocationAmount * BigInt(2)) / tokenPrice;

        expect(projectInfo.availableTokens).to.equal(expectedAvailable);
      });

      it("Should revert when querying non-existent project", async function () {
        const { tokenLauncher, user1 } = await loadFixture(
          smallSupplyTokenFixture
        );

        const nonExistentProjectId = 999;

        await expect(
          tokenLauncher.getProjectWithUserInfo(
            nonExistentProjectId,
            user1.address
          )
        )
          .to.be.revertedWithCustomError(tokenLauncher, "ProjectNotFound")
          .withArgs(nonExistentProjectId);
      });
    });
    describe("getProjectDetails", function () {
      it("Should revert with ProjectNotFound for non-existent project", async function () {
        const { tokenLauncher } = await loadFixture(smallSupplyTokenFixture);

        const nonExistentProjectId = 999;

        await expect(tokenLauncher.getProjectDetails(nonExistentProjectId))
          .to.be.revertedWithCustomError(tokenLauncher, "ProjectNotFound")
          .withArgs(nonExistentProjectId);
      });

      it("Should return same info as getProjectWithUserInfo with zero address", async function () {
        const { tokenLauncher, projectId, totalSupply } = await loadFixture(
          smallSupplyTokenFixture
        );

        const projectDetails = await tokenLauncher.getProjectDetails(projectId);
        const projectWithUserInfo = await tokenLauncher.getProjectWithUserInfo(
          projectId,
          ethers.ZeroAddress
        );

        expect(projectDetails.project.projectId).to.equal(
          projectWithUserInfo.project.projectId
        );
        expect(projectDetails.project.totalSupply).to.equal(
          projectWithUserInfo.project.totalSupply
        );
        expect(projectDetails.project.startDate).to.equal(
          projectWithUserInfo.project.startDate
        );
        expect(projectDetails.project.endDate).to.equal(
          projectWithUserInfo.project.endDate
        );
        expect(projectDetails.project.tokenPrice).to.equal(
          projectWithUserInfo.project.tokenPrice
        );
        expect(projectDetails.project.participantCount).to.equal(
          projectWithUserInfo.project.participantCount
        );
        expect(projectDetails.project.amountRaised).to.equal(
          projectWithUserInfo.project.amountRaised
        );
        expect(projectDetails.project.targetRaise).to.equal(
          projectWithUserInfo.project.targetRaise
        );
        expect(projectDetails.project.tokenAddress).to.equal(
          projectWithUserInfo.project.tokenAddress
        );
        expect(projectDetails.project.creator).to.equal(
          projectWithUserInfo.project.creator
        );
        expect(projectDetails.project.projectName).to.equal(
          projectWithUserInfo.project.projectName
        );
        expect(projectDetails.project.projectDescription).to.equal(
          projectWithUserInfo.project.projectDescription
        );
        expect(projectDetails.project.hasCreatorWithdrawn).to.equal(
          projectWithUserInfo.project.hasCreatorWithdrawn
        );

        expect(projectDetails.totalSpent).to.equal(0);
        expect(projectDetails.tokenAllocationAmount).to.equal(0);
        expect(projectDetails.availableTokens).to.equal(totalSupply);
      });

      it("Should return correct project details after state changes", async function () {
        const {
          tokenLauncher,
          user1,
          projectId,
          startDate,
          tokenPrice,
          totalSupply,
        } = await loadFixture(smallSupplyTokenFixture);

        await time.increaseTo(startDate + 1);
        const allocationAmount = (BigInt(totalSupply) * tokenPrice) / BigInt(2);
        await tokenLauncher.connect(user1).allocateTokens(projectId, {
          value: allocationAmount,
        });

        const projectDetails = await tokenLauncher.getProjectDetails(projectId);

        expect(projectDetails.project.participantCount).to.equal(1);
        expect(projectDetails.project.amountRaised).to.equal(allocationAmount);
        expect(projectDetails.availableTokens).to.equal(
          BigInt(totalSupply) - allocationAmount / tokenPrice
        );
        expect(projectDetails.totalSpent).to.equal(0);
        expect(projectDetails.tokenAllocationAmount).to.equal(0);
      });
    });
  });
});
