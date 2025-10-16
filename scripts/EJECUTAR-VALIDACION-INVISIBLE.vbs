' ============================================================================
' SCRIPT VBS DE VALIDACIÓN INVISIBLE - ARBITRAGEXPLUS2025
' 
' Este script ejecuta la validación COMPLETAMENTE INVISIBLE
' (sin mostrar ninguna ventana) y solo abre el reporte en Notepad
' 
' Autor: MANUS AI
' Versión: 2.0
' ============================================================================

Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Obtener directorio del script
strScriptPath = objFSO.GetParentFolderName(WScript.ScriptFullName)

' Crear directorio de reportes si no existe
strReportsDir = strScriptPath & "\reportes"
If Not objFSO.FolderExists(strReportsDir) Then
    objFSO.CreateFolder(strReportsDir)
End If

' Generar timestamp
strTimestamp = Year(Now) & "-" & _
               Right("0" & Month(Now), 2) & "-" & _
               Right("0" & Day(Now), 2) & "_" & _
               Right("0" & Hour(Now), 2) & "-" & _
               Right("0" & Minute(Now), 2) & "-" & _
               Right("0" & Second(Now), 2)

strReportFile = strReportsDir & "\validation-report-" & strTimestamp & ".txt"

' Ejecutar PowerShell de forma INVISIBLE (WindowStyle = 0)
strCommand = "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -NoProfile -File """ & _
             strScriptPath & "\Validate-System-Complete.ps1"" -OutputPath """ & strReportFile & """"

objShell.Run strCommand, 0, True

' Esperar a que se genere el archivo (máximo 10 segundos)
intWaitCount = 0
Do While Not objFSO.FileExists(strReportFile) And intWaitCount < 20
    WScript.Sleep 500
    intWaitCount = intWaitCount + 1
Loop

' Abrir el reporte en Notepad
If objFSO.FileExists(strReportFile) Then
    objShell.Run "notepad.exe """ & strReportFile & """", 1, False
Else
    MsgBox "No se pudo generar el reporte de validación." & vbCrLf & vbCrLf & _
           "Verifica que el archivo Validate-System-Complete.ps1 existe en:" & vbCrLf & _
           strScriptPath, vbExclamation, "Error - ARBITRAGEXPLUS2025"
End If

Set objShell = Nothing
Set objFSO = Nothing

