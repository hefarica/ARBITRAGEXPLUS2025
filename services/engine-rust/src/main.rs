// ARBITRAGEXPLUS2025 - Rust Engine Main Module
// 
// Motor principal de cálculo para arbitraje DeFi implementado en Rust.
// Este módulo coordina todos los algoritmos de pathfinding, pricing y optimización.
// 
// Características principales:
// - Algoritmos de pathfinding optimizados para 2-DEX y 3-DEX
// - Cálculos de ROI y ranking de rutas en tiempo real
// - Optimización usando programación dinámica
// - Procesamiento paralelo para máximo rendimiento
// - Integración con Google Sheets para configuración dinámica

use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::time::sleep;
use serde::{Deserialize, Serialize};
use log::{info, warn, error, debug};

mod pathfinding;
mod pricing;
mod engine;
mod utils;
mod connectors;

use pathfinding::{PathFinder, RouteOptimizer};
use pricing::{PriceEngine, PriceData};
use engine::ArbitrageEngine;
use utils::{Config, Logger, PerformanceMetrics};
use connectors::{SheetsConnector, BlockchainConnector};

/// Configuración de una blockchain cargada desde Google Sheets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockchainConfig {
    pub chain_id: u64,
    pub chain_name: String,
    pub native_token: String,
    pub rpc_endpoint: String,
    pub gas_price_gwei: f64,
    pub block_time: u64,
    pub health_status: String,
}

/// Configuración de un DEX cargada desde Google Sheets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DexConfig {
    pub dex_id: String,
    pub dex_name: String,
    pub chain_id: u64,
    pub router_address: String,
    pub factory_address: String,
    pub fee_percentage: f64,
    pub tvl_usd: f64,
    pub status: String,
}

/// Configuración de un asset cargada desde Google Sheets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetConfig {
    pub token_symbol: String,
    pub token_name: String,
    pub token_address: String,
    pub decimals: u8,
    pub chain_id: u64,
    pub current_price_usd: f64,
    pub liquidity_usd: f64,
    pub is_stablecoin: bool,
}

/// Configuración de un pool cargada desde Google Sheets  
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolConfig {
    pub pool_id: String,
    pub dex_id: String,
    pub token_a: String,
    pub token_b: String,
    pub reserves_a: f64,
    pub reserves_b: f64,
    pub liquidity_usd: f64,
    pub fee_tier: u32,
}

/// Ruta de arbitraje generada por el motor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArbitrageRoute {
    pub route_id: String,
    pub source_token: String,
    pub target_token: String,
    pub intermediate_token: Option<String>,
    pub dex_path: Vec<String>,
    pub input_amount: f64,
    pub expected_output: f64,
    pub net_profit_usd: f64,
    pub roi_percentage: f64,
    pub gas_cost_usd: f64,
    pub execution_time_estimate: u64,
    pub confidence_score: f64,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Resultado de optimización de rutas
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationResult {
    pub routes: Vec<ArbitrageRoute>,
    pub total_opportunities: usize,
    pub profitable_routes: usize,
    pub best_roi: f64,
    pub total_potential_profit: f64,
    pub computation_time_ms: u64,
}

/// Motor principal del sistema de arbitraje
pub struct RustArbitrageEngine {
    // Configuración dinámica (cargada desde Google Sheets)
    blockchains: Arc<Mutex<Vec<BlockchainConfig>>>,
    dexes: Arc<Mutex<Vec<DexConfig>>>,
    assets: Arc<Mutex<Vec<AssetConfig>>>,
    pools: Arc<Mutex<Vec<PoolConfig>>>,
    
    // Componentes principales
    sheets_connector: Arc<SheetsConnector>,
    blockchain_connector: Arc<BlockchainConnector>,
    path_finder: Arc<PathFinder>,
    price_engine: Arc<PriceEngine>,
    route_optimizer: Arc<RouteOptimizer>,
    arbitrage_engine: Arc<ArbitrageEngine>,
    
    // Estado del sistema
    is_running: Arc<Mutex<bool>>,
    last_config_update: Arc<Mutex<Instant>>,
    performance_metrics: Arc<Mutex<PerformanceMetrics>>,
    
