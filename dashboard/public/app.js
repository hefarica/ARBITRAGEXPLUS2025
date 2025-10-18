/**
 * @file app.js
 * @description Dashboard logic with real-time updates
 * 
 * ARBITRAGEXPLUS2025 - Dashboard Application
 */

// ==================================================================================
// CONFIGURATION
// ==================================================================================

const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000/api'
  : '/api';

const UPDATE_INTERVAL = 10000; // 10 seconds

// ==================================================================================
// STATE
// ==================================================================================

const state = {
  stats: {
    totalBatches: 0,
    totalOperations: 0,
    totalProfit: '0.00',
    successRate: 0,
    activeChains: 0,
  },
  charts: {
    profit: null,
    chainDistribution: null,
    gas: null,
    successFailed: null,
  },
  filters: {
    alertSeverity: 'all',
    profitTimeframe: '24h',
  },
};

// ==================================================================================
// INITIALIZATION
// ==================================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('Dashboard initializing...');
  
  initializeCharts();
  initializeEventListeners();
  loadData();
  
  // Start auto-refresh
  setInterval(loadData, UPDATE_INTERVAL);
  
  console.log('Dashboard initialized');
});

// ==================================================================================
// EVENT LISTENERS
// ==================================================================================

function initializeEventListeners() {
  // Refresh button
  document.getElementById('refresh-activity')?.addEventListener('click', () => {
    loadActivity();
  });
  
  // Alert filters
  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
      e.target.classList.add('active');
      state.filters.alertSeverity = e.target.dataset.severity;
      loadAlerts();
    });
  });
  
  // Profit timeframe
  document.getElementById('profit-timeframe')?.addEventListener('change', (e) => {
    state.filters.profitTimeframe = e.target.value;
    loadProfitChart();
  });
}

// ==================================================================================
// DATA LOADING
// ==================================================================================

async function loadData() {
  try {
    await Promise.all([
      loadStats(),
      loadActivity(),
      loadChains(),
      loadAlerts(),
      loadProfitChart(),
      loadChainDistributionChart(),
      loadGasChart(),
      loadSuccessFailedChart(),
    ]);
    
    updateLastUpdateTime();
    updateSystemStatus(true);
  } catch (error) {
    console.error('Failed to load data:', error);
    updateSystemStatus(false);
  }
}

