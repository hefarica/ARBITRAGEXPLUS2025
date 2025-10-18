/**
 * ============================================================================
 * ARCHIVO: ./ARBITRAGEXPLUS2025/services/engine-rust/src/main.rs
 * MÓDULO: Rust Engine
 * ============================================================================
 * 
 * 📥 ENTRADA:
 *   STRUCTS: Health
 * 
 * 🔄 TRANSFORMACIÓN:
 *   FUNCIONES: health, main
 * 
 * 📤 SALIDA:
 *   RETORNA: Health
 * 
 * 🔗 DEPENDENCIAS:
 * 
 * ============================================================================
 */

use axum::{routing::get, Router, Json};
use serde::Serialize;
use rust_core::math;

#[derive(Serialize)]
struct Health {
    status: &'static str,
}

async fn health() -> Json<Health> {
    Json(Health { status: "ok" })
}

#[tokio::main]
async fn main() {
    let app = Router::new().route("/health", get(health));
    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], 4000));
    println!("Engine listening on {}", addr);
    // Example use of rust_core to show integration
    let _ = math::sma(&[1.0, 2.0, 3.0]);
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}
