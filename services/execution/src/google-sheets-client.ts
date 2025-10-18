/**
 * ============================================================================
 * ARCHIVO: ./services/execution/src/google-sheets-client.ts
 * SERVICIO: execution
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 * 
 * 🔄 TRANSFORMACIÓN:
 *   CLASES: GoogleSheetsClient
 * 
 * 📤 SALIDA DE DATOS:
 *   EXPORTS: GoogleSheetsClient
 * 
 * 🔗 DEPENDENCIAS:
 * 
 * ============================================================================
 */

/**
 * @file google-sheets-client.ts
 * @description Cliente para integración con Google Sheets (stub - usar implementación de python-collector)
 */

export class GoogleSheetsClient {
  async getBlockchains(): Promise<any[]> {
    // Stub - implementar usando la lógica de services/python-collector/src/sheets/client.py
    return [];
  }
  
  async getRoutes(): Promise<any[]> {
    // Stub - implementar usando la lógica de services/python-collector/src/sheets/client.py
    return [];
  }
  
  async updateExecutions(results: any[]): Promise<void> {
    // Stub - implementar usando la lógica de services/python-collector/src/sheets/client.py
  }
}

