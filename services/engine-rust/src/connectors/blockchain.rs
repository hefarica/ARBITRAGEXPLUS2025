//! Blockchain Connector - Multi-chain RPC Interface
//! 
//! Este módulo implementa el conector a múltiples blockchains para:
//! - Consultar balances y allowances
//! - Estimar gas y costos de transacciones
//! - Ejecutar transacciones (swaps, flash loans)
//! - Monitorear estado de la red
//! - Interactuar con contratos inteligentes

use serde::{Deserialize, Serialize};
use reqwest::Client;
use std::collections::HashMap;
use std::time::Duration;
use anyhow::{Context, Result};

// ==================================================================================
// TYPES & STRUCTS
// ==================================================================================

/// Configuración de una blockchain
#[derive(Debug, Clone)]
pub struct ChainConfig {
    pub chain_id: u64,
    pub name: String,
    pub rpc_url: String,
    pub explorer_url: String,
    pub native_token: String,
    pub is_active: bool,
}

/// Cliente de blockchain
pub struct BlockchainConnector {
    chains: HashMap<u64, ChainConfig>,
    client: Client,
    request_timeout: Duration,
}

/// Información de balance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BalanceInfo {
    pub address: String,
    pub token: String,
    pub balance: String,
    pub balance_formatted: f64,
    pub decimals: u8,
}

/// Información de gas
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GasInfo {
    pub gas_price_gwei: f64,
    pub gas_limit: u64,
    pub estimated_cost_eth: f64,
    pub estimated_cost_usd: f64,
}

/// Parámetros de transacción
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionParams {
    pub from: String,
    pub to: String,
    pub data: String,
    pub value: String,
    pub gas_limit: Option<u64>,
    pub gas_price: Option<String>,
    pub nonce: Option<u64>,
}

/// Resultado de transacción
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionResult {
    pub tx_hash: String,
    pub status: TransactionStatus,
    pub block_number: Option<u64>,
    pub gas_used: Option<u64>,
    pub effective_gas_price: Option<String>,
}

/// Estado de transacción
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TransactionStatus {
    Pending,
    Confirmed,
    Failed,
    Reverted,
}

/// Request JSON-RPC
#[derive(Debug, Serialize)]
struct JsonRpcRequest {
    jsonrpc: String,
    method: String,
    params: serde_json::Value,
    id: u64,
}

/// Response JSON-RPC
#[derive(Debug, Deserialize)]
struct JsonRpcResponse {
    jsonrpc: String,
    id: u64,
    result: Option<serde_json::Value>,
    error: Option<JsonRpcError>,
}

#[derive(Debug, Deserialize)]
struct JsonRpcError {
    code: i64,
    message: String,
}

// ==================================================================================
// BLOCKCHAIN CONNECTOR IMPLEMENTATION
// ==================================================================================

