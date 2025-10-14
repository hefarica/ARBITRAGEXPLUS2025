use axum::{routing::get, Router};
use std::net::SocketAddr;

async fn solve() -> String {
    "Solve endpoint reached!".to_string()
}

async fn score() -> String {
    "Score endpoint reached!".to_string()
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/solve", get(solve))
        .route("/score", get(score));

    let addr = SocketAddr::from(([0, 0, 0, 0], 8000));
    println!("Listening on {}", addr);
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}

