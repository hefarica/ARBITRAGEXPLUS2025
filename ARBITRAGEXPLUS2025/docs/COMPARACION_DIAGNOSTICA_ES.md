# Comparación Diagnóstica: Documentación vs. Código Ejecutable

Esta sección compara la documentación y la estructura propuesta para ARBITRAGEXPLUS-IIII con el contenido del paquete ejecutable (`ARBITRAGEXPLUS-IIII_skeleton.zip`).

## 1. Puntos de Coincidencia

La estructura de directorios de alto nivel en el paquete ejecutable coincide en gran medida con la propuesta en la documentación. Ambos contemplan los siguientes módulos clave:

- `services/api-server`: El backend principal de Node.js/TypeScript.
- `rust-core` y `rust-engine`: El motor de cálculo de alto rendimiento en Rust.
- `ts-executor`: El orquestador de transacciones en TypeScript.
- `python-collector`: El colector de datos en Python.
- `contracts`: Los contratos inteligentes de Solidity.
- `.github/workflows`: Para la integración y despliegue continuo (CI/CD).
- `SCRIPTS/`: Para scripts de validación y utilidades.

Además, el paquete ejecutable incluye los scripts de validación (`verify-structure.js`, `check_fly_config.js`, `scan-dead-paths.js`, `validate-local-health.js`, `validate-deployment.js`) y los documentos de arquitectura (`ARCHITECTURE.md`, `DATAFLOW.md`) mencionados en la documentación.

## 2. Discrepancias y Gaps

Aunque la estructura general es consistente, existen varias discrepancias y Gaps entre la documentación y el estado actual del código en el paquete ejecutable:

| Módulo/Característica | Documentación/Propuesta | Estado en el Paquete Ejecutable | Gap/Discrepancia |
| :--- | :--- | :--- | :--- |
| **`services/api-server`** | Estructura interna completa con `routes`, `controllers`, `services`, `adapters`, `middlewares`, `lib`, `config`. | Solo contiene `src/server.ts` y `Dockerfile`. | La estructura interna detallada no está implementada. |
| **`rust-core`** | Estructura interna con `domain`, `math`, `serde`, `errors.rs`, `benches`. | Solo contiene `src/lib.rs`. | La estructura interna detallada no está implementada. |
| **`rust-engine`** | Estructura interna con `engine`, `pricing`, `connectors`, `ffi`, `utils`. | Solo contiene `src/main.rs`. | La estructura interna detallada no está implementada. |
| **`contracts`** | Estructura interna con `script`, `test`, `interfaces`, `Vault.sol`, `Router.sol`. | Solo contiene `src/ArbitrageExecutor.sol`. | Faltan los contratos `Vault.sol` y `Router.sol`, así como los directorios `script`, `test` e `interfaces`. |
| **`ts-executor`** | Estructura interna con `jobs`, `queues`, `bridges`, `chains`, `config`. | Solo contiene `src/index.ts`. | La estructura interna detallada no está implementada. |
| **`python-collector`** | Estructura interna con `collectors`, `pipelines`, `schedulers`, `sheets`, `utils`, `notebooks`. | Solo contiene `src/collectors/prices_ingest.py`. | La estructura interna detallada no está implementada. |
| **`db/`** | Directorio para migraciones y seeds de base de datos. | No existe. | El directorio `db/` no está presente. |
| **`configs/`** | Directorio para archivos de configuración YAML/JSON. | No existe. | El directorio `configs/` no está presente. |
| **`tools/`** | Directorio para scripts CLI de DevOps. | No existe. | El directorio `tools/` no está presente. |

## 3. Conclusión del Diagnóstico

El paquete ejecutable `ARBITRAGEXPLUS-IIII_skeleton.zip` proporciona un **esqueleto básico** del proyecto, con la estructura de directorios de alto nivel y algunos archivos de ejemplo. Sin embargo, **carece de la implementación detallada y la estructura interna propuestas en la documentación**.

Los Gaps identificados no son errores, sino más bien una **falta de completitud**. El paquete ejecutable representa el punto de partida, y la documentación describe el camino a seguir para alcanzar la funcionalidad completa del sistema.

La tarea principal, por lo tanto, es **implementar la estructura interna de cada módulo** y **crear los directorios y archivos faltantes** (`db/`, `configs/`, `tools/`) de acuerdo con la propuesta, para luego desarrollar la lógica de negocio de cada componente.

