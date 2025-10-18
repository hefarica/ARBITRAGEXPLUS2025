# 📊 Especificación de la Hoja ORACLE_ASSETS

## 🎯 Propósito

La hoja **ORACLE_ASSETS** es la fuente única de verdad (SSOT) para la configuración de assets y oráculos en el sistema ARBITRAGEXPLUS2025. Permite gestionar dinámicamente qué tokens monitorear, qué oráculos usar, y qué parámetros de validación aplicar **sin modificar código**.

---

## 📋 Estructura de Columnas

| Columna | Tipo | Requerido | Descripción | Ejemplo |
|---------|------|-----------|-------------|---------|
| **SYMBOL** | String | ✅ Sí | Símbolo del token (uppercase) | `ETH`, `USDC`, `BTC` |
| **BLOCKCHAIN** | String | ✅ Sí | Red blockchain (lowercase) | `ethereum`, `polygon`, `bsc` |
| **PYTH_PRICE_ID** | String (64 chars) | ⚠️ Condicional | ID del price feed de Pyth Network | `0xff61491a931112...` |
| **CHAINLINK_ADDRESS** | Address (42 chars) | ⚠️ Condicional | Dirección del contrato Chainlink | `0x5f4eC3Df9cbd43...` |
| **UNISWAP_POOL_ADDRESS** | Address (42 chars) | ⚠️ Condicional | Dirección del pool de Uniswap V3 | `0x88e6A0c2dDD26...` |
| **IS_ACTIVE** | Boolean | ✅ Sí | Si debe monitorearse | `TRUE` o `FALSE` |
| **PRIORITY** | Integer | ✅ Sí | Prioridad de ejecución | `1` (crítico), `2` (importante), `3` (opcional) |
| **MIN_CONFIDENCE** | Float | ✅ Sí | Confianza mínima requerida (0-1) | `0.95`, `0.90`, `0.85` |
| **MAX_DEVIATION** | Float | ❌ No | Desviación máxima permitida | `0.02` (2%), `0.03` (3%) |
| **NOTES** | String | ❌ No | Notas para operadores | `Main asset`, `High volatility` |

### ⚠️ Reglas de Validación

1. **Al menos un oráculo requerido**: Debe tener al menos uno de:
   - `PYTH_PRICE_ID`
   - `CHAINLINK_ADDRESS`
   - `UNISWAP_POOL_ADDRESS`

2. **SYMBOL + BLOCKCHAIN = Clave única**: No puede haber duplicados de la combinación `blockchain:symbol`

3. **IS_ACTIVE debe ser TRUE o FALSE**: Cualquier otro valor se trata como FALSE

4. **PRIORITY debe ser 1, 2 o 3**:
   - `1` = Crítico (ETH, USDC, USDT, stablecoins principales)
   - `2` = Importante (tokens DeFi principales)
   - `3` = Opcional (memecoins, tokens experimentales)

5. **MIN_CONFIDENCE debe estar entre 0 y 1**:
   - `0.95-1.0` = Muy alta (stablecoins, assets principales)
   - `0.90-0.94` = Alta (tokens DeFi establecidos)
   - `0.85-0.89` = Media (tokens volátiles)
   - `< 0.85` = Baja (memecoins, tokens experimentales)

---

## 🔄 Flujo de Datos

```
Google Sheets (ORACLE_ASSETS)
    ↓
PriceService.loadAssetsConfig()
    ↓
Map<string, OracleAssetConfig>
    ↓
PriceService.getPrice(query)
    ↓
Validación: IS_ACTIVE, MIN_CONFIDENCE
    ↓
Consulta oráculos configurados
    ↓
Retorna precio o error
```

---

## 📥 Importación del CSV

### Opción 1: Importar desde archivo

1. Abrir Google Sheets
2. Crear nueva hoja llamada `ORACLE_ASSETS`
3. Archivo → Importar → Subir
4. Seleccionar `ORACLE_ASSETS_IMPORT.csv`
5. Configurar:
   - Tipo de separador: Coma
   - Convertir texto a números: Sí
   - Importar ubicación: Reemplazar hoja actual

### Opción 2: Copiar y pegar

1. Abrir `ORACLE_ASSETS_IMPORT.csv` en editor de texto
2. Seleccionar todo (Ctrl+A)
3. Copiar (Ctrl+C)
4. En Google Sheets, crear hoja `ORACLE_ASSETS`
5. Seleccionar celda A1
6. Pegar (Ctrl+V)
7. Datos → Dividir texto en columnas

### Opción 3: Script de importación (recomendado)

```bash
# Usar el script de importación incluido
cd /home/ubuntu/ARBITRAGEXPLUS2025
python3 scripts/import-oracle-assets.py
```

---

## 🎨 Formato Recomendado

### Colores por Prioridad

- **Priority 1 (Crítico)**: Fondo verde claro (`#d9ead3`)
- **Priority 2 (Importante)**: Fondo amarillo claro (`#fff2cc`)
- **Priority 3 (Opcional)**: Fondo naranja claro (`#fce5cd`)

### Colores por Estado

- **IS_ACTIVE = TRUE**: Texto negro (`#000000`)
- **IS_ACTIVE = FALSE**: Texto gris (`#999999`) + tachado

### Formato de Celdas

- **SYMBOL**: Texto, mayúsculas, negrita
- **BLOCKCHAIN**: Texto, minúsculas
- **PYTH_PRICE_ID**: Texto, monoespaciado
- **CHAINLINK_ADDRESS**: Texto, monoespaciado
- **IS_ACTIVE**: Lista desplegable (TRUE, FALSE)
- **PRIORITY**: Número entero (1-3)
- **MIN_CONFIDENCE**: Número decimal (0.00-1.00)
- **MAX_DEVIATION**: Número decimal (0.00-1.00)

