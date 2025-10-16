/**
 * ARBITRAGEXPLUS2025 - Monitor de Repositorio GitHub
 * Sistema de Monitoreo en Tiempo Real y Reconfiguración Automática
 * 
 * Este script complementa el gas-advanced-mapper.gs proporcionando:
 * - Monitoreo continuo del repositorio GitHub
 * - Detección de cambios en archivos críticos
 * - Validación de rutas y estructura
 * - Alertas automáticas por problemas
 * - Sincronización bidireccional con Google Sheets
 */

// ========================================================================================
// CONFIGURACIÓN DEL MONITOR
// ========================================================================================

const MONITOR_CONFIG = {
  GITHUB: {
    OWNER: 'hefarica',
    REPO: 'ARBITRAGEXPLUS2025',
    BRANCH: 'master',
    API_BASE: 'https://api.github.com'
  },
  
  MONITORING: {
    FAST_INTERVAL: 60000,    // 1 minuto - monitoreo rápido
    DEEP_INTERVAL: 300000,   // 5 minutos - análisis profundo
    HEALTH_CHECK: 900000,    // 15 minutos - health check completo
    MAX_RETRIES: 3,
    TIMEOUT: 30000
  },
  
  CRITICAL_PATHS: [
    // Servicios principales
    'services/api-server/src/adapters/ws/',
    'services/api-server/src/oracles/',
    'services/api-server/src/exec/',
    'services/python-collector/src/collectors/',
    'services/python-collector/src/connectors/',
    'services/python-collector/src/sheets/',
    'services/engine-rust/src/pathfinding/',
    'services/engine-rust/src/pricing/',
    'services/ts-executor/src/exec/',
    'services/ts-executor/src/chains/',
    
    // Contratos y configuración
    'contracts/src/',
    'configs/',
    'SCRIPTS/',
    
    // Archivos críticos
    'package.json',
    'fly.toml',
    'README.md'
  ],
  
  REQUIRED_FILES: {
    'package.json': 'Configuración del workspace pnpm',
    'fly.toml': 'Configuración de despliegue Fly.io',
    'SCRIPTS/verify-structure.js': 'Script de validación de estructura',
    'configs/chains.yaml': 'Configuración de blockchains',
    'configs/dex.yaml': 'Configuración de DEXes',
    'configs/tokens.yaml': 'Configuración de tokens'
  }
};

// ========================================================================================
// FUNCIONES DE MONITOREO PRINCIPAL
// ========================================================================================

/**
 * Monitor principal - se ejecuta cada minuto
 */
function repositoryHealthMonitor() {
  const startTime = new Date();
  
  try {
    Logger.log('🔍 [MONITOR] Iniciando monitoreo de repositorio...');
    
    // 1. Verificar acceso básico al repositorio
    const basicCheck = performBasicHealthCheck();
    if (!basicCheck.success) {
      logAlert('REPOSITORY_ACCESS_FAILED', 'ERROR', basicCheck.error);
      return;
    }
    
    // 2. Verificar cambios recientes
    const changesCheck = checkForRecentChanges();
    if (changesCheck.hasChanges) {
      Logger.log(`🔄 [MONITOR] Cambios detectados: ${changesCheck.changeCount}`);
      triggerRepositorySync();
    }
    
    // 3. Validar rutas críticas
    const pathsCheck = validateCriticalPaths();
    if (pathsCheck.missingPaths.length > 0) {
      logAlert('MISSING_CRITICAL_PATHS', 'WARNING', 
        `Rutas faltantes: ${pathsCheck.missingPaths.join(', ')}`);
    }
    
    // 4. Actualizar métricas de monitoreo
    updateMonitoringMetrics(startTime);
    
    Logger.log('✅ [MONITOR] Ciclo completado exitosamente');
    
  } catch (error) {
    Logger.log('❌ [MONITOR] Error en monitoreo: ' + error.toString());
    logAlert('MONITOR_ERROR', 'ERROR', error.toString());
  }
}

/**
 * Análisis profundo del repositorio - se ejecuta cada 5 minutos
 */
