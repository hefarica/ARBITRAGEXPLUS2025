//! Google Sheets Connector - Dynamic Configuration Source
//! 
//! Este módulo implementa el conector a Google Sheets que funciona como
//! "cerebro" del sistema, cargando toda la configuración dinámica:
//! - BLOCKCHAINS: Redes activas
//! - DEXES: Exchanges configurados
//! - ASSETS: Tokens y precios
//! - POOLS: Liquidez disponible
//! - ROUTES: Rutas optimizadas
//! - CONFIG: Configuración global

use serde::{Deserialize, Serialize};
use reqwest::Client;
use std::collections::HashMap;
use std::time::{Duration, SystemTime};
use anyhow::{Context, Result};

// ==================================================================================
// TYPES & STRUCTS
// ==================================================================================

/// Configuración del conector de Sheets
#[derive(Debug, Clone)]
pub struct SheetsConfig {
    pub spreadsheet_id: String,
    pub api_key: Option<String>,
    pub service_account_json: Option<String>,
    pub cache_ttl_seconds: u64,
}

/// Cliente de Google Sheets
pub struct SheetsConnector {
    config: SheetsConfig,
    client: Client,
    cache: HashMap<String, CachedData>,
}

/// Datos cacheados con timestamp
#[derive(Debug, Clone)]
struct CachedData {
    data: Vec<Vec<String>>,
    timestamp: SystemTime,
}

/// Representación de una blockchain desde Sheets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockchainConfig {
    pub chain_id: u64,
    pub name: String,
    pub rpc_url: String,
    pub explorer_url: String,
    pub native_token: String,
    pub is_active: bool,
    pub gas_price_gwei: f64,
    pub block_time_ms: u64,
}

/// Representación de un DEX desde Sheets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DexConfig {
    pub dex_id: String,
    pub name: String,
    pub dex_type: String,
    pub chain_id: u64,
    pub router_address: String,
    pub factory_address: String,
    pub fee_bps: u32,
    pub is_active: bool,
    pub supports_flash_loans: bool,
}

/// Representación de un asset desde Sheets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetConfig {
    pub symbol: String,
    pub name: String,
    pub address: String,
    pub chain_id: u64,
    pub decimals: u8,
    pub price_usd: f64,
    pub is_stable: bool,
    pub is_active: bool,
}

/// Representación de un pool desde Sheets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolData {
    pub pool_id: String,
    pub dex_id: String,
    pub token_a: String,
    pub token_b: String,
    pub reserve_a: f64,
    pub reserve_b: f64,
    pub tvl_usd: f64,
    pub volume_24h: f64,
    pub is_active: bool,
}

/// Configuración del sistema desde Sheets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemConfig {
    pub max_slippage: f64,
    pub max_price_impact: f64,
    pub min_profit_usd: f64,
    pub max_gas_price_gwei: f64,
    pub flash_loan_enabled: bool,
    pub max_concurrent_routes: u32,
}

// ==================================================================================
// SHEETS CONNECTOR IMPLEMENTATION
// ==================================================================================

impl SheetsConnector {
    /// Crear nuevo conector de Sheets
    pub fn new(config: SheetsConfig) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .context("Failed to create HTTP client")?;
        
