// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IRouter.sol";
import "./interfaces/IVault.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title Router
 * @notice Router principal para ejecución de arbitraje con flash loans
 * @dev Implementa lógica de arbitraje multi-DEX con protección reentrancy
 * 
 * Premisas:
 * 1. Rutas y parámetros desde Google Sheets (no hardcoded)
 * 2. Soporta arrays dinámicos de DEXs y tokens
 * 3. Consumido por el TS Executor
 */
contract Router is IRouter, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    
    // ============ State Variables ============
    
    IVault public vault;
    
    // Mapeo de DEX routers aprobados (dinámico, desde Sheets)
    mapping(address => bool) public approvedDexRouters;
    
    // Mapeo de tokens aprobados (dinámico, desde Sheets)
    mapping(address => bool) public approvedTokens;
    
    // Fee del protocolo (en basis points, 100 = 1%)
    uint256 public protocolFeeBps = 10; // 0.1% default
    
    // Dirección del treasury para fees
    address public treasury;
    
    // Profit mínimo requerido (en wei)
    uint256 public minProfitThreshold;
    
    // Estadísticas de ejecución
    uint256 public totalExecutions;
    uint256 public totalProfitGenerated;
    uint256 public totalFeesCollected;
    
    // ============ Events ============
    
    event ArbitrageExecuted(
        address indexed executor,
        address indexed token,
        uint256 amountBorrowed,
        uint256 profitGenerated,
        uint256 feeCollected
    );
    
    event DexRouterApproved(address indexed router, bool approved);
    event TokenApproved(address indexed token, bool approved);
    event ProtocolFeeUpdated(uint256 oldFee, uint256 newFee);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event MinProfitThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    
    // ============ Errors ============
    
    error UnauthorizedDexRouter(address router);
    error UnauthorizedToken(address token);
    error InsufficientProfit(uint256 profit, uint256 minRequired);
    error FlashLoanFailed();
    error SwapFailed(address dex, address tokenIn, address tokenOut);
    error InvalidPath();
    error ZeroAddress();
    error ZeroAmount();
    
    // ============ Constructor ============
    
    constructor(
        address _vault,
        address _treasury
    ) Ownable(msg.sender) {
        if (_vault == address(0) || _treasury == address(0)) revert ZeroAddress();
        
        vault = IVault(_vault);
        treasury = _treasury;
        minProfitThreshold = 0.01 ether; // Default 0.01 ETH
    }
    
    // ============ Main Arbitrage Function ============
    
    /**
     * @notice Ejecuta arbitraje usando flash loan del Vault
     * @param token Token a tomar prestado para arbitraje
     * @param amount Cantidad a tomar prestada
     * @param path Array de direcciones: [dex1, dex2, ..., dexN, token1, token2, ...]
     * @param minProfit Profit mínimo esperado (protección slippage)
     * @return profit Profit neto generado
     */
    function executeArbitrage(
        address token,
        uint256 amount,
        address[] calldata path,
        uint256 minProfit
    ) external override nonReentrant returns (uint256 profit) {
        if (amount == 0) revert ZeroAmount();
        if (!approvedTokens[token]) revert UnauthorizedToken(token);
        if (path.length < 4) revert InvalidPath(); // Mínimo: 2 DEXs + 2 tokens
        
        // Guardar balance inicial
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        
        // 1. Solicitar flash loan del Vault
        bytes memory data = abi.encode(path, minProfit);
        vault.flashLoan(token, amount, data);
        
        // 2. Verificar balance después del arbitraje
        uint256 balanceAfter = IERC20(token).balanceOf(address(this));
        
        if (balanceAfter <= balanceBefore) revert InsufficientProfit(0, minProfit);
        
        profit = balanceAfter - balanceBefore;
        
        if (profit < minProfit) revert InsufficientProfit(profit, minProfit);
        if (profit < minProfitThreshold) revert InsufficientProfit(profit, minProfitThreshold);
        
        // 3. Calcular y transferir fee del protocolo
        uint256 protocolFee = (profit * protocolFeeBps) / 10000;
        uint256 netProfit = profit - protocolFee;
        
        if (protocolFee > 0) {
            IERC20(token).safeTransfer(treasury, protocolFee);
        }
        
        // 4. Transferir profit neto al ejecutor
        IERC20(token).safeTransfer(msg.sender, netProfit);
        
        // 5. Actualizar estadísticas
        totalExecutions++;
        totalProfitGenerated += profit;
        totalFeesCollected += protocolFee;
        
        emit ArbitrageExecuted(msg.sender, token, amount, profit, protocolFee);
        
        return profit;
    }
    
    /**
     * @notice Callback del flash loan - ejecuta la lógica de arbitraje
     * @param token Token prestado
     * @param amount Cantidad prestada
     * @param fee Fee del flash loan
     * @param data Datos codificados (path, minProfit)
     */
    function onFlashLoan(
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) external override {
        // Solo el Vault puede llamar esta función
        require(msg.sender == address(vault), "Unauthorized caller");
        
        // Decodificar datos
        (address[] memory path, uint256 minProfit) = abi.decode(data, (address[], uint256));
        
        // Ejecutar swaps en la ruta especificada
        uint256 currentAmount = amount;
        
        // Path format: [dex1, dex2, ..., token1, token2, ...]
        // Separar DEXs y tokens
        uint256 numDexs = path.length / 2;
        
        for (uint256 i = 0; i < numDexs; i++) {
            address dexRouter = path[i];
            address tokenIn = (i == 0) ? token : path[numDexs + i];
            address tokenOut = path[numDexs + i + 1];
            
            if (!approvedDexRouters[dexRouter]) revert UnauthorizedDexRouter(dexRouter);
            
            // Ejecutar swap en el DEX
            currentAmount = _executeSwap(dexRouter, tokenIn, tokenOut, currentAmount);
        }
        
        // Verificar que tenemos suficiente para repagar el flash loan + fee
        uint256 amountToRepay = amount + fee;
        
        if (currentAmount < amountToRepay) revert FlashLoanFailed();
        
        // Aprobar al Vault para tomar el repago
        IERC20(token).safeApprove(address(vault), amountToRepay);
    }
    
    /**
     * @notice Ejecuta un swap individual en un DEX
     * @param dexRouter Dirección del router del DEX
     * @param tokenIn Token de entrada
     * @param tokenOut Token de salida
     * @param amountIn Cantidad de entrada
     * @return amountOut Cantidad recibida
     */
    function _executeSwap(
        address dexRouter,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal returns (uint256 amountOut) {
        // Aprobar el DEX para gastar tokens
        IERC20(tokenIn).safeApprove(dexRouter, amountIn);
        
        // Preparar path para el swap (Uniswap V2 style)
        address[] memory swapPath = new address[](2);
        swapPath[0] = tokenIn;
        swapPath[1] = tokenOut;
        
        // Balance antes del swap
        uint256 balanceBefore = IERC20(tokenOut).balanceOf(address(this));
        
        // Ejecutar swap (usando interface genérica de Uniswap V2)
        // En producción, esto debería adaptarse a cada DEX específico
        (bool success, ) = dexRouter.call(
            abi.encodeWithSignature(
                "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)",
                amountIn,
                0, // amountOutMin = 0 (ya validamos profit después)
                swapPath,
                address(this),
                block.timestamp + 300 // 5 minutos deadline
            )
        );
        
        if (!success) revert SwapFailed(dexRouter, tokenIn, tokenOut);
        
        // Calcular cantidad recibida
        uint256 balanceAfter = IERC20(tokenOut).balanceOf(address(this));
        amountOut = balanceAfter - balanceBefore;
        
        if (amountOut == 0) revert SwapFailed(dexRouter, tokenIn, tokenOut);
        
        return amountOut;
    }
    
    /**
     * @notice Swap simple (sin flash loan)
     * @param tokenIn Token de entrada
     * @param tokenOut Token de salida
     * @param amountIn Cantidad de entrada
     * @return amountOut Cantidad recibida
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external override nonReentrant returns (uint256 amountOut) {
        if (!approvedTokens[tokenIn] || !approvedTokens[tokenOut]) {
            revert UnauthorizedToken(tokenIn);
        }
        
        // Transferir tokens del usuario
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        
        // Ejecutar swap (usando primer DEX aprobado - en producción usar mejor ruta)
        // Esta es una implementación simplificada
        
        // Transferir tokens de vuelta al usuario
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);
        
        return amountOut;
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Aprueba o desaprueba un DEX router (dinámico, desde Sheets)
     */
    function setDexRouterApproval(address router, bool approved) external onlyOwner {
        if (router == address(0)) revert ZeroAddress();
        approvedDexRouters[router] = approved;
        emit DexRouterApproved(router, approved);
    }
    
    /**
     * @notice Aprueba o desaprueba un token (dinámico, desde Sheets)
     */
    function setTokenApproval(address token, bool approved) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        approvedTokens[token] = approved;
        emit TokenApproved(token, approved);
    }
    
    /**
     * @notice Actualiza el fee del protocolo
     */
    function setProtocolFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 1000, "Fee too high"); // Max 10%
        uint256 oldFee = protocolFeeBps;
        protocolFeeBps = newFeeBps;
        emit ProtocolFeeUpdated(oldFee, newFeeBps);
    }
    
    /**
     * @notice Actualiza la dirección del treasury
     */
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }
    
    /**
     * @notice Actualiza el profit mínimo requerido
     */
    function setMinProfitThreshold(uint256 newThreshold) external onlyOwner {
        uint256 oldThreshold = minProfitThreshold;
        minProfitThreshold = newThreshold;
        emit MinProfitThresholdUpdated(oldThreshold, newThreshold);
    }
    
    /**
     * @notice Actualiza la dirección del Vault
     */
    function setVault(address newVault) external onlyOwner {
        if (newVault == address(0)) revert ZeroAddress();
        vault = IVault(newVault);
    }
    
    /**
     * @notice Rescata tokens atrapados (emergencia)
     */
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Obtiene estadísticas del router
     */
    function getStats() external view returns (
        uint256 executions,
        uint256 profitGenerated,
        uint256 feesCollected
    ) {
        return (totalExecutions, totalProfitGenerated, totalFeesCollected);
    }
    
    /**
     * @notice Verifica si un DEX está aprobado
     */
    function isDexApproved(address router) external view returns (bool) {
        return approvedDexRouters[router];
    }
    
    /**
     * @notice Verifica si un token está aprobado
     */
    function isTokenApproved(address token) external view returns (bool) {
        return approvedTokens[token];
    }
}
