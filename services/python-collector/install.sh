#!/bin/bash
# Script de instalación para Linux/Mac
# Instala Python, dependencias y configura el watcher

set -e

echo "========================================"
echo "ARBITRAGEXPLUS2025 - Instalación"
echo "========================================"
echo ""

# Verificar Python
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 no está instalado"
    echo "Por favor instala Python 3.11+ desde https://www.python.org/downloads/"
    exit 1
fi

echo "[OK] Python instalado: $(python3 --version)"
echo ""

# Crear entorno virtual
echo "Creando entorno virtual..."
python3 -m venv .venv

if [ $? -ne 0 ]; then
    echo "ERROR: No se pudo crear entorno virtual"
    exit 1
fi

echo "[OK] Entorno virtual creado"
echo ""

# Activar entorno virtual
echo "Activando entorno virtual..."
source .venv/bin/activate

# Instalar dependencias
echo "Instalando dependencias..."
pip install --upgrade pip
pip install -r requirements.txt

if [ $? -ne 0 ]; then
    echo "ERROR: No se pudieron instalar las dependencias"
    exit 1
fi

echo "[OK] Dependencias instaladas"
echo ""

# Verificar archivo Excel
if [ ! -f "../../data/ARBITRAGEXPLUS2025.xlsx" ]; then
    echo "ADVERTENCIA: Archivo Excel no encontrado en data/ARBITRAGEXPLUS2025.xlsx"
    echo "Por favor coloca el archivo Excel en la ubicación correcta"
    echo ""
fi

echo "========================================"
echo "INSTALACIÓN COMPLETADA"
echo "========================================"
echo ""
echo "Para iniciar el watcher, ejecuta:"
echo "  ./start_watcher.sh"
echo ""

