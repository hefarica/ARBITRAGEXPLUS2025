"""
Llamanodes Client - Obtiene configuraciones de nodos desde repositorios GitHub de Llamanodes

📥 ENTRADAS:
- Nombre de blockchain

🔄 TRANSFORMACIONES:
- Scraping de repositorios GitHub de Llamanodes
- Extracción de configuraciones de nodos

📤 SALIDAS:
- Diccionario con URLs de nodos y configuraciones

🔗 DEPENDENCIAS:
- requests para HTTP calls
- re para parsing

Fuentes:
- https://llamanodes.com/ - Proveedor de nodos RPC
- GitHub repos con configuraciones públicas
"""

import requests
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
import re

logger = logging.getLogger(__name__)


class LlamanodesClient:
    """Cliente para obtener configuraciones de nodos desde Llamanodes"""
    
    # Mapeo de blockchains a configuraciones conocidas
    KNOWN_CONFIGS = {
        'ethereum': {
            'rpc_urls': [
                'https://eth.llamarpc.com',
                'https://ethereum.publicnode.com',
            ],
            'wss_urls': [
                'wss://eth.llamarpc.com',
            ],
            'chain_id': 1,
        },
        'polygon': {
            'rpc_urls': [
                'https://polygon.llamarpc.com',
                'https://polygon-rpc.com',
            ],
            'wss_urls': [
                'wss://polygon.llamarpc.com',
            ],
            'chain_id': 137,
        },
        'bsc': {
            'rpc_urls': [
                'https://bsc.llamarpc.com',
                'https://bsc-dataseed.binance.org',
            ],
            'wss_urls': [
                'wss://bsc.llamarpc.com',
            ],
            'chain_id': 56,
        },
        'arbitrum': {
            'rpc_urls': [
                'https://arbitrum.llamarpc.com',
                'https://arb1.arbitrum.io/rpc',
            ],
            'wss_urls': [
                'wss://arbitrum.llamarpc.com',
            ],
            'chain_id': 42161,
        },
        'optimism': {
            'rpc_urls': [
                'https://optimism.llamarpc.com',
                'https://mainnet.optimism.io',
            ],
            'wss_urls': [
                'wss://optimism.llamarpc.com',
            ],
            'chain_id': 10,
        },
        'avalanche': {
            'rpc_urls': [
                'https://avalanche.llamarpc.com',
                'https://api.avax.network/ext/bc/C/rpc',
            ],
            'wss_urls': [
                'wss://avalanche.llamarpc.com',
            ],
            'chain_id': 43114,
        },
        'base': {
            'rpc_urls': [
                'https://base.llamarpc.com',
                'https://mainnet.base.org',
            ],
            'wss_urls': [
                'wss://base.llamarpc.com',
            ],
            'chain_id': 8453,
        },
    }
    
    def __init__(self, timeout: int = 10):
        """
        Args:
            timeout: Timeout para requests en segundos
        """
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'ARBITRAGEXPLUS2025/1.0'
        })
        logger.info("LlamanodesClient initialized")
    
    def get_node_config(self, chain_name: str) -> Optional[Dict[str, Any]]:
        """
        Obtiene configuración de nodos para una blockchain
        
        Args:
            chain_name: Nombre de la blockchain
            
        Returns:
            Diccionario con configuración de nodos
        """
        chain_name_normalized = chain_name.lower().strip()
        
        # Buscar en configuraciones conocidas
        if chain_name_normalized in self.KNOWN_CONFIGS:
            config = self.KNOWN_CONFIGS[chain_name_normalized]
            logger.info(f"✅ Node config found for {chain_name}")
            return config
        
        logger.warning(f"⚠️  No node config found for {chain_name}")
        return None
    
    def test_rpc_endpoint(self, rpc_url: str) -> bool:
        """
        Prueba si un endpoint RPC está activo
        
        Args:
            rpc_url: URL del endpoint RPC
            
        Returns:
            True si el endpoint responde correctamente
        """
        try:
            payload = {
                "jsonrpc": "2.0",
                "method": "eth_blockNumber",
                "params": [],
                "id": 1
            }
            
            response = self.session.post(
                rpc_url,
                json=payload,
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'result' in data:
                    logger.info(f"✅ RPC endpoint is active: {rpc_url}")
                    return True
            
            return False
            
        except Exception as e:
            logger.debug(f"RPC endpoint test failed for {rpc_url}: {e}")
            return False
    
    def get_active_rpcs(self, chain_name: str) -> List[str]:
        """
        Obtiene lista de RPCs activos para una blockchain
        
        Args:
            chain_name: Nombre de la blockchain
            
        Returns:
            Lista de URLs de RPCs activos
        """
        config = self.get_node_config(chain_name)
        if not config:
            return []
        
        rpc_urls = config.get('rpc_urls', [])
        active_rpcs = []
        
        for rpc_url in rpc_urls:
            if self.test_rpc_endpoint(rpc_url):
                active_rpcs.append(rpc_url)
        
        logger.info(f"📊 Active RPCs for {chain_name}: {len(active_rpcs)}/{len(rpc_urls)}")
        return active_rpcs
    
    def extract_blockchain_data(self, chain_name: str) -> Dict[str, Any]:
        """
        Extrae datos de nodos para una blockchain
        
        Args:
            chain_name: Nombre de la blockchain
            
        Returns:
            Diccionario con datos para columnas PUSH
        """
        logger.info(f"🔍 Fetching node data from Llamanodes for: {chain_name}")
        
        config = self.get_node_config(chain_name)
        
        if not config:
            logger.warning(f"⚠️  No node config found for {chain_name}")
            return {}
        
        rpc_urls = config.get('rpc_urls', [])
        wss_urls = config.get('wss_urls', [])
        
        # Construir datos
        data = {
            'RPC_URL_1': rpc_urls[0] if len(rpc_urls) > 0 else '',
            'RPC_URL_2': rpc_urls[1] if len(rpc_urls) > 1 else '',
            'RPC_URL_3': rpc_urls[2] if len(rpc_urls) > 2 else '',
            'WSS_URL_1': wss_urls[0] if len(wss_urls) > 0 else '',
            'WSS_URL_2': wss_urls[1] if len(wss_urls) > 1 else '',
            'LLAMANODES_CHAIN_ID': config.get('chain_id', ''),
            'RPC_COUNT': len(rpc_urls),
            'WSS_COUNT': len(wss_urls),
            'DATA_SOURCE_LLAMANODES': 'Llamanodes',
            'LAST_UPDATED_LLAMANODES': datetime.now().isoformat(),
        }
        
        logger.info(f"✅ Llamanodes data extracted for {chain_name}: {len(data)} fields")
        return data


# Singleton instance
_llamanodes_client = None


def get_llamanodes_client() -> LlamanodesClient:
    """Retorna instancia singleton del cliente Llamanodes"""
    global _llamanodes_client
    if _llamanodes_client is None:
        _llamanodes_client = LlamanodesClient()
    return _llamanodes_client


# Test
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    client = LlamanodesClient()
    
    # Test con polygon
    print("\n" + "="*80)
    print("Testing Llamanodes Client with 'polygon'")
    print("="*80)
    
    data = client.extract_blockchain_data("polygon")
    
    print("\n📊 Extracted Data:")
    for key, value in data.items():
        print(f"  {key}: {value}")
    
    # Test active RPCs
    print("\n🔍 Testing active RPCs...")
    active_rpcs = client.get_active_rpcs("polygon")
    print(f"Active RPCs: {active_rpcs}")
    
    print("\n✅ Test completed")

