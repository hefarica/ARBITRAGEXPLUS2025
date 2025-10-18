// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/ArbitrageManager.sol";
import "../src/Oracles/ChainlinkOracle.sol";
import "../src/Oracles/BandOracle.sol";

/**
 * @title ArbitrageManagerTest
 * @dev Tests completos para ArbitrageManager - Batch execution de 40 operaciones
 * 
 * ARBITRAGEXPLUS2025 - Test Suite para Arbitraje Batch
 * 
 * Cubre:
 * - Ejecución de batches de 1 a 40 operaciones
 * - Validación de operaciones
 * - Circuit breaker
 * - Gestión de gas
 * - Integración con oráculos
 */
contract ArbitrageManagerTest is Test {
    
    ArbitrageManager public manager;
    ChainlinkOracle public chainlinkOracle;
    BandOracle public bandOracle;
    
    // Mock tokens
    MockERC20 public tokenA;
    MockERC20 public tokenB;
    MockERC20 public tokenC;
    
    // Mock DEXes
    MockDEX public dexUniswap;
    MockDEX public dexSushiswap;
    MockDEX public dexPancakeswap;
    
    address public owner;
    address public executor;
    
    // ==================================================================================
    // SETUP
    // ==================================================================================
    
    function setUp() public {
        owner = address(this);
        executor = address(0x1234);
        
        // Deploy mock tokens
        tokenA = new MockERC20("Token A", "TKNA", 18);
        tokenB = new MockERC20("Token B", "TKNB", 18);
        tokenC = new MockERC20("Token C", "TKNC", 18);
        
        // Deploy mock DEXes
        dexUniswap = new MockDEX("Uniswap");
        dexSushiswap = new MockDEX("Sushiswap");
        dexPancakeswap = new MockDEX("Pancakeswap");
        
        // Preparar arrays para constructor
        address[] memory dexes = new address[](3);
        dexes[0] = address(dexUniswap);
        dexes[1] = address(dexSushiswap);
        dexes[2] = address(dexPancakeswap);
        
        address[] memory tokens = new address[](3);
        tokens[0] = address(tokenA);
        tokens[1] = address(tokenB);
        tokens[2] = address(tokenC);
        
        // Deploy ArbitrageManager
        manager = new ArbitrageManager(dexes, tokens);
        
        // Deploy oracles
        chainlinkOracle = new ChainlinkOracle();
        bandOracle = new BandOracle();
        
        // Mint tokens al manager para testing
        tokenA.mint(address(manager), 1000 ether);
        tokenB.mint(address(manager), 1000 ether);
        tokenC.mint(address(manager), 1000 ether);
        
        // Configurar liquidez en DEXes
        _setupDEXLiquidity();
    }
    
    function _setupDEXLiquidity() internal {
        // Mint tokens a los DEXes
        tokenA.mint(address(dexUniswap), 10000 ether);
        tokenB.mint(address(dexUniswap), 10000 ether);
        tokenC.mint(address(dexUniswap), 10000 ether);
        
        tokenA.mint(address(dexSushiswap), 10000 ether);
        tokenB.mint(address(dexSushiswap), 10000 ether);
        tokenC.mint(address(dexSushiswap), 10000 ether);
        
        tokenA.mint(address(dexPancakeswap), 10000 ether);
        tokenB.mint(address(dexPancakeswap), 10000 ether);
        tokenC.mint(address(dexPancakeswap), 10000 ether);
    }
    
    // ==================================================================================
    // TESTS: BATCH EXECUTION
    // ==================================================================================
    
    function testExecuteSingleOperation() public {
        ArbitrageManager.BatchOperation[] memory ops = new ArbitrageManager.BatchOperation[](1);
        
        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);
        
        address[] memory exchanges = new address[](1);
        exchanges[0] = address(dexUniswap);
        
        ops[0] = ArbitrageManager.BatchOperation({
            tokenIn: address(tokenA),
            tokenOut: address(tokenB),
            amountIn: 1 ether,
            minAmountOut: 0.95 ether,
            path: path,
            exchanges: exchanges,
            swapData: "",
            deadline: block.timestamp + 1 hours
        });
        
        ArbitrageManager.BatchResult memory result = manager.executeBatch(ops);
        
        assertTrue(result.success, "Batch should succeed");
        assertEq(result.successfulOps, 1, "Should have 1 successful op");
        assertEq(result.failedOps, 0, "Should have 0 failed ops");
    }
    
    function testExecuteMultipleOperations() public {
        uint256 numOps = 5;
        ArbitrageManager.BatchOperation[] memory ops = new ArbitrageManager.BatchOperation[](numOps);
        
        for (uint256 i = 0; i < numOps; i++) {
            address[] memory path = new address[](2);
            path[0] = address(tokenA);
            path[1] = address(tokenB);
            
            address[] memory exchanges = new address[](1);
            exchanges[0] = address(dexUniswap);
            
            ops[i] = ArbitrageManager.BatchOperation({
                tokenIn: address(tokenA),
                tokenOut: address(tokenB),
                amountIn: 0.1 ether,
                minAmountOut: 0.095 ether,
                path: path,
                exchanges: exchanges,
                swapData: "",
                deadline: block.timestamp + 1 hours
            });
        }
        
        ArbitrageManager.BatchResult memory result = manager.executeBatch(ops);
        
        assertTrue(result.success, "Batch should succeed");
        assertEq(result.successfulOps, numOps, "All ops should succeed");
        assertEq(result.failedOps, 0, "Should have 0 failed ops");
    }
    
    function testExecute40Operations() public {
        uint256 numOps = 40; // Máximo permitido
        ArbitrageManager.BatchOperation[] memory ops = new ArbitrageManager.BatchOperation[](numOps);
        
        for (uint256 i = 0; i < numOps; i++) {
            address[] memory path = new address[](2);
            path[0] = address(tokenA);
            path[1] = address(tokenB);
            
            address[] memory exchanges = new address[](1);
            exchanges[0] = address(dexUniswap);
            
            ops[i] = ArbitrageManager.BatchOperation({
                tokenIn: address(tokenA),
                tokenOut: address(tokenB),
                amountIn: 0.01 ether,
                minAmountOut: 0.0095 ether,
                path: path,
                exchanges: exchanges,
                swapData: "",
                deadline: block.timestamp + 1 hours
            });
        }
        
        ArbitrageManager.BatchResult memory result = manager.executeBatch(ops);
        
        assertTrue(result.success, "Batch of 40 ops should succeed");
        assertEq(result.successfulOps, numOps, "All 40 ops should succeed");
        assertGt(result.gasUsed, 0, "Should have used gas");
    }
    
    function testRevertOnBatchTooLarge() public {
        uint256 numOps = 41; // Excede el máximo
        ArbitrageManager.BatchOperation[] memory ops = new ArbitrageManager.BatchOperation[](numOps);
        
        vm.expectRevert("Batch too large");
        manager.executeBatch(ops);
    }
    
    function testRevertOnEmptyBatch() public {
        ArbitrageManager.BatchOperation[] memory ops = new ArbitrageManager.BatchOperation[](0);
        
        vm.expectRevert("Empty batch");
        manager.executeBatch(ops);
    }
    
    // ==================================================================================
    // TESTS: VALIDATION
    // ==================================================================================
    
    function testRejectUnsupportedToken() public {
        MockERC20 unsupportedToken = new MockERC20("Unsupported", "UNS", 18);
        
        ArbitrageManager.BatchOperation[] memory ops = new ArbitrageManager.BatchOperation[](1);
        
        address[] memory path = new address[](2);
        path[0] = address(unsupportedToken);
        path[1] = address(tokenB);
        
        address[] memory exchanges = new address[](1);
        exchanges[0] = address(dexUniswap);
        
        ops[0] = ArbitrageManager.BatchOperation({
            tokenIn: address(unsupportedToken),
            tokenOut: address(tokenB),
            amountIn: 1 ether,
            minAmountOut: 0.95 ether,
            path: path,
            exchanges: exchanges,
            swapData: "",
            deadline: block.timestamp + 1 hours
        });
        
        ArbitrageManager.BatchResult memory result = manager.executeBatch(ops);
        
        assertEq(result.failedOps, 1, "Should fail unsupported token");
        assertEq(result.successfulOps, 0, "Should have 0 successful ops");
    }
    
    function testRejectExpiredDeadline() public {
        ArbitrageManager.BatchOperation[] memory ops = new ArbitrageManager.BatchOperation[](1);
        
        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);
        
        address[] memory exchanges = new address[](1);
        exchanges[0] = address(dexUniswap);
        
        ops[0] = ArbitrageManager.BatchOperation({
            tokenIn: address(tokenA),
            tokenOut: address(tokenB),
            amountIn: 1 ether,
            minAmountOut: 0.95 ether,
            path: path,
            exchanges: exchanges,
            swapData: "",
            deadline: block.timestamp - 1 // Deadline en el pasado
        });
        
        ArbitrageManager.BatchResult memory result = manager.executeBatch(ops);
        
        assertEq(result.failedOps, 1, "Should fail expired deadline");
    }
    
    function testRejectUnauthorizedDEX() public {
        MockDEX unauthorizedDEX = new MockDEX("Unauthorized");
        
        ArbitrageManager.BatchOperation[] memory ops = new ArbitrageManager.BatchOperation[](1);
        
        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);
        
        address[] memory exchanges = new address[](1);
        exchanges[0] = address(unauthorizedDEX);
        
        ops[0] = ArbitrageManager.BatchOperation({
            tokenIn: address(tokenA),
            tokenOut: address(tokenB),
            amountIn: 1 ether,
            minAmountOut: 0.95 ether,
            path: path,
            exchanges: exchanges,
            swapData: "",
            deadline: block.timestamp + 1 hours
        });
        
        ArbitrageManager.BatchResult memory result = manager.executeBatch(ops);
        
        assertEq(result.failedOps, 1, "Should fail unauthorized DEX");
    }
    
    // ==================================================================================
    // TESTS: CIRCUIT BREAKER
    // ==================================================================================
    
    function testCircuitBreakerActivation() public {
        // Crear batch con alta tasa de fallos
        uint256 numOps = 10;
        ArbitrageManager.BatchOperation[] memory ops = new ArbitrageManager.BatchOperation[](numOps);
        
        // Crear operaciones que fallarán (deadline expirado)
        for (uint256 i = 0; i < numOps; i++) {
            address[] memory path = new address[](2);
            path[0] = address(tokenA);
            path[1] = address(tokenB);
            
            address[] memory exchanges = new address[](1);
            exchanges[0] = address(dexUniswap);
            
            ops[i] = ArbitrageManager.BatchOperation({
                tokenIn: address(tokenA),
                tokenOut: address(tokenB),
                amountIn: 1 ether,
                minAmountOut: 0.95 ether,
                path: path,
                exchanges: exchanges,
                swapData: "",
                deadline: block.timestamp - 1 // Todas expiradas
            });
        }
        
        // Ejecutar múltiples batches fallidos para activar circuit breaker
        for (uint256 i = 0; i < 5; i++) {
            manager.executeBatch(ops);
        }
        
        assertTrue(manager.circuitBreakerActive(), "Circuit breaker should be active");
        
        // Intentar ejecutar otro batch debería fallar
        vm.expectRevert("Circuit breaker is active");
        manager.executeBatch(ops);
    }
    
    // ==================================================================================
    // TESTS: GAS OPTIMIZATION
    // ==================================================================================
    
    function testGasUsageScaling() public {
        // Test con 1 operación
        uint256 gas1 = _measureGasForBatch(1);
        
        // Test con 10 operaciones
        uint256 gas10 = _measureGasForBatch(10);
        
        // Test con 40 operaciones
        uint256 gas40 = _measureGasForBatch(40);
        
        // Verificar que el gas escala linealmente (con margen de error)
        uint256 expectedGas10 = gas1 * 10;
        uint256 expectedGas40 = gas1 * 40;
        
        // Permitir 20% de variación
        assertApproxEqRel(gas10, expectedGas10, 0.2e18, "Gas should scale linearly for 10 ops");
        assertApproxEqRel(gas40, expectedGas40, 0.2e18, "Gas should scale linearly for 40 ops");
    }
    
    function _measureGasForBatch(uint256 numOps) internal returns (uint256) {
        ArbitrageManager.BatchOperation[] memory ops = new ArbitrageManager.BatchOperation[](numOps);
        
        for (uint256 i = 0; i < numOps; i++) {
            address[] memory path = new address[](2);
            path[0] = address(tokenA);
            path[1] = address(tokenB);
            
            address[] memory exchanges = new address[](1);
            exchanges[0] = address(dexUniswap);
            
            ops[i] = ArbitrageManager.BatchOperation({
                tokenIn: address(tokenA),
                tokenOut: address(tokenB),
                amountIn: 0.01 ether,
                minAmountOut: 0.0095 ether,
                path: path,
                exchanges: exchanges,
                swapData: "",
                deadline: block.timestamp + 1 hours
            });
        }
        
        uint256 gasBefore = gasleft();
        manager.executeBatch(ops);
        uint256 gasAfter = gasleft();
        
        return gasBefore - gasAfter;
    }
    
    // ==================================================================================
    // TESTS: STATISTICS
    // ==================================================================================
    
    function testStatisticsTracking() public {
        uint256 numOps = 5;
        ArbitrageManager.BatchOperation[] memory ops = new ArbitrageManager.BatchOperation[](numOps);
        
        for (uint256 i = 0; i < numOps; i++) {
            address[] memory path = new address[](2);
            path[0] = address(tokenA);
            path[1] = address(tokenB);
            
            address[] memory exchanges = new address[](1);
            exchanges[0] = address(dexUniswap);
            
            ops[i] = ArbitrageManager.BatchOperation({
                tokenIn: address(tokenA),
                tokenOut: address(tokenB),
                amountIn: 0.1 ether,
                minAmountOut: 0.095 ether,
                path: path,
                exchanges: exchanges,
                swapData: "",
                deadline: block.timestamp + 1 hours
            });
        }
        
        uint256 batchesBefore = manager.totalBatches();
        uint256 opsBefore = manager.totalOperations();
        
        manager.executeBatch(ops);
        
        assertEq(manager.totalBatches(), batchesBefore + 1, "Should increment batch counter");
        assertEq(manager.totalOperations(), opsBefore + numOps, "Should increment ops counter");
        assertGt(manager.totalGasUsed(), 0, "Should track gas used");
    }
}

// ==================================================================================
// MOCK CONTRACTS
// ==================================================================================

contract MockERC20 {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    
    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }
    
    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }
    
    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

contract MockDEX {
    string public name;
    
    constructor(string memory _name) {
        name = _name;
    }
    
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address to
    ) external returns (uint256 amountOut) {
        // Mock swap: retorna 1:1 con 1% de fee
        amountOut = (amountIn * 99) / 100;
        
        MockERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        MockERC20(tokenOut).transfer(to, amountOut);
        
        return amountOut;
    }
}

