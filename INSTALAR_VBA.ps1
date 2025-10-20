# ========================================
# ARBITRAGEXPLUS2025 - Instalador de VBA
# ========================================
#
# Este script instala automáticamente el código VBA
# en el archivo ARBITRAGEXPLUS2025.xlsm
#
# Uso: Ejecutar como administrador
# ========================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ARBITRAGEXPLUS2025" -ForegroundColor Cyan
Write-Host "  Instalador de Código VBA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Buscar el archivo Excel
$possiblePaths = @(
    "$env:USERPROFILE\Documents\ARBITRAGEXPLUS2025.xlsm",
    "$env:USERPROFILE\Downloads\ARBITRAGEXPLUS2025.xlsm",
    "$env:USERPROFILE\Desktop\ARBITRAGEXPLUS2025.xlsm",
    "D:\Downloads\ARBITRAGEXPLUS2025.xlsm",
    "C:\ARBITRAGEXPLUS2025.xlsm"
)

$excelPath = $null
foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $excelPath = $path
        break
    }
}

if ($null -eq $excelPath) {
    Write-Host "[X] ERROR: No se encontró el archivo ARBITRAGEXPLUS2025.xlsm" -ForegroundColor Red
    Write-Host ""
    Write-Host "Ubicaciones buscadas:" -ForegroundColor Yellow
    foreach ($path in $possiblePaths) {
        Write-Host "  - $path" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "Presiona cualquier tecla para salir..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
    exit 1
}

Write-Host "[OK] Archivo Excel encontrado:" -ForegroundColor Green
Write-Host "     $excelPath" -ForegroundColor White
Write-Host ""

# Leer el código VBA desde el archivo
$vbaCodePath = Join-Path $PSScriptRoot "vba-code\AutomationController.bas"

if (-not (Test-Path $vbaCodePath)) {
    Write-Host "[X] ERROR: No se encontró el archivo de código VBA" -ForegroundColor Red
    Write-Host "     Ruta esperada: $vbaCodePath" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Presiona cualquier tecla para salir..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
    exit 1
}

Write-Host "[OK] Código VBA encontrado" -ForegroundColor Green
Write-Host ""

# Crear objeto Excel
Write-Host "Abriendo Excel..." -ForegroundColor Cyan
try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
} catch {
    Write-Host "[X] ERROR: No se pudo abrir Excel" -ForegroundColor Red
    Write-Host "     $_" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Presiona cualquier tecla para salir..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
    exit 1
}

try {
    # Abrir el archivo
    Write-Host "Abriendo archivo: $excelPath" -ForegroundColor Cyan
    $workbook = $excel.Workbooks.Open($excelPath)
    
    # Leer el código VBA
    $vbaCode = Get-Content $vbaCodePath -Raw
    
    # Obtener el módulo ThisWorkbook
    $thisWorkbook = $workbook.VBProject.VBComponents.Item("ThisWorkbook")
    
    # Limpiar código existente
    Write-Host "Limpiando código VBA existente..." -ForegroundColor Cyan
    $lineCount = $thisWorkbook.CodeModule.CountOfLines
    if ($lineCount -gt 0) {
        $thisWorkbook.CodeModule.DeleteLines(1, $lineCount)
    }
    
    # Insertar el nuevo código
    Write-Host "Instalando código VBA..." -ForegroundColor Cyan
    $thisWorkbook.CodeModule.AddFromString($vbaCode)
    
    # Guardar y cerrar
    Write-Host "Guardando archivo..." -ForegroundColor Cyan
    $workbook.Save()
    $workbook.Close($false)
    
    Write-Host ""
    Write-Host "[OK] Código VBA instalado correctamente" -ForegroundColor Green
    Write-Host ""
    Write-Host "Funcionalidad instalada:" -ForegroundColor White
    Write-Host "  - Detección automática de cambios en columna NAME" -ForegroundColor Gray
    Write-Host "  - Limpieza automática de columnas PUSH (azules) cuando NAME está vacío" -ForegroundColor Gray
    Write-Host "  - Conexión con COM Bridge externo" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Próximos pasos:" -ForegroundColor Yellow
    Write-Host "  1. Abre el archivo ARBITRAGEXPLUS2025.xlsm" -ForegroundColor White
    Write-Host "  2. Habilita las macros si Excel lo solicita" -ForegroundColor White
    Write-Host "  3. Prueba escribiendo y borrando en la columna NAME" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "[X] ERROR al instalar el código VBA" -ForegroundColor Red
    Write-Host "     $_" -ForegroundColor Gray
    Write-Host ""
    
    # Verificar si el acceso a VBA está habilitado
    if ($_.Exception.Message -like '*programmatic access*') {
        Write-Host "SOLUCIÓN:" -ForegroundColor Yellow
        Write-Host "  1. Abre Excel" -ForegroundColor White
        Write-Host '  2. Ve a Archivo > Opciones > Centro de confianza' -ForegroundColor White
        Write-Host '  3. Haz clic en Configuracion del Centro de confianza' -ForegroundColor White
        Write-Host '  4. Ve a Configuracion de macros' -ForegroundColor White
        Write-Host '  5. Marca: Confiar en el acceso al modelo de objetos de proyectos de VBA' -ForegroundColor White
        Write-Host "  6. Haz clic en Aceptar y cierra Excel" -ForegroundColor White
        Write-Host "  7. Ejecuta este script de nuevo" -ForegroundColor White
        Write-Host ""
    }
} finally {
    # Cerrar Excel
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}

Write-Host "Presiona cualquier tecla para salir..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')

