"""
Rate Limiter Manager - Implementa algoritmo Token Bucket para rate limiting

📥 ENTRADAS:
- Configuración de límites por API (requests/segundo)

🔄 TRANSFORMACIONES:
- Algoritmo Token Bucket para control de tasa
- Gestión de múltiples limitadores por API

📤 SALIDAS:
- Permite/bloquea requests según límites configurados

🔗 DEPENDENCIAS:
- threading para thread-safety
- time para tracking de tiempo

Algoritmo Token Bucket:
- Bucket tiene capacidad máxima de tokens
- Tokens se regeneran a tasa constante
- Cada request consume 1 token
- Si no hay tokens, request se bloquea hasta que haya disponibles
"""

import time
import threading
import logging
from typing import Dict, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class RateLimitConfig:
    """Configuración de rate limiting para una API"""
    requests_per_second: float
    burst_size: int = 10  # Tamaño del burst (capacidad máxima del bucket)


class TokenBucket:
    """
    Implementación del algoritmo Token Bucket para rate limiting
    
    El bucket tiene una capacidad máxima y se llena a una tasa constante.
    Cada request consume un token. Si no hay tokens disponibles, se espera.
    """
    
    def __init__(self, rate: float, capacity: int):
        """
        Args:
            rate: Tasa de regeneración de tokens (tokens/segundo)
            capacity: Capacidad máxima del bucket
        """
        self.rate = rate
        self.capacity = capacity
        self.tokens = capacity
        self.last_update = time.time()
        self._lock = threading.Lock()
        
        logger.debug(f"TokenBucket created: rate={rate}/s, capacity={capacity}")
    
    def _refill(self):
        """Rellena el bucket basándose en el tiempo transcurrido"""
        now = time.time()
        elapsed = now - self.last_update
        
        # Calcular tokens a agregar
        tokens_to_add = elapsed * self.rate
        
        # Actualizar tokens (sin exceder capacidad)
        self.tokens = min(self.capacity, self.tokens + tokens_to_add)
        self.last_update = now
    
    def consume(self, tokens: int = 1, blocking: bool = True) -> bool:
        """
        Intenta consumir tokens del bucket
        
        Args:
            tokens: Número de tokens a consumir
            blocking: Si True, espera hasta que haya tokens disponibles
            
        Returns:
            True si se consumieron los tokens, False si no hay disponibles
        """
        with self._lock:
            self._refill()
            
            # Si hay suficientes tokens, consumir
            if self.tokens >= tokens:
                self.tokens -= tokens
                return True
            
            # Si no hay tokens y no es blocking, retornar False
            if not blocking:
                return False
            
            # Calcular tiempo de espera
            tokens_needed = tokens - self.tokens
            wait_time = tokens_needed / self.rate
            
            logger.debug(f"Rate limit reached, waiting {wait_time:.2f}s")
        
        # Esperar fuera del lock
        if blocking:
            time.sleep(wait_time)
            return self.consume(tokens, blocking=False)
        
        return False
    
    def get_available_tokens(self) -> float:
        """Retorna el número de tokens disponibles actualmente"""
        with self._lock:
            self._refill()
            return self.tokens


