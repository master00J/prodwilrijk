const API = {
  async request(endpoint, options = {}) {
  try {
    console.log('Requesting:', endpoint); // Log the endpoint for debugging
    const response = await fetch(`https://prodwilrijk.be${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error (${endpoint}): ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error.message);
    Notifications.show('error', `Fout bij API-aanroep: ${error.message}`);
    throw error;
  }
  },
  getOrders: () => API.request('/api/admin/orders'),
  getOrderItems: (orderId) => API.request(`/api/orders/${orderId}/items-with-times`),
  getActiveTimeLogs: (orderId = null) => API.request(`/api/timelog/active${orderId ? `?orderId=${orderId}` : ''}`),
  getAllActiveTimeLogs: () => API.request('/api/timelog/active'),
  getEmployees: () => API.request('/api/werknemers'),
  getProductionSteps: () => API.request('/api/production_steps'),
  getHoutStock: () => API.request('/api/hout_stock'),
  updateOrderStatus: (orderId, status) =>
    API.request(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
  updateItemStatus: (itemId, status) =>
    API.request(`/api/order-items/${itemId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  startTimeLog: (payload) =>
    API.request('/api/timelog/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  stopTimeLog: (logId) =>
    API.request(`/api/timelog/${logId}/pause`, { method: 'POST' }),
  updateItemCount: (itemId, afgewerkt_aantal) =>
    API.request(`/api/order-items/${itemId}/afgewerkt-aantal`, {
      method: 'POST',
      body: JSON.stringify({ afgewerkt_aantal }),
    }),
  updateStuklijstLine: (itemId, lineIndex, newData) =>
    API.request(`/api/order-items/${itemId}/stuklijst/${lineIndex}`, {
      method: 'POST',
      body: JSON.stringify(newData),
    }),
};

const AppState = {
  currentOrderId: null,
  activeHoutHalenLogId: null,
  filters: { 
    searchTerm: '', 
    status: 'all',
    activeTab: 'active',
    prepackDivision: null, // Added for prepack division filtering
    sortBy: 'recent'
  },
  currentStuklijst: null,
  houtStock: [],
  isMobile: window.innerWidth < 768,
};

const Elements = {
  cache: new Map(),
  get: (id) => {
    if (!Elements.cache.has(id)) {
      Elements.cache.set(id, document.getElementById(id));
    }
    return Elements.cache.get(id);
  },
};

const Utils = {
  formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('nl-BE');
  },
  formatDateTime(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('nl-BE');
  },
  formatTime(seconds) {
    if (!seconds || seconds < 0) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h > 0 ? `${h}u` : '', m > 0 ? `${m}m` : '', `${s}s`]
      .filter(Boolean)
      .join(' ');
  },
  getProgressBarClass(percentage) {
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-blue-500';
    if (percentage >= 50) return 'bg-indigo-500';
    if (percentage >= 25) return 'bg-yellow-500';
    return 'bg-red-500';
  },
  debounce(fn, ms = 300) {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), ms);
    };
  },
  calculatePiecesPerPlank(plankLength, requiredLength) {
    const sawThickness = 5; // 5 mm
    let count = 0;
    let remaining = plankLength;
    while (remaining >= requiredLength) {
      remaining -= requiredLength;
      remaining -= sawThickness;
      count++;
    }
    return count;
  },
  suggestWoodForStuklijst(stuklijst, stock, itemHoeveelheid) {
    return stuklijst.map(line => {
      const totalRequired = line.aantal * itemHoeveelheid;
      const matchingPlanks = stock.filter(s =>
        s.soort.toLowerCase() === line.houtsoort.toLowerCase() &&
        s.dikte >= line.dikte &&
        s.breedte >= line.breedte
      );
      let best = null;
      for (const plank of matchingPlanks) {
        const perPlank = Utils.calculatePiecesPerPlank(plank.lengte, line.lengte);
        if (perPlank > 0) {
          const planksNeeded = Math.ceil(totalRequired / perPlank);
          if (!best || planksNeeded < best.planksNeeded) {
            best = {
              plank,
              perPlank,
              planksNeeded,
            };
          }
        }
      }
      if (best) {
        return {
          ...line,
          totalRequired,
          suggestion: `Gebruik ${best.planksNeeded}× ${best.plank.soort} plank(en) van ${best.plank.lengte}mm (locatie: ${best.plank.locatie}). Per plank ${best.perPlank} stuks.`,
          locatie: best.plank.locatie,
          plankLengte: best.plank.lengte,
          plankCount: best.planksNeeded,
          perPlank: best.perPlank,
        };
      } else {
        return {
          ...line,
          totalRequired,
          suggestion: 'Geen geschikte plank gevonden in voorraad.',
        };
      }
    });
  },
  getElapsedTime(startTime) {
    return Math.floor(
      luxon.DateTime.now().toSeconds() - luxon.DateTime.fromISO(startTime).toSeconds()
    );
  },
  sortOrders(orders, sortBy) {
    switch (sortBy) {
      case 'deadline':
        return orders.sort((a, b) => {
          if (!a.einddatum) return 1;
          if (!b.einddatum) return -1;
          return new Date(a.einddatum) - new Date(b.einddatum);
        });
      case 'klant':
        return orders.sort((a, b) => a.klant.localeCompare(b.klant));
      case 'recent':
      default:
        return orders.sort((a, b) => {
          if (a.active && !b.active) return -1;
          if (!a.active && b.active) return 1;
          if (a.startdatum && b.startdatum) {
            return new Date(b.startdatum) - new Date(a.startdatum);
          }
          return 0;
        });
    }
  },
  filterOrders(orders, filters) {
    console.log('[Utils.filterOrders] Called with filters:', JSON.parse(JSON.stringify(filters)));
    console.log('[Utils.filterOrders] First few orders received:', orders.slice(0, 3).map(o => ({       order_nummer: o.order_nummer,       prepack: o.prepack,       typeOfPrepack: typeof o.prepack,      division: o.division,       status: o.status,       active: o.active,      typeOfActive: typeof o.active    })));
    
    // Helper function to consistently check if an order is a prepack
    const isPrepackOrder = (order) => {
      return order.prepack === true || 
             order.prepack === 1 || 
             order.prepack === "true" ||
             order.prepack === "1";
    };
    
    let filtered = [...orders]; 

    if (filters.activeTab === 'prepack') {
      console.log('[Utils.filterOrders] Filtering for Prepack tab.');
      // Use helper function to filter prepack orders
      filtered = filtered.filter(isPrepackOrder);
      console.log(`[Utils.filterOrders] After prepack === true filter: ${filtered.length} orders`);
      
      if (filters.prepackDivision) {
        filtered = filtered.filter(order => order.division === filters.prepackDivision);
        console.log(`[Utils.filterOrders] After division === "${filters.prepackDivision}" filter: ${filtered.length} orders`);
      }
      
      if (filters.searchTerm) {
        const searchTerm = filters.searchTerm.toLowerCase();
        filtered = filtered.filter(order => 
          order.order_nummer.toLowerCase().includes(searchTerm) ||
          order.klant.toLowerCase().includes(searchTerm) ||
          (order.beschrijving && order.beschrijving.toLowerCase().includes(searchTerm))
        );
      }
      
      if (filters.status && filters.status !== 'all') {
        filtered = filtered.filter(order => {
            if (filters.status === 'In uitvoering') return order.active === true; 
            else if (filters.status === 'Actieve tijdsregistratie') return Boolean(order.hasActiveTimeLogs) === true;
            return order.status === filters.status;
        });
      }

    } else { // Non-prepack tabs (e.g., 'active', 'completed')
      console.log(`[Utils.filterOrders] Filtering for Non-Prepack tab: ${filters.activeTab}`);
      
      // Log orders that are expected to be prepack but might be slipping through
      orders.forEach(order => {
        if (order.order_nummer === 'PVO25-06132') { // Replace with an actual prepack order_nummer for testing
            console.log('[Utils.filterOrders] Checking specific prepack order (PVO25-06132) in non-prepack tab:', 
                        { prepack: order.prepack, typeOfPrepack: typeof order.prepack, division: order.division });
        }
      });

      // Filter out prepack orders from non-prepack tabs
      filtered = filtered.filter(order => {
        const isNotPrepack = !isPrepackOrder(order);
        
        // Debugging
        if (order.order_nummer === 'PVO25-06132' && !isNotPrepack) {
            console.log('[Utils.filterOrders] Prepack order PVO25-06132 was correctly filtered out from non-prepack tab.');
        } else if (order.order_nummer === 'PVO25-06132' && isNotPrepack) {
            console.warn('[Utils.filterOrders] Prepack order PVO25-06132 was NOT filtered out! order.prepack is:', order.prepack, typeof order.prepack);
        }
        
        return isNotPrepack;
      });
      console.log(`[Utils.filterOrders] After !order.prepack filter (for non-prepack tab ${filters.activeTab}): ${filtered.length} orders`);

      if (filters.activeTab === 'active') {
        filtered = filtered.filter(order => order.status !== 'Afgewerkt');
        console.log(`[Utils.filterOrders] After status !== \'Afgewerkt\' filter (for active tab): ${filtered.length} orders`);
      } else if (filters.activeTab === 'completed') {
        filtered = filtered.filter(order => order.status === 'Afgewerkt');
        console.log(`[Utils.filterOrders] After status === \'Afgewerkt\' filter (for completed tab): ${filtered.length} orders`);
      }

      if (filters.searchTerm) {
        const searchTerm = filters.searchTerm.toLowerCase();
        filtered = filtered.filter(order => {
          return order.order_nummer.toLowerCase().includes(searchTerm) ||
                 order.klant.toLowerCase().includes(searchTerm) ||
                 (order.beschrijving && order.beschrijving.toLowerCase().includes(searchTerm));
        });
      }
      
      if (filters.status && filters.status !== 'all') {
        filtered = filtered.filter(order => {
          if (filters.status === 'In uitvoering') return order.active === true;
          else if (filters.status === 'Actieve tijdsregistratie') return Boolean(order.hasActiveTimeLogs) === true;
          return order.status === filters.status;
        });
      }
    }
    filtered = Utils.sortOrders(filtered, filters.sortBy);
    console.log('[Utils.filterOrders] Final filtered and sorted orders count:', filtered.length);
    return filtered;
  },
  optimizeWoodUsage(stuklijst, stock) {
    const woodGroups = {};
    
    stuklijst.forEach(item => {
      const key = `${item.houtsoort}-${item.dikte}-${item.breedte}`;
      if (!woodGroups[key]) {
        woodGroups[key] = {
          houtsoort: item.houtsoort,
          dikte: item.dikte,
          breedte: item.breedte,
          pieces: []
        };
      }
      
      for (let i = 0; i < item.totalRequired; i++) {
        woodGroups[key].pieces.push({
          length: item.lengte,
          for: `${item.aantal}× ${item.lengte}mm`
        });
      }
    });
    
    const result = {
      totalWaste: 0,
      totalUsed: 0,
      cuts: []
    };
    
    Object.values(woodGroups).forEach(group => {
      const pieces = [...group.pieces].sort((a, b) => b.length - a.length);
      const availablePlanks = stock.filter(plank => 
        plank.soort.toLowerCase() === group.houtsoort.toLowerCase() && 
        plank.dikte >= group.dikte &&
        plank.breedte >= group.breedte
      ).sort((a, b) => a.lengte - b.lengte);
      
      if (availablePlanks.length === 0) return;
      
      const plankCuts = [];
      
      while (pieces.length > 0) {
        const plank = { ...availablePlanks[availablePlanks.length - 1] };
        let remainingLength = plank.lengte;
        const cutPieces = [];
        
        let i = 0;
        while (i < pieces.length) {
          const piece = pieces[i];
          if (piece.length + (cutPieces.length > 0 ? 5 : 0) <= remainingLength) {
            remainingLength -= piece.length + (cutPieces.length > 0 ? 5 : 0);
            cutPieces.push({ ...piece });
            pieces.splice(i, 1);
          } else {
            i++;
          }
        }
        
        plankCuts.push({
          plank: plank,
          cuts: cutPieces,
          remainingLength: remainingLength,
          waste: remainingLength < 100 ? remainingLength : 0,
          reusableLength: remainingLength >= 100 ? remainingLength : 0
        });
        
        result.totalWaste += remainingLength < 100 ? remainingLength : 0;
        result.totalUsed += plank.lengte - remainingLength;
      }
      
      result.cuts.push({
        houtsoort: group.houtsoort,
        dikte: group.dikte, 
        breedte: group.breedte,
        planks: plankCuts
      });
    });
    
    return result;
  },
  createWoodVisualisation(plank, cuts) {
    const container = document.createElement('div');
    container.className = 'mb-4 bg-white p-4 rounded shadow';
    
    const plankInfo = document.createElement('div');
    plankInfo.className = 'mb-2 font-semibold';
    plankInfo.textContent = `${plank.soort} ${plank.dikte}×${plank.breedte}×${plank.lengte}mm - Locatie: ${plank.locatie}`;
    container.appendChild(plankInfo);
    
    const visualContainer = document.createElement('div');
    visualContainer.className = 'relative h-12 bg-gray-200 rounded overflow-hidden my-2';
    const containerWidth = plank.lengte > 3000 ? 600 : 400;
    const scale = containerWidth / plank.lengte;
    visualContainer.style.width = `${containerWidth}px`;
    
    let currentPosition = 0;
    
    cuts.forEach((cut, index) => {
      const piece = document.createElement('div');
      piece.className = 'wood-piece bg-blue-300 absolute top-0 h-full';
      piece.style.left = `${currentPosition * scale}px`;
      piece.style.width = `${cut.length * scale}px`;
      
      const label = document.createElement('div');
      label.className = 'wood-piece-label text-xs';
      label.textContent = `${cut.length}mm`;
      piece.appendChild(label);
      
      visualContainer.appendChild(piece);
      
      currentPosition += cut.length;
      
      if (index < cuts.length - 1) {
        const saw = document.createElement('div');
        saw.className = 'wood-piece bg-red-300 absolute top-0 h-full';
        saw.style.left = `${currentPosition * scale}px`;
        saw.style.width = `${5 * scale}px`;
        visualContainer.appendChild(saw);
        
        currentPosition += 5;
      }
    });
    
    if (plank.lengte - currentPosition > 0) {
      const remainder = document.createElement('div');
      remainder.className = `wood-piece absolute top-0 h-full ${plank.lengte - currentPosition >= 100 ? 'bg-green-300' : 'bg-orange-200'}`;
      remainder.style.left = `${currentPosition * scale}px`;
      remainder.style.width = `${(plank.lengte - currentPosition) * scale}px`;
      
      const label = document.createElement('div');
      label.className = 'wood-piece-label text-xs';
      label.textContent = `${plank.lengte - currentPosition}mm ${plank.lengte - currentPosition >= 100 ? '(herbruikbaar)' : '(afval)'}`;
      remainder.appendChild(label);
      
      visualContainer.appendChild(remainder);
    }
    
    container.appendChild(visualContainer);
    
    const scaleBar = document.createElement('div');
    scaleBar.className = 'scale-bar';
    
    const scaleLabel = document.createElement('div');
    scaleLabel.textContent = '0';
    scaleBar.appendChild(scaleLabel);
    
    const scaleLine = document.createElement('div');
    scaleLine.className = 'scale-line';
    scaleLine.style.width = `${containerWidth}px`;
    scaleBar.appendChild(scaleLine);
    
    const scaleEnd = document.createElement('div');
    scaleEnd.textContent = `${plank.lengte}mm`;
    scaleBar.appendChild(scaleEnd);
    
    container.appendChild(scaleBar);
    
    return container;
  }
};

