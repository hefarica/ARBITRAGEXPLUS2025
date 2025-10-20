using System.Diagnostics;
using System.Runtime.InteropServices;

namespace MASTER_RUNNER;

public static class ServiceManager
{
    private static readonly List<Process> RunningProcesses = new();
    private static readonly object ConsoleLock = new();

    public static async Task StartAllServicesAsync()
    {
        Console.WriteLine("[1/3] Iniciando API Server (Node.js)...");
        await StartApiServerAsync();
        
        Console.WriteLine("\n[2/3] Iniciando Oráculos de Precios (Python)...");
        await StartOraclesAsync();
        
        Console.WriteLine("\n[3/3] Iniciando Excel COM Bridge (.NET)...");
        await StartComBridgeAsync();
        
        Console.WriteLine();
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine("✓ Todos los servicios han sido iniciados correctamente");
        Console.ResetColor();
    }

    private static async Task StartApiServerAsync()
    {
        string apiServerPath = Path.Combine("..", "automation", "api-server");
        string packageJsonPath = Path.Combine(apiServerPath, "package.json");

        if (!File.Exists(packageJsonPath))
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("  ⚠ API Server no encontrado, omitiendo...");
            Console.ResetColor();
            return;
        }

        try
        {
            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "npm",
                    Arguments = "run dev",
                    WorkingDirectory = Path.GetFullPath(apiServerPath),
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                }
            };

            process.OutputDataReceived += (sender, e) =>
            {
                if (!string.IsNullOrEmpty(e.Data))
                {
                    lock (ConsoleLock)
                    {
                        Console.ForegroundColor = ConsoleColor.Cyan;
                        Console.Write("[API Server] ");
                        Console.ResetColor();
                        Console.WriteLine(e.Data);
                    }
                }
            };

            process.ErrorDataReceived += (sender, e) =>
            {
                if (!string.IsNullOrEmpty(e.Data))
                {
                    lock (ConsoleLock)
                    {
                        Console.ForegroundColor = ConsoleColor.Yellow;
                        Console.Write("[API Server] ");
                        Console.ResetColor();
                        Console.WriteLine(e.Data);
                    }
                }
            };

            process.Start();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();
            
            RunningProcesses.Add(process);

            // Esperar un momento para que el servidor se inicie
            await Task.Delay(2000);

            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("  ✓ API Server iniciado (puerto 8009)");
            Console.ResetColor();
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"  ✗ Error al iniciar API Server: {ex.Message}");
            Console.ResetColor();
        }
    }

    private static async Task StartOraclesAsync()
    {
        string oraclesPath = Path.Combine("..", "automation", "oracles");
        string binanceOraclePath = Path.Combine(oraclesPath, "BinanceOracleV2.py");

        if (!File.Exists(binanceOraclePath))
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("  ⚠ Oráculos no encontrados, omitiendo...");
            Console.ResetColor();
            return;
        }

        try
        {
            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "python",
                    Arguments = $"\"{binanceOraclePath}\"",
                    WorkingDirectory = Path.GetFullPath(oraclesPath),
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                }
            };

            process.OutputDataReceived += (sender, e) =>
            {
                if (!string.IsNullOrEmpty(e.Data))
                {
                    lock (ConsoleLock)
                    {
                        Console.ForegroundColor = ConsoleColor.Magenta;
                        Console.Write("[Binance Oracle] ");
                        Console.ResetColor();
                        Console.WriteLine(e.Data);
                    }
                }
            };

            process.ErrorDataReceived += (sender, e) =>
            {
                if (!string.IsNullOrEmpty(e.Data))
                {
                    lock (ConsoleLock)
                    {
                        Console.ForegroundColor = ConsoleColor.Yellow;
                        Console.Write("[Binance Oracle] ");
                        Console.ResetColor();
                        Console.WriteLine(e.Data);
                    }
                }
            };

            process.Start();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();
            
            RunningProcesses.Add(process);

            // Esperar un momento para que el oráculo se conecte
            await Task.Delay(1000);

            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("  ✓ Oráculo de Binance iniciado");
            Console.ResetColor();
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"  ✗ Error al iniciar Oráculo: {ex.Message}");
            Console.ResetColor();
        }
    }

    private static async Task StartComBridgeAsync()
    {
        // Buscar el ejecutable en las posibles ubicaciones
        var possiblePaths = new[]
        {
            Path.Combine("..", "automation", "excel-com-bridge", "bin", "Release", "net48", "win-x86", "ExcelComBridge.exe"),
            Path.Combine("..", "automation", "excel-com-bridge", "bin", "Release", "net48", "ExcelComBridge.exe"),
            Path.Combine("..", "automation", "excel-com-bridge", "bin", "x86", "Release", "net48", "ExcelComBridge.exe")
        };

        string? comBridgePath = null;
        foreach (var path in possiblePaths)
        {
            if (File.Exists(path))
            {
                comBridgePath = path;
                break;
            }
        }

        if (comBridgePath == null)
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("  ⚠ Excel COM Bridge no encontrado, omitiendo...");
            Console.WriteLine("    El puente COM debe compilarse primero.");
            Console.WriteLine("    Ubicaciones buscadas:");
            foreach (var path in possiblePaths)
            {
                Console.WriteLine($"      - {Path.GetFullPath(path)}");
            }
            Console.ResetColor();
            return;
        }

        try
        {
            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = comBridgePath,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                }
            };

            process.OutputDataReceived += (sender, e) =>
            {
                if (!string.IsNullOrEmpty(e.Data))
                {
                    lock (ConsoleLock)
                    {
                        Console.ForegroundColor = ConsoleColor.Green;
                        Console.Write("[COM Bridge] ");
                        Console.ResetColor();
                        Console.WriteLine(e.Data);
                    }
                }
            };

            process.ErrorDataReceived += (sender, e) =>
            {
                if (!string.IsNullOrEmpty(e.Data))
                {
                    lock (ConsoleLock)
                    {
                        Console.ForegroundColor = ConsoleColor.Yellow;
                        Console.Write("[COM Bridge] ");
                        Console.ResetColor();
                        Console.WriteLine(e.Data);
                    }
                }
            };

            process.Start();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();
            
            RunningProcesses.Add(process);

            // Esperar un momento para que el puente COM se registre
            await Task.Delay(1000);

            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("  ✓ Excel COM Bridge iniciado");
            Console.ResetColor();
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"  ✗ Error al iniciar COM Bridge: {ex.Message}");
            Console.ResetColor();
        }
    }

    public static void OpenExcel()
    {
        // Buscar archivo Excel en ubicaciones comunes
        var possiblePaths = new[]
        {
            Path.Combine("..", "ARBITRAGEXPLUS2025.xlsm"),
            Path.Combine("..", "data", "ARBITRAGEXPLUS2025.xlsm"),
            Path.Combine("..", "..", "ARBITRAGEXPLUS2025.xlsm"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Desktop), "ARBITRAGEXPLUS2025.xlsm"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "ARBITRAGEXPLUS2025.xlsm"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads", "ARBITRAGEXPLUS2025.xlsm"),
            "ARBITRAGEXPLUS2025.xlsm"
        };

        string? excelPath = null;
        foreach (var path in possiblePaths)
        {
            try
            {
                string fullPath = Path.GetFullPath(path);
                if (File.Exists(fullPath))
                {
                    excelPath = fullPath;
                    break;
                }
            }
            catch
            {
                // Ignorar errores de ruta inválida
                continue;
            }
        }

        if (excelPath != null)
        {
            try
            {
                Process.Start(new ProcessStartInfo(excelPath) { UseShellExecute = true });
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine($"  ✓ Excel abierto: {excelPath}");
                Console.ResetColor();
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine($"  ⚠ No se pudo abrir Excel automáticamente: {ex.Message}");
                Console.WriteLine($"    Por favor, abre manualmente: {excelPath}");
                Console.ResetColor();
            }
        }
        else
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("  ⚠ Archivo Excel no encontrado en ubicaciones comunes");
            Console.WriteLine("    Ubicaciones buscadas:");
            foreach (var path in possiblePaths)
            {
                try
                {
                    Console.WriteLine($"      - {Path.GetFullPath(path)}");
                }
                catch
                {
                    Console.WriteLine($"      - {path}");
                }
            }
            Console.ResetColor();
            Console.WriteLine();
            Console.WriteLine("  Por favor, abre manualmente el archivo ARBITRAGEXPLUS2025.xlsm");
        }
    }

    public static void StopAllServices()
    {
        foreach (var process in RunningProcesses)
        {
            try
            {
                if (!process.HasExited)
                {
                    // Intentar cerrar gracefully primero
                    process.CloseMainWindow();
                    
                    // Esperar 2 segundos
                    if (!process.WaitForExit(2000))
                    {
                        // Si no se cierra, forzar
                        process.Kill(entireProcessTree: true);
                    }
                    
                    Console.WriteLine($"  ✓ Servicio detenido (PID: {process.Id})");
                }
            }
            catch (Exception ex)
            {
                // Ignorar errores al matar procesos que ya están muertos
                Console.WriteLine($"  • Proceso ya finalizado (PID: {process.Id})");
            }
        }
        
        RunningProcesses.Clear();
    }
}

