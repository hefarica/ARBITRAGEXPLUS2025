"""
dynamic_client.py

Cliente de Google Sheets con arrays dinámicos completos según Prompt Supremo Definitivo.
Lee TODAS las columnas dinámicamente desde las hojas expandidas (861+ campos).

PRINCIPIO SAGRADO: CERO HARDCODING ABSOLUTO
"""

import os
from typing import List, Dict, Any, Optional
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import logging

logger = logging.getLogger(__name__)


class DynamicSheetsClient:
    """Cliente dinámico para Google Sheets Brain con 861+ campos"""
    
    def __init__(self):
        """Inicializa el cliente con service account"""
        self.spreadsheet_id = os.getenv('GOOGLE_SHEETS_SPREADSHEET_ID')
        credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
        
        if not self.spreadsheet_id:
            raise ValueError("GOOGLE_SHEETS_SPREADSHEET_ID no configurado")
        if not credentials_path:
            raise ValueError("GOOGLE_APPLICATION_CREDENTIALS no configurado")
        
        # Autenticar
        credentials = service_account.Credentials.from_service_account_file(
            credentials_path,
            scopes=['https://www.googleapis.com/auth/spreadsheets']
        )
        
        self.service = build('sheets', 'v4', credentials=credentials)
        self.sheets = self.service.spreadsheets()
        
        logger.info(f"✅ DynamicSheetsClient inicializado para spreadsheet: {self.spreadsheet_id}")
    
    # ========================================================================
    # BLOCKCHAINS - 49 campos dinámicos
    # ========================================================================
    
    async def get_blockchains_array(self) -> List[Dict[str, Any]]:
        """
        Lee BLOCKCHAINS desde Sheets - 49 campos dinámicos
        
        Returns:
            Lista de blockchains con todos los campos dinámicos
        """
        try:
            # Leer encabezados para mapeo dinámico
            headers_result = self.sheets.values().get(
                spreadsheetId=self.spreadsheet_id,
                range='BLOCKCHAINS!A1:AW1'  # 49 columnas = AW
            ).execute()
            
            headers = headers_result.get('values', [[]])[0]
            
            # Leer datos
            data_result = self.sheets.values().get(
                spreadsheetId=self.spreadsheet_id,
                range='BLOCKCHAINS!A2:AW'  # Desde fila 2 hasta el final
            ).execute()
            
            rows = data_result.get('values', [])
            
            # Mapear dinámicamente cada fila
            blockchains = []
            for row in rows:
                # Extender row si es más corta que headers
                row_extended = row + [''] * (len(headers) - len(row))
                
                blockchain = {}
                for i, header in enumerate(headers):
                    blockchain[header.lower().replace(' ', '_')] = row_extended[i]
                
                # Solo incluir si está activo
                if blockchain.get('is_active', '').upper() == 'TRUE':
                    blockchains.append(blockchain)
            
            logger.info(f"✅ Leídos {len(blockchains)} blockchains activos con {len(headers)} campos cada uno")
            return blockchains
            
        except HttpError as error:
            logger.error(f"❌ Error leyendo BLOCKCHAINS: {error}")
            raise
    
    # ========================================================================
    # DEXES - 171 campos dinámicos
    # ========================================================================
    
    async def get_dexes_array(self) -> List[Dict[str, Any]]:
        """
        Lee DEXES desde Sheets - 171 campos dinámicos
        
        Returns:
            Lista de DEXes con todos los campos dinámicos
        """
        try:
            # Leer encabezados (171 columnas = FO)
            headers_result = self.sheets.values().get(
                spreadsheetId=self.spreadsheet_id,
                range='DEXES!A1:FO1'
            ).execute()
            
            headers = headers_result.get('values', [[]])[0]
            
            # Leer datos
            data_result = self.sheets.values().get(
                spreadsheetId=self.spreadsheet_id,
                range='DEXES!A2:FO'
            ).execute()
            
            rows = data_result.get('values', [])
            
            # Mapear dinámicamente
            dexes = []
            for row in rows:
                row_extended = row + [''] * (len(headers) - len(row))
                
                dex = {}
                for i, header in enumerate(headers):
                    dex[header.lower().replace(' ', '_')] = row_extended[i]
                
                # Solo incluir si está activo
                if dex.get('is_active', '').upper() == 'TRUE':
                    dexes.append(dex)
            
            logger.info(f"✅ Leídos {len(dexes)} DEXes activos con {len(headers)} campos cada uno")
            return dexes
            
        except HttpError as error:
            logger.error(f"❌ Error leyendo DEXES: {error}")
            raise
    
    # ========================================================================
    # ASSETS - 326 campos dinámicos
    # ========================================================================
    
    async def get_assets_array(self, blockchain_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Lee ASSETS desde Sheets - 326 campos dinámicos
        
        Args:
            blockchain_id: Filtrar por blockchain específico (opcional)
        
        Returns:
            Lista de assets con todos los campos dinámicos
        """
        try:
            # Leer encabezados (326 columnas = LV)
            headers_result = self.sheets.values().get(
                spreadsheetId=self.spreadsheet_id,
                range='ASSETS!A1:LV1'
            ).execute()
            
            headers = headers_result.get('values', [[]])[0]
            
            # Leer datos
            data_result = self.sheets.values().get(
                spreadsheetId=self.spreadsheet_id,
                range='ASSETS!A2:LV'
            ).execute()
            
            rows = data_result.get('values', [])
            
            # Mapear dinámicamente
            assets = []
            for row in rows:
                row_extended = row + [''] * (len(headers) - len(row))
                
                asset = {}
                for i, header in enumerate(headers):
                    asset[header.lower().replace(' ', '_')] = row_extended[i]
                
                # Filtros
                is_active = asset.get('is_active', '').upper() == 'TRUE'
                matches_blockchain = (blockchain_id is None or 
                                    asset.get('blockchain_id') == blockchain_id)
                
                if is_active and matches_blockchain:
                    assets.append(asset)
            
            logger.info(f"✅ Leídos {len(assets)} assets activos con {len(headers)} campos cada uno")
            return assets
            
        except HttpError as error:
            logger.error(f"❌ Error leyendo ASSETS: {error}")
            raise
    
    # ========================================================================
    # POOLS - 94 campos dinámicos
    # ========================================================================
    
    async def get_pools_array(self, dex_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Lee POOLS desde Sheets - 94 campos dinámicos
        
        Args:
            dex_id: Filtrar por DEX específico (opcional)
        
        Returns:
            Lista de pools con todos los campos dinámicos
        """
        try:
            # Leer encabezados (94 columnas = CP)
            headers_result = self.sheets.values().get(
                spreadsheetId=self.spreadsheet_id,
                range='POOLS!A1:CP1'
            ).execute()
            
            headers = headers_result.get('values', [[]])[0]
            
            # Leer datos
            data_result = self.sheets.values().get(
                spreadsheetId=self.spreadsheet_id,
                range='POOLS!A2:CP'
            ).execute()
            
            rows = data_result.get('values', [])
            
            # Mapear dinámicamente
            pools = []
            for row in rows:
                row_extended = row + [''] * (len(headers) - len(row))
                
                pool = {}
                for i, header in enumerate(headers):
                    pool[header.lower().replace(' ', '_')] = row_extended[i]
                
                # Filtros
                is_active = pool.get('is_active', '').upper() == 'TRUE'
                matches_dex = (dex_id is None or pool.get('dex_id') == dex_id)
                
                if is_active and matches_dex:
                    pools.append(pool)
            
            logger.info(f"✅ Leídos {len(pools)} pools activos con {len(headers)} campos cada uno")
            return pools
            
        except HttpError as error:
            logger.error(f"❌ Error leyendo POOLS: {error}")
            raise
    
    # ========================================================================
    # ROUTES - 172 campos dinámicos (SOLO LECTURA)
    # ========================================================================
    
    async def get_routes_array(self, 
                               is_active: bool = True,
                               is_profitable: bool = True,
                               min_profit_usd: float = 0.0) -> List[Dict[str, Any]]:
        """
        Lee ROUTES desde Sheets - 172 campos dinámicos
        
        Args:
            is_active: Filtrar solo rutas activas
            is_profitable: Filtrar solo rutas rentables
            min_profit_usd: Profit mínimo en USD
        
        Returns:
            Lista de rutas con todos los campos dinámicos
        """
        try:
            # Leer encabezados (172 columnas = FP)
            headers_result = self.sheets.values().get(
                spreadsheetId=self.spreadsheet_id,
                range='ROUTES!A1:FP1'
            ).execute()
            
            headers = headers_result.get('values', [[]])[0]
            
            # Leer datos
            data_result = self.sheets.values().get(
                spreadsheetId=self.spreadsheet_id,
                range='ROUTES!A2:FP'
            ).execute()
            
            rows = data_result.get('values', [])
            
            # Mapear dinámicamente
            routes = []
            for row in rows:
                row_extended = row + [''] * (len(headers) - len(row))
                
                route = {}
                for i, header in enumerate(headers):
                    route[header.lower().replace(' ', '_')] = row_extended[i]
                
                # Filtros
                active_check = (not is_active or 
                              route.get('is_active', '').upper() == 'TRUE')
                
                profitable_check = (not is_profitable or 
                                  route.get('is_profitable', '').upper() == 'TRUE')
                
                try:
                    profit_usd = float(route.get('expected_profit_usd', 0) or 0)
                except (ValueError, TypeError):
                    profit_usd = 0.0
                
                profit_check = profit_usd >= min_profit_usd
                
                if active_check and profitable_check and profit_check:
                    routes.append(route)
            
            logger.info(f"✅ Leídas {len(routes)} rutas filtradas con {len(headers)} campos cada una")
            return routes
            
        except HttpError as error:
            logger.error(f"❌ Error leyendo ROUTES: {error}")
            raise
    
    # ========================================================================
    # ROUTES - ESCRITURA (generadas por Rust Engine)
    # ========================================================================
    
    async def write_routes_array(self, routes: List[Dict[str, Any]]) -> bool:
        """
        Escribe rutas generadas por Rust Engine a ROUTES
        
        Args:
            routes: Lista de rutas con todos los campos
        
        Returns:
            True si se escribió exitosamente
        """
        try:
            if not routes:
                logger.warning("⚠️  No hay rutas para escribir")
                return False
            
            # Leer encabezados para mapeo
            headers_result = self.sheets.values().get(
                spreadsheetId=self.spreadsheet_id,
                range='ROUTES!A1:FP1'
            ).execute()
            
            headers = headers_result.get('values', [[]])[0]
            header_map = {h.lower().replace(' ', '_'): i for i, h in enumerate(headers)}
            
            # Convertir rutas a filas
            rows = []
            for route in routes:
                row = [''] * len(headers)
                for key, value in route.items():
                    if key in header_map:
                        row[header_map[key]] = str(value) if value is not None else ''
                rows.append(row)
            
            # Escribir (append)
            self.sheets.values().append(
                spreadsheetId=self.spreadsheet_id,
                range='ROUTES!A2',
                valueInputOption='RAW',
                insertDataOption='INSERT_ROWS',
                body={'values': rows}
            ).execute()
            
            logger.info(f"✅ Escritas {len(rows)} rutas a ROUTES")
            return True
            
        except HttpError as error:
            logger.error(f"❌ Error escribiendo ROUTES: {error}")
            raise
    
    # ========================================================================
    # EXECUTIONS - 49 campos dinámicos (ESCRITURA)
    # ========================================================================
    
    async def write_executions_array(self, executions: List[Dict[str, Any]]) -> bool:
        """
        Escribe resultados de ejecución a EXECUTIONS
        
        Args:
            executions: Lista de ejecuciones con todos los campos
        
        Returns:
            True si se escribió exitosamente
        """
        try:
            if not executions:
                logger.warning("⚠️  No hay ejecuciones para escribir")
                return False
            
            # Leer encabezados
            headers_result = self.sheets.values().get(
                spreadsheetId=self.spreadsheet_id,
                range='EXECUTIONS!A1:AW1'
            ).execute()
            
            headers = headers_result.get('values', [[]])[0]
            header_map = {h.lower().replace(' ', '_'): i for i, h in enumerate(headers)}
            
            # Convertir a filas
            rows = []
            for execution in executions:
                row = [''] * len(headers)
                for key, value in execution.items():
                    if key in header_map:
                        row[header_map[key]] = str(value) if value is not None else ''
                rows.append(row)
            
            # Escribir (append)
            self.sheets.values().append(
                spreadsheetId=self.spreadsheet_id,
                range='EXECUTIONS!A2',
                valueInputOption='RAW',
                insertDataOption='INSERT_ROWS',
                body={'values': rows}
            ).execute()
            
            logger.info(f"✅ Escritas {len(rows)} ejecuciones a EXECUTIONS")
            return True
            
        except HttpError as error:
            logger.error(f"❌ Error escribiendo EXECUTIONS: {error}")
            raise
    
    # ========================================================================
    # UTILIDADES
    # ========================================================================
    
    async def get_sheet_metadata(self, sheet_name: str) -> Dict[str, Any]:
        """
        Obtiene metadata de una hoja (número de filas, columnas, etc.)
        
        Args:
            sheet_name: Nombre de la hoja
        
        Returns:
            Metadata de la hoja
        """
        try:
            spreadsheet = self.sheets.get(spreadsheetId=self.spreadsheet_id).execute()
            
            for sheet in spreadsheet.get('sheets', []):
                if sheet['properties']['title'] == sheet_name:
                    props = sheet['properties']
                    grid = props.get('gridProperties', {})
                    
                    return {
                        'sheet_id': props['sheetId'],
                        'title': props['title'],
                        'row_count': grid.get('rowCount', 0),
                        'column_count': grid.get('columnCount', 0),
                        'frozen_row_count': grid.get('frozenRowCount', 0),
                        'frozen_column_count': grid.get('frozenColumnCount', 0)
                    }
            
            raise ValueError(f"Hoja '{sheet_name}' no encontrada")
            
        except HttpError as error:
            logger.error(f"❌ Error obteniendo metadata de {sheet_name}: {error}")
            raise

