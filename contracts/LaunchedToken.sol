// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract LaunchedToken is ERC20 {
    address public immutable creator;
    uint256 public immutable tokenPrice;
    uint256 public startDate;
    uint256 public endDate;
    string public projectName;
    string public projectDescription;

    constructor(
        address _owner,
        address _launchpad,
        uint256 _totalSupply,
        uint256 _startDate,
        uint256 _endDate,
        uint256 _tokenPrice,
        string memory _name,
        string memory _symbol,
        string memory _projectName,
        string memory _projectDescription
    ) ERC20(_name, _symbol) {
        projectName = _projectName;
        projectDescription = _projectDescription;
        startDate = _startDate;
        endDate = _endDate;
        tokenPrice = _tokenPrice;
        creator = _owner;
        _mint(_launchpad, _totalSupply);
    }
}
