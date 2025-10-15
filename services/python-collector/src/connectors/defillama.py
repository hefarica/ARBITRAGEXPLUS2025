
import asyncio
import aiohttp
import json
from typing import Dict, Any, List

class DefiLlamaConnector:
    def __init__(self, base_url: str = "https://api.llama.fi"):
        self.base_url = base_url

    async def fetch_json(self, endpoint: str) -> Dict[str, Any]:
        url = f"{self.base_url}/{endpoint}"
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    response.raise_for_status()  # Raise an exception for HTTP errors
                    return await response.json()
        except aiohttp.ClientError as e:
            print(f"Error fetching data from DefiLlama {url}: {e}")
            return {}

    async def get_protocols(self) -> List[Dict[str, Any]]:
        data = await self.fetch_json("protocols")
        return data if isinstance(data, list) else []

    async def get_protocol_tvl(self, protocol_name: str) -> Dict[str, Any]:
        data = await self.fetch_json(f"protocol/{protocol_name}")
        return data

    async def get_charts_tvl(self, protocol_name: str = "") -> Dict[str, Any]:
        if protocol_name:
            return await self.fetch_json(f"charts/protocol/{protocol_name}")
        else:
            return await self.fetch_json("charts")

    # Add more DefiLlama endpoints as needed

# Example Usage (for local testing)
# async def main():
#     connector = DefiLlamaConnector()

#     print("Fetching all protocols...")
#     protocols = await connector.get_protocols()
#     if protocols:
#         print(f"Found {len(protocols)} protocols. First 3: {protocols[:3]}")

#     print("\nFetching TVL for Uniswap...")
#     uniswap_tvl = await connector.get_protocol_tvl("uniswap")
#     if uniswap_tvl:
#         print(f"Uniswap TVL: {uniswap_tvl.get("tvl", "N/A")}")

#     print("\nFetching historical TVL chart for Aave...")
#     aave_charts = await connector.get_charts_tvl("aave")
#     if aave_charts:
#         print(f"Aave historical TVL data points: {len(aave_charts.get("tvl", []))}")

# if __name__ == "__main__":
#     asyncio.run(main())

