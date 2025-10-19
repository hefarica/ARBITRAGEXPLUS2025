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

echo "[INFO] El sistema buscará automáticamente el archivo Excel"
echo "[INFO] Buscará en:"
echo "  1. Variable de entorno EXCEL_FILE_PATH"
echo "  2. Carpeta data/ del proyecto"
echo "  3. Búsqueda recursiva en el proyecto"
echo ""

echo "Iniciando watcher..."
echo ""
echo "El watcher monitoreará la columna NAME cada 1 segundo"
echo "Cuando escribas un nombre de blockchain, se actualizarán automáticamente las columnas PUSH"
echo ""
echo "Presiona Ctrl+C para detener el watcher"
echo ""
echo "========================================"
echo ""

# Iniciar watcher (el script buscará automáticamente el Excel)
cd src
python3 blockchains_watcher_v2.py

