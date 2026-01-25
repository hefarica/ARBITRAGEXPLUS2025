"""
APE Guardian Engine v15 - ABR Profiles
=======================================
Configuración de 6 perfiles ABR adaptativos (P0-P5).
"""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


# Configuración de perfiles por defecto
DEFAULT_PROFILES: Dict[str, Dict[str, Any]] = {
    'P0': {
        'name': 'ULTRA_EXTREME',
        'description': '8K/4K Ultra - Máxima calidad sin límites',
        'max_bitrate_mbps': 50.0,
        'min_bitrate_mbps': 15.0,
        'target_resolution': '7680x4320',
        'max_resolution': '7680x4320',
        'min_resolution': '3840x2160',
        'target_buffer_ms': 8000,
        'min_buffer_ms': 5000,
        'max_buffer_ms': 60000,
        'parallel_segments': 8,
        'prefetch_segments': 5,
        'latency_mode': 'quality',
        'hdr_enabled': True,
        'dolby_atmos': True,
        'priority': 1,
        'required_throughput_mbps': 60.0,
        'headers_count': 235,
    },
    'P1': {
        'name': '4K_SUPREME',
        'description': '4K Supreme - Alta calidad para conexiones excelentes',
        'max_bitrate_mbps': 25.0,
        'min_bitrate_mbps': 10.0,
        'target_resolution': '3840x2160',
        'max_resolution': '3840x2160',
        'min_resolution': '1920x1080',
        'target_buffer_ms': 6000,
        'min_buffer_ms': 4000,
        'max_buffer_ms': 45000,
        'parallel_segments': 6,
        'prefetch_segments': 4,
        'latency_mode': 'balanced',
        'hdr_enabled': True,
        'dolby_atmos': True,
        'priority': 2,
        'required_throughput_mbps': 30.0,
        'headers_count': 185,
    },
    'P2': {
        'name': 'FULL_HD_QUALITY',
        'description': 'Full HD - Balance óptimo calidad/estabilidad',
        'max_bitrate_mbps': 15.0,
        'min_bitrate_mbps': 5.0,
        'target_resolution': '1920x1080',
        'max_resolution': '1920x1080',
        'min_resolution': '1280x720',
        'target_buffer_ms': 5000,
        'min_buffer_ms': 3000,
        'max_buffer_ms': 30000,
        'parallel_segments': 4,
        'prefetch_segments': 3,
        'latency_mode': 'balanced',
        'hdr_enabled': True,
        'dolby_atmos': False,
        'priority': 3,
        'required_throughput_mbps': 18.0,
        'headers_count': 158,
    },
    'P3': {
        'name': 'HD_STABLE',
        'description': 'HD Estable - Prioriza estabilidad sobre calidad',
        'max_bitrate_mbps': 8.0,
        'min_bitrate_mbps': 2.5,
        'target_resolution': '1280x720',
        'max_resolution': '1280x720',
        'min_resolution': '854x480',
        'target_buffer_ms': 8000,
        'min_buffer_ms': 5000,
        'max_buffer_ms': 45000,
        'parallel_segments': 4,
        'prefetch_segments': 4,
        'latency_mode': 'stability',
        'hdr_enabled': False,
        'dolby_atmos': False,
        'priority': 4,
        'required_throughput_mbps': 10.0,
        'headers_count': 142,
    },
    'P4': {
        'name': 'SD_RESILIENT',
        'description': 'SD Resiliente - Para redes inestables',
        'max_bitrate_mbps': 4.0,
        'min_bitrate_mbps': 1.0,
        'target_resolution': '854x480',
        'max_resolution': '854x480',
        'min_resolution': '640x360',
        'target_buffer_ms': 10000,
        'min_buffer_ms': 6000,
        'max_buffer_ms': 60000,
        'parallel_segments': 2,
        'prefetch_segments': 5,
        'latency_mode': 'stability',
        'hdr_enabled': False,
        'dolby_atmos': False,
        'priority': 5,
        'required_throughput_mbps': 5.0,
        'headers_count': 128,
    },
    'P5': {
        'name': 'FAILSAFE',
        'description': 'Failsafe - Modo de emergencia, máxima resiliencia',
        'max_bitrate_mbps': 2.0,
        'min_bitrate_mbps': 0.5,
        'target_resolution': '640x360',
        'max_resolution': '640x360',
        'min_resolution': '426x240',
        'target_buffer_ms': 15000,
        'min_buffer_ms': 8000,
        'max_buffer_ms': 90000,
        'parallel_segments': 1,
        'prefetch_segments': 6,
        'latency_mode': 'ultra-stable',
        'hdr_enabled': False,
        'dolby_atmos': False,
        'priority': 6,
        'required_throughput_mbps': 2.5,
        'headers_count': 115,
    },
}