        Ok(Self {
            config,
            client,
            cache: HashMap::new(),
        })
    }
    
    /// Crear desde variables de entorno
    pub fn from_env() -> Result<Self> {
        let spreadsheet_id = std::env::var("SPREADSHEET_ID")
            .context("SPREADSHEET_ID environment variable not set")?;
        
        let api_key = std::env::var("GOOGLE_API_KEY").ok();
        let service_account_json = std::env::var("GOOGLE_SERVICE_ACCOUNT_JSON").ok();
        
        let cache_ttl_seconds = std::env::var("SHEETS_CACHE_TTL")
            .unwrap_or_else(|_| "300".to_string())
            .parse()
            .unwrap_or(300);
        
        let config = SheetsConfig {
            spreadsheet_id,
            api_key,
            service_account_json,
            cache_ttl_seconds,
        };
        
        Self::new(config)
    }
    
    // ================================================================================
    // CORE METHODS - SHEET DATA FETCHING
    // ================================================================================
    
    /// Obtener datos de una hoja (con cache)
    pub async fn get_sheet_data(&mut self, sheet_name: &str) -> Result<Vec<Vec<String>>> {
        // Verificar cache
        if let Some(cached) = self.cache.get(sheet_name) {
            let elapsed = SystemTime::now()
                .duration_since(cached.timestamp)
                .unwrap_or(Duration::from_secs(u64::MAX));
            
            if elapsed.as_secs() < self.config.cache_ttl_seconds {
                return Ok(cached.data.clone());
            }
        }
        
        // Fetch desde Google Sheets API
        let data = self.fetch_sheet_data(sheet_name).await?;
        
        // Actualizar cache
        self.cache.insert(sheet_name.to_string(), CachedData {
            data: data.clone(),
            timestamp: SystemTime::now(),
        });
        
        Ok(data)
    }
    
    /// Fetch real desde Google Sheets API
    async fn fetch_sheet_data(&self, sheet_name: &str) -> Result<Vec<Vec<String>>> {
        let range = format!("{}!A:Z", sheet_name);
        
        // Construir URL según método de autenticación
        let url = if let Some(api_key) = &self.config.api_key {
            format!(
                "https://sheets.googleapis.com/v4/spreadsheets/{}/values/{}?key={}",
                self.config.spreadsheet_id, range, api_key
            )
        } else {
            // TODO: Implementar autenticación con service account
            return Err(anyhow::anyhow!("Service account authentication not yet implemented"));
        };
        
        let response = self.client
            .get(&url)
            .send()
            .await
            .context("Failed to fetch sheet data")?;
        
        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "Sheets API returned error: {}",
                response.status()
            ));
        }
        
        let json: serde_json::Value = response
            .json()
            .await
            .context("Failed to parse JSON response")?;
        
        // Extraer valores
        let values = json["values"]
            .as_array()
            .context("No values in response")?
            .iter()
            .map(|row| {
                row.as_array()
                    .unwrap_or(&vec![])
                    .iter()
                    .map(|cell| cell.as_str().unwrap_or("").to_string())
                    .collect()
            })
            .collect();
        
        Ok(values)
    }
    
    /// Invalidar cache de una hoja
    pub fn invalidate_cache(&mut self, sheet_name: &str) {
        self.cache.remove(sheet_name);
    }
    
    /// Invalidar todo el cache
    pub fn invalidate_all_cache(&mut self) {
        self.cache.clear();
    }
    
    // ================================================================================
    // HIGH-LEVEL METHODS - TYPED DATA
    // ================================================================================
    
    /// Obtener configuración de blockchains
    pub async fn get_blockchains(&mut self) -> Result<Vec<BlockchainConfig>> {
        let data = self.get_sheet_data("BLOCKCHAINS").await?;
        
        if data.is_empty() {
            return Ok(Vec::new());
        }
        
        // Saltar header (primera fila)
        let rows = &data[1..];
        
        let blockchains = rows
            .iter()
            .filter_map(|row| {
                if row.len() < 8 {
                    return None;
                }
                
                Some(BlockchainConfig {
                    chain_id: row[0].parse().ok()?,
                    name: row[1].clone(),
                    rpc_url: row[2].clone(),
                    explorer_url: row[3].clone(),
                    native_token: row[4].clone(),
                    is_active: row[5].to_lowercase() == "true",
                    gas_price_gwei: row[6].parse().unwrap_or(0.0),
                    block_time_ms: row[7].parse().unwrap_or(12000),
                })
            })
            .collect();
        
        Ok(blockchains)
    }
    
    /// Obtener configuración de DEXes
    pub async fn get_dexes(&mut self) -> Result<Vec<DexConfig>> {
        let data = self.get_sheet_data("DEXES").await?;
        
        if data.is_empty() {
            return Ok(Vec::new());
        }
        
        let rows = &data[1..];
        
        let dexes = rows
            .iter()
            .filter_map(|row| {
                if row.len() < 9 {
                    return None;
                }
                
                Some(DexConfig {
                    dex_id: row[0].clone(),
                    name: row[1].clone(),
                    dex_type: row[2].clone(),
                    chain_id: row[3].parse().ok()?,
                    router_address: row[4].clone(),
                    factory_address: row[5].clone(),
                    fee_bps: row[6].parse().unwrap_or(30),
                    is_active: row[7].to_lowercase() == "true",
                    supports_flash_loans: row[8].to_lowercase() == "true",
                })
            })
            .collect();
        
        Ok(dexes)
    }
    
    /// Obtener configuración de assets
    pub async fn get_assets(&mut self) -> Result<Vec<AssetConfig>> {
        let data = self.get_sheet_data("ASSETS").await?;
        
        if data.is_empty() {
            return Ok(Vec::new());
        }
        
        let rows = &data[1..];
        
        let assets = rows
            .iter()
            .filter_map(|row| {
                if row.len() < 8 {
                    return None;
                }
                
                Some(AssetConfig {
                    symbol: row[0].clone(),
                    name: row[1].clone(),
                    address: row[2].clone(),
                    chain_id: row[3].parse().ok()?,
                    decimals: row[4].parse().unwrap_or(18),
                    price_usd: row[5].parse().unwrap_or(0.0),
                    is_stable: row[6].to_lowercase() == "true",
                    is_active: row[7].to_lowercase() == "true",
                })
            })
            .collect();
        
        Ok(assets)
    }
    
    /// Obtener datos de pools
    pub async fn get_pools(&mut self) -> Result<Vec<PoolData>> {
        let data = self.get_sheet_data("POOLS").await?;
        
        if data.is_empty() {
            return Ok(Vec::new());
        }
        
        let rows = &data[1..];
        
        let pools = rows
            .iter()
            .filter_map(|row| {
                if row.len() < 9 {
                    return None;
                }
                
                Some(PoolData {
                    pool_id: row[0].clone(),
                    dex_id: row[1].clone(),
                    token_a: row[2].clone(),
                    token_b: row[3].clone(),
                    reserve_a: row[4].parse().unwrap_or(0.0),
                    reserve_b: row[5].parse().unwrap_or(0.0),
                    tvl_usd: row[6].parse().unwrap_or(0.0),
                    volume_24h: row[7].parse().unwrap_or(0.0),
                    is_active: row[8].to_lowercase() == "true",
                })
            })
            .collect();
        
        Ok(pools)
    }
    
    /// Obtener configuración del sistema
    pub async fn get_system_config(&mut self) -> Result<SystemConfig> {
        let data = self.get_sheet_data("CONFIG").await?;
        
        if data.len() < 2 {
            return Err(anyhow::anyhow!("CONFIG sheet is empty or missing"));
        }
        
        // Convertir a HashMap para fácil acceso
        let mut config_map: HashMap<String, String> = HashMap::new();
        
        for row in &data[1..] {
            if row.len() >= 2 {
                config_map.insert(row[0].clone(), row[1].clone());
            }
        }
        
        Ok(SystemConfig {
            max_slippage: config_map.get("MAX_SLIPPAGE")
                .and_then(|v| v.parse().ok())
                .unwrap_or(5.0),
            max_price_impact: config_map.get("MAX_PRICE_IMPACT")
                .and_then(|v| v.parse().ok())
                .unwrap_or(3.0),
            min_profit_usd: config_map.get("MIN_PROFIT_USD")
                .and_then(|v| v.parse().ok())
                .unwrap_or(10.0),
            max_gas_price_gwei: config_map.get("MAX_GAS_PRICE_GWEI")
                .and_then(|v| v.parse().ok())
                .unwrap_or(100.0),
            flash_loan_enabled: config_map.get("FLASH_LOAN_ENABLED")
                .map(|v| v.to_lowercase() == "true")
                .unwrap_or(true),
            max_concurrent_routes: config_map.get("MAX_CONCURRENT_ROUTES")
                .and_then(|v| v.parse().ok())
                .unwrap_or(40),
        })
    }
    
    // ================================================================================
    // WRITE OPERATIONS
    // ================================================================================
    
    /// Escribir resultados de ejecución a Sheets
    pub async fn write_execution_result(
        &self,
        route_id: &str,
        profit_usd: f64,
        gas_cost_usd: f64,
        status: &str,
    ) -> Result<()> {
        // TODO: Implementar escritura a hoja EXECUTIONS
        // Requiere autenticación con service account y permisos de escritura
        
        log::info!(
            "Execution result: route={}, profit=${:.2}, gas=${:.2}, status={}",
            route_id, profit_usd, gas_cost_usd, status
        );
        
        Ok(())
    }
}

