#!/usr/bin/env python3
"""
Script para crear hojas ERROR_HANDLING_CONFIG y COLLECTORS_CONFIG en Google Sheets
"""

import os
import sys
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Configuración
SPREADSHEET_ID = '1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
CREDENTIALS_PATH = '/home/ubuntu/ARBITRAGEXPLUS2025/keys/gsheets-sa.json'

def get_sheets_service():
    """Obtiene el servicio de Google Sheets"""
    credentials = service_account.Credentials.from_service_account_file(
        CREDENTIALS_PATH, scopes=SCOPES
    )
    service = build('sheets', 'v4', credentials=credentials)
    return service

def create_error_handling_config_sheet(service):
    """Crea la hoja ERROR_HANDLING_CONFIG"""
    print("\n📝 Creando hoja ERROR_HANDLING_CONFIG...")
    
    # Datos de configuración de errores
    error_configs = [
        ['ERROR_CODE', 'SHOULD_LOG', 'SHOULD_ALERT', 'SHOULD_RETRY', 'MAX_RETRIES', 'RETRY_DELAY', 'CUSTOM_HANDLERS', 'NOTES'],
        ['VALIDATION_ERROR', 'TRUE', 'FALSE', 'FALSE', '0', '0', '', 'Errores de validación de entrada'],
        ['RPC_ERROR', 'TRUE', 'TRUE', 'TRUE', '3', '1000', 'blockchain_error_handler', 'Errores de RPC/blockchain'],
        ['SHEETS_ERROR', 'TRUE', 'TRUE', 'TRUE', '3', '2000', 'sheets_error_handler', 'Errores de Google Sheets'],
        ['ORACLE_ERROR', 'TRUE', 'TRUE', 'TRUE', '3', '1000', '', 'Errores de oráculos de precios'],
        ['NETWORK_ERROR', 'TRUE', 'FALSE', 'TRUE', '5', '2000', '', 'Errores de red/conectividad'],
        ['TIMEOUT_ERROR', 'TRUE', 'FALSE', 'TRUE', '2', '3000', '', 'Errores de timeout'],
        ['AUTH_ERROR', 'TRUE', 'TRUE', 'FALSE', '0', '0', '', 'Errores de autenticación'],
        ['RATE_LIMIT_ERROR', 'TRUE', 'FALSE', 'TRUE', '3', '5000', '', 'Errores de rate limiting'],
        ['INSUFFICIENT_FUNDS', 'TRUE', 'TRUE', 'FALSE', '0', '0', '', 'Fondos insuficientes'],
        ['GAS_ESTIMATION_ERROR', 'TRUE', 'FALSE', 'TRUE', '2', '1000', '', 'Errores de estimación de gas'],
    ]
    
    try:
        # 1. Crear la hoja
        requests = [{
            'addSheet': {
                'properties': {
                    'title': 'ERROR_HANDLING_CONFIG',
                    'gridProperties': {
                        'rowCount': 100,
                        'columnCount': 10,
                        'frozenRowCount': 1
                    }
                }
            }
        }]
        
        batch_update_request = {'requests': requests}
        response = service.spreadsheets().batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body=batch_update_request
        ).execute()
        
        sheet_id = response['replies'][0]['addSheet']['properties']['sheetId']
        print(f"  ✅ Hoja creada con ID: {sheet_id}")
        
        # 2. Escribir datos
        range_name = 'ERROR_HANDLING_CONFIG!A1:H11'
        body = {'values': error_configs}
        
        service.spreadsheets().values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=range_name,
            valueInputOption='RAW',
            body=body
        ).execute()
        
        print(f"  ✅ {len(error_configs)} filas escritas")
        
        # 3. Aplicar formato
        format_requests = [
            # Header con fondo azul y texto blanco
            {
                'repeatCell': {
                    'range': {
                        'sheetId': sheet_id,
                        'startRowIndex': 0,
                        'endRowIndex': 1
                    },
                    'cell': {
                        'userEnteredFormat': {
                            'backgroundColor': {'red': 0.26, 'green': 0.52, 'blue': 0.96},
                            'textFormat': {'foregroundColor': {'red': 1, 'green': 1, 'blue': 1}, 'bold': True},
                            'horizontalAlignment': 'CENTER'
                        }
                    },
                    'fields': 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
                }
            },
            # Validación de datos para SHOULD_LOG, SHOULD_ALERT, SHOULD_RETRY
            {
                'setDataValidation': {
                    'range': {
                        'sheetId': sheet_id,
                        'startRowIndex': 1,
                        'startColumnIndex': 1,
                        'endColumnIndex': 4
                    },
                    'rule': {
                        'condition': {
                            'type': 'ONE_OF_LIST',
                            'values': [{'userEnteredValue': 'TRUE'}, {'userEnteredValue': 'FALSE'}]
                        },
                        'showCustomUi': True
                    }
                }
            },
            # Auto-resize columnas
            {
                'autoResizeDimensions': {
                    'dimensions': {
                        'sheetId': sheet_id,
                        'dimension': 'COLUMNS',
                        'startIndex': 0,
                        'endIndex': 8
                    }
                }
            }
        ]
        
        batch_update_request = {'requests': format_requests}
        service.spreadsheets().batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body=batch_update_request
        ).execute()
        
        print("  ✅ Formato aplicado")
        return sheet_id
    
    except HttpError as e:
        if 'already exists' in str(e):
            print("  ⚠️  La hoja ya existe")
            return None
        else:
            print(f"  ❌ Error: {e}")
            raise

