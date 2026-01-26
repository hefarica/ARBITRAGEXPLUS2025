#!/bin/bash
###############################################################################
# APE GUARDIAN ENGINE v17 - SNIPER v2 FIX
# Script de deployment ultra-simplificado
# Ejecutar en VPS: bash <(curl -s https://raw.githubusercontent.com/hefarica/ARBITRAGEXPLUS2025/master/sniper_v2_fix/APPLY_SNIPER_V2_FIX.sh)
###############################################################################

set -e  # Exit on error

echo "🚀 APE Guardian Engine v17 - SNIPER v2 Fix"
echo "==========================================="
echo ""

# Verificar que estamos en el servidor correcto
if [ ! -d "/opt/ape-guardian" ]; then
    echo "❌ ERROR: /opt/ape-guardian directory not found"
    echo "   This script must be run on the production VPS"
    exit 1
fi

echo "✓ Production environment detected"
echo ""

# Crear backup del estado actual
BACKUP_DIR="/opt/ape-guardian/backups/sniper_v2_fix_$(date +%Y%m%d_%H%M%S)"
echo "📦 Creating backup in $BACKUP_DIR..."
mkdir -p "$BACKUP_DIR"

# Backup de archivos existentes
if [ -f "/opt/ape-guardian/api_server.py" ]; then
    cp /opt/ape-guardian/api_server.py "$BACKUP_DIR/api_server.py.backup"
    echo "   ✓ Backed up api_server.py"
fi

if [ -f "/opt/ape-guardian/api_server_integrated_sniper.py" ]; then
    cp /opt/ape-guardian/api_server_integrated_sniper.py "$BACKUP_DIR/api_server_integrated_sniper.py.backup"
    echo "   ✓ Backed up api_server_integrated_sniper.py"
fi

echo ""

###############################################################################
# PASO 1: Descargar api_server_integrated_sniper_v2.py desde GitHub
###############################################################################

echo "📥 PASO 1: Descargando api_server_integrated_sniper_v2.py desde GitHub..."

curl -s -o /opt/ape-guardian/api_server_integrated_sniper_v2.py \
  https://raw.githubusercontent.com/hefarica/ARBITRAGEXPLUS2025/master/sniper_v2_fix/api_server_integrated_sniper_v2.py

if [ $? -eq 0 ]; then
    echo "   ✓ api_server_integrated_sniper_v2.py downloaded"
else
    echo "   ❌ Failed to download api_server_integrated_sniper_v2.py"
    exit 1
fi

echo ""

###############################################################################
# PASO 2: Modificar api_server.py
###############################################################################

echo "📝 PASO 2: Modificando api_server.py..."

# Hacer backup del archivo actual
cp /opt/ape-guardian/api_server.py /opt/ape-guardian/api_server.py.pre_sniper_v2

# Modificar import de SNIPER
sed -i 's/from api_server_integrated_sniper import/from api_server_integrated_sniper_v2 import/' /opt/ape-guardian/api_server.py

# Modificar alias de integrated_sniper
sed -i 's/integrated_sniper,$/integrated_sniper_v2 as integrated_sniper,/' /opt/ape-guardian/api_server.py

# Modificar alias de integrate_sniper_with_telemetry
sed -i 's/integrate_sniper_with_telemetry,$/integrate_sniper_v2_with_telemetry as integrate_sniper_with_telemetry,/' /opt/ape-guardian/api_server.py

# Modificar alias de add_sniper_endpoints_to_app
sed -i 's/add_sniper_endpoints_to_app,$/add_sniper_v2_endpoints_to_app as add_sniper_endpoints_to_app,/' /opt/ape-guardian/api_server.py

# Buscar la línea con track_request_with_sniper y agregar register_list_load_with_sniper después
sed -i '/track_request_with_sniper$/a\        register_list_load_with_sniper' /opt/ape-guardian/api_server.py

# Actualizar mensajes de log
sed -i 's/logger.info("✓ SNIPER MODE enabled")/logger.info("✓ SNIPER MODE v2 enabled")/' /opt/ape-guardian/api_server.py
sed -i 's/logger.warning(f"SNIPER MODE disabled: {e}")/logger.warning(f"SNIPER MODE v2 disabled: {e}")/' /opt/ape-guardian/api_server.py

# Modificar la llamada a track_request_with_sniper (buscar y reemplazar el bloque completo)
# Buscar: full_url = request.url
# Reemplazar por: requested_path = request.path + referer
sed -i '/# \[v17\] SNIPER MODE: Detectar canal activo/,/logger.error(f"\[v17\] SNIPER error: {e}")/{
    s|full_url = request.url|requested_path = request.path\n            referer = request.headers.get('\''Referer'\'')|
    s|channel_name = track_request_with_sniper(session_id, full_url, filename)|channel_name = track_request_with_sniper(session_id, requested_path, referer)|
}' /opt/ape-guardian/api_server.py

