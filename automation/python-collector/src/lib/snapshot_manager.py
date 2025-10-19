"""
SnapshotManager - Gestión de snapshots para detección incremental de cambios en Excel

Mantiene un snapshot del estado anterior de las celdas y detecta cambios comparando
el estado actual vs el snapshot. Solo se procesan las celdas que realmente cambiaron.
"""

import json
import logging
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)


@dataclass
class CellSnapshot:
    """Snapshot de una celda individual"""
    row: int  # 1-based
    col: int  # 1-based
    value: Any
    timestamp: str


@dataclass
class SheetSnapshot:
    """Snapshot de una hoja completa"""
    sheet_name: str
    cells: Dict[str, CellSnapshot]  # key = "row_col"
    last_update: str
    version: int = 1


@dataclass
class CellChange:
    """Representa un cambio detectado en una celda"""
    sheet_name: str
    row: int
    col: int
    column_name: str
    old_value: Any
    new_value: Any
    timestamp: str


class SnapshotManager:
    """
    Gestiona snapshots de hojas Excel para detectar cambios incrementales.
    
    Permite:
    - Crear snapshots del estado actual
    - Comparar estado actual vs snapshot anterior
    - Detectar qué celdas cambiaron
    - Persistir snapshots en disco
    """

    def __init__(self, snapshot_dir: str | Path = ".snapshots"):
        """
        Inicializa el SnapshotManager.

        Args:
            snapshot_dir: Directorio donde se guardan los snapshots
        """
        self.snapshot_dir = Path(snapshot_dir)
        self.snapshot_dir.mkdir(parents=True, exist_ok=True)
        
        self.snapshots: Dict[str, SheetSnapshot] = {}
        
        logger.info(f"SnapshotManager inicializado en: {self.snapshot_dir}")

    def _get_snapshot_path(self, sheet_name: str) -> Path:
        """Obtiene la ruta del archivo de snapshot para una hoja"""
        safe_name = sheet_name.replace(" ", "_").replace("/", "_")
        return self.snapshot_dir / f"{safe_name}.json"

    def _cell_key(self, row: int, col: int) -> str:
        """Genera una clave única para una celda"""
        return f"{row}_{col}"

    def create_snapshot(
        self,
        sheet_name: str,
        data: List[Dict[str, Any]],
        column_mapping: Dict[str, int],
        start_row: int = 2
    ) -> SheetSnapshot:
        """
        Crea un snapshot del estado actual de una hoja.

        Args:
            sheet_name: Nombre de la hoja
            data: Lista de diccionarios con los datos actuales
            column_mapping: Mapeo {nombre_columna: índice_columna (0-based)}
            start_row: Fila inicial de datos (1-based)

        Returns:
            SheetSnapshot creado
        """
        cells: Dict[str, CellSnapshot] = {}
        timestamp = datetime.utcnow().isoformat()

        for row_idx, row_data in enumerate(data, start=start_row):
            for col_name, value in row_data.items():
                if col_name in column_mapping:
                    col_idx = column_mapping[col_name] + 1  # Convertir a 1-based
                    key = self._cell_key(row_idx, col_idx)
                    
                    cells[key] = CellSnapshot(
                        row=row_idx,
                        col=col_idx,
                        value=value,
                        timestamp=timestamp
                    )

        # Obtener versión anterior si existe
        old_snapshot = self.snapshots.get(sheet_name)
        version = old_snapshot.version + 1 if old_snapshot else 1

        snapshot = SheetSnapshot(
            sheet_name=sheet_name,
            cells=cells,
            last_update=timestamp,
            version=version
        )

        self.snapshots[sheet_name] = snapshot
        logger.info(f"Snapshot creado para '{sheet_name}': {len(cells)} celdas, versión {version}")

        return snapshot

    def detect_changes(
        self,
        sheet_name: str,
        current_data: List[Dict[str, Any]],
        column_mapping: Dict[str, int],
        start_row: int = 2,
        columns_to_watch: Optional[List[str]] = None
    ) -> List[CellChange]:
        """
        Detecta cambios comparando datos actuales con el snapshot anterior.

        Args:
            sheet_name: Nombre de la hoja
            current_data: Datos actuales
            column_mapping: Mapeo {nombre_columna: índice_columna (0-based)}
            start_row: Fila inicial de datos (1-based)
            columns_to_watch: Lista de columnas a monitorear (None = todas)

        Returns:
            Lista de cambios detectados
        """
        old_snapshot = self.snapshots.get(sheet_name)
        
        if not old_snapshot:
            logger.warning(f"No hay snapshot previo para '{sheet_name}', creando uno nuevo")
            self.create_snapshot(sheet_name, current_data, column_mapping, start_row)
            return []

        changes: List[CellChange] = []
        timestamp = datetime.utcnow().isoformat()
        
        # Filtrar columnas a monitorear
        cols_to_check = columns_to_watch if columns_to_watch else list(column_mapping.keys())

        for row_idx, row_data in enumerate(current_data, start=start_row):
            for col_name in cols_to_check:
                if col_name not in column_mapping:
                    continue

                col_idx = column_mapping[col_name] + 1  # Convertir a 1-based
                key = self._cell_key(row_idx, col_idx)
                
                current_value = row_data.get(col_name)
                old_cell = old_snapshot.cells.get(key)
                old_value = old_cell.value if old_cell else None

                # Detectar cambio
                if current_value != old_value:
                    change = CellChange(
                        sheet_name=sheet_name,
                        row=row_idx,
                        col=col_idx,
                        column_name=col_name,
                        old_value=old_value,
                        new_value=current_value,
                        timestamp=timestamp
                    )
                    changes.append(change)

        logger.info(f"Detectados {len(changes)} cambios en '{sheet_name}'")
        
        return changes

    def update_snapshot(
        self,
        sheet_name: str,
        data: List[Dict[str, Any]],
        column_mapping: Dict[str, int],
        start_row: int = 2
    ) -> None:
        """
        Actualiza el snapshot con los datos actuales.

        Args:
            sheet_name: Nombre de la hoja
            data: Datos actuales
            column_mapping: Mapeo {nombre_columna: índice_columna}
            start_row: Fila inicial de datos (1-based)
        """
        self.create_snapshot(sheet_name, data, column_mapping, start_row)
        logger.debug(f"Snapshot actualizado para '{sheet_name}'")

    def save_to_disk(self, sheet_name: Optional[str] = None) -> None:
        """
        Guarda snapshots en disco.

        Args:
            sheet_name: Nombre de hoja específica (None = todas)
        """
        sheets_to_save = [sheet_name] if sheet_name else list(self.snapshots.keys())

        for name in sheets_to_save:
            snapshot = self.snapshots.get(name)
            if not snapshot:
                continue

            path = self._get_snapshot_path(name)
            
            # Convertir a formato serializable
            data = {
                "sheet_name": snapshot.sheet_name,
                "last_update": snapshot.last_update,
                "version": snapshot.version,
                "cells": {
                    key: asdict(cell) for key, cell in snapshot.cells.items()
                }
            }

            with open(path, "w") as f:
                json.dump(data, f, indent=2)

            logger.debug(f"Snapshot guardado en disco: {path}")

    def load_from_disk(self, sheet_name: str) -> Optional[SheetSnapshot]:
        """
        Carga un snapshot desde disco.

        Args:
            sheet_name: Nombre de la hoja

        Returns:
            SheetSnapshot cargado o None si no existe
        """
        path = self._get_snapshot_path(sheet_name)
        
        if not path.exists():
            logger.debug(f"No existe snapshot en disco para '{sheet_name}'")
            return None

        try:
            with open(path, "r") as f:
                data = json.load(f)

            # Reconstruir objetos
            cells = {
                key: CellSnapshot(**cell_data)
                for key, cell_data in data["cells"].items()
            }

            snapshot = SheetSnapshot(
                sheet_name=data["sheet_name"],
                cells=cells,
                last_update=data["last_update"],
                version=data["version"]
            )

            self.snapshots[sheet_name] = snapshot
            logger.info(f"Snapshot cargado desde disco: '{sheet_name}' (versión {snapshot.version})")

            return snapshot

        except Exception as e:
            logger.error(f"Error al cargar snapshot desde disco: {e}")
            return None

    def load_all_from_disk(self) -> int:
        """
        Carga todos los snapshots disponibles desde disco.

        Returns:
            Número de snapshots cargados
        """
        count = 0
        
        for path in self.snapshot_dir.glob("*.json"):
            sheet_name = path.stem.replace("_", " ")
            if self.load_from_disk(sheet_name):
                count += 1

        logger.info(f"Cargados {count} snapshots desde disco")
        return count

    def get_changed_rows(
        self,
        changes: List[CellChange],
        column_name: Optional[str] = None
    ) -> Set[int]:
        """
        Obtiene los números de fila que tienen cambios.

        Args:
            changes: Lista de cambios
            column_name: Filtrar solo cambios en esta columna (None = todas)

        Returns:
            Set de números de fila (1-based)
        """
        if column_name:
            return {c.row for c in changes if c.column_name == column_name}
        else:
            return {c.row for c in changes}

    def get_changes_by_column(
        self,
        changes: List[CellChange],
        column_name: str
    ) -> List[CellChange]:
        """
        Filtra cambios por nombre de columna.

        Args:
            changes: Lista de cambios
            column_name: Nombre de la columna

        Returns:
            Lista de cambios en esa columna
        """
        return [c for c in changes if c.column_name == column_name]

    def clear_snapshot(self, sheet_name: str, delete_file: bool = True) -> None:
        """
        Elimina el snapshot de una hoja.

        Args:
            sheet_name: Nombre de la hoja
            delete_file: Si True, también elimina el archivo del disco
        """
        if sheet_name in self.snapshots:
            del self.snapshots[sheet_name]
            logger.debug(f"Snapshot eliminado de memoria: '{sheet_name}'")

        if delete_file:
            path = self._get_snapshot_path(sheet_name)
            if path.exists():
                path.unlink()
                logger.debug(f"Snapshot eliminado de disco: {path}")

    def clear_all_snapshots(self) -> None:
        """Elimina todos los snapshots"""
        self.snapshots.clear()
        
        for path in self.snapshot_dir.glob("*.json"):
            path.unlink()

        logger.info("Todos los snapshots eliminados")

    def get_snapshot_info(self, sheet_name: str) -> Optional[Dict[str, Any]]:
        """
        Obtiene información sobre un snapshot.

        Args:
            sheet_name: Nombre de la hoja

        Returns:
            Diccionario con información o None si no existe
        """
        snapshot = self.snapshots.get(sheet_name)
        
        if not snapshot:
            return None

        return {
            "sheet_name": snapshot.sheet_name,
            "last_update": snapshot.last_update,
            "version": snapshot.version,
            "cell_count": len(snapshot.cells),
            "rows": len(set(cell.row for cell in snapshot.cells.values())),
            "cols": len(set(cell.col for cell in snapshot.cells.values()))
        }

