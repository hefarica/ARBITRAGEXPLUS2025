/**
 * ============================================================================
 * CONTRATO: 
 * ARCHIVO: ./contracts/interfaces/IFlashLoanCallbacks.sol
 * PRIORIDAD: P0 (CRÍTICO - ON-CHAIN)
 * ============================================================================
 * 
 * 📥 ENTRADA:
 *   FUNCIONES: receiveFlashLoan, executeOperation, uniswapV3FlashCallback
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

/**
 * @title IFlashLoanCallbacks
 * @notice Interfaces para callbacks de flash loans de múltiples protocolos
 * @dev Implementar según el protocolo de flash loan que se vaya a usar
 */

// Aave V3 Flash Loan Callback
interface IAaveFlashLoanReceiver {
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}

// Balancer Flash Loan Callback
interface IBalancerFlashLoanReceiver {
    function receiveFlashLoan(
        address[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        bytes memory userData
    ) external;
}

// Uniswap V3 Flash Callback
interface IUniswapV3FlashCallback {
    function uniswapV3FlashCallback(
        uint256 fee0,
        uint256 fee1,
        bytes calldata data
    ) external;
}

// dYdX Flash Loan Callback
interface IDyDxFlashLoanReceiver {
    function callFunction(
        address sender,
        address account,
        bytes calldata data
    ) external;
}

