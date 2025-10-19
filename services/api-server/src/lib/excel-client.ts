/**
 * 📥 ENTRADAS: Archivo Excel (ARBITRAGEXPLUS2025.xlsx)
 * 🔄 TRANSFORMACIONES: Cliente para leer/escribir Excel con API compatible con GoogleSheetsClient
 * 📤 SALIDAS: Datos de hojas Excel (ORACLE_ASSETS, PARAMETROS, etc.)
 * 🔗 DEPENDENCIAS: exceljs
 * 
 * 🎯 PROGRAMACIÓN DINÁMICA:
 * - ❌ NO hardcoding de rutas → Configurable vía env var
 * - ✅ Carga dinámica de hojas por nombre
 * - ✅ Thread-safe con locks para escritura concurrente
 * - ✅ API compatible con GoogleSheetsClient (drop-in replacement)
 */

import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

export interface CellValue {
  value: string | number | boolean | Date | null;
}

export interface SheetData {
  [key: string]: string | number | boolean | Date | null;
}

export class ExcelClient {
  private excelPath: string;
  private workbook: ExcelJS.Workbook | null = null;
  private isLocked: boolean = false;

  constructor(excelPath?: string) {
    this.excelPath = excelPath || process.env.EXCEL_FILE_PATH || 
      '/home/ubuntu/ARBITRAGEXPLUS2025/data/ARBITRAGEXPLUS2025.xlsx';
    
    if (!fs.existsSync(this.excelPath)) {
      throw new Error(`Excel file not found: ${this.excelPath}`);
    }
    
    console.log(`ExcelClient initialized with file: ${this.excelPath}`);
  }

