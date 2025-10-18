/**
 * ============================================================================
 * ARCHIVO: ./services/rust-core/src/domain/mod.rs
 * MÓDULO: Rust Engine
 * ============================================================================
 * 
 * 📥 ENTRADA:
 *   STRUCTS: Asset
 * 
 * 🔄 TRANSFORMACIÓN:
 * 
 * 📤 SALIDA:
 *   RETORNA: Asset
 * 
 * 🔗 DEPENDENCIAS:
 * 
 * ============================================================================
 */

//! Domain models for the arbitrage engine.

#[derive(Debug, Clone)]
pub struct Asset {
    pub symbol: String,
    pub address: String,
}

// Additional domain structs (Position, Pool, Order) will live here.