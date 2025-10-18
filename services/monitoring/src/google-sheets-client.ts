/**
 * @file google-sheets-client.ts
 * @description Cliente stub para Google Sheets (usar implementación de python-collector)
 */

export class GoogleSheetsClient {
  async addExecution(data: any): Promise<void> {
    // Stub - implementar usando la lógica de services/python-collector/src/sheets/client.py
    console.log('Adding execution to Sheets:', data);
  }
  
  async addAlert(data: any): Promise<void> {
    // Stub - implementar usando la lógica de services/python-collector/src/sheets/client.py
    console.log('Adding alert to Sheets:', data);
  }
  
  async getChainConfigs(): Promise<any[]> {
    // Stub - implementar usando la lógica de services/python-collector/src/sheets/client.py
    return [];
  }
}

