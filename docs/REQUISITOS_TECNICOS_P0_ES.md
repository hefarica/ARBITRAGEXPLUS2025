# Requisitos Técnicos para Mejoras de Prioridad Crítica (P0)

Este documento compila los **requisitos técnicos detallados** para las mejoras y elementos faltantes clasificados como prioridad crítica (`P0`) en el proyecto ARBITRAGEXPLUS‑IIII. Cumplir estos puntos es indispensable para establecer una base sólida, segura y funcional antes de abordar tareas de prioridad mayor.

## 1. Reestructuración de la Raíz del Monorepo

El paquete original contenía una carpeta anidada con el mismo nombre del repositorio. Esta estructura impedía que Fly.io y los workflows de CI/CD encontraran los archivos esenciales. Los pasos técnicos son【447051377897297†L10-L27】:

* **Acción:** Mover todo el contenido de `ARBITRAGEXPLUS-IIII/ARBITRAGEXPLUS-IIII/` a la raíz del repositorio (`ARBITRAGEXPLUS-IIII/`).
* **Verificación:** Tras la reestructuración, archivos como `fly.toml`, `README.md`, `.gitignore`, `services/`, `rust-core/` y similares deben ser accesibles desde la raíz【447051377897297†L18-L25】.
* **Impacto:** Habilita el correcto funcionamiento de los scripts de CI/CD y el despliegue en Fly.io【447051377897297†L27-L29】.

## 2. Creación de Carpetas y Archivos Faltantes

Para implementar la arquitectura modular propuesta, es necesario crear directorios y archivos placeholder en cada módulo. Los requisitos principales son【447051377897297†L30-L64】:

* **Estructura de `api-server`:** Dentro de `services/api-server/src/`, crear `routes/`, `controllers/`, `services/`, `adapters/`, `middlewares/`, `lib/` y `config/`【447051377897297†L43-L46】.
* **Estructura de `rust-core`:** En `rust-core/src/`, crear `domain/`, `math/`, `serde/`, `errors.rs` y `benches/`【447051377897297†L46-L48】.
* **Estructura de `rust-engine`:** En `rust-engine/src/`, crear `engine/`, `pricing/`, `connectors/`, `ffi/` y `utils/`【447051377897297†L48-L51】.
* **Estructura de `contracts`:** En `contracts/`, crear `script/`, `test/`, `interfaces/` y los contratos `Vault.sol` y `Router.sol`【447051377897297†L52-L53】.
* **Estructura de `ts-executor`:** En `ts-executor/src/`, crear `jobs/`, `queues/`, `bridges/`, `chains/` y `config/`【447051377897297†L54-L55】.
* **Estructura de `python-collector`:** En `python-collector/src/`, crear `collectors/`, `pipelines/`, `schedulers/`, `sheets/`, `utils/` y `notebooks/`【447051377897297†L56-L58】.
* **Raíz del Monorepo:** Crear directorios `db/`, `configs/` y `tools/`【447051377897297†L58-L59】.
* **Verificación:** La estructura debe reflejar fielmente la propuesta, con archivos `README.md` o `index.ts`/`.rs` en cada subdirectorio para indicar su propósito【447051377897297†L59-L64】.
* **Impacto:** Permite implementar la lógica de negocio de manera modular y facilita el mantenimiento【447051377897297†L65-L67】.

## 3. Configuración de Fly.io y CI/CD

Un despliegue reproducible y automatizado requiere una configuración correcta de Fly.io y de los pipelines de CI/CD【447051377897297†L68-L118】:

### `fly.toml`

* Situar `fly.toml` en la raíz del monorepo【447051377897297†L78-L79】.
* Establecer `app = "arbitragexplus-api"` o el nombre deseado【447051377897297†L80-L81】.
* Definir `[build]` para apuntar al `Dockerfile` dentro de `services/api-server/`【447051377897297†L81-L83】.
* Configurar `[http_service]` para escuchar en el puerto 3000 (o el puerto que use el API server)【447051377897297†L84-L85】.
* Añadir `[[http_service.healthcheck]]` apuntando a `/health`【447051377897297†L84-L87】.

### Dockerfile (`services/api-server/`)

* Usar una imagen base ligera (`node:20-alpine`)【447051377897297†L89-L92】.
* Copiar dependencias, instalar (utilizando `npm ci` o `pnpm install`), construir la aplicación (`npm run build`)【447051377897297†L93-L94】.
* Exponer el puerto (por ejemplo, `EXPOSE 3000`)【447051377897297†L95-L96】.
* Definir el comando de inicio: `CMD ["node", "dist/server.js"]`【447051377897297†L96-L97】.

### Workflows de CI/CD

