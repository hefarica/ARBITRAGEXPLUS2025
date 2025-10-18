#!/usr/bin/env python3
"""
Script para crear la hoja ORACLE_ASSETS en Google Sheets
con 60+ tokens configurados dinámicamente
"""

import os
import sys
import csv
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Configuración
SPREADSHEET_ID = '1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ'
CREDENTIALS_PATH = '/home/ubuntu/ARBITRAGEXPLUS2025/keys/gsheets-sa.json'
SHEET_NAME = 'ORACLE_ASSETS'
CSV_PATH = '/home/ubuntu/ARBITRAGEXPLUS2025/docs/ORACLE_ASSETS_IMPORT.csv'

# Scopes de Google Sheets API
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

def get_sheets_service():
    """Obtiene el servicio de Google Sheets API"""
    try:
        credentials = service_account.Credentials.from_service_account_file(
            CREDENTIALS_PATH, scopes=SCOPES
        )
        service = build('sheets', 'v4', credentials=credentials)
        return service
    except Exception as e:
        print(f"❌ Error creando servicio de Sheets: {e}")
        sys.exit(1)

def read_csv_data():
    """Lee los datos del CSV"""
    try:
        with open(CSV_PATH, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            data = list(reader)
        print(f"✅ CSV leído: {len(data)} filas")
        return data
    except Exception as e:
        print(f"❌ Error leyendo CSV: {e}")
        sys.exit(1)

def create_sheet(service):
    """Crea la hoja ORACLE_ASSETS si no existe"""
    try:
        # Verificar si la hoja ya existe
        spreadsheet = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
        sheets = spreadsheet.get('sheets', [])
        
        for sheet in sheets:
            if sheet['properties']['title'] == SHEET_NAME:
                print(f"⚠️  La hoja '{SHEET_NAME}' ya existe")
                sheet_id = sheet['properties']['sheetId']
                return sheet_id
        
        # Crear nueva hoja
        request_body = {
            'requests': [{
                'addSheet': {
                    'properties': {
                        'title': SHEET_NAME,
                        'gridProperties': {
                            'rowCount': 1000,
                            'columnCount': 10,
                            'frozenRowCount': 1  # Congelar fila de headers
                        }
                    }
                }
            }]
        }
        
        response = service.spreadsheets().batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body=request_body
        ).execute()
        
        sheet_id = response['replies'][0]['addSheet']['properties']['sheetId']
        print(f"✅ Hoja '{SHEET_NAME}' creada exitosamente (ID: {sheet_id})")
        return sheet_id
        
    except HttpError as e:
        print(f"❌ Error creando hoja: {e}")
        sys.exit(1)

def write_data(service, data):
    """Escribe los datos en la hoja"""
    try:
        # Escribir datos
        range_name = f'{SHEET_NAME}!A1'
        body = {
            'values': data
        }
        
        result = service.spreadsheets().values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=range_name,
            valueInputOption='RAW',
            body=body
        ).execute()
        
        print(f"✅ Datos escritos: {result.get('updatedCells')} celdas actualizadas")
        
    except HttpError as e:
        print(f"❌ Error escribiendo datos: {e}")
        sys.exit(1)

