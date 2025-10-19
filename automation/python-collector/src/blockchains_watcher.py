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
- 50 columnas PUSH actualizadas automáticamente
- Logs de cambios detectados

🔗 DEPENDENCIAS:
- excel_client_v2 para detección de cambios
- fetch_chain_info para consultar fuentes externas (próxima fase)
"""

import time
import logging
from typing import Dict, Any, List
from excel_client_v2 import get_excel_client_v2

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
            
        TODO: Implementar en Fase 4 con DefiLlama, Llamanodes, Publicnodes
        """
        logger.info(f"🔍 Consultando datos para blockchain: {blockchain_name}")
        
        # Por ahora, retornar datos mock
        # En Fase 4 se implementará la consulta real
        return {
            'BLOCKCHAIN_ID': f"{blockchain_name}_001",
            'CHAIN_ID': self._get_chain_id(blockchain_name),
            'NATIVE_TOKEN': self._get_native_token(blockchain_name),
            'SYMBOL': self._get_symbol(blockchain_name),
            'RPC_URL_1': f"https://rpc.{blockchain_name}.io",
            'RPC_URL_2': f"https://rpc2.{blockchain_name}.io",
            'RPC_URL_3': f"https://rpc3.{blockchain_name}.io",
            'WSS_URL': f"wss://ws.{blockchain_name}.io",
            'EXPLORER_URL': f"https://explorer.{blockchain_name}.io",
            'BLOCK_TIME_MS': 2000,
            'IS_ACTIVE': True,
            'HEALTH_STATUS': "HEALTHY",
            'NOTES': f"Auto-populated from external sources at {time.strftime('%Y-%m-%d %H:%M:%S')}"
        }
    
    def _get_chain_id(self, blockchain_name: str) -> int:
        """Retorna chain ID conocido"""
        chain_ids = {
            'ethereum': 1,
            'polygon': 137,
            'bsc': 56,
            'avalanche': 43114,
            'arbitrum': 42161,
            'optimism': 10,
        }
        return chain_ids.get(blockchain_name.lower(), 0)
    
    def _get_native_token(self, blockchain_name: str) -> str:
        """Retorna token nativo"""
        tokens = {
            'ethereum': 'ETH',
            'polygon': 'MATIC',
            'bsc': 'BNB',
            'avalanche': 'AVAX',
            'arbitrum': 'ETH',
            'optimism': 'ETH',
        }
        return tokens.get(blockchain_name.lower(), 'UNKNOWN')
    
    def _get_symbol(self, blockchain_name: str) -> str:
        """Retorna símbolo"""
        return self._get_native_token(blockchain_name)
    
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
        
        logger.info(f"📝 Cambio detectado en fila {row}, {column_name}: {old_value} → {new_value}")
        
        if column_name == "NAME" and new_value:
            # Consultar fuentes externas
            blockchain_data = self._fetch_blockchain_data(new_value)
            
            # Actualizar columnas PUSH
            logger.info(f"💾 Actualizando columnas PUSH para fila {row}...")
            self.client.update_push_columns(self.sheet_name, row, blockchain_data)
            logger.info(f"✅ Columnas PUSH actualizadas para {new_value}")
    
    def start(self):
        """Inicia el servicio de monitoreo"""
        self.running = True
        logger.info(f"🚀 BlockchainsWatcher iniciado (polling cada {self.poll_interval}s)")
        
        try:
            while self.running:
                # Detectar cambios en columnas PULL
                changes = self.client.detect_changes_in_pull_columns(
                    self.sheet_name,
                    start_row=2,
                    end_row=100
                )
                
                # Procesar cada cambio
                for change in changes:
                    self._handle_change(change)
                
                # Esperar antes del próximo poll
                time.sleep(self.poll_interval)
                
        except KeyboardInterrupt:
            logger.info("⏹️  BlockchainsWatcher detenido por usuario")
        except Exception as e:
            logger.error(f"❌ Error en BlockchainsWatcher: {e}", exc_info=True)
        finally:
            self.running = False
    
    def stop(self):
        """Detiene el servicio de monitoreo"""
        logger.info("⏹️  Deteniendo BlockchainsWatcher...")
        self.running = False

def main():
    """Entry point del servicio"""
    watcher = BlockchainsWatcher(poll_interval=0.5)
    
    try:
        watcher.start()
    except KeyboardInterrupt:
        watcher.stop()

if __name__ == "__main__":
    main()

