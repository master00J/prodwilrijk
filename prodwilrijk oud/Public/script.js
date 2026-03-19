// script.js (ES Module)

// =======================================
// API MODULE
// =======================================
export const API = {
  async request(endpoint, options = {}) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Fout bij API request');
      return data;
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  },
  getOrders: () => API.request('/api/admin/orders'),
  getOrderItems: (orderId) => API.request(`/api/orders/${orderId}/items-with-times`),
  getActiveTimeLogs: () => API.request(`/api/timelog/active?orderId=${AppState.currentOrderId}`),
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

// =======================================
// APP STATE & ELEMENTS
// =======================================
const AppState = {
  currentOrderId: null,
  activeHoutHalenLogId: null,
  filters: { searchTerm: '', status: '' },
  currentStuklijst: null,
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

// =======================================
// UTILS
// =======================================
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
  debounce: (fn, ms = 300) => _.debounce(fn, ms),
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
};

// =======================================
// NOTIFICATIONS
// =======================================
const Notifications = {
  container: Elements.get('notification-container'),
  show(type, message, duration = 3000) {
    const bgClass = type === 'error'
      ? 'bg-red-500'
      : type === 'warning'
      ? 'bg-yellow-500'
      : 'bg-green-500';
    const notification = document.createElement('div');
    notification.className = `mb-4 p-4 rounded shadow transition transform hover:scale-105 ${bgClass} text-white`;
    notification.textContent = message;
    Notifications.container.appendChild(notification);
    setTimeout(() => {
      notification.classList.add('opacity-0', 'transition-opacity', 'duration-500');
      setTimeout(() => notification.remove(), 500);
    }, duration);
  },
};

