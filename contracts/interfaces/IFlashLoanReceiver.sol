/**
 * ============================================================================
 * CONTRATO: 
 * ARCHIVO: ./contracts/interfaces/IFlashLoanReceiver.sol
 * PRIORIDAD: P0 (CRÍTICO - ON-CHAIN)
 * ============================================================================
 * 
 * 📥 ENTRADA:
 *   FUNCIONES: executeOperation
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
pragma solidity ^0.8.20;

interface IFlashLoanReceiver {
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}
