"""
============================================================================
ARCHIVO: ./services/python-collector/src/main.py
============================================================================

📥 ENTRADA DE DATOS:
  FUENTE: Google Sheets - ALERTS, ROUTES, ASSETS, EXECUTIONS, BLOCKCHAINS
    - Formato: Dict[str, Any]

🔄 TRANSFORMACIÓN:
  CLASES: class, PythonCollector
  FUNCIONES: _load_initial_configuration, _manual_update_cycle, _initialize_sheets_client

📤 SALIDA DE DATOS:
  DESTINO: Google Sheets

🔗 DEPENDENCIAS:
  - src.utils.logger
  - ThreadPoolExecutor
  - setup_logger

============================================================================

🧬 PROGRAMACIÓN DINÁMICA APLICADA:
  1. ❌ NO collectors hardcodeados → ✅ Dict dinámico de CollectorInterface
  2. ❌ NO importaciones fijas → ✅ Importación dinámica con importlib
  3. ✅ Interface CollectorInterface (ABC) permite agregar collectors sin modificar código
  4. ✅ register_collector() agrega collectors en runtime
  5. ✅ load_collectors_config() carga configuración desde Google Sheets
  6. ✅ discover_collectors() importa módulos dinámicamente
  7. ✅ Polimorfismo: Cualquier clase que implemente CollectorInterface puede ser registrada
  8. ✅ Descubrimiento dinámico de collectors desde configuración

"""

#!/usr/bin/env python3
"""
ARBITRAGEXPLUS2025 - Python Collector Service

Servicio principal de recolección de datos que actúa como puente entre:
- Google Sheets (fuente de configuración)
- Oráculos de precios (Pyth, DefiLlama, etc.)
- DEXes (precios en tiempo real via WebSocket)
- Blockchain networks (estado y métricas)

Este servicio es crítico para el funcionamiento del sistema ya que:
- Mantiene Google Sheets actualizado con datos de mercado
- Recolecta precios de múltiples fuentes
- Sincroniza configuración dinámicamente
- Ejecuta pipelines programables
- Maneja reconexiones automáticas
"""

import asyncio
import logging
import os
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from concurrent.futures import ThreadPoolExecutor
import traceback

# Importaciones locales
from src.sheets.client import SheetsClient
from src.connectors.pyth import PythConnector
from src.connectors.defillama import DefiLlamaConnector
from src.connectors.publicnodes import PublicNodesConnector
from src.collectors.dex_prices import DexPriceCollector
from src.collectors.blockchain_health import BlockchainHealthCollector
from src.pipelines.data_pipeline import DataPipeline
from src.schedulers.cron_jobs import CronScheduler
from src.utils.logger import setup_logger
from src.utils.config import Config

@dataclass
class SystemMetrics:
    """Métricas del sistema de recolección"""
    total_updates: int = 0
    successful_updates: int = 0
    failed_updates: int = 0
    last_update: Optional[datetime] = None
    uptime_start: datetime = None
    errors_last_hour: int = 0
    
    @property
    def success_rate(self) -> float:
        if self.total_updates == 0:
            return 0.0
        return (self.successful_updates / self.total_updates) * 100
    
    @property
    def uptime_hours(self) -> float:
        if self.uptime_start is None:
            return 0.0
        return (datetime.now() - self.uptime_start).total_seconds() / 3600

