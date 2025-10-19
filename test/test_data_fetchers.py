"""
Test para clientes de fuentes de datos externas
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "services" / "python-collector" / "src"))

from fetchers.defillama_client import DefiLlamaClient
from fetchers.llamanodes_client import LlamanodesClient
from fetchers.publicnodes_client import PublicnodesClient


def test_defillama():
    """Prueba el cliente DefiLlama"""
    
    print(f"\n{'='*80}")
    print(f"TEST: DefiLlamaClient")
    print(f"{'='*80}\n")
    
    with DefiLlamaClient() as client:
        # Test 1: Obtener datos de Ethereum
        print(f"Test 1: Obtener datos de Ethereum")
        print(f"{'-'*80}")
        
        data = client.extract_blockchain_data("ethereum")
        
        print(f"Campos obtenidos: {len(data)}")
        for key, value in data.items():
            if value is not None:
                print(f"  {key}: {value}")
        
        print()
        
        # Test 2: Obtener DEXes soportados
        print(f"Test 2: Obtener DEXes en Ethereum")
        print(f"{'-'*80}")
        
        dexes = client.get_supported_dexes("ethereum")
        print(f"DEXes encontrados: {len(dexes)}")
        for dex in dexes[:5]:
            print(f"  - {dex}")
        if len(dexes) > 5:
            print(f"  ... y {len(dexes) - 5} más")
        
        print()


def test_llamanodes():
    """Prueba el cliente Llamanodes"""
    
    print(f"\n{'='*80}")
    print(f"TEST: LlamanodesClient")
    print(f"{'='*80}\n")
    
    client = LlamanodesClient()
    
    # Test 1: Obtener endpoints RPC
    print(f"Test 1: Obtener endpoints RPC para Polygon")
    print(f"{'-'*80}")
    
    endpoints = client.get_rpc_endpoints("polygon")
    
    print(f"Endpoints obtenidos: {len(endpoints)}")
    for key, value in endpoints.items():
        print(f"  {key}: {value}")
    
    print()
    
    # Test 2: Obtener direcciones de contratos
    print(f"Test 2: Obtener direcciones de contratos para Polygon")
    print(f"{'-'*80}")
    
    contracts = client.get_contract_addresses("polygon")
    
    print(f"Contratos obtenidos: {len(contracts)}")
    for key, value in contracts.items():
        print(f"  {key}: {value}")
    
    print()
    
    # Test 3: Test de RPC endpoint
    print(f"Test 3: Probar conectividad de RPC")
    print(f"{'-'*80}")
    
    if "RPC_URL_1" in endpoints:
        result = client.test_rpc_endpoint(endpoints["RPC_URL_1"])
        
        print(f"URL: {result['url']}")
        print(f"Success: {result['success']}")
        if result['success']:
            print(f"Latency: {result['latency_ms']} ms")
            print(f"Block number: {result['block_number']}")
        else:
            print(f"Error: {result['error']}")
    
    print()
    
    # Test 4: Extraer datos completos
    print(f"Test 4: Extraer datos completos de BSC")
    print(f"{'-'*80}")
    
    data = client.extract_blockchain_data("bsc")
    
    print(f"Campos obtenidos: {len(data)}")
    for key, value in data.items():
        if value is not None:
            print(f"  {key}: {value}")
    
    print()


def test_publicnodes():
    """Prueba el cliente Publicnodes"""
    
    print(f"\n{'='*80}")
    print(f"TEST: PublicnodesClient")
    print(f"{'='*80}\n")
    
    client = PublicnodesClient()
    
    # Test 1: Obtener configuración técnica
    print(f"Test 1: Obtener configuración de Arbitrum")
    print(f"{'-'*80}")
    
    config = client.get_chain_config("arbitrum")
    
    print(f"Parámetros obtenidos: {len(config)}")
    for key, value in config.items():
        print(f"  {key}: {value}")
    
    print()
    
    # Test 2: Obtener DEXes soportados
    print(f"Test 2: Obtener DEXes soportados en Arbitrum")
    print(f"{'-'*80}")
    
    dexes = client.get_supported_dexes("arbitrum")
    
    print(f"DEXes: {len(dexes)}")
    for dex in dexes:
        print(f"  - {dex}")
    
    print()
    
    # Test 3: Obtener protocolos soportados
    print(f"Test 3: Obtener protocolos soportados en Arbitrum")
    print(f"{'-'*80}")
    
    protocols = client.get_supported_protocols("arbitrum")
    
    print(f"Protocolos: {len(protocols)}")
    for protocol in protocols:
        print(f"  - {protocol}")
    
    print()
    
    # Test 4: Extraer datos completos
    print(f"Test 4: Extraer datos completos de Optimism")
    print(f"{'-'*80}")
    
    data = client.extract_blockchain_data("optimism")
    
    print(f"Campos obtenidos: {len(data)}")
    for key, value in data.items():
        if value is not None:
            print(f"  {key}: {value}")
    
    print()


def test_integration():
    """Prueba la integración de los 3 clientes"""
    
    print(f"\n{'='*80}")
    print(f"TEST: Integración de los 3 clientes")
    print(f"{'='*80}\n")
    
    chain_name = "ethereum"
    
    print(f"Obteniendo datos completos de '{chain_name}' desde 3 fuentes...")
    print(f"{'-'*80}\n")
    
    # Obtener datos de cada fuente
    with DefiLlamaClient() as defillama:
        defillama_data = defillama.extract_blockchain_data(chain_name)
    
    llamanodes = LlamanodesClient()
    llamanodes_data = llamanodes.extract_blockchain_data(chain_name)
    
    publicnodes = PublicnodesClient()
    publicnodes_data = publicnodes.extract_blockchain_data(chain_name)
    
    # Merge de datos
    merged_data = {
        **defillama_data,
        **llamanodes_data,
        **publicnodes_data,
    }
    
    print(f"Datos merged de {chain_name}:")
    print(f"  - DefiLlama: {len(defillama_data)} campos")
    print(f"  - Llamanodes: {len(llamanodes_data)} campos")
    print(f"  - Publicnodes: {len(publicnodes_data)} campos")
    print(f"  - TOTAL: {len(merged_data)} campos únicos\n")
    
    # Mostrar algunos campos clave
    print(f"Campos clave:")
    key_fields = [
        "CHAIN_ID", "NATIVE_TOKEN", "TVL_USD", "DAILY_VOLUME_USD",
        "RPC_URL_1", "WETH_ADDRESS", "BLOCK_TIME_MS", "GAS_PRICE_GWEI",
        "SUPPORTED_DEXES", "LATENCY_MS"
    ]
    
    for field in key_fields:
        if field in merged_data:
            value = merged_data[field]
            print(f"  {field}: {value}")
    
    print()
    
    print(f"{'='*80}")
    print(f"TODOS LOS TESTS COMPLETADOS")
    print(f"{'='*80}\n")


if __name__ == "__main__":
    # Ejecutar tests individuales
    test_defillama()
    test_llamanodes()
    test_publicnodes()
    
    # Test de integración
    test_integration()

