// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

contract DeployArbitrage is Script {
    function run() external {
        vm.startBroadcast();
        // Deploy contracts
        vm.stopBroadcast();
    }
}
