import aiohttp
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)

class PythConnector:
    def __init__(self, api_url: str = "https://hermes.pyth.network"):
        self.api_url = api_url
    
    async def get_prices(self, price_ids: List[str]) -> List[Dict]:
        """Get prices from Pyth Network"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.api_url}/api/latest_price_feeds", params={"ids[]": price_ids}) as resp:
                    data = await resp.json()
                    return data
        except Exception as e:
            logger.error(f"Error fetching Pyth prices: {e}")
            return []
