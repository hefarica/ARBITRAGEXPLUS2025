// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../../src/Oracles/ChainlinkOracle.sol";

/**
 * @title ChainlinkOracleTest
 * @dev Tests para integración con Chainlink Price Feeds
 * 
 * ARBITRAGEXPLUS2025 - Test Suite para Chainlink Oracle
 */
contract ChainlinkOracleTest is Test {
    
    ChainlinkOracle public oracle;
    MockChainlinkAggregator public mockFeed;
    
    address public owner;
    address public tokenUSDC;
    address public tokenWETH;
    
    function setUp() public {
        owner = address(this);
        tokenUSDC = address(0x1);
        tokenWETH = address(0x2);
        
        oracle = new ChainlinkOracle();
        mockFeed = new MockChainlinkAggregator(8); // 8 decimales (estándar USD)
        
        // Configurar precio inicial
        mockFeed.setLatestAnswer(100000000); // $1.00 en 8 decimales
    }
    
    function testAddPriceFeed() public {
        oracle.addPriceFeed(tokenUSDC, address(mockFeed), 1 hours);
        
        assertTrue(oracle.isPriceFeedActive(tokenUSDC), "Price feed should be active");
        
        (address feed, uint8 decimals, uint256 heartbeat, bool isActive) = oracle.getPriceFeedInfo(tokenUSDC);
        
        assertEq(feed, address(mockFeed), "Feed address should match");
        assertEq(decimals, 8, "Decimals should be 8");
        assertEq(heartbeat, 1 hours, "Heartbeat should be 1 hour");
        assertTrue(isActive, "Should be active");
    }
    
    function testGetPrice() public {
        oracle.addPriceFeed(tokenUSDC, address(mockFeed), 1 hours);
        
        (uint256 price, uint256 timestamp) = oracle.getPrice(tokenUSDC);
        
        assertEq(price, 1e18, "Price should be $1.00 in 18 decimals");
        assertEq(timestamp, block.timestamp, "Timestamp should be current");
    }
    
    function testGetPriceWithDifferentDecimals() public {
        // Test con 18 decimales
        MockChainlinkAggregator feed18 = new MockChainlinkAggregator(18);
        feed18.setLatestAnswer(1e18); // $1.00 en 18 decimales
        
        oracle.addPriceFeed(tokenWETH, address(feed18), 1 hours);
        
        (uint256 price, ) = oracle.getPrice(tokenWETH);
        
        assertEq(price, 1e18, "Price should be normalized to 18 decimals");
    }
    
    function testRevertOnStalePrice() public {
        oracle.addPriceFeed(tokenUSDC, address(mockFeed), 1 hours);
        
        // Avanzar tiempo más allá del heartbeat
        vm.warp(block.timestamp + 2 hours);
        
        vm.expectRevert("Price too old");
        oracle.getPrice(tokenUSDC);
    }
    
    function testRevertOnInvalidPrice() public {
        oracle.addPriceFeed(tokenUSDC, address(mockFeed), 1 hours);
        
        // Configurar precio inválido (negativo)
        mockFeed.setLatestAnswer(0);
        
        vm.expectRevert("Invalid price");
        oracle.getPrice(tokenUSDC);
    }
    
    function testGetPriceUnsafe() public {
        oracle.addPriceFeed(tokenUSDC, address(mockFeed), 1 hours);
        
        // Avanzar tiempo para hacer el precio stale
        vm.warp(block.timestamp + 2 hours);
        
        (uint256 price, bool isStale) = oracle.getPriceUnsafe(tokenUSDC);
        
        assertEq(price, 1e18, "Should return price even if stale");
        assertTrue(isStale, "Should indicate price is stale");
    }
    
    function testGetMultiplePrices() public {
        // Configurar múltiples feeds
        MockChainlinkAggregator feedWETH = new MockChainlinkAggregator(8);
        feedWETH.setLatestAnswer(200000000000); // $2000.00
        
        oracle.addPriceFeed(tokenUSDC, address(mockFeed), 1 hours);
        oracle.addPriceFeed(tokenWETH, address(feedWETH), 1 hours);
        
        address[] memory tokens = new address[](2);
        tokens[0] = tokenUSDC;
        tokens[1] = tokenWETH;
        
        (uint256[] memory prices, uint256[] memory timestamps) = oracle.getPrices(tokens);
        
        assertEq(prices[0], 1e18, "USDC price should be $1.00");
        assertEq(prices[1], 2000e18, "WETH price should be $2000.00");
        assertEq(timestamps[0], block.timestamp, "Timestamp should match");
        assertEq(timestamps[1], block.timestamp, "Timestamp should match");
    }
    
    function testUpdatePriceFeed() public {
        oracle.addPriceFeed(tokenUSDC, address(mockFeed), 1 hours);
        
        MockChainlinkAggregator newFeed = new MockChainlinkAggregator(8);
        newFeed.setLatestAnswer(105000000); // $1.05
        
        oracle.updatePriceFeed(tokenUSDC, address(newFeed), 2 hours);
        
        (uint256 price, ) = oracle.getPrice(tokenUSDC);
        
        assertEq(price, 1.05e18, "Price should be updated to $1.05");
    }
    
    function testRemovePriceFeed() public {
        oracle.addPriceFeed(tokenUSDC, address(mockFeed), 1 hours);
        
        assertTrue(oracle.isPriceFeedActive(tokenUSDC), "Should be active");
        
        oracle.removePriceFeed(tokenUSDC);
        
        assertFalse(oracle.isPriceFeedActive(tokenUSDC), "Should be inactive");
        
        vm.expectRevert("Price feed not active");
        oracle.getPrice(tokenUSDC);
    }
    
    function testOnlyOwnerCanManage() public {
        address notOwner = address(0x999);
        
        vm.prank(notOwner);
        vm.expectRevert("Not owner");
        oracle.addPriceFeed(tokenUSDC, address(mockFeed), 1 hours);
    }
    
    function testTransferOwnership() public {
        address newOwner = address(0x888);
        
        oracle.transferOwnership(newOwner);
        
        assertEq(oracle.owner(), newOwner, "Owner should be transferred");
        
        // El antiguo owner no debería poder agregar feeds
        vm.expectRevert("Not owner");
        oracle.addPriceFeed(tokenUSDC, address(mockFeed), 1 hours);
        
        // El nuevo owner debería poder agregar feeds
        vm.prank(newOwner);
        oracle.addPriceFeed(tokenUSDC, address(mockFeed), 1 hours);
        
        assertTrue(oracle.isPriceFeedActive(tokenUSDC), "New owner should be able to add feeds");
    }
}

// ==================================================================================
// MOCK CHAINLINK AGGREGATOR
// ==================================================================================

contract MockChainlinkAggregator {
    uint8 public decimals;
    int256 private latestAnswer;
    uint80 private latestRound;
    
    constructor(uint8 _decimals) {
        decimals = _decimals;
        latestRound = 1;
    }
    
    function setLatestAnswer(int256 _answer) external {
        latestAnswer = _answer;
        latestRound++;
    }
    
    function description() external pure returns (string memory) {
        return "Mock Chainlink Aggregator";
    }
    
    function version() external pure returns (uint256) {
        return 1;
    }
    
    function getRoundData(uint80 _roundId)
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            _roundId,
            latestAnswer,
            block.timestamp,
            block.timestamp,
            _roundId
        );
    }
    
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            latestRound,
            latestAnswer,
            block.timestamp,
            block.timestamp,
            latestRound
        );
    }
}