    // Configuración del motor
    config: Config,
    logger: Logger,
}

impl RustArbitrageEngine {
    /// Crear nueva instancia del motor
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let config = Config::from_env()?;
        let logger = Logger::new("RustArbitrageEngine");
        
        info!("🦀 Inicializando Rust Arbitrage Engine...");
        
        Ok(Self {
            blockchains: Arc::new(Mutex::new(Vec::new())),
            dexes: Arc::new(Mutex::new(Vec::new())),
            assets: Arc::new(Mutex::new(Vec::new())),
            pools: Arc::new(Mutex::new(Vec::new())),
            
            sheets_connector: Arc::new(SheetsConnector::new(&config)?),
            blockchain_connector: Arc::new(BlockchainConnector::new(&config)?),
            path_finder: Arc::new(PathFinder::new(&config)?),
            price_engine: Arc::new(PriceEngine::new(&config)?),
            route_optimizer: Arc::new(RouteOptimizer::new(&config)?),
            arbitrage_engine: Arc::new(ArbitrageEngine::new(&config)?),
            
            is_running: Arc::new(Mutex::new(false)),
            last_config_update: Arc::new(Mutex::new(Instant::now())),
            performance_metrics: Arc::new(Mutex::new(PerformanceMetrics::new())),
            
            config,
            logger,
        })
    }
    
    /// Inicializar el motor completo
    pub async fn initialize(&self) -> Result<(), Box<dyn std::error::Error>> {
        info!("🔧 Inicializando componentes del motor...");
        
        // 1. Inicializar conectores
        self.sheets_connector.initialize().await?;
        self.blockchain_connector.initialize().await?;
        
        // 2. Cargar configuración inicial desde Google Sheets
        self.load_configuration_from_sheets().await?;
        
        // 3. Inicializar componentes con configuración
        self.initialize_components().await?;
        
        // 4. Validar configuración mínima
        self.validate_configuration()?;
        
        info!("✅ Rust Arbitrage Engine inicializado correctamente");
        Ok(())
    }
    
    /// Cargar configuración desde Google Sheets
    async fn load_configuration_from_sheets(&self) -> Result<(), Box<dyn std::error::Error>> {
        info!("📊 Cargando configuración desde Google Sheets...");
        
        // Cargar datos de las hojas principales
        let blockchains_data = self.sheets_connector.get_sheet_data("BLOCKCHAINS").await?;
        let dexes_data = self.sheets_connector.get_sheet_data("DEXES").await?;
        let assets_data = self.sheets_connector.get_sheet_data("ASSETS").await?;
        let pools_data = self.sheets_connector.get_sheet_data("POOLS").await?;
        
        // Parsear y almacenar configuración
        {
            let mut blockchains = self.blockchains.lock().unwrap();
            *blockchains = self.parse_blockchains_config(blockchains_data)?;
        }
        
        {
            let mut dexes = self.dexes.lock().unwrap();
            *dexes = self.parse_dexes_config(dexes_data)?;
        }
        
        {
            let mut assets = self.assets.lock().unwrap();
            *assets = self.parse_assets_config(assets_data)?;
        }
        
        {
            let mut pools = self.pools.lock().unwrap();
            *pools = self.parse_pools_config(pools_data)?;
        }
        
        // Actualizar timestamp de última configuración
        {
            let mut last_update = self.last_config_update.lock().unwrap();
            *last_update = Instant::now();
        }
        
        let blockchains_count = self.blockchains.lock().unwrap().len();
        let dexes_count = self.dexes.lock().unwrap().len();
        let assets_count = self.assets.lock().unwrap().len();
        let pools_count = self.pools.lock().unwrap().len();
        
        info!("📈 Configuración cargada: {} chains, {} DEXes, {} assets, {} pools", 
              blockchains_count, dexes_count, assets_count, pools_count);
        
        Ok(())
    }
    
    /// Inicializar componentes con la configuración cargada
    async fn initialize_components(&self) -> Result<(), Box<dyn std::error::Error>> {
        info!("⚙️ Inicializando componentes con configuración...");
        
        let blockchains = self.blockchains.lock().unwrap().clone();
        let dexes = self.dexes.lock().unwrap().clone();
        let assets = self.assets.lock().unwrap().clone();
        let pools = self.pools.lock().unwrap().clone();
        
        // Inicializar path finder con configuración de DEXes y pools
        self.path_finder.initialize(&dexes, &pools).await?;
        
        // Inicializar price engine con assets
        self.price_engine.initialize(&assets, &pools).await?;
        
        // Inicializar route optimizer
        self.route_optimizer.initialize(&dexes, &assets, &pools).await?;
        
        // Inicializar arbitrage engine
        self.arbitrage_engine.initialize(&blockchains, &dexes).await?;
        
        info!("✅ Todos los componentes inicializados");
        Ok(())
    }
    
    /// Validar que tenemos configuración mínima
    fn validate_configuration(&self) -> Result<(), Box<dyn std::error::Error>> {
        let blockchains_count = self.blockchains.lock().unwrap().len();
        let dexes_count = self.dexes.lock().unwrap().len();
        let assets_count = self.assets.lock().unwrap().len();
        
        if blockchains_count == 0 {
            return Err("No blockchains configured in Google Sheets".into());
        }
        
        if dexes_count < 2 {
            return Err("Need at least 2 DEXes for arbitrage".into());
        }
        
        if assets_count == 0 {
            return Err("No assets configured in Google Sheets".into());
        }
        
        info!("✅ Configuración mínima validada");
        Ok(())
    }
    
    /// Iniciar el motor de arbitraje
    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error>> {
        {
            let mut running = self.is_running.lock().unwrap();
            *running = true;
        }
        
        info!("🚀 Iniciando Rust Arbitrage Engine...");
        
        // Inicializar si no se ha hecho
        if !self.sheets_connector.is_initialized() {
            self.initialize().await?;
        }
        
        // Crear tareas concurrentes
        let engine_clone = self.clone_arc();
        
        let main_loop_task = tokio::spawn(async move {
            engine_clone.main_loop().await;
        });
        
        let config_update_task = tokio::spawn(async move {
            let engine = self.clone_arc();
            engine.configuration_update_loop().await;
        });
        
        // Esperar a que todas las tareas terminen
        tokio::try_join!(main_loop_task, config_update_task)?;
        
        Ok(())
    }
    
    /// Loop principal del motor
    async fn main_loop(&self) {
        info!("🔄 Iniciando loop principal del motor...");
        
        let mut last_optimization = Instant::now();
        let optimization_interval = Duration::from_secs(self.config.optimization_interval_seconds);
        
        while self.is_running() {
            let start_time = Instant::now();
            
            match self.execute_arbitrage_cycle().await {
                Ok(result) => {
                    debug!("✅ Ciclo de arbitraje completado: {} rutas generadas", result.routes.len());
                    
                    // Actualizar métricas de rendimiento
                    {
                        let mut metrics = self.performance_metrics.lock().unwrap();
                        metrics.add_cycle_time(start_time.elapsed());
                        metrics.add_routes_generated(result.routes.len());
                    }
                    
                    // Escribir rutas a Google Sheets
                    if let Err(e) = self.write_routes_to_sheets(result.routes).await {
                        error!("❌ Error escribiendo rutas a Sheets: {}", e);
                    }
                }
                Err(e) => {
                    error!("❌ Error en ciclo de arbitraje: {}", e);
                    
                    // Incrementar contador de errores
                    {
                        let mut metrics = self.performance_metrics.lock().unwrap();
                        metrics.add_error();
                    }
                }
            }
            
            // Optimización completa menos frecuente
            if last_optimization.elapsed() >= optimization_interval {
                if let Err(e) = self.deep_optimization().await {
                    error!("❌ Error en optimización profunda: {}", e);
                }
                last_optimization = Instant::now();
            }
            
            // Pausa antes del siguiente ciclo
            sleep(Duration::from_secs(self.config.cycle_interval_seconds)).await;
        }
        
        info!("🛑 Loop principal del motor detenido");
    }
    
    /// Ejecutar un ciclo completo de búsqueda de arbitraje
    async fn execute_arbitrage_cycle(&self) -> Result<OptimizationResult, Box<dyn std::error::Error>> {
        let start_time = Instant::now();
        
        // 1. Obtener precios actuales
        let price_data = self.price_engine.get_current_prices().await?;
        debug!("📊 Obtenidos {} precios actuales", price_data.len());
        
        // 2. Generar rutas de arbitraje potenciales
        let potential_routes = self.path_finder.find_arbitrage_opportunities(&price_data).await?;
        debug!("🔍 Encontradas {} oportunidades potenciales", potential_routes.len());
        
        // 3. Evaluar y optimizar rutas
        let optimized_routes = self.route_optimizer.optimize_routes(potential_routes, &price_data).await?;
        debug!("⚡ Optimizadas {} rutas", optimized_routes.len());
        
        // 4. Filtrar rutas rentables
        let profitable_routes = self.filter_profitable_routes(optimized_routes)?;
        debug!("💰 {} rutas rentables encontradas", profitable_routes.len());
        
        // 5. Ranking final por ROI
        let ranked_routes = self.rank_routes_by_roi(profitable_routes)?;
        
        let computation_time = start_time.elapsed();
        
        // Crear resultado
        let result = OptimizationResult {
            total_opportunities: potential_routes.len(),
            profitable_routes: ranked_routes.len(),
            best_roi: ranked_routes.first().map(|r| r.roi_percentage).unwrap_or(0.0),
            total_potential_profit: ranked_routes.iter().map(|r| r.net_profit_usd).sum(),
            computation_time_ms: computation_time.as_millis() as u64,
            routes: ranked_routes,
        };
        
        Ok(result)
    }
    
    /// Optimización profunda usando programación dinámica
    async fn deep_optimization(&self) -> Result<(), Box<dyn std::error::Error>> {
        info!("🧠 Ejecutando optimización profunda con programación dinámica...");
        
        let start_time = Instant::now();
        
        // Implementar algoritmos de programación dinámica
        // para optimización avanzada de rutas
        
        // 1. Análisis de patrones históricos
        let historical_patterns = self.analyze_historical_patterns().await?;
        
        // 2. Optimización de capital allocation usando DP
        let optimal_allocations = self.optimize_capital_allocation(&historical_patterns)?;
        
        // 3. Ajuste de parámetros del sistema
        self.adjust_system_parameters(&optimal_allocations).await?;
        
        let optimization_time = start_time.elapsed();
        info!("✅ Optimización profunda completada en {}ms", optimization_time.as_millis());
        
        Ok(())
    }
    
    /// Loop de actualización de configuración
    async fn configuration_update_loop(&self) {
        info!("🔄 Iniciando loop de actualización de configuración...");
        
        let update_interval = Duration::from_secs(self.config.config_update_interval_seconds);
        
        while self.is_running() {
            sleep(update_interval).await;
            
            if let Err(e) = self.update_configuration().await {
                error!("❌ Error actualizando configuración: {}", e);
            }
        }
    }
    
    /// Actualizar configuración desde Google Sheets
    async fn update_configuration(&self) -> Result<(), Box<dyn std::error::Error>> {
        debug!("🔄 Verificando actualizaciones de configuración...");
        
        // Verificar si hay cambios en Google Sheets
        let last_modified = self.sheets_connector.get_last_modified().await?;
        let last_update = *self.last_config_update.lock().unwrap();
        
        if last_modified > last_update {
            info!("📝 Configuración actualizada detectada, recargando...");
            
            self.load_configuration_from_sheets().await?;
            self.initialize_components().await?;
            
            info!("✅ Configuración actualizada exitosamente");
        }
        
        Ok(())
    }
    
    // ==================================================================================
    // MÉTODOS DE PROCESAMIENTO DE DATOS
    // ==================================================================================
    
    /// Parsear configuración de blockchains desde Google Sheets
    fn parse_blockchains_config(&self, data: Vec<HashMap<String, serde_json::Value>>) -> Result<Vec<BlockchainConfig>, Box<dyn std::error::Error>> {
        let mut configs = Vec::new();
        
        for row in data {
            if let (Some(chain_id), Some(chain_name)) = (
                row.get("CHAIN_ID").and_then(|v| v.as_str()),
                row.get("CHAIN_NAME").and_then(|v| v.as_str())
            ) {
                let config = BlockchainConfig {
                    chain_id: chain_id.parse()?,
                    chain_name: chain_name.to_string(),
                    native_token: row.get("NATIVE_TOKEN").and_then(|v| v.as_str()).unwrap_or("ETH").to_string(),
                    rpc_endpoint: row.get("RPC_ENDPOINT").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    gas_price_gwei: row.get("GAS_PRICE_GWEI").and_then(|v| v.as_f64()).unwrap_or(20.0),
                    block_time: row.get("BLOCK_TIME").and_then(|v| v.as_u64()).unwrap_or(12),
                    health_status: row.get("HEALTH_STATUS").and_then(|v| v.as_str()).unwrap_or("UNKNOWN").to_string(),
                };
                configs.push(config);
            }
        }
        
        Ok(configs)
    }
    
    /// Parsear configuración de DEXes desde Google Sheets
    fn parse_dexes_config(&self, data: Vec<HashMap<String, serde_json::Value>>) -> Result<Vec<DexConfig>, Box<dyn std::error::Error>> {
        let mut configs = Vec::new();
        
        for row in data {
            if let (Some(dex_id), Some(dex_name)) = (
                row.get("DEX_ID").and_then(|v| v.as_str()),
                row.get("DEX_NAME").and_then(|v| v.as_str())
            ) {
                let config = DexConfig {
                    dex_id: dex_id.to_string(),
                    dex_name: dex_name.to_string(),
                    chain_id: row.get("CHAIN_ID").and_then(|v| v.as_str()).and_then(|s| s.parse().ok()).unwrap_or(1),
                    router_address: row.get("ROUTER_ADDRESS").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    factory_address: row.get("FACTORY_ADDRESS").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    fee_percentage: row.get("FEE_PERCENTAGE").and_then(|v| v.as_f64()).unwrap_or(0.3),
                    tvl_usd: row.get("TVL_USD").and_then(|v| v.as_f64()).unwrap_or(0.0),
                    status: row.get("STATUS").and_then(|v| v.as_str()).unwrap_or("UNKNOWN").to_string(),
                };
                configs.push(config);
            }
        }
        
        Ok(configs)
    }
    
    /// Parsear configuración de assets desde Google Sheets
    fn parse_assets_config(&self, data: Vec<HashMap<String, serde_json::Value>>) -> Result<Vec<AssetConfig>, Box<dyn std::error::Error>> {
        let mut configs = Vec::new();
        
        for row in data {
            if let Some(token_symbol) = row.get("TOKEN_SYMBOL").and_then(|v| v.as_str()) {
                let config = AssetConfig {
                    token_symbol: token_symbol.to_string(),
                    token_name: row.get("TOKEN_NAME").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    token_address: row.get("TOKEN_ADDRESS").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    decimals: row.get("TOKEN_DECIMALS").and_then(|v| v.as_u64()).unwrap_or(18) as u8,
                    chain_id: row.get("CHAIN_ID").and_then(|v| v.as_str()).and_then(|s| s.parse().ok()).unwrap_or(1),
                    current_price_usd: row.get("CURRENT_PRICE_USD").and_then(|v| v.as_f64()).unwrap_or(0.0),
                    liquidity_usd: row.get("LIQUIDITY_USD").and_then(|v| v.as_f64()).unwrap_or(0.0),
                    is_stablecoin: row.get("IS_STABLECOIN").and_then(|v| v.as_bool()).unwrap_or(false),
                };
                configs.push(config);
            }
        }
        
        Ok(configs)
    }
    
    /// Parsear configuración de pools desde Google Sheets  
    fn parse_pools_config(&self, data: Vec<HashMap<String, serde_json::Value>>) -> Result<Vec<PoolConfig>, Box<dyn std::error::Error>> {
        let mut configs = Vec::new();
        
        for row in data {
            if let Some(pool_id) = row.get("POOL_ID").and_then(|v| v.as_str()) {
                let config = PoolConfig {
                    pool_id: pool_id.to_string(),
                    dex_id: row.get("DEX_ID").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    token_a: row.get("TOKEN_A").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    token_b: row.get("TOKEN_B").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    reserves_a: row.get("RESERVES_A").and_then(|v| v.as_f64()).unwrap_or(0.0),
                    reserves_b: row.get("RESERVES_B").and_then(|v| v.as_f64()).unwrap_or(0.0),
                    liquidity_usd: row.get("LIQUIDITY_USD").and_then(|v| v.as_f64()).unwrap_or(0.0),
                    fee_tier: row.get("FEE_TIER").and_then(|v| v.as_u64()).unwrap_or(3000) as u32,
                };
                configs.push(config);
            }
        }
        
        Ok(configs)
    }
    
    // ==================================================================================
    // MÉTODOS DE ANÁLISIS Y OPTIMIZACIÓN
    // ==================================================================================
    
    /// Filtrar rutas rentables
    fn filter_profitable_routes(&self, routes: Vec<ArbitrageRoute>) -> Result<Vec<ArbitrageRoute>, Box<dyn std::error::Error>> {
        let min_profit_usd = self.config.min_profit_usd;
        let min_roi_percentage = self.config.min_roi_percentage;
        
        let profitable: Vec<ArbitrageRoute> = routes
            .into_iter()
            .filter(|route| {
                route.net_profit_usd >= min_profit_usd && 
                route.roi_percentage >= min_roi_percentage
            })
            .collect();
        
        Ok(profitable)
    }
    
    /// Ranking de rutas por ROI
    fn rank_routes_by_roi(&self, mut routes: Vec<ArbitrageRoute>) -> Result<Vec<ArbitrageRoute>, Box<dyn std::error::Error>> {
        routes.sort_by(|a, b| {
            b.roi_percentage.partial_cmp(&a.roi_percentage).unwrap_or(std::cmp::Ordering::Equal)
        });
        
        // Limitar a top N rutas
        routes.truncate(self.config.max_routes_to_return);
        
        Ok(routes)
    }
    
    /// Análisis de patrones históricos
    async fn analyze_historical_patterns(&self) -> Result<HashMap<String, f64>, Box<dyn std::error::Error>> {
        // Implementar análisis de patrones usando programación dinámica
        // Por ahora retornamos datos de ejemplo
        let mut patterns = HashMap::new();
        patterns.insert("avg_profit_per_route".to_string(), 15.5);
        patterns.insert("success_rate".to_string(), 0.85);
        patterns.insert("optimal_gas_price".to_string(), 25.0);
        
        Ok(patterns)
    }
    
    /// Optimización de allocation de capital usando DP
    fn optimize_capital_allocation(&self, _patterns: &HashMap<String, f64>) -> Result<HashMap<String, f64>, Box<dyn std::error::Error>> {
        // Implementar algoritmo de programación dinámica para allocation
        let mut allocations = HashMap::new();
        allocations.insert("high_liquidity_pools".to_string(), 0.6);
        allocations.insert("medium_liquidity_pools".to_string(), 0.3);
        allocations.insert("low_liquidity_pools".to_string(), 0.1);
        
        Ok(allocations)
    }
    
    /// Ajustar parámetros del sistema
    async fn adjust_system_parameters(&self, _allocations: &HashMap<String, f64>) -> Result<(), Box<dyn std::error::Error>> {
        // Implementar ajuste dinámico de parámetros
        info!("🔧 Ajustando parámetros del sistema basado en optimización DP");
        Ok(())
    }
    
    /// Escribir rutas a Google Sheets
    async fn write_routes_to_sheets(&self, routes: Vec<ArbitrageRoute>) -> Result<(), Box<dyn std::error::Error>> {
        if routes.is_empty() {
            return Ok(());
        }
        
        debug!("📝 Escribiendo {} rutas a Google Sheets...", routes.len());
        
        // Convertir rutas a formato de Sheets
        let sheet_data: Vec<HashMap<String, serde_json::Value>> = routes
            .into_iter()
            .map(|route| {
                let mut row = HashMap::new();
                row.insert("ROUTE_ID".to_string(), serde_json::Value::String(route.route_id));
                row.insert("SOURCE_TOKEN".to_string(), serde_json::Value::String(route.source_token));
                row.insert("TARGET_TOKEN".to_string(), serde_json::Value::String(route.target_token));
                row.insert("NET_PROFIT_USD".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(route.net_profit_usd).unwrap()));
                row.insert("ROI_PERCENTAGE".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(route.roi_percentage).unwrap()));
                row.insert("GAS_COST_USD".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(route.gas_cost_usd).unwrap()));
                row.insert("STATUS".to_string(), serde_json::Value::String("PENDING".to_string()));
                row.insert("CREATED_AT".to_string(), serde_json::Value::String(route.created_at.to_rfc3339()));
                row
            })
            .collect();
        
        // Escribir a la hoja ROUTES
        self.sheets_connector.update_sheet_data("ROUTES", sheet_data).await?;
        
        debug!("✅ Rutas escritas a Google Sheets");
        Ok(())
    }
    
    // ==================================================================================
    // MÉTODOS DE UTILIDAD
    // ==================================================================================
    
    /// Verificar si el motor está ejecutándose
    fn is_running(&self) -> bool {
        *self.is_running.lock().unwrap()
    }
    
    /// Detener el motor
    pub async fn stop(&self) {
        info!("🛑 Deteniendo Rust Arbitrage Engine...");
        
        {
            let mut running = self.is_running.lock().unwrap();
            *running = false;
        }
        
        // Dar tiempo para que los loops terminen
        sleep(Duration::from_secs(2)).await;
        
        info!("✅ Rust Arbitrage Engine detenido");
    }
    
    /// Obtener métricas de rendimiento
    pub fn get_performance_metrics(&self) -> PerformanceMetrics {
        self.performance_metrics.lock().unwrap().clone()
    }
    
    /// Obtener estado actual del motor
    pub fn get_status(&self) -> HashMap<String, serde_json::Value> {
        let mut status = HashMap::new();
        
        status.insert("is_running".to_string(), serde_json::Value::Bool(self.is_running()));
        status.insert("blockchains_count".to_string(), serde_json::Value::Number(serde_json::Number::from(self.blockchains.lock().unwrap().len())));
        status.insert("dexes_count".to_string(), serde_json::Value::Number(serde_json::Number::from(self.dexes.lock().unwrap().len())));
        status.insert("assets_count".to_string(), serde_json::Value::Number(serde_json::Number::from(self.assets.lock().unwrap().len())));
        status.insert("pools_count".to_string(), serde_json::Value::Number(serde_json::Number::from(self.pools.lock().unwrap().len())));
        
        let metrics = self.performance_metrics.lock().unwrap();
        status.insert("total_cycles".to_string(), serde_json::Value::Number(serde_json::Number::from(metrics.total_cycles)));
        status.insert("total_routes_generated".to_string(), serde_json::Value::Number(serde_json::Number::from(metrics.total_routes_generated)));
        status.insert("average_cycle_time_ms".to_string(), serde_json::Value::Number(serde_json::Number::from(metrics.average_cycle_time_ms())));
        
        status
    }
    
    /// Crear clon con Arc para tareas concurrentes
    fn clone_arc(&self) -> Arc<Self> {
        // Esta implementación requeriría que RustArbitrageEngine implemente Clone
        // o use Arc<RustArbitrageEngine> desde el principio
        unimplemented!("Implement Arc cloning for concurrent tasks")
    }
}

// ==================================================================================
// MAIN - PUNTO DE ENTRADA
// ==================================================================================

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Configurar logging
    env_logger::init();
    
    info!("🦀 Iniciando ARBITRAGEXPLUS2025 Rust Engine...");
    
    // Crear e inicializar motor
    let engine = RustArbitrageEngine::new()?;
    
    // Manejar señales del sistema para shutdown graceful
    let engine_clone = Arc::new(engine);
    let shutdown_engine = Arc::clone(&engine_clone);
    
    tokio::spawn(async move {
        tokio::signal::ctrl_c().await.expect("Failed to listen for Ctrl+C");
        info!("🛑 Recibida señal de interrupción...");
        shutdown_engine.stop().await;
    });
    
    // Iniciar motor
    match engine_clone.start().await {
        Ok(_) => info!("✅ Rust Engine terminado exitosamente"),
        Err(e) => error!("❌ Error en Rust Engine: {}", e),
    }
    
    Ok(())
}