def create_collectors_config_sheet(service):
    """Crea la hoja COLLECTORS_CONFIG"""
    print("\n📝 Creando hoja COLLECTORS_CONFIG...")
    
    # Datos de configuración de collectors
    collector_configs = [
        ['NAME', 'ENABLED', 'PRIORITY', 'MAX_RETRIES', 'TIMEOUT', 'MODULE_PATH', 'CLASS_NAME', 'NOTES'],
        ['pyth_collector', 'TRUE', '1', '3', '30', 'services.python-collector.src.main', 'PythCollector', 'Collector para Pyth Network'],
        ['chainlink_collector', 'FALSE', '2', '3', '30', 'services.python-collector.src.main', 'ChainlinkCollector', 'Collector para Chainlink (preparado)'],
        ['uniswap_collector', 'FALSE', '2', '3', '30', '', '', 'Collector para Uniswap (futuro)'],
        ['binance_collector', 'FALSE', '3', '3', '30', '', '', 'Collector para Binance API (futuro)'],
        ['coingecko_collector', 'FALSE', '3', '2', '20', '', '', 'Collector para CoinGecko API (futuro)'],
    ]
    
    try:
        # 1. Crear la hoja
        requests = [{
            'addSheet': {
                'properties': {
                    'title': 'COLLECTORS_CONFIG',
                    'gridProperties': {
                        'rowCount': 100,
                        'columnCount': 10,
                        'frozenRowCount': 1
                    }
                }
            }
        }]
        
        batch_update_request = {'requests': requests}
        response = service.spreadsheets().batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body=batch_update_request
        ).execute()
        
        sheet_id = response['replies'][0]['addSheet']['properties']['sheetId']
        print(f"  ✅ Hoja creada con ID: {sheet_id}")
        
        # 2. Escribir datos
        range_name = 'COLLECTORS_CONFIG!A1:H6'
        body = {'values': collector_configs}
        
        service.spreadsheets().values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=range_name,
            valueInputOption='RAW',
            body=body
        ).execute()
        
        print(f"  ✅ {len(collector_configs)} filas escritas")
        
        # 3. Aplicar formato
        format_requests = [
            # Header con fondo azul y texto blanco
            {
                'repeatCell': {
                    'range': {
                        'sheetId': sheet_id,
                        'startRowIndex': 0,
                        'endRowIndex': 1
                    },
                    'cell': {
                        'userEnteredFormat': {
                            'backgroundColor': {'red': 0.26, 'green': 0.52, 'blue': 0.96},
                            'textFormat': {'foregroundColor': {'red': 1, 'green': 1, 'blue': 1}, 'bold': True},
                            'horizontalAlignment': 'CENTER'
                        }
                    },
                    'fields': 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
                }
            },
            # Validación de datos para ENABLED
            {
                'setDataValidation': {
                    'range': {
                        'sheetId': sheet_id,
                        'startRowIndex': 1,
                        'startColumnIndex': 1,
                        'endColumnIndex': 2
                    },
                    'rule': {
                        'condition': {
                            'type': 'ONE_OF_LIST',
                            'values': [{'userEnteredValue': 'TRUE'}, {'userEnteredValue': 'FALSE'}]
                        },
                        'showCustomUi': True
                    }
                }
            },
            # Validación de datos para PRIORITY (1, 2, 3)
            {
                'setDataValidation': {
                    'range': {
                        'sheetId': sheet_id,
                        'startRowIndex': 1,
                        'startColumnIndex': 2,
                        'endColumnIndex': 3
                    },
                    'rule': {
                        'condition': {
                            'type': 'ONE_OF_LIST',
                            'values': [
                                {'userEnteredValue': '1'},
                                {'userEnteredValue': '2'},
                                {'userEnteredValue': '3'}
                            ]
                        },
                        'showCustomUi': True
                    }
                }
            },
            # Formato condicional: ENABLED = FALSE → gris
            {
                'addConditionalFormatRule': {
                    'rule': {
                        'ranges': [{
                            'sheetId': sheet_id,
                            'startRowIndex': 1,
                            'startColumnIndex': 0,
                            'endColumnIndex': 8
                        }],
                        'booleanRule': {
                            'condition': {
                                'type': 'CUSTOM_FORMULA',
                                'values': [{'userEnteredValue': '=$B2="FALSE"'}]
                            },
                            'format': {
                                'backgroundColor': {'red': 0.9, 'green': 0.9, 'blue': 0.9},
                                'textFormat': {'strikethrough': True}
                            }
                        }
                    },
                    'index': 0
                }
            },
            # Auto-resize columnas
            {
                'autoResizeDimensions': {
                    'dimensions': {
                        'sheetId': sheet_id,
                        'dimension': 'COLUMNS',
                        'startIndex': 0,
                        'endIndex': 8
                    }
                }
            }
        ]
        
        batch_update_request = {'requests': format_requests}
        service.spreadsheets().batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body=batch_update_request
        ).execute()
        
        print("  ✅ Formato aplicado")
        return sheet_id
    
    except HttpError as e:
        if 'already exists' in str(e):
            print("  ⚠️  La hoja ya existe")
            return None
        else:
            print(f"  ❌ Error: {e}")
            raise

def main():
    """Función principal"""
    print("🚀 Creando hojas de configuración en Google Sheets...")
    print(f"📊 Spreadsheet ID: {SPREADSHEET_ID}")
    
    try:
        # Obtener servicio
        service = get_sheets_service()
        print("✅ Conectado a Google Sheets API")
        
        # Crear hojas
        error_sheet_id = create_error_handling_config_sheet(service)
        collectors_sheet_id = create_collectors_config_sheet(service)
        
        print("\n" + "=" * 70)
        print("✅ HOJAS CREADAS EXITOSAMENTE")
        print("=" * 70)
        
        if error_sheet_id:
            print(f"📋 ERROR_HANDLING_CONFIG: Sheet ID {error_sheet_id}")
            print(f"   URL: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit#gid={error_sheet_id}")
        
        if collectors_sheet_id:
            print(f"📋 COLLECTORS_CONFIG: Sheet ID {collectors_sheet_id}")
            print(f"   URL: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit#gid={collectors_sheet_id}")
        
        print("\n🎉 ¡Configuración completada!")
    
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()

