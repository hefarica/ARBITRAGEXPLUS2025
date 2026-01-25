# APE Guardian Engine v15

**Versión:** 15.0.0
**Autor:** Manus AI
**Fecha:** 2026-01-25

## 1. Resumen Ejecutivo

APE Guardian Engine v15 es un sistema de streaming de bitrate adaptativo (ABR) de última generación, diseñado para ofrecer la máxima calidad de video posible sin interrupciones, buffering o congelamiento. El sistema se integra de forma transparente en arquitecturas de IPTV existentes y utiliza un motor de machine learning para optimizar la entrega de contenido en tiempo real.

El Guardian Engine actúa como un proxy inteligente entre el cliente y el servidor de contenido, interceptando las solicitudes de manifiestos M3U8 y aplicando una serie de optimizaciones avanzadas antes de entregar el contenido al reproductor. Esto se logra a través de la inyección de más de 165 cabeceras HTTP dinámicas, la selección de perfiles de calidad adaptativos y un sistema de recuperación de errores robusto.

## 2. Arquitectura del Sistema

La arquitectura del APE Guardian Engine se compone de los siguientes elementos:

- **Nginx (Web Server):** Actúa como reverse proxy, sirviendo archivos estáticos y enrutando las peticiones del Guardian Engine a su servicio correspondiente.
- **PHP (Upload System):** Gestiona la subida de archivos M3U8 mediante un sistema de chunks, asegurando la integridad de los archivos grandes.
- **APE Guardian Engine (Python/Flask):** El núcleo del sistema. Un servicio en Python que corre sobre Flask y se encarga de toda la lógica de ABR.
- **JWT (Autenticación):** La comunicación y configuración del Guardian Engine se controla mediante JSON Web Tokens, permitiendo una integración segura y flexible.

### Flujo de la Petición

1.  **Petición del Cliente:** El reproductor del cliente solicita un manifiesto M3U8 a través de una URL especial que apunta al Guardian Engine (ej: `https://iptv-ape.duckdns.org/guardian/lista.m3u8?t=JWT_TOKEN`).
2.  **Validación de JWT:** El Guardian Engine valida el token JWT. Si el token es inválido, la petición es rechazada. Si es válido, se extrae la configuración (perfil, bitrate, etc.).
3.  **Creación de Sesión:** Se crea una sesión única para el usuario, almacenando su configuración y estado.
4.  **Motor ABR (ARBITER+):** El algoritmo ARBITER+ analiza 7 factores en tiempo real para seleccionar el perfil de calidad óptimo:
    - Ancho de banda disponible
    - Nivel de buffer del reproductor
    - Resolución de pantalla
    - Capacidad del reproductor
    - Calidad del servidor de origen
    - Pérdida de paquetes
    - Latencia
5.  **Inyección de Cabeceras:** Se inyectan más de 165 cabeceras HTTP dinámicas en la respuesta para controlar el comportamiento del reproductor y la red.
6.  **Entrega del Manifiesto:** El Guardian Engine entrega el manifiesto M3U8 modificado al cliente.

## 3. Características Principales

| Característica | Descripción |
| :--- | :--- |
| **Motor ABR ARBITER+** | Algoritmo de selección de perfil basado en 7 factores para una adaptación precisa y en tiempo real. |
| **6 Perfiles Adaptativos (P0-P5)** | Perfiles preconfigurados para diferentes escenarios, desde "Ultra Extreme" (P0) hasta "Bajo Consumo" (P5). |
| **Hysteresis Controller** | Evita cambios de calidad bruscos (anti-flapping), permitiendo un failover rápido (<1s) y un failback estable (60s). |
| **Motor de Recuperación de Errores** | Maneja 43 códigos de error HTTP (400-511) con estrategias de reintento, backoff y fallback a CDN. |
| **Inyector de 165+ Cabeceras** | Control granular sobre el reproductor, la red y el cache para una optimización máxima. |
| **Predictor de Ancho de Banda (GRU)** | Utiliza un modelo de Machine Learning (Gated Recurrent Unit) para predecir el ancho de banda futuro y tomar decisiones proactivas. |
| **Autenticación JWT** | Integración segura y flexible mediante JSON Web Tokens. |
| **Telemetría en Tiempo Real** | Recopilación de micro-snapshots (100ms) y macro-agregados (10s) para un monitoreo detallado (próximamente con WebSocket). |

## 4. Instalación y Despliegue

### Requisitos

- Servidor Ubuntu 22.04 o superior
- Nginx
- Python 3.10 o superior
- PHP-FPM

### Pasos de Despliegue

1.  **Clonar el Repositorio:**

    ```bash
    git clone https://github.com/hefarica/ARBITRAGEXPLUS2025.git /opt/ape-guardian
    ```

2.  **Instalar Dependencias:**

    ```bash
    cd /opt/ape-guardian
    pip3 install --break-system-packages -r requirements.txt
    ```

3.  **Configurar Nginx:**

    Copiar el archivo de configuración de Nginx (`nginx/default`) a `/etc/nginx/sites-available/default` y reiniciar Nginx.

4.  **Configurar Servicio systemd:**

    Copiar el archivo de servicio (`systemd/ape-guardian-engine.service`) a `/etc/systemd/system/` y habilitar e iniciar el servicio.

    ```bash
    systemctl daemon-reload
    systemctl enable ape-guardian-engine
    systemctl start ape-guardian-engine
    ```

5.  **Verificar la Instalación:**

    ```bash
    curl https://iptv-ape.duckdns.org/guardian/health
    ```

    Debería obtener una respuesta JSON con el estado `healthy`.

## 5. Contribuciones

El proyecto APE Guardian Engine es de código abierto y las contribuciones son bienvenidas. Por favor, abra un issue o un pull request en el repositorio de GitHub para discutir cualquier cambio.
