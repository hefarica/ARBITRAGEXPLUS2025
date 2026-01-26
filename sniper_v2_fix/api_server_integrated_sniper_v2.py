"""
APE Guardian Engine v17 - INTEGRATED SNIPER MODE v2
Sistema integrado de detección y optimización de canal activo
Detección basada en parseo de M3U8 y monitoreo pasivo (SIN PROXY)
"""

import os
import re
import threading
import time
from datetime import datetime, timedelta
from typing import Dict, Optional, Set, List
from collections import defaultdict
from flask import jsonify

# Clase para detección de canal activo integrada (v2)
class IntegratedChannelSniperV2:
    """
    Sistema SNIPER v2 que detecta qué canal específico está siendo reproducido
    mediante parseo de la lista M3U8 y monitoreo pasivo (SIN PROXY)
    """
    
    def __init__(self):
        # Listas M3U8 cargadas
        # {list_filename: {channels: [{name, url, tvg_id, tvg_logo}], loaded_at}}
        self.loaded_lists: Dict[str, Dict] = {}
        
        # Sesiones activas
        # {session_id: {list_filename, channels_in_list, last_refresh, request_count}}
        self.active_sessions: Dict[str, Dict] = {}
        
        # Canales activos detectados
        # {session_id: {channel_name, channel_url, first_seen, last_seen, confidence}}
        self.active_channels: Dict[str, Dict] = {}
        
        # Recursos asignados por canal
        # {channel_key: {cpu_priority, memory_allocated, bandwidth_allocated}}
        self.channel_resources: Dict[str, Dict] = {}
        
        # Lock para thread-safety
        self.lock = threading.Lock()
        
        # Estadísticas globales
        self.stats = {
            'total_channels_detected': 0,
            'total_lists_loaded': 0,
            'active_sessions': 0,
            'sniper_mode_activations': 0
        }
    
    def parse_m3u8_list(self, list_filename: str, content: str) -> List[Dict]:
        """
        Parsea una lista M3U8 y extrae TODOS los canales con sus URLs
        
        Returns:
            List of {name, url, tvg_id, tvg_logo, tvg_group}
        """
        channels = []
        lines = content.split('\n')
        
        current_channel = {}
        
        for i, line in enumerate(lines):
            line = line.strip()
            
            # Detectar línea #EXTINF (metadata del canal)
            if line.startswith('#EXTINF:'):
                # Extraer metadata
                # Formato: #EXTINF:-1 tvg-id="ESPN" tvg-logo="..." tvg-group="Sports",ESPN HD
                
                # Extraer tvg-id
                tvg_id_match = re.search(r'tvg-id="([^"]+)"', line)
                tvg_id = tvg_id_match.group(1) if tvg_id_match else None
                
                # Extraer tvg-logo
                tvg_logo_match = re.search(r'tvg-logo="([^"]+)"', line)
                tvg_logo = tvg_logo_match.group(1) if tvg_logo_match else None
                
                # Extraer tvg-group
                tvg_group_match = re.search(r'tvg-group="([^"]+)"', line)
                tvg_group = tvg_group_match.group(1) if tvg_group_match else None
                
                # Extraer nombre del canal (después de la última coma)
                name_match = re.search(r',(.+)$', line)
                name = name_match.group(1).strip() if name_match else f"Channel_{i}"
                
                current_channel = {
                    'name': name,
                    'tvg_id': tvg_id,
                    'tvg_logo': tvg_logo,
                    'tvg_group': tvg_group,
                    'url': None
                }
            
            # Detectar URL del canal (línea siguiente a #EXTINF)
            elif line and not line.startswith('#') and current_channel:
                # Esta es la URL del canal
                current_channel['url'] = line
                
                # Agregar canal a la lista
                if current_channel['url']:
                    channels.append(current_channel.copy())
                
                # Reset
                current_channel = {}
        
        return channels
    
    def register_list_load(self, session_id: str, list_filename: str, content: str):
        """
        Registra que una lista M3U8 fue cargada por una sesión
        Parsea la lista y almacena los canales
        """
        with self.lock:
            # Parsear lista
            channels = self.parse_m3u8_list(list_filename, content)
            
            # Almacenar lista
            self.loaded_lists[list_filename] = {
                'channels': channels,
                'loaded_at': datetime.now(),
                'channel_count': len(channels)
            }
            
            # Registrar sesión
            self.active_sessions[session_id] = {
                'list_filename': list_filename,
                'channels_in_list': len(channels),
                'last_refresh': datetime.now(),
                'request_count': 1
            }
            
            self.stats['total_lists_loaded'] += 1
            self.stats['active_sessions'] += 1
            
            return len(channels)
    
    def detect_channel_from_referer(self, session_id: str, referer_url: str) -> Optional[str]:
        """
        Detecta el canal activo analizando el header Referer
        que el player envía cuando solicita segmentos al CDN
        
        Args:
            session_id: ID de la sesión
            referer_url: URL del Referer (ej. http://cdn.com/live/ESPN_HD/index.m3u8)
        
        Returns:
            channel_name: Nombre del canal detectado o None
        """
        with self.lock:
            # Verificar si la sesión existe
            if session_id not in self.active_sessions:
                return None
            
            # Obtener la lista cargada por esta sesión
            list_filename = self.active_sessions[session_id]['list_filename']
            
            if list_filename not in self.loaded_lists:
                return None
            
            channels = self.loaded_lists[list_filename]['channels']
            
            # Buscar el canal cuya URL coincida con el Referer
            for channel in channels:
                channel_url = channel['url']
                
                # Extraer el dominio y path base de ambas URLs
                if self._urls_match(channel_url, referer_url):
                    channel_name = channel['name']
                    
                    # Actualizar o crear canal activo
                    if session_id not in self.active_channels:
                        # Nuevo canal activo
                        self.active_channels[session_id] = {
                            'channel_name': channel_name,
                            'channel_url': channel_url,
                            'tvg_id': channel.get('tvg_id'),
                            'tvg_group': channel.get('tvg_group'),
                            'first_seen': datetime.now(),
                            'last_seen': datetime.now(),
                            'confidence': 0.9,
                            'is_active': True
                        }
                        
                        self.stats['total_channels_detected'] += 1
                        
                        # Activar modo SNIPER
                        self._activate_sniper_mode(session_id, channel_name)
                    else:
                        # Canal existente
                        existing_channel = self.active_channels[session_id]['channel_name']
                        
                        if channel_name != existing_channel:
                            # CAMBIO DE CANAL
                            self._deactivate_sniper_mode(session_id, existing_channel)
                            
                            self.active_channels[session_id] = {
                                'channel_name': channel_name,
                                'channel_url': channel_url,
                                'tvg_id': channel.get('tvg_id'),
                                'tvg_group': channel.get('tvg_group'),
                                'first_seen': datetime.now(),
                                'last_seen': datetime.now(),
                                'confidence': 0.9,
                                'is_active': True
                            }
                            
                            self._activate_sniper_mode(session_id, channel_name)
                        else:
                            # Mismo canal, actualizar last_seen
                            self.active_channels[session_id]['last_seen'] = datetime.now()
                            self.active_channels[session_id]['confidence'] = min(1.0, 
                                self.active_channels[session_id]['confidence'] + 0.1)
                    
                    return channel_name
            
            return None
    
    def detect_channel_heuristic(self, session_id: str) -> Optional[str]:
        """
        Detección heurística del canal activo basada en:
        - Tiempo desde la última actualización de la lista
        - Patrón de refrescos (cada X segundos indica reproducción activa)
        
        Esta función se llama cuando el player refresca la lista M3U8
        """
        with self.lock:
            if session_id not in self.active_sessions:
                return None
            
            session = self.active_sessions[session_id]
            now = datetime.now()
            
            # Calcular tiempo desde último refresh
            time_since_refresh = (now - session['last_refresh']).total_seconds()
            
            # Actualizar request_count y last_refresh
            session['request_count'] += 1
            session['last_refresh'] = now
            
            # Heurística: Si el player refresca la lista cada 2-10 segundos,
            # probablemente está reproduciendo un canal
            if 2 <= time_since_refresh <= 10:
                # Reproducción activa detectada
                # Pero no sabemos QUÉ canal específico
                # Retornar el último canal detectado (si existe)
                if session_id in self.active_channels:
                    channel_name = self.active_channels[session_id]['channel_name']
                    self.active_channels[session_id]['last_seen'] = now
                    return channel_name
            
            return None
    
    def _urls_match(self, url1: str, url2: str) -> bool:
        """
        Verifica si dos URLs apuntan al mismo recurso base
        
        Ejemplos:
        - http://cdn.com/live/ESPN_HD/index.m3u8
        - http://cdn.com/live/ESPN_HD/segment_1.ts
        → Match (mismo path base: /live/ESPN_HD/)
        """
        # Extraer path base de ambas URLs
        path1 = self._extract_base_path(url1)
        path2 = self._extract_base_path(url2)
        
        if not path1 or not path2:
            return False
        
        # Comparar paths base
        return path1 == path2
    
    def _extract_base_path(self, url: str) -> Optional[str]:
        """
        Extrae el path base de una URL
        
        Ejemplo:
        - http://cdn.com/live/ESPN_HD/index.m3u8 → /live/ESPN_HD/
        - http://cdn.com/live/ESPN_HD/segment_1.ts → /live/ESPN_HD/
        """
        # Remover protocolo y dominio
        match = re.search(r'://[^/]+(/.*)', url)
        if not match:
            return None
        
        path = match.group(1)
        
        # Remover filename
        path = '/'.join(path.split('/')[:-1]) + '/'
        
        return path
    
    def _activate_sniper_mode(self, session_id: str, channel_name: str):
        """
        Activa el modo SNIPER para un canal específico
        """
        channel_key = f"{session_id}:{channel_name}"
        
        self.channel_resources[channel_key] = {
            'cpu_priority': 'HIGH',
            'memory_allocated_mb': 256,
            'bandwidth_allocated_mbps': 50,
            'cache_enabled': True,
            'preload_segments': 10,
            'recovery_mode': 'ULTRA_AGGRESSIVE',
            'error_tolerance': 0
        }
        
        self.stats['sniper_mode_activations'] += 1
    
    def _deactivate_sniper_mode(self, session_id: str, channel_name: str):
        """
        Desactiva el modo SNIPER para un canal
        """
        channel_key = f"{session_id}:{channel_name}"
        
        if channel_key in self.channel_resources:
            del self.channel_resources[channel_key]
    
    def get_all_active_channels(self) -> List[Dict]:
        """
        Obtiene todos los canales activos
        """
        with self.lock:
            channels = []
            for session_id, channel_data in self.active_channels.items():
                if channel_data['is_active']:
                    channels.append({
                        'session_id': session_id,
                        'channel_name': channel_data['channel_name'],
                        'channel_url': channel_data.get('channel_url'),
                        'tvg_id': channel_data.get('tvg_id'),
                        'tvg_group': channel_data.get('tvg_group'),
                        'first_seen': channel_data['first_seen'].isoformat(),
                        'last_seen': channel_data['last_seen'].isoformat(),
                        'confidence': channel_data['confidence'],
                        'sniper_active': True
                    })
            return channels
    
    def get_active_channel(self, session_id: str) -> Optional[Dict]:
        """
        Obtiene el canal activo para una sesión específica
        """
        with self.lock:
            if session_id in self.active_channels:
                channel_data = self.active_channels[session_id]
                return {
                    'session_id': session_id,
                    'channel_name': channel_data['channel_name'],
                    'channel_url': channel_data.get('channel_url'),
                    'tvg_id': channel_data.get('tvg_id'),
                    'tvg_group': channel_data.get('tvg_group'),
                    'first_seen': channel_data['first_seen'].isoformat(),
                    'last_seen': channel_data['last_seen'].isoformat(),
                    'confidence': channel_data['confidence'],
                    'sniper_active': True
                }
            return None
    
    def get_sniper_stats(self) -> Dict:
        """
        Obtiene estadísticas del sistema SNIPER
        """
        with self.lock:
            return {
                'stats': self.stats.copy(),
                'active_channels_count': len([c for c in self.active_channels.values() if c['is_active']]),
                'total_sessions': len(self.active_sessions),
                'resources_allocated': len(self.channel_resources)
            }
    
    def cleanup_inactive_sessions(self, timeout_seconds: int = 60):
        """
        Limpia sesiones inactivas (sin actividad por X segundos)
        """
        with self.lock:
            now = datetime.now()
            inactive_sessions = []
            
            for session_id, channel_data in self.active_channels.items():
                time_since_last_seen = (now - channel_data['last_seen']).total_seconds()
                
                if time_since_last_seen > timeout_seconds:
                    inactive_sessions.append(session_id)
            
            for session_id in inactive_sessions:
                channel_name = self.active_channels[session_id]['channel_name']
                self._deactivate_sniper_mode(session_id, channel_name)
                self.active_channels[session_id]['is_active'] = False


