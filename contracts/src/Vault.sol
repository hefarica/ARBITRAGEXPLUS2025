/**
 * ============================================================================
 * CONTRATO: Vault
 * ARCHIVO: ./contracts/src/Vault.sol
 * PRIORIDAD: P0 (CRÍTICO - ON-CHAIN)
 * ============================================================================
 * 
 * 📥 ENTRADA:
 *   FUNCIONES: calculateFlashLoanFee, setMaxFlashLoanPercentage, getAvailableLiquidity
 * 
 * 🔄 LÓGICA:
 * 
 * 📤 SALIDA:
 *   EVENTOS: LiquidityWithdrawn, LiquidityDeposited, FlashLoanExecuted
 * 
 * 🔒 SEGURIDAD:
 *   - Reentrancy guard
 *   - Access control
 * 
 * ============================================================================
 */

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IVault.sol";
import "./interfaces/IRouter.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title Vault
 * @notice Vault principal para gestión de liquidez y flash loans
 * @dev Implementa flash loans con protección reentrancy y pausable
 * 
 * Premisas:
 * 1. Parámetros de liquidez desde Google Sheets (no hardcoded)
 * 2. Soporta arrays dinámicos de tokens
 * 3. Consumido por el Router para flash loans
 */
contract Vault is IVault, ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;
    
    // ============ State Variables ============
    
    // Router autorizado para flash loans
    address public router;
    
    // Fee del flash loan (en basis points, 100 = 1%)
    uint256 public flashLoanFeeBps = 9; // 0.09% default (competitivo con Aave)
    
    // Mapeo de tokens soportados (dinámico, desde Sheets)
    mapping(address => bool) public supportedTokens;
    
    // Mapeo de liquidez disponible por token
    mapping(address => uint256) public tokenLiquidity;
    
    // Mapeo de liquidez reservada (en flash loans activos)
    mapping(address => uint256) public reservedLiquidity;
    
    // Límite máximo de flash loan por token (% de liquidez total)
    mapping(address => uint256) public maxFlashLoanPercentage;
    
    // Estadísticas de flash loans
    uint256 public totalFlashLoans;
    uint256 public totalVolumeFlashLoans;
    uint256 public totalFeesGenerated;
    
    // Mapeo de proveedores de liquidez
    mapping(address => mapping(address => uint256)) public liquidityProviders;
    
    // ============ Events ============
    
    event FlashLoanExecuted(
        address indexed borrower,
        address indexed token,
        uint256 amount,
        uint256 fee
    );
    
    event LiquidityDeposited(
        address indexed provider,
        address indexed token,
        uint256 amount
    );
    
    event LiquidityWithdrawn(
        address indexed provider,
        address indexed token,
        uint256 amount
    );
    
    event TokenSupportUpdated(address indexed token, bool supported);
    event FlashLoanFeeUpdated(uint256 oldFee, uint256 newFee);
    event RouterUpdated(address indexed oldRouter, address indexed newRouter);
    event MaxFlashLoanPercentageUpdated(address indexed token, uint256 percentage);
    
    // ============ Errors ============
    
    error UnauthorizedRouter(address caller);
    error UnsupportedToken(address token);
    error InsufficientLiquidity(uint256 requested, uint256 available);
    error FlashLoanNotRepaid(uint256 expected, uint256 received);
    error ZeroAddress();
    error ZeroAmount();
    error ExceedsMaxFlashLoan(uint256 requested, uint256 max);
    
    // ============ Constructor ============
    
    constructor(address _router) Ownable(msg.sender) {
        if (_router == address(0)) revert ZeroAddress();
        router = _router;
        
        // Default: permitir flash loans de hasta 80% de la liquidez
        // Se puede ajustar por token desde Sheets
    }
    
    // ============ Flash Loan Functions ============
    
    /**
     * @notice Ejecuta un flash loan
     * @param token Token a prestar
     * @param amount Cantidad a prestar
     * @param data Datos para pasar al callback
     */
    function flashLoan(
        address token,
        uint256 amount,
        bytes calldata data
    ) external override nonReentrant whenNotPaused {
        if (msg.sender != router) revert UnauthorizedRouter(msg.sender);
        if (!supportedTokens[token]) revert UnsupportedToken(token);
        if (amount == 0) revert ZeroAmount();
        
        // Verificar liquidez disponible
        uint256 availableLiquidity = tokenLiquidity[token] - reservedLiquidity[token];
        if (amount > availableLiquidity) {
            revert InsufficientLiquidity(amount, availableLiquidity);
        }
        
        // Verificar límite máximo de flash loan
        uint256 maxPercentage = maxFlashLoanPercentage[token];
        if (maxPercentage > 0) {
            uint256 maxAmount = (tokenLiquidity[token] * maxPercentage) / 10000;
            if (amount > maxAmount) {
                revert ExceedsMaxFlashLoan(amount, maxAmount);
            }
        }
        
        // Calcular fee
        uint256 fee = (amount * flashLoanFeeBps) / 10000;
        uint256 amountToRepay = amount + fee;
        
        // Reservar liquidez
        reservedLiquidity[token] += amount;
        
        // Balance antes del préstamo
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        
        // Transferir tokens al router
        IERC20(token).safeTransfer(router, amount);
        
        // Llamar al callback del router para ejecutar arbitraje
        IRouter(router).onFlashLoan(token, amount, fee, data);
        
        // Verificar que el préstamo fue repagado
        uint256 balanceAfter = IERC20(token).balanceOf(address(this));
        
        if (balanceAfter < balanceBefore + fee) {
            revert FlashLoanNotRepaid(balanceBefore + fee, balanceAfter);
        }
        
        // Liberar liquidez reservada
        reservedLiquidity[token] -= amount;
        
        // Actualizar liquidez total (incluye fee)
        tokenLiquidity[token] += fee;
        
        // Actualizar estadísticas
        totalFlashLoans++;
        totalVolumeFlashLoans += amount;
        totalFeesGenerated += fee;
        
        emit FlashLoanExecuted(router, token, amount, fee);
    }
    
    // ============ Liquidity Provider Functions ============
    
    /**
     * @notice Deposita liquidez en el vault
     * @param token Token a depositar
     * @param amount Cantidad a depositar
     */
    function depositLiquidity(
        address token,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        if (!supportedTokens[token]) revert UnsupportedToken(token);
        if (amount == 0) revert ZeroAmount();
        
        // Transferir tokens del proveedor
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        // Actualizar balances
        liquidityProviders[msg.sender][token] += amount;
        tokenLiquidity[token] += amount;
        
        emit LiquidityDeposited(msg.sender, token, amount);
    }
    
    /**
     * @notice Retira liquidez del vault
     * @param token Token a retirar
     * @param amount Cantidad a retirar
     */
    function withdrawLiquidity(
        address token,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        
        uint256 providerBalance = liquidityProviders[msg.sender][token];
        require(providerBalance >= amount, "Insufficient balance");
        
        // Verificar que hay liquidez disponible (no reservada)
        uint256 availableLiquidity = tokenLiquidity[token] - reservedLiquidity[token];
        if (amount > availableLiquidity) {
            revert InsufficientLiquidity(amount, availableLiquidity);
        }
        
        // Actualizar balances
        liquidityProviders[msg.sender][token] -= amount;
        tokenLiquidity[token] -= amount;
        
        // Transferir tokens al proveedor
        IERC20(token).safeTransfer(msg.sender, amount);
        
        emit LiquidityWithdrawn(msg.sender, token, amount);
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Añade o remueve soporte para un token (dinámico, desde Sheets)
     */
    function setSupportedToken(address token, bool supported) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        supportedTokens[token] = supported;
        
        // Si es un nuevo token, establecer límite por defecto
        if (supported && maxFlashLoanPercentage[token] == 0) {
            maxFlashLoanPercentage[token] = 8000; // 80% default
        }
        
        emit TokenSupportUpdated(token, supported);
    }
    
    /**
     * @notice Actualiza el fee del flash loan
     */
    function setFlashLoanFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 100, "Fee too high"); // Max 1%
        uint256 oldFee = flashLoanFeeBps;
        flashLoanFeeBps = newFeeBps;
        emit FlashLoanFeeUpdated(oldFee, newFeeBps);
    }
    
    /**
     * @notice Actualiza el router autorizado
     */
    function setRouter(address newRouter) external onlyOwner {
        if (newRouter == address(0)) revert ZeroAddress();
        address oldRouter = router;
        router = newRouter;
        emit RouterUpdated(oldRouter, newRouter);
    }
    
    /**
     * @notice Actualiza el porcentaje máximo de flash loan para un token
     */
    function setMaxFlashLoanPercentage(address token, uint256 percentage) external onlyOwner {
        require(percentage <= 10000, "Percentage too high"); // Max 100%
        maxFlashLoanPercentage[token] = percentage;
        emit MaxFlashLoanPercentageUpdated(token, percentage);
    }
    
    /**
     * @notice Pausa el contrato (emergencia)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Despausa el contrato
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Rescata tokens atrapados (emergencia)
     */
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        require(!supportedTokens[token], "Cannot rescue supported token");
        IERC20(token).safeTransfer(owner(), amount);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Obtiene la liquidez disponible para flash loans
     */
    function getAvailableLiquidity(address token) external view returns (uint256) {
        return tokenLiquidity[token] - reservedLiquidity[token];
    }
    
    /**
     * @notice Obtiene el máximo flash loan permitido para un token
     */
    function getMaxFlashLoan(address token) external view returns (uint256) {
        uint256 percentage = maxFlashLoanPercentage[token];
        if (percentage == 0) return 0;
        
        uint256 availableLiquidity = tokenLiquidity[token] - reservedLiquidity[token];
        return (availableLiquidity * percentage) / 10000;
    }
    
    /**
     * @notice Calcula el fee para un flash loan
     */
    function calculateFlashLoanFee(uint256 amount) external view returns (uint256) {
        return (amount * flashLoanFeeBps) / 10000;
    }
    
    /**
     * @notice Obtiene el balance de un proveedor de liquidez
     */
    function getProviderBalance(address provider, address token) external view returns (uint256) {
        return liquidityProviders[provider][token];
    }
    
    /**
     * @notice Obtiene estadísticas del vault
     */
    function getStats() external view returns (
        uint256 flashLoans,
        uint256 volumeFlashLoans,
        uint256 feesGenerated
    ) {
        return (totalFlashLoans, totalVolumeFlashLoans, totalFeesGenerated);
    }
    
    /**
     * @notice Verifica si un token está soportado
     */
    function isTokenSupported(address token) external view returns (bool) {
        return supportedTokens[token];
    }
    
    /**
     * @notice Obtiene información completa de liquidez para un token
     */
    function getTokenLiquidityInfo(address token) external view returns (
        uint256 total,
        uint256 reserved,
        uint256 available,
        uint256 maxFlashLoan
    ) {
        total = tokenLiquidity[token];
        reserved = reservedLiquidity[token];
        available = total - reserved;
        
        uint256 percentage = maxFlashLoanPercentage[token];
        maxFlashLoan = (available * percentage) / 10000;
        
        return (total, reserved, available, maxFlashLoan);
    }
}