const Notifications = {
  container: Elements.get('notification-container'),
  show(type, message, duration = 3000) {
    const bgClass = type === 'error'
      ? 'bg-red-500'
      : type === 'warning'
      ? 'bg-yellow-500'
      : type === 'info'
      ? 'bg-blue-500'
      : 'bg-green-500';
    const notification = document.createElement('div');
    notification.className = `mb-4 p-4 rounded-lg shadow-lg transition transform hover:scale-105 ${bgClass} text-white max-w-md`;
    
    const icon = type === 'error' ? 'exclamation-circle' : 
                type === 'warning' ? 'exclamation-triangle' : 
                type === 'info' ? 'info-circle' : 'check-circle';
    
    notification.innerHTML = `
      <div class="flex items-center">
        <i class="fas fa-${icon} mr-3 text-lg"></i>
        <span>${message}</span>
      </div>
    `;
    
    Notifications.container.appendChild(notification);
    setTimeout(() => {
      notification.classList.add('opacity-0', 'transition-opacity', 'duration-500');
      setTimeout(() => notification.remove(), 500);
    }, duration);
  },
};

const CacheManager = {
  cache: {},
  
  async init() {
    try {
      const cachedOrders = localStorage.getItem('cached_orders');
      const cachedStock = localStorage.getItem('cached_stock');

      if (cachedOrders) {
        const parsedOrders = JSON.parse(cachedOrders);
        if (Array.isArray(parsedOrders) && parsedOrders.length > 0) {
          parsedOrders.forEach(order => order.fromCache = true);
          this.cache['cached_orders'] = parsedOrders;
          if (!navigator.onLine) {
            UI.Orders.renderTable(parsedOrders);
            UI.Orders.renderCards(parsedOrders);
            console.log('Orders geladen uit cache');
          }
        } else {
          console.warn('Ongeldige cached orders');
        }
      }

      if (cachedStock) {
        const parsedStock = JSON.parse(cachedStock);
        if (Array.isArray(parsedStock)) {
          this.cache['cached_stock'] = parsedStock;
          AppState.houtStock = parsedStock;
          console.log('Houtvoorraad geladen uit cache');
        } else {
          console.warn('Ongeldige cached stock');
        }
      }
    } catch (error) {
      console.error('Fout bij laden cache:', error);
    }
  },

  updateCache(key, data) {
    try {
      this.cache[key] = data;
      if (data && typeof data === 'object') {
        localStorage.setItem(key, JSON.stringify(data));
      } else {
        console.warn(`Ongeldige data voor caching: ${key}`);
      }
    } catch (error) {
      console.error(`Fout bij caching ${key}:`, error);
    }
    return data;
  },
  
  getCache(key) {
    return this.cache[key] || null;
  }
};

