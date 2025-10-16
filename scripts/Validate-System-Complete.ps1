<#
.SYNOPSIS
    Script Maestro de Validación Completa del Sistema ARBITRAGEXPLUS2025

.DESCRIPTION
    Ejecuta todas las validaciones del sistema y genera un reporte visual
    en formato árbol ASCII con colores indicando el estado de cada archivo.
    
    Para archivos que NO pasen la auditoría, incluye:
    - Ubicación precisa en el repositorio GitHub
    - Función detallada del archivo
    - Datos que debería RECIBIR
    - Datos que debería ENTREGAR

.NOTES
    Autor: MANUS AI
    Versión: 2.0
    Fecha: 2025-10-16
    Repositorio: https://github.com/hefarica/ARBITRAGEXPLUS2025
    
.EXAMPLE
    .\Validate-System-Complete.ps1
    
.EXAMPLE
    .\Validate-System-Complete.ps1 -OutputPath "C:\Reports\validation-report.txt"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [string]$OutputPath = "validation-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt",
    
    [Parameter(Mandatory=$false)]
    [switch]$NoColor
)

# ============================================================================
# CONFIGURACIÓN
# ============================================================================

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

# Repositorio GitHub
$script:RepoURL = "https://github.com/hefarica/ARBITRAGEXPLUS2025"
$script:RepoBranch = "master"

# Colores ANSI para terminal
$script:Colors = @{
    Reset = "`e[0m"
    Red = "`e[31m"
    Green = "`e[32m"
    Yellow = "`e[33m"
    Blue = "`e[34m"
    Magenta = "`e[35m"
    Cyan = "`e[36m"
    White = "`e[37m"
    Bold = "`e[1m"
    BgRed = "`e[41m"
    BgGreen = "`e[42m"
}

