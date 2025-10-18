/**
 * Tests de Validación de Programación Dinámica
 * 
 * Verifica que el sistema cumple con los principios de Programación Dinámica:
 * - NO hardcoding de nombres específicos
 * - Arrays/Maps para colecciones dinámicas
 * - Interfaces abstractas y polimorfismo
 * - Descubrimiento dinámico de capacidades
 * - Configuración desde Google Sheets
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { PriceService } from '../services/api-server/src/services/priceService';
import { DynamicErrorSystem } from '../services/api-server/src/lib/errors';

describe('Programación Dinámica - PriceService', () => {
  let priceService: PriceService;
  let mockSheetsService: any;

  beforeAll(() => {
    // Mock de Sheets Service
    mockSheetsService = {
      readSheet: async (sheetName: string) => {
        if (sheetName === 'ORACLE_ASSETS') {
          return [
            {
              SYMBOL: 'ETH',
              BLOCKCHAIN: 'ethereum',
              PYTH_PRICE_ID: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
              IS_ACTIVE: 'TRUE',
              PRIORITY: '1',
              MIN_CONFIDENCE: '0.95',
              MAX_DEVIATION: '0.02',
            },
            {
              SYMBOL: 'USDC',
              BLOCKCHAIN: 'ethereum',
              PYTH_PRICE_ID: '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
              IS_ACTIVE: 'TRUE',
              PRIORITY: '1',
              MIN_CONFIDENCE: '0.98',
              MAX_DEVIATION: '0.01',
            },
            {
              SYMBOL: 'LINK',
              BLOCKCHAIN: 'ethereum',
              PYTH_PRICE_ID: '0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221',
              IS_ACTIVE: 'FALSE', // Deshabilitado
              PRIORITY: '2',
              MIN_CONFIDENCE: '0.90',
            },
          ];
        }
        return [];
      },
    };

    priceService = new PriceService(mockSheetsService);
  });

  it('✅ NO hardcoding: Carga assets desde Google Sheets', async () => {
    await priceService.init();
    
    const stats = priceService.getStats();
    
    expect(stats.configuredAssets).toBeGreaterThan(0);
    expect(stats.configuredAssets).toBe(3); // ETH, USDC, LINK
  });

  it('✅ Map dinámico: Construye Map en runtime', async () => {
    await priceService.init();
    
    const assets = priceService.getConfiguredAssets();
    
    // Verificar que es un array (no hardcoded)
    expect(Array.isArray(assets)).toBe(true);
    
    // Verificar que contiene los assets cargados
    const symbols = assets.map(a => a.symbol);
    expect(symbols).toContain('ETH');
    expect(symbols).toContain('USDC');
    expect(symbols).toContain('LINK');
  });

  it('✅ Validación por características: IS_ACTIVE', async () => {
    await priceService.init();
    
    const stats = priceService.getStats();
    
    // Solo 2 activos (ETH, USDC), LINK está deshabilitado
    expect(stats.activeAssets).toBe(2);
    expect(stats.inactiveAssets).toBe(1);
  });

  it('✅ Descubrimiento dinámico: Detecta assets activos', async () => {
    await priceService.init();
    
    const assets = priceService.getConfiguredAssets();
    const activeAssets = assets.filter(a => a.isActive);
    
    expect(activeAssets.length).toBe(2);
    expect(activeAssets.every(a => a.isActive)).toBe(true);
  });

  it('✅ Polimorfismo: OracleSource[] permite múltiples oráculos', async () => {
    await priceService.init();
    
    const stats = priceService.getStats();
    
    // Verificar que hay múltiples fuentes de oráculos
    expect(stats.oracleSources).toBeGreaterThan(0);
    expect(stats.availableSources).toBeGreaterThan(0);
  });

  it('✅ Configuración dinámica: MIN_CONFIDENCE por asset', async () => {
    await priceService.init();
    
    const assets = priceService.getConfiguredAssets();
    
    // Verificar que cada asset tiene su propia configuración
    const ethAsset = assets.find(a => a.symbol === 'ETH');
    const usdcAsset = assets.find(a => a.symbol === 'USDC');
    
    expect(ethAsset?.minConfidence).toBe(0.95);
    expect(usdcAsset?.minConfidence).toBe(0.98); // Mayor confianza para stablecoin
  });

  it('❌ Rechaza asset deshabilitado (IS_ACTIVE = FALSE)', async () => {
    await priceService.init();
    
    // Intentar obtener precio de LINK (deshabilitado)
    await expect(
      priceService.getPrice({ token: 'LINK', blockchain: 'ethereum' })
    ).rejects.toThrow('is disabled');
  });
});

describe('Programación Dinámica - DynamicErrorSystem', () => {
  let errorSystem: DynamicErrorSystem;
  let mockSheetsService: any;

  beforeAll(() => {
    mockSheetsService = {
      readSheet: async (sheetName: string) => {
        if (sheetName === 'ERROR_HANDLING_CONFIG') {
          return [
            {
              ERROR_CODE: 'VALIDATION_ERROR',
              SHOULD_LOG: 'TRUE',
              SHOULD_ALERT: 'FALSE',
              SHOULD_RETRY: 'FALSE',
              MAX_RETRIES: '0',
              RETRY_DELAY: '0',
              CUSTOM_HANDLERS: '',
            },
            {
              ERROR_CODE: 'RPC_ERROR',
              SHOULD_LOG: 'TRUE',
              SHOULD_ALERT: 'TRUE',
              SHOULD_RETRY: 'TRUE',
              MAX_RETRIES: '3',
              RETRY_DELAY: '1000',
              CUSTOM_HANDLERS: 'blockchain_error_handler',
            },
          ];
        }
        return [];
      },
    };

    errorSystem = new DynamicErrorSystem(mockSheetsService);
  });

  it('✅ NO handlers hardcodeados: Array dinámico', async () => {
    await errorSystem.init();
    
    const stats = errorSystem.getStats();
    
    // Verificar que hay handlers registrados
    expect(stats.registeredHandlers).toBeGreaterThan(0);
    
    // Verificar que es un array
    expect(Array.isArray(stats.handlers)).toBe(true);
  });

  it('✅ registerHandler(): Agregar handlers en runtime', async () => {
    await errorSystem.init();
    
    const initialCount = errorSystem.getStats().registeredHandlers;
    
    // Registrar nuevo handler
    errorSystem.registerHandler({
      name: 'test_handler',
      priority: 10,
      canHandle: () => true,
      handle: async () => {},
    });
    
    const newCount = errorSystem.getStats().registeredHandlers;
    
    expect(newCount).toBe(initialCount + 1);
  });

  it('✅ loadErrorConfig(): Carga configuración desde Sheets', async () => {
    await errorSystem.init();
    
    const stats = errorSystem.getStats();
    
    // Verificar que cargó configuraciones
    expect(stats.configuredErrors).toBe(2); // VALIDATION_ERROR, RPC_ERROR
    
    // Verificar configuraciones específicas
    const configs = stats.configs;
    const rpcConfig = configs.find((c: any) => c.errorCode === 'RPC_ERROR');
    
    expect(rpcConfig).toBeDefined();
    expect(rpcConfig.shouldLog).toBe(true);
    expect(rpcConfig.shouldAlert).toBe(true);
    expect(rpcConfig.shouldRetry).toBe(true);
  });

  it('✅ Polimorfismo: Interface ErrorHandler', async () => {
    await errorSystem.init();
    
    const stats = errorSystem.getStats();
    
    // Verificar que todos los handlers tienen name y priority
    stats.handlers.forEach((handler: any) => {
      expect(handler.name).toBeDefined();
      expect(handler.priority).toBeDefined();
      expect(typeof handler.name).toBe('string');
      expect(typeof handler.priority).toBe('number');
    });
  });

  it('✅ Configuración dinámica: SHOULD_RETRY por error', async () => {
    await errorSystem.init();
    
    const stats = errorSystem.getStats();
    const configs = stats.configs;
    
    const validationConfig = configs.find((c: any) => c.errorCode === 'VALIDATION_ERROR');
    const rpcConfig = configs.find((c: any) => c.errorCode === 'RPC_ERROR');
    
    // Validation error no debe reintentar
    expect(validationConfig.shouldRetry).toBe(false);
    
    // RPC error sí debe reintentar
    expect(rpcConfig.shouldRetry).toBe(true);
  });
});

describe('Programación Dinámica - Principios Generales', () => {
  it('✅ NO hardcoding de nombres específicos', () => {
    // Verificar que no hay hardcoding en archivos clave
    const priceServiceCode = require('fs').readFileSync(
      '/home/ubuntu/ARBITRAGEXPLUS2025/services/api-server/src/services/priceService.ts',
      'utf-8'
    );
    
    // No debe tener mapeo fijo de tokens
    expect(priceServiceCode).not.toContain('const TOKEN_MAPPING = {');
    expect(priceServiceCode).not.toContain('if (token === "ETH")');
    
    // Debe usar Map dinámico
    expect(priceServiceCode).toContain('Map<string, OracleAssetConfig>');
  });

  it('✅ Arrays/Maps para colecciones dinámicas', () => {
    const priceServiceCode = require('fs').readFileSync(
      '/home/ubuntu/ARBITRAGEXPLUS2025/services/api-server/src/services/priceService.ts',
      'utf-8'
    );
    
    const errorsCode = require('fs').readFileSync(
      '/home/ubuntu/ARBITRAGEXPLUS2025/services/api-server/src/lib/errors.ts',
      'utf-8'
    );
    
    // PriceService debe usar Map
    expect(priceServiceCode).toContain('private assetsConfig: Map');
    
    // ErrorSystem debe usar Array
    expect(errorsCode).toContain('private handlers: ErrorHandler[]');
  });

  it('✅ Interfaces abstractas y polimorfismo', () => {
    const priceServiceCode = require('fs').readFileSync(
      '/home/ubuntu/ARBITRAGEXPLUS2025/services/api-server/src/services/priceService.ts',
      'utf-8'
    );
    
    const errorsCode = require('fs').readFileSync(
      '/home/ubuntu/ARBITRAGEXPLUS2025/services/api-server/src/lib/errors.ts',
      'utf-8'
    );
    
    // Debe tener interfaces
    expect(priceServiceCode).toContain('export interface OracleSource');
    expect(errorsCode).toContain('export interface ErrorHandler');
  });

  it('✅ Descubrimiento dinámico de capacidades', () => {
    const priceServiceCode = require('fs').readFileSync(
      '/home/ubuntu/ARBITRAGEXPLUS2025/services/api-server/src/services/priceService.ts',
      'utf-8'
    );
    
    // Debe tener método de carga dinámica
    expect(priceServiceCode).toContain('async loadAssetsConfig()');
    expect(priceServiceCode).toContain('await this.sheetsService.readSheet');
  });

  it('✅ Configuración desde Google Sheets', () => {
    const priceServiceCode = require('fs').readFileSync(
      '/home/ubuntu/ARBITRAGEXPLUS2025/services/api-server/src/services/priceService.ts',
      'utf-8'
    );
    
    const errorsCode = require('fs').readFileSync(
      '/home/ubuntu/ARBITRAGEXPLUS2025/services/api-server/src/lib/errors.ts',
      'utf-8'
    );
    
    // Debe leer desde Sheets
    expect(priceServiceCode).toContain('ORACLE_ASSETS');
    expect(errorsCode).toContain('ERROR_HANDLING_CONFIG');
  });

  it('✅ Headers documentan Programación Dinámica', () => {
    const priceServiceCode = require('fs').readFileSync(
      '/home/ubuntu/ARBITRAGEXPLUS2025/services/api-server/src/services/priceService.ts',
      'utf-8'
    );
    
    const errorsCode = require('fs').readFileSync(
      '/home/ubuntu/ARBITRAGEXPLUS2025/services/api-server/src/lib/errors.ts',
      'utf-8'
    );
    
    // Debe tener sección de DP en header
    expect(priceServiceCode).toContain('🧬 PROGRAMACIÓN DINÁMICA APLICADA:');
    expect(errorsCode).toContain('🧬 PROGRAMACIÓN DINÁMICA APLICADA:');
  });
});

describe('Programación Dinámica - Anti-Patterns', () => {
  it('❌ NO debe tener switch/case con nombres hardcodeados', () => {
    const priceServiceCode = require('fs').readFileSync(
      '/home/ubuntu/ARBITRAGEXPLUS2025/services/api-server/src/services/priceService.ts',
      'utf-8'
    );
    
    // No debe tener switch con tokens específicos
    const hasSwitchToken = /switch\s*\(token\)/i.test(priceServiceCode);
    expect(hasSwitchToken).toBe(false);
  });

  it('❌ NO debe tener if/else con nombres específicos', () => {
    const priceServiceCode = require('fs').readFileSync(
      '/home/ubuntu/ARBITRAGEXPLUS2025/services/api-server/src/services/priceService.ts',
      'utf-8'
    );
    
    // No debe tener if con tokens específicos
    const hasIfToken = /if\s*\(.*===\s*['"]ETH['"]\)/i.test(priceServiceCode);
    expect(hasIfToken).toBe(false);
  });

  it('❌ NO debe tener arrays fijos de nombres', () => {
    const priceServiceCode = require('fs').readFileSync(
      '/home/ubuntu/ARBITRAGEXPLUS2025/services/api-server/src/services/priceService.ts',
      'utf-8'
    );
    
    // No debe tener arrays fijos como ['ETH', 'USDC', ...]
    const hasFixedArray = /const\s+TOKENS\s*=\s*\[['"]ETH['"]/i.test(priceServiceCode);
    expect(hasFixedArray).toBe(false);
  });
});