const UI = {
  Modal: {
    show() {
      const modal = Elements.get('order-modal');
      modal.classList.remove('hidden', 'opacity-0', 'pointer-events-none', 'scale-95');
      modal.classList.add('opacity-100');
      document.body.style.overflow = 'hidden';
      modal.focus();
    },
    hide() {
      const modal = Elements.get('order-modal');
      modal.classList.remove('opacity-100');
      modal.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
      document.body.style.overflow = '';
    },
  },
  Orders: {
    async render() {
      try {
        const loader = document.createElement('div');
        loader.id = 'orders-loader';
        loader.className = 'p-8 text-center';
        loader.innerHTML = '<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700 mb-3"></div><p>Orders laden...</p>';
        Elements.get('orders-active-container').prepend(loader);

        // Haal orders op
        let orders = await API.getOrders();
        
        // Verrijk de orders met informatie over actieve timelogs
        // Beschouw alle orders met status 'In uitvoering' als potentieel actief
        orders = orders.map(order => {
          // Beschouw orders met status 'In uitvoering' als having actieve tijdsregistraties
          const hasActiveLogs = order.active === true;
          return {
            ...order,
            hasActiveTimeLogs: hasActiveLogs
          };
        });
        
        // Sla orders op in cache voor later gebruik
        CacheManager.updateCache('cached_orders', orders);

        // Filter en sorteer orders voor weergave
        const filteredOrders = Utils.filterOrders(orders, AppState.filters);
        console.log('Gefilterde orders:', filteredOrders.length);
        const sortedOrders = Utils.sortOrders(filteredOrders, AppState.filters.sortBy);

        // Render de orders zonder actieve tijdsregistraties eerst om snel iets te tonen
        this.renderTable(sortedOrders);
        this.renderCards(sortedOrders);

        loader.remove();
        
        // Laad altijd actieve tijdsregistraties, ongeacht welke filter actief is
        // Dit zorgt ervoor dat het groene punt altijd wordt weergegeven
        this.loadActiveTimelogs();
      } catch (error) {
        Notifications.show('error', 'Fout bij het laden van orders');
        console.error(error);
        const loader = document.getElementById('orders-loader');
        if (loader) loader.remove();
      }
    },
    
    async loadActiveTimelogs() {
      try {
        console.log('Actieve tijdsregistraties laden...');
        // Haal actieve timelogs op
        const allActiveLogs = await API.getAllActiveTimeLogs();
        console.log('Actieve tijdsregistraties:', allActiveLogs);
        
        if (!allActiveLogs) {
          console.warn('Geen actieve tijdsregistraties ontvangen');
          return;
        }
        
        // Helper functie om orderId uit een log te halen
        const extractOrderId = (log) => {
          // Controleer alle mogelijke veldnamen
          if (log.order_id) return log.order_id;
          if (log.orderId) return log.orderId;
          if (log.order) return log.order;
          
          // Als we hier een string hebben, probeer het direct te gebruiken
          if (typeof log === 'string' && !isNaN(parseInt(log))) {
            return parseInt(log);
          }
          
          // Als de log een object_id heeft die een string is met format "order_123"
          if (log.object_id && typeof log.object_id === 'string' && log.object_id.startsWith('order_')) {
            const id = log.object_id.replace('order_', '');
            if (!isNaN(parseInt(id))) return parseInt(id);
          }
          
          return null;
        };
        
        // Creëer een set van order IDs met actieve timelogs
        const ordersWithActiveLogs = new Set();
        try {
          if (Array.isArray(allActiveLogs)) {
            allActiveLogs.forEach(log => {
              const orderId = extractOrderId(log);
              if (orderId) {
                console.log('Order ID gevonden in log:', orderId);
                ordersWithActiveLogs.add(orderId);
              }
            });
          } else if (typeof allActiveLogs === 'object') {
            // Als het een object is met geneste arrays
            Object.keys(allActiveLogs).forEach(key => {
              if (Array.isArray(allActiveLogs[key])) {
                allActiveLogs[key].forEach(log => {
                  const orderId = extractOrderId(log);
                  if (orderId) {
                    console.log('Order ID gevonden in log:', orderId);
                    ordersWithActiveLogs.add(orderId);
                  }
                });
              }
            });
          }
          
          console.log('Orders met actieve tijdsregistraties:', Array.from(ordersWithActiveLogs));
        } catch (e) {
          console.warn("Kon actieve timelogs niet verwerken:", e);
          return;
        }
        
        // Helper functie om te controleren of order actieve logs heeft
        const hasActiveLogs = (order) => {
          if (ordersWithActiveLogs.has(order.id)) return true;
          if (order.order_id && ordersWithActiveLogs.has(order.order_id)) return true;
          if (order.orderId && ordersWithActiveLogs.has(order.orderId)) return true;
          return false;
        };
        
        // Update functie die zowel in-memory cache als localStorage bijwerkt
        const updateOrdersWithActiveLogs = (ordersToUpdate) => {
          if (!Array.isArray(ordersToUpdate) || ordersToUpdate.length === 0) return null;
          
          const updatedOrders = ordersToUpdate.map(order => ({
            ...order,
            hasActiveTimeLogs: hasActiveLogs(order)
          }));
          
          // Update in-memory cache en localStorage
          CacheManager.updateCache('cached_orders', updatedOrders);
          return updatedOrders;
        };
        
        // Werk orders bij met tijdsregistratie info
        try {
          // Probeer eerst de in-memory cache te gebruiken
          let cachedOrders = CacheManager.getCache('cached_orders');
          if (cachedOrders && Array.isArray(cachedOrders) && cachedOrders.length > 0) {
            // Update orders in cache
            const updatedOrders = updateOrdersWithActiveLogs(cachedOrders);
            
            // Rendeer de geupdate orders met behoud van huidige filters
            const filteredOrders = Utils.filterOrders(updatedOrders, AppState.filters);
            const sortedOrders = Utils.sortOrders(filteredOrders, AppState.filters.sortBy);
            
            this.renderTable(sortedOrders);
            this.renderCards(sortedOrders);
            console.log('Orders bijgewerkt met actieve tijdsregistratie info van in-memory cache');
            return;
          }
          
          // Als in-memory cache niet beschikbaar is, probeer localStorage
          let cachedOrdersJson = localStorage.getItem('cached_orders');
          if (cachedOrdersJson) {
            try {
              let orders = JSON.parse(cachedOrdersJson);
              
              // Controleer of orders een array is
              if (Array.isArray(orders) && orders.length) {
                const updatedOrders = updateOrdersWithActiveLogs(orders);
                
                // Rendeer de geupdate orders
                const filteredOrders = Utils.filterOrders(updatedOrders, AppState.filters);
                const sortedOrders = Utils.sortOrders(filteredOrders, AppState.filters.sortBy);
                
                this.renderTable(sortedOrders);
                this.renderCards(sortedOrders);
                console.log('Orders bijgewerkt met actieve tijdsregistratie info van localStorage');
              }
            } catch (e) {
              console.warn('Kon orders uit localStorage niet verwerken:', e);
            }
          } else {
            console.warn('Geen gecachede orders gevonden');
          }
        } catch (error) {
          console.error('Fout bij updaten orders met tijdsregistratie info:', error);
        }
      } catch (error) {
        console.error('Fout bij laden van actieve tijdsregistraties:', error);
      }
    },
    renderTable(orders) {
      const tableId = AppState.filters.activeTab === 'active' || AppState.filters.activeTab === 'prepack' ?
        'orders-active-container' :
        'orders-completed-container';
      const tbody = Elements.get(tableId)?.querySelector('tbody');
      if (!tbody) return;

      if (orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="py-4 text-center text-gray-600">Geen orders gevonden.</td></tr>`;
        return;
      }

      const statusClasses = {
        'Afgewerkt': 'bg-green-500 text-white',
        'In uitvoering': 'bg-blue-500 text-white',
        'Open': 'bg-yellow-500 text-gray-800'
      };

      if (AppState.filters.activeTab === 'active' || AppState.filters.activeTab === 'prepack') {
        tbody.innerHTML = orders.map(order => {
          const displayStatus = order.active ? 'In uitvoering' : order.status;
          const highlightClass = order.hasActiveTimeLogs ? 'bg-blue-100' : (order.active ? 'bg-blue-50' : '');
          const activeIndicator = order.hasActiveTimeLogs 
            ? '<span class="inline-flex items-center mr-2"><span class="animate-ping absolute h-2 w-2 rounded-full bg-green-400 opacity-75"></span><span class="relative rounded-full h-3 w-3 bg-green-500"></span></span>' 
            : '';
          
          // Add prepack badge for prepack items
          const prepackBadge = AppState.filters.activeTab === 'prepack' 
            ? `<span class="px-2 py-1 ml-2 rounded-full bg-purple-100 text-purple-800 text-xs">
                ${order.division || 'Prepack'}
               </span>` 
            : '';
          
          return `
            <tr class="hover:bg-gray-100 transition-colors ${highlightClass}">
              <td class="px-4 py-3">
                <div class="flex items-center">
                  ${activeIndicator}
                  <span>${order.order_nummer}</span>
                  ${prepackBadge}
                </div>
              </td>
              <td class="px-4 py-3 hidden md:table-cell">${order.klant}</td>
              <td class="px-4 py-3 hidden lg:table-cell"><div class="truncate max-w-xs">${order.beschrijving || '-'}</div></td>
              <td class="px-4 py-3 hidden md:table-cell">${Utils.formatDate(order.einddatum)}</td>
              <td class="px-4 py-3">
                <span class="px-2 py-1 rounded-full ${statusClasses[displayStatus] || 'bg-gray-400 text-white'}">
                  ${displayStatus}
                  ${order.hasActiveTimeLogs ? ' <i class="fas fa-user-clock ml-1" title="Actieve tijdsregistratie"></i>' : ''}
                </span>
              </td>
              <td class="px-4 py-3 hidden md:table-cell">
                <div class="flex items-center">
                  <div class="w-full bg-gray-200 rounded-full h-2 mr-2"><div class="h-2 rounded-full ${Utils.getProgressBarClass(order.voortgang)}" style="width: ${order.voortgang || 0}%"></div></div>
                  <span class="text-xs">${order.voortgang || 0}%</span>
                </div>
              </td>
              <td class="px-4 py-3">
                <button class="view-order-details-btn bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg tablet-btn" data-order-id="${order.id}">
                  <i class="fas fa-eye mr-1"></i> Details
                </button>
              </td>
            </tr>
          `;
        }).join('');
      } else {
        tbody.innerHTML = orders.map(order => `
          <tr class="hover:bg-gray-100 transition-colors">
            <td class="px-4 py-3">${order.order_nummer}</td>
            <td class="px-4 py-3 hidden md:table-cell">${order.klant}</td>
            <td class="px-4 py-3 hidden lg:table-cell"><div class="truncate max-w-xs">${order.beschrijving || '-'}</div></td>
            <td class="px-4 py-3 hidden md:table-cell">${Utils.formatDate(order.einddatum)}</td>
            <td class="px-4 py-3 hidden md:table-cell">${Utils.formatTime(order.totale_tijd)}</td>
            <td class="px-4 py-3">
              <button class="view-order-details-btn bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg tablet-btn" data-order-id="${order.id}">
                <i class="fas fa-eye mr-1"></i> Details
              </button>
            </td>
          </tr>
        `).join('');
      }
    },
    renderCards(orders) {
      const containerId = AppState.filters.activeTab === 'active' || AppState.filters.activeTab === 'prepack' ?
        'orders-active-cards' :
        'orders-completed-cards';
      const container = Elements.get(containerId);
      if (!container) return;

      if (orders.length === 0) {
        container.innerHTML = '<div class="bg-white p-4 rounded-lg shadow text-center text-gray-600">Geen orders gevonden.</div>';
        return;
      }

      const statusClasses = {
        'Afgewerkt': 'bg-green-500 text-white',
        'In uitvoering': 'bg-blue-500 text-white',
        'Open': 'bg-yellow-500 text-gray-800'
      };

      if (AppState.filters.activeTab === 'active' || AppState.filters.activeTab === 'prepack') {
        container.innerHTML = orders.map(order => {
          const displayStatus = order.active ? 'In uitvoering' : order.status;
          const highlightClass = order.hasActiveTimeLogs ? 'bg-blue-100' : (order.active ? 'bg-blue-50' : '');
          const activeIndicator = order.hasActiveTimeLogs 
            ? '<div class="relative mr-2"><span class="animate-ping absolute h-2 w-2 rounded-full bg-green-400 opacity-75"></span><span class="relative rounded-full h-3 w-3 bg-green-500"></span></div>' 
            : '';
          
          // Add prepack badge for prepack items
          const prepackBadge = AppState.filters.activeTab === 'prepack' 
            ? `<span class="px-2 py-1 ml-2 rounded-full bg-purple-100 text-purple-800 text-xs">
                ${order.division || 'Prepack'}
               </span>` 
            : '';
          
          return `
            <div class="bg-white rounded-lg shadow p-4 tablet-card ${highlightClass}">
              <div class="flex justify-between items-start mb-3">
                <h3 class="font-bold flex items-center">
                  ${activeIndicator}
                  ${order.order_nummer}
                  ${prepackBadge}
                </h3>
                <span class="px-2 py-1 rounded-full text-sm ${statusClasses[displayStatus] || 'bg-gray-400 text-white'}">
                  ${displayStatus}
                  ${order.hasActiveTimeLogs ? ' <i class="fas fa-user-clock ml-1" title="Actieve tijdsregistratie"></i>' : ''}
                </span>
              </div>
              <p class="text-sm text-gray-600 mb-2">${order.klant}</p>
              <p class="text-sm text-gray-500 mb-3 truncate">${order.beschrijving || '-'}</p>
              <div class="flex justify-between items-center text-sm mb-3">
                <span>Deadline: ${Utils.formatDate(order.einddatum)}</span>
                <span>Voortgang: ${order.voortgang || 0}%</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2 mb-4"><div class="h-2 rounded-full ${Utils.getProgressBarClass(order.voortgang)}" style="width: ${order.voortgang || 0}%"></div></div>
              <button class="view-order-details-btn w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg tablet-btn" data-order-id="${order.id}">
                <i class="fas fa-eye mr-1"></i> Details bekijken
              </button>
            </div>
          `;
        }).join('');
      } else {
        container.innerHTML = orders.map(order => `
          <div class="bg-white rounded-lg shadow p-4 tablet-card">
            <div class="flex justify-between items-start mb-3">
              <h3 class="font-bold">${order.order_nummer}</h3>
              <span class="px-2 py-1 rounded-full text-sm bg-green-500 text-white">Afgewerkt</span>
            </div>
            <p class="text-sm text-gray-600 mb-2">${order.klant}</p>
            <p class="text-sm text-gray-500 mb-3 truncate">${order.beschrijving || '-'}</p>
            <div class="flex justify-between items-center text-sm mb-4">
              <span>Afgewerkt op: ${Utils.formatDate(order.einddatum)}</span>
              <span>Manuren: ${Utils.formatTime(order.totale_tijd)}</span>
            </div>
            <button class="view-order-details-btn w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg tablet-btn" data-order-id="${order.id}">
              <i class="fas fa-eye mr-1"></i> Details bekijken
            </button>
          </div>
        `).join('');
      }
    }
  },
  TimeLogs: {
    render(logs) {
      const container = Elements.get('active-timelogs-list');
      if (!container) return;

      if (!logs || logs.length === 0) {
        container.innerHTML = '<div class="bg-gray-50 p-4 rounded-lg text-center text-gray-500">Geen actieve tijdsregistraties voor deze order.</div>';
        return;
      }

      // Krijg alle items uit de DOM voor directe koppeling
      const itemRows = document.querySelectorAll('#order-items-table tbody tr');
      const itemCards = document.querySelectorAll('#order-items-cards > div');
      
      // Maak een map van alle zichtbare items
      const visibleItems = {};
      
      itemRows.forEach(row => {
        const itemCell = row.querySelector('td:first-child');
        if (itemCell) {
          visibleItems[itemCell.textContent.trim()] = true;
        }
      });
      
      itemCards.forEach(card => {
        const itemName = card.querySelector('h3');
        if (itemName) {
          visibleItems[itemName.textContent.trim()] = true;
        }
      });
      
      // Krijg alle item_id en item_naam van de dropdown
      const itemSelect = Elements.get('item-select');
      const items = {};
      
      if (itemSelect) {
        Array.from(itemSelect.options).forEach(option => {
          if (option.value && option.textContent) {
            items[option.value] = option.textContent;
          }
        });
      }
      
      console.log('Zichtbare items:', Object.keys(visibleItems));
      console.log('Items uit select:', items);
      console.log('Opgeslagen items:', AppState.selectedItems);
      console.log('Logs met itemNaam:', logs.map(log => log.itemNaam));

      container.innerHTML = logs.map(log => {
        // Bepaal item naam
        let itemName = '';
        
        // Nieuw: Check als itemNaam direct in de log aanwezig is
        if (log.itemNaam) {
          itemName = log.itemNaam;
          console.log('Directe itemNaam gevonden in log:', itemName);
        }
        // Prioriteit 0: Gebruik de eerder opgeslagen item-informatie voor deze log
        else if (AppState.selectedItems && log.orderItemId && AppState.selectedItems[log.orderItemId]) {
          itemName = AppState.selectedItems[log.orderItemId];
          console.log('Item naam gevonden in opgeslagen items:', itemName);
        }
        // Prioriteit 1: Probeer directe match met orderItemId
        else if (log.orderItemId && items[log.orderItemId]) {
          itemName = items[log.orderItemId];
        }
        // Prioriteit 2: Kijk naar de globale itemMap voor een match
        else if (window.itemMap && log.orderItemId && window.itemMap[log.orderItemId]) {
          itemName = window.itemMap[log.orderItemId];
        }
        // Prioriteit 3: Probeer alternatieve velden
        else if (window.itemMap) {
          // Probeer elke mogelijke ID-veld
          const possibleIds = [
            log.item_id,
            log.order_item_id
          ];
          
          for (const id of possibleIds) {
            if (id && window.itemMap[id]) {
              itemName = window.itemMap[id];
              break;
            }
          }
        }
        
        // Prioriteit 4: Als er maar één item is, gebruik dat
        if (!itemName && log.type === 'Werk' && Object.keys(visibleItems).length === 1) {
          itemName = Object.keys(visibleItems)[0];
        }
        
        // Prioriteit 5: Als er meerdere items zijn maar geen directe match, 
        // gebruik het eerste item van de dropdown als dat bestaat
        if (!itemName && itemSelect && itemSelect.options.length > 0) {
          // Zoek de eerste niet-lege optie in de dropdown
          for (let i = 0; i < itemSelect.options.length; i++) {
            if (itemSelect.options[i].value && itemSelect.options[i].textContent) {
              itemName = itemSelect.options[i].textContent;
              break;
            }
          }
        }
        
        // Prioriteit 6: Als er nog steeds geen naam is, probeer nog een paar methoden
        if (!itemName) {
          // Probeer een van de zichtbare items te gebruiken
          const visibleItemNames = Object.keys(visibleItems);
          if (visibleItemNames.length > 0) {
            itemName = visibleItemNames[0];
          } 
          // Als laatste redmiddel, gebruik het eerste zichtbare item in de tabel
          else {
            const firstItem = document.querySelector('#order-items-table tbody td:first-child');
            if (firstItem) {
              itemName = firstItem.textContent.trim();
            } else {
              itemName = "Item";
            }
          }
        }
        
        console.log(`Log ${log.id} gebruikt item: ${itemName} (orderItemId: ${log.orderItemId})`);
        
        return `
        <div class="bg-white p-4 rounded-lg shadow mb-4">
          <div class="flex flex-wrap justify-between items-start gap-2">
            <div>
              <div class="flex items-center flex-wrap gap-1">
                <span class="font-semibold">${log.type}</span>
                <span class="ml-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">${log.werknemer}</span>
                <span class="ml-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">${itemName}</span>
              </div>
              <div class="text-sm text-gray-500 mt-1">Start: ${Utils.formatDateTime(log.start_tijd)}</div>
            </div>
            <div class="flex items-center">
              <span class="elapsed-time mr-3 font-mono text-lg" data-start="${log.start_tijd}">${Utils.formatTime(Utils.getElapsedTime(log.start_tijd))}</span>
              <button class="stop-timelog-btn bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg tablet-btn" data-log-id="${log.id}">
                <i class="fas fa-stop mr-1"></i> Stop
              </button>
            </div>
          </div>
        </div>
      `}).join('');
    },
    startTimeUpdate() {
      setInterval(() => {
        document.querySelectorAll('.elapsed-time').forEach(el => {
          const startTime = el.dataset.start;
          el.textContent = Utils.formatTime(Utils.getElapsedTime(startTime));
        });
      }, 1000);
    },
  },
  StuklijstModal: {
    show(stuklijst, stock, itemHoeveelheid, itemId) {
      const modal = Elements.get('stuklijst-modal');
      const container = Elements.get('stuklijst-details');
      container.innerHTML = '';
      document.body.style.overflow = 'hidden';
      modal.dataset.itemId = itemId;

      const headerDiv = document.createElement('div');
      headerDiv.className = 'bg-blue-50 p-4 rounded mb-4';
      headerDiv.innerHTML = `
        <h4 class="font-semibold text-lg mb-2">Totale hoeveelheden voor ${itemHoeveelheid} items</h4>
        <p class="text-sm text-gray-600">Bekijk hieronder de benodigde materialen en hun voorgestelde locaties.</p>
      `;
      container.appendChild(headerDiv);

      const suggested = Utils.suggestWoodForStuklijst(stuklijst, stock, itemHoeveelheid);

      const locationGroups = {};
      suggested.forEach(line => {
        if (line.locatie) {
          if (!locationGroups[line.locatie]) locationGroups[line.locatie] = [];
          locationGroups[line.locatie].push(line);
        }
      });

      if (Object.keys(locationGroups).length > 0) {
        const locationsDiv = document.createElement('div');
        locationsDiv.className = 'bg-green-50 p-4 rounded mb-6';
        locationsDiv.innerHTML = `
          <h4 class="font-semibold mb-3">Opslaglocaties samenvatting:</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${Object.entries(locationGroups).map(([location, items]) => `
              <div class="bg-white p-3 rounded shadow-sm">
                <div class="font-medium">Locatie: ${location}</div>
                <ul class="mt-1 pl-5 list-disc text-sm">
                  ${items.map(item => `<li>${item.plankCount}× ${item.houtsoort} ${item.dikte}×${item.breedte}×${item.plankLengte}mm</li>`).join('')}
                </ul>
              </div>
            `).join('')}
          </div>
        `;
        container.appendChild(locationsDiv);
      }

      suggested.forEach((line, idx) => {
        const div = document.createElement('div');
        div.className = 'p-4 bg-gray-50 rounded mb-4';
        const totalAantal = line.aantal * itemHoeveelheid;
        const checked = line.afgewerkt ? 'checked' : '';

        div.innerHTML = `
          <div class="flex flex-col gap-2 ${line.afgewerkt ? 'opacity-50' : ''}">
            <div class="flex flex-wrap justify-between items-start gap-3">
              <div class="flex-1">
                <div class="text-lg font-medium">${totalAantal}× [${line.dikte}mm × ${line.breedte}mm × ${line.lengte}mm] ${line.houtsoort}</div>
                <span class="text-sm text-gray-600 block mt-1">(${line.aantal} stuks per item × ${itemHoeveelheid} items)</span>
              </div>
              <label class="inline-flex items-center text-sm gap-2">
                <input type="checkbox" data-stuklijst-index="${idx}" class="stuklijst-done-checkbox w-5 h-5" ${checked} ${line.afgewerkt ? 'disabled' : ''}/>
                <span>${line.afgewerkt ? 'Afgewerkt' : 'Markeer als afgewerkt'}</span>
              </label>
            </div>
            <div class="mt-3 bg-white p-4 rounded border border-gray-200 text-sm">
              <div class="font-medium text-gray-700 mb-2">Suggestie:</div>
              <div class="flex items-center mb-2"><i class="fas fa-map-marker-alt text-red-500 mr-2"></i><span>Locatie: <strong>${line.locatie || 'Onbekend'}</strong></span></div>
              <div>${line.suggestion}</div>
            </div>
          </div>
        `;
        container.appendChild(div);
      });

      modal.removeEventListener('click', UI.handleStuklijstCheckboxClick);
      modal.addEventListener('click', UI.handleStuklijstCheckboxClick);
      modal.classList.remove('hidden');
    },
    hide() {
      const modal = Elements.get('stuklijst-modal');
      modal.removeEventListener('click', UI.handleStuklijstCheckboxClick);
      delete modal.dataset.itemId;
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    },
  },
  OrderItems: {
    async render(items) {
      try {
        const loader = document.createElement('div');
        loader.id = 'items-loader';
        loader.className = 'p-8 text-center';
        loader.innerHTML = '<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700 mb-3"></div><p>Items laden...</p>';
        Elements.get('order-items-cards').prepend(loader);

        const stock = await API.getHoutStock();
        AppState.houtStock = stock;

        const tbody = Elements.get('order-items-table')?.querySelector('tbody');
        const cardsContainer = Elements.get('order-items-cards');

        if (!tbody || !cardsContainer) return;

        this.renderTable(items, stock, tbody);
        this.renderCards(items, stock, cardsContainer);

        this.bindEvents(tbody, stock);
        this.bindCardEvents(cardsContainer, stock);

        loader.remove();
      } catch (error) {
        Notifications.show('error', 'Fout bij het laden van items');
        console.error(error);
        const loader = document.getElementById('items-loader');
        if (loader) loader.remove();
      }
    },
    renderTable(items, stock, tbody) {
      tbody.innerHTML = items.map(item => {
        let stuklijstButton = '<em>Geen stuklijst</em>';

        if (Array.isArray(item.stuklijst) && item.stuklijst.length > 0) {
          const firstLine = item.stuklijst[0];
          stuklijstButton = `
            <div class="mb-2"><strong>${firstLine.aantal}× ${firstLine.houtsoort} ${firstLine.dikte}mm × ${firstLine.breedte}mm × ${firstLine.lengte}mm</strong></div>
            <button class="show-stuklijst-btn bg-indigo-500 text-white px-3 py-2 rounded-lg shadow hover:bg-indigo-600 text-sm"
              data-stuklijst='${JSON.stringify(item.stuklijst)}'
              data-item-hoeveelheid='${item.hoeveelheid}'
              data-item-id='${item.item_id}'>
              <i class="fas fa-list-ul mr-1"></i> Toon Stuklijst
            </button>
          `;
        }

        const progressPercentage = item.hoeveelheid > 0 ? 
                                  (item.afgewerkt_aantal / item.hoeveelheid) * 100 : 0;

        return `
          <tr class="hover:bg-gray-50">
            <td class="px-4 py-2">${item.item_naam}</td>
            <td class="px-4 py-2">${item.hoeveelheid}</td>
            <td class="px-4 py-2">
              <div class="flex items-center space-x-2">
                <input type="number" class="w-20 px-3 py-2 border rounded-lg shadow-sm" 
                      value="${item.afgewerkt_aantal || 0}" 
                      min="0" max="${item.hoeveelheid}" 
                      data-item-id="${item.item_id}">
                <button class="update-count-btn bg-gray-600 text-white px-3 py-2 rounded-lg shadow hover:bg-gray-700" 
                        data-item-id="${item.item_id}">
                  <i class="fas fa-save"></i>
                </button>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2 mt-2 overflow-hidden">
                <div class="h-2 rounded-full ${Utils.getProgressBarClass(progressPercentage)}" 
                     style="width: ${progressPercentage}%"></div>
              </div>
            </td>
            <td class="px-4 py-2">${stuklijstButton}</td>
            <td class="px-4 py-2">${UI.OrderItems.getStatusBadge(item.status)}</td>
            <td class="px-4 py-2">
              ${
                item.status !== 'Afgewerkt'
                  ? `<button class="complete-item-btn bg-green-500 text-white px-3 py-2 rounded-lg shadow hover:bg-green-600" data-item-id="${item.item_id}">
                        <i class="fas fa-check mr-1"></i> Markeer als Afgewerkt
                     </button>`
                  : ''
              }
            </td>
          </tr>
        `;
      }).join('');
    },
    renderCards(items, stock, container) {
      container.innerHTML = items.map(item => {
        let stuklijstButton = '<em class="text-gray-500">Geen stuklijst</em>';

        if (Array.isArray(item.stuklijst) && item.stuklijst.length > 0) {
          const firstLine = item.stuklijst[0];
          stuklijstButton = `
            <div class="mb-2 text-sm"><strong>${firstLine.aantal}× ${firstLine.houtsoort} ${firstLine.dikte}×${firstLine.breedte}×${firstLine.lengte}mm</strong></div>
            <button class="show-stuklijst-btn bg-indigo-500 text-white px-3 py-2 rounded-lg shadow hover:bg-indigo-600 text-sm w-full"
              data-stuklijst='${JSON.stringify(item.stuklijst)}'
              data-item-hoeveelheid='${item.hoeveelheid}'
              data-item-id='${item.item_id}'>
              <i class="fas fa-list-ul mr-1"></i> Toon Stuklijst
            </button>
          `;
        }

        const progressPercentage = item.hoeveelheid > 0 ? 
                                  (item.afgewerkt_aantal / item.hoeveelheid) * 100 : 0;

        return `
          <div class="bg-white p-4 rounded-lg shadow mb-4">
            <div class="flex justify-between items-start mb-3">
              <h3 class="font-bold">${item.item_naam}</h3>
              ${UI.OrderItems.getStatusBadge(item.status)}
            </div>
            <div class="flex justify-between text-sm mb-3">
              <span>Hoeveelheid: ${item.hoeveelheid}</span>
              <span>Afgewerkt: ${item.afgewerkt_aantal || 0}</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2 mb-3 overflow-hidden">
              <div class="h-2 rounded-full ${Utils.getProgressBarClass(progressPercentage)}" 
                   style="width: ${progressPercentage}%"></div>
            </div>
            <div class="grid grid-cols-3 gap-2 mb-4">
              <input type="number" class="col-span-2 px-3 py-2 border rounded-lg shadow-sm" 
                     value="${item.afgewerkt_aantal || 0}" 
                     min="0" max="${item.hoeveelheid}" 
                     data-item-id="${item.item_id}">
              <button class="update-count-btn bg-gray-600 text-white px-2 py-2 rounded-lg shadow hover:bg-gray-700" 
                      data-item-id="${item.item_id}">
                <i class="fas fa-save mr-1"></i> Update
              </button>
            </div>
            <div class="border-t pt-3 mb-3">
              <h4 class="font-medium mb-2">Stuklijst:</h4>
              ${stuklijstButton}
            </div>
            ${
              item.status !== 'Afgewerkt'
                ? `<button class="complete-item-btn bg-green-500 text-white px-3 py-2 rounded-lg shadow hover:bg-green-600 w-full mt-3" data-item-id="${item.item_id}">
                      <i class="fas fa-check mr-1"></i> Markeer als Afgewerkt
                   </button>`
                : ''
            }
          </div>
        `;
      }).join('');
    },
    getStatusBadge(status) {
      const colors = {
        'Open': 'bg-yellow-100 text-yellow-800',
        'In uitvoering': 'bg-blue-100 text-blue-800',
        'Afgewerkt': 'bg-green-100 text-green-800'
      };
      return `<span class="px-2 py-1 rounded-full text-sm ${colors[status] || 'bg-gray-100'}">${status}</span>`;
    },
    bindEvents(container, stock) {
  container.addEventListener('click', async e => {
    const completeBtn = e.target.closest('.complete-item-btn');
    const updateBtn = e.target.closest('.update-count-btn');
    const showStuklijstBtn = e.target.closest('.show-stuklijst-btn');

    if (completeBtn) {
      const itemId = completeBtn.dataset.itemId;
      if (confirm('Weet je zeker dat je dit item als afgewerkt wilt markeren?')) {
        await OrderManagement.updateItemStatus(itemId, 'Afgewerkt');
        const items = await API.getOrderItems(AppState.currentOrderId);
        UI.OrderItems.render(items);
        await UI.Orders.render();
      }
    }

    if (updateBtn) {
      const itemId = updateBtn.dataset.itemId;
      const input = container.querySelector(`input[data-item-id="${itemId}"]`);
      const count = parseInt(input.value);
      const maxCount = parseInt(input.max); // This is the `hoeveelheid` value from the HTML

      if (isNaN(count) || count < 0 || count > maxCount) {
        Notifications.show('warning', 'Afgewerkt aantal mag niet hoger zijn dan de totale hoeveelheid (' + maxCount + ') of negatief zijn.');
        return;
      }
      
      // Voorkom dat de knop meerdere keren wordt ingedrukt
      updateBtn.disabled = true;
      
      // Direct de UI bijwerken om betere gebruikersfeedback te geven
      updateBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
      
      try {
        await OrderManagement.updateItemCount(itemId, count);
        // De OrderManagement.updateItemCount functie zorgt nu voor het bijwerken van de UI
      } catch (error) {
        // Alleen in geval van een fout herstellen we de knop hier
        updateBtn.disabled = false;
        updateBtn.innerHTML = `<i class="fas fa-save"></i>`;
      }
    }

    if (showStuklijstBtn) {
      const stuklijst = JSON.parse(showStuklijstBtn.dataset.stuklijst);
      const itemHoeveelheid = parseInt(showStuklijstBtn.dataset.itemHoeveelheid, 10);
      const itemId = showStuklijstBtn.dataset.itemId;
      UI.StuklijstModal.show(stuklijst, stock, itemHoeveelheid, itemId);
    }
  });
    },
    bindCardEvents(container, stock) {
      container.addEventListener('click', async e => {
        const completeBtn = e.target.closest('.complete-item-btn');
        const updateBtn = e.target.closest('.update-count-btn');
        const showStuklijstBtn = e.target.closest('.show-stuklijst-btn');

        if (completeBtn) {
          const itemId = completeBtn.dataset.itemId;
          if (confirm('Weet je zeker dat je dit item als afgewerkt wilt markeren?')) {
            await OrderManagement.updateItemStatus(itemId, 'Afgewerkt');
            const items = await API.getOrderItems(AppState.currentOrderId);
            UI.OrderItems.render(items);
            await UI.Orders.render();
          }
        }

        if (updateBtn) {
          const itemId = updateBtn.dataset.itemId;
          const input = container.querySelector(`input[data-item-id="${itemId}"]`);
          const count = parseInt(input.value);
          const maxCount = parseInt(input.max);

          if (isNaN(count) || count < 0 || count > maxCount) {
            Notifications.show('warning', 'Afgewerkt aantal mag niet hoger zijn dan de totale hoeveelheid (' + maxCount + ') of negatief zijn.');
            return;
          }
          
          // Voorkom dat de knop meerdere keren wordt ingedrukt
          updateBtn.disabled = true;
          
          // Direct de UI bijwerken om betere gebruikersfeedback te geven
          updateBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
          
          try {
            await OrderManagement.updateItemCount(itemId, count);
            // De OrderManagement.updateItemCount functie zorgt nu voor het bijwerken van de UI
          } catch (error) {
            // Alleen in geval van een fout herstellen we de knop hier
            updateBtn.disabled = false;
            updateBtn.innerHTML = `<i class="fas fa-save mr-1"></i> Update`;
          }
        }

        if (showStuklijstBtn) {
          const stuklijst = JSON.parse(showStuklijstBtn.dataset.stuklijst);
          const itemHoeveelheid = parseInt(showStuklijstBtn.dataset.itemHoeveelheid, 10);
          const itemId = showStuklijstBtn.dataset.itemId;
          UI.StuklijstModal.show(stuklijst, stock, itemHoeveelheid, itemId);
        }
      });
    }
  },
  handleStuklijstCheckboxClick(ev) {
    if (!ev.target.classList.contains('stuklijst-done-checkbox')) return;
    const idx = ev.target.dataset.stuklijstIndex;
    const isChecked = ev.target.checked;
    const modal = Elements.get('stuklijst-modal');
    const itemId = modal.dataset.itemId;
    if (!itemId) return;

    const containerDiv = ev.target.closest('div.p-4');
    if (containerDiv) {
      containerDiv.classList.toggle('opacity-50', isChecked);
      const label = containerDiv.querySelector('label span');
      if (label) label.textContent = isChecked ? 'Afgewerkt' : 'Markeer als afgewerkt';
    }

    API.updateStuklijstLine(itemId, idx, { afgewerkt: isChecked })
      .then(async () => {
        Notifications.show('success', `Sub-regel succesvol ${isChecked ? 'afgewerkt' : 'heropend'}`);
        const items = await API.getOrderItems(AppState.currentOrderId);
        UI.OrderItems.render(items);
      })
      .catch(error => {
        console.error('Fout bij updaten sub-regel:', error);
        Notifications.show('error', 'Fout bij updaten van stuklijst');
        setTimeout(() => {
          if (containerDiv) {
            containerDiv.classList.toggle('opacity-50', !isChecked);
            const label = containerDiv.querySelector('label span');
            if (label) label.textContent = !isChecked ? 'Afgewerkt' : 'Markeer als afgewerkt';
          }
          ev.target.checked = !isChecked;
        }, 300);
      });
  },
  updateActiveTab(tabId) {
    const activeTab = Elements.get('tab-active');
    const completedTab = Elements.get('tab-completed');
    const prepackTab = Elements.get('tab-prepack'); // Assuming this ID exists for the Prepack tab
    const prepackDivisionsContainer = Elements.get('prepack-divisions-container'); // Assuming this ID exists

    // Reset all tabs and hide prepack divisions initially
    [activeTab, completedTab, prepackTab].forEach(tab => tab && tab.classList.remove('tab-active'));
    if (prepackDivisionsContainer) prepackDivisionsContainer.classList.add('hidden');
    AppState.filters.prepackDivision = null; // Reset division filter

    if (tabId === 'tab-active') {
      AppState.filters.activeTab = 'active';
      if (activeTab) activeTab.classList.add('tab-active');
    } else if (tabId === 'tab-completed') {
      AppState.filters.activeTab = 'completed';
      if (completedTab) completedTab.classList.add('tab-active');
    } else if (tabId === 'tab-prepack') {
      AppState.filters.activeTab = 'prepack';
      if (prepackTab) prepackTab.classList.add('tab-active');
      if (prepackDivisionsContainer) prepackDivisionsContainer.classList.remove('hidden');
      // Automatically select the first division or clear if no divisions found
      this.renderPrepackDivisionTabs(); // Call to render/update division tabs
      const firstDivisionButton = prepackDivisionsContainer.querySelector('.prepack-sub-tab');
      if (firstDivisionButton) {
        this.updatePrepackDivisionTab(firstDivisionButton.dataset.division);
      } else {
         this.updatePrepackDivisionTab(null); // No divisions, clear filter
      }
    }
    UI.Orders.render(); // Re-render orders based on new tab/filters
  },
  renderPrepackDivisionTabs() {
    const prepackDivisionsContainer = Elements.get('prepack-divisions-container');
    if (!prepackDivisionsContainer) return;

    // Clear existing sub-tabs to prevent duplication if re-rendering
    // prepackDivisionsContainer.innerHTML = ''; // Or selectively remove/update

    // Get unique divisions from prepack orders (or a predefined list)
    // For now, assuming sub-tabs are already in HTML as per timing.html structure
    const divisionButtons = prepackDivisionsContainer.querySelectorAll('.prepack-sub-tab');
    
    let divisions = [];
    if (CacheManager.getCache('cached_orders')) {
        const allOrders = CacheManager.getCache('cached_orders');
        const prepackOrders = allOrders.filter(order => order.prepack === true);
        divisions = [...new Set(prepackOrders.map(order => order.division).filter(Boolean))];
    }
    
    // Show/hide sub-tabs based on available divisions in data
    divisionButtons.forEach(button => {
        const division = button.dataset.division;
        if (divisions.includes(division)) {
            button.classList.remove('hidden');
            button.removeEventListener('click', this.handlePrepackDivisionClick); // Avoid double listeners
            button.addEventListener('click', this.handlePrepackDivisionClick.bind(this));
        } else {
            button.classList.add('hidden');
        }
    });

    // If no specific divisions from orders, ensure all predefined tabs are shown and wired up
    // This part handles the case where sub-tabs are hardcoded in HTML and we want to ensure they are active
    if (divisions.length === 0) {
        divisionButtons.forEach(button => {
            button.classList.remove('hidden'); // Make sure they are visible if we default to showing all
            button.removeEventListener('click', this.handlePrepackDivisionClick); // Avoid double listeners
            button.addEventListener('click', this.handlePrepackDivisionClick.bind(this));
        });
    }

    // If AppState.filters.prepackDivision is already set, highlight the active sub-tab
    if (AppState.filters.prepackDivision) {
        const activeSubTab = prepackDivisionsContainer.querySelector(`.prepack-sub-tab[data-division="${AppState.filters.prepackDivision}"]`);
        if (activeSubTab) {
            divisionButtons.forEach(btn => btn.classList.remove('sub-tab-active'));
            activeSubTab.classList.add('sub-tab-active');
        }
    }
  },
  
  handlePrepackDivisionClick(event) {
    const division = event.target.closest('.prepack-sub-tab').dataset.division;
    this.updatePrepackDivisionTab(division);
  },

  updatePrepackDivisionTab(division) {
    AppState.filters.prepackDivision = division;
    const prepackDivisionsContainer = Elements.get('prepack-divisions-container');
    if (prepackDivisionsContainer) {
        const divisionButtons = prepackDivisionsContainer.querySelectorAll('.prepack-sub-tab');
        divisionButtons.forEach(button => {
            if (button.dataset.division === division) {
                button.classList.add('sub-tab-active');
            } else {
                button.classList.remove('sub-tab-active');
            }
        });
    }
    UI.Orders.render(); // Re-render orders
  },
  WoodOptimization: {
    show(orderId) {
      const modal = Elements.get('cutting-plan-modal');
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';

      const detailsContainer = Elements.get('cutting-plan-details');
      const statsContainer = Elements.get('overall-stats-content');
      const materialsContainer = Elements.get('material-list');
      const locationsContainer = Elements.get('storage-locations');

      detailsContainer.innerHTML = `
        <div class="p-8 text-center">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-700 mb-3"></div>
          <p>Bezig met optimaliseren...</p>
        </div>
      `;

      API.getOrderItems(orderId)
        .then(items => {
          const allStuklijst = [];
          items.forEach(item => {
            if (Array.isArray(item.stuklijst) && item.stuklijst.length > 0) {
              item.stuklijst.forEach(line => {
                allStuklijst.push({
                  ...line,
                  totalRequired: line.aantal * item.hoeveelheid,
                  itemName: item.item_naam
                });
              });
            }
          });

          const solution = Utils.optimizeWoodUsage(allStuklijst, AppState.houtStock);

          statsContainer.innerHTML = `
            <div><div class="text-lg font-semibold text-blue-700 mb-1">${solution.cuts.length} houtsoort(en)</div><div class="text-sm">Totaal aantal planken: ${solution.cuts.reduce((acc, cut) => acc + cut.planks.length, 0)}</div></div>
            <div><div class="text-lg font-semibold text-green-700 mb-1">${Math.round(solution.totalUsed / 10) / 100} meter gebruikt</div><div class="text-sm text-red-600">Afval: ${Math.round(solution.totalWaste / 10) / 100} meter (${Math.round((solution.totalWaste / (solution.totalUsed + solution.totalWaste)) * 100)}%)</div></div>
          `;

          materialsContainer.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              ${solution.cuts.map(cut => `
                <div class="bg-white p-3 rounded shadow-sm"><div class="font-semibold">${cut.houtsoort} ${cut.dikte}×${cut.breedte}mm:</div><div class="mt-1">Benodigde planken: <strong>${cut.planks.length}×</strong></div></div>
              `).join('')}
            </div>
          `;

          const locations = {};
          solution.cuts.forEach(cut => {
            cut.planks.forEach(plank => {
              if (plank.plank.locatie) {
                if (!locations[plank.plank.locatie]) locations[plank.plank.locatie] = [];
                if (!locations[plank.plank.locatie].some(p => 
                  p.soort === plank.plank.soort && 
                  p.dikte === plank.plank.dikte && 
                  p.breedte === plank.plank.breedte && 
                  p.lengte === plank.plank.lengte)) {
                  locations[plank.plank.locatie].push({
                    soort: plank.plank.soort,
                    dikte: plank.plank.dikte,
                    breedte: plank.plank.breedte,
                    lengte: plank.plank.lengte,
                    count: 1
                  });
                } else {
                  const existing = locations[plank.plank.locatie].find(p => 
                    p.soort === plank.plank.soort && 
                    p.dikte === plank.plank.dikte && 
                    p.breedte === plank.plank.breedte &&
                    p.lengte === plank.plank.lengte);
                  if (existing) existing.count++;
                }
              }
            });
          });

          if (Object.keys(locations).length > 0) {
            locationsContainer.innerHTML = Object.entries(locations).map(([location, planks]) => `
              <div class="bg-white p-3 rounded shadow-sm"><div class="font-semibold text-green-700 mb-2"><i class="fas fa-map-marker-alt mr-1"></i> Locatie: ${location}</div><ul class="list-disc pl-5 text-sm">${planks.map(p => `<li>${p.count}× ${p.soort} ${p.dikte}×${p.breedte}×${p.lengte}mm</li>`).join('')}</ul></div>
            `).join('');
          } else {
            locationsContainer.innerHTML = '<div class="bg-gray-50 p-3 rounded text-center text-gray-500">Geen locatie-informatie beschikbaar.</div>';
          }

          // Toon zaagplan visualisatie
          detailsContainer.innerHTML = '';
          solution.cuts.forEach(cut => {
            const groupTitle = document.createElement('h3');
            groupTitle.className = 'font-semibold text-lg mb-3';
            groupTitle.textContent = `${cut.houtsoort} ${cut.dikte}mm × ${cut.breedte}mm`;
            detailsContainer.appendChild(groupTitle);

            cut.planks.forEach(plank => {
              const visual = Utils.createWoodVisualisation(plank.plank, plank.cuts);
              detailsContainer.appendChild(visual);
            });
          });
        })
        .catch(error => {
          console.error('Optimization error:', error);
          detailsContainer.innerHTML = `
            <div class="p-4 bg-red-100 rounded-lg">
              <h4 class="font-bold text-red-700 mb-2">Fout bij optimaliseren:</h4>
              <p>${error.message || 'Onbekende fout'}</p>
              <p class="mt-3 text-sm">De optimalisatie wordt nu client-side uitgevoerd om server crashes te voorkomen.</p>
            </div>`;
          Notifications.show('error', 'Fout bij optimaliseren.');
        })
        .finally(() => {
          // Ensure the loader is removed even if there's an error
          const loader = detailsContainer.querySelector('.animate-spin');
          if (loader) loader.parentElement.remove();
        });
    },
    hide() {
      const modal = Elements.get('cutting-plan-modal');
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  },
  showMobileFilter() {
    const modal = Elements.get('mobile-filter-modal');
    modal.classList.remove('hidden');

    // Kopieer huidige filters naar mobiele inputs
    Elements.get('mobile-search-input').value = AppState.filters.searchTerm;
    Elements.get('mobile-status-filter').value = AppState.filters.status;
    Elements.get('mobile-sort-orders').value = AppState.filters.sortBy;
  },
  hideMobileFilter() {
    const modal = Elements.get('mobile-filter-modal');
    modal.classList.add('hidden');
  },
  applyMobileFilters() {
    AppState.filters.searchTerm = Elements.get('mobile-search-input').value;
    AppState.filters.status = Elements.get('mobile-status-filter').value;
    AppState.filters.sortBy = Elements.get('mobile-sort-orders').value;

    // Synchroniseer met desktop filters
    Elements.get('search-input').value = AppState.filters.searchTerm;
    Elements.get('status-filter').value = AppState.filters.status;
    Elements.get('sort-orders').value = AppState.filters.sortBy;

    UI.Orders.render();
    UI.hideMobileFilter();
  }
};

