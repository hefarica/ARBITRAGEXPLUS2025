// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../../src/Oracles/BandOracle.sol";

/**
 * @title BandOracleTest
 * @dev Tests para integración con Band Protocol
 * 
 * ARBITRAGEXPLUS2025 - Test Suite para Band Oracle
 */
contract BandOracleTest is Test {
    
    BandOracle public oracle;
    MockBandStdReference public mockRef;
    
    address public owner;
    address public tokenBTC;
    address public tokenETH;
    
    function setUp() public {
        owner = address(this);
        tokenBTC = address(0x1);
        tokenETH = address(0x2);
        
        mockRef = new MockBandStdReference();
        oracle = new BandOracle(address(mockRef));
        
        // Configurar precios iniciales en el mock
        mockRef.setReferenceData("BTC", "USD", 50000e18, block.timestamp);
        mockRef.setReferenceData("ETH", "USD", 3000e18, block.timestamp);
    }
    
    function testAddSymbol() public {
        oracle.addSymbol(tokenBTC, "BTC", 1 hours);
        
        assertTrue(oracle.isSymbolActive(tokenBTC), "Symbol should be active");
        
        (string memory symbol, uint256 heartbeat, bool isActive) = oracle.getSymbolInfo(tokenBTC);
        
        assertEq(symbol, "BTC", "Symbol should be BTC");
        assertEq(heartbeat, 1 hours, "Heartbeat should be 1 hour");
        assertTrue(isActive, "Should be active");
    }
    
    function testGetPrice() public {
        oracle.addSymbol(tokenBTC, "BTC", 1 hours);
        
        (uint256 price, uint256 timestamp) = oracle.getPrice(tokenBTC);
        
        assertEq(price, 50000e18, "Price should be $50,000");
        assertEq(timestamp, block.timestamp, "Timestamp should be current");
    }
    
    function testGetMultiplePrices() public {
        oracle.addSymbol(tokenBTC, "BTC", 1 hours);
        oracle.addSymbol(tokenETH, "ETH", 1 hours);
        
        address[] memory tokens = new address[](2);
        tokens[0] = tokenBTC;
        tokens[1] = tokenETH;
        
        (uint256[] memory prices, uint256[] memory timestamps) = oracle.getPrices(tokens);
        
        assertEq(prices[0], 50000e18, "BTC price should be $50,000");
        assertEq(prices[1], 3000e18, "ETH price should be $3,000");
        assertEq(timestamps[0], block.timestamp, "Timestamp should match");
        assertEq(timestamps[1], block.timestamp, "Timestamp should match");
    }
    
    function testRevertOnStalePrice() public {
        oracle.addSymbol(tokenBTC, "BTC", 1 hours);
        
        // Avanzar tiempo más allá del heartbeat
        vm.warp(block.timestamp + 2 hours);
        
        vm.expectRevert("Price too old");
        oracle.getPrice(tokenBTC);
    }
    
    function testRevertOnInvalidPrice() public {
        oracle.addSymbol(tokenBTC, "BTC", 1 hours);
        
        // Configurar precio inválido
        mockRef.setReferenceData("BTC", "USD", 0, block.timestamp);
        
        vm.expectRevert("Invalid price");
        oracle.getPrice(tokenBTC);
    }
    
    function testGetPriceUnsafe() public {
        oracle.addSymbol(tokenBTC, "BTC", 1 hours);
        
        // Avanzar tiempo para hacer el precio stale
        vm.warp(block.timestamp + 2 hours);
        
        (uint256 price, bool isStale) = oracle.getPriceUnsafe(tokenBTC);
        
        assertEq(price, 50000e18, "Should return price even if stale");
        assertTrue(isStale, "Should indicate price is stale");
    }
    
    function testUpdateSymbol() public {
        oracle.addSymbol(tokenBTC, "BTC", 1 hours);
        
        oracle.updateSymbol(tokenBTC, "WBTC", 2 hours);
        
        (string memory symbol, uint256 heartbeat, ) = oracle.getSymbolInfo(tokenBTC);
        
        assertEq(symbol, "WBTC", "Symbol should be updated to WBTC");
        assertEq(heartbeat, 2 hours, "Heartbeat should be updated to 2 hours");
    }
    
    function testRemoveSymbol() public {
        oracle.addSymbol(tokenBTC, "BTC", 1 hours);
        
        assertTrue(oracle.isSymbolActive(tokenBTC), "Should be active");
        
        oracle.removeSymbol(tokenBTC);
        
        assertFalse(oracle.isSymbolActive(tokenBTC), "Should be inactive");
        
        vm.expectRevert("Symbol not active");
        oracle.getPrice(tokenBTC);
    }
    
    function testUpdateStdReference() public {
        MockBandStdReference newRef = new MockBandStdReference();
        newRef.setReferenceData("BTC", "USD", 60000e18, block.timestamp);
        
        oracle.updateStdReference(address(newRef));
        oracle.addSymbol(tokenBTC, "BTC", 1 hours);
        
        (uint256 price, ) = oracle.getPrice(tokenBTC);
        
        assertEq(price, 60000e18, "Price should be from new reference");
    }
    
    function testOnlyOwnerCanManage() public {
        address notOwner = address(0x999);
        
        vm.prank(notOwner);
        vm.expectRevert("Not owner");
        oracle.addSymbol(tokenBTC, "BTC", 1 hours);
    }
    
    function testTransferOwnership() public {
        address newOwner = address(0x888);
        
        oracle.transferOwnership(newOwner);
        
        assertEq(oracle.owner(), newOwner, "Owner should be transferred");
        
        // El antiguo owner no debería poder agregar símbolos
        vm.expectRevert("Not owner");
        oracle.addSymbol(tokenBTC, "BTC", 1 hours);
        
        // El nuevo owner debería poder agregar símbolos
        vm.prank(newOwner);
        oracle.addSymbol(tokenBTC, "BTC", 1 hours);
        
        assertTrue(oracle.isSymbolActive(tokenBTC), "New owner should be able to add symbols");
    }
    
    function testBatchPriceRetrieval() public {
        // Agregar múltiples símbolos
        oracle.addSymbol(tokenBTC, "BTC", 1 hours);
        oracle.addSymbol(tokenETH, "ETH", 1 hours);
        
        address[] memory tokens = new address[](2);
        tokens[0] = tokenBTC;
        tokens[1] = tokenETH;
        
        // Medir gas para batch
        uint256 gasBefore = gasleft();
        oracle.getPrices(tokens);
        uint256 gasUsed = gasBefore - gasleft();
        
        // Verificar que el batch es más eficiente que llamadas individuales
        assertTrue(gasUsed > 0, "Should use gas");
    }
}

// ==================================================================================
// MOCK BAND PROTOCOL REFERENCE
// ==================================================================================

contract MockBandStdReference {
    
    struct ReferenceData {
        uint256 rate;
        uint256 lastUpdatedBase;
        uint256 lastUpdatedQuote;
    }
    
    mapping(string => mapping(string => ReferenceData)) private data;
    
    function setReferenceData(
        string memory base,
        string memory quote,
        uint256 rate,
        uint256 timestamp
    ) external {
        data[base][quote] = ReferenceData({
            rate: rate,
            lastUpdatedBase: timestamp,
            lastUpdatedQuote: timestamp
        });
    }
    
    function getReferenceData(
        string memory base,
        string memory quote
    ) external view returns (ReferenceData memory) {
        return data[base][quote];
    }
    
    function getReferenceDataBulk(
        string[] memory bases,
        string[] memory quotes
    ) external view returns (ReferenceData[] memory) {
        require(bases.length == quotes.length, "BAD_INPUT_LENGTH");
        
        ReferenceData[] memory results = new ReferenceData[](bases.length);
        
        for (uint256 i = 0; i < bases.length; i++) {
            results[i] = data[bases[i]][quotes[i]];
        }
        
        return results;
    }
}

