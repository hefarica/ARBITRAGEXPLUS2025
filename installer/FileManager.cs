using System.Diagnostics;

namespace MASTER_RUNNER;

public static class FileManager
{
    public static async Task CompileComBridgeAsync()
    {
        string projectPath = Path.Combine("..", "automation", "excel-com-bridge", "ExcelComBridge.csproj");
        string exePath = Path.Combine("..", "automation", "excel-com-bridge", "bin", "Release", "net8.0", "ExcelComBridge.exe");

        if (!File.Exists(projectPath))
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine($"  ⚠ No se encontró el proyecto Excel COM Bridge en:");
            Console.WriteLine($"    {Path.GetFullPath(projectPath)}");
            Console.ResetColor();
            Console.WriteLine("  El sistema continuará sin el puente COM.");
            return;
        }

        // Verificar si necesita compilación
        bool needsCompilation = !File.Exists(exePath);
        
        if (!needsCompilation)
        {
            // Verificar si el código fuente es más nuevo que el ejecutable
            var projectLastWrite = File.GetLastWriteTime(projectPath);
            var exeLastWrite = File.GetLastWriteTime(exePath);
            
            // Verificar archivos .cs en la carpeta
            var csFiles = Directory.GetFiles(Path.GetDirectoryName(projectPath)!, "*.cs", SearchOption.AllDirectories);
            var newestCsFile = csFiles.Select(f => File.GetLastWriteTime(f)).Max();
            
            needsCompilation = newestCsFile > exeLastWrite || projectLastWrite > exeLastWrite;
        }

        if (!needsCompilation)
        {
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("  ✓ Excel COM Bridge ya está compilado y actualizado");
            Console.ResetColor();
            Console.WriteLine($"    Ubicación: {Path.GetFullPath(exePath)}");
            return;
        }

        Console.WriteLine("  Compilando Excel COM Bridge...");
        Console.WriteLine("  (Esto puede tardar 1-2 minutos)");
        Console.WriteLine();

        try
        {
            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "dotnet",
                    Arguments = $"build \"{projectPath}\" -c Release --nologo",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };

            process.OutputDataReceived += (sender, e) =>
            {
                if (!string.IsNullOrEmpty(e.Data))
                {
                    Console.WriteLine($"    {e.Data}");
                }
            };

            process.ErrorDataReceived += (sender, e) =>
            {
                if (!string.IsNullOrEmpty(e.Data))
                {
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Console.WriteLine($"    {e.Data}");
                    Console.ResetColor();
                }
            };

            process.Start();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();
            await process.WaitForExitAsync();

            if (process.ExitCode == 0)
            {
                Console.WriteLine();
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine("  ✓ Excel COM Bridge compilado exitosamente");
                Console.ResetColor();
                Console.WriteLine($"    Ejecutable: {Path.GetFullPath(exePath)}");
            }
            else
            {
                Console.WriteLine();
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine($"  ✗ Error al compilar Excel COM Bridge (código de salida: {process.ExitCode})");
                Console.ResetColor();
                Console.WriteLine("  El sistema continuará sin el puente COM.");
            }
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"  ✗ Error al compilar Excel COM Bridge: {ex.Message}");
            Console.ResetColor();
            Console.WriteLine("  El sistema continuará sin el puente COM.");
        }
    }

    public static void EnsureDirectoriesExist()
    {
        // Crear directorios necesarios si no existen
        var directories = new[]
        {
            Path.Combine("..", "automation", "api-server", "logs"),
            Path.Combine("..", "automation", "excel-com-bridge", "logs"),
            Path.Combine("..", "automation", "oracles", "logs"),
            Path.Combine("..", "data")
        };

        foreach (var dir in directories)
        {
            if (!Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
                Console.WriteLine($"  Creado directorio: {dir}");
            }
        }
    }
}

