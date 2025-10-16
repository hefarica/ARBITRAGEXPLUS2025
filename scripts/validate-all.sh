#!/bin/bash

# Script Maestro de Validación Integral
# Ejecuta las 3 validaciones en secuencia y genera reporte consolidado

set -e

cd "$(dirname "$0")/.."

echo "╔════════════════════════════════════════════════════════════════════════════════════╗"
echo "║                    VALIDACIÓN INTEGRAL DEL SISTEMA                                 ║"
echo "║                        ARBITRAGEXPLUS2025                                          ║"
echo "╚════════════════════════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Resultados
COMPLETENESS_PASS=0
SOURCES_PASS=0
FLOW_PASS=0

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  VALIDACIÓN 1: ANÁLISIS DE COMPLETITUD"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if node scripts/analyze-file-completeness.js 2>&1 | tee /tmp/completeness.log; then
    COMPLETENESS_PASS=1
    echo -e "${GREEN}✅ VALIDACIÓN 1: PASS${NC}"
else
    echo -e "${RED}❌ VALIDACIÓN 1: FAIL${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  VALIDACIÓN 2: RASTREO DE FUENTES DE DATOS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if node scripts/trace-data-sources.js 2>&1 | tee /tmp/sources.log; then
    SOURCES_PASS=1
    echo -e "${GREEN}✅ VALIDACIÓN 2: PASS${NC}"
else
    echo -e "${RED}❌ VALIDACIÓN 2: FAIL${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  VALIDACIÓN 3: FLUJO DE DATOS DINÁMICOS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if node scripts/validate-data-flow.js 2>&1 | tee /tmp/flow.log; then
    FLOW_PASS=1
    echo -e "${GREEN}✅ VALIDACIÓN 3: PASS${NC}"
else
    echo -e "${YELLOW}⚠️  VALIDACIÓN 3: WARNINGS${NC}"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════════════════════════╗"
echo "║                          REPORTE CONSOLIDADO                                       ║"
echo "╚════════════════════════════════════════════════════════════════════════════════════╝"
echo ""

# Extract key metrics
COMPLETENESS=$(grep "COMPLETITUD:" /tmp/completeness.log | tail -1 || echo "N/A")
GREEN_SOURCES=$(grep "VERDE (Fuentes válidas):" /tmp/sources.log | tail -1 || echo "N/A")
RED_SOURCES=$(grep "ROJO (Hardcoded/Inválido):" /tmp/sources.log | tail -1 || echo "N/A")
GREEN_FLOW=$(grep "VERDE (Flujo correcto):" /tmp/flow.log | tail -1 || echo "N/A")
RED_FLOW=$(grep "ROJO (Flujo incorrecto):" /tmp/flow.log | tail -1 || echo "N/A")

echo "📊 MÉTRICAS CLAVE:"
echo "   $COMPLETENESS"
echo "   $GREEN_SOURCES"
echo "   $RED_SOURCES"
echo "   $GREEN_FLOW"
echo "   $RED_FLOW"
echo ""

# Overall result
TOTAL_PASS=$((COMPLETENESS_PASS + SOURCES_PASS + FLOW_PASS))

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $TOTAL_PASS -eq 3 ]; then
    echo -e "${GREEN}✅ TODAS LAS VALIDACIONES PASARON${NC}"
    echo "   El sistema cumple con las 3 premisas de programación dinámica"
    exit 0
elif [ $TOTAL_PASS -ge 2 ]; then
    echo -e "${YELLOW}⚠️  VALIDACIONES PARCIALES${NC}"
    echo "   Algunas validaciones fallaron, revisar logs arriba"
    exit 1
else
    echo -e "${RED}❌ VALIDACIONES FALLIDAS${NC}"
    echo "   El sistema NO cumple con las premisas de programación dinámica"
    echo "   Revisar y corregir antes de continuar"
    exit 1
fi

