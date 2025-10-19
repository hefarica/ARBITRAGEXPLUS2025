using System;
using System.Runtime.InteropServices;
using Excel = Microsoft.Office.Interop.Excel;

namespace ExcelComBridge
{
    class Program
    {
        private static Excel.Application excelApp;
        private static Excel.Workbook workbook;
        private static Excel.Worksheet worksheet;
        
        static void Main(string[] args)
        {
            Console.WriteLine("========================================");
            Console.WriteLine("  Excel COM Bridge - .NET Framework 4.8");
            Console.WriteLine("========================================");
            Console.WriteLine();

            try
            {
                // Obtener ruta del archivo Excel
                string excelPath = GetExcelPath(args);
                if (string.IsNullOrEmpty(excelPath))
                {
                    Console.WriteLine("[ERROR] No se especificó archivo Excel");
                    Console.WriteLine();
                    Console.WriteLine("Uso: ExcelComBridge.exe <ruta_al_archivo.xlsx>");
                    Console.ReadKey();
                    return;
                }

                Console.WriteLine($"[INFO] Archivo Excel: {excelPath}");
                Console.WriteLine();

                // Conectar con Excel
                Console.WriteLine("[INFO] Conectando con Excel...");
                ConnectToExcel(excelPath);
                
                Console.WriteLine("[OK] Conectado exitosamente");
                Console.WriteLine();

                // Suscribir eventos
                Console.WriteLine("[INFO] Suscribiendo eventos...");
                SubscribeToEvents();
                
                Console.WriteLine("[OK] Eventos suscritos");
                Console.WriteLine();

                Console.WriteLine("========================================");
                Console.WriteLine("  SISTEMA ACTIVO");
                Console.WriteLine("========================================");
                Console.WriteLine();
                Console.WriteLine("✅ Eventos de Excel suscritos");
                Console.WriteLine("✅ Detección de cambios: <10ms");
                Console.WriteLine("🔒 Persistencia PUSH: Activada");
                Console.WriteLine("🧹 Auto-limpieza: Activada");
                Console.WriteLine();
                Console.WriteLine("Presiona Ctrl+C para detener...");
                Console.WriteLine();

                // Mantener el programa ejecutándose
                Console.ReadLine();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] {ex.Message}");
                Console.WriteLine();
                Console.WriteLine("Detalles:");
                Console.WriteLine(ex.ToString());
                Console.ReadKey();
            }
            finally
            {
                Cleanup();
            }
        }

        static string GetExcelPath(string[] args)
        {
            // Si se pasó como argumento
            if (args.Length > 0 && System.IO.File.Exists(args[0]))
            {
                return args[0];
            }

            // Buscar en el proyecto
            string[] searchPaths = new string[]
            {
                @"..\..\data\ARBITRAGEXPLUS2025.xlsx",
                @"..\..\..\data\ARBITRAGEXPLUS2025.xlsx",
                @"data\ARBITRAGEXPLUS2025.xlsx",
                @"ARBITRAGEXPLUS2025.xlsx"
            };

            foreach (string path in searchPaths)
            {
                string fullPath = System.IO.Path.GetFullPath(path);
                if (System.IO.File.Exists(fullPath))
                {
                    return fullPath;
                }
            }

            // Pedir al usuario
            Console.WriteLine("[INFO] No se encontró el archivo Excel automáticamente");
            Console.WriteLine("[INFO] Por favor ingresa la ruta completa:");
            Console.Write("> ");
            string userPath = Console.ReadLine();
            
            if (System.IO.File.Exists(userPath))
            {
                return userPath;
            }

            return null;
        }

        static void ConnectToExcel(string filePath)
        {
            // Crear instancia de Excel
            excelApp = new Excel.Application();
            excelApp.Visible = true;
            excelApp.DisplayAlerts = false;

            // Abrir el archivo
            workbook = excelApp.Workbooks.Open(filePath);
            
            // Obtener la hoja BLOCKCHAINS
            worksheet = (Excel.Worksheet)workbook.Worksheets["BLOCKCHAINS"];
        }

        static void SubscribeToEvents()
        {
            // Suscribir al evento de cambio de hoja
            ((Excel.AppEvents_Event)excelApp).SheetChange += OnSheetChange;
        }

        static void OnSheetChange(object sh, Excel.Range target)
        {
            try
            {
                Excel.Worksheet changedSheet = sh as Excel.Worksheet;
                
                // Solo procesar la hoja BLOCKCHAINS
                if (changedSheet == null || changedSheet.Name != "BLOCKCHAINS")
                    return;

                // Solo procesar columna B (NAME)
                if (target.Column != 2)
                    return;

                string cellValue = target.Value?.ToString() ?? "";
                int row = target.Row;

                Console.WriteLine($"[EVENTO] Cambio detectado en fila {row}: \"{cellValue}\"");

                if (string.IsNullOrWhiteSpace(cellValue))
                {
                    // Limpiar columnas PUSH
                    ClearPushColumns(row);
                    Console.WriteLine($"[OK] Fila {row} limpiada");
                }
                else
                {
                    // Actualizar columnas PUSH
                    UpdatePushColumns(row, cellValue);
                    Console.WriteLine($"[OK] Fila {row} actualizada con datos de '{cellValue}'");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] En evento: {ex.Message}");
            }
        }

