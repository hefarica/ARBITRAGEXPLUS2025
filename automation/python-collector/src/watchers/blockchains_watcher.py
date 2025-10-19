"""
BlockchainsWatcher - Servicio que monitorea cambios en la columna NAME (PULL) de la hoja BLOCKCHAINS

📥 ENTRADAS:
- Hoja BLOCKCHAINS, columna NAME (PULL/blanca)
- Usuario escribe nombre de blockchain (ej: "polygon")

🔄 TRANSFORMACIONES:
- Detecta cambios en columna NAME cada 500ms
- Dispara consulta a fuentes externas cuando detecta cambio
- Actualiza columnas PUSH (azules) con datos obtenidos

📤 SALIDAS:
- 50+ columnas PUSH actualizadas automáticamente
- Logs de cambios detectados

🔗 DEPENDENCIAS:
- excel_client_v2 para detección de cambios
- blockchain_data_aggregator para consultar fuentes externas
- rate_limiter para evitar bloqueos de API
"""

import time
import logging
import sys
import os
from typing import Dict, Any, List

# Agregar src al path para imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from excel_client_v2 import get_excel_client_v2
from aggregators.blockchain_data_aggregator import get_blockchain_data_aggregator

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class BlockchainsWatcher:
    """
    Servicio que monitorea cambios en la columna NAME de BLOCKCHAINS
    y dispara actualización automática de columnas PUSH
    """
    
    def __init__(self, poll_interval: float = 0.5):
        """
        Args:
            poll_interval: Intervalo de polling en segundos (default 500ms)
        """
        self.client = get_excel_client_v2()
        self.aggregator = get_blockchain_data_aggregator()
        self.poll_interval = poll_interval
        self.running = False
        self.sheet_name = "BLOCKCHAINS"
        
        logger.info(f"BlockchainsWatcher inicializado (poll_interval={poll_interval}s)")
    
    def _fetch_blockchain_data(self, blockchain_name: str) -> Dict[str, Any]:
        """
        Consulta fuentes externas para obtener datos de una blockchain
        
        Args:
            blockchain_name: Nombre de la blockchain (ej: "polygon")
            
        Returns:
            Diccionario con datos para columnas PUSH
        """
        logger.info(f"🔍 Consultando datos para blockchain: {blockchain_name}")
        
        try:
            # Usar el agregador para obtener datos de todas las fuentes
            data = self.aggregator.aggregate_blockchain_data(
                blockchain_name,
                parallel=True  # Consultar fuentes en paralelo para mayor velocidad
            )
            
            fetch_time = data.get('FETCH_TIME_MS', 0)
            logger.info(f"✅ Datos obtenidos para {blockchain_name} en {fetch_time}ms")
            
            return data
            
        except Exception as e:
            logger.error(f"❌ Error al obtener datos para {blockchain_name}: {e}", exc_info=True)
            
            # Retornar datos mínimos en caso de error
            return {
                'NAME': blockchain_name.capitalize(),
                'HEALTH_STATUS': 'ERROR',
                'ERROR_MESSAGE': str(e),
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
        
        # Solo procesar cambios en columna NAME con valor no vacío
        if column_name == "NAME" and new_value and str(new_value).strip():
            blockchain_name = str(new_value).strip()
            
            # Consultar fuentes externas
            start_time = time.time()
            blockchain_data = self._fetch_blockchain_data(blockchain_name)
            fetch_elapsed = (time.time() - start_time) * 1000
            
            # Actualizar columnas PUSH
            logger.info(f"💾 Actualizando columnas PUSH para fila {row}...")
            try:
                self.client.update_push_columns(self.sheet_name, row, blockchain_data)
                update_elapsed = (time.time() - start_time) * 1000
                
                logger.info(
                    f"✅ Columnas PUSH actualizadas para '{blockchain_name}' "
                    f"(fetch: {fetch_elapsed:.0f}ms, total: {update_elapsed:.0f}ms)"
                )
            except Exception as e:
                logger.error(f"❌ Error al actualizar columnas PUSH: {e}", exc_info=True)
    
    def start(self):
        """Inicia el servicio de monitoreo"""
        self.running = True
        logger.info(f"🚀 BlockchainsWatcher iniciado (polling cada {self.poll_interval}s)")
        logger.info(f"📊 Monitoreando hoja: {self.sheet_name}")
        
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
                        logger.info(f"🔔 {len(changes)} cambio(s) detectado(s) en iteración {iteration}")
                        for change in changes:
                            self._handle_change(change)
                    else:
                        # Log cada 10 iteraciones para no saturar
                        if iteration % 10 == 0:
                            logger.debug(f"⏳ Iteración {iteration}: Sin cambios detectados")
                    
                except Exception as e:
                    logger.error(f"❌ Error al detectar cambios: {e}", exc_info=True)
                
                # Esperar antes del próximo poll
                time.sleep(self.poll_interval)
                
        except KeyboardInterrupt:
            logger.info("⏹️  BlockchainsWatcher detenido por usuario")
        except Exception as e:
            logger.error(f"❌ Error crítico en BlockchainsWatcher: {e}", exc_info=True)
        finally:
            self.running = False
    
    def stop(self):
        """Detiene el servicio de monitoreo"""
        logger.info("⏹️  Deteniendo BlockchainsWatcher...")
        self.running = False


def main():
    """Entry point del servicio"""
    logger.info("="*80)
    logger.info("BLOCKCHAINS WATCHER - Sistema de Sincronización Bidireccional Excel")
    logger.info("="*80)
    logger.info("")
    logger.info("📋 Instrucciones:")
    logger.info("  1. Abre el archivo Excel: data/ARBITRAGEXPLUS2025.xlsx")
    logger.info("  2. Ve a la hoja BLOCKCHAINS")
    logger.info("  3. Escribe un nombre de blockchain en la columna B (NAME)")
    logger.info("     Ejemplos: polygon, ethereum, bsc, arbitrum, optimism")
    logger.info("  4. Las columnas PUSH (azules) se actualizarán automáticamente")
    logger.info("")
    logger.info("⏱️  Tiempo objetivo: <500ms por actualización")
    logger.info("🔄 Intervalo de polling: 500ms")
    logger.info("")
    logger.info("Presiona Ctrl+C para detener el servicio")
    logger.info("="*80)
    logger.info("")
    
    watcher = BlockchainsWatcher(poll_interval=0.5)
    
    try:
        watcher.start()
    except KeyboardInterrupt:
        watcher.stop()


if __name__ == "__main__":
    main()

