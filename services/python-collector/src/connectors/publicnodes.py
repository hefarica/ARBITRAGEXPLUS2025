import aiohttp
from typing import Dict
import logging

logger = logging.getLogger(__name__)

class PublicNodesConnector:
    def __init__(self, rpc_urls: Dict[str, str]):
        self.rpc_urls = rpc_urls
    
    async def get_block_number(self, chain_id: str) -> int:
        """Get latest block number from PublicNodes RPC"""
        try:
            rpc_url = self.rpc_urls.get(chain_id)
            if not rpc_url:
                return 0
            
            async with aiohttp.ClientSession() as session:
                payload = {
                    "jsonrpc": "2.0",
                    "method": "eth_blockNumber",
                    "params": [],
                    "id": 1
                }
                async with session.post(rpc_url, json=payload) as resp:
                    data = await resp.json()
                    return int(data.get("result", "0x0"), 16)
        except Exception as e:
            logger.error(f"Error fetching block number for {chain_id}: {e}")
            return 0
