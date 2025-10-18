#!/bin/bash

echo "🔍 VALIDACIÓN DE IMPLEMENTACIÓN - ARBITRAGEXPLUS2025"
echo "=================================================="
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# 1. Verificar headers en archivos
echo "📋 1. Verificando headers de documentación..."
FILES_WITH_HEADERS=$(find . -type f \( -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.rs" -o -name "*.sol" \) \
  | grep -v node_modules \
  | grep -v target \
  | grep -v dist \
  | xargs grep -l "============================================================================" 2>/dev/null | wc -l)

TOTAL_FILES=$(find . -type f \( -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.rs" -o -name "*.sol" \) \
  | grep -v node_modules \
  | grep -v target \
  | grep -v dist \
  | wc -l)

if [ $FILES_WITH_HEADERS -ge 200 ]; then
  echo -e "${GREEN}✅ Headers agregados: $FILES_WITH_HEADERS/$TOTAL_FILES archivos${NC}"
else
  echo -e "${RED}❌ Faltan headers: solo $FILES_WITH_HEADERS/$TOTAL_FILES archivos${NC}"
  ERRORS=$((ERRORS + 1))
fi

# 2. Verificar que no hay placeholders sin completar
echo ""
echo "🔍 2. Verificando placeholders sin completar..."
PLACEHOLDERS=$(grep -r "\[TODO\]" --include="*.ts" --include="*.py" --include="*.rs" --include="*.sol" 2>/dev/null | grep -v node_modules | grep -v target | wc -l)

if [ $PLACEHOLDERS -eq 0 ]; then
  echo -e "${GREEN}✅ No hay placeholders sin completar${NC}"
else
  echo -e "${YELLOW}⚠️  Hay $PLACEHOLDERS placeholders sin completar${NC}"
  WARNINGS=$((WARNINGS + 1))
fi

# 3. Verificar errors.ts mejorado
echo ""
echo "🔧 3. Verificando mejoras en errors.ts..."
if grep -q "sanitizeError" services/api-server/src/lib/errors.ts 2>/dev/null; then
  echo -e "${GREEN}✅ sanitizeError() implementada${NC}"
else
  echo -e "${RED}❌ Falta sanitizeError()${NC}"
  ERRORS=$((ERRORS + 1))
fi

if grep -q "ErrorLogger" services/api-server/src/lib/errors.ts 2>/dev/null; then
  echo -e "${GREEN}✅ ErrorLogger implementado${NC}"
else
  echo -e "${RED}❌ Falta ErrorLogger${NC}"
  ERRORS=$((ERRORS + 1))
fi

if grep -q "CircuitBreaker" services/api-server/src/lib/errors.ts 2>/dev/null; then
  echo -e "${GREEN}✅ CircuitBreaker implementado${NC}"
else
  echo -e "${RED}❌ Falta CircuitBreaker${NC}"
  ERRORS=$((ERRORS + 1))
fi

# 4. Verificar priceService.ts
echo ""
echo "💰 4. Verificando priceService.ts..."
if [ -f "services/api-server/src/services/priceService.ts" ]; then
  echo -e "${GREEN}✅ priceService.ts creado${NC}"
  
  if grep -q "queryMultipleOracles" services/api-server/src/services/priceService.ts; then
    echo -e "${GREEN}✅ Multi-oracle support implementado${NC}"
  else
    echo -e "${RED}❌ Falta multi-oracle support${NC}"
    ERRORS=$((ERRORS + 1))
  fi
  
  if grep -q "calculateConsensusPrice" services/api-server/src/services/priceService.ts; then
    echo -e "${GREEN}✅ Consenso de precios implementado${NC}"
  else
    echo -e "${RED}❌ Falta consenso de precios${NC}"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo -e "${RED}❌ priceService.ts no existe${NC}"
  ERRORS=$((ERRORS + 1))
fi

# 5. Verificar main.py mejorado
echo ""
echo "🐍 5. Verificando mejoras en main.py..."
if grep -q "ParallelOrchestrator" services/python-collector/src/main.py 2>/dev/null; then
  echo -e "${GREEN}✅ ParallelOrchestrator implementado${NC}"
else
  echo -e "${RED}❌ Falta ParallelOrchestrator${NC}"
  ERRORS=$((ERRORS + 1))
fi

if grep -q "AutoRecoverySystem" services/python-collector/src/main.py 2>/dev/null; then
  echo -e "${GREEN}✅ AutoRecoverySystem implementado${NC}"
else
  echo -e "${RED}❌ Falta AutoRecoverySystem${NC}"
  ERRORS=$((ERRORS + 1))
fi

# 6. Verificar que no hay credenciales hardcodeadas
echo ""
echo "🔒 6. Verificando credenciales hardcodeadas..."
HARDCODED=$(grep -r "api_key\s*=\s*['\"]" --include="*.ts" --include="*.py" --include="*.js" 2>/dev/null | grep -v node_modules | grep -v "process.env" | wc -l)

if [ $HARDCODED -eq 0 ]; then
  echo -e "${GREEN}✅ No se detectaron credenciales hardcodeadas${NC}"
else
  echo -e "${RED}❌ Se detectaron $HARDCODED posibles credenciales hardcodeadas${NC}"
  ERRORS=$((ERRORS + 1))
fi

# 7. Verificar estructura de directorios
echo ""
echo "📁 7. Verificando estructura de directorios..."
REQUIRED_DIRS=(
  "contracts"
  "services/api-server"
  "services/execution"
  "services/monitoring"
  "services/python-collector"
  "dashboard"
  "test"
  "docs"
)

for dir in "${REQUIRED_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    echo -e "${GREEN}✅ $dir existe${NC}"
  else
    echo -e "${RED}❌ $dir no existe${NC}"
    ERRORS=$((ERRORS + 1))
  fi
done

# 8. Contar líneas de código
echo ""
echo "📊 8. Estadísticas de código..."
TS_LINES=$(find . -name "*.ts" -not -path "*/node_modules/*" -not -path "*/dist/*" -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}')
PY_LINES=$(find . -name "*.py" -not -path "*/node_modules/*" -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}')
SOL_LINES=$(find . -name "*.sol" -not -path "*/node_modules/*" -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}')
RS_LINES=$(find . -name "*.rs" -not -path "*/target/*" -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}')

echo "  TypeScript: $TS_LINES líneas"
echo "  Python: $PY_LINES líneas"
echo "  Solidity: $SOL_LINES líneas"
echo "  Rust: $RS_LINES líneas"
TOTAL_LINES=$((TS_LINES + PY_LINES + SOL_LINES + RS_LINES))
echo "  TOTAL: $TOTAL_LINES líneas"

# Resumen final
echo ""
echo "=================================================="
echo "📊 RESUMEN DE VALIDACIÓN"
echo "=================================================="
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✅ ¡VALIDACIÓN EXITOSA!${NC}"
  echo "Todas las verificaciones pasaron correctamente."
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}⚠️  VALIDACIÓN CON ADVERTENCIAS${NC}"
  echo "Errores: $ERRORS"
  echo "Advertencias: $WARNINGS"
  exit 0
else
  echo -e "${RED}❌ VALIDACIÓN FALLIDA${NC}"
  echo "Errores: $ERRORS"
  echo "Advertencias: $WARNINGS"
  exit 1
fi
