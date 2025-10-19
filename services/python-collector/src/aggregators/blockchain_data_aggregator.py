"""
Blockchain Data Aggregator - Combina datos de múltiples fuentes externas

📥 ENTRADAS:
- Nombre de blockchain

🔄 TRANSFORMACIONES:
- Consulta DefiLlama, Llamanodes, Publicnodes en paralelo
- Combina y normaliza datos
- Aplica rate limiting

📤 SALIDAS:
- Diccionario unificado con todos los campos para columnas PUSH

🔗 DEPENDENCIAS:
- clients.defillama_client
- clients.llamanodes_client
- clients.publicnodes_client
- lib.rate_limiter

Flujo:
1. Recibe nombre de blockchain
2. Consulta 3 fuentes con rate limiting
3. Combina datos en diccionario unificado
4. Retorna datos listos para escribir en Excel
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime
import concurrent.futures

from clients.defillama_client import get_defillama_client
from clients.llamanodes_client import get_llamanodes_client
from clients.publicnodes_client import get_publicnodes_client
from lib.rate_limiter import get_rate_limiter_manager

logger = logging.getLogger(__name__)


class BlockchainDataAggregator:
    """
    Agregador que combina datos de blockchain desde múltiples fuentes
    """
    
    # Mapeo de nombres comunes a chain IDs
    CHAIN_ID_MAP = {
        'ethereum': 1,
        'polygon': 137,
        'bsc': 56,
        'binance': 56,
        'arbitrum': 42161,
        'optimism': 10,
        'avalanche': 43114,
        'base': 8453,
        'gnosis': 100,
    }
    
    # Mapeo de nombres comunes a símbolos nativos
    NATIVE_TOKEN_MAP = {
        'ethereum': 'ETH',
        'polygon': 'MATIC',
        'bsc': 'BNB',
        'binance': 'BNB',
        'arbitrum': 'ETH',
        'optimism': 'ETH',
        'avalanche': 'AVAX',
        'base': 'ETH',
        'gnosis': 'xDAI',
    }
    
    def __init__(self):
        """Inicializa el agregador con los clientes necesarios"""
        self.defillama_client = get_defillama_client()
        self.llamanodes_client = get_llamanodes_client()
        self.publicnodes_client = get_publicnodes_client()
        self.rate_limiter = get_rate_limiter_manager()
        
        logger.info("BlockchainDataAggregator initialized")
    
    def _fetch_defillama_data(self, chain_name: str) -> Dict[str, Any]:
        """Obtiene datos de DefiLlama con rate limiting"""
        try:
            # Aplicar rate limiting
            self.rate_limiter.acquire('defillama', blocking=True)
            
            # Fetch data
            data = self.defillama_client.extract_blockchain_data(chain_name)
            logger.info(f"✅ DefiLlama data fetched for {chain_name}")
            return data
            
        except Exception as e:
            logger.error(f"❌ Error fetching DefiLlama data: {e}", exc_info=True)
            return {}
    
    def _fetch_llamanodes_data(self, chain_name: str) -> Dict[str, Any]:
        """Obtiene datos de Llamanodes con rate limiting"""
        try:
            # Aplicar rate limiting
            self.rate_limiter.acquire('llamanodes', blocking=True)
            
            # Fetch data
            data = self.llamanodes_client.extract_blockchain_data(chain_name)
            logger.info(f"✅ Llamanodes data fetched for {chain_name}")
            return data
            
        except Exception as e:
            logger.error(f"❌ Error fetching Llamanodes data: {e}", exc_info=True)
            return {}
    
    def _fetch_publicnodes_data(self, chain_name: str) -> Dict[str, Any]:
        """Obtiene datos de Publicnodes con rate limiting"""
        try:
            # Aplicar rate limiting
            self.rate_limiter.acquire('publicnodes', blocking=True)
            
            # Fetch data
            data = self.publicnodes_client.extract_blockchain_data(chain_name)
            logger.info(f"✅ Publicnodes data fetched for {chain_name}")
            return data
            
        except Exception as e:
            logger.error(f"❌ Error fetching Publicnodes data: {e}", exc_info=True)
            return {}
    
    def _get_chain_id(self, chain_name: str, fetched_data: Dict[str, Any]) -> int:
        """Obtiene chain ID desde datos o mapeo"""
        chain_name_lower = chain_name.lower().strip()
        
        # Intentar desde datos fetched
        for key in ['DEFILLAMA_CHAIN_ID', 'LLAMANODES_CHAIN_ID', 'PUBLICNODE_CHAIN_ID']:
            if key in fetched_data and fetched_data[key]:
                return int(fetched_data[key])
        
        # Usar mapeo conocido
        return self.CHAIN_ID_MAP.get(chain_name_lower, 0)
    
    def _get_native_token(self, chain_name: str, fetched_data: Dict[str, Any]) -> str:
        """Obtiene símbolo del token nativo"""
        chain_name_lower = chain_name.lower().strip()
        
        # Intentar desde datos fetched
        if 'DEFILLAMA_TOKEN_SYMBOL' in fetched_data and fetched_data['DEFILLAMA_TOKEN_SYMBOL']:
            return fetched_data['DEFILLAMA_TOKEN_SYMBOL']
        
        # Usar mapeo conocido
        return self.NATIVE_TOKEN_MAP.get(chain_name_lower, 'UNKNOWN')
    
    def aggregate_blockchain_data(self, chain_name: str, parallel: bool = True) -> Dict[str, Any]:
        """
        Agrega datos de blockchain desde múltiples fuentes
        
        Args:
            chain_name: Nombre de la blockchain
            parallel: Si True, consulta fuentes en paralelo
            
        Returns:
            Diccionario con todos los datos agregados para columnas PUSH
        """
        logger.info(f"🔄 Aggregating blockchain data for: {chain_name}")
        start_time = datetime.now()
        
        # Fetch data from all sources
        if parallel:
            # Consultar en paralelo usando ThreadPoolExecutor
            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
                future_defillama = executor.submit(self._fetch_defillama_data, chain_name)
                future_llamanodes = executor.submit(self._fetch_llamanodes_data, chain_name)
                future_publicnodes = executor.submit(self._fetch_publicnodes_data, chain_name)
                
                defillama_data = future_defillama.result()
                llamanodes_data = future_llamanodes.result()
                publicnodes_data = future_publicnodes.result()
        else:
            # Consultar secuencialmente
            defillama_data = self._fetch_defillama_data(chain_name)
            llamanodes_data = self._fetch_llamanodes_data(chain_name)
            publicnodes_data = self._fetch_publicnodes_data(chain_name)
        
        # Combinar todos los datos
        aggregated_data = {}
        
        # Agregar datos de DefiLlama
        aggregated_data.update(defillama_data)
        
        # Agregar datos de Llamanodes
        aggregated_data.update(llamanodes_data)
        
        # Agregar datos de Publicnodes
        aggregated_data.update(publicnodes_data)
        
        # Agregar campos calculados/derivados
        chain_id = self._get_chain_id(chain_name, aggregated_data)
        native_token = self._get_native_token(chain_name, aggregated_data)
        
        aggregated_data.update({
            'BLOCKCHAIN_ID': f"{chain_name.lower()}_{chain_id}",
            'NAME': chain_name.capitalize(),
            'CHAIN_ID': chain_id,
            'NATIVE_TOKEN': native_token,
            'SYMBOL': native_token,
            'IS_ACTIVE': True,
            'HEALTH_STATUS': 'HEALTHY' if aggregated_data.get('RPC_IS_ACTIVE', False) else 'UNKNOWN',
            'AGGREGATED_AT': datetime.now().isoformat(),
        })
        
        # Calcular tiempo de ejecución
        elapsed = (datetime.now() - start_time).total_seconds()
        aggregated_data['FETCH_TIME_MS'] = int(elapsed * 1000)
        
        logger.info(f"✅ Blockchain data aggregated for {chain_name}: {len(aggregated_data)} fields in {elapsed:.2f}s")
        
        return aggregated_data
    
    def get_supported_blockchains(self) -> list:
        """Retorna lista de blockchains soportadas"""
        return list(self.CHAIN_ID_MAP.keys())


# Singleton instance
_aggregator_instance = None


def get_blockchain_data_aggregator() -> BlockchainDataAggregator:
    """Retorna instancia singleton del agregador"""
    global _aggregator_instance
    if _aggregator_instance is None:
        _aggregator_instance = BlockchainDataAggregator()
    return _aggregator_instance


# Test
if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    aggregator = BlockchainDataAggregator()
    
    print("\n" + "="*80)
    print("Testing BlockchainDataAggregator with 'polygon'")
    print("="*80)
    
    # Test con polygon
    data = aggregator.aggregate_blockchain_data("polygon", parallel=True)
    
    print(f"\n📊 Aggregated Data ({len(data)} fields):")
    print("-" * 80)
    
    # Agrupar por fuente
    defillama_fields = {k: v for k, v in data.items() if 'DEFILLAMA' in k}
    llamanodes_fields = {k: v for k, v in data.items() if 'LLAMANODES' in k or 'RPC' in k or 'WSS' in k}
    publicnodes_fields = {k: v for k, v in data.items() if 'PUBLICNODE' in k or 'EXPLORER' in k}
    other_fields = {k: v for k, v in data.items() if k not in defillama_fields and k not in llamanodes_fields and k not in publicnodes_fields}
    
    print("\n🔹 DefiLlama Data:")
    for key, value in defillama_fields.items():
        print(f"  {key}: {value}")
    
    print("\n🔹 Llamanodes Data:")
    for key, value in llamanodes_fields.items():
        print(f"  {key}: {value}")
    
    print("\n🔹 Publicnodes Data:")
    for key, value in publicnodes_fields.items():
        print(f"  {key}: {value}")
    
    print("\n🔹 Calculated/Derived Data:")
    for key, value in other_fields.items():
        print(f"  {key}: {value}")
    
    print(f"\n⏱️  Total fetch time: {data.get('FETCH_TIME_MS', 0)}ms")
    print("\n✅ Test completed")

