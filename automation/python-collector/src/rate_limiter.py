"""
RateLimiterManager - Gestor de rate limiting para APIs externas

Implementa algoritmo Token Bucket para controlar la tasa de peticiones a APIs externas
y evitar bloqueos por exceso de requests.

Configuración por API:
- DefiLlama: Sin límite oficial documentado, usar 10 req/s como precaución
- Publicnodes: Sin límite oficial, usar 5 req/s
- Llamanodes: Sin límite oficial, usar 5 req/s

El rate limiter es thread-safe y puede ser usado concurrentemente.
"""

import time
import threading
import logging
from typing import Dict, Optional
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)

@dataclass
class RateLimitConfig:
    """Configuración de rate limiting para una API"""
    name: str
    max_requests: int  # Máximo de requests por período
    period_seconds: float  # Período en segundos
    
    @property
    def requests_per_second(self) -> float:
        """Retorna requests por segundo"""
        return self.max_requests / self.period_seconds

class TokenBucket:
    """
    Implementación de Token Bucket para rate limiting
    
    El algoritmo permite ráfagas cortas mientras mantiene una tasa promedio.
    """
    
    def __init__(self, rate: float, capacity: int):
        """
        Args:
            rate: Tokens agregados por segundo
            capacity: Capacidad máxima del bucket
        """
        self.rate = rate
        self.capacity = capacity
        self.tokens = capacity
        self.last_update = time.time()
        self._lock = threading.Lock()
    
    def _refill(self):
        """Rellena el bucket con tokens basándose en el tiempo transcurrido"""
        now = time.time()
        elapsed = now - self.last_update
        
        # Agregar tokens basándose en el tiempo transcurrido
        new_tokens = elapsed * self.rate
        self.tokens = min(self.capacity, self.tokens + new_tokens)
        self.last_update = now
    
    def consume(self, tokens: int = 1) -> bool:
        """
        Intenta consumir tokens del bucket
        
        Args:
            tokens: Número de tokens a consumir
            
        Returns:
            True si se pudieron consumir los tokens, False si no hay suficientes
        """
        with self._lock:
            self._refill()
            
            if self.tokens >= tokens:
                self.tokens -= tokens
                return True
            return False
    
    def wait_for_token(self, tokens: int = 1, timeout: Optional[float] = None):
        """
        Espera hasta que haya tokens disponibles
        
        Args:
            tokens: Número de tokens a esperar
            timeout: Tiempo máximo de espera en segundos (None = sin límite)
            
        Raises:
            TimeoutError: Si se excede el timeout
        """
        start_time = time.time()
        
        while True:
            if self.consume(tokens):
                return
            
            # Verificar timeout
            if timeout is not None:
                elapsed = time.time() - start_time
                if elapsed >= timeout:
                    raise TimeoutError(f"Rate limiter timeout after {timeout}s")
            
            # Esperar un poco antes de reintentar
            time.sleep(0.01)  # 10ms
    
    def get_available_tokens(self) -> float:
        """Retorna el número de tokens disponibles actualmente"""
        with self._lock:
            self._refill()
            return self.tokens

class RateLimiterManager:
    """
    Gestor centralizado de rate limiters para múltiples APIs
    """
    
    # Configuraciones predeterminadas
    DEFAULT_CONFIGS = {
        'defillama': RateLimitConfig('DefiLlama', max_requests=10, period_seconds=1.0),
        'publicnodes': RateLimitConfig('Publicnodes', max_requests=5, period_seconds=1.0),
        'llamanodes': RateLimitConfig('Llamanodes', max_requests=5, period_seconds=1.0),
        'default': RateLimitConfig('Default', max_requests=10, period_seconds=1.0)
    }
    
    def __init__(self):
        """Inicializa el gestor de rate limiters"""
        self._limiters: Dict[str, TokenBucket] = {}
        self._configs: Dict[str, RateLimitConfig] = {}
        self._lock = threading.Lock()
        
        # Inicializar con configuraciones predeterminadas
        for api_name, config in self.DEFAULT_CONFIGS.items():
            self.add_limiter(api_name, config)
        
        logger.info("RateLimiterManager inicializado")
        logger.info(f"APIs configuradas: {', '.join(self._configs.keys())}")
    
    def add_limiter(self, api_name: str, config: RateLimitConfig):
        """
        Agrega un rate limiter para una API
        
        Args:
            api_name: Nombre de la API
            config: Configuración de rate limiting
        """
        with self._lock:
            bucket = TokenBucket(
                rate=config.requests_per_second,
                capacity=config.max_requests
            )
            self._limiters[api_name] = bucket
            self._configs[api_name] = config
            
            logger.info(f"Rate limiter agregado: {api_name} ({config.requests_per_second:.1f} req/s)")
    
    def acquire(self, api_name: str, timeout: Optional[float] = 5.0) -> bool:
        """
        Adquiere permiso para hacer una petición a una API
        
        Args:
            api_name: Nombre de la API
            timeout: Tiempo máximo de espera en segundos
            
        Returns:
            True si se adquirió el permiso
            
        Raises:
            TimeoutError: Si se excede el timeout
        """
        limiter = self._limiters.get(api_name) or self._limiters.get('default')
        
        try:
            limiter.wait_for_token(tokens=1, timeout=timeout)
            logger.debug(f"Rate limit OK: {api_name}")
            return True
        except TimeoutError:
            logger.warning(f"Rate limit timeout: {api_name}")
            raise
    
    def try_acquire(self, api_name: str) -> bool:
        """
        Intenta adquirir permiso sin esperar
        
        Args:
            api_name: Nombre de la API
            
        Returns:
            True si se adquirió el permiso, False si no hay tokens disponibles
        """
        limiter = self._limiters.get(api_name) or self._limiters.get('default')
        return limiter.consume(1)
    
    def get_status(self, api_name: str) -> Dict[str, any]:
        """
        Obtiene el estado actual de un rate limiter
        
        Args:
            api_name: Nombre de la API
            
        Returns:
            Diccionario con información del estado
        """
        limiter = self._limiters.get(api_name)
        config = self._configs.get(api_name)
        
        if not limiter or not config:
            return {'error': f'API {api_name} not found'}
        
        return {
            'api': api_name,
            'rate': config.requests_per_second,
            'capacity': config.max_requests,
            'available_tokens': limiter.get_available_tokens(),
            'utilization': 1 - (limiter.get_available_tokens() / config.max_requests)
        }
    
    def get_all_status(self) -> Dict[str, Dict[str, any]]:
        """
        Obtiene el estado de todos los rate limiters
        
        Returns:
            Diccionario con estado de todas las APIs
        """
        return {
            api_name: self.get_status(api_name)
            for api_name in self._configs.keys()
            if api_name != 'default'
        }

# Singleton
_manager_instance = None

def get_rate_limiter_manager() -> RateLimiterManager:
    """Retorna instancia singleton del gestor"""
    global _manager_instance
    if _manager_instance is None:
        _manager_instance = RateLimiterManager()
    return _manager_instance

