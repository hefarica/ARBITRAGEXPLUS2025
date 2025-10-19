"""
DefiLlamaClient - Cliente para consultar datos de blockchains desde DefiLlama API

API Documentation: https://defillama.com/docs/api

Endpoints utilizados:
- /v1/chains - Lista de todas las blockchains
- /v1/protocols - Protocolos por blockchain
- /v1/tvl/{chain} - TVL de una blockchain específica
"""

import requests
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
import time
import sys
import os

# Agregar directorio actual al path para imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from rate_limiter import get_rate_limiter_manager
    RATE_LIMITER_AVAILABLE = True
except ImportError:
    RATE_LIMITER_AVAILABLE = False

logger = logging.getLogger(__name__)

class DefiLlamaClient:
    """Cliente para DefiLlama API"""
    
    BASE_URL = "https://api.llama.fi"
    
    def __init__(self, timeout: int = 10, use_rate_limiter: bool = True):
        """
        Args:
            timeout: Timeout para requests en segundos
            use_rate_limiter: Si usar rate limiting
        """
        self.timeout = timeout
        self.use_rate_limiter = use_rate_limiter and RATE_LIMITER_AVAILABLE
        
        if self.use_rate_limiter:
            self.rate_limiter = get_rate_limiter_manager()
        
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'ARBITRAGEXPLUS2025/1.0',
            'Accept': 'application/json'
        })
        logger.info(f"DefiLlamaClient inicializado (rate_limiter={'ON' if self.use_rate_limiter else 'OFF'})")
    
    def _make_request(self, endpoint: str) -> Optional[Dict[str, Any]]:
        """
        Realiza una petición HTTP a la API con rate limiting
        
        Args:
            endpoint: Endpoint relativo (ej: "/chains")
            
        Returns:
            Respuesta JSON o None si falla
        """
        # Aplicar rate limiting si está habilitado
        if self.use_rate_limiter:
            try:
                self.rate_limiter.acquire('defillama', timeout=5.0)
            except TimeoutError:
                logger.error("Rate limiter timeout para DefiLlama")
                return None
        
        url = f"{self.BASE_URL}{endpoint}"
        
        try:
            logger.debug(f"GET {url}")
            response = self.session.get(url, timeout=self.timeout)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.Timeout:
            logger.error(f"Timeout al consultar {url}")
            return None
        except requests.exceptions.RequestException as e:
            logger.error(f"Error al consultar {url}: {e}")
            return None
    
    def get_all_chains(self) -> Optional[List[Dict[str, Any]]]:
        """
        Obtiene lista de todas las blockchains
        
        Returns:
            Lista de blockchains con sus datos
        """
        # Intentar endpoint /chains primero
        data = self._make_request("/chains")
        if data:
            logger.info(f"Obtenidas {len(data)} blockchains de DefiLlama")
        return data
    
    def get_chain_info(self, chain_name: str) -> Optional[Dict[str, Any]]:
        """
        Obtiene información de una blockchain específica
        
        Args:
            chain_name: Nombre de la blockchain (ej: "Ethereum", "Polygon")
            
        Returns:
            Diccionario con información de la blockchain o None si no se encuentra
        """
        chains = self.get_all_chains()
        if not chains:
            return None
        
        # Normalizar nombre para búsqueda case-insensitive
        chain_name_lower = chain_name.lower()
        
        for chain in chains:
            # Buscar por nombre exacto o por gecko_id
            gecko_id = chain.get('gecko_id') or ''
            name = chain.get('name') or ''
            if (name.lower() == chain_name_lower or 
                gecko_id.lower() == chain_name_lower or
                str(chain.get('chainId', '')).lower() == chain_name_lower):
                logger.info(f"Encontrada blockchain: {chain.get('name')}")
                return chain
        
        logger.warning(f"No se encontró blockchain: {chain_name}")
        return None
    
    def get_chain_tvl(self, chain_name: str) -> Optional[float]:
        """
        Obtiene el TVL (Total Value Locked) de una blockchain
        
        Args:
            chain_name: Nombre de la blockchain
            
        Returns:
            TVL en USD o None si falla
        """
        chain_info = self.get_chain_info(chain_name)
        if chain_info:
            tvl = chain_info.get('tvl')
            if tvl:
                logger.info(f"TVL de {chain_name}: ${tvl:,.2f}")
                return float(tvl)
        return None
    
    def get_chain_protocols(self, chain_name: str) -> Optional[List[Dict[str, Any]]]:
        """
        Obtiene protocolos activos en una blockchain
        
        Args:
            chain_name: Nombre de la blockchain
            
        Returns:
            Lista de protocolos o None si falla
        """
        data = self._make_request("/protocols")
        if not data:
            return None
        
        chain_name_lower = chain_name.lower()
        protocols = []
        
        for protocol in data:
            chains = protocol.get('chains', [])
            if isinstance(chains, list):
                chains_lower = [c.lower() for c in chains]
                if chain_name_lower in chains_lower:
                    protocols.append(protocol)
        
        logger.info(f"Encontrados {len(protocols)} protocolos en {chain_name}")
        return protocols
    
    def get_blockchain_data_for_excel(self, blockchain_name: str) -> Dict[str, Any]:
        """
        Obtiene datos completos de una blockchain formateados para Excel
        
        Args:
            blockchain_name: Nombre de la blockchain
            
        Returns:
            Diccionario con datos para columnas PUSH de Excel
        """
        logger.info(f"🔍 Consultando DefiLlama para: {blockchain_name}")
        
        chain_info = self.get_chain_info(blockchain_name)
        
        if not chain_info:
            logger.warning(f"No se encontraron datos en DefiLlama para: {blockchain_name}")
            return self._get_fallback_data(blockchain_name)
        
        # Extraer datos relevantes
        result = {
            'BLOCKCHAIN_ID': chain_info.get('gecko_id', blockchain_name.lower()),
            'CHAIN_ID': chain_info.get('chainId', 0),
            'NATIVE_TOKEN': chain_info.get('tokenSymbol', 'UNKNOWN'),
            'SYMBOL': chain_info.get('tokenSymbol', 'UNKNOWN'),
            'TVL_USD': chain_info.get('tvl', 0),
            'CMC_ID': chain_info.get('cmcId', ''),
            'GECKO_ID': chain_info.get('gecko_id', ''),
            'DEFILLAMA_NAME': chain_info.get('name', blockchain_name),
            'LAST_UPDATED': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'DATA_SOURCE': 'DefiLlama API',
            'IS_ACTIVE': True,
            'HEALTH_STATUS': 'HEALTHY'
        }
        
        logger.info(f"✅ Datos obtenidos de DefiLlama para {blockchain_name}")
        return result
    
    def _get_fallback_data(self, blockchain_name: str) -> Dict[str, Any]:
        """
        Retorna datos de fallback cuando no se encuentra en DefiLlama
        
        Args:
            blockchain_name: Nombre de la blockchain
            
        Returns:
            Diccionario con datos básicos
        """
        return {
            'BLOCKCHAIN_ID': blockchain_name.lower(),
            'CHAIN_ID': 0,
            'NATIVE_TOKEN': 'UNKNOWN',
            'SYMBOL': 'UNKNOWN',
            'TVL_USD': 0,
            'CMC_ID': '',
            'GECKO_ID': '',
            'DEFILLAMA_NAME': blockchain_name,
            'LAST_UPDATED': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'DATA_SOURCE': 'Fallback (DefiLlama not found)',
            'IS_ACTIVE': False,
            'HEALTH_STATUS': 'UNKNOWN'
        }

# Singleton
_client_instance = None

def get_defillama_client() -> DefiLlamaClient:
    """Retorna instancia singleton"""
    global _client_instance
    if _client_instance is None:
        _client_instance = DefiLlamaClient()
    return _client_instance

