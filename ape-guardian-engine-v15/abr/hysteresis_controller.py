"""
APE Guardian Engine v15 - Hysteresis Controller
================================================
Controlador de histéresis para evitar cambios bruscos de calidad (anti-flapping).
"""

import time
import logging
from typing import Dict, Tuple, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class ProfileChangeRecord:
    """Registro de un cambio de perfil."""
    from_profile: str
    to_profile: str
    timestamp: float
    reason: str
    was_downgrade: bool


class HysteresisController:
    """
    Controlador de histéresis para cambios de perfil ABR.
    
    Principios:
    - Failover (degradación): Inmediato (< 1 segundo)
    - Failback (mejora): Solo después de 60 segundos de estabilidad
    - Evita "quality flapping" (oscilaciones rápidas)
    """
    
    def __init__(
        self,
        failback_stability_seconds: int = 60,
        min_time_between_changes_seconds: int = 5,
        stability_threshold: float = 0.7
    ):
        """
        Inicializa el controlador de histéresis.
        
        Args:
            failback_stability_seconds: Tiempo de estabilidad requerido para mejorar
            min_time_between_changes_seconds: Tiempo mínimo entre cambios
            stability_threshold: Umbral de estabilidad (0-1)
        """
        self.failback_stability_seconds = failback_stability_seconds
        self.min_time_between_changes = min_time_between_changes_seconds
        self.stability_threshold = stability_threshold
        
        # Estado por sesión
        self._session_state: Dict[str, dict] = {}
        
        logger.info(
            f"Hysteresis Controller initialized "
            f"(failback={failback_stability_seconds}s, min_interval={min_time_between_changes_seconds}s)"
        )
    
    def _get_session_state(self, session_id: str) -> dict:
        """Obtiene o crea estado de sesión."""
        if session_id not in self._session_state:
            self._session_state[session_id] = {
                'current_profile': None,
                'last_change_time': 0,
                'last_downgrade_time': 0,
                'stable_since': time.time(),
                'change_history': [],
                'consecutive_stable_checks': 0,
            }
        return self._session_state[session_id]
    
    def should_allow_change(
        self,
        session_id: str,
        new_profile_id: str,
        is_network_stable: bool
    ) -> Tuple[bool, str]:
        """
        Determina si se debe permitir un cambio de perfil.
        
        Args:
            session_id: ID de la sesión
            new_profile_id: ID del nuevo perfil propuesto
            is_network_stable: Si la red está estable actualmente
            
        Returns:
            Tuple de (permitir_cambio, razón)
        """
        state = self._get_session_state(session_id)
        now = time.time()
        current_profile = state['current_profile']
        
        # Primera vez - siempre permitir
        if current_profile is None:
            state['current_profile'] = new_profile_id
            state['last_change_time'] = now
            state['stable_since'] = now
            return True, "Initial profile assignment"
        
        # Sin cambio necesario
        if new_profile_id == current_profile:
            # Actualizar estabilidad
            if is_network_stable:
                state['consecutive_stable_checks'] += 1
            else:
                state['consecutive_stable_checks'] = 0
                state['stable_since'] = now
            return False, "No change needed"
        
        # Determinar si es upgrade o downgrade
        is_downgrade = self._is_downgrade(current_profile, new_profile_id)
        
        # FAILOVER (downgrade): Permitir inmediatamente
        if is_downgrade:
            # Verificar tiempo mínimo entre cambios (evitar flapping extremo)
            time_since_last = now - state['last_change_time']
            if time_since_last < 1.0:  # Mínimo 1 segundo entre downgrades
                return False, f"Too soon since last change ({time_since_last:.1f}s < 1s)"
            
            # Permitir downgrade
            self._record_change(state, current_profile, new_profile_id, "failover", True)
            state['current_profile'] = new_profile_id
            state['last_change_time'] = now
            state['last_downgrade_time'] = now
            state['stable_since'] = now
            state['consecutive_stable_checks'] = 0
            
            logger.info(f"Session {session_id}: FAILOVER {current_profile} -> {new_profile_id}")
            return True, "Failover (immediate downgrade)"
        
        # FAILBACK (upgrade): Requiere estabilidad sostenida
        else:
            # Verificar tiempo desde último downgrade
            time_since_downgrade = now - state['last_downgrade_time']
            if time_since_downgrade < self.failback_stability_seconds:
                remaining = self.failback_stability_seconds - time_since_downgrade
                return False, f"Waiting for stability ({remaining:.0f}s remaining)"
            
            # Verificar estabilidad actual
            if not is_network_stable:
                state['stable_since'] = now
                state['consecutive_stable_checks'] = 0
                return False, "Network not stable"
            
            # Verificar tiempo de estabilidad
            stable_duration = now - state['stable_since']
            if stable_duration < self.failback_stability_seconds:
                remaining = self.failback_stability_seconds - stable_duration
                return False, f"Stability period not met ({remaining:.0f}s remaining)"
            
            # Verificar checks consecutivos de estabilidad
            if state['consecutive_stable_checks'] < 6:  # Al menos 6 checks estables
                return False, f"Need more stable checks ({state['consecutive_stable_checks']}/6)"
            
            # Permitir upgrade
            self._record_change(state, current_profile, new_profile_id, "failback", False)
            state['current_profile'] = new_profile_id
            state['last_change_time'] = now
            state['consecutive_stable_checks'] = 0
            
            logger.info(f"Session {session_id}: FAILBACK {current_profile} -> {new_profile_id}")
            return True, "Failback (stable upgrade)"
    
    def _is_downgrade(self, from_profile: str, to_profile: str) -> bool:
        """Determina si un cambio es un downgrade."""
        # Los perfiles van de P0 (mejor) a P5 (peor)
        # Mayor número = peor calidad = downgrade
        try:
            from_num = int(from_profile.replace('P', ''))
            to_num = int(to_profile.replace('P', ''))
            return to_num > from_num
        except (ValueError, AttributeError):
            return False
    
    def _record_change(
        self,
        state: dict,
        from_profile: str,
        to_profile: str,
        reason: str,
        was_downgrade: bool
    ):
        """Registra un cambio de perfil."""
        record = ProfileChangeRecord(
            from_profile=from_profile,
            to_profile=to_profile,
            timestamp=time.time(),
            reason=reason,
            was_downgrade=was_downgrade
        )
        
        # Mantener solo los últimos 100 cambios
        state['change_history'].append(record)
        if len(state['change_history']) > 100:
            state['change_history'] = state['change_history'][-100:]
    
    def force_profile(self, session_id: str, profile_id: str):
        """Fuerza un perfil específico (bypass de histéresis)."""
        state = self._get_session_state(session_id)
        old_profile = state['current_profile']
        
        state['current_profile'] = profile_id
        state['last_change_time'] = time.time()
        state['stable_since'] = time.time()
        
        if old_profile:
            self._record_change(state, old_profile, profile_id, "forced", False)
        
        logger.info(f"Session {session_id}: FORCED profile to {profile_id}")
    
    def get_current_profile(self, session_id: str) -> Optional[str]:
        """Obtiene el perfil actual de una sesión."""
        state = self._get_session_state(session_id)
        return state['current_profile']
    
    def get_session_stats(self, session_id: str) -> Dict:
        """Obtiene estadísticas de una sesión."""
        state = self._get_session_state(session_id)
        now = time.time()
        
        history = state['change_history']
        downgrades = sum(1 for r in history if r.was_downgrade)
        upgrades = len(history) - downgrades
        
        return {
            'current_profile': state['current_profile'],
            'last_change_time': state['last_change_time'],
            'time_since_last_change': now - state['last_change_time'] if state['last_change_time'] else 0,
            'stable_duration': now - state['stable_since'],
            'consecutive_stable_checks': state['consecutive_stable_checks'],
            'total_changes': len(history),
            'total_downgrades': downgrades,
            'total_upgrades': upgrades,
        }
    
    def cleanup_session(self, session_id: str):
        """Limpia el estado de una sesión."""
        if session_id in self._session_state:
            del self._session_state[session_id]
            logger.debug(f"Cleaned up hysteresis state for session: {session_id}")
