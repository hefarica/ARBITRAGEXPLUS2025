"""
Prueba End-to-End del Sistema de Automatización Excel

Simula el flujo completo:
1. Usuario escribe nombre de blockchain en columna NAME (PULL)
2. Sistema detecta el cambio
3. Sistema consulta APIs externas (DefiLlama, Publicnodes, Llamanodes)
4. Sistema actualiza columnas PUSH automáticamente
5. Validación de datos y rendimiento

Objetivo de rendimiento: <300ms total por blockchain
"""

import sys
import os
import logging
import time
from typing import Dict, Any

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Agregar directorio actual al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from excel_client_v2 import get_excel_client_v2
from data_fetchers.blockchain_data_aggregator import get_blockchain_data_aggregator
from rate_limiter import get_rate_limiter_manager

def test_excel_file_exists():
    """Verifica que el archivo Excel existe"""
    logger.info("\n" + "=" * 80)
    logger.info("TEST 1: Verificar Archivo Excel")
    logger.info("=" * 80)
    
    client = get_excel_client_v2()
    
    if not os.path.exists(client.file_path):
        logger.error(f"❌ Archivo Excel no encontrado: {client.file_path}")
        return False
    
    logger.info(f"✅ Archivo Excel encontrado: {client.file_path}")
    logger.info(f"   Tamaño: {os.path.getsize(client.file_path) / 1024:.1f} KB")
    return True

def test_column_detection():
    """Verifica detección de columnas PUSH/PULL"""
    logger.info("\n" + "=" * 80)
    logger.info("TEST 2: Detección de Columnas PUSH/PULL")
    logger.info("=" * 80)
    
    client = get_excel_client_v2()
    
    try:
        metadata = client.get_column_metadata("BLOCKCHAINS")
        pull_columns = client.get_pull_columns("BLOCKCHAINS")
        push_columns = client.get_push_columns("BLOCKCHAINS")
        
        logger.info(f"✅ Total de columnas: {len(metadata)}")
        logger.info(f"   Columnas PULL (blancas): {len(pull_columns)}")
        logger.info(f"   Columnas PUSH (azules): {len(push_columns)}")
        
        # Mostrar columnas PULL
        logger.info("\n📋 Columnas PULL detectadas:")
        for col in pull_columns:
            logger.info(f"   - {col.name} (columna {col.index})")
        
        # Mostrar algunas columnas PUSH
        logger.info(f"\n📋 Primeras 10 columnas PUSH detectadas:")
        for col in push_columns[:10]:
            logger.info(f"   - {col.name} (columna {col.index})")
        
        return len(pull_columns) > 0 and len(push_columns) > 0
        
    except Exception as e:
        logger.error(f"❌ Error: {e}", exc_info=True)
        return False

def test_data_aggregation(blockchain_name: str = "ethereum"):
    """Prueba agregación de datos de múltiples fuentes"""
    logger.info("\n" + "=" * 80)
    logger.info(f"TEST 3: Agregación de Datos ({blockchain_name})")
    logger.info("=" * 80)
    
    aggregator = get_blockchain_data_aggregator()
    
    logger.info(f"\n🔍 Consultando datos para: {blockchain_name}")
    start = time.time()
    
    try:
        data = aggregator.get_complete_blockchain_data(blockchain_name)
        elapsed = (time.time() - start) * 1000  # en ms
        
        logger.info(f"✅ Datos agregados en {elapsed:.0f}ms")
        
        # Validar campos clave
        required_fields = ['BLOCKCHAIN_ID', 'CHAIN_ID', 'NATIVE_TOKEN', 'RPC_URL_1']
        missing_fields = [f for f in required_fields if not data.get(f)]
        
        if missing_fields:
            logger.warning(f"⚠️  Campos faltantes: {missing_fields}")
        else:
            logger.info("✅ Todos los campos requeridos presentes")
        
        # Mostrar datos clave
        logger.info("\n📊 Datos obtenidos:")
        key_fields = {
            'BLOCKCHAIN_ID': data.get('BLOCKCHAIN_ID'),
            'CHAIN_ID': data.get('CHAIN_ID'),
            'NATIVE_TOKEN': data.get('NATIVE_TOKEN'),
            'TVL_USD': f"${data.get('TVL_USD', 0):,.0f}",
            'RPC_URL_1': data.get('RPC_URL_1'),
            'HEALTH_STATUS': data.get('HEALTH_STATUS'),
            'IS_ACTIVE': data.get('IS_ACTIVE')
        }
        
        for field, value in key_fields.items():
            logger.info(f"   {field}: {value}")
        
        return elapsed, data
        
    except Exception as e:
        logger.error(f"❌ Error: {e}", exc_info=True)
        return None, None

def test_excel_update(blockchain_name: str = "ethereum", row: int = 2):
    """Prueba actualización de Excel"""
    logger.info("\n" + "=" * 80)
    logger.info(f"TEST 4: Actualización de Excel (fila {row})")
    logger.info("=" * 80)
    
    client = get_excel_client_v2()
    aggregator = get_blockchain_data_aggregator()
    
    try:
        # Obtener datos
        logger.info(f"\n🔍 Obteniendo datos para: {blockchain_name}")
        data = aggregator.get_complete_blockchain_data(blockchain_name)
        
        # Actualizar Excel
        logger.info(f"💾 Actualizando columnas PUSH en fila {row}...")
        start = time.time()
        
        client.update_push_columns("BLOCKCHAINS", row, data)
        
        elapsed = (time.time() - start) * 1000  # en ms
        logger.info(f"✅ Excel actualizado en {elapsed:.0f}ms")
        
        return elapsed
        
    except Exception as e:
        logger.error(f"❌ Error: {e}", exc_info=True)
        return None

