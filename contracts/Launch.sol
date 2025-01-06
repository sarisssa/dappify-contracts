// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract LaunchedToken is ERC20 {
    string public projectName;
    string public projectDescription;
    uint256 public startDate;
    uint256 public endDate;
    uint256 public immutable tokenPrice;
    address public immutable creator;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _totalSupply,
        string memory _projectName,
        string memory _projectDescription,
        uint256 _startDate,
        uint256 _endDate,
        uint256 _tokenPrice,
        address _owner,
        address _launchpad
    ) ERC20(_name, _symbol) {
        projectName = _projectName;
        projectDescription = _projectDescription;
        startDate = _startDate;
        endDate = _endDate;
        tokenPrice = _tokenPrice;
        creator = _owner;
        _mint(_launchpad, _totalSupply * 10 ** decimals());
    }
}

contract TokenLauncher is ReentrancyGuard {
    struct Project {
        uint256 projectId;
        address tokenAddress;
        string name;
        string symbol;
        uint256 totalSupply;
        string projectName;
        string projectDescription;
        uint256 startDate;
        uint256 endDate;
        uint256 tokenPrice;
        address creator;
        uint256 launchDate;
        uint256 participantCount;
    }

    struct ProjectWithUserInfo {
        Project project;
        uint256 totalSpent;
        Purchase[] purchases;
        bool hasParticipated;
    }

    struct Purchase {
        uint256 amount;
        uint256 cost;
        uint256 purchaseDate;
        bool refunded;
    }
    uint256 private _nonce;
    uint256 private _purchaseNonce;
    uint256 private _projectCount;
    uint256[] private projectIds;
    mapping(uint256 => Project) public projects;
    mapping(address => uint256[]) public creatorToProjectIds;
    mapping(uint256 => address[]) private projectBuyers;
    mapping(uint256 => mapping(address => bool)) private hasParticipated;
    mapping(uint256 => mapping(address => Purchase[])) public purchases;
    mapping(uint256 => uint256) public totalRaised;

    event TokenLaunched(
        address tokenAddress,
        string name,
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

    event TokensPurchased(
        uint256 projectId,
        address buyer,
        uint256 amount,
        uint256 cost,
        uint256 purchaseId
    );

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
    error NoPayment();
    error InsufficientLaunchpadTokens();
    error TransferFailed();

    error NoRefundsAvailable();
    error NoTokensToRefund();
    error RefundTooEarly();
    error TargetRaiseAchieved();
    error ETHRefundFailed();

    error NotProjectCreator(address caller, address creator);
    error NoFundsToWithdraw();
    error TargetRaiseNotMet(uint256 current, uint256 target);
    error WithdrawalFailed(address creator, uint256 amount);

    modifier isRefundable(uint256 projectId) {
        Project storage project = projects[projectId];
        if (block.timestamp < project.startDate + 30 days) {
            revert RefundTooEarly();
        }
        if (totalRaised[projectId] >= getTargetRaise(projectId)) {
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
        // if (startDate < block.timestamp) {
        //     revert StartDateMustBeFuture();
        // }

        if (endDate <= startDate) {
            revert EndDateMustBeAfterStart();
        }

        if (endDate < startDate + 30 days) {
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
        uint256 projectId = generateProjectId();

        Project memory newProject = Project({
            projectId: projectId,
            tokenAddress: address(newToken),
            name: name,
            symbol: symbol,
            totalSupply: totalSupply,
            projectName: projectName,
            projectDescription: projectDescription,
            startDate: startDate,
            endDate: endDate,
            tokenPrice: tokenPrice,
            creator: msg.sender,
            launchDate: block.timestamp,
            participantCount: 0
        });

        projects[projectId] = newProject;
        projectIds.push(projectId);
        creatorToProjectIds[msg.sender].push(projectId);
        _projectCount++;

        emit TokenLaunched(
            address(newToken),
            name,
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

    function buyTokens(uint256 projectId) public payable nonReentrant {
        Project storage project = projects[projectId];

        if (project.tokenAddress == address(0)) {
            revert ProjectNotFound(projectId);
        }

        if (block.timestamp <= project.startDate) {
            revert SaleNotStarted();
        }

        if (msg.value == 0) {
            revert NoPayment();
        }

        if (!hasParticipated[projectId][msg.sender]) {
            hasParticipated[projectId][msg.sender] = true;
            projectBuyers[projectId].push(msg.sender);
            project.participantCount++;
        }

        uint256 tokenAmount = calculateTokenAmount(projectId, msg.value);

        LaunchedToken token = LaunchedToken(project.tokenAddress);

        if (
            token.balanceOf(address(this)) <
            tokenAmount * 10 ** token.decimals()
        ) {
            revert InsufficientLaunchpadTokens();
        }
        uint256 purchaseId = _generatePurchaseId();

        Purchase memory purchase = Purchase({
            amount: tokenAmount * 10 ** token.decimals(),
            cost: msg.value,
            purchaseDate: block.timestamp,
            refunded: false
        });

        purchases[projectId][msg.sender].push(purchase);

        bool success = token.transfer(
            msg.sender,
            tokenAmount * 10 ** token.decimals()
        );

        if (!success) {
            revert TransferFailed();
        }

        emit TokensPurchased(
            projectId,
            msg.sender,
            tokenAmount,
            msg.value,
            purchaseId
        );
    }

    function refundTokens(
        uint256 projectId
    ) public nonReentrant isRefundable(projectId) {
        Project storage project = projects[projectId];

        if (project.tokenAddress == address(0)) {
            revert ProjectNotFound(projectId);
        }

        if (!hasParticipated[projectId][msg.sender]) {
            revert NoTokensToRefund();
        }

        LaunchedToken token = LaunchedToken(project.tokenAddress);
        Purchase[] storage userPurchases = purchases[projectId][msg.sender];
        uint256 totalRefundAmount = 0;

        for (uint256 i = 0; i < userPurchases.length; i++) {
            Purchase storage purchase = userPurchases[i];
            if (!purchase.refunded) {
                uint256 tokensToReturn = purchase.amount;

                purchase.refunded = true;
                totalRefundAmount += purchase.cost;

                require(
                    token.transferFrom(
                        msg.sender,
                        address(this),
                        tokensToReturn
                    ),
                    "Token return failed"
                );
            }
        }
        require(totalRefundAmount > 0, "No refunds available");

        totalRaised[projectId] -= totalRefundAmount;

        (bool success, ) = msg.sender.call{value: totalRefundAmount}("");
        require(success, "ETH refund failed");

        emit TokensRefunded(projectId, msg.sender, totalRefundAmount);
    }

    function withdrawFunds(uint256 projectId) public nonReentrant {
        Project storage project = projects[projectId];

        if (project.tokenAddress == address(0)) {
            revert ProjectNotFound(projectId);
        }

        if (msg.sender != project.creator) {
            revert NotProjectCreator(msg.sender, project.creator);
        }

        uint256 totalRaisedAmount = totalRaised[projectId];
        uint256 targetAmount = getTargetRaise(projectId);

        if (totalRaisedAmount < targetAmount) {
            revert TargetRaiseNotMet(totalRaisedAmount, targetAmount);
        }

        if (totalRaisedAmount == 0) {
            revert NoFundsToWithdraw();
        }

        uint256 creatorAmount = (totalRaisedAmount * 99) / 100;

        (bool successCreator, ) = project.creator.call{value: creatorAmount}(
            ""
        );
        if (!successCreator) {
            revert WithdrawalFailed(msg.sender, creatorAmount);
        }

        emit CreatorWithdraw(
            projectId,
            project.creator,
            creatorAmount,
            totalRaisedAmount - creatorAmount
        );
    }

    function getAllProjects() public view returns (Project[] memory) {
        Project[] memory allProjects = new Project[](_projectCount);

        for (uint256 i = 0; i < projectIds.length; i++) {
            allProjects[i] = projects[projectIds[i]];
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

        uint256 totalSpent = 0;
        Purchase[] memory userPurchases = new Purchase[](0);
        bool userHasParticipated = false;

        if (user != address(0)) {
            userHasParticipated = hasParticipated[projectId][user];
            if (purchases[projectId][user].length > 0) {
                userPurchases = purchases[projectId][user];
                for (uint256 i = 0; i < userPurchases.length; i++) {
                    if (!userPurchases[i].refunded) {
                        totalSpent += userPurchases[i].cost;
                    }
                }
            }
        }

        return
            ProjectWithUserInfo({
                project: projects[projectId],
                totalSpent: totalSpent,
                purchases: userPurchases,
                hasParticipated: userHasParticipated
            });
    }

    function getProjectDetails(
        uint256 projectId
    ) public view returns (ProjectWithUserInfo memory) {
        return getProjectWithUserInfo(projectId, address(0));
    }

    function getTargetRaise(uint256 projectId) public view returns (uint256) {
        Project storage project = projects[projectId];
        return project.totalSupply * project.tokenPrice;
    }

    function calculateTokenAmount(
        uint256 projectId,
        uint256 paymentAmount
    ) public view returns (uint256 tokenAmount) {
        Project storage project = projects[projectId];
        return paymentAmount / project.tokenPrice;
    }

    function generateProjectId() private returns (uint256) {
        _nonce++;
        bytes32 hash = keccak256(
            abi.encodePacked(block.timestamp, msg.sender, _nonce)
        );

        return uint256(uint96(bytes12(hash)));
    }

    function _generatePurchaseId() private returns (uint256) {
        _purchaseNonce++;
        bytes32 hash = keccak256(
            abi.encodePacked(block.timestamp, msg.sender, _purchaseNonce)
        );

        return uint256(uint96(bytes12(hash)));
    }
}
