#!/usr/bin/env python3
"""
Script para actualizar ORACLE_ASSETS con columnas para Binance, CoinGecko y Band
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
SHEET_NAME = 'ORACLE_ASSETS'

def get_sheets_service():
    """Obtiene el servicio de Google Sheets"""
    credentials = service_account.Credentials.from_service_account_file(
        CREDENTIALS_PATH, scopes=SCOPES
    )
    service = build('sheets', 'v4', credentials=credentials)
    return service

def get_sheet_id(service):
    """Obtiene el sheet ID de ORACLE_ASSETS"""
    try:
        spreadsheet = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
        for sheet in spreadsheet['sheets']:
            if sheet['properties']['title'] == SHEET_NAME:
                return sheet['properties']['sheetId']
        return None
    except HttpError as e:
        print(f"Error getting sheet ID: {e}")
        return None

def update_oracle_assets(service):
    """Actualiza la hoja ORACLE_ASSETS con nuevas columnas"""
    print(f"\n📝 Actualizando hoja {SHEET_NAME}...")
    
    sheet_id = get_sheet_id(service)
    if not sheet_id:
        print(f"❌ No se encontró la hoja {SHEET_NAME}")
        return False
    
    try:
        # 1. Leer datos actuales
        range_name = f'{SHEET_NAME}!A1:Z100'
        result = service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=range_name
        ).execute()
        
        current_data = result.get('values', [])
        if not current_data:
            print("❌ No hay datos en la hoja")
            return False
        
        # 2. Obtener header actual
        header = current_data[0]
        print(f"  📋 Header actual: {len(header)} columnas")
        
        # 3. Agregar nuevas columnas si no existen
        new_columns = [
            'BINANCE_SYMBOL',  # Símbolo en Binance (ej: ETHUSDT)
            'COINGECKO_ID',    # ID en CoinGecko (ej: ethereum)
            'BAND_SYMBOL',     # Símbolo en Band (ej: ETH)
        ]
        
        columns_added = []
        for col in new_columns:
            if col not in header:
                header.append(col)
                columns_added.append(col)
        
        if not columns_added:
            print("  ℹ️  Todas las columnas ya existen")
            return True
        
        print(f"  ✅ Agregando columnas: {', '.join(columns_added)}")
        
        # 4. Actualizar header
        header_range = f'{SHEET_NAME}!A1:{chr(64 + len(header))}1'
        service.spreadsheets().values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=header_range,
            valueInputOption='RAW',
            body={'values': [header]}
        ).execute()
        
        # 5. Agregar valores por defecto para assets existentes
        if len(current_data) > 1:
            print(f"  📝 Actualizando {len(current_data) - 1} assets...")
            
            # Mapeos de símbolos
            binance_map = {
                'ETH': 'ETHUSDT', 'WETH': 'ETHUSDT',
                'BTC': 'BTCUSDT', 'WBTC': 'BTCUSDT',
                'BNB': 'BNBUSDT', 'WBNB': 'BNBUSDT',
                'MATIC': 'MATICUSDT', 'WMATIC': 'MATICUSDT',
                'AVAX': 'AVAXUSDT', 'WAVAX': 'AVAXUSDT',
                'SOL': 'SOLUSDT',
                'LINK': 'LINKUSDT',
                'UNI': 'UNIUSDT',
                'AAVE': 'AAVEUSDT',
                'SHIB': 'SHIBUSDT',
                'PEPE': 'PEPEUSDT',
                'ARB': 'ARBUSDT',
                'OP': 'OPUSDT',
                'ATOM': 'ATOMUSDT',
                'DOT': 'DOTUSDT',
                'ADA': 'ADAUSDT',
                'XRP': 'XRPUSDT',
                'DOGE': 'DOGEUSDT',
            }
            
            coingecko_map = {
                'ETH': 'ethereum', 'WETH': 'ethereum',
                'BTC': 'bitcoin', 'WBTC': 'bitcoin',
                'BNB': 'binancecoin', 'WBNB': 'binancecoin',
                'MATIC': 'matic-network', 'WMATIC': 'matic-network',
                'AVAX': 'avalanche-2', 'WAVAX': 'avalanche-2',
                'SOL': 'solana',
                'LINK': 'chainlink',
                'UNI': 'uniswap',
                'AAVE': 'aave',
                'SHIB': 'shiba-inu',
                'PEPE': 'pepe',
                'ARB': 'arbitrum',
                'OP': 'optimism',
                'ATOM': 'cosmos',
                'DOT': 'polkadot',
                'ADA': 'cardano',
                'XRP': 'ripple',
                'DOGE': 'dogecoin',
                'USDC': 'usd-coin',
                'USDT': 'tether',
                'DAI': 'dai',
            }
            
            # Índice de columna SYMBOL
            symbol_idx = header.index('SYMBOL') if 'SYMBOL' in header else 0
            
            # Índices de nuevas columnas
            binance_idx = header.index('BINANCE_SYMBOL')
            coingecko_idx = header.index('COINGECKO_ID')
            band_idx = header.index('BAND_SYMBOL')
            
            # Actualizar cada fila
            updates = []
            for i, row in enumerate(current_data[1:], start=2):  # Empezar desde fila 2
                # Extender fila si es necesario
                while len(row) < len(header):
                    row.append('')
                
                symbol = row[symbol_idx] if len(row) > symbol_idx else ''
                
                # Agregar valores si no existen
                if symbol:
                    # Binance
                    if not row[binance_idx]:
                        row[binance_idx] = binance_map.get(symbol, '')
                    
                    # CoinGecko
                    if not row[coingecko_idx]:
                        row[coingecko_idx] = coingecko_map.get(symbol, '')
                    
                    # Band (normalizar: WETH -> ETH)
                    if not row[band_idx]:
                        normalized = symbol.replace('W', '') if symbol.startswith('W') else symbol
                        row[band_idx] = normalized
                
                # Agregar a batch update
                row_range = f'{SHEET_NAME}!A{i}:{chr(64 + len(header))}{i}'
                updates.append({
                    'range': row_range,
                    'values': [row]
                })
            
            # Ejecutar batch update
            if updates:
                body = {
                    'valueInputOption': 'RAW',
                    'data': updates
                }
                service.spreadsheets().values().batchUpdate(
                    spreadsheetId=SPREADSHEET_ID,
                    body=body
                ).execute()
                
                print(f"  ✅ {len(updates)} filas actualizadas")
        
        # 6. Aplicar formato a nuevas columnas
        print("  🎨 Aplicando formato...")
        
        # Obtener índices de columnas (A=0, B=1, etc.)
        start_col_idx = len(header) - len(columns_added)
        end_col_idx = len(header)
        
        format_requests = [
            # Header con fondo azul
            {
                'repeatCell': {
                    'range': {
                        'sheetId': sheet_id,
                        'startRowIndex': 0,
                        'endRowIndex': 1,
                        'startColumnIndex': start_col_idx,
                        'endColumnIndex': end_col_idx
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
            # Auto-resize nuevas columnas
            {
                'autoResizeDimensions': {
                    'dimensions': {
                        'sheetId': sheet_id,
                        'dimension': 'COLUMNS',
                        'startIndex': start_col_idx,
                        'endIndex': end_col_idx
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
        return True
    
    except HttpError as e:
        print(f"  ❌ Error: {e}")
        return False

def main():
    """Función principal"""
    print("🚀 Actualizando ORACLE_ASSETS con columnas de nuevos oráculos...")
    print(f"📊 Spreadsheet ID: {SPREADSHEET_ID}")
    
    try:
        # Obtener servicio
        service = get_sheets_service()
        print("✅ Conectado a Google Sheets API")
        
        # Actualizar hoja
        success = update_oracle_assets(service)
        
        if success:
            print("\n" + "=" * 70)
            print("✅ ACTUALIZACIÓN COMPLETADA")
            print("=" * 70)
            print(f"📋 Hoja: {SHEET_NAME}")
            print(f"🔗 URL: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit#gid=867441237")
            print("\n🎉 ¡Nuevas columnas agregadas!")
            print("   - BINANCE_SYMBOL")
            print("   - COINGECKO_ID")
            print("   - BAND_SYMBOL")
        else:
            print("\n❌ Actualización fallida")
            sys.exit(1)
    
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()

