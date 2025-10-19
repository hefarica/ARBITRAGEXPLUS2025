"""
PublicnodesClient - Cliente para obtener endpoints RPC públicos

Fuentes:
- Publicnode.com - RPCs públicos gratuitos
- Chainlist.org - Lista de RPCs por blockchain
- Documentación oficial de cada blockchain

Este cliente proporciona endpoints RPC HTTP y WebSocket para diferentes blockchains
"""

import requests
import logging
from typing import Dict, Any, Optional, List
import json

logger = logging.getLogger(__name__)

class PublicnodesClient:
    """Cliente para obtener endpoints RPC públicos"""
    
    # Endpoints conocidos de Publicnode y otras fuentes públicas
    KNOWN_RPCS = {
        'ethereum': {
            'rpc_urls': [
                'https://ethereum.publicnode.com',
                'https://eth.llamarpc.com',
                'https://rpc.ankr.com/eth'
            ],
            'wss_urls': [
                'wss://ethereum.publicnode.com',
                'wss://eth.llamarpc.com'
            ],
            'explorer': 'https://etherscan.io',
            'chain_id': 1
        },
        'polygon': {
            'rpc_urls': [
                'https://polygon-bor.publicnode.com',
                'https://polygon.llamarpc.com',
                'https://rpc.ankr.com/polygon'
            ],
            'wss_urls': [
                'wss://polygon-bor.publicnode.com',
                'wss://polygon.llamarpc.com'
            ],
            'explorer': 'https://polygonscan.com',
            'chain_id': 137
        },
        'bsc': {
            'rpc_urls': [
                'https://bsc.publicnode.com',
                'https://binance.llamarpc.com',
                'https://rpc.ankr.com/bsc'
            ],
            'wss_urls': [
                'wss://bsc.publicnode.com',
                'wss://binance.llamarpc.com'
            ],
            'explorer': 'https://bscscan.com',
            'chain_id': 56
        },
        'avalanche': {
            'rpc_urls': [
                'https://avalanche-c-chain.publicnode.com',
                'https://api.avax.network/ext/bc/C/rpc',
                'https://rpc.ankr.com/avalanche'
            ],
            'wss_urls': [
                'wss://avalanche-c-chain.publicnode.com'
            ],
            'explorer': 'https://snowtrace.io',
            'chain_id': 43114
        },
        'arbitrum': {
            'rpc_urls': [
                'https://arbitrum-one.publicnode.com',
                'https://arb1.arbitrum.io/rpc',
                'https://rpc.ankr.com/arbitrum'
            ],
            'wss_urls': [
                'wss://arbitrum-one.publicnode.com'
            ],
            'explorer': 'https://arbiscan.io',
            'chain_id': 42161
        },
        'optimism': {
            'rpc_urls': [
                'https://optimism.publicnode.com',
                'https://mainnet.optimism.io',
                'https://rpc.ankr.com/optimism'
            ],
            'wss_urls': [
                'wss://optimism.publicnode.com'
            ],
            'explorer': 'https://optimistic.etherscan.io',
            'chain_id': 10
        },
        'base': {
            'rpc_urls': [
                'https://base.publicnode.com',
                'https://mainnet.base.org',
                'https://rpc.ankr.com/base'
            ],
            'wss_urls': [
                'wss://base.publicnode.com'
            ],
            'explorer': 'https://basescan.org',
            'chain_id': 8453
        },
        'fantom': {
            'rpc_urls': [
                'https://fantom.publicnode.com',
                'https://rpc.ftm.tools',
                'https://rpc.ankr.com/fantom'
            ],
            'wss_urls': [
                'wss://fantom.publicnode.com'
            ],
            'explorer': 'https://ftmscan.com',
            'chain_id': 250
        },
        'gnosis': {
            'rpc_urls': [
                'https://gnosis.publicnode.com',
                'https://rpc.gnosischain.com',
                'https://rpc.ankr.com/gnosis'
            ],
            'wss_urls': [
                'wss://gnosis.publicnode.com'
            ],
            'explorer': 'https://gnosisscan.io',
            'chain_id': 100
        },
        'celo': {
            'rpc_urls': [
                'https://celo.publicnode.com',
                'https://forno.celo.org',
                'https://rpc.ankr.com/celo'
            ],
            'wss_urls': [
                'wss://celo.publicnode.com'
            ],
            'explorer': 'https://celoscan.io',
            'chain_id': 42220
        }
    }
    
    def __init__(self, timeout: int = 5):
        """
        Args:
            timeout: Timeout para verificación de RPCs en segundos
        """
        self.timeout = timeout
        logger.info("PublicnodesClient inicializado")
    
    def get_rpc_endpoints(self, blockchain_name: str) -> Optional[Dict[str, Any]]:
        """
        Obtiene endpoints RPC para una blockchain
        
        Args:
            blockchain_name: Nombre de la blockchain
            
        Returns:
            Diccionario con RPCs HTTP y WebSocket
        """
        blockchain_key = blockchain_name.lower()
        
        if blockchain_key in self.KNOWN_RPCS:
            logger.info(f"✅ Endpoints RPC encontrados para {blockchain_name}")
            return self.KNOWN_RPCS[blockchain_key]
        
        logger.warning(f"⚠️  No se encontraron endpoints RPC para {blockchain_name}")
        return None
    
    def verify_rpc_health(self, rpc_url: str) -> bool:
        """
        Verifica si un endpoint RPC está funcionando
        
        Args:
            rpc_url: URL del RPC a verificar
            
        Returns:
            True si el RPC responde correctamente
        """
        try:
            # Hacer una llamada JSON-RPC básica (eth_blockNumber)
            payload = {
                "jsonrpc": "2.0",
                "method": "eth_blockNumber",
                "params": [],
                "id": 1
            }
            
            response = requests.post(
                rpc_url,
                json=payload,
                timeout=self.timeout,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'result' in data:
                    logger.debug(f"✅ RPC healthy: {rpc_url}")
                    return True
            
            logger.warning(f"⚠️  RPC unhealthy: {rpc_url}")
            return False
            
        except Exception as e:
            logger.debug(f"❌ RPC error {rpc_url}: {e}")
            return False
    
    def get_best_rpc(self, blockchain_name: str) -> Optional[str]:
        """
        Obtiene el mejor RPC disponible para una blockchain
        
        Args:
            blockchain_name: Nombre de la blockchain
            
        Returns:
            URL del mejor RPC disponible o None
        """
        endpoints = self.get_rpc_endpoints(blockchain_name)
        if not endpoints:
            return None
        
        rpc_urls = endpoints.get('rpc_urls', [])
        
        # Verificar cada RPC hasta encontrar uno que funcione
        for rpc_url in rpc_urls:
            if self.verify_rpc_health(rpc_url):
                logger.info(f"🎯 Mejor RPC para {blockchain_name}: {rpc_url}")
                return rpc_url
        
        # Si ninguno responde, retornar el primero de la lista
        if rpc_urls:
            logger.warning(f"⚠️  Ningún RPC verificado, usando primero de lista: {rpc_urls[0]}")
            return rpc_urls[0]
        
        return None
    
    def get_blockchain_rpc_data_for_excel(self, blockchain_name: str) -> Dict[str, Any]:
        """
        Obtiene datos de RPC formateados para Excel
        
        Args:
            blockchain_name: Nombre de la blockchain
            
        Returns:
            Diccionario con datos de RPC para columnas PUSH
        """
        logger.info(f"🔍 Consultando endpoints RPC para: {blockchain_name}")
        
        endpoints = self.get_rpc_endpoints(blockchain_name)
        
        if not endpoints:
            return self._get_fallback_rpc_data(blockchain_name)
        
        rpc_urls = endpoints.get('rpc_urls', [])
        wss_urls = endpoints.get('wss_urls', [])
        
        result = {
            'RPC_URL_1': rpc_urls[0] if len(rpc_urls) > 0 else '',
            'RPC_URL_2': rpc_urls[1] if len(rpc_urls) > 1 else '',
            'RPC_URL_3': rpc_urls[2] if len(rpc_urls) > 2 else '',
            'WSS_URL': wss_urls[0] if len(wss_urls) > 0 else '',
            'WSS_URL_2': wss_urls[1] if len(wss_urls) > 1 else '',
            'EXPLORER_URL': endpoints.get('explorer', ''),
            'CHAIN_ID': endpoints.get('chain_id', 0),
            'RPC_PROVIDER': 'Publicnode + LlamaRPC + Ankr',
            'RPC_STATUS': 'AVAILABLE'
        }
        
        logger.info(f"✅ Datos RPC obtenidos para {blockchain_name}")
        return result
    
    def _get_fallback_rpc_data(self, blockchain_name: str) -> Dict[str, Any]:
        """
        Retorna datos de fallback cuando no se encuentran RPCs
        
        Args:
            blockchain_name: Nombre de la blockchain
            
        Returns:
            Diccionario con datos vacíos
        """
        return {
            'RPC_URL_1': '',
            'RPC_URL_2': '',
            'RPC_URL_3': '',
            'WSS_URL': '',
            'WSS_URL_2': '',
            'EXPLORER_URL': '',
            'CHAIN_ID': 0,
            'RPC_PROVIDER': 'Not found',
            'RPC_STATUS': 'UNAVAILABLE'
        }

# Singleton
_client_instance = None

def get_publicnodes_client() -> PublicnodesClient:
    """Retorna instancia singleton"""
    global _client_instance
    if _client_instance is None:
        _client_instance = PublicnodesClient()
    return _client_instance

