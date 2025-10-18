/**
 * ============================================================================
 * ARCHIVO: ./services/rust-core/src/serde_utils/mod.rs
 * MÓDULO: Rust Engine
 * ============================================================================
 * 
 * 📥 ENTRADA:
 *   STRUCTS: JsonWrapper
 * 
 * 🔄 TRANSFORMACIÓN:
 * 
 * 📤 SALIDA:
 *   RETORNA: JsonWrapper
 * 
 * 🔗 DEPENDENCIAS:
 * 
 * ============================================================================
 */

//! Serialization helpers for the core engine.
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct JsonWrapper<T> {
    pub data: T,
}