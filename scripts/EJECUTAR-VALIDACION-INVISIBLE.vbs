' ============================================================================
' SCRIPT VBS DE VALIDACIÓN INVISIBLE - ARBITRAGEXPLUS2025
' 
' Este script ejecuta la validación COMPLETAMENTE INVISIBLE
' (sin mostrar ninguna ventana) y solo abre el reporte en Notepad
' 
' El reporte se guarda con fecha y hora para evitar sobrescribir
' 
' Autor: MANUS AI
' Versión: 3.0
' ============================================================================

Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Obtener directorio donde está este script VBS
strScriptPath = objFSO.GetParentFolderName(WScript.ScriptFullName)

' Verificar que existe el script PowerShell en la misma carpeta
strPowerShellScript = strScriptPath & "\Validate-System-Complete.ps1"

If Not objFSO.FileExists(strPowerShellScript) Then
    MsgBox "ERROR: No se encontró el archivo:" & vbCrLf & vbCrLf & _
           "Validate-System-Complete.ps1" & vbCrLf & vbCrLf & _
           "Debe estar en la misma carpeta que este script:" & vbCrLf & _
           strScriptPath & vbCrLf & vbCrLf & _
           "Descarga el archivo del repositorio:" & vbCrLf & _
           "https://github.com/hefarica/ARBITRAGEXPLUS2025", _
           vbCritical, "Error - Archivo no encontrado"
    WScript.Quit
End If

' Crear directorio de reportes si no existe
strReportsDir = strScriptPath & "\reportes"
If Not objFSO.FolderExists(strReportsDir) Then
    objFSO.CreateFolder(strReportsDir)
End If

' Generar timestamp con formato: YYYY-MM-DD_HH-MM-SS
Function GetTimestamp()
    Dim strYear, strMonth, strDay, strHour, strMinute, strSecond
    
    strYear = Year(Now)
    strMonth = Right("0" & Month(Now), 2)
    strDay = Right("0" & Day(Now), 2)
    strHour = Right("0" & Hour(Now), 2)
    strMinute = Right("0" & Minute(Now), 2)
    strSecond = Right("0" & Second(Now), 2)
    
    GetTimestamp = strYear & "-" & strMonth & "-" & strDay & "_" & _
                   strHour & "-" & strMinute & "-" & strSecond
End Function

' Generar nombre de archivo con timestamp
strTimestamp = GetTimestamp()
strReportFile = strReportsDir & "\validation-report-" & strTimestamp & ".txt"

' Ejecutar PowerShell de forma INVISIBLE (WindowStyle = 0)
' Wait = True para esperar a que termine
strCommand = "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -NoProfile -File """ & _
             strPowerShellScript & """ -OutputPath """ & strReportFile & """"

' Ejecutar y esperar a que termine
objShell.Run strCommand, 0, True

' Esperar a que se genere el archivo (máximo 10 segundos)
intWaitCount = 0
Do While Not objFSO.FileExists(strReportFile) And intWaitCount < 20
    WScript.Sleep 500
    intWaitCount = intWaitCount + 1
Loop

' Verificar si se generó el archivo
If objFSO.FileExists(strReportFile) Then
    ' Abrir el reporte en Notepad
    objShell.Run "notepad.exe """ & strReportFile & """", 1, False
Else
    ' Mostrar error si no se generó el archivo
    MsgBox "ERROR: No se pudo generar el reporte de validación." & vbCrLf & vbCrLf & _
           "Posibles causas:" & vbCrLf & _
           "1. El script PowerShell tiene errores" & vbCrLf & _
           "2. No tienes permisos de escritura en:" & vbCrLf & _
           "   " & strReportsDir & vbCrLf & vbCrLf & _
           "Verifica que el archivo Validate-System-Complete.ps1 es la versión correcta." & vbCrLf & _
           "Descárgalo del repositorio:" & vbCrLf & _
           "https://github.com/hefarica/ARBITRAGEXPLUS2025", _
           vbExclamation, "Error - No se generó el reporte"
End If

' Limpiar objetos
Set objShell = Nothing
Set objFSO = Nothing