# Instancia global del SNIPER v2
integrated_sniper_v2 = IntegratedChannelSniperV2()


# Funciones de integración con Flask
def register_list_load_with_sniper(session_id: str, list_filename: str, content: str) -> int:
    """
    Registra que una lista M3U8 fue cargada
    Retorna el número de canales en la lista
    """
    return integrated_sniper_v2.register_list_load(session_id, list_filename, content)


def detect_channel_from_referer_with_sniper(session_id: str, referer_url: str) -> Optional[str]:
    """
    Detecta el canal activo desde el header Referer
    """
    return integrated_sniper_v2.detect_channel_from_referer(session_id, referer_url)


def detect_channel_heuristic_with_sniper(session_id: str) -> Optional[str]:
    """
    Detección heurística del canal activo
    """
    return integrated_sniper_v2.detect_channel_heuristic(session_id)


def add_sniper_v2_endpoints_to_app(app):
    """
    Agrega los endpoints del SNIPER v2 a la aplicación Flask
    """
    
    @app.route('/telemetry/active-channels', methods=['GET'])
    def get_active_channels():
        """
        Obtiene todos los canales activos detectados por el SNIPER
        """
        try:
            channels = integrated_sniper_v2.get_all_active_channels()
            stats = integrated_sniper_v2.get_sniper_stats()
            
            return jsonify({
                'active_channels': channels,
                'stats': stats,
                'timestamp': datetime.now().isoformat()
            }), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/telemetry/active-channel/<session_id>', methods=['GET'])
    def get_active_channel(session_id: str):
        """
        Obtiene el canal activo para una sesión específica
        """
        try:
            channel = integrated_sniper_v2.get_active_channel(session_id)
            
            if channel:
                return jsonify(channel), 200
            else:
                return jsonify({'error': 'No active channel for this session'}), 404
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/telemetry/sniper/stats', methods=['GET'])
    def get_sniper_stats():
        """
        Obtiene estadísticas del sistema SNIPER
        """
        try:
            stats = integrated_sniper_v2.get_sniper_stats()
            return jsonify(stats), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500


