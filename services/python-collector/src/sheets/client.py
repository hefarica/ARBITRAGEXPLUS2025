"""
client.py

Cliente avanzado de Google Sheets para ARBITRAGEXPLUS2025.
Implementa el cerebro operativo del sistema basado en Sheets dinámicos.

RESPONSABILIDADES:
- Autenticación OAuth2 con Google Sheets API
- Lectura dinámica de configuración desde múltiples hojas
- Escritura de resultados de operaciones y alertas
- Caché inteligente para reducir API calls
- Manejo robusto de rate limits y errores
- Validación de esquemas de datos
- Logging exhaustivo de operaciones

INTEGRACIÓN:
- Hoja CONFIG_GENERAL: Variables maestras del sistema
- Hoja BLOCKCHAINS: Redes blockchain activas
- Hoja DEXES: Exchanges descentralizados
- Hoja ASSETS: Tokens y precios
- Hoja POOLS: Pools de liquidez
- Hoja ROUTES: Rutas de arbitraje
- Hoja EXECUTIONS: Registro de operaciones
- Hoja ALERTS: Alertas y notificaciones

ARQUITECTURA:
Google Sheets ← OAuth2 → Client.py ← Config Reader → Services

@author ARBITRAGEXPLUS2025 Core Team
@version 1.0.0
@criticality BLOQUEANTE
@integration-with All Python services, Rust engine via FFI
"""

import asyncio
import json
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import gspread
from gspread.exceptions import APIError, SpreadsheetNotFound
from google.oauth2.service_account import Credentials
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

# Configuración de logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Scopes requeridos para Google Sheets API
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.readonly",
]

# Constantes del sistema
DEFAULT_CACHE_TTL = 60  # segundos
MAX_RETRIES = 5
RATE_LIMIT_WAIT = 60  # segundos

# ============================================================================
# DATACLASSES: Estructuras de datos
# ============================================================================

@dataclass
class SheetConfig:
    """Configuración de conexión a Google Sheets"""
    spreadsheet_id: str
    credentials_path: str
    sheet_names: Dict[str, str] = field(default_factory=dict)
    cache_enabled: bool = True
    cache_ttl: int = DEFAULT_CACHE_TTL
    max_retries: int = MAX_RETRIES

@dataclass
class CacheEntry:
    """Entrada de caché para datos de Sheets"""
    data: Any
    timestamp: datetime
    ttl: int
    
    def is_valid(self) -> bool:
        """Verifica si la entrada de caché aún es válida"""
        return datetime.now() - self.timestamp < timedelta(seconds=self.ttl)

# ============================================================================
# CLASE PRINCIPAL: GoogleSheetsClient
# ============================================================================

