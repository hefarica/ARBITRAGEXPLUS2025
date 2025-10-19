"""
Publicnodes Client - Obtiene endpoints RPC públicos desde Publicnode.com

📥 ENTRADAS:
- Nombre de blockchain

🔄 TRANSFORMACIONES:
- Consulta a endpoints de Publicnode
- Validación de disponibilidad

📤 SALIDAS:
- Diccionario con URLs públicas de RPC/WSS

🔗 DEPENDENCIAS:
- requests para HTTP calls

Fuentes:
- https://www.publicnode.com/ - Proveedor de nodos RPC públicos gratuitos
"""

import requests
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

logger = logging.getLogger(__name__)


class PublicnodesClient:
    """Cliente para obtener endpoints RPC públicos desde Publicnode"""
    
    # Configuraciones conocidas de Publicnode
    PUBLICNODE_CONFIGS = {
        'ethereum': {
            'rpc_https': 'https://ethereum-rpc.publicnode.com',
            'rpc_wss': 'wss://ethereum-rpc.publicnode.com',
            'chain_id': 1,
            'explorer': 'https://etherscan.io',
        },
        'polygon': {
            'rpc_https': 'https://polygon-bor-rpc.publicnode.com',
            'rpc_wss': 'wss://polygon-bor-rpc.publicnode.com',
            'chain_id': 137,
            'explorer': 'https://polygonscan.com',
        },
        'bsc': {
            'rpc_https': 'https://bsc-rpc.publicnode.com',
            'rpc_wss': 'wss://bsc-rpc.publicnode.com',
            'chain_id': 56,
            'explorer': 'https://bscscan.com',
        },
        'arbitrum': {
            'rpc_https': 'https://arbitrum-one-rpc.publicnode.com',
            'rpc_wss': 'wss://arbitrum-one-rpc.publicnode.com',
            'chain_id': 42161,
            'explorer': 'https://arbiscan.io',
        },
        'optimism': {
            'rpc_https': 'https://optimism-rpc.publicnode.com',
            'rpc_wss': 'wss://optimism-rpc.publicnode.com',
            'chain_id': 10,
            'explorer': 'https://optimistic.etherscan.io',
        },
        'avalanche': {
            'rpc_https': 'https://avalanche-c-chain-rpc.publicnode.com',
            'rpc_wss': 'wss://avalanche-c-chain-rpc.publicnode.com',
            'chain_id': 43114,
            'explorer': 'https://snowtrace.io',
        },
        'base': {
            'rpc_https': 'https://base-rpc.publicnode.com',
            'rpc_wss': 'wss://base-rpc.publicnode.com',
            'chain_id': 8453,
            'explorer': 'https://basescan.org',
        },
        'gnosis': {
            'rpc_https': 'https://gnosis-rpc.publicnode.com',
            'rpc_wss': 'wss://gnosis-rpc.publicnode.com',
            'chain_id': 100,
            'explorer': 'https://gnosisscan.io',
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
        logger.info("PublicnodesClient initialized")
    
    def get_publicnode_config(self, chain_name: str) -> Optional[Dict[str, Any]]:
        """
        Obtiene configuración de Publicnode para una blockchain
        
        Args:
            chain_name: Nombre de la blockchain
            
        Returns:
            Diccionario con configuración
        """
        chain_name_normalized = chain_name.lower().strip()
        
        if chain_name_normalized in self.PUBLICNODE_CONFIGS:
            config = self.PUBLICNODE_CONFIGS[chain_name_normalized]
            logger.info(f"✅ Publicnode config found for {chain_name}")
            return config
        
        logger.warning(f"⚠️  No Publicnode config found for {chain_name}")
        return None
    
    def test_rpc_endpoint(self, rpc_url: str) -> tuple[bool, Optional[int]]:
        """
        Prueba un endpoint RPC y obtiene el número de bloque actual
        
        Args:
            rpc_url: URL del endpoint RPC
            
        Returns:
            Tupla (is_active, block_number)
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
                    block_number = int(data['result'], 16)
                    logger.info(f"✅ RPC active: {rpc_url} (block: {block_number})")
                    return True, block_number
            
            return False, None
            
        except Exception as e:
            logger.debug(f"RPC test failed for {rpc_url}: {e}")
            return False, None
    
    def get_chain_id_from_rpc(self, rpc_url: str) -> Optional[int]:
        """
        Obtiene el chain ID desde un endpoint RPC
        
        Args:
            rpc_url: URL del endpoint RPC
            
        Returns:
            Chain ID o None
        """
        try:
            payload = {
                "jsonrpc": "2.0",
                "method": "eth_chainId",
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
                    chain_id = int(data['result'], 16)
                    return chain_id
            
            return None
            
        except Exception as e:
            logger.debug(f"Failed to get chain ID from {rpc_url}: {e}")
            return None
    
    def extract_blockchain_data(self, chain_name: str) -> Dict[str, Any]:
        """
        Extrae datos de endpoints públicos para una blockchain
        
        Args:
            chain_name: Nombre de la blockchain
            
        Returns:
            Diccionario con datos para columnas PUSH
        """
        logger.info(f"🔍 Fetching public node data for: {chain_name}")
        
        config = self.get_publicnode_config(chain_name)
        
        if not config:
            logger.warning(f"⚠️  No Publicnode config found for {chain_name}")
            return {}
        
        rpc_https = config.get('rpc_https', '')
        rpc_wss = config.get('rpc_wss', '')
        
        # Test RPC endpoint
        is_active, block_number = self.test_rpc_endpoint(rpc_https)
        
        # Obtener chain ID desde RPC
        chain_id_from_rpc = self.get_chain_id_from_rpc(rpc_https) if is_active else None
        
        # Construir datos
        data = {
            'PUBLICNODE_RPC_HTTPS': rpc_https,
            'PUBLICNODE_RPC_WSS': rpc_wss,
            'PUBLICNODE_CHAIN_ID': chain_id_from_rpc or config.get('chain_id', ''),
            'EXPLORER_URL': config.get('explorer', ''),
            'RPC_IS_ACTIVE': is_active,
            'LATEST_BLOCK_NUMBER': block_number or 0,
            'DATA_SOURCE_PUBLICNODE': 'Publicnode.com',
            'LAST_UPDATED_PUBLICNODE': datetime.now().isoformat(),
        }
        
        logger.info(f"✅ Publicnode data extracted for {chain_name}: {len(data)} fields")
        return data


# Singleton instance
_publicnodes_client = None


def get_publicnodes_client() -> PublicnodesClient:
    """Retorna instancia singleton del cliente Publicnodes"""
    global _publicnodes_client
    if _publicnodes_client is None:
        _publicnodes_client = PublicnodesClient()
    return _publicnodes_client


# Test
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    client = PublicnodesClient()
    
    # Test con polygon
    print("\n" + "="*80)
    print("Testing Publicnodes Client with 'polygon'")
    print("="*80)
    
    data = client.extract_blockchain_data("polygon")
    
    print("\n📊 Extracted Data:")
    for key, value in data.items():
        print(f"  {key}: {value}")
    
    print("\n✅ Test completed")

