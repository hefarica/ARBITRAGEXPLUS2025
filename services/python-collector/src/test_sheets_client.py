import os
import sys
from dotenv import load_dotenv

# Add the src directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'utils'))

from sheets_client import SheetsClient

# Load environment variables from .env file
dotenv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../.env'))
print(f"Attempting to load .env from: {dotenv_path}")
load_dotenv(dotenv_path=dotenv_path)

SPREADSHEET_ID = os.getenv('GOOGLE_SHEETS_DOC_ID')
print(f"GOOGLE_SHEETS_DOC_ID after getenv: {SPREADSHEET_ID}")

if not SPREADSHEET_ID:
    print("Error: GOOGLE_SHEETS_DOC_ID not found in .env")
    sys.exit(1)

try:
    client = SheetsClient(SPREADSHEET_ID)
    print(f"Successfully initialized SheetsClient for spreadsheet ID: {SPREADSHEET_ID}")

    # Test: Ensure a sheet exists
    test_sheet_name = 'TestSheetFromPython'
    if client.ensure_sheet_exists(test_sheet_name):
        print(f"Sheet '{test_sheet_name}' is ready.")

        # Test: Write values
        test_range_write = f'{test_sheet_name}!A1'
        test_values = [['Hello', 'World'], ['From', 'Python', 'Client']]
        write_result = client.write_values(test_range_write, test_values)
        if write_result:
            print(f"Successfully wrote values to {test_range_write}: {write_result}")
        else:
            print(f"Failed to write values to {test_range_write}")

        # Test: Read values
        test_range_read = f'{test_sheet_name}!A1:C2'
        read_values = client.read_values(test_range_read)
        if read_values:
            print(f"Successfully read values from {test_range_read}: {read_values}")
        else:
            print(f"Failed to read values from {test_range_read}")

    else:
        print(f"Failed to ensure sheet '{test_sheet_name}' exists.")

except Exception as e:
    print(f"An error occurred: {e}")
    sys.exit(1)

