/**
 * ============================================================================
 * ARCHIVO: ./services/engine-rust/src/utils/mod.rs
 * MÓDULO: Rust Engine
 * ============================================================================
 * 
 * 📥 ENTRADA:
 * 
 * 🔄 TRANSFORMACIÓN:
 *   FUNCIONES: format_currency, calculate_roi
 * 
 * 📤 SALIDA:
 * 
 * 🔗 DEPENDENCIAS:
 * 
 * ============================================================================
 */

//! Utility functions

pub fn format_currency(amount: f64) -> String {
    format!("${:.2}", amount)
}

pub fn calculate_roi(profit: f64, investment: f64) -> f64 {
    (profit / investment) * 100.0
}
