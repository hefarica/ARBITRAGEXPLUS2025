using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using Excel = Microsoft.Office.Interop.Excel;

namespace ExcelComBridge
{
    class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            Console.WriteLine("========================================");
            Console.WriteLine("  Excel COM Bridge - .NET Framework 4.8");
            Console.WriteLine("========================================");
            Console.WriteLine();

            string excelPath = null;

            // Obtener ruta del Excel
            if (args.Length > 0 && File.Exists(args[0]))
            {
                excelPath = Path.GetFullPath(args[0]);
                Console.WriteLine($"[OK] Archivo Excel: {excelPath}");
            }
            else
            {
                // Buscar automáticamente
                excelPath = FindExcelFile();
                
                if (excelPath == null)
                {
                    Console.WriteLine("[WARN] Archivo Excel no encontrado");
                    Console.WriteLine("[INFO] Abriendo selector de archivos...");
                    Console.WriteLine();
                    
                    excelPath = SelectExcelFile();
                    
                    if (excelPath == null)
                    {
                        Console.WriteLine("[ERROR] No se seleccionó ningún archivo");
                        Console.WriteLine();
                        Console.WriteLine("Presiona cualquier tecla para salir...");
                        Console.ReadKey();
                        return;
                    }
                }
                
                Console.WriteLine($"[OK] Archivo Excel: {excelPath}");
            }

            Console.WriteLine();

            try
            {
                // Crear gestor COM
                var comManager = new ExcelComManager(excelPath);
                
                Console.WriteLine("[OK] Conectado a Excel via COM");
                Console.WriteLine();

                // Crear watcher de blockchains
                var watcher = new BlockchainsWatcher(comManager);
                
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

                // Mantener vivo
                Console.CancelKeyPress += (s, e) =>
                {
                    e.Cancel = true;
                    Console.WriteLine();
                    Console.WriteLine("[INFO] Deteniendo sistema...");
                    watcher.Stop();
                    comManager.Dispose();
                    Console.WriteLine("[OK] Sistema detenido");
                };

                // Esperar indefinidamente
                while (true)
                {
                    System.Threading.Thread.Sleep(1000);
                }
            }
            catch (COMException ex)
            {
                Console.WriteLine();
                Console.WriteLine($"[ERROR] Error COM: {ex.Message}");
                Console.WriteLine();
                Console.WriteLine("Posibles causas:");
                Console.WriteLine("1. Excel no está instalado");
                Console.WriteLine("2. El archivo está abierto en modo protegido");
                Console.WriteLine("3. Las macros están deshabilitadas");
                Console.WriteLine();
                Console.WriteLine("Presiona cualquier tecla para salir...");
                Console.ReadKey();
            }
            catch (Exception ex)
            {
                Console.WriteLine();
                Console.WriteLine($"[ERROR] {ex.Message}");
                Console.WriteLine();
                Console.WriteLine("Presiona cualquier tecla para salir...");
                Console.ReadKey();
            }
        }

        static string FindExcelFile()
        {
            string filename = "ARBITRAGEXPLUS2025.xlsx";
            
            // Ubicaciones comunes
            string[] locations = new string[]
            {
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "data", filename),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads", filename),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), filename),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Desktop), filename)
            };

            foreach (var location in locations)
            {
                string fullPath = Path.GetFullPath(location);
                if (File.Exists(fullPath))
                {
                    return fullPath;
                }
            }

            return null;
        }

        static string SelectExcelFile()
        {
            using (OpenFileDialog dialog = new OpenFileDialog())
            {
                dialog.Title = "Selecciona el archivo Excel ARBITRAGEXPLUS2025.xlsx";
                dialog.Filter = "Archivos Excel (*.xlsx)|*.xlsx|Todos los archivos (*.*)|*.*";
                dialog.FileName = "ARBITRAGEXPLUS2025.xlsx";
                dialog.InitialDirectory = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);

                if (dialog.ShowDialog() == DialogResult.OK)
                {
                    return dialog.FileName;
                }
            }

            return null;
        }
    }
}

