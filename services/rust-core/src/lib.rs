pub mod domain;
pub mod math;
pub mod serde_utils;
pub mod errors;

pub use errors::CoreError;

pub fn health_check() -> &'static str {
    "rust-core is healthy!"
}