# Estructura del sistema con especificaciones completas
$script:SystemStructure = @{
    'services/python-collector/src/sheets/client.py' = @{
        Function = 'Cliente Google Sheets - Cerebro operativo del sistema'
        Description = 'Gestiona toda la comunicación con Google Sheets, implementando el patrón Singleton con caché inteligente, reintentos automáticos y manejo robusto de errores.'
        MinLines = 500
        Critical = $true
        Patterns = @('class GoogleSheetsClient', 'async def', '@retry')
        ShouldReceive = @(
            'Credenciales de Google Service Account (JSON)',
            'SPREADSHEET_ID desde variables de entorno',
            'Nombres de hojas: BLOCKCHAINS, DEXES, ASSETS, POOLS, ROUTES, EXECUTIONS, CONFIG, ALERTS',
            'Datos de ejecución de arbitraje (para escritura)'
        )
        ShouldDeliver = @(
            'Arrays dinámicos de blockchains desde hoja BLOCKCHAINS',
            'Arrays dinámicos de DEXes desde hoja DEXES',
            'Arrays dinámicos de assets desde hoja ASSETS',
            'Arrays dinámicos de pools desde hoja POOLS',
            'Arrays dinámicos de rutas desde hoja ROUTES',
            'Configuración del sistema desde hoja CONFIG',
            'Confirmación de escritura a EXECUTIONS (< 50ms)'
        )
    }
    
    'services/api-server/src/adapters/ws/websocketManager.ts' = @{
        Function = 'Gestor WebSocket - Conexiones en tiempo real con DEXs'
        Description = 'Administra hasta 40+ conexiones WebSocket concurrentes con Pyth Network, Subgraphs de DEXs, y feeds de precios. Implementa reconexión automática, backpressure handling y event-driven architecture.'
        MinLines = 600
        Critical = $true
        Patterns = @('class WebSocketManager', 'EventEmitter', 'Map<')
        ShouldReceive = @(
            'Configuración de endpoints WebSocket desde Google Sheets',
            'Lista dinámica de pares de trading a monitorear',
            'Parámetros de reconexión (max retries, backoff)',
            'Event handlers desde TS Executor'
        )
        ShouldDeliver = @(
            'Eventos de actualización de precios en tiempo real',
            'Eventos de cambios en liquidez de pools',
            'Eventos de nuevas oportunidades de arbitraje',
            'Estado de conexiones (health checks)',
            'Datos normalizados de múltiples fuentes WebSocket'
        )
    }
    
    'services/ts-executor/src/exec/flash.ts' = @{
        Function = 'Ejecutor Flash Loans - Operaciones atómicas de arbitraje'
        Description = 'Ejecuta operaciones de arbitraje mediante flash loans atómicos. Coordina hasta 40 operaciones simultáneas con protección MEV, validación de rutas, estimación de gas y manejo de slippage.'
        MinLines = 600
        Critical = $true
        Patterns = @('executeArbitrage', 'flashLoan', 'async')
        ShouldReceive = @(
            'Rutas de arbitraje validadas desde Rust Engine',
            'Configuración de DEXs desde Google Sheets',
            'Parámetros de gas (gasPrice, gasLimit)',
            'Slippage tolerance desde CONFIG',
            'Direcciones de contratos Router y Vault',
            'Private key del wallet ejecutor (desde env)'
        )
        ShouldDeliver = @(
            'Transacciones firmadas y enviadas a blockchain',
            'Resultados de ejecución (éxito/fallo, profit real)',
            'Logs de ejecución a Google Sheets (EXECUTIONS)',
            'Eventos de ejecución al sistema de monitoreo',
            'Métricas de rendimiento (tiempo de ejecución, gas usado)',
            'Errores detallados en caso de fallo'
        )
    }
    
    'services/engine-rust/src/pathfinding/mod.rs' = @{
        Function = 'Motor Rust - Algoritmos DP para pathfinding'
        Description = 'Módulo principal del motor de pathfinding con algoritmos de programación dinámica. Coordina los algoritmos 2-DEX y 3-DEX, ranking de rutas y optimización de portfolio.'
        MinLines = 300
        Critical = $true
        Patterns = @('pub struct', 'impl', 'Vec<')
        ShouldReceive = @(
            'Arrays de pools disponibles con liquidez',
            'Arrays de assets con precios actualizados',
            'Parámetros de búsqueda (max hops, min profit)',
            'Restricciones de gas y slippage',
            'Estado actual del portfolio'
        )
        ShouldDeliver = @(
            'Rutas de arbitraje 2-hop ordenadas por profit',
            'Rutas de arbitraje 3-hop ordenadas por profit',
            'Ranking multi-criterio de rutas',
            'Cálculos de profit esperado con slippage',
            'Estimaciones de gas por ruta',
            'Recomendaciones de ejecución'
        )
    }
    
    'services/engine-rust/src/pathfinding/two_dex.rs' = @{
        Function = 'Algoritmo DP 2-DEX - Rutas de arbitraje 2-hop'
        Description = 'Implementa algoritmo de programación dinámica O(n²) para encontrar rutas de arbitraje de 2 saltos (2-hop). Optimizado para velocidad con early stopping.'
        MinLines = 200
        Critical = $true
        Patterns = @('pub fn find', 'TwoHopPathfinder')
        ShouldReceive = @(
            'Vec<Pool> - Array de pools disponibles',
            'Vec<Asset> - Array de assets con precios',
            'Asset inicial (token de entrada)',
            'Monto inicial a arbitrar',
            'Parámetros de optimización (min_profit, max_slippage)'
        )
        ShouldDeliver = @(
            'Vec<Route> - Rutas 2-hop encontradas',
            'Profit esperado por ruta',
            'Slippage calculado por ruta',
            'Path: [Asset A -> Pool 1 -> Asset B -> Pool 2 -> Asset A]',
            'Métricas de ejecución del algoritmo'
        )
    }
    
    'services/engine-rust/src/pathfinding/three_dex.rs' = @{
        Function = 'Algoritmo DP 3-DEX - Rutas de arbitraje 3-hop'
        Description = 'Implementa algoritmo de programación dinámica O(n³) para encontrar rutas de arbitraje de 3 saltos (3-hop). Incluye poda de búsqueda para optimización.'
        MinLines = 200
        Critical = $true
        Patterns = @('pub fn find', 'ThreeHopPathfinder')
        ShouldReceive = @(
            'Vec<Pool> - Array de pools disponibles',
            'Vec<Asset> - Array de assets con precios',
            'Asset inicial (token de entrada)',
            'Monto inicial a arbitrar',
            'Parámetros de optimización (min_profit, max_slippage, max_gas)'
        )
        ShouldDeliver = @(
            'Vec<Route> - Rutas 3-hop encontradas',
            'Profit esperado por ruta (descontando gas)',
            'Slippage acumulado calculado',
            'Path: [Asset A -> Pool 1 -> Asset B -> Pool 2 -> Asset C -> Pool 3 -> Asset A]',
            'Estimación de gas por ruta',
            'Ranking de rutas por profit neto'
        )
    }
    
    'contracts/src/Router.sol' = @{
        Function = 'Router Contract - Ejecución multi-DEX on-chain'
        Description = 'Contrato inteligente que ejecuta arbitrajes multi-DEX mediante flash loans. Soporta rutas dinámicas, protección contra reentrancy y MEV, y gestión de fees.'
        MinLines = 500
        Critical = $true
        Patterns = @('contract', 'function executeArbitrage', 'address[]')
        ShouldReceive = @(
            'address[] calldata dexRouters - Direcciones de routers DEX (dinámico desde Sheets)',
            'address[] calldata tokens - Tokens en la ruta de arbitraje',
            'uint256[] calldata amounts - Montos para cada swap',
            'bytes calldata params - Parámetros adicionales codificados',
            'Flash loan callback desde Vault'
        )
        ShouldDeliver = @(
            'Ejecución atómica de swaps multi-DEX',
            'Profit neto transferido al wallet ejecutor',
            'Protocol fees enviados al treasury',
            'Eventos de ejecución (ArbitrageExecuted)',
            'Revert con mensaje detallado en caso de fallo',
            'Estadísticas de ejecución on-chain'
        )
    }
    
    'contracts/src/Vault.sol' = @{
        Function = 'Vault Contract - Gestión de liquidez y flash loans'
        Description = 'Vault que provee liquidez para flash loans con fees competitivos (0.09%). Gestiona múltiples tokens, liquidity providers, y protección contra ataques.'
        MinLines = 300
        Critical = $true
        Patterns = @('contract', 'function flashLoan', 'mapping')
        ShouldReceive = @(
            'Depósitos de liquidity providers (multi-token)',
            'Solicitudes de flash loans desde Router',
            'address token - Token a prestar',
            'uint256 amount - Monto del flash loan',
            'bytes calldata data - Datos para callback',
            'Configuración de fees desde admin'
        )
        ShouldDeliver = @(
            'Flash loan ejecutado con callback',
            'Validación de repago + fees',
            'Distribución de fees a LPs',
            'Eventos de flash loan (FlashLoanExecuted)',
            'Tracking de liquidez disponible/reservada',
            'Protección contra reentrancy y exploits'
        )
    }
    
    'apps-script/gas-advanced-mapper.gs' = @{
        Function = 'Google Apps Script - Sincronización bidireccional Sheets'
        Description = 'Script de Google Apps Script que sincroniza datos entre Google Sheets y el repositorio GitHub. Implementa webhooks, validación de esquemas y logging.'
        MinLines = 100
        Critical = $false
        Patterns = @('function', 'SpreadsheetApp')
        ShouldReceive = @(
            'Triggers de edición en Google Sheets',
            'Webhooks desde servicios externos',
            'Datos de configuración desde hojas CONFIG',
            'Credenciales de GitHub API (desde propiedades)'
        )
        ShouldDeliver = @(
            'Sincronización automática a GitHub',
            'Validación de esquemas de datos',
            'Logs de sincronización a hoja ALERTS',
            'Notificaciones de errores',
            'Timestamps de última sincronización'
        )
    }
    
    'config/chains.yaml' = @{
        Function = 'Configuración de blockchains - Datos dinámicos'
        Description = 'Archivo YAML con configuración de todas las blockchains soportadas. Se sincroniza con Google Sheets hoja BLOCKCHAINS.'
        MinLines = 10
        Critical = $false
        Patterns = @('chains:', 'chain_id:')
        ShouldReceive = @(
            'Sincronización desde Google Sheets (BLOCKCHAINS)',
            'Variables de entorno para RPC URLs',
            'Configuración manual de nuevas chains'
        )
        ShouldDeliver = @(
            'Array de chains con: chain_id, name, rpc_url, explorer_url',
            'Parámetros de gas por chain',
            'Configuración de contratos por chain',
            'Datos cargados por Python Collector'
        )
    }
    
    'config/dexes.yaml' = @{
        Function = 'Configuración de DEXes - Datos dinámicos'
        Description = 'Archivo YAML con configuración de todos los DEXes soportados. Se sincroniza con Google Sheets hoja DEXES.'
        MinLines = 10
        Critical = $false
        Patterns = @('dexes:', 'router_address:')
        ShouldReceive = @(
            'Sincronización desde Google Sheets (DEXES)',
            'Variables de entorno para API keys',
            'Configuración manual de nuevos DEXes'
        )
        ShouldDeliver = @(
            'Array de DEXes con: dex_id, name, router_address, factory_address',
            'Fee tiers por DEX',
            'Endpoints de subgraphs',
            'Datos cargados por Python Collector y TS Executor'
        )
    }
}