const TimeLogging = {
  async stopLog(logId) {
    try {
      Notifications.show('info', 'Tijdsregistratie stoppen...', 1000);

      await API.stopTimeLog(logId);
      await this.refreshTimeLogs();
      await UI.Orders.render();

      Notifications.show('success', 'Tijdsregistratie succesvol gestopt');
      return true;
    } catch (error) {
      Notifications.show('error', 'Fout bij stoppen tijdsregistratie');
      console.error('Stop timelog error:', error);
      return false;
    }
  },

  async handleStopClick(logId) {
    const stopButton = document.querySelector(`[data-log-id="${logId}"]`);
    if (stopButton) {
      stopButton.disabled = true;
      stopButton.innerHTML = `
        <div class="flex items-center">
          <div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          <span>Stoppen...</span>
        </div>
      `;

      const success = await this.stopLog(logId);

      if (!success && stopButton) {
        stopButton.disabled = false;
        stopButton.innerHTML = `<i class="fas fa-stop mr-1"></i> Stop`;
      }
    }
  },

  async startLog(type = 'Werk') {
    const form = Elements.get('time-registration-form');
    const startButton = Elements.get('start-time-btn');

    // Haal payload op en valideer
    const payload = EventHandlers.getTimeLogPayload();
    if (!EventHandlers.validateTimeLogPayload(payload)) return;

    try {
      if (startButton) {
        startButton.disabled = true;
        startButton.innerHTML = `
          <div class="flex items-center">
            <div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            <span>Starten...</span>
          </div>
        `;
      }

      // Expliciet het geselecteerde item informatie opslaan voor gebruik bij problemen
      const itemSelect = Elements.get('item-select');
      const selectedItemId = itemSelect.value;
      const selectedItemName = itemSelect.options[itemSelect.selectedIndex]?.textContent || '';
      
      // Log deze informatie expliciet
      console.log("STARTEN MET ITEM:", selectedItemId, selectedItemName);
      
      // Zorg dat de item naam ook in de payload zit
      payload.itemNaam = selectedItemName;
      
      // Expliciet de itemnaam opslaan in de AppState voor latere raadpleging
      if (!AppState.selectedItems) AppState.selectedItems = {};
      AppState.selectedItems[selectedItemId] = selectedItemName;
      
      payload.type = type;

      const response = await API.startTimeLog(payload);
      const newLogId = response.log_id;

      await new Promise(resolve => setTimeout(resolve, 500));

      const allTimeLogs = await API.getAllActiveTimeLogs();
      const currentOrderId = AppState.currentOrderId;
      console.log('[startLog] Raw allTimeLogs:', JSON.stringify(allTimeLogs)); // Log raw data

      // Filter EERST op de huidige order
      let filteredLogs = allTimeLogs.filter(log => {
        if (log.order_id && log.order_id == currentOrderId) return true;
        if (log.orderId && log.orderId == currentOrderId) return true;
        if (log.order && log.order == currentOrderId) return true;
        if (log.object_id && typeof log.object_id === 'string' && log.object_id.startsWith('order_')) {
          const id = log.object_id.replace('order_', '');
          if (!isNaN(parseInt(id)) && parseInt(id) == currentOrderId) return true;
        }
        // Include the new log even if orderId match fails momentarily
        if (log.id === newLogId) return true; 
        return false;
      });

      // MAP DAN om de nieuwe log te verrijken (maakt nieuwe array)
      const orderTimeLogs = filteredLogs.map(log => {
        if (log.id === newLogId) {
          console.log(`[startLog] Verrijken log ${newLogId} in map met ItemID: ${selectedItemId}, Naam: ${selectedItemName}`);
          return {
            ...log,
            orderItemId: selectedItemId, 
            itemNaam: selectedItemName  
          };
        }
        return log; // Geef ongewijzigde log terug
      });
      
      // === Extra controle en toewijzing vóór render ===
      const finalNewLog = orderTimeLogs.find(log => log.id === newLogId);
      if (finalNewLog) {
          if (finalNewLog.orderItemId !== selectedItemId) {
              console.warn(`[startLog] Corrigeren orderItemId voor log ${newLogId} vlak voor render. Was: ${finalNewLog.orderItemId}, Moet zijn: ${selectedItemId}`);
              finalNewLog.orderItemId = selectedItemId;
          }
          if (finalNewLog.itemNaam !== selectedItemName) {
             console.warn(`[startLog] Corrigeren itemNaam voor log ${newLogId} vlak voor render. Was: ${finalNewLog.itemNaam}, Moet zijn: ${selectedItemName}`);
             finalNewLog.itemNaam = selectedItemName;
          }
      } else {
          console.error(`[startLog] Kon nieuwe log ${newLogId} NIET vinden in de *definitieve* lijst voor render!`);
      }
      // ==================================================

      console.log('[startLog] Logs doorgegeven aan render (na extra check):', JSON.stringify(orderTimeLogs));
      UI.TimeLogs.render(orderTimeLogs);

      // form.reset(); // Verwijder deze regel om te voorkomen dat dropdown reset
      if (startButton) {
        startButton.disabled = false;
        startButton.innerHTML = `<i class="fas fa-play mr-2"></i>Start`;
      }

      Notifications.show('success', `${type} tijdsregistratie gestart`);
      return response;
    } catch (error) {
      if (startButton) {
        startButton.disabled = false;
        startButton.innerHTML = `<i class="fas fa-play mr-2"></i>Start`;
      }

      Notifications.show('error', 'Fout bij starten tijdsregistratie');
      throw error;
    }
  },

  async refreshTimeLogs() {
    try {
      const logs = await API.getActiveTimeLogs();
      UI.TimeLogs.render(logs);
      return logs;
    } catch (error) {
      console.error('Kon actieve tijdsregistraties niet ophalen:', error);
      return [];
    }
  }
};

