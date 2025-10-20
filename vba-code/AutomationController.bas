Attribute VB_Name = "AutomationController"
'===============================================================================
' AutomationController - Módulo VBA para ARBITRAGEXPLUS2025
' Detecta cambios en columnas PULL (blancas) y activa el sistema backend
'===============================================================================

Option Explicit

' Referencia al objeto COM externo
Private ExternalComBridge As Object

' Flag para prevenir bucles infinitos
Private EnableEventHandling As Boolean

' Constantes de colores (RGB en formato Long)
Private Const COLOR_PUSH As Long = &HC47244  ' Azul (#4472C4)
Private Const COLOR_PULL As Long = &HFFFFFF  ' Blanco

'===============================================================================
' INICIALIZACIÓN
'===============================================================================

Public Sub StartAutomationEngine()
    On Error GoTo ErrorHandler
    
    ' Intentar crear instancia del objeto COM
    Set ExternalComBridge = CreateObject("ExcelComBridge.StreamListener")
    
    If Not ExternalComBridge Is Nothing Then
        Debug.Print "[VBA] Motor de automatización conectado correctamente"
        MsgBox "Sistema de automatización iniciado correctamente.", vbInformation, "ARBITRAGEXPLUS2025"
        EnableEventHandling = True
    Else
        Debug.Print "[VBA] Error: No se pudo crear instancia del objeto COM"
        MsgBox "No se pudo conectar al motor de automatización." & vbCrLf & _
               "Asegúrate de que ExcelComBridge.exe esté en ejecución.", vbExclamation, "Error"
    End If
    
    Exit Sub
    
ErrorHandler:
    Debug.Print "[VBA] Error al inicializar: " & Err.Description
    MsgBox "Error al inicializar el sistema de automatización:" & vbCrLf & _
           Err.Description & vbCrLf & vbCrLf & _
           "Asegúrate de que el puente COM esté compilado y registrado.", vbCritical, "Error"
End Sub

Public Sub StopAutomationEngine()
    On Error Resume Next
    
    If Not ExternalComBridge Is Nothing Then
        Set ExternalComBridge = Nothing
        Debug.Print "[VBA] Motor de automatización desconectado"
        EnableEventHandling = False
    End If
End Sub

'===============================================================================
' MANEJO DE EVENTOS
'===============================================================================

Public Sub HandleCellChange(ByVal Sh As Object, ByVal Target As Range)
    ' Prevenir bucles infinitos
    If Not EnableEventHandling Then Exit Sub
    
    ' Solo procesar cambios de una celda a la vez
    If Target.Cells.Count > 1 Then Exit Sub
    
    On Error GoTo ErrorHandler
    
    Dim ws As Worksheet
    Set ws = Sh
    
    ' Verificar si la hoja es una de las soportadas
    If Not IsSupportedSheet(ws.Name) Then Exit Sub
    
    ' Obtener información de la columna
    Dim colIndex As Long
    colIndex = Target.Column
    
    Dim headerCell As Range
    Set headerCell = ws.Cells(1, colIndex)
    
    ' Verificar si es columna PULL (encabezado blanco)
    If Not IsPullColumn(headerCell) Then Exit Sub
    
    ' Obtener datos
    Dim rowNum As Long
    rowNum = Target.Row
    
    Dim colName As String
    colName = headerCell.Value
    
    Dim cellValue As String
    cellValue = Target.Value
    
    Debug.Print "[VBA] Cambio detectado: " & ws.Name & "!" & colName & rowNum & " = '" & cellValue & "'"
    
    ' Llamar al objeto COM
    If Not ExternalComBridge Is Nothing Then
        EnableEventHandling = False ' Desactivar eventos temporalmente
        
        ExternalComBridge.OnCellChanged rowNum, colName, cellValue
        
        EnableEventHandling = True ' Reactivar eventos
    Else
        Debug.Print "[VBA] Error: Objeto COM no está disponible"
    End If
    
    Exit Sub
    
ErrorHandler:
    EnableEventHandling = True ' Asegurar que se reactiven los eventos
    Debug.Print "[VBA] Error en HandleCellChange: " & Err.Description
End Sub

'===============================================================================
' FUNCIONES AUXILIARES
'===============================================================================

Private Function IsSupportedSheet(ByVal sheetName As String) As Boolean
    ' Lista de hojas soportadas
    Select Case UCase(sheetName)
        Case "BLOCKCHAINS", "DEXES", "ASSETS", "POOLS", "ROUTES"
            IsSupportedSheet = True
        Case Else
            IsSupportedSheet = False
    End Select
End Function

Private Function IsPullColumn(ByVal headerCell As Range) As Boolean
    ' Verificar si el color de fondo es blanco (PULL)
    Dim bgColor As Long
    bgColor = headerCell.Interior.Color
    
    ' Blanco (RGB: 255,255,255 = 16777215 en Long)
    ' También considerar celdas sin color (xlNone = -4142)
    If bgColor = COLOR_PULL Or bgColor = 16777215 Or bgColor = -4142 Then
        IsPullColumn = True
    Else
        IsPullColumn = False
    End If
End Function

Private Function IsPushColumn(ByVal headerCell As Range) As Boolean
    ' Verificar si el color de fondo es azul (PUSH)
    Dim bgColor As Long
    bgColor = headerCell.Interior.Color
    
    ' Azul #4472C4 (RGB: 68,114,196)
    ' En formato Long: 196*65536 + 114*256 + 68 = 12874308
    If bgColor = COLOR_PUSH Or bgColor = 12874308 Then
        IsPushColumn = True
    Else
        IsPushColumn = False
    End If
End Function