class PythonCollector:
    """
    Servicio principal de recolección de datos
    
    Este servicio coordina todas las actividades de recolección:
    - Configuración dinámica desde Google Sheets
    - Recolección de precios multi-fuente
    - Monitoreo de salud de blockchains
    - Actualización automática de datos
    - Pipelines programables
    """
    
    def __init__(self):
        self.logger = setup_logger("PythonCollector")
        self.config = Config()
        
        # Métricas del sistema
        self.metrics = SystemMetrics(uptime_start=datetime.now())
        
        # Componentes principales
        self.sheets_client: Optional[SheetsClient] = None
        self.pyth_connector: Optional[PythConnector] = None
        self.defillama_connector: Optional[DefiLlamaConnector] = None
        self.publicnodes_connector: Optional[PublicNodesConnector] = None
        self.dex_collector: Optional[DexPriceCollector] = None
        self.blockchain_collector: Optional[BlockchainHealthCollector] = None
        self.data_pipeline: Optional[DataPipeline] = None
        self.scheduler: Optional[CronScheduler] = None
        
        # Estado del sistema
        self.is_running = False
        self.should_stop = False
        
        # Configuración dinámica (cargada desde Sheets)
        self.blockchains: List[Dict] = []
        self.dexes: List[Dict] = []
        self.assets: List[Dict] = []
        self.pools: List[Dict] = []
        self.system_config: Dict[str, Any] = {}
        
        # Timestamps para control de actualizaciones
        self.last_config_update = datetime.min
        self.last_price_update = datetime.min
        self.last_health_check = datetime.min
        
        # Thread pool para operaciones concurrentes
        self.executor = ThreadPoolExecutor(max_workers=8)
    
    async def initialize(self) -> bool:
        """
        Inicializar todos los componentes del sistema
        """
        try:
            self.logger.info("🚀 Inicializando Python Collector Service...")
            
            # 1. Inicializar cliente de Google Sheets
            await self._initialize_sheets_client()
            
            # 2. Cargar configuración inicial desde Sheets
            await self._load_initial_configuration()
            
            # 3. Inicializar conectores externos
            await self._initialize_connectors()
            
            # 4. Inicializar recolectores especializados
            await self._initialize_collectors()
            
            # 5. Configurar pipelines y scheduler
            await self._initialize_pipelines()
            
            # 6. Configurar scheduler para tareas automáticas
            await self._initialize_scheduler()
            
            self.logger.info("✅ Python Collector inicializado correctamente")
            self.logger.info(f"📊 Configuración cargada: {len(self.blockchains)} chains, {len(self.dexes)} DEXes, {len(self.assets)} assets")
            
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Error inicializando Python Collector: {e}")
            self.logger.error(traceback.format_exc())
            return False
    
    async def _initialize_sheets_client(self):
        """Inicializar conexión con Google Sheets"""
        try:
            self.sheets_client = SheetsClient(
                spreadsheet_id=self.config.SPREADSHEET_ID,
                credentials_path=self.config.GOOGLE_CREDENTIALS_PATH
            )
            await self.sheets_client.initialize()
            
            # Validar acceso a todas las hojas requeridas
            required_sheets = ['BLOCKCHAINS', 'DEXES', 'ASSETS', 'POOLS', 'ROUTES', 'EXECUTIONS', 'CONFIG', 'ALERTS']
            for sheet_name in required_sheets:
                if not await self.sheets_client.sheet_exists(sheet_name):
                    raise Exception(f"Required sheet '{sheet_name}' not found")
            
            self.logger.info("✅ Google Sheets client inicializado")
            
        except Exception as e:
            self.logger.error(f"❌ Error inicializando Sheets client: {e}")
            raise
    
    async def _load_initial_configuration(self):
        """Cargar configuración inicial desde Google Sheets"""
        try:
            self.logger.info("📥 Cargando configuración inicial desde Google Sheets...")
            
            # Cargar datos de las hojas principales
            self.blockchains = await self.sheets_client.get_sheet_data('BLOCKCHAINS')
            self.dexes = await self.sheets_client.get_sheet_data('DEXES')
            self.assets = await self.sheets_client.get_sheet_data('ASSETS')
            self.pools = await self.sheets_client.get_sheet_data('POOLS')
            
            # Cargar configuración del sistema
            config_data = await self.sheets_client.get_sheet_data('CONFIG')
            self.system_config = {}
            for row in config_data:
                if row.get('CONFIG_KEY') and row.get('CONFIG_VALUE'):
                    self.system_config[row['CONFIG_KEY']] = {
                        'value': row['CONFIG_VALUE'],
                        'type': row.get('CONFIG_TYPE', 'string'),
                        'is_active': row.get('IS_ACTIVE', True)
                    }
            
            # Validar configuración mínima
            if len(self.blockchains) == 0:
                raise Exception("No blockchains configured in Google Sheets")
            
            if len(self.dexes) == 0:
                raise Exception("No DEXes configured in Google Sheets")
            
            self.last_config_update = datetime.now()
            self.logger.info(f"📊 Configuración cargada: {len(self.blockchains)} chains, {len(self.dexes)} DEXes, {len(self.assets)} assets, {len(self.pools)} pools")
            
        except Exception as e:
            self.logger.error(f"❌ Error cargando configuración inicial: {e}")
            raise
    
    async def _initialize_connectors(self):
        """Inicializar conectores a servicios externos"""
        try:
            self.logger.info("🔌 Inicializando conectores externos...")
            
            # Connector Pyth Network
            pyth_assets = [asset for asset in self.assets if asset.get('PYTH_PRICE_ID')]
            self.pyth_connector = PythConnector(assets=pyth_assets)
            await self.pyth_connector.initialize()
            
            # Connector DefiLlama
            self.defillama_connector = DefiLlamaConnector()
            await self.defillama_connector.initialize()
            
            # Connector PublicNodes para health checks
            blockchain_rpcs = [
                {'chain_id': bc.get('CHAIN_ID'), 'rpc_url': bc.get('RPC_ENDPOINT')}
                for bc in self.blockchains if bc.get('RPC_ENDPOINT')
            ]
            self.publicnodes_connector = PublicNodesConnector(blockchain_rpcs)
            await self.publicnodes_connector.initialize()
            
            self.logger.info("✅ Conectores externos inicializados")
            
        except Exception as e:
            self.logger.error(f"❌ Error inicializando conectores: {e}")
            raise
    
    async def _initialize_collectors(self):
        """Inicializar recolectores especializados"""
        try:
            self.logger.info("📡 Inicializando recolectores especializados...")
            
            # Recolector de precios DEX
            dex_configs = [
                {
                    'dex_id': dex.get('DEX_ID'),
                    'name': dex.get('DEX_NAME'),
                    'websocket_url': dex.get('WEBSOCKET_URL'),
                    'api_endpoint': dex.get('API_ENDPOINT'),
                    'chain_id': dex.get('CHAIN_ID')
                }
                for dex in self.dexes if dex.get('WEBSOCKET_URL')
            ]
            
            self.dex_collector = DexPriceCollector(
                dex_configs=dex_configs,
                assets=self.assets
            )
            await self.dex_collector.initialize()
            
            # Recolector de salud de blockchains
            self.blockchain_collector = BlockchainHealthCollector(
                blockchains=self.blockchains,
                publicnodes_connector=self.publicnodes_connector
            )
            await self.blockchain_collector.initialize()
            
            self.logger.info("✅ Recolectores especializados inicializados")
            
        except Exception as e:
            self.logger.error(f"❌ Error inicializando recolectores: {e}")
            raise
    
    async def _initialize_pipelines(self):
        """Inicializar pipelines de datos"""
        try:
            self.logger.info("🏗️ Inicializando pipelines de datos...")
            
            self.data_pipeline = DataPipeline(
                sheets_client=self.sheets_client,
                pyth_connector=self.pyth_connector,
                defillama_connector=self.defillama_connector,
                dex_collector=self.dex_collector,
                blockchain_collector=self.blockchain_collector
            )
            await self.data_pipeline.initialize()
            
            self.logger.info("✅ Pipelines de datos inicializados")
            
        except Exception as e:
            self.logger.error(f"❌ Error inicializando pipelines: {e}")
            raise
    
    async def _initialize_scheduler(self):
        """Inicializar scheduler para tareas automáticas"""
        try:
            self.logger.info("⏰ Inicializando scheduler...")
            
            self.scheduler = CronScheduler()
            
            # Configurar jobs desde system_config
            update_interval = int(self.system_config.get('UPDATE_INTERVAL', {}).get('value', 30))
            health_check_interval = int(self.system_config.get('HEALTH_CHECK_INTERVAL', {}).get('value', 300))
            
            # Job de actualización de precios (cada 30 segundos por defecto)
            self.scheduler.add_job(
                func=self._update_prices_job,
                trigger='interval',
                seconds=update_interval,
                id='update_prices',
                name='Update Prices from All Sources'
            )
            
            # Job de health check (cada 5 minutos por defecto)
            self.scheduler.add_job(
                func=self._health_check_job,
                trigger='interval',
                seconds=health_check_interval,
                id='health_check',
                name='Blockchain Health Check'
            )
            
            # Job de reconfiguración (cada 10 minutos)
            self.scheduler.add_job(
                func=self._reconfiguration_job,
                trigger='interval',
                minutes=10,
                id='reconfiguration',
                name='Reload Configuration from Sheets'
            )
            
            # Job de limpieza de métricas (cada hora)
            self.scheduler.add_job(
                func=self._cleanup_metrics_job,
                trigger='interval',
                hours=1,
                id='cleanup_metrics',
                name='Cleanup Old Metrics'
            )
            
            await self.scheduler.initialize()
            self.logger.info("✅ Scheduler inicializado con jobs automáticos")
            
        except Exception as e:
            self.logger.error(f"❌ Error inicializando scheduler: {e}")
            raise
    
    async def start(self):
        """Iniciar el servicio de recolección"""
        try:
            if not await self.initialize():
                raise Exception("Failed to initialize collector service")
            
            self.is_running = True
            self.should_stop = False
            
            self.logger.info("🎯 Python Collector Service iniciado")
            self.logger.info("📊 Comenzando recolección de datos...")
            
            # Iniciar scheduler
            self.scheduler.start()
            
            # Loop principal
            await self._main_loop()
            
        except KeyboardInterrupt:
            self.logger.info("🛑 Recibida señal de interrupción")
            await self.stop()
            
        except Exception as e:
            self.logger.error(f"❌ Error fatal en Python Collector: {e}")
            self.logger.error(traceback.format_exc())
            await self.stop()
    
    async def stop(self):
        """Detener el servicio de recolección"""
        try:
            self.logger.info("🛑 Deteniendo Python Collector Service...")
            
            self.should_stop = True
            self.is_running = False
            
            # Detener scheduler
            if self.scheduler:
                await self.scheduler.stop()
            
            # Cerrar conectores
            if self.dex_collector:
                await self.dex_collector.stop()
            
            if self.blockchain_collector:
                await self.blockchain_collector.stop()
            
            # Cerrar thread pool
            self.executor.shutdown(wait=True)
            
            self.logger.info("✅ Python Collector Service detenido")
            
        except Exception as e:
            self.logger.error(f"❌ Error deteniendo servicio: {e}")
    
    async def _main_loop(self):
        """Loop principal del servicio"""
        while not self.should_stop:
            try:
                # Ejecutar una actualización manual cada 5 minutos como backup
                await self._manual_update_cycle()
                
                # Dormir por 5 minutos
                await asyncio.sleep(300)
                
            except Exception as e:
                self.logger.error(f"❌ Error en main loop: {e}")
                await asyncio.sleep(60)  # Dormir 1 minuto en caso de error
    
    async def _manual_update_cycle(self):
        """Ciclo manual de actualización como backup del scheduler"""
        try:
            now = datetime.now()
            
            # Solo ejecutar si han pasado más de 5 minutos desde la última actualización manual
            if (now - self.last_price_update).total_seconds() > 300:
                self.logger.debug("🔄 Ejecutando ciclo manual de actualización...")
                
                await self._update_prices_job()
                await self._health_check_job()
                
                self.last_price_update = now
            
        except Exception as e:
            self.logger.error(f"❌ Error en ciclo manual de actualización: {e}")
    
    # ==================================================================================
    # JOBS DEL SCHEDULER
    # ==================================================================================
    
    async def _update_prices_job(self):
        """Job para actualizar precios desde todas las fuentes"""
        try:
            self.logger.debug("💰 Actualizando precios desde todas las fuentes...")
            
            start_time = time.time()
            
            # Recolectar precios de todas las fuentes concurrentemente
            tasks = []
            
            # Precios de Pyth
            if self.pyth_connector:
                tasks.append(self._collect_pyth_prices())
            
            # Precios de DefiLlama
            if self.defillama_connector:
                tasks.append(self._collect_defillama_data())
            
            # Precios de DEXes vía WebSocket
            if self.dex_collector:
                tasks.append(self._collect_dex_prices())
            
            # Ejecutar todas las tareas concurrentemente
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Procesar resultados y actualizar Sheets
            successful_updates = 0
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    self.logger.warning(f"⚠️ Error en tarea {i}: {result}")
                else:
                    successful_updates += 1
            
            # Actualizar métricas
            self.metrics.total_updates += 1
            if successful_updates > 0:
                self.metrics.successful_updates += 1
                self.metrics.last_update = datetime.now()
            else:
                self.metrics.failed_updates += 1
            
            elapsed_time = time.time() - start_time
            self.logger.debug(f"✅ Actualización de precios completada en {elapsed_time:.2f}s ({successful_updates}/{len(tasks)} exitosas)")
            
        except Exception as e:
            self.logger.error(f"❌ Error en job de actualización de precios: {e}")
            self.metrics.failed_updates += 1
    
    async def _health_check_job(self):
        """Job para verificar salud de blockchains"""
        try:
            self.logger.debug("🏥 Ejecutando health checks...")
            
            if self.blockchain_collector:
                health_data = await self.blockchain_collector.collect_health_data()
                
                # Actualizar hoja BLOCKCHAINS con datos de salud
                for chain_data in health_data:
                    await self.sheets_client.update_row_by_key(
                        sheet_name='BLOCKCHAINS',
                        key_field='CHAIN_ID',
                        key_value=chain_data['chain_id'],
                        updates={
                            'HEALTH_STATUS': chain_data['status'],
                            'BLOCK_NUMBER': chain_data.get('block_number', 0),
                            'GAS_PRICE_GWEI': chain_data.get('gas_price', 0),
                            'LAST_UPDATE': datetime.now().isoformat()
                        }
                    )
                
                self.last_health_check = datetime.now()
                self.logger.debug("✅ Health checks completados")
            
        except Exception as e:
            self.logger.error(f"❌ Error en job de health check: {e}")
    
    async def _reconfiguration_job(self):
        """Job para recargar configuración desde Sheets"""
        try:
            self.logger.debug("🔄 Recargando configuración desde Sheets...")
            
            # Verificar si hay cambios en la configuración
            current_config_hash = self._get_config_hash()
            
            # Recargar configuración
            await self._load_initial_configuration()
            
            new_config_hash = self._get_config_hash()
            
            if current_config_hash != new_config_hash:
                self.logger.info("📝 Configuración actualizada, reconfigurando servicios...")
                
                # Reconfigurar conectores con nueva configuración
                await self._reconfigure_services()
                
            else:
                self.logger.debug("📋 No hay cambios en la configuración")
            
        except Exception as e:
            self.logger.error(f"❌ Error en job de reconfiguración: {e}")
    
    async def _cleanup_metrics_job(self):
        """Job para limpiar métricas antiguas"""
        try:
            self.logger.debug("🧹 Limpiando métricas antiguas...")
            
            # Reset contador de errores por hora
            self.metrics.errors_last_hour = 0
            
            # Otras tareas de limpieza...
            
            self.logger.debug("✅ Limpieza de métricas completada")
            
        except Exception as e:
            self.logger.error(f"❌ Error en job de limpieza: {e}")
    
    # ==================================================================================
    # MÉTODOS DE RECOLECCIÓN DE DATOS
    # ==================================================================================
    
    async def _collect_pyth_prices(self):
        """Recolectar precios de Pyth Network"""
        try:
            if not self.pyth_connector:
                return
            
            prices = await self.pyth_connector.get_current_prices()
            
            # Actualizar hoja ASSETS con precios de Pyth
            for price_data in prices:
                await self.sheets_client.update_row_by_key(
                    sheet_name='ASSETS',
                    key_field='TOKEN_SYMBOL',
                    key_value=price_data['symbol'],
                    updates={
                        'CURRENT_PRICE_USD': price_data['price'],
                        'PRICE_SOURCE': 'PYTH',
                        'PRICE_CONFIDENCE': price_data['confidence'],
                        'LAST_UPDATE': datetime.now().isoformat()
                    }
                )
            
            self.logger.debug(f"📊 Actualizados {len(prices)} precios de Pyth")
            
        except Exception as e:
            self.logger.error(f"❌ Error recolectando precios Pyth: {e}")
            raise
    
    async def _collect_defillama_data(self):
        """Recolectar datos de DefiLlama"""
        try:
            if not self.defillama_connector:
                return
            
            # Obtener TVL de protocolos
            tvl_data = await self.defillama_connector.get_protocol_tvl()
            
            # Actualizar hojas según los datos obtenidos
            for protocol_data in tvl_data:
                # Actualizar DEXes con TVL
                if protocol_data.get('category') == 'dex':
                    await self.sheets_client.update_row_by_key(
                        sheet_name='DEXES',
                        key_field='DEX_NAME',
                        key_value=protocol_data['name'],
                        updates={
                            'TVL_USD': protocol_data['tvl'],
                            'LAST_UPDATE': datetime.now().isoformat()
                        }
                    )
            
            self.logger.debug(f"📈 Actualizados datos de {len(tvl_data)} protocolos DefiLlama")
            
        except Exception as e:
            self.logger.error(f"❌ Error recolectando datos DefiLlama: {e}")
            raise
    
    async def _collect_dex_prices(self):
        """Recolectar precios de DEXes vía WebSocket"""
        try:
            if not self.dex_collector:
                return
            
            dex_prices = await self.dex_collector.get_latest_prices()
            
            # Actualizar pools con precios de DEXes
            for pool_id, price_data in dex_prices.items():
                await self.sheets_client.update_row_by_key(
                    sheet_name='POOLS',
                    key_field='POOL_ID',
                    key_value=pool_id,
                    updates={
                        'RESERVES_A': price_data.get('reserve_a', 0),
                        'RESERVES_B': price_data.get('reserve_b', 0),
                        'VOLUME_24H': price_data.get('volume_24h', 0),
                        'LAST_SYNC': datetime.now().isoformat()
                    }
                )
            
            self.logger.debug(f"🏊 Actualizados {len(dex_prices)} pools DEX")
            
        except Exception as e:
            self.logger.error(f"❌ Error recolectando precios DEX: {e}")
            raise
    
    # ==================================================================================
    # MÉTODOS DE UTILIDAD
    # ==================================================================================
    
    def _get_config_hash(self) -> str:
        """Obtener hash de la configuración actual para detectar cambios"""
        config_str = json.dumps({
            'blockchains_count': len(self.blockchains),
            'dexes_count': len(self.dexes),
            'assets_count': len(self.assets),
            'system_config': self.system_config
        }, sort_keys=True)
        
        import hashlib
        return hashlib.md5(config_str.encode()).hexdigest()
    
    async def _reconfigure_services(self):
        """Reconfigurar servicios con nueva configuración"""
        try:
            # Reconfigurar conectores
            if self.pyth_connector:
                pyth_assets = [asset for asset in self.assets if asset.get('PYTH_PRICE_ID')]
                await self.pyth_connector.update_asset_configuration(pyth_assets)
            
            if self.dex_collector:
                dex_configs = [
                    {
                        'dex_id': dex.get('DEX_ID'),
                        'websocket_url': dex.get('WEBSOCKET_URL'),
                        'chain_id': dex.get('CHAIN_ID')
                    }
                    for dex in self.dexes if dex.get('WEBSOCKET_URL')
                ]
                await self.dex_collector.update_dex_configuration(dex_configs)
            
            self.logger.info("🔄 Servicios reconfigurados con nueva configuración")
            
        except Exception as e:
            self.logger.error(f"❌ Error reconfigurando servicios: {e}")
            raise
    
    def get_status(self) -> Dict[str, Any]:
        """Obtener estado actual del servicio"""
        return {
            'is_running': self.is_running,
            'metrics': asdict(self.metrics),
            'configuration': {
                'blockchains': len(self.blockchains),
                'dexes': len(self.dexes),
                'assets': len(self.assets),
                'pools': len(self.pools)
            },
            'components': {
                'sheets_client': self.sheets_client is not None,
                'pyth_connector': self.pyth_connector is not None,
                'defillama_connector': self.defillama_connector is not None,
                'dex_collector': self.dex_collector is not None,
                'blockchain_collector': self.blockchain_collector is not None,
                'scheduler': self.scheduler is not None and self.scheduler.running
            },
            'last_updates': {
                'config': self.last_config_update.isoformat() if self.last_config_update != datetime.min else None,
                'prices': self.last_price_update.isoformat() if self.last_price_update != datetime.min else None,
                'health': self.last_health_check.isoformat() if self.last_health_check != datetime.min else None
            }
        }

