"""
APE Guardian Engine v15 - Session Manager
==========================================
Gestión centralizada de sesiones de usuario.
"""

import time
import logging
import threading
from typing import Dict, Optional, Any
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

@dataclass
class Session:
    """Representa una sesión de usuario activa."""
    session_id: str
    user_id: str
    client_ip: str
    jwt_payload: Dict[str, Any]
    abr_enabled: bool
    current_profile_id: str
    created_at: float
    last_activity: float
    
    # Métricas de la sesión
    requests_count: int = 0
    bytes_transferred: int = 0
    errors_count: int = 0
    profile_changes: int = 0
    
    # Estado del ABR
    current_bitrate_mbps: float = 0.0
    buffer_level_ms: float = 0.0
    stability_score: float = 1.0
    
    # Información de red
    network_info: Dict[str, Any] = field(default_factory=dict)
    
    def update_activity(self):
        """Actualiza el timestamp de última actividad."""
        self.last_activity = time.time()
        self.requests_count += 1
    
    def is_expired(self, timeout_seconds: int = 3600) -> bool:
        """Verifica si la sesión ha expirado."""
        return time.time() - self.last_activity > timeout_seconds
    
    def to_dict(self) -> Dict[str, Any]:
        """Convierte la sesión a diccionario."""
        return {
            'session_id': self.session_id,
            'user_id': self.user_id,
            'client_ip': self.client_ip,
            'abr_enabled': self.abr_enabled,
            'current_profile_id': self.current_profile_id,
            'created_at': self.created_at,
            'last_activity': self.last_activity,
            'requests_count': self.requests_count,
            'bytes_transferred': self.bytes_transferred,
            'errors_count': self.errors_count,
            'profile_changes': self.profile_changes,
            'current_bitrate_mbps': self.current_bitrate_mbps,
            'buffer_level_ms': self.buffer_level_ms,
            'stability_score': self.stability_score,
            'uptime_seconds': time.time() - self.created_at,
        }


