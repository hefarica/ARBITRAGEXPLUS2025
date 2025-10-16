// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IVault.sol";

contract Vault is IVault {
    mapping(address => uint256) public balances;
    
    function deposit(address token, uint256 amount) external override {
        balances[token] += amount;
    }
    
    function withdraw(address token, uint256 amount) external override {
        require(balances[token] >= amount, "Insufficient balance");
        balances[token] -= amount;
    }
    
    function flashLoan(
        address token,
        uint256 amount,
        bytes calldata data
    ) external override {
        // Flash loan logic
    }
}
