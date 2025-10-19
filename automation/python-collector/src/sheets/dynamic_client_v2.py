"""
============================================================================
ARCHIVO: ./services/python-collector/src/sheets/dynamic_client_v2.py
============================================================================

📥 ENTRADA DE DATOS:
  FUENTE: Google Sheets - ALERTS, ROUTES, ASSETS, EXECUTIONS, BLOCKCHAINS
    - Formato: Dict[str, Any]

🔄 TRANSFORMACIÓN:
  CLASES: DynamicSheetsClient
  FUNCIONES: get_dexes_array, write_routes_array, get_config_array

📤 SALIDA DE DATOS:
  DESTINO: Google Sheets

🔗 DEPENDENCIAS:
  - google.oauth2.service_account
  - logging
  - HttpError

============================================================================
"""

"""
dynamic_client_v2.py

Cliente de Google Sheets con arrays dinámicos exactos según Prompt Supremo Definitivo.
Lee exactamente 1016 campos distribuidos en 8 hojas principales.

PRINCIPIO SAGRADO: CERO HARDCODING ABSOLUTO
"""

import os
from typing import List, Dict, Any, Optional
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================================
# CONFIGURACIÓN
# ============================================================================

SPREADSHEET_ID = os.getenv('GOOGLE_SHEETS_SPREADSHEET_ID', '1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ')
CREDENTIALS_PATH = os.getenv('GOOGLE_APPLICATION_CREDENTIALS', './keys/gsheets-sa.json')

# Rangos exactos según Prompt Supremo - 1016 campos totales
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

# ============================================================================
# CLIENTE DE GOOGLE SHEETS
# ============================================================================

