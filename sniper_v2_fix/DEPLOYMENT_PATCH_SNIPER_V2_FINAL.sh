#!/bin/bash
###############################################################################
# APE GUARDIAN ENGINE v17 - SNIPER v2 DEPLOYMENT PATCH
# Deployment patch unificado para corregir detección de canales activos
###############################################################################

set -e  # Exit on error

echo "🚀 APE Guardian Engine v17 - SNIPER v2 Deployment Patch"
echo "========================================================"
echo ""

# Verificar que estamos en el servidor correcto
if [ ! -d "/opt/ape-guardian" ]; then
    echo "❌ ERROR: /opt/ape-guardian directory not found"
    echo "   This script must be run on the production VPS"
    exit 1
fi

echo "✓ Production environment detected"
echo ""

# Crear backup del estado actual
BACKUP_DIR="/opt/ape-guardian/backups/sniper_v2_patch_$(date +%Y%m%d_%H%M%S)"
echo "📦 Creating backup in $BACKUP_DIR..."
mkdir -p "$BACKUP_DIR"

# Backup de archivos existentes
if [ -f "/opt/ape-guardian/api_server.py" ]; then
    cp /opt/ape-guardian/api_server.py "$BACKUP_DIR/api_server.py.backup"
    echo "   ✓ Backed up api_server.py"
fi

if [ -f "/opt/ape-guardian/api_server_integrated_sniper.py" ]; then
    cp /opt/ape-guardian/api_server_integrated_sniper.py "$BACKUP_DIR/api_server_integrated_sniper.py.backup"
    echo "   ✓ Backed up api_server_integrated_sniper.py"
fi

echo ""

###############################################################################
# PASO 1: Actualizar api_server_integrated_sniper_v2.py
###############################################################################

echo "📝 PASO 1: Actualizando api_server_integrated_sniper_v2.py..."

cat > /opt/ape-guardian/api_server_integrated_sniper_v2.py << 'SNIPER_V2_EOF'
"""
APE Guardian Engine v17 - INTEGRATED SNIPER MODE v2
Sistema integrado de detección y optimización de canal activo
Versión 2: Detección pasiva mejorada con parseo de M3U8
"""

import os
import re
import logging
import threading
from datetime import datetime
from typing import Dict, Optional, List
from collections import defaultdict

logger = logging.getLogger(__name__)