const HoutHalen = {
  async start() {
    const btn = Elements.get('hout-halen-btn');

    if (AppState.activeHoutHalenLogId) {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = `
          <div class="flex items-center">
            <div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            <span>Stoppen...</span>
          </div>
        `;

        await this.stop();
        return;
      }
    }

    try {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = `
          <div class="flex items-center">
            <div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            <span>Starten...</span>
          </div>
        `;
      }

      if (!AppState.currentOrderId) {
        Notifications.show('warning', 'Geen order geselecteerd');
        this.resetButton();
        return;
      }
      
      // Expliciet de item informatie opslaan
      const itemSelect = Elements.get('item-select');
      const selectedItemId = itemSelect.value;
      const selectedItemName = itemSelect.options[itemSelect.selectedIndex]?.textContent || '';
      
      // Log de info
      console.log("HOUT HALEN STARTEN MET ITEM:", selectedItemId, selectedItemName);
      
      // Custom payload maken voor de hout halen tijdsregistratie
      const customPayload = {
        orderId: AppState.currentOrderId,
        orderItemId: selectedItemId,
        itemNaam: selectedItemName,
        productionStepId: Elements.get('production-step-select').value,
        werknemers: Array.from(Elements.get('employee-select').selectedOptions).map(opt => parseInt(opt.value)),
        type: 'Hout Halen'
      };
      
      // Direct de API aanroepen met onze custom payload
      const response = await API.startTimeLog(customPayload);
      AppState.activeHoutHalenLogId = response.log_id;
      const newLogId = response.log_id; // Sla de ID op
      this.updateButton(true);
      
      // Handmatig de UI bijwerken na korte pauze
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Haal ALLE actieve logs op
      const allTimeLogs = await API.getAllActiveTimeLogs();
      const currentOrderId = AppState.currentOrderId;
      console.log('[HoutHalen] Raw allTimeLogs:', JSON.stringify(allTimeLogs)); // Log raw data

      // Filter EERST op de huidige order
      let filteredLogs = allTimeLogs.filter(log => {
        if (log.order_id && log.order_id == currentOrderId) return true;
        if (log.orderId && log.orderId == currentOrderId) return true;
        if (log.order && log.order == currentOrderId) return true;
        if (log.object_id && typeof log.object_id === 'string' && log.object_id.startsWith('order_')) {
          const id = log.object_id.replace('order_', '');
          if (!isNaN(parseInt(id)) && parseInt(id) == currentOrderId) return true;
        }
        // Include the new log even if orderId match fails momentarily
        if (log.id === newLogId) return true;
        return false;
      });

      // MAP DAN om de nieuwe log te verrijken (maakt nieuwe array)
      const orderTimeLogs = filteredLogs.map(log => {
        if (log.id === newLogId) {
          console.log(`[HoutHalen] Verrijken log ${newLogId} in map met ItemID: ${selectedItemId}, Naam: ${selectedItemName}`);
          return {
            ...log,
            orderItemId: selectedItemId, 
            itemNaam: selectedItemName  
          };
        }
        return log; // Geef ongewijzigde log terug
      });
      
      console.log('[HoutHalen] Logs doorgegeven aan render:', JSON.stringify(orderTimeLogs)); // Log processed data
      UI.TimeLogs.render(orderTimeLogs);

      await this.showWoodSuggestions();
    } catch (error) {
      console.error('Fout bij starten hout halen:', error);
      this.resetButton();
    }
  },

  async stop() {
    if (!AppState.activeHoutHalenLogId) return;

    try {
      await TimeLogging.stopLog(AppState.activeHoutHalenLogId);
      AppState.activeHoutHalenLogId = null;
      this.updateButton(false);
    } catch (error) {
      console.error('Fout bij stoppen hout halen:', error);
      this.resetButton();
    }
  },

  updateButton(active) {
    const btn = Elements.get('hout-halen-btn');
    if (!btn) return;

    if (active) {
      btn.innerHTML = `<i class="fas fa-stop mr-2"></i>Stop Hout Halen`;
      btn.classList.remove('bg-yellow-500', 'hover:bg-yellow-600');
      btn.classList.add('bg-red-500', 'hover:bg-red-600');
    } else {
      btn.innerHTML = `<i class="fas fa-truck-loading mr-2"></i>Hout Halen`;
      btn.classList.remove('bg-red-500', 'hover:bg-red-600');
      btn.classList.add('bg-yellow-500', 'hover:bg-yellow-600');
    }

    btn.disabled = false;
  },

  resetButton() {
    const btn = Elements.get('hout-halen-btn');
    if (!btn) return;

    btn.innerHTML = `<i class="fas fa-truck-loading mr-2"></i>Hout Halen`;
    btn.classList.remove('bg-red-500', 'hover:bg-red-600');
    btn.classList.add('bg-yellow-500', 'hover:bg-yellow-600');
    btn.disabled = false;
  },

  updateAvailability() {
    const productionStep = Elements.get('production-step-select');
    const btn = Elements.get('hout-halen-btn');

    if (!productionStep || !btn) return;

    const selectedStep = productionStep.options[productionStep.selectedIndex]?.text || '';
    const isZagen = selectedStep.toLowerCase().includes('zaag') || 
                    selectedStep.toLowerCase().includes('zagen') || 
                    selectedStep.toLowerCase().includes('hout');

    btn.disabled = !isZagen;
    btn.classList.toggle('opacity-50', !isZagen);

    btn.title = isZagen 
      ? "Start tijdsregistratie voor het halen van hout" 
      : "Hout halen is alleen beschikbaar voor zaag-gerelateerde stappen";
  },

  async showWoodSuggestions() {
    try {
      if (!AppState.currentOrderId) return;

      const items = await API.getOrderItems(AppState.currentOrderId);
      const stock = AppState.houtStock;

      const allStuklijst = [];
      items.forEach(item => {
        if (Array.isArray(item.stuklijst) && item.stuklijst.length > 0) {
          const remaining = item.hoeveelheid - (item.afgewerkt_aantal || 0);
          if (remaining <= 0) return;

          item.stuklijst.forEach(line => {
            if (!line.afgewerkt) {
              allStuklijst.push({
                ...line,
                totalRequired: line.aantal * remaining,
                itemName: item.item_naam
              });
            }
          });
        }
      });

      if (allStuklijst.length === 0) {
        Notifications.show('info', 'Geen benodigde materialen gevonden voor de huidige order');
        return;
      }

      const locationGroups = {};
      allStuklijst.forEach(line => {
        const suggested = Utils.suggestWoodForStuklijst([line], stock, 1)[0];
        if (suggested.locatie) {
          if (!locationGroups[suggested.locatie]) locationGroups[suggested.locatie] = [];
          locationGroups[suggested.locatie].push(suggested);
        }
      });

      if (Object.keys(locationGroups).length > 0) {
        const locationSummary = Object.entries(locationGroups)
          .map(([location, items]) => `Locatie ${location}: ${items.length} materialen`)
          .join(', ');
        Notifications.show('success', `Hout halen gestart. Materialen op: ${locationSummary}`, 5000);

        if (confirm("Wil je de benodigde materialen en hun locaties bekijken?")) {
          UI.StuklijstModal.show(allStuklijst, stock, 1, AppState.currentOrderId);
        }
      } else {
        Notifications.show('warning', 'Kon geen geschikte houtlocaties vinden voor de benodigde materialen');
      }
    } catch (error) {
      console.error('Fout bij ophalen houtsuggesties:', error);
    }
  }
};

