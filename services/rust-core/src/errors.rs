/**
 * ============================================================================
 * ARCHIVO: ./services/rust-core/src/errors.rs
 * MÓDULO: Rust Engine
 * ============================================================================
 * 
 * 📥 ENTRADA:
 * 
 * 🔄 TRANSFORMACIÓN:
 * 
 * 📤 SALIDA:
 * 
 * 🔗 DEPENDENCIAS:
 * 
 * ============================================================================
 */

//! Custom error types for the core engine.
#[derive(Debug, thiserror::Error)]
pub enum CoreError {
    #[error("Invalid input: {0}")]
    InvalidInput(String),
    #[error("Computation error: {0}")]
    Computation(String),
}