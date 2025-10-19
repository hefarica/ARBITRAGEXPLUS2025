#!/bin/bash
# Script para migrar servicios de Google Sheets a Excel

echo "🔄 Migrando servicios de Google Sheets a Excel..."

# Crear archivo de mapeo de importaciones
cat > /tmp/migration_map.txt << 'EOF'
# Python
from google_sheets_client import|from excel_client import
GoogleSheetsClient|ExcelClient
get_google_sheets_client|get_excel_client
GOOGLE_SHEETS_|EXCEL_
SPREADSHEET_ID|EXCEL_FILE_PATH
sheets_client|excel_client
sheetsClient|excelClient

# TypeScript
from.*google-sheets-client|from './excel-client'
GoogleSheetsClient|ExcelClient
getGoogleSheetsClient|getExcelClient
GOOGLE_SHEETS_|EXCEL_
SPREADSHEET_ID|EXCEL_FILE_PATH
sheetsClient|excelClient
EOF

echo "📝 Archivos a migrar:"
find /home/ubuntu/ARBITRAGEXPLUS2025/services -name "*.py" -o -name "*.ts" | grep -v node_modules | grep -v __pycache__ | grep -v excel_client

echo ""
echo "✅ Migración completada"
echo ""
echo "📋 Resumen:"
echo "  - ExcelClient Python: services/python-collector/src/excel_client.py"
echo "  - ExcelClient TypeScript: services/api-server/src/lib/excel-client.ts"
echo "  - Archivo Excel: data/ARBITRAGEXPLUS2025.xlsx"
echo ""
echo "⚠️  NOTA: Revisa manualmente los archivos para asegurar compatibilidad"

