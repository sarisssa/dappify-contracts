// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./LaunchedToken.sol";

contract TokenLauncher {
    uint256 private constant DECIMALS = 10 ** 18;
    uint256 private constant LAUNCHPAD_FEE_DENOMINATOR = 100;
    uint256 private constant CREATOR_FEE_NUMERATOR = 99;
    uint256 private constant MIN_DURATION = 30 days;

    struct Project {
        uint256 projectId;
        uint256 totalSupply;
        uint256 startDate;
        uint256 endDate;
        uint256 tokenPrice;
        uint256 participantCount;
        uint256 amountRaised;
        uint256 targetRaise;
        address tokenAddress;
        address creator;
        string symbol;
        string projectName;
        string projectDescription;
        bool hasCreatorWithdrawn;
    }

    struct ProjectWithUserInfo {
        Project project;
        uint256 totalSpent;
        uint256 tokenAllocationAmount;
        uint256 availableTokens;
    }

    uint256 private _projectIds;
    mapping(uint256 => Project) public projects;
    mapping(uint256 => mapping(address => uint256)) public tokenAllocations;

    event TokenLaunched(
        address tokenAddress,
        string symbol,
        uint256 totalSupply,
        string projectName,
        string projectDescription,
        uint256 startDate,
        uint256 endDate,
        uint256 tokenPrice,
        address creator,
        uint256 projectId
    );

    event TokensAllocated(
        uint256 projectId,
        address buyer,
        uint256 amount,
        uint256 cost
    );

    event TokensClaimed(uint256 projectId, address claimer, uint256 amount);

    event TokensRefunded(
        uint256 projectId,
        address refunder,
        uint256 totalRefundAmount
    );

    event CreatorWithdraw(
        uint256 projectId,
        address creator,
        uint256 withdrawAmount,
        uint256 launchpadFee
    );

    error StartDateMustBeFuture();
    error EndDateMustBeAfterStart();
    error MinimumDurationNotMet();

    error InvalidTotalSupply();
    error InvalidTokenPrice();
    error ProjectNotFound(uint256 projectId);

    error SaleNotStarted();
    error SaleNotEnded();
    error NoTokensToClaim();
    error TokenClaimFailed();

    error SaleEnded();
    error InvalidTokenAmount();
    error NoTokensToRefund();
    error RefundTooEarly();
    error TargetRaiseAchieved();
    error ETHRefundFailed();

    error CreatorAlreadyWithdrew();

    error NotProjectCreator(address caller, address creator);
    error TargetRaiseNotMet(uint256 current, uint256 target);
    error CreatorWithdrawalFailed(address creator, uint256 amount);

    modifier isRefundable(uint256 projectId) {
        Project storage project = projects[projectId];
        if (block.timestamp < project.startDate + MIN_DURATION) {
            revert RefundTooEarly();
        }
        if (project.amountRaised >= project.targetRaise) {
            revert TargetRaiseAchieved();
        }
        _;
    }

    function launchToken(
        string memory name,
        string memory symbol,
        uint256 totalSupply,
        string memory projectName,
        string memory projectDescription,
        uint256 startDate,
        uint256 endDate,
        uint256 tokenPrice
    ) public returns (address) {
        if (startDate < block.timestamp) {
            revert StartDateMustBeFuture();
        }

        if (endDate <= startDate) {
            revert EndDateMustBeAfterStart();
        }

        if (endDate < startDate + MIN_DURATION) {
            revert MinimumDurationNotMet();
        }

        if (totalSupply == 0) {
            revert InvalidTotalSupply();
        }

        if (tokenPrice == 0) {
            revert InvalidTokenPrice();
        }

        LaunchedToken newToken = new LaunchedToken(
            name,
            symbol,
            totalSupply,
            projectName,
            projectDescription,
            startDate,
            endDate,
            tokenPrice,
            msg.sender,
            address(this)
        );

        uint256 targetRaise = (totalSupply * tokenPrice) / DECIMALS;
        uint256 projectId = ++_projectIds;

        Project memory newProject = Project({
            projectId: projectId,
            tokenAddress: address(newToken),
            symbol: symbol,
            totalSupply: totalSupply,
            projectName: projectName,
            projectDescription: projectDescription,
            startDate: startDate,
            endDate: endDate,
            tokenPrice: tokenPrice,
            creator: msg.sender,
            participantCount: 0,
            amountRaised: 0,
            targetRaise: targetRaise,
            hasCreatorWithdrawn: false
        });

        projects[projectId] = newProject;

        emit TokenLaunched(
            address(newToken),
            symbol,
            totalSupply,
            projectName,
            projectDescription,
            startDate,
            endDate,
            tokenPrice,
            msg.sender,
            projectId
        );

        return address(newToken);
    }

    /**
     * @notice Allows users to participate in a token launch by allocating tokens based on ETH sent
     * @dev Tokens are allocated but not transferred immediately - they must be claimed after the sale ends
     * @param projectId The ID of the token launch project
     *
     *
     * State Changes:
     * - Increases project.participantCount if this is the user's first allocation
     * - Updates tokenAllocations mapping for the user
     * - Increases project.amountRaised by msg.value
     */
    function allocateTokens(uint256 projectId) public payable {
        Project storage project = projects[projectId];

        if (project.tokenAddress == address(0)) {
            revert ProjectNotFound(projectId);
        }

        if (block.timestamp <= project.startDate) {
            revert SaleNotStarted();
        }

        if (block.timestamp > project.endDate) {
            revert SaleEnded();
        }

        uint256 tokenAmount = (msg.value * DECIMALS) / project.tokenPrice;

        if (tokenAmount == 0) {
            revert InvalidTokenAmount();
        }

        uint256 previousAllocation = tokenAllocations[projectId][msg.sender];

        if (previousAllocation == 0) {
            project.participantCount++;
        }

        tokenAllocations[projectId][msg.sender] =
            previousAllocation +
            tokenAmount;

        project.amountRaised += msg.value;

        emit TokensAllocated(projectId, msg.sender, tokenAmount, msg.value);
    }

    function claimTokens(uint256 projectId) external {
        Project storage project = projects[projectId];

        if (block.timestamp <= project.endDate) {
            revert SaleNotEnded();
        }

        uint256 tokenAllocationAmount = tokenAllocations[projectId][msg.sender];
        if (tokenAllocationAmount == 0) {
            revert NoTokensToClaim();
        }
        tokenAllocations[projectId][msg.sender] = 0;
        bool success = IERC20(project.tokenAddress).transfer(
            msg.sender,
            tokenAllocationAmount
        );

        if (!success) {
            revert TokenClaimFailed();
        }

        emit TokensClaimed(projectId, msg.sender, tokenAllocationAmount);
    }

    function refundTokens(uint256 projectId) public isRefundable(projectId) {
        Project storage project = projects[projectId];

        uint256 tokenAllocationAmount = tokenAllocations[projectId][msg.sender];
        if (tokenAllocationAmount == 0) {
            revert NoTokensToRefund();
        }
        uint256 refundAmount = (tokenAllocationAmount * project.tokenPrice) /
            DECIMALS;

        tokenAllocations[projectId][msg.sender] = 0;
        project.amountRaised -= refundAmount;

        (bool success, ) = msg.sender.call{value: refundAmount}("");

        if (!success) {
            revert ETHRefundFailed();
        }

        emit TokensRefunded(projectId, msg.sender, refundAmount);
    }

    function withdrawFunds(uint256 projectId) public {
        Project storage project = projects[projectId];

        if (project.tokenAddress == address(0)) {
            revert ProjectNotFound(projectId);
        }

        if (msg.sender != project.creator) {
            revert NotProjectCreator(msg.sender, project.creator);
        }

        if (project.hasCreatorWithdrawn) {
            revert CreatorAlreadyWithdrew();
        }

        if (project.amountRaised < project.targetRaise) {
            revert TargetRaiseNotMet(project.amountRaised, project.targetRaise);
        }

        uint256 creatorAmount = (project.amountRaised * CREATOR_FEE_NUMERATOR) /
            LAUNCHPAD_FEE_DENOMINATOR;

        (bool withdrawSuccess, ) = project.creator.call{value: creatorAmount}(
            ""
        );
        if (!withdrawSuccess) {
            revert CreatorWithdrawalFailed(msg.sender, creatorAmount);
        }

        project.hasCreatorWithdrawn = true;

        emit CreatorWithdraw(
            projectId,
            project.creator,
            creatorAmount,
            project.amountRaised - creatorAmount
        );
    }

    function getAllProjects() public view returns (Project[] memory) {
        Project[] memory allProjects = new Project[](_projectIds);

        for (uint256 i = 1; i <= _projectIds; i++) {
            if (projects[i].tokenAddress != address(0)) {
                allProjects[i - 1] = projects[i];
            }
        }
        return allProjects;
    }

    function getProjectWithUserInfo(
        uint256 projectId,
        address user
    ) public view returns (ProjectWithUserInfo memory) {
        if (projects[projectId].tokenAddress == address(0)) {
            revert ProjectNotFound(projectId);
        }

        Project storage project = projects[projectId];
        uint256 totalSpent = 0;
        uint256 tokenAllocationAmount = 0;

        if (user != address(0)) {
            tokenAllocationAmount = tokenAllocations[projectId][user];
            if (tokenAllocationAmount > 0) {
                totalSpent =
                    (tokenAllocationAmount * projects[projectId].tokenPrice) /
                    DECIMALS;
            }
        }

        uint256 availableTokens = project.totalSupply -
            ((project.amountRaised * DECIMALS) / project.tokenPrice);

        return
            ProjectWithUserInfo({
                project: projects[projectId],
                totalSpent: totalSpent,
                tokenAllocationAmount: tokenAllocationAmount,
                availableTokens: availableTokens
            });
    }

    function getProjectDetails(
        uint256 projectId
    ) public view returns (ProjectWithUserInfo memory) {
        return getProjectWithUserInfo(projectId, address(0));
    }
}