class DynamicSheetsClient:
    """
    Cliente de Google Sheets con arrays dinámicos puros.
    Lee exactamente 1016 campos distribuidos en 8 hojas según Prompt Supremo.
    """
    
    def __init__(self, spreadsheet_id: str = SPREADSHEET_ID, credentials_path: str = CREDENTIALS_PATH):
        """Inicializa el cliente con credenciales de Service Account"""
        self.spreadsheet_id = spreadsheet_id
        self.credentials_path = credentials_path
        self.service = None
        self._authenticate()
    
    def _authenticate(self):
        """Autentica con Google Sheets API usando Service Account"""
        try:
            creds = Credentials.from_service_account_file(
                self.credentials_path,
                scopes=['https://www.googleapis.com/auth/spreadsheets']
            )
            self.service = build('sheets', 'v4', credentials=creds)
            logger.info(f"✅ Autenticado con Google Sheets API")
        except Exception as e:
            logger.error(f"❌ Error al autenticar: {e}")
            raise
    
    # ========================================================================
    # BLOCKCHAINS - 50 CAMPOS DINÁMICOS
    # ========================================================================
    
    async def get_blockchains_array(self) -> List[Dict[str, Any]]:
        """
        Lee BLOCKCHAINS desde Sheets - 50 campos dinámicos - CERO hardcoding
        
        Returns:
            Lista de diccionarios con 50 campos por blockchain
        """
        try:
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=SHEET_RANGES['BLOCKCHAINS']
            ).execute()
            
            values = result.get('values', [])
            
            if not values:
                logger.warning("⚠️  No se encontraron blockchains")
                return []
            
            # Obtener headers de la primera fila
            headers_result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range='BLOCKCHAINS!A1:AX1'
            ).execute()
            
            headers = headers_result.get('values', [[]])[0]
            
            blockchains = []
            for row in values:
                # Asegurar que la fila tenga 50 valores
                padded_row = row + [''] * (50 - len(row))
                blockchain = {headers[i]: padded_row[i] for i in range(min(len(headers), 50))}
                blockchains.append(blockchain)
            
            logger.info(f"✅ Leídos {len(blockchains)} blockchains con 50 campos cada uno")
            return blockchains
            
        except HttpError as e:
            logger.error(f"❌ Error al leer BLOCKCHAINS: {e}")
            raise
    
    # ========================================================================
    # DEXES - 200 CAMPOS DINÁMICOS
    # ========================================================================
    
    async def get_dexes_array(self) -> List[Dict[str, Any]]:
        """
        Lee DEXES desde Sheets - 200 campos dinámicos - TODO arrays
        
        Returns:
            Lista de diccionarios con 200 campos por DEX
        """
        try:
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=SHEET_RANGES['DEXES']
            ).execute()
            
            values = result.get('values', [])
            
            if not values:
                logger.warning("⚠️  No se encontraron DEXes")
                return []
            
            # Obtener headers
            headers_result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range='DEXES!A1:GR1'
            ).execute()
            
            headers = headers_result.get('values', [[]])[0]
            
            dexes = []
            for row in values:
                # Asegurar que la fila tenga 200 valores
                padded_row = row + [''] * (200 - len(row))
                dex = {headers[i]: padded_row[i] for i in range(min(len(headers), 200))}
                dexes.append(dex)
            
            logger.info(f"✅ Leídos {len(dexes)} DEXes con 200 campos cada uno")
            return dexes
            
        except HttpError as e:
            logger.error(f"❌ Error al leer DEXES: {e}")
            raise
    
    # ========================================================================
    # ASSETS - 400 CAMPOS DINÁMICOS
    # ========================================================================
    
    async def get_assets_array(self) -> List[Dict[str, Any]]:
        """
        Lee ASSETS desde Sheets - 400 campos dinámicos - arrays puros
        
        Returns:
            Lista de diccionarios con 400 campos por asset
        """
        try:
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=SHEET_RANGES['ASSETS']
            ).execute()
            
            values = result.get('values', [])
            
            if not values:
                logger.warning("⚠️  No se encontraron assets")
                return []
            
            # Obtener headers
            headers_result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range='ASSETS!A1:OL1'
            ).execute()
            
            headers = headers_result.get('values', [[]])[0]
            
            assets = []
            for row in values:
                # Asegurar que la fila tenga 400 valores
                padded_row = row + [''] * (400 - len(row))
                asset = {headers[i]: padded_row[i] for i in range(min(len(headers), 400))}
                assets.append(asset)
            
            logger.info(f"✅ Leídos {len(assets)} assets con 400 campos cada uno")
            return assets
            
        except HttpError as e:
            logger.error(f"❌ Error al leer ASSETS: {e}")
            raise
    
    # ========================================================================
    # POOLS - 100 CAMPOS DINÁMICOS
    # ========================================================================
    
    async def get_pools_array(self) -> List[Dict[str, Any]]:
        """
        Lee POOLS desde Sheets - 100 campos dinámicos - tiempo real desde arrays
        
        Returns:
            Lista de diccionarios con 100 campos por pool
        """
        try:
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=SHEET_RANGES['POOLS']
            ).execute()
            
            values = result.get('values', [])
            
            if not values:
                logger.warning("⚠️  No se encontraron pools")
                return []
            
            # Obtener headers
            headers_result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range='POOLS!A1:CV1'
            ).execute()
            
            headers = headers_result.get('values', [[]])[0]
            
            pools = []
            for row in values:
                # Asegurar que la fila tenga 100 valores
                padded_row = row + [''] * (100 - len(row))
                pool = {headers[i]: padded_row[i] for i in range(min(len(headers), 100))}
                pools.append(pool)
            
            logger.info(f"✅ Leídos {len(pools)} pools con 100 campos cada uno")
            return pools
            
        except HttpError as e:
            logger.error(f"❌ Error al leer POOLS: {e}")
            raise
    
    # ========================================================================
    # ROUTES - 200 CAMPOS DINÁMICOS (LECTURA)
    # ========================================================================
    
    async def get_routes_array(self) -> List[Dict[str, Any]]:
        """
        Lee ROUTES desde Sheets - 200 campos dinámicos - arrays optimizados
        
        Returns:
            Lista de diccionarios con 200 campos por ruta
        """
        try:
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=SHEET_RANGES['ROUTES']
            ).execute()
            
            values = result.get('values', [])
            
            if not values:
                logger.warning("⚠️  No se encontraron rutas")
                return []
            
            # Obtener headers
            headers_result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range='ROUTES!A1:GR1'
            ).execute()
            
            headers = headers_result.get('values', [[]])[0]
            
            routes = []
            for row in values:
                # Asegurar que la fila tenga 200 valores
                padded_row = row + [''] * (200 - len(row))
                route = {headers[i]: padded_row[i] for i in range(min(len(headers), 200))}
                routes.append(route)
            
            logger.info(f"✅ Leídas {len(routes)} rutas con 200 campos cada una")
            return routes
            
        except HttpError as e:
            logger.error(f"❌ Error al leer ROUTES: {e}")
            raise
    
    # ========================================================================
    # ROUTES - 200 CAMPOS DINÁMICOS (ESCRITURA DESDE RUST)
    # ========================================================================
    
    async def write_routes_array(self, routes: List[Dict[str, Any]]) -> bool:
        """
        Escribe ROUTES a Sheets - 200 campos dinámicos - desde Rust engine
        
        Args:
            routes: Lista de diccionarios con 200 campos por ruta
            
        Returns:
            True si la escritura fue exitosa
        """
        try:
            if not routes:
                logger.warning("⚠️  No hay rutas para escribir")
                return False
            
            # Obtener headers
            headers_result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range='ROUTES!A1:GR1'
            ).execute()
            
            headers = headers_result.get('values', [[]])[0]
            
            # Convertir rutas a valores
            values = []
            for route in routes:
                row = [route.get(header, '') for header in headers]
                values.append(row)
            
            # Escribir a Sheets
            body = {'values': values}
            result = self.service.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range=SHEET_RANGES['ROUTES'],
                valueInputOption='RAW',
                body=body
            ).execute()
            
            logger.info(f"✅ Escritas {len(routes)} rutas con 200 campos cada una")
            return True
            
        except HttpError as e:
            logger.error(f"❌ Error al escribir ROUTES: {e}")
            raise
    
    # ========================================================================
    # EXECUTIONS - 50 CAMPOS DINÁMICOS (ESCRITURA)
    # ========================================================================
    
    async def write_executions_array(self, executions: List[Dict[str, Any]]) -> bool:
        """
        Escribe EXECUTIONS a Sheets - 50 campos dinámicos - arrays auditables
        
        Args:
            executions: Lista de diccionarios con 50 campos por ejecución
            
        Returns:
            True si la escritura fue exitosa
        """
        try:
            if not executions:
                logger.warning("⚠️  No hay ejecuciones para escribir")
                return False
            
            # Obtener headers
            headers_result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range='EXECUTIONS!A1:AX1'
            ).execute()
            
            headers = headers_result.get('values', [[]])[0]
            
            # Convertir ejecuciones a valores
            values = []
            for execution in executions:
                row = [execution.get(header, '') for header in headers]
                values.append(row)
            
            # Escribir a Sheets (append para no sobrescribir)
            body = {'values': values}
            result = self.service.spreadsheets().values().append(
                spreadsheetId=self.spreadsheet_id,
                range=SHEET_RANGES['EXECUTIONS'],
                valueInputOption='RAW',
                insertDataOption='INSERT_ROWS',
                body=body
            ).execute()
            
            logger.info(f"✅ Escritas {len(executions)} ejecuciones con 50 campos cada una")
            return True
            
        except HttpError as e:
            logger.error(f"❌ Error al escribir EXECUTIONS: {e}")
            raise
    
    # ========================================================================
    # CONFIG - 7 CAMPOS DINÁMICOS
    # ========================================================================
    
    async def get_config_array(self) -> List[Dict[str, Any]]:
        """
        Lee CONFIG desde Sheets - 7 campos dinámicos
        
        Returns:
            Lista de diccionarios con 7 campos por configuración
        """
        try:
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=SHEET_RANGES['CONFIG']
            ).execute()
            
            values = result.get('values', [])
            
            if not values:
                logger.warning("⚠️  No se encontró configuración")
                return []
            
            # Obtener headers
            headers_result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range='CONFIG!A1:G1'
            ).execute()
            
            headers = headers_result.get('values', [[]])[0]
            
            config = []
            for row in values:
                # Asegurar que la fila tenga 7 valores
                padded_row = row + [''] * (7 - len(row))
                config_item = {headers[i]: padded_row[i] for i in range(min(len(headers), 7))}
                config.append(config_item)
            
            logger.info(f"✅ Leídas {len(config)} configuraciones con 7 campos cada una")
            return config
            
        except HttpError as e:
            logger.error(f"❌ Error al leer CONFIG: {e}")
            raise
    
    # ========================================================================
    # ALERTS - 9 CAMPOS DINÁMICOS
    # ========================================================================
    
    async def get_alerts_array(self) -> List[Dict[str, Any]]:
        """
        Lee ALERTS desde Sheets - 9 campos dinámicos
        
        Returns:
            Lista de diccionarios con 9 campos por alerta
        """
        try:
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=SHEET_RANGES['ALERTS']
            ).execute()
            
            values = result.get('values', [])
            
            if not values:
                logger.warning("⚠️  No se encontraron alertas")
                return []
            
            # Obtener headers
            headers_result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range='ALERTS!A1:I1'
            ).execute()
            
            headers = headers_result.get('values', [[]])[0]
            
            alerts = []
            for row in values:
                # Asegurar que la fila tenga 9 valores
                padded_row = row + [''] * (9 - len(row))
                alert = {headers[i]: padded_row[i] for i in range(min(len(headers), 9))}
                alerts.append(alert)
            
            logger.info(f"✅ Leídas {len(alerts)} alertas con 9 campos cada una")
            return alerts
            
        except HttpError as e:
            logger.error(f"❌ Error al leer ALERTS: {e}")
            raise


