"""
============================================================================
ARCHIVO: ./services/python-collector/src/utils/config.py
============================================================================

📥 ENTRADA DE DATOS:

🔄 TRANSFORMACIÓN:
  CLASES: Config

📤 SALIDA DE DATOS:

🔗 DEPENDENCIAS:
  - os
  - load_dotenv
  - dotenv

============================================================================
"""

import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SPREADSHEET_ID = os.getenv("SPREADSHEET_ID")
    GOOGLE_SERVICE_ACCOUNT_KEY = os.getenv("GOOGLE_SERVICE_ACCOUNT_KEY")
    PYTH_API_URL = os.getenv("PYTH_API_URL", "https://hermes.pyth.network")
    DEFILLAMA_API_URL = os.getenv("DEFILLAMA_API_URL", "https://api.llama.fi")
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
