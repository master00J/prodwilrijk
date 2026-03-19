document.addEventListener('DOMContentLoaded', () => {
    const workordersTableBody = document.getElementById('workorders-table-body');

    // Fetch all completed work orders on page load
    fetch('/api/workorders/completed?step=zagerij')
        .then(response => response.json())
        .then(data => {
            updateTable(data);
        })
        .catch(error => console.error('Error fetching completed work orders:', error));

    function updateTable(workorders) {
        workordersTableBody.innerHTML = '';

        workorders.forEach(order => {
            const row = document.createElement('tr');

            row.innerHTML = `
                <td>${order.order_number}</td>
                <td>${order.order_description}</td>
                <td>Completed</td>
            `;

            workordersTableBody.appendChild(row);
        });
    }
});
