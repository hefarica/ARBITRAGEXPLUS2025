#!/usr/bin/env python3
"""
Tests de integración para ExcelClient
Valida todas las operaciones con el archivo Excel real
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../services/python-collector/src'))

from excel_client import ExcelClient, get_excel_client
from datetime import datetime
import pytest


class TestExcelClientIntegration:
    """Suite de tests de integración para ExcelClient"""
    
    @pytest.fixture
    def client(self):
        """Fixture que retorna instancia de ExcelClient"""
        return ExcelClient('/home/ubuntu/ARBITRAGEXPLUS2025/data/ARBITRAGEXPLUS2025.xlsx')
    
    def test_read_oracle_assets(self, client):
        """Test: Leer ORACLE_ASSETS completo"""
        assets = client.get_sheet_data("ORACLE_ASSETS")
        
        assert len(assets) > 0, "Debe haber assets configurados"
        assert len(assets) >= 57, f"Debe haber al menos 57 assets, encontrados: {len(assets)}"
        
        # Verificar estructura del primer asset
        first_asset = assets[0]
        assert 'SYMBOL' in first_asset
        assert 'BLOCKCHAIN' in first_asset
        assert 'PYTH_PRICE_ID' in first_asset
        assert 'IS_ACTIVE' in first_asset
        
        print(f"✅ {len(assets)} assets leídos correctamente")
    
    def test_read_oracle_assets_range(self, client):
        """Test: Leer rango específico de ORACLE_ASSETS"""
        data = client.get_range("ORACLE_ASSETS!A1:M10")
        
        assert len(data) == 10, "Debe leer exactamente 10 filas"
        assert len(data[0]) == 13, "Debe leer exactamente 13 columnas"
        
        # Verificar headers
        headers = data[0]
        assert headers[0] == 'SYMBOL'
        assert headers[1] == 'BLOCKCHAIN'
        assert headers[9] == 'BINANCE_SYMBOL'
        assert headers[10] == 'COINGECKO_ID'
        assert headers[11] == 'BAND_SYMBOL'
        
        print(f"✅ Rango leído correctamente: {len(data)} filas x {len(data[0])} columnas")
    
    def test_read_parametros(self, client):
        """Test: Leer PARAMETROS"""
        params = client.get_sheet_data("PARAMETROS")
        
        assert len(params) >= 20, f"Debe haber al menos 20 parámetros, encontrados: {len(params)}"
        
        # Verificar estructura
        first_param = params[0]
        assert 'PARAMETRO' in first_param
        assert 'VALOR' in first_param
        assert 'UNIDAD' in first_param
        assert 'DESCRIPCION' in first_param
        
        print(f"✅ {len(params)} parámetros leídos correctamente")
    
    def test_read_error_handling_config(self, client):
        """Test: Leer ERROR_HANDLING_CONFIG"""
        errors = client.get_sheet_data("ERROR_HANDLING_CONFIG")
        
        assert len(errors) >= 10, f"Debe haber al menos 10 configuraciones, encontradas: {len(errors)}"
        
        # Verificar estructura
        first_error = errors[0]
        assert 'ERROR_CODE' in first_error
        assert 'SHOULD_LOG' in first_error
        assert 'SHOULD_RETRY' in first_error
        assert 'MAX_RETRIES' in first_error
        
        print(f"✅ {len(errors)} configuraciones de error leídas correctamente")
    
    def test_read_collectors_config(self, client):
        """Test: Leer COLLECTORS_CONFIG"""
        collectors = client.get_sheet_data("COLLECTORS_CONFIG")
        
        assert len(collectors) >= 5, f"Debe haber al menos 5 collectors, encontrados: {len(collectors)}"
        
        # Verificar estructura
        first_collector = collectors[0]
        assert 'NAME' in first_collector
        assert 'ENABLED' in first_collector
        assert 'PRIORITY' in first_collector
        assert 'MODULE_PATH' in first_collector
        
        print(f"✅ {len(collectors)} collectors leídos correctamente")
    
    def test_update_cell(self, client):
        """Test: Actualizar celda individual"""
        # Actualizar TOTAL_BATCHES en ESTADISTICAS
        test_value = 999
        client.update_cell("ESTADISTICAS", "B2", test_value)
        
        # Leer y verificar
        value = client.get_cell("ESTADISTICAS", "B2")
        assert value == test_value, f"Valor debe ser {test_value}, obtenido: {value}"
        
        print(f"✅ Celda actualizada correctamente: {value}")
    
    def test_append_row(self, client):
        """Test: Agregar fila a RESULTADOS"""
        # Contar filas antes
        results_before = client.get_sheet_data("RESULTADOS")
        count_before = len(results_before)
        
        # Agregar nueva fila
        test_row = [
            datetime.now(),
            "BATCH_TEST_001",
            "ethereum",
            "USDC",
            "ETH",
            10000,
            4.02,
            50,
            0.5,
            150000,
            15,
            35,
            "0xtest1234",
            "SUCCESS",
            "Integration test"
        ]
        client.append_row("RESULTADOS", test_row)
        
        # Contar filas después
        results_after = client.get_sheet_data("RESULTADOS")
        count_after = len(results_after)
        
        assert count_after == count_before + 1, "Debe haber una fila más"
        
        # Verificar última fila
        last_row = results_after[-1]
        assert last_row['BATCH_ID'] == "BATCH_TEST_001"
        assert last_row['CHAIN'] == "ethereum"
        assert last_row['STATUS'] == "SUCCESS"
        
        print(f"✅ Fila agregada correctamente: {count_before} → {count_after}")
    
    def test_update_range(self, client):
        """Test: Actualizar rango de celdas"""
        # Actualizar múltiples estadísticas
        updates = [
            [200],  # TOTAL_BATCHES
            [5000],  # TOTAL_OPERATIONS
            [95.5],  # SUCCESS_RATE
        ]
        
        client.update_range("ESTADISTICAS!B2:B4", updates)
        
        # Verificar
        total_batches = client.get_cell("ESTADISTICAS", "B2")
        total_ops = client.get_cell("ESTADISTICAS", "B3")
        success_rate = client.get_cell("ESTADISTICAS", "B4")
        
        assert total_batches == 200
        assert total_ops == 5000
        assert success_rate == 95.5
        
        print(f"✅ Rango actualizado correctamente")
    
    def test_batch_get(self, client):
        """Test: Leer múltiples rangos en batch"""
        ranges = [
            "ORACLE_ASSETS!A1:M10",
            "PARAMETROS!A1:D5",
            "ESTADISTICAS!A1:B5"
        ]
        
        results = client.batch_get(ranges)
        
        assert len(results) == 3, "Debe retornar 3 resultados"
        assert "ORACLE_ASSETS!A1:M10" in results
        assert "PARAMETROS!A1:D5" in results
        assert "ESTADISTICAS!A1:B5" in results
        
        print(f"✅ Batch get completado: {len(results)} rangos leídos")
    
    def test_batch_update(self, client):
        """Test: Actualizar múltiples rangos en batch"""
        updates = {
            "ESTADISTICAS!B2": [[300]],
            "ESTADISTICAS!B3": [[6000]],
            "ESTADISTICAS!B4": [[96.5]]
        }
        
        client.batch_update(updates)
        
        # Verificar
        total_batches = client.get_cell("ESTADISTICAS", "B2")
        total_ops = client.get_cell("ESTADISTICAS", "B3")
        success_rate = client.get_cell("ESTADISTICAS", "B4")
        
        assert total_batches == 300
        assert total_ops == 6000
        assert success_rate == 96.5
        
        print(f"✅ Batch update completado")
    
    def test_get_sheet_names(self, client):
        """Test: Obtener lista de hojas"""
        sheet_names = client.get_sheet_names()
        
        expected_sheets = [
            "ORACLE_ASSETS",
            "ERROR_HANDLING_CONFIG",
            "COLLECTORS_CONFIG",
            "PARAMETROS",
            "RESULTADOS",
            "LOGERRORESEVENTOS",
            "ESTADISTICAS"
        ]
        
        for expected in expected_sheets:
            assert expected in sheet_names, f"Hoja '{expected}' debe existir"
        
        print(f"✅ {len(sheet_names)} hojas encontradas: {', '.join(sheet_names)}")
    
    def test_filter_active_assets(self, client):
        """Test: Filtrar assets activos"""
        assets = client.get_sheet_data("ORACLE_ASSETS")
        
        # Filtrar solo activos
        active_assets = [a for a in assets if str(a.get('IS_ACTIVE', '')).upper() == 'TRUE']
        
        assert len(active_assets) > 0, "Debe haber assets activos"
        
        # Verificar que todos tienen IS_ACTIVE=TRUE
        for asset in active_assets:
            assert str(asset['IS_ACTIVE']).upper() == 'TRUE'
        
        print(f"✅ {len(active_assets)}/{len(assets)} assets activos")
    
    def test_get_high_priority_assets(self, client):
        """Test: Obtener assets de alta prioridad"""
        assets = client.get_sheet_data("ORACLE_ASSETS")
        
        # Filtrar prioridad 1
        high_priority = [a for a in assets if str(a.get('PRIORITY', '')) == '1']
        
        assert len(high_priority) > 0, "Debe haber assets de prioridad 1"
        
        print(f"✅ {len(high_priority)} assets de prioridad 1")
    
    def test_singleton_pattern(self):
        """Test: Verificar que get_excel_client retorna singleton"""
        client1 = get_excel_client()
        client2 = get_excel_client()
        
        assert client1 is client2, "Debe retornar la misma instancia"
        
        print(f"✅ Singleton pattern funciona correctamente")


def run_all_tests():
    """Ejecuta todos los tests"""
    print("🧪 Ejecutando tests de integración de ExcelClient...\n")
    
    # Ejecutar con pytest
    pytest.main([__file__, '-v', '--tb=short'])


if __name__ == "__main__":
    run_all_tests()

