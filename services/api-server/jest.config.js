/**
 * ============================================================================
 * ARCHIVO: ./services/api-server/jest.config.js
 * SERVICIO: api-server
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 * 
 * 🔄 TRANSFORMACIÓN:
 * 
 * 📤 SALIDA DE DATOS:
 * 
 * 🔗 DEPENDENCIAS:
 * 
 * ============================================================================
 */

/**
 * Jest Configuration for API Server Tests
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test', '<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^@adapters/(.*)$': '<rootDir>/src/adapters/$1',
    '^@oracles/(.*)$': '<rootDir>/src/oracles/$1',
    '^@lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@types$': '<rootDir>/src/types/index.ts',
    '^@logger$': '<rootDir>/src/lib/logger.ts',
    '^@errors$': '<rootDir>/src/lib/errors.ts',
    '^@utils$': '<rootDir>/src/lib/utils.ts',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/types/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThresholds: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testTimeout: 30000,
  verbose: true,
  bail: false,
  maxWorkers: '50%',
};

