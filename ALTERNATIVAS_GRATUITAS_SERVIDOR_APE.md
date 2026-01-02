# 🆓 ALTERNATIVAS GRATUITAS PARA EJECUTAR SERVIDOR APE

## 🎯 OBJETIVO

Ejecutar el servidor APE **sin costo** usando servicios gratuitos o ejecutándolo localmente en tu propio dispositivo.

---

## 📊 COMPARACIÓN RÁPIDA

| Opción | Costo | Complejidad | Latencia | Recomendado Para |
|--------|-------|-------------|----------|------------------|
| **Oracle Cloud (Always Free)** | $0 | Media | Baja | ✅ Mejor opción |
| **Render.com (Free Tier)** | $0 | Baja | Media | ✅ Fácil setup |
| **Railway.app (Free Tier)** | $0 | Baja | Media | ✅ Fácil setup |
| **Fly.io (Free Tier)** | $0 | Media | Baja | Buena opción |
| **Google Cloud Run** | $0* | Media | Baja | Buena opción |
| **Tu PC/Laptop Local** | $0 | Baja | Muy Baja | ✅ Si está siempre encendido |
| **Android TV (Termux)** | $0 | Alta | Muy Baja | ✅ **MEJOR: Mismo dispositivo** |
| **Raspberry Pi** | ~$35 | Media | Muy Baja | Si ya tienes uno |

---

## 🏆 OPCIÓN 1: ORACLE CLOUD (ALWAYS FREE) - **RECOMENDADA**

### **✅ Ventajas:**
- **100% gratis para siempre** (no expira)
- 2 VMs con 1GB RAM cada una
- 200 GB de almacenamiento
- 10 TB de transferencia mensual
- IP pública estática

### **❌ Desventajas:**
- Requiere tarjeta de crédito (no cobra)
- Setup inicial más complejo

### **📋 Pasos:**

1. **Crear cuenta:** https://www.oracle.com/cloud/free/
2. **Crear VM:**
   - Compute → Instances → Create Instance
   - Shape: VM.Standard.E2.1.Micro (Always Free)
   - Image: Ubuntu 22.04
   - Networking: Crear VCN nueva
3. **Abrir puerto 8080:**
   - Networking → Virtual Cloud Networks → Security Lists
   - Ingress Rules → Add Rule
   - Source CIDR: 0.0.0.0/0
   - Destination Port: 8080
4. **Conectar por SSH:**
   ```bash
   ssh ubuntu@<IP_PUBLICA>
   ```
5. **Instalar servidor APE:**
   ```bash
   sudo bash install_ape_server.sh
   ```

**IP pública:** La VM tendrá una IP pública fija que puedes usar en el M3U8.

---

## 🚀 OPCIÓN 2: RENDER.COM (FREE TIER) - **MÁS FÁCIL**

### **✅ Ventajas:**
- **Setup en 5 minutos**
- Deploy automático desde GitHub
- HTTPS gratis
- No requiere tarjeta

### **❌ Desventajas:**
- Se duerme después de 15 min de inactividad (tarda 30s en despertar)
- 750 horas/mes gratis (suficiente para 1 servicio 24/7)

### **📋 Pasos:**

1. **Crear cuenta:** https://render.com/
2. **Conectar GitHub:** Settings → Connect GitHub
3. **Crear Web Service:**
   - New → Web Service
   - Connect Repository: `hefarica/ARBITRAGEXPLUS2025`
   - Name: `ape-server`
   - Environment: `Python 3`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `python3 ape_server_serverside.py`
4. **Variables de entorno:**
   - IPTV_USER: `3JHFTC`
   - IPTV_PASS: `U56BDP`
   - SECRET_KEY: `tu_secret_key`
5. **Deploy:** Click "Create Web Service"

**URL:** `https://ape-server.onrender.com` (usar en M3U8)

**Nota:** El servicio se duerme después de 15 min sin uso, pero despierta automáticamente al recibir una request (tarda ~30s la primera vez).

---

## ⚡ OPCIÓN 3: RAILWAY.APP (FREE TIER)

### **✅ Ventajas:**
- Deploy desde GitHub en 2 clics
- $5 de crédito gratis/mes (suficiente para uso ligero)
- No se duerme

### **❌ Desventajas:**
- Requiere tarjeta de crédito (no cobra si no superas $5/mes)
- Después de $5, cobra por uso

### **📋 Pasos:**

1. **Crear cuenta:** https://railway.app/
2. **New Project → Deploy from GitHub**
3. **Seleccionar:** `hefarica/ARBITRAGEXPLUS2025`
4. **Variables:**
   - IPTV_USER: `3JHFTC`
   - IPTV_PASS: `U56BDP`
   - SECRET_KEY: `tu_secret_key`
5. **Deploy automático**

**URL:** `https://ape-server-production.up.railway.app`

---

## 🌐 OPCIÓN 4: FLY.IO (FREE TIER)

### **✅ Ventajas:**
- 3 VMs gratis
- 160 GB de transferencia/mes
- Deploy global

### **❌ Desventajas:**
- Requiere tarjeta de crédito
- CLI más complejo

### **📋 Pasos:**

