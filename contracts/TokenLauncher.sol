// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./LaunchedToken.sol";
import "hardhat/console.sol";

/// @title TokenLauncher - A contract for launching new ERC20 tokens
/// @notice This contract allows users to create and launch new ERC20 tokens with customizable parameters
/// @dev Handles token creation, sales, refunds, and creator withdrawals
contract TokenLauncher {
    uint256 private constant LAUNCHPAD_FEE_DENOMINATOR = 100;
    uint256 private constant CREATOR_FEE_NUMERATOR = 99;
    uint256 private constant MIN_DURATION = 30 days;

    /// @notice Structure to hold project information
    /// @dev Used to track all details about a launched token project
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

    /// @notice Structure to hold project information with user-specific details
    /// @dev Combines project data with user allocation information
    struct ProjectWithUserInfo {
        Project project;
        uint256 totalSpent;
        uint256 tokenAllocationAmount;
        uint256 availableTokens;
    }

    uint256 private _projectIds;
    /// @notice Mapping from project ID to Project details
    mapping(uint256 => Project) public projects;
    /// @notice Mapping from project ID to user address to token allocation amount
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

    error InvalidStringParameters(string message);
    error StartDateMustBeFuture();
    error MinimumDurationNotMet();

    error InvalidTotalSupply();
    error InvalidTokenPrice();
    error ProjectNotFound(uint256 projectId);

    error SaleNotStarted();
    error SaleNotEnded();
    error InvalidPaymentAmount(uint256 requiredPayment, uint256 messageValue);
    error InsufficientTokens(uint256 available, uint256 requested);
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

    /// @notice Modifier to check if a project is eligible for refunds
    /// @param projectId The ID of the project to check
    modifier isRefundable(uint256 projectId) {
        Project storage project = projects[projectId];

        if (project.tokenAddress == address(0)) {
            revert ProjectNotFound(projectId);
        }
        if (block.timestamp < project.startDate + MIN_DURATION) {
            revert RefundTooEarly();
        }
        if (project.amountRaised >= project.targetRaise) {
            revert TargetRaiseAchieved();
        }
        _;
    }

    /**
     * @notice Creates a new ERC-20 token and launches it on the platform
     * @dev Deploys a new LaunchedToken contract and initializes a new project
     * @param totalSupply The total supply of tokens to be created
     * @param startDate The timestamp when the token sale starts
     * @param endDate The timestamp when the token sale ends
     * @param tokenPrice The price per token in wei
     * @param name The name of the token
     * @param symbol The symbol of the token
     * @param projectName The name of the project
     * @param projectDescription A description of the project
     * @return address The address of the newly created token contract
     */
    function launchToken(
        uint256 totalSupply,
        uint256 startDate,
        uint256 endDate,
        uint256 tokenPrice,
        string memory name,
        string memory symbol,
        string memory projectName,
        string memory projectDescription
    ) external returns (address) {
        if (
            bytes(name).length == 0 ||
            bytes(symbol).length == 0 ||
            bytes(projectName).length == 0 ||
            bytes(projectDescription).length == 0
        ) {
            revert InvalidStringParameters("String parameters cannot be empty");
        }
        if (startDate < block.timestamp) {
            revert StartDateMustBeFuture();
        }

        if (endDate < startDate + MIN_DURATION) {
            revert MinimumDurationNotMet();
        }

        if (totalSupply <= 0) {
            revert InvalidTotalSupply();
        }

        if (tokenPrice <= 0) {
            revert InvalidTokenPrice();
        }

        LaunchedToken newToken = new LaunchedToken(
            msg.sender,
            address(this),
            totalSupply,
            startDate,
            endDate,
            tokenPrice,
            name,
            symbol,
            projectName,
            projectDescription
        );

        uint256 targetRaise = totalSupply * tokenPrice;
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
    function allocateTokens(
        uint256 projectId,
        uint256 tokenAmount
    ) external payable {
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

        if (tokenAmount < 1 * 10 ** 18) {
            revert InvalidTokenAmount();
        }

        if (tokenAmount % (1 * 10 ** 18) != 0) {
            revert InvalidTokenAmount();
        }

        uint256 requiredPayment = project.tokenPrice * tokenAmount;
        if (msg.value != requiredPayment) {
            revert InvalidPaymentAmount(requiredPayment, msg.value);
        }

        uint256 tokensAllocated = project.amountRaised / project.tokenPrice;
        uint256 availableTokens = project.totalSupply - tokensAllocated;

        if (tokenAmount > availableTokens) {
            revert InsufficientTokens(availableTokens, tokenAmount);
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

    /**
     * @notice Allows users to claim their allocated tokens after a successful raise
     * @dev Transfer tokens from the contract to the claimer
     * @param projectId The ID of the token launch project
     *
     * State Changes:
     * - Sets tokenAllocations[projectId][msg.sender] to 0
     * - Transfers tokens from contract to msg.sender
     */
    function claimTokens(uint256 projectId) external {
        Project storage project = projects[projectId];

        if (project.tokenAddress == address(0)) {
            revert ProjectNotFound(projectId);
        }

        if (block.timestamp <= project.endDate) {
            revert SaleNotEnded();
        }

        if (project.amountRaised < project.targetRaise) {
            revert TargetRaiseNotMet(project.amountRaised, project.targetRaise);
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

    /**
     * @notice Allows users to get a refund if the sale is unsuccessful
     * @dev Users can get refunds if minimum duration has passed and target wasn't met
     * @param projectId The ID of the token launch project
     *
     * State Changes:
     * - Sets tokenAllocations[projectId][msg.sender] to 0
     * - Decreases project.amountRaised by refund amount
     * - Transfers ETH from contract to msg.sender
     */
    function refundTokens(uint256 projectId) external isRefundable(projectId) {
        Project storage project = projects[projectId];

        uint256 tokenAllocationAmount = tokenAllocations[projectId][msg.sender];
        if (tokenAllocationAmount == 0) {
            revert NoTokensToRefund();
        }
        uint256 refundAmount = tokenAllocationAmount * project.tokenPrice;

        tokenAllocations[projectId][msg.sender] = 0;

        project.amountRaised -= refundAmount;

        (bool success, ) = msg.sender.call{value: refundAmount}("");

        if (!success) {
            revert ETHRefundFailed();
        }

        emit TokensRefunded(projectId, msg.sender, refundAmount);
    }

    /**
     * @notice Allows the project creator to withdraw raised funds
     * @dev Creator can only withdraw if target is met and they haven't withdrawn before
     * @param projectId The ID of the token launch project
     *
     * State Changes:
     * - Sets project.hasCreatorWithdrawn to true
     * - Transfers ETH from contract to project creator
     */
    function withdrawFunds(uint256 projectId) external {
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

    /// @notice Retrieves all projects that have been created
    /// @dev Returns an array of all projects, including completed and ongoing ones
    /// @return Project[] An array of all projects
    function getAllProjects() external view returns (Project[] memory) {
        Project[] memory allProjects = new Project[](_projectIds);

        for (uint256 i = 1; i <= _projectIds; i++) {
            if (projects[i].tokenAddress != address(0)) {
                allProjects[i - 1] = projects[i];
            }
        }
        return allProjects;
    }

    /// @notice Gets detailed project information including user-specific data
    /// @dev Returns project details along with user allocation and spending info
    /// @param projectId The ID of the project to query
    /// @param user The address of the user to query information for
    /// @return ProjectWithUserInfo Struct containing project and user-specific information
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
                    tokenAllocationAmount *
                    projects[projectId].tokenPrice;
            }
        }

        uint256 availableTokens = project.totalSupply -
            (project.amountRaised / project.tokenPrice);

        return
            ProjectWithUserInfo({
                project: projects[projectId],
                totalSpent: totalSpent,
                tokenAllocationAmount: tokenAllocationAmount,
                availableTokens: availableTokens
            });
    }

    /// @notice Gets project details without user-specific information
    /// @dev Wrapper around getProjectWithUserInfo with zero address as user
    /// @param projectId The ID of the project to query
    /// @return ProjectWithUserInfo Struct containing project information
    function getProjectDetails(
        uint256 projectId
    ) external view returns (ProjectWithUserInfo memory) {
        return getProjectWithUserInfo(projectId, address(0));
    }
}
