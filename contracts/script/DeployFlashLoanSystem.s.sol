/**
 * ============================================================================
 * CONTRATO: DeployFlashLoanSystem
 * ARCHIVO: ./contracts/script/DeployFlashLoanSystem.s.sol
 * PRIORIDAD: P0 (CRÍTICO - ON-CHAIN)
 * ============================================================================
 * 
 * 📥 ENTRADA:
 *   FUNCIONES: _configureFlashLoanArbitrage, run, _configureBatchExecutor
 * 
 * 🔄 LÓGICA:
 *   - Flash loans
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
import {FlashLoanArbitrage} from "../src/FlashLoanArbitrage.sol";
import {BatchExecutor} from "../src/BatchExecutor.sol";

/**
 * @title DeployFlashLoanSystem
 * @notice Script para desplegar el sistema completo de flash loan arbitrage
 * @dev Uso: forge script script/DeployFlashLoanSystem.s.sol:DeployFlashLoanSystem --rpc-url $RPC_URL --broadcast
 */
contract DeployFlashLoanSystem is Script {
    
    // Direcciones de protocolos conocidos (ejemplos para mainnet)
    // NOTA: Estas direcciones deben venir dinámicamente desde Google Sheets en producción
    
    // Aave V3
    address constant AAVE_V3_POOL_ETHEREUM = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
    address constant AAVE_V3_POOL_POLYGON = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;
    address constant AAVE_V3_POOL_ARBITRUM = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;
    
    // Balancer
    address constant BALANCER_VAULT_ETHEREUM = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;
    address constant BALANCER_VAULT_POLYGON = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;
    address constant BALANCER_VAULT_ARBITRUM = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;
    
    // Uniswap V2/V3
    address constant UNISWAP_V2_ROUTER_ETHEREUM = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
    address constant UNISWAP_V3_ROUTER_ETHEREUM = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    
    // SushiSwap
    address constant SUSHISWAP_ROUTER_ETHEREUM = 0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F;
    address constant SUSHISWAP_ROUTER_POLYGON = 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506;
    
    // PancakeSwap
    address constant PANCAKESWAP_ROUTER_BSC = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying FlashLoanArbitrage system...");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Desplegar FlashLoanArbitrage
        console.log("\n1. Deploying FlashLoanArbitrage...");
        FlashLoanArbitrage flashLoanArbitrage = new FlashLoanArbitrage();
        console.log("FlashLoanArbitrage deployed at:", address(flashLoanArbitrage));
        
        // 2. Desplegar BatchExecutor
        console.log("\n2. Deploying BatchExecutor...");
        BatchExecutor batchExecutor = new BatchExecutor();
        console.log("BatchExecutor deployed at:", address(batchExecutor));
        
        // 3. Configurar FlashLoanArbitrage
        console.log("\n3. Configuring FlashLoanArbitrage...");
        _configureFlashLoanArbitrage(flashLoanArbitrage, deployer);
        
        // 4. Configurar BatchExecutor
        console.log("\n4. Configuring BatchExecutor...");
        _configureBatchExecutor(batchExecutor, address(flashLoanArbitrage), deployer);
        
        vm.stopBroadcast();
        
        // 5. Imprimir resumen
        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("FlashLoanArbitrage:", address(flashLoanArbitrage));
        console.log("BatchExecutor:", address(batchExecutor));
        console.log("Owner:", deployer);
        console.log("\nNext steps:");
        console.log("1. Agregar estas direcciones a Google Sheets (hoja CONFIG)");
        console.log("2. Configurar variables de entorno en el backend");
        console.log("3. Ejecutar tests de integración");
        console.log("4. Iniciar el sistema de monitoreo");
    }
    
    function _configureFlashLoanArbitrage(
        FlashLoanArbitrage arbitrage,
        address executor
    ) internal {
        // Autorizar executor (el deployer inicialmente)
        arbitrage.authorizeExecutor(executor, true);
        console.log("  - Authorized executor:", executor);
        
        // Autorizar proveedores de flash loan según la chain
        if (block.chainid == 1) { // Ethereum Mainnet
            arbitrage.authorizeFlashLoanProvider(AAVE_V3_POOL_ETHEREUM, true);
            arbitrage.authorizeFlashLoanProvider(BALANCER_VAULT_ETHEREUM, true);
            console.log("  - Authorized Aave V3 Pool (Ethereum)");
            console.log("  - Authorized Balancer Vault (Ethereum)");
            
            // Autorizar routers de DEX
            arbitrage.authorizeDEXRouter(UNISWAP_V2_ROUTER_ETHEREUM, true);
            arbitrage.authorizeDEXRouter(UNISWAP_V3_ROUTER_ETHEREUM, true);
            arbitrage.authorizeDEXRouter(SUSHISWAP_ROUTER_ETHEREUM, true);
            console.log("  - Authorized Uniswap V2/V3 Routers");
            console.log("  - Authorized SushiSwap Router");
            
        } else if (block.chainid == 137) { // Polygon
            arbitrage.authorizeFlashLoanProvider(AAVE_V3_POOL_POLYGON, true);
            arbitrage.authorizeFlashLoanProvider(BALANCER_VAULT_POLYGON, true);
            console.log("  - Authorized Aave V3 Pool (Polygon)");
            console.log("  - Authorized Balancer Vault (Polygon)");
            
            arbitrage.authorizeDEXRouter(SUSHISWAP_ROUTER_POLYGON, true);
            console.log("  - Authorized SushiSwap Router (Polygon)");
            
        } else if (block.chainid == 42161) { // Arbitrum
            arbitrage.authorizeFlashLoanProvider(AAVE_V3_POOL_ARBITRUM, true);
            arbitrage.authorizeFlashLoanProvider(BALANCER_VAULT_ARBITRUM, true);
            console.log("  - Authorized Aave V3 Pool (Arbitrum)");
            console.log("  - Authorized Balancer Vault (Arbitrum)");
            
        } else if (block.chainid == 56) { // BSC
            arbitrage.authorizeDEXRouter(PANCAKESWAP_ROUTER_BSC, true);
            console.log("  - Authorized PancakeSwap Router (BSC)");
            
        } else {
            console.log("  - Unknown chain, skipping protocol configuration");
            console.log("  - Configure manually or via backend");
        }
    }
    
    function _configureBatchExecutor(
        BatchExecutor executor,
        address arbitrageContract,
        address authorizedExecutor
    ) internal {
        // Autorizar executor
        executor.authorizeExecutor(authorizedExecutor, true);
        console.log("  - Authorized executor:", authorizedExecutor);
        
        // Autorizar contrato de arbitraje
        executor.authorizeArbitrageContract(arbitrageContract, true);
        console.log("  - Authorized arbitrage contract:", arbitrageContract);
    }
}