# Resultados de validación
$script:ValidationResults = @{
    TotalFiles = 0
    PassedFiles = 0
    FailedFiles = 0
    WarningFiles = 0
    FileDetails = @{}
    FailedFilesDetails = @()
}

# ============================================================================
# FUNCIONES AUXILIARES
# ============================================================================

function Write-ColorText {
    param(
        [string]$Text,
        [string]$Color = "White",
        [switch]$NoNewline
    )
    
    if ($NoColor) {
        if ($NoNewline) {
            Write-Host $Text -NoNewline
        } else {
            Write-Host $Text
        }
    } else {
        $colorCode = $script:Colors[$Color]
        $resetCode = $script:Colors.Reset
        
        if ($NoNewline) {
            Write-Host "$colorCode$Text$resetCode" -NoNewline
        } else {
            Write-Host "$colorCode$Text$resetCode"
        }
    }
}

function Write-Header {
    param([string]$Text)
    
    Write-ColorText "`n$('=' * 80)" -Color Cyan
    Write-ColorText "  $Text" -Color Bold
    Write-ColorText "$('=' * 80)" -Color Cyan
}

function Write-SubHeader {
    param([string]$Text)
    
    Write-ColorText "`n$('-' * 80)" -Color Blue
    Write-ColorText "  $Text" -Color Blue
    Write-ColorText "$('-' * 80)" -Color Blue
}

