"""
APE Guardian Engine v15 - Configuración Principal
==================================================
Archivo de configuración centralizado para todo el sistema.
"""

import os
from typing import Dict, Any

# ============================================================================
# CONFIGURACIÓN DEL SERVIDOR
# ============================================================================

SERVER_CONFIG = {
    'host': '0.0.0.0',
    'port': 8080,
    'debug': False,
    'workers': 4,
    'threads': 2,
    'timeout': 30,
}

# ============================================================================
# CONFIGURACIÓN JWT
# ============================================================================

JWT_CONFIG = {
    'secret_key': os.environ.get('APE_JWT_SECRET', 'ape-guardian-secret-key-change-in-production'),
    'algorithm': 'HS256',
    'expiration_days': 365,
    'required_fields': ['user_id'],
    'optional_fields': ['list_id', 'profile', 'abr_enabled', 'max_bitrate_mbps', 
                        'min_bitrate_mbps', 'screen_resolution', 'player_capability'],
}

# ============================================================================
# CONFIGURACIÓN DE PERFILES ABR (P0-P5)
# ============================================================================

ABR_PROFILES = {
    'P0': {
        'name': 'ULTRA_4K_SPORTS',
        'description': 'Deportes 4K Ultra - Latencia mínima',
        'max_bitrate_mbps': 25.0,
        'min_bitrate_mbps': 8.0,
        'target_buffer_ms': 3000,
        'max_buffer_ms': 8000,
        'latency_mode': 'ultra_low',
        'parallel_segments': 4,
        'prefetch_segments': 2,
        'priority': 1,
    },
    'P1': {
        'name': 'LOW_LATENCY_SPORTS',
        'description': 'Deportes HD - Baja latencia',
        'max_bitrate_mbps': 15.0,
        'min_bitrate_mbps': 5.0,
        'target_buffer_ms': 4000,
        'max_buffer_ms': 10000,
        'latency_mode': 'low',
        'parallel_segments': 4,
        'prefetch_segments': 3,
        'priority': 2,
    },
    'P2': {
        'name': 'QUALITY_FOCUS_SERIES',
        'description': 'Series/Películas - Máxima calidad',
        'max_bitrate_mbps': 20.0,
        'min_bitrate_mbps': 3.0,
        'target_buffer_ms': 6000,
        'max_buffer_ms': 15000,
        'latency_mode': 'normal',
        'parallel_segments': 4,
        'prefetch_segments': 4,
        'priority': 3,
    },
    'P3': {
        'name': 'GENERAL_HD_STABLE',
        'description': 'HD General - Estabilidad',
        'max_bitrate_mbps': 10.0,
        'min_bitrate_mbps': 2.0,
        'target_buffer_ms': 8000,
        'max_buffer_ms': 20000,
        'latency_mode': 'normal',
        'parallel_segments': 3,
        'prefetch_segments': 4,
        'priority': 4,
    },
    'P4': {
        'name': 'UNSTABLE_NETWORK',
        'description': 'Redes inestables - Adaptativo',
        'max_bitrate_mbps': 5.0,
        'min_bitrate_mbps': 0.8,
        'target_buffer_ms': 12000,
        'max_buffer_ms': 30000,
        'latency_mode': 'conservative',
        'parallel_segments': 2,
        'prefetch_segments': 5,
        'priority': 5,
    },
    'P5': {
        'name': 'CRITICAL_FAILSAFE',
        'description': 'Red crítica - Modo seguro',
        'max_bitrate_mbps': 2.0,
        'min_bitrate_mbps': 0.3,
        'target_buffer_ms': 20000,
        'max_buffer_ms': 60000,
        'latency_mode': 'failsafe',
        'parallel_segments': 1,
        'prefetch_segments': 6,
        'priority': 6,
    },
}

# ============================================================================
# CONFIGURACIÓN DE TELEMETRÍA
# ============================================================================

TELEMETRY_CONFIG = {
    'micro_snapshot_interval_ms': 100,
    'macro_aggregate_interval_s': 10,
    'history_retention_s': 300,
    'websocket_port': 8081,
    'metrics_buffer_size': 1000,
}

# ============================================================================
# CONFIGURACIÓN DE MACHINE LEARNING
# ============================================================================

ML_CONFIG = {
    'gru_sequence_length': 30,
    'gru_hidden_units': 64,
    'prediction_horizon_s': 10,
    'learning_rate': 0.001,
    'anomaly_threshold': 0.1,
    'q_learning_gamma': 0.95,
    'q_learning_epsilon': 0.1,
    'bayesian_n_iterations': 50,
}