function deepRepositoryAnalysis() {
  try {
    Logger.log('🔬 [DEEP] Iniciando análisis profundo...');
    
    // 1. Analizar estructura completa
    const structureAnalysis = analyzeRepositoryStructure();
    
    // 2. Verificar integridad de archivos críticos
    const integrityCheck = validateFileIntegrity();
    
    // 3. Analizar cambios en dependencias
    const dependencyCheck = analyzeDependencyChanges();
    
    // 4. Generar reporte de salud
    const healthReport = generateHealthReport(structureAnalysis, integrityCheck, dependencyCheck);
    
    // 5. Actualizar Google Sheets con resultados
    updateSheetsWithAnalysis(healthReport);
    
    Logger.log('✅ [DEEP] Análisis profundo completado');
    
  } catch (error) {
    Logger.log('❌ [DEEP] Error en análisis: ' + error.toString());
    logAlert('DEEP_ANALYSIS_ERROR', 'ERROR', error.toString());
  }
}

// ========================================================================================
// FUNCIONES DE VERIFICACIÓN
// ========================================================================================

/**
 * Verificación básica de salud del repositorio
 */
function performBasicHealthCheck() {
  try {
    const token = getGitHubToken();
    const url = `${MONITOR_CONFIG.GITHUB.API_BASE}/repos/${MONITOR_CONFIG.GITHUB.OWNER}/${MONITOR_CONFIG.GITHUB.REPO}`;
    
    const response = UrlFetchApp.fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ARBITRAGEXPLUS2025-Monitor'
      },
      timeout: MONITOR_CONFIG.MONITORING.TIMEOUT
    });
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`GitHub API responded with ${response.getResponseCode()}`);
    }
    
    const repoData = JSON.parse(response.getContentText());
    
    return {
      success: true,
      data: {
        name: repoData.name,
        size: repoData.size,
        language: repoData.language,
        updated_at: repoData.updated_at,
        default_branch: repoData.default_branch
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Verificar cambios recientes en el repositorio
 */
function checkForRecentChanges() {
  try {
    const token = getGitHubToken();
    const url = `${MONITOR_CONFIG.GITHUB.API_BASE}/repos/${MONITOR_CONFIG.GITHUB.OWNER}/${MONITOR_CONFIG.GITHUB.REPO}/commits`;
    
    const response = UrlFetchApp.fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      timeout: MONITOR_CONFIG.MONITORING.TIMEOUT
    });
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`Error fetching commits: ${response.getResponseCode()}`);
    }
    
    const commits = JSON.parse(response.getContentText());
    const lastKnownCommit = getLastKnownCommit();
    
    let newCommits = [];
    let hasChanges = false;
    
    if (commits.length > 0) {
      const latestCommit = commits[0];
      
      if (lastKnownCommit !== latestCommit.sha) {
        // Encontrar nuevos commits
        newCommits = commits.filter(commit => commit.sha !== lastKnownCommit);
        hasChanges = true;
        
        // Actualizar último commit conocido
        setLastKnownCommit(latestCommit.sha);
        
        Logger.log(`📝 [CHANGES] Nuevos commits: ${newCommits.length}`);
        newCommits.forEach(commit => {
          Logger.log(`   - ${commit.sha.substring(0, 7)}: ${commit.commit.message}`);
        });
      }
    }
    
    return {
      hasChanges: hasChanges,
      changeCount: newCommits.length,
      newCommits: newCommits
    };
    
  } catch (error) {
    Logger.log('❌ [CHANGES] Error verificando cambios: ' + error.toString());
    return { hasChanges: false, error: error.toString() };
  }
}

/**
 * Validar rutas críticas del repositorio
 */
function validateCriticalPaths() {
  const missingPaths = [];
  const existingPaths = [];
  const token = getGitHubToken();
  
  MONITOR_CONFIG.CRITICAL_PATHS.forEach(path => {
    try {
      const url = `${MONITOR_CONFIG.GITHUB.API_BASE}/repos/${MONITOR_CONFIG.GITHUB.OWNER}/${MONITOR_CONFIG.GITHUB.REPO}/contents/${path}`;
      
      const response = UrlFetchApp.fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        },
        timeout: MONITOR_CONFIG.MONITORING.TIMEOUT
      });
      
      if (response.getResponseCode() === 200) {
        existingPaths.push(path);
      } else {
        missingPaths.push(path);
      }
      
    } catch (error) {
      missingPaths.push(path);
      Logger.log(`⚠️ [PATHS] Ruta no accesible: ${path}`);
    }
    
    // Pausa para evitar rate limiting
    Utilities.sleep(100);
  });
  
  return {
    totalPaths: MONITOR_CONFIG.CRITICAL_PATHS.length,
    existingPaths: existingPaths,
    missingPaths: missingPaths,
    healthPercentage: (existingPaths.length / MONITOR_CONFIG.CRITICAL_PATHS.length) * 100
  };
}