const OrderManagement = {
  async updateStatus(orderId, status) {
    try {
      Notifications.show('info', 'Order status bijwerken...', 1000);

      await API.updateOrderStatus(orderId, status);
      await UI.Orders.render();
      UI.Modal.hide();

      Notifications.show('success', `Order status bijgewerkt naar ${status}`);
    } catch (error) {
      Notifications.show('error', 'Fout bij bijwerken order status');
      console.error('Order status update error:', error);
    }
  },

  async updateItemStatus(itemId, status) {
    try {
      Notifications.show('info', 'Item status bijwerken...', 1000);

      await API.updateItemStatus(itemId, status);
      const items = await API.getOrderItems(AppState.currentOrderId);
      UI.OrderItems.render(items);
      await UI.Orders.render();

      Notifications.show('success', `Item status bijgewerkt naar ${status}`);
    } catch (error) {
      Notifications.show('error', 'Fout bij bijwerken item status');
      console.error('Item status update error:', error);
    }
  },

  async updateItemCount(itemId, count) {
    try {
      // Bijhouden welke items worden bijgewerkt
      if (!this.updatingItems) this.updatingItems = new Set();
      
      // Controleer of dit item al wordt bijgewerkt
      if (this.updatingItems.has(itemId)) {
        console.log(`Item ${itemId} wordt al bijgewerkt, wacht op voltooiing...`);
        return; // Voorkom dubbele updates voor hetzelfde item
      }
      
      // Markeer dit item als "wordt bijgewerkt"
      this.updatingItems.add(itemId);
      
      // Define loadingElements here, before the API call
      const loadingElements = document.querySelectorAll(`[data-item-id="${itemId}"] button`);
      loadingElements.forEach(el => {
        if (el.tagName === 'BUTTON') {
          el.disabled = true;
          el.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
        }
      });

      await API.updateItemCount(itemId, count);
      
      // Verwijder dit item uit de bijwerk-set
      this.updatingItems.delete(itemId);
      
      // Controleer of er nog items worden bijgewerkt
      const isLastUpdate = this.updatingItems.size === 0;
      
      // Alleen volledig herladen als dit de laatste update is
      if (isLastUpdate) {
        const items = await API.getOrderItems(AppState.currentOrderId);
        UI.OrderItems.render(items);
        await UI.Orders.render();
      } else {
        // Als er nog meer updates zijn, update alleen de weergegeven waarden
        document.querySelectorAll(`input[data-item-id="${itemId}"]`).forEach(input => {
          input.value = count;
        });
        
        // Verwijder de disable status en herstel de knoppen
        loadingElements.forEach(el => {
          if (el.tagName === 'BUTTON') {
            el.disabled = false;
            el.innerHTML = `<i class="fas fa-save"></i>`;
          }
        });
      }

      Notifications.show('success', `Aantal bijgewerkt naar ${count}`);
    } catch (error) {
      // Bij een fout deze ook uit de bijwerk-set verwijderen
      if (this.updatingItems) {
        this.updatingItems.delete(itemId);
      }
      
      Notifications.show('error', 'Fout bij bijwerken aantal');
      console.error('Item count update error:', error);

      // Use the same loadingElements here to reset the buttons
      if (loadingElements) {
        loadingElements.forEach(el => {
          if (el.tagName === 'BUTTON') {
            el.disabled = false;
            el.innerHTML = `<i class="fas fa-save"></i>`;
          }
        });
      }
    }
  }
};