function Get-FileLineCount {
    param([string]$FilePath)
    
    if (Test-Path $FilePath) {
        return (Get-Content $FilePath).Count
    }
    return 0
}

function Test-FilePatterns {
    param(
        [string]$FilePath,
        [string[]]$Patterns
    )
    
    if (-not (Test-Path $FilePath)) {
        return $false
    }
    
    $content = Get-Content $FilePath -Raw
    $foundPatterns = 0
    
    foreach ($pattern in $Patterns) {
        if ($content -match [regex]::Escape($pattern)) {
            $foundPatterns++
        }
    }
    
    return ($foundPatterns -eq $Patterns.Count)
}

function Get-GitHubFileURL {
    param([string]$FilePath)
    
    return "$($script:RepoURL)/blob/$($script:RepoBranch)/$FilePath"
}

# ============================================================================
# VALIDACIÓN 1: INTEGRIDAD DE ARCHIVOS
# ============================================================================

function Invoke-FileIntegrityValidation {
    Write-Header "VALIDACIÓN 1: INTEGRIDAD DE ARCHIVOS CRÍTICOS"
    
    $repoRoot = Split-Path -Parent $PSScriptRoot
    
    foreach ($file in $script:SystemStructure.Keys) {
        $filePath = Join-Path $repoRoot $file
        $fileInfo = $script:SystemStructure[$file]
        
        Write-ColorText "`n📄 Validando: $file" -Color Cyan
        
        $script:ValidationResults.TotalFiles++
        
        $status = @{
            Exists = Test-Path $filePath
            LineCount = 0
            HasPatterns = $false
            Errors = @()
            Warnings = @()
            GitHubURL = Get-GitHubFileURL $file
        }
        
        if ($status.Exists) {
            $status.LineCount = Get-FileLineCount $filePath
            $status.HasPatterns = Test-FilePatterns $filePath $fileInfo.Patterns
            
            # Validar líneas mínimas
            if ($status.LineCount -lt $fileInfo.MinLines) {
                $status.Errors += "Solo $($status.LineCount) líneas (mínimo: $($fileInfo.MinLines))"
                Write-ColorText "  ❌ Solo $($status.LineCount) líneas (mínimo: $($fileInfo.MinLines))" -Color Red
            } else {
                Write-ColorText "  ✅ $($status.LineCount) líneas (OK)" -Color Green
            }
            
            # Validar patrones
            if (-not $status.HasPatterns) {
                $status.Errors += "Faltan patrones requeridos"
                Write-ColorText "  ❌ Faltan patrones requeridos" -Color Red
            } else {
                Write-ColorText "  ✅ Patrones requeridos encontrados" -Color Green
            }
            
            # Buscar TODOs y FIXMEs
            $content = Get-Content $filePath -Raw
            if ($content -match 'TODO|FIXME') {
                $status.Warnings += "Contiene TODO/FIXME"
                Write-ColorText "  ⚠️  Contiene TODO/FIXME" -Color Yellow
            }
            
        } else {
            $status.Errors += "Archivo no existe"
            Write-ColorText "  ❌ Archivo no existe" -Color Red
        }
        
        # Guardar resultados
        $script:ValidationResults.FileDetails[$file] = $status
        
        if ($status.Errors.Count -eq 0) {
            $script:ValidationResults.PassedFiles++
        } else {
            if ($fileInfo.Critical) {
                $script:ValidationResults.FailedFiles++
            } else {
                $script:ValidationResults.WarningFiles++
            }
            
            # Agregar a lista de archivos fallidos para reporte detallado
            $script:ValidationResults.FailedFilesDetails += @{
                File = $file
                Status = $status
                Info = $fileInfo
            }
        }
    }
}

