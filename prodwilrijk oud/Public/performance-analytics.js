// ==========================================
// ===== Performance Analytics Modules ======
// ==========================================

// Nederlandse teksten configuratie
const NL_TEKSTEN = {
  totaalWerknemers: 'Totaal Werknemers',
  gemUrenPerWerknemer: 'Gem. Uren/Werknemer',
  teamProductiviteit: 'Team Productiviteit',
  topPerformer: 'Top Performer',
  ordersPerUur: 'orders/uur',
  top5Performers: 'Top 5 Performers - Deze Maand',
  rang: 'Rang',
  werknemer: 'Werknemer',
  totaalUren: 'Totaal Uren',
  ordersGewerkt: 'Orders Gewerkt',
  productiviteit: 'Productiviteit',
  efficiencyScore: 'Efficiency Score',
  alleWerknemers: 'Alle Werknemers',
  zoeken: 'Zoeken...',
  orders: 'Orders',
  vsTeamGem: 'vs Team Gem.',
  totaleArbeidskost: 'Totale Arbeidskost',
  laatsteAfgerond: 'laatste afgeronde orders',
  gemKostPerOrder: 'Gem. Kost per Order',
  gemiddelde: 'gemiddelde',
  uurloon: 'Uurloon',
  standaardTarief: 'standaard tarief',
  noot: 'Opmerking',
  kostenInfo: 'Kostenberekeningen zijn gebaseerd op tijdslogs en standaard uurloon (€{rate}/uur). Voeg orderprij zen toe voor volledige winstgevendheidsanalyse.',
  kostenBreakdown: 'Kosten Breakdown - Recente Orders',
  orderNr: 'Order #',
  klant: 'Klant',
  arbeidskost: 'Arbeidskost',
  kostPerUur: 'Kost/Uur',
  atRisk: 'Risico',
  tightSchedule: 'Krap Schema',
  onTrack: 'Op Schema',
  ordersAchterSchema: 'orders achter schema',
  ordersDichtbijDeadline: 'orders dichtbij deadline',
  ordersOpSchema: 'orders op schema',
  actieVereist: 'ACTIE VEREIST',
  riscoMsg: 'order(s) dreigen deadline te missen. Review en pas resources aan.',
  orderCompletionForecasts: 'Order Afwerking Voorspellingen',
  deadline: 'Deadline',
  geschatteAfronding: 'Geschatte Afronding',
  dagenOver: 'Dagen Over',
  status: 'Status',
  dagenTekst: 'dagen',
  geenProblemenMsg: 'Alles Oké! Geen bottlenecks gedetecteerd. Alle orders vorderen goed.',
  bottlenecksGedetecteerd: 'Bottlenecks Gedetecteerd',
  hoogPrioriteit: 'Hoog Prioriteit',
  detailsBekijken: 'Details Bekijken'
};

const ANALYTICS_API_REQUIRED_METHODS = ['getOrders', 'getOrderDetails', 'getEmployees'];
let analyticsFallbackApi = null;
let analyticsFallbackWarned = false;
let cachedAnalyticsApi = null;

function isValidAnalyticsApi(candidate) {
  return candidate && ANALYTICS_API_REQUIRED_METHODS.every(
    method => typeof candidate[method] === 'function'
  );
}

function getFallbackAnalyticsApi() {
  if (!analyticsFallbackApi) {
    analyticsFallbackApi = {
      __isAnalyticsFallbackClient: true,
      async getOrders() {
        return [];
      },
      async getOrderDetails(orderId) {
        return {
          id: orderId,
          order_nummer: '',
          klant: '',
          status: 'Onbekend',
          tijdsregistraties: [],
          order_start: null,
          voortgang: 0
        };
      },
      async getEmployees() {
        return [];
      }
    };
  }
  return analyticsFallbackApi;
}

function resolveAnalyticsAPI({ allowFallback = true, useCache = true } = {}) {
  if (useCache && cachedAnalyticsApi && isValidAnalyticsApi(cachedAnalyticsApi)) {
    return cachedAnalyticsApi;
  }

  const candidates = [];

  if (typeof getAPI === 'function') {
    try {
      const resolved = getAPI();
      if (resolved) {
        candidates.push(resolved);
      }
    } catch (error) {
      console.warn('getAPI() threw while resolving analytics API:', error);
    }
  }

  if (typeof window !== 'undefined') {
    if (window.API) {
      candidates.push(window.API);
    }
    if (window.AnalyticsAPI) {
      candidates.push(window.AnalyticsAPI);
    }
  }

  for (const candidate of candidates) {
    if (isValidAnalyticsApi(candidate)) {
      if (useCache) {
        cachedAnalyticsApi = candidate;
      }
      return candidate;
    }
  }

  if (!allowFallback) {
    return null;
  }

  if (!analyticsFallbackWarned) {
    console.warn(
      'Analytics API not available; using fallback stub. Metrics will remain empty until the API is restored.'
    );
    analyticsFallbackWarned = true;
  }

  return getFallbackAnalyticsApi();
}

