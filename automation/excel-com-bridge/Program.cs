using System;
using System.IO;
using System.Windows.Forms;

namespace ArbitrageXStreamListener
{
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

            // Buscar archivo Excel
            string[] possibleLocations = new[]
            {
                Path.Combine(Directory.GetCurrentDirectory(), "ARBITRAGEXPLUS2025.xlsm"),
                Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "ARBITRAGEXPLUS2025.xlsm"),
                Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "..", "ARBITRAGEXPLUS2025.xlsm"),
                Path.Combine(Directory.GetCurrentDirectory(), "data", "ARBITRAGEXPLUS2025.xlsm"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Desktop), "ARBITRAGEXPLUS2025.xlsm"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "ARBITRAGEXPLUS2025.xlsm"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads", "ARBITRAGEXPLUS2025.xlsm")
            };

            string excelFilePath = null;
            foreach (var location in possibleLocations)
            {
                if (File.Exists(location))
                {
                    excelFilePath = location;
                    break;
                }
            }

            if (excelFilePath == null)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("ERROR: No se encontró el archivo ARBITRAGEXPLUS2025.xlsm");
                Console.ResetColor();
                Console.WriteLine();
                Console.WriteLine("Ubicaciones buscadas:");
                foreach (var location in possibleLocations)
                {
                    Console.WriteLine($"  - {location}");
                }
                Console.WriteLine();
                Console.WriteLine("Presiona cualquier tecla para salir...");
                Console.ReadKey();
                return;
            }

            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine($"Archivo Excel encontrado: {excelFilePath}");
            Console.ResetColor();
            Console.WriteLine();

            // Iniciar StreamListener
            try
            {
                var listener = new StreamListener(excelFilePath);
                listener.Start();

                Console.WriteLine();
                Console.WriteLine("Presiona cualquier tecla para detener el puente COM...");
                Console.ReadKey();

                listener.Stop();
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine($"ERROR: {ex.Message}");
                Console.ResetColor();
                Console.WriteLine();
                Console.WriteLine("Presiona cualquier tecla para salir...");
                Console.ReadKey();
            }
        }
    }
}

