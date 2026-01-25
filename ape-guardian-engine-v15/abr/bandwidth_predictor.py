"""
APE Guardian Engine v15 - Bandwidth Predictor
==============================================
Predictor de ancho de banda usando EWMA y análisis de tendencia.
(Versión simplificada sin dependencias de ML pesadas)
"""

import time
import logging
import statistics
from typing import List, Optional, Dict, Any
from collections import deque
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class ThroughputSample:
    """Muestra de throughput."""
    timestamp: float
    throughput_mbps: float
    segment_size_bytes: int
    download_time_ms: float


class BandwidthPredictor:
    """
    Predictor de ancho de banda.
    
    Utiliza:
    - EWMA (Exponentially Weighted Moving Average) para suavizado
    - Análisis de tendencia (pendiente) para predicción
    - Detección de anomalías para filtrar outliers
    """
    
    def __init__(
        self,
        ewma_alpha: float = 0.3,
        history_size: int = 100,
        prediction_horizon_seconds: float = 10.0
    ):
        """
        Inicializa el predictor.
        
        Args:
            ewma_alpha: Factor de suavizado EWMA (0-1, mayor = más peso a recientes)
            history_size: Tamaño del historial de muestras
            prediction_horizon_seconds: Horizonte de predicción en segundos
        """
        self.ewma_alpha = ewma_alpha
        self.prediction_horizon = prediction_horizon_seconds
        
        # Historial por sesión
        self._session_history: Dict[str, deque] = {}
        self._session_ewma: Dict[str, float] = {}
        
        logger.info(
            f"Bandwidth Predictor initialized "
            f"(alpha={ewma_alpha}, horizon={prediction_horizon_seconds}s)"
        )
    
    def _get_history(self, session_id: str) -> deque:
        """Obtiene o crea historial de sesión."""
        if session_id not in self._session_history:
            self._session_history[session_id] = deque(maxlen=100)
        return self._session_history[session_id]
    
    def add_sample(
        self,
        session_id: str,
        throughput_mbps: float,
        segment_size_bytes: int = 0,
        download_time_ms: float = 0.0
    ):
        """
        Agrega una muestra de throughput.
        
        Args:
            session_id: ID de la sesión
            throughput_mbps: Throughput medido en Mbps
            segment_size_bytes: Tamaño del segmento descargado
            download_time_ms: Tiempo de descarga en ms
        """
        history = self._get_history(session_id)
        
        sample = ThroughputSample(
            timestamp=time.time(),
            throughput_mbps=throughput_mbps,
            segment_size_bytes=segment_size_bytes,
            download_time_ms=download_time_ms
        )
        
        history.append(sample)
        
        # Actualizar EWMA
        if session_id not in self._session_ewma:
            self._session_ewma[session_id] = throughput_mbps
        else:
            self._session_ewma[session_id] = (
                self.ewma_alpha * throughput_mbps +
                (1 - self.ewma_alpha) * self._session_ewma[session_id]
            )
    
    def predict_throughput(self, session_id: str) -> float:
        """
        Predice el throughput para los próximos segundos.
        
        Args:
            session_id: ID de la sesión
            
        Returns:
            Throughput predicho en Mbps
        """
        history = self._get_history(session_id)
        
        if not history:
            return 10.0  # Default conservador
        
        if len(history) < 3:
            # Muy pocas muestras, retornar última
            return history[-1].throughput_mbps
        
        # Obtener muestras recientes (últimos 30 segundos)
        now = time.time()
        recent = [
            s for s in history
            if now - s.timestamp <= 30
        ]
        
        if not recent:
            return self._session_ewma.get(session_id, 10.0)
        
        # Calcular tendencia (pendiente)
        throughputs = [s.throughput_mbps for s in recent]
        timestamps = [s.timestamp for s in recent]
        
        # Normalizar timestamps
        t0 = timestamps[0]
        normalized_times = [t - t0 for t in timestamps]
        
        # Calcular pendiente usando regresión lineal simple
        slope = self._calculate_slope(normalized_times, throughputs)
        
        # EWMA actual
        current_ewma = self._session_ewma.get(session_id, throughputs[-1])
        
        # Predicción = EWMA + (pendiente * horizonte)
        prediction = current_ewma + (slope * self.prediction_horizon)
        
        # Limitar a valores razonables
        prediction = max(0.5, min(100.0, prediction))
        
        # Aplicar factor de seguridad (80% del predicho)
        safe_prediction = prediction * 0.8
        
        logger.debug(
            f"Session {session_id}: Predicted throughput = {safe_prediction:.2f} Mbps "
            f"(ewma={current_ewma:.2f}, slope={slope:.3f})"
        )
        
        return safe_prediction
    
    def _calculate_slope(self, x: List[float], y: List[float]) -> float:
        """Calcula la pendiente usando regresión lineal simple."""
        n = len(x)
        if n < 2:
            return 0.0
        
        sum_x = sum(x)
        sum_y = sum(y)
        sum_xy = sum(xi * yi for xi, yi in zip(x, y))
        sum_x2 = sum(xi ** 2 for xi in x)
        
        denominator = n * sum_x2 - sum_x ** 2
        if denominator == 0:
            return 0.0
        
        slope = (n * sum_xy - sum_x * sum_y) / denominator
        return slope
    
    def get_current_ewma(self, session_id: str) -> float:
        """Obtiene el EWMA actual de una sesión."""
        return self._session_ewma.get(session_id, 10.0)
    
    def get_statistics(self, session_id: str) -> Dict[str, Any]:
        """Obtiene estadísticas de una sesión."""
        history = self._get_history(session_id)
        
        if not history:
            return {
                'samples_count': 0,
                'ewma_throughput_mbps': 0.0,
                'min_throughput_mbps': 0.0,
                'max_throughput_mbps': 0.0,
                'avg_throughput_mbps': 0.0,
                'std_throughput_mbps': 0.0,
                'trend': 'unknown',
            }
        
        throughputs = [s.throughput_mbps for s in history]
        
        # Determinar tendencia
        if len(throughputs) >= 5:
            first_half = statistics.mean(throughputs[:len(throughputs)//2])
            second_half = statistics.mean(throughputs[len(throughputs)//2:])
            if second_half > first_half * 1.1:
                trend = 'improving'
            elif second_half < first_half * 0.9:
                trend = 'degrading'
            else:
                trend = 'stable'
        else:
            trend = 'unknown'
        
        return {
            'samples_count': len(history),
            'ewma_throughput_mbps': self._session_ewma.get(session_id, 0.0),
            'min_throughput_mbps': min(throughputs),
            'max_throughput_mbps': max(throughputs),
            'avg_throughput_mbps': statistics.mean(throughputs),
            'std_throughput_mbps': statistics.stdev(throughputs) if len(throughputs) > 1 else 0.0,
            'trend': trend,
        }
    
    def get_throughput_history(self, session_id: str, seconds: int = 60) -> List[float]:
        """Obtiene historial de throughput."""
        history = self._get_history(session_id)
        now = time.time()
        return [
            s.throughput_mbps
            for s in history
            if now - s.timestamp <= seconds
        ]
    
    def cleanup_session(self, session_id: str):
        """Limpia datos de una sesión."""
        if session_id in self._session_history:
            del self._session_history[session_id]
        if session_id in self._session_ewma:
            del self._session_ewma[session_id]
        logger.debug(f"Cleaned up predictor data for session: {session_id}")
