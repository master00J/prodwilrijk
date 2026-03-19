// ==========================================
// ========== Enhanced API Handler ==========
// ==========================================

/**
 * Enhanced API handler with improved error handling, caching, and retry logic
 */
class APIHandler {
  constructor(baseURL = 'https://prodwilrijk.be') {
    this.baseURL = baseURL;
    this.pendingRequests = new Map();
    this.requestQueue = [];
    this.maxConcurrentRequests = 6;
    this.activeRequests = 0;
  }

  /**
   * Main request method with enhanced features
   */
  async request(endpoint, options = {}) {
    const {
      method = 'GET',
      body = null,
      headers = {},
      cache = true,
      cacheTTL = 5 * 60 * 1000, // 5 minutes
      retry = true,
      loadingId = null,
      ...fetchOptions
    } = options;

    // Create cache key
    const cacheKey = this.createCacheKey(endpoint, options);

    // Check cache for GET requests
    if (method === 'GET' && cache && CacheManager.has(cacheKey)) {
      console.log(`[API] Cache hit for ${endpoint}`);
      return CacheManager.get(cacheKey);
    }

    // Prevent duplicate concurrent requests
    if (this.pendingRequests.has(cacheKey)) {
      console.log(`[API] Reusing pending request for ${endpoint}`);
      return this.pendingRequests.get(cacheKey);
    }

    // Start loading indicator
    if (loadingId) {
      LoadingManager.start(loadingId);
    }

    const requestPromise = this._executeRequest(endpoint, {
      method,
      body,
      headers,
      retry,
      ...fetchOptions
    });

    // Store pending request
    this.pendingRequests.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;

      // Cache successful GET requests
      if (method === 'GET' && cache && result) {
        CacheManager.set(cacheKey, result, cacheTTL);
      }

      // Invalidate related cache on mutations
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        this.invalidateRelatedCache(endpoint);
      }

      return result;
    } catch (error) {
      throw error;
    } finally {
      this.pendingRequests.delete(cacheKey);
      if (loadingId) {
        LoadingManager.stop(loadingId);
      }
    }
  }

  /**
   * Execute the actual request with retry logic
   */
  async _executeRequest(endpoint, options) {
    const { retry, ...fetchOptions } = options;
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;

    const requestFn = async () => {
      console.log(`[API] Request: ${fetchOptions.method || 'GET'} ${url}`);

      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
        body: fetchOptions.body ? JSON.stringify(fetchOptions.body) : undefined,
      });

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        error.status = response.status;
        error.response = response;

        // Try to parse error body
        try {
          const errorData = await response.json();
          error.message = errorData.message || error.message;
          error.data = errorData;
        } catch (e) {
          // Response is not JSON, use status text
        }

        throw error;
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }

      return await response.text();
    };

    // Use retry logic if enabled
    if (retry && typeof RetryManager !== 'undefined') {
      return await RetryManager.withRetry(requestFn, 3, 1000);
    }

    return await requestFn();
  }

  /**
   * Create a cache key from endpoint and options
   */
  createCacheKey(endpoint, options) {
    const method = options.method || 'GET';
    const params = options.params || {};
    const paramsString = Object.keys(params).length > 0 
      ? JSON.stringify(params) 
      : '';
    return `${method}:${endpoint}:${paramsString}`;
  }

  /**
   * Invalidate cache entries related to an endpoint
   */
  invalidateRelatedCache(endpoint) {
    // Extract resource type from endpoint (e.g., '/api/orders/123' -> 'orders')
    const match = endpoint.match(/\/api\/([^\/]+)/);
    if (match) {
      const resource = match[1];
      // Clear all cache entries for this resource
      CacheManager.cache.forEach((_, key) => {
        if (key.includes(resource)) {
          CacheManager.delete(key);
          console.log(`[API] Invalidated cache: ${key}`);
        }
      });
    }
  }

  /**
   * GET request convenience method
   */
  async get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  /**
   * POST request convenience method
   */
  async post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: data,
      cache: false
    });
  }

  /**
   * PUT request convenience method
   */
  async put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: data,
      cache: false
    });
  }

  /**
   * DELETE request convenience method
   */
  async delete(endpoint, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'DELETE',
      cache: false
    });
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    CacheManager.clear();
    console.log('[API] All cache cleared');
  }
}