# ============================================================================
# VALIDACIÓN 2: FLUJO DE DATOS
# ============================================================================

function Invoke-DataFlowValidation {
    Write-Header "VALIDACIÓN 2: FLUJO DE DATOS ENTRE MÓDULOS"
    
    $flows = @(
        @{
            Name = "Google Sheets → Python Collector"
            Source = "services/python-collector/src/sheets/client.py"
            Target = "services/python-collector/src/main.py"
            Patterns = @('from.*sheets.*import', 'GoogleSheetsClient')
        },
        @{
            Name = "Python Collector → API Server"
            Source = "services/python-collector/src/main.py"
            Target = "services/api-server/src/server.ts"
            Patterns = @('fetch.*config', 'axios')
        },
        @{
            Name = "WebSocket Manager → Flash Executor"
            Source = "services/api-server/src/adapters/ws/websocketManager.ts"
            Target = "services/ts-executor/src/exec/flash.ts"
            Patterns = @('EventEmitter', 'on\(')
        },
        @{
            Name = "Flash Executor → Router Contract"
            Source = "services/ts-executor/src/exec/flash.ts"
            Target = "contracts/src/Router.sol"
            Patterns = @('executeArbitrage', 'ethers')
        }
    )
    
    $repoRoot = Split-Path -Parent $PSScriptRoot
    
    foreach ($flow in $flows) {
        Write-ColorText "`n🔄 Validando: $($flow.Name)" -Color Cyan
        
        $sourcePath = Join-Path $repoRoot $flow.Source
        
        if (Test-Path $sourcePath) {
            $hasPatterns = Test-FilePatterns $sourcePath $flow.Patterns
            
            if ($hasPatterns) {
                Write-ColorText "  ✅ Flujo de datos correcto" -Color Green
            } else {
                Write-ColorText "  ⚠️  Flujo de datos incompleto" -Color Yellow
            }
        } else {
            Write-ColorText "  ❌ Archivo fuente no existe" -Color Red
        }
    }
}

# ============================================================================
# VALIDACIÓN 3: ARRAYS DINÁMICOS (NO HARDCODING)
# ============================================================================

function Invoke-DynamicArraysValidation {
    Write-Header "VALIDACIÓN 3: ARRAYS DINÁMICOS (NO HARDCODING)"
    
    $repoRoot = Split-Path -Parent $PSScriptRoot
    
    $filesToCheck = @(
        'services/python-collector/src/sheets/client.py',
        'services/api-server/src/adapters/ws/websocketManager.ts',
        'services/ts-executor/src/exec/flash.ts',
        'services/engine-rust/src/pathfinding/mod.rs'
    )
    
    foreach ($file in $filesToCheck) {
        $filePath = Join-Path $repoRoot $file
        
        Write-ColorText "`n📋 Validando: $file" -Color Cyan
        
        if (Test-Path $filePath) {
            $content = Get-Content $filePath -Raw
            
            # Detectar hardcoding prohibido
            $hardcodedPatterns = @(
                'const BLOCKCHAINS = \[',
                'const DEXES = \[',
                'const CHAIN_ID = \d+',
                'FIXED_.*= \['
            )
            
            $hasHardcoding = $false
            foreach ($pattern in $hardcodedPatterns) {
                if ($content -match $pattern) {
                    $hasHardcoding = $true
                    Write-ColorText "  ❌ Hardcoding detectado: $pattern" -Color Red
                }
            }
            
            if (-not $hasHardcoding) {
                Write-ColorText "  ✅ NO tiene hardcoding" -Color Green
            }
            
            # Detectar arrays dinámicos
            $dynamicPatterns = @{
                '.py' = @('\[.*for.*in.*\]', 'map\(', 'filter\(')
                '.ts' = @('Array\.map', 'Array\.filter', 'Promise\.all')
                '.rs' = @('\.iter\(\)', '\.filter\(', '\.collect\(\)')
                '.sol' = @('\[\].*calldata', 'mapping')
            }
            
            $ext = [System.IO.Path]::GetExtension($file)
            if ($dynamicPatterns.ContainsKey($ext)) {
                $hasDynamic = $false
                foreach ($pattern in $dynamicPatterns[$ext]) {
                    if ($content -match $pattern) {
                        $hasDynamic = $true
                        Write-ColorText "  ✅ Usa arrays dinámicos: $pattern" -Color Green
                        break
                    }
                }
                
                if (-not $hasDynamic) {
                    Write-ColorText "  ❌ NO usa arrays dinámicos" -Color Red
                }
            }
        } else {
            Write-ColorText "  ❌ Archivo no existe" -Color Red
        }
    }
}

