// Load the header from header.html
document.getElementById('header').innerHTML = `<object type="text/html" data="header.html"></object>`;

// Fetch items for the dropdown
fetch('/api/get_stock_items')
    .then(response => response.json())
    .then(data => {
        const itemDropdown = document.getElementById('itemDropdown');
        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = `${item.item_name} (ID: ${item.id})`;
            itemDropdown.appendChild(option);
        });
    })
    .catch(error => console.error('Error loading items:', error));

// Add new item
document.getElementById('addItemForm').addEventListener('submit', function (event) {
    event.preventDefault();
    const item_name = document.getElementById('itemName').value;
    const description = document.getElementById('description').value;
    const minimum_stock = document.getElementById('minimumStock').value;

    console.log('Submitting data:', { item_name, description, minimum_stock }); // Log data voor submit

    fetch('/api/add_stock_item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_name, description, minimum_stock })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Server response:', data); // Log de server response
        alert(data.message); // Toon het bericht van de backend
        location.reload(); // Herlaad de pagina om de itemlijst te verversen
    })
    .catch(error => console.error('Error:', error));
});

// Update current stock
document.getElementById('updateStockForm').addEventListener('submit', function (event) {
    event.preventDefault();
    const id = document.getElementById('itemDropdown').value;
    const current_stock = document.getElementById('currentStock').value;

    fetch('/api/update_stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, current_stock })
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message); // Display the message from the backend
    })
    .catch(error => console.error('Error:', error));
});

