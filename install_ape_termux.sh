#!/data/data/com.termux/files/usr/bin/bash
# Script de instalación del servidor APE en Android TV (Termux)

set -e

echo "🚀 Instalando APE Server v9.0 en Android TV (Termux)..."
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0;33m' # No Color

# ═══════════════════════════════════════════════════════════════════════════
# PASO 1: Actualizar paquetes
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}📦 Actualizando paquetes...${NC}"
pkg update -y
pkg upgrade -y
echo -e "${GREEN}✅ Paquetes actualizados${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# PASO 2: Instalar Python y dependencias
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}🐍 Instalando Python y dependencias...${NC}"
pkg install -y python redis
echo -e "${GREEN}✅ Python instalado${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# PASO 3: Instalar dependencias Python
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}📚 Instalando dependencias Python...${NC}"
pip install flask redis requests pyjwt
echo -e "${GREEN}✅ Dependencias instaladas${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# PASO 4: Crear directorio de trabajo
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}📁 Creando directorio de trabajo...${NC}"
mkdir -p ~/ape-server
cd ~/ape-server
echo -e "${GREEN}✅ Directorio creado: ~/ape-server${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# PASO 5: Descargar servidor APE desde GitHub
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}📥 Descargando servidor APE...${NC}"
curl -o ape_server_serverside.py https://raw.githubusercontent.com/hefarica/ARBITRAGEXPLUS2025/master/ape_server_serverside.py
chmod +x ape_server_serverside.py
echo -e "${GREEN}✅ Servidor descargado${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# PASO 6: Configurar credenciales
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}🔐 Configuración de credenciales${NC}"
echo ""
read -p "Usuario IPTV (actual: 3JHFTC): " IPTV_USER
IPTV_USER=${IPTV_USER:-3JHFTC}

read -p "Password IPTV (actual: U56BDP): " IPTV_PASS
IPTV_PASS=${IPTV_PASS:-U56BDP}

read -p "Secret Key JWT (dejar vacío para generar): " SECRET_KEY
if [ -z "$SECRET_KEY" ]; then
    # Generar secret key aleatoria
    SECRET_KEY=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
    echo -e "${GREEN}✅ Secret Key generada: $SECRET_KEY${NC}"
fi

# Actualizar archivo
sed -i "s/IPTV_USER = \"3JHFTC\"/IPTV_USER = \"$IPTV_USER\"/" ape_server_serverside.py
sed -i "s/IPTV_PASS = \"U56BDP\"/IPTV_PASS = \"$IPTV_PASS\"/" ape_server_serverside.py
sed -i "s/SECRET_KEY = 'ape_v9_secret_key_change_in_production'/SECRET_KEY = '$SECRET_KEY'/" ape_server_serverside.py

echo -e "${GREEN}✅ Credenciales configuradas${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# PASO 7: Crear scripts de utilidad
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}📝 Creando scripts de utilidad...${NC}"

# Script para iniciar servidor
cat > start.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
echo "🚀 Iniciando APE Server..."
cd ~/ape-server

# Iniciar Redis en segundo plano
redis-server --daemonize yes

# Esperar a que Redis esté listo
sleep 2

# Iniciar servidor APE
python3 ape_server_serverside.py
EOF

chmod +x start.sh

# Script para detener servidor
cat > stop.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
echo "🛑 Deteniendo APE Server..."

# Detener servidor APE
pkill -f ape_server_serverside.py

# Detener Redis
redis-cli shutdown

echo "✅ Servidor detenido"
EOF

chmod +x stop.sh

# Script para ver logs
cat > logs.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
echo "📊 APE Server Logs (Ctrl+C para salir)"
echo "════════════════════════════════════════"
tail -f ~/ape-server/ape_server.log
EOF

chmod +x logs.sh

# Script para ver stats
cat > stats.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
echo "📈 APE Server Stats"
echo "══════════════════════════════════════"
echo ""

# Estado de Redis
echo "🔹 Estado de Redis:"
redis-cli ping
echo ""

# Sesiones activas
echo "🔹 Sesiones Activas:"
redis-cli KEYS "session:*" | wc -l
echo ""

# Procesos
echo "🔹 Procesos:"
ps aux | grep -E "(redis|ape_server)" | grep -v grep
EOF

chmod +x stats.sh

echo -e "${GREEN}✅ Scripts creados${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# PASO 8: Crear servicio con screen (opcional)
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}📺 Instalando screen (para ejecutar en segundo plano)...${NC}"
pkg install -y screen
echo -e "${GREEN}✅ Screen instalado${NC}"
echo ""

# Script para iniciar en screen
cat > start_background.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
echo "🚀 Iniciando APE Server en segundo plano..."

# Iniciar Redis
redis-server --daemonize yes
sleep 2

# Iniciar servidor APE en screen
screen -dmS ape-server bash -c "cd ~/ape-server && python3 ape_server_serverside.py"

echo "✅ Servidor iniciado en segundo plano"
echo ""
echo "Para ver logs: screen -r ape-server"
echo "Para salir de screen: Ctrl+A, luego D"
EOF

chmod +x start_background.sh

echo -e "${GREEN}✅ Script de background creado${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# PASO 9: Crear archivo de configuración
# ═══════════════════════════════════════════════════════════════════════════

cat > config.txt << EOF
════════════════════════════════════════════════════════════════
APE SERVER v9.0 - CONFIGURACIÓN
════════════════════════════════════════════════════════════════

Usuario IPTV: $IPTV_USER
Password IPTV: $IPTV_PASS
Secret Key: $SECRET_KEY

URL del servidor: http://localhost:8080
URL alternativa: http://127.0.0.1:8080

════════════════════════════════════════════════════════════════
EOF

echo -e "${GREEN}✅ Configuración guardada en config.txt${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# RESUMEN FINAL
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo "════════════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ INSTALACIÓN COMPLETADA${NC}"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "📊 Información del Servidor:"
echo "   - URL: http://localhost:8080"
echo "   - Usuario IPTV: $IPTV_USER"
echo "   - Password IPTV: $IPTV_PASS"
echo "   - Secret Key: $SECRET_KEY"
echo ""
echo "🔧 Comandos Útiles:"
echo "   - Iniciar:         ~/ape-server/start.sh"
echo "   - Iniciar (bg):    ~/ape-server/start_background.sh"
echo "   - Detener:         ~/ape-server/stop.sh"
echo "   - Ver logs:        ~/ape-server/logs.sh"
echo "   - Ver stats:       ~/ape-server/stats.sh"
echo ""
echo "🌐 Configurar M3U8:"
echo "   APE_SERVER_URL = \"http://localhost:8080\""
echo "   SECRET_KEY = \"$SECRET_KEY\""
echo ""
echo "📚 Archivos:"
echo "   - Servidor: ~/ape-server/ape_server_serverside.py"
echo "   - Config: ~/ape-server/config.txt"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo -e "${GREEN}🎉 ¡APE Server está listo para usar!${NC}"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Para iniciar el servidor ahora:"
echo "   cd ~/ape-server"
echo "   ./start_background.sh"
echo ""
