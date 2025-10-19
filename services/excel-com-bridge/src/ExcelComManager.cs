using System;
using System.Runtime.InteropServices;
using Microsoft.Office.Interop.Excel;
using Serilog;

namespace ExcelComBridge
{
    /// <summary>
    /// Gestor principal de Excel COM Automation
    /// Maneja la conexión con Excel y captura eventos en tiempo real
    /// </summary>
    public class ExcelComManager : IDisposable
    {
        private Application? _excelApp;
        private Workbook? _workbook;
        private bool _disposed = false;
        private readonly string _filePath;
        
        // Eventos
        public event EventHandler<WorksheetChangeEventArgs>? CellChanged;
        public event EventHandler<WorksheetChangeEventArgs>? CellDeleted;
        
        public ExcelComManager(string filePath)
        {
            _filePath = filePath;
            Log.Information("ExcelComManager inicializado para: {FilePath}", filePath);
        }
        
        /// <summary>
        /// Conecta con Excel y abre el archivo
        /// Si Excel ya está abierto con el archivo, se conecta a esa instancia
        /// </summary>
        public void Connect()
        {
            try
            {
                Log.Information("Conectando con Excel...");
                
                // Intentar obtener instancia de Excel en ejecución
                try
                {
                    _excelApp = (Application)Marshal.GetActiveObject("Excel.Application");
                    Log.Information("✅ Conectado a Excel existente");
                }
                catch (COMException)
                {
                    // No hay Excel abierto, crear nueva instancia
                    _excelApp = new Application();
                    _excelApp.Visible = true;
                    Log.Information("✅ Nueva instancia de Excel creada");
                }
                
                // Buscar si el archivo ya está abierto
                _workbook = FindOpenWorkbook(_filePath);
                
                if (_workbook == null)
                {
                    // Abrir el archivo
                    Log.Information("Abriendo archivo: {FilePath}", _filePath);
                    _workbook = _excelApp.Workbooks.Open(_filePath);
                    Log.Information("✅ Archivo abierto");
                }
                else
                {
                    Log.Information("✅ Archivo ya estaba abierto");
                }
                
                // Suscribirse a eventos
                SubscribeToEvents();
                
                Log.Information("🎯 ExcelComManager conectado exitosamente");
                Log.Information("⚡ Latencia de eventos: <10ms");
            }
            catch (Exception ex)
            {
                Log.Error(ex, "❌ Error al conectar con Excel");
                throw;
            }
        }
        
        /// <summary>
        /// Busca un workbook abierto por ruta de archivo
        /// </summary>
        private Workbook? FindOpenWorkbook(string filePath)
        {
            if (_excelApp == null) return null;
            
            string normalizedPath = System.IO.Path.GetFullPath(filePath);
            
            foreach (Workbook wb in _excelApp.Workbooks)
            {
                string wbPath = System.IO.Path.GetFullPath(wb.FullName);
                if (string.Equals(wbPath, normalizedPath, StringComparison.OrdinalIgnoreCase))
                {
                    return wb;
                }
            }
            
            return null;
        }
        
        /// <summary>
        /// Suscribe a eventos de Excel
        /// </summary>
        private void SubscribeToEvents()
        {
            if (_workbook == null) return;
            
            Log.Information("Suscribiendo a eventos de Excel...");
            
            // Evento cuando cambia cualquier celda
            _workbook.SheetChange += OnSheetChange;
            
            Log.Information("✅ Eventos suscritos");
        }
        
