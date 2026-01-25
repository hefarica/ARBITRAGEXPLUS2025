"""
APE Guardian Engine v15 - ARBITER+ Algorithm
=============================================
Selector de bitrate óptimo basado en 7 factores simultáneos.
"""

import logging
from typing import Dict, Optional, Any, List
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class ProfileConfig:
    """Configuración de un perfil ABR."""
    id: str
    name: str
    max_bitrate_mbps: float
    min_bitrate_mbps: float
    target_buffer_ms: int
    max_buffer_ms: int
    parallel_segments: int
    prefetch_segments: int
    priority: int


class ArbiterPlus:
    """
    ARBITER+ - Selector de bitrate óptimo.
    
    Utiliza 7 factores simultáneos para determinar el perfil óptimo:
    1. Throughput predicho (GRU)
    2. Nivel de buffer actual
    3. Resolución de pantalla del usuario
    4. Capacidad del reproductor
    5. RTT del servidor
    6. Packet loss
    7. Score de estabilidad de red
    """
    
    # Pesos de los factores (suman 1.0)
    FACTOR_WEIGHTS = {
        'throughput': 0.30,
        'buffer': 0.20,
        'screen': 0.10,
        'player': 0.10,
        'rtt': 0.10,
        'packet_loss': 0.10,
        'stability': 0.10,
    }
    
    # Mapeo de resolución a bitrate mínimo recomendado
    RESOLUTION_BITRATE = {
        '8k': 40.0,
        '4k': 15.0,
        '2k': 8.0,
        '1080p': 5.0,
        '720p': 2.5,
        '480p': 1.0,
        '360p': 0.5,
    }
    
    # Mapeo de capacidad del player a multiplicador
    PLAYER_CAPABILITY = {
        'ultra': 1.5,
        'high': 1.0,
        'medium': 0.7,
        'low': 0.5,
    }
    
    def __init__(self, profiles: Dict[str, Dict[str, Any]]):
        """
        Inicializa ARBITER+.
        
        Args:
            profiles: Diccionario de perfiles ABR
        """
        self.profiles = self._parse_profiles(profiles)
        self._profile_list = sorted(
            self.profiles.values(),
            key=lambda p: p.max_bitrate_mbps,
            reverse=True
        )
        
        logger.info(f"ARBITER+ initialized with {len(self.profiles)} profiles")
    
    def _parse_profiles(self, profiles: Dict) -> Dict[str, ProfileConfig]:
        """Parsea configuración de perfiles."""
        parsed = {}
        for pid, config in profiles.items():
            parsed[pid] = ProfileConfig(
                id=pid,
                name=config.get('name', pid),
                max_bitrate_mbps=config.get('max_bitrate_mbps', 10.0),
                min_bitrate_mbps=config.get('min_bitrate_mbps', 1.0),
                target_buffer_ms=config.get('target_buffer_ms', 5000),
                max_buffer_ms=config.get('max_buffer_ms', 15000),
                parallel_segments=config.get('parallel_segments', 4),
                prefetch_segments=config.get('prefetch_segments', 3),
                priority=config.get('priority', 5),
            )
        return parsed
    
    def select_optimal_profile(
        self,
        predicted_throughput_mbps: float,
        buffer_level_ms: float,
        screen_resolution: str = '1080p',
        player_capability: str = 'high',
        server_rtt_ms: float = 50.0,
        packet_loss_pct: float = 0.0,
        stability_score: float = 1.0,
        current_profile_id: Optional[str] = None,
        max_bitrate_mbps: float = 30.0,
        min_bitrate_mbps: float = 0.5
    ) -> ProfileConfig:
        """
        Selecciona el perfil óptimo basado en 7 factores.
        
        Args:
            predicted_throughput_mbps: Throughput predicho por GRU
            buffer_level_ms: Nivel actual del buffer en ms
            screen_resolution: Resolución de pantalla del usuario
            player_capability: Capacidad del reproductor
            server_rtt_ms: RTT al servidor en ms
            packet_loss_pct: Porcentaje de packet loss
            stability_score: Score de estabilidad (0-1)
            current_profile_id: Perfil actual (para hysteresis)
            max_bitrate_mbps: Bitrate máximo permitido
            min_bitrate_mbps: Bitrate mínimo permitido
            
        Returns:
            Perfil óptimo seleccionado
        """
        # Calcular score para cada perfil
        profile_scores = {}
        
        for profile in self._profile_list:
            # Verificar límites de bitrate
            if profile.max_bitrate_mbps > max_bitrate_mbps:
                continue
            if profile.min_bitrate_mbps < min_bitrate_mbps:
                continue
            
            score = self._calculate_profile_score(
                profile=profile,
                predicted_throughput_mbps=predicted_throughput_mbps,
                buffer_level_ms=buffer_level_ms,
                screen_resolution=screen_resolution,
                player_capability=player_capability,
                server_rtt_ms=server_rtt_ms,
                packet_loss_pct=packet_loss_pct,
                stability_score=stability_score
            )
            
            profile_scores[profile.id] = score
        
        if not profile_scores:
            # Fallback al perfil más conservador
            return self.profiles.get('P5', self._profile_list[-1])
        
        # Seleccionar perfil con mayor score
        best_profile_id = max(profile_scores, key=profile_scores.get)
        best_profile = self.profiles[best_profile_id]
        
        logger.debug(
            f"ARBITER+ selected {best_profile_id} "
            f"(score={profile_scores[best_profile_id]:.2f}, "
            f"throughput={predicted_throughput_mbps:.1f}Mbps, "
            f"buffer={buffer_level_ms:.0f}ms)"
        )
        
        return best_profile
    
    def _calculate_profile_score(
        self,
        profile: ProfileConfig,
        predicted_throughput_mbps: float,
        buffer_level_ms: float,
        screen_resolution: str,
        player_capability: str,
        server_rtt_ms: float,
        packet_loss_pct: float,
        stability_score: float
    ) -> float:
        """Calcula el score de un perfil basado en los 7 factores."""
        
        # Factor 1: Throughput (¿el throughput soporta este perfil?)
        throughput_ratio = predicted_throughput_mbps / profile.max_bitrate_mbps
        throughput_score = min(1.0, throughput_ratio) if throughput_ratio >= 0.8 else throughput_ratio * 0.5
        
        # Factor 2: Buffer (¿el buffer es suficiente para este perfil?)
        buffer_ratio = buffer_level_ms / profile.target_buffer_ms
        if buffer_ratio >= 1.5:
            buffer_score = 1.0  # Buffer saludable
        elif buffer_ratio >= 1.0:
            buffer_score = 0.8  # Buffer OK
        elif buffer_ratio >= 0.5:
            buffer_score = 0.5  # Buffer bajo
        else:
            buffer_score = 0.2  # Buffer crítico
        
        # Factor 3: Resolución de pantalla
        required_bitrate = self.RESOLUTION_BITRATE.get(screen_resolution.lower(), 5.0)
        if profile.max_bitrate_mbps >= required_bitrate:
            screen_score = 1.0
        else:
            screen_score = profile.max_bitrate_mbps / required_bitrate
        
        # Factor 4: Capacidad del player
        player_multiplier = self.PLAYER_CAPABILITY.get(player_capability.lower(), 1.0)
        effective_max = profile.max_bitrate_mbps * player_multiplier
        player_score = min(1.0, effective_max / profile.max_bitrate_mbps)
        
        # Factor 5: RTT (menor es mejor)
        if server_rtt_ms <= 50:
            rtt_score = 1.0
        elif server_rtt_ms <= 100:
            rtt_score = 0.8
        elif server_rtt_ms <= 200:
            rtt_score = 0.5
        else:
            rtt_score = 0.3
        
        # Factor 6: Packet loss (menor es mejor)
        if packet_loss_pct <= 0.1:
            packet_loss_score = 1.0
        elif packet_loss_pct <= 1.0:
            packet_loss_score = 0.7
        elif packet_loss_pct <= 3.0:
            packet_loss_score = 0.4
        else:
            packet_loss_score = 0.1
        
        # Factor 7: Estabilidad
        stability_score_factor = stability_score
        
        # Calcular score ponderado
        total_score = (
            self.FACTOR_WEIGHTS['throughput'] * throughput_score +
            self.FACTOR_WEIGHTS['buffer'] * buffer_score +
            self.FACTOR_WEIGHTS['screen'] * screen_score +
            self.FACTOR_WEIGHTS['player'] * player_score +
            self.FACTOR_WEIGHTS['rtt'] * rtt_score +
            self.FACTOR_WEIGHTS['packet_loss'] * packet_loss_score +
            self.FACTOR_WEIGHTS['stability'] * stability_score_factor
        )
        
        # Bonus por usar mayor calidad (preferir calidad si es viable)
        quality_bonus = (profile.max_bitrate_mbps / 30.0) * 0.1
        
        return total_score + quality_bonus
    
    def get_profile(self, profile_id: str) -> Optional[ProfileConfig]:
        """Obtiene un perfil por ID."""
        return self.profiles.get(profile_id)
    
    def get_all_profiles(self) -> List[ProfileConfig]:
        """Obtiene todos los perfiles ordenados por bitrate."""
        return self._profile_list
    
    def get_emergency_profile(self) -> ProfileConfig:
        """Obtiene el perfil de emergencia (más conservador)."""
        return self.profiles.get('P5', self._profile_list[-1])
    
    def get_optimal_profile_for_bitrate(self, target_bitrate_mbps: float) -> ProfileConfig:
        """Obtiene el perfil más cercano a un bitrate objetivo."""
        best_profile = None
        best_diff = float('inf')
        
        for profile in self._profile_list:
            diff = abs(profile.max_bitrate_mbps - target_bitrate_mbps)
            if diff < best_diff:
                best_diff = diff
                best_profile = profile
        
        return best_profile or self._profile_list[-1]
