"""
Schema - Definiciones de esquema dinámicas desde Google Sheets

Define y valida el esquema de datos consumiendo la configuración desde Sheets.
TODO es dinámico, sin hardcoding de estructuras.

Premisas:
1. Esquemas definidos en CONFIG_GENERAL de Sheets
2. Validación dinámica usando arrays
3. Consumido por route_writer y otros módulos
"""

from typing import Dict, List, Any, Optional, Set
from enum import Enum
from .client import SheetsClient


class SheetName(Enum):
    """Nombres de hojas (cargados dinámicamente desde Sheets)"""
    BLOCKCHAINS = "BLOCKCHAINS"
    DEXES = "DEXES"
    ASSETS = "ASSETS"
    POOLS = "POOLS"
    ROUTES = "ROUTES"
    EXECUTIONS = "EXECUTIONS"
    CONFIG_GENERAL = "CONFIG_GENERAL"
    ALERTS = "ALERTS"
    MODULOS_REGISTRADOS = "MODULOS_REGISTRADOS"


class SchemaValidator:
    """
    Validador de esquemas que consume definiciones desde Sheets.
    No hardcodea estructuras, todo viene de CONFIG_GENERAL.
    """
    
    def __init__(self, sheets_client: SheetsClient, spreadsheet_id: str):
        """
        Inicializa el validador de esquemas.
        
        Args:
            sheets_client: Cliente de Google Sheets
            spreadsheet_id: ID del spreadsheet
        """
        self.client = sheets_client
        self.spreadsheet_id = spreadsheet_id
        self.schemas: Dict[str, Dict[str, Any]] = {}
        
        # Cargar esquemas dinámicamente desde Sheets
        self._load_schemas()
    
    def _load_schemas(self) -> None:
        """
        Carga las definiciones de esquemas desde CONFIG_GENERAL.
        Permite modificar esquemas sin cambiar código.
        """
        try:
            config_data = self.client.read_range(
                self.spreadsheet_id,
                "CONFIG_GENERAL!A2:H1000"
            )
            
            # Agrupar configuraciones por hoja usando dict comprehension
            sheet_configs = {}
            for row in config_data:
                if len(row) < 2:
                    continue
                
                # Parsear clave de configuración (ej: "BLOCKCHAINS_SCHEMA_FIELD_NAME")
                parts = row[0].split('_')
                if len(parts) >= 3 and parts[1] == 'SCHEMA':
                    sheet_name = parts[0]
                    field_type = '_'.join(parts[2:])
                    
                    if sheet_name not in sheet_configs:
                        sheet_configs[sheet_name] = {}
                    
                    sheet_configs[sheet_name][field_type] = row[1]
            
            # Convertir a esquemas estructurados
            self.schemas = {
                sheet: self._parse_schema_config(config)
                for sheet, config in sheet_configs.items()
            }
            
        except Exception as e:
            print(f"Warning: Could not load schemas from Sheets: {e}")
            self.schemas = self._default_schemas()
    
    def _parse_schema_config(self, config: Dict[str, str]) -> Dict[str, Any]:
        """
        Parsea la configuración de esquema a un formato estructurado.
        
        Args:
            config: Configuración cruda desde Sheets
            
        Returns:
            Esquema estructurado
        """
        schema = {
            'fields': {},
            'required': [],
            'unique': []
        }
        
        # Parsear campos usando list comprehension
        field_keys = [k for k in config.keys() if k.startswith('FIELD_')]
        for field_key in field_keys:
            field_name = field_key.replace('FIELD_', '')
            field_config = config[field_key]
            
            # Parsear tipo y restricciones
            parts = field_config.split('|')
            field_type = parts[0] if parts else 'string'
            
            schema['fields'][field_name] = {
                'type': field_type,
                'required': 'required' in field_config.lower(),
                'unique': 'unique' in field_config.lower()
            }
            
            if 'required' in field_config.lower():
                schema['required'].append(field_name)
            if 'unique' in field_config.lower():
                schema['unique'].append(field_name)
        
        return schema
    
    def _default_schemas(self) -> Dict[str, Dict[str, Any]]:
        """
        Esquemas por defecto (solo usado si Sheets no está disponible).
        Mínimo hardcoding, solo estructura básica.
        """
        return {
            'BLOCKCHAINS': {
                'fields': {
                    'CHAIN_ID': {'type': 'string', 'required': True, 'unique': True},
                    'NAME': {'type': 'string', 'required': True, 'unique': False},
                    'RPC_URL': {'type': 'string', 'required': True, 'unique': False},
                    'CHAIN_ID_NUM': {'type': 'number', 'required': True, 'unique': True}
                },
                'required': ['CHAIN_ID', 'NAME', 'RPC_URL', 'CHAIN_ID_NUM'],
                'unique': ['CHAIN_ID', 'CHAIN_ID_NUM']
            },
            'DEXES': {
                'fields': {
                    'DEX_ID': {'type': 'string', 'required': True, 'unique': True},
                    'NAME': {'type': 'string', 'required': True, 'unique': False},
                    'CHAIN': {'type': 'string', 'required': True, 'unique': False},
                    'ROUTER_ADDRESS': {'type': 'address', 'required': True, 'unique': False}
                },
                'required': ['DEX_ID', 'NAME', 'CHAIN', 'ROUTER_ADDRESS'],
                'unique': ['DEX_ID']
            },
            'ROUTES': {
                'fields': {
                    'ROUTE_ID': {'type': 'string', 'required': True, 'unique': True},
                    'TIMESTAMP': {'type': 'datetime', 'required': True, 'unique': False},
                    'CHAIN': {'type': 'string', 'required': True, 'unique': False},
                    'PATH': {'type': 'string', 'required': True, 'unique': False},
                    'EXPECTED_PROFIT': {'type': 'number', 'required': True, 'unique': False},
                    'STATUS': {'type': 'string', 'required': True, 'unique': False}
                },
                'required': ['ROUTE_ID', 'TIMESTAMP', 'CHAIN', 'PATH'],
                'unique': ['ROUTE_ID']
            }
        }
    
    def validate(self, sheet_name: str, data: Dict[str, Any]) -> tuple[bool, List[str]]:
        """
        Valida datos contra el esquema de una hoja.
        
        Args:
            sheet_name: Nombre de la hoja
            data: Datos a validar
            
        Returns:
            (es_válido, lista_de_errores)
        """
        if sheet_name not in self.schemas:
            return False, [f"Schema not found for sheet: {sheet_name}"]
        
        schema = self.schemas[sheet_name]
        errors = []
        
        # Validar campos requeridos usando list comprehension
        missing_required = [
            field for field in schema['required']
            if field not in data or data[field] is None or data[field] == ''
        ]
        
        if missing_required:
            errors.extend([
                f"Missing required field: {field}"
                for field in missing_required
            ])
        
        # Validar tipos de datos
        for field_name, field_value in data.items():
            if field_name not in schema['fields']:
                continue
            
            field_schema = schema['fields'][field_name]
            expected_type = field_schema['type']
            
            if not self._validate_type(field_value, expected_type):
                errors.append(
                    f"Invalid type for {field_name}: expected {expected_type}, got {type(field_value).__name__}"
                )
        
        return len(errors) == 0, errors
    
    def _validate_type(self, value: Any, expected_type: str) -> bool:
        """
        Valida el tipo de un valor.
        
        Args:
            value: Valor a validar
            expected_type: Tipo esperado
            
        Returns:
            True si el tipo es válido
        """
        if value is None or value == '':
            return True  # None/empty permitido para campos no requeridos
        
        type_validators = {
            'string': lambda v: isinstance(v, str),
            'number': lambda v: isinstance(v, (int, float)) or (isinstance(v, str) and v.replace('.', '').replace('-', '').isdigit()),
            'boolean': lambda v: isinstance(v, bool) or v in ['true', 'false', 'True', 'False', '1', '0'],
            'datetime': lambda v: isinstance(v, str),  # Simplified, could use dateutil
            'address': lambda v: isinstance(v, str) and (v.startswith('0x') or v == ''),
        }
        
        validator = type_validators.get(expected_type, lambda v: True)
        return validator(value)
    
    def get_required_fields(self, sheet_name: str) -> List[str]:
        """
        Obtiene los campos requeridos de una hoja.
        
        Args:
            sheet_name: Nombre de la hoja
            
        Returns:
            Lista de campos requeridos
        """
        if sheet_name not in self.schemas:
            return []
        
        return self.schemas[sheet_name]['required']
    
    def get_unique_fields(self, sheet_name: str) -> List[str]:
        """
        Obtiene los campos únicos de una hoja.
        
        Args:
            sheet_name: Nombre de la hoja
            
        Returns:
            Lista de campos únicos
        """
        if sheet_name not in self.schemas:
            return []
        
        return self.schemas[sheet_name]['unique']
    
    def validate_batch(self, sheet_name: str, data_list: List[Dict[str, Any]]) -> tuple[bool, Dict[int, List[str]]]:
        """
        Valida un lote de datos usando arrays dinámicos.
        
        Args:
            sheet_name: Nombre de la hoja
            data_list: Lista de datos a validar
            
        Returns:
            (todos_válidos, {índice: lista_de_errores})
        """
        # Validar cada elemento usando enumerate (array dinámico)
        validation_results = {
            idx: self.validate(sheet_name, data)
            for idx, data in enumerate(data_list)
        }
        
        # Filtrar solo los que tienen errores
        errors_by_index = {
            idx: errors
            for idx, (is_valid, errors) in validation_results.items()
            if not is_valid
        }
        
        all_valid = len(errors_by_index) == 0
        
        return all_valid, errors_by_index
    
    def check_uniqueness(self, sheet_name: str, data_list: List[Dict[str, Any]]) -> tuple[bool, List[str]]:
        """
        Verifica que los campos únicos no estén duplicados en el lote.
        
        Args:
            sheet_name: Nombre de la hoja
            data_list: Lista de datos
            
        Returns:
            (sin_duplicados, lista_de_duplicados)
        """
        unique_fields = self.get_unique_fields(sheet_name)
        if not unique_fields:
            return True, []
        
        duplicates = []
        
        # Verificar cada campo único
        for field in unique_fields:
            # Extraer valores usando list comprehension
            values = [
                data.get(field)
                for data in data_list
                if field in data and data[field] is not None
            ]
            
            # Encontrar duplicados usando set
            seen: Set[Any] = set()
            field_duplicates = [
                value for value in values
                if value in seen or seen.add(value)  # type: ignore
            ]
            
            if field_duplicates:
                duplicates.extend([
                    f"Duplicate {field}: {dup}"
                    for dup in set(field_duplicates)
                ])
        
        return len(duplicates) == 0, duplicates


# Export para consumo por otros módulos
__all__ = ['SchemaValidator', 'SheetName']

