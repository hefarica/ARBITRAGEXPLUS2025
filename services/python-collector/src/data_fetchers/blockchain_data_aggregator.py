"""
BlockchainDataAggregator - Agrega datos de múltiples fuentes externas

Combina información de:
1. DefiLlama - TVL, protocolos, datos generales
2. Publicnodes - Endpoints RPC públicos
3. Llamanodes - Endpoints RPC de Llamanodes

Proporciona una interfaz unificada para obtener todos los datos necesarios
para las columnas PUSH de la hoja BLOCKCHAINS
"""

import logging
from typing import Dict, Any
from datetime import datetime

from .defillama_client import get_defillama_client
from .publicnodes_client import get_publicnodes_client
from .llamanodes_client import get_llamanodes_client

logger = logging.getLogger(__name__)

class BlockchainDataAggregator:
    """Agregador que combina datos de múltiples fuentes"""
    
    def __init__(self):
        """Inicializa todos los clientes de datos"""
        self.defillama = get_defillama_client()
        self.publicnodes = get_publicnodes_client()
        self.llamanodes = get_llamanodes_client()
        logger.info("BlockchainDataAggregator inicializado")
    
    def get_complete_blockchain_data(self, blockchain_name: str) -> Dict[str, Any]:
        """
        Obtiene datos completos de una blockchain desde todas las fuentes
        
        Args:
            blockchain_name: Nombre de la blockchain (ej: "ethereum", "polygon")
            
        Returns:
            Diccionario con todos los datos para columnas PUSH
        """
        logger.info(f"📊 Agregando datos completos para: {blockchain_name}")
        
        # Obtener datos de cada fuente
        defillama_data = self.defillama.get_blockchain_data_for_excel(blockchain_name)
        publicnodes_data = self.publicnodes.get_blockchain_rpc_data_for_excel(blockchain_name)
        llamanodes_data = self.llamanodes.get_blockchain_llamanodes_data_for_excel(blockchain_name)
        
        # Combinar todos los datos
        complete_data = {
            # Datos básicos de identificación
            'BLOCKCHAIN_ID': defillama_data.get('BLOCKCHAIN_ID', blockchain_name.lower()),
            'NAME': blockchain_name,  # Columna PULL, pero la incluimos para referencia
            'CHAIN_ID': publicnodes_data.get('CHAIN_ID') or defillama_data.get('CHAIN_ID', 0),
            'NATIVE_TOKEN': defillama_data.get('NATIVE_TOKEN', 'UNKNOWN'),
            'SYMBOL': defillama_data.get('SYMBOL', 'UNKNOWN'),
            
            # Datos de DefiLlama
            'TVL_USD': defillama_data.get('TVL_USD', 0),
            'CMC_ID': defillama_data.get('CMC_ID', ''),
            'GECKO_ID': defillama_data.get('GECKO_ID', ''),
            'DEFILLAMA_NAME': defillama_data.get('DEFILLAMA_NAME', blockchain_name),
            
            # Endpoints RPC de Publicnodes
            'RPC_URL_1': publicnodes_data.get('RPC_URL_1', ''),
            'RPC_URL_2': publicnodes_data.get('RPC_URL_2', ''),
            'RPC_URL_3': publicnodes_data.get('RPC_URL_3', ''),
            'WSS_URL': publicnodes_data.get('WSS_URL', ''),
            'WSS_URL_2': publicnodes_data.get('WSS_URL_2', ''),
            'EXPLORER_URL': publicnodes_data.get('EXPLORER_URL', ''),
            'RPC_PROVIDER': publicnodes_data.get('RPC_PROVIDER', ''),
            'RPC_STATUS': publicnodes_data.get('RPC_STATUS', 'UNKNOWN'),
            
            # Endpoints de Llamanodes
            'LLAMANODES_RPC': llamanodes_data.get('LLAMANODES_RPC', ''),
            'LLAMANODES_WSS': llamanodes_data.get('LLAMANODES_WSS', ''),
            'LLAMANODES_DOCS': llamanodes_data.get('LLAMANODES_DOCS', ''),
            'LLAMANODES_STATUS': llamanodes_data.get('LLAMANODES_STATUS', 'UNKNOWN'),
            'LLAMANODES_VERIFIED': llamanodes_data.get('LLAMANODES_VERIFIED', False),
            
            # Metadatos
            'LAST_UPDATED': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'DATA_SOURCE': 'DefiLlama + Publicnodes + Llamanodes',
            'IS_ACTIVE': self._determine_is_active(defillama_data, publicnodes_data),
            'HEALTH_STATUS': self._determine_health_status(publicnodes_data, llamanodes_data),
            'NOTES': f"Auto-populated from multiple sources at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        }
        
        logger.info(f"✅ Datos completos agregados para {blockchain_name}")
        return complete_data
    
    def _determine_is_active(self, defillama_data: Dict[str, Any], 
                            publicnodes_data: Dict[str, Any]) -> bool:
        """
        Determina si una blockchain está activa basándose en los datos
        
        Args:
            defillama_data: Datos de DefiLlama
            publicnodes_data: Datos de Publicnodes
            
        Returns:
            True si la blockchain está activa
        """
        # Considerar activa si tiene TVL > 0 o RPCs disponibles
        has_tvl = defillama_data.get('TVL_USD', 0) > 0
        has_rpcs = publicnodes_data.get('RPC_STATUS') == 'AVAILABLE'
        
        return has_tvl or has_rpcs
    
    def _determine_health_status(self, publicnodes_data: Dict[str, Any],
                                 llamanodes_data: Dict[str, Any]) -> str:
        """
        Determina el estado de salud de una blockchain
        
        Args:
            publicnodes_data: Datos de Publicnodes
            llamanodes_data: Datos de Llamanodes
            
        Returns:
            Estado de salud: HEALTHY, DEGRADED, UNHEALTHY, UNKNOWN
        """
        rpc_available = publicnodes_data.get('RPC_STATUS') == 'AVAILABLE'
        llamanodes_available = llamanodes_data.get('LLAMANODES_STATUS') == 'AVAILABLE'
        
        if rpc_available and llamanodes_available:
            return 'HEALTHY'
        elif rpc_available or llamanodes_available:
            return 'DEGRADED'
        elif publicnodes_data.get('RPC_STATUS') == 'UNAVAILABLE':
            return 'UNHEALTHY'
        else:
            return 'UNKNOWN'
    
    def get_supported_blockchains(self) -> Dict[str, Any]:
        """
        Obtiene lista de blockchains soportadas por todas las fuentes
        
        Returns:
            Diccionario con listas de blockchains por fuente
        """
        return {
            'defillama': 'All chains from DefiLlama API',
            'publicnodes': list(self.publicnodes.KNOWN_RPCS.keys()),
            'llamanodes': self.llamanodes.get_all_supported_chains()
        }

# Singleton
_aggregator_instance = None

def get_blockchain_data_aggregator() -> BlockchainDataAggregator:
    """Retorna instancia singleton del agregador"""
    global _aggregator_instance
    if _aggregator_instance is None:
        _aggregator_instance = BlockchainDataAggregator()
    return _aggregator_instance

