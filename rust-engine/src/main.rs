use axum::{routing::get, Router};
use std::net::SocketAddr;
use rust_core::math::price_after_fee;

async fn health() -> &'static str { "ok" }
async fn quote() -> String {
    let q = price_after_fee(100.0, 30.0);
    serde_json::json!({ "px_after_fee": q }).to_string()
}

#[tokio::main]
async fn main() {
    let app = Router::new().route("/health", get(health)).route("/quote", get(quote));
    let addr = SocketAddr::from(([0,0,0,0], 8080));
    println!("engine listening on {}", addr);
    axum::Server::bind(&addr).serve(app.into_make_service()).await.unwrap();
}
