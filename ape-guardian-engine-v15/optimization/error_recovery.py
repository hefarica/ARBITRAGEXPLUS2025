"""
APE Guardian Engine v15 - Error Recovery Engine
================================================
Motor de recuperación de errores HTTP con estrategias específicas para 43 códigos.
"""

import time
import logging
import random
from typing import Dict, Tuple, Optional, Any, Callable
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class RecoveryAction(Enum):
    """Acciones de recuperación posibles."""
    RETRY = "retry"
    RETRY_WITH_BACKOFF = "retry_with_backoff"
    REFRESH_TOKEN = "refresh_token"
    ROTATE_HEADERS = "rotate_headers"
    CDN_FALLBACK = "cdn_fallback"
    REDUCE_QUALITY = "reduce_quality"
    ABORT = "abort"
    WAIT_AND_RETRY = "wait_and_retry"
    FOLLOW_REDIRECT = "follow_redirect"


@dataclass
class ErrorStrategy:
    """Estrategia de recuperación para un código HTTP."""
    code: int
    name: str
    action: RecoveryAction
    max_retries: int
    initial_delay_ms: int
    backoff_multiplier: float
    is_retryable: bool
    description: str


class ErrorRecoveryEngine:
    """
    Motor de recuperación de errores HTTP.
    
    Implementa estrategias específicas para 43 códigos HTTP que pueden
    afectar la reproducción de streams HLS/M3U8.
    """
    
    # Estrategias para cada código HTTP
    ERROR_STRATEGIES: Dict[int, ErrorStrategy] = {
        # === REDIRECTS (3xx) - Seguir redirect ===
        301: ErrorStrategy(301, "Moved Permanently", RecoveryAction.FOLLOW_REDIRECT, 5, 0, 1.0, True, "Seguir redirect permanente"),
        302: ErrorStrategy(302, "Found", RecoveryAction.FOLLOW_REDIRECT, 5, 0, 1.0, True, "Seguir redirect temporal"),
        307: ErrorStrategy(307, "Temporary Redirect", RecoveryAction.FOLLOW_REDIRECT, 5, 0, 1.0, True, "Seguir redirect temporal"),
        308: ErrorStrategy(308, "Permanent Redirect", RecoveryAction.FOLLOW_REDIRECT, 5, 0, 1.0, True, "Seguir redirect permanente"),
        
        # === CLIENT ERRORS (4xx) ===
        400: ErrorStrategy(400, "Bad Request", RecoveryAction.ABORT, 0, 0, 1.0, False, "Request malformado, no reintentar"),
        401: ErrorStrategy(401, "Unauthorized", RecoveryAction.REFRESH_TOKEN, 3, 500, 2.0, True, "Refrescar token de autenticación"),
        402: ErrorStrategy(402, "Payment Required", RecoveryAction.ABORT, 0, 0, 1.0, False, "Pago requerido, no reintentar"),
        403: ErrorStrategy(403, "Forbidden", RecoveryAction.ROTATE_HEADERS, 5, 1000, 1.5, True, "Rotar User-Agent y headers"),
        404: ErrorStrategy(404, "Not Found", RecoveryAction.RETRY, 2, 500, 2.0, True, "Reintentar (puede ser temporal en live)"),
        405: ErrorStrategy(405, "Method Not Allowed", RecoveryAction.ABORT, 0, 0, 1.0, False, "Método no permitido"),
        406: ErrorStrategy(406, "Not Acceptable", RecoveryAction.ROTATE_HEADERS, 3, 500, 1.5, True, "Cambiar Accept headers"),
        407: ErrorStrategy(407, "Proxy Auth Required", RecoveryAction.ABORT, 0, 0, 1.0, False, "Autenticación de proxy requerida"),
        408: ErrorStrategy(408, "Request Timeout", RecoveryAction.RETRY_WITH_BACKOFF, 5, 1000, 2.0, True, "Timeout, reintentar con backoff"),
        409: ErrorStrategy(409, "Conflict", RecoveryAction.RETRY_WITH_BACKOFF, 3, 1000, 2.0, True, "Conflicto, reintentar"),
        410: ErrorStrategy(410, "Gone", RecoveryAction.ABORT, 0, 0, 1.0, False, "Recurso eliminado permanentemente"),
        411: ErrorStrategy(411, "Length Required", RecoveryAction.ABORT, 0, 0, 1.0, False, "Content-Length requerido"),
        412: ErrorStrategy(412, "Precondition Failed", RecoveryAction.RETRY, 2, 500, 1.5, True, "Precondición fallida"),
        415: ErrorStrategy(415, "Unsupported Media Type", RecoveryAction.ABORT, 0, 0, 1.0, False, "Tipo de media no soportado"),
        416: ErrorStrategy(416, "Range Not Satisfiable", RecoveryAction.RETRY, 2, 500, 1.5, True, "Rango no satisfacible"),
        417: ErrorStrategy(417, "Expectation Failed", RecoveryAction.RETRY, 2, 500, 1.5, True, "Expectativa fallida"),
        421: ErrorStrategy(421, "Misdirected Request", RecoveryAction.CDN_FALLBACK, 3, 1000, 2.0, True, "Cambiar a otro CDN"),
        422: ErrorStrategy(422, "Unprocessable Entity", RecoveryAction.ABORT, 0, 0, 1.0, False, "Entidad no procesable"),
        423: ErrorStrategy(423, "Locked", RecoveryAction.WAIT_AND_RETRY, 5, 2000, 2.0, True, "Recurso bloqueado, esperar"),
        424: ErrorStrategy(424, "Failed Dependency", RecoveryAction.RETRY_WITH_BACKOFF, 3, 1000, 2.0, True, "Dependencia fallida"),
        425: ErrorStrategy(425, "Too Early", RecoveryAction.WAIT_AND_RETRY, 3, 1000, 1.5, True, "Muy temprano, esperar"),
        426: ErrorStrategy(426, "Upgrade Required", RecoveryAction.ABORT, 0, 0, 1.0, False, "Upgrade de protocolo requerido"),
        428: ErrorStrategy(428, "Precondition Required", RecoveryAction.RETRY, 2, 500, 1.5, True, "Precondición requerida"),
        429: ErrorStrategy(429, "Too Many Requests", RecoveryAction.WAIT_AND_RETRY, 15, 5000, 2.0, True, "Rate limit, respetar Retry-After"),
        431: ErrorStrategy(431, "Headers Too Large", RecoveryAction.ABORT, 0, 0, 1.0, False, "Headers muy grandes"),
        451: ErrorStrategy(451, "Unavailable For Legal Reasons", RecoveryAction.ROTATE_HEADERS, 3, 1000, 1.5, True, "Bloqueo legal, intentar evasión"),
        
        # === SERVER ERRORS (5xx) ===
        500: ErrorStrategy(500, "Internal Server Error", RecoveryAction.RETRY_WITH_BACKOFF, 10, 1000, 2.0, True, "Error interno, reintentar"),
        501: ErrorStrategy(501, "Not Implemented", RecoveryAction.ABORT, 0, 0, 1.0, False, "No implementado"),
        502: ErrorStrategy(502, "Bad Gateway", RecoveryAction.CDN_FALLBACK, 10, 1000, 2.0, True, "Gateway malo, cambiar CDN"),
        503: ErrorStrategy(503, "Service Unavailable", RecoveryAction.WAIT_AND_RETRY, 10, 2000, 2.0, True, "Servicio no disponible, esperar"),
        504: ErrorStrategy(504, "Gateway Timeout", RecoveryAction.CDN_FALLBACK, 10, 1000, 2.0, True, "Timeout de gateway, cambiar CDN"),
        505: ErrorStrategy(505, "HTTP Version Not Supported", RecoveryAction.ABORT, 0, 0, 1.0, False, "Versión HTTP no soportada"),
        506: ErrorStrategy(506, "Variant Also Negotiates", RecoveryAction.ABORT, 0, 0, 1.0, False, "Error de negociación"),
        507: ErrorStrategy(507, "Insufficient Storage", RecoveryAction.ABORT, 0, 0, 1.0, False, "Almacenamiento insuficiente"),
        508: ErrorStrategy(508, "Loop Detected", RecoveryAction.ABORT, 0, 0, 1.0, False, "Loop detectado"),
        510: ErrorStrategy(510, "Not Extended", RecoveryAction.ABORT, 0, 0, 1.0, False, "Extensión requerida"),
        511: ErrorStrategy(511, "Network Auth Required", RecoveryAction.ABORT, 0, 0, 1.0, False, "Autenticación de red requerida"),
    }
    
    # User-Agents para rotación
    USER_AGENTS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "ExoPlayer/2.19.0 (Linux; Android 13)",
        "VLC/3.0.18 LibVLC/3.0.18",
        "Lavf/60.3.100",
    ]
    
    def __init__(self):
        """Inicializa el motor de recuperación de errores."""
        # Estado de reintentos por sesión
        self._retry_state: Dict[str, Dict[int, dict]] = {}
        
        logger.info(f"Error Recovery Engine initialized with {len(self.ERROR_STRATEGIES)} strategies")
    
    def _get_retry_state(self, session_id: str, error_code: int) -> dict:
        """Obtiene o crea estado de reintentos."""
        if session_id not in self._retry_state:
            self._retry_state[session_id] = {}
        if error_code not in self._retry_state[session_id]:
            self._retry_state[session_id][error_code] = {
                'attempts': 0,
                'last_attempt': 0,
                'current_delay': 0,
                'ua_index': 0,
            }
        return self._retry_state[session_id][error_code]
    
    def handle_error(
        self,
        session_id: str,
        error_code: int,
        retry_after: Optional[int] = None
    ) -> Tuple[RecoveryAction, Dict[str, Any]]:
        """
        Maneja un error HTTP y retorna la acción de recuperación.
        
        Args:
            session_id: ID de la sesión
            error_code: Código de error HTTP
            retry_after: Valor del header Retry-After (si existe)
            
        Returns:
            Tuple de (acción, parámetros)
        """
        strategy = self.ERROR_STRATEGIES.get(error_code)
        
        if not strategy:
            logger.warning(f"Unknown error code: {error_code}, using default strategy")
            return RecoveryAction.ABORT, {'reason': 'Unknown error code'}
        
        state = self._get_retry_state(session_id, error_code)
        state['attempts'] += 1
        state['last_attempt'] = time.time()
        
        # Verificar si excedimos reintentos
        if state['attempts'] > strategy.max_retries:
            logger.warning(
                f"Session {session_id}: Max retries exceeded for {error_code} "
                f"({state['attempts']}/{strategy.max_retries})"
            )
            return RecoveryAction.ABORT, {
                'reason': f"Max retries exceeded ({strategy.max_retries})",
                'error_code': error_code,
                'error_name': strategy.name,
            }
        
        # Calcular delay
        if strategy.action == RecoveryAction.WAIT_AND_RETRY and retry_after:
            delay_ms = retry_after * 1000
        else:
            delay_ms = int(strategy.initial_delay_ms * (strategy.backoff_multiplier ** (state['attempts'] - 1)))
        
        state['current_delay'] = delay_ms
        
        # Preparar parámetros según la acción
        params = {
            'error_code': error_code,
            'error_name': strategy.name,
            'attempt': state['attempts'],
            'max_retries': strategy.max_retries,
            'delay_ms': delay_ms,
            'description': strategy.description,
        }
        
        # Acciones específicas
        if strategy.action == RecoveryAction.ROTATE_HEADERS:
            state['ua_index'] = (state['ua_index'] + 1) % len(self.USER_AGENTS)
            params['new_user_agent'] = self.USER_AGENTS[state['ua_index']]
            params['new_headers'] = self._generate_rotated_headers(state['ua_index'])
        
        elif strategy.action == RecoveryAction.CDN_FALLBACK:
            params['should_switch_cdn'] = True
        
        elif strategy.action == RecoveryAction.REDUCE_QUALITY:
            params['should_reduce_quality'] = True
        
        logger.info(
            f"Session {session_id}: Error {error_code} ({strategy.name}) - "
            f"Action: {strategy.action.value}, Attempt: {state['attempts']}/{strategy.max_retries}, "
            f"Delay: {delay_ms}ms"
        )
        
        return strategy.action, params
    
    def _generate_rotated_headers(self, ua_index: int) -> Dict[str, str]:
        """Genera headers rotados para evasión."""
        ua = self.USER_AGENTS[ua_index]
        
        # Determinar tipo de UA
        is_mobile = 'Mobile' in ua or 'iPhone' in ua or 'Android' in ua
        is_safari = 'Safari' in ua and 'Chrome' not in ua
        
        headers = {
            'User-Agent': ua,
            'Accept': '*/*',
            'Accept-Language': random.choice(['en-US,en;q=0.9', 'es-ES,es;q=0.9', 'en-GB,en;q=0.9']),
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
        }
        
        if not is_mobile:
            headers['Sec-Fetch-Dest'] = 'empty'
            headers['Sec-Fetch-Mode'] = 'cors'
            headers['Sec-Fetch-Site'] = 'cross-site'
        
        return headers
    
    def reset_retry_state(self, session_id: str, error_code: Optional[int] = None):
        """Resetea el estado de reintentos."""
        if session_id in self._retry_state:
            if error_code:
                if error_code in self._retry_state[session_id]:
                    del self._retry_state[session_id][error_code]
            else:
                del self._retry_state[session_id]
    
    def get_strategy(self, error_code: int) -> Optional[ErrorStrategy]:
        """Obtiene la estrategia para un código de error."""
        return self.ERROR_STRATEGIES.get(error_code)
    
    def is_retryable(self, error_code: int) -> bool:
        """Verifica si un error es reintentable."""
        strategy = self.ERROR_STRATEGIES.get(error_code)
        return strategy.is_retryable if strategy else False
    
    def get_all_strategies(self) -> Dict[int, Dict[str, Any]]:
        """Obtiene todas las estrategias como diccionario."""
        return {
            code: {
                'name': s.name,
                'action': s.action.value,
                'max_retries': s.max_retries,
                'is_retryable': s.is_retryable,
                'description': s.description,
            }
            for code, s in self.ERROR_STRATEGIES.items()
        }
    
    def get_session_error_stats(self, session_id: str) -> Dict[str, Any]:
        """Obtiene estadísticas de errores de una sesión."""
        if session_id not in self._retry_state:
            return {'total_errors': 0, 'errors': {}}
        
        errors = self._retry_state[session_id]
        return {
            'total_errors': sum(e['attempts'] for e in errors.values()),
            'errors': {
                code: {
                    'attempts': state['attempts'],
                    'last_attempt': state['last_attempt'],
                    'current_delay': state['current_delay'],
                }
                for code, state in errors.items()
            }
        }
    
    def cleanup_session(self, session_id: str):
        """Limpia estado de una sesión."""
        if session_id in self._retry_state:
            del self._retry_state[session_id]
            logger.debug(f"Cleaned up error recovery state for session: {session_id}")
