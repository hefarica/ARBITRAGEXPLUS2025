---
name: Operational Task
about: Tarea operativa o de mantenimiento
title: '[OPS] '
labels: operational, manu
assignees: hefarica
---

## 📋 Descripción de la Tarea

Breve descripción de la tarea operativa.

## 🎯 Objetivo Esperado

¿Qué se espera lograr con esta tarea?

## ✅ Pasos a Realizar

- [ ] Paso 1
- [ ] Paso 2
- [ ] Paso 3

## 🔍 Validaciones

- [ ] Ejecutar `node SCRIPTS/verify-structure.js`
- [ ] Ejecutar `node SCRIPTS/scan-dead-paths.js`
- [ ] Ejecutar `node SCRIPTS/check_fly_config.js`
- [ ] Ejecutar `pnpm -r build`
- [ ] Ejecutar `pnpm -r test`
- [ ] Ejecutar `node validate-local-health.js`

## 🚀 CI/CD

- [ ] GitHub Actions: sanity-check ✅
- [ ] GitHub Actions: build ✅
- [ ] GitHub Actions: deploy ✅

## 🏥 Health Check

- [ ] Endpoint `/health` responde 200
- [ ] Despliegue en Fly.io exitoso

## ✅ Criterios de Aceptación

- [ ] Todos los scripts de validación pasan
- [ ] CI/CD en verde
- [ ] Health check exitoso en producción
- [ ] Checklist de PR completado
