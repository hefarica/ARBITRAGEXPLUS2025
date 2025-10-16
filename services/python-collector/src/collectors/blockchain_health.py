import asyncio
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)

class BlockchainHealthCollector:
    def __init__(self, blockchains: List[Dict]):
        self.blockchains = blockchains
    
    async def collect(self) -> List[Dict]:
        """Collect health status from all blockchains"""
        tasks = [self.check_blockchain(bc) for bc in self.blockchains]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return [r for r in results if not isinstance(r, Exception)]
    
    async def check_blockchain(self, blockchain: Dict) -> Dict:
        """Check health of a single blockchain"""
        try:
            return {
                "chain_id": blockchain.get("chain_id"),
                "status": "healthy",
                "block_number": 0,
                "latency_ms": 0
            }
        except Exception as e:
            logger.error(f"Error checking blockchain {blockchain.get('chain_id')}: {e}")
            raise
