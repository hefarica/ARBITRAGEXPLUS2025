"""
Route Writer - Escritura dinámica de rutas a Google Sheets

Escribe rutas de arbitraje calculadas a la hoja ROUTES de Google Sheets.
TODO consume datos dinámicamente desde arrays, sin hardcoding.

Premisas:
1. Datos desde Sheets/APIs (no hardcoded)
2. Arrays dinámicos (map, filter, reduce equivalentes en Python)
3. Consumido por otros módulos
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from .client import SheetsClient


class RouteWriter:
    """
    Escritor de rutas de arbitraje a Google Sheets.
    Consume configuración dinámica desde CONFIG_GENERAL.
    """
    
    def __init__(self, sheets_client: SheetsClient, spreadsheet_id: str):
        """
        Inicializa el escritor de rutas.
        
        Args:
            sheets_client: Cliente de Google Sheets
            spreadsheet_id: ID del spreadsheet
        """
        self.client = sheets_client
        self.spreadsheet_id = spreadsheet_id
        self.routes_sheet = "ROUTES"
        
        # Obtener configuración dinámica de columnas desde Sheets
        self._load_column_config()
    
    def _load_column_config(self) -> None:
        """
        Carga la configuración de columnas desde CONFIG_GENERAL.
        Esto permite cambiar el esquema sin modificar código.
        """
        try:
            config_data = self.client.read_range(
                self.spreadsheet_id,
                "CONFIG_GENERAL!A2:H100"
            )
            
            # Filtrar configuración de columnas de ROUTES
            self.column_config = [
                row for row in config_data
                if len(row) > 0 and 'ROUTES_COLUMN' in str(row[0])
            ]
            
            # Mapear nombres de columnas dinámicamente
            self.column_mapping = {
                row[0].replace('ROUTES_COLUMN_', ''): idx
                for idx, row in enumerate(self.column_config)
            } if self.column_config else self._default_column_mapping()
            
        except Exception as e:
            print(f"Warning: Could not load column config from Sheets: {e}")
            self.column_mapping = self._default_column_mapping()
    
    def _default_column_mapping(self) -> Dict[str, int]:
        """
        Mapeo por defecto de columnas (usado solo si Sheets no está disponible).
        """
        return {
            'ROUTE_ID': 0,
            'TIMESTAMP': 1,
            'CHAIN': 2,
            'PATH': 3,
            'EXPECTED_PROFIT': 4,
            'GAS_COST': 5,
            'NET_PROFIT': 6,
            'STATUS': 7
        }
    
    def write_routes(self, routes: List[Dict[str, Any]]) -> bool:
        """
        Escribe múltiples rutas a Google Sheets usando arrays dinámicos.
        
        Args:
            routes: Lista de rutas calculadas
            
        Returns:
            True si la escritura fue exitosa
        """
        if not routes:
            return True
        
        # Transformar rutas usando list comprehension (array dinámico)
        rows = [
            self._route_to_row(route)
            for route in routes
        ]
        
        # Filtrar rutas válidas (array dinámico)
        valid_rows = [
            row for row in rows
            if row is not None and len(row) > 0
        ]
        
        if not valid_rows:
            return True
        
        # Escribir a Sheets
        try:
            range_name = f"{self.routes_sheet}!A{self._get_next_row()}:H"
            self.client.write_range(
                self.spreadsheet_id,
                range_name,
                valid_rows
            )
            return True
        except Exception as e:
            print(f"Error writing routes to Sheets: {e}")
            return False
    
    def _route_to_row(self, route: Dict[str, Any]) -> Optional[List[Any]]:
        """
        Convierte una ruta a una fila de Sheets usando el mapeo dinámico.
        
        Args:
            route: Diccionario con datos de la ruta
            
        Returns:
            Lista de valores para la fila
        """
        try:
            # Crear fila usando el mapeo dinámico de columnas
            row = [''] * len(self.column_mapping)
            
            # Mapear campos dinámicamente
            field_mapping = {
                'ROUTE_ID': route.get('id', ''),
                'TIMESTAMP': route.get('timestamp', datetime.now().isoformat()),
                'CHAIN': route.get('chain', ''),
                'PATH': self._format_path(route.get('path', [])),
                'EXPECTED_PROFIT': route.get('expected_profit', 0),
                'GAS_COST': route.get('gas_cost', 0),
                'NET_PROFIT': route.get('net_profit', 0),
                'STATUS': route.get('status', 'PENDING')
            }
            
            # Asignar valores usando el mapeo dinámico
            for field, value in field_mapping.items():
                if field in self.column_mapping:
                    row[self.column_mapping[field]] = value
            
            return row
        except Exception as e:
            print(f"Error converting route to row: {e}")
            return None
    
    def _format_path(self, path: List[str]) -> str:
        """
        Formatea el path de la ruta usando array dinámico.
        
        Args:
            path: Lista de DEXs en el path
            
        Returns:
            String formateado del path
        """
        # Usar join con list comprehension (array dinámico)
        return ' → '.join([
            str(dex) for dex in path
        ]) if path else ''
    
    def _get_next_row(self) -> int:
        """
        Obtiene el siguiente número de fila disponible en ROUTES.
        
        Returns:
            Número de fila
        """
        try:
            existing_data = self.client.read_range(
                self.spreadsheet_id,
                f"{self.routes_sheet}!A:A"
            )
            return len(existing_data) + 1
        except:
            return 2  # Fila 1 es header
    
    def update_route_status(self, route_id: str, status: str, tx_hash: Optional[str] = None) -> bool:
        """
        Actualiza el estado de una ruta específica.
        
        Args:
            route_id: ID de la ruta
            status: Nuevo estado
            tx_hash: Hash de transacción (opcional)
            
        Returns:
            True si la actualización fue exitosa
        """
        try:
            # Leer todas las rutas
            routes_data = self.client.read_range(
                self.spreadsheet_id,
                f"{self.routes_sheet}!A2:H1000"
            )
            
            # Buscar la ruta usando list comprehension (array dinámico)
            matching_rows = [
                (idx, row) for idx, row in enumerate(routes_data)
                if len(row) > 0 and row[0] == route_id
            ]
            
            if not matching_rows:
                return False
            
            row_idx, row = matching_rows[0]
            
            # Actualizar estado
            status_col = self.column_mapping.get('STATUS', 7)
            row[status_col] = status
            
            # Actualizar TX hash si se proporciona
            if tx_hash and 'TX_HASH' in self.column_mapping:
                tx_col = self.column_mapping['TX_HASH']
                if tx_col < len(row):
                    row[tx_col] = tx_hash
            
            # Escribir fila actualizada
            range_name = f"{self.routes_sheet}!A{row_idx + 2}:H{row_idx + 2}"
            self.client.write_range(
                self.spreadsheet_id,
                range_name,
                [row]
            )
            
            return True
        except Exception as e:
            print(f"Error updating route status: {e}")
            return False
    
    def get_pending_routes(self) -> List[Dict[str, Any]]:
        """
        Obtiene todas las rutas pendientes usando arrays dinámicos.
        
        Returns:
            Lista de rutas pendientes
        """
        try:
            routes_data = self.client.read_range(
                self.spreadsheet_id,
                f"{self.routes_sheet}!A2:H1000"
            )
            
            # Filtrar rutas pendientes usando list comprehension
            status_col = self.column_mapping.get('STATUS', 7)
            pending_routes = [
                self._row_to_route(row)
                for row in routes_data
                if len(row) > status_col and row[status_col] == 'PENDING'
            ]
            
            # Filtrar None values
            return [r for r in pending_routes if r is not None]
        except Exception as e:
            print(f"Error getting pending routes: {e}")
            return []
    
    def _row_to_route(self, row: List[Any]) -> Optional[Dict[str, Any]]:
        """
        Convierte una fila de Sheets a un diccionario de ruta.
        
        Args:
            row: Fila de Sheets
            
        Returns:
            Diccionario con datos de la ruta
        """
        try:
            # Mapeo inverso usando el column_mapping dinámico
            return {
                'id': row[self.column_mapping.get('ROUTE_ID', 0)],
                'timestamp': row[self.column_mapping.get('TIMESTAMP', 1)],
                'chain': row[self.column_mapping.get('CHAIN', 2)],
                'path': row[self.column_mapping.get('PATH', 3)].split(' → '),
                'expected_profit': float(row[self.column_mapping.get('EXPECTED_PROFIT', 4)] or 0),
                'gas_cost': float(row[self.column_mapping.get('GAS_COST', 5)] or 0),
                'net_profit': float(row[self.column_mapping.get('NET_PROFIT', 6)] or 0),
                'status': row[self.column_mapping.get('STATUS', 7)]
            }
        except Exception as e:
            print(f"Error converting row to route: {e}")
            return None


# Export para consumo por otros módulos
__all__ = ['RouteWriter']