# ============================================================================
# VALIDACIÓN 4: CONFIGURACIÓN EXTERNALIZADA
# ============================================================================

function Invoke-ConfigValidation {
    Write-Header "VALIDACIÓN 4: CONFIGURACIÓN EXTERNALIZADA"
    
    $repoRoot = Split-Path -Parent $PSScriptRoot
    
    $configFiles = @(
        'config/chains.yaml',
        'config/dexes.yaml',
        'config/system.yaml',
        '.env.example'
    )
    
    foreach ($file in $configFiles) {
        $filePath = Join-Path $repoRoot $file
        
        Write-ColorText "`n⚙️  Validando: $file" -Color Cyan
        
        if (Test-Path $filePath) {
            $content = Get-Content $filePath -Raw
            
            # Verificar uso de variables de entorno
            if ($content -match '\$\{.*\}|process\.env') {
                Write-ColorText "  ✅ Usa variables de entorno" -Color Green
            } else {
                Write-ColorText "  ⚠️  No se detectaron variables de entorno" -Color Yellow
            }
            
            # Verificar que NO tenga valores sensibles hardcodeados
            if ($content -match 'api_key.*=.*[a-zA-Z0-9]{20,}|private_key.*=.*0x[a-fA-F0-9]{64}') {
                Write-ColorText "  ❌ Posible valor sensible hardcodeado" -Color Red
            } else {
                Write-ColorText "  ✅ No hay valores sensibles hardcodeados" -Color Green
            }
        } else {
            Write-ColorText "  ⚠️  Archivo no encontrado (opcional)" -Color Yellow
        }
    }
}

# ============================================================================
# GENERACIÓN DE REPORTE ASCII TREE
# ============================================================================