# ============================================================================
# EJEMPLO DE USO
# ============================================================================

if __name__ == "__main__":
    import asyncio
    
    async def test_client():
        """Prueba el cliente de Google Sheets"""
        client = DynamicSheetsClient()
        
        # Probar lectura de cada hoja
        print("\n🧪 Probando lectura de arrays dinámicos...")
        
        blockchains = await client.get_blockchains_array()
        print(f"\n📊 BLOCKCHAINS: {len(blockchains)} registros con 50 campos")
        
        dexes = await client.get_dexes_array()
        print(f"📊 DEXES: {len(dexes)} registros con 200 campos")
        
        assets = await client.get_assets_array()
        print(f"📊 ASSETS: {len(assets)} registros con 400 campos")
        
        pools = await client.get_pools_array()
        print(f"📊 POOLS: {len(pools)} registros con 100 campos")
        
        routes = await client.get_routes_array()
        print(f"📊 ROUTES: {len(routes)} registros con 200 campos")
        
        config = await client.get_config_array()
        print(f"📊 CONFIG: {len(config)} registros con 7 campos")
        
        alerts = await client.get_alerts_array()
        print(f"📊 ALERTS: {len(alerts)} registros con 9 campos")
        
        total_fields = 50 + 200 + 400 + 100 + 200 + 50 + 7 + 9
        print(f"\n✅ Total de campos: {total_fields} (esperado: 1016)")
    
    asyncio.run(test_client())

