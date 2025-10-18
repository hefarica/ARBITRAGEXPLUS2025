"""
============================================================================
ARCHIVO: ./services/python-collector/setup.py
============================================================================

📥 ENTRADA DE DATOS:

🔄 TRANSFORMACIÓN:

📤 SALIDA DE DATOS:

🔗 DEPENDENCIAS:
  - setuptools
  - setup

============================================================================
"""

from setuptools import setup, find_packages

setup(
    name="arbitragexplus-python-collector",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "google-api-python-client>=2.108.0",
        "requests>=2.31.0",
        "aiohttp>=3.9.1",
        "pandas>=2.1.4",
    ],
)