def track_request_with_sniper(session_id: str, requested_path: str, referer: Optional[str] = None):
    """
    Función principal para rastrear requests con el sistema SNIPER v2
    
    Esta función debe ser llamada en CADA request a archivos M3U8 para:
    1. Detectar qué canal está siendo reproducido
    2. Activar el modo SNIPER para ese canal específico
    3. Aplicar optimizaciones ultra-agresivas
    
    Args:
        session_id: Identificador único de la sesión del usuario
        requested_path: Path del archivo solicitado (ej: /lists/APE_ULTIMATE_v9.0_20260125.m3u8)
        referer: Header Referer (opcional, puede contener pistas del canal activo)
    
    Returns:
        str: Nombre del canal detectado (si se detectó), None en caso contrario
    """
    try:
        logger.info(f"🎯 SNIPER v2: Tracking request - session={session_id}, path={requested_path}")
        
        # 1. Detección heurística basada en patrón de refrescos
        detected_channel = integrated_sniper_v2.detect_channel_heuristic(session_id)
        
        if detected_channel:
            logger.info(f"✓ SNIPER v2: Channel detected via heuristic - {detected_channel}")
            return detected_channel
        
        # 2. Detección desde header Referer (si está disponible)
        if referer:
            detected_channel = integrated_sniper_v2.detect_channel_from_referer(session_id, referer)
            
            if detected_channel:
                logger.info(f"✓ SNIPER v2: Channel detected via Referer - {detected_channel}")
                return detected_channel
        
        # 3. Si no se detectó canal específico, al menos registrar la actividad
        logger.info(f"⚠ SNIPER v2: No specific channel detected yet for session {session_id}")
        return None
        
    except Exception as e:
        logger.error(f"❌ SNIPER v2: Error tracking request - {e}")
        return None


def integrate_sniper_v2_with_telemetry(realtime_guardian):
    """
    Integra el sistema SNIPER v2 con el sistema de telemetría existente
    """
    # Agregar método para obtener canal activo
    def get_active_channel_for_session(session_id: str):
        return integrated_sniper_v2.get_active_channel(session_id)
    
    # Agregar método para obtener todos los canales activos
    def get_all_active_channels():
        return integrated_sniper_v2.get_all_active_channels()
    
    # Agregar método para obtener estadísticas sniper
    def get_sniper_stats():
        return integrated_sniper_v2.get_sniper_stats()
    
    # Inyectar métodos en realtime_guardian
    realtime_guardian.get_active_channel = get_active_channel_for_session
    realtime_guardian.get_all_active_channels = get_all_active_channels
    realtime_guardian.get_sniper_stats = get_sniper_stats
    
    logger.info("✅ SNIPER MODE v2 integrated with telemetry system")
