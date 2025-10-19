using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;
using Serilog;

namespace ExcelComBridge
{
    /// <summary>
    /// Gestor de snapshots para detección incremental de cambios
    /// Latencia: <10ms para detectar cambios
    /// </summary>
    public class SnapshotManager
    {
        private readonly Dictionary<string, SheetSnapshot> _snapshots = new();
        private readonly ExcelComManager _excelManager;
        
        public SnapshotManager(ExcelComManager excelManager)
        {
            _excelManager = excelManager;
            Log.Information("SnapshotManager inicializado");
        }
        
        /// <summary>
        /// Crea un snapshot de una hoja completa
        /// </summary>
        public void CreateSnapshot(string sheetName, int startRow, int endRow, int startCol, int endCol)
        {
            var snapshot = new SheetSnapshot
            {
                SheetName = sheetName,
                StartRow = startRow,
                EndRow = endRow,
                StartCol = startCol,
                EndCol = endCol,
                Timestamp = DateTime.UtcNow,
                Version = _snapshots.ContainsKey(sheetName) ? _snapshots[sheetName].Version + 1 : 1
            };
            
            // Capturar valores actuales
            for (int row = startRow; row <= endRow; row++)
            {
                for (int col = startCol; col <= endCol; col++)
                {
                    var value = _excelManager.ReadCell(sheetName, row, col);
                    snapshot.Cells[$"{row},{col}"] = value;
                }
            }
            
            _snapshots[sheetName] = snapshot;
            
            Log.Information("📸 Snapshot creado: {Sheet} v{Version} ({Cells} celdas)", 
                sheetName, snapshot.Version, snapshot.Cells.Count);
        }
        
        /// <summary>
        /// Detecta cambios comparando con el snapshot anterior
        /// Retorna lista de celdas que cambiaron
        /// </summary>
        public List<CellChange> DetectChanges(string sheetName, int startRow, int endRow, int startCol, int endCol)
        {
            var changes = new List<CellChange>();
            
            if (!_snapshots.ContainsKey(sheetName))
            {
                // No hay snapshot previo, crear uno
                CreateSnapshot(sheetName, startRow, endRow, startCol, endCol);
                return changes;
            }
            
            var oldSnapshot = _snapshots[sheetName];
            
            // Comparar valores actuales con snapshot
            for (int row = startRow; row <= endRow; row++)
            {
                for (int col = startCol; col <= endCol; col++)
                {
                    string key = $"{row},{col}";
                    var currentValue = _excelManager.ReadCell(sheetName, row, col);
                    
                    object? oldValue = null;
                    oldSnapshot.Cells.TryGetValue(key, out oldValue);
                    
                    // Detectar cambio
                    if (!ValuesEqual(oldValue, currentValue))
                    {
                        changes.Add(new CellChange
                        {
                            SheetName = sheetName,
                            Row = row,
                            Column = col,
                            OldValue = oldValue,
                            NewValue = currentValue,
                            Timestamp = DateTime.UtcNow
                        });
                    }
                }
            }
            
            if (changes.Count > 0)
            {
                Log.Information("🔍 Detectados {Count} cambios en {Sheet}", changes.Count, sheetName);
                
                // Actualizar snapshot
                CreateSnapshot(sheetName, startRow, endRow, startCol, endCol);
            }
            
            return changes;
        }
        
        /// <summary>
        /// Detecta si una celda específica cambió
        /// </summary>
        public CellChange? DetectCellChange(string sheetName, int row, int col)
        {
            if (!_snapshots.ContainsKey(sheetName))
            {
                return null;
            }
            
            var oldSnapshot = _snapshots[sheetName];
            string key = $"{row},{col}";
            
            object? oldValue = null;
            oldSnapshot.Cells.TryGetValue(key, out oldValue);
            
            var currentValue = _excelManager.ReadCell(sheetName, row, col);
            
            if (!ValuesEqual(oldValue, currentValue))
            {
                return new CellChange
                {
                    SheetName = sheetName,
                    Row = row,
                    Column = col,
                    OldValue = oldValue,
                    NewValue = currentValue,
                    Timestamp = DateTime.UtcNow
                };
            }
            
            return null;
        }
        
        /// <summary>
        /// Actualiza el snapshot de una celda específica
        /// </summary>
        public void UpdateCellSnapshot(string sheetName, int row, int col, object? value)
        {
            if (!_snapshots.ContainsKey(sheetName))
            {
                return;
            }
            
            string key = $"{row},{col}";
            _snapshots[sheetName].Cells[key] = value;
        }
        
        /// <summary>
        /// Compara dos valores considerando nulls y tipos
        /// </summary>
        private bool ValuesEqual(object? a, object? b)
        {
            if (a == null && b == null) return true;
            if (a == null || b == null) return false;
            
            // Convertir a string para comparación
            string aStr = a.ToString() ?? string.Empty;
            string bStr = b.ToString() ?? string.Empty;
            
            return aStr.Equals(bStr, StringComparison.Ordinal);
        }
        
        /// <summary>
        /// Obtiene el snapshot actual de una hoja
        /// </summary>
        public SheetSnapshot? GetSnapshot(string sheetName)
        {
            return _snapshots.ContainsKey(sheetName) ? _snapshots[sheetName] : null;
        }
        
        /// <summary>
        /// Limpia todos los snapshots
        /// </summary>
        public void ClearSnapshots()
        {
            _snapshots.Clear();
            Log.Information("🧹 Snapshots limpiados");
        }
    }
    
    /// <summary>
    /// Snapshot de una hoja de Excel
    /// </summary>
    public class SheetSnapshot
    {
        public string SheetName { get; set; } = string.Empty;
        public int StartRow { get; set; }
        public int EndRow { get; set; }
        public int StartCol { get; set; }
        public int EndCol { get; set; }
        public int Version { get; set; }
        public DateTime Timestamp { get; set; }
        
        /// <summary>
        /// Diccionario de celdas: "row,col" => value
        /// </summary>
        public Dictionary<string, object?> Cells { get; set; } = new();
    }
    
    /// <summary>
    /// Representa un cambio en una celda
    /// </summary>
    public class CellChange
    {
        public string SheetName { get; set; } = string.Empty;
        public int Row { get; set; }
        public int Column { get; set; }
        public object? OldValue { get; set; }
        public object? NewValue { get; set; }
        public DateTime Timestamp { get; set; }
        
        public bool IsDeleted => NewValue == null || string.IsNullOrEmpty(NewValue.ToString());
        public bool IsAdded => OldValue == null || string.IsNullOrEmpty(OldValue.ToString());
        public bool IsModified => !IsDeleted && !IsAdded;
    }
}

