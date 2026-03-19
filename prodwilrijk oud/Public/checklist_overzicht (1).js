// Laad de checklists en vul de tabel
fetch('/api/get_checklists')
    .then(response => response.json())
    .then(data => {
        const tbody = document.getElementById('checklist-table-body');
        
        // Check of het tbody element bestaat
        if (!tbody) {
            console.error('Checklist table body not found');
            return;
        }

        // Maak de huidige inhoud van de tabel leeg
        tbody.innerHTML = '';

        // Loop door de data en vul de tabel
        data.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.werkorder}</td>
                <td>${new Date(item.datum).toISOString().split('T')[0]}</td>
                <td>${item.verantwoordelijke}</td>
                <td>${item.order_description}</td>  <!-- Weergeven van de order_description -->
                <td>
                    <button onclick="viewDetails(${item.id})">Details</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    })
    .catch(error => console.error('Error fetching checklists:', error));

// Functie om de details van een checklist te bekijken
function viewDetails(checklistId) {
    window.location.href = `/checklist_details.html?id=${checklistId}`;
}
