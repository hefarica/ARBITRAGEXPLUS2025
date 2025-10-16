from google.oauth2 import service_account
from googleapiclient.discovery import build
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)

class SheetsClient:
    def __init__(self, credentials_file: str, spreadsheet_id: str):
        self.spreadsheet_id = spreadsheet_id
        credentials = service_account.Credentials.from_service_account_file(
            credentials_file,
            scopes=['https://www.googleapis.com/auth/spreadsheets']
        )
        self.service = build('sheets', 'v4', credentials=credentials)
    
    def read_range(self, range_name: str) -> List[List[Any]]:
        """Read data from a range"""
        try:
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=range_name
            ).execute()
            return result.get('values', [])
        except Exception as e:
            logger.error(f"Error reading range {range_name}: {e}")
            return []
    
    def write_range(self, range_name: str, values: List[List[Any]]) -> bool:
        """Write data to a range"""
        try:
            body = {'values': values}
            self.service.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range=range_name,
                valueInputOption='RAW',
                body=body
            ).execute()
            return True
        except Exception as e:
            logger.error(f"Error writing to range {range_name}: {e}")
            return False
