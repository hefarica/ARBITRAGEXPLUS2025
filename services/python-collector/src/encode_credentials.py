import base64
import json
import os

# Path to the original credentials file
creds_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../upload/gen-lang-client-0296716075-a1a15439605f.json'))

# Path to the .env file
dotenv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../.env'))

# Read the original credentials file
with open(creds_path, 'r') as f:
    creds_json = json.load(f)

# Encode the credentials to base64
creds_b64 = base64.b64encode(json.dumps(creds_json).encode('utf-8')).decode('utf-8')

# Read the .env file
with open(dotenv_path, 'r') as f:
    lines = f.readlines()

# Update the GOOGLE_SHEETS_CREDENTIALS_BASE64 variable
with open(dotenv_path, 'w') as f:
    for line in lines:
        if line.startswith('GOOGLE_SHEETS_CREDENTIALS_BASE64='):
            f.write(f'GOOGLE_SHEETS_CREDENTIALS_BASE64={creds_b64}\n')
        else:
            f.write(line)

print(f"Successfully updated GOOGLE_SHEETS_CREDENTIALS_BASE64 in {dotenv_path}")