const EventHandlers = {
  async init() {
    console.log("App Initializing...");
    Elements.get('app-loader').classList.remove('hidden');
    
    // Event listeners for main tabs
    const tabActive = Elements.get('tab-active');
    if (tabActive) tabActive.addEventListener('click', () => UI.updateActiveTab('tab-active'));
    
    const tabCompleted = Elements.get('tab-completed');
    if (tabCompleted) tabCompleted.addEventListener('click', () => UI.updateActiveTab('tab-completed'));
    
    const tabPrepack = Elements.get('tab-prepack');
    if (tabPrepack) tabPrepack.addEventListener('click', () => UI.updateActiveTab('tab-prepack'));

    // Event listeners for filters and search
    document.addEventListener('click', this.handleClicks.bind(this));
    document.addEventListener('change', this.handleChanges.bind(this));

    const floatingActionBtn = Elements.get('floating-action-btn');
    if (floatingActionBtn) floatingActionBtn.addEventListener('click', UI.showMobileFilter);
    
    const closeFilterModalBtn = Elements.get('close-filter-modal');
    if (closeFilterModalBtn) closeFilterModalBtn.addEventListener('click', UI.hideMobileFilter);
    
    const applyMobileFiltersBtn = Elements.get('apply-mobile-filters');
    if (applyMobileFiltersBtn) applyMobileFiltersBtn.addEventListener('click', UI.applyMobileFilters);

    // Status filter opties bijwerken
    const statusFilters = document.querySelectorAll('#status-filter, #mobile-status-filter');
    statusFilters.forEach(filter => {
      if (filter) {
        // Voeg de actieve tijdsregistratie optie toe
        const newOption = document.createElement('option');
        newOption.value = 'Actieve tijdsregistratie';
        newOption.textContent = 'Actieve tijdsregistratie';
        
        // Voeg de optie toe na 'In uitvoering'
        const inProgressOption = Array.from(filter.options).find(opt => opt.value === 'In uitvoering');
        if (inProgressOption) {
          filter.insertBefore(newOption, inProgressOption.nextSibling);
        } else {
          filter.appendChild(newOption);
        }
      }
    });

    await Promise.all([UI.Orders.render(), this.loadMasterData()]);
    UI.TimeLogs.startTimeUpdate();

    Elements.get('close-stuklijst-modal').addEventListener('click', () => UI.StuklijstModal.hide());

    document.addEventListener('click', async e => {
      if (e.target.classList.contains('bg-black') && e.target.classList.contains('bg-opacity-50')) {
        Elements.get('cutting-plan-modal').classList.add('hidden');
        document.body.style.overflow = '';
        return;
      }

      if (e.target.id === 'optimize-wood-btn' || e.target.closest('#optimize-wood-btn')) {
        if (!AppState.currentOrderId) {
          Notifications.show('warning', 'Geen order geselecteerd.');
          return;
        }
        UI.WoodOptimization.show(AppState.currentOrderId);
      } else if (e.target.id === 'close-cutting-plan-modal' || e.target.closest('#close-cutting-plan-modal')) {
        UI.WoodOptimization.hide();
      } else if (e.target.id === 'print-cutting-plan') {
        window.print();
      } else if (e.target.id === 'download-cutting-plan') {
        Notifications.show('info', 'Download functionaliteit nog niet geïmplementeerd.');
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        const cuttingPlanModal = Elements.get('cutting-plan-modal');
        const stuklijstModal = Elements.get('stuklijst-modal');
        const orderModal = Elements.get('order-modal');
        const mobileFilterModal = Elements.get('mobile-filter-modal');

        if (!cuttingPlanModal.classList.contains('hidden')) {
          UI.WoodOptimization.hide();
        } else if (!stuklijstModal.classList.contains('hidden')) {
          UI.StuklijstModal.hide();
        } else if (!orderModal.classList.contains('opacity-0')) {
          UI.Modal.hide();
        } else if (!mobileFilterModal.classList.contains('hidden')) {
          UI.hideMobileFilter();
        }
      }
    });

    const checkDeviceType = Utils.debounce(() => {
      AppState.isMobile = window.innerWidth < 768;
      document.body.classList.toggle('tablet-mode', AppState.isMobile);
      UI.Orders.render();
    }, 250);

    window.addEventListener('resize', checkDeviceType);
    checkDeviceType(); // Initial check

    setInterval(async () => {
      if (navigator.onLine) {
        try {
          const response = await fetch('/api/updates-check', {
            headers: { 'Cache-Control': 'no-cache' }
          });
          const data = await response.json();

          if (data.hasUpdates) {
            Notifications.show('info', 'Er zijn nieuwe updates beschikbaar. Herlaad de pagina om ze toe te passen.', 10000);
          }
        } catch (error) {
          console.log('Update check mislukt, mogelijk geen endpoint beschikbaar');
        }
      }
    }, 300000);
  },

  handleClicks(e) {
    const target = e.target;
    if (target.closest('.view-order-details-btn')) {
      const orderId = target.closest('.view-order-details-btn').dataset.orderId;
      this.viewOrder(orderId);
    } else if (target.closest('.stop-timelog-btn')) {
      const logId = target.closest('.stop-timelog-btn').dataset.logId;
      if (logId) TimeLogging.handleStopClick(logId);
    } else if (target.closest('#start-time-btn')) {
      this.startTimeLog();
    } else if (target.closest('#hout-halen-btn')) {
      HoutHalen.start();
    } else if (target.closest('.close-modal')) {
      UI.Modal.hide();
    } else if (target.closest('.complete-order-btn')) {
      const orderId = target.closest('.complete-order-btn').dataset.orderId;
      if (confirm('Weet je zeker dat je deze order als afgewerkt wilt markeren?')) {
        OrderManagement.updateStatus(orderId, 'Afgewerkt');
      }
    }
  },

  handleChanges: Utils.debounce(function(e) {
    const target = e.target;
    if (target.matches('#search-input')) {
      AppState.filters.searchTerm = target.value;
      UI.Orders.render();
    } else if (target.matches('#status-filter') || target.matches('#mobile-status-filter')) {
      AppState.filters.status = target.value;
      const statusFilters = document.querySelectorAll('#status-filter, #mobile-status-filter');
      statusFilters.forEach(filter => {
        if (filter !== target) filter.value = target.value;
      });
      
      UI.Orders.render();
    } else if (target.matches('#sort-orders')) {
      AppState.filters.sortBy = target.value;
      UI.Orders.render();
    } else if (target.matches('#production-step-select')) {
      HoutHalen.updateAvailability();
    }
  }, 300),

  async loadMasterData() {
    try {
      const [employees, steps, stock] = await Promise.all([
        API.getEmployees(),
        API.getProductionSteps(),
        API.getHoutStock()
      ]);

      this.populateSelect('employee-select', employees, 'id', 'naam');
      this.populateSelect('production-step-select', steps, 'id', 'naam');

      AppState.houtStock = stock;
      CacheManager.updateCache('cached_stock', stock);

      return { employees, steps, stock };
    } catch (error) {
      console.error('Fout bij laden van master data:', error);
      Notifications.show('error', 'Kon niet alle benodigde gegevens laden');
      return {};
    }
  },

  getTimeLogPayload() {
    const itemSelect = Elements.get('item-select');
    const selectedItemText = itemSelect.options[itemSelect.selectedIndex]?.textContent || '';
    
    return {
      orderId: AppState.currentOrderId,
      orderItemId: itemSelect.value,
      itemNaam: selectedItemText, // Voeg de itemnaam toe aan de payload
      productionStepId: Elements.get('production-step-select').value,
      werknemers: Array.from(Elements.get('employee-select').selectedOptions).map(opt => parseInt(opt.value)),
      type: 'Werk'
    };
  },

  validateTimeLogPayload(payload) {
    const required = {
      orderItemId: 'Selecteer een item',
      productionStepId: 'Selecteer een productiestap',
      werknemers: 'Selecteer minstens één werknemer'
    };

    for (const [key, message] of Object.entries(required)) {
      if (!payload[key] || (Array.isArray(payload[key]) && payload[key].length === 0)) {
        const fieldMap = {
          orderItemId: 'item-select',
          productionStepId: 'production-step-select',
          werknemers: 'employee-select'
        };

        const field = Elements.get(fieldMap[key]);
        if (field) {
          field.classList.add('border-red-500', 'bg-red-50');
          setTimeout(() => field.classList.remove('border-red-500', 'bg-red-50'), 3000);
        }

        Notifications.show('warning', message);
        return false;
      }
    }

    return true;
  },

  async startTimeLog() {
    const payload = this.getTimeLogPayload();
    if (!this.validateTimeLogPayload(payload)) return;
    try {
      await TimeLogging.startLog('Werk');
      // Haal alleen de tijdsregistraties voor de huidige order op in plaats van alle tijdsregistraties
      const allTimeLogs = await API.getActiveTimeLogs();
      const currentOrderId = AppState.currentOrderId;
      
      // Filter tijdsregistraties voor alleen deze werkorder
      const orderTimeLogs = allTimeLogs.filter(log => {
        // Controleer alle mogelijke veldnamen voor order ID
        if (log.order_id && log.order_id == currentOrderId) return true;
        if (log.orderId && log.orderId == currentOrderId) return true;
        if (log.order && log.order == currentOrderId) return true;
        
        // Als de log een object_id heeft die een string is met format "order_123"
        if (log.object_id && typeof log.object_id === 'string' && log.object_id.startsWith('order_')) {
          const id = log.object_id.replace('order_', '');
          if (!isNaN(parseInt(id)) && parseInt(id) == currentOrderId) return true;
        }
        
        return false;
      });
      
      UI.TimeLogs.render(orderTimeLogs);
    } catch (error) {
      Notifications.show('error', error.message);
    }
  },

  async stopTimeLog(logId) {
    try {
      await TimeLogging.stopLog(logId);
      // Haal alleen de tijdsregistraties voor de huidige order op in plaats van alle tijdsregistraties
      const allTimeLogs = await API.getActiveTimeLogs();
      const currentOrderId = AppState.currentOrderId;
      
      // Filter tijdsregistraties voor alleen deze werkorder
      const orderTimeLogs = allTimeLogs.filter(log => {
        // Controleer alle mogelijke veldnamen voor order ID
        if (log.order_id && log.order_id == currentOrderId) return true;
        if (log.orderId && log.orderId == currentOrderId) return true;
        if (log.order && log.order == currentOrderId) return true;
        
        // Als de log een object_id heeft die een string is met format "order_123"
        if (log.object_id && typeof log.object_id === 'string' && log.object_id.startsWith('order_')) {
          const id = log.object_id.replace('order_', '');
          if (!isNaN(parseInt(id)) && parseInt(id) == currentOrderId) return true;
        }
        
        return false;
      });
      
      UI.TimeLogs.render(orderTimeLogs);
      UI.Orders.render();
    } catch (error) {
      Notifications.show('error', 'Fout bij stoppen tijdsregistratie');
    }
  },

  populateSelect(elementId, items, valueKey, textKey) {
    const select = Elements.get(elementId);
    if (!select) return;

    select.innerHTML = items.map(item => 
      `<option value="${item[valueKey]}">${item[textKey]}</option>`
    ).join('');

    if (AppState.isMobile) {
      select.classList.add('text-base', 'py-3');
    }
  },

  async viewOrder(orderId) {
  if (!orderId || isNaN(orderId)) {
    Notifications.show('warning', 'Ongeldige order ID');
    return;
  }
  AppState.currentOrderId = orderId;

  const loader = document.createElement('div');
  loader.id = 'order-loader';
  loader.className = 'p-8 text-center';
  loader.innerHTML = '<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700 mb-3"></div><p>Order gegevens laden...</p>';
  Elements.get('order-items-cards').prepend(loader);

  try {
    const [items, allTimeLogs] = await Promise.all([
      API.getOrderItems(orderId),
      API.getActiveTimeLogs()
    ]);

    // Filter tijdsregistraties voor alleen deze werkorder
    const orderTimeLogs = allTimeLogs.filter(log => {
      // Controleer alle mogelijke veldnamen voor order ID
      if (log.order_id && log.order_id == orderId) return true;
      if (log.orderId && log.orderId == orderId) return true;
      if (log.order && log.order == orderId) return true;
      
      // Als de log een object_id heeft die een string is met format "order_123"
      if (log.object_id && typeof log.object_id === 'string' && log.object_id.startsWith('order_')) {
        const id = log.object_id.replace('order_', '');
        if (!isNaN(parseInt(id)) && parseInt(id) == orderId) return true;
      }
      
      return false;
    });

    // Creëer een globale itemMap om items makkelijker op te zoeken
    window.itemMap = {};
    items.forEach(item => {
      window.itemMap[item.item_id] = item.item_naam;
    });

    this.populateSelect('item-select', items, 'item_id', 'item_naam');
    UI.TimeLogs.render(orderTimeLogs);
    UI.OrderItems.render(items);
    UI.Modal.show();

    const activeHoutHalenLog = orderTimeLogs.find(log => log.type === 'Hout Halen');
    AppState.activeHoutHalenLogId = activeHoutHalenLog ? activeHoutHalenLog.id : null;
    HoutHalen.updateButton(!!activeHoutHalenLog);

    loader.remove();
  } catch (error) {
    console.error('Fout bij laden order details:', error);
    Notifications.show('error', `Kon order details niet laden: ${error.message}`);
    const loader = document.getElementById('order-loader');
    if (loader) loader.remove();
  }
}
};