class GoogleSheetsClient:
    """
    Cliente avanzado para Google Sheets con caché, reintentos y validación.
    
    Implementa el patrón Singleton para garantizar una sola instancia.
    """
    
    _instance = None
    
    def __new__(cls, config: SheetConfig):
        """Implementación Singleton"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self, config: SheetConfig):
        """
        Inicializa el cliente de Google Sheets.
        
        Args:
            config: Configuración de conexión
        """
        if hasattr(self, '_initialized'):
            return
            
        self.config = config
        self.client: Optional[gspread.Client] = None
        self.spreadsheet: Optional[gspread.Spreadsheet] = None
        self.cache: Dict[str, CacheEntry] = {}
        self._initialized = False
        
        logger.info("Inicializando GoogleSheetsClient")
        self._connect()
        self._initialized = True
    
    def _connect(self) -> None:
        """
        Establece conexión con Google Sheets API.
        
        Raises:
            FileNotFoundError: Si no se encuentra el archivo de credenciales
            ValueError: Si las credenciales son inválidas
        """
        try:
            # Verificar que existe el archivo de credenciales
            if not os.path.exists(self.config.credentials_path):
                raise FileNotFoundError(
                    f"Archivo de credenciales no encontrado: {self.config.credentials_path}"
                )
            
            # Cargar credenciales
            creds = Credentials.from_service_account_file(
                self.config.credentials_path,
                scopes=SCOPES
            )
            
            # Autenticar con gspread
            self.client = gspread.authorize(creds)
            
            # Abrir spreadsheet
            self.spreadsheet = self.client.open_by_key(self.config.spreadsheet_id)
            logger.info(f"✅ Conectado exitosamente a spreadsheet: {self.spreadsheet.title}")
            
        except FileNotFoundError as e:
            logger.error(f"❌ Error de archivo: {e}")
            raise
        except Exception as e:
            logger.error(f"❌ Error de conexión a Google Sheets: {e}")
            raise ValueError(f"Credenciales inválidas o spreadsheet no accesible: {e}")
    
    @retry(
        retry=retry_if_exception_type(APIError),
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=1, min=4, max=60),
        reraise=True
    )
    def _get_worksheet(self, sheet_name: str) -> gspread.Worksheet:
        """
        Obtiene una hoja del spreadsheet con reintentos automáticos.
        
        Args:
            sheet_name: Nombre de la hoja
            
        Returns:
            Objeto Worksheet
            
        Raises:
            SpreadsheetNotFound: Si no se encuentra la hoja
        """
        try:
            worksheet = self.spreadsheet.worksheet(sheet_name)
            logger.debug(f"Hoja obtenida: {sheet_name}")
            return worksheet
        except gspread.WorksheetNotFound:
            logger.error(f"❌ Hoja no encontrada: {sheet_name}")
            raise SpreadsheetNotFound(f"Hoja '{sheet_name}' no existe en el spreadsheet")
    
    def _get_cache_key(self, sheet_name: str, operation: str) -> str:
        """Genera clave única para caché"""
        return f"{sheet_name}:{operation}"
    
    def _get_from_cache(self, cache_key: str) -> Optional[Any]:
        """
        Obtiene datos del caché si está disponible y válido.
        
        Args:
            cache_key: Clave de caché
            
        Returns:
            Datos cacheados o None
        """
        if not self.config.cache_enabled:
            return None
            
        entry = self.cache.get(cache_key)
        if entry and entry.is_valid():
            logger.debug(f"✓ Cache hit: {cache_key}")
            return entry.data
            
        logger.debug(f"✗ Cache miss: {cache_key}")
        return None
    
    def _save_to_cache(self, cache_key: str, data: Any, ttl: Optional[int] = None) -> None:
        """Guarda datos en caché"""
        if not self.config.cache_enabled:
            return
            
        ttl = ttl or self.config.cache_ttl
        self.cache[cache_key] = CacheEntry(
            data=data,
            timestamp=datetime.now(),
            ttl=ttl
        )
        logger.debug(f"💾 Datos guardados en cache: {cache_key}")
    
    def clear_cache(self, sheet_name: Optional[str] = None) -> None:
        """
        Limpia el caché completamente o para una hoja específica.
        
        Args:
            sheet_name: Nombre de hoja (opcional, limpia todo si es None)
        """
        if sheet_name:
            keys_to_remove = [k for k in self.cache.keys() if k.startswith(f"{sheet_name}:")]
            for key in keys_to_remove:
                del self.cache[key]
            logger.info(f"🗑️  Cache limpiado para hoja: {sheet_name}")
        else:
            self.cache.clear()
            logger.info("🗑️  Cache limpiado completamente")
    
    @retry(
        retry=retry_if_exception_type(APIError),
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=1, min=4, max=60)
    )
    async def read_sheet_data(
        self,
        sheet_name: str,
        use_cache: bool = True,
        value_render_option: str = "UNFORMATTED_VALUE"
    ) -> List[List[Any]]:
        """
        Lee todos los datos de una hoja con soporte de caché.
        
        Args:
            sheet_name: Nombre de la hoja a leer
            use_cache: Si debe usar caché (default: True)
            value_render_option: Formato de valores ('FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA')
            
        Returns:
            Lista de listas con los datos de la hoja
            
        Example:
            data = await client.read_sheet_data("BLOCKCHAINS")
            # data = [
            #   ["ID", "Name", "ChainID", ...],  # Headers
            #   [1, "Ethereum", 1, ...],          # Row 1
            #   [2, "Polygon", 137, ...]          # Row 2
            # ]
        """
        cache_key = self._get_cache_key(sheet_name, "read_all")
        
        # Intentar obtener desde caché
        if use_cache:
            cached_data = self._get_from_cache(cache_key)
            if cached_data is not None:
                return cached_data
        
        # Leer desde API
        try:
            worksheet = self._get_worksheet(sheet_name)
            data = worksheet.get_all_values(value_render_option=value_render_option)
            
            logger.info(f"📥 Leídos {len(data)} filas de '{sheet_name}'")
            
            # Guardar en caché
            if use_cache:
                self._save_to_cache(cache_key, data)
            
            return data
            
        except Exception as e:
            logger.error(f"❌ Error leyendo hoja '{sheet_name}': {e}")
            raise
    
    async def read_sheet_as_dict(
        self,
        sheet_name: str,
        use_cache: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Lee una hoja y la retorna como lista de diccionarios (cada fila = dict).
        
        La primera fila se usa como headers/keys.
        
        Args:
            sheet_name: Nombre de la hoja
            use_cache: Si debe usar caché
            
        Returns:
            Lista de diccionarios, donde cada dict es una fila
            
        Example:
            data = await client.read_sheet_as_dict("DEXES")
            # data = [
            #   {"ID": 1, "Name": "Uniswap", "Type": "V2", ...},
            #   {"ID": 2, "Name": "Sushiswap", "Type": "V2", ...}
            # ]
        """
        data = await self.read_sheet_data(sheet_name, use_cache=use_cache)
        
        if len(data) < 2:
            logger.warning(f"⚠️  Hoja '{sheet_name}' vacía o sin datos")
            return []
        
        headers = data[0]
        rows = data[1:]
        
        result = []
        for row in rows:
            # Crear diccionario para cada fila
            row_dict = {}
            for i, header in enumerate(headers):
                value = row[i] if i < len(row) else None
                row_dict[header] = value
            result.append(row_dict)
        
        logger.info(f"📊 Convertidos {len(result)} registros de '{sheet_name}' a diccionarios")
        return result
    
    @retry(
        retry=retry_if_exception_type(APIError),
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=1, min=4, max=60)
    )
    async def write_row(
        self,
        sheet_name: str,
        row_data: List[Any],
        append: bool = True
    ) -> bool:
        """
        Escribe una fila de datos en una hoja.
        
        Args:
            sheet_name: Nombre de la hoja
            row_data: Lista de valores a escribir
            append: Si True, agrega al final; si False, reemplaza última fila
            
        Returns:
            True si éxito, False si falla
            
        Example:
            success = await client.write_row(
                "EXECUTIONS",
                [datetime.now(), "ETH/USDT", 1.5, "SUCCESS", "0x..."]
            )
        """
        try:
            worksheet = self._get_worksheet(sheet_name)
            
            if append:
                worksheet.append_row(row_data, value_input_option="USER_ENTERED")
                logger.info(f"📤 Fila agregada a '{sheet_name}': {row_data[:3]}...")
            else:
                last_row = len(worksheet.get_all_values())
                worksheet.update(f"A{last_row}", [row_data], value_input_option="USER_ENTERED")
                logger.info(f"📝 Fila actualizada en '{sheet_name}': {row_data[:3]}...")
            
            # Invalidar caché para esta hoja
            self.clear_cache(sheet_name)
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Error escribiendo en '{sheet_name}': {e}")
            return False
    
    async def write_bulk(
        self,
        sheet_name: str,
        data: List[List[Any]],
        start_cell: str = "A2"
    ) -> bool:
        """
        Escribe múltiples filas de forma eficiente (batch update).
        
        Args:
            sheet_name: Nombre de la hoja
            data: Lista de listas (cada sublista es una fila)
            start_cell: Celda inicial (default: A2, asume headers en A1)
            
        Returns:
            True si éxito
            
        Example:
            routes = [
                ["Route1", "ETH>USDT>BNB", 1.5, 0.002],
                ["Route2", "BTC>ETH>USDT", 2.1, 0.001]
            ]
            await client.write_bulk("ROUTES", routes)
        """
        try:
            worksheet = self._get_worksheet(sheet_name)
            worksheet.update(start_cell, data, value_input_option="USER_ENTERED")
            
            logger.info(f"📤 {len(data)} filas escritas en '{sheet_name}' desde {start_cell}")
            
            # Invalidar caché
            self.clear_cache(sheet_name)
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Error en write_bulk '{sheet_name}': {e}")
            return False
    
    async def get_config_value(self, config_key: str, default: Any = None) -> Any:
        """
        Lee un valor específico de la hoja CONFIG_GENERAL.
        
        Asume que CONFIG_GENERAL tiene columnas: [KEY, VALUE, TYPE, DESCRIPTION]
        
        Args:
            config_key: Clave de configuración (ej: "MIN_PROFIT_THRESHOLD")
            default: Valor por defecto si no se encuentra
            
        Returns:
            Valor de configuración o default
            
        Example:
            min_profit = await client.get_config_value("MIN_PROFIT_THRESHOLD", 0.005)
        """
        try:
            config_data = await self.read_sheet_as_dict("CONFIG_GENERAL", use_cache=True)
            
            for row in config_data:
                if row.get("KEY") == config_key:
                    value = row.get("VALUE")
                    value_type = row.get("TYPE", "string")
                    
                    # Convertir tipo
                    if value_type == "float":
                        return float(value)
                    elif value_type == "int":
                        return int(value)
                    elif value_type == "bool":
                        return value.lower() in ("true", "1", "yes")
                    else:
                        return value
            
            logger.warning(f"⚠️  Config key '{config_key}' no encontrada, usando default: {default}")
            return default
            
        except Exception as e:
            logger.error(f"❌ Error obteniendo config '{config_key}': {e}")
            return default
    
    async def log_error(
        self,
        error_message: str,
        severity: str = "ERROR",
        module: str = "UNKNOWN",
        additional_data: Optional[Dict] = None
    ) -> bool:
        """
        Registra un error en la hoja LOG_ERRORES_EVENTOS.
        
        Args:
            error_message: Mensaje de error
            severity: Nivel de severidad (INFO, WARNING, ERROR, CRITICAL)
            module: Módulo que generó el error
            additional_data: Datos adicionales en formato dict
            
        Returns:
            True si se registró exitosamente
        """
        try:
            timestamp = datetime.now().isoformat()
            additional_json = json.dumps(additional_data) if additional_data else ""
            
            row = [timestamp, severity, module, error_message, additional_json]
            
            return await self.write_row("LOG_ERRORES_EVENTOS", row, append=True)
            
        except Exception as e:
            logger.error(f"❌ Error al log error: {e}")
            return False
    
    async def health_check(self) -> Dict[str, Any]:
        """
        Realiza un health check del cliente de Sheets.
        
        Returns:
            Dict con estado del sistema
        """
        try:
            # Verificar conexión
            spreadsheet_title = self.spreadsheet.title if self.spreadsheet else None
            
            # Intentar leer una hoja simple
            config_data = await self.read_sheet_data("CONFIG_GENERAL", use_cache=False)
            
            return {
                "status": "healthy",
                "connected": True,
                "spreadsheet": spreadsheet_title,
                "cache_size": len(self.cache),
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "connected": False,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }

