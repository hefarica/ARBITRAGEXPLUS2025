import { google } from 'googleapis';
import { Logger } from '../lib/logger';
import { ApiError } from '../lib/errors';

/**
 * ARBITRAGEXPLUS2025 - Google Sheets Service
 * 
 * Servicio que maneja toda la comunicación con Google Sheets.
 * Este es el componente más crítico del sistema ya que Google Sheets
 * funciona como el "cerebro operativo" que controla toda la configuración.
 * 
 * Funcionalidades:
 * - Leer configuración dinámica desde las 8 hojas del sistema
 * - Escribir resultados de ejecuciones automáticamente
 * - Sincronizar cambios en tiempo real
 * - Validar integridad de datos
 * - Manejar 1016 campos distribuidos en 8 hojas especializadas
 */

interface SheetConfig {
  name: string;
  range: string;
  expectedColumns: number;
  keyField: string;
}

interface ExecutionRecord {
  execution_id: string;
  route_id: string;
  transaction_hash: string;
  block_number: number;
  timestamp: Date;
  input_token: string;
  output_token: string;
  input_amount: number;
  output_amount: number;
  gas_used: number;
  gas_price: number;
  total_cost_usd: number;
  profit_usd: number;
  roi_realized: number;
  execution_status: string;
  error_message?: string;
}

export class SheetsService {
  private sheets: any;
  private logger: Logger;
  private spreadsheetId: string;
  private lastUpdateTime: Map<string, Date> = new Map();
  private dataCache: Map<string, any[]> = new Map();
  private cacheTimeout: number = 30000; // 30 segundos

  // Configuración de las 8 hojas del sistema
  private readonly SHEET_CONFIGS: Record<string, SheetConfig> = {
    BLOCKCHAINS: {
      name: 'BLOCKCHAINS',
      range: 'A:AX', // 50 columnas (A-AX)
      expectedColumns: 50,
      keyField: 'CHAIN_ID'
    },
    DEXES: {
      name: 'DEXES',
      range: 'A:GR', // 200 columnas (A-GR)
      expectedColumns: 200,
      keyField: 'DEX_ID'
    },
    ASSETS: {
      name: 'ASSETS',
      range: 'A:OL', // 400 columnas (A-OL)
      expectedColumns: 400,
      keyField: 'TOKEN_SYMBOL'
    },
    POOLS: {
      name: 'POOLS',
      range: 'A:CV', // 100 columnas (A-CV)
      expectedColumns: 100,
      keyField: 'POOL_ID'
    },
    ROUTES: {
      name: 'ROUTES',
      range: 'A:GR', // 200 columnas (A-GR)
      expectedColumns: 200,
      keyField: 'ROUTE_ID'
    },
    EXECUTIONS: {
      name: 'EXECUTIONS',
      range: 'A:AX', // 50 columnas (A-AX)
      expectedColumns: 50,
      keyField: 'EXECUTION_ID'
    },
    CONFIG: {
      name: 'CONFIG',
      range: 'A:G', // 7 columnas (A-G)
      expectedColumns: 7,
      keyField: 'CONFIG_KEY'
    },
    ALERTS: {
      name: 'ALERTS',
      range: 'A:I', // 9 columnas (A-I)
      expectedColumns: 9,
      keyField: 'ALERT_ID'
    }
  };

  constructor() {
    this.logger = new Logger('SheetsService');
    this.spreadsheetId = process.env.SPREADSHEET_ID || '';
    
    if (!this.spreadsheetId) {
      throw new ApiError('SPREADSHEET_ID environment variable is required', 500);
    }
  }