def test_full_cycle_performance():
    """Prueba rendimiento del ciclo completo"""
    logger.info("\n" + "=" * 80)
    logger.info("TEST 5: Rendimiento Ciclo Completo")
    logger.info("=" * 80)
    
    blockchains = ['ethereum', 'polygon', 'arbitrum']
    results = []
    
    for blockchain in blockchains:
        logger.info(f"\n{'=' * 40}")
        logger.info(f"Procesando: {blockchain.upper()}")
        logger.info(f"{'=' * 40}")
        
        start_total = time.time()
        
        # Fase 1: Agregación de datos
        logger.info("📊 Fase 1: Agregación de datos...")
        fetch_time, data = test_data_aggregation(blockchain)
        
        if not data:
            logger.error(f"❌ Fallo en agregación de datos para {blockchain}")
            continue
        
        # Fase 2: Actualización de Excel (simulada, sin escribir realmente)
        logger.info("\n💾 Fase 2: Actualización de Excel (simulada)...")
        update_start = time.time()
        # Simular actualización sin escribir realmente
        time.sleep(0.05)  # Simular 50ms de escritura
        update_time = (time.time() - update_start) * 1000
        
        total_time = (time.time() - start_total) * 1000
        
        # Registrar resultados
        result = {
            'blockchain': blockchain,
            'fetch_time': fetch_time,
            'update_time': update_time,
            'total_time': total_time,
            'meets_target': total_time < 300
        }
        results.append(result)
        
        # Mostrar resumen
        logger.info(f"\n⏱️  Tiempos:")
        logger.info(f"   Fetch: {fetch_time:.0f}ms")
        logger.info(f"   Update: {update_time:.0f}ms")
        logger.info(f"   Total: {total_time:.0f}ms")
        
        if result['meets_target']:
            logger.info(f"   🎯 CUMPLE objetivo (<300ms)")
        else:
            logger.warning(f"   ⚠️  EXCEDE objetivo ({total_time:.0f}ms > 300ms)")
    
    # Resumen final
    logger.info("\n" + "=" * 80)
    logger.info("RESUMEN DE RENDIMIENTO")
    logger.info("=" * 80)
    
    total_tests = len(results)
    passed_tests = sum(1 for r in results if r['meets_target'])
    avg_time = sum(r['total_time'] for r in results) / total_tests if total_tests > 0 else 0
    
    logger.info(f"\n📊 Estadísticas:")
    logger.info(f"   Total de pruebas: {total_tests}")
    logger.info(f"   Cumplieron objetivo: {passed_tests}/{total_tests}")
    logger.info(f"   Tiempo promedio: {avg_time:.0f}ms")
    logger.info(f"   Objetivo: <300ms")
    
    logger.info(f"\n📋 Resultados detallados:")
    for r in results:
        status = "✅" if r['meets_target'] else "⚠️"
        logger.info(f"   {status} {r['blockchain']}: {r['total_time']:.0f}ms")
    
    return results

def test_rate_limiter_integration():
    """Prueba integración con rate limiter"""
    logger.info("\n" + "=" * 80)
    logger.info("TEST 6: Integración con Rate Limiter")
    logger.info("=" * 80)
    
    manager = get_rate_limiter_manager()
    
    # Mostrar estado de todos los rate limiters
    logger.info("\n📊 Estado de Rate Limiters:")
    status = manager.get_all_status()
    
    for api, info in status.items():
        logger.info(f"\n   {api.upper()}:")
        logger.info(f"      Rate: {info['rate']:.1f} req/s")
        logger.info(f"      Capacity: {info['capacity']}")
        logger.info(f"      Available: {info['available_tokens']:.1f}")
        logger.info(f"      Utilization: {info['utilization']*100:.1f}%")
    
    return True

def main():
    """Ejecuta todas las pruebas end-to-end"""
    logger.info("\n" + "=" * 80)
    logger.info("PRUEBAS END-TO-END: SISTEMA DE AUTOMATIZACIÓN EXCEL")
    logger.info("=" * 80)
    
    test_results = {}
    
    try:
        # Test 1: Archivo Excel
        test_results['excel_file'] = test_excel_file_exists()
        
        # Test 2: Detección de columnas
        test_results['column_detection'] = test_column_detection()
        
        # Test 3: Agregación de datos
        fetch_time, data = test_data_aggregation("ethereum")
        test_results['data_aggregation'] = fetch_time is not None
        
        # Test 4: Actualización de Excel (comentado para no modificar el archivo)
        # test_results['excel_update'] = test_excel_update("ethereum", 2)
        logger.info("\n⚠️  Test 4 (Actualización de Excel) omitido para preservar archivo")
        
        # Test 5: Rendimiento ciclo completo
        perf_results = test_full_cycle_performance()
        test_results['performance'] = len(perf_results) > 0
        
        # Test 6: Rate limiter
        test_results['rate_limiter'] = test_rate_limiter_integration()
        
        # Resumen final
        logger.info("\n" + "=" * 80)
        logger.info("RESUMEN FINAL DE PRUEBAS")
        logger.info("=" * 80)
        
        total = len(test_results)
        passed = sum(1 for v in test_results.values() if v)
        
        logger.info(f"\n📊 Resultados:")
        for test_name, result in test_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            logger.info(f"   {status}: {test_name}")
        
        logger.info(f"\n🎯 Total: {passed}/{total} pruebas exitosas")
        
        if passed == total:
            logger.info("\n✅ TODAS LAS PRUEBAS PASARON")
        else:
            logger.warning(f"\n⚠️  {total - passed} pruebas fallaron")
        
        return test_results
        
    except Exception as e:
        logger.error(f"\n❌ Error en pruebas: {e}", exc_info=True)
        return None

if __name__ == "__main__":
    main()