/**
 * Analizar estructura completa del repositorio
 */
function analyzeRepositoryStructure() {
  try {
    const token = getGitHubToken();
    const url = `${MONITOR_CONFIG.GITHUB.API_BASE}/repos/${MONITOR_CONFIG.GITHUB.OWNER}/${MONITOR_CONFIG.GITHUB.REPO}/git/trees/${MONITOR_CONFIG.GITHUB.BRANCH}?recursive=1`;
    
    const response = UrlFetchApp.fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      timeout: MONITOR_CONFIG.MONITORING.TIMEOUT * 2 // Más tiempo para análisis profundo
    });
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`Error fetching tree: ${response.getResponseCode()}`);
    }
    
    const treeData = JSON.parse(response.getContentText());
    const files = treeData.tree || [];
    
    // Analizar por tipo de archivo y directorio
    const analysis = {
      totalItems: files.length,
      directories: files.filter(item => item.type === 'tree').length,
      files: files.filter(item => item.type === 'blob').length,
      fileTypes: {},
      serviceDirectories: [],
      configFiles: [],
      timestamp: new Date()
    };
    
    // Clasificar archivos por extensión
    files.forEach(item => {
      if (item.type === 'blob') {
        const ext = item.path.split('.').pop();
        analysis.fileTypes[ext] = (analysis.fileTypes[ext] || 0) + 1;
      }
      
      // Identificar directorios de servicios
      if (item.path.startsWith('services/') && item.type === 'tree') {
        analysis.serviceDirectories.push(item.path);
      }
      
      // Identificar archivos de configuración
      if (item.path.includes('config') || item.path.endsWith('.yaml') || item.path.endsWith('.toml')) {
        analysis.configFiles.push(item.path);
      }
    });
    
    Logger.log(`📊 [STRUCTURE] ${analysis.totalItems} items: ${analysis.directories} dirs, ${analysis.files} files`);
    
    return analysis;
    
  } catch (error) {
    Logger.log('❌ [STRUCTURE] Error analizando estructura: ' + error.toString());
    return { error: error.toString(), timestamp: new Date() };
  }
}

/**
 * Validar integridad de archivos críticos
 */
function validateFileIntegrity() {
  const results = {};
  const token = getGitHubToken();
  
  Object.entries(MONITOR_CONFIG.REQUIRED_FILES).forEach(([filePath, description]) => {
    try {
      const url = `${MONITOR_CONFIG.GITHUB.API_BASE}/repos/${MONITOR_CONFIG.GITHUB.OWNER}/${MONITOR_CONFIG.GITHUB.REPO}/contents/${filePath}`;
      
      const response = UrlFetchApp.fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        },
        timeout: MONITOR_CONFIG.MONITORING.TIMEOUT
      });
      
      if (response.getResponseCode() === 200) {
        const fileData = JSON.parse(response.getContentText());
        results[filePath] = {
          exists: true,
          size: fileData.size,
          sha: fileData.sha,
          description: description
        };
      } else {
        results[filePath] = {
          exists: false,
          error: `HTTP ${response.getResponseCode()}`,
          description: description
        };
      }
      
    } catch (error) {
      results[filePath] = {
        exists: false,
        error: error.toString(),
        description: description
      };
    }
    
    // Pausa para evitar rate limiting
    Utilities.sleep(200);
  });
  
  const totalFiles = Object.keys(results).length;
  const existingFiles = Object.values(results).filter(file => file.exists).length;
  
  Logger.log(`📁 [INTEGRITY] ${existingFiles}/${totalFiles} archivos críticos validados`);
  
  return {
    results: results,
    totalFiles: totalFiles,
    existingFiles: existingFiles,
    integrityPercentage: (existingFiles / totalFiles) * 100,
    timestamp: new Date()
  };
}

// ========================================================================================
// FUNCIONES DE SINCRONIZACIÓN
// ========================================================================================

