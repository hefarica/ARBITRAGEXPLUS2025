# ✅ Checklist Maestro MANU

Este documento guía el proceso de despliegue y validación. **Debes leerlo completamente antes de iniciar cualquier tarea**.

## Reglas fundamentales

1. **Analiza antes de actuar**: lee todo el contenido provisto, asegúrate de comprender cada paso.
2. **No apuntes a rutas inexistentes**: utiliza `scripts/verify-structure.js` para comprobar que la estructura es correcta.
3. **No avances si algo falla**: detén el proceso, encuentra la causa raíz y arréglala; no apliques parches rápidos.
4. **Mensajes de commit claros**: explican qué cambió y por qué.
5. **Cierre único**: para considerar una tarea finalizada, debes comentar en el PR: `APROBADO — CHECKLIST COMPLETO Y VALIDADO. ENTREGADO.`

## Fases

### 1. Preparación

- [ ] Ejecuta `git checkout main && git pull --ff-only`.
- [ ] Verifica que el working tree esté limpio (`git status`).
- [ ] Copia `.env.example` a `.env` y completa los valores necesarios.

### 2. Estructura y Configuración

- [ ] Asegúrate de que la estructura del proyecto coincide con el árbol especificado en los documentos (`services/api-server`, `scripts`, etc.).
- [ ] Ejecuta `node scripts/verify-structure.js`.
- [ ] Ejecuta `node scripts/check_fly_config.js`.
- [ ] Ejecuta `node scripts/scan-dead-paths.js`.

### 3. Construcción y pruebas locales

- [ ] Instala dependencias: `npm ci --prefix services/api-server`.
- [ ] Compila: `npm run build --prefix services/api-server`.
- [ ] Verifica salud local: `node scripts/validate-local-health.js`.

### 4. Commit y Pull Request

- [ ] Crea una rama de trabajo (`feature/fly-deploy-5000` u otra descriptiva).
- [ ] Agrega todos los cambios (`git add .`).
- [ ] Commit: `git commit -m "feat: Fly.io deployment 5000% efficient ... (#MANU)"`.
- [ ] Push: `git push origin <branch>`.
- [ ] Abre un PR contra `main` usando la plantilla `.github/PULL_REQUEST_TEMPLATE/manu-fly-deployment.md` y marca todos los checkboxes correspondientes.

### 5. Despliegue y validación en CI/CD

- [ ] Asegúrate de que el secreto `FLY_API_TOKEN` está configurado en el repositorio.
- [ ] Verifica que los jobs `sanity-check`, `build` y `deploy` pasen en GitHub Actions.
- [ ] Tras el despliegue, ejecuta `node scripts/validate-deployment.js` para confirmar que el endpoint de salud en producción responde correctamente.

### 6. Cierre

- [ ] Una vez verificados todos los checks, comenta en el PR la frase exacta: `APROBADO — CHECKLIST COMPLETO Y VALIDADO. ENTREGADO.`.
