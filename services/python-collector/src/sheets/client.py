"""
client.py - Cliente Google Sheets para ARBITRAGEXPLUS2025

Cliente para leer/escribir Google Sheets según Prompt Supremo Definitivo.
Implementa funciones específicas para cada hoja con arrays dinámicos.

TAREA 2.1 del Prompt Supremo:
- get_blockchains_array(): Lee 50 campos desde BLOCKCHAINS
- get_dexes_array(): Lee 200 campos desde DEXES
- get_assets_array(): Lee 400 campos desde ASSETS
- get_pools_array(): Lee 100 campos desde POOLS
- get_routes_array(): Lee 200 campos desde ROUTES
- write_executions_array(): Escribe 50 campos a EXECUTIONS

CERO HARDCODING: Todos los campos se leen dinámicamente desde Sheets.
"""

import asyncio
import logging
import os
from typing import Any, Dict, List, Optional

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Configuración de logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Scopes requeridos
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.readonly",
]

# Rangos de hojas según Prompt Supremo (1016 campos distribuidos)
SHEET_RANGES = {
    'BLOCKCHAINS': 'BLOCKCHAINS!A2:AX',      # 50 columnas (A-AX)
    'DEXES': 'DEXES!A2:GR',                  # 200 columnas (A-GR)
    'ASSETS': 'ASSETS!A2:OL',                # 400 columnas (A-OL)
    'POOLS': 'POOLS!A2:CV',                  # 100 columnas (A-CV)
    'ROUTES': 'ROUTES!A2:GR',                # 200 columnas (A-GR)
    'EXECUTIONS': 'EXECUTIONS!A2:AX',        # 50 columnas (A-AX)
    'CONFIG': 'CONFIG!A2:G',                 # 7 columnas (A-G)
    'ALERTS': 'ALERTS!A2:I'                  # 9 columnas (A-I)
}

