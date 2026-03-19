document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('admin-items-table-body');
    const totalRevenueElement = document.getElementById('total-revenue');
    const filterButton = document.getElementById('filter-button');

    if (!tableBody || !totalRevenueElement || !filterButton) {
        console.error('Required DOM elements are missing.');
        return;
    }

    const fetchAdminItems = async (dateFrom, dateTo) => {
        try {
            let url = '/api/admin_items';
            if (dateFrom || dateTo) {
                const params = new URLSearchParams();
                if (dateFrom) params.append('dateFrom', dateFrom);
                if (dateTo) params.append('dateTo', dateTo);
                url += '?' + params.toString();
            }

            const response = await fetch(url);

            // Check if the response content type is JSON
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const { items, totalRevenue } = await response.json();
                populateTable(items);
                totalRevenueElement.textContent = totalRevenue.toFixed(2);
            } else {
                const text = await response.text();
                console.error('Unexpected response:', text);
                alert('Failed to fetch admin items. Please check the server response.');
            }
        } catch (error) {
            console.error('Error fetching admin items:', error);
        }
    };

    const populateTable = (items) => {
        tableBody.innerHTML = '';
        items.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.id}</td>
                <td>${item.item_number}</td>
                <td>${item.po_number}</td>
                <td>${item.amount}</td>
                <td>${new Date(item.date_added).toLocaleDateString()}</td>
                <td>${new Date(item.date_packed).toLocaleDateString()}</td>
                <td><input type="number" value="${item.price || 0}" data-id="${item.id}" class="price-input"></td>
                <td><button class="save-btn" data-id="${item.id}">Save</button></td>
            `;
            tableBody.appendChild(row);
        });

        document.querySelectorAll('.save-btn').forEach(button => {
            button.addEventListener('click', event => {
                const id = event.target.dataset.id;
                const price = document.querySelector(`.price-input[data-id="${id}"]`).value;
                updatePrice(id, price);
            });
        });
    };

    const updatePrice = async (id, price) => {
        try {
            const response = await fetch(`/api/admin_items/${id}/price`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ price })
            });
            const data = await response.json();
            if (data.success) {
                alert('Price updated successfully');
                // Refetch data to update total revenue
                fetchAdminItems(document.getElementById('date-from').value, document.getElementById('date-to').value);
            } else {
                alert('Error updating price');
            }
        } catch (error) {
            console.error('Error updating price:', error);
        }
    };

    filterButton.addEventListener('click', () => {
        const dateFrom = document.getElementById('date-from').value;
        const dateTo = document.getElementById('date-to').value;
        fetchAdminItems(dateFrom, dateTo);
    });

    // Initial fetch
    fetchAdminItems();
});
