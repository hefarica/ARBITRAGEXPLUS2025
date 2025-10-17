/**
 * GoogleSheetsClient.ts
 * 
 * Cliente para interactuar con Google Sheets Brain
 * Lee configuración y rutas, escribe resultados de ejecución
 * 
 * @author ARBITRAGEXPLUS2025
 */

import { google, sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';

export interface RouteData {
  routeId: string;
  routeName: string;
  isActive: boolean;
  isProfitable: boolean;
  strategyType: string;
  sourceToken: string;
  targetToken: string;
  dex1: string;
  dex2: string;
  dex3?: string;
  expectedProfitUSD: number;
  expectedROI: number;
  flashLoanProvider?: string;
  amount: string;
  minAmountOut: string;
  minProfit: string;
  maxSlippage: number;
  dex1Router: string;
}

export interface ExecutionData {
  executionId: string;
  routeId: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  isSuccessful: boolean;
  timestamp: string;
  blockNumber: number;
  transactionHash: string;
  profitUSD: number;
  gasUsed: number;
  gasPriceGwei: number;
  errorMessage?: string;
}

export interface ConfigData {
  key: string;
  value: string;
  type: string;
  description: string;
  isActive: boolean;
}

export class GoogleSheetsClient {
  private sheets: sheets_v4.Sheets;
  private spreadsheetId: string;
  private auth: JWT;
  
  constructor() {
    // Autenticación con service account
    this.auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    
    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    this.spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || 
                         process.env.SPREADSHEET_ID || 
                         '';
    
    if (!this.spreadsheetId) {
      throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID not configured');
    }
    
    console.log(`✅ GoogleSheetsClient initialized`);
    console.log(`   Spreadsheet ID: ${this.spreadsheetId}`);
  }
  
  /**
   * Lee rutas desde la hoja ROUTES
   */
  async getRoutes(filters?: {
    isActive?: boolean;
    isProfitable?: boolean;
    minProfitUSD?: number;
    strategyType?: string;
  }): Promise<RouteData[]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'ROUTES!A2:GX1000' // Leer hasta columna GX (201 columnas)
      });
      
      const rows = response.data.values || [];
      
      if (rows.length === 0) {
        console.log('No routes found in ROUTES sheet');
        return [];
      }
      
      // Convertir rows a RouteData
      const routes: RouteData[] = rows.map(row => this.parseRouteRow(row)).filter(r => r !== null) as RouteData[];
      
      // Aplicar filtros
      let filteredRoutes = routes;
      
      if (filters?.isActive !== undefined) {
        filteredRoutes = filteredRoutes.filter(r => r.isActive === filters.isActive);
      }
      
      if (filters?.isProfitable !== undefined) {
        filteredRoutes = filteredRoutes.filter(r => r.isProfitable === filters.isProfitable);
      }
      
      if (filters?.minProfitUSD !== undefined) {
        filteredRoutes = filteredRoutes.filter(r => r.expectedProfitUSD >= filters.minProfitUSD!);
      }
      
      if (filters?.strategyType) {
        filteredRoutes = filteredRoutes.filter(r => r.strategyType === filters.strategyType);
      }
      
      console.log(`📊 Found ${filteredRoutes.length} routes matching filters (${routes.length} total)`);
      
      return filteredRoutes;
      
    } catch (error) {
      console.error('Failed to read routes from Sheets:', error);
      throw error;
    }
  }
  
  /**
   * Escribe resultado de ejecución a la hoja EXECUTIONS
   */
  async writeExecution(execution: ExecutionData): Promise<void> {
    try {
      const row = [
        execution.executionId,
        execution.routeId,
        execution.status,
        execution.isSuccessful ? 'TRUE' : 'FALSE',
        execution.timestamp,
        execution.blockNumber,
        execution.transactionHash,
        '', // INPUT_TOKEN (vacío por ahora)
        '', // OUTPUT_TOKEN
        '', // INPUT_AMOUNT
        '', // OUTPUT_AMOUNT
        execution.profitUSD,
        '', // ROI_PERCENT (calcular si es necesario)
        execution.gasUsed,
        execution.gasPriceGwei,
        '', // GAS_COST_ETH
        '', // GAS_COST_USD
        '', // SLIPPAGE_ACTUAL
        '', // EXECUTION_TIME_MS
        '', // CONFIRMATION_TIME_MS
        execution.errorMessage || ''
      ];
      
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'EXECUTIONS!A:U',
        valueInputOption: 'RAW',
        requestBody: {
          values: [row]
        }
      });
      
      console.log(`✅ Execution ${execution.executionId} written to EXECUTIONS sheet`);
      
    } catch (error) {
      console.error('Failed to write execution to Sheets:', error);
      throw error;
    }
  }
  
  /**
   * Lee configuración desde la hoja CONFIG
   */
  async getConfig(key?: string): Promise<ConfigData[]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'CONFIG!A2:G1000'
      });
      
      const rows = response.data.values || [];
      
      const configs: ConfigData[] = rows.map(row => ({
        key: row[0] || '',
        value: row[1] || '',
        type: row[2] || 'string',
        description: row[3] || '',
        isActive: row[4] === 'TRUE'
      }));
      
      if (key) {
        return configs.filter(c => c.key === key);
      }
      
      return configs;
      
    } catch (error) {
      console.error('Failed to read config from Sheets:', error);
      throw error;
    }
  }
  
  /**
   * Escribe log a la hoja LOGS
   */
  async writeLog(log: {
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
    category: string;
    component: string;
    eventType: string;
    message: string;
    details?: string;
    contextJson?: string;
    errorCode?: string;
    errorMessage?: string;
    routeId?: string;
    txHash?: string;
  }): Promise<void> {
    try {
      const row = [
        `LOG_${Date.now()}`,
        new Date().toISOString(),
        log.level,
        log.category,
        log.component,
        log.eventType,
        log.message,
        log.details || '',
        log.contextJson || '',
        log.errorCode || '',
        log.errorMessage || '',
        '', // STACK_TRACE
        '', // USER_ID
        '', // SESSION_ID
        '', // REQUEST_ID
        '', // EXECUTION_ID
        log.routeId || '',
        '', // STRATEGY_ID
        '', // CHAIN_ID
        '', // DEX_ID
        '', // TOKEN_SYMBOL
        '', // AMOUNT
        log.txHash || ''
      ];
      
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'LOGS!A:AX',
        valueInputOption: 'RAW',
        requestBody: {
          values: [row]
        }
      });
      
    } catch (error) {
      console.error('Failed to write log to Sheets:', error);
      // No throw - logging no debe detener la ejecución
    }
  }
  
  /**
   * Escribe métrica a la hoja METRICS
   */
  async writeMetric(metric: {
    metricName: string;
    category: string;
    type: string;
    unit: string;
    currentValue: number;
    previousValue?: number;
  }): Promise<void> {
    try {
      const changePercent = metric.previousValue 
        ? ((metric.currentValue - metric.previousValue) / metric.previousValue) * 100
        : 0;
      
      const trend = changePercent > 0 ? 'UP' : changePercent < 0 ? 'DOWN' : 'STABLE';
      
      const row = [
        `METRIC_${Date.now()}`,
        metric.metricName,
        metric.category,
        metric.type,
        metric.unit,
        metric.currentValue,
        metric.previousValue || 0,
        changePercent,
        metric.currentValue - (metric.previousValue || 0),
        trend,
        '', // TARGET_VALUE
        '', // THRESHOLD_MIN
        '', // THRESHOLD_MAX
        'FALSE', // IS_CRITICAL
        'FALSE', // ALERT_ENABLED
        '', // ... otros campos
        new Date().toISOString()
      ];
      
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'METRICS!A:BZ',
        valueInputOption: 'RAW',
        requestBody: {
          values: [row]
        }
      });
      
    } catch (error) {
      console.error('Failed to write metric to Sheets:', error);
    }
  }
  
  /**
   * Parsea una fila de la hoja ROUTES
   */
  private parseRouteRow(row: any[]): RouteData | null {
    try {
      return {
        routeId: row[0] || '',
        routeName: row[1] || '',
        isActive: row[2] === 'TRUE',
        isProfitable: row[3] === 'TRUE',
        strategyType: row[4] || '',
        sourceToken: row[7] || '',
        targetToken: row[8] || '',
        dex1: row[10] || '',
        dex2: row[11] || '',
        dex3: row[12] || undefined,
        expectedProfitUSD: parseFloat(row[13]) || 0,
        expectedROI: parseFloat(row[14]) || 0,
        flashLoanProvider: row[15] || undefined,
        amount: '1', // Simplificado
        minAmountOut: '0.95', // Simplificado
        minProfit: '0.01', // Simplificado
        maxSlippage: 0.01, // 1%
        dex1Router: '' // Obtener de DEXES sheet
      };
    } catch (error) {
      console.error('Failed to parse route row:', error);
      return null;
    }
  }
}