  /**
   * Carga el workbook desde el archivo
   */
  private async loadWorkbook(): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(this.excelPath);
    return workbook;
  }

  /**
   * Guarda el workbook al archivo
   */
  private async saveWorkbook(workbook: ExcelJS.Workbook): Promise<void> {
    // Simple lock mechanism
    while (this.isLocked) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.isLocked = true;
    try {
      await workbook.xlsx.writeFile(this.excelPath);
    } finally {
      this.isLocked = false;
    }
  }

  /**
   * Lee un rango de celdas del Excel
   * 
   * @param rangeNotation - Notación de rango (ej: "ORACLE_ASSETS!A1:M100")
   * @returns Array de arrays con los valores de las celdas
   * 
   * @example
   * const client = new ExcelClient();
   * const data = await client.getRange("ORACLE_ASSETS!A1:M100");
   * console.log(data[0]); // Primera fila (headers)
   */
  async getRange(rangeNotation: string): Promise<any[][]> {
    const { sheetName, cellRange } = this.parseRangeNotation(rangeNotation);
    
    const workbook = await this.loadWorkbook();
    const worksheet = workbook.getWorksheet(sheetName);
    
    if (!worksheet) {
      throw new Error(`Sheet '${sheetName}' not found in workbook`);
    }

    const values: any[][] = [];
    const range = worksheet.getCell(cellRange);
    
    // Parse range (ej: "A1:M100")
    const [startCell, endCell] = cellRange.split(':');
    const startRef = this.parseCellAddress(startCell);
    const endRef = this.parseCellAddress(endCell);

    // Leer valores del rango
    for (let row = startRef.row; row <= endRef.row; row++) {
      const rowValues: any[] = [];
      for (let col = startRef.col; col <= endRef.col; col++) {
        const cell = worksheet.getCell(row, col);
        rowValues.push(cell.value !== null && cell.value !== undefined ? cell.value : '');
      }
      values.push(rowValues);
    }

    console.log(`Read ${values.length} rows from ${rangeNotation}`);
    return values;
  }

  /**
   * Actualiza un rango de celdas en Excel
   * 
   * @param rangeNotation - Notación de rango (ej: "RESULTADOS!A2:O2")
   * @param values - Array de arrays con los valores a escribir
   * 
   * @example
   * const client = new ExcelClient();
   * await client.updateRange("RESULTADOS!A2:O2", [[
   *   new Date(), "BATCH_001", "ethereum", "USDC", "ETH",
   *   10000, 4.02, 50, 0.5, 150000, 15, 35, "0x1234", "SUCCESS", ""
   * ]]);
   */
  async updateRange(rangeNotation: string, values: any[][]): Promise<void> {
    const { sheetName, cellRange } = this.parseRangeNotation(rangeNotation);
    
    const workbook = await this.loadWorkbook();
    const worksheet = workbook.getWorksheet(sheetName);
    
    if (!worksheet) {
      throw new Error(`Sheet '${sheetName}' not found in workbook`);
    }

    // Parse start cell
    const startCell = cellRange.split(':')[0];
    const startRef = this.parseCellAddress(startCell);

    // Escribir valores
    values.forEach((row, rowIdx) => {
      row.forEach((value, colIdx) => {
        const cell = worksheet.getCell(startRef.row + rowIdx, startRef.col + colIdx);
        cell.value = value;
      });
    });

    await this.saveWorkbook(workbook);
    console.log(`Updated ${values.length} rows in ${rangeNotation}`);
  }

  /**
   * Agrega una fila al final de una hoja
   * 
   * @param sheetName - Nombre de la hoja
   * @param values - Array de valores a agregar
   * 
   * @example
   * const client = new ExcelClient();
   * await client.appendRow("RESULTADOS", [
   *   new Date(), "BATCH_002", "polygon", "USDT", "MATIC",
   *   5000, 2500, 25, 0.5, 80000, 5, 20, "0x5678", "SUCCESS", ""
   * ]);
   */
  async appendRow(sheetName: string, values: any[]): Promise<void> {
    const workbook = await this.loadWorkbook();
    const worksheet = workbook.getWorksheet(sheetName);
    
    if (!worksheet) {
      throw new Error(`Sheet '${sheetName}' not found in workbook`);
    }

    worksheet.addRow(values);
    await this.saveWorkbook(workbook);
    console.log(`Appended row to ${sheetName}`);
  }

  /**
   * Lee todos los datos de una hoja y los retorna como array de objetos
   * 
   * @param sheetName - Nombre de la hoja
   * @param skipHeader - Si true, usa la primera fila como headers
   * @returns Array de objetos con los datos
   * 
   * @example
   * const client = new ExcelClient();
   * const assets = await client.getSheetData("ORACLE_ASSETS");
   * console.log(assets[0].SYMBOL); // 'ETH'
   * console.log(assets[0].BLOCKCHAIN); // 'ethereum'
   */
  async getSheetData(sheetName: string, skipHeader: boolean = true): Promise<SheetData[]> {
    const workbook = await this.loadWorkbook();
    const worksheet = workbook.getWorksheet(sheetName);
    
    if (!worksheet) {
      throw new Error(`Sheet '${sheetName}' not found in workbook`);
    }

    const rows: any[][] = [];
    worksheet.eachRow((row, rowNumber) => {
      const values: any[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        values.push(cell.value !== null && cell.value !== undefined ? cell.value : '');
      });
      rows.push(values);
    });

    if (rows.length === 0) {
      return [];
    }

    if (skipHeader) {
      const headers = rows[0];
      const dataRows = rows.slice(1);
      
      return dataRows.map(row => {
        const obj: SheetData = {};
        headers.forEach((header, idx) => {
          obj[String(header)] = row[idx] !== undefined ? row[idx] : '';
        });
        return obj;
      });
    } else {
      return rows.map(row => {
        const obj: SheetData = {};
        row.forEach((value, idx) => {
          obj[idx.toString()] = value;
        });
        return obj;
      });
    }
  }

  /**
   * Actualiza una celda específica
   * 
   * @param sheetName - Nombre de la hoja
   * @param cellAddress - Dirección de la celda (ej: "A1", "B5")
   * @param value - Valor a escribir
   * 
   * @example
   * const client = new ExcelClient();
   * await client.updateCell("ESTADISTICAS", "B2", 150); // TOTAL_BATCHES
   */
  async updateCell(sheetName: string, cellAddress: string, value: any): Promise<void> {
    const workbook = await this.loadWorkbook();
    const worksheet = workbook.getWorksheet(sheetName);
    
    if (!worksheet) {
      throw new Error(`Sheet '${sheetName}' not found in workbook`);
    }

    worksheet.getCell(cellAddress).value = value;
    await this.saveWorkbook(workbook);
    console.log(`Updated cell ${sheetName}!${cellAddress} = ${value}`);
  }

  /**
   * Lee el valor de una celda específica
   * 
   * @param sheetName - Nombre de la hoja
   * @param cellAddress - Dirección de la celda (ej: "A1", "B5")
   * @returns Valor de la celda
   */
  async getCell(sheetName: string, cellAddress: string): Promise<any> {
    const workbook = await this.loadWorkbook();
    const worksheet = workbook.getWorksheet(sheetName);
    
    if (!worksheet) {
      throw new Error(`Sheet '${sheetName}' not found in workbook`);
    }

    const value = worksheet.getCell(cellAddress).value;
    return value !== null && value !== undefined ? value : '';
  }

  /**
   * Limpia un rango de celdas
   * 
   * @param rangeNotation - Notación de rango (ej: "RESULTADOS!A2:O100")
   */
  async clearRange(rangeNotation: string): Promise<void> {
    const { sheetName, cellRange } = this.parseRangeNotation(rangeNotation);
    
    const workbook = await this.loadWorkbook();
    const worksheet = workbook.getWorksheet(sheetName);
    
    if (!worksheet) {
      throw new Error(`Sheet '${sheetName}' not found in workbook`);
    }

    const [startCell, endCell] = cellRange.split(':');
    const startRef = this.parseCellAddress(startCell);
    const endRef = this.parseCellAddress(endCell);

    for (let row = startRef.row; row <= endRef.row; row++) {
      for (let col = startRef.col; col <= endRef.col; col++) {
        worksheet.getCell(row, col).value = null;
      }
    }

    await this.saveWorkbook(workbook);
    console.log(`Cleared range ${rangeNotation}`);
  }

  /**
   * Obtiene la lista de nombres de hojas en el workbook
   * 
   * @returns Array de nombres de hojas
   */
  async getSheetNames(): Promise<string[]> {
    const workbook = await this.loadWorkbook();
    return workbook.worksheets.map(ws => ws.name);
  }

  /**
   * Lee múltiples rangos en una sola operación (batch)
   * 
   * @param ranges - Array de notaciones de rango
   * @returns Objeto con rango como key y datos como value
   * 
   * @example
   * const client = new ExcelClient();
   * const data = await client.batchGet([
   *   "ORACLE_ASSETS!A1:M100",
   *   "PARAMETROS!A1:D20"
   * ]);
   * console.log(data["ORACLE_ASSETS!A1:M100"][0]);
   */
  async batchGet(ranges: string[]): Promise<{ [key: string]: any[][] }> {
    const result: { [key: string]: any[][] } = {};
    
    for (const rangeNotation of ranges) {
      result[rangeNotation] = await this.getRange(rangeNotation);
    }
    
    return result;
  }

  /**
   * Actualiza múltiples rangos en una sola operación (batch)
   * 
   * @param updates - Objeto con rango como key y valores como value
   * 
   * @example
   * const client = new ExcelClient();
   * await client.batchUpdate({
   *   "ESTADISTICAS!B2": [[150]],
   *   "ESTADISTICAS!B3": [[5000]]
   * });
   */
  async batchUpdate(updates: { [key: string]: any[][] }): Promise<void> {
    for (const [rangeNotation, values] of Object.entries(updates)) {
      await this.updateRange(rangeNotation, values);
    }
  }

  // Métodos auxiliares privados

  /**
   * Parsea notación de rango tipo "SheetName!A1:B10"
   * 
   * @returns Objeto con sheetName y cellRange
   */
  private parseRangeNotation(rangeNotation: string): { sheetName: string; cellRange: string } {
    if (!rangeNotation.includes('!')) {
      throw new Error(`Invalid range notation: ${rangeNotation}. Expected format: 'SheetName!A1:B10'`);
    }
    
    const [sheetName, cellRange] = rangeNotation.split('!');
    return { sheetName, cellRange };
  }

  /**
   * Parsea dirección de celda tipo "A1" a {row, col}
   * 
   * @returns Objeto con row y col (1-indexed)
   */
  private parseCellAddress(cellAddress: string): { row: number; col: number } {
    const match = cellAddress.match(/^([A-Z]+)(\d+)$/);
    if (!match) {
      throw new Error(`Invalid cell address: ${cellAddress}`);
    }
    
    const colLetters = match[1];
    const rowNumber = parseInt(match[2], 10);
    
    // Convertir letras de columna a número
    let col = 0;
    for (let i = 0; i < colLetters.length; i++) {
      col = col * 26 + (colLetters.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
    }
    
    return { row: rowNumber, col };
  }
}