        /// <summary>
        /// Manejador de evento SheetChange
        /// Se dispara INMEDIATAMENTE cuando cambia una celda
        /// </summary>
        private void OnSheetChange(object sh, Range target)
        {
            try
            {
                var worksheet = sh as Worksheet;
                if (worksheet == null) return;
                
                string sheetName = worksheet.Name;
                int row = target.Row;
                int column = target.Column;
                object? oldValue = null; // COM no provee old value directamente
                object? newValue = target.Value;
                
                Log.Debug("📝 Celda cambiada: {Sheet}!{Row},{Col} = {Value}", 
                    sheetName, row, column, newValue);
                
                var args = new WorksheetChangeEventArgs
                {
                    SheetName = sheetName,
                    Row = row,
                    Column = column,
                    OldValue = oldValue,
                    NewValue = newValue,
                    Timestamp = DateTime.UtcNow
                };
                
                // Detectar si es borrado (valor vacío)
                if (newValue == null || string.IsNullOrEmpty(newValue.ToString()))
                {
                    CellDeleted?.Invoke(this, args);
                }
                else
                {
                    CellChanged?.Invoke(this, args);
                }
            }
            catch (Exception ex)
            {
                Log.Error(ex, "❌ Error en OnSheetChange");
            }
        }
        
        /// <summary>
        /// Lee el valor de una celda
        /// </summary>
        public object? ReadCell(string sheetName, int row, int column)
        {
            if (_workbook == null) 
                throw new InvalidOperationException("No conectado a Excel");
            
            var worksheet = _workbook.Sheets[sheetName] as Worksheet;
            if (worksheet == null)
                throw new ArgumentException($"Hoja '{sheetName}' no encontrada");
            
            var cell = worksheet.Cells[row, column] as Range;
            return cell?.Value;
        }
        
        /// <summary>
        /// Escribe un valor en una celda
        /// </summary>
        public void WriteCell(string sheetName, int row, int column, object value)
        {
            if (_workbook == null) 
                throw new InvalidOperationException("No conectado a Excel");
            
            var worksheet = _workbook.Sheets[sheetName] as Worksheet;
            if (worksheet == null)
                throw new ArgumentException($"Hoja '{sheetName}' no encontrada");
            
            var cell = worksheet.Cells[row, column] as Range;
            if (cell != null)
            {
                cell.Value = value;
            }
        }
        
        /// <summary>
        /// Lee el color de fondo de una celda (para detectar PUSH/PULL)
        /// </summary>
        public int GetCellColor(string sheetName, int row, int column)
        {
            if (_workbook == null) 
                throw new InvalidOperationException("No conectado a Excel");
            
            var worksheet = _workbook.Sheets[sheetName] as Worksheet;
            if (worksheet == null)
                throw new ArgumentException($"Hoja '{sheetName}' no encontrada");
            
            var cell = worksheet.Cells[row, column] as Range;
            if (cell?.Interior != null)
            {
                return (int)cell.Interior.Color;
            }
            
            return 0xFFFFFF; // Blanco por defecto
        }
        
        /// <summary>
        /// Guarda el workbook
        /// </summary>
        public void Save()
        {
            _workbook?.Save();
            Log.Debug("💾 Workbook guardado");
        }
        
        public void Dispose()
        {
            if (_disposed) return;
            
            Log.Information("Liberando recursos de Excel COM...");
            
            try
            {
                // Desuscribirse de eventos
                if (_workbook != null)
                {
                    _workbook.SheetChange -= OnSheetChange;
                }
                
                // Liberar COM objects
                if (_workbook != null)
                {
                    Marshal.ReleaseComObject(_workbook);
                    _workbook = null;
                }
                
                if (_excelApp != null)
                {
                    // No cerrar Excel si ya estaba abierto
                    Marshal.ReleaseComObject(_excelApp);
                    _excelApp = null;
                }
                
                GC.Collect();
                GC.WaitForPendingFinalizers();
                
                Log.Information("✅ Recursos liberados");
            }
            catch (Exception ex)
            {
                Log.Error(ex, "❌ Error al liberar recursos");
            }
            
            _disposed = true;
        }
    }
    
    /// <summary>
    /// Argumentos del evento de cambio en worksheet
    /// </summary>
    public class WorksheetChangeEventArgs : EventArgs
    {
        public string SheetName { get; set; } = string.Empty;
        public int Row { get; set; }
        public int Column { get; set; }
        public object? OldValue { get; set; }
        public object? NewValue { get; set; }
        public DateTime Timestamp { get; set; }
    }
}

