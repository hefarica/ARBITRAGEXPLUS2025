"""
APE Guardian Engine v15 - API Server
=====================================
Servidor Flask que expone el Guardian Engine via REST API.
"""

import os
import sys
import time
import hashlib
import logging
from functools import wraps
from flask import Flask, request, jsonify, Response
from flask_cors import CORS

# Agregar directorio al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.settings import Settings
from guardian_engine import GuardianEngine

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Crear aplicación Flask
app = Flask(__name__)
CORS(app)

# Inicializar Guardian Engine
guardian = GuardianEngine(m3u8_directory=Settings.M3U8_DIRECTORY)


def extract_session_id(jwt_token: str) -> str:
    """Genera un session_id único basado en el JWT."""
    return f"session_{hashlib.md5(jwt_token.encode()).hexdigest()[:16]}"


def get_client_ip() -> str:
    """Obtiene la IP real del cliente."""
    # Intentar obtener IP de headers de proxy
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0].strip()
    if request.headers.get('X-Real-IP'):
        return request.headers.get('X-Real-IP')
    return request.remote_addr or '127.0.0.1'


# ==================== ENDPOINTS ====================

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify(guardian.get_health())


@app.route('/session/create', methods=['POST'])
def create_session():
    """
    Crea una nueva sesión de streaming.
    
    Body JSON:
        - jwt_token: Token JWT con configuración
    """
    data = request.get_json() or {}
    jwt_token = data.get('jwt_token') or request.args.get('t')
    
    if not jwt_token:
        return jsonify({'error': 'JWT token required'}), 400
    
    session_id = extract_session_id(jwt_token)
    client_ip = get_client_ip()
    
    success, result = guardian.create_session(session_id, jwt_token, client_ip)
    
    if success:
        return jsonify({
            'success': True,
            'session_id': session_id,
            'session': result,
        })
    else:
        return jsonify({
            'success': False,
            'error': result.get('error', 'Unknown error'),
        }), 400


@app.route('/session/<session_id>/stats', methods=['GET'])
def get_session_stats(session_id: str):
    """Obtiene estadísticas de una sesión."""
    stats = guardian.get_session_stats(session_id)
    
    if stats is None:
        return jsonify({'error': 'Session not found'}), 404
    
    return jsonify(stats)


@app.route('/session/<session_id>/telemetry', methods=['GET'])
def get_session_telemetry(session_id: str):
    """Obtiene telemetría en tiempo real de una sesión."""
    telemetry = guardian.get_realtime_telemetry(session_id)
    
    if telemetry is None:
        return jsonify({'error': 'Session not found'}), 404
    
    return jsonify(telemetry)


@app.route('/session/<session_id>/telemetry', methods=['POST'])
def record_telemetry(session_id: str):
    """
    Registra métricas de telemetría.
    
    Body JSON:
        - throughput_mbps: Throughput en Mbps
        - rtt_ms: Latencia RTT en ms
        - buffer_ms: Nivel de buffer en ms
        - packet_loss: Pérdida de paquetes (0-1)
        - jitter_ms: Jitter en ms
    """
    data = request.get_json() or {}
    
    guardian.record_telemetry(
        session_id=session_id,
        throughput_mbps=data.get('throughput_mbps', 0),
        rtt_ms=data.get('rtt_ms', 0),
        buffer_ms=data.get('buffer_ms', 0),
        packet_loss=data.get('packet_loss', 0),
        jitter_ms=data.get('jitter_ms', 0),
    )
    
    return jsonify({'success': True})


@app.route('/session/<session_id>/error', methods=['POST'])
def handle_error(session_id: str):
    """
    Maneja un error HTTP.
    
    Body JSON:
        - error_code: Código de error HTTP
        - retry_after: Valor de Retry-After (opcional)
    """
    data = request.get_json() or {}
    error_code = data.get('error_code')
    
    if not error_code:
        return jsonify({'error': 'error_code required'}), 400
    
    result = guardian.handle_error(
        session_id=session_id,
        error_code=error_code,
        retry_after=data.get('retry_after'),
    )
    
    return jsonify(result)


@app.route('/session/<session_id>/cleanup', methods=['POST', 'DELETE'])
def cleanup_session(session_id: str):
    """Limpia una sesión."""
    guardian.cleanup_session(session_id)
    return jsonify({'success': True})


@app.route('/<path:filename>', methods=['GET', 'HEAD'])
def serve_m3u8(filename: str):
    """
    Sirve un archivo M3U8 con headers ABR.
    
    Query params:
        - t: Token JWT
    """
    # Solo procesar archivos .m3u8
    if not filename.endswith('.m3u8'):
        return jsonify({'error': 'Only .m3u8 files supported'}), 400
    
    # Obtener JWT
    jwt_token = request.args.get('t')
    
    if not jwt_token:
        return jsonify({'error': 'JWT token required (use ?t=TOKEN)'}), 401
    
    # Generar session_id
    session_id = extract_session_id(jwt_token)
    client_ip = get_client_ip()
    
    # Procesar petición
    success, result = guardian.process_m3u8_request(
        session_id=session_id,
        filename=filename,
        jwt_token=jwt_token,
        client_ip=client_ip,
    )
    
    if not success:
        error = result.get('error', 'Unknown error')
        if 'not found' in error.lower():
            return jsonify({'error': error}), 404
        elif 'jwt' in error.lower() or 'token' in error.lower():
            return jsonify({'error': error}), 401
        else:
            return jsonify({'error': error}), 500
    
    # Crear respuesta
    content = result.get('content', '')
    headers = result.get('headers', {})
    
    # Para HEAD, no enviar contenido
    if request.method == 'HEAD':
        response = Response('', status=200)
    else:
        response = Response(content, status=200)
    
    # Agregar headers
    for key, value in headers.items():
        response.headers[key] = str(value)
    
    return response


@app.route('/profiles', methods=['GET'])
def get_profiles():
    """Obtiene todos los perfiles ABR disponibles."""
    return jsonify(guardian.profile_manager.get_profile_summary())


@app.route('/profiles/<profile_id>', methods=['GET'])
def get_profile(profile_id: str):
    """Obtiene un perfil específico."""
    profile = guardian.profile_manager.get_profile(profile_id)
    
    if profile is None:
        return jsonify({'error': 'Profile not found'}), 404
    
    return jsonify(profile)


@app.route('/error-strategies', methods=['GET'])
def get_error_strategies():
    """Obtiene todas las estrategias de recuperación de errores."""
    return jsonify(guardian.error_recovery.get_all_strategies())


@app.route('/ml/stats', methods=['GET'])
def get_ml_stats():
    """Obtiene estadísticas del sistema de Machine Learning."""
    return jsonify(guardian.ml_tuner.get_learning_stats())


@app.route('/ml/parameters', methods=['GET'])
def get_ml_parameters():
    """Obtiene los parámetros optimizados actuales."""
    return jsonify(guardian.ml_tuner.get_optimized_parameters())


# ==================== ERROR HANDLERS ====================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal error: {error}")
    return jsonify({'error': 'Internal server error'}), 500


# ==================== MAIN ====================

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    debug = os.environ.get('DEBUG', 'false').lower() == 'true'
    
    logger.info(f"Starting APE Guardian Engine API Server on port {port}")
    
    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug,
        threaded=True,
    )
