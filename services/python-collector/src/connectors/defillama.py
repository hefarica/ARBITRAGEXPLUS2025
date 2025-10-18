"""
============================================================================
ARCHIVO: ./services/python-collector/src/connectors/defillama.py
============================================================================

📥 ENTRADA DE DATOS:

🔄 TRANSFORMACIÓN:
  CLASES: DefiLlamaConnector
  FUNCIONES: get_pools, __init__

📤 SALIDA DE DATOS:

🔗 DEPENDENCIAS:
  - logging
  - DefiLlama
  - typing

============================================================================
"""

import aiohttp
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)

class DefiLlamaConnector:
    def __init__(self, api_url: str = "https://api.llama.fi"):
        self.api_url = api_url
    
    async def get_pools(self) -> List[Dict]:
        """Get pools from DefiLlama"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.api_url}/pools") as resp:
                    data = await resp.json()
                    return data.get("data", [])
        except Exception as e:
            logger.error(f"Error fetching DefiLlama pools: {e}")
            return []