# ==================================================================================
# MAIN - PUNTO DE ENTRADA
# ==================================================================================

async def main():
    """Función principal del servicio"""
    collector = PythonCollector()
    
    try:
        await collector.start()
    except KeyboardInterrupt:
        print("\n🛑 Interrupción detectada, deteniendo servicio...")
    finally:
        await collector.stop()

if __name__ == "__main__":
    # Configurar logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Ejecutar servicio
    asyncio.run(main())


# ==================================================================================
# PARALLEL ORCHESTRATOR
# ==================================================================================

class ParallelOrchestrator:
    """
    Orquestador paralelo para ejecutar múltiples tareas concurrentemente
    con gestión de límites, retry y circuit breaker
    """
    
    def __init__(self, max_concurrent: int = 40, max_retries: int = 3):
        self.logger = setup_logger("ParallelOrchestrator")
        self.max_concurrent = max_concurrent
        self.max_retries = max_retries
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.stats = {
            'total_tasks': 0,
            'successful_tasks': 0,
            'failed_tasks': 0,
            'retried_tasks': 0,
        }
    
    async def execute_batch(self, tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Ejecuta un batch de tareas en paralelo
        
        Args:
            tasks: Lista de diccionarios con 'id', 'func', 'args', 'kwargs'
        
        Returns:
            Lista de resultados con 'id', 'success', 'result' o 'error'
        """
        self.logger.info(f"🚀 Ejecutando batch de {len(tasks)} tareas (max concurrent: {self.max_concurrent})")
        
        async def execute_with_retry(task: Dict[str, Any]) -> Dict[str, Any]:
            task_id = task.get('id', 'unknown')
            func = task.get('func')
            args = task.get('args', [])
            kwargs = task.get('kwargs', {})
            
            for attempt in range(self.max_retries):
                try:
                    async with self.semaphore:
                        self.logger.debug(f"Ejecutando tarea {task_id} (intento {attempt + 1}/{self.max_retries})")
                        
                        # Ejecutar función
                        if asyncio.iscoroutinefunction(func):
                            result = await func(*args, **kwargs)
                        else:
                            result = func(*args, **kwargs)
                        
                        self.stats['successful_tasks'] += 1
                        return {
                            'id': task_id,
                            'success': True,
                            'result': result,
                            'attempts': attempt + 1,
                        }
                
                except Exception as e:
                    self.logger.warning(f"Tarea {task_id} falló (intento {attempt + 1}/{self.max_retries}): {e}")
                    
                    if attempt < self.max_retries - 1:
                        self.stats['retried_tasks'] += 1
                        # Backoff exponencial
                        await asyncio.sleep(2 ** attempt)
                    else:
                        self.stats['failed_tasks'] += 1
                        return {
                            'id': task_id,
                            'success': False,
                            'error': str(e),
                            'attempts': attempt + 1,
                        }
        
        # Ejecutar todas las tareas en paralelo
        self.stats['total_tasks'] += len(tasks)
        results = await asyncio.gather(*[execute_with_retry(task) for task in tasks])
        
        success_count = sum(1 for r in results if r.get('success'))
        self.logger.info(f"✅ Batch completado: {success_count}/{len(tasks)} exitosas")
        
        return results
    
    def get_stats(self) -> Dict[str, Any]:
        """Obtiene estadísticas del orchestrator"""
        success_rate = (self.stats['successful_tasks'] / self.stats['total_tasks'] * 100) if self.stats['total_tasks'] > 0 else 0
        
        return {
            **self.stats,
            'success_rate': round(success_rate, 2),
            'max_concurrent': self.max_concurrent,
        }

# ==================================================================================
# AUTO-RECOVERY SYSTEM
# ==================================================================================

class AutoRecoverySystem:
    """
    Sistema de auto-recuperación ante fallos
    Monitorea la salud del sistema y ejecuta acciones correctivas
    """
    
    def __init__(self, collector: PythonCollector):
        self.logger = setup_logger("AutoRecoverySystem")
        self.collector = collector
        self.health_check_interval = 60  # 1 minuto
        self.recovery_actions = []
        self.is_running = False
    
    async def start(self):
        """Inicia el sistema de auto-recovery"""
        self.is_running = True
        self.logger.info("🏥 Sistema de auto-recovery iniciado")
        
        while self.is_running:
            try:
                await self.perform_health_check()
                await asyncio.sleep(self.health_check_interval)
            except Exception as e:
                self.logger.error(f"Error en health check: {e}")
                await asyncio.sleep(self.health_check_interval)
    
    async def perform_health_check(self):
        """Realiza health check completo del sistema"""
        self.logger.debug("🔍 Realizando health check...")
        
        issues = []
        
        # 1. Verificar conexión a Sheets
        if not self.collector.sheets_client or not await self.collector.sheets_client.is_connected():
            issues.append({
                'component': 'sheets_client',
                'issue': 'Conexión perdida',
                'action': 'reconnect_sheets'
            })
        
        # 2. Verificar conectores
        if self.collector.pyth_connector and not self.collector.pyth_connector.is_healthy():
            issues.append({
                'component': 'pyth_connector',
                'issue': 'Conector no saludable',
                'action': 'restart_pyth'
            })
        
        # 3. Verificar métricas
        if self.collector.metrics.success_rate < 50:
            issues.append({
                'component': 'metrics',
                'issue': f'Success rate bajo: {self.collector.metrics.success_rate}%',
                'action': 'alert_low_success_rate'
            })
        
        # 4. Verificar última actualización
        time_since_update = (datetime.now() - self.collector.metrics.last_update).total_seconds() if self.collector.metrics.last_update else float('inf')
        if time_since_update > 300:  # 5 minutos
            issues.append({
                'component': 'updates',
                'issue': f'Sin actualizaciones desde hace {time_since_update}s',
                'action': 'force_update'
            })
        
        # Ejecutar acciones correctivas
        if issues:
            self.logger.warning(f"⚠️  {len(issues)} problemas detectados")
            for issue in issues:
                await self.execute_recovery_action(issue)
        else:
            self.logger.debug("✅ Health check OK")
    
    async def execute_recovery_action(self, issue: Dict[str, Any]):
        """Ejecuta una acción de recuperación"""
        action = issue.get('action')
        self.logger.info(f"🔧 Ejecutando acción de recuperación: {action}")
        
        try:
            if action == 'reconnect_sheets':
                await self.collector._initialize_sheets_client()
            
            elif action == 'restart_pyth':
                await self.collector.pyth_connector.reconnect()
            
            elif action == 'alert_low_success_rate':
                # Enviar alerta a Sheets
                if self.collector.sheets_client:
                    await self.collector.sheets_client.append_row('ALERTS', {
                        'timestamp': datetime.now().isoformat(),
                        'severity': 'WARNING',
                        'component': issue.get('component'),
                        'message': issue.get('issue'),
                        'action_taken': action,
                    })
            
            elif action == 'force_update':
                await self.collector._manual_update_cycle()
            
            self.logger.info(f"✅ Acción de recuperación completada: {action}")
            self.recovery_actions.append({
                'timestamp': datetime.now().isoformat(),
                'issue': issue,
                'action': action,
                'success': True,
            })
        
        except Exception as e:
            self.logger.error(f"❌ Error ejecutando acción de recuperación {action}: {e}")
            self.recovery_actions.append({
                'timestamp': datetime.now().isoformat(),
                'issue': issue,
                'action': action,
                'success': False,
                'error': str(e),
            })
    
    async def stop(self):
        """Detiene el sistema de auto-recovery"""
        self.is_running = False
        self.logger.info("🛑 Sistema de auto-recovery detenido")
    
    def get_stats(self) -> Dict[str, Any]:
        """Obtiene estadísticas del sistema de recovery"""
        successful_recoveries = sum(1 for r in self.recovery_actions if r.get('success'))
        total_recoveries = len(self.recovery_actions)
        
        return {
            'total_recoveries': total_recoveries,
            'successful_recoveries': successful_recoveries,
            'failed_recoveries': total_recoveries - successful_recoveries,
            'recent_actions': self.recovery_actions[-10:],  # Últimas 10
        }

# ==================================================================================
# ENHANCED MAIN WITH ORCHESTRATOR
# ==================================================================================

async def main_with_orchestrator():
    """
    Función principal mejorada con orchestrator y auto-recovery
    """
    collector = PythonCollector()
    orchestrator = ParallelOrchestrator(max_concurrent=40)
    recovery_system = AutoRecoverySystem(collector)
    
    try:
        # Inicializar collector
        if not await collector.initialize():
            print("❌ Error inicializando collector")
            return
        
        # Iniciar sistema de auto-recovery en background
        recovery_task = asyncio.create_task(recovery_system.start())
        
        # Iniciar collector
        await collector.start()
        
        # Esperar a que termine
        await recovery_task
    
    except KeyboardInterrupt:
        print("\n🛑 Interrupción detectada, deteniendo servicios...")
    
    finally:
        await recovery_system.stop()
        await collector.stop()
        
        # Mostrar estadísticas finales
        print("\n📊 Estadísticas finales:")
        print(f"Collector: {collector.get_status()}")
        print(f"Orchestrator: {orchestrator.get_stats()}")
        print(f"Recovery: {recovery_system.get_stats()}")

# Exportar orchestrator y recovery system
__all__ = [
    'PythonCollector',
    'ParallelOrchestrator',
    'AutoRecoverySystem',
    'main',
    'main_with_orchestrator',
]




# ==================================================================================
# DYNAMIC COLLECTOR SYSTEM - PROGRAMACIÓN DINÁMICA
# ==================================================================================

from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional, Type
import importlib
import inspect

class CollectorInterface(ABC):
    """
    Interface abstracta para collectors
    Permite agregar nuevos collectors sin modificar código (polimorfismo)
    """
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Nombre único del collector"""
        pass
    
    @property
    @abstractmethod
    def priority(self) -> int:
        """Prioridad de ejecución (1=alta, 2=media, 3=baja)"""
        pass
    
    @abstractmethod
    async def can_collect(self) -> bool:
        """Determina si el collector puede ejecutarse"""
        pass
    
    @abstractmethod
    async def collect(self) -> Dict[str, Any]:
        """Ejecuta la recolección de datos"""
        pass
    
    @abstractmethod
    async def health_check(self) -> bool:
        """Verifica si el collector está saludable"""
        pass


class PythCollector(CollectorInterface):
    """Collector para Pyth Network"""
    
    def __init__(self, pyth_connector):
        self.pyth_connector = pyth_connector
        self._name = 'pyth_collector'
        self._priority = 1
    
    @property
    def name(self) -> str:
        return self._name
    
    @property
    def priority(self) -> int:
        return self._priority
    
    async def can_collect(self) -> bool:
        return self.pyth_connector is not None
    
    async def collect(self) -> Dict[str, Any]:
        # Implementar lógica de recolección de Pyth
        return {'source': 'pyth', 'data': {}}
    
    async def health_check(self) -> bool:
        return await self.can_collect()


class ChainlinkCollector(CollectorInterface):
    """Collector para Chainlink (preparado para implementación)"""
    
    def __init__(self):
        self._name = 'chainlink_collector'
        self._priority = 2
    
    @property
    def name(self) -> str:
        return self._name
    
    @property
    def priority(self) -> int:
        return self._priority
    
    async def can_collect(self) -> bool:
        # TODO: Verificar si Chainlink está configurado
        return False
    
    async def collect(self) -> Dict[str, Any]:
        # TODO: Implementar recolección de Chainlink
        return {'source': 'chainlink', 'data': {}}
    
    async def health_check(self) -> bool:
        return False


class DynamicCollectorOrchestrator:
    """
    Orchestrator dinámico de collectors
    Programación Dinámica: Descubrimiento y ejecución de collectors
    """
    
    def __init__(self, sheets_client=None, max_concurrent: int = 40):
        self.sheets_client = sheets_client
        self.max_concurrent = max_concurrent
        
        # Dict dinámico de collectors (key: name, value: CollectorInterface)
        self.collectors: Dict[str, CollectorInterface] = {}
        
        # Configuración cargada desde Sheets
        self.collector_configs: Dict[str, Dict[str, Any]] = {}
        
        # Estadísticas
        self.stats = {
            'total_collections': 0,
            'successful_collections': 0,
            'failed_collections': 0,
            'collectors_registered': 0,
        }
        
        self.logger = logging.getLogger(__name__)
    
    async def load_collectors_config(self):
        """
        Carga configuración de collectors desde Google Sheets
        Programación Dinámica: Descubrimiento dinámico de collectors
        """
        try:
            if not self.sheets_client:
                self.logger.warning("No sheets client configured")
                return
            
            self.logger.info("Loading collectors configuration from Sheets...")
            
            # Leer hoja COLLECTORS_CONFIG
            rows = await self.sheets_client.read_sheet('COLLECTORS_CONFIG')
            
            if not rows:
                self.logger.warning("No collectors config found")
                return
            
            # Limpiar configuración anterior
            self.collector_configs.clear()
            
            # Construir Dict dinámicamente
            for row in rows:
                try:
                    config = {
                        'name': row.get('NAME', ''),
                        'enabled': row.get('ENABLED', 'TRUE') == 'TRUE',
                        'priority': int(row.get('PRIORITY', 2)),
                        'max_retries': int(row.get('MAX_RETRIES', 3)),
                        'timeout': int(row.get('TIMEOUT', 30)),
                        'module_path': row.get('MODULE_PATH', ''),
                        'class_name': row.get('CLASS_NAME', ''),
                        'notes': row.get('NOTES', ''),
                    }
                    
                    if not config['name']:
                        continue
                    
                    self.collector_configs[config['name']] = config
                    self.logger.debug(f"Loaded collector config: {config['name']}")
                
                except Exception as e:
                    self.logger.error(f"Failed to parse collector config row: {e}")
            
            self.logger.info(f"Collectors configuration loaded: {len(self.collector_configs)} configs")
        
        except Exception as e:
            self.logger.error(f"Failed to load collectors config: {e}")
    
    def register_collector(self, collector: CollectorInterface):
        """
        Registra un collector dinámicamente
        Programación Dinámica: Agregar collectors sin modificar código
        """
        if collector.name in self.collectors:
            self.logger.warning(f"Collector {collector.name} already registered, replacing...")
        
        self.collectors[collector.name] = collector
        self.stats['collectors_registered'] = len(self.collectors)
        
        self.logger.info(f"Collector registered: {collector.name} (priority: {collector.priority})")
    
    async def discover_collectors(self):
        """
        Descubre collectors dinámicamente desde configuración
        Programación Dinámica: Importación dinámica de módulos
        """
        try:
            for name, config in self.collector_configs.items():
                if not config['enabled']:
                    self.logger.debug(f"Collector {name} is disabled, skipping...")
                    continue
                
                # Si ya está registrado, skip
                if name in self.collectors:
                    continue
                
                # Intentar importar y crear instancia dinámicamente
                if config['module_path'] and config['class_name']:
                    try:
                        module = importlib.import_module(config['module_path'])
                        collector_class = getattr(module, config['class_name'])
                        
                        # Verificar que implemente CollectorInterface
                        if not issubclass(collector_class, CollectorInterface):
                            self.logger.warning(f"Class {config['class_name']} does not implement CollectorInterface")
                            continue
                        
                        # Crear instancia
                        collector_instance = collector_class()
                        
                        # Registrar
                        self.register_collector(collector_instance)
                        
                        self.logger.info(f"Dynamically loaded collector: {name}")
                    
                    except Exception as e:
                        self.logger.error(f"Failed to load collector {name}: {e}")
        
        except Exception as e:
            self.logger.error(f"Failed to discover collectors: {e}")
    
    async def execute_collectors(self) -> Dict[str, Any]:
        """
        Ejecuta todos los collectors habilitados
        Programación Dinámica: Itera sobre Dict de collectors
        """
        results = {}
        
        # Ordenar collectors por prioridad
        sorted_collectors = sorted(
            self.collectors.values(),
            key=lambda c: c.priority
        )
        
        # Ejecutar collectors
        for collector in sorted_collectors:
            try:
                # Verificar si puede ejecutarse
                if not await collector.can_collect():
                    self.logger.debug(f"Collector {collector.name} cannot collect, skipping...")
                    continue
                
                # Ejecutar
                self.logger.info(f"Executing collector: {collector.name}")
                data = await collector.collect()
                
                results[collector.name] = {
                    'success': True,
                    'data': data,
                }
                
                self.stats['successful_collections'] += 1
            
            except Exception as e:
                self.logger.error(f"Collector {collector.name} failed: {e}")
                results[collector.name] = {
                    'success': False,
                    'error': str(e),
                }
                self.stats['failed_collections'] += 1
        
        self.stats['total_collections'] += 1
        
        return results
    
    async def health_check_collectors(self) -> Dict[str, bool]:
        """
        Verifica salud de todos los collectors
        """
        health_status = {}
        
        for name, collector in self.collectors.items():
            try:
                is_healthy = await collector.health_check()
                health_status[name] = is_healthy
            except Exception as e:
                self.logger.error(f"Health check failed for {name}: {e}")
                health_status[name] = False
        
        return health_status
    
    def get_stats(self) -> Dict[str, Any]:
        """Obtiene estadísticas del orchestrator"""
        return {
            **self.stats,
            'registered_collectors': list(self.collectors.keys()),
            'configured_collectors': len(self.collector_configs),
            'enabled_collectors': sum(1 for c in self.collector_configs.values() if c['enabled']),
        }


# ==================================================================================
# ENHANCED MAIN WITH DYNAMIC ORCHESTRATOR
# ==================================================================================

async def main_with_dynamic_orchestrator():
    """
    Función principal con orchestrator dinámico
    Programación Dinámica: Descubrimiento y ejecución de collectors
    """
    logger = logging.getLogger(__name__)
    
    # Inicializar sheets client
    sheets_client = None  # TODO: Inicializar con credenciales
    
    # Crear orchestrator dinámico
    orchestrator = DynamicCollectorOrchestrator(
        sheets_client=sheets_client,
        max_concurrent=40
    )
    
    try:
        logger.info("🚀 Iniciando sistema con orchestrator dinámico...")
        
        # 1. Cargar configuración de collectors desde Sheets
        await orchestrator.load_collectors_config()
        
        # 2. Registrar collectors por defecto
        # (En producción, estos se cargarían dinámicamente desde config)
        pyth_collector = PythCollector(pyth_connector=None)  # TODO: Inicializar connector
        orchestrator.register_collector(pyth_collector)
        
        chainlink_collector = ChainlinkCollector()
        orchestrator.register_collector(chainlink_collector)
        
        # 3. Descubrir collectors adicionales desde configuración
        await orchestrator.discover_collectors()
        
        # 4. Verificar salud de collectors
        health_status = await orchestrator.health_check_collectors()
        logger.info(f"Health status: {health_status}")
        
        # 5. Ejecutar collectors
        results = await orchestrator.execute_collectors()
        logger.info(f"Collection results: {len(results)} collectors executed")
        
        # 6. Mostrar estadísticas
        stats = orchestrator.get_stats()
        logger.info(f"📊 Estadísticas del orchestrator:")
        logger.info(f"  - Collectors registrados: {stats['collectors_registered']}")
        logger.info(f"  - Collectors habilitados: {stats['enabled_collectors']}")
        logger.info(f"  - Recolecciones exitosas: {stats['successful_collections']}")
        logger.info(f"  - Recolecciones fallidas: {stats['failed_collections']}")
        
        logger.info("✅ Sistema completado exitosamente")
    
    except Exception as e:
        logger.error(f"❌ Error en main: {e}")
        raise


# ==================================================================================
# ENTRY POINT
# ==================================================================================

if __name__ == '__main__':
    # Configurar logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Ejecutar main con orchestrator dinámico
    import asyncio
    asyncio.run(main_with_dynamic_orchestrator())

