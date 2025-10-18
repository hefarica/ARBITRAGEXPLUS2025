"""
============================================================================
ARCHIVO: ./services/python-collector/src/pipelines/data_pipeline.py
============================================================================

📥 ENTRADA DE DATOS:

🔄 TRANSFORMACIÓN:
  CLASES: DataPipeline
  FUNCIONES: run, __init__

📤 SALIDA DE DATOS:

🔗 DEPENDENCIAS:
  - asyncio
  - typing
  - List

============================================================================
"""

import asyncio
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)

class DataPipeline:
    def __init__(self, collectors: List, writers: List):
        self.collectors = collectors
        self.writers = writers
    
    async def run(self):
        """Run the data pipeline"""
        logger.info("Starting data pipeline...")
        
        # Collect data
        collected_data = []
        for collector in self.collectors:
            try:
                data = await collector.collect()
                collected_data.extend(data)
            except Exception as e:
                logger.error(f"Error in collector: {e}")
        
        # Write data
        for writer in self.writers:
            try:
                await writer.write(collected_data)
            except Exception as e:
                logger.error(f"Error in writer: {e}")
        
        logger.info(f"Pipeline completed. Processed {len(collected_data)} items")
