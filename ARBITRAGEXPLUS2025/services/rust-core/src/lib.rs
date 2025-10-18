/**
 * ============================================================================
 * ARCHIVO: ./ARBITRAGEXPLUS2025/services/rust-core/src/lib.rs
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
 *   - serde_utils
 *   - errors
 *   - math
 * 
 * ============================================================================
 */

pub mod domain;
pub mod math;
pub mod serde_utils;
pub mod errors;

// Re-export commonly used items
pub use errors::CoreError;