1. **Instalar CLI:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```
2. **Login:**
   ```bash
   fly auth login
   ```
3. **Deploy:**
   ```bash
   fly launch
   ```

---

## 💻 OPCIÓN 5: TU PC/LAPTOP LOCAL - **LATENCIA CERO**

### **✅ Ventajas:**
- **Latencia mínima** (mismo WiFi)
- Control total
- No requiere cuenta externa

### **❌ Desventajas:**
- PC debe estar siempre encendido
- Requiere configurar router (port forwarding)

### **📋 Pasos:**

1. **Instalar servidor en tu PC:**
   ```bash
   sudo bash install_ape_server.sh
   ```

2. **Obtener IP local:**
   ```bash
   ip addr show | grep inet
   # O en Windows: ipconfig
   ```
   Ejemplo: `192.168.1.100`

3. **Configurar M3U8:**
   ```
   APE_SERVER_URL = "http://192.168.1.100:8080"
   ```

4. **Usar en OTT Navigator:**
   - Si el dispositivo está en el **mismo WiFi**, funciona directamente
   - Si quieres acceso desde fuera, configura **port forwarding** en tu router

**Port Forwarding (opcional):**
1. Acceder a tu router: `http://192.168.1.1`
2. Port Forwarding → Add Rule
3. External Port: 8080
4. Internal IP: 192.168.1.100
5. Internal Port: 8080

---

## 📱 OPCIÓN 6: ANDROID TV (TERMUX) - **¡MISMO DISPOSITIVO!** ⭐

### **✅ Ventajas:**
- **LATENCIA CERO** (localhost)
- No requiere servidor externo
- No requiere port forwarding
- **Ejecuta en el mismo dispositivo que OTT Navigator**

### **❌ Desventajas:**
- Requiere instalar Termux
- Consume RAM del dispositivo

### **📋 Pasos:**

1. **Instalar Termux:**
   - Descargar desde F-Droid: https://f-droid.org/en/packages/com.termux/
   - O APK directo: https://github.com/termux/termux-app/releases

2. **Abrir Termux e instalar dependencias:**
   ```bash
   pkg update
   pkg install python redis
   pip install flask redis requests pyjwt
   ```

3. **Copiar servidor APE:**
   ```bash
   # Descargar desde GitHub
   curl -O https://raw.githubusercontent.com/hefarica/ARBITRAGEXPLUS2025/master/ape_server_serverside.py
   ```

4. **Editar configuración:**
   ```bash
   nano ape_server_serverside.py
   # Cambiar credenciales IPTV y secret key
   ```

5. **Iniciar Redis:**
   ```bash
   redis-server &
   ```

6. **Iniciar servidor APE:**
   ```bash
   python3 ape_server_serverside.py
   ```

7. **Configurar M3U8:**
   ```
   APE_SERVER_URL = "http://localhost:8080"
   # O: "http://127.0.0.1:8080"
   ```

8. **Usar en OTT Navigator:**
   - El servidor corre en el mismo dispositivo
   - URLs: `http://localhost:8080/stream/...`

**Mantener corriendo en segundo plano:**
```bash
# Instalar screen
pkg install screen

# Crear sesión
screen -S ape-server

# Iniciar servidor
python3 ape_server_serverside.py

# Detach: Ctrl+A, luego D
# Reattach: screen -r ape-server
```

---

## 🍓 OPCIÓN 7: RASPBERRY PI

Si ya tienes una Raspberry Pi:

```bash
# Instalar servidor
sudo bash install_ape_server.sh

# Obtener IP
hostname -I

# Usar IP en M3U8
APE_SERVER_URL = "http://192.168.1.50:8080"
```

---

## ☁️ OPCIÓN 8: GOOGLE CLOUD RUN (FREE TIER)

### **✅ Ventajas:**
- 2 millones de requests/mes gratis
- Escala automáticamente
- HTTPS gratis

### **❌ Desventajas:**
- Requiere tarjeta de crédito
- Setup más complejo (Docker)

### **📋 Pasos:**

1. **Crear Dockerfile:**
   ```dockerfile
   FROM python:3.11-slim
   WORKDIR /app
   COPY requirements.txt .
   RUN pip install -r requirements.txt
   COPY ape_server_serverside.py .
   CMD ["python3", "ape_server_serverside.py"]
   ```

2. **Deploy:**
   ```bash
   gcloud run deploy ape-server \
     --source . \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

---

## 🎯 RECOMENDACIÓN FINAL

### **Para uso personal (1-5 dispositivos):**
✅ **OPCIÓN 6: Android TV (Termux)** - Ejecuta en el mismo dispositivo, latencia cero

### **Para acceso remoto (fuera de casa):**
✅ **OPCIÓN 1: Oracle Cloud** - Gratis para siempre, IP pública fija

### **Para setup rápido:**
✅ **OPCIÓN 2: Render.com** - Deploy en 5 minutos desde GitHub

---

## 📊 COMPARACIÓN DE LATENCIA

| Opción | Latencia Estimada |
|--------|-------------------|
| Android TV (localhost) | **< 1 ms** ⭐ |
| PC Local (mismo WiFi) | **1-5 ms** |
| Raspberry Pi (mismo WiFi) | **1-5 ms** |
| Oracle Cloud | **20-50 ms** |
| Render.com | **50-100 ms** |
| Railway.app | **50-100 ms** |
| Fly.io | **20-50 ms** |

---

## 🚀 PRÓXIMOS PASOS

**¿Cuál opción te interesa más?**

1. **Android TV (Termux)** → Te preparo script de instalación automatizada
2. **Oracle Cloud** → Te guío paso a paso en el setup
3. **Render.com** → Te preparo el repositorio para deploy automático
4. **PC Local** → Te ayudo con la configuración

**¿Cuál prefieres?**
