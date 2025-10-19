/**
 * Tests de integración para ExcelClient TypeScript
 * Valida todas las operaciones con el archivo Excel real
 */

import { expect } from 'chai';
import { ExcelClient, getExcelClient } from '../services/api-server/src/lib/excel-client';

describe('ExcelClient Integration Tests', () => {
  let client: ExcelClient;

  before(() => {
    // Inicializar cliente
    client = new ExcelClient('/home/ubuntu/ARBITRAGEXPLUS2025/data/ARBITRAGEXPLUS2025.xlsx');
  });

  describe('Lectura de Datos', () => {
    it('debe leer ORACLE_ASSETS completo', async () => {
      const assets = await client.getSheetData('ORACLE_ASSETS');
      
      expect(assets).to.be.an('array');
      expect(assets.length).to.be.at.least(57);
      
      // Verificar estructura del primer asset
      const firstAsset = assets[0];
      expect(firstAsset).to.have.property('SYMBOL');
      expect(firstAsset).to.have.property('BLOCKCHAIN');
      expect(firstAsset).to.have.property('PYTH_PRICE_ID');
      expect(firstAsset).to.have.property('IS_ACTIVE');
      
      console.log(`✅ ${assets.length} assets leídos correctamente`);
    });

    it('debe leer rango específico de ORACLE_ASSETS', async () => {
      const data = await client.getRange('ORACLE_ASSETS!A1:M10');
      
      expect(data).to.be.an('array');
      expect(data.length).to.equal(10);
      expect(data[0].length).to.equal(13);
      
      // Verificar headers
      const headers = data[0];
      expect(headers[0]).to.equal('SYMBOL');
      expect(headers[1]).to.equal('BLOCKCHAIN');
      expect(headers[9]).to.equal('BINANCE_SYMBOL');
      expect(headers[10]).to.equal('COINGECKO_ID');
      expect(headers[11]).to.equal('BAND_SYMBOL');
      
      console.log(`✅ Rango leído: ${data.length} filas x ${data[0].length} columnas`);
    });

    it('debe leer PARAMETROS', async () => {
      const params = await client.getSheetData('PARAMETROS');
      
      expect(params).to.be.an('array');
      expect(params.length).to.be.at.least(20);
      
      // Verificar estructura
      const firstParam = params[0];
      expect(firstParam).to.have.property('PARAMETRO');
      expect(firstParam).to.have.property('VALOR');
      expect(firstParam).to.have.property('UNIDAD');
      expect(firstParam).to.have.property('DESCRIPCION');
      
      console.log(`✅ ${params.length} parámetros leídos correctamente`);
    });

    it('debe leer ERROR_HANDLING_CONFIG', async () => {
      const errors = await client.getSheetData('ERROR_HANDLING_CONFIG');
      
      expect(errors).to.be.an('array');
      expect(errors.length).to.be.at.least(10);
      
      // Verificar estructura
      const firstError = errors[0];
      expect(firstError).to.have.property('ERROR_CODE');
      expect(firstError).to.have.property('SHOULD_LOG');
      expect(firstError).to.have.property('SHOULD_RETRY');
      expect(firstError).to.have.property('MAX_RETRIES');
      
      console.log(`✅ ${errors.length} configuraciones de error leídas`);
    });

    it('debe leer COLLECTORS_CONFIG', async () => {
      const collectors = await client.getSheetData('COLLECTORS_CONFIG');
      
      expect(collectors).to.be.an('array');
      expect(collectors.length).to.be.at.least(5);
      
      // Verificar estructura
      const firstCollector = collectors[0];
      expect(firstCollector).to.have.property('NAME');
      expect(firstCollector).to.have.property('ENABLED');
      expect(firstCollector).to.have.property('PRIORITY');
      expect(firstCollector).to.have.property('MODULE_PATH');
      
      console.log(`✅ ${collectors.length} collectors leídos correctamente`);
    });
  });

  describe('Escritura de Datos', () => {
    it('debe actualizar celda individual', async () => {
      const testValue = 999;
      await client.updateCell('ESTADISTICAS', 'B2', testValue);
      
      // Leer y verificar
      const value = await client.getCell('ESTADISTICAS', 'B2');
      expect(value).to.equal(testValue);
      
      console.log(`✅ Celda actualizada: ${value}`);
    });

    it('debe agregar fila a RESULTADOS', async () => {
      // Contar filas antes
      const resultsBefore = await client.getSheetData('RESULTADOS');
      const countBefore = resultsBefore.length;
      
      // Agregar nueva fila
      const testRow = [
        new Date(),
        'BATCH_TEST_TS_001',
        'ethereum',
        'USDC',
        'ETH',
        10000,
        4.02,
        50,
        0.5,
        150000,
        15,
        35,
        '0xtestts1234',
        'SUCCESS',
        'Integration test TypeScript'
      ];
      await client.appendRow('RESULTADOS', testRow);
      
      // Contar filas después
      const resultsAfter = await client.getSheetData('RESULTADOS');
      const countAfter = resultsAfter.length;
      
      expect(countAfter).to.equal(countBefore + 1);
      
      // Verificar última fila
      const lastRow = resultsAfter[resultsAfter.length - 1];
      expect(lastRow.BATCH_ID).to.equal('BATCH_TEST_TS_001');
      expect(lastRow.CHAIN).to.equal('ethereum');
      expect(lastRow.STATUS).to.equal('SUCCESS');
      
      console.log(`✅ Fila agregada: ${countBefore} → ${countAfter}`);
    });

    it('debe actualizar rango de celdas', async () => {
      const updates = [
        [200],  // TOTAL_BATCHES
        [5000],  // TOTAL_OPERATIONS
        [95.5],  // SUCCESS_RATE
      ];
      
      await client.updateRange('ESTADISTICAS!B2:B4', updates);
      
      // Verificar
      const totalBatches = await client.getCell('ESTADISTICAS', 'B2');
      const totalOps = await client.getCell('ESTADISTICAS', 'B3');
      const successRate = await client.getCell('ESTADISTICAS', 'B4');
      
      expect(totalBatches).to.equal(200);
      expect(totalOps).to.equal(5000);
      expect(successRate).to.equal(95.5);
      
      console.log(`✅ Rango actualizado correctamente`);
    });
  });

  describe('Operaciones Batch', () => {
    it('debe leer múltiples rangos en batch', async () => {
      const ranges = [
        'ORACLE_ASSETS!A1:M10',
        'PARAMETROS!A1:D5',
        'ESTADISTICAS!A1:B5'
      ];
      
      const results = await client.batchGet(ranges);
      
      expect(Object.keys(results)).to.have.lengthOf(3);
      expect(results).to.have.property('ORACLE_ASSETS!A1:M10');
      expect(results).to.have.property('PARAMETROS!A1:D5');
      expect(results).to.have.property('ESTADISTICAS!A1:B5');
      
      console.log(`✅ Batch get: ${Object.keys(results).length} rangos leídos`);
    });

    it('debe actualizar múltiples rangos en batch', async () => {
      const updates = {
        'ESTADISTICAS!B2': [[300]],
        'ESTADISTICAS!B3': [[6000]],
        'ESTADISTICAS!B4': [[96.5]]
      };
      
      await client.batchUpdate(updates);
      
      // Verificar
      const totalBatches = await client.getCell('ESTADISTICAS', 'B2');
      const totalOps = await client.getCell('ESTADISTICAS', 'B3');
      const successRate = await client.getCell('ESTADISTICAS', 'B4');
      
      expect(totalBatches).to.equal(300);
      expect(totalOps).to.equal(6000);
      expect(successRate).to.equal(96.5);
      
      console.log(`✅ Batch update completado`);
    });
  });

  describe('Utilidades', () => {
    it('debe obtener lista de hojas', async () => {
      const sheetNames = await client.getSheetNames();
      
      const expectedSheets = [
        'ORACLE_ASSETS',
        'ERROR_HANDLING_CONFIG',
        'COLLECTORS_CONFIG',
        'PARAMETROS',
        'RESULTADOS',
        'LOGERRORESEVENTOS',
        'ESTADISTICAS'
      ];
      
      for (const expected of expectedSheets) {
        expect(sheetNames).to.include(expected);
      }
      
      console.log(`✅ ${sheetNames.length} hojas: ${sheetNames.join(', ')}`);
    });

    it('debe filtrar assets activos', async () => {
      const assets = await client.getSheetData('ORACLE_ASSETS');
      
      // Filtrar solo activos
      const activeAssets = assets.filter(a => 
        String(a.IS_ACTIVE).toUpperCase() === 'TRUE'
      );
      
      expect(activeAssets.length).to.be.greaterThan(0);
      
      // Verificar que todos tienen IS_ACTIVE=TRUE
      for (const asset of activeAssets) {
        expect(String(asset.IS_ACTIVE).toUpperCase()).to.equal('TRUE');
      }
      
      console.log(`✅ ${activeAssets.length}/${assets.length} assets activos`);
    });

    it('debe obtener assets de alta prioridad', async () => {
      const assets = await client.getSheetData('ORACLE_ASSETS');
      
      // Filtrar prioridad 1
      const highPriority = assets.filter(a => String(a.PRIORITY) === '1');
      
      expect(highPriority.length).to.be.greaterThan(0);
      
      console.log(`✅ ${highPriority.length} assets de prioridad 1`);
    });

    it('debe verificar singleton pattern', () => {
      const client1 = getExcelClient();
      const client2 = getExcelClient();
      
      expect(client1).to.equal(client2);
      
      console.log(`✅ Singleton pattern funciona correctamente`);
    });
  });

  describe('Validación de Datos', () => {
    it('debe validar que todos los assets activos tienen oráculos configurados', async () => {
      const assets = await client.getSheetData('ORACLE_ASSETS');
      
      const activeAssets = assets.filter(a => 
        String(a.IS_ACTIVE).toUpperCase() === 'TRUE'
      );
      
      for (const asset of activeAssets) {
        // Al menos un oráculo debe estar configurado
        const hasOracle = 
          asset.PYTH_PRICE_ID ||
          asset.CHAINLINK_ADDRESS ||
          asset.UNISWAP_POOL_ADDRESS ||
          asset.BINANCE_SYMBOL ||
          asset.COINGECKO_ID ||
          asset.BAND_SYMBOL;
        
        expect(hasOracle, `Asset ${asset.SYMBOL} debe tener al menos un oráculo configurado`).to.be.ok;
      }
      
      console.log(`✅ Todos los assets activos tienen oráculos configurados`);
    });

    it('debe validar que los parámetros tienen valores válidos', async () => {
      const params = await client.getSheetData('PARAMETROS');
      
      for (const param of params) {
        expect(param.PARAMETRO).to.be.a('string').and.not.empty;
        expect(param.VALOR).to.exist;
        
        // Si es numérico, debe ser válido
        if (!isNaN(Number(param.VALOR))) {
          expect(Number(param.VALOR)).to.be.a('number');
        }
      }
      
      console.log(`✅ Todos los parámetros tienen valores válidos`);
    });

    it('debe validar que los collectors tienen configuración válida', async () => {
      const collectors = await client.getSheetData('COLLECTORS_CONFIG');
      
      for (const collector of collectors) {
        expect(collector.NAME).to.be.a('string').and.not.empty;
        expect(String(collector.ENABLED).toUpperCase()).to.be.oneOf(['TRUE', 'FALSE']);
        expect(Number(collector.PRIORITY)).to.be.a('number').and.within(1, 5);
        expect(Number(collector.TIMEOUT)).to.be.a('number').and.greaterThan(0);
      }
      
      console.log(`✅ Todos los collectors tienen configuración válida`);
    });
  });
});

