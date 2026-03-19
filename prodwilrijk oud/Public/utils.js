// ==========================================
// ============ Utility Functions ===========
// ==========================================

/**
 * Data Type Normalization
 * Ensures consistent data types across the application
 */
const DataNormalizer = {
  /**
   * Normalizes prepack value to boolean
   * Handles string, number, and boolean inputs
   */
  toBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      return lower === 'true' || lower === '1' || lower === 'yes';
    }
    return false;
  },

  /**
   * Normalizes order data structure
   */
  normalizeOrder(order) {
    if (!order) return null;
    
    return {
      ...order,
      id: parseInt(order.id) || 0,
      prepack: this.toBoolean(order.prepack),
      active: this.toBoolean(order.active),
      priority: this.toBoolean(order.priority),
      voortgang: parseFloat(order.voortgang) || 0,
      totale_tijd: parseInt(order.totale_tijd) || 0,
      // Ensure dates are valid
      startdatum: order.startdatum ? new Date(order.startdatum) : null,
      einddatum: order.einddatum ? new Date(order.einddatum) : null,
    };
  },

  /**
   * Normalizes array of orders
   */
  normalizeOrders(orders) {
    if (!Array.isArray(orders)) return [];
    return orders.map(order => this.normalizeOrder(order)).filter(Boolean);
  }
};

/**
 * Format utilities
 */
const Format = {
  date(dateString) {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (e) {
      console.error('Date formatting error:', e);
      return '-';
    }
  },

  dateTime(dateString) {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      console.error('DateTime formatting error:', e);
      return '-';
    }
  },

  time(seconds) {
    if (!seconds || seconds < 0) return '0s';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    
    return parts.join(' ');
  },

  currency(amount) {
    if (amount === null || amount === undefined) return '-';
    try {
      return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'EUR'
      }).format(amount);
    } catch (e) {
      console.error('Currency formatting error:', e);
      return `€${amount}`;
    }
  },

  percentage(value) {
    if (value === null || value === undefined) return '0%';
    return `${Math.round(value)}%`;
  },

  number(value, decimals = 2) {
    if (value === null || value === undefined) return '-';
    return parseFloat(value).toFixed(decimals);
  }
};

/**
 * Debounce function for performance optimization
 */