class SessionManager:
    """
    Gestor centralizado de sesiones.
    
    Responsabilidades:
    - Crear, obtener y eliminar sesiones
    - Limpiar sesiones expiradas automáticamente
    - Mantener estadísticas de sesiones
    """
    
    def __init__(self, session_timeout: int = 3600, cleanup_interval: int = 300):
        """
        Inicializa el gestor de sesiones.
        
        Args:
            session_timeout: Tiempo de expiración de sesiones en segundos
            cleanup_interval: Intervalo de limpieza automática en segundos
        """
        self.session_timeout = session_timeout
        self.cleanup_interval = cleanup_interval
        self._sessions: Dict[str, Session] = {}
        self._lock = threading.Lock()
        
        # Iniciar limpieza automática
        self._cleanup_thread = threading.Thread(target=self._cleanup_loop, daemon=True)
        self._cleanup_thread.start()
        
        logger.info(f"Session Manager initialized (timeout={session_timeout}s, cleanup={cleanup_interval}s)")
    
    def create_session(
        self,
        session_id: str,
        user_id: str,
        client_ip: str,
        jwt_payload: Dict[str, Any],
        network_info: Optional[Dict[str, Any]] = None
    ) -> Session:
        """
        Crea una nueva sesión.
        
        Args:
            session_id: ID único de la sesión
            user_id: ID del usuario
            client_ip: IP del cliente
            jwt_payload: Payload del JWT
            network_info: Información de red opcional
            
        Returns:
            Sesión creada
        """
        now = time.time()
        
        session = Session(
            session_id=session_id,
            user_id=user_id,
            client_ip=client_ip,
            jwt_payload=jwt_payload,
            abr_enabled=jwt_payload.get('abr_enabled', True),
            current_profile_id=jwt_payload.get('profile_id', jwt_payload.get('profile', 'P2')),
            created_at=now,
            last_activity=now,
            network_info=network_info or {},
        )
        
        with self._lock:
            self._sessions[session_id] = session
        
        logger.info(f"Session created: {session_id} (user={user_id}, profile={session.current_profile_id})")
        return session
    
    def get_session(self, session_id: str) -> Optional[Session]:
        """
        Obtiene una sesión por ID.
        
        Args:
            session_id: ID de la sesión
            
        Returns:
            Sesión o None si no existe
        """
        with self._lock:
            session = self._sessions.get(session_id)
            if session and not session.is_expired(self.session_timeout):
                session.update_activity()
                return session
            elif session:
                # Sesión expirada, eliminar
                del self._sessions[session_id]
                logger.info(f"Session expired and removed: {session_id}")
        return None
    
    def session_exists(self, session_id: str) -> bool:
        """Verifica si una sesión existe y está activa."""
        return self.get_session(session_id) is not None
    
    def update_session(
        self,
        session_id: str,
        profile_id: Optional[str] = None,
        bitrate_mbps: Optional[float] = None,
        buffer_level_ms: Optional[float] = None,
        stability_score: Optional[float] = None,
        bytes_transferred: Optional[int] = None,
        error: bool = False
    ) -> bool:
        """
        Actualiza una sesión existente.
        
        Args:
            session_id: ID de la sesión
            profile_id: Nuevo perfil (opcional)
            bitrate_mbps: Nuevo bitrate (opcional)
            buffer_level_ms: Nuevo nivel de buffer (opcional)
            stability_score: Nuevo score de estabilidad (opcional)
            bytes_transferred: Bytes transferidos (opcional)
            error: Si hubo un error
            
        Returns:
            True si se actualizó, False si no existe
        """
        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                return False
            
            session.update_activity()
            
            if profile_id and profile_id != session.current_profile_id:
                session.current_profile_id = profile_id
                session.profile_changes += 1
            
            if bitrate_mbps is not None:
                session.current_bitrate_mbps = bitrate_mbps
            
            if buffer_level_ms is not None:
                session.buffer_level_ms = buffer_level_ms
            
            if stability_score is not None:
                session.stability_score = stability_score
            
            if bytes_transferred is not None:
                session.bytes_transferred += bytes_transferred
            
            if error:
                session.errors_count += 1
            
            return True
    
    def delete_session(self, session_id: str) -> bool:
        """
        Elimina una sesión.
        
        Args:
            session_id: ID de la sesión
            
        Returns:
            True si se eliminó, False si no existía
        """
        with self._lock:
            if session_id in self._sessions:
                del self._sessions[session_id]
                logger.info(f"Session deleted: {session_id}")
                return True
        return False
    
    def get_all_sessions(self) -> Dict[str, Dict[str, Any]]:
        """Obtiene todas las sesiones activas."""
        with self._lock:
            return {
                sid: session.to_dict()
                for sid, session in self._sessions.items()
                if not session.is_expired(self.session_timeout)
            }
    
    def get_stats(self) -> Dict[str, Any]:
        """Obtiene estadísticas del gestor de sesiones."""
        with self._lock:
            active_sessions = [
                s for s in self._sessions.values()
                if not s.is_expired(self.session_timeout)
            ]
            
            return {
                'total_sessions': len(active_sessions),
                'total_requests': sum(s.requests_count for s in active_sessions),
                'total_bytes': sum(s.bytes_transferred for s in active_sessions),
                'total_errors': sum(s.errors_count for s in active_sessions),
                'profiles_distribution': self._get_profile_distribution(active_sessions),
                'avg_stability_score': (
                    sum(s.stability_score for s in active_sessions) / len(active_sessions)
                    if active_sessions else 0.0
                ),
            }
    
    def _get_profile_distribution(self, sessions: list) -> Dict[str, int]:
        """Obtiene distribución de perfiles."""
        distribution = {}
        for session in sessions:
            profile = session.current_profile_id
            distribution[profile] = distribution.get(profile, 0) + 1
        return distribution
    
    def _cleanup_loop(self):
        """Loop de limpieza automática de sesiones expiradas."""
        while True:
            time.sleep(self.cleanup_interval)
            self._cleanup_expired_sessions()
    
    def _cleanup_expired_sessions(self):
        """Limpia sesiones expiradas."""
        with self._lock:
            expired = [
                sid for sid, session in self._sessions.items()
                if session.is_expired(self.session_timeout)
            ]
            
            for sid in expired:
                del self._sessions[sid]
            
            if expired:
                logger.info(f"Cleaned up {len(expired)} expired sessions")


# Singleton global
_session_manager: Optional[SessionManager] = None


def get_session_manager() -> SessionManager:
    """Obtiene la instancia global del SessionManager."""
    global _session_manager
    if _session_manager is None:
        _session_manager = SessionManager()
    return _session_manager