class ProfileManager:
    """
    Gestor de perfiles ABR.
    
    Responsabilidades:
    - Cargar y gestionar perfiles
    - Seleccionar perfil óptimo según throughput
    - Proporcionar configuración de perfil
    """
    
    def __init__(self, custom_profiles: Optional[Dict[str, Dict[str, Any]]] = None):
        """
        Inicializa el gestor de perfiles.
        
        Args:
            custom_profiles: Perfiles personalizados (opcional)
        """
        self.profiles = DEFAULT_PROFILES.copy()
        
        if custom_profiles:
            self.profiles.update(custom_profiles)
        
        logger.info(f"Profile Manager initialized with {len(self.profiles)} profiles")
    
    def get_profile(self, profile_id: str) -> Optional[Dict[str, Any]]:
        """
        Obtiene un perfil por ID.
        
        Args:
            profile_id: ID del perfil (P0-P5)
            
        Returns:
            Configuración del perfil o None
        """
        return self.profiles.get(profile_id)
    
    def get_all_profiles(self) -> Dict[str, Dict[str, Any]]:
        """Obtiene todos los perfiles."""
        return self.profiles.copy()
    
    def get_profile_for_throughput(self, throughput_mbps: float) -> str:
        """
        Selecciona el perfil óptimo para un throughput dado.
        
        Args:
            throughput_mbps: Throughput disponible en Mbps
            
        Returns:
            ID del perfil óptimo
        """
        # Ordenar perfiles por bitrate máximo (descendente)
        sorted_profiles = sorted(
            self.profiles.items(),
            key=lambda x: x[1]['max_bitrate_mbps'],
            reverse=True
        )
        
        # Seleccionar el perfil más alto que el throughput pueda soportar
        for profile_id, config in sorted_profiles:
            required = config['required_throughput_mbps']
            if throughput_mbps >= required:
                return profile_id
        
        # Fallback al perfil más conservador
        return 'P5'
    
    def get_profile_for_resolution(self, resolution: str) -> str:
        """
        Selecciona el perfil óptimo para una resolución de pantalla.
        
        Args:
            resolution: Resolución de pantalla (ej: '1080p', '4k')
            
        Returns:
            ID del perfil óptimo
        """
        resolution_map = {
            '8k': 'P0',
            '4k': 'P1',
            '2k': 'P2',
            '1080p': 'P2',
            '720p': 'P3',
            '480p': 'P4',
            '360p': 'P5',
        }
        
        return resolution_map.get(resolution.lower(), 'P2')
    
    def get_next_lower_profile(self, current_profile_id: str) -> Optional[str]:
        """
        Obtiene el siguiente perfil más bajo (para failover).
        
        Args:
            current_profile_id: ID del perfil actual
            
        Returns:
            ID del siguiente perfil más bajo o None si ya es el mínimo
        """
        profile_order = ['P0', 'P1', 'P2', 'P3', 'P4', 'P5']
        
        try:
            current_index = profile_order.index(current_profile_id)
            if current_index < len(profile_order) - 1:
                return profile_order[current_index + 1]
        except ValueError:
            pass
        
        return None
    
    def get_next_higher_profile(self, current_profile_id: str) -> Optional[str]:
        """
        Obtiene el siguiente perfil más alto (para failback).
        
        Args:
            current_profile_id: ID del perfil actual
            
        Returns:
            ID del siguiente perfil más alto o None si ya es el máximo
        """
        profile_order = ['P0', 'P1', 'P2', 'P3', 'P4', 'P5']
        
        try:
            current_index = profile_order.index(current_profile_id)
            if current_index > 0:
                return profile_order[current_index - 1]
        except ValueError:
            pass
        
        return None
    
    def get_emergency_profile(self) -> str:
        """Obtiene el perfil de emergencia."""
        return 'P5'
    
    def get_default_profile(self) -> str:
        """Obtiene el perfil por defecto."""
        return 'P2'
    
    def update_profile(self, profile_id: str, updates: Dict[str, Any]) -> bool:
        """
        Actualiza un perfil existente.
        
        Args:
            profile_id: ID del perfil
            updates: Diccionario con actualizaciones
            
        Returns:
            True si se actualizó, False si no existe
        """
        if profile_id not in self.profiles:
            return False
        
        self.profiles[profile_id].update(updates)
        logger.info(f"Updated profile {profile_id}")
        return True
    
    def get_profile_summary(self) -> list:
        """Obtiene resumen de todos los perfiles."""
        return [
            {
                'id': pid,
                'name': config['name'],
                'max_bitrate_mbps': config['max_bitrate_mbps'],
                'target_resolution': config['target_resolution'],
                'required_throughput_mbps': config['required_throughput_mbps'],
            }
            for pid, config in sorted(self.profiles.items())
        ]