# ============================================================================
# FUNCIONES AUXILIARES
# ============================================================================

def create_client_from_env() -> GoogleSheetsClient:
    """
    Crea un cliente de Sheets usando variables de entorno.
    
    Variables requeridas:
    - GOOGLE_SHEETS_SPREADSHEET_ID
    - GOOGLE_SHEETS_CREDENTIALS_PATH
    
    Returns:
        Instancia de GoogleSheetsClient
    """
    config = SheetConfig(
        spreadsheet_id=os.getenv("GOOGLE_SHEETS_SPREADSHEET_ID"),
        credentials_path=os.getenv("GOOGLE_SHEETS_CREDENTIALS_PATH", "credentials.json")
    )
    
    return GoogleSheetsClient(config)

# ============================================================================
# TESTING Y VALIDACIÓN
# ============================================================================

async def test_client():
    """Función de prueba del cliente"""
    logger.info("🧪 Iniciando pruebas del GoogleSheetsClient")
    
    # Crear cliente desde env
    client = create_client_from_env()
    
    # Health check
    health = await client.health_check()
    logger.info(f"Health: {health}")
    
    # Leer configuración
    min_profit = await client.get_config_value("MIN_PROFIT_THRESHOLD", 0.005)
    logger.info(f"Min profit threshold: {min_profit}")
    
    # Leer hojas críticas
    blockchains = await client.read_sheet_as_dict("BLOCKCHAINS")
    logger.info(f"Blockchains encontrados: {len(blockchains)}")
    
    dexes = await client.read_sheet_as_dict("DEXES")
    logger.info(f"DEXes encontrados: {len(dexes)}")
    
    logger.info("✅ Pruebas completadas")

if __name__ == "__main__":
    # Configurar logging para testing
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    # Ejecutar pruebas
    asyncio.run(test_client())