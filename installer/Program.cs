using System.Diagnostics;
using System.Runtime.InteropServices;

namespace MASTER_RUNNER;

class Program
{
    // Importar función de Windows para manejar Ctrl+C
    [DllImport("kernel32.dll")]
    static extern bool SetConsoleCtrlHandler(CtrlHandler handler, bool add);
    
    delegate bool CtrlHandler(CtrlType sig);
    
    static bool ConsoleCtrlCheck(CtrlType sig)
    {
        Console.WriteLine("\n\n========================================");
        Console.WriteLine("  Deteniendo todos los servicios...");
        Console.WriteLine("========================================");
        Console.WriteLine("Por favor, espera mientras se cierran los procesos de forma segura.\n");
        
        ServiceManager.StopAllServices();
        
        Console.WriteLine("\n[OK] Todos los servicios han sido detenidos.");
        Console.WriteLine("Presiona cualquier tecla para salir.");
        Console.ReadKey();
        
        Environment.Exit(0);
        return true;
    }

    enum CtrlType : uint
    {
        CTRL_C_EVENT = 0,
        CTRL_BREAK_EVENT = 1,
        CTRL_CLOSE_EVENT = 2,
        CTRL_LOGOFF_EVENT = 5,
        CTRL_SHUTDOWN_EVENT = 6
    }

    static async Task Main(string[] args)
    {
        // Configurar consola
        Console.Title = "ARBITRAGEXPLUS2025 - Master Runner v1.0";
        Console.OutputEncoding = System.Text.Encoding.UTF8;
        
        // Mostrar banner
        ShowBanner();

        // Manejar Ctrl+C para cerrar limpiamente
        SetConsoleCtrlHandler(new CtrlHandler(ConsoleCtrlCheck), true);

        try
        {
            Console.WriteLine("Iniciando sistema ARBITRAGEXPLUS2025...\n");
            
            // 1. Auto-Diagnóstico y Configuración
            Console.WriteLine("========================================");
            Console.WriteLine("  FASE 1: Verificación de Dependencias");
            Console.WriteLine("========================================\n");
            await ComponentsChecker.CheckAndConfigureAsync();

            // 2. Compilar si es necesario
            Console.WriteLine("\n========================================");
            Console.WriteLine("  FASE 2: Compilación de Componentes");
            Console.WriteLine("========================================\n");
            await FileManager.CompileComBridgeAsync();

            // 3. Iniciar todos los servicios
            Console.WriteLine("\n========================================");
            Console.WriteLine("  FASE 3: Inicio de Servicios");
            Console.WriteLine("========================================\n");
            await ServiceManager.StartAllServicesAsync();

            // 4. Abrir Excel
            Console.WriteLine("\n========================================");
            Console.WriteLine("  FASE 4: Apertura de Excel");
            Console.WriteLine("========================================\n");
            ServiceManager.OpenExcel();

            // 5. Entrar en modo monitor
            Console.WriteLine("\n========================================");
            Console.WriteLine("  SISTEMA EN EJECUCIÓN");
            Console.WriteLine("========================================");
            Console.WriteLine();
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("✓ Todos los servicios están activos y funcionando");
            Console.ResetColor();
            Console.WriteLine();
            Console.WriteLine("Logs en tiempo real:");
            Console.WriteLine("─────────────────────────────────────────");
            Console.WriteLine();
            
            // Mantener la aplicación viva
            await Task.Delay(Timeout.Infinite);
        }
        catch (Exception ex)
        {
            Console.WriteLine();
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine("========================================");
            Console.WriteLine("  ERROR FATAL");
            Console.WriteLine("========================================");
            Console.WriteLine();
            Console.WriteLine($"Mensaje: {ex.Message}");
            Console.WriteLine();
            Console.WriteLine($"Stack Trace:");
            Console.WriteLine(ex.StackTrace);
            Console.ResetColor();
            Console.WriteLine();
            Console.WriteLine("Presiona cualquier tecla para salir.");
            Console.ReadKey();
            Environment.Exit(1);
        }
    }

    static void ShowBanner()
    {
        Console.Clear();
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine(@"
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║        █████╗ ██████╗ ██████╗ ██╗████████╗██████╗        ║
║       ██╔══██╗██╔══██╗██╔══██╗██║╚══██╔══╝██╔══██╗       ║
║       ███████║██████╔╝██████╔╝██║   ██║   ██████╔╝       ║
║       ██╔══██║██╔══██╗██╔══██╗██║   ██║   ██╔══██╗       ║
║       ██║  ██║██║  ██║██████╔╝██║   ██║   ██║  ██║       ║
║       ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝   ╚═╝   ╚═╝  ╚═╝       ║
║                                                           ║
║              ARBITRAGEXPLUS2025 - Master Runner          ║
║                      Version 1.0.0                        ║
║                                                           ║
║         Sistema de Arbitraje de Criptomonedas            ║
║              Arquitectura Reactiva - Excel UI            ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
");
        Console.ResetColor();
        Console.WriteLine();
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine("ADVERTENCIA: Este sistema se conecta a servicios externos.");
        Console.WriteLine("Asegúrate de tener una conexión a Internet estable.");
        Console.ResetColor();
        Console.WriteLine();
        Console.WriteLine("Presiona Ctrl+C en cualquier momento para detener todos los servicios.");
        Console.WriteLine();
    }
}

