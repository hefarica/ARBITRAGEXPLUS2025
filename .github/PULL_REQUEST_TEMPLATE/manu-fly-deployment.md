# 🚀 PR: Fly.io Deployment 5000% Efficient

## Summary
Dockerfile-first deployment for `services/api-server` + guards.

## Checklist (must be all green)
- [ ] `node SCRIPTS/verify-structure.js`
- [ ] `node SCRIPTS/check_fly_config.js`
- [ ] `node SCRIPTS/scan-dead-paths.js`
- [ ] Local: `npm --prefix services/api-server ci && npm --prefix services/api-server run build`
- [ ] Local: `node SCRIPTS/validate-local-health.js`
- [ ] After merge: `node SCRIPTS/validate-deployment.js`

**Closing phrase (by MANU only):**
```
APROBADO — CHECKLIST COMPLETO Y VALIDADO. ENTREGADO.
```
