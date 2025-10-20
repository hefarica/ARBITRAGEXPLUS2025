using System;
using System.Windows.Forms;

namespace ArbitrageXStreamListener;

public class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        
        Console.Title = "ARBITRAGEXPLUS2025 - Excel COM Bridge";
        Console.WriteLine("========================================");
        Console.WriteLine("  ARBITRAGEXPLUS2025");
        Console.WriteLine("  Puente COM de Excel");
        Console.WriteLine("========================================");
        Console.WriteLine();
        Console.WriteLine("Iniciando puente COM...");
        Console.WriteLine();
        
        try
        {
            // Obtener ruta del archivo Excel desde argumentos o usar ruta por defecto
            string excelPath = args.Length > 0 ? args[0] : FindExcelFile();
            
            if (string.IsNullOrEmpty(excelPath))
            {
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine("ADVERTENCIA: No se especificó ruta del archivo Excel.");
                Console.WriteLine("El puente COM está en espera de conexiones VBA.");
                Console.ResetColor();
                Console.WriteLine();
                Console.WriteLine("Presiona cualquier tecla para detener...");
                Console.ReadKey();
                return;
            }
            
            var bridge = new StreamListener();
            bridge.StartEngine(excelPath);
            
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("✅ Puente COM iniciado correctamente.");
            Console.ResetColor();
            Console.WriteLine();
            Console.WriteLine("El sistema está escuchando cambios en Excel.");
            Console.WriteLine("Presiona cualquier tecla para detener...");
            Console.ReadKey();
            
            bridge.StopEngine();
            Console.WriteLine("Puente COM detenido.");
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"ERROR FATAL: {ex.Message}");
            Console.WriteLine();
            Console.WriteLine($"Stack Trace: {ex.StackTrace}");
            Console.ResetColor();
            Console.WriteLine();
            Console.WriteLine("Presiona cualquier tecla para salir...");
            Console.ReadKey();
        }
    }
    
    private static string? FindExcelFile()
    {
        // Buscar el archivo Excel en ubicaciones comunes
        var searchPaths = new[]
        {
            @"..\..\ARBITRAGEXPLUS2025.xlsm",
            @"..\..\..\ARBITRAGEXPLUS2025.xlsm",
            @"ARBITRAGEXPLUS2025.xlsm",
            System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Desktop), "ARBITRAGEXPLUS2025.xlsm"),
            System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "ARBITRAGEXPLUS2025.xlsm")
        };
        
        foreach (var path in searchPaths)
        {
            string fullPath = System.IO.Path.GetFullPath(path);
            if (System.IO.File.Exists(fullPath))
            {
                Console.WriteLine($"Archivo Excel encontrado: {fullPath}");
                return fullPath;
            }
        }
        
        return null;
    }
}