impl BlockchainConnector {
    /// Crear nuevo conector de blockchain
    pub fn new(request_timeout_secs: u64) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(request_timeout_secs))
            .build()
            .expect("Failed to create HTTP client");
        
        Self {
            chains: HashMap::new(),
            client,
            request_timeout: Duration::from_secs(request_timeout_secs),
        }
    }
    
    /// Agregar configuración de chain
    pub fn add_chain(&mut self, config: ChainConfig) {
        self.chains.insert(config.chain_id, config);
    }
    
    /// Cargar chains desde lista
    pub fn load_chains(&mut self, chains: Vec<ChainConfig>) {
        self.chains.clear();
        for chain in chains {
            if chain.is_active {
                self.chains.insert(chain.chain_id, chain);
            }
        }
    }
    
    /// Obtener configuración de chain
    pub fn get_chain(&self, chain_id: u64) -> Option<&ChainConfig> {
        self.chains.get(&chain_id)
    }
    
    // ================================================================================
    // JSON-RPC METHODS
    // ================================================================================
    
    /// Ejecutar llamada JSON-RPC genérica
    async fn call_rpc(
        &self,
        chain_id: u64,
        method: &str,
        params: serde_json::Value,
    ) -> Result<serde_json::Value> {
        let chain = self.chains.get(&chain_id)
            .ok_or_else(|| anyhow::anyhow!("Chain {} not configured", chain_id))?;
        
        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            method: method.to_string(),
            params,
            id: 1,
        };
        
        let response = self.client
            .post(&chain.rpc_url)
            .json(&request)
            .send()
            .await
            .context("Failed to send RPC request")?;
        
        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "RPC request failed with status: {}",
                response.status()
            ));
        }
        
        let rpc_response: JsonRpcResponse = response
            .json()
            .await
            .context("Failed to parse RPC response")?;
        
        if let Some(error) = rpc_response.error {
            return Err(anyhow::anyhow!(
                "RPC error {}: {}",
                error.code,
                error.message
            ));
        }
        
        rpc_response.result
            .ok_or_else(|| anyhow::anyhow!("No result in RPC response"))
    }
    
    // ================================================================================
    // BLOCKCHAIN QUERIES
    // ================================================================================
    
    /// Obtener número de bloque actual
    pub async fn get_block_number(&self, chain_id: u64) -> Result<u64> {
        let result = self.call_rpc(
            chain_id,
            "eth_blockNumber",
            serde_json::json!([]),
        ).await?;
        
        let block_hex = result.as_str()
            .ok_or_else(|| anyhow::anyhow!("Invalid block number format"))?;
        
        let block_number = u64::from_str_radix(
            block_hex.trim_start_matches("0x"),
            16
        ).context("Failed to parse block number")?;
        
        Ok(block_number)
    }
    
    /// Obtener precio de gas actual
    pub async fn get_gas_price(&self, chain_id: u64) -> Result<f64> {
        let result = self.call_rpc(
            chain_id,
            "eth_gasPrice",
            serde_json::json!([]),
        ).await?;
        
        let gas_price_hex = result.as_str()
            .ok_or_else(|| anyhow::anyhow!("Invalid gas price format"))?;
        
        let gas_price_wei = u128::from_str_radix(
            gas_price_hex.trim_start_matches("0x"),
            16
        ).context("Failed to parse gas price")?;
        
        // Convertir de wei a gwei
        let gas_price_gwei = gas_price_wei as f64 / 1_000_000_000.0;
        
        Ok(gas_price_gwei)
    }
    
    /// Obtener balance de ETH/token nativo
    pub async fn get_native_balance(
        &self,
        chain_id: u64,
        address: &str,
    ) -> Result<BalanceInfo> {
        let result = self.call_rpc(
            chain_id,
            "eth_getBalance",
            serde_json::json!([address, "latest"]),
        ).await?;
        
        let balance_hex = result.as_str()
            .ok_or_else(|| anyhow::anyhow!("Invalid balance format"))?;
        
        let balance_wei = u128::from_str_radix(
            balance_hex.trim_start_matches("0x"),
            16
        ).context("Failed to parse balance")?;
        
        let balance_eth = balance_wei as f64 / 1e18;
        
        let chain = self.get_chain(chain_id).unwrap();
        
        Ok(BalanceInfo {
            address: address.to_string(),
            token: chain.native_token.clone(),
            balance: balance_wei.to_string(),
            balance_formatted: balance_eth,
            decimals: 18,
        })
    }
    
    /// Obtener balance de token ERC20
    pub async fn get_token_balance(
        &self,
        chain_id: u64,
        token_address: &str,
        wallet_address: &str,
    ) -> Result<BalanceInfo> {
        // Construir data para balanceOf(address)
        let data = format!(
            "0x70a08231000000000000000000000000{}",
            wallet_address.trim_start_matches("0x")
        );
        
        let result = self.call_rpc(
            chain_id,
            "eth_call",
            serde_json::json!([
                {
                    "to": token_address,
                    "data": data
                },
                "latest"
            ]),
        ).await?;
        
        let balance_hex = result.as_str()
            .ok_or_else(|| anyhow::anyhow!("Invalid balance format"))?;
        
        let balance = u128::from_str_radix(
            balance_hex.trim_start_matches("0x"),
            16
        ).unwrap_or(0);
        
        // Asumir 18 decimales por defecto (debería obtenerse del token)
        let balance_formatted = balance as f64 / 1e18;
        
        Ok(BalanceInfo {
            address: wallet_address.to_string(),
            token: token_address.to_string(),
            balance: balance.to_string(),
            balance_formatted,
            decimals: 18,
        })
    }
    
    /// Estimar gas para una transacción
    pub async fn estimate_gas(
        &self,
        chain_id: u64,
        params: &TransactionParams,
    ) -> Result<GasInfo> {
        let result = self.call_rpc(
            chain_id,
            "eth_estimateGas",
            serde_json::json!([{
                "from": params.from,
                "to": params.to,
                "data": params.data,
                "value": params.value
            }]),
        ).await?;
        
        let gas_hex = result.as_str()
            .ok_or_else(|| anyhow::anyhow!("Invalid gas estimate format"))?;
        
        let gas_limit = u64::from_str_radix(
            gas_hex.trim_start_matches("0x"),
            16
        ).context("Failed to parse gas estimate")?;
        
        // Obtener precio de gas actual
        let gas_price_gwei = self.get_gas_price(chain_id).await?;
        
        // Calcular costo estimado
        let estimated_cost_eth = (gas_limit as f64) * gas_price_gwei / 1e9;
        
        // TODO: Obtener precio de ETH en USD para cálculo preciso
        let eth_price_usd = 2000.0; // Placeholder
        let estimated_cost_usd = estimated_cost_eth * eth_price_usd;
        
        Ok(GasInfo {
            gas_price_gwei,
            gas_limit,
            estimated_cost_eth,
            estimated_cost_usd,
        })
    }
    
    // ================================================================================
    // TRANSACTION EXECUTION
    // ================================================================================
    
    /// Enviar transacción firmada
    pub async fn send_raw_transaction(
        &self,
        chain_id: u64,
        signed_tx: &str,
    ) -> Result<String> {
        let result = self.call_rpc(
            chain_id,
            "eth_sendRawTransaction",
            serde_json::json!([signed_tx]),
        ).await?;
        
        let tx_hash = result.as_str()
            .ok_or_else(|| anyhow::anyhow!("Invalid transaction hash format"))?
            .to_string();
        
        Ok(tx_hash)
    }
    
    /// Obtener recibo de transacción
    pub async fn get_transaction_receipt(
        &self,
        chain_id: u64,
        tx_hash: &str,
    ) -> Result<Option<TransactionResult>> {
        let result = self.call_rpc(
            chain_id,
            "eth_getTransactionReceipt",
            serde_json::json!([tx_hash]),
        ).await?;
        
        if result.is_null() {
            return Ok(None);
        }
        
        let receipt = result.as_object()
            .ok_or_else(|| anyhow::anyhow!("Invalid receipt format"))?;
        
        let status_hex = receipt.get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("0x0");
        
        let status = if status_hex == "0x1" {
            TransactionStatus::Confirmed
        } else {
            TransactionStatus::Failed
        };
        
        let block_number = receipt.get("blockNumber")
            .and_then(|v| v.as_str())
            .and_then(|s| u64::from_str_radix(s.trim_start_matches("0x"), 16).ok());
        
        let gas_used = receipt.get("gasUsed")
            .and_then(|v| v.as_str())
            .and_then(|s| u64::from_str_radix(s.trim_start_matches("0x"), 16).ok());
        
        Ok(Some(TransactionResult {
            tx_hash: tx_hash.to_string(),
            status,
            block_number,
            gas_used,
            effective_gas_price: receipt.get("effectiveGasPrice")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
        }))
    }
    
    /// Esperar confirmación de transacción
    pub async fn wait_for_confirmation(
        &self,
        chain_id: u64,
        tx_hash: &str,
        max_wait_secs: u64,
    ) -> Result<TransactionResult> {
        let start = std::time::Instant::now();
        let max_duration = Duration::from_secs(max_wait_secs);
        
        loop {
            if start.elapsed() > max_duration {
                return Err(anyhow::anyhow!("Transaction confirmation timeout"));
            }
            
            if let Some(receipt) = self.get_transaction_receipt(chain_id, tx_hash).await? {
                return Ok(receipt);
            }
            
            // Esperar 2 segundos antes de reintentar
            tokio::time::sleep(Duration::from_secs(2)).await;
        }
    }
    
    // ================================================================================
    // HEALTH & MONITORING
    // ================================================================================
    
    /// Verificar conectividad con la chain
    pub async fn is_healthy(&self, chain_id: u64) -> bool {
        self.get_block_number(chain_id).await.is_ok()
    }
    
    /// Obtener información de todas las chains
    pub async fn get_all_chains_status(&self) -> HashMap<u64, ChainStatus> {
        let mut statuses = HashMap::new();
        
        for (chain_id, chain) in &self.chains {
            let is_healthy = self.is_healthy(*chain_id).await;
            
            let block_number = if is_healthy {
                self.get_block_number(*chain_id).await.ok()
            } else {
                None
            };
            
            let gas_price = if is_healthy {
                self.get_gas_price(*chain_id).await.ok()
            } else {
                None
            };
            
            statuses.insert(*chain_id, ChainStatus {
                chain_id: *chain_id,
                name: chain.name.clone(),
                is_healthy,
                block_number,
                gas_price_gwei: gas_price,
            });
        }
        
        statuses
    }
}

/// Estado de una chain
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainStatus {
    pub chain_id: u64,
    pub name: String,
    pub is_healthy: bool,
    pub block_number: Option<u64>,
    pub gas_price_gwei: Option<f64>,
}

// ==================================================================================
// TESTS
// ==================================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_connector_creation() {
        let connector = BlockchainConnector::new(30);
        assert_eq!(connector.chains.len(), 0);
    }
    
    #[test]
    fn test_add_chain() {
        let mut connector = BlockchainConnector::new(30);
        
        let config = ChainConfig {
            chain_id: 1,
            name: "Ethereum".to_string(),
            rpc_url: "https://eth.llamarpc.com".to_string(),
            explorer_url: "https://etherscan.io".to_string(),
            native_token: "ETH".to_string(),
            is_active: true,
        };
        
        connector.add_chain(config);
        assert_eq!(connector.chains.len(), 1);
        assert!(connector.get_chain(1).is_some());
    }
}