class SheetsClient:
    """
    Cliente para leer/escribir Google Sheets.
    
    Implementa el protocolo del Prompt Supremo Definitivo:
    - ANTES: Validar conexión y credenciales
    - DURANTE: Leer/escribir arrays dinámicos sin hardcoding
    - DESPUÉS: Validar datos y manejar errores
    """
    
    def __init__(
        self,
        spreadsheet_id: Optional[str] = None,
        credentials_path: Optional[str] = None
    ):
        """
        Inicializa el cliente de Google Sheets.
        
        Args:
            spreadsheet_id: ID del spreadsheet (o desde env GOOGLE_SHEETS_SPREADSHEET_ID)
            credentials_path: Ruta al archivo JSON de credenciales (o desde env GOOGLE_APPLICATION_CREDENTIALS)
        """
        self.spreadsheet_id = spreadsheet_id or os.getenv('GOOGLE_SHEETS_SPREADSHEET_ID')
        self.credentials_path = credentials_path or os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
        
        if not self.spreadsheet_id:
            raise ValueError("spreadsheet_id es requerido (env: GOOGLE_SHEETS_SPREADSHEET_ID)")
        
        if not self.credentials_path:
            raise ValueError("credentials_path es requerido (env: GOOGLE_APPLICATION_CREDENTIALS)")
        
        # Inicializar servicio de Google Sheets
        self.service = None
        self._initialize_service()
    
    def _initialize_service(self):
        """Inicializa el servicio de Google Sheets API"""
        try:
            creds = Credentials.from_service_account_file(
                self.credentials_path,
                scopes=SCOPES
            )
            self.service = build('sheets', 'v4', credentials=creds)
            logger.info(f"✅ Cliente Google Sheets inicializado: {self.spreadsheet_id}")
        except Exception as e:
            logger.error(f"❌ Error al inicializar servicio Google Sheets: {e}")
            raise
    
    def _read_range(self, range_name: str) -> List[List[Any]]:
        """
        Lee un rango de Google Sheets.
        
        Args:
            range_name: Rango en formato 'HOJA!A1:Z100'
            
        Returns:
            Lista de filas con valores
        """
        try:
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=range_name
            ).execute()
            
            values = result.get('values', [])
            logger.info(f"📖 Leídas {len(values)} filas desde {range_name}")
            return values
            
        except HttpError as e:
            logger.error(f"❌ Error al leer rango {range_name}: {e}")
            raise
    
    def _write_range(self, range_name: str, values: List[List[Any]]) -> Dict[str, Any]:
        """
        Escribe un rango en Google Sheets.
        
        Args:
            range_name: Rango en formato 'HOJA!A1:Z100'
            values: Lista de filas con valores
            
        Returns:
            Respuesta de la API
        """
        try:
            body = {'values': values}
            result = self.service.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range=range_name,
                valueInputOption='RAW',
                body=body
            ).execute()
            
            logger.info(f"✍️  Escritas {len(values)} filas en {range_name}")
            return result
            
        except HttpError as e:
            logger.error(f"❌ Error al escribir rango {range_name}: {e}")
            raise
    
    def _map_row_to_dict(self, headers: List[str], row: List[Any]) -> Dict[str, Any]:
        """
        Mapea una fila a un diccionario usando headers.
        
        Args:
            headers: Lista de nombres de columnas
            row: Lista de valores de la fila
            
        Returns:
            Diccionario con pares header:value
        """
        # Extender row si es más corta que headers
        extended_row = row + [''] * (len(headers) - len(row))
        return dict(zip(headers, extended_row))
    
    # ========================================================================
    # FUNCIONES REQUERIDAS POR PROMPT SUPREMO - TAREA 2.1
    # ========================================================================
    
    async def get_blockchains_array(self) -> List[Dict[str, Any]]:
        """
        Lee BLOCKCHAINS desde Sheets - 50 campos dinámicos.
        
        Rango: BLOCKCHAINS!A2:AX (50 columnas)
        
        Returns:
            Lista de diccionarios con datos de blockchains
        """
        range_name = SHEET_RANGES['BLOCKCHAINS']
        
        # Leer datos
        values = self._read_range(range_name)
        
        if not values:
            logger.warning("⚠️  Hoja BLOCKCHAINS vacía")
            return []
        
        # Primera fila son los headers
        headers_range = 'BLOCKCHAINS!A1:AX1'
        headers_result = self._read_range(headers_range)
        headers = headers_result[0] if headers_result else []
        
        # Mapear filas a diccionarios
        blockchains = [self._map_row_to_dict(headers, row) for row in values]
        
        logger.info(f"✅ Leídas {len(blockchains)} blockchains (50 campos c/u)")
        return blockchains
    
    async def get_dexes_array(self) -> List[Dict[str, Any]]:
        """
        Lee DEXES desde Sheets - 200 campos dinámicos.
        
        Rango: DEXES!A2:GR (200 columnas)
        
        Returns:
            Lista de diccionarios con datos de DEXes
        """
        range_name = SHEET_RANGES['DEXES']
        
        values = self._read_range(range_name)
        
        if not values:
            logger.warning("⚠️  Hoja DEXES vacía")
            return []
        
        headers_range = 'DEXES!A1:GR1'
        headers_result = self._read_range(headers_range)
        headers = headers_result[0] if headers_result else []
        
        dexes = [self._map_row_to_dict(headers, row) for row in values]
        
        logger.info(f"✅ Leídos {len(dexes)} DEXes (200 campos c/u)")
        return dexes
    
    async def get_assets_array(self) -> List[Dict[str, Any]]:
        """
        Lee ASSETS desde Sheets - 400 campos dinámicos.
        
        Rango: ASSETS!A2:OL (400 columnas)
        
        Returns:
            Lista de diccionarios con datos de assets
        """
        range_name = SHEET_RANGES['ASSETS']
        
        values = self._read_range(range_name)
        
        if not values:
            logger.warning("⚠️  Hoja ASSETS vacía")
            return []
        
        headers_range = 'ASSETS!A1:OL1'
        headers_result = self._read_range(headers_range)
        headers = headers_result[0] if headers_result else []
        
        assets = [self._map_row_to_dict(headers, row) for row in values]
        
        logger.info(f"✅ Leídos {len(assets)} assets (400 campos c/u)")
        return assets
    
    async def get_pools_array(self) -> List[Dict[str, Any]]:
        """
        Lee POOLS desde Sheets - 100 campos dinámicos.
        
        Rango: POOLS!A2:CV (100 columnas)
        
        Returns:
            Lista de diccionarios con datos de pools
        """
        range_name = SHEET_RANGES['POOLS']
        
        values = self._read_range(range_name)
        
        if not values:
            logger.warning("⚠️  Hoja POOLS vacía")
            return []
        
        headers_range = 'POOLS!A1:CV1'
        headers_result = self._read_range(headers_range)
        headers = headers_result[0] if headers_result else []
        
        pools = [self._map_row_to_dict(headers, row) for row in values]
        
        logger.info(f"✅ Leídos {len(pools)} pools (100 campos c/u)")
        return pools
    
    async def get_routes_array(self) -> List[Dict[str, Any]]:
        """
        Lee ROUTES desde Sheets - 200 campos dinámicos.
        
        Rango: ROUTES!A2:GR (200 columnas)
        
        Returns:
            Lista de diccionarios con rutas de arbitraje
        """
        range_name = SHEET_RANGES['ROUTES']
        
        values = self._read_range(range_name)
        
        if not values:
            logger.warning("⚠️  Hoja ROUTES vacía")
            return []
        
        headers_range = 'ROUTES!A1:GR1'
        headers_result = self._read_range(headers_range)
        headers = headers_result[0] if headers_result else []
        
        routes = [self._map_row_to_dict(headers, row) for row in values]
        
        logger.info(f"✅ Leídas {len(routes)} rutas (200 campos c/u)")
        return routes
    
    async def write_executions_array(self, executions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Escribe EXECUTIONS a Sheets - 50 campos dinámicos.
        
        Rango: EXECUTIONS!A2:AX (50 columnas)
        
        Args:
            executions: Lista de diccionarios con resultados de ejecuciones
            
        Returns:
            Respuesta de la API
        """
        if not executions:
            logger.warning("⚠️  No hay ejecuciones para escribir")
            return {}
        
        # Leer headers
        headers_range = 'EXECUTIONS!A1:AX1'
        headers_result = self._read_range(headers_range)
        headers = headers_result[0] if headers_result else []
        
        # Convertir diccionarios a filas
        rows = []
        for execution in executions:
            row = [execution.get(header, '') for header in headers]
            rows.append(row)
        
        # Escribir a Sheets
        range_name = SHEET_RANGES['EXECUTIONS']
        result = self._write_range(range_name, rows)
        
        logger.info(f"✅ Escritas {len(executions)} ejecuciones (50 campos c/u)")
        return result
    
    async def get_config_array(self) -> List[Dict[str, Any]]:
        """
        Lee CONFIG desde Sheets - 7 campos dinámicos.
        
        Rango: CONFIG!A2:G (7 columnas)
        
        Returns:
            Lista de diccionarios con configuración
        """
        range_name = SHEET_RANGES['CONFIG']
        
        values = self._read_range(range_name)
        
        if not values:
            logger.warning("⚠️  Hoja CONFIG vacía")
            return []
        
        headers_range = 'CONFIG!A1:G1'
        headers_result = self._read_range(headers_range)
        headers = headers_result[0] if headers_result else []
        
        config = [self._map_row_to_dict(headers, row) for row in values]
        
        logger.info(f"✅ Leída configuración (7 campos)")
        return config
    
    async def get_alerts_array(self) -> List[Dict[str, Any]]:
        """
        Lee ALERTS desde Sheets - 9 campos dinámicos.
        
        Rango: ALERTS!A2:I (9 columnas)
        
        Returns:
            Lista de diccionarios con alertas
        """
        range_name = SHEET_RANGES['ALERTS']
        
        values = self._read_range(range_name)
        
        if not values:
            logger.warning("⚠️  Hoja ALERTS vacía")
            return []
        
        headers_range = 'ALERTS!A1:I1'
        headers_result = self._read_range(headers_range)
        headers = headers_result[0] if headers_result else []
        
        alerts = [self._map_row_to_dict(headers, row) for row in values]
        
        logger.info(f"✅ Leídas {len(alerts)} alertas (9 campos c/u)")
        return alerts


# ============================================================================
# EJEMPLO DE USO
# ============================================================================

async def main():
    """Ejemplo de uso del cliente"""
    
    # Inicializar cliente
    client = SheetsClient()
    
    # Leer blockchains (50 campos)
    blockchains = await client.get_blockchains_array()
    print(f"📊 Blockchains: {len(blockchains)}")
    
    # Leer DEXes (200 campos)
    dexes = await client.get_dexes_array()
    print(f"📊 DEXes: {len(dexes)}")
    
    # Leer assets (400 campos)
    assets = await client.get_assets_array()
    print(f"📊 Assets: {len(assets)}")
    
    # Leer pools (100 campos)
    pools = await client.get_pools_array()
    print(f"📊 Pools: {len(pools)}")
    
    # Leer rutas (200 campos)
    routes = await client.get_routes_array()
    print(f"📊 Routes: {len(routes)}")


if __name__ == "__main__":
    asyncio.run(main())



    async def update_asset_price(self, asset_id: str, price_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Actualiza el precio de un asset en Sheets.
        
        Args:
            asset_id: ID del asset (TOKEN_ADDRESS o ID)
            price_data: Diccionario con datos de precio a actualizar
            
        Returns:
            Respuesta de la API
        """
        # Leer assets actuales
        assets = await self.get_assets_array()
        
        # Buscar el asset
        asset_index = None
        for i, asset in enumerate(assets):
            if asset.get('TOKEN_ADDRESS') == asset_id or asset.get('ID') == asset_id:
                asset_index = i
                break
        
        if asset_index is None:
            logger.warning(f"⚠️  Asset {asset_id} no encontrado en Sheets")
            return {}
        
        # Leer headers
        headers_range = 'ASSETS!A1:OL1'
        headers_result = self._read_range(headers_range)
        headers = headers_result[0] if headers_result else []
        
        # Actualizar solo las columnas de precio
        row_number = asset_index + 2  # +2 porque A1 es header y empezamos en A2
        
        for field_name, field_value in price_data.items():
            # Buscar la columna del campo
            try:
                col_index = headers.index(field_name)
                # Convertir índice a letra de columna (A=0, B=1, ..., Z=25, AA=26, ...)
                col_letter = self._column_index_to_letter(col_index)
                
                # Actualizar celda individual
                range_name = f'ASSETS!{col_letter}{row_number}'
                self._write_range(range_name, [[field_value]])
                
                logger.info(f"✅ Actualizado {field_name} = {field_value} para asset {asset_id}")
            except ValueError:
                logger.warning(f"⚠️  Campo {field_name} no encontrado en headers de ASSETS")
        
        return {'updated': True, 'asset_id': asset_id}
    
    def _column_index_to_letter(self, index: int) -> str:
        """
        Convierte índice de columna a letra (0 -> A, 25 -> Z, 26 -> AA).
        
        Args:
            index: Índice de columna (0-based)
            
        Returns:
            Letra de columna
        """
        result = ""
        while index >= 0:
            result = chr(index % 26 + ord('A')) + result
            index = index // 26 - 1
        return result