* **Build y tests:** Ejecutar instalación y build de todos los servicios (`api-server`, `ts-executor`, `rust-core`, `rust-engine`, `python-collector`, `contracts`) y sus pruebas unitarias e integración【447051377897297†L101-L104】.
* **Despliegue continuo:** Configurar un workflow que, tras un push exitoso a `main`, construya la imagen Docker del API server y la despliegue en Fly.io usando `flyctl deploy`【447051377897297†L105-L108】.
* **Secretos:** Asegurar que `FLY_API_TOKEN` esté configurado como secreto en GitHub y sea accesible por el workflow【447051377897297†L109-L111】.
* **Verificación:** El pipeline debe ejecutarse sin errores y el endpoint `/health` del API server desplegado en Fly.io debe responder `200 OK`【447051377897297†L112-L115】.
* **Impacto:** Automatiza el despliegue y garantiza que solo código validado llegue a producción【447051377897297†L116-L118】.

## 4. Scripts de Validación

Los scripts de validación protegen la estructura y configuración del proyecto. Los requisitos son【447051377897297†L119-L140】:

* **Implementación completa:** Verificar que los scripts `verify-structure.js`, `check_fly_config.js`, `scan-dead-paths.js`, `validate-local-health.js` y `validate-deployment.js` estén implementados y funcionales【447051377897297†L125-L129】.
* **Integración en CI/CD:** Los workflows deben ejecutar estos scripts como parte de la fase de pre‑commit o pre‑push y bloquear el pipeline si alguno falla【447051377897297†L129-L133】.
* **Reporte:** Los scripts deben generar reportes claros sobre fallos, indicando causa y ubicación del problema【447051377897297†L134-L135】.
* **Impacto:** Actúan como defensa temprana contra errores de configuración, estructura y dependencias【447051377897297†L136-L139】.

## 5. Estrategia de Persistencia de Datos (Base de Datos)

Una base de datos robusta es fundamental para almacenar datos históricos, configuraciones dinámicas y estados de transacciones【447051377897297†L142-L147】. Los requisitos técnicos son【447051377897297†L150-L181】:

* **Selección de base de datos:** PostgreSQL como base principal, con extensión opcional a TimescaleDB para datos de series temporales【447051377897297†L150-L153】.
* **Aprovisionamiento:** Crear una instancia de PostgreSQL en un servicio free‑tier (por ejemplo, Neon.tech o Supabase)【447051377897297†L154-L156】.
* **Diseño de esquemas:** Definir tablas para oportunidades de arbitraje, transacciones ejecutadas, configuraciones dinámicas (umbrales, pools activos) y datos históricos de precios/liquidez【447051377897297†L157-L165】.
* **Integración de ORM/Cliente:** Utilizar un ORM (p. ej. Drizzle ORM para TypeScript) o un cliente nativo en cada servicio que interactúe con la base (api-server, ts-executor, python-collector)【447051377897297†L166-L169】.
* **Migraciones:** Implementar un sistema de migraciones para gestionar cambios de esquema【447051377897297†L170-L173】.
* **Conectividad segura:** Manejar las credenciales como secretos y asegurar que la conexión a la base sea segura (SSL/TLS)【447051377897297†L174-L176】.
* **Impacto:** Permite almacenar y consultar datos críticos, habilitando análisis post‑mortem, optimización de estrategias y persistencia de estados【447051377897297†L177-L181】.

## 6. Seguridad Avanzada (Gestión de Secretos)

La seguridad de credenciales y datos sensibles es prioritaria para un sistema financiero【447051377897297†L182-L213】. Los requisitos son:

* **Variables de entorno:** Gestionar credenciales sensibles (claves privadas, API keys, secretos de DB) exclusivamente a través de variables de entorno【447051377897297†L186-L190】.
* **Gestor de secretos en producción:** Implementar un gestor de secretos dedicado (HashiCorp Vault, AWS Secrets Manager o capacidades de Fly.io/Render) para almacenar, rotar y auditar accesos【447051377897297†L191-L196】.
* **Protección en desarrollo:** Utilizar archivos `.env` locales para desarrollo y asegurarse de que estén en `.gitignore`【447051377897297†L199-L201】.
* **Framework de seguridad en el API server:** Aplicar un framework de seguridad (por ejemplo Helmet) para mitigar XSS, CSRF y otras vulnerabilidades web【447051377897297†L202-L205】.
* **Auditoría:** Implementar logs de auditoría para accesos a secretos y operaciones críticas【447051377897297†L207-L209】.
* **Impacto:** Protege contra accesos no autorizados, fugas de credenciales y ataques web, garantizando la integridad y confidencialidad de los activos y datos【447051377897297†L210-L213】.

## Conclusión

Estos requisitos técnicos de prioridad crítica (`P0`) sientan las bases para un desarrollo seguro, eficiente y escalable de ARBITRAGEXPLUS‑IIII. Cumplirlos garantiza que la infraestructura y los procesos de despliegue sean robustos. Tras implementarlos, el proyecto estará listo para abordar mejoras de prioridades `P1` y `P2`, como se detalla en la estrategia de acción y en los documentos de mejoras y priorización【447051377897297†L214-L219】.