// Instancia global (singleton)
let excelClientInstance: ExcelClient | null = null;

/**
 * Obtiene instancia global de ExcelClient (singleton)
 * 
 * @returns Instancia de ExcelClient
 */
export function getExcelClient(): ExcelClient {
  if (!excelClientInstance) {
    excelClientInstance = new ExcelClient();
  }
  return excelClientInstance;
}

// Ejemplo de uso
async function main() {
  const client = new ExcelClient();
  
  // Leer ORACLE_ASSETS
  console.log('📊 Leyendo ORACLE_ASSETS...');
  const assets = await client.getSheetData('ORACLE_ASSETS');
  console.log(`✅ ${assets.length} assets encontrados`);
  console.log(`Primer asset: ${assets[0].SYMBOL} en ${assets[0].BLOCKCHAIN}`);
  
  // Leer PARAMETROS
  console.log('\n⚙️ Leyendo PARAMETROS...');
  const params = await client.getRange('PARAMETROS!A1:D21');
  console.log(`✅ ${params.length - 1} parámetros encontrados`);
  
  // Actualizar estadística
  console.log('\n📈 Actualizando ESTADISTICAS...');
  await client.updateCell('ESTADISTICAS', 'B2', 200);
  console.log('✅ Estadística actualizada');
  
  // Agregar resultado
  console.log('\n📝 Agregando resultado de ejemplo...');
  await client.appendRow('RESULTADOS', [
    new Date(),
    'BATCH_TEST_TS',
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
    '0xtest...ts',
    'SUCCESS',
    'Test from TypeScript'
  ]);
  console.log('✅ Resultado agregado');
  
  console.log('\n🎉 ¡Todas las operaciones completadas exitosamente!');
}

// Ejecutar si es el módulo principal
if (require.main === module) {
  main().catch(console.error);
}

