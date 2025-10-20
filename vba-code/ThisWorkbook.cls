VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "ThisWorkbook"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = True
'===============================================================================
' ThisWorkbook - Eventos del libro de Excel
' ARBITRAGEXPLUS2025
'===============================================================================

Option Explicit

Private Sub Workbook_Open()
    Debug.Print "ARBITRAGEXPLUS2025 - Sistema de automatización cargado"
    Application.EnableEvents = True
End Sub

Private Sub Workbook_SheetChange(ByVal Sh As Object, ByVal Target As Range)
    ' Este evento se dispara para cualquier cambio en cualquier hoja.
    ' La lógica para filtrar por hoja y tipo de columna se manejará en el módulo.
    AutomationController.HandleCellChange Sh, Target
End Sub

