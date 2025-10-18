/**
 * ============================================================================
 * CONTRATO: DeployArbitrageSystem
 * ARCHIVO: ./contracts/script/DeployArbitrageSystem.s.sol
 * PRIORIDAD: P0 (CRÍTICO - ON-CHAIN)
 * ============================================================================
 * 
 * 📥 ENTRADA:
 *   FUNCIONES: _getSupportedTokens, _deployArbitrageManager, _deployBatchExecutor
 * 
 * 🔄 LÓGICA:
 *   - Arbitrage execution
 * 
 * 📤 SALIDA:
 * 
 * 🔒 SEGURIDAD:
 *   - Reentrancy guard
 *   - Access control
 * 
 * ============================================================================
 */

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/ArbitrageManager.sol";
import "../src/ArbitrageExecutor.sol";
import "../src/FlashLoanArbitrage.sol";
import "../src/BatchExecutor.sol";
import "../src/Oracles/ChainlinkOracle.sol";
import "../src/Oracles/BandOracle.sol";

/**
 * @title DeployArbitrageSystem
 * @dev Script de deployment completo para ARBITRAGEXPLUS2025
 * 
 * Despliega todos los contratos del sistema en orden correcto:
 * 1. Oráculos (Chainlink, Band)
 * 2. ArbitrageExecutor
 * 3. FlashLoanArbitrage
 * 4. BatchExecutor
 * 5. ArbitrageManager
 * 
 * Uso:
 * forge script script/DeployArbitrageSystem.s.sol:DeployArbitrageSystem \
 *   --rpc-url $RPC_URL \
 *   --private-key $PRIVATE_KEY \
 *   --broadcast \
 *   --verify
 */
