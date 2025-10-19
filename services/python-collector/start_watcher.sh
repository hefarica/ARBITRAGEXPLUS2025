#!/bin/bash
# Script para iniciar el watcher en Linux/Mac

set -e

echo "========================================"
echo "ARBITRAGEXPLUS2025 - Iniciando Watcher"
echo "========================================"
echo ""

# Verificar que existe el entorno virtual
if [ ! -f ".venv/bin/activate" ]; then
    echo "ERROR: Entorno virtual no encontrado"
    echo "Por favor ejecuta primero ./install.sh"
    exit 1
fi

# Activar entorno virtual
source .venv/bin/activate

# Verificar archivo Excel
EXCEL_PATH="../../data/ARBITRAGEXPLUS2025.xlsx"
if [ ! -f "$EXCEL_PATH" ]; then
    echo "ERROR: Archivo Excel no encontrado en $EXCEL_PATH"
    echo ""
    echo "Por favor:"
    echo "1. Coloca el archivo ARBITRAGEXPLUS2025.xlsx en la carpeta data/"
    echo "2. O edita la variable EXCEL_PATH en este script"
    echo ""
    exit 1
fi

echo "[OK] Archivo Excel encontrado: $EXCEL_PATH"
echo ""

# Configurar variable de entorno
export EXCEL_FILE_PATH="$EXCEL_PATH"

echo "Iniciando watcher..."
echo ""
echo "El watcher monitoreará la columna NAME cada 1 segundo"
echo "Cuando escribas un nombre de blockchain, se actualizarán automáticamente las columnas PUSH"
echo ""
echo "Presiona Ctrl+C para detener el watcher"
echo ""
echo "========================================"
echo ""

# Iniciar watcher
cd src
python3 blockchains_watcher_v2.py