function debounce(func, wait = 300) {
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
 * Throttle function for performance optimization
 */
function throttle(func, limit = 100) {
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
 * Loading state manager
 */
const LoadingManager = {
  activeLoaders: new Set(),
  
  start(loaderId) {
    this.activeLoaders.add(loaderId);
    this.updateUI();
  },
  
  stop(loaderId) {
    this.activeLoaders.delete(loaderId);
    this.updateUI();
  },
  
  isLoading(loaderId = null) {
    if (loaderId) return this.activeLoaders.has(loaderId);
    return this.activeLoaders.size > 0;
  },
  
  updateUI() {
    const isLoading = this.activeLoaders.size > 0;
    // Update global loading indicator if it exists
    const globalLoader = document.getElementById('global-loader');
    if (globalLoader) {
      globalLoader.style.display = isLoading ? 'flex' : 'none';
    }
  },
  
  createSkeletonRow(columnCount) {
    const cols = Array(columnCount).fill(0).map(() => 
      '<td><div class="skeleton-loader"></div></td>'
    ).join('');
    return `<tr class="skeleton-row">${cols}</tr>`;
  },
  
  createSkeletonRows(rowCount, columnCount) {
    return Array(rowCount).fill(0).map(() => 
      this.createSkeletonRow(columnCount)
    ).join('');
  }
};

/**
 * Error handler with user-friendly messages
 */
const ErrorHandler = {
  messages: {
    network: 'Network error. Please check your connection and try again.',
    timeout: 'Request timed out. Please try again.',
    unauthorized: 'You are not authorized. Please log in.',
    notFound: 'The requested resource was not found.',
    server: 'Server error. Please try again later.',
    validation: 'Please check your input and try again.',
    unknown: 'An unexpected error occurred. Please try again.'
  },

  handle(error, context = '') {
    console.error(`Error in ${context}:`, error);
    
    let message = this.messages.unknown;
    
    if (error.message?.includes('NetworkError') || error.message?.includes('Failed to fetch')) {
      message = this.messages.network;
    } else if (error.message?.includes('timeout')) {
      message = this.messages.timeout;
    } else if (error.status === 401 || error.status === 403) {
      message = this.messages.unauthorized;
    } else if (error.status === 404) {
      message = this.messages.notFound;
    } else if (error.status >= 500) {
      message = this.messages.server;
    } else if (error.status >= 400 && error.status < 500) {
      message = this.messages.validation;
    } else if (error.message) {
      message = error.message;
    }
    
    return {
      message,
      originalError: error,
      context
    };
  },

  showNotification(error, context = '') {
    const handled = this.handle(error, context);
    if (typeof Notifications !== 'undefined' && Notifications.show) {
      Notifications.show('error', handled.message, 5000);
    } else {
      alert(handled.message);
    }
  }
};

/**
 * Timer manager to prevent memory leaks
 */
const TimerManager = {
  timers: new Map(),
  intervals: new Map(),
  
  setTimeout(id, callback, delay) {
    this.clearTimeout(id);
    const timer = setTimeout(() => {
      callback();
      this.timers.delete(id);
    }, delay);
    this.timers.set(id, timer);
    return timer;
  },
  
  clearTimeout(id) {
    if (this.timers.has(id)) {
      clearTimeout(this.timers.get(id));
      this.timers.delete(id);
    }
  },
  
  setInterval(id, callback, delay) {
    this.clearInterval(id);
    const interval = setInterval(callback, delay);
    this.intervals.set(id, interval);
    return interval;
  },
  
  clearInterval(id) {
    if (this.intervals.has(id)) {
      clearInterval(this.intervals.get(id));
      this.intervals.delete(id);
    }
  },
  
  clearAll() {
    this.timers.forEach(timer => clearTimeout(timer));
    this.intervals.forEach(interval => clearInterval(interval));
    this.timers.clear();
    this.intervals.clear();
  }
};

/**
 * Cache manager with TTL and size limits
 */
const CacheManager = {
  cache: new Map(),
  config: {
    maxSize: 50, // Maximum number of cache entries
    defaultTTL: 5 * 60 * 1000, // 5 minutes default TTL
  },
  
  set(key, value, ttl = this.config.defaultTTL) {
    // Remove oldest entry if cache is full
    if (this.cache.size >= this.config.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    const entry = {
      value,
      timestamp: Date.now(),
      ttl
    };
    
    this.cache.set(key, entry);
    
    // Also store in localStorage for persistence
    try {
      localStorage.setItem(`cache_${key}`, JSON.stringify(entry));
    } catch (e) {
      console.warn('Failed to store in localStorage:', e);
    }
  },
  
  get(key) {
    let entry = this.cache.get(key);
    
    // If not in memory, try localStorage
    if (!entry) {
      try {
        const stored = localStorage.getItem(`cache_${key}`);
        if (stored) {
          entry = JSON.parse(stored);
          this.cache.set(key, entry);
        }
      } catch (e) {
        console.warn('Failed to retrieve from localStorage:', e);
      }
    }
    
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      return null;
    }
    
    return entry.value;
  },
  
  delete(key) {
    this.cache.delete(key);
    try {
      localStorage.removeItem(`cache_${key}`);
    } catch (e) {
      console.warn('Failed to remove from localStorage:', e);
    }
  },
  
  clear() {
    this.cache.clear();
    // Clear all cache items from localStorage
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('cache_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn('Failed to clear localStorage:', e);
    }
  },
  
  has(key) {
    return this.get(key) !== null;
  }
};

/**
 * API retry logic with exponential backoff
 */
const RetryManager = {
  async withRetry(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Don't retry on 4xx errors (client errors)
        if (error.status >= 400 && error.status < 500) {
          throw error;
        }
        
        if (i < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, i); // Exponential backoff
          console.log(`Retry attempt ${i + 1}/${maxRetries} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }
};

/**
 * Validation utilities
 */
const Validator = {
  isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },
  
  isValidDate(date) {
    const d = new Date(date);
    return d instanceof Date && !isNaN(d.getTime());
  },
  
  isPositiveNumber(value) {
    return typeof value === 'number' && value > 0;
  },
  
  isEmpty(value) {
    return value === null || value === undefined || value === '' || 
           (Array.isArray(value) && value.length === 0) ||
           (typeof value === 'object' && Object.keys(value).length === 0);
  },
  
  sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

/**
 * Accessibility utilities
 */
const A11y = {
  /**
   * Announces a message to screen readers
   */
  announce(message, priority = 'polite') {
    let announcer = document.getElementById('a11y-announcer');
    
    if (!announcer) {
      announcer = document.createElement('div');
      announcer.id = 'a11y-announcer';
      announcer.setAttribute('role', 'status');
      announcer.setAttribute('aria-live', priority);
      announcer.setAttribute('aria-atomic', 'true');
      announcer.className = 'sr-only';
      announcer.style.cssText = 'position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden;';
      document.body.appendChild(announcer);
    }
    
    // Clear and set new message
    announcer.textContent = '';
    setTimeout(() => {
      announcer.textContent = message;
    }, 100);
  },
  
  /**
   * Traps focus within an element (useful for modals)
   */
  trapFocus(element) {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    
    const handleKeyDown = (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        } else if (!e.shiftKey && document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
      
      if (e.key === 'Escape') {
        element.dispatchEvent(new CustomEvent('escape'));
      }
    };
    
    element.addEventListener('keydown', handleKeyDown);
    
    // Return cleanup function
    return () => {
      element.removeEventListener('keydown', handleKeyDown);
    };
  },
  
  /**
   * Sets focus to an element with retry
   */
  setFocus(element, retries = 3) {
    if (!element) return;
    
    const attemptFocus = (attempt = 0) => {
      element.focus();
      
      if (document.activeElement !== element && attempt < retries) {
        setTimeout(() => attemptFocus(attempt + 1), 100);
      }
    };
    
    attemptFocus();
  }
};

// Export all utilities
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DataNormalizer,
    Format,
    debounce,
    throttle,
    LoadingManager,
    ErrorHandler,
    TimerManager,
    CacheManager,
    RetryManager,
    Validator,
    A11y
  };
}