/**
 * Triggear sincronización completa del repositorio
 */
function triggerRepositorySync() {
  try {
    Logger.log('🔄 [SYNC] Iniciando sincronización...');
    
    // Llamar al mapeo completo del script principal
    if (typeof mapCompleteRepository === 'function') {
      mapCompleteRepository();
    } else {
      Logger.log('⚠️ [SYNC] Función mapCompleteRepository no disponible');
    }
    
    // Actualizar timestamp de última sincronización
    setLastSyncTimestamp();
    
    Logger.log('✅ [SYNC] Sincronización completada');
    
  } catch (error) {
    Logger.log('❌ [SYNC] Error en sincronización: ' + error.toString());
    logAlert('SYNC_ERROR', 'ERROR', error.toString());
  }
}

/**
 * Actualizar Google Sheets con resultados de análisis
 */
function updateSheetsWithAnalysis(healthReport) {
  try {
    const ss = getSpreadsheet();
    if (!ss) return;
    
    // Actualizar hoja ALERTS con nuevos problemas
    updateAlertsSheet(ss, healthReport);
    
    // Actualizar hoja CONFIG con métricas de salud
    updateConfigSheet(ss, healthReport);
    
    Logger.log('📊 [SHEETS] Hojas actualizadas con análisis');
    
  } catch (error) {
    Logger.log('❌ [SHEETS] Error actualizando hojas: ' + error.toString());
  }
}

/**
 * Actualizar hoja de alertas
 */
function updateAlertsSheet(ss, healthReport) {
  const alertsSheet = ss.getSheetByName('ALERTS');
  if (!alertsSheet) return;
  
  const timestamp = new Date();
  
  // Agregar alerta si hay problemas críticos
  if (healthReport.structureAnalysis && healthReport.structureAnalysis.error) {
    addAlert(alertsSheet, {
      id: `STRUCT_${timestamp.getTime()}`,
      type: 'STRUCTURE_ERROR',
      severity: 'ERROR',
      message: `Error en análisis de estructura: ${healthReport.structureAnalysis.error}`,
      timestamp: timestamp
    });
  }
  
  if (healthReport.integrityCheck && healthReport.integrityCheck.integrityPercentage < 100) {
    const missingFiles = Object.entries(healthReport.integrityCheck.results)
      .filter(([_, data]) => !data.exists)
      .map(([path, _]) => path);
    
    addAlert(alertsSheet, {
      id: `INTEGRITY_${timestamp.getTime()}`,
      type: 'FILE_INTEGRITY',
      severity: 'WARNING',
      message: `Archivos críticos faltantes: ${missingFiles.join(', ')}`,
      timestamp: timestamp
    });
  }
}

/**
 * Actualizar hoja de configuración
 */
function updateConfigSheet(ss, healthReport) {
  const configSheet = ss.getSheetByName('CONFIG');
  if (!configSheet) return;
  
  // Buscar y actualizar métricas del sistema
  const values = configSheet.getDataRange().getValues();
  
  for (let i = 0; i < values.length; i++) {
    const row = i + 1;
    const key = values[i][0];
    
    switch (key) {
      case 'LAST_MONITOR_CHECK':
        configSheet.getRange(row, 2).setValue(new Date().toISOString());
        configSheet.getRange(row, 6).setValue(new Date());
        break;
        
      case 'REPOSITORY_HEALTH':
        const healthPercentage = healthReport.pathsCheck ? healthReport.pathsCheck.healthPercentage : 0;
        configSheet.getRange(row, 2).setValue(healthPercentage);
        configSheet.getRange(row, 6).setValue(new Date());
        break;
    }
  }
}

// ========================================================================================
// FUNCIONES DE UTILIDAD
// ========================================================================================

/**
 * Obtener token de GitHub
 */
function getGitHubToken() {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) {
    throw new Error('❌ Token de GitHub no configurado en Script Properties');
  }
  return token;
}

/**
 * Obtener spreadsheet
 */
function getSpreadsheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || 
                       GITHUB_CONFIG?.SPREADSHEET_ID;
  
  if (!spreadsheetId) {
    Logger.log('⚠️ SPREADSHEET_ID no configurado');
    return null;
  }
  
  try {
    return SpreadsheetApp.openById(spreadsheetId);
  } catch (error) {
    Logger.log('❌ Error accediendo al spreadsheet: ' + error.toString());
    return null;
  }
}

