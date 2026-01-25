"""
APE Guardian Engine v15 - JWT Validator
========================================
Validación y gestión de tokens JWT para autenticación y configuración ABR.
"""

import jwt
import time
import hashlib
import logging
from typing import Dict, Optional, Tuple, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class JWTPayload:
    """Estructura del payload JWT validado."""
    user_id: str
    list_id: str
    profile: str
    abr_enabled: bool
    max_bitrate_mbps: float
    min_bitrate_mbps: float
    screen_resolution: str
    player_capability: str
    issued_at: int
    expires_at: int
    raw_payload: Dict[str, Any]


class JWTValidator:
    """
    Validador de tokens JWT para el Guardian Engine.
    
    Responsabilidades:
    - Validar firma y expiración de tokens
    - Extraer configuración ABR del payload
    - Generar session_id único basado en JWT
    """
    
    def __init__(self, secret_key: str, algorithm: str = 'HS256'):
        """
        Inicializa el validador JWT.
        
        Args:
            secret_key: Clave secreta para verificar firma
            algorithm: Algoritmo de firma (default: HS256)
        """
        self.secret_key = secret_key
        self.algorithm = algorithm
        self._cache: Dict[str, Tuple[float, JWTPayload]] = {}
        self._cache_ttl = 300  # 5 minutos
        
        logger.info(f"JWT Validator initialized with algorithm: {algorithm}")
    
    def validate_token(self, token: str) -> Tuple[bool, Optional[Dict], Optional[str]]:
        """
        Valida un token JWT.
        
        Args:
            token: Token JWT a validar
            
        Returns:
            Tuple de (is_valid, payload_dict, error_message)
        """
        if not token:
            return False, None, "Token is empty"
        
        # Verificar cache
        cache_key = hashlib.md5(token.encode()).hexdigest()
        if cache_key in self._cache:
            cached_time, cached_payload = self._cache[cache_key]
            if time.time() - cached_time < self._cache_ttl:
                return True, cached_payload.raw_payload, None
        
        try:
            # Decodificar y verificar token
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm],
                options={'verify_exp': True}
            )
            
            # Validar campos requeridos
            if 'user_id' not in payload:
                return False, None, "Missing required field: user_id"
            
            # Crear payload estructurado con valores por defecto
            jwt_payload = JWTPayload(
                user_id=payload.get('user_id', 'anonymous'),
                list_id=payload.get('list_id', 'default'),
                profile=payload.get('profile', 'P2'),
                abr_enabled=payload.get('abr_enabled', True),
                max_bitrate_mbps=float(payload.get('max_bitrate_mbps', 30.0)),
                min_bitrate_mbps=float(payload.get('min_bitrate_mbps', 0.5)),
                screen_resolution=payload.get('screen_resolution', '1080p'),
                player_capability=payload.get('player_capability', 'high'),
                issued_at=payload.get('iat', int(time.time())),
                expires_at=payload.get('exp', int(time.time()) + 86400),
                raw_payload=payload
            )
            
            # Guardar en cache
            self._cache[cache_key] = (time.time(), jwt_payload)
            
            logger.debug(f"JWT validated successfully for user: {jwt_payload.user_id}")
            return True, payload, None
            
        except jwt.ExpiredSignatureError:
            return False, None, "Token has expired"
        except jwt.InvalidTokenError as e:
            return False, None, f"Invalid token: {str(e)}"
        except Exception as e:
            logger.error(f"JWT validation error: {e}")
            return False, None, f"Validation error: {str(e)}"
    
    def generate_session_id(self, token: str, client_ip: str) -> str:
        """
        Genera un session_id único basado en el token y la IP del cliente.
        
        Args:
            token: Token JWT
            client_ip: IP del cliente
            
        Returns:
            Session ID único
        """
        data = f"{token}:{client_ip}:{time.time()}"
        return f"session_{hashlib.md5(data.encode()).hexdigest()[:16]}"
    
    def get_payload_structured(self, token: str) -> Optional[JWTPayload]:
        """
        Obtiene el payload estructurado de un token.
        
        Args:
            token: Token JWT
            
        Returns:
            JWTPayload estructurado o None si inválido
        """
        is_valid, payload, _ = self.validate_token(token)
        if not is_valid or not payload:
            return None
        
        return JWTPayload(
            user_id=payload.get('user_id', 'anonymous'),
            list_id=payload.get('list_id', 'default'),
            profile=payload.get('profile', 'P2'),
            abr_enabled=payload.get('abr_enabled', True),
            max_bitrate_mbps=float(payload.get('max_bitrate_mbps', 30.0)),
            min_bitrate_mbps=float(payload.get('min_bitrate_mbps', 0.5)),
            screen_resolution=payload.get('screen_resolution', '1080p'),
            player_capability=payload.get('player_capability', 'high'),
            issued_at=payload.get('iat', int(time.time())),
            expires_at=payload.get('exp', int(time.time()) + 86400),
            raw_payload=payload
        )
    
    def clear_cache(self):
        """Limpia el cache de tokens."""
        self._cache.clear()
        logger.info("JWT cache cleared")


# Singleton global
_jwt_validator: Optional[JWTValidator] = None


def init_jwt_validator(secret_key: str, algorithm: str = 'HS256') -> JWTValidator:
    """Inicializa el validador JWT global."""
    global _jwt_validator
    _jwt_validator = JWTValidator(secret_key, algorithm)
    return _jwt_validator


def get_jwt_validator() -> JWTValidator:
    """Obtiene el validador JWT global."""
    global _jwt_validator
    if _jwt_validator is None:
        raise RuntimeError("JWT Validator not initialized. Call init_jwt_validator first.")
    return _jwt_validator