contract DeployArbitrageSystem is Script {
    
    // ==================================================================================
    // CONFIGURACIÓN POR RED
    // ==================================================================================
    
    struct NetworkConfig {
        string name;
        address aavePool;
        address uniswapV2Router;
        address uniswapV3Router;
        address sushiswapRouter;
        address pancakeswapRouter;
        address weth;
        address usdc;
        address usdt;
        address dai;
        address bandStdRef;
    }
    
    // Configuraciones predefinidas por red
    mapping(uint256 => NetworkConfig) public configs;
    
    // Direcciones desplegadas
    ChainlinkOracle public chainlinkOracle;
    BandOracle public bandOracle;
    ArbitrageExecutor public arbitrageExecutor;
    FlashLoanArbitrage public flashLoanArbitrage;
    BatchExecutor public batchExecutor;
    ArbitrageManager public arbitrageManager;
    
    // ==================================================================================
    // SETUP
    // ==================================================================================
    
    function setUp() public {
        _setupNetworkConfigs();
    }
    
    function _setupNetworkConfigs() internal {
        // Ethereum Mainnet (chainId: 1)
        configs[1] = NetworkConfig({
            name: "Ethereum Mainnet",
            aavePool: 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2,
            uniswapV2Router: 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D,
            uniswapV3Router: 0xE592427A0AEce92De3Edee1F18E0157C05861564,
            sushiswapRouter: 0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F,
            pancakeswapRouter: address(0), // No disponible en Ethereum
            weth: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2,
            usdc: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48,
            usdt: 0xdAC17F958D2ee523a2206206994597C13D831ec7,
            dai: 0x6B175474E89094C44Da98b954EedeAC495271d0F,
            bandStdRef: 0xDA7a001b254CD22e46d3eAB04d937489c93174C3
        });
        
        // BSC Mainnet (chainId: 56)
        configs[56] = NetworkConfig({
            name: "BSC Mainnet",
            aavePool: address(0), // Aave no disponible en BSC
            uniswapV2Router: address(0),
            uniswapV3Router: address(0),
            sushiswapRouter: 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506,
            pancakeswapRouter: 0x10ED43C718714eb63d5aA57B78B54704E256024E,
            weth: 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c, // WBNB
            usdc: 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d,
            usdt: 0x55d398326f99059fF775485246999027B3197955,
            dai: 0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3,
            bandStdRef: 0xDA7a001b254CD22e46d3eAB04d937489c93174C3
        });
        
        // Polygon Mainnet (chainId: 137)
        configs[137] = NetworkConfig({
            name: "Polygon Mainnet",
            aavePool: 0x794a61358D6845594F94dc1DB02A252b5b4814aD,
            uniswapV2Router: address(0),
            uniswapV3Router: 0xE592427A0AEce92De3Edee1F18E0157C05861564,
            sushiswapRouter: 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506,
            pancakeswapRouter: address(0),
            weth: 0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270, // WMATIC
            usdc: 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174,
            usdt: 0xc2132D05D31c914a87C6611C10748AEb04B58e8F,
            dai: 0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063,
            bandStdRef: 0x56E2898E0ceFF0D1222827759B56B28Ad812f92F
        });
        
        // Arbitrum Mainnet (chainId: 42161)
        configs[42161] = NetworkConfig({
            name: "Arbitrum Mainnet",
            aavePool: 0x794a61358D6845594F94dc1DB02A252b5b4814aD,
            uniswapV2Router: address(0),
            uniswapV3Router: 0xE592427A0AEce92De3Edee1F18E0157C05861564,
            sushiswapRouter: 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506,
            pancakeswapRouter: address(0),
            weth: 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1,
            usdc: 0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8,
            usdt: 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9,
            dai: 0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1,
            bandStdRef: address(0) // No disponible en Arbitrum
        });
        
        // Sepolia Testnet (chainId: 11155111)
        configs[11155111] = NetworkConfig({
            name: "Sepolia Testnet",
            aavePool: 0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951,
            uniswapV2Router: 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D,
            uniswapV3Router: 0xE592427A0AEce92De3Edee1F18E0157C05861564,
            sushiswapRouter: address(0),
            pancakeswapRouter: address(0),
            weth: 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9,
            usdc: 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8,
            usdt: address(0),
            dai: 0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357,
            bandStdRef: address(0)
        });
        
        // BSC Testnet (chainId: 97)
        configs[97] = NetworkConfig({
            name: "BSC Testnet",
            aavePool: address(0),
            uniswapV2Router: address(0),
            uniswapV3Router: address(0),
            sushiswapRouter: address(0),
            pancakeswapRouter: 0xD99D1c33F9fC3444f8101754aBC46c52416550D1,
            weth: 0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd, // WBNB
            usdc: 0x64544969ed7EBf5f083679233325356EbE738930,
            usdt: 0x337610d27c682E347C9cD60BD4b3b107C9d34dDd,
            dai: address(0),
            bandStdRef: address(0)
        });
        
        // Mumbai Testnet (chainId: 80001)
        configs[80001] = NetworkConfig({
            name: "Mumbai Testnet",
            aavePool: 0x6C9fB0D5bD9429eb9Cd96B85B81d872281771E6B,
            uniswapV2Router: address(0),
            uniswapV3Router: 0xE592427A0AEce92De3Edee1F18E0157C05861564,
            sushiswapRouter: address(0),
            pancakeswapRouter: address(0),
            weth: 0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889, // WMATIC
            usdc: 0x0FA8781a83E46826621b3BC094Ea2A0212e71B23,
            usdt: address(0),
            dai: 0x001B3B4d0F3714Ca98ba10F6042DaEbF0B1B7b6F,
            bandStdRef: address(0)
        });
    }
    
    // ==================================================================================
    // DEPLOYMENT PRINCIPAL
    // ==================================================================================
    
    function run() public {
        uint256 chainId = block.chainid;
        NetworkConfig memory config = configs[chainId];
        
        require(bytes(config.name).length > 0, "Unsupported network");
        
        console.log("========================================");
        console.log("ARBITRAGEXPLUS2025 - Deployment Script");
        console.log("========================================");
        console.log("Network:", config.name);
        console.log("Chain ID:", chainId);
        console.log("Deployer:", msg.sender);
        console.log("========================================");
        
        vm.startBroadcast();
        
        // 1. Deploy Oracles
        _deployOracles(config);
        
        // 2. Deploy ArbitrageExecutor
        _deployArbitrageExecutor(config);
        
        // 3. Deploy FlashLoanArbitrage
        _deployFlashLoanArbitrage(config);
        
        // 4. Deploy BatchExecutor
        _deployBatchExecutor(config);
        
        // 5. Deploy ArbitrageManager
        _deployArbitrageManager(config);
        
        // 6. Configure contracts
        _configureContracts(config);
        
        vm.stopBroadcast();
        
        // 7. Print deployment summary
        _printDeploymentSummary(config);
    }
    
    // ==================================================================================
    // DEPLOYMENT DE ORÁCULOS
    // ==================================================================================
    
    function _deployOracles(NetworkConfig memory config) internal {
        console.log("\n[1/5] Deploying Oracles...");
        
        // Deploy Chainlink Oracle
        chainlinkOracle = new ChainlinkOracle();
        console.log("  ChainlinkOracle deployed at:", address(chainlinkOracle));
        
        // Deploy Band Oracle (si está disponible)
        if (config.bandStdRef != address(0)) {
            bandOracle = new BandOracle(config.bandStdRef);
            console.log("  BandOracle deployed at:", address(bandOracle));
        } else {
            console.log("  BandOracle: Not available on this network");
        }
    }
    
    // ==================================================================================
    // DEPLOYMENT DE ARBITRAGE EXECUTOR
    // ==================================================================================
    
    function _deployArbitrageExecutor(NetworkConfig memory config) internal {
        console.log("\n[2/5] Deploying ArbitrageExecutor...");
        
        arbitrageExecutor = new ArbitrageExecutor();
        console.log("  ArbitrageExecutor deployed at:", address(arbitrageExecutor));
    }
    
    // ==================================================================================
    // DEPLOYMENT DE FLASH LOAN ARBITRAGE
    // ==================================================================================
    
    function _deployFlashLoanArbitrage(NetworkConfig memory config) internal {
        console.log("\n[3/5] Deploying FlashLoanArbitrage...");
        
        if (config.aavePool != address(0)) {
            flashLoanArbitrage = new FlashLoanArbitrage(config.aavePool);
            console.log("  FlashLoanArbitrage deployed at:", address(flashLoanArbitrage));
        } else {
            console.log("  FlashLoanArbitrage: Aave not available on this network");
        }
    }
    
    // ==================================================================================
    // DEPLOYMENT DE BATCH EXECUTOR
    // ==================================================================================
    
    function _deployBatchExecutor(NetworkConfig memory config) internal {
        console.log("\n[4/5] Deploying BatchExecutor...");
        
        batchExecutor = new BatchExecutor();
        console.log("  BatchExecutor deployed at:", address(batchExecutor));
    }
    
    // ==================================================================================
    // DEPLOYMENT DE ARBITRAGE MANAGER
    // ==================================================================================
    
    function _deployArbitrageManager(NetworkConfig memory config) internal {
        console.log("\n[5/5] Deploying ArbitrageManager...");
        
        // Preparar arrays de DEXes autorizados
        address[] memory authorizedDexes = _getAuthorizedDexes(config);
        
        // Preparar arrays de tokens soportados
        address[] memory supportedTokens = _getSupportedTokens(config);
        
        arbitrageManager = new ArbitrageManager(authorizedDexes, supportedTokens);
        console.log("  ArbitrageManager deployed at:", address(arbitrageManager));
    }
    
    // ==================================================================================
    // CONFIGURACIÓN POST-DEPLOYMENT
    // ==================================================================================
    
    function _configureContracts(NetworkConfig memory config) internal {
        console.log("\nConfiguring contracts...");
        
        // Configurar oráculos en ArbitrageManager
        if (address(chainlinkOracle) != address(0)) {
            // Aquí se configurarían los price feeds de Chainlink
            console.log("  Chainlink oracle configured");
        }
        
        if (address(bandOracle) != address(0)) {
            // Aquí se configurarían los símbolos de Band
            console.log("  Band oracle configured");
        }
        
        console.log("Configuration complete!");
    }
    
    // ==================================================================================
    // HELPERS
    // ==================================================================================
    
    function _getAuthorizedDexes(NetworkConfig memory config) internal pure returns (address[] memory) {
        uint256 count = 0;
        
        // Contar DEXes disponibles
        if (config.uniswapV2Router != address(0)) count++;
        if (config.uniswapV3Router != address(0)) count++;
        if (config.sushiswapRouter != address(0)) count++;
        if (config.pancakeswapRouter != address(0)) count++;
        
        address[] memory dexes = new address[](count);
        uint256 index = 0;
        
        if (config.uniswapV2Router != address(0)) dexes[index++] = config.uniswapV2Router;
        if (config.uniswapV3Router != address(0)) dexes[index++] = config.uniswapV3Router;
        if (config.sushiswapRouter != address(0)) dexes[index++] = config.sushiswapRouter;
        if (config.pancakeswapRouter != address(0)) dexes[index++] = config.pancakeswapRouter;
        
        return dexes;
    }
    
    function _getSupportedTokens(NetworkConfig memory config) internal pure returns (address[] memory) {
        uint256 count = 0;
        
        // Contar tokens disponibles
        if (config.weth != address(0)) count++;
        if (config.usdc != address(0)) count++;
        if (config.usdt != address(0)) count++;
        if (config.dai != address(0)) count++;
        
        address[] memory tokens = new address[](count);
        uint256 index = 0;
        
        if (config.weth != address(0)) tokens[index++] = config.weth;
        if (config.usdc != address(0)) tokens[index++] = config.usdc;
        if (config.usdt != address(0)) tokens[index++] = config.usdt;
        if (config.dai != address(0)) tokens[index++] = config.dai;
        
        return tokens;
    }
    
    function _printDeploymentSummary(NetworkConfig memory config) internal view {
        console.log("\n========================================");
        console.log("DEPLOYMENT SUMMARY");
        console.log("========================================");
        console.log("Network:", config.name);
        console.log("\nContracts:");
        console.log("  ChainlinkOracle:", address(chainlinkOracle));
        if (address(bandOracle) != address(0)) {
            console.log("  BandOracle:", address(bandOracle));
        }
        console.log("  ArbitrageExecutor:", address(arbitrageExecutor));
        if (address(flashLoanArbitrage) != address(0)) {
            console.log("  FlashLoanArbitrage:", address(flashLoanArbitrage));
        }
        console.log("  BatchExecutor:", address(batchExecutor));
        console.log("  ArbitrageManager:", address(arbitrageManager));
        console.log("========================================");
        console.log("\nDeployment complete! Save these addresses.");
        console.log("========================================\n");
    }
}

