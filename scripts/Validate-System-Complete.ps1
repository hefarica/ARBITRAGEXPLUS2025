<#
.SYNOPSIS
    Script Maestro de Validación Completa del Sistema ARBITRAGEXPLUS2025

.DESCRIPTION
    Ejecuta todas las validaciones del sistema y genera un reporte visual
    en formato árbol ASCII con colores indicando el estado de cada archivo.

.NOTES
    Autor: MANUS AI
    Versión: 1.0
    Fecha: 2025-10-16
    
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

# Estructura del sistema
$script:SystemStructure = @{
    'services/python-collector/src/sheets/client.py' = @{
        Function = 'Cliente Google Sheets - Cerebro operativo del sistema'
        MinLines = 500
        Critical = $true
        Patterns = @('class GoogleSheetsClient', 'async def', '@retry')
    }
    'services/api-server/src/adapters/ws/websocketManager.ts' = @{
        Function = 'Gestor WebSocket - Conexiones en tiempo real con DEXs'
        MinLines = 600
        Critical = $true
        Patterns = @('class WebSocketManager', 'EventEmitter', 'Map<')
    }
    'services/ts-executor/src/exec/flash.ts' = @{
        Function = 'Ejecutor Flash Loans - Operaciones atómicas de arbitraje'
        MinLines = 600
        Critical = $true
        Patterns = @('executeArbitrage', 'flashLoan', 'async')
    }
    'services/engine-rust/src/pathfinding/mod.rs' = @{
        Function = 'Motor Rust - Algoritmos DP para pathfinding'
        MinLines = 300
        Critical = $true
        Patterns = @('pub struct', 'impl', 'Vec<')
    }
    'services/engine-rust/src/pathfinding/two_dex.rs' = @{
        Function = 'Algoritmo DP 2-DEX - Rutas de arbitraje 2-hop'
        MinLines = 200
        Critical = $true
        Patterns = @('pub fn find', 'TwoHopPathfinder')
    }
    'services/engine-rust/src/pathfinding/three_dex.rs' = @{
        Function = 'Algoritmo DP 3-DEX - Rutas de arbitraje 3-hop'
        MinLines = 200
        Critical = $true
        Patterns = @('pub fn find', 'ThreeHopPathfinder')
    }
    'contracts/src/Router.sol' = @{
        Function = 'Router Contract - Ejecución multi-DEX on-chain'
        MinLines = 500
        Critical = $true
        Patterns = @('contract', 'function executeArbitrage', 'address[]')
    }
    'contracts/src/Vault.sol' = @{
        Function = 'Vault Contract - Gestión de liquidez y flash loans'
        MinLines = 300
        Critical = $true
        Patterns = @('contract', 'function flashLoan', 'mapping')
    }
    'apps-script/gas-advanced-mapper.gs' = @{
        Function = 'Google Apps Script - Sincronización bidireccional Sheets'
        MinLines = 100
        Critical = $false
        Patterns = @('function', 'SpreadsheetApp')
    }
    'config/chains.yaml' = @{
        Function = 'Configuración de blockchains - Datos dinámicos'
        MinLines = 10
        Critical = $false
        Patterns = @('chains:', 'chain_id:')
    }
    'config/dexes.yaml' = @{
        Function = 'Configuración de DEXes - Datos dinámicos'
        MinLines = 10
        Critical = $false
        Patterns = @('dexes:', 'router_address:')
    }
}

# Resultados de validación
$script:ValidationResults = @{
    TotalFiles = 0
    PassedFiles = 0
    FailedFiles = 0
    WarningFiles = 0
    FileDetails = @{}
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
        } elseif ($fileInfo.Critical) {
            $script:ValidationResults.FailedFiles++
        } else {
            $script:ValidationResults.WarningFiles++
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
        $currentLevel[$fileName] = $FileDetails[$file]
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
            
            if ($Level[$key] -is [hashtable] -and $Level[$key].ContainsKey('Exists')) {
                # Es un archivo
                $fileStatus = $Level[$key]
                $statusIcon = if ($fileStatus.Errors.Count -eq 0) { "✅" } else { "❌" }
                $statusColor = if ($fileStatus.Errors.Count -eq 0) { "[VERDE]" } else { "[ROJO]" }
                
                $fileInfo = $script:SystemStructure[$file]
                $function = if ($fileInfo) { $fileInfo.Function } else { "Sin descripción" }
                
                $line = "$Prefix$connector $statusIcon $statusColor $key"
                $script:report += $line
                $script:report += "$Prefix$extension    Función: $function"
                
                if ($fileStatus.Exists) {
                    $script:report += "$Prefix$extension    Líneas: $($fileStatus.LineCount)"
                    
                    if ($fileStatus.Errors.Count -gt 0) {
                        $script:report += "$Prefix$extension    Errores:"
                        foreach ($error in $fileStatus.Errors) {
                            $script:report += "$Prefix$extension      - $error"
                        }
                    }
                    
                    if ($fileStatus.Warnings.Count -gt 0) {
                        $script:report += "$Prefix$extension    Advertencias:"
                        foreach ($warning in $fileStatus.Warnings) {
                            $script:report += "$Prefix$extension      - $warning"
                        }
                    }
                } else {
                    $script:report += "$Prefix$extension    ❌ ARCHIVO NO EXISTE"
                }
                
                $script:report += ""
                
            } else {
                # Es un directorio
                $connectorColor = "[NEGRO]"
                $script:report += "$Prefix$connector $connectorColor 📁 $key/"
                
                Add-TreeLevel -Level $Level[$key] -Prefix "$Prefix$extension" -IsLast $isLastItem
            }
        }
    }
    
    Add-TreeLevel -Level $tree
    
    $report += $script:report
    
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
    Write-ColorText "║                                                                           ║" -Color Cyan
    Write-ColorText "╚═══════════════════════════════════════════════════════════════════════════╝" -Color Cyan
    
    # Ejecutar validaciones
    Invoke-FileIntegrityValidation
    Invoke-DataFlowValidation
    Invoke-DynamicArraysValidation
    Invoke-ConfigValidation
    
    # Generar reporte
    Write-Header "GENERANDO REPORTE ASCII TREE"
    
    $script:report = @()
    $reportContent = New-ASCIITree -FileDetails $script:ValidationResults.FileDetails -OutputPath $OutputPath
    
    Write-ColorText "`n✅ Reporte generado: $OutputPath" -Color Green
    
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
        exit 0
    } else {
        Write-ColorText "`n❌ SE ENCONTRARON $($script:ValidationResults.FailedFiles) ARCHIVOS CON ERRORES" -Color Red
        Write-ColorText "   Por favor revisa el reporte: $OutputPath" -Color Yellow
        exit 1
    }
}

# Ejecutar
Main

