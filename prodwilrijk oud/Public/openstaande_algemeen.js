document.addEventListener('DOMContentLoaded', function() {
    let refreshInterval;

    // Load header
    fetch('header.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById('header-placeholder').innerHTML = data;
        })
        .catch(err => console.error('Error loading header:', err));

    // Initialize
    loadAlgemeneBestellingen();
    initializeAutoRefresh();

    function initializeAutoRefresh() {
        const autoRefreshToggle = document.getElementById('autoRefresh');
        
        autoRefreshToggle.addEventListener('change', function() {
            if (this.checked) {
                refreshInterval = setInterval(loadAlgemeneBestellingen, 30000);
                this.nextElementSibling.innerHTML = `
                    <i class="fas fa-sync fa-spin me-2"></i>Auto-verversen actief
                `;
            } else {
                clearInterval(refreshInterval);
                this.nextElementSibling.innerHTML = `
                    <i class="fas fa-sync me-2"></i>Auto-verversen (30s)
                `;
            }
        });
    }

    function loadAlgemeneBestellingen() {
        const tableBody = document.querySelector('#algemeen-bestellingen-table tbody');
        
        // Show loading state
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    <div class="spinner-border text-primary loading-spinner" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="text-muted mt-2">Bestellingen laden...</p>
                </td>
            </tr>`;

        fetch('/api/openstaande_bestellingen_algemeen')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                if (!Array.isArray(data)) {
                    throw new Error('Received data is not an array');
                }

                if (data.length === 0) {
                    showEmptyState(tableBody);
                    return;
                }

                renderBestellingen(tableBody, data);
            })
            .catch(err => {
                console.error('Error:', err);
                showErrorState(tableBody, err.message);
                showNotification('Er is een fout opgetreden bij het laden van de bestellingen.', 'danger');
            });
    }

    function showEmptyState(tableBody) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-box-open text-muted"></i>
                    <p class="h5 mb-2">Geen openstaande bestellingen</p>
                    <p class="text-muted mb-0">Er zijn momenteel geen openstaande algemene bestellingen.</p>
                </td>
            </tr>`;
    }

    function showErrorState(tableBody, message) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-exclamation-triangle text-danger"></i>
                    <p class="h5 mb-2">Er is een fout opgetreden</p>
                    <p class="text-muted mb-0">${message}</p>
                </td>
            </tr>`;
    }

    function renderBestellingen(tableBody, data) {
        tableBody.innerHTML = '';

        data.forEach(order => {
            const besteldOp = order.besteld_op ? 
                new Date(order.besteld_op).toLocaleDateString('nl-BE', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                }) : 'N/A';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="artikel-omschrijving">
                    <div class="text-truncate" title="${order.artikel_omschrijving}">
                        ${order.artikel_omschrijving}
                    </div>
                </td>
                <td>${order.artikelnummer}</td>
                <td>${order.aantal}</td>
                <td class="date-column">${besteldOp}</td>
                <td>
                    ${getStatusBadge(order)}
                </td>
                <td>
                    ${getActionButton(order)}
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    function getStatusBadge(order) {
        if (order.ontvangen_op) {
            return `
                <span class="badge bg-success status-badge">
                    <i class="fas fa-check me-1"></i>Ontvangen op 
                    ${new Date(order.ontvangen_op).toLocaleDateString('nl-BE')}
                </span>`;
        }
        return `
            <span class="badge bg-warning status-badge">
                <i class="fas fa-clock me-1"></i>In afwachting
            </span>`;
    }

    function getActionButton(order) {
        if (order.ontvangen_op) {
            return `
                <button class="btn btn-success btn-sm" disabled>
                    <i class="fas fa-check me-1"></i>Ontvangen
                </button>`;
        }
        return `
            <button class="btn btn-primary btn-sm btn-receive" 
                    onclick="markAsReceived(${order.id})" 
                    data-order-id="${order.id}">
                <i class="fas fa-box me-1"></i>Markeer als ontvangen
            </button>`;
    }

    window.markAsReceived = function(orderId) {
        const button = document.querySelector(`button[data-order-id="${orderId}"]`);
        if (!button) return;

        // Disable button and show loading state
        button.disabled = true;
        button.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            Verwerken...`;

        fetch(`/api/markeer_ontvangen_algemeen/${orderId}`, { 
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(result => {
            if (result.success) {
                showNotification('Bestelling succesvol gemarkeerd als ontvangen', 'success');
                loadAlgemeneBestellingen();
            } else {
                throw new Error(result.message || 'Unknown error');
            }
        })
        .catch(err => {
            console.error('Error:', err);
            button.disabled = false;
            button.innerHTML = `<i class="fas fa-box me-1"></i>Markeer als ontvangen`;
            showNotification('Er is een fout opgetreden bij het markeren als ontvangen', 'danger');
        });
    };

    function showNotification(message, type = 'info') {
        const toast = document.getElementById('notificationToast');
        const toastBody = toast.querySelector('.toast-body');
        
        // Set appropriate background color
        toastBody.className = 'toast-body';
        switch(type) {
            case 'success':
                toastBody.classList.add('bg-success', 'text-white');
                break;
            case 'danger':
                toastBody.classList.add('bg-danger', 'text-white');
                break;
            case 'warning':
                toastBody.classList.add('bg-warning');
                break;
            default:
                toastBody.classList.add('bg-info', 'text-white');
        }
        
        toastBody.textContent = message;
        
        const bsToast = new bootstrap.Toast(toast, {
            delay: 3000
        });
        bsToast.show();
    }
});