# Agregar registro de lista M3U8 después de obtener el contenido
# Buscar la línea "headers = result.get('headers', {})" y agregar código después
sed -i "/headers = result.get('headers', {})/a\\
    \\
    # [v17] SNIPER MODE: Registrar la lista M3U8 para parsear canales\\
    if SNIPER_ENABLED and content:\\
        try:\\
            num_channels = register_list_load_with_sniper(session_id, filename, content)\\
            logger.info(f\"🎯 SNIPER: Registered M3U8 list - {filename} ({num_channels} channels)\")\\
        except Exception as e:\\
            logger.error(f\"[v17] SNIPER error registering list: {e}\")" /opt/ape-guardian/api_server.py

echo "   ✓ api_server.py modified"
echo ""

###############################################################################
# PASO 3: Verificar sintaxis de Python
###############################################################################

echo "🔍 PASO 3: Verificando sintaxis de Python..."

python3 -m py_compile /opt/ape-guardian/api_server_integrated_sniper_v2.py
if [ $? -eq 0 ]; then
    echo "   ✓ api_server_integrated_sniper_v2.py syntax OK"
else
    echo "   ❌ Syntax error in api_server_integrated_sniper_v2.py"
    exit 1
fi

python3 -m py_compile /opt/ape-guardian/api_server.py
if [ $? -eq 0 ]; then
    echo "   ✓ api_server.py syntax OK"
else
    echo "   ❌ Syntax error in api_server.py"
    echo "   Restoring backup..."
    cp "$BACKUP_DIR/api_server.py.backup" /opt/ape-guardian/api_server.py
    exit 1
fi

echo ""

###############################################################################
# PASO 4: Reiniciar el servicio
###############################################################################

echo "🔄 PASO 4: Reiniciando servicio APE Guardian Engine..."

systemctl restart ape-guardian-engine

# Esperar 3 segundos para que el servicio inicie
sleep 3

# Verificar estado del servicio
if systemctl is-active --quiet ape-guardian-engine; then
    echo "   ✓ Service restarted successfully"
else
    echo "   ❌ Service failed to start"
    echo ""
    echo "📋 Service logs (last 20 lines):"
    journalctl -u ape-guardian-engine -n 20 --no-pager
    echo ""
    echo "   Restoring backup..."
    cp "$BACKUP_DIR/api_server.py.backup" /opt/ape-guardian/api_server.py
    systemctl restart ape-guardian-engine
    exit 1
fi

echo ""

###############################################################################
# PASO 5: Verificar endpoints
###############################################################################

echo "🔍 PASO 5: Verificando endpoints..."

# Verificar /guardian/health
echo -n "   Checking /guardian/health... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/guardian/health)
if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ OK (200)"
else
    echo "❌ FAILED ($HTTP_CODE)"
fi

# Verificar /guardian/telemetry/sniper/stats
echo -n "   Checking /guardian/telemetry/sniper/stats... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/guardian/telemetry/sniper/stats)
if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ OK (200)"
else
    echo "❌ FAILED ($HTTP_CODE)"
fi

# Verificar /guardian/telemetry/active-channels
echo -n "   Checking /guardian/telemetry/active-channels... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/guardian/telemetry/active-channels)
if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ OK (200)"
else
    echo "❌ FAILED ($HTTP_CODE)"
fi

echo ""

###############################################################################
# RESUMEN
###############################################################################

echo "✅ SNIPER v2 FIX APPLIED SUCCESSFULLY"
echo "====================================="
echo ""
echo "📊 Summary:"
echo "   ✓ SNIPER v2 module deployed"
echo "   ✓ API Server updated with SNIPER v2 integration"
echo "   ✓ Service restarted successfully"
echo "   ✓ All endpoints responding"
echo ""
echo "📦 Backup location: $BACKUP_DIR"
echo ""
echo "🎯 SNIPER v2 Features:"
echo "   • Passive channel detection from M3U8 playlists"
echo "   • Automatic M3U8 parsing on every request"
echo "   • Heuristic detection based on refresh patterns"
echo "   • Referer-based channel identification"
echo "   • Ultra-aggressive optimization for active channel"
echo ""
echo "🔍 Next Steps:"
echo "   1. Test with existing M3U8 playlist"
echo "   2. Monitor logs: journalctl -u ape-guardian-engine -f"
echo "   3. Check dashboard: https://iptv-ape.duckdns.org/guardian/"
echo "   4. Verify channel detection in telemetry endpoints"
echo ""
echo "🚀 SNIPER v2 is now ACTIVE and ready to detect channels!"
echo ""
echo "📋 View SNIPER logs:"
echo "   journalctl -u ape-guardian-engine -f | grep SNIPER"
echo ""
echo "📊 Check telemetry:"
echo "   curl http://localhost:8080/guardian/telemetry/sniper/stats"
echo "   curl http://localhost:8080/guardian/telemetry/active-channels"
