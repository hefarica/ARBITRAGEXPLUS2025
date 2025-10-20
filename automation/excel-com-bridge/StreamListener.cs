using System;
using System.Threading;
using System.Threading.Tasks;
using Excel = Microsoft.Office.Interop.Excel;

namespace ArbitrageXStreamListener
{
    public class StreamListener
    {
        private readonly string _excelFilePath;
        private Excel.Application _excelApp;
        private Excel.Workbook _workbook;
        private Excel.Worksheet _worksheet;
        private CancellationTokenSource _cts;
        private bool _isRunning;

        public StreamListener(string excelFilePath)
        {
            _excelFilePath = excelFilePath;
            _cts = new CancellationTokenSource();
        }

        public void Start()
        {
            Console.WriteLine("Iniciando StreamListener...");
            
            try
            {
                // Abrir Excel
                _excelApp = new Excel.Application();
                _excelApp.Visible = true;
                _excelApp.DisplayAlerts = false;

                _workbook = _excelApp.Workbooks.Open(_excelFilePath);
                
                // Buscar hoja BLOCKCHAINS
                foreach (Excel.Worksheet sheet in _workbook.Worksheets)
                {
                    if (sheet.Name == "BLOCKCHAINS")
                    {
                        _worksheet = sheet;
                        break;
                    }
                }

                if (_worksheet == null)
                {
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Console.WriteLine("Advertencia: No se encontró la hoja 'BLOCKCHAINS'");
                    Console.ResetColor();
                    _worksheet = (Excel.Worksheet)_workbook.Worksheets[1];
                }

                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine($"Excel abierto correctamente: {_worksheet.Name}");
                Console.ResetColor();

                _isRunning = true;
                
                // Iniciar monitoreo
                Task.Run(() => MonitorChangesAsync(_cts.Token));
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine($"Error al iniciar StreamListener: {ex.Message}");
                Console.ResetColor();
                throw;
            }
        }

        private async Task MonitorChangesAsync(CancellationToken cancellationToken)
        {
            Console.WriteLine("Monitoreando cambios en Excel...");
            
            while (!cancellationToken.IsCancellationRequested && _isRunning)
            {
                try
                {
                    // Aquí iría la lógica de monitoreo
                    // Por ahora solo esperamos
                    await Task.Delay(1000, cancellationToken);
                }
                catch (TaskCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine($"Error en monitoreo: {ex.Message}");
                    Console.ResetColor();
                }
            }
        }

        public void Stop()
        {
            Console.WriteLine("Deteniendo StreamListener...");
            
            _isRunning = false;
            _cts?.Cancel();

            try
            {
                if (_workbook != null)
                {
                    _workbook.Close(false);
                    System.Runtime.InteropServices.Marshal.ReleaseComObject(_workbook);
                }

                if (_excelApp != null)
                {
                    _excelApp.Quit();
                    System.Runtime.InteropServices.Marshal.ReleaseComObject(_excelApp);
                }

                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine("StreamListener detenido correctamente");
                Console.ResetColor();
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine($"Advertencia al detener: {ex.Message}");
                Console.ResetColor();
            }
        }
    }
}