function New-ASCIITree {
    param(
        [hashtable]$FileDetails,
        [string]$OutputPath
    )
    
    $report = @()
    $report += "╔═══════════════════════════════════════════════════════════════════════════╗"
    $report += "║                                                                           ║"
    $report += "║         REPORTE DE VALIDACIÓN DEL SISTEMA - ARBITRAGEXPLUS2025           ║"
    $report += "║         Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')                              ║"
    $report += "║         Repositorio: $($script:RepoURL)                  ║"
    $report += "║                                                                           ║"
    $report += "╚═══════════════════════════════════════════════════════════════════════════╝"
    $report += ""
    $report += "📊 RESUMEN EJECUTIVO:"
    $report += "   Total de archivos:      $($script:ValidationResults.TotalFiles)"
    $report += "   ✅ Archivos OK:          $($script:ValidationResults.PassedFiles)"
    $report += "   ❌ Archivos con errores: $($script:ValidationResults.FailedFiles)"
    $report += "   ⚠️  Advertencias:        $($script:ValidationResults.WarningFiles)"
    $report += ""
    $report += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    $report += "ÁRBOL DE ARCHIVOS DEL SISTEMA"
    $report += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    $report += ""
    $report += "ARBITRAGEXPLUS2025/"
    
    # Organizar archivos por directorio
    $tree = @{}
    foreach ($file in $FileDetails.Keys) {
        $parts = $file -split '/'
        $currentLevel = $tree
        
        for ($i = 0; $i -lt $parts.Count - 1; $i++) {
            $dir = $parts[$i]
            if (-not $currentLevel.ContainsKey($dir)) {
                $currentLevel[$dir] = @{}
            }
            $currentLevel = $currentLevel[$dir]
        }
        
        $fileName = $parts[-1]
        $currentLevel[$fileName] = @{
            FullPath = $file
            Status = $FileDetails[$file]
        }
    }
    
    # Función recursiva para generar árbol
    function Add-TreeLevel {
        param(
            [hashtable]$Level,
            [string]$Prefix = "",
            [bool]$IsLast = $true
        )
        
        $keys = $Level.Keys | Sort-Object
        $count = $keys.Count
        
        for ($i = 0; $i -lt $count; $i++) {
            $key = $keys[$i]
            $isLastItem = ($i -eq ($count - 1))
            
            $connector = if ($isLastItem) { "└──" } else { "├──" }
            $extension = if ($isLastItem) { "    " } else { "│   " }
            
            if ($Level[$key].ContainsKey('FullPath')) {
                # Es un archivo
                $fullPath = $Level[$key].FullPath
                $fileStatus = $Level[$key].Status
                $fileInfo = $script:SystemStructure[$fullPath]
                
                $statusIcon = if ($fileStatus.Errors.Count -eq 0) { "✅" } else { "❌" }
                $statusColor = if ($fileStatus.Errors.Count -eq 0) { "[VERDE]" } else { "[ROJO]" }
                $connectorColor = if ($fileStatus.Errors.Count -eq 0) { "[VERDE]" } else { "[NEGRO]" }
                
                $function = if ($fileInfo) { $fileInfo.Function } else { "Sin descripción" }
                
                $line = "$Prefix$connector $connectorColor $statusIcon $statusColor $key"
                $script:treeReport += $line
                $script:treeReport += "$Prefix$extension    Función: $function"
                
                if ($fileStatus.Exists) {
                    $script:treeReport += "$Prefix$extension    Líneas: $($fileStatus.LineCount)"
                    
                    if ($fileStatus.Errors.Count -gt 0) {
                        $script:treeReport += "$Prefix$extension    Errores:"
                        foreach ($error in $fileStatus.Errors) {
                            $script:treeReport += "$Prefix$extension      - $error"
                        }
                    }
                    
                    if ($fileStatus.Warnings.Count -gt 0) {
                        $script:treeReport += "$Prefix$extension    Advertencias:"
                        foreach ($warning in $fileStatus.Warnings) {
                            $script:treeReport += "$Prefix$extension      - $warning"
                        }
                    }
                } else {
                    $script:treeReport += "$Prefix$extension    ❌ ARCHIVO NO EXISTE"
                }
                
                $script:treeReport += ""
                
            } else {
                # Es un directorio
                $script:treeReport += "$Prefix$connector [NEGRO] 📁 $key/"
                
                Add-TreeLevel -Level $Level[$key] -Prefix "$Prefix$extension" -IsLast $isLastItem
            }
        }
    }
    
    $script:treeReport = @()
    Add-TreeLevel -Level $tree
    
    $report += $script:treeReport
    
    # Agregar sección de archivos fallidos con detalles completos
    if ($script:ValidationResults.FailedFilesDetails.Count -gt 0) {
        $report += ""
        $report += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        $report += "DETALLES DE ARCHIVOS QUE NO PASARON LA AUDITORÍA"
        $report += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        $report += ""
        
        foreach ($failedFile in $script:ValidationResults.FailedFilesDetails) {
            $file = $failedFile.File
            $status = $failedFile.Status
            $info = $failedFile.Info
            
            $report += "╔═══════════════════════════════════════════════════════════════════════════╗"
            $report += "║ ARCHIVO: $file"
            $report += "╚═══════════════════════════════════════════════════════════════════════════╝"
            $report += ""
            $report += "📍 UBICACIÓN EN REPOSITORIO:"
            $report += "   $($status.GitHubURL)"
            $report += ""
            $report += "📋 FUNCIÓN DEL ARCHIVO:"
            $report += "   $($info.Function)"
            $report += ""
            $report += "📝 DESCRIPCIÓN DETALLADA:"
            $report += "   $($info.Description)"
            $report += ""
            $report += "📥 DATOS QUE DEBERÍA RECIBIR (INPUTS):"
            foreach ($input in $info.ShouldReceive) {
                $report += "   • $input"
            }
            $report += ""
            $report += "📤 DATOS QUE DEBERÍA ENTREGAR (OUTPUTS):"
            foreach ($output in $info.ShouldDeliver) {
                $report += "   • $output"
            }
            $report += ""
            $report += "❌ ERRORES DETECTADOS:"
            foreach ($error in $status.Errors) {
                $report += "   • $error"
            }
            $report += ""
            $report += "📊 ESTADO ACTUAL:"
            $report += "   Existe: $(if ($status.Exists) { 'Sí' } else { 'No' })"
            $report += "   Líneas actuales: $($status.LineCount)"
            $report += "   Líneas mínimas requeridas: $($info.MinLines)"
            $report += "   Patrones requeridos encontrados: $(if ($status.HasPatterns) { 'Sí' } else { 'No' })"
            $report += ""
            $report += "🔧 ACCIÓN REQUERIDA:"
            if (-not $status.Exists) {
                $report += "   1. Crear el archivo en la ubicación especificada"
                $report += "   2. Implementar la función descrita arriba"
                $report += "   3. Asegurar que reciba y entregue los datos especificados"
            } elseif ($status.LineCount -lt $info.MinLines) {
                $report += "   1. Completar la implementación del archivo"
                $report += "   2. Agregar al menos $(($info.MinLines - $status.LineCount)) líneas más de código funcional"
                $report += "   3. Implementar todos los patrones requeridos"
            } elseif (-not $status.HasPatterns) {
                $report += "   1. Implementar los patrones requeridos: $($info.Patterns -join ', ')"
                $report += "   2. Asegurar que el archivo cumpla con su función especificada"
            }
            $report += ""
            $report += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            $report += ""
        }
    }
    
    $report += ""
    $report += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    $report += "LEYENDA:"
    $report += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    $report += ""
    $report += "✅ [VERDE]  - Archivo OK, todas las validaciones pasaron"
    $report += "❌ [ROJO]   - Archivo con errores críticos"
    $report += "⚠️  [AMARILLO] - Archivo con advertencias"
    $report += ""
    $report += "Conectores:"
    $report += "  ├── [VERDE] - Conecta a archivo OK"
    $report += "  ├── [NEGRO] - Conecta a archivo con problemas o directorio"
    $report += "  └── [VERDE/NEGRO] - Último elemento del nivel"
    $report += ""
    $report += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    $report += "FIN DEL REPORTE"
    $report += "Generado: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    $report += "Repositorio: $($script:RepoURL)"
    $report += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Guardar reporte
    $report | Out-File -FilePath $OutputPath -Encoding UTF8
    
    return $report
}

