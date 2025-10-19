"""
DefiLlama Client - Obtiene datos de blockchains desde DefiLlama API

📥 ENTRADAS:
- Nombre de blockchain (ej: "polygon", "ethereum")

🔄 TRANSFORMACIONES:
- Consulta API de DefiLlama
- Extrae TVL, protocolos, chain info

📤 SALIDAS:
- Diccionario con datos de blockchain para columnas PUSH

🔗 DEPENDENCIAS:
- requests para HTTP calls
- logging para debug

API Endpoints:
- https://api.llama.fi/chains - Lista de chains con TVL
- https://api.llama.fi/protocols - Lista de protocolos
- https://api.llama.fi/v2/chains - Información detallada de chains
"""

import requests
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

logger = logging.getLogger(__name__)


class DefiLlamaClient:
    """Cliente para consultar datos de blockchains desde DefiLlama"""
    
    BASE_URL = "https://api.llama.fi"
    
    def __init__(self, timeout: int = 10):
        """
        Args:
            timeout: Timeout para requests en segundos
        """
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'ARBITRAGEXPLUS2025/1.0'
        })
        logger.info("DefiLlamaClient initialized")
    
    def get_chain_info(self, chain_name: str) -> Optional[Dict[str, Any]]:
        """
        Obtiene información de una blockchain desde DefiLlama
        
        Args:
            chain_name: Nombre de la blockchain (ej: "polygon", "ethereum")
            
        Returns:
            Diccionario con datos de la blockchain o None si no se encuentra
        """
        try:
            # Normalizar nombre
            chain_name_normalized = chain_name.lower().strip()
            
            # Obtener lista de chains
            response = self.session.get(
                f"{self.BASE_URL}/v2/chains",
                timeout=self.timeout
            )
            response.raise_for_status()
            
            chains = response.json()
            
            # Buscar chain por nombre
            for chain in chains:
                if chain.get('name', '').lower() == chain_name_normalized:
                    logger.info(f"✅ Chain found in DefiLlama: {chain_name}")
                    return chain
                
                # También buscar por gecko_id o tokenSymbol
                gecko_id = chain.get('gecko_id') or ''
                token_symbol = chain.get('tokenSymbol') or ''
                if (str(gecko_id).lower() == chain_name_normalized or
                    str(token_symbol).lower() == chain_name_normalized):
                    logger.info(f"✅ Chain found in DefiLlama by ID: {chain_name}")
                    return chain
            
            logger.warning(f"⚠️  Chain not found in DefiLlama: {chain_name}")
            return None
            
        except requests.RequestException as e:
            logger.error(f"❌ Error fetching chain info from DefiLlama: {e}")
            return None
        except Exception as e:
            logger.error(f"❌ Unexpected error in get_chain_info: {e}", exc_info=True)
            return None
    
    def get_chain_tvl(self, chain_name: str) -> Optional[float]:
        """
        Obtiene el TVL actual de una blockchain
        
        Args:
            chain_name: Nombre de la blockchain
            
        Returns:
            TVL en USD o None
        """
        try:
            response = self.session.get(
                f"{self.BASE_URL}/chains",
                timeout=self.timeout
            )
            response.raise_for_status()
            
            chains = response.json()
            
            for chain in chains:
                if chain.get('name', '').lower() == chain_name.lower():
                    tvl = chain.get('tvl', 0)
                    logger.info(f"📊 TVL for {chain_name}: ${tvl:,.2f}")
                    return float(tvl)
            
            return None
            
        except Exception as e:
            logger.error(f"❌ Error fetching TVL: {e}")
            return None
    
    def get_protocols_count(self, chain_name: str) -> int:
        """
        Obtiene el número de protocolos activos en una blockchain
        
        Args:
            chain_name: Nombre de la blockchain
            
        Returns:
            Número de protocolos
        """
        try:
            response = self.session.get(
                f"{self.BASE_URL}/protocols",
                timeout=self.timeout
            )
            response.raise_for_status()
            
            protocols = response.json()
            
            # Contar protocolos que incluyen esta chain
            count = 0
            for protocol in protocols:
                chains = protocol.get('chains', [])
                if isinstance(chains, list) and chain_name.capitalize() in chains:
                    count += 1
            
            logger.info(f"📊 Protocols on {chain_name}: {count}")
            return count
            
        except Exception as e:
            logger.error(f"❌ Error fetching protocols count: {e}")
            return 0
    
    def extract_blockchain_data(self, chain_name: str) -> Dict[str, Any]:
        """
        Extrae todos los datos disponibles de una blockchain desde DefiLlama
        
        Args:
            chain_name: Nombre de la blockchain
            
        Returns:
            Diccionario con datos para columnas PUSH
        """
        logger.info(f"🔍 Fetching data from DefiLlama for: {chain_name}")
        
        chain_info = self.get_chain_info(chain_name)
        tvl = self.get_chain_tvl(chain_name)
        protocols_count = self.get_protocols_count(chain_name)
        
        if not chain_info:
            logger.warning(f"⚠️  No data found in DefiLlama for {chain_name}")
            return {}
        
        # Extraer datos relevantes
        data = {
            'DEFILLAMA_NAME': chain_info.get('name', ''),
            'DEFILLAMA_GECKO_ID': chain_info.get('gecko_id', ''),
            'DEFILLAMA_TOKEN_SYMBOL': chain_info.get('tokenSymbol', ''),
            'DEFILLAMA_CG_ID': chain_info.get('cmcId', ''),
            'TVL_USD': tvl or chain_info.get('tvl', 0),
            'PROTOCOLS_COUNT': protocols_count,
            'DEFILLAMA_CHAIN_ID': chain_info.get('chainId', ''),
            'DATA_SOURCE_DEFILLAMA': 'DefiLlama API',
            'LAST_UPDATED_DEFILLAMA': datetime.now().isoformat(),
        }
        
        logger.info(f"✅ DefiLlama data extracted for {chain_name}: {len(data)} fields")
        return data


# Singleton instance
_defillama_client = None


def get_defillama_client() -> DefiLlamaClient:
    """Retorna instancia singleton del cliente DefiLlama"""
    global _defillama_client
    if _defillama_client is None:
        _defillama_client = DefiLlamaClient()
    return _defillama_client


# Test
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    client = DefiLlamaClient()
    
    # Test con polygon
    print("\n" + "="*80)
    print("Testing DefiLlama Client with 'polygon'")
    print("="*80)
    
    data = client.extract_blockchain_data("polygon")
    
    print("\n📊 Extracted Data:")
    for key, value in data.items():
        print(f"  {key}: {value}")
    
    print("\n✅ Test completed")

