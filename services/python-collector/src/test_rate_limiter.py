"""
Script de prueba para RateLimiterManager

Prueba:
1. Creación y configuración de rate limiters
2. Consumo de tokens y espera
3. Verificación de límites
4. Integración con clientes de datos
"""

import sys
import os
import logging
import time
import threading

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Agregar directorio actual al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from rate_limiter import get_rate_limiter_manager, RateLimitConfig

def test_basic_rate_limiting():
    """Prueba básica de rate limiting"""
    logger.info("\n" + "=" * 80)
    logger.info("TEST 1: Rate Limiting Básico")
    logger.info("=" * 80)
    
    manager = get_rate_limiter_manager()
    
    # Mostrar estado inicial
    logger.info("\n📊 Estado inicial:")
    status = manager.get_all_status()
    for api, info in status.items():
        logger.info(f"  {api}: {info['available_tokens']:.1f}/{info['capacity']} tokens")
    
    # Hacer 5 requests rápidas a DefiLlama
    logger.info("\n🔄 Haciendo 5 requests rápidas a DefiLlama...")
    start = time.time()
    
    for i in range(5):
        success = manager.try_acquire('defillama')
        logger.info(f"  Request {i+1}: {'✅ OK' if success else '❌ BLOCKED'}")
    
    elapsed = time.time() - start
    logger.info(f"⏱️  Tiempo total: {elapsed*1000:.0f}ms")
    
    # Mostrar estado después
    logger.info("\n📊 Estado después de 5 requests:")
    status = manager.get_status('defillama')
    logger.info(f"  Tokens disponibles: {status['available_tokens']:.1f}/{status['capacity']}")
    logger.info(f"  Utilización: {status['utilization']*100:.1f}%")

def test_rate_limiting_with_wait():
    """Prueba rate limiting con espera"""
    logger.info("\n" + "=" * 80)
    logger.info("TEST 2: Rate Limiting con Espera")
    logger.info("=" * 80)
    
    manager = get_rate_limiter_manager()
    
    # Hacer 15 requests con espera (más que el límite de 10/s)
    logger.info("\n🔄 Haciendo 15 requests con espera automática...")
    start = time.time()
    
    for i in range(15):
        try:
            manager.acquire('defillama', timeout=2.0)
            logger.info(f"  Request {i+1}: ✅ OK")
        except TimeoutError:
            logger.warning(f"  Request {i+1}: ⏱️  TIMEOUT")
    
    elapsed = time.time() - start
    logger.info(f"⏱️  Tiempo total: {elapsed*1000:.0f}ms")
    logger.info(f"📈 Tasa efectiva: {15/elapsed:.1f} req/s")

def test_concurrent_requests():
    """Prueba requests concurrentes"""
    logger.info("\n" + "=" * 80)
    logger.info("TEST 3: Requests Concurrentes")
    logger.info("=" * 80)
    
    manager = get_rate_limiter_manager()
    results = {'success': 0, 'timeout': 0}
    lock = threading.Lock()
    
    def make_request(thread_id: int):
        """Función que ejecuta cada thread"""
        try:
            manager.acquire('defillama', timeout=3.0)
            with lock:
                results['success'] += 1
            logger.info(f"  Thread {thread_id}: ✅ OK")
        except TimeoutError:
            with lock:
                results['timeout'] += 1
            logger.warning(f"  Thread {thread_id}: ⏱️  TIMEOUT")
    
    # Lanzar 20 threads simultáneos
    logger.info("\n🔄 Lanzando 20 threads simultáneos...")
    start = time.time()
    
    threads = []
    for i in range(20):
        thread = threading.Thread(target=make_request, args=(i+1,))
        threads.append(thread)
        thread.start()
    
    # Esperar a que terminen todos
    for thread in threads:
        thread.join()
    
    elapsed = time.time() - start
    
    logger.info(f"\n📊 Resultados:")
    logger.info(f"  Exitosos: {results['success']}/20")
    logger.info(f"  Timeouts: {results['timeout']}/20")
    logger.info(f"  Tiempo total: {elapsed*1000:.0f}ms")
    logger.info(f"  Tasa efectiva: {results['success']/elapsed:.1f} req/s")

def test_multiple_apis():
    """Prueba con múltiples APIs"""
    logger.info("\n" + "=" * 80)
    logger.info("TEST 4: Múltiples APIs")
    logger.info("=" * 80)
    
    manager = get_rate_limiter_manager()
    
    apis = ['defillama', 'publicnodes', 'llamanodes']
    
    logger.info("\n🔄 Haciendo 3 requests a cada API...")
    
    for api in apis:
        logger.info(f"\n  {api.upper()}:")
        for i in range(3):
            success = manager.try_acquire(api)
            logger.info(f"    Request {i+1}: {'✅ OK' if success else '❌ BLOCKED'}")
    
    # Mostrar estado de todas las APIs
    logger.info("\n📊 Estado de todas las APIs:")
    all_status = manager.get_all_status()
    for api, status in all_status.items():
        logger.info(f"  {api}:")
        logger.info(f"    Rate: {status['rate']:.1f} req/s")
        logger.info(f"    Tokens: {status['available_tokens']:.1f}/{status['capacity']}")
        logger.info(f"    Utilización: {status['utilization']*100:.1f}%")

def test_integration_with_defillama():
    """Prueba integración con DefiLlamaClient"""
    logger.info("\n" + "=" * 80)
    logger.info("TEST 5: Integración con DefiLlamaClient")
    logger.info("=" * 80)
    
    from data_fetchers.defillama_client import get_defillama_client
    
    client = get_defillama_client()
    manager = get_rate_limiter_manager()
    
    # Hacer múltiples consultas
    blockchains = ['ethereum', 'polygon', 'bsc']
    
    logger.info("\n🔄 Consultando múltiples blockchains con rate limiting...")
    start = time.time()
    
    for blockchain in blockchains:
        logger.info(f"\n  Consultando {blockchain}...")
        
        # Mostrar estado del rate limiter antes
        status_before = manager.get_status('defillama')
        logger.info(f"    Tokens antes: {status_before['available_tokens']:.1f}")
        
        # Hacer consulta
        data = client.get_blockchain_data_for_excel(blockchain)
        
        # Mostrar estado del rate limiter después
        status_after = manager.get_status('defillama')
        logger.info(f"    Tokens después: {status_after['available_tokens']:.1f}")
        logger.info(f"    TVL: ${data.get('TVL_USD', 0):,.0f}")
    
    elapsed = time.time() - start
    logger.info(f"\n⏱️  Tiempo total: {elapsed*1000:.0f}ms")
    logger.info(f"📈 Tasa efectiva: {len(blockchains)/elapsed:.1f} consultas/s")

def main():
    """Ejecuta todas las pruebas"""
    logger.info("\n" + "=" * 80)
    logger.info("PRUEBAS DE RATE LIMITER")
    logger.info("=" * 80)
    
    try:
        test_basic_rate_limiting()
        time.sleep(1)  # Esperar para que se recarguen los tokens
        
        test_rate_limiting_with_wait()
        time.sleep(1)
        
        test_concurrent_requests()
        time.sleep(1)
        
        test_multiple_apis()
        time.sleep(1)
        
        test_integration_with_defillama()
        
        logger.info("\n" + "=" * 80)
        logger.info("✅ TODAS LAS PRUEBAS COMPLETADAS")
        logger.info("=" * 80)
        
    except Exception as e:
        logger.error(f"\n❌ Error en pruebas: {e}", exc_info=True)

if __name__ == "__main__":
    main()