class RateLimiterManager:
    """
    Gestor de rate limiters para múltiples APIs
    
    Mantiene un TokenBucket por cada API y gestiona los límites de forma centralizada.
    """
    
    # Configuraciones por defecto para APIs conocidas
    DEFAULT_CONFIGS = {
        'defillama': RateLimitConfig(requests_per_second=5.0, burst_size=10),
        'llamanodes': RateLimitConfig(requests_per_second=10.0, burst_size=20),
        'publicnodes': RateLimitConfig(requests_per_second=10.0, burst_size=20),
        'default': RateLimitConfig(requests_per_second=2.0, burst_size=5),
    }
    
    def __init__(self, configs: Optional[Dict[str, RateLimitConfig]] = None):
        """
        Args:
            configs: Diccionario de configuraciones por API
        """
        self.configs = configs or self.DEFAULT_CONFIGS.copy()
        self.limiters: Dict[str, TokenBucket] = {}
        self._lock = threading.Lock()
        
        logger.info(f"RateLimiterManager initialized with {len(self.configs)} configs")
    
    def _get_limiter(self, api_name: str) -> TokenBucket:
        """Obtiene o crea un limiter para una API"""
        with self._lock:
            if api_name not in self.limiters:
                # Obtener config (usar default si no existe)
                config = self.configs.get(api_name, self.configs['default'])
                
                # Crear limiter
                self.limiters[api_name] = TokenBucket(
                    rate=config.requests_per_second,
                    capacity=config.burst_size
                )
                
                logger.info(f"Created rate limiter for '{api_name}': {config.requests_per_second}/s")
            
            return self.limiters[api_name]
    
    def acquire(self, api_name: str, tokens: int = 1, blocking: bool = True) -> bool:
        """
        Adquiere permiso para hacer un request a una API
        
        Args:
            api_name: Nombre de la API
            tokens: Número de tokens a consumir
            blocking: Si True, espera hasta que haya tokens disponibles
            
        Returns:
            True si se obtuvo permiso, False si no hay tokens disponibles
        """
        limiter = self._get_limiter(api_name)
        return limiter.consume(tokens, blocking)
    
    def get_status(self, api_name: str) -> Dict[str, any]:
        """
        Obtiene el estado actual de un rate limiter
        
        Args:
            api_name: Nombre de la API
            
        Returns:
            Diccionario con estado del limiter
        """
        limiter = self._get_limiter(api_name)
        config = self.configs.get(api_name, self.configs['default'])
        
        return {
            'api_name': api_name,
            'rate': config.requests_per_second,
            'capacity': config.burst_size,
            'available_tokens': limiter.get_available_tokens(),
        }
    
    def add_config(self, api_name: str, config: RateLimitConfig):
        """
        Agrega o actualiza configuración para una API
        
        Args:
            api_name: Nombre de la API
            config: Configuración de rate limiting
        """
        with self._lock:
            self.configs[api_name] = config
            
            # Si ya existe un limiter, recrearlo
            if api_name in self.limiters:
                del self.limiters[api_name]
            
            logger.info(f"Updated rate limit config for '{api_name}': {config.requests_per_second}/s")


# Singleton instance
_rate_limiter_manager = None


def get_rate_limiter_manager() -> RateLimiterManager:
    """Retorna instancia singleton del RateLimiterManager"""
    global _rate_limiter_manager
    if _rate_limiter_manager is None:
        _rate_limiter_manager = RateLimiterManager()
    return _rate_limiter_manager


# Test
if __name__ == "__main__":
    logging.basicConfig(level=logging.DEBUG)
    
    print("\n" + "="*80)
    print("Testing RateLimiterManager with Token Bucket algorithm")
    print("="*80)
    
    manager = RateLimiterManager()
    
    # Test 1: Hacer requests rápidos (debería rate limit)
    print("\n📊 Test 1: Rapid requests to DefiLlama (5/s limit)")
    print("-" * 80)
    
    start = time.time()
    for i in range(10):
        acquired = manager.acquire('defillama', blocking=False)
        elapsed = time.time() - start
        print(f"Request {i+1}: {'✅ Allowed' if acquired else '❌ Rate limited'} (elapsed: {elapsed:.2f}s)")
    
    # Test 2: Hacer requests con blocking
    print("\n📊 Test 2: Blocking requests to DefiLlama")
    print("-" * 80)
    
    start = time.time()
    for i in range(5):
        manager.acquire('defillama', blocking=True)
        elapsed = time.time() - start
        print(f"Request {i+1}: ✅ Completed (elapsed: {elapsed:.2f}s)")
    
    # Test 3: Ver estado
    print("\n📊 Test 3: Check status")
    print("-" * 80)
    
    status = manager.get_status('defillama')
    print(f"API: {status['api_name']}")
    print(f"Rate: {status['rate']}/s")
    print(f"Capacity: {status['capacity']}")
    print(f"Available tokens: {status['available_tokens']:.2f}")
    
    print("\n✅ All tests completed")

