#!/bin/bash

###############################################################################
# PLAN DE ACCIÓN PARA VALIDACIÓN COMPLETA DEL SISTEMA
# 
# Este script ejecuta una serie de validaciones exhaustivas en orden
# secuencial para garantizar la integridad completa del sistema.
#
# CRITERIO DE ÉXITO: Todas las validaciones deben pasar (exit code 0)
###############################################################################

set -e  # Salir inmediatamente si algún comando falla

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Directorio raíz del repositorio
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Contadores
TOTAL_VALIDATIONS=0
PASSED_VALIDATIONS=0
FAILED_VALIDATIONS=0

###############################################################################
# UTILIDADES
###############################################################################

print_header() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_step() {
    echo ""
    echo -e "${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

run_validation() {
    local name="$1"
    local command="$2"
    local optional="${3:-false}"
    
    TOTAL_VALIDATIONS=$((TOTAL_VALIDATIONS + 1))
    
    print_step "Ejecutando: $name"
    
    if eval "$command"; then
        print_success "$name PASÓ"
        PASSED_VALIDATIONS=$((PASSED_VALIDATIONS + 1))
        return 0
    else
        if [ "$optional" = "true" ]; then
            print_warning "$name FALLÓ (opcional)"
            return 0
        else
            print_error "$name FALLÓ (crítico)"
            FAILED_VALIDATIONS=$((FAILED_VALIDATIONS + 1))
            return 1
        fi
    fi
}

###############################################################################
# FASE 0: PREPARACIÓN
###############################################################################

print_header "FASE 0: PREPARACIÓN DEL ENTORNO"

print_step "Verificando Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "Node.js instalado: $NODE_VERSION"
else
    print_error "Node.js no está instalado"
    exit 1
fi

print_step "Verificando Python..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    print_success "Python instalado: $PYTHON_VERSION"
else
    print_error "Python no está instalado"
    exit 1
fi

print_step "Verificando Rust..."
if command -v cargo &> /dev/null; then
    RUST_VERSION=$(cargo --version)
    print_success "Rust instalado: $RUST_VERSION"
else
    print_warning "Rust no está instalado (opcional para algunas validaciones)"
fi

print_step "Instalando dependencias de scripts..."
cd "$REPO_ROOT/scripts"
if [ -f "package.json" ]; then
    npm install --silent 2>&1 | grep -v "npm WARN" || true
    print_success "Dependencias de scripts instaladas"
fi
cd "$REPO_ROOT"

###############################################################################
# FASE 1: VALIDACIÓN DE ESTRUCTURA
###############################################################################

print_header "FASE 1: VALIDACIÓN DE ESTRUCTURA DE ARCHIVOS"

run_validation \
    "Estructura de directorios" \
    "node scripts/verify-structure.js"

run_validation \
    "Detección de imports rotos" \
    "node scripts/scan-dead-paths.js"

run_validation \
    "Análisis de completitud de archivos" \
    "node scripts/analyze-file-completeness.js" \
    "true"

###############################################################################
# FASE 2: VALIDACIÓN DE INTEGRIDAD
###############################################################################

print_header "FASE 2: VALIDACIÓN DE INTEGRIDAD DE ARCHIVOS"

run_validation \
    "Integridad completa del sistema" \
    "node scripts/validate-system-integrity.js"

###############################################################################
# FASE 3: VALIDACIÓN DE ARQUITECTURA DINÁMICA
###############################################################################

print_header "FASE 3: VALIDACIÓN DE ARQUITECTURA DINÁMICA"

run_validation \
    "Patrones arquitectónicos y NO hardcoding" \
    "node scripts/validate-dynamic-architecture.js"

###############################################################################
# FASE 4: VALIDACIÓN DE FLUJO DE DATOS
###############################################################################

print_header "FASE 4: VALIDACIÓN DE FLUJO DE DATOS"

run_validation \
    "Flujo de datos dinámicos" \
    "node scripts/validate-data-flow.js" \
    "true"

###############################################################################
# FASE 5: VALIDACIÓN DE CONFIGURACIÓN
###############################################################################

print_header "FASE 5: VALIDACIÓN DE CONFIGURACIÓN"

print_step "Verificando archivos de configuración..."

CONFIG_FILES=(
    "config/chains.yaml"
    "config/dexes.yaml"
    "config/system.yaml"
    ".env.example"
)

for config_file in "${CONFIG_FILES[@]}"; do
    if [ -f "$config_file" ]; then
        print_success "Encontrado: $config_file"
        
        # Verificar que use variables de entorno
        if grep -q '\${' "$config_file" || grep -q 'process.env' "$config_file"; then
            print_success "  ✓ Usa variables de entorno"
        else
            print_warning "  ⚠ No se detectaron variables de entorno"
        fi
        
        # Verificar que NO tenga valores sensibles hardcodeados
        if grep -qE 'api_key.*=.*[a-zA-Z0-9]{20,}|private_key.*=.*0x[a-fA-F0-9]{64}' "$config_file"; then
            print_error "  ✗ Posible valor sensible hardcodeado"
            FAILED_VALIDATIONS=$((FAILED_VALIDATIONS + 1))
        else
            print_success "  ✓ No hay valores sensibles hardcodeados"
        fi
    else
        print_warning "No encontrado: $config_file (opcional)"
    fi
done

###############################################################################
# FASE 6: VALIDACIÓN DE SERVICIOS
###############################################################################

print_header "FASE 6: VALIDACIÓN DE SERVICIOS"

print_step "Validando Python Collector..."
if [ -f "services/python-collector/src/sheets/client.py" ]; then
    LINES=$(wc -l < "services/python-collector/src/sheets/client.py")
    if [ "$LINES" -ge 500 ]; then
        print_success "client.py tiene $LINES líneas (✓ >= 500)"
    else
        print_error "client.py solo tiene $LINES líneas (✗ < 500)"
        FAILED_VALIDATIONS=$((FAILED_VALIDATIONS + 1))
    fi
    
    # Verificar patrones críticos
    if grep -q "class GoogleSheetsClient" "services/python-collector/src/sheets/client.py"; then
        print_success "  ✓ Clase GoogleSheetsClient encontrada"
    else
        print_error "  ✗ Clase GoogleSheetsClient NO encontrada"
        FAILED_VALIDATIONS=$((FAILED_VALIDATIONS + 1))
    fi
    
    if grep -q "async def" "services/python-collector/src/sheets/client.py"; then
        print_success "  ✓ Métodos async encontrados"
    else
        print_error "  ✗ Métodos async NO encontrados"
        FAILED_VALIDATIONS=$((FAILED_VALIDATIONS + 1))
    fi
fi

print_step "Validando WebSocket Manager..."
if [ -f "services/api-server/src/adapters/ws/websocketManager.ts" ]; then
    LINES=$(wc -l < "services/api-server/src/adapters/ws/websocketManager.ts")
    if [ "$LINES" -ge 600 ]; then
        print_success "websocketManager.ts tiene $LINES líneas (✓ >= 600)"
    else
        print_error "websocketManager.ts solo tiene $LINES líneas (✗ < 600)"
        FAILED_VALIDATIONS=$((FAILED_VALIDATIONS + 1))
    fi
    
    if grep -q "class WebSocketManager" "services/api-server/src/adapters/ws/websocketManager.ts"; then
        print_success "  ✓ Clase WebSocketManager encontrada"
    else
        print_error "  ✗ Clase WebSocketManager NO encontrada"
        FAILED_VALIDATIONS=$((FAILED_VALIDATIONS + 1))
    fi
fi

print_step "Validando Flash Executor..."
if [ -f "services/ts-executor/src/exec/flash.ts" ]; then
    LINES=$(wc -l < "services/ts-executor/src/exec/flash.ts")
    if [ "$LINES" -ge 600 ]; then
        print_success "flash.ts tiene $LINES líneas (✓ >= 600)"
    else
        print_error "flash.ts solo tiene $LINES líneas (✗ < 600)"
        FAILED_VALIDATIONS=$((FAILED_VALIDATIONS + 1))
    fi
fi

print_step "Validando Rust Engine..."
if [ -f "services/engine-rust/src/pathfinding/mod.rs" ]; then
    LINES=$(wc -l < "services/engine-rust/src/pathfinding/mod.rs")
    if [ "$LINES" -ge 300 ]; then
        print_success "pathfinding/mod.rs tiene $LINES líneas (✓ >= 300)"
    else
        print_error "pathfinding/mod.rs solo tiene $LINES líneas (✗ < 300)"
        FAILED_VALIDATIONS=$((FAILED_VALIDATIONS + 1))
    fi
fi

###############################################################################
# FASE 7: VALIDACIÓN DE CONTRATOS
###############################################################################

print_header "FASE 7: VALIDACIÓN DE CONTRATOS SOLIDITY"

print_step "Validando Router.sol..."
if [ -f "contracts/src/Router.sol" ]; then
    LINES=$(wc -l < "contracts/src/Router.sol")
    if [ "$LINES" -ge 500 ]; then
        print_success "Router.sol tiene $LINES líneas (✓ >= 500)"
    else
        print_error "Router.sol solo tiene $LINES líneas (✗ < 500)"
        FAILED_VALIDATIONS=$((FAILED_VALIDATIONS + 1))
    fi
    
    if grep -q "function executeArbitrage" "contracts/src/Router.sol"; then
        print_success "  ✓ Función executeArbitrage encontrada"
    else
        print_error "  ✗ Función executeArbitrage NO encontrada"
        FAILED_VALIDATIONS=$((FAILED_VALIDATIONS + 1))
    fi
    
    if grep -q "address\[\]" "contracts/src/Router.sol"; then
        print_success "  ✓ Usa arrays dinámicos"
    else
        print_error "  ✗ NO usa arrays dinámicos"
        FAILED_VALIDATIONS=$((FAILED_VALIDATIONS + 1))
    fi
fi

print_step "Validando Vault.sol..."
if [ -f "contracts/src/Vault.sol" ]; then
    LINES=$(wc -l < "contracts/src/Vault.sol")
    if [ "$LINES" -ge 300 ]; then
        print_success "Vault.sol tiene $LINES líneas (✓ >= 300)"
    else
        print_warning "Vault.sol tiene $LINES líneas (⚠ < 300)"
    fi
fi

###############################################################################
# FASE 8: VALIDACIÓN DE ARRAYS DINÁMICOS
###############################################################################

print_header "FASE 8: VALIDACIÓN DE ARRAYS DINÁMICOS (NO HARDCODING)"

print_step "Buscando hardcoding prohibido..."

HARDCODED_FOUND=false

# Buscar arrays hardcodeados
if grep -r "const BLOCKCHAINS = \[" services/ 2>/dev/null; then
    print_error "Encontrado: Array BLOCKCHAINS hardcodeado"
    HARDCODED_FOUND=true
fi

if grep -r "const DEXES = \[" services/ 2>/dev/null; then
    print_error "Encontrado: Array DEXES hardcodeado"
    HARDCODED_FOUND=true
fi

if grep -r "const CHAIN_ID = [0-9]" services/ 2>/dev/null; then
    print_error "Encontrado: CHAIN_ID hardcodeado"
    HARDCODED_FOUND=true
fi

if [ "$HARDCODED_FOUND" = true ]; then
    print_error "Se encontró hardcoding prohibido"
    FAILED_VALIDATIONS=$((FAILED_VALIDATIONS + 1))
else
    print_success "No se encontró hardcoding prohibido"
    PASSED_VALIDATIONS=$((PASSED_VALIDATIONS + 1))
fi

TOTAL_VALIDATIONS=$((TOTAL_VALIDATIONS + 1))

###############################################################################
# FASE 9: VALIDACIÓN DE INTEGRACIÓN
###############################################################################

print_header "FASE 9: VALIDACIÓN DE INTEGRACIÓN ENTRE MÓDULOS"

print_step "Verificando imports entre módulos..."

# Python Collector → API Server
if grep -r "import.*GoogleSheetsClient" services/python-collector/ 2>/dev/null | grep -v ".pyc" > /dev/null; then
    print_success "Python Collector usa GoogleSheetsClient"
else
    print_warning "Python Collector podría no usar GoogleSheetsClient"
fi

# WebSocket Manager → Flash Executor
if grep -r "import.*WebSocketManager" services/ts-executor/ 2>/dev/null > /dev/null; then
    print_success "TS Executor importa WebSocketManager"
else
    print_warning "TS Executor podría no importar WebSocketManager"
fi

# Flash Executor → Contratos
if grep -r "executeArbitrage" services/ts-executor/ 2>/dev/null > /dev/null; then
    print_success "TS Executor llama a executeArbitrage"
else
    print_warning "TS Executor podría no llamar a executeArbitrage"
fi

###############################################################################
# RESUMEN FINAL
###############################################################################

print_header "RESUMEN FINAL DE VALIDACIONES"

echo ""
echo -e "${BOLD}📊 ESTADÍSTICAS:${NC}"
echo -e "  Total de validaciones:     ${TOTAL_VALIDATIONS}"
echo -e "  ${GREEN}✅ Validaciones pasadas:    ${PASSED_VALIDATIONS}${NC}"
echo -e "  ${RED}❌ Validaciones fallidas:   ${FAILED_VALIDATIONS}${NC}"

PERCENTAGE=$((PASSED_VALIDATIONS * 100 / TOTAL_VALIDATIONS))
echo ""
echo -e "${BOLD}📈 COMPLETITUD: ${PERCENTAGE}%${NC}"

echo ""
if [ "$FAILED_VALIDATIONS" -eq 0 ]; then
    echo -e "${GREEN}${BOLD}╔═══════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}${BOLD}║                                                                           ║${NC}"
    echo -e "${GREEN}${BOLD}║         ✅ TODAS LAS VALIDACIONES PASARON EXITOSAMENTE                   ║${NC}"
    echo -e "${GREEN}${BOLD}║                                                                           ║${NC}"
    echo -e "${GREEN}${BOLD}║         El sistema está completo e integrado correctamente              ║${NC}"
    echo -e "${GREEN}${BOLD}║                                                                           ║${NC}"
    echo -e "${GREEN}${BOLD}╚═══════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}${BOLD}╔═══════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}${BOLD}║                                                                           ║${NC}"
    echo -e "${RED}${BOLD}║         ❌ VALIDACIÓN FALLIDA                                             ║${NC}"
    echo -e "${RED}${BOLD}║                                                                           ║${NC}"
    echo -e "${RED}${BOLD}║         Se encontraron ${FAILED_VALIDATIONS} errores críticos                                  ║${NC}"
    echo -e "${RED}${BOLD}║         Por favor revisa los errores arriba y corrige                    ║${NC}"
    echo -e "${RED}${BOLD}║                                                                           ║${NC}"
    echo -e "${RED}${BOLD}╚═══════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    exit 1
fi

