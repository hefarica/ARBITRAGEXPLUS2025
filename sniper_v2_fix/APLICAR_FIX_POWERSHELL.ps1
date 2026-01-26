# APE Guardian Engine v17 - SNIPER v2 Fix
# Ejecutar en PowerShell

Write-Host "🚀 APE Guardian Engine v17 - SNIPER v2 Fix" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Paso 1: Crear backup
Write-Host "📦 Paso 1: Creando backup..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no root@178.156.147.234 "mkdir -p /opt/ape-guardian/backups/sniper_v2_manus_fix && cp /opt/ape-guardian/api_server_integrated_sniper.py /opt/ape-guardian/backups/sniper_v2_manus_fix/api_server_integrated_sniper.py.backup && echo 'Backup creado'"

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ Backup creado exitosamente" -ForegroundColor Green
} else {
    Write-Host "   ❌ Error creando backup" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Paso 2: Descargar archivo v2 desde GitHub
Write-Host "📥 Paso 2: Descargando archivo v2 desde GitHub..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no root@178.156.147.234 "curl -s -o /opt/ape-guardian/api_server_integrated_sniper_v2.py https://raw.githubusercontent.com/hefarica/ARBITRAGEXPLUS2025/master/sniper_v2_fix/api_server_integrated_sniper_v2.py && echo 'Descargado'"

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ Archivo descargado exitosamente" -ForegroundColor Green
} else {
    Write-Host "   ❌ Error descargando archivo" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Paso 3: Reemplazar archivo viejo con v2
Write-Host "🔄 Paso 3: Reemplazando archivo..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no root@178.156.147.234 "cp /opt/ape-guardian/api_server_integrated_sniper_v2.py /opt/ape-guardian/api_server_integrated_sniper.py && echo 'Reemplazado'"

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ Archivo reemplazado exitosamente" -ForegroundColor Green
} else {
    Write-Host "   ❌ Error reemplazando archivo" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Paso 4: Verificar sintaxis
Write-Host "🔍 Paso 4: Verificando sintaxis..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no root@178.156.147.234 "python3 -m py_compile /opt/ape-guardian/api_server_integrated_sniper.py && echo 'Sintaxis OK'"

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ Sintaxis verificada" -ForegroundColor Green
} else {
    Write-Host "   ❌ Error de sintaxis" -ForegroundColor Red
    Write-Host "   Restaurando backup..." -ForegroundColor Yellow
    ssh -o StrictHostKeyChecking=no root@178.156.147.234 "cp /opt/ape-guardian/backups/sniper_v2_manus_fix/api_server_integrated_sniper.py.backup /opt/ape-guardian/api_server_integrated_sniper.py"
    exit 1
}

Write-Host ""

# Paso 5: Reiniciar servicio
Write-Host "🔄 Paso 5: Reiniciando servicio..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no root@178.156.147.234 "systemctl restart ape-guardian-engine && sleep 3 && systemctl is-active ape-guardian-engine"

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ Servicio reiniciado exitosamente" -ForegroundColor Green
} else {
    Write-Host "   ❌ Error reiniciando servicio" -ForegroundColor Red
    Write-Host "   Ver logs:" -ForegroundColor Yellow
    ssh -o StrictHostKeyChecking=no root@178.156.147.234 "journalctl -u ape-guardian-engine -n 20 --no-pager"
    exit 1
}

Write-Host ""

# Paso 6: Verificar endpoints
Write-Host "🔍 Paso 6: Verificando endpoints..." -ForegroundColor Yellow

$health = ssh -o StrictHostKeyChecking=no root@178.156.147.234 "curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/guardian/health"
Write-Host "   /guardian/health: $health" -ForegroundColor $(if ($health -eq "200") { "Green" } else { "Red" })

$sniper_stats = ssh -o StrictHostKeyChecking=no root@178.156.147.234 "curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/guardian/telemetry/sniper/stats"
Write-Host "   /guardian/telemetry/sniper/stats: $sniper_stats" -ForegroundColor $(if ($sniper_stats -eq "200") { "Green" } else { "Red" })

$active_channels = ssh -o StrictHostKeyChecking=no root@178.156.147.234 "curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/guardian/telemetry/active-channels"
Write-Host "   /guardian/telemetry/active-channels: $active_channels" -ForegroundColor $(if ($active_channels -eq "200") { "Green" } else { "Red" })

Write-Host ""
Write-Host "✅ SNIPER v2 FIX COMPLETADO EXITOSAMENTE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "🎯 Funciones agregadas:" -ForegroundColor Cyan
Write-Host "   • track_request_with_sniper()" -ForegroundColor White
Write-Host "   • register_list_load_with_sniper()" -ForegroundColor White
Write-Host "   • integrate_sniper_v2_with_telemetry()" -ForegroundColor White
Write-Host "   • Parseo automático de M3U8" -ForegroundColor White
Write-Host "   • Detección heurística de canales" -ForegroundColor White
Write-Host "   • Detección por Referer" -ForegroundColor White
Write-Host ""
Write-Host "🔍 Verificar logs:" -ForegroundColor Cyan
Write-Host "   ssh -o StrictHostKeyChecking=no root@178.156.147.234 `"journalctl -u ape-guardian-engine -f | grep SNIPER`"" -ForegroundColor White
Write-Host ""
Write-Host "📊 Verificar telemetría:" -ForegroundColor Cyan
Write-Host "   ssh -o StrictHostKeyChecking=no root@178.156.147.234 `"curl -s http://localhost:8080/guardian/telemetry/sniper/stats`"" -ForegroundColor White
Write-Host ""
Write-Host "🚀 SNIPER v2 está ACTIVO y listo para detectar canales!" -ForegroundColor Green
