(() => {
  const params = new URLSearchParams(window.location.search);
  const locationFilter = (params.get('location') || 'all').trim();
  const limit = Number.parseInt(params.get('limit') || '12', 10);
  const includeCompleted = params.get('includeCompleted') === 'true';

  const ordersContainer = document.getElementById('orders-container');
  const emptyState = document.getElementById('empty-state');
  const lastUpdateEl = document.getElementById('last-update');
  const activeLocationEl = document.getElementById('active-location');

  const MAX_RENDERED = Number.isFinite(limit) && limit > 0 ? limit : 12;

  function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('nl-BE', {
      weekday: 'short',
      day: '2-digit',
      month: 'short'
    });
  }

  function formatTime(value) {
    if (!value) return '-';
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds <= 0) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}u ${minutes}m`;
  }

  function renderLocationPills(locations) {
    if (!Array.isArray(locations) || locations.length === 0) {
      return '<span class="location-pill">Geen scherm ingesteld</span>';
    }
    return locations
      .map((loc) => `<span class="location-pill">${loc}</span>`)
      .join('');
  }

  function updateActiveLocation() {
    activeLocationEl.innerHTML = '';
    const values = locationFilter.split(',').map((loc) => loc.trim()).filter(Boolean);
    if (values.length === 0 || values.includes('all')) {
      activeLocationEl.innerHTML = '<span class="location-pill">Alle schermen</span>';
      return;
    }
    activeLocationEl.innerHTML = values.map((loc) => `<span class="location-pill">${loc}</span>`).join('');
  }

  function renderOrders(orders, generatedAt) {
    if (!Array.isArray(orders) || orders.length === 0) {
      emptyState.style.display = 'flex';
      ordersContainer.querySelectorAll('.order-card').forEach((card) => card.remove());
      if (generatedAt) {
        lastUpdateEl.textContent = new Date(generatedAt).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
      }
      return;
    }

    emptyState.style.display = 'none';
    ordersContainer.innerHTML = orders.slice(0, MAX_RENDERED).map((order, idx) => {
      const isPriority = !!order.priority;
      const position = idx + 1;
      const sequence = Number.isFinite(order.production_sequence) ? order.production_sequence : null;
      const status = order.status || 'Onbekend';
      const progress = Number.isFinite(order.progress) ? `${order.progress}%` : '-';
      const duration = formatTime(order.total_seconds);

      return `
        <article class="order-card${isPriority ? ' primary' : ''}">
          <div class="order-header">
            <div class="sequence-badge">
              ${sequence !== null ? `#${sequence}` : `Positie ${position}`}
            </div>
            ${isPriority ? '<div class="priority-badge">PRIO</div>' : ''}
          </div>
          <h2 class="customer">${order.customer || 'Onbekende klant'}</h2>
          <div class="status">${status}</div>
          <div class="description">${order.description || ''}</div>
          <div class="locations">
            ${renderLocationPills(order.narrowcast_locations)}
          </div>
          <div class="meta-line">
            <span>Start: ${formatDate(order.start_date)}</span>
            <span>Einde: ${formatDate(order.end_date)}</span>
          </div>
          <div class="meta-line">
            <span>Order: ${order.order_number || order.order_nummer || order.id}</span>
            <span>Voortgang: ${progress}</span>
          </div>
          <div class="meta-line">
            <span>Totale tijd: ${duration}</span>
            <span>Items: ${order.completed_items || 0}/${order.total_items || 0}</span>
          </div>
        </article>
      `;
    }).join('');

    if (generatedAt) {
      lastUpdateEl.textContent = new Date(generatedAt).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
    } else {
      lastUpdateEl.textContent = new Date().toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
    }
  }

  async function fetchOrders(reason = 'manual') {
    try {
      const query = new URLSearchParams();
      query.set('location', locationFilter || 'all');
      query.set('limit', String(MAX_RENDERED));
      if (includeCompleted) {
        query.set('includeCompleted', 'true');
      }

      const url = `/api/narrowcast/production-orders?${query.toString()}`;
      const response = await fetch(url, { cache: 'no-store' });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      renderOrders(payload.orders || [], payload.generated_at);
    } catch (error) {
      console.error(`[NarrowcastOrders] Error fetching orders (${reason}):`, error);
    }
  }

  function setupSSE() {
    try {
      const source = new EventSource('/api/narrowcast/events');
      const reload = () => fetchOrders('sse');

      source.addEventListener('connected', () => {
        fetchOrders('sse-connected');
      });

      ['production_sequence_changed', 'production_order_updated', 'production_order_priority'].forEach((event) => {
        source.addEventListener(event, reload);
      });

      source.onerror = (err) => {
        console.error('[NarrowcastOrders] SSE error:', err);
        source.close();
        setTimeout(setupSSE, 10000);
      };
    } catch (error) {
      console.error('[NarrowcastOrders] Unable to setup SSE:', error);
    }
  }

  function init() {
    updateActiveLocation();
    fetchOrders('initial');
    setupSSE();
    setInterval(() => fetchOrders('interval'), 60000);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