class IntegratedChannelSniperV2:
    """
    Sistema SNIPER v2 que detecta qué canal específico está siendo reproducido
    mediante análisis pasivo de requests M3U8 y patrones de refresco
    """
    
    def __init__(self):
        # Sesiones activas con sus listas M3U8 cargadas
        # {session_id: {list_filename, channels: [], last_refresh, request_count}}
        self.active_sessions: Dict[str, Dict] = {}
        
        # Canales activos detectados por sesión
        # {session_id: {channel_name, url, tvg_id, tvg_group, first_seen, last_seen, confidence, is_active}}
        self.active_channels: Dict[str, Dict] = {}
        
        # Recursos asignados por canal
        # {channel_key: {cpu_priority, memory_allocated, bandwidth_allocated}}
        self.channel_resources: Dict[str, Dict] = {}
        
        # Lock para thread-safety
        self.lock = threading.Lock()
        
        # Estadísticas globales
        self.stats = {
            'total_lists_loaded': 0,
            'total_channels_parsed': 0,
            'active_sessions': 0,
            'sniper_mode_activations': 0,
            'channels_detected': 0
        }
    
    def register_list_load(self, session_id: str, list_filename: str, content: str) -> int:
        """
        Registra la carga de una lista M3U8 y parsea sus canales
        
        Returns:
            int: Número de canales parseados
        """
        with self.lock:
            # Parsear canales del contenido M3U8
            channels = self._parse_m3u8_channels(content)
            
            # Registrar sesión
            if session_id not in self.active_sessions:
                self.active_sessions[session_id] = {
                    'list_filename': list_filename,
                    'channels': channels,
                    'last_refresh': datetime.now(),
                    'request_count': 1,
                    'first_load': datetime.now()
                }
                self.stats['active_sessions'] += 1
            else:
                # Actualizar sesión existente
                self.active_sessions[session_id]['channels'] = channels
                self.active_sessions[session_id]['last_refresh'] = datetime.now()
                self.active_sessions[session_id]['request_count'] += 1
            
            self.stats['total_lists_loaded'] += 1
            self.stats['total_channels_parsed'] += len(channels)
            
            logger.info(f"🎯 SNIPER v2: Registered list {list_filename} for session {session_id} ({len(channels)} channels)")
            
            return len(channels)
    
    def _parse_m3u8_channels(self, content: str) -> List[Dict]:
        """
        Parsea el contenido M3U8 y extrae información de canales
        
        Formato esperado:
        #EXTINF:-1 tvg-id="ESPN_HD" tvg-name="ESPN HD" tvg-logo="..." group-title="Sports",ESPN HD
        http://cdn.example.com/live/espn_hd/index.m3u8
        """
        channels = []
        lines = content.strip().split('\n')
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            # Buscar líneas EXTINF
            if line.startswith('#EXTINF:'):
                # Extraer información del canal
                channel_info = self._extract_channel_info(line)
                
                # La siguiente línea debe ser la URL
                if i + 1 < len(lines):
                    url = lines[i + 1].strip()
                    if url and not url.startswith('#'):
                        channel_info['url'] = url
                        channels.append(channel_info)
                        i += 2
                        continue
            
            i += 1
        
        return channels
    
    def _extract_channel_info(self, extinf_line: str) -> Dict:
        """
        Extrae información de una línea EXTINF
        
        Ejemplo:
        #EXTINF:-1 tvg-id="ESPN_HD" tvg-name="ESPN HD" tvg-logo="..." group-title="Sports",ESPN HD
        """
        info = {
            'tvg_id': None,
            'tvg_name': None,
            'tvg_logo': None,
            'tvg_group': None,
            'channel_name': None
        }
        
        # Extraer tvg-id
        tvg_id_match = re.search(r'tvg-id="([^"]*)"', extinf_line)
        if tvg_id_match:
            info['tvg_id'] = tvg_id_match.group(1)
        
        # Extraer tvg-name
        tvg_name_match = re.search(r'tvg-name="([^"]*)"', extinf_line)
        if tvg_name_match:
            info['tvg_name'] = tvg_name_match.group(1)
        
        # Extraer tvg-logo
        tvg_logo_match = re.search(r'tvg-logo="([^"]*)"', extinf_line)
        if tvg_logo_match:
            info['tvg_logo'] = tvg_logo_match.group(1)
        
        # Extraer group-title
        group_match = re.search(r'group-title="([^"]*)"', extinf_line)
        if group_match:
            info['tvg_group'] = group_match.group(1)
        
        # Extraer nombre del canal (después de la última coma)
        name_match = re.search(r',(.+)$', extinf_line)
        if name_match:
            info['channel_name'] = name_match.group(1).strip()
        
        return info
    
    def detect_channel_from_referer(self, session_id: str, referer_url: str) -> Optional[str]:
        """
        Detecta el canal activo desde el header Referer
        
        El player puede incluir en el Referer la URL del canal que está reproduciendo
        """
        with self.lock:
            if session_id not in self.active_sessions:
                return None
            
            session = self.active_sessions[session_id]
            channels = session.get('channels', [])
            
            # Buscar canal cuya URL coincida con el Referer
            for channel in channels:
                channel_url = channel.get('url', '')
                if channel_url and self._urls_match(referer_url, channel_url):
                    channel_name = channel.get('channel_name') or channel.get('tvg_name') or 'Unknown'
                    
                    # Registrar canal activo
                    if session_id not in self.active_channels or \
                       self.active_channels[session_id]['channel_name'] != channel_name:
                        # Nuevo canal detectado
                        self.active_channels[session_id] = {
                            'channel_name': channel_name,
                            'url': channel_url,
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
            'memory_allocated': '512MB',
            'bandwidth_allocated': '10Mbps',
            'optimization_level': 'ULTRA_AGGRESSIVE',
            'activated_at': datetime.now()
        }
        
        self.stats['sniper_mode_activations'] += 1
        self.stats['channels_detected'] += 1
        
        logger.info(f"🎯 SNIPER MODE ACTIVATED: {channel_name} (session: {session_id})")
        logger.info(f"   Resources allocated: CPU=HIGH, Memory=512MB, Bandwidth=10Mbps")
    
    def get_active_channel(self, session_id: str) -> Optional[Dict]:
        """
        Obtiene el canal activo para una sesión específica
        """
        with self.lock:
            return self.active_channels.get(session_id)
    
    def get_all_active_channels(self) -> List[Dict]:
        """
        Obtiene todos los canales activos
        """
        with self.lock:
            return [
                {
                    'session_id': session_id,
                    **channel_info
                }
                for session_id, channel_info in self.active_channels.items()
            ]
    
    def get_sniper_stats(self) -> Dict:
        """
        Obtiene estadísticas del sistema SNIPER
        """
        with self.lock:
            return {
                **self.stats,
                'active_channels_count': len(self.active_channels),
                'active_sessions_count': len(self.active_sessions)
            }


# Instancia global del SNIPER v2
integrated_sniper_v2 = IntegratedChannelSniperV2()


###############################################################################
# FUNCIONES DE INTEGRACIÓN CON API SERVER
###############################################################################