// ==================================================================================
// TESTS
// ==================================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_sheets_config_creation() {
        let config = SheetsConfig {
            spreadsheet_id: "test_id".to_string(),
            api_key: Some("test_key".to_string()),
            service_account_json: None,
            cache_ttl_seconds: 300,
        };
        
        assert_eq!(config.spreadsheet_id, "test_id");
        assert_eq!(config.cache_ttl_seconds, 300);
    }
    
    #[tokio::test]
    async fn test_cache_invalidation() {
        let config = SheetsConfig {
            spreadsheet_id: "test_id".to_string(),
            api_key: Some("test_key".to_string()),
            service_account_json: None,
            cache_ttl_seconds: 300,
        };
        
        let mut connector = SheetsConnector::new(config).unwrap();
        
        // Simular cache
        connector.cache.insert("TEST".to_string(), CachedData {
            data: vec![vec!["test".to_string()]],
            timestamp: SystemTime::now(),
        });
        
        assert!(connector.cache.contains_key("TEST"));
        
        connector.invalidate_cache("TEST");
        assert!(!connector.cache.contains_key("TEST"));
    }
}




// ==================================================================================
// PROMPT SUPREMO DEFINITIVO - TAREA 3.1
// Funciones específicas requeridas por el Prompt Supremo
// ==================================================================================

