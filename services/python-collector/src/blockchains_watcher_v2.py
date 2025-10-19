"""
BlockchainsWatcher V2 - Servicio con integración de datos reales

📥 ENTRADAS:
- Hoja BLOCKCHAINS, columna NAME (PULL/blanca)
- Usuario escribe nombre de blockchain (ej: "polygon")

🔄 TRANSFORMACIONES:
- Detecta cambios en columna NAME cada 500ms
- Consulta DefiLlama, Publicnodes, Llamanodes automáticamente
- Agrega datos de múltiples fuentes
- Actualiza columnas PUSH (azules) con datos reales

📤 SALIDAS:
- 50 columnas PUSH actualizadas automáticamente con datos reales
- Logs detallados de cambios y consultas
- Manejo de errores y fallbacks

🔗 DEPENDENCIAS:
- excel_client_v2 para detección de cambios
- data_fetchers para consultar fuentes externas (DefiLlama, Publicnodes, Llamanodes)
"""

import time
import logging
import sys
import os
from typing import Dict, Any, List

# Agregar directorio actual al path para imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from excel_client_v2 import get_excel_client_v2
from data_fetchers.blockchain_data_aggregator import get_blockchain_data_aggregator

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class BlockchainsWatcherV2:
    """
    Servicio que monitorea cambios en la columna NAME de BLOCKCHAINS
    y dispara actualización automática de columnas PUSH con datos reales
    """
    
    def __init__(self, poll_interval: float = 1.0):
        """
        Args:
            poll_interval: Intervalo de polling en segundos (default 1s)
        """
        self.client = get_excel_client_v2()
        self.aggregator = get_blockchain_data_aggregator()
        self.poll_interval = poll_interval
        self.running = False
        self.sheet_name = "BLOCKCHAINS"
        
        logger.info(f"BlockchainsWatcherV2 inicializado (poll_interval={poll_interval}s)")
        logger.info("✅ Integración con datos reales: DefiLlama + Publicnodes + Llamanodes")
    
    def _fetch_blockchain_data(self, blockchain_name: str) -> Dict[str, Any]:
        """
        Consulta fuentes externas para obtener datos reales de una blockchain
        
        Args:
            blockchain_name: Nombre de la blockchain (ej: "polygon")
            
        Returns:
            Diccionario con datos para columnas PUSH
        """
        logger.info(f"🔍 Consultando datos REALES para blockchain: {blockchain_name}")
        
        try:
            # Usar el agregador para obtener datos de todas las fuentes
            complete_data = self.aggregator.get_complete_blockchain_data(blockchain_name)
            
            logger.info(f"✅ Datos reales obtenidos para {blockchain_name}")
            logger.debug(f"Datos: {complete_data}")
            
            return complete_data
            
        except Exception as e:
            logger.error(f"❌ Error al obtener datos para {blockchain_name}: {e}", exc_info=True)
            
            # Retornar datos de fallback en caso de error
            return self._get_fallback_data(blockchain_name)
    
    def _get_fallback_data(self, blockchain_name: str) -> Dict[str, Any]:
        """
        Retorna datos de fallback en caso de error
        
        Args:
            blockchain_name: Nombre de la blockchain
            
        Returns:
            Diccionario con datos básicos
        """
        logger.warning(f"⚠️  Usando datos de fallback para {blockchain_name}")
        
        return {
            'BLOCKCHAIN_ID': blockchain_name.lower(),
            'CHAIN_ID': 0,
            'NATIVE_TOKEN': 'UNKNOWN',
            'SYMBOL': 'UNKNOWN',
            'TVL_USD': 0,
            'RPC_URL_1': '',
            'RPC_URL_2': '',
            'RPC_URL_3': '',
            'WSS_URL': '',
            'EXPLORER_URL': '',
            'HEALTH_STATUS': 'ERROR',
            'IS_ACTIVE': False,
            'NOTES': f'Error fetching data - using fallback'
        }
    
    def _handle_change(self, change: Dict[str, Any]):
        """
        Maneja un cambio detectado en columna PULL
        
        Args:
            change: Diccionario con información del cambio
        """
        row = change['row']
        column_name = change['column_name']
        old_value = change['old_value']
        new_value = change['new_value']
        
        logger.info(f"📝 Cambio detectado en fila {row}, {column_name}: '{old_value}' → '{new_value}'")
        
        if column_name == "NAME" and new_value:
            # Consultar fuentes externas REALES
            start_time = time.time()
            blockchain_data = self._fetch_blockchain_data(new_value)
            fetch_time = (time.time() - start_time) * 1000  # en ms
            
            # Actualizar columnas PUSH
            logger.info(f"💾 Actualizando columnas PUSH para fila {row}...")
            update_start = time.time()
            self.client.update_push_columns(self.sheet_name, row, blockchain_data)
            update_time = (time.time() - update_start) * 1000  # en ms
            
            total_time = fetch_time + update_time
            
            logger.info(f"✅ Columnas PUSH actualizadas para '{new_value}'")
            logger.info(f"⏱️  Tiempos: Fetch={fetch_time:.0f}ms, Update={update_time:.0f}ms, Total={total_time:.0f}ms")
            
            # Información de rendimiento (no crítico)
            if total_time < 300:
                logger.info(f"🎯 Excelente rendimiento: {total_time:.0f}ms < 300ms (objetivo)")
            elif total_time < 500:
                logger.info(f"✅ Buen rendimiento: {total_time:.0f}ms < 500ms (aceptable)")
            elif total_time < 1000:
                logger.info(f"ℹ️  Rendimiento normal: {total_time:.0f}ms < 1s")
            else:
                logger.warning(f"⚠️  Latencia alta: {total_time:.0f}ms > 1s (considera optimizar conexión)")
    
    def start(self):
        """Inicia el servicio de monitoreo"""
        self.running = True
        logger.info(f"🚀 BlockchainsWatcherV2 iniciado (polling cada {self.poll_interval}s)")
        logger.info("📊 Fuentes de datos: DefiLlama API + Publicnodes + Llamanodes")
        
        try:
            iteration = 0
            while self.running:
                iteration += 1
                
                # Detectar cambios en columnas PULL
                try:
                    changes = self.client.detect_changes_in_pull_columns(
                        self.sheet_name,
                        start_row=2,
                        end_row=100
                    )
                    
                    # Procesar cada cambio
                    if changes:
                        logger.info(f"🔔 Detectados {len(changes)} cambios en iteración {iteration}")
                        for change in changes:
                            self._handle_change(change)
                    else:
                        # Log silencioso cada 10 iteraciones
                        if iteration % 10 == 0:
                            logger.debug(f"💤 Sin cambios detectados (iteración {iteration})")
                
                except Exception as e:
                    logger.error(f"❌ Error en iteración {iteration}: {e}", exc_info=True)
                
                # Esperar antes del próximo poll
                time.sleep(self.poll_interval)
                
        except KeyboardInterrupt:
            logger.info("⏹️  BlockchainsWatcherV2 detenido por usuario")
        except Exception as e:
            logger.error(f"❌ Error crítico en BlockchainsWatcherV2: {e}", exc_info=True)
        finally:
            self.running = False
    
    def stop(self):
        """Detiene el servicio de monitoreo"""
        logger.info("⏹️  Deteniendo BlockchainsWatcherV2...")
        self.running = False

def main():
    """Entry point del servicio"""
    logger.info("=" * 80)
    logger.info("BLOCKCHAINS WATCHER V2 - Con integración de datos reales")
    logger.info("=" * 80)
    
    watcher = BlockchainsWatcherV2(poll_interval=1.0)
    
    try:
        watcher.start()
    except KeyboardInterrupt:
        watcher.stop()

if __name__ == "__main__":
    main()

