// ==========================================
// === Analytics Helper Functions =========
// ==========================================

/**
 * Loading Manager for Analytics
 */
const LoadingManager = {
  activeLoaders: new Set(),
  
  start(key) {
    this.activeLoaders.add(key);
  },
  
  stop(key) {
    this.activeLoaders.delete(key);
  },
  
  isLoading(key) {
    return this.activeLoaders.has(key);
  }
};

/**
 * Error Handler for Analytics
 */
const ErrorHandler = {
  showNotification(error, context = '') {
    console.error(`Error in ${context}:`, error);
    
    if (typeof Notifications !== 'undefined') {
      Notifications.error(
        'Error Loading Analytics',
        error.message || 'An unexpected error occurred'
      );
    } else {
      alert(`Error in ${context}: ${error.message}`);
    }
  }
};

/**
 * Format Utilities
 */
const Format = {
  date(dateString) {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  },
  
  datetime(dateString) {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid DateTime';
      
      return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid DateTime';
    }
  },
  
  number(num, decimals = 0) {
    if (typeof num !== 'number' || isNaN(num)) return '0';
    return num.toFixed(decimals);
  },
  
  currency(amount, currency = '€') {
    if (typeof amount !== 'number' || isNaN(amount)) return `${currency}0.00`;
    return `${currency}${amount.toFixed(2)}`;
  },
  
  percentage(value, decimals = 1) {
    if (typeof value !== 'number' || isNaN(value)) return '0%';
    return `${value.toFixed(decimals)}%`;
  },
  
  duration(seconds) {
    if (!seconds || seconds < 0) return '0m';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
};

/**
 * API Helper for Analytics (extends existing API if needed)
 */
// Maak een dedicated Analytics API object
window.AnalyticsAPI = {
  BASE_URL: '/api',
  
  async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  },
  
  async getOrders() {
    // Try primary endpoint
    try {
      const list = await this.request('/production-orders');
      if (Array.isArray(list) && list.length) return list.map(this._normalizeOrderForAnalytics);
    } catch (e) {}

    // Try admin orders as fallback
    try {
      const adminList = await this.request('/admin/orders');
      if (Array.isArray(adminList) && adminList.length) {
        return adminList.map(this._normalizeOrderForAnalytics);
      }
    } catch (e) {}

    // Try localStorage cache from werkregistratie
    try {
      const raw = localStorage.getItem('cached_orders');
      if (raw) {
        const cached = JSON.parse(raw);
        if (Array.isArray(cached)) {
          return cached.map(this._normalizeOrderForAnalytics);
        }
      }
    } catch (e) {
      console.warn('Failed reading cached_orders from localStorage:', e);
    }

    return [];
  },
  
  async getOrderDetails(orderId) {
    // Try production order details
    try {
      const o = await this.request(`/production-orders/${orderId}`);
      return this._normalizeOrderForAnalytics(o);
    } catch (e) {}

    // Try admin order details
    try {
      const o = await this.request(`/admin/orders/${orderId}`);
      return this._normalizeOrderForAnalytics(o);
    } catch (e) {}

    // Try local cache lookup
    try {
      const raw = localStorage.getItem('cached_orders');
      if (raw) {
        const cached = JSON.parse(raw) || [];
        const found = cached.find(o => `${o.id}` === `${orderId}` || `${o.order_id}` === `${orderId}`);
        if (found) return this._normalizeOrderForAnalytics(found);
      }
    } catch (e) {}

    return null;
  },
  
  async getEmployees() {
    try {
      const w = await this.request('/werknemers');
      if (Array.isArray(w)) return w;
    } catch (error) {}
    try {
      const w2 = await this.request('/employees');
      if (Array.isArray(w2)) return w2.map(r => ({ id: r.id, naam: r.naam || r.name || r.full_name || r.username || r.employee_name }));
    } catch (e) {}

    // Try cache (optional: if you later store employees in localStorage)
    try {
      const raw = localStorage.getItem('cached_employees');
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) return list;
      }
    } catch (e) {}

    return [];
  },

  // Normalize various order shapes to analytics-friendly shape
  _normalizeOrderForAnalytics(order) {
    if (!order || typeof order !== 'object') return order;
    const id = order.id ?? order.order_id ?? order.ID ?? null;
    const status = order.status ?? order.order_status ?? 'Onbekend';
    const quantity = Number(order.quantity ?? order.aantal ?? 0) || 0;
    const completed = Number(order.completed_quantity ?? order.afgewerkt_aantal ?? 0) || 0;
    let voortgang = order.voortgang;
    if (typeof voortgang !== 'number') {
      if (quantity > 0) voortgang = Math.round((completed / quantity) * 100);
      else if (String(status).toLowerCase() === 'afgewerkt') voortgang = 100;
      else voortgang = 0;
    }
    const startdatum = order.startdatum ?? order.created_at ?? order.start_date ?? null;
    const einddatum = order.einddatum ?? (voortgang >= 100 ? (order.updated_at ?? order.end_date ?? null) : null);
    const klant = order.klant ?? order.client ?? order.customer ?? null;
    const order_nummer = order.order_nummer ?? order.work_order ?? id;

    return {
      ...order,
      id,
      status,
      quantity,
      completed_quantity: completed,
      voortgang,
      startdatum,
      einddatum,
      klant,
      order_nummer
    };
  }
};