function isFallbackAnalyticsApi(api) {
  return Boolean(api && api.__isAnalyticsFallbackClient);
}

async function waitForAnalyticsAPI({ timeout = 4000, interval = 200 } = {}) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const api = resolveAnalyticsAPI({ allowFallback: false });
    if (api && !isFallbackAnalyticsApi(api)) {
      return api;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  return resolveAnalyticsAPI({ allowFallback: true });
}

/**
 * 1. TREND ANALYSIS MODULE
 * Compares current metrics with previous periods
 */
const TrendAnalyzer = {
  async comparePeriods(metric, currentPeriod, previousPeriod) {
    try {
      const current = await this.getMetricValue(metric, currentPeriod);
      const previous = await this.getMetricValue(metric, previousPeriod);
      
      if (previous === 0) {
        return {
          current,
          previous,
          change: current > 0 ? 100 : 0,
          trend: current > 0 ? 'up' : 'neutral',
          icon: current > 0 ? '🔼' : '➡️',
          color: current > 0 ? 'success' : 'secondary'
        };
      }
      
      const change = ((current - previous) / previous) * 100;
      const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
      const icon = change > 5 ? '🔼' : change < -5 ? '🔽' : '➡️';
      const color = change > 0 ? 'success' : change < 0 ? 'danger' : 'secondary';
      
      return {
        current,
        previous,
        change: Math.abs(change).toFixed(1),
        trend,
        icon,
        color,
        message: `${icon} ${Math.abs(change).toFixed(1)}% vs previous period`
      };
    } catch (error) {
      console.error('Error comparing periods:', error);
      return null;
    }
  },

  async getMetricValue(metric, period) {
    const { startDate, endDate } = this.getPeriodDates(period);
    
    // Gebruik centrale API-resolver
    const API = await waitForAnalyticsAPI();
    if (!API || isFallbackAnalyticsApi(API)) {
      console.warn('Geen API beschikbaar voor metrics');
      return 0;
    }
    
    switch (metric) {
      case 'active_orders':
        return await this.getActiveOrdersCount(startDate, endDate, API);
      case 'completed_orders':
        return await this.getCompletedOrdersCount(startDate, endDate, API);
      case 'total_hours':
        return await this.getTotalHours(startDate, endDate, API);
      case 'efficiency':
        return await this.getEfficiency(startDate, endDate, API);
      default:
        return 0;
    }
  },

  getPeriodDates(period) {
    const now = new Date();
    let startDate, endDate = new Date();

    switch (period) {
      case 'current_week':
        const dayOfWeek = now.getDay() || 7;
        startDate = new Date(now);
        startDate.setDate(now.getDate() - dayOfWeek + 1);
        break;
      case 'previous_week':
        const prevWeekStart = new Date(now);
        prevWeekStart.setDate(now.getDate() - now.getDay() - 6);
        startDate = prevWeekStart;
        endDate = new Date(prevWeekStart);
        endDate.setDate(prevWeekStart.getDate() + 6);
        break;
      case 'current_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'previous_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return { startDate, endDate };
  },

  async getActiveOrdersCount(startDate, endDate, API) {
    const orders = await API.getOrders();
    return orders.filter(o => o.status !== 'Afgewerkt').length;
  },

  async getCompletedOrdersCount(startDate, endDate, API) {
    const orders = await API.getOrders();
    return orders.filter(o => {
      if (o.status !== 'Afgewerkt') return false;
      if (!o.einddatum) return false;
      const completedDate = new Date(o.einddatum);
      return completedDate >= startDate && completedDate <= endDate;
    }).length;
  },

  async getTotalHours(startDate, endDate, API) {
    const orders = await API.getOrders();
    let totalSeconds = 0;
    for (const order of orders) {
      if (order.totale_tijd) {
        totalSeconds += order.totale_tijd;
      }
    }
    return (totalSeconds / 3600).toFixed(1);
  },

  async getEfficiency(startDate, endDate, API) {
    // Placeholder - calculate based on your specific metrics
    return 0;
  },

  async renderTrendDashboard() {
    const container = document.getElementById('trends-dashboard-container');
    if (!container) return;

    LoadingManager.start('trends');

    try {
      const apiClient = await waitForAnalyticsAPI();
      if (!apiClient || isFallbackAnalyticsApi(apiClient)) {
        container.innerHTML = `
          <div class="alert alert-warning mb-4">
            <i class="fas fa-plug-circle-xmark me-2"></i>
            Analytics API niet beschikbaar. Trendoverzicht kan niet geladen worden.
          </div>
        `;
        return;
      }

      const metrics = [
        { id: 'active_orders', label: 'Actieve Orders', icon: 'clipboard-list' },
        { id: 'completed_orders', label: 'Afgewerkte Orders', icon: 'check-circle' },
        { id: 'total_hours', label: 'Totaal Uren', icon: 'clock' }
      ];

      const trends = await Promise.all(
        metrics.map(m => this.comparePeriods(m.id, 'current_month', 'previous_month'))
      );

      let html = `
        <div class="row mb-4">
          ${metrics.map((metric, idx) => {
            const trend = trends[idx];
            if (!trend) return '';
            
            return `
              <div class="col-md-4">
                <div class="card card-hover">
                  <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                      <div>
                        <h6 class="text-muted mb-2">${metric.label}</h6>
                        <h2 class="mb-0">${trend.current}</h2>
                      </div>
                      <div class="stat-icon text-primary">
                        <i class="fas fa-${metric.icon}"></i>
                      </div>
                    </div>
                    <div class="d-flex align-items-center">
                      <span class="badge badge-${trend.color} me-2">
                        ${trend.icon} ${trend.change}%
                      </span>
                      <small class="text-muted">vs vorige maand</small>
                    </div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="card">
          <div class="card-header">
            <h5 class="mb-0">Prestatie Trends</h5>
          </div>
          <div class="card-body">
            <canvas id="trend-chart" height="80"></canvas>
          </div>
        </div>
      `;

      container.innerHTML = html;

      // Initialize chart
      await this.initTrendChart();

    } catch (error) {
      ErrorHandler.showNotification(error, 'renderTrendDashboard');
      container.innerHTML = `
        <div class="error-state">
          <div class="error-state-icon"><i class="fas fa-exclamation-circle"></i></div>
          <div class="error-state-content">
            <div class="error-state-title">Trends Laden Mislukt</div>
            <div class="error-state-message">${error.message}</div>
            <button class="error-state-action" onclick="TrendAnalyzer.renderTrendDashboard()">
              <i class="fas fa-redo me-2"></i>Opnieuw Proberen
            </button>
          </div>
        </div>
      `;
    } finally {
      LoadingManager.stop('trends');
    }
  },

  async initTrendChart() {
    const ctx = document.getElementById('trend-chart');
    if (!ctx) return;

    // Generate last 30 days of data
    const labels = [];
    const data = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      labels.push(date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
      data.push(Math.floor(Math.random() * 20) + 10); // Placeholder
    }

    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Actieve Orders',
          data,
          borderColor: 'rgb(37, 99, 235)',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }
};

/**
 * 2. EMPLOYEE PERFORMANCE MODULE
 * Tracks and ranks employee productivity
 */
const EmployeePerformance = {
  async getEmployeeMetrics(period) {
    try {
      const API = await waitForAnalyticsAPI();
      if (!API || isFallbackAnalyticsApi(API)) {
        console.warn('Geen Analytics API beschikbaar voor werknemer metrics');
        return [];
      }
      
      const employees = await API.getEmployees();
      const orders = await API.getOrders();

      const metrics = await Promise.all(
        employees.map(async (emp) => {
          const empOrders = [];
          let totalHours = 0;

          for (const order of orders) {
            const details = await API.getOrderDetails(order.id);
            if (details.tijdsregistraties) {
              const empLogs = details.tijdsregistraties.filter(
                log => log.werknemer_id === emp.id || log.werknemer === emp.naam
              );
              if (empLogs.length > 0) {
                empOrders.push(order);
                empLogs.forEach(log => {
                  totalHours += (log.duur || 0) / 3600;
                });
              }
            }
          }

          return {
            id: emp.id,
            name: emp.naam,
            totalHours: totalHours.toFixed(1),
            ordersWorked: empOrders.length,
            productivity: (empOrders.length / (totalHours || 1)).toFixed(2),
            efficiency: totalHours > 0 ? ((empOrders.length / totalHours) * 10).toFixed(1) : 0
          };
        })
      );

      return metrics.filter(m => m.totalHours > 0).sort((a, b) => b.productivity - a.productivity);
    } catch (error) {
      console.error('Error getting employee metrics:', error);
      return [];
    }
  },

  async renderPerformanceDashboard() {
    const container = document.getElementById('employee-performance-container');
    if (!container) return;

    LoadingManager.start('employee-performance');

    try {
      const apiClient = await waitForAnalyticsAPI();
      if (!apiClient || isFallbackAnalyticsApi(apiClient)) {
        container.innerHTML = `
          <div class="alert alert-warning mb-4">
            <i class="fas fa-plug-circle-xmark me-2"></i>
            Analytics API niet beschikbaar. Werknemersprestaties kunnen niet worden berekend.
          </div>
        `;
        return;
      }

      const metrics = await this.getEmployeeMetrics('current_month');

      if (metrics.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon"><i class="fas fa-users"></i></div>
            <div class="empty-state-title">Geen Werknemers Data</div>
            <div class="empty-state-description">Geen werknemers prestatie data beschikbaar voor deze periode.</div>
          </div>
        `;
        return;
      }

      const topPerformers = metrics.slice(0, 5);
      const teamAverage = {
        totalHours: (metrics.reduce((sum, m) => sum + parseFloat(m.totalHours), 0) / metrics.length).toFixed(1),
        productivity: (metrics.reduce((sum, m) => sum + parseFloat(m.productivity), 0) / metrics.length).toFixed(2)
      };

      let html = `
        <!-- Team Overview -->
        <div class="row mb-4">
          <div class="col-md-3">
            <div class="stat-card primary">
              <div class="card-body">
                <p class="stat-label">Total Employees</p>
                <h2 class="stat-value">${metrics.length}</h2>
              </div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="stat-card success">
              <div class="card-body">
                <p class="stat-label">Avg Hours/Employee</p>
                <h2 class="stat-value">${teamAverage.totalHours}h</h2>
              </div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="stat-card warning">
              <div class="card-body">
                <p class="stat-label">Team Productivity</p>
                <h2 class="stat-value">${teamAverage.productivity}</h2>
                <small class="text-white-50">orders/hour</small>
              </div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="stat-card info">
              <div class="card-body">
                <p class="stat-label">Top Performer</p>
                <h2 class="stat-value" style="font-size: 1.2rem;">${topPerformers[0].name}</h2>
                <small class="text-white-50">${topPerformers[0].productivity} prod</small>
              </div>
            </div>
          </div>
        </div>

        <!-- Leaderboard -->
        <div class="card mb-4">
          <div class="card-header">
            <h5 class="mb-0"><i class="fas fa-trophy text-warning me-2"></i>Top 5 Performers - This Month</h5>
          </div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead class="table-light">
                  <tr>
                    <th width="60">Rank</th>
                    <th>Employee</th>
                    <th>Total Hours</th>
                    <th>Orders Worked</th>
                    <th>Productivity</th>
                    <th>Efficiency Score</th>
                  </tr>
                </thead>
                <tbody>
                  ${topPerformers.map((emp, idx) => `
                    <tr>
                      <td>
                        <div class="d-flex align-items-center">
                          ${idx === 0 ? '<i class="fas fa-crown text-warning me-2"></i>' : ''}
                          <strong>#${idx + 1}</strong>
                        </div>
                      </td>
                      <td><strong>${emp.name}</strong></td>
                      <td>${emp.totalHours}h</td>
                      <td>${emp.ordersWorked}</td>
                      <td>
                        <span class="badge badge-success">${emp.productivity} orders/h</span>
                      </td>
                      <td>
                        <div class="progress" style="height: 20px;">
                          <div class="progress-bar bg-success" role="progressbar" 
                               style="width: ${Math.min(emp.efficiency * 10, 100)}%">
                            ${emp.efficiency}
                          </div>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- All Employees -->
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">All Employees</h5>
            <input type="text" class="form-control form-control-sm" style="width: 200px;" 
                   placeholder="Search..." id="employee-search">
          </div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover mb-0" id="all-employees-table">
                <thead class="table-light">
                  <tr>
                    <th>Employee</th>
                    <th>Total Hours</th>
                    <th>Orders</th>
                    <th>Productivity</th>
                    <th>vs Team Avg</th>
                  </tr>
                </thead>
                <tbody>
                  ${metrics.map(emp => {
                    const vsAvg = ((emp.productivity / teamAverage.productivity - 1) * 100).toFixed(0);
                    const vsAvgColor = vsAvg > 0 ? 'success' : vsAvg < 0 ? 'danger' : 'secondary';
                    const vsAvgIcon = vsAvg > 0 ? '🔼' : vsAvg < 0 ? '🔽' : '➡️';
                    
                    return `
                      <tr>
                        <td>${emp.name}</td>
                        <td>${emp.totalHours}h</td>
                        <td>${emp.ordersWorked}</td>
                        <td>${emp.productivity}</td>
                        <td>
                          <span class="badge badge-${vsAvgColor}">
                            ${vsAvgIcon} ${Math.abs(vsAvg)}%
                          </span>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      container.innerHTML = html;

      // Add search functionality
      const searchInput = document.getElementById('employee-search');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          const searchTerm = e.target.value.toLowerCase();
          const rows = document.querySelectorAll('#all-employees-table tbody tr');
          rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
          });
        });
      }

    } catch (error) {
      ErrorHandler.showNotification(error, 'renderPerformanceDashboard');
    } finally {
      LoadingManager.stop('employee-performance');
    }
  }
};

/**
 * 3. COST ANALYSIS MODULE
 * Calculates costs and profitability
 */
const CostAnalyzer = {
  config: {
    defaultHourlyRate: 25, // EUR 25/hour - adjust as needed
    employeeRates: {}  // Can be loaded from database
  },

  async calculateOrderCost(orderId) {
    try {
      const API = await waitForAnalyticsAPI();
      if (!API || isFallbackAnalyticsApi(API)) {
        console.warn('Geen Analytics API beschikbaar voor kostencalculatie');
        return { totalCost: 0, totalHours: 0, costPerHour: 0 };
      }
      
      const order = await API.getOrderDetails(orderId);
      if (!order.tijdsregistraties) {
        return { totalCost: 0, totalHours: 0, costPerHour: 0 };
      }

      let totalCost = 0;
      let totalSeconds = 0;

      for (const log of order.tijdsregistraties) {
        const employeeRate = this.config.employeeRates[log.werknemer_id] || this.config.defaultHourlyRate;
        const hours = (log.duur || 0) / 3600;
        totalCost += hours * employeeRate;
        totalSeconds += log.duur || 0;
      }

      const totalHours = totalSeconds / 3600;

      return {
        totalCost: totalCost.toFixed(2),
        totalHours: totalHours.toFixed(2),
        costPerHour: totalHours > 0 ? (totalCost / totalHours).toFixed(2) : 0,
        breakdown: this.getCostBreakdown(order.tijdsregistraties)
      };
    } catch (error) {
      console.error('Error calculating order cost:', error);
      return { totalCost: 0, totalHours: 0, costPerHour: 0 };
    }
  },

  getCostBreakdown(timeLogs) {
    const breakdown = {};
    
    for (const log of timeLogs) {
      const step = log.productiestap || 'Unknown';
      const rate = this.config.employeeRates[log.werknemer_id] || this.config.defaultHourlyRate;
      const hours = (log.duur || 0) / 3600;
      const cost = hours * rate;

      if (!breakdown[step]) {
        breakdown[step] = { hours: 0, cost: 0 };
      }
      breakdown[step].hours += hours;
      breakdown[step].cost += cost;
    }

    return breakdown;
  },

  async renderCostAnalysis() {
    const container = document.getElementById('cost-analysis-container');
    if (!container) return;

    LoadingManager.start('cost-analysis');

    try {
      const API = await waitForAnalyticsAPI();
      if (!API || isFallbackAnalyticsApi(API)) {
        console.warn('Geen Analytics API beschikbaar voor kostenanalyse');
        container.innerHTML = `
          <div class="alert alert-warning">
            <i class="fas fa-plug-circle-xmark me-2"></i>
            Analytics API niet beschikbaar. Kostenanalyse kan niet geladen worden.
          </div>
        `;
        return;
      }
      
      const orders = await API.getOrders();
      const completedOrders = orders.filter(o => o.status === 'Afgewerkt' || o.voortgang >= 100);

      let totalCost = 0;
      let totalRevenue = 0; // Would need to come from order.prijs
      const costData = [];

      for (const order of completedOrders.slice(0, 20)) { // Limit to 20 for performance
        const cost = await this.calculateOrderCost(order.id);
        totalCost += parseFloat(cost.totalCost);
        // totalRevenue += order.prijs || 0; // If you have pricing data

        costData.push({
          orderNumber: order.order_nummer,
          client: order.klant,
          cost: cost.totalCost,
          hours: cost.totalHours,
          costPerHour: cost.costPerHour
        });
      }

      let html = `
        <!-- Cost Overview -->
        <div class="row mb-4">
          <div class="col-md-4">
            <div class="stat-card danger">
              <div class="card-body">
                <p class="stat-label">Total Labor Cost</p>
                <h2 class="stat-value">€${totalCost.toFixed(0)}</h2>
                <small class="text-white-50">Last 20 completed orders</small>
              </div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="stat-card warning">
              <div class="card-body">
                <p class="stat-label">Avg Cost per Order</p>
                <h2 class="stat-value">€${(totalCost / costData.length).toFixed(0)}</h2>
                <small class="text-white-50">average</small>
              </div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="stat-card info">
              <div class="card-body">
                <p class="stat-label">Hourly Rate</p>
                <h2 class="stat-value">€${this.config.defaultHourlyRate}</h2>
                <small class="text-white-50">standard rate</small>
              </div>
            </div>
          </div>
        </div>

        <div class="alert alert-warning">
          <i class="fas fa-info-circle me-2"></i>
          <strong>Note:</strong> Cost calculations are based on time logs and standard hourly rates (€${this.config.defaultHourlyRate}/hour). 
          Revenue data is not yet integrated. Add order pricing for full profitability analysis.
        </div>

        <!-- Cost Details Table -->
        <div class="card">
          <div class="card-header">
            <h5 class="mb-0">Cost Breakdown - Recent Orders</h5>
          </div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Order #</th>
                    <th>Client</th>
                    <th>Total Hours</th>
                    <th>Labor Cost</th>
                    <th>Cost/Hour</th>
                  </tr>
                </thead>
                <tbody>
                  ${costData.map(order => `
                    <tr>
                      <td><strong>${order.orderNumber}</strong></td>
                      <td>${order.client}</td>
                      <td>${order.hours}h</td>
                      <td><strong>€${order.cost}</strong></td>
                      <td>€${order.costPerHour}/h</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      container.innerHTML = html;

    } catch (error) {
      ErrorHandler.showNotification(error, 'renderCostAnalysis');
    } finally {
      LoadingManager.stop('cost-analysis');
    }
  }
};

/**
 * 4. FORECASTING MODULE
 * Predicts order completion dates and capacity
 */
const Forecaster = {
  async predictOrderCompletion(orderId) {
    try {
      const API = await waitForAnalyticsAPI();
      if (!API || isFallbackAnalyticsApi(API)) {
        console.warn('Geen Analytics API beschikbaar voor voorspellingen');
        return {
          estimatedDate: null,
          daysRemaining: null,
          confidence: 'low',
          status: 'api-unavailable',
          message: 'Analytics API niet beschikbaar'
        };
      }
      
      const order = await API.getOrderDetails(orderId);
      
      if (!order.voortgang || order.voortgang === 0) {
        return {
          estimatedDate: null,
          daysRemaining: null,
          confidence: 'low',
          status: 'insufficient-data',
          message: 'Insufficient data for prediction'
        };
      }

      const completedPercentage = order.voortgang;
      const startDate = new Date(order.startdatum);
      const now = new Date();
      const elapsedTime = now - startDate;
      
      const estimatedTotalTime = (elapsedTime / completedPercentage) * 100;
      const remainingTime = estimatedTotalTime - elapsedTime;
      
      const estimatedCompletionDate = new Date(now.getTime() + remainingTime);
      const daysRemaining = Math.ceil(remainingTime / (1000 * 60 * 60 * 24));
      
      const deadline = new Date(order.einddatum);
      const status = this.getStatusIndicator(estimatedCompletionDate, deadline);
      
      return {
        estimatedDate: estimatedCompletionDate,
        daysRemaining,
        confidence: completedPercentage > 20 ? 'high' : 'medium',
        status: status.status,
        message: status.message,
        icon: status.icon
      };
    } catch (error) {
      console.error('Error predicting completion:', error);
      return null;
    }
  },

  getStatusIndicator(estimated, deadline) {
    const diff = estimated - deadline;
    const daysDiff = diff / (1000 * 60 * 60 * 24);
    
    if (daysDiff > 2) {
      return {
        status: 'at-risk',
        icon: '⚠️',
        color: 'danger',
        message: 'At risk of missing deadline'
      };
    } else if (daysDiff > 0) {
      return {
        status: 'tight',
        icon: '⏰',
        color: 'warning',
        message: 'Tight schedule'
      };
    } else {
      return {
        status: 'on-track',
        icon: '✅',
        color: 'success',
        message: 'On track'
      };
    }
  },

  async renderForecasts() {
    const container = document.getElementById('forecasts-container');
    if (!container) return;

    LoadingManager.start('forecasts');

    try {
      const API = await waitForAnalyticsAPI();
      if (!API || isFallbackAnalyticsApi(API)) {
        container.innerHTML = `
          <div class="alert alert-warning mb-0">
            <i class="fas fa-plug-circle-xmark me-2"></i>
            Analytics API niet beschikbaar. Voorspellingen kunnen niet berekend worden.
          </div>
        `;
        return;
      }
      
      const orders = await API.getOrders();
      const activeOrders = orders.filter(o => o.status !== 'Afgewerkt');

      const predictions = [];
      for (const order of activeOrders.slice(0, 15)) { // Limit for performance
        const prediction = await this.predictOrderCompletion(order.id);
        if (prediction && prediction.estimatedDate) {
          predictions.push({
            order: order.order_nummer,
            client: order.klant,
            deadline: order.einddatum,
            ...prediction
          });
        }
      }

      // Group by status
      const atRisk = predictions.filter(p => p.status === 'at-risk');
      const tight = predictions.filter(p => p.status === 'tight');
      const onTrack = predictions.filter(p => p.status === 'on-track');

      let html = `
        <!-- Summary Cards -->
        <div class="row mb-4">
          <div class="col-md-4">
            <div class="stat-card danger">
              <div class="card-body">
                <p class="stat-label">⚠️ At Risk</p>
                <h2 class="stat-value">${atRisk.length}</h2>
                <small class="text-white-50">orders behind schedule</small>
              </div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="stat-card warning">
              <div class="card-body">
                <p class="stat-label">⏰ Tight Schedule</p>
                <h2 class="stat-value">${tight.length}</h2>
                <small class="text-white-50">orders cutting it close</small>
              </div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="stat-card success">
              <div class="card-body">
                <p class="stat-label">✅ On Track</p>
                <h2 class="stat-value">${onTrack.length}</h2>
                <small class="text-white-50">orders on schedule</small>
              </div>
            </div>
          </div>
        </div>

        ${atRisk.length > 0 ? `
          <div class="alert alert-danger mb-4">
            <i class="fas fa-exclamation-triangle me-2"></i>
            <strong>Action Required:</strong> ${atRisk.length} order(s) are at risk of missing their deadline. Review and adjust resources.
          </div>
        ` : ''}

        <!-- Forecast Details -->
        <div class="card">
          <div class="card-header">
            <h5 class="mb-0">Order Completion Forecasts</h5>
          </div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Order #</th>
                    <th>Client</th>
                    <th>Deadline</th>
                    <th>Est. Completion</th>
                    <th>Days Remaining</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${predictions.map(pred => {
                    const statusColor = pred.status === 'at-risk' ? 'danger' : 
                                       pred.status === 'tight' ? 'warning' : 'success';
                    return `
                      <tr>
                        <td><strong>${pred.order}</strong></td>
                        <td>${pred.client}</td>
                        <td>${Format.date(pred.deadline)}</td>
                        <td>${Format.date(pred.estimatedDate)}</td>
                        <td>${pred.daysRemaining} days</td>
                        <td>
                          <span class="badge badge-${statusColor}">
                            ${pred.icon} ${pred.message}
                          </span>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      container.innerHTML = html;

    } catch (error) {
      ErrorHandler.showNotification(error, 'renderForecasts');
    } finally {
      LoadingManager.stop('forecasts');
    }
  }
};

/**
 * 5. BOTTLENECK DETECTION MODULE
 * Identifies stuck orders and process bottlenecks
 */
const BottleneckDetector = {
  async analyzeBottlenecks() {
    try {
      const API = await waitForAnalyticsAPI();
      if (!API || isFallbackAnalyticsApi(API)) {
        return [];
      }
      
      const orders = await API.getOrders();
      const activeOrders = orders.filter(o => o.status !== 'Afgewerkt');
      
      const bottlenecks = [];

      for (const order of activeOrders) {
        // Check 1: Orders with no recent activity
        const lastActivity = await this.getLastActivityTime(order.id);
        if (lastActivity) {
          const hoursSinceActivity = (Date.now() - lastActivity) / (1000 * 60 * 60);
          
          if (hoursSinceActivity > 48) {
            bottlenecks.push({
              type: 'inactive',
              severity: 'high',
              orderId: order.id,
              orderNumber: order.order_nummer,
              client: order.klant,
              message: `No activity for ${Math.floor(hoursSinceActivity)} hours`,
              icon: '💤',
              color: 'danger'
            });
          } else if (hoursSinceActivity > 24) {
            bottlenecks.push({
              type: 'inactive',
              severity: 'medium',
              orderId: order.id,
              orderNumber: order.order_nummer,
              client: order.klant,
              message: `No activity for ${Math.floor(hoursSinceActivity)} hours`,
              icon: '⏸️',
              color: 'warning'
            });
          }
        }

        // Check 2: Orders behind schedule
        const prediction = await Forecaster.predictOrderCompletion(order.id);
        if (prediction && prediction.status === 'at-risk') {
          bottlenecks.push({
            type: 'behind-schedule',
            severity: 'high',
            orderId: order.id,
            orderNumber: order.order_nummer,
            client: order.klant,
            message: prediction.message,
            icon: '⚠️',
            color: 'danger'
          });
        }

        // Check 3: Low progress
        if (order.voortgang < 10 && order.startdatum) {
          const daysSinceStart = (Date.now() - new Date(order.startdatum)) / (1000 * 60 * 60 * 24);
          if (daysSinceStart > 3) {
            bottlenecks.push({
              type: 'low-progress',
              severity: 'medium',
              orderId: order.id,
              orderNumber: order.order_nummer,
              client: order.klant,
              message: `Only ${order.voortgang}% complete after ${Math.floor(daysSinceStart)} days`,
              icon: '🐌',
              color: 'warning'
            });
          }
        }
      }

      return bottlenecks.sort((a, b) => 
        (b.severity === 'high' ? 1 : 0) - (a.severity === 'high' ? 1 : 0)
      );
    } catch (error) {
      console.error('Error analyzing bottlenecks:', error);
      return [];
    }
  },

  async getLastActivityTime(orderId) {
    try {
      const API = await waitForAnalyticsAPI();
      if (!API || isFallbackAnalyticsApi(API)) {
        return null;
      }
      
      const order = await API.getOrderDetails(orderId);
      if (!order.tijdsregistraties || order.tijdsregistraties.length === 0) {
        return null;
      }

      const lastLog = order.tijdsregistraties.reduce((latest, log) => {
        const logTime = new Date(log.eind_tijd || log.start_tijd);
        return logTime > latest ? logTime : latest;
      }, new Date(0));

      return lastLog.getTime();
    } catch (error) {
      return null;
    }
  },

  async renderBottleneckAlerts() {
    const container = document.getElementById('bottleneck-alerts-container');
    if (!container) return;

    try {
      const apiClient = await waitForAnalyticsAPI();
      const usingFallback = !apiClient || isFallbackAnalyticsApi(apiClient);
      const bottlenecks = usingFallback ? [] : await this.analyzeBottlenecks();

      if (usingFallback) {
        container.innerHTML = `
          <div class="alert alert-warning mb-0">
            <i class="fas fa-plug-circle-xmark me-2"></i>
            Analytics API niet beschikbaar. Bottleneckanalyse wordt overgeslagen.
          </div>
        `;
        return;
      }

      if (bottlenecks.length === 0) {
        container.innerHTML = `
          <div class="alert alert-success">
            <i class="fas fa-check-circle me-2"></i>
            <strong>All Clear!</strong> No bottlenecks detected. All orders are progressing well.
          </div>
        `;
        return;
      }

      const highPriority = bottlenecks.filter(b => b.severity === 'high');

      let html = `
        <div class="card border-${highPriority.length > 0 ? 'danger' : 'warning'}">
          <div class="card-header bg-${highPriority.length > 0 ? 'danger' : 'warning'} text-white">
            <h5 class="mb-0">
              <i class="fas fa-exclamation-triangle me-2"></i>
              Bottlenecks Detected (${bottlenecks.length})
              ${highPriority.length > 0 ? `<span class="badge bg-light text-danger ms-2">${highPriority.length} High Priority</span>` : ''}
            </h5>
          </div>
          <div class="card-body">
            <div class="row">
              ${bottlenecks.slice(0, 6).map(bottleneck => `
                <div class="col-md-6 mb-3">
                  <div class="alert alert-${bottleneck.color} mb-0">
                    <div class="d-flex align-items-start">
                      <div class="me-3" style="font-size: 24px;">${bottleneck.icon}</div>
                      <div class="flex-grow-1">
                        <strong>${bottleneck.orderNumber}</strong> - ${bottleneck.client}
                        <br>
                        <small>${bottleneck.message}</small>
                        <br>
                        <button class="btn btn-sm btn-outline-${bottleneck.color} mt-2" 
                                onclick="viewOrderDetails(${bottleneck.orderId})">
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
            ${bottlenecks.length > 6 ? `
              <div class="text-center mt-3">
                <small class="text-muted">And ${bottlenecks.length - 6} more...</small>
              </div>
            ` : ''}
          </div>
        </div>
      `;

      container.innerHTML = html;

    } catch (error) {
      console.error('Error rendering bottleneck alerts:', error);
    }
  }
};

/**
 * INITIALIZATION
 */
document.addEventListener('DOMContentLoaded', () => {
  // Initialize performance analytics when tab is shown
  const performanceTab = document.getElementById('performance-tab');
  if (performanceTab) {
    performanceTab.addEventListener('shown.bs.tab', async () => {
      // Load bottleneck alerts (shown on all sub-tabs)
      await BottleneckDetector.renderBottleneckAlerts();
      
      // Load initial trend dashboard
      await TrendAnalyzer.renderTrendDashboard();
    });
  }

  // Initialize sub-tabs
  const trendsTab = document.getElementById('trends-sub-tab');
  if (trendsTab) {
    trendsTab.addEventListener('shown.bs.tab', () => {
      TrendAnalyzer.renderTrendDashboard();
    });
  }

  const employeesTab = document.getElementById('employees-sub-tab');
  if (employeesTab) {
    employeesTab.addEventListener('shown.bs.tab', () => {
      EmployeePerformance.renderPerformanceDashboard();
    });
  }

  const costsTab = document.getElementById('costs-sub-tab');
  if (costsTab) {
    costsTab.addEventListener('shown.bs.tab', () => {
      CostAnalyzer.renderCostAnalysis();
    });
  }

  const forecastsTab = document.getElementById('forecasts-sub-tab');
  if (forecastsTab) {
    forecastsTab.addEventListener('shown.bs.tab', () => {
      Forecaster.renderForecasts();
    });
  }

  // Refresh button
  const refreshBtn = document.getElementById('refresh-analytics');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      const activeTab = document.querySelector('.tab-pane.active[id*="-content"]');
      if (!activeTab) return;

      refreshBtn.disabled = true;
      refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Laden...';

      try {
        await BottleneckDetector.renderBottleneckAlerts();
        
        if (activeTab.id === 'trends-content') {
          await TrendAnalyzer.renderTrendDashboard();
        } else if (activeTab.id === 'employees-content') {
          await EmployeePerformance.renderPerformanceDashboard();
        } else if (activeTab.id === 'costs-content') {
          await CostAnalyzer.renderCostAnalysis();
        } else if (activeTab.id === 'forecasts-content') {
          await Forecaster.renderForecasts();
        }

        if (typeof Notifications !== 'undefined') {
          Notifications.success('Analytics succesvol vernieuwd!');
        }
      } catch (error) {
        ErrorHandler.showNotification(error, 'refresh analytics');
      } finally {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt me-2"></i>Analytics Vernieuwen';
      }
    });
  }

  // Custom period selector
  const periodSelect = document.getElementById('performance-period');
  const customDateRange = document.getElementById('custom-date-range-performance');
  if (periodSelect && customDateRange) {
    periodSelect.addEventListener('change', () => {
      customDateRange.style.display = periodSelect.value === 'custom' ? 'block' : 'none';
    });
  }
});

// Make modules globally available
window.TrendAnalyzer = TrendAnalyzer;
window.EmployeePerformance = EmployeePerformance;
window.CostAnalyzer = CostAnalyzer;
window.Forecaster = Forecaster;
window.BottleneckDetector = BottleneckDetector;

