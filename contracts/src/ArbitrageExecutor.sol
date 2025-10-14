// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ArbitrageExecutor {
    event Executed(address indexed caller);
    function execute() external {
        emit Executed(msg.sender);
    }
}