/**
 * Application-specific API endpoints
 */
class AppAPI extends APIHandler {
  // Orders
  getOrders(options = {}) {
    return this.get('/api/admin/orders', { loadingId: 'orders-list', ...options });
  }

  getOrderDetails(orderId, options = {}) {
    return this.get(`/api/admin/orders/${orderId}`, { loadingId: `order-${orderId}`, ...options });
  }

  getOrderItems(orderId, options = {}) {
    return this.get(`/api/orders/${orderId}/items-with-times`, { ...options });
  }

  updateOrderStatus(orderId, status) {
    return this.put(`/api/orders/${orderId}/status`, { status }, {
      loadingId: `update-order-${orderId}`
    });
  }

  updateOrderPriority(orderId, isPriority) {
    return this.put(`/api/admin/orders/${orderId}/priority`, { priority: isPriority });
  }

  // Items
  updateItemStatus(itemId, status) {
    return this.post(`/api/order-items/${itemId}/status`, { status });
  }

  updateItemCount(itemId, afgewerkt_aantal) {
    return this.post(`/api/order-items/${itemId}/afgewerkt-aantal`, { afgewerkt_aantal });
  }

  updateStuklijstLine(itemId, lineIndex, newData) {
    return this.post(`/api/order-items/${itemId}/stuklijst/${lineIndex}`, newData);
  }

  // Time Logs
  getActiveTimeLogs(orderId = null, options = {}) {
    const endpoint = orderId 
      ? `/api/timelog/active?orderId=${orderId}`
      : '/api/timelog/active';
    return this.get(endpoint, { cache: false, ...options });
  }

  startTimeLog(payload) {
    return this.post('/api/timelog/start', payload, {
      loadingId: 'start-timelog'
    });
  }

  stopTimeLog(logId) {
    return this.post(`/api/timelog/${logId}/pause`, null, {
      loadingId: `stop-timelog-${logId}`
    });
  }

  // Employees
  getEmployees(options = {}) {
    return this.get('/api/werknemers', { cacheTTL: 10 * 60 * 1000, ...options }); // 10 min cache
  }

  // Production Steps
  getProductionSteps(options = {}) {
    return this.get('/api/production_steps', { cacheTTL: 10 * 60 * 1000, ...options }); // 10 min cache
  }

  // Wood Stock
  getHoutStock(options = {}) {
    return this.get('/api/hout_stock', { cacheTTL: 5 * 60 * 1000, ...options }); // 5 min cache
  }

  // Statistics
  getZaagStatistieken(params, options = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.get(`/api/admin/zaag-statistieken?${queryString}`, options);
  }

  // Batch request helper
  async batchRequest(requests) {
    const results = await Promise.allSettled(
      requests.map(req => {
        const { endpoint, method = 'GET', data, options = {} } = req;
        
        if (method === 'GET') {
          return this.get(endpoint, options);
        } else if (method === 'POST') {
          return this.post(endpoint, data, options);
        } else if (method === 'PUT') {
          return this.put(endpoint, data, options);
        } else if (method === 'DELETE') {
          return this.delete(endpoint, options);
        }
      })
    );

    return results.map((result, index) => ({
      ...requests[index],
      status: result.status,
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason : null
    }));
  }
}

// Create singleton instance
const API = new AppAPI();

// Make it available globally
if (typeof window !== 'undefined') {
  window.API = API;
  window.APIHandler = APIHandler;
  window.AppAPI = AppAPI;
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { API, APIHandler, AppAPI };
}