# ============================================================================
# CONFIGURACIÓN DE HYSTERESIS
# ============================================================================

HYSTERESIS_CONFIG = {
    'failover_threshold_ms': 1000,
    'failback_stability_s': 60,
    'min_time_between_changes_s': 5,
    'stability_score_threshold': 0.7,
}

# ============================================================================
# CONFIGURACIÓN DE ERROR RECOVERY
# ============================================================================

ERROR_RECOVERY_CONFIG = {
    'max_retries_4xx': 3,
    'max_retries_5xx': 10,
    'max_retries_429': 15,
    'backoff_base_ms': 100,
    'backoff_max_ms': 30000,
    'backoff_multiplier': 2.0,
}

# ============================================================================
# CONFIGURACIÓN DE RED
# ============================================================================

NETWORK_CONFIG = {
    'tcp_buffer_size': 8 * 1024 * 1024,  # 8MB
    'tcp_keepalive': True,
    'tcp_nodelay': True,
    'connection_timeout_s': 10,
    'read_timeout_s': 30,
    'max_parallel_connections': 8,
}

# ============================================================================
# RUTAS DE ARCHIVOS
# ============================================================================

PATHS_CONFIG = {
    'm3u8_directory': '/var/www/lists',
    'versions_directory': '/var/www/lists/versions',
    'logs_directory': '/var/log/ape-guardian',
    'cache_directory': '/tmp/ape-guardian-cache',
}

# ============================================================================
# FUNCIÓN PARA OBTENER CONFIGURACIÓN
# ============================================================================

# ============================================================================
# CLASE SETTINGS (ACCESO SIMPLIFICADO)
# ============================================================================

class Settings:
    """Clase de configuración con acceso simplificado."""
    
    # Server
    HOST = SERVER_CONFIG['host']
    PORT = SERVER_CONFIG['port']
    DEBUG = SERVER_CONFIG['debug']
    WORKERS = SERVER_CONFIG['workers']
    
    # JWT
    JWT_SECRET = JWT_CONFIG['secret_key']
    JWT_ALGORITHM = JWT_CONFIG['algorithm']
    JWT_EXPIRATION_DAYS = JWT_CONFIG['expiration_days']
    
    # Paths
    M3U8_DIRECTORY = PATHS_CONFIG['m3u8_directory']
    VERSIONS_DIRECTORY = PATHS_CONFIG['versions_directory']
    LOGS_DIRECTORY = PATHS_CONFIG['logs_directory']
    CACHE_DIRECTORY = PATHS_CONFIG['cache_directory']
    
    # Telemetry
    TELEMETRY_WEBSOCKET_PORT = TELEMETRY_CONFIG['websocket_port']
    MICRO_SNAPSHOT_INTERVAL_MS = TELEMETRY_CONFIG['micro_snapshot_interval_ms']
    MACRO_AGGREGATE_INTERVAL_S = TELEMETRY_CONFIG['macro_aggregate_interval_s']
    
    # Hysteresis
    FAILOVER_THRESHOLD_MS = HYSTERESIS_CONFIG['failover_threshold_ms']
    FAILBACK_STABILITY_S = HYSTERESIS_CONFIG['failback_stability_s']
    
    # Network
    TCP_BUFFER_SIZE = NETWORK_CONFIG['tcp_buffer_size']
    MAX_PARALLEL_CONNECTIONS = NETWORK_CONFIG['max_parallel_connections']
    
    @classmethod
    def get_profile(cls, profile_id: str) -> Dict[str, Any]:
        """Obtiene un perfil ABR."""
        return ABR_PROFILES.get(profile_id, ABR_PROFILES['P2'])
    
    @classmethod
    def get_all_profiles(cls) -> Dict[str, Dict[str, Any]]:
        """Obtiene todos los perfiles ABR."""
        return ABR_PROFILES.copy()


def get_config(section: str = None) -> Dict[str, Any]:
    """Obtiene la configuración del sistema."""
    config = {
        'server': SERVER_CONFIG,
        'jwt': JWT_CONFIG,
        'profiles': ABR_PROFILES,
        'telemetry': TELEMETRY_CONFIG,
        'ml': ML_CONFIG,
        'hysteresis': HYSTERESIS_CONFIG,
        'error_recovery': ERROR_RECOVERY_CONFIG,
        'network': NETWORK_CONFIG,
        'paths': PATHS_CONFIG,
    }
    
    if section:
        return config.get(section, {})
    return config
