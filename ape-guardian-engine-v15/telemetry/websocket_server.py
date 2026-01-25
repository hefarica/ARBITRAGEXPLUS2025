"""
APE Guardian Engine v15 - WebSocket Server
===========================================
Servidor WebSocket para streaming de telemetría en tiempo real.
"""

import json
import time
import asyncio
import logging
import threading
from typing import Dict, Set, Optional, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Intentar importar websockets, si no está disponible usar fallback
try:
    import websockets
    from websockets.server import serve
    WEBSOCKETS_AVAILABLE = True
except ImportError:
    WEBSOCKETS_AVAILABLE = False
    logger.warning("websockets package not available, WebSocket server disabled")


@dataclass
class WebSocketClient:
    """Representa un cliente WebSocket conectado."""
    client_id: str
    websocket: Any
    subscribed_sessions: Set[str]
    connected_at: float
    last_ping: float


class TelemetryWebSocketServer:
    """
    Servidor WebSocket para streaming de telemetría.
    
    Responsabilidades:
    - Aceptar conexiones de clientes (panel de control)
    - Enviar métricas en tiempo real
    - Gestionar suscripciones a sesiones específicas
    """
    
    def __init__(self, host: str = '0.0.0.0', port: int = 8081):
        """
        Inicializa el servidor WebSocket.
        
        Args:
            host: Host para escuchar
            port: Puerto para WebSocket
        """
        self.host = host
        self.port = port
        self._clients: Dict[str, WebSocketClient] = {}
        self._running = False
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._server = None
        
        logger.info(f"WebSocket Server initialized on {host}:{port}")
    
    async def _handle_client(self, websocket, path):
        """Maneja una conexión de cliente."""
        client_id = f"client_{int(time.time() * 1000)}"
        
        client = WebSocketClient(
            client_id=client_id,
            websocket=websocket,
            subscribed_sessions=set(),
            connected_at=time.time(),
            last_ping=time.time()
        )
        
        self._clients[client_id] = client
        logger.info(f"WebSocket client connected: {client_id}")
        
        try:
            # Enviar mensaje de bienvenida
            await websocket.send(json.dumps({
                'type': 'connected',
                'client_id': client_id,
                'timestamp': time.time()
            }))
            
            async for message in websocket:
                await self._handle_message(client, message)
                
        except Exception as e:
            logger.error(f"WebSocket error for {client_id}: {e}")
        finally:
            del self._clients[client_id]
            logger.info(f"WebSocket client disconnected: {client_id}")
    
    async def _handle_message(self, client: WebSocketClient, message: str):
        """Procesa un mensaje del cliente."""
        try:
            data = json.loads(message)
            msg_type = data.get('type')
            
            if msg_type == 'subscribe':
                # Suscribirse a una sesión
                session_id = data.get('session_id')
                if session_id:
                    client.subscribed_sessions.add(session_id)
                    await client.websocket.send(json.dumps({
                        'type': 'subscribed',
                        'session_id': session_id
                    }))
            
            elif msg_type == 'unsubscribe':
                # Desuscribirse de una sesión
                session_id = data.get('session_id')
                if session_id:
                    client.subscribed_sessions.discard(session_id)
                    await client.websocket.send(json.dumps({
                        'type': 'unsubscribed',
                        'session_id': session_id
                    }))
            
            elif msg_type == 'ping':
                # Responder ping
                client.last_ping = time.time()
                await client.websocket.send(json.dumps({
                    'type': 'pong',
                    'timestamp': time.time()
                }))
            
            elif msg_type == 'get_system_metrics':
                # Enviar métricas del sistema
                from .realtime_collector import get_telemetry_collector
                collector = get_telemetry_collector()
                metrics = collector.get_system_metrics()
                await client.websocket.send(json.dumps({
                    'type': 'system_metrics',
                    'data': metrics
                }))
            
        except json.JSONDecodeError:
            logger.warning(f"Invalid JSON from client: {message[:100]}")
        except Exception as e:
            logger.error(f"Error handling message: {e}")
    
    async def broadcast_metrics(self, session_id: str, metrics: Dict[str, Any]):
        """Envía métricas a todos los clientes suscritos a una sesión."""
        message = json.dumps({
            'type': 'metrics',
            'session_id': session_id,
            'data': metrics,
            'timestamp': time.time()
        })
        
        for client in list(self._clients.values()):
            if session_id in client.subscribed_sessions or '*' in client.subscribed_sessions:
                try:
                    await client.websocket.send(message)
                except Exception as e:
                    logger.error(f"Error sending to client {client.client_id}: {e}")
    
    async def broadcast_system_metrics(self, metrics: Dict[str, Any]):
        """Envía métricas del sistema a todos los clientes."""
        message = json.dumps({
            'type': 'system_metrics',
            'data': metrics,
            'timestamp': time.time()
        })
        
        for client in list(self._clients.values()):
            try:
                await client.websocket.send(message)
            except Exception as e:
                logger.error(f"Error sending system metrics to {client.client_id}: {e}")
    
    async def _run_server(self):
        """Ejecuta el servidor WebSocket."""
        if not WEBSOCKETS_AVAILABLE:
            logger.error("websockets package not available")
            return
        
        self._running = True
        
        async with serve(self._handle_client, self.host, self.port):
            logger.info(f"WebSocket server running on ws://{self.host}:{self.port}")
            while self._running:
                await asyncio.sleep(1)
    
    def start(self):
        """Inicia el servidor WebSocket en un thread separado."""
        if not WEBSOCKETS_AVAILABLE:
            logger.warning("WebSocket server not started (websockets not available)")
            return
        
        def run_loop():
            self._loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self._loop)
            self._loop.run_until_complete(self._run_server())
        
        thread = threading.Thread(target=run_loop, daemon=True)
        thread.start()
        logger.info("WebSocket server thread started")
    
    def stop(self):
        """Detiene el servidor WebSocket."""
        self._running = False
        if self._loop:
            self._loop.call_soon_threadsafe(self._loop.stop)
        logger.info("WebSocket server stopped")
    
    def get_connected_clients(self) -> int:
        """Retorna el número de clientes conectados."""
        return len(self._clients)
    
    def get_client_info(self) -> list:
        """Retorna información de todos los clientes conectados."""
        return [
            {
                'client_id': c.client_id,
                'connected_at': c.connected_at,
                'subscribed_sessions': list(c.subscribed_sessions),
                'last_ping': c.last_ping
            }
            for c in self._clients.values()
        ]


# Singleton global
_websocket_server: Optional[TelemetryWebSocketServer] = None


def get_websocket_server(host: str = '0.0.0.0', port: int = 8081) -> TelemetryWebSocketServer:
    """Obtiene la instancia global del WebSocket server."""
    global _websocket_server
    if _websocket_server is None:
        _websocket_server = TelemetryWebSocketServer(host, port)
    return _websocket_server