// Gebruik AnalyticsAPI als fallback voor window.API
if (typeof window.API === 'undefined') {
  window.API = window.AnalyticsAPI;
} else {
  // Als API al bestaat, voeg de methods toe als ze ontbreken
  if (!window.API.getOrders) {
    window.API.getOrders = window.AnalyticsAPI.getOrders.bind(window.AnalyticsAPI);
  }
  if (!window.API.getOrderDetails) {
    window.API.getOrderDetails = window.AnalyticsAPI.getOrderDetails.bind(window.AnalyticsAPI);
  }
  if (!window.API.getEmployees) {
    window.API.getEmployees = window.AnalyticsAPI.getEmployees.bind(window.AnalyticsAPI);
  }
}

// Force window.API to exist
if (!window.API) {
  window.API = window.AnalyticsAPI;
  console.log('⚠️ window.API was undefined, set to AnalyticsAPI');
}

console.log('✅ Analytics API configured:', {
  baseURL: window.AnalyticsAPI.BASE_URL,
  windowAPIExists: typeof window.API !== 'undefined',
  hasGetOrders: typeof (window.API && window.API.getOrders) === 'function',
  hasGetOrderDetails: typeof (window.API && window.API.getOrderDetails) === 'function',
  hasGetEmployees: typeof (window.API && window.API.getEmployees) === 'function',
  AnalyticsAPIExists: typeof window.AnalyticsAPI !== 'undefined'
});

/**
 * Notification Helper (if Notifications doesn't exist)
 */
if (typeof Notifications === 'undefined') {
  window.Notifications = {
    success(title, message) {
      this.show('success', title, message);
    },
    
    error(title, message) {
      this.show('error', title, message);
    },
    
    warning(title, message) {
      this.show('warning', title, message);
    },
    
    info(title, message) {
      this.show('info', title, message);
    },
    
    show(type, title, message) {
      // Create simple alert notification
      const container = this.getOrCreateContainer();
      
      const notification = document.createElement('div');
      notification.className = `toast ${type}`;
      notification.innerHTML = `
        <div class="toast-icon">
          ${this.getIcon(type)}
        </div>
        <div class="toast-content">
          <div class="toast-title">${title}</div>
          <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
      `;
      
      container.appendChild(notification);
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        notification.classList.add('removing');
        setTimeout(() => notification.remove(), 300);
      }, 5000);
    },
    
    getOrCreateContainer() {
      let container = document.querySelector('.toast-container');
      if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
      }
      return container;
    },
    
    getIcon(type) {
      const icons = {
        success: '<i class="fas fa-check-circle"></i>',
        error: '<i class="fas fa-exclamation-circle"></i>',
        warning: '<i class="fas fa-exclamation-triangle"></i>',
        info: '<i class="fas fa-info-circle"></i>'
      };
      return icons[type] || icons.info;
    }
  };
}

/**
 * View Order Details Helper
 */
function viewOrderDetails(orderId) {
  // Try to use existing function if available
  if (typeof window.showOrderDetails === 'function') {
    window.showOrderDetails(orderId);
  } else if (typeof window.viewOrder === 'function') {
    window.viewOrder(orderId);
  } else {
    // Fallback - open in new tab or show modal
    window.location.href = `#order-${orderId}`;
    
    // Or trigger Bootstrap modal if it exists
    const modal = document.getElementById('orderDetailsModal');
    if (modal && typeof bootstrap !== 'undefined') {
      const bsModal = new bootstrap.Modal(modal);
      bsModal.show();
      
      // Load order details into modal
      if (typeof loadOrderDetailsIntoModal === 'function') {
        loadOrderDetailsIntoModal(orderId);
      }
    }
  }
}

