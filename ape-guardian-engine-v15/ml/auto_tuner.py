"""
APE Guardian Engine v15 - Machine Learning Auto-Tuner
======================================================
Sistema de aprendizaje automático para auto-ajuste de parámetros ABR.
"""

import time
import logging
import random
import statistics
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, field
from collections import deque

logger = logging.getLogger(__name__)


@dataclass
class Experience:
    """Experiencia de aprendizaje."""
    state: Dict[str, float]
    action: str
    reward: float
    next_state: Dict[str, float]
    timestamp: float


@dataclass
class ParameterConfig:
    """Configuración de un parámetro optimizable."""
    name: str
    min_value: float
    max_value: float
    current_value: float
    step_size: float
    description: str


class MLAutoTuner:
    """
    Sistema de Machine Learning para auto-ajuste de parámetros.
    
    Implementa:
    1. Q-Learning simplificado para selección de acciones
    2. Optimización bayesiana simplificada para parámetros
    3. Detección de anomalías basada en estadísticas
    """
    
    # Parámetros optimizables
    TUNABLE_PARAMETERS = {
        'ewma_alpha': ParameterConfig('ewma_alpha', 0.1, 0.5, 0.3, 0.05, 'Factor de suavizado EWMA'),
        'buffer_target_ms': ParameterConfig('buffer_target_ms', 3000, 15000, 5000, 1000, 'Buffer objetivo en ms'),
        'parallel_segments': ParameterConfig('parallel_segments', 1, 8, 4, 1, 'Segmentos paralelos'),
        'prefetch_segments': ParameterConfig('prefetch_segments', 1, 6, 3, 1, 'Segmentos de prefetch'),
        'stability_threshold': ParameterConfig('stability_threshold', 0.5, 0.9, 0.7, 0.05, 'Umbral de estabilidad'),
        'failback_seconds': ParameterConfig('failback_seconds', 30, 120, 60, 10, 'Segundos para failback'),
    }
    
    def __init__(
        self,
        learning_rate: float = 0.1,
        discount_factor: float = 0.95,
        exploration_rate: float = 0.1,
        experience_buffer_size: int = 1000
    ):
        """
        Inicializa el auto-tuner.
        
        Args:
            learning_rate: Tasa de aprendizaje (alpha)
            discount_factor: Factor de descuento (gamma)
            exploration_rate: Tasa de exploración (epsilon)
            experience_buffer_size: Tamaño del buffer de experiencias
        """
        self.learning_rate = learning_rate
        self.discount_factor = discount_factor
        self.exploration_rate = exploration_rate
        
        # Buffer de experiencias
        self.experiences: deque = deque(maxlen=experience_buffer_size)
        
        # Q-Table simplificada (estado discretizado -> valores de acción)
        self.q_table: Dict[str, Dict[str, float]] = {}
        
        # Parámetros actuales
        self.parameters = {
            name: config.current_value
            for name, config in self.TUNABLE_PARAMETERS.items()
        }
        
        # Historial de rendimiento
        self.performance_history: deque = deque(maxlen=100)
        
        # Estadísticas de anomalías
        self.anomaly_baseline: Dict[str, Dict[str, float]] = {}
        
        logger.info("ML Auto-Tuner initialized")
    
    def discretize_state(self, state: Dict[str, float]) -> str:
        """Discretiza un estado continuo para la Q-table."""
        # Discretizar métricas clave
        throughput_level = 'low' if state.get('throughput_mbps', 0) < 5 else 'medium' if state.get('throughput_mbps', 0) < 15 else 'high'
        buffer_level = 'critical' if state.get('buffer_ms', 0) < 3000 else 'low' if state.get('buffer_ms', 0) < 8000 else 'healthy'
        stability = 'unstable' if state.get('stability_score', 0) < 0.5 else 'moderate' if state.get('stability_score', 0) < 0.8 else 'stable'
        
        return f"{throughput_level}_{buffer_level}_{stability}"
    
    def get_possible_actions(self) -> List[str]:
        """Obtiene las acciones posibles."""
        return [
            'increase_buffer',
            'decrease_buffer',
            'increase_parallel',
            'decrease_parallel',
            'increase_prefetch',
            'decrease_prefetch',
            'increase_stability_threshold',
            'decrease_stability_threshold',
            'maintain',
        ]
    
    def select_action(self, state: Dict[str, float]) -> str:
        """
        Selecciona una acción usando epsilon-greedy.
        
        Args:
            state: Estado actual
            
        Returns:
            Acción seleccionada
        """
        # Exploración
        if random.random() < self.exploration_rate:
            return random.choice(self.get_possible_actions())
        
        # Explotación
        state_key = self.discretize_state(state)
        
        if state_key not in self.q_table:
            self.q_table[state_key] = {action: 0.0 for action in self.get_possible_actions()}
        
        # Seleccionar acción con mayor valor Q
        best_action = max(self.q_table[state_key], key=self.q_table[state_key].get)
        return best_action
    
    def apply_action(self, action: str) -> Dict[str, float]:
        """
        Aplica una acción y retorna los nuevos parámetros.
        
        Args:
            action: Acción a aplicar
            
        Returns:
            Nuevos valores de parámetros
        """
        if action == 'increase_buffer':
            self._adjust_parameter('buffer_target_ms', 1)
        elif action == 'decrease_buffer':
            self._adjust_parameter('buffer_target_ms', -1)
        elif action == 'increase_parallel':
            self._adjust_parameter('parallel_segments', 1)
        elif action == 'decrease_parallel':
            self._adjust_parameter('parallel_segments', -1)
        elif action == 'increase_prefetch':
            self._adjust_parameter('prefetch_segments', 1)
        elif action == 'decrease_prefetch':
            self._adjust_parameter('prefetch_segments', -1)
        elif action == 'increase_stability_threshold':
            self._adjust_parameter('stability_threshold', 1)
        elif action == 'decrease_stability_threshold':
            self._adjust_parameter('stability_threshold', -1)
        # 'maintain' no hace nada
        
        return self.parameters.copy()
    
    def _adjust_parameter(self, param_name: str, direction: int):
        """Ajusta un parámetro en la dirección indicada."""
        config = self.TUNABLE_PARAMETERS.get(param_name)
        if not config:
            return
        
        new_value = self.parameters[param_name] + (direction * config.step_size)
        new_value = max(config.min_value, min(config.max_value, new_value))
        self.parameters[param_name] = new_value
        
        logger.debug(f"Adjusted {param_name}: {new_value}")
    
    def calculate_reward(
        self,
        success_rate: float,
        buffer_ratio: float,
        quality_score: float,
        had_buffering: bool
    ) -> float:
        """
        Calcula la recompensa basada en el rendimiento.
        
        Args:
            success_rate: Tasa de éxito (0-1)
            buffer_ratio: Ratio de buffer (actual/objetivo)
            quality_score: Score de calidad (0-1)
            had_buffering: Si hubo buffering
            
        Returns:
            Recompensa calculada
        """
        reward = 0.0
        
        # Recompensa por success rate alto
        if success_rate >= 0.999:
            reward += 10.0
        elif success_rate >= 0.99:
            reward += 5.0
        elif success_rate >= 0.95:
            reward += 2.0
        else:
            reward -= 5.0
        
        # Recompensa por buffer saludable
        if buffer_ratio >= 1.5:
            reward += 5.0
        elif buffer_ratio >= 1.0:
            reward += 2.0
        elif buffer_ratio >= 0.5:
            reward -= 2.0
        else:
            reward -= 10.0
        
        # Recompensa por calidad
        reward += quality_score * 5.0
        
        # Penalización severa por buffering
        if had_buffering:
            reward -= 20.0
        
        return reward
    
    def learn(
        self,
        state: Dict[str, float],
        action: str,
        reward: float,
        next_state: Dict[str, float]
    ):
        """
        Actualiza la Q-table con una nueva experiencia.
        
        Args:
            state: Estado anterior
            action: Acción tomada
            reward: Recompensa recibida
            next_state: Nuevo estado
        """
        # Guardar experiencia
        experience = Experience(
            state=state,
            action=action,
            reward=reward,
            next_state=next_state,
            timestamp=time.time()
        )
        self.experiences.append(experience)
        
        # Actualizar Q-table
        state_key = self.discretize_state(state)
        next_state_key = self.discretize_state(next_state)
        
        if state_key not in self.q_table:
            self.q_table[state_key] = {a: 0.0 for a in self.get_possible_actions()}
        if next_state_key not in self.q_table:
            self.q_table[next_state_key] = {a: 0.0 for a in self.get_possible_actions()}
        
        # Q-Learning update
        current_q = self.q_table[state_key][action]
        max_next_q = max(self.q_table[next_state_key].values())
        
        new_q = current_q + self.learning_rate * (
            reward + self.discount_factor * max_next_q - current_q
        )
        
        self.q_table[state_key][action] = new_q
        
        # Registrar rendimiento
        self.performance_history.append({
            'timestamp': time.time(),
            'reward': reward,
            'action': action,
        })
        
        logger.debug(f"Learned: state={state_key}, action={action}, reward={reward:.2f}, new_q={new_q:.2f}")
    
    def detect_anomaly(self, metrics: Dict[str, float]) -> Tuple[bool, str]:
        """
        Detecta anomalías en las métricas.
        
        Args:
            metrics: Métricas actuales
            
        Returns:
            Tuple de (es_anomalía, descripción)
        """
        anomalies = []
        
        for metric_name, value in metrics.items():
            if metric_name not in self.anomaly_baseline:
                # Inicializar baseline
                self.anomaly_baseline[metric_name] = {
                    'values': deque(maxlen=100),
                    'mean': value,
                    'std': 0.0,
                }
            
            baseline = self.anomaly_baseline[metric_name]
            baseline['values'].append(value)
            
            if len(baseline['values']) >= 10:
                baseline['mean'] = statistics.mean(baseline['values'])
                baseline['std'] = statistics.stdev(baseline['values']) if len(baseline['values']) > 1 else 0.0
                
                # Detectar anomalía (> 3 desviaciones estándar)
                if baseline['std'] > 0:
                    z_score = abs(value - baseline['mean']) / baseline['std']
                    if z_score > 3:
                        anomalies.append(f"{metric_name} (z={z_score:.1f})")
        
        if anomalies:
            return True, f"Anomalies detected: {', '.join(anomalies)}"
        
        return False, "No anomalies"
    
    def get_optimized_parameters(self) -> Dict[str, float]:
        """Obtiene los parámetros optimizados actuales."""
        return self.parameters.copy()
    
    def get_learning_stats(self) -> Dict[str, Any]:
        """Obtiene estadísticas de aprendizaje."""
        if not self.performance_history:
            return {
                'total_experiences': 0,
                'avg_reward': 0.0,
                'q_table_size': 0,
            }
        
        rewards = [p['reward'] for p in self.performance_history]
        
        return {
            'total_experiences': len(self.experiences),
            'avg_reward': statistics.mean(rewards),
            'min_reward': min(rewards),
            'max_reward': max(rewards),
            'q_table_size': len(self.q_table),
            'exploration_rate': self.exploration_rate,
            'current_parameters': self.parameters,
        }
    
    def decay_exploration(self, min_rate: float = 0.01):
        """Reduce la tasa de exploración gradualmente."""
        self.exploration_rate = max(min_rate, self.exploration_rate * 0.995)
    
    def reset(self):
        """Resetea el estado del auto-tuner."""
        self.experiences.clear()
        self.q_table.clear()
        self.performance_history.clear()
        self.anomaly_baseline.clear()
        
        # Restaurar parámetros por defecto
        self.parameters = {
            name: config.current_value
            for name, config in self.TUNABLE_PARAMETERS.items()
        }
        
        logger.info("ML Auto-Tuner reset")
