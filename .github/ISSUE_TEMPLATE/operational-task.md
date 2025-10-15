---
name: "\U0001F527 Operación MANU"
about: "Acciones operativas relacionadas con despliegues o mantenimiento"
title: "[OPS] Breve descripción de la tarea"
labels: ["operational", "manu", "deploy"]
assignees: "hefarica"
---

## Objetivo
¿Qué se debe lograr? Describe claramente el resultado esperado.

## Pasos
- [ ] Leer el `CHECKLIST_MANU_MASTER.md` y asegurarse de entender el objetivo.
- [ ] Validar estructura con `node scripts/verify-structure.js`.
- [ ] Validar configuración de Fly con `node scripts/check_fly_config.js`.
- [ ] Escanear imports con `node scripts/scan-dead-paths.js`.
- [ ] Implementar los cambios necesarios.
- [ ] Ejecutar `npm ci && npm run build` en `services/api-server`.
- [ ] Comprobar salud local con `node scripts/validate-local-health.js`.
- [ ] Crear PR y seguir plantilla.

## Criterios de aceptación
- [ ] Todos los checks de CI/CD pasan.
- [ ] Health check en producción responde con HTTP 200 y `{ status: 'ok' }`.
- [ ] El checklist de la plantilla de PR está completamente marcado.
