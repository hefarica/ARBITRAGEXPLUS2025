"""
DefiLlamaClient - Cliente para obtener datos de blockchains desde DefiLlama API

API Documentation: https://defillama.com/docs/api

Endpoints utilizados:
- /v2/chains - Lista de todas las blockchains con TVL y stats
- /chains - Información histórica de TVL por chain
"""

import logging
from typing import Any, Dict, List, Optional
from datetime import datetime

import requests

from lib.rate_limiter import get_rate_limiter_manager

logger = logging.getLogger(__name__)


class DefiLlamaClient:
    """Cliente para interactuar con DefiLlama API"""

    BASE_URL = "https://api.llama.fi"
    
    # Mapeo de nombres de blockchain (nuestros → DefiLlama)
    CHAIN_NAME_MAPPING = {
        "ethereum": "Ethereum",
        "bsc": "BSC",
        "polygon": "Polygon",
        "arbitrum": "Arbitrum",
        "optimism": "Optimism",
        "avalanche": "Avalanche",
        "fantom": "Fantom",
        "cronos": "Cronos",
        "base": "Base",
        "linea": "Linea",
    }

    def __init__(self, timeout: int = 30):
        """
        Inicializa el cliente DefiLlama.

        Args:
            timeout: Timeout para requests HTTP en segundos
        """
        self.timeout = timeout
        self.rate_limiter = get_rate_limiter_manager()
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "ARBITRAGEXPLUS2025/1.0",
            "Accept": "application/json"
        })
        
        logger.info("DefiLlamaClient inicializado")

    def _make_request(self, endpoint: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Hace un request a la API con rate limiting.

        Args:
            endpoint: Endpoint de la API (ej: "/v2/chains")
            params: Parámetros query opcionales

        Returns:
            Respuesta JSON como diccionario

        Raises:
            requests.RequestException: Si el request falla
        """
        # Aplicar rate limiting
        self.rate_limiter.acquire('defillama', blocking=True)

        url = f"{self.BASE_URL}{endpoint}"
        
        try:
            logger.debug(f"GET {url}")
            response = self.session.get(url, params=params, timeout=self.timeout)
            response.raise_for_status()
            
            return response.json()

        except requests.RequestException as e:
            logger.error(f"Error en request a DefiLlama: {e}")
            raise

    def get_all_chains(self) -> List[Dict[str, Any]]:
        """
        Obtiene información de todas las blockchains.

        Returns:
            Lista de diccionarios con datos de cada blockchain

        Ejemplo de respuesta:
        [
            {
                "gecko_id": "ethereum",
                "tvl": 50000000000,
                "tokenSymbol": "ETH",
                "cmcId": "1027",
                "name": "Ethereum",
                "chainId": 1
            },
            ...
        ]
        """
        try:
            data = self._make_request("/v2/chains")
            logger.info(f"Obtenidas {len(data)} blockchains de DefiLlama")
            return data

        except Exception as e:
            logger.error(f"Error obteniendo chains de DefiLlama: {e}")
            return []

    def get_chain_by_name(self, chain_name: str) -> Optional[Dict[str, Any]]:
        """
        Obtiene información de una blockchain específica por nombre.

        Args:
            chain_name: Nombre de la blockchain (ej: "ethereum", "bsc")

        Returns:
            Diccionario con datos de la blockchain o None si no se encuentra
        """
        # Normalizar nombre
        normalized_name = self.CHAIN_NAME_MAPPING.get(chain_name.lower(), chain_name.title())
        
        all_chains = self.get_all_chains()
        
        for chain in all_chains:
            if chain.get("name", "").lower() == normalized_name.lower():
                logger.info(f"Encontrada blockchain '{chain_name}' en DefiLlama")
                return chain

        logger.warning(f"Blockchain '{chain_name}' no encontrada en DefiLlama")
        return None

    def get_chain_tvl_history(self, chain_name: str) -> List[Dict[str, Any]]:
        """
        Obtiene el historial de TVL de una blockchain.

        Args:
            chain_name: Nombre de la blockchain

        Returns:
            Lista de puntos históricos con timestamp y TVL

        Ejemplo de respuesta:
        [
            {"date": 1609459200, "tvl": 15000000000},
            {"date": 1609545600, "tvl": 15500000000},
            ...
        ]
        """
        normalized_name = self.CHAIN_NAME_MAPPING.get(chain_name.lower(), chain_name.title())
        
        try:
            data = self._make_request(f"/v2/historicalChainTvl/{normalized_name}")
            logger.info(f"Obtenidos {len(data)} puntos históricos de TVL para '{chain_name}'")
            return data

        except Exception as e:
            logger.error(f"Error obteniendo TVL histórico de '{chain_name}': {e}")
            return []

    def extract_blockchain_data(self, chain_name: str) -> Dict[str, Any]:
        """
        Extrae y estructura datos relevantes de una blockchain para ARBITRAGEXPLUS.

        Args:
            chain_name: Nombre de la blockchain

        Returns:
            Diccionario con datos estructurados para Excel
        """
        chain_data = self.get_chain_by_name(chain_name)
        
        if not chain_data:
            logger.warning(f"No se pudieron obtener datos de '{chain_name}'")
            return {}

        # Obtener TVL histórico para calcular volumen diario
        tvl_history = self.get_chain_tvl_history(chain_name)
        
        # Calcular volumen diario (aproximación basada en cambio de TVL)
        daily_volume = 0
        if len(tvl_history) >= 2:
            latest_tvl = tvl_history[-1].get("tvl", 0)
            previous_tvl = tvl_history[-2].get("tvl", 0)
            # Aproximación: volumen ≈ 10% del cambio de TVL
            daily_volume = abs(latest_tvl - previous_tvl) * 0.1

        # Estructurar datos según columnas de BLOCKCHAINS sheet
        extracted = {
            # Campos básicos
            "CHAIN_ID": chain_data.get("chainId"),
            "NATIVE_TOKEN": chain_data.get("tokenSymbol"),
            "SYMBOL": chain_data.get("tokenSymbol"),
            
            # Métricas financieras
            "TVL_USD": chain_data.get("tvl"),
            "DAILY_VOLUME_USD": daily_volume,
            
            # Metadata
            "GECKO_ID": chain_data.get("gecko_id"),
            "CMC_ID": chain_data.get("cmcId"),
            
            # Timestamp
            "UPDATED_AT": datetime.utcnow().isoformat(),
        }

        logger.info(f"Datos extraídos para '{chain_name}': TVL=${extracted.get('TVL_USD', 0):,.0f}")
        
        return extracted

    def get_protocols_by_chain(self, chain_name: str) -> List[Dict[str, Any]]:
        """
        Obtiene protocolos DeFi activos en una blockchain.

        Args:
            chain_name: Nombre de la blockchain

        Returns:
            Lista de protocolos con sus datos
        """
        normalized_name = self.CHAIN_NAME_MAPPING.get(chain_name.lower(), chain_name.title())
        
        try:
            # Obtener todos los protocolos
            all_protocols = self._make_request("/protocols")
            
            # Filtrar por chain
            chain_protocols = [
                p for p in all_protocols
                if normalized_name in p.get("chains", [])
            ]
            
            logger.info(f"Encontrados {len(chain_protocols)} protocolos en '{chain_name}'")
            return chain_protocols

        except Exception as e:
            logger.error(f"Error obteniendo protocolos de '{chain_name}': {e}")
            return []

    def get_supported_dexes(self, chain_name: str) -> List[str]:
        """
        Obtiene lista de DEXes soportados en una blockchain.

        Args:
            chain_name: Nombre de la blockchain

        Returns:
            Lista de nombres de DEXes
        """
        protocols = self.get_protocols_by_chain(chain_name)
        
        # Filtrar solo DEXes (categoría "Dexes")
        dexes = [
            p.get("name")
            for p in protocols
            if "Dexes" in p.get("category", "")
        ]
        
        logger.info(f"Encontrados {len(dexes)} DEXes en '{chain_name}'")
        return dexes

    def close(self):
        """Cierra la sesión HTTP"""
        self.session.close()
        logger.debug("Sesión DefiLlama cerrada")

    def __enter__(self):
        """Context manager entry"""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.close()
        return False