def format_sheet(service, sheet_id):
    """Aplica formato a la hoja"""
    try:
        requests = []
        
        # 1. Formato de header (fila 1)
        requests.append({
            'repeatCell': {
                'range': {
                    'sheetId': sheet_id,
                    'startRowIndex': 0,
                    'endRowIndex': 1
                },
                'cell': {
                    'userEnteredFormat': {
                        'backgroundColor': {'red': 0.2, 'green': 0.6, 'blue': 0.9},
                        'textFormat': {
                            'foregroundColor': {'red': 1.0, 'green': 1.0, 'blue': 1.0},
                            'bold': True,
                            'fontSize': 11
                        },
                        'horizontalAlignment': 'CENTER',
                        'verticalAlignment': 'MIDDLE'
                    }
                },
                'fields': 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
            }
        })
        
        # 2. Auto-resize columnas
        requests.append({
            'autoResizeDimensions': {
                'dimensions': {
                    'sheetId': sheet_id,
                    'dimension': 'COLUMNS',
                    'startIndex': 0,
                    'endIndex': 10
                }
            }
        })
        
        # 3. Formato de columna IS_ACTIVE (validación de datos)
        requests.append({
            'setDataValidation': {
                'range': {
                    'sheetId': sheet_id,
                    'startRowIndex': 1,
                    'startColumnIndex': 5,  # Columna F (IS_ACTIVE)
                    'endColumnIndex': 6
                },
                'rule': {
                    'condition': {
                        'type': 'ONE_OF_LIST',
                        'values': [
                            {'userEnteredValue': 'TRUE'},
                            {'userEnteredValue': 'FALSE'}
                        ]
                    },
                    'showCustomUi': True,
                    'strict': True
                }
            }
        })
        
        # 4. Formato de columna PRIORITY (validación de datos)
        requests.append({
            'setDataValidation': {
                'range': {
                    'sheetId': sheet_id,
                    'startRowIndex': 1,
                    'startColumnIndex': 6,  # Columna G (PRIORITY)
                    'endColumnIndex': 7
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
                    'showCustomUi': True,
                    'strict': True
                }
            }
        })
        
        # 5. Formato condicional para prioridades
        # Priority 1 = Verde
        requests.append({
            'addConditionalFormatRule': {
                'rule': {
                    'ranges': [{
                        'sheetId': sheet_id,
                        'startRowIndex': 1,
                        'startColumnIndex': 0,
                        'endColumnIndex': 10
                    }],
                    'booleanRule': {
                        'condition': {
                            'type': 'CUSTOM_FORMULA',
                            'values': [{'userEnteredValue': '=$G2=1'}]
                        },
                        'format': {
                            'backgroundColor': {'red': 0.85, 'green': 0.92, 'blue': 0.83}
                        }
                    }
                },
                'index': 0
            }
        })
        
        # Priority 2 = Amarillo
        requests.append({
            'addConditionalFormatRule': {
                'rule': {
                    'ranges': [{
                        'sheetId': sheet_id,
                        'startRowIndex': 1,
                        'startColumnIndex': 0,
                        'endColumnIndex': 10
                    }],
                    'booleanRule': {
                        'condition': {
                            'type': 'CUSTOM_FORMULA',
                            'values': [{'userEnteredValue': '=$G2=2'}]
                        },
                        'format': {
                            'backgroundColor': {'red': 1.0, 'green': 0.95, 'blue': 0.8}
                        }
                    }
                },
                'index': 1
            }
        })
        
        # Priority 3 = Naranja
        requests.append({
            'addConditionalFormatRule': {
                'rule': {
                    'ranges': [{
                        'sheetId': sheet_id,
                        'startRowIndex': 1,
                        'startColumnIndex': 0,
                        'endColumnIndex': 10
                    }],
                    'booleanRule': {
                        'condition': {
                            'type': 'CUSTOM_FORMULA',
                            'values': [{'userEnteredValue': '=$G2=3'}]
                        },
                        'format': {
                            'backgroundColor': {'red': 0.99, 'green': 0.90, 'blue': 0.80}
                        }
                    }
                },
                'index': 2
            }
        })
        
        # IS_ACTIVE = FALSE = Gris con tachado
        requests.append({
            'addConditionalFormatRule': {
                'rule': {
                    'ranges': [{
                        'sheetId': sheet_id,
                        'startRowIndex': 1,
                        'startColumnIndex': 0,
                        'endColumnIndex': 10
                    }],
                    'booleanRule': {
                        'condition': {
                            'type': 'CUSTOM_FORMULA',
                            'values': [{'userEnteredValue': '=$F2="FALSE"'}]
                        },
                        'format': {
                            'textFormat': {
                                'foregroundColor': {'red': 0.6, 'green': 0.6, 'blue': 0.6},
                                'strikethrough': True
                            }
                        }
                    }
                },
                'index': 3
            }
        })
        
        # Ejecutar todas las requests
        body = {'requests': requests}
        service.spreadsheets().batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body=body
        ).execute()
        
        print(f"✅ Formato aplicado exitosamente")
        
    except HttpError as e:
        print(f"⚠️  Error aplicando formato (no crítico): {e}")

def main():
    """Función principal"""
    print("🚀 Creando hoja ORACLE_ASSETS en Google Sheets...")
    print(f"📊 Spreadsheet ID: {SPREADSHEET_ID}")
    print(f"📁 CSV: {CSV_PATH}")
    print("")
    
    # 1. Obtener servicio de Sheets
    service = get_sheets_service()
    
    # 2. Leer datos del CSV
    data = read_csv_data()
    
    # 3. Crear hoja
    sheet_id = create_sheet(service)
    
    # 4. Escribir datos
    write_data(service, data)
    
    # 5. Aplicar formato
    format_sheet(service, sheet_id)
    
    print("")
    print("=" * 70)
    print("✅ ¡HOJA ORACLE_ASSETS CREADA EXITOSAMENTE!")
    print("=" * 70)
    print(f"📊 Total de assets configurados: {len(data) - 1}")  # -1 por el header
    print(f"🔗 URL: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit#gid={sheet_id}")
    print("")
    print("🎯 Próximos pasos:")
    print("  1. Verificar la hoja en Google Sheets")
    print("  2. Ajustar configuraciones según necesidad")
    print("  3. El servicio cargará automáticamente la configuración")
    print("")

if __name__ == '__main__':
    main()

