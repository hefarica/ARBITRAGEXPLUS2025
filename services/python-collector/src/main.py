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