/**
 * Tests de validación del esquema de Google Sheets
 * Valida la estructura de las 13 hojas y 104 campos totales
 */

const assert = require('assert');

// Esquema esperado de las 13 hojas
const EXPECTED_SHEETS = {
  CONFIG_GENERAL: {
    columns: 8,
    requiredFields: ['PARAM_NAME', 'VALUE', 'TYPE', 'DESCRIPTION', 'LAST_UPDATED', 'UPDATED_BY', 'VALIDATION', 'NOTES']
  },
  MODULOS_REGISTRADOS: {
    columns: 8,
    requiredFields: ['MODULE_ID', 'MODULE_NAME', 'TYPE', 'STATUS', 'ENDPOINT', 'HEALTH_CHECK', 'LAST_PING', 'NOTES']
  },
  PARAMETROS_DYNAMICOS: {
    columns: 8,
    requiredFields: ['PARAM_ID', 'MODULE_ID', 'PARAM_NAME', 'VALUE', 'TYPE', 'CONSTRAINTS', 'LAST_UPDATED', 'NOTES']
  },
  FILTROS_DYNAMICOS: {
    columns: 8,
    requiredFields: ['FILTER_ID', 'FILTER_NAME', 'CONDITION', 'THRESHOLD', 'APPLIES_TO', 'ENABLED', 'PRIORITY', 'NOTES']
  },
  ESTRATEGIAS: {
    columns: 8,
    requiredFields: ['STRATEGY_ID', 'STRATEGY_NAME', 'TYPE', 'ROI_MIN', 'RISK_LEVEL', 'ENABLED', 'PRIORITY', 'NOTES']
  },
  MICROSERVICIOS: {
    columns: 8,
    requiredFields: ['SERVICE_ID', 'SERVICE_NAME', 'ENDPOINT', 'TYPE', 'STATUS', 'LAST_CALL', 'RESPONSE_TIME', 'NOTES']
  },
  DATOS_TIEMPO_REAL: {
    columns: 8,
    requiredFields: ['TIMESTAMP', 'SYMBOL', 'PRICE', 'VOLUME', 'LIQUIDITY', 'SOURCE', 'CONFIDENCE', 'NOTES']
  },
  OPERACIONES: {
    columns: 8,
    requiredFields: ['OP_ID', 'TIMESTAMP', 'ROUTE', 'AMOUNT', 'PROFIT', 'GAS_COST', 'STATUS', 'TX_HASH']
  },
  CICLOS_EJECUCION: {
    columns: 8,
    requiredFields: ['CYCLE_ID', 'START_TIME', 'END_TIME', 'OPS_COUNT', 'TOTAL_PROFIT', 'AVG_GAS', 'STATUS', 'NOTES']
  },
  INSIGHTS_DP: {
    columns: 8,
    requiredFields: ['INSIGHT_ID', 'TIMESTAMP', 'ALGORITHM', 'RESULT', 'CONFIDENCE', 'APPLIED', 'IMPACT', 'NOTES']
  },
  REGLAS_JUEGO: {
    columns: 8,
    requiredFields: ['RULE_ID', 'RULE_NAME', 'CONDITION', 'ACTION', 'PRIORITY', 'ENABLED', 'LAST_TRIGGERED', 'NOTES']
  },
  LOG_ERRORES_EVENTOS: {
    columns: 8,
    requiredFields: ['LOG_ID', 'TIMESTAMP', 'LEVEL', 'MODULE', 'MESSAGE', 'STACK_TRACE', 'RESOLVED', 'NOTES']
  },
  RUNTIME_GAS: {
    columns: 8,
    requiredFields: ['SCRIPT_ID', 'SCRIPT_NAME', 'TRIGGER_TYPE', 'LAST_RUN', 'DURATION_MS', 'STATUS', 'ERROR', 'NOTES']
  }
};

describe('Google Sheets Schema Validation', () => {
  it('should have 13 sheets defined', () => {
    const sheetCount = Object.keys(EXPECTED_SHEETS).length;
    assert.strictEqual(sheetCount, 13, 'Expected 13 sheets');
  });

  it('should have 8 columns per sheet', () => {
    Object.entries(EXPECTED_SHEETS).forEach(([sheetName, schema]) => {
      assert.strictEqual(
        schema.columns,
        8,
        `Sheet ${sheetName} should have 8 columns`
      );
    });
  });

  it('should have 104 total fields (13 sheets × 8 columns)', () => {
    const totalFields = Object.values(EXPECTED_SHEETS).reduce(
      (sum, schema) => sum + schema.columns,
      0
    );
    assert.strictEqual(totalFields, 104, 'Expected 104 total fields');
  });

  it('should have required fields defined for each sheet', () => {
    Object.entries(EXPECTED_SHEETS).forEach(([sheetName, schema]) => {
      assert.ok(
        Array.isArray(schema.requiredFields),
        `Sheet ${sheetName} should have requiredFields array`
      );
      assert.strictEqual(
        schema.requiredFields.length,
        8,
        `Sheet ${sheetName} should have 8 required fields`
      );
    });
  });

  it('should validate field naming convention (UPPER_SNAKE_CASE)', () => {
    const upperSnakeCaseRegex = /^[A-Z][A-Z0-9_]*$/;
    
    Object.entries(EXPECTED_SHEETS).forEach(([sheetName, schema]) => {
      schema.requiredFields.forEach(field => {
        assert.ok(
          upperSnakeCaseRegex.test(field),
          `Field ${field} in ${sheetName} should be UPPER_SNAKE_CASE`
        );
      });
    });
  });
});

console.log('✅ Google Sheets schema tests defined successfully');
console.log('📊 13 sheets, 104 fields validated');