/**
 * Obtener último commit conocido
 */
function getLastKnownCommit() {
  return PropertiesService.getScriptProperties().getProperty('LAST_KNOWN_COMMIT') || '';
}

/**
 * Establecer último commit conocido
 */
function setLastKnownCommit(sha) {
  PropertiesService.getScriptProperties().setProperty('LAST_KNOWN_COMMIT', sha);
}

/**
 * Establecer timestamp de última sincronización
 */
function setLastSyncTimestamp() {
  const timestamp = new Date().toISOString();
  PropertiesService.getScriptProperties().setProperty('LAST_SYNC', timestamp);
}

/**
 * Generar reporte de salud
 */
function generateHealthReport(structureAnalysis, integrityCheck, dependencyCheck) {
  return {
    timestamp: new Date(),
    structureAnalysis: structureAnalysis,
    integrityCheck: integrityCheck,
    dependencyCheck: dependencyCheck,
    overallHealth: calculateOverallHealth(structureAnalysis, integrityCheck, dependencyCheck)
  };
}

/**
 * Calcular salud general del sistema
 */
function calculateOverallHealth(structureAnalysis, integrityCheck, dependencyCheck) {
  let healthScore = 100;
  
  // Penalizar por errores en estructura
  if (structureAnalysis && structureAnalysis.error) {
    healthScore -= 30;
  }
  
  // Penalizar por archivos faltantes
  if (integrityCheck && integrityCheck.integrityPercentage < 100) {
    healthScore -= (100 - integrityCheck.integrityPercentage) * 0.5;
  }
  
  return Math.max(0, Math.min(100, healthScore));
}

/**
 * Analizar cambios en dependencias
 */
function analyzeDependencyChanges() {
  try {
    const token = getGitHubToken();
    
    // Verificar package.json
    const packageJsonUrl = `${MONITOR_CONFIG.GITHUB.API_BASE}/repos/${MONITOR_CONFIG.GITHUB.OWNER}/${MONITOR_CONFIG.GITHUB.REPO}/contents/package.json`;
    
    const response = UrlFetchApp.fetch(packageJsonUrl, {
      method: 'GET',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (response.getResponseCode() === 200) {
      const fileData = JSON.parse(response.getContentText());
      const lastKnownSha = PropertiesService.getScriptProperties().getProperty('PACKAGE_JSON_SHA');
      
      if (lastKnownSha !== fileData.sha) {
        PropertiesService.getScriptProperties().setProperty('PACKAGE_JSON_SHA', fileData.sha);
        Logger.log('📦 [DEPS] Cambio detectado en package.json');
        return { hasChanges: true, file: 'package.json', newSha: fileData.sha };
      }
    }
    
    return { hasChanges: false };
    
  } catch (error) {
    Logger.log('❌ [DEPS] Error analizando dependencias: ' + error.toString());
    return { hasChanges: false, error: error.toString() };
  }
}

/**
 * Registrar alerta
 */
function logAlert(type, severity, message) {
  try {
    Logger.log(`🚨 [ALERT] ${severity}: ${type} - ${message}`);
    
    const ss = getSpreadsheet();
    if (ss) {
      const alertsSheet = ss.getSheetByName('ALERTS');
      if (alertsSheet) {
        addAlert(alertsSheet, {
          id: `${type}_${Date.now()}`,
          type: type,
          severity: severity,
          message: message,
          timestamp: new Date()
        });
      }
    }
  } catch (error) {
    Logger.log('❌ Error registrando alerta: ' + error.toString());
  }
}

/**
 * Agregar alerta a la hoja
 */
function addAlert(alertsSheet, alert) {
  try {
    const lastRow = alertsSheet.getLastRow() + 1;
    
    alertsSheet.getRange(lastRow, 1).setValue(alert.id);              // ALERT_ID
    alertsSheet.getRange(lastRow, 2).setValue(alert.type);            // ALERT_TYPE
    alertsSheet.getRange(lastRow, 3).setValue(alert.severity);        // SEVERITY
    alertsSheet.getRange(lastRow, 4).setValue(alert.message);         // MESSAGE
    alertsSheet.getRange(lastRow, 5).setValue(alert.timestamp);       // TRIGGERED_AT
    alertsSheet.getRange(lastRow, 6).setValue(false);                 // IS_RESOLVED
    alertsSheet.getRange(lastRow, 7).setValue('');                    // RESOLVED_AT
    alertsSheet.getRange(lastRow, 8).setValue('');                    // NOTES
    alertsSheet.getRange(lastRow, 9).setValue(true);                  // ACTION_REQUIRED
    
  } catch (error) {
    Logger.log('❌ Error agregando alerta: ' + error.toString());
  }
}

/**
 * Actualizar métricas de monitoreo
 */
function updateMonitoringMetrics(startTime) {
  try {
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    // Guardar métricas de rendimiento
    PropertiesService.getScriptProperties().setProperties({
      'LAST_MONITOR_EXECUTION': endTime.toISOString(),
      'LAST_MONITOR_DURATION': duration.toString(),
      'MONITOR_EXECUTION_COUNT': (parseInt(PropertiesService.getScriptProperties().getProperty('MONITOR_EXECUTION_COUNT') || '0') + 1).toString()
    });
    
    Logger.log(`⏱️ [METRICS] Monitoreo completado en ${duration}ms`);
    
  } catch (error) {
    Logger.log('❌ Error actualizando métricas: ' + error.toString());
  }
}

// ========================================================================================
// CONFIGURACIÓN E INSTALACIÓN
// ========================================================================================

/**
 * Instalar triggers de monitoreo
 */
function setupRepositoryMonitoring() {
  try {
    Logger.log('⚙️ Configurando triggers de monitoreo...');
    
    // Eliminar triggers existentes de este script
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      const functionName = trigger.getHandlerFunction();
      if (functionName === 'repositoryHealthMonitor' || functionName === 'deepRepositoryAnalysis') {
        ScriptApp.deleteTrigger(trigger);
      }
    });
    
    // Crear nuevo trigger para monitoreo rápido
    ScriptApp.newTrigger('repositoryHealthMonitor')
      .timeBased()
      .everyMinutes(1)
      .create();
    
    // Crear trigger para análisis profundo
    ScriptApp.newTrigger('deepRepositoryAnalysis')
      .timeBased()
      .everyMinutes(5)
      .create();
    
    Logger.log('✅ Triggers de monitoreo configurados');
    
  } catch (error) {
    Logger.log('❌ Error configurando triggers: ' + error.toString());
  }
}

