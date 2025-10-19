"""
LlamanodesClient - Cliente para obtener información de Llamanodes

Fuentes:
- GitHub: https://github.com/llamanodes
- Documentación de RPCs específicos por blockchain

Llamanodes proporciona RPCs públicos y privados para múltiples blockchains
"""

import requests
import logging
from typing import Dict, Any, Optional, List
import re

logger = logging.getLogger(__name__)

class LlamanodesClient:
    """Cliente para obtener información de Llamanodes"""
    
    GITHUB_API_BASE = "https://api.github.com"
    LLAMANODES_ORG = "llamanodes"
    
    # Endpoints conocidos de Llamanodes
    LLAMANODES_RPCS = {
        'ethereum': {
            'rpc_url': 'https://eth.llamarpc.com',
            'wss_url': 'wss://eth.llamarpc.com',
            'docs_url': 'https://llamanodes.com/ethereum'
        },
        'polygon': {
            'rpc_url': 'https://polygon.llamarpc.com',
            'wss_url': 'wss://polygon.llamarpc.com',
            'docs_url': 'https://llamanodes.com/polygon'
        },
        'bsc': {
            'rpc_url': 'https://binance.llamarpc.com',
            'wss_url': 'wss://binance.llamarpc.com',
            'docs_url': 'https://llamanodes.com/binance'
        },
        'avalanche': {
            'rpc_url': 'https://avalanche.llamarpc.com',
            'wss_url': 'wss://avalanche.llamarpc.com',
            'docs_url': 'https://llamanodes.com/avalanche'
        },
        'arbitrum': {
            'rpc_url': 'https://arbitrum.llamarpc.com',
            'wss_url': 'wss://arbitrum.llamarpc.com',
            'docs_url': 'https://llamanodes.com/arbitrum'
        },
        'optimism': {
            'rpc_url': 'https://optimism.llamarpc.com',
            'wss_url': 'wss://optimism.llamarpc.com',
            'docs_url': 'https://llamanodes.com/optimism'
        },
        'base': {
            'rpc_url': 'https://base.llamarpc.com',
            'wss_url': 'wss://base.llamarpc.com',
            'docs_url': 'https://llamanodes.com/base'
        },
        'fantom': {
            'rpc_url': 'https://fantom.llamarpc.com',
            'wss_url': 'wss://fantom.llamarpc.com',
            'docs_url': 'https://llamanodes.com/fantom'
        }
    }
    
    def __init__(self, timeout: int = 10):
        """
        Args:
            timeout: Timeout para requests en segundos
        """
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'ARBITRAGEXPLUS2025/1.0',
            'Accept': 'application/json'
        })
        logger.info("LlamanodesClient inicializado")
    
    def get_llamanodes_repos(self) -> Optional[List[Dict[str, Any]]]:
        """
        Obtiene lista de repositorios de Llamanodes en GitHub
        
        Returns:
            Lista de repositorios o None si falla
        """
        url = f"{self.GITHUB_API_BASE}/orgs/{self.LLAMANODES_ORG}/repos"
        
        try:
            response = self.session.get(url, timeout=self.timeout)
            response.raise_for_status()
            repos = response.json()
            logger.info(f"Encontrados {len(repos)} repositorios de Llamanodes")
            return repos
        except Exception as e:
            logger.error(f"Error al obtener repos de Llamanodes: {e}")
            return None
    
    def get_llamanodes_rpc(self, blockchain_name: str) -> Optional[Dict[str, Any]]:
        """
        Obtiene endpoints RPC de Llamanodes para una blockchain
        
        Args:
            blockchain_name: Nombre de la blockchain
            
        Returns:
            Diccionario con endpoints de Llamanodes
        """
        blockchain_key = blockchain_name.lower()
        
        if blockchain_key in self.LLAMANODES_RPCS:
            logger.info(f"✅ Llamanodes RPC encontrado para {blockchain_name}")
            return self.LLAMANODES_RPCS[blockchain_key]
        
        logger.warning(f"⚠️  No se encontró Llamanodes RPC para {blockchain_name}")
        return None
    
    def verify_llamanodes_rpc(self, rpc_url: str) -> bool:
        """
        Verifica si un endpoint de Llamanodes está funcionando
        
        Args:
            rpc_url: URL del RPC a verificar
            
        Returns:
            True si el RPC responde correctamente
        """
        try:
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
                    logger.debug(f"✅ Llamanodes RPC healthy: {rpc_url}")
                    return True
            
            return False
            
        except Exception as e:
            logger.debug(f"❌ Llamanodes RPC error {rpc_url}: {e}")
            return False
    
    def get_blockchain_llamanodes_data_for_excel(self, blockchain_name: str) -> Dict[str, Any]:
        """
        Obtiene datos de Llamanodes formateados para Excel
        
        Args:
            blockchain_name: Nombre de la blockchain
            
        Returns:
            Diccionario con datos de Llamanodes para columnas PUSH
        """
        logger.info(f"🔍 Consultando Llamanodes para: {blockchain_name}")
        
        rpc_data = self.get_llamanodes_rpc(blockchain_name)
        
        if not rpc_data:
            return self._get_fallback_llamanodes_data(blockchain_name)
        
        # Verificar si el RPC está disponible
        is_available = self.verify_llamanodes_rpc(rpc_data['rpc_url'])
        
        result = {
            'LLAMANODES_RPC': rpc_data.get('rpc_url', ''),
            'LLAMANODES_WSS': rpc_data.get('wss_url', ''),
            'LLAMANODES_DOCS': rpc_data.get('docs_url', ''),
            'LLAMANODES_STATUS': 'AVAILABLE' if is_available else 'UNAVAILABLE',
            'LLAMANODES_VERIFIED': is_available
        }
        
        logger.info(f"✅ Datos Llamanodes obtenidos para {blockchain_name}")
        return result
    
    def _get_fallback_llamanodes_data(self, blockchain_name: str) -> Dict[str, Any]:
        """
        Retorna datos de fallback cuando no se encuentra en Llamanodes
        
        Args:
            blockchain_name: Nombre de la blockchain
            
        Returns:
            Diccionario con datos vacíos
        """
        return {
            'LLAMANODES_RPC': '',
            'LLAMANODES_WSS': '',
            'LLAMANODES_DOCS': '',
            'LLAMANODES_STATUS': 'NOT_SUPPORTED',
            'LLAMANODES_VERIFIED': False
        }
    
    def get_all_supported_chains(self) -> List[str]:
        """
        Retorna lista de todas las blockchains soportadas por Llamanodes
        
        Returns:
            Lista de nombres de blockchains
        """
        return list(self.LLAMANODES_RPCS.keys())

# Singleton
_client_instance = None

def get_llamanodes_client() -> LlamanodesClient:
    """Retorna instancia singleton"""
    global _client_instance
    if _client_instance is None:
        _client_instance = LlamanodesClient()
    return _client_instance