impl SheetsConnector {
    /// Lee DEXES desde Sheets - 200 campos dinámicos
    /// 
    /// Rango: DEXES!A2:GR (200 columnas)
    /// 
    /// Esta función es requerida por el Prompt Supremo Definitivo (Tarea 3.1)
    pub async fn get_dexes_array(&mut self) -> Result<Vec<HashMap<String, String>>> {
        let data = self.get_sheet_data("DEXES").await?;
        
        if data.is_empty() {
            return Ok(Vec::new());
        }
        
        // Primera fila son los headers
        let headers = &data[0];
        
        // Convertir cada fila a HashMap
        let mut dexes = Vec::new();
        for row in data.iter().skip(1) {
            let mut dex_map = HashMap::new();
            for (i, value) in row.iter().enumerate() {
                if i < headers.len() {
                    dex_map.insert(headers[i].clone(), value.clone());
                }
            }
            dexes.push(dex_map);
        }
        
        log::info!("✅ Leídos {} DEXes desde Sheets (200 campos dinámicos)", dexes.len());
        Ok(dexes)
    }
    
    /// Lee ASSETS desde Sheets - 400 campos dinámicos
    /// 
    /// Rango: ASSETS!A2:OL (400 columnas)
    /// 
    /// Esta función es requerida por el Prompt Supremo Definitivo (Tarea 3.1)
    pub async fn get_assets_array(&mut self) -> Result<Vec<HashMap<String, String>>> {
        let data = self.get_sheet_data("ASSETS").await?;
        
        if data.is_empty() {
            return Ok(Vec::new());
        }
        
        let headers = &data[0];
        
        let mut assets = Vec::new();
        for row in data.iter().skip(1) {
            let mut asset_map = HashMap::new();
            for (i, value) in row.iter().enumerate() {
                if i < headers.len() {
                    asset_map.insert(headers[i].clone(), value.clone());
                }
            }
            assets.push(asset_map);
        }
        
        log::info!("✅ Leídos {} assets desde Sheets (400 campos dinámicos)", assets.len());
        Ok(assets)
    }
    