async function loadStats() {
  try {
    const response = await axios.get(`${API_BASE_URL}/stats`);
    const data = response.data;
    
    state.stats = {
      totalBatches: data.totalBatches || 0,
      totalOperations: data.totalOperations || 0,
      totalProfit: data.totalProfit || '0.00',
      successRate: data.successRate || 0,
      activeChains: data.activeChains || 0,
    };
    
    updateStatsUI();
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

async function loadActivity() {
  try {
    const response = await axios.get(`${API_BASE_URL}/activity?limit=20`);
    const activities = response.data;
    
    const tbody = document.getElementById('activity-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = activities.map((activity) => `
      <tr>
        <td>${formatTime(activity.timestamp)}</td>
        <td>${activity.chain}</td>
        <td>${activity.batchId}</td>
        <td>${activity.totalOps}/${activity.successfulOps}</td>
        <td>${activity.profit} ETH</td>
        <td>${formatGas(activity.gasUsed)}</td>
        <td>
          <span class="status-badge ${activity.success ? 'success' : 'failed'}">
            ${activity.success ? 'Success' : 'Failed'}
          </span>
        </td>
        <td>
          <span class="tx-hash" onclick="openTxHash('${activity.txHash}', '${activity.chainId}')">
            ${truncateHash(activity.txHash)}
          </span>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Failed to load activity:', error);
  }
}

async function loadChains() {
  try {
    const response = await axios.get(`${API_BASE_URL}/chains`);
    const chains = response.data;
    
    const grid = document.getElementById('chains-grid');
    if (!grid) return;
    
    grid.innerHTML = chains.map((chain) => `
      <div class="chain-item">
        <div class="chain-status ${chain.enabled ? '' : 'offline'}"></div>
        <div class="chain-info">
          <div class="chain-name">${chain.name}</div>
          <div class="chain-stats">${chain.operations || 0} ops</div>
        </div>
      </div>
    `).join('');
    
    state.stats.activeChains = chains.filter((c) => c.enabled).length;
    document.getElementById('active-chains').textContent = state.stats.activeChains;
  } catch (error) {
    console.error('Failed to load chains:', error);
  }
}

async function loadAlerts() {
  try {
    const params = {
      limit: 50,
    };
    
    if (state.filters.alertSeverity !== 'all') {
      params.severity = state.filters.alertSeverity;
    }
    
    const response = await axios.get(`${API_BASE_URL}/alerts`, { params });
    const alerts = response.data;
    
    const list = document.getElementById('alerts-list');
    if (!list) return;
    
    list.innerHTML = alerts.map((alert) => `
      <div class="alert-item ${alert.severity}">
        <div class="alert-header-row">
          <div class="alert-title">${alert.title}</div>
          <div class="alert-time">${formatTime(alert.timestamp)}</div>
        </div>
        <div class="alert-message">${alert.message}</div>
        <div class="alert-meta">
          <span>Chain: ${alert.chain}</span>
          ${alert.txHash ? `<span>TX: ${truncateHash(alert.txHash)}</span>` : ''}
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Failed to load alerts:', error);
  }
}

// ==================================================================================
// CHARTS
// ==================================================================================

function initializeCharts() {
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#cbd5e1',
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#94a3b8',
        },
        grid: {
          color: '#334155',
        },
      },
      y: {
        ticks: {
          color: '#94a3b8',
        },
        grid: {
          color: '#334155',
        },
      },
    },
  };
  
  // Profit Chart
  const profitCtx = document.getElementById('profit-chart');
  if (profitCtx) {
    state.charts.profit = new Chart(profitCtx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Profit (ETH)',
          data: [],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
        }],
      },
      options: chartOptions,
    });
  }
  
  // Chain Distribution Chart
  const chainCtx = document.getElementById('chain-distribution-chart');
  if (chainCtx) {
    state.charts.chainDistribution = new Chart(chainCtx, {
      type: 'doughnut',
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: [
            '#3b82f6',
            '#10b981',
            '#f59e0b',
            '#ef4444',
            '#8b5cf6',
            '#ec4899',
          ],
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#cbd5e1',
            },
          },
        },
      },
    });
  }
  
  // Gas Chart
  const gasCtx = document.getElementById('gas-chart');
  if (gasCtx) {
    state.charts.gas = new Chart(gasCtx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          label: 'Gas Used',
          data: [],
          backgroundColor: '#3b82f6',
        }],
      },
      options: chartOptions,
    });
  }
  
  // Success/Failed Chart
  const successFailedCtx = document.getElementById('success-failed-chart');
  if (successFailedCtx) {
    state.charts.successFailed = new Chart(successFailedCtx, {
      type: 'pie',
      data: {
        labels: ['Successful', 'Failed'],
        datasets: [{
          data: [0, 0],
          backgroundColor: ['#10b981', '#ef4444'],
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#cbd5e1',
            },
          },
        },
      },
    });
  }
}

async function loadProfitChart() {
  try {
    const response = await axios.get(`${API_BASE_URL}/profit-history`, {
      params: {
        timeframe: state.filters.profitTimeframe,
      },
    });
    
    const data = response.data;
    
    if (state.charts.profit) {
      state.charts.profit.data.labels = data.labels;
      state.charts.profit.data.datasets[0].data = data.values;
      state.charts.profit.update();
    }
  } catch (error) {
    console.error('Failed to load profit chart:', error);
  }
}

async function loadChainDistributionChart() {
  try {
    const response = await axios.get(`${API_BASE_URL}/chain-distribution`);
    const data = response.data;
    
    if (state.charts.chainDistribution) {
      state.charts.chainDistribution.data.labels = data.labels;
      state.charts.chainDistribution.data.datasets[0].data = data.values;
      state.charts.chainDistribution.update();
    }
  } catch (error) {
    console.error('Failed to load chain distribution chart:', error);
  }
}

async function loadGasChart() {
  try {
    const response = await axios.get(`${API_BASE_URL}/gas-history`);
    const data = response.data;
    
    if (state.charts.gas) {
      state.charts.gas.data.labels = data.labels;
      state.charts.gas.data.datasets[0].data = data.values;
      state.charts.gas.update();
    }
  } catch (error) {
    console.error('Failed to load gas chart:', error);
  }
}

async function loadSuccessFailedChart() {
  try {
    const response = await axios.get(`${API_BASE_URL}/success-failed`);
    const data = response.data;
    
    if (state.charts.successFailed) {
      state.charts.successFailed.data.datasets[0].data = [
        data.successful || 0,
        data.failed || 0,
      ];
      state.charts.successFailed.update();
    }
  } catch (error) {
    console.error('Failed to load success/failed chart:', error);
  }
}

// ==================================================================================
// UI UPDATES
// ==================================================================================

function updateStatsUI() {
  document.getElementById('total-batches').textContent = state.stats.totalBatches.toLocaleString();
  document.getElementById('total-operations').textContent = state.stats.totalOperations.toLocaleString();
  document.getElementById('total-profit').textContent = `${state.stats.totalProfit} ETH`;
  document.getElementById('success-rate').textContent = `${state.stats.successRate.toFixed(1)}%`;
}

function updateLastUpdateTime() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString();
  document.getElementById('last-update').textContent = timeStr;
}

function updateSystemStatus(online) {
  const statusEl = document.getElementById('system-status');
  if (online) {
    statusEl.classList.remove('offline');
    statusEl.textContent = '●';
  } else {
    statusEl.classList.add('offline');
    statusEl.textContent = '●';
  }
}

// ==================================================================================
// HELPERS
// ==================================================================================

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

function formatGas(gas) {
  if (!gas) return '0';
  const num = parseInt(gas);
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(2)}K`;
  }
  return num.toString();
}

function truncateHash(hash) {
  if (!hash) return '';
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

function openTxHash(hash, chainId) {
  const explorers = {
    1: 'https://etherscan.io/tx/',
    56: 'https://bscscan.com/tx/',
    137: 'https://polygonscan.com/tx/',
    42161: 'https://arbiscan.io/tx/',
    10: 'https://optimistic.etherscan.io/tx/',
    43114: 'https://snowtrace.io/tx/',
    11155111: 'https://sepolia.etherscan.io/tx/',
  };
  
  const baseUrl = explorers[chainId] || explorers[1];
  window.open(`${baseUrl}${hash}`, '_blank');
}

// ==================================================================================
// ERROR HANDLING
// ==================================================================================

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

