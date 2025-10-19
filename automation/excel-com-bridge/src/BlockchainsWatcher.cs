using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Serilog;

namespace ExcelComBridge
{
    /// <summary>
    /// Watcher para la hoja BLOCKCHAINS
    /// Detecta cambios en columna NAME (PULL) y actualiza columnas PUSH
    /// Detecta borrados en columnas PUSH y los restaura automáticamente
    /// </summary>
    public class BlockchainsWatcher
    {
        private readonly ExcelComManager _excelManager;
        private readonly SnapshotManager _snapshotManager;
        private readonly HttpClient _httpClient;
        private readonly string _sheetName = "BLOCKCHAINS";
        
        // Mapeo de columnas (índice basado en 1)
        private const int COL_NAME = 2; // Columna B (PULL)
        private const int START_ROW = 2; // Fila 2 (después de headers)
        private const int END_ROW = 100;
        
        // Colores para detectar PUSH/PULL
        private const int COLOR_BLUE = 0xC47244; // #4472C4 en BGR
        private const int COLOR_WHITE = 0xFFFFFF;
        
        private Dictionary<int, bool> _columnTypes = new(); // col => isPush
        
        public BlockchainsWatcher(ExcelComManager excelManager, SnapshotManager snapshotManager)
        {
            _excelManager = excelManager;
            _snapshotManager = snapshotManager;
            _httpClient = new HttpClient();
            
            Log.Information("BlockchainsWatcher inicializado");
            
            // Detectar columnas PUSH/PULL por color
            DetectColumnTypes();
            
            // Crear snapshot inicial
            _snapshotManager.CreateSnapshot(_sheetName, START_ROW, END_ROW, 1, 51);
            
            // Suscribirse a eventos de cambio
            _excelManager.CellChanged += OnCellChanged;
            _excelManager.CellDeleted += OnCellDeleted;
            
            Log.Information("✅ BlockchainsWatcher listo");
            Log.Information("🔒 Persistencia PUSH activada");
            Log.Information("🧹 Auto-limpieza activada");
        }
        
        /// <summary>
        /// Detecta qué columnas son PUSH (azul) y cuáles PULL (blanco)
        /// </summary>
        private void DetectColumnTypes()
        {
            Log.Information("Detectando tipos de columnas por color...");
            
            int pushCount = 0;
            int pullCount = 0;
            
            for (int col = 1; col <= 51; col++)
            {
                int color = _excelManager.GetCellColor(_sheetName, 1, col); // Fila 1 = headers
                
                bool isPush = (color == COLOR_BLUE);
                _columnTypes[col] = isPush;
                
                if (isPush) pushCount++;
                else pullCount++;
            }
            
            Log.Information("✅ Detectadas {Push} columnas PUSH (azul) y {Pull} columnas PULL (blanco)", 
                pushCount, pullCount);
        }
        
        /// <summary>
        /// Manejador cuando cambia una celda
        /// </summary>
        private void OnCellChanged(object? sender, WorksheetChangeEventArgs e)
        {
            // Solo procesar hoja BLOCKCHAINS
            if (e.SheetName != _sheetName) return;
            
            // Solo procesar filas de datos (no headers)
            if (e.Row < START_ROW || e.Row > END_ROW) return;
            
            Log.Debug("📝 Cambio detectado: {Sheet}!{Row},{Col} = '{Value}'", 
                e.SheetName, e.Row, e.Column, e.NewValue);
            
            // Verificar si es columna NAME (PULL)
            if (e.Column == COL_NAME)
            {
                HandleNameChange(e.Row, e.NewValue);
            }
        }
        
        /// <summary>
        /// Manejador cuando se borra una celda
        /// </summary>
        private void OnCellDeleted(object? sender, WorksheetChangeEventArgs e)
        {
            // Solo procesar hoja BLOCKCHAINS
            if (e.SheetName != _sheetName) return;
            
            // Solo procesar filas de datos
            if (e.Row < START_ROW || e.Row > END_ROW) return;
            
            // Verificar si es columna NAME (PULL)
            if (e.Column == COL_NAME)
            {
                Log.Information("🧹 NAME borrado en fila {Row}, limpiando columnas PUSH...", e.Row);
                ClearPushColumns(e.Row);
                return;
            }
            
            // Verificar si es columna PUSH (restaurar)
            if (_columnTypes.ContainsKey(e.Column) && _columnTypes[e.Column])
            {
                RestorePushColumn(e.Row, e.Column);
            }
        }
        
