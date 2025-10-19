"""
BlockchainsWatcher V2 - Servicio con integración de datos reales

📥 ENTRADAS:
- Hoja BLOCKCHAINS, columna NAME (PULL/blanca)
- Usuario escribe nombre de blockchain (ej: "polygon")

🔄 TRANSFORMACIONES:
- Detecta cambios en columna NAME cada 1s
- Consulta DefiLlama, Publicnodes, Llamanodes automáticamente
- Agrega datos de múltiples fuentes
- Actualiza columnas PUSH (azules) con datos reales

🔒 PERSISTENCIA:
- Si usuario borra dato en columna PUSH → Sistema lo restaura automáticamente
- Si usuario borra NAME → Sistema limpia todas las columnas PUSH de esa fila

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
            poll_interval: Intervalo de polling en segundos
        """
        self.client = get_excel_client_v2()
        self.aggregator = get_blockchain_data_aggregator()
        self.sheet_name = "BLOCKCHAINS"
        self.poll_interval = poll_interval
        self.running = False
    
    def _fetch_blockchain_data(self, blockchain_name: str) -> Dict[str, Any]:
        """
        Obtiene datos reales de una blockchain desde múltiples fuentes
        
        Args:
            blockchain_name: Nombre de la blockchain (ej: "polygon")
            
        Returns:
            Diccionario con datos agregados de todas las fuentes
        """
        try:
            logger.info(f"🔍 Consultando datos para: {blockchain_name}")
            data = self.aggregator.get_blockchain_data(blockchain_name)
            
            if data:
                logger.info(f"✅ Datos reales obtenidos para {blockchain_name}")
                return data
            else:
                logger.warning(f"⚠️  No se encontraron datos para {blockchain_name}, usando fallback")
                return self._get_fallback_data(blockchain_name)
                
        except Exception as e:
            logger.error(f"❌ Error obteniendo datos para {blockchain_name}: {e}")
            return self._get_fallback_data(blockchain_name)
    
    def _get_fallback_data(self, blockchain_name: str) -> Dict[str, Any]:
        """Retorna datos de fallback cuando las fuentes externas fallan"""
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
        
        if column_name == "NAME":
            if new_value:  # Usuario escribió un nombre
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
            
            elif old_value and not new_value:  # Usuario borró el nombre
                # Limpiar todas las columnas PUSH de esta fila
                logger.info(f"🧹 NAME borrado en fila {row}, limpiando todas las columnas PUSH...")
                self.client.clear_push_columns(self.sheet_name, row)
                logger.info(f"✅ Columnas PUSH limpiadas para fila {row}")
    
    def _handle_push_change(self, change: Dict[str, Any]):
        """
        Maneja cambios en columnas PUSH (restauración automática)
        
        Args:
            change: Diccionario con información del cambio
        """
        row = change['row']
        column_name = change['column_name']
        old_value = change['old_value']
        
        logger.warning(f"⚠️  Columna PUSH '{column_name}' borrada manualmente en fila {row}")
        logger.info(f"🔄 Restaurando valor: '{old_value}'")
        
        # Restaurar el valor borrado
        self.client.update_push_columns(self.sheet_name, row, {column_name: old_value})
        logger.info(f"✅ Valor restaurado en {column_name}, fila {row}")
    
    def start(self):
        """Inicia el servicio de monitoreo"""
        self.running = True
        logger.info(f"🚀 BlockchainsWatcherV2 iniciado (polling cada {self.poll_interval}s)")
        logger.info("📊 Fuentes de datos: DefiLlama API + Publicnodes + Llamanodes")
        logger.info("🔒 Persistencia PUSH activada: Los datos borrados se restauran automáticamente")
        logger.info("🧹 Limpieza automática: Si borras NAME, se limpian todas las columnas PUSH")
        
        try:
            iteration = 0
            while self.running:
                iteration += 1
                
                # Detectar cambios en columnas PULL y PUSH
                try:
                    pull_changes = self.client.detect_changes_in_pull_columns(
                        self.sheet_name,
                        start_row=2,
                        end_row=100
                    )
                    
                    # Detectar cambios en columnas PUSH (persistencia)
                    push_changes = self.client.detect_changes_in_push_columns(
                        self.sheet_name,
                        start_row=2,
                        end_row=100
                    )
                    
                    # Procesar cambios en PULL
                    if pull_changes:
                        logger.info(f"🔔 Detectados {len(pull_changes)} cambios en columnas PULL (iteración {iteration})")
                        for change in pull_changes:
                            self._handle_change(change)
                    
                    # Procesar cambios en PUSH (restauración)
                    if push_changes:
                        logger.info(f"🔄 Detectados {len(push_changes)} cambios en columnas PUSH (restauración automática)")
                        for change in push_changes:
                            self._handle_push_change(change)
                    
                    # Log silencioso si no hay cambios
                    if not pull_changes and not push_changes:
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

if __name__ == "__main__":
    watcher = BlockchainsWatcherV2()
    watcher.start()

