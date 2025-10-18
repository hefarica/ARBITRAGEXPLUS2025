/**
 * ============================================================================
 * ARCHIVO: ./services/rust-core/src/math/mod.rs
 * MÓDULO: Rust Engine
 * ============================================================================
 * 
 * 📥 ENTRADA:
 * 
 * 🔄 TRANSFORMACIÓN:
 *   FUNCIONES: sma
 * 
 * 📤 SALIDA:
 * 
 * 🔗 DEPENDENCIAS:
 * 
 * ============================================================================
 */

//! Mathematical utilities for pricing and risk calculations.

/// Compute a simple moving average for demonstration purposes.
pub fn sma(data: &[f64]) -> Option<f64> {
    if data.is_empty() {
        None
    } else {
        Some(data.iter().sum::<f64>() / data.len() as f64)
    }
}