/**
 * Export Analytics Data to Excel
 */
async function exportAnalyticsToExcel(data, filename = 'analytics-export.xlsx') {
  if (typeof XLSX === 'undefined') {
    ErrorHandler.showNotification(
      new Error('XLSX library not loaded'),
      'exportAnalyticsToExcel'
    );
    return;
  }
  
  try {
    const wb = XLSX.utils.book_new();
    
    // If data is an object with multiple sheets
    if (typeof data === 'object' && !Array.isArray(data)) {
      for (const [sheetName, sheetData] of Object.entries(data)) {
        const ws = XLSX.utils.json_to_sheet(sheetData);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }
    } else {
      // Single sheet
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Analytics');
    }
    
    XLSX.writeFile(wb, filename);
    
    if (typeof Notifications !== 'undefined') {
      Notifications.success('Export Successful', `Data exported to ${filename}`);
    }
  } catch (error) {
    ErrorHandler.showNotification(error, 'exportAnalyticsToExcel');
  }
}

/**
 * Calculate Business Days Between Dates
 */
function businessDaysBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  let count = 0;
  const current = new Date(start);
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

/**
 * Debounce Function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle Function
 */
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Deep Clone Object
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj);
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  
  const clonedObj = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      clonedObj[key] = deepClone(obj[key]);
    }
  }
  return clonedObj;
}

/**
 * Group Array by Key
 */
function groupBy(array, key) {
  return array.reduce((result, item) => {
    const group = item[key];
    if (!result[group]) {
      result[group] = [];
    }
    result[group].push(item);
    return result;
  }, {});
}

/**
 * Calculate Average
 */
function average(numbers) {
  if (!numbers || numbers.length === 0) return 0;
  const sum = numbers.reduce((a, b) => a + b, 0);
  return sum / numbers.length;
}

/**
 * Calculate Median
 */
function median(numbers) {
  if (!numbers || numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 
    ? (sorted[mid - 1] + sorted[mid]) / 2 
    : sorted[mid];
}

/**
 * Calculate Standard Deviation
 */
function standardDeviation(numbers) {
  if (!numbers || numbers.length === 0) return 0;
  const avg = average(numbers);
  const squareDiffs = numbers.map(value => Math.pow(value - avg, 2));
  const avgSquareDiff = average(squareDiffs);
  return Math.sqrt(avgSquareDiff);
}

/**
 * Get Color for Value (gradient)
 */
function getColorForValue(value, min, max, colorStart = '#ef4444', colorEnd = '#10b981') {
  const percentage = (value - min) / (max - min);
  // Simple color interpolation (for demo purposes)
  return percentage > 0.7 ? colorEnd : percentage > 0.4 ? '#f59e0b' : colorStart;
}

/**
 * Get API Helper - always returns a valid API object
 */
function getAPI() {
  // Try AnalyticsAPI first (most reliable)
  if (window.AnalyticsAPI && typeof window.AnalyticsAPI.getOrders === 'function') {
    return window.AnalyticsAPI;
  }
  
  // Try window.API
  if (window.API && typeof window.API.getOrders === 'function') {
    return window.API;
  }
  
  // Force re-create if needed
  if (!window.AnalyticsAPI) {
    console.error('⚠️ AnalyticsAPI was destroyed! Re-creating...');
    window.AnalyticsAPI = {
      BASE_URL: '/api',
      async request(endpoint, options = {}) {
        const response = await fetch(`${this.BASE_URL}${endpoint}`, {
          headers: { 'Content-Type': 'application/json', ...options.headers },
          ...options
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
      },
      async getOrders() { return await this.request('/production-orders'); },
      async getOrderDetails(orderId) { return await this.request(`/production-orders/${orderId}`); },
      async getEmployees() {
        try { return await this.request('/werknemers'); }
        catch { return []; }
      }
    };
  }
  
  return window.AnalyticsAPI;
}

// Make helpers globally available
window.LoadingManager = LoadingManager;
window.ErrorHandler = ErrorHandler;
window.Format = Format;
window.getAPI = getAPI;
window.viewOrderDetails = viewOrderDetails;
window.exportAnalyticsToExcel = exportAnalyticsToExcel;
window.businessDaysBetween = businessDaysBetween;
window.debounce = debounce;
window.throttle = throttle;
window.deepClone = deepClone;
window.groupBy = groupBy;
window.average = average;
window.median = median;
window.standardDeviation = standardDeviation;
window.getColorForValue = getColorForValue;

console.log('✅ Analytics helpers loaded successfully');

