#!/bin/bash
###############################################################################
# APE GUARDIAN ENGINE v17 - SNIPER v2 SIMPLE FIX
# Solución simple: Reemplazar api_server_integrated_sniper.py con versión v2
###############################################################################

set -e

echo "🚀 APE Guardian Engine v17 - SNIPER v2 Simple Fix"
echo "=================================================="
echo ""

# Verificar directorio
if [ ! -d "/opt/ape-guardian" ]; then
    echo "❌ ERROR: /opt/ape-guardian not found"
    exit 1
fi

echo "✓ Production environment detected"
echo ""

# Crear backup
BACKUP_DIR="/opt/ape-guardian/backups/sniper_v2_simple_$(date +%Y%m%d_%H%M%S)"
echo "📦 Creating backup in $BACKUP_DIR..."
mkdir -p "$BACKUP_DIR"

if [ -f "/opt/ape-guardian/api_server_integrated_sniper.py" ]; then
    cp /opt/ape-guardian/api_server_integrated_sniper.py "$BACKUP_DIR/api_server_integrated_sniper.py.backup"
    echo "   ✓ Backed up api_server_integrated_sniper.py"
fi

echo ""

# Descargar versión v2 desde GitHub
echo "📥 Downloading SNIPER v2 from GitHub..."
curl -s -o /opt/ape-guardian/api_server_integrated_sniper_v2.py \
  https://raw.githubusercontent.com/hefarica/ARBITRAGEXPLUS2025/master/sniper_v2_fix/api_server_integrated_sniper_v2.py

if [ $? -ne 0 ]; then
    echo "❌ Failed to download"
    exit 1
fi

echo "   ✓ Downloaded api_server_integrated_sniper_v2.py"
echo ""

# Reemplazar el archivo v1 con v2 (mismo nombre)
echo "🔄 Replacing api_server_integrated_sniper.py with v2..."
cp /opt/ape-guardian/api_server_integrated_sniper_v2.py /opt/ape-guardian/api_server_integrated_sniper.py

echo "   ✓ File replaced"
echo ""

# Verificar sintaxis
echo "🔍 Verifying Python syntax..."
python3 -m py_compile /opt/ape-guardian/api_server_integrated_sniper.py

if [ $? -eq 0 ]; then
    echo "   ✓ Syntax OK"
else
    echo "   ❌ Syntax error"
    cp "$BACKUP_DIR/api_server_integrated_sniper.py.backup" /opt/ape-guardian/api_server_integrated_sniper.py
    exit 1
fi

echo ""

# Reiniciar servicio
echo "🔄 Restarting service..."
systemctl restart ape-guardian-engine
sleep 3

if systemctl is-active --quiet ape-guardian-engine; then
    echo "   ✓ Service restarted successfully"
else
    echo "   ❌ Service failed to start"
    journalctl -u ape-guardian-engine -n 20 --no-pager
    cp "$BACKUP_DIR/api_server_integrated_sniper.py.backup" /opt/ape-guardian/api_server_integrated_sniper.py
    systemctl restart ape-guardian-engine
    exit 1
fi

echo ""

# Verificar endpoints
echo "🔍 Verifying endpoints..."

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/guardian/health)
echo "   /guardian/health: $HTTP_CODE"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/guardian/telemetry/sniper/stats)
echo "   /guardian/telemetry/sniper/stats: $HTTP_CODE"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/guardian/telemetry/active-channels)
echo "   /guardian/telemetry/active-channels: $HTTP_CODE"

echo ""
echo "✅ SNIPER v2 SIMPLE FIX COMPLETED"
echo "================================="
echo ""
echo "📦 Backup: $BACKUP_DIR"
echo ""
echo "🎯 SNIPER v2 Features:"
echo "   • track_request_with_sniper() function added"
echo "   • register_list_load_with_sniper() function added"
echo "   • integrate_sniper_v2_with_telemetry() function added"
echo "   • M3U8 parsing on every request"
echo "   • Heuristic channel detection"
echo "   • Referer-based detection"
echo ""
echo "🔍 Monitor logs:"
echo "   journalctl -u ape-guardian-engine -f | grep SNIPER"
echo ""
echo "📊 Check telemetry:"
echo "   curl http://localhost:8080/guardian/telemetry/sniper/stats"
echo ""
echo "🚀 SNIPER v2 is now ACTIVE!"
