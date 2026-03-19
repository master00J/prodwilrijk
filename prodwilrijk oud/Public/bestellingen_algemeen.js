document.addEventListener('DOMContentLoaded', function() {
    const searchBar = document.getElementById('search-bar');
    const artikelsTableBody = document.getElementById('artikels-table').getElementsByTagName('tbody')[0];
    const orderListBody = document.getElementById('order-list').getElementsByTagName('tbody')[0];
    const sendOrderBtn = document.getElementById('send-order-btn');

    let orderList = [];
    let searchTimeout;

    // Search with debounce
    searchBar.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        const query = searchBar.value.trim().toLowerCase();
        
        // Show loading state
        if (query) {
            artikelsTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center">
                        <div class="spinner-border spinner-border-sm text-primary me-2" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        Artikelen zoeken...
                    </td>
                </tr>`;
        } else {
            artikelsTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center">Gebruik de zoekbalk om artikelen te zoeken</td>
                </tr>`;
            return;
        }

        searchTimeout = setTimeout(() => {
            if (query) {
                fetchArtikels(query);
            }
        }, 300);
    });

    function fetchArtikels(query) {
        fetch(`/api/search_artikels?q=${encodeURIComponent(query)}`)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                artikelsTableBody.innerHTML = '';
                if (data.length === 0) {
                    artikelsTableBody.innerHTML = `
                        <tr>
                            <td colspan="4" class="text-center">
                                <i class="fas fa-search me-2"></i>Geen artikelen gevonden
                            </td>
                        </tr>`;
                    return;
                }
                data.forEach(item => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${item.volledige_omschrijving}</td>
                        <td>${item.artikelnummer}</td>
                        <td>
                            <input type="number" 
                                   min="1" 
                                   value="1" 
                                   class="form-control form-control-sm order-quantity" 
                                   style="width: 80px">
                        </td>
                        <td>
                            <button class="btn btn-sm btn-success add-to-order" data-id="${item.id}">
                                <i class="fas fa-plus me-1"></i>Toevoegen
                            </button>
                        </td>
                    `;
                    artikelsTableBody.appendChild(row);
                });
            })
            .catch(error => {
                console.error('Error:', error);
                artikelsTableBody.innerHTML = `
                    <tr>
                        <td colspan="4" class="text-center text-danger">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            Er is een fout opgetreden bij het ophalen van de artikelen
                        </td>
                    </tr>`;
            });
    }

    // Add item to order
    artikelsTableBody.addEventListener('click', function(event) {
        const addButton = event.target.closest('.add-to-order');
        if (!addButton) return;

        const row = addButton.closest('tr');
        const quantityInput = row.querySelector('.order-quantity');
        const quantity = parseInt(quantityInput.value);

        if (quantity <= 0) {
            showAlert('Aantal moet groter zijn dan 0', 'warning');
            return;
        }

        const orderItem = {
            id: addButton.dataset.id,
            description: row.cells[0].textContent,
            articleNumber: row.cells[1].textContent,
            quantity: quantity
        };

        // Check if item already exists
        const existingIndex = orderList.findIndex(item => item.id === orderItem.id);
        if (existingIndex !== -1) {
            orderList[existingIndex].quantity += quantity;
        } else {
            orderList.push(orderItem);
        }

        renderOrderList();
        showAlert('Artikel toegevoegd aan bestelling', 'success');
    });

    // Render order list
    function renderOrderList() {
        orderListBody.innerHTML = '';
        if (orderList.length === 0) {
            orderListBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center">
                        <i class="fas fa-shopping-cart me-2"></i>Geen artikelen geselecteerd
                    </td>
                </tr>`;
            return;
        }

        orderList.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.description}</td>
                <td>${item.articleNumber}</td>
                <td>${item.quantity}</td>
                <td>
                    <button class="btn btn-sm btn-danger remove-from-order" data-index="${index}">
                        <i class="fas fa-trash me-1"></i>Verwijderen
                    </button>
                </td>
            `;
            orderListBody.appendChild(row);
        });
    }

    // Remove item from order
    orderListBody.addEventListener('click', function(event) {
        const removeButton = event.target.closest('.remove-from-order');
        if (!removeButton) return;

        const index = removeButton.dataset.index;
        orderList.splice(index, 1);
        renderOrderList();
        showAlert('Artikel verwijderd uit bestelling', 'warning');
    });

    // Send order
    sendOrderBtn.addEventListener('click', function() {
        if (orderList.length === 0) {
            showAlert('Geen artikelen geselecteerd om te bestellen', 'warning');
            return;
        }

        sendOrderBtn.disabled = true;
        sendOrderBtn.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            Bestelling versturen...`;

        fetch('/api/plaats_bestelling_algemeen', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderList })
        })
        .then(response => {
            if (!response.ok) throw new Error('Error sending order');
            return response.json();
        })
        .then(result => {
            if (result.success) {
                showAlert('Bestelling succesvol verstuurd!', 'success');
                orderList = [];
                renderOrderList();
            } else {
                throw new Error(result.message || 'Unknown error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('Er is een fout opgetreden bij het versturen van de bestelling', 'danger');
        })
        .finally(() => {
            sendOrderBtn.disabled = false;
            sendOrderBtn.innerHTML = `<i class="fas fa-paper-plane me-2"></i>Verstuur Bestelling`;
        });
    });

    // Show alert helper
    function showAlert(message, type = 'info') {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed bottom-0 end-0 m-3`;
        alertDiv.style.zIndex = '1050';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(alertDiv);
        setTimeout(() => {
            alertDiv.remove();
        }, 3000);
    }

    // Initial render
    renderOrderList();
});