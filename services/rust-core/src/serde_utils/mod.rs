//! Serialization helpers for the core engine.
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct JsonWrapper<T> {
    pub data: T,
}