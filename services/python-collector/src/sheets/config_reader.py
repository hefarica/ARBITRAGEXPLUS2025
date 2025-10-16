from .client import SheetsClient
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)

class ConfigReader:
    def __init__(self, sheets_client: SheetsClient):
        self.client = sheets_client
    
    def get_blockchains(self) -> List[Dict]:
        """Get blockchain configurations"""
        rows = self.client.read_range('BLOCKCHAINS!A2:AX1000')
        return self._parse_rows(rows)
    
    def get_dexes(self) -> List[Dict]:
        """Get DEX configurations"""
        rows = self.client.read_range('DEXES!A2:GR1000')
        return self._parse_rows(rows)
    
    def get_assets(self) -> List[Dict]:
        """Get asset configurations"""
        rows = self.client.read_range('ASSETS!A2:OL1000')
        return self._parse_rows(rows)
    
    def get_pools(self) -> List[Dict]:
        """Get pool configurations"""
        rows = self.client.read_range('POOLS!A2:CV1000')
        return self._parse_rows(rows)
    
    def _parse_rows(self, rows: List[List]) -> List[Dict]:
        """Parse rows into dictionaries"""
        if not rows:
            return []
        headers = rows[0] if rows else []
        return [dict(zip(headers, row)) for row in rows[1:]]