// =======================================
// UI COMPONENTS
// =======================================
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
        let orders = await API.getOrders();
        const searchTerm = AppState.filters.searchTerm.toLowerCase();
        const statusFilter = AppState.filters.status;
        
        orders = orders.filter(order => {
          const matchesSearch = order.order_nummer.toLowerCase().includes(searchTerm) ||
                                order.klant.toLowerCase().includes(searchTerm) ||
                                (order.beschrijving && order.beschrijving.toLowerCase().includes(searchTerm));
          const matchesStatus = statusFilter ? order.status === statusFilter : true;
          return matchesSearch && matchesStatus;
        });
        
        const tbody = Elements.get('orders-table').querySelector('tbody');
        if (!tbody) return;
        
        if (orders.length === 0) {
          tbody.innerHTML = `<tr>
            <td colspan="9" class="py-4 text-center text-gray-600">Geen orders gevonden.</td>
          </tr>`;
          return;
        }
        
        tbody.innerHTML = orders.map(order => {
          const statusClasses = {
            'Afgewerkt': 'bg-green-500 text-white',
            'In uitvoering': 'bg-blue-500 text-white',
            'Open': 'bg-yellow-500 text-gray-800'
          };
          return `
            <tr class="hover:bg-gray-100 transition-colors">
              <td class="px-4 py-3">${order.order_nummer}</td>
              <td class="px-4 py-3">${order.klant}</td>
              <td class="px-4 py-3">
                <div class="truncate max-w-xs">${order.beschrijving || '-'}</div>
              </td>
              <td class="px-4 py-3">${Utils.formatDate(order.startdatum)}</td>
              <td class="px-4 py-3">${Utils.formatDate(order.einddatum)}</td>
              <td class="px-4 py-3">
                <span class="px-2 py-1 rounded-full ${statusClasses[order.status] || 'bg-gray-400 text-white'}">
                  ${order.status}
                </span>
              </td>
              <td class="px-4 py-3">${Utils.formatTime(order.totale_tijd)}</td>
              <td class="px-4 py-3 overflow-hidden">
  <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
    <div class="h-2 rounded-full ${Utils.getProgressBarClass(order.voortgang)}" style="width: ${order.voortgang || 0}%"></div>
  </div>
</td>
<td class="px-4 py-3">
  <button class="view-order-details-btn bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded relative z-10" data-order-id="${order.id}">
    <i class="fas fa-eye mr-1"></i> Details
  </button>
</td>

              </td>
            </tr>
          `;
        }).join('');
      } catch (error) {
        Notifications.show('error', 'Fout bij het laden van orders');
        console.error(error);
      }
    },
  },
  TimeLogs: {
    render(logs) {
      const container = Elements.get('active-timelogs-list');
      if (!container) return;
      container.innerHTML = logs.map(log => {
        return `
          <div class="bg-white p-4 rounded-lg shadow mb-4">
            <div class="flex justify-between items-start">
              <div>
                <span class="font-semibold">${log.type}</span>
                <span class="text-gray-600">- ${log.werknemer}</span>
                <div class="text-sm text-gray-500">
                  Start: ${Utils.formatDateTime(log.start_tijd)}
                </div>
              </div>
              <button class="stop-timelog-btn bg-red-500 text-white px-3 py-1 rounded" data-log-id="${log.id}">
                Stop
              </button>
            </div>
            <div class="mt-2">
              <span class="elapsed-time" data-start="${log.start_tijd}">
                ${Utils.formatTime(Utils.getElapsedTime(log.start_tijd))}
              </span>
            </div>
          </div>
        `;
      }).join('');
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
      headerDiv.innerHTML = `<h4 class="font-semibold">Totale hoeveelheden voor ${itemHoeveelheid} items</h4>`;
      container.appendChild(headerDiv);
      const suggested = Utils.suggestWoodForStuklijst(stuklijst, stock, itemHoeveelheid);
      suggested.forEach((line, idx) => {
        const div = document.createElement('div');
        div.className = 'p-4 bg-gray-50 rounded mb-4';
        const totalAantal = line.aantal * itemHoeveelheid;
        const checked = line.afgewerkt ? 'checked' : '';
        div.innerHTML = `
          <div class="flex flex-col gap-2 ${line.afgewerkt ? 'opacity-50' : ''}">
            <div class="flex justify-between items-start">
              <div class="flex-1">
                <strong class="text-lg block mb-1">
                  ${totalAantal}× [${line.dikte}mm × ${line.breedte}mm × ${line.lengte}mm] ${line.houtsoort}
                </strong>
                <span class="text-sm text-gray-600">
                  (${line.aantal} stuks per item × ${itemHoeveelheid} items)
                </span>
              </div>
              <label class="inline-flex items-center text-sm gap-2 ml-4">
                <input 
                  type="checkbox" 
                  data-stuklijst-index="${idx}"
                  class="stuklijst-done-checkbox w-5 h-5"
                  ${checked}
                  ${line.afgewerkt ? 'disabled' : ''}
                />
                <span>${line.afgewerkt ? 'Afgewerkt' : 'Markeer als afgewerkt'}</span>
              </label>
            </div>
            <div class="text-sm bg-white p-3 rounded mt-2 border border-gray-200">
              <strong class="text-gray-700">Suggestie:</strong> 
              <span class="text-gray-600">${line.suggestion}</span>
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
      const stock = await API.getHoutStock();
      const tbody = Elements.get('order-items-table')?.querySelector('tbody');
      if (!tbody) return;
      tbody.innerHTML = items.map(item => {
        let stuklijstButton = '<em>Geen stuklijst</em>';
        if (Array.isArray(item.stuklijst) && item.stuklijst.length > 0) {
          const firstLine = item.stuklijst[0];
          stuklijstButton = `
            <div class="mb-2">
              <strong>${firstLine.aantal}× ${firstLine.houtsoort} ${firstLine.dikte}mm × ${firstLine.breedte}mm × ${firstLine.lengte}mm</strong>
            </div>
            <button class="show-stuklijst-btn bg-gray-200 px-2 py-1 rounded text-sm"
              data-stuklijst='${JSON.stringify(item.stuklijst)}'
              data-item-hoeveelheid='${item.hoeveelheid}'
              data-item-id='${item.item_id}'>
              Toon Stuklijst
            </button>
          `;
        }
        return `
          <tr class="hover:bg-gray-50">
            <td class="px-4 py-2">${item.item_naam}</td>
            <td class="px-4 py-2">${item.hoeveelheid}</td>
            <td class="px-4 py-2">
              <div class="flex items-center space-x-2">
                <input type="number" class="w-20 px-2 py-1 border rounded" value="${item.afgewerkt_aantal || 0}" min="0" max="${item.hoeveelheid}" data-item-id="${item.item_id}">
                <button class="update-count-btn bg-gray-500 text-white px-2 py-1 rounded text-sm" data-item-id="${item.item_id}">
                  Update
                </button>
              </div>
            </td>
            <td class="px-4 py-2">${stuklijstButton}</td>
            <td class="px-4 py-2">
              ${UI.OrderItems.getStatusBadge(item.status)}
            </td>
            <td class="px-4 py-2">
              ${
                item.status !== 'Afgewerkt'
                  ? `<button class="complete-item-btn bg-green-500 text-white px-3 py-1 rounded text-sm" data-item-id="${item.item_id}">
                        Markeer als Afgewerkt
                     </button>`
                  : ''
              }
            </td>
          </tr>
        `;
      }).join('');
      this.bindEvents(tbody, stock);
    },
    getStatusBadge(status) {
      const colors = {
        'Open': 'bg-yellow-100 text-yellow-800',
        'In uitvoering': 'bg-blue-100 text-blue-800',
        'Afgewerkt': 'bg-green-100 text-green-800'
      };
      return `<span class="px-2 py-1 rounded-full ${colors[status] || 'bg-gray-100'}">${status}</span>`;
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
          if (isNaN(count) || count < 0 || count > parseInt(input.max)) {
            Notifications.show('warning', 'Voer een geldig aantal in');
            return;
          }
          await OrderManagement.updateItemCount(itemId, count);
          const items = await API.getOrderItems(AppState.currentOrderId);
          UI.OrderItems.render(items);
          await UI.Orders.render();
        }
        if (showStuklijstBtn) {
          const stuklijst = JSON.parse(showStuklijstBtn.dataset.stuklijst);
          const itemHoeveelheid = parseInt(showStuklijstBtn.dataset.itemHoeveelheid, 10);
          const itemId = showStuklijstBtn.dataset.itemId;
          UI.StuklijstModal.show(stuklijst, stock, itemHoeveelheid, itemId);
        }
      });
    },
  },
  // Helper voor stuklijst checkbox events
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
      if (label) {
        label.textContent = isChecked ? 'Afgewerkt' : 'Markeer als afgewerkt';
      }
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
            if (label) {
              label.textContent = !isChecked ? 'Afgewerkt' : 'Markeer als afgewerkt';
            }
          }
          ev.target.checked = !isChecked;
        }, 300);
      });
  },
};

// =======================================
// EVENT HANDLERS
// =======================================
const EventHandlers = {
  async init() {
    document.addEventListener('click', this.handleClicks.bind(this));
    document.addEventListener('change', this.handleChanges.bind(this));
    await Promise.all([UI.Orders.render(), this.loadMasterData()]);
    UI.TimeLogs.startTimeUpdate();
    Elements.get('close-stuklijst-modal').addEventListener('click', () => {
      UI.StuklijstModal.hide();
    });
    document.addEventListener('click', async e => {
      if (
        e.target.classList.contains('bg-black') &&
        e.target.classList.contains('bg-opacity-50')
      ) {
        Elements.get('cutting-plan-modal').classList.add('hidden');
        document.body.style.overflow = '';
        return;
      }
      if (e.target.id === 'optimize-wood-btn') {
        if (!AppState.currentOrderId) {
          Notifications.show('warning', 'Geen order geselecteerd.');
          return;
        }
        const container = Elements.get('cutting-plan-details');
        container.innerHTML = '<div class="p-4 text-center">Bezig met optimaliseren...</div>';
        Elements.get('cutting-plan-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        try {
          const response = await fetch('/api/optimal_cutting_plan?orderId=' + AppState.currentOrderId);
          const data = await response.json();
          container.innerHTML = '';
          if (data.solution) {
            container.innerHTML = '<pre>' + JSON.stringify(data.solution, null, 2) + '</pre>';
          } else {
            container.innerHTML = 'Geen oplossing gevonden.';
          }
        } catch (err) {
          console.error('Optimization error:', err);
          container.innerHTML = `
            <div class="p-4 bg-red-100 rounded">
              <strong>Fout bij optimaliseren:</strong><br>
              ${err.message}
            </div>
          `;
          Notifications.show('error', 'Fout bij optimaliseren.');
        }
      } else if (
        e.target.id === 'close-cutting-plan-modal' ||
        e.target.closest('#close-cutting-plan-modal')
      ) {
        Elements.get('cutting-plan-modal').classList.add('hidden');
        document.body.style.overflow = '';
      }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        const modal = Elements.get('cutting-plan-modal');
        if (!modal.classList.contains('hidden')) {
          modal.classList.add('hidden');
          document.body.style.overflow = '';
        }
      }
    });
  },
  async stopTimeLog(logId) {
    try {
      await TimeLogging.stopLog(logId);
      const timeLogs = await API.getActiveTimeLogs();
      UI.TimeLogs.render(timeLogs);
      UI.Orders.render();
    } catch (error) {
      Notifications.show('error', 'Fout bij stoppen tijdsregistratie');
    }
  },
  async startTimeLog() {
    const payload = this.getTimeLogPayload();
    if (!this.validateTimeLogPayload(payload)) return;
    try {
      await TimeLogging.startLog('Werk');
      const timeLogs = await API.getActiveTimeLogs();
      UI.TimeLogs.render(timeLogs);
    } catch (error) {
      Notifications.show('error', error.message);
    }
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
    } else if (target.matches('#status-filter')) {
      AppState.filters.status = target.value;
      UI.Orders.render();
    } else if (target.matches('#production-step-select')) {
      HoutHalen.updateAvailability();
    }
  }, 300),
  async loadMasterData() {
    const [employees, steps] = await Promise.all([
      API.getEmployees(),
      API.getProductionSteps()
    ]);
    this.populateSelect('employee-select', employees, 'id', 'naam');
    this.populateSelect('production-step-select', steps, 'id', 'naam');
  },
  getTimeLogPayload() {
    return {
      orderId: AppState.currentOrderId,
      orderItemId: Elements.get('item-select').value,
      productionStepId: Elements.get('production-step-select').value,
      werknemers: Array.from(Elements.get('employee-select').selectedOptions).map(opt => parseInt(opt.value)),
      type: 'Werk'
    };
  },
  validateTimeLogPayload(payload) {
    if (!payload.orderItemId || !payload.productionStepId || payload.werknemers.length === 0) {
      Notifications.show('warning', 'Vul alle velden in om tijdsregistratie te starten.');
      return false;
    }
    return true;
  },
  populateSelect(elementId, items, valueKey, textKey) {
    const select = Elements.get(elementId);
    select.innerHTML = items.map(item => `<option value="${item[valueKey]}">${item[textKey]}</option>`).join('');
  },
  async viewOrder(orderId) {
    AppState.currentOrderId = orderId;
    const [items, timeLogs] = await Promise.all([
      API.getOrderItems(orderId),
      API.getActiveTimeLogs()
    ]);
    this.populateSelect('item-select', items, 'item_id', 'item_naam');
    UI.TimeLogs.render(timeLogs);
    UI.OrderItems.render(items);
    UI.Modal.show();
  },
};

// =======================================
// TIME LOGGING
// =======================================
const TimeLogging = {
  async stopLog(logId) {
    try {
      await API.stopTimeLog(logId);
      await this.refreshTimeLogs();
      await UI.Orders.render();
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
      stopButton.textContent = 'Stoppen...';
    }
    const success = await this.stopLog(logId);
    if (!success && stopButton) {
      stopButton.disabled = false;
      stopButton.textContent = 'Stop';
    }
  },
  async startLog(type = 'Werk') {
    const form = Elements.get('time-registration-form');
    const payload = EventHandlers.getTimeLogPayload();
    if (!this.validatePayload(payload)) return;
    try {
      const response = await API.startTimeLog(payload);
      await this.refreshTimeLogs();
      form.reset();
      return response;
    } catch (error) {
      Notifications.show('error', 'Fout bij starten tijdsregistratie');
      throw error;
    }
  },
  validatePayload(payload) {
    const required = {
      orderItemId: 'Selecteer een item',
      productionStepId: 'Selecteer een productiestap',
      werknemers: 'Selecteer minstens één werknemer'
    };
    for (const [key, message] of Object.entries(required)) {
      if (!payload[key] || (Array.isArray(payload[key]) && payload[key].length === 0)) {
        Notifications.show('warning', message);
        return false;
      }
    }
    return true;
  },
  async refreshTimeLogs() {
    const logs = await API.getActiveTimeLogs();
    UI.TimeLogs.render(logs);
    return logs;
  },
};

// =======================================
// HOUT HALEN
// =======================================
const HoutHalen = {
  async start() {
    if (AppState.activeHoutHalenLogId) {
      await this.stop();
      return;
    }
    try {
      const response = await TimeLogging.startLog('Hout Halen');
      AppState.activeHoutHalenLogId = response.log_id;
      this.updateButton(true);
    } catch (error) {
      console.error('Fout bij starten hout halen:', error);
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
    }
  },
  updateButton(active) {
    const btn = Elements.get('hout-halen-btn');
    if (!btn) return;
    btn.textContent = active ? 'Stop Hout Halen' : 'Hout Halen';
    btn.classList.toggle('bg-red-500', active);
    btn.classList.toggle('bg-yellow-500', !active);
  },
  updateAvailability() {
    const productionStep = Elements.get('production-step-select');
    const btn = Elements.get('hout-halen-btn');
    if (!productionStep || !btn) return;
    const selectedStep = productionStep.options[productionStep.selectedIndex]?.text || '';
    const isZagen = selectedStep.toLowerCase().includes('zagen');
    btn.disabled = !isZagen;
    btn.classList.toggle('opacity-50', !isZagen);
  },
};

// =======================================
// ORDER MANAGEMENT
// =======================================
const OrderManagement = {
  async updateStatus(orderId, status) {
    try {
      await API.updateOrderStatus(orderId, status);
      await UI.Orders.render();
      UI.Modal.hide();
      Notifications.show('success', 'Order status bijgewerkt');
    } catch (error) {
      Notifications.show('error', 'Fout bij bijwerken order status');
      throw error;
    }
  },
  async updateItemStatus(itemId, status) {
    try {
      await API.updateItemStatus(itemId, status);
      const items = await API.getOrderItems(AppState.currentOrderId);
      UI.OrderItems.render(items);
      Notifications.show('success', 'Item status bijgewerkt');
    } catch (error) {
      Notifications.show('error', 'Fout bij bijwerken item status');
      throw error;
    }
  },
  async updateItemCount(itemId, count) {
    try {
      await API.updateItemCount(itemId, count);
      const items = await API.getOrderItems(AppState.currentOrderId);
      UI.OrderItems.render(items);
      Notifications.show('success', 'Aantal bijgewerkt');
    } catch (error) {
      Notifications.show('error', 'Fout bij bijwerken aantal');
      throw error;
    }
  },
};

// =======================================
// GLOBALE ERROR HANDLING
// =======================================
window.addEventListener('error', event => {
  console.error('Global error:', event.error);
  Notifications.show('error', 'Er is een onverwachte fout opgetreden');
});

window.addEventListener('unhandledrejection', event => {
  console.error('Unhandled promise rejection:', event.reason);
  Notifications.show('error', 'Er is een onverwachte fout opgetreden');
});

// =======================================
// INITIALIZATION
// =======================================
document.addEventListener('DOMContentLoaded', () => {
  EventHandlers.init().catch(error => {
    console.error('Initialization error:', error);
    Notifications.show('error', 'Er is een fout opgetreden bij het laden van de applicatie');
  });
});