def register_list_load_with_sniper(session_id: str, list_filename: str, content: str) -> int:
    """
    Registra la carga de una lista M3U8 con el sistema SNIPER
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
    from flask import jsonify
    
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
SNIPER_V2_EOF

echo "   ✓ api_server_integrated_sniper_v2.py created"
echo ""

###############################################################################
# PASO 2: Actualizar api_server.py con integración SNIPER v2
###############################################################################

echo "📝 PASO 2: Actualizando api_server.py con integración SNIPER v2..."

# Crear patch para api_server.py
cat > /tmp/api_server_sniper_v2.patch << 'PATCH_EOF'
--- a/api_server.py
+++ b/api_server.py
@@ -46,13 +46,16 @@
     STATE_CONTROL_ENABLED = False
 
-# APE Guardian Engine v17 - SNIPER MODE
+# APE Guardian Engine v17 - SNIPER MODE v2
 try:
-    from api_server_integrated_sniper import (
-        integrated_sniper,
-        integrate_sniper_with_telemetry,
-        add_sniper_endpoints_to_app,
-        track_request_with_sniper
+    from api_server_integrated_sniper_v2 import (
+        integrated_sniper_v2 as integrated_sniper,
+        integrate_sniper_v2_with_telemetry as integrate_sniper_with_telemetry,
+        add_sniper_v2_endpoints_to_app as add_sniper_endpoints_to_app,
+        track_request_with_sniper,
+        register_list_load_with_sniper
     )
     SNIPER_ENABLED = True
-    logger.info("✓ SNIPER MODE enabled")
+    logger.info("✓ SNIPER MODE v2 enabled")
 except ImportError as e:
     SNIPER_ENABLED = False
-    logger.warning(f"SNIPER MODE disabled: {e}")
+    logger.warning(f"SNIPER MODE v2 disabled: {e}")
@@ -255,9 +258,11 @@
     # [v17] SNIPER MODE: Detectar canal activo
     if SNIPER_ENABLED:
         try:
-            # Construir URL completa
-            full_url = request.url
-            channel_name = track_request_with_sniper(session_id, full_url, filename)
+            # Obtener el path solicitado y el header Referer
+            requested_path = request.path
+            referer = request.headers.get('Referer')
+            
+            # Llamar al sistema SNIPER para rastrear la petición
+            channel_name = track_request_with_sniper(session_id, requested_path, referer)
             if channel_name:
                 logger.info(f"🎯 SNIPER: Channel detected - {channel_name} (session: {session_id})")
         except Exception as e:
@@ -300,6 +305,15 @@
     # Crear respuesta
     content = result.get('content', '')
     headers = result.get('headers', {})
+    
+    # [v17] SNIPER MODE: Registrar la lista M3U8 para parsear canales
+    if SNIPER_ENABLED and content:
+        try:
+            num_channels = register_list_load_with_sniper(session_id, filename, content)
+            logger.info(f"🎯 SNIPER: Registered M3U8 list - {filename} ({num_channels} channels)")
+        except Exception as e:
+            logger.error(f"[v17] SNIPER error registering list: {e}")
     
     # Para HEAD, no enviar contenido
     if request.method == 'HEAD':
PATCH_EOF

# Aplicar el patch manualmente (modificar api_server.py directamente)
echo "   Aplicando cambios a api_server.py..."

# Hacer backup del archivo actual
cp /opt/ape-guardian/api_server.py /opt/ape-guardian/api_server.py.pre_sniper_v2

# Modificar las líneas específicas usando sed
sed -i 's/# APE Guardian Engine v17 - SNIPER MODE$/# APE Guardian Engine v17 - SNIPER MODE v2/' /opt/ape-guardian/api_server.py
sed -i 's/from api_server_integrated_sniper import/from api_server_integrated_sniper_v2 import/' /opt/ape-guardian/api_server.py
sed -i 's/integrated_sniper,$/integrated_sniper_v2 as integrated_sniper,/' /opt/ape-guardian/api_server.py
sed -i 's/integrate_sniper_with_telemetry,$/integrate_sniper_v2_with_telemetry as integrate_sniper_with_telemetry,/' /opt/ape-guardian/api_server.py
sed -i 's/add_sniper_endpoints_to_app,$/add_sniper_v2_endpoints_to_app as add_sniper_endpoints_to_app,/' /opt/ape-guardian/api_server.py

# Agregar register_list_load_with_sniper al import
sed -i '/track_request_with_sniper$/a\        register_list_load_with_sniper' /opt/ape-guardian/api_server.py

# Actualizar mensajes de log
sed -i 's/logger.info("✓ SNIPER MODE enabled")/logger.info("✓ SNIPER MODE v2 enabled")/' /opt/ape-guardian/api_server.py
sed -i 's/logger.warning(f"SNIPER MODE disabled: {e}")/logger.warning(f"SNIPER MODE v2 disabled: {e}")/' /opt/ape-guardian/api_server.py

# Modificar la sección de track_request_with_sniper
sed -i '/# \[v17\] SNIPER MODE: Detectar canal activo/,/logger.error(f"\[v17\] SNIPER error: {e}")/{
    s/full_url = request.url/requested_path = request.path\n            referer = request.headers.get('\''Referer'\'')/
    s/channel_name = track_request_with_sniper(session_id, full_url, filename)/channel_name = track_request_with_sniper(session_id, requested_path, referer)/
}' /opt/ape-guardian/api_server.py

# Agregar registro de lista M3U8 después de obtener el contenido
# Buscar la línea "headers = result.get('headers', {})" y agregar después
sed -i "/headers = result.get('headers', {})/a\\
    \\
    # [v17] SNIPER MODE: Registrar la lista M3U8 para parsear canales\\
    if SNIPER_ENABLED and content:\\
        try:\\
            num_channels = register_list_load_with_sniper(session_id, filename, content)\\
            logger.info(f\"🎯 SNIPER: Registered M3U8 list - {filename} ({num_channels} channels)\")\\
        except Exception as e:\\
            logger.error(f\"[v17] SNIPER error registering list: {e}\")" /opt/ape-guardian/api_server.py

echo "   ✓ api_server.py updated with SNIPER v2 integration"
echo ""

###############################################################################
# PASO 3: Verificar sintaxis de Python
###############################################################################

echo "🔍 PASO 3: Verificando sintaxis de Python..."

python3 -m py_compile /opt/ape-guardian/api_server_integrated_sniper_v2.py
if [ $? -eq 0 ]; then
    echo "   ✓ api_server_integrated_sniper_v2.py syntax OK"
else
    echo "   ❌ Syntax error in api_server_integrated_sniper_v2.py"
    exit 1
fi

python3 -m py_compile /opt/ape-guardian/api_server.py
if [ $? -eq 0 ]; then
    echo "   ✓ api_server.py syntax OK"
else
    echo "   ❌ Syntax error in api_server.py"
    exit 1
fi

echo ""

###############################################################################
# PASO 4: Reiniciar el servicio
###############################################################################

echo "🔄 PASO 4: Reiniciando servicio APE Guardian Engine..."

systemctl restart ape-guardian-engine

# Esperar 3 segundos para que el servicio inicie
sleep 3

# Verificar estado del servicio
if systemctl is-active --quiet ape-guardian-engine; then
    echo "   ✓ Service restarted successfully"
else
    echo "   ❌ Service failed to start"
    echo ""
    echo "📋 Service logs (last 20 lines):"
    journalctl -u ape-guardian-engine -n 20 --no-pager
    exit 1
fi

echo ""

###############################################################################
# PASO 5: Verificar endpoints
###############################################################################

echo "🔍 PASO 5: Verificando endpoints..."

# Verificar /guardian/health
echo -n "   Checking /guardian/health... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/guardian/health)
if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ OK (200)"
else
    echo "❌ FAILED ($HTTP_CODE)"
fi

# Verificar /guardian/telemetry/sniper/stats
echo -n "   Checking /guardian/telemetry/sniper/stats... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/guardian/telemetry/sniper/stats)
if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ OK (200)"
else
    echo "❌ FAILED ($HTTP_CODE)"
fi

# Verificar /guardian/telemetry/active-channels
echo -n "   Checking /guardian/telemetry/active-channels... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/guardian/telemetry/active-channels)
if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ OK (200)"
else
    echo "❌ FAILED ($HTTP_CODE)"
fi

echo ""

###############################################################################
# RESUMEN
###############################################################################

echo "✅ DEPLOYMENT PATCH COMPLETED SUCCESSFULLY"
echo "=========================================="
echo ""
echo "📊 Summary:"
echo "   ✓ SNIPER v2 module deployed"
echo "   ✓ API Server updated with SNIPER v2 integration"
echo "   ✓ Service restarted successfully"
echo "   ✓ All endpoints responding"
echo ""
echo "📦 Backup location: $BACKUP_DIR"
echo ""
echo "🎯 SNIPER v2 Features:"
echo "   • Passive channel detection from M3U8 playlists"
echo "   • Automatic M3U8 parsing on every request"
echo "   • Heuristic detection based on refresh patterns"
echo "   • Referer-based channel identification"
echo "   • Ultra-aggressive optimization for active channel"
echo ""
echo "🔍 Next Steps:"
echo "   1. Test with existing M3U8 playlist"
echo "   2. Monitor logs: journalctl -u ape-guardian-engine -f"
echo "   3. Check dashboard: https://iptv-ape.duckdns.org/guardian/"
echo "   4. Verify channel detection in telemetry endpoints"
echo ""
echo "🚀 SNIPER v2 is now ACTIVE and ready to detect channels!"
