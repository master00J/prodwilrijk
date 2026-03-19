// wood_consumption.js

// Helperfuncties (als function declarations zodat ze overal beschikbaar zijn)
function calculateVolume(item) {
  return (Number(item.lengte) / 1000) *
         (Number(item.breedte) / 1000) *
         (Number(item.dikte) / 1000) *
         Number(item.aantal);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('nl-NL', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

// Globale variabelen voor Chart.js-instanties en auto-refresh
let consumptionChart = null;
let panelConsumptionChart = null;
let autoRefreshInterval = null;

document.addEventListener('DOMContentLoaded', () => {
  loadFilterSettings();
  populateFilters();
  fetchAndDisplayData();
  setupFilterListeners();
  setupAutoRefreshToggle();

  document.getElementById('fetch-data').addEventListener('click', (e) => {
    e.preventDefault();
    fetchAndDisplayData();
  });
});

// Laad eerder opgeslagen filterwaarden (localStorage)
function loadFilterSettings() {
  const startDate = localStorage.getItem('start-date');
  const endDate = localStorage.getItem('end-date');
  const dikte = localStorage.getItem('dikte');
  const breedte = localStorage.getItem('breedte');
  if (startDate) document.getElementById('start-date').value = startDate;
  if (endDate) document.getElementById('end-date').value = endDate;
  if (dikte) document.getElementById('dikte').value = dikte;
  if (breedte) document.getElementById('breedte').value = breedte;
}

// Voeg change-eventlisteners toe zodat filters automatisch worden opgeslagen
function setupFilterListeners() {
  ['start-date', 'end-date', 'dikte', 'breedte'].forEach(id => {
    document.getElementById(id).addEventListener('change', (e) => {
      localStorage.setItem(id, e.target.value);
    });
  });
}

// Auto-refresh toggle: start of stop automatisch verversen (elke 60 sec)
function setupAutoRefreshToggle() {
  const toggle = document.getElementById('auto-refresh-toggle');
  if (toggle) {
    toggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        autoRefreshInterval = setInterval(fetchAndDisplayData, 60000);
        showToast('Auto-refresh ingeschakeld', 'success');
      } else {
        clearInterval(autoRefreshInterval);
        showToast('Auto-refresh uitgeschakeld', 'info');
      }
      localStorage.setItem('auto-refresh', e.target.checked);
    });
    // Laad de opgeslagen staat
    if (localStorage.getItem('auto-refresh') === 'true') {
      toggle.checked = true;
      autoRefreshInterval = setInterval(fetchAndDisplayData, 60000);
    }
  }
}