---

## 📊 Ejemplos de Configuración

### Stablecoin (Máxima Confianza)

```csv
USDC,ethereum,0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a,0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6,,TRUE,1,0.98,0.01,USD Coin - Stablecoin
```

- **Priority**: 1 (crítico)
- **MIN_CONFIDENCE**: 0.98 (muy alta)
- **MAX_DEVIATION**: 0.01 (1% máximo)

### Token DeFi Establecido

```csv
AAVE,ethereum,0x2b9ab1e972a281585084148ba1389800799bd4be63b0049b8246b8e1c2c2b1e4,0x547a514d5e3769680Ce22B2361c10Ea13619e8a9,,TRUE,2,0.90,0.025,Aave DeFi protocol token
```

- **Priority**: 2 (importante)
- **MIN_CONFIDENCE**: 0.90 (alta)
- **MAX_DEVIATION**: 0.025 (2.5%)

### Memecoin (Alta Volatilidad)

```csv
PEPE,ethereum,0xd69731a2e74ac1ce884fc3890f7ee324b6deb66147055249568869ed700882e4,,,TRUE,3,0.80,0.04,Pepe memecoin - Very high volatility
```

- **Priority**: 3 (opcional)
- **MIN_CONFIDENCE**: 0.80 (media-baja)
- **MAX_DEVIATION**: 0.04 (4%)

### Token Deshabilitado

```csv
LINK,ethereum,0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221,0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c,,FALSE,2,0.90,0.025,Chainlink - Currently disabled for testing
```

- **IS_ACTIVE**: FALSE
- El servicio ignorará este asset

---

## 🔧 Operaciones Comunes

### Agregar Nuevo Token

1. Agregar nueva fila al final de la hoja
2. Completar todas las columnas requeridas
3. Configurar `IS_ACTIVE = TRUE`
4. Esperar hasta 5 minutos (refresh automático)
5. Verificar en logs: `Assets configuration loaded successfully`

### Deshabilitar Token

1. Cambiar `IS_ACTIVE` de `TRUE` a `FALSE`
2. Esperar hasta 5 minutos
3. El servicio dejará de consultar precios para ese asset

### Ajustar Confianza Mínima

1. Modificar valor de `MIN_CONFIDENCE`
2. Esperar hasta 5 minutos
3. El servicio aplicará la nueva validación

### Agregar 100 Tokens

1. Copiar CSV con 100 filas
2. Pegar en Google Sheets
3. Esperar hasta 5 minutos
4. ✅ Sin modificar código

---

## 📈 Estadísticas

El servicio reporta estadísticas en tiempo real:

```typescript
{
  configuredAssets: 60,      // Total de assets en la hoja
  activeAssets: 58,          // Assets con IS_ACTIVE = TRUE
  inactiveAssets: 2,         // Assets con IS_ACTIVE = FALSE
  cachedPrices: 58,          // Precios en cache
  oracleSources: 3,          // Oráculos disponibles
  availableSources: 1,       // Oráculos actualmente disponibles
}
```

---

## 🔍 Troubleshooting

### Error: "Asset X is not configured"

**Causa**: El asset no existe en la hoja ORACLE_ASSETS

**Solución**: Agregar fila con la configuración del asset

### Error: "Asset X is disabled"

**Causa**: `IS_ACTIVE = FALSE`

**Solución**: Cambiar a `IS_ACTIVE = TRUE`

### Warning: "Confidence below threshold"

**Causa**: El precio obtenido tiene confianza menor a `MIN_CONFIDENCE`

**Solución**: 
- Reducir `MIN_CONFIDENCE` si es aceptable
- Verificar que los oráculos estén funcionando correctamente

### Warning: "High price deviation detected"

**Causa**: Los precios de diferentes oráculos difieren más de `MAX_DEVIATION`

**Solución**:
- Aumentar `MAX_DEVIATION` si es aceptable
- Investigar por qué los oráculos difieren (posible manipulación de precio)

---

## 🚀 Ventajas del Sistema Dinámico

| Operación | Antes (Hardcoded) | Ahora (Dinámico) |
|-----------|-------------------|------------------|
| Agregar token | Modificar código + deploy | ✅ Agregar fila en Sheets |
| Deshabilitar token | Comentar código + deploy | ✅ Cambiar IS_ACTIVE a FALSE |
| Ajustar confianza | Modificar constante + deploy | ✅ Editar MIN_CONFIDENCE |
| Agregar 100 tokens | 100 líneas de código | ✅ 100 filas en Sheets |
| Cambiar oráculo | Refactorizar código + deploy | ✅ Editar columna de oráculo |
| Tiempo de cambio | ~30 minutos | ✅ ~30 segundos |

---

## 📝 Notas Importantes

1. **Refresh automático cada 5 minutos**: Los cambios en la hoja se reflejan automáticamente
2. **Cache de 30 segundos**: Los precios se cachean para reducir llamadas a oráculos
3. **Sin downtime**: Los cambios se aplican sin reiniciar el servicio
4. **Validación automática**: El servicio valida la configuración al cargarla
5. **Logging completo**: Todos los cambios se registran en logs

---

## 🔗 Referencias

- **Pyth Price Feed IDs**: https://pyth.network/developers/price-feed-ids
- **Chainlink Price Feeds**: https://docs.chain.link/data-feeds/price-feeds/addresses
- **Uniswap V3 Pools**: https://info.uniswap.org/#/pools

---

**Última actualización**: 18 de Octubre, 2025  
**Versión**: 1.0.0