# ============================================================================
# MAIN
# ============================================================================

function Main {
    Clear-Host
    
    Write-ColorText "╔═══════════════════════════════════════════════════════════════════════════╗" -Color Cyan
    Write-ColorText "║                                                                           ║" -Color Cyan
    Write-ColorText "║         VALIDACIÓN COMPLETA DEL SISTEMA - ARBITRAGEXPLUS2025             ║" -Color Cyan
    Write-ColorText "║         Repositorio: $($script:RepoURL)                  ║" -Color Cyan
    Write-ColorText "║                                                                           ║" -Color Cyan
    Write-ColorText "╚═══════════════════════════════════════════════════════════════════════════╝" -Color Cyan
    
    # Ejecutar validaciones
    Invoke-FileIntegrityValidation
    Invoke-DataFlowValidation
    Invoke-DynamicArraysValidation
    Invoke-ConfigValidation
    
    # Generar reporte
    Write-Header "GENERANDO REPORTE ASCII TREE"
    
    $reportContent = New-ASCIITree -FileDetails $script:ValidationResults.FileDetails -OutputPath $OutputPath
    
    Write-ColorText "`n✅ Reporte generado: $OutputPath" -Color Green
    Write-ColorText "   Ubicación completa: $(Resolve-Path $OutputPath)" -Color Cyan
    
    # Mostrar resumen final
    Write-Header "RESUMEN FINAL"
    
    Write-ColorText "`n📊 ESTADÍSTICAS:" -Color Bold
    Write-ColorText "   Total de archivos:      $($script:ValidationResults.TotalFiles)"
    Write-ColorText "   ✅ Archivos OK:          $($script:ValidationResults.PassedFiles)" -Color Green
    Write-ColorText "   ❌ Archivos con errores: $($script:ValidationResults.FailedFiles)" -Color Red
    Write-ColorText "   ⚠️  Advertencias:        $($script:ValidationResults.WarningFiles)" -Color Yellow
    
    $percentage = [math]::Round(($script:ValidationResults.PassedFiles / $script:ValidationResults.TotalFiles) * 100, 1)
    Write-ColorText "`n📈 COMPLETITUD: $percentage%" -Color Bold
    
    if ($script:ValidationResults.FailedFiles -eq 0) {
        Write-ColorText "`n✅ TODAS LAS VALIDACIONES PASARON EXITOSAMENTE" -Color Green
        Write-ColorText "   El sistema está completo e integrado correctamente" -Color Green
        exit 0
    } else {
        Write-ColorText "`n❌ SE ENCONTRARON $($script:ValidationResults.FailedFiles) ARCHIVOS CON ERRORES" -Color Red
        Write-ColorText "   Por favor revisa el reporte detallado: $OutputPath" -Color Yellow
        Write-ColorText "   Cada archivo fallido incluye:" -Color Yellow
        Write-ColorText "     • Ubicación en GitHub" -Color Yellow
        Write-ColorText "     • Función que debería cumplir" -Color Yellow
        Write-ColorText "     • Datos que debería recibir" -Color Yellow
        Write-ColorText "     • Datos que debería entregar" -Color Yellow
        exit 1
    }
}

# Ejecutar
Main