// Vul de filterselecties met data uit de API
async function populateFilters() {
  try {
    const dikteResponse = await fetch('/api/diktes');
    const diktes = await dikteResponse.json();
    const dikteSelect = document.getElementById('dikte');
    dikteSelect.innerHTML = '<option value="">Alle</option>';
    diktes.forEach(item => {
      const option = document.createElement('option');
      option.value = item.dikte;
      option.textContent = item.dikte;
      dikteSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error fetching diktes:', error);
    showToast('Fout bij het ophalen van diktes', 'danger');
  }

  try {
    const breedteResponse = await fetch('/api/breedtes');
    const breedtes = await breedteResponse.json();
    const breedteSelect = document.getElementById('breedte');
    breedteSelect.innerHTML = '<option value="">Alle</option>';
    breedtes.forEach(item => {
      const option = document.createElement('option');
      option.value = item.breedte;
      option.textContent = item.breedte;
      breedteSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error fetching breedtes:', error);
    showToast('Fout bij het ophalen van breedtes', 'danger');
  }
}

// Haal verbruiksdata op en scheid deze in hout en plaatmateriaal
async function fetchAndDisplayData() {
  const startDate = document.getElementById('start-date').value;
  const endDate = document.getElementById('end-date').value;
  const dikte = document.getElementById('dikte').value;
  const breedte = document.getElementById('breedte').value;

  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  if (dikte) params.append('dikte', dikte);
  if (breedte) params.append('breedte', breedte);

  document.getElementById('loading-spinner').style.display = 'block';

  try {
    const response = await fetch('/api/wood_consumption?' + params.toString());
    const data = await response.json();
    document.getElementById('loading-spinner').style.display = 'none';

    // Scheid de data in hout (niet OSB/MEP) en plaatmateriaal (OSB of MEP)
    const woodData = data.filter(item => item.soort !== 'OSB' && item.soort !== 'MEP');
    const panelData = data.filter(item => item.soort === 'OSB' || item.soort === 'MEP');

    // Houtverbruik
    if (woodData.length === 0) {
      document.getElementById('summary').innerHTML =
        `<div class="alert alert-info">Geen houtverbruik gevonden voor de geselecteerde periode en filters.</div>`;
      document.querySelector('#consumptionTable tbody').innerHTML = '';
      if (consumptionChart) { consumptionChart.destroy(); consumptionChart = null; }
      document.getElementById('top-six-dimensions').innerHTML = '';
      // Leeg de reorder container
      document.getElementById('reorder-proposal').innerHTML = '';
    } else {
      renderSummary(woodData, 'summary', {
        totalLabel: 'Totaal Houtverbruik',
        avgLabel: 'Gemiddeld Dagelijks Houtverbruik',
        countLabel: 'Totaal Aantal Items'
      });
      renderTable(woodData, '#consumptionTable tbody');
      renderChart(woodData, 'consumptionChart', 'Houtverbruik (m³)', 'rgba(54, 162, 235, 0.6)', 'rgba(54, 162, 235, 1)', false);
      renderTopSix(woodData);
      addTableControls('consumptionTable');
      // Genereer het reorder voorstel (in de aparte tab)
      generateReorderProposal(woodData);
    }

    // Plaatmateriaalverbruik
    if (panelData.length === 0) {
      document.getElementById('panel-summary').innerHTML =
        `<div class="alert alert-info">Geen plaatmateriaal verbruik gevonden voor de geselecteerde periode en filters.</div>`;
      document.querySelector('#panelConsumptionTable tbody').innerHTML = '';
      if (panelConsumptionChart) { panelConsumptionChart.destroy(); panelConsumptionChart = null; }
    } else {
      renderSummary(panelData, 'panel-summary', {
        totalLabel: 'Totaal Plaatmateriaalverbruik',
        avgLabel: 'Gemiddeld Dagelijks Plaatmateriaalverbruik',
        countLabel: 'Totaal Aantal Items'
      });
      renderTable(panelData, '#panelConsumptionTable tbody');
      renderChart(panelData, 'panelConsumptionChart', 'Plaatmateriaalverbruik (m³)', 'rgba(255, 159, 64, 0.6)', 'rgba(255, 159, 64, 1)', true);
      addTableControls('panelConsumptionTable');
    }
  } catch (error) {
    document.getElementById('loading-spinner').style.display = 'none';
    console.error('Error fetching consumption data:', error);
    showToast('Kon het verbruik niet ophalen.', 'danger');
  }
}

// Genereer een samenvatting (cards) in de gegeven container
function renderSummary(data, containerId, config) {
  const totalVolume = data.reduce((sum, item) => sum + calculateVolume(item), 0);
  const uniqueDates = new Set(data.map(item => formatDate(item.date_consumed)));
  const days = uniqueDates.size || 1;
  const averageVolume = totalVolume / days;
  const totalItems = data.reduce((sum, item) => sum + Number(item.aantal), 0);

  const html = `
    <div class="row">
      <div class="col-md-4">
        <div class="card h-100">
          <div class="card-body">
            <h5 class="card-title">${config.totalLabel}</h5>
            <p class="card-text display-6">${totalVolume.toFixed(3)} m³</p>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card h-100">
          <div class="card-body">
            <h5 class="card-title">${config.avgLabel}</h5>
            <p class="card-text display-6">${averageVolume.toFixed(3)} m³</p>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card h-100">
          <div class="card-body">
            <h5 class="card-title">${config.countLabel}</h5>
            <p class="card-text display-6">${totalItems}</p>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById(containerId).innerHTML = html;
}

// Vul een tabel met data; tableBodySelector moet verwijzen naar de tbody
function renderTable(data, tableBodySelector) {
  const tbody = document.querySelector(tableBodySelector);
  tbody.innerHTML = data
    .map(item => {
      const volume = calculateVolume(item);
      return `
        <tr>
          <td>${formatDate(item.date_consumed)}</td>
          <td>${item.soort}</td>
          <td>${item.lengte}</td>
          <td>${item.dikte}</td>
          <td>${item.breedte}</td>
          <td>${item.aantal}</td>
          <td>${volume.toFixed(3)} m³</td>
        </tr>
      `;
    })
    .join('');
}

// Maak een grafiek met Chart.js en voeg een onClick-event toe voor drill-down
function renderChart(data, canvasId, datasetLabel, bgColor, borderColor, isPanel) {
  const consumptionByDate = {};
  data.forEach(item => {
    const dateKey = formatDate(item.date_consumed);
    const volume = calculateVolume(item);
    consumptionByDate[dateKey] = (consumptionByDate[dateKey] || 0) + volume;
  });
  const sortedDates = Object.keys(consumptionByDate).sort((a, b) => new Date(a) - new Date(b));
  const volumes = sortedDates.map(date => consumptionByDate[date]);

  const ctx = document.getElementById(canvasId).getContext('2d');
  const onClickHandler = (evt, elements) => {
    if (elements.length > 0) {
      const index = elements[0].index;
      const dateClicked = sortedDates[index];
      drillDownChart(dateClicked, data);
    }
  };

  const chartConfig = {
    type: 'bar',
    data: {
      labels: sortedDates,
      datasets: [{
        label: datasetLabel,
        data: volumes,
        backgroundColor: bgColor,
        borderColor: borderColor,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onClick: onClickHandler,
      scales: {
        x: {
          grid: { display: false },
          ticks: { autoSkip: true, maxTicksLimit: 10, color: '#6c757d' }
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#6c757d' },
          grid: { color: 'rgba(0, 0, 0, 0.05)' }
        }
      },
      plugins: {
        tooltip: { mode: 'index', intersect: false },
        legend: { display: true, position: 'top' }
      }
    }
  };

  if (!isPanel) {
    if (consumptionChart) consumptionChart.destroy();
    consumptionChart = new Chart(ctx, chartConfig);
  } else {
    if (panelConsumptionChart) panelConsumptionChart.destroy();
    panelConsumptionChart = new Chart(ctx, chartConfig);
  }
}

// Toon de top 6 dimensies (op basis van dikte x breedte) voor houtverbruik
function renderTopSix(data) {
  const dimensionMap = new Map();
  data.forEach(item => {
    const key = `${item.dikte} x ${item.breedte}`;
    const current = dimensionMap.get(key) || { count: 0, volume: 0 };
    current.count += Number(item.aantal);
    current.volume += calculateVolume(item);
    dimensionMap.set(key, current);
  });
  const sorted = [...dimensionMap.entries()].sort((a, b) => b[1].volume - a[1].volume).slice(0, 6);
  const html = `
    <h5 class="mb-3">Top 6 Maten (Dikte x Breedte) op verbruikt volume</h5>
    <ul class="list-group">
      ${sorted.map(([dim, stats]) => `
        <li class="list-group-item d-flex justify-content-between align-items-center">
          ${dim}
          <span class="badge bg-primary rounded-pill">${stats.volume.toFixed(3)} m³</span>
          <span class="badge bg-secondary rounded-pill">${stats.count} stuks</span>
        </li>
      `).join('')}
    </ul>
  `;
  document.getElementById('top-six-dimensions').innerHTML = html;
}

// Drill-down: toon een modal met details van alle items op de aangeklikte datum
function drillDownChart(dateClicked, data) {
  const details = data.filter(item => formatDate(item.date_consumed) === dateClicked);
  let html = `<h5>Details voor ${dateClicked}</h5>`;
  html += `<ul class="list-group">`;
  details.forEach(item => {
    const vol = calculateVolume(item);
    html += `<li class="list-group-item">
      ${item.soort}: ${item.lengte} x ${item.breedte} x ${item.dikte} mm, Aantal: ${item.aantal}, Volume: ${vol.toFixed(3)} m³
    </li>`;
  });
  html += `</ul>`;
  const modalBody = document.getElementById('detailModalBody');
  modalBody.innerHTML = html;
  const detailModal = new bootstrap.Modal(document.getElementById('detailModal'));
  detailModal.show();
}

// Nieuwe functie: genereer een reorder voorstel op basis van verbruik en huidige voorraad
async function generateReorderProposal(consumptionData) {
  const reorderLeadTime = 7; // Bijvoorbeeld: 7 dagen lead time
  try {
    const response = await fetch('/api/hout_stock');
    const stockData = await response.json();

    // Maak een map van voorraad per uniek item (key = soort_lengte_breedte_dikte)
    const stockMap = new Map();
    stockData.forEach(item => {
      const key = `${item.soort}_${item.lengte}_${item.breedte}_${item.dikte}`;
      stockMap.set(key, item);
    });

    // Groepeer verbruiksdata per item (zelfde sleutel)
    const consumptionMap = new Map();
    consumptionData.forEach(item => {
      const key = `${item.soort}_${item.lengte}_${item.breedte}_${item.dikte}`;
      if (!consumptionMap.has(key)) {
        consumptionMap.set(key, { total: 0, days: new Set() });
      }
      const group = consumptionMap.get(key);
      group.total += Number(item.aantal);
      group.days.add(formatDate(item.date_consumed));
    });

    // Bereken per item het gemiddelde dagelijkse verbruik en stel een reorder hoeveelheid voor
    const proposals = [];
    consumptionMap.forEach((group, key) => {
      const avgDaily = group.total / group.days.size;
      const stockItem = stockMap.get(key);
      const currentStock = stockItem ? Number(stockItem.aantal) : 0;
      const proposedOrder = Math.ceil(avgDaily * reorderLeadTime) - currentStock;
      if (proposedOrder > 0) {
        const [soort, lengte, breedte, dikte] = key.split('_');
        proposals.push({
          soort,
          lengte,
          breedte,
          dikte,
          avgDaily: avgDaily.toFixed(2),
          currentStock,
          proposedOrder
        });
      }
    });

    // Sorteer de voorstellen op houtsoort, vervolgens op breedte en dikte
    proposals.sort((a, b) => {
      let cmp = a.soort.localeCompare(b.soort);
      if (cmp !== 0) return cmp;
      cmp = Number(a.breedte) - Number(b.breedte);
      if (cmp !== 0) return cmp;
      return Number(a.dikte) - Number(b.dikte);
    });

    // Render het voorstel in de container met id "reorder-proposal"
    const container = document.getElementById('reorder-proposal');
    if (proposals.length === 0) {
      container.innerHTML = `<div class="alert alert-success">Geen reorder voorstellen nodig op basis van verbruik.</div>`;
    } else {
      let html = `
        <h5>Reorder Voorstellen</h5>
        <table class="table table-bordered">
          <thead>
            <tr>
              <th>Soort</th>
              <th>Lengte (mm)</th>
              <th>Breedte (mm)</th>
              <th>Dikte (mm)</th>
              <th>Gemiddeld dagelijks verbruik</th>
              <th>Huidige voorraad</th>
              <th>Voorgesteld te bestellen aantal</th>
            </tr>
          </thead>
          <tbody>
      `;
      proposals.forEach(item => {
        html += `
          <tr>
            <td>${item.soort}</td>
            <td>${item.lengte}</td>
            <td>${item.breedte}</td>
            <td>${item.dikte}</td>
            <td>${item.avgDaily}</td>
            <td>${item.currentStock}</td>
            <td>${item.proposedOrder}</td>
          </tr>
        `;
      });
      html += `</tbody></table>`;
      container.innerHTML = html;
    }
  } catch (error) {
    console.error('Error generating reorder proposal:', error);
    showToast('Fout bij het genereren van reorder voorstel', 'danger');
  }
}

// Voeg boven de tabel een set bedieningsknoppen toe (zoeken, exporteren en printen)
function addTableControls(tableId) {
  const container = document.getElementById(tableId + '-controls');
  if (!container) return;
  container.innerHTML = `
    <div class="d-flex mb-2">
      <input type="text" class="form-control me-2" placeholder="Zoeken..." id="${tableId}-search">
      <button class="btn btn-outline-secondary me-2" id="${tableId}-export" aria-label="Exporteer naar CSV">Export CSV</button>
      <button class="btn btn-outline-secondary" id="${tableId}-print" aria-label="Print tabel">Print</button>
    </div>
  `;
  document.getElementById(`${tableId}-search`).addEventListener('input', function () {
    filterTable(tableId, this.value);
  });
  document.getElementById(`${tableId}-export`).addEventListener('click', function () {
    exportTableToCSV(tableId);
  });
  document.getElementById(`${tableId}-print`).addEventListener('click', function () {
    printTable(tableId);
  });
  makeTableSortable(document.getElementById(tableId));
}

// Filter de tabel op basis van een zoekterm
function filterTable(tableId, searchTerm) {
  const table = document.getElementById(tableId);
  const filter = searchTerm.toLowerCase();
  Array.from(table.tBodies[0].rows).forEach(row => {
    const cells = row.getElementsByTagName('td');
    let match = false;
    for (let i = 0; i < cells.length; i++) {
      if (cells[i].textContent.toLowerCase().indexOf(filter) > -1) {
        match = true;
        break;
      }
    }
    row.style.display = match ? '' : 'none';
  });
}

// Exporteer de tabelgegevens naar CSV
function exportTableToCSV(tableId) {
  const table = document.getElementById(tableId);
  let csv = '';
  for (const row of table.rows) {
    let rowData = [];
    for (const cell of row.cells) {
      rowData.push('"' + cell.textContent.replace(/"/g, '""') + '"');
    }
    csv += rowData.join(',') + '\n';
  }
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = tableId + "_data.csv";
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Print de tabel: open een nieuw venster met een printvriendelijke versie
function printTable(tableId) {
  const table = document.getElementById(tableId);
  const newWin = window.open("");
  newWin.document.write(`
    <html>
      <head>
        <title>Print Tabel</title>
        <style>
          table { width: 100%; border-collapse: collapse; }
          table, th, td { border: 1px solid black; }
          th, td { padding: 8px; text-align: left; }
        </style>
      </head>
      <body>
        ${table.outerHTML}
      </body>
    </html>
  `);
  newWin.document.close();
  newWin.focus();
  newWin.print();
  newWin.close();
}

// Maak de tabel sorteerbaar: klik op een header sorteert de kolom
function makeTableSortable(table) {
  const headers = table.querySelectorAll("th");
  headers.forEach((header, index) => {
    header.style.cursor = 'pointer';
    header.addEventListener('click', () => {
      sortTableByColumn(table, index);
    });
  });
}

// Sorteer de tabel op basis van de opgegeven kolom
function sortTableByColumn(table, column, asc = true) {
  const dirModifier = asc ? 1 : -1;
  const tBody = table.tBodies[0];
  const rows = Array.from(tBody.querySelectorAll("tr"));
  const sortedRows = rows.sort((a, b) => {
    const aText = a.querySelector(`td:nth-child(${column + 1})`).textContent.trim();
    const bText = b.querySelector(`td:nth-child(${column + 1})`).textContent.trim();
    return aText.localeCompare(bText, undefined, { numeric: true }) * dirModifier;
  });
  while (tBody.firstChild) {
    tBody.removeChild(tBody.firstChild);
  }
  tBody.append(...sortedRows);
  table.querySelectorAll("th")[column].addEventListener('click', function () {
    sortTableByColumn(table, column, !asc);
  });
}

// Toon een toast-notificatie (Bootstrap Toast)
function showToast(message, type = 'info') {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;
  const toastId = 'toast-' + Date.now();
  const toastHTML = `
    <div id="${toastId}" class="toast align-items-center text-white bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Sluiten"></button>
      </div>
    </div>
  `;
  toastContainer.insertAdjacentHTML('beforeend', toastHTML);
  const toastEl = document.getElementById(toastId);
  const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
  toast.show();
  toastEl.addEventListener('hidden.bs.toast', () => {
    toastEl.remove();
  });
}
