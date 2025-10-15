
import os
import json
import base64
from google.oauth2 import service_account
from googleapiclient.discovery import build

class SheetsClient:
    def __init__(self, spreadsheet_id):
        self.spreadsheet_id = spreadsheet_id

        self.service = self._authenticate()

    def _authenticate(self):
        creds_b64 = os.getenv('GOOGLE_SHEETS_CREDENTIALS_BASE64')
        if not creds_b64:
            raise ValueError("GOOGLE_SHEETS_CREDENTIALS_BASE64 environment variable not set.")
        creds_info = json.loads(base64.b64decode(creds_b64).decode('utf-8'))
        creds = service_account.Credentials.from_service_account_info(
            creds_info,
            scopes=['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
        )
        return build('sheets', 'v4', credentials=creds)

    def read_values(self, range_name):
        try:
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id, range=range_name).execute()
            return result.get('values', [])
        except Exception as e:
            print(f"Error reading from sheet {range_name}: {e}")
            return []

    def write_values(self, range_name, values):
        try:
            body = {
                'values': values
            }
            result = self.service.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id, range=range_name,
                valueInputOption='RAW', body=body).execute()
            return result
        except Exception as e:
            print(f"Error writing to sheet {range_name}: {e}")
            return None

    def batch_update(self, requests):
        try:
            body = {
                'requests': requests
            }
            result = self.service.spreadsheets().batchUpdate(
                spreadsheetId=self.spreadsheet_id, body=body).execute()
            return result
        except Exception as e:
            print(f"Error batch updating sheet: {e}")
            return None

    def ensure_sheet_exists(self, sheet_name):
        try:
            spreadsheet_metadata = self.service.spreadsheets().get(
                spreadsheetId=self.spreadsheet_id).execute()
            sheets = spreadsheet_metadata.get('sheets', [])
            existing_sheet_names = [s['properties']['title'] for s in sheets]

            if sheet_name not in existing_sheet_names:
                requests = [{
                    'addSheet': {
                        'properties': {
                            'title': sheet_name
                        }
                    }
                }]
                self.batch_update(requests)
                print(f"Sheet '{sheet_name}' created successfully.")
            else:
                print(f"Sheet '{sheet_name}' already exists.")
            return True
        except Exception as e:
            print(f"Error ensuring sheet '{sheet_name}' exists: {e}")
            return False

# Example Usage (for local testing, not part of the deployed service)
# if __name__ == '__main__':
#     # Ensure you have a .env file or set these environment variables
#     # SPREADSHEET_ID = os.getenv('SPREADSHEET_ID')
#     # GOOGLE_APPLICATION_CREDENTIALS = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')

#     # For demonstration, replace with actual values or load from .env
#     SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID'
#     GOOGLE_APPLICATION_CREDENTIALS = '../../keys/gsheets-sa.json' # Adjust path as needed

#     if not SPREADSHEET_ID or not GOOGLE_APPLICATION_CREDENTIALS:
#         print("Please set SPREADSHEET_ID and GOOGLE_APPLICATION_CREDENTIALS environment variables.")
#     else:
#         client = SheetsClient(SPREADSHEET_ID, GOOGLE_APPLICATION_CREDENTIALS)

#         # Example: Read from a sheet
#         # data = client.read_values('CONFIG_GENERAL!A1:B10')
#         # print("Read Data:", data)

#         # Example: Write to a sheet
#         # client.write_values('Hoja5!A1', [['Hello', 'World'], ['From', 'Python']])

#         # Example: Ensure a sheet exists
#         # client.ensure_sheet_exists('NewSheetForData')