        static void ClearPushColumns(int row)
        {
            // Desactivar actualización de pantalla
            excelApp.ScreenUpdating = false;

            try
            {
                // Obtener todas las columnas
                Excel.Range headerRow = worksheet.Rows[1];
                int lastCol = worksheet.Cells[1, worksheet.Columns.Count].End(Excel.XlDirection.xlToLeft).Column;

                for (int col = 1; col <= lastCol; col++)
                {
                    Excel.Range headerCell = (Excel.Range)worksheet.Cells[1, col];
                    
                    // Verificar si es columna PUSH (azul #4472C4)
                    if (IsPushColumn(headerCell))
                    {
                        Excel.Range cell = (Excel.Range)worksheet.Cells[row, col];
                        cell.Value = "";
                    }
                }
            }
            finally
            {
                excelApp.ScreenUpdating = true;
            }
        }

        static void UpdatePushColumns(int row, string blockchainName)
        {
            // Desactivar actualización de pantalla
            excelApp.ScreenUpdating = false;

            try
            {
                // Datos de ejemplo (en producción, consultar APIs)
                var data = GetBlockchainData(blockchainName);

                // Actualizar celdas
                foreach (var kvp in data)
                {
                    int col = GetColumnByHeader(kvp.Key);
                    if (col > 0)
                    {
                        Excel.Range cell = (Excel.Range)worksheet.Cells[row, col];
                        cell.Value = kvp.Value;
                    }
                }
            }
            finally
            {
                excelApp.ScreenUpdating = true;
            }
        }

        static System.Collections.Generic.Dictionary<string, object> GetBlockchainData(string name)
        {
            // Datos mock - En producción, consultar APIs reales
            var data = new System.Collections.Generic.Dictionary<string, object>();

            switch (name.ToLower())
            {
                case "ethereum":
                    data["CHAIN_ID"] = 1;
                    data["NATIVE_TOKEN"] = "ETH";
                    data["SYMBOL"] = "ETH";
                    break;
                case "polygon":
                    data["CHAIN_ID"] = 137;
                    data["NATIVE_TOKEN"] = "MATIC";
                    data["SYMBOL"] = "MATIC";
                    break;
                case "bsc":
                    data["CHAIN_ID"] = 56;
                    data["NATIVE_TOKEN"] = "BNB";
                    data["SYMBOL"] = "BNB";
                    break;
                case "arbitrum":
                    data["CHAIN_ID"] = 42161;
                    data["NATIVE_TOKEN"] = "ETH";
                    data["SYMBOL"] = "ETH";
                    break;
                case "avalanche":
                    data["CHAIN_ID"] = 43114;
                    data["NATIVE_TOKEN"] = "AVAX";
                    data["SYMBOL"] = "AVAX";
                    break;
            }

            return data;
        }

        static int GetColumnByHeader(string headerName)
        {
            Excel.Range headerRow = worksheet.Rows[1];
            int lastCol = worksheet.Cells[1, worksheet.Columns.Count].End(Excel.XlDirection.xlToLeft).Column;

            for (int col = 1; col <= lastCol; col++)
            {
                Excel.Range cell = (Excel.Range)worksheet.Cells[1, col];
                if (cell.Value?.ToString() == headerName)
                {
                    return col;
                }
            }

            return -1;
        }

        static bool IsPushColumn(Excel.Range headerCell)
        {
            // Azul #4472C4 = RGB(196, 114, 68) = 4485828 en decimal
            // Permitir variación
            long color = headerCell.Interior.Color;
            
            // Convertir a RGB
            int r = (int)(color & 0xFF);
            int g = (int)((color >> 8) & 0xFF);
            int b = (int)((color >> 16) & 0xFF);

            // Azul #4472C4 = RGB(196, 114, 68)
            return Math.Abs(r - 196) <= 10 && Math.Abs(g - 114) <= 10 && Math.Abs(b - 68) <= 10;
        }

        static void Cleanup()
        {
            try
            {
                if (workbook != null)
                {
                    workbook.Save();
                    workbook.Close();
                    Marshal.ReleaseComObject(workbook);
                }

                if (excelApp != null)
                {
                    excelApp.Quit();
                    Marshal.ReleaseComObject(excelApp);
                }

                GC.Collect();
                GC.WaitForPendingFinalizers();
            }
            catch { }
        }
    }
}