  /**
   * Inicializar conexión con Google Sheets
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('🔗 Inicializando conexión con Google Sheets...');
      
      // Configurar autenticación
      const auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.readonly'
        ]
      });

      const authClient = await auth.getClient();
      this.sheets = google.sheets({ version: 'v4', auth: authClient });

      // Validar acceso al spreadsheet
      await this.validateSpreadsheetAccess();
      
      // Validar estructura de todas las hojas
      await this.validateSheetStructures();
      
      this.logger.info('✅ Conexión con Google Sheets establecida correctamente');
      this.logger.info(`📊 Spreadsheet ID: ${this.spreadsheetId}`);
      
    } catch (error) {
      this.logger.error('❌ Error inicializando Google Sheets:', error);
      throw new ApiError('Failed to initialize Google Sheets connection', 500);
    }
  }

  /**
   * Validar acceso al spreadsheet
   */
  private async validateSpreadsheetAccess(): Promise<void> {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
        fields: 'properties.title,sheets.properties.title'
      });

      const title = response.data.properties?.title;
      const sheetTitles = response.data.sheets?.map((sheet: any) => sheet.properties?.title) || [];
      
      this.logger.info(`📋 Spreadsheet: "${title}"`);
      this.logger.info(`📄 Hojas disponibles: ${sheetTitles.join(', ')}`);
      
      // Verificar que existan las 8 hojas requeridas
      const missingSheets = Object.keys(this.SHEET_CONFIGS).filter(
        sheetName => !sheetTitles.includes(sheetName)
      );
      
      if (missingSheets.length > 0) {
        throw new ApiError(`Missing required sheets: ${missingSheets.join(', ')}`, 500);
      }
      
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Cannot access spreadsheet: ${error.message}`, 500);
    }
  }

  /**
   * Validar estructura de todas las hojas
   */
  private async validateSheetStructures(): Promise<void> {
    this.logger.info('🔍 Validando estructura de hojas...');
    
    for (const [sheetName, config] of Object.entries(this.SHEET_CONFIGS)) {
      try {
        await this.validateSheetStructure(sheetName, config);
      } catch (error) {
        this.logger.error(`❌ Error validando hoja ${sheetName}:`, error);
        throw error;
      }
    }
    
    this.logger.info('✅ Todas las hojas tienen estructura válida');
  }

  /**
   * Validar estructura de una hoja específica
   */
  private async validateSheetStructure(sheetName: string, config: SheetConfig): Promise<void> {
    try {
      // Obtener solo la primera fila (encabezados)
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!1:1`
      });

      const headers = response.data.values?.[0] || [];
      const actualColumns = headers.length;
      
      if (actualColumns !== config.expectedColumns) {
        this.logger.warn(
          `⚠️ ${sheetName}: Esperadas ${config.expectedColumns} columnas, encontradas ${actualColumns}`
        );
      }
      
      // Verificar que existe el campo clave
      const keyFieldIndex = headers.indexOf(config.keyField);
      if (keyFieldIndex === -1) {
        throw new ApiError(`Key field ${config.keyField} not found in ${sheetName}`, 500);
      }
      
      this.logger.debug(`✅ ${sheetName}: ${actualColumns} columnas, campo clave en posición ${keyFieldIndex}`);
      
    } catch (error) {
      throw new ApiError(`Failed to validate ${sheetName} structure: ${error.message}`, 500);
    }
  }

  /**
   * Obtener datos de una hoja específica con cache
   */
  async getSheetData(sheetName: string): Promise<any[]> {
    try {
      // Verificar cache
      const cached = this.getCachedData(sheetName);
      if (cached) {
        return cached;
      }

      const config = this.SHEET_CONFIGS[sheetName];
      if (!config) {
        throw new ApiError(`Unknown sheet: ${sheetName}`, 400);
      }

      this.logger.debug(`📥 Obteniendo datos de ${sheetName}...`);

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!${config.range}`,
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING'
      });

      const rows = response.data.values || [];
      
      if (rows.length === 0) {
        this.logger.warn(`⚠️ Hoja ${sheetName} está vacía`);
        return [];
      }

      // Primera fila son los encabezados
      const headers = rows[0];
      const data = rows.slice(1);

      // Convertir filas a objetos
      const objects = data.map((row: any[]) => {
        const obj: any = {};
        headers.forEach((header: string, index: number) => {
          if (header && header.trim()) {
            obj[header.trim()] = row[index] !== undefined ? row[index] : '';
          }
        });
        return obj;
      }).filter((obj: any) => {
        // Filtrar filas vacías (donde el campo clave está vacío)
        return obj[config.keyField] && obj[config.keyField].toString().trim() !== '';
      });

      // Guardar en cache
      this.setCachedData(sheetName, objects);
      
      this.logger.debug(`✅ ${sheetName}: ${objects.length} registros cargados`);
      return objects;

    } catch (error) {
      this.logger.error(`❌ Error obteniendo datos de ${sheetName}:`, error);
      throw new ApiError(`Failed to get ${sheetName} data: ${error.message}`, 500);
    }
  }

  /**
   * Obtener configuración del sistema desde la hoja CONFIG
   */
  async getSystemConfig(): Promise<Map<string, any>> {
    const configData = await this.getSheetData('CONFIG');
    const configMap = new Map<string, any>();

    configData.forEach((row: any) => {
      if (row.CONFIG_KEY) {
        configMap.set(row.CONFIG_KEY, {
          value: row.CONFIG_VALUE,
          type: row.CONFIG_TYPE || 'string',
          description: row.CONFIG_DESCRIPTION || '',
          isActive: row.IS_ACTIVE !== false,
          lastModified: row.LAST_MODIFIED ? new Date(row.LAST_MODIFIED) : new Date(),
          modifiedBy: row.MODIFIED_BY || 'SYSTEM'
        });
      }
    });

    return configMap;
  }

  /**
   * Registrar una ejecución en la hoja EXECUTIONS
   */
  async recordExecution(execution: ExecutionRecord): Promise<void> {
    try {
      this.logger.info(`💾 Registrando ejecución ${execution.execution_id}...`);

      const values = [
        [
          execution.execution_id,
          execution.route_id,
          execution.transaction_hash || '',
          execution.block_number || 0,
          execution.timestamp.toISOString(),
          execution.input_token,
          execution.output_token,
          execution.input_amount,
          execution.output_amount || 0,
          execution.gas_used || 0,
          execution.gas_price || 0,
          execution.total_cost_usd || 0,
          execution.profit_usd || 0,
          execution.roi_realized || 0,
          execution.execution_status,
          execution.error_message || ''
        ]
      ];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'EXECUTIONS!A:P',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: values
        }
      });

      // Invalidar cache de EXECUTIONS
      this.clearCache('EXECUTIONS');
      
      this.logger.info(`✅ Ejecución ${execution.execution_id} registrada correctamente`);

    } catch (error) {
      this.logger.error(`❌ Error registrando ejecución:`, error);
      throw new ApiError(`Failed to record execution: ${error.message}`, 500);
    }
  }

  /**
   * Crear una alerta en la hoja ALERTS
   */
  async createAlert(alertData: {
    alertId: string;
    alertType: string;
    severity: 'INFO' | 'WARNING' | 'ERROR';
    message: string;
    actionRequired?: boolean;
  }): Promise<void> {
    try {
      const values = [
        [
          alertData.alertId,
          alertData.alertType,
          alertData.severity,
          alertData.message,
          new Date().toISOString(), // TRIGGERED_AT
          false, // IS_RESOLVED
          '', // RESOLVED_AT
          '', // NOTES
          alertData.actionRequired || false // ACTION_REQUIRED
        ]
      ];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'ALERTS!A:I',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: values
        }
      });

      // Invalidar cache de ALERTS
      this.clearCache('ALERTS');
      
      this.logger.info(`🚨 Alerta creada: ${alertData.alertType} - ${alertData.severity}`);

    } catch (error) {
      this.logger.error(`❌ Error creando alerta:`, error);
      throw new ApiError(`Failed to create alert: ${error.message}`, 500);
    }
  }

  /**
   * Actualizar una ruta en la hoja ROUTES
   */
  async updateRoute(routeId: string, updates: Partial<any>): Promise<void> {
    try {
      // Primero obtener la fila de la ruta
      const routes = await this.getSheetData('ROUTES');
      const routeIndex = routes.findIndex((route: any) => route.ROUTE_ID === routeId);
      
      if (routeIndex === -1) {
        throw new ApiError(`Route ${routeId} not found`, 404);
      }

      // Obtener encabezados para mapear columnas
      const headersResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'ROUTES!1:1'
      });
      
      const headers = headersResponse.data.values?.[0] || [];
      
      // Preparar actualizaciones por columna
      const updateRequests = [];
      
      for (const [field, value] of Object.entries(updates)) {
        const columnIndex = headers.indexOf(field);
        if (columnIndex !== -1) {
          const range = `ROUTES!${this.columnIndexToLetter(columnIndex)}${routeIndex + 2}`;
          updateRequests.push({
            range: range,
            values: [[value]]
          });
        }
      }

      // Ejecutar todas las actualizaciones
      if (updateRequests.length > 0) {
        await this.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: {
            valueInputOption: 'USER_ENTERED',
            data: updateRequests
          }
        });

        // Invalidar cache
        this.clearCache('ROUTES');
        
        this.logger.info(`✅ Ruta ${routeId} actualizada: ${Object.keys(updates).join(', ')}`);
      }

    } catch (error) {
      this.logger.error(`❌ Error actualizando ruta ${routeId}:`, error);
      throw new ApiError(`Failed to update route: ${error.message}`, 500);
    }
  }

  /**
   * Obtener historial de ejecuciones con filtros
   */
  async getExecutions(filters: {
    limit?: number;
    offset?: number;
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<any[]> {
    try {
      let executions = await this.getSheetData('EXECUTIONS');

      // Aplicar filtros
      if (filters.status) {
        executions = executions.filter((exec: any) => exec.EXECUTION_STATUS === filters.status);
      }

      if (filters.dateFrom) {
        executions = executions.filter((exec: any) => {
          const execDate = new Date(exec.TIMESTAMP);
          return execDate >= filters.dateFrom!;
        });
      }

      if (filters.dateTo) {
        executions = executions.filter((exec: any) => {
          const execDate = new Date(exec.TIMESTAMP);
          return execDate <= filters.dateTo!;
        });
      }

      // Ordenar por timestamp descendente
      executions.sort((a: any, b: any) => {
        const dateA = new Date(a.TIMESTAMP);
        const dateB = new Date(b.TIMESTAMP);
        return dateB.getTime() - dateA.getTime();
      });

      // Aplicar paginación
      const offset = filters.offset || 0;
      const limit = filters.limit || 50;
      
      return executions.slice(offset, offset + limit);

    } catch (error) {
      this.logger.error('❌ Error obteniendo ejecuciones:', error);
      throw new ApiError(`Failed to get executions: ${error.message}`, 500);
    }
  }

  /**
   * Verificar salud de la conexión
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
        fields: 'properties.title'
      });
      
      return true;
    } catch (error) {
      this.logger.error('❌ Health check fallido:', error);
      return false;
    }
  }

  // ==================================================================================
  // MÉTODOS PRIVADOS DE UTILIDAD
  // ==================================================================================

  /**
   * Obtener datos del cache si están vigentes
   */
  private getCachedData(sheetName: string): any[] | null {
    const cached = this.dataCache.get(sheetName);
    const lastUpdate = this.lastUpdateTime.get(sheetName);
    
    if (cached && lastUpdate) {
      const now = new Date();
      const timeDiff = now.getTime() - lastUpdate.getTime();
      
      if (timeDiff < this.cacheTimeout) {
        this.logger.debug(`📦 Usando cache para ${sheetName} (${Math.round(timeDiff / 1000)}s)`);
        return cached;
      }
    }
    
    return null;
  }

  /**
   * Guardar datos en cache
   */
  private setCachedData(sheetName: string, data: any[]): void {
    this.dataCache.set(sheetName, data);
    this.lastUpdateTime.set(sheetName, new Date());
  }

  /**
   * Limpiar cache de una hoja específica
   */
  private clearCache(sheetName: string): void {
    this.dataCache.delete(sheetName);
    this.lastUpdateTime.delete(sheetName);
  }

  /**
   * Limpiar todo el cache
   */
  public clearAllCache(): void {
    this.dataCache.clear();
    this.lastUpdateTime.clear();
    this.logger.info('🗑️ Cache completo limpiado');
  }

  /**
   * Convertir índice de columna a letra (0 = A, 1 = B, etc.)
   */
  private columnIndexToLetter(index: number): string {
    let result = '';
    while (index >= 0) {
      result = String.fromCharCode((index % 26) + 65) + result;
      index = Math.floor(index / 26) - 1;
    }
    return result;
  }

  /**
   * Obtener estadísticas del servicio
   */
  public getStats(): any {
    return {
      spreadsheetId: this.spreadsheetId,
      cachedSheets: Array.from(this.dataCache.keys()),
      cacheTimeout: this.cacheTimeout,
      lastUpdates: Object.fromEntries(this.lastUpdateTime),
      configuredSheets: Object.keys(this.SHEET_CONFIGS)
    };
  }
}