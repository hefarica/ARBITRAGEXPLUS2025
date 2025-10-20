using System.Diagnostics;
using System.Runtime.InteropServices;

namespace MASTER_RUNNER;

public static class ComponentsChecker
{
    public static async Task CheckAndConfigureAsync()
    {
        Console.WriteLine("[1/6] Verificando .NET 8 SDK...");
        await CheckDotNetAsync();
        
        Console.WriteLine("\n[2/6] Verificando Node.js y npm...");
        await CheckNodeAndNpmAsync();
        
        Console.WriteLine("\n[3/6] Verificando Python y pip...");
        await CheckPythonAndPipAsync();
        
        Console.WriteLine("\n[4/6] Instalando paquetes de Python...");
        await InstallPythonPackagesAsync();
        
        Console.WriteLine("\n[5/6] Instalando paquetes de Node.js...");
        await InstallNodePackagesAsync();
        
        Console.WriteLine("\n[6/6] Creando archivos de configuración...");
        CreateConfigFiles();
        
        Console.WriteLine();
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine("✓ Todas las dependencias están configuradas correctamente.");
        Console.ResetColor();
    }

    private static async Task CheckDotNetAsync()
    {
        try
        {
            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "dotnet",
                    Arguments = "--list-sdks",
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };
            
            process.Start();
            string output = await process.StandardOutput.ReadToEndAsync();
            await process.WaitForExitAsync();

            if (output.Contains("8.0."))
            {
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine("  ✓ .NET 8 SDK encontrado");
                Console.ResetColor();
                
                // Mostrar versión
                var lines = output.Split('\n');
                var dotnet8Line = lines.FirstOrDefault(l => l.Contains("8.0."));
                if (dotnet8Line != null)
                {
                    Console.WriteLine($"    Versión: {dotnet8Line.Trim()}");
                }
            }
            else
            {
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine("  ⚠ .NET 8 SDK no encontrado");
                Console.ResetColor();
                Console.WriteLine("    Por favor, instálalo desde: https://dotnet.microsoft.com/download");
                Console.WriteLine("    Descarga: .NET 8.0 SDK (x64)");
                Console.WriteLine();
                Console.WriteLine("  ¿Deseas abrir el navegador para descargar? (s/n)");
                var response = Console.ReadLine()?.ToLower();
                if (response == "s" || response == "y")
                {
                    OpenUrl("https://dotnet.microsoft.com/download/dotnet/8.0");
                }
            }
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"  ✗ Error al verificar .NET: {ex.Message}");
            Console.ResetColor();
        }
    }

    private static async Task CheckNodeAndNpmAsync()
    {
        try
        {
            // Verificar Node.js
            var nodeProcess = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "node",
                    Arguments = "--version",
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };
            
            nodeProcess.Start();
            string nodeVersion = await nodeProcess.StandardOutput.ReadToEndAsync();
            await nodeProcess.WaitForExitAsync();

            if (nodeProcess.ExitCode == 0)
            {
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine($"  ✓ Node.js encontrado: {nodeVersion.Trim()}");
                Console.ResetColor();
            }
            else
            {
                throw new Exception("Node.js no encontrado");
            }

            // Verificar npm - Intentar agregar al PATH si no está
            var npmProcess = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "npm",
                    Arguments = "--version",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };
            
            try
            {
                npmProcess.Start();
                string npmVersion = await npmProcess.StandardOutput.ReadToEndAsync();
                await npmProcess.WaitForExitAsync();

                if (npmProcess.ExitCode == 0)
                {
                    Console.ForegroundColor = ConsoleColor.Green;
                    Console.WriteLine($"  ✓ npm encontrado: {npmVersion.Trim()}");
                    Console.ResetColor();
                }
                else
                {
                    throw new Exception("npm no encontrado");
                }
            }
            catch
            {
                // Intentar agregar Node.js al PATH
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine("  ⚠ npm no encontrado en PATH, intentando agregar...");
                Console.ResetColor();
                
                // Ubicaciones comunes de Node.js
                string[] possiblePaths = new[]
                {
                    @"C:\Program Files\nodejs",
                    @"C:\Program Files (x86)\nodejs",
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs"),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "npm")
                };

                foreach (var path in possiblePaths)
                {
                    if (Directory.Exists(path))
                    {
                        var currentPath = Environment.GetEnvironmentVariable("PATH", EnvironmentVariableTarget.Process);
                        if (!currentPath.Contains(path))
                        {
                            Environment.SetEnvironmentVariable("PATH", $"{currentPath};{path}", EnvironmentVariableTarget.Process);
                            Console.WriteLine($"  ✓ Agregado al PATH: {path}");
                        }
                    }
                }

                // Intentar de nuevo
                var npmRetry = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "npm",
                        Arguments = "--version",
                        RedirectStandardOutput = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };
                
                try
                {
                    npmRetry.Start();
                    string npmVersion = await npmRetry.StandardOutput.ReadToEndAsync();
                    await npmRetry.WaitForExitAsync();

                    if (npmRetry.ExitCode == 0)
                    {
                        Console.ForegroundColor = ConsoleColor.Green;
                        Console.WriteLine($"  ✓ npm encontrado: {npmVersion.Trim()}");
                        Console.ResetColor();
                    }
                    else
                    {
                        throw new Exception("npm no encontrado después de agregar al PATH");
                    }
                }
                catch
                {
                    throw new Exception("npm no encontrado");
                }
            }
        }
        catch (Exception)
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("  ⚠ Node.js o npm no encontrado");
            Console.ResetColor();
            Console.WriteLine("    Por favor, instala Node.js desde: https://nodejs.org/");
            Console.WriteLine("    Descarga: LTS (Recomendado para la mayoría de usuarios)");
            Console.WriteLine();
            Console.WriteLine("  ¿Deseas abrir el navegador para descargar? (s/n)");
            var response = Console.ReadLine()?.ToLower();
            if (response == "s" || response == "y")
            {
                OpenUrl("https://nodejs.org/");
            }
        }
    }

    private static async Task CheckPythonAndPipAsync()
    {
        try
        {
            // Verificar Python
            var pythonProcess = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "python",
                    Arguments = "--version",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };
            
            pythonProcess.Start();
            string pythonVersion = await pythonProcess.StandardOutput.ReadToEndAsync();
            string pythonError = await pythonProcess.StandardError.ReadToEndAsync();
            await pythonProcess.WaitForExitAsync();

            string version = !string.IsNullOrEmpty(pythonVersion) ? pythonVersion : pythonError;

            if (pythonProcess.ExitCode == 0 || version.Contains("Python"))
            {
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine($"  ✓ Python encontrado: {version.Trim()}");
                Console.ResetColor();
            }
            else
            {
                throw new Exception("Python no encontrado");
            }

            // Verificar pip
            var pipProcess = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "pip",
                    Arguments = "--version",
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };
            
            pipProcess.Start();
            string pipVersion = await pipProcess.StandardOutput.ReadToEndAsync();
            await pipProcess.WaitForExitAsync();

            if (pipProcess.ExitCode == 0)
            {
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine($"  ✓ pip encontrado: {pipVersion.Trim().Split('\n')[0]}");
                Console.ResetColor();
            }
            else
            {
                throw new Exception("pip no encontrado");
            }
        }
        catch (Exception)
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("  ⚠ Python o pip no encontrado");
            Console.ResetColor();
            Console.WriteLine("    Por favor, instala Python desde: https://www.python.org/downloads/");
            Console.WriteLine("    Descarga: Python 3.11 o superior");
            Console.WriteLine("    IMPORTANTE: Marca la opción 'Add Python to PATH' durante la instalación");
            Console.WriteLine();
            Console.WriteLine("  ¿Deseas abrir el navegador para descargar? (s/n)");
            var response = Console.ReadLine()?.ToLower();
            if (response == "s" || response == "y")
            {
                OpenUrl("https://www.python.org/downloads/");
            }
        }
    }

    private static async Task InstallPythonPackagesAsync()
    {
        string requirementsPath = Path.Combine("..", "automation", "oracles", "requirements.txt");
        
        if (!File.Exists(requirementsPath))
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine($"  ⚠ No se encontró {requirementsPath}");
            Console.ResetColor();
            return;
        }

        try
        {
            Console.WriteLine("  Instalando paquetes desde requirements.txt...");
            
            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "pip",
                    Arguments = $"install -r \"{requirementsPath}\" --quiet",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };
            
            process.Start();
            await process.WaitForExitAsync();

            if (process.ExitCode == 0)
            {
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine("  ✓ Paquetes de Python instalados correctamente");
                Console.ResetColor();
            }
            else
            {
                string error = await process.StandardError.ReadToEndAsync();
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine($"  ⚠ Advertencia al instalar paquetes: {error}");
                Console.ResetColor();
            }
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"  ✗ Error al instalar paquetes de Python: {ex.Message}");
            Console.ResetColor();
        }
    }

    private static async Task InstallNodePackagesAsync()
    {
        string apiServerPath = Path.Combine("..", "automation", "api-server");
        
        if (!Directory.Exists(apiServerPath))
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine($"  ⚠ No se encontró la carpeta {apiServerPath}");
            Console.ResetColor();
            return;
        }

        string packageJsonPath = Path.Combine(apiServerPath, "package.json");
        if (!File.Exists(packageJsonPath))
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine($"  ⚠ No se encontró package.json en {apiServerPath}");
            Console.ResetColor();
            return;
        }

        try
        {
            Console.WriteLine("  Instalando paquetes de Node.js...");
            Console.WriteLine("  (Esto puede tardar varios minutos la primera vez)");
            
            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = "/c npm install",
                    WorkingDirectory = Path.GetFullPath(apiServerPath),
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };
            
            process.Start();
            await process.WaitForExitAsync();

            if (process.ExitCode == 0)
            {
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine("  ✓ Paquetes de Node.js instalados correctamente");
                Console.ResetColor();
            }
            else
            {
                string error = await process.StandardError.ReadToEndAsync();
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine($"  ⚠ Advertencia al instalar paquetes: {error}");
                Console.ResetColor();
            }
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"  ✗ Error al instalar paquetes de Node.js: {ex.Message}");
            Console.ResetColor();
        }
    }

    private static void CreateConfigFiles()
    {
        // Crear .env para API server si no existe
        string apiEnvPath = Path.Combine("..", "automation", "api-server", ".env");
        string apiEnvTemplate = Path.Combine("templates", ".env.api.template");
        
        if (!File.Exists(apiEnvPath) && File.Exists(apiEnvTemplate))
        {
            File.Copy(apiEnvTemplate, apiEnvPath);
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("  ✓ Creado archivo .env para API Server");
            Console.ResetColor();
        }
        else if (File.Exists(apiEnvPath))
        {
            Console.WriteLine("  • Archivo .env para API Server ya existe");
        }

        // Crear .env para oráculos si no existe
        string oraclesEnvPath = Path.Combine("..", "automation", "oracles", ".env");
        string oraclesEnvTemplate = Path.Combine("templates", ".env.oracles.template");
        
        if (!File.Exists(oraclesEnvPath) && File.Exists(oraclesEnvTemplate))
        {
            File.Copy(oraclesEnvTemplate, oraclesEnvPath);
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("  ✓ Creado archivo .env para Oráculos");
            Console.ResetColor();
        }
        else if (File.Exists(oraclesEnvPath))
        {
            Console.WriteLine("  • Archivo .env para Oráculos ya existe");
        }
    }

    private static void OpenUrl(string url)
    {
        try
        {
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
            else if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
            {
                Process.Start("xdg-open", url);
            }
            else if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
            {
                Process.Start("open", url);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"  No se pudo abrir el navegador: {ex.Message}");
            Console.WriteLine($"  Por favor, visita manualmente: {url}");
        }
    }
}