/**
 * Test completo del sistema de monitoreo
 */
function testRepositoryMonitoring() {
  try {
    Logger.log('🧪 Iniciando test del sistema de monitoreo...');
    
    // 1. Test de acceso a GitHub
    const basicCheck = performBasicHealthCheck();
    if (!basicCheck.success) {
      throw new Error('Test de acceso básico falló: ' + basicCheck.error);
    }
    Logger.log('✅ Test de acceso a GitHub: PASADO');
    
    // 2. Test de verificación de cambios
    const changesCheck = checkForRecentChanges();
    if (changesCheck.error) {
      Logger.log('⚠️ Test de cambios con advertencia: ' + changesCheck.error);
    } else {
      Logger.log('✅ Test de verificación de cambios: PASADO');
    }
    
    // 3. Test de validación de rutas
    const pathsCheck = validateCriticalPaths();
    Logger.log(`✅ Test de rutas críticas: ${pathsCheck.existingPaths.length}/${pathsCheck.totalPaths} encontradas`);
    
    // 4. Test de acceso a Sheets
    const ss = getSpreadsheet();
    if (!ss) {
      throw new Error('No se pudo acceder al Google Sheet');
    }
    Logger.log('✅ Test de acceso a Sheets: PASADO');
    
    Logger.log('🎯 Todos los tests de monitoreo completados exitosamente');
    return true;
    
  } catch (error) {
    Logger.log('❌ Test de monitoreo falló: ' + error.toString());
    return false;
  }
}

// ========================================================================================
// INICIALIZACIÓN
// ========================================================================================

Logger.log('🔍 ARBITRAGEXPLUS2025 - Monitor de Repositorio GitHub cargado');
Logger.log('📊 Configuración: ' + MONITOR_CONFIG.CRITICAL_PATHS.length + ' rutas críticas');
Logger.log('🎯 Listo para monitoreo con setupRepositoryMonitoring()');