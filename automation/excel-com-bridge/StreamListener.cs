using System.Collections.Concurrent;
using System.Runtime.InteropServices;
using MASTER_RUNNER;
using MASTER_RUNNER.Collectors;

namespace ArbitrageXStreamListener;

[ComVisible(true)]
[Guid("12345678-1234-1234-1234-123456789ABC")]
[ClassInterface(ClassInterfaceType.AutoDual)]
[ProgId("ExcelComBridge.StreamListener")]
public class StreamListener
{
    private readonly ConcurrentQueue<Request> _eventQueue = new();
    private readonly CancellationTokenSource _cts = new();
    private dynamic? _excelApp;
    private dynamic? _workbook;
    private bool _isRunning = false;

    public void StartEngine(string excelPath)
    {
        _excelApp = Activator.CreateInstance(Type.GetTypeFromProgID("Excel.Application"));
        _workbook = _excelApp.Workbooks.Open(excelPath);
        _isRunning = true;
        
        Task.Run(() => ProcessQueue());
    }

    public void StopEngine()
    {
        _isRunning = false;
        _cts.Cancel();
        _workbook?.Close(false);
        _excelApp?.Quit();
    }

    public void OnCellChanged(int row, string columnName, string value)
    {
        if (!_isRunning) return;
        if (string.IsNullOrEmpty(value)) return;
        
        // Por ahora, solo manejamos el caso de la columna NAME en BLOCKCHAINS
        // En el futuro, esto puede ser más genérico
        if (columnName.Equals("NAME", StringComparison.OrdinalIgnoreCase))
        {
            _eventQueue.Enqueue(new Request { Row = row, Name = value.ToLower() });
        }
    }

    private async Task ProcessQueue()
    {
        while (!_cts.IsCancellationRequested)
        {
            if (_eventQueue.TryDequeue(out var request))
            {
                await ProcessRequestAsync(request);
            }
            else
            {
                await Task.Delay(50);
            }
        }
    }

    private async Task ProcessRequestAsync(Request request)
    {
        Console.WriteLine($"[COM Bridge] Procesando solicitud para '{request.Name}' en la fila {request.Row}...");
        
        var defiLlamaTask = DefiLlamaCollector.GetDataAsync(request.Name);
        var llamanodesTask = LlamanodesCollector.GetDataAsync(request.Name);
        var publicnodesTask = PublicnodesCollector.GetDataAsync(request.Name);

        await Task.WhenAll(defiLlamaTask, llamanodesTask, publicnodesTask);

        var mergedData = BlockchainDataMerger.Merge(defiLlamaTask.Result, llamanodesTask.Result, publicnodesTask.Result);

        if (mergedData != null)
        {
            UpdateRow(request.Row, mergedData);
        }
    }

    private void UpdateRow(int row, BlockchainData data)
    {
        if (_workbook == null) return;
        dynamic worksheet = _workbook.Sheets["BLOCKCHAINS"];
        
        foreach (var entry in data.Data)
        {
            try
            {
                // Encontrar la columna por nombre de encabezado
                int col = FindColumnByName(worksheet, entry.Key);
                if (col > 0)
                {
                    worksheet.Cells[row, col].Value = entry.Value;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[COM Bridge] Error escribiendo celda {entry.Key}: {ex.Message}");
            }
        }
    }

    private int FindColumnByName(dynamic worksheet, string headerName)
    {
        // Buscar el encabezado en la primera fila
        dynamic lastCol = worksheet.Cells(1, worksheet.Columns.Count).End(XlDirection.xlToLeft);
        for (int c = 1; c <= lastCol.Column; c++)
        {
            if (worksheet.Cells(1, c).Value?.ToString().Equals(headerName, StringComparison.OrdinalIgnoreCase) ?? false)
            {
                return c;
            }
        }
        return -1; // No encontrado
    }
}

public class Request
{
    public int Row { get; set; }
    public string Name { get; set; } = "";
}

public enum XlDirection
{
    xlDown = -4121,
    xlToLeft = -4159,
    xlToRight = -4161,
    xlUp = -4162
}

