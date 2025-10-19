using System;
using System.IO;
using Serilog;

namespace ExcelComBridge
{
    class Program
    {
        static void Main(string[] args)
        {
            // Configurar logging
            Log.Logger = new LoggerConfiguration()
                .MinimumLevel.Debug()
                .WriteTo.Console()
                .WriteTo.File("logs/excel-com-bridge-.txt", rollingInterval: RollingInterval.Day)
                .CreateLogger();
            
            try
            {
                Log.Information("========================================");
                Log.Information("Excel COM Bridge - ARBITRAGEXPLUS2025");
                Log.Information("========================================");
                Log.Information("");
                
                // Obtener ruta del archivo Excel
                string excelPath = GetExcelPath(args);
                
                if (!File.Exists(excelPath))
                {
                    Log.Error("❌ Archivo Excel no encontrado: {Path}", excelPath);
                    Console.WriteLine("\nPresiona cualquier tecla para salir...");
                    Console.ReadKey();
                    return;
                }
                
                Log.Information("📂 Archivo Excel: {Path}", excelPath);
                Log.Information("");
                
                // Crear gestor de Excel COM
                using var excelManager = new ExcelComManager(excelPath);
                
                // Conectar con Excel
                excelManager.Connect();
                
                // Crear gestor de snapshots
                var snapshotManager = new SnapshotManager(excelManager);
                
                // Crear watcher de BLOCKCHAINS
                var blockchainWatcher = new BlockchainsWatcher(excelManager, snapshotManager);
                
                Log.Information("");
                Log.Information("========================================");
                Log.Information("✅ Sistema iniciado correctamente");
                Log.Information("========================================");
                Log.Information("");
                Log.Information("🎯 Características:");
                Log.Information("  • Detección de cambios en tiempo real (<10ms)");
                Log.Information("  • Persistencia automática de columnas PUSH");
                Log.Information("  • Auto-limpieza al borrar NAME");
                Log.Information("");
                Log.Information("📝 Instrucciones:");
                Log.Information("  1. Escribe un nombre de blockchain en columna NAME (B)");
                Log.Information("  2. Las columnas PUSH se actualizarán automáticamente");
                Log.Information("  3. Si borras un dato PUSH, se restaurará automáticamente");
                Log.Information("  4. Si borras NAME, se limpiarán todas las columnas PUSH");
                Log.Information("");
                Log.Information("Presiona Ctrl+C para detener...");
                Log.Information("");
                
                // Mantener la aplicación ejecutándose
                Console.CancelKeyPress += (sender, e) =>
                {
                    e.Cancel = true;
                    Log.Information("");
                    Log.Information("⏹️  Deteniendo Excel COM Bridge...");
                };
                
                // Loop infinito
                while (true)
                {
                    System.Threading.Thread.Sleep(1000);
                }
            }
            catch (Exception ex)
            {
                Log.Fatal(ex, "❌ Error fatal en Excel COM Bridge");
                Console.WriteLine("\nPresiona cualquier tecla para salir...");
                Console.ReadKey();
            }
            finally
            {
                Log.CloseAndFlush();
            }
        }
        
        /// <summary>
        /// Obtiene la ruta del archivo Excel desde argumentos o variable de entorno
        /// </summary>
        static string GetExcelPath(string[] args)
        {
            // 1. Desde argumentos de línea de comandos
            if (args.Length > 0 && File.Exists(args[0]))
            {
                return Path.GetFullPath(args[0]);
            }
            
            // 2. Desde variable de entorno
            string? envPath = Environment.GetEnvironmentVariable("EXCEL_FILE_PATH");
            if (!string.IsNullOrEmpty(envPath) && File.Exists(envPath))
            {
                return Path.GetFullPath(envPath);
            }
            
            // 3. Buscar en directorio del proyecto
            string projectRoot = FindProjectRoot();
            string dataPath = Path.Combine(projectRoot, "data", "ARBITRAGEXPLUS2025.xlsx");
            
            if (File.Exists(dataPath))
            {
                return Path.GetFullPath(dataPath);
            }
            
            // 4. Ruta por defecto relativa
            return Path.GetFullPath("../../data/ARBITRAGEXPLUS2025.xlsx");
        }
        
        /// <summary>
        /// Busca la raíz del proyecto (donde está la carpeta .git o services)
        /// </summary>
        static string FindProjectRoot()
        {
            string currentDir = Directory.GetCurrentDirectory();
            DirectoryInfo? dir = new DirectoryInfo(currentDir);
            
            while (dir != null)
            {
                // Buscar carpeta .git
                if (Directory.Exists(Path.Combine(dir.FullName, ".git")))
                {
                    return dir.FullName;
                }
                
                // Buscar carpeta services
                if (Directory.Exists(Path.Combine(dir.FullName, "services")))
                {
                    return dir.FullName;
                }
                
                dir = dir.Parent;
            }
            
            return currentDir;
        }
    }
}

