' ========================================
' ARBITRAGEXPLUS2025 - Excel VBA Macros
' ========================================
' 
' Instrucciones de instalación:
' 1. Abre ARBITRAGEXPLUS2025.xlsx
' 2. Presiona Alt+F11 para abrir el editor VBA
' 3. Inserta un nuevo módulo: Insert > Module
' 4. Copia y pega este código
' 5. Guarda el archivo como .xlsm (con macros habilitadas)
' 6. Cierra el editor VBA
'
' ========================================

Option Explicit

' Variable global para el objeto COM externo
Public ExternalComBridge As Object

' ========================================
' Evento: Al abrir el libro
' ========================================
Private Sub Workbook_Open()
    ' Mensaje de bienvenida
    Debug.Print "ARBITRAGEXPLUS2025 - Sistema de automatización cargado"
    
    ' Habilitar eventos
    Application.EnableEvents = True
    
    ' Opcional: Conectar con COM Bridge externo
    ' ConnectToComBridge
End Sub

' ========================================
' Evento: Al cambiar cualquier celda
' ========================================
Private Sub Workbook_SheetChange(ByVal Sh As Object, ByVal Target As Range)
    ' Solo procesar si es la hoja BLOCKCHAINS
    If Sh.Name <> "BLOCKCHAINS" Then Exit Sub
    
    ' Solo procesar si es la columna B (NAME)
    If Target.Column <> 2 Then Exit Sub
    
    ' Evitar bucles infinitos y parpadeo
    Application.EnableEvents = False
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual
    
    On Error GoTo ErrorHandler
    
    ' Obtener el valor de la celda
    Dim cellValue As String
    cellValue = Trim(Target.Value)
    
    ' Si el valor está vacío, limpiar la fila
    If cellValue = "" Then
        Call ClearPushColumns(Target.Row)
        Debug.Print "Fila " & Target.Row & " limpiada (NAME vacío)"
    Else
        ' Notificar cambio al sistema externo
        Debug.Print "Cambio detectado en fila " & Target.Row & ": " & cellValue
        
        ' Si hay COM Bridge conectado, notificar
        If Not ExternalComBridge Is Nothing Then
            ExternalComBridge.OnNameChanged Target.Row, cellValue
        End If
    End If
    
ErrorHandler:
    ' Restaurar configuración
    Application.EnableEvents = True
    Application.ScreenUpdating = True
    Application.Calculation = xlCalculationAutomatic
    
    If Err.Number <> 0 Then
        Debug.Print "Error en Workbook_SheetChange: " & Err.Description
    End If
End Sub

' ========================================
' Limpiar columnas PUSH de una fila
' ========================================
Sub ClearPushColumns(ByVal rowNumber As Long)
    ' Desactivar actualización de pantalla
    Dim screenState As Boolean
    screenState = Application.ScreenUpdating
    Application.ScreenUpdating = False
    
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("BLOCKCHAINS")
    
    ' Obtener encabezados
    Dim lastCol As Long
    lastCol = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column
    
    Dim col As Long
    For col = 1 To lastCol
        ' Obtener color de fondo del encabezado
        Dim headerColor As Long
        headerColor = ws.Cells(1, col).Interior.Color
        
        ' Si es azul (#4472C4 = RGB(68, 114, 196) = 12874308)
        ' Permitir un rango de colores azules
        If IsBlueColor(headerColor) Then
            ' Limpiar la celda
            ws.Cells(rowNumber, col).Value = ""
        End If
    Next col
    
    ' Restaurar actualización de pantalla
    Application.ScreenUpdating = screenState
End Sub

' ========================================
' Verificar si un color es azul (PUSH)
' ========================================
Function IsBlueColor(ByVal color As Long) As Boolean
    ' Convertir color a RGB
    Dim r As Long, g As Long, b As Long
    r = color Mod 256
    g = (color \ 256) Mod 256
    b = (color \ 65536) Mod 256
    
    ' Azul #4472C4 = RGB(68, 114, 196)
    ' Permitir variación de ±10 en cada componente
    If Abs(r - 196) <= 10 And Abs(g - 114) <= 10 And Abs(b - 68) <= 10 Then
        IsBlueColor = True
    Else
        IsBlueColor = False
    End If
End Function

' ========================================
' Conectar con COM Bridge externo
' ========================================
Sub ConnectToComBridge()
    On Error Resume Next
    
    ' Intentar conectar con el objeto COM
    Set ExternalComBridge = GetObject(, "ExcelComBridge.Application")
    
    If Err.Number <> 0 Then
        Debug.Print "COM Bridge no está ejecutándose (normal si usas solo VBA)"
        Set ExternalComBridge = Nothing
    Else
        Debug.Print "Conectado a COM Bridge externo"
    End If
    
    On Error GoTo 0
End Sub

' ========================================
' Desconectar COM Bridge
' ========================================
Sub DisconnectComBridge()
    If Not ExternalComBridge Is Nothing Then
        Set ExternalComBridge = Nothing
        Debug.Print "Desconectado de COM Bridge"
    End If
End Sub

' ========================================
' Función de prueba manual
' ========================================
Sub TestAutomation()
    ' Prueba: Escribir "polygon" en B5
    ThisWorkbook.Worksheets("BLOCKCHAINS").Range("B5").Value = "polygon"
    
    ' Esperar 2 segundos
    Application.Wait Now + TimeValue("00:00:02")
    
    ' Verificar si se llenaron las columnas PUSH
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("BLOCKCHAINS")
    
    Dim chainId As String
    chainId = ws.Range("C5").Value ' Asumiendo que CHAIN_ID está en columna C
    
    If chainId <> "" Then
        MsgBox "✅ Automatización funcionando!" & vbCrLf & "CHAIN_ID: " & chainId, vbInformation
    Else
        MsgBox "⚠️ Las columnas PUSH no se llenaron automáticamente" & vbCrLf & "Verifica que el COM Bridge esté ejecutándose", vbExclamation
    End If
End Sub

' ========================================
' Limpiar todas las filas vacías
' ========================================
Sub CleanEmptyRows()
    ' Desactivar actualización de pantalla para mejor rendimiento
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual
    
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("BLOCKCHAINS")
    
    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, 2).End(xlUp).Row
    
    Dim row As Long
    Dim cleaned As Long
    cleaned = 0
    
    For row = 2 To lastRow
        If Trim(ws.Cells(row, 2).Value) = "" Then
            Call ClearPushColumns(row)
            cleaned = cleaned + 1
        End If
    Next row
    
    ' Restaurar configuración
    Application.ScreenUpdating = True
    Application.Calculation = xlCalculationAutomatic
    
    MsgBox "Limpiadas " & cleaned & " filas con NAME vacío", vbInformation
End Sub

