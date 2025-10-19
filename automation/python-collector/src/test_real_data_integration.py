"""
Script de prueba para validar la integración de datos reales

Prueba:
1. DefiLlamaClient - Consulta de datos de blockchains
2. PublicnodesClient - Endpoints RPC
3. LlamanodesClient - Endpoints de Llamanodes
4. BlockchainDataAggregator - Agregación de datos
"""

import sys
import os
import logging

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Agregar directorio actual al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from data_fetchers.defillama_client import get_defillama_client
from data_fetchers.publicnodes_client import get_publicnodes_client
from data_fetchers.llamanodes_client import get_llamanodes_client
from data_fetchers.blockchain_data_aggregator import get_blockchain_data_aggregator

def test_defillama():
    """Prueba DefiLlamaClient"""
    logger.info("\n" + "=" * 80)
    logger.info("TEST 1: DefiLlamaClient")
    logger.info("=" * 80)
    
    client = get_defillama_client()
    
    # Probar con Ethereum
    logger.info("\n🔍 Consultando Ethereum en DefiLlama...")
    data = client.get_blockchain_data_for_excel("ethereum")
    
    logger.info(f"✅ Datos obtenidos:")
    for key, value in data.items():
        logger.info(f"  {key}: {value}")
    
    return data

def test_publicnodes():
    """Prueba PublicnodesClient"""
    logger.info("\n" + "=" * 80)
    logger.info("TEST 2: PublicnodesClient")
    logger.info("=" * 80)
    
    client = get_publicnodes_client()
    
    # Probar con Polygon
    logger.info("\n🔍 Consultando Polygon en Publicnodes...")
    data = client.get_blockchain_rpc_data_for_excel("polygon")
    
    logger.info(f"✅ Datos obtenidos:")
    for key, value in data.items():
        logger.info(f"  {key}: {value}")
    
    # Verificar salud de RPC
    logger.info("\n🏥 Verificando salud de RPC...")
    rpc_url = data.get('RPC_URL_1')
    if rpc_url:
        is_healthy = client.verify_rpc_health(rpc_url)
        logger.info(f"  RPC {rpc_url}: {'✅ HEALTHY' if is_healthy else '❌ UNHEALTHY'}")
    
    return data

def test_llamanodes():
    """Prueba LlamanodesClient"""
    logger.info("\n" + "=" * 80)
    logger.info("TEST 3: LlamanodesClient")
    logger.info("=" * 80)
    
    client = get_llamanodes_client()
    
    # Probar con Arbitrum
    logger.info("\n🔍 Consultando Arbitrum en Llamanodes...")
    data = client.get_blockchain_llamanodes_data_for_excel("arbitrum")
    
    logger.info(f"✅ Datos obtenidos:")
    for key, value in data.items():
        logger.info(f"  {key}: {value}")
    
    # Listar blockchains soportadas
    logger.info("\n📋 Blockchains soportadas por Llamanodes:")
    supported = client.get_all_supported_chains()
    logger.info(f"  {', '.join(supported)}")
    
    return data

def test_aggregator():
    """Prueba BlockchainDataAggregator"""
    logger.info("\n" + "=" * 80)
    logger.info("TEST 4: BlockchainDataAggregator")
    logger.info("=" * 80)
    
    aggregator = get_blockchain_data_aggregator()
    
    # Probar con BSC
    logger.info("\n🔍 Consultando BSC (agregando datos de todas las fuentes)...")
    data = aggregator.get_complete_blockchain_data("bsc")
    
    logger.info(f"✅ Datos completos obtenidos:")
    logger.info(f"  Total de campos: {len(data)}")
    
    # Mostrar campos clave
    key_fields = ['BLOCKCHAIN_ID', 'CHAIN_ID', 'NATIVE_TOKEN', 'TVL_USD', 
                  'RPC_URL_1', 'LLAMANODES_RPC', 'HEALTH_STATUS', 'IS_ACTIVE']
    
    logger.info("\n📊 Campos clave:")
    for field in key_fields:
        value = data.get(field, 'N/A')
        logger.info(f"  {field}: {value}")
    
    return data

def test_multiple_blockchains():
    """Prueba con múltiples blockchains"""
    logger.info("\n" + "=" * 80)
    logger.info("TEST 5: Múltiples Blockchains")
    logger.info("=" * 80)
    
    aggregator = get_blockchain_data_aggregator()
    
    blockchains = ['ethereum', 'polygon', 'bsc', 'avalanche', 'arbitrum', 'optimism']
    
    results = {}
    
    for blockchain in blockchains:
        logger.info(f"\n🔍 Consultando {blockchain}...")
        try:
            data = aggregator.get_complete_blockchain_data(blockchain)
            results[blockchain] = {
                'success': True,
                'chain_id': data.get('CHAIN_ID'),
                'tvl': data.get('TVL_USD'),
                'rpc_status': data.get('RPC_STATUS'),
                'health': data.get('HEALTH_STATUS')
            }
            logger.info(f"  ✅ {blockchain}: Chain ID={data.get('CHAIN_ID')}, TVL=${data.get('TVL_USD'):,.0f}")
        except Exception as e:
            logger.error(f"  ❌ Error: {e}")
            results[blockchain] = {'success': False, 'error': str(e)}
    
    # Resumen
    logger.info("\n" + "=" * 80)
    logger.info("RESUMEN DE RESULTADOS")
    logger.info("=" * 80)
    
    successful = sum(1 for r in results.values() if r.get('success'))
    logger.info(f"✅ Exitosos: {successful}/{len(blockchains)}")
    
    for blockchain, result in results.items():
        status = "✅" if result.get('success') else "❌"
        logger.info(f"  {status} {blockchain}")
    
    return results

def main():
    """Ejecuta todas las pruebas"""
    logger.info("\n" + "=" * 80)
    logger.info("PRUEBAS DE INTEGRACIÓN DE DATOS REALES")
    logger.info("=" * 80)
    
    try:
        # Ejecutar pruebas individuales
        test_defillama()
        test_publicnodes()
        test_llamanodes()
        test_aggregator()
        
        # Prueba con múltiples blockchains
        results = test_multiple_blockchains()
        
        logger.info("\n" + "=" * 80)
        logger.info("✅ TODAS LAS PRUEBAS COMPLETADAS")
        logger.info("=" * 80)
        
        return results
        
    except Exception as e:
        logger.error(f"\n❌ Error en pruebas: {e}", exc_info=True)
        return None

if __name__ == "__main__":
    main()

