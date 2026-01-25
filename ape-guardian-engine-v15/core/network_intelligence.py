"""
APE Guardian Engine v15 - Network Intelligence
===============================================
Detección de información de red del cliente (ISP, ubicación, tipo de conexión).
"""

import requests
import logging
import time
from typing import Dict, Optional, Any
from dataclasses import dataclass, asdict
from functools import lru_cache

logger = logging.getLogger(__name__)

@dataclass
class NetworkInfo:
    """Información de red del cliente."""
    ip: str
    isp: str
    org: str
    asn: str
    country: str
    country_code: str
    region: str
    city: str
    timezone: str
    connection_type: str
    is_mobile: bool
    is_proxy: bool
    is_hosting: bool
    estimated_bandwidth_mbps: float
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class NetworkIntelligence:
    """
    Servicio de inteligencia de red.
    
    Responsabilidades:
    - Detectar ISP, ubicación y tipo de conexión
    - Estimar ancho de banda basado en tipo de conexión
    - Cachear resultados para evitar llamadas repetidas
    """
    
    # Estimaciones de ancho de banda por tipo de conexión
    BANDWIDTH_ESTIMATES = {
        'fiber': 100.0,
        'cable': 50.0,
        'dsl': 20.0,
        'mobile_5g': 50.0,
        'mobile_4g': 20.0,
        'mobile_3g': 5.0,
        'satellite': 10.0,
        'dialup': 0.5,
        'unknown': 10.0,
    }
    
    def __init__(self, cache_ttl: int = 3600):
        """
        Inicializa el servicio de inteligencia de red.
        
        Args:
            cache_ttl: Tiempo de vida del cache en segundos
        """
        self.cache_ttl = cache_ttl
        self._cache: Dict[str, tuple] = {}
        self._api_url = "http://ip-api.com/json/{ip}?fields=status,message,country,countryCode,region,city,zip,lat,lon,timezone,isp,org,as,mobile,proxy,hosting,query"
        
        logger.info(f"Network Intelligence initialized with cache TTL: {cache_ttl}s")
    
    def detect_network_info(self, client_ip: str) -> Optional[Dict[str, Any]]:
        """
        Detecta información de red para una IP.
        
        Args:
            client_ip: IP del cliente
            
        Returns:
            Diccionario con información de red o None si falla
        """
        # Verificar cache
        if client_ip in self._cache:
            cached_time, cached_info = self._cache[client_ip]
            if time.time() - cached_time < self.cache_ttl:
                return cached_info
        
        # IPs reservadas/locales - retornar valores por defecto
        if self._is_private_ip(client_ip):
            default_info = self._get_default_network_info(client_ip)
            self._cache[client_ip] = (time.time(), default_info)
            return default_info
        
        try:
            response = requests.get(
                self._api_url.format(ip=client_ip),
                timeout=5
            )
            
            if response.status_code != 200:
                logger.error(f"IP-API returned status {response.status_code}")
                return self._get_default_network_info(client_ip)
            
            data = response.json()
            
            if data.get('status') == 'fail':
                logger.error(f"IP-API error: {data.get('message', 'unknown')}")
                return self._get_default_network_info(client_ip)
            
            # Determinar tipo de conexión
            connection_type = self._detect_connection_type(data)
            
            network_info = {
                'ip': client_ip,
                'isp': data.get('isp', 'unknown'),
                'org': data.get('org', 'unknown'),
                'asn': data.get('as', 'unknown'),
                'country': data.get('country', 'unknown'),
                'country_code': data.get('countryCode', 'XX'),
                'region': data.get('region', 'unknown'),
                'city': data.get('city', 'unknown'),
                'timezone': data.get('timezone', 'UTC'),
                'connection_type': connection_type,
                'is_mobile': data.get('mobile', False),
                'is_proxy': data.get('proxy', False),
                'is_hosting': data.get('hosting', False),
                'estimated_bandwidth_mbps': self.BANDWIDTH_ESTIMATES.get(connection_type, 10.0),
            }
            
            # Guardar en cache
            self._cache[client_ip] = (time.time(), network_info)
            
            logger.debug(f"Network info detected for {client_ip}: ISP={network_info['isp']}, type={connection_type}")
            return network_info
            
        except requests.Timeout:
            logger.warning(f"IP-API timeout for {client_ip}")
            return self._get_default_network_info(client_ip)
        except Exception as e:
            logger.error(f"Network detection error: {e}")
            return self._get_default_network_info(client_ip)
    
    def _is_private_ip(self, ip: str) -> bool:
        """Verifica si una IP es privada/reservada."""
        private_prefixes = [
            '10.', '172.16.', '172.17.', '172.18.', '172.19.',
            '172.20.', '172.21.', '172.22.', '172.23.', '172.24.',
            '172.25.', '172.26.', '172.27.', '172.28.', '172.29.',
            '172.30.', '172.31.', '192.168.', '127.', '0.', '169.254.',
            'localhost', '::1', 'fe80:'
        ]
        return any(ip.startswith(prefix) for prefix in private_prefixes)
    
    def _get_default_network_info(self, client_ip: str) -> Dict[str, Any]:
        """Retorna información de red por defecto."""
        return {
            'ip': client_ip,
            'isp': 'unknown',
            'org': 'unknown',
            'asn': 'unknown',
            'country': 'unknown',
            'country_code': 'XX',
            'region': 'unknown',
            'city': 'unknown',
            'timezone': 'UTC',
            'connection_type': 'unknown',
            'is_mobile': False,
            'is_proxy': False,
            'is_hosting': False,
            'estimated_bandwidth_mbps': 10.0,
        }
    
    def _detect_connection_type(self, api_data: Dict) -> str:
        """Detecta el tipo de conexión basado en datos de la API."""
        isp = api_data.get('isp', '').lower()
        org = api_data.get('org', '').lower()
        is_mobile = api_data.get('mobile', False)
        
        if is_mobile:
            if '5g' in isp or '5g' in org:
                return 'mobile_5g'
            elif '4g' in isp or 'lte' in isp:
                return 'mobile_4g'
            else:
                return 'mobile_3g'
        
        # Detectar por ISP
        fiber_keywords = ['fiber', 'fibra', 'ftth', 'fios', 'gpon']
        cable_keywords = ['cable', 'comcast', 'spectrum', 'cox', 'charter']
        dsl_keywords = ['dsl', 'adsl', 'vdsl']
        satellite_keywords = ['satellite', 'starlink', 'hughesnet', 'viasat']
        
        combined = f"{isp} {org}"
        
        if any(kw in combined for kw in fiber_keywords):
            return 'fiber'
        elif any(kw in combined for kw in cable_keywords):
            return 'cable'
        elif any(kw in combined for kw in dsl_keywords):
            return 'dsl'
        elif any(kw in combined for kw in satellite_keywords):
            return 'satellite'
        
        return 'unknown'
    
    def get_baseline_throughput(self, network_info: Dict) -> float:
        """Obtiene el throughput base estimado para una conexión."""
        if not network_info:
            return 10.0
        return network_info.get('estimated_bandwidth_mbps', 10.0)
    
    def is_high_quality_connection(self, network_info: Dict) -> bool:
        """Verifica si la conexión es de alta calidad."""
        if not network_info:
            return False
        connection_type = network_info.get('connection_type', 'unknown')
        return connection_type in ['fiber', 'cable', 'mobile_5g']
    
    def should_enable_aggressive_mode(self, network_info: Dict) -> bool:
        """Determina si se debe habilitar modo agresivo."""
        if not network_info:
            return False
        
        # Modo agresivo solo para conexiones de alta calidad sin proxy
        is_high_quality = self.is_high_quality_connection(network_info)
        is_proxy = network_info.get('is_proxy', False)
        is_hosting = network_info.get('is_hosting', False)
        
        return is_high_quality and not is_proxy and not is_hosting


# Singleton global
_network_intelligence: Optional[NetworkIntelligence] = None


def get_network_intelligence() -> NetworkIntelligence:
    """Obtiene la instancia global de NetworkIntelligence."""
    global _network_intelligence
    if _network_intelligence is None:
        _network_intelligence = NetworkIntelligence()
    return _network_intelligence
