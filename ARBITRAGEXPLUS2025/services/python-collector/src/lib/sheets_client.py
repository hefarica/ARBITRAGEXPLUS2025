"""
============================================================================
ARCHIVO: ./ARBITRAGEXPLUS2025/services/python-collector/src/lib/sheets_client.py
============================================================================

📥 ENTRADA DE DATOS:

🔄 TRANSFORMACIÓN:
  CLASES: GoogleSheetsClient
  FUNCIONES: write_values, ensure_sheet_exists, _authenticate

📤 SALIDA DE DATOS:

🔗 DEPENDENCIAS:
  - google.oauth2
  - service_account
  - a

============================================================================
"""

import gspread
from google.oauth2 import service_account
import os

class GoogleSheetsClient:
    def __init__(self, spreadsheet_id, credentials_path):
        self.spreadsheet_id = spreadsheet_id
        self.credentials_path = credentials_path
        self.client = self._authenticate()

    def _authenticate(self):
        scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
        creds = service_account.Credentials.from_service_account_file(self.credentials_path, scopes=scope)
        return gspread.authorize(creds)

    def get_worksheet(self, worksheet_name):
        spreadsheet = self.client.open_by_key(self.spreadsheet_id)
        return spreadsheet.worksheet(worksheet_name)

    def read_values(self, worksheet_name, range_name):
        worksheet = self.get_worksheet(worksheet_name)
        return worksheet.range(range_name)

    def write_values(self, worksheet_name, range_name, values):
        worksheet = self.get_worksheet(worksheet_name)
        worksheet.update(range_name, values)

    def ensure_sheet_exists(self, spreadsheet_name, worksheet_name):
        try:
            spreadsheet = self.client.open(spreadsheet_name)
        except gspread.exceptions.SpreadsheetNotFound:
            spreadsheet = self.client.create(spreadsheet_name)
            spreadsheet.share(self.client.auth.service_account_email, perm_type='user', role='writer')

        try:
            worksheet = spreadsheet.worksheet(worksheet_name)
        except gspread.exceptions.WorksheetNotFound:
            worksheet = spreadsheet.add_worksheet(title=worksheet_name, rows="100", cols="20")
        return worksheet

# Example Usage (for testing purposes)
if __name__ == "__main__":
    # These should ideally come from environment variables or a config file
    SPREADSHEET_ID = os.getenv("SPREADSHEET_ID")
    GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

    if not SPREADSHEET_ID or not GOOGLE_APPLICATION_CREDENTIALS:
        print("Please set SPREADSHEET_ID and GOOGLE_APPLICATION_CREDENTIALS environment variables.")
        exit(1)

    # Ensure the keys directory exists
    keys_dir = os.path.dirname(GOOGLE_APPLICATION_CREDENTIALS)
    if not os.path.exists(keys_dir):
        os.makedirs(keys_dir)

    # Placeholder for service account JSON content (replace with actual content)
    # For security, this should be loaded from a file or environment variable, not hardcoded.
    # Example: with open(GOOGLE_APPLICATION_CREDENTIALS, 'w') as f: f.write(os.getenv('SERVICE_ACCOUNT_JSON_CONTENT'))

    client = GoogleSheetsClient(SPREADSHEET_ID, GOOGLE_APPLICATION_CREDENTIALS)

    # Example: Read values from a sheet
    try:
        params_range = client.read_values("Parametros", "A1:D20")
        print("Parameters:", params_range)
    except Exception as e:
        print(f"Error reading parameters: {e}")

    # Example: Write values to a sheet
    try:
        client.write_values("Hoja 5", "A1", [["Test Data", "123"], ["More Data", "456"]])
        print("Data written to Hoja 5")
    except Exception as e:
        print(f"Error writing to Hoja 5: {e}")

    # Example: Ensure a sheet exists
    try:
        client.ensure_sheet_exists("ARBITRAGEXPLUS", "NewSheet")
        print("Ensured NewSheet exists in ARBITRAGEXPLUS")
    except Exception as e:
        print(f"Error ensuring sheet exists: {e}")