// Barcode scanner management
const BarcodeScanner = {
  scanner: null,
  activeStream: null,
  lastDetectedCode: null,
  currentCamera: 'environment', // begin met back camera
  
  init() {
    console.log('BarcodeScanner.init() wordt aangeroepen');
    // Barcode scanner knoppen
    document.getElementById('barcode-scan-btn').addEventListener('click', () => {
      console.log('Barcode scan knop geklikt');
      this.openScannerModal();
    });
    document.getElementById('mobile-barcode-scan-btn').addEventListener('click', () => {
      console.log('Mobiele barcode scan knop geklikt');
      this.openScannerModal();
    });
    document.getElementById('close-barcode-scanner').addEventListener('click', () => this.closeScannerModal());
    document.getElementById('toggle-flash').addEventListener('click', () => this.toggleFlash());
    document.getElementById('switch-camera').addEventListener('click', () => this.switchCamera());
    document.getElementById('submit-order-number').addEventListener('click', () => this.handleManualOrderInput());
    
    // Start QuaggaJS met de camera wanneer de modal opent
    document.getElementById('barcode-scanner-modal').addEventListener('transitionend', (e) => {
      console.log('Modal transitionend event', e);
      if (!e.target.classList.contains('hidden')) {
        this.startScanner();
      }
    });
  },
  
  openScannerModal() {
    console.log('openScannerModal() wordt aangeroepen');
    const modal = document.getElementById('barcode-scanner-modal');
    console.log('Modal element:', modal);
    
    // Toon de modal
    modal.style.display = 'block';
    
    // Start camera direct
    setTimeout(() => {
      modal.classList.remove('hidden');
      this.startScanner();
    }, 100);
  },
  
  closeScannerModal() {
    console.log('closeScannerModal() wordt aangeroepen');
    this.stopScanner();
    
    const modal = document.getElementById('barcode-scanner-modal');
    modal.classList.add('hidden');
    
    // Verberg de modal volledig na transitie
    setTimeout(() => {
      modal.style.display = 'none';
    }, 300);
  },
  
  async startScanner() {
    console.log('startScanner() wordt aangeroepen');
    this.lastDetectedCode = null;
    
    try {
      // Controleer of Quagga geladen is
      if (typeof Quagga === 'undefined') {
        console.error("Quagga is niet gedefinieerd. De bibliotheek is niet correct geladen.");
        document.getElementById('scanner-message').innerHTML = 
          `<span class="text-red-500">Barcode scanner bibliotheek is niet geladen. Ververs de pagina.</span>`;
        return;
      }
      
      // Stop eerst eventuele actieve scanner
      if (Quagga.isRunning) {
        Quagga.stop();
      }
      
      // Controleer camera-toegang
      console.log('Camera toegang aanvragen...');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: this.currentCamera,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
        
        console.log('Camera toegang verkregen');
        this.activeStream = stream;
        
        // Video element direct koppelen aan stream als fallback
        const videoElement = document.getElementById('barcode-scanner-video');
        if (videoElement) {
          videoElement.srcObject = stream;
          await videoElement.play().catch(e => console.error("Video play error:", e));
        }
      } catch (cameraError) {
        console.error("Camera toegangsfout:", cameraError);
        document.getElementById('scanner-message').innerHTML = 
          `<span class="text-red-500">Geen toegang tot camera: ${cameraError.message}</span>`;
        return;
      }
      
      // Configureer QuaggaJS
      console.log('Quagga initialiseren...');
      const config = {
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: document.getElementById('barcode-scanner-video'),
          constraints: {
            facingMode: this.currentCamera,
            width: { min: 640 },
            height: { min: 480 }
          }
        },
        locator: {
          patchSize: "medium",
          halfSample: true
        },
        numOfWorkers: 2, // Verminder aantal workers voor betere prestaties
        frequency: 10,
        decoder: {
          readers: [
            "code_128_reader",
            "ean_reader",
            "ean_8_reader",
            "code_39_reader"
          ]
        },
        locate: true
      };
      
      Quagga.init(config, (err) => {
        if (err) {
          console.error("Quagga initialisatiefout:", err);
          document.getElementById('scanner-message').innerHTML = 
            `<span class="text-red-500">Camera kon niet worden gestart: ${err.message}</span>`;
          return;
        }
        
        console.log('Quagga succesvol geïnitialiseerd, scanner wordt gestart');
        
        // Bind de onDetected handler met de juiste this context
        const boundOnDetected = this.onBarcodeDetected.bind(this);
        Quagga.onDetected(boundOnDetected);
        
        Quagga.start();
        console.log("Barcode scanner gestart");
        
        // Laat camera overlay zien
        document.getElementById('scanner-overlay').style.display = 'flex';
      });
    } catch (error) {
      console.error("Algemene fout bij starten scanner:", error);
      document.getElementById('scanner-message').innerHTML = 
        `<span class="text-red-500">Fout bij opstarten scanner: ${error.message}</span>`;
    }
  },
  
  stopScanner() {
    if (Quagga) {
      Quagga.stop();
    }
    
    // Stop de camera stream
    if (this.activeStream) {
      this.activeStream.getTracks().forEach(track => track.stop());
      this.activeStream = null;
    }
    
    console.log("Barcode scanner gestopt");
  },
  
  onBarcodeDetected(result) {
    // Voorkom dubbele detecties
    const code = result.codeResult.code;
    if (code === this.lastDetectedCode) return;
    
    this.lastDetectedCode = code;
    console.log("Barcode gedetecteerd:", code);
    
    // Speel een geluid af
    this.playBeepSound();
    
    // Toon feedback
    document.getElementById('scanner-message').innerHTML = 
      `<span class="text-green-500">Barcode gedetecteerd: ${code}</span>`;
    
    // Stop scanner en open de juiste order
    setTimeout(() => {
      this.stopScanner();
      this.closeScannerModal();
      this.findAndOpenOrder(code);
    }, 500);
  },
  
  async findAndOpenOrder(orderNumber) {
    try {
      // Toon loading indicator
      Notifications.show('info', `Order zoeken: ${orderNumber}...`);
      
      // Haal alle orders op
      const orders = await API.getOrders();
      
      // Zoek naar de order met het gescande ordernummer
      const order = orders.find(o => o.order_nummer.toString() === orderNumber.toString());
      
      if (order) {
        // Open de order met de App.viewOrder functie
        EventHandlers.viewOrder(order.id);
        Notifications.show('success', `Order gevonden: ${order.order_nummer}`);
      } else {
        Notifications.show('error', `Geen order gevonden met nummer: ${orderNumber}`);
      }
    } catch (error) {
      console.error("Fout bij zoeken naar order:", error);
      Notifications.show('error', `Fout bij zoeken naar order: ${error.message}`);
    }
  },
  
  handleManualOrderInput() {
    const orderNumberInput = document.getElementById('manual-order-number');
    const orderNumber = orderNumberInput.value.trim();
    
    if (orderNumber) {
      this.closeScannerModal();
      this.findAndOpenOrder(orderNumber);
    } else {
      document.getElementById('scanner-message').innerHTML = 
        `<span class="text-red-500">Vul een geldig ordernummer in</span>`;
    }
  },
  
  toggleFlash() {
    if (!this.activeStream) return;
    
    const videoTrack = this.activeStream.getVideoTracks()[0];
    if (!videoTrack) return;
    
    const capabilities = videoTrack.getCapabilities();
    if (!capabilities.torch) {
      document.getElementById('scanner-message').innerHTML = 
        `<span class="text-orange-500">Flitser niet beschikbaar op dit apparaat</span>`;
      return;
    }
    
    const settings = videoTrack.getSettings();
    const torch = !settings.torch;
    
    videoTrack.applyConstraints({
      advanced: [{ torch: torch }]
    }).then(() => {
      document.getElementById('toggle-flash').innerHTML = 
        torch ? 
          '<i class="fas fa-bolt mr-2"></i>Flitser uit' : 
          '<i class="fas fa-bolt mr-2"></i>Flitser aan';
    }).catch(error => {
      console.error("Flitser error:", error);
    });
  },
  
  switchCamera() {
    this.currentCamera = this.currentCamera === 'environment' ? 'user' : 'environment';
    
    // Herstart de scanner met de nieuwe camera
    this.stopScanner();
    setTimeout(() => this.startScanner(), 300);
  },
  
  playBeepSound() {
    // Maak een audioContext en speel een korte piep
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.value = 1000;
    gainNode.gain.value = 0.1;
    
    oscillator.start();
    setTimeout(() => oscillator.stop(), 200);
  }
};

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
try {
  const loader = document.createElement('div');
  loader.id = 'app-loader';
  loader.className = 'fixed inset-0 bg-white bg-opacity-80 z-50 flex items-center justify-center';
  loader.innerHTML = `
    <div class="text-center p-4">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mb-3"></div>
      <p class="text-xl">Werkregistratie laden...</p>
    </div>
  `;
  document.body.insertAdjacentElement('afterbegin', loader);

  await CacheManager.init();
  await EventHandlers.init();

  // Controleer of Quagga geladen is en laad het indien nodig
  if (typeof Quagga === 'undefined') {
    console.log("Quagga bibliotheek laden...");
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/quagga/0.12.1/quagga.min.js';
    script.onload = () => {
      console.log("Quagga bibliotheek geladen, scanner initialiseren");
      BarcodeScanner.init();
    };
    script.onerror = (err) => {
      console.error("Kon Quagga bibliotheek niet laden:", err);
      Notifications.show('error', "Kon barcodescanner niet laden");
    };
    document.head.appendChild(script);
  } else {
    // Als Quagga al geladen is, initialiseer de scanner direct
    BarcodeScanner.init();
  }

  loader.style.opacity = '0';
  setTimeout(() => loader.remove(), 500);
} catch (error) {
  console.error('Initialization error:', error);
  Notifications.show('error', 'Er is een fout opgetreden bij het laden van de applicatie');
  const loader = document.getElementById('app-loader');
  if (loader) loader.remove();
}
});