//! Utilities for serialization and deserialization.

use serde::{Deserialize, Serialize};

pub fn serialize_to_json<T: serde::Serialize>(value: &T) -> Result<String, serde_json::Error> {
    serde_json::to_string(value)
}

pub fn deserialize_from_json<T: serde::de::DeserializeOwned>(json: &str) -> Result<T, serde_json::Error> {
    serde_json::from_str(json)
}

#[derive(Serialize, Deserialize, Debug)]
pub struct JsonWrapper<T> {
    pub data: T,
}

