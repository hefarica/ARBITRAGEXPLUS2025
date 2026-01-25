"""
APE Guardian Engine v15 - Main Engine
======================================
Motor principal que orquesta todos los módulos del sistema.
"""

import os
import time
import logging
from typing import Dict, Any, Optional, Tuple

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Importar módulos
from config.settings import Settings
from core.jwt_validator import JWTValidator
from core.network_intelligence import NetworkIntelligence
from core.session_manager import SessionManager
from telemetry.realtime_collector import TelemetryCollector
from abr.profiles import ProfileManager
from abr.arbiter_plus import ArbiterPlus
from abr.hysteresis_controller import HysteresisController
from abr.bandwidth_predictor import BandwidthPredictor
from optimization.error_recovery import ErrorRecoveryEngine
from optimization.headers_injector import HeadersInjector
from ml.auto_tuner import MLAutoTuner


class GuardianEngine:
    """
    Motor principal del APE Guardian Engine v15.
    
    Orquesta todos los módulos para proporcionar:
    - Streaming ABR adaptativo
    - Telemetría en tiempo real
    - Recuperación de errores
    - Auto-optimización con ML
    """
    
    VERSION = "15.0.0"
    
    def __init__(self, m3u8_directory: str = "/var/www/lists"):
        """
        Inicializa el Guardian Engine.
        
        Args:
            m3u8_directory: Directorio donde se encuentran los archivos M3U8
        """
        self.m3u8_directory = m3u8_directory
        
        # Inicializar módulos
        logger.info("Initializing APE Guardian Engine v15...")
        
        # Core
        self.jwt_validator = JWTValidator(Settings.JWT_SECRET)
        self.network_intelligence = NetworkIntelligence()
        self.session_manager = SessionManager()
        
        # ABR
        self.profile_manager = ProfileManager()
        self.arbiter = ArbiterPlus(self.profile_manager.get_all_profiles())
        self.hysteresis = HysteresisController()
        self.bandwidth_predictor = BandwidthPredictor()
        
        # Optimization
        self.error_recovery = ErrorRecoveryEngine()
        self.headers_injector = HeadersInjector()
        
        # ML
        self.ml_tuner = MLAutoTuner()
        
        # Telemetry collectors por sesión
        self.telemetry_collectors: Dict[str, TelemetryCollector] = {}
        
        logger.info(f"APE Guardian Engine v{self.VERSION} initialized successfully")
        logger.info(f"M3U8 directory: {self.m3u8_directory}")
    
    def create_session(
        self,
        session_id: str,
        jwt_token: str,
        client_ip: str
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Crea una nueva sesión de streaming.
        
        Args:
            session_id: ID único de la sesión
            jwt_token: Token JWT con configuración
            client_ip: IP del cliente
            
        Returns:
            Tuple de (éxito, datos de sesión o error)
        """
        # Validar JWT
        is_valid, payload, error = self.jwt_validator.validate_token(jwt_token)
        
        if not is_valid:
            logger.warning(f"Invalid JWT for session {session_id}: {error}")
            return False, {'error': f"Invalid JWT: {error}"}
        
        # Obtener información de red (con fallback)
        network_info = self.network_intelligence.detect_network_info(client_ip)
        if network_info is None:
            network_info = {
                'ip': client_ip,
                'isp': 'unknown',
                'country': 'unknown',
                'city': 'unknown',
                'connection_type': 'unknown',
                'as_number': 'unknown',
            }
        
        # Extraer configuración del JWT
        abr_enabled = payload.get('abr_enabled', True)
        profile_id = payload.get('profile_id', 'P2')
        screen_resolution = payload.get('screen_resolution', '1080p')
        player_capability = payload.get('player_capability', 'high')
        
        # Crear sesión
        session_data = {
            'session_id': session_id,
            'created_at': time.time(),
            'client_ip': client_ip,
            'abr_enabled': abr_enabled,
            'profile_id': profile_id,
            'screen_resolution': screen_resolution,
            'player_capability': player_capability,
            'network_info': network_info,
            'jwt_payload': payload,
        }
        
        self.session_manager.create_session(
            session_id=session_id,
            user_id=payload.get('user_id', 'unknown'),
            client_ip=client_ip,
            jwt_payload=payload,
            network_info=network_info
        )
        
        # Crear collector de telemetría
        # Usar el TelemetryCollector global
        if not hasattr(self, '_telemetry_collector'):
            self._telemetry_collector = TelemetryCollector()
        self._telemetry_collector.get_or_create_session(session_id)
        self.telemetry_collectors[session_id] = session_id  # Store session_id reference
        
        # Inicializar hysteresis con el perfil inicial
        self.hysteresis.force_profile(session_id, profile_id)
        
        logger.info(
            f"Created session {session_id} "
            f"(profile={profile_id}, abr={abr_enabled}, isp={network_info.get('isp', 'unknown')})"
        )
        
        return True, session_data
    
    def process_m3u8_request(
        self,
        session_id: str,
        filename: str,
        jwt_token: Optional[str] = None,
        client_ip: str = '127.0.0.1'
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Procesa una petición de archivo M3U8.
        
        Args:
            session_id: ID de la sesión
            filename: Nombre del archivo M3U8
            jwt_token: Token JWT (opcional si ya existe sesión)
            client_ip: IP del cliente
            
        Returns:
            Tuple de (éxito, respuesta con contenido y headers)
        """
        # Verificar/crear sesión
        session = self.session_manager.get_session(session_id)
        
        if session is None:
            if jwt_token:
                success, result = self.create_session(session_id, jwt_token, client_ip)
                if not success:
                    return False, result
                session = self.session_manager.get_session(session_id)
            else:
                return False, {'error': 'Session not found and no JWT provided'}
        
        # Verificar que el archivo existe
        file_path = os.path.join(self.m3u8_directory, filename)
        if not os.path.exists(file_path):
            logger.warning(f"File not found: {file_path}")
            return False, {'error': f'File not found: {filename}'}
        
        # Leer archivo
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            logger.error(f"Error reading file {file_path}: {e}")
            return False, {'error': f'Error reading file: {str(e)}'}
        
        # Obtener telemetría actual (con valores por defecto si es nueva sesión)
        # Obtener telemetría de la sesión
        if hasattr(self, '_telemetry_collector') and session_id in self.telemetry_collectors:
            current_telemetry = self._telemetry_collector.get_session_macro(session_id)
        else:
            current_telemetry = None
        
        # Valores por defecto si no hay telemetría
        if current_telemetry is None:
            throughput_mbps = 10.0
            buffer_level_ms = 5000
            stability_score = 1.0
        else:
            throughput_mbps = current_telemetry.get('throughput_mbps', 10.0)
            buffer_level_ms = current_telemetry.get('buffer_ms', 5000)
            stability_score = current_telemetry.get('stability_score', 1.0)
        
        # Obtener perfil actual
        profile_id = session.current_profile_id if hasattr(session, 'current_profile_id') else 'P2'
        profile = self.profile_manager.get_profile(profile_id)
        
        # Si ABR está habilitado, calcular perfil óptimo
        if getattr(session, 'abr_enabled', True):
            # Predecir throughput futuro
            # Agregar muestra actual y predecir
            self.bandwidth_predictor.add_sample(session_id, throughput_mbps)
            predicted_throughput = self.bandwidth_predictor.predict_throughput(session_id)
            
            # Seleccionar perfil óptimo con ARBITER+
            screen_res = session.jwt_payload.get('screen_resolution', '1080p') if hasattr(session, 'jwt_payload') else '1080p'
            player_cap = session.jwt_payload.get('player_capability', 'high') if hasattr(session, 'jwt_payload') else 'high'
            
            recommended_profile_obj = self.arbiter.select_optimal_profile(
                predicted_throughput_mbps=predicted_throughput,
                buffer_level_ms=buffer_level_ms,
                stability_score=stability_score,
                screen_resolution=screen_res,
                player_capability=player_cap,
                packet_loss_pct=0.0,
                server_rtt_ms=50.0
            )
            
            # Obtener perfil recomendado
            recommended_profile = recommended_profile_obj.id if recommended_profile_obj else 'P2'
            
            # Aplicar hysteresis para evitar cambios bruscos
            if recommended_profile != profile_id:
                is_stable = stability_score > 0.7
                should_change, reason = self.hysteresis.should_allow_change(
                    session_id=session_id,
                    new_profile_id=recommended_profile,
                    is_network_stable=is_stable
                )
                if should_change:
                    final_profile = recommended_profile
                else:
                    final_profile = profile_id
            else:
                final_profile = profile_id
            
            if final_profile != profile_id:
                logger.info(f"Session {session_id}: Profile changed {profile_id} -> {final_profile}")
                self.session_manager.update_session(session_id, {'profile_id': final_profile})
                profile_id = final_profile
                profile = self.profile_manager.get_profile(profile_id)
        
        # Generar headers dinámicos
        headers = self.headers_injector.generate_headers(
            profile_id=profile_id,
            abr_enabled=getattr(session, 'abr_enabled', True),
            screen_resolution=session.jwt_payload.get('screen_resolution', '1080p') if hasattr(session, 'jwt_payload') else '1080p',
            player_capability=session.jwt_payload.get('player_capability', 'high') if hasattr(session, 'jwt_payload') else 'high',
            buffer_level_ms=buffer_level_ms,
            stability_score=stability_score,
            throughput_mbps=throughput_mbps
        )
        
        # Agregar headers de contenido
        headers['Content-Type'] = 'application/vnd.apple.mpegurl'
        headers['Content-Length'] = str(len(content.encode('utf-8')))
        
        # Actualizar estadísticas de sesión
        # La sesión ya se actualiza automáticamente en get_session()
        
        logger.debug(f"Serving {filename} for session {session_id} with {len(headers)} headers")
        
        return True, {
            'content': content,
            'headers': headers,
            'profile_id': profile_id,
            'session_id': session_id,
        }
    
    def record_telemetry(
        self,
        session_id: str,
        throughput_mbps: float,
        rtt_ms: float,
        buffer_ms: float,
        packet_loss: float = 0.0,
        jitter_ms: float = 0.0
    ):
        """
        Registra métricas de telemetría para una sesión.
        
        Args:
            session_id: ID de la sesión
            throughput_mbps: Throughput en Mbps
            rtt_ms: Latencia RTT en ms
            buffer_ms: Nivel de buffer en ms
            packet_loss: Pérdida de paquetes (0-1)
            jitter_ms: Jitter en ms
        """
        # Registrar telemetría
        if hasattr(self, '_telemetry_collector') and session_id in self.telemetry_collectors:
            self._telemetry_collector.record_micro(
                session_id=session_id,
                throughput_mbps=throughput_mbps,
                rtt_ms=rtt_ms,
                buffer_ms=buffer_ms,
                packet_loss=packet_loss,
                jitter_ms=jitter_ms
            )
            
            # Actualizar predictor de bandwidth
            self.bandwidth_predictor.add_sample(session_id, throughput_mbps)
    
    def handle_error(
        self,
        session_id: str,
        error_code: int,
        retry_after: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Maneja un error HTTP.
        
        Args:
            session_id: ID de la sesión
            error_code: Código de error HTTP
            retry_after: Valor de Retry-After (opcional)
            
        Returns:
            Acción de recuperación y parámetros
        """
        action, params = self.error_recovery.handle_error(
            session_id=session_id,
            error_code=error_code,
            retry_after=retry_after
        )
        
        # Registrar en telemetría
        telemetry = self.telemetry_collectors.get(session_id)
        if telemetry:
            telemetry.record_error(error_code)
        
        return {
            'action': action.value,
            'params': params,
        }
    
    def get_session_stats(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Obtiene estadísticas de una sesión.
        
        Args:
            session_id: ID de la sesión
            
        Returns:
            Estadísticas o None si no existe
        """
        session = self.session_manager.get_session(session_id)
        if session is None:
            return None
        
        # Obtener telemetría
        telemetry = self.telemetry_collectors.get(session_id)
        telemetry_stats = telemetry.get_stats() if telemetry else {}
        
        # Obtener estadísticas de errores
        error_stats = self.error_recovery.get_session_error_stats(session_id)
        
        # Obtener estado de hysteresis
        hysteresis_state = self.hysteresis.get_session_state(session_id)
        
        return {
            'session': session,
            'telemetry': telemetry_stats,
            'errors': error_stats,
            'hysteresis': hysteresis_state,
            'ml_stats': self.ml_tuner.get_learning_stats(),
        }
    
    def get_realtime_telemetry(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Obtiene telemetría en tiempo real de una sesión.
        
        Args:
            session_id: ID de la sesión
            
        Returns:
            Telemetría actual o None
        """
        telemetry = self.telemetry_collectors.get(session_id)
        if telemetry is None:
            return None
        
        return {
            'micro': telemetry.get_current_micro(),
            'macro': telemetry.get_current_macro(),
            'success_rate': telemetry.get_success_rate(),
            'timestamp': time.time(),
        }
    
    def cleanup_session(self, session_id: str):
        """
        Limpia una sesión y libera recursos.
        
        Args:
            session_id: ID de la sesión
        """
        self.session_manager.delete_session(session_id)
        
        if session_id in self.telemetry_collectors:
            del self.telemetry_collectors[session_id]
        
        self.error_recovery.cleanup_session(session_id)
        self.hysteresis.cleanup_session(session_id)
        self.bandwidth_predictor.cleanup_session(session_id)
        
        logger.info(f"Cleaned up session: {session_id}")
    
    def get_health(self) -> Dict[str, Any]:
        """Obtiene estado de salud del engine."""
        return {
            'status': 'healthy',
            'version': self.VERSION,
            'engine': 'APE Guardian Engine',
            'active_sessions': len(self.session_manager.get_all_sessions()),
            'profiles_available': len(self.profile_manager.get_all_profiles()),
            'headers_available': self.headers_injector.get_header_count(),
            'error_strategies': len(self.error_recovery.ERROR_STRATEGIES),
            'ml_enabled': True,
            'uptime': time.time(),
        }