        /// <summary>
        /// Maneja cambio en columna NAME
        /// </summary>
        private async void HandleNameChange(int row, object? newValue)
        {
            if (newValue == null || string.IsNullOrEmpty(newValue.ToString()))
            {
                // NAME borrado, limpiar PUSH
                Log.Information("🧹 NAME vacío en fila {Row}, limpiando columnas PUSH...", row);
                ClearPushColumns(row);
                return;
            }
            
            string blockchainName = newValue.ToString()!.Trim().ToLower();
            
            Log.Information("🔍 Consultando datos para: {Blockchain} (fila {Row})", blockchainName, row);
            
            try
            {
                // Llamar a Python collector para obtener datos
                var data = await FetchBlockchainData(blockchainName);
                
                if (data != null)
                {
                    Log.Information("✅ Datos obtenidos, actualizando {Count} columnas PUSH...", data.Count);
                    UpdatePushColumns(row, data);
                }
                else
                {
                    Log.Warning("⚠️  No se encontraron datos para {Blockchain}", blockchainName);
                }
            }
            catch (Exception ex)
            {
                Log.Error(ex, "❌ Error obteniendo datos para {Blockchain}", blockchainName);
            }
        }
        
        /// <summary>
        /// Obtiene datos de blockchain desde Python collector
        /// </summary>
        private async Task<Dictionary<string, object>?> FetchBlockchainData(string blockchainName)
        {
            try
            {
                // TODO: Llamar a API de Python collector
                // Por ahora, retornar datos mock
                await Task.Delay(10); // Simular latencia de red
                
                return new Dictionary<string, object>
                {
                    ["CHAIN_ID"] = 137,
                    ["NATIVE_TOKEN"] = "MATIC",
                    ["SYMBOL"] = "MATIC",
                    ["TVL_USD"] = 1308433348,
                    ["RPC_URL_1"] = "https://polygon-rpc.com",
                    ["HEALTH_STATUS"] = "HEALTHY"
                };
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error fetching data");
                return null;
            }
        }
        
        /// <summary>
        /// Actualiza columnas PUSH de una fila
        /// </summary>
        private void UpdatePushColumns(int row, Dictionary<string, object> data)
        {
            // Mapeo de nombres de campo a índices de columna
            // TODO: Obtener esto dinámicamente leyendo headers
            var columnMapping = new Dictionary<string, int>
            {
                ["CHAIN_ID"] = 3,
                ["NATIVE_TOKEN"] = 4,
                ["SYMBOL"] = 5,
                ["TVL_USD"] = 6,
                ["RPC_URL_1"] = 7,
                ["HEALTH_STATUS"] = 8
            };
            
            foreach (var kvp in data)
            {
                if (columnMapping.ContainsKey(kvp.Key))
                {
                    int col = columnMapping[kvp.Key];
                    _excelManager.WriteCell(_sheetName, row, col, kvp.Value);
                    
                    // Actualizar snapshot
                    _snapshotManager.UpdateCellSnapshot(_sheetName, row, col, kvp.Value);
                }
            }
            
            _excelManager.Save();
            Log.Information("✅ Columnas PUSH actualizadas para fila {Row}", row);
        }
        
        /// <summary>
        /// Limpia todas las columnas PUSH de una fila
        /// </summary>
        private void ClearPushColumns(int row)
        {
            foreach (var kvp in _columnTypes)
            {
                if (kvp.Value) // Es PUSH
                {
                    _excelManager.WriteCell(_sheetName, row, kvp.Key, string.Empty);
                    _snapshotManager.UpdateCellSnapshot(_sheetName, row, kvp.Key, string.Empty);
                }
            }
            
            _excelManager.Save();
            Log.Information("✅ Columnas PUSH limpiadas para fila {Row}", row);
        }
        
        /// <summary>
        /// Restaura una columna PUSH que fue borrada manualmente
        /// </summary>
        private void RestorePushColumn(int row, int col)
        {
            var change = _snapshotManager.DetectCellChange(_sheetName, row, col);
            
            if (change != null && change.OldValue != null)
            {
                Log.Warning("⚠️  Columna PUSH borrada en fila {Row}, col {Col}", row, col);
                Log.Information("🔄 Restaurando valor: '{OldValue}'", change.OldValue);
                
                _excelManager.WriteCell(_sheetName, row, col, change.OldValue);
                _excelManager.Save();
                
                Log.Information("✅ Valor restaurado");
            }
        }
    }
}

