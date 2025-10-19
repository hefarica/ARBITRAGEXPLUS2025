"""
============================================================================
ARCHIVO: ./services/python-collector/src/schedulers/cron_jobs.py
============================================================================

📥 ENTRADA DE DATOS:

🔄 TRANSFORMACIÓN:
  CLASES: CronScheduler
  FUNCIONES: run, add_job, __init__

📤 SALIDA DE DATOS:

🔗 DEPENDENCIAS:
  - schedule
  - time
  - logging

============================================================================
"""

import schedule
import time
import asyncio
from typing import Callable
import logging

logger = logging.getLogger(__name__)

class CronScheduler:
    def __init__(self):
        self.jobs = []
    
    def add_job(self, func: Callable, interval_seconds: int):
        """Add a job to run at specified interval"""
        schedule.every(interval_seconds).seconds.do(func)
        self.jobs.append(func)
        logger.info(f"Added job: {func.__name__} every {interval_seconds}s")
    
    def run(self):
        """Run the scheduler"""
        logger.info("Starting scheduler...")
        while True:
            schedule.run_pending()
            time.sleep(1)
