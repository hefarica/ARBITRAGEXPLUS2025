"""
APE Guardian Engine v15 - Realtime Telemetry Collector
=======================================================
Recolección de métricas en tiempo real con doble nivel (micro/macro).
"""

import time
import logging
import threading
import statistics
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from collections import deque

logger = logging.getLogger(__name__)

@dataclass
class MicroSnapshot:
    """Snapshot de métricas cada 100ms (nivel táctico)."""
    timestamp: float
    throughput_mbps: float
    rtt_ms: float
    packet_loss_pct: float
    jitter_ms: float
    buffer_level_ms: float
    ttfb_ms: float
    http_status: int
    segment_size_bytes: int
    download_time_ms: float


@dataclass
class MacroAggregate:
    """Agregado de métricas cada 10s (nivel estratégico)."""
    timestamp: float
    avg_throughput_mbps: float
    min_throughput_mbps: float
    max_throughput_mbps: float
    std_throughput_mbps: float
    avg_rtt_ms: float
    avg_packet_loss_pct: float
    avg_jitter_ms: float
    avg_buffer_level_ms: float
    success_rate: float
    stability_score: float
    trend: str  # 'improving', 'stable', 'degrading'
    samples_count: int


class SessionTelemetry:
    """Telemetría para una sesión específica."""
    
    def __init__(self, session_id: str, micro_buffer_size: int = 100, macro_buffer_size: int = 30):
        """
        Inicializa telemetría de sesión.
        
        Args:
            session_id: ID de la sesión
            micro_buffer_size: Tamaño del buffer de micro-snapshots
            macro_buffer_size: Tamaño del buffer de macro-aggregates
        """
        self.session_id = session_id
        self.micro_snapshots: deque = deque(maxlen=micro_buffer_size)
        self.macro_aggregates: deque = deque(maxlen=macro_buffer_size)
        self.last_macro_time = time.time()
        self.macro_interval = 10.0  # segundos
        
        # Contadores de éxito/error
        self.success_count = 0
        self.error_count = 0
        
        # EWMA para throughput suavizado
        self.ewma_throughput = None
        self.ewma_alpha = 0.3
    
    def add_micro_snapshot(
        self,
        throughput_mbps: float,
        rtt_ms: float = 0.0,
        packet_loss_pct: float = 0.0,
        jitter_ms: float = 0.0,
        buffer_level_ms: float = 0.0,
        ttfb_ms: float = 0.0,
        http_status: int = 200,
        segment_size_bytes: int = 0,
        download_time_ms: float = 0.0
    ):
        """Agrega un micro-snapshot."""
        snapshot = MicroSnapshot(
            timestamp=time.time(),
            throughput_mbps=throughput_mbps,
            rtt_ms=rtt_ms,
            packet_loss_pct=packet_loss_pct,
            jitter_ms=jitter_ms,
            buffer_level_ms=buffer_level_ms,
            ttfb_ms=ttfb_ms,
            http_status=http_status,
            segment_size_bytes=segment_size_bytes,
            download_time_ms=download_time_ms
        )
        
        self.micro_snapshots.append(snapshot)
        
        # Actualizar EWMA
        if self.ewma_throughput is None:
            self.ewma_throughput = throughput_mbps
        else:
            self.ewma_throughput = (
                self.ewma_alpha * throughput_mbps +
                (1 - self.ewma_alpha) * self.ewma_throughput
            )
        
        # Actualizar contadores
        if 200 <= http_status < 300:
            self.success_count += 1
        else:
            self.error_count += 1
        
        # Verificar si es tiempo de crear macro-aggregate
        if time.time() - self.last_macro_time >= self.macro_interval:
            self._create_macro_aggregate()
    
    def _create_macro_aggregate(self):
        """Crea un macro-aggregate de los últimos micro-snapshots."""
        if not self.micro_snapshots:
            return
        
        # Obtener snapshots del último intervalo
        now = time.time()
        recent = [
            s for s in self.micro_snapshots
            if now - s.timestamp <= self.macro_interval
        ]
        
        if not recent:
            return
        
        throughputs = [s.throughput_mbps for s in recent]
        
        # Calcular tendencia
        if len(throughputs) >= 3:
            first_half = statistics.mean(throughputs[:len(throughputs)//2])
            second_half = statistics.mean(throughputs[len(throughputs)//2:])
            if second_half > first_half * 1.1:
                trend = 'improving'
            elif second_half < first_half * 0.9:
                trend = 'degrading'
            else:
                trend = 'stable'
        else:
            trend = 'stable'
        
        # Calcular stability score (0-1)
        if len(throughputs) > 1:
            cv = statistics.stdev(throughputs) / statistics.mean(throughputs) if statistics.mean(throughputs) > 0 else 1
            stability_score = max(0, min(1, 1 - cv))
        else:
            stability_score = 1.0
        
        aggregate = MacroAggregate(
            timestamp=now,
            avg_throughput_mbps=statistics.mean(throughputs),
            min_throughput_mbps=min(throughputs),
            max_throughput_mbps=max(throughputs),
            std_throughput_mbps=statistics.stdev(throughputs) if len(throughputs) > 1 else 0,
            avg_rtt_ms=statistics.mean([s.rtt_ms for s in recent]),
            avg_packet_loss_pct=statistics.mean([s.packet_loss_pct for s in recent]),
            avg_jitter_ms=statistics.mean([s.jitter_ms for s in recent]),
            avg_buffer_level_ms=statistics.mean([s.buffer_level_ms for s in recent]),
            success_rate=self.success_count / (self.success_count + self.error_count) if (self.success_count + self.error_count) > 0 else 1.0,
            stability_score=stability_score,
            trend=trend,
            samples_count=len(recent)
        )
        
        self.macro_aggregates.append(aggregate)
        self.last_macro_time = now
    
    def get_current_metrics(self) -> Optional[Dict[str, Any]]:
        """Obtiene las métricas actuales."""
        if not self.micro_snapshots:
            return None
        
        latest = self.micro_snapshots[-1]
        
        return {
            'timestamp': latest.timestamp,
            'throughput_mbps': latest.throughput_mbps,
            'ewma_throughput_mbps': self.ewma_throughput or 0.0,
            'rtt_ms': latest.rtt_ms,
            'packet_loss_pct': latest.packet_loss_pct,
            'jitter_ms': latest.jitter_ms,
            'buffer_level_ms': latest.buffer_level_ms,
            'ttfb_ms': latest.ttfb_ms,
            'http_status': latest.http_status,
            'success_rate': self.success_count / (self.success_count + self.error_count) if (self.success_count + self.error_count) > 0 else 1.0,
            'stability_score': self._calculate_current_stability(),
        }
    
    def get_current_macro(self) -> Optional[Dict[str, Any]]:
        """Obtiene el último macro-aggregate."""
        if not self.macro_aggregates:
            return None
        
        latest = self.macro_aggregates[-1]
        return {
            'timestamp': latest.timestamp,
            'avg_throughput_mbps': latest.avg_throughput_mbps,
            'min_throughput_mbps': latest.min_throughput_mbps,
            'max_throughput_mbps': latest.max_throughput_mbps,
            'std_throughput_mbps': latest.std_throughput_mbps,
            'avg_rtt_ms': latest.avg_rtt_ms,
            'avg_packet_loss_pct': latest.avg_packet_loss_pct,
            'avg_jitter_ms': latest.avg_jitter_ms,
            'avg_buffer_level_ms': latest.avg_buffer_level_ms,
            'success_rate': latest.success_rate,
            'stability_score': latest.stability_score,
            'trend': latest.trend,
            'samples_count': latest.samples_count,
        }
    
    def _calculate_current_stability(self) -> float:
        """Calcula el score de estabilidad actual."""
        if len(self.micro_snapshots) < 5:
            return 1.0
        
        recent = list(self.micro_snapshots)[-10:]
        throughputs = [s.throughput_mbps for s in recent]
        
        if not throughputs or statistics.mean(throughputs) == 0:
            return 1.0
        
        cv = statistics.stdev(throughputs) / statistics.mean(throughputs) if len(throughputs) > 1 else 0
        return max(0, min(1, 1 - cv))
    
    def get_throughput_history(self, seconds: int = 60) -> List[float]:
        """Obtiene historial de throughput."""
        now = time.time()
        return [
            s.throughput_mbps
            for s in self.micro_snapshots
            if now - s.timestamp <= seconds
        ]


class TelemetryCollector:
    """
    Colector central de telemetría.
    
    Responsabilidades:
    - Gestionar telemetría de múltiples sesiones
    - Proporcionar métricas agregadas del sistema
    - Exponer datos para WebSocket
    """
    
    def __init__(self):
        """Inicializa el colector de telemetría."""
        self._sessions: Dict[str, SessionTelemetry] = {}
        self._lock = threading.Lock()
        self._start_time = time.time()
        
        logger.info("Telemetry Collector initialized")
    
    def get_or_create_session(self, session_id: str) -> SessionTelemetry:
        """Obtiene o crea telemetría de sesión."""
        with self._lock:
            if session_id not in self._sessions:
                self._sessions[session_id] = SessionTelemetry(session_id)
                logger.debug(f"Created telemetry for session: {session_id}")
            return self._sessions[session_id]
    
    def record_metric(
        self,
        session_id: str,
        throughput_mbps: float,
        rtt_ms: float = 0.0,
        packet_loss_pct: float = 0.0,
        jitter_ms: float = 0.0,
        buffer_level_ms: float = 0.0,
        ttfb_ms: float = 0.0,
        http_status: int = 200,
        segment_size_bytes: int = 0,
        download_time_ms: float = 0.0
    ):
        """Registra una métrica para una sesión."""
        telemetry = self.get_or_create_session(session_id)
        telemetry.add_micro_snapshot(
            throughput_mbps=throughput_mbps,
            rtt_ms=rtt_ms,
            packet_loss_pct=packet_loss_pct,
            jitter_ms=jitter_ms,
            buffer_level_ms=buffer_level_ms,
            ttfb_ms=ttfb_ms,
            http_status=http_status,
            segment_size_bytes=segment_size_bytes,
            download_time_ms=download_time_ms
        )
    
    def get_session_metrics(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Obtiene métricas de una sesión."""
        with self._lock:
            if session_id not in self._sessions:
                return None
            return self._sessions[session_id].get_current_metrics()
    
    def get_session_macro(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Obtiene macro-aggregate de una sesión."""
        with self._lock:
            if session_id not in self._sessions:
                return None
            return self._sessions[session_id].get_current_macro()
    
    def get_system_metrics(self) -> Dict[str, Any]:
        """Obtiene métricas agregadas del sistema."""
        with self._lock:
            active_sessions = len(self._sessions)
            
            if not self._sessions:
                return {
                    'uptime_seconds': time.time() - self._start_time,
                    'active_sessions': 0,
                    'avg_throughput_mbps': 0.0,
                    'avg_success_rate': 1.0,
                    'avg_stability_score': 1.0,
                }
            
            # Agregar métricas de todas las sesiones
            throughputs = []
            success_rates = []
            stability_scores = []
            
            for telemetry in self._sessions.values():
                metrics = telemetry.get_current_metrics()
                if metrics:
                    throughputs.append(metrics['throughput_mbps'])
                    success_rates.append(metrics['success_rate'])
                    stability_scores.append(metrics['stability_score'])
            
            return {
                'uptime_seconds': time.time() - self._start_time,
                'active_sessions': active_sessions,
                'avg_throughput_mbps': statistics.mean(throughputs) if throughputs else 0.0,
                'avg_success_rate': statistics.mean(success_rates) if success_rates else 1.0,
                'avg_stability_score': statistics.mean(stability_scores) if stability_scores else 1.0,
            }
    
    def cleanup_session(self, session_id: str):
        """Limpia telemetría de una sesión."""
        with self._lock:
            if session_id in self._sessions:
                del self._sessions[session_id]
                logger.debug(f"Cleaned up telemetry for session: {session_id}")


# Singleton global
_telemetry_collector: Optional[TelemetryCollector] = None


def get_telemetry_collector() -> TelemetryCollector:
    """Obtiene la instancia global del TelemetryCollector."""
    global _telemetry_collector
    if _telemetry_collector is None:
        _telemetry_collector = TelemetryCollector()
    return _telemetry_collector