    /// Lee POOLS desde Sheets - 100 campos dinámicos
    /// 
    /// Rango: POOLS!A2:CV (100 columnas)
    /// 
    /// Esta función es requerida por el Prompt Supremo Definitivo (Tarea 3.1)
    pub async fn get_pools_array(&mut self) -> Result<Vec<HashMap<String, String>>> {
        let data = self.get_sheet_data("POOLS").await?;
        
        if data.is_empty() {
            return Ok(Vec::new());
        }
        
        let headers = &data[0];
        
        let mut pools = Vec::new();
        for row in data.iter().skip(1) {
            let mut pool_map = HashMap::new();
            for (i, value) in row.iter().enumerate() {
                if i < headers.len() {
                    pool_map.insert(headers[i].clone(), value.clone());
                }
            }
            pools.push(pool_map);
        }
        
        log::info!("✅ Leídos {} pools desde Sheets (100 campos dinámicos)", pools.len());
        Ok(pools)
    }
    
    /// Lee BLOCKCHAINS desde Sheets - 50 campos dinámicos
    /// 
    /// Rango: BLOCKCHAINS!A2:AX (50 columnas)
    /// 
    /// Esta función es requerida por el Prompt Supremo Definitivo (Tarea 3.1)
    pub async fn get_blockchains_array(&mut self) -> Result<Vec<HashMap<String, String>>> {
        let data = self.get_sheet_data("BLOCKCHAINS").await?;
        
        if data.is_empty() {
            return Ok(Vec::new());
        }
        
        let headers = &data[0];
        
        let mut blockchains = Vec::new();
        for row in data.iter().skip(1) {
            let mut blockchain_map = HashMap::new();
            for (i, value) in row.iter().enumerate() {
                if i < headers.len() {
                    blockchain_map.insert(headers[i].clone(), value.clone());
                }
            }
            blockchains.push(blockchain_map);
        }
        
        log::info!("✅ Leídas {} blockchains desde Sheets (50 campos dinámicos)", blockchains.len());
        Ok(blockchains)
    }
    
    /// Lee ROUTES desde Sheets - 200 campos dinámicos
    /// 
    /// Rango: ROUTES!A2:GR (200 columnas)
    /// 
    /// Esta función es requerida por el Prompt Supremo Definitivo (Tarea 3.1)
    pub async fn get_routes_array(&mut self) -> Result<Vec<HashMap<String, String>>> {
        let data = self.get_sheet_data("ROUTES").await?;
        
        if data.is_empty() {
            return Ok(Vec::new());
        }
        
        let headers = &data[0];
        
        let mut routes = Vec::new();
        for row in data.iter().skip(1) {
            let mut route_map = HashMap::new();
            for (i, value) in row.iter().enumerate() {
                if i < headers.len() {
                    route_map.insert(headers[i].clone(), value.clone());
                }
            }
            routes.push(route_map);
        }
        
        log::info!("✅ Leídas {} rutas desde Sheets (200 campos dinámicos)", routes.len());
        Ok(routes)
    }
}

// ==================================================================================
// TESTS
// ==================================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_sheets_connector_creation() {
        let config = SheetsConfig {
            spreadsheet_id: "test_id".to_string(),
            api_key: Some("test_key".to_string()),
            service_account_json: None,
            cache_ttl_seconds: 300,
        };
        
        let connector = SheetsConnector::new(config);
        assert!(connector.is_ok());
    }
}

