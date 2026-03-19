document.addEventListener('DOMContentLoaded', () => {
    const addOrderButton = document.getElementById('add-order-button');
    const workordersTableBody = document.getElementById('workorders-table-body');
    const orderDetails = document.getElementById('order-details');
    const detailsOrderNumber = document.getElementById('details-order-number');
    const zagerijTimelogs = document.getElementById('zagerij-timelogs');
    const assemblageTimelogs = document.getElementById('assemblage-timelogs');
    const totalTimeElement = document.getElementById('total-time');

    function showLoading() {
        workordersTableBody.innerHTML = '<tr><td colspan="6">Loading...</td></tr>';
    }

    function hideLoading() {
        workordersTableBody.innerHTML = '';
    }

    function showFeedback(message) {
        alert(message);
    }

    function fetchWorkorders() {
        showLoading();
        fetch('/api/workorders')
            .then(response => response.json())
            .then(data => {
                hideLoading();
                updateTable(data);
            })
            .catch(error => {
                console.error('Error fetching work orders:', error);
                showFeedback('Error fetching work orders.');
            });
    }

    fetchWorkorders();

    addOrderButton.addEventListener('click', () => {
        const orderNumber = document.getElementById('order-number').value;
        const orderDescription = document.getElementById('order-description').value;
        const orderQuantity = document.getElementById('order-quantity').value;
        const steps = Array.from(document.getElementById('steps').selectedOptions).map(option => option.value);

        if (!orderNumber || !orderDescription || !orderQuantity || steps.length === 0) {
            alert('Vul alle velden in en selecteer minstens één stap.');
            return;
        }

        const newOrder = {
            orderNumber,
            orderDescription,
            orderQuantity,
            steps
        };

        fetch('/api/workorders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newOrder)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showFeedback('Werkorder succesvol toegevoegd.');
                fetchWorkorders();
            } else {
                showFeedback('Error adding work order.');
            }
        })
        .catch(error => {
            console.error('Error adding work order:', error);
            showFeedback('Error adding work order.');
        });
    });

    function updateTable(workorders) {
        workordersTableBody.innerHTML = '';

        workorders.forEach(order => {
            const zagerijStatus = order.steps.includes('zagerij') ? (order.status_zagerij || 'pending') : 'N.V.T';
            const assemblageStatus = order.steps.includes('assemblage') ? (order.status_assemblage || 'pending') : 'N.V.T';
            const row = document.createElement('tr');

            row.innerHTML = `
                <td>${order.order_number}</td>
                <td>${order.order_description}</td>
                <td>${order.order_quantity}</td>
                <td>${zagerijStatus}</td>
                <td>${assemblageStatus}</td>
                <td><button onclick="viewDetails(${order.id})">Details</button></td>
            `;

            workordersTableBody.appendChild(row);
        });
    }

    window.viewDetails = function(id) {
        fetch(`/api/workorders/${id}`)
            .then(response => response.json())
            .then(order => {
                detailsOrderNumber.textContent = order.order_number;
                updateTimelogs(order);
                orderDetails.style.display = 'block';
            })
            .catch(error => console.error('Error fetching work order details:', error));
    }

    function updateTimelogs(order) {
        zagerijTimelogs.innerHTML = '';
        assemblageTimelogs.innerHTML = '';
        let totalMinutes = 0;

        if (order.zagerij_start_time) {
            const startTime = new Date(order.zagerij_start_time);
            const endTime = order.zagerij_end_time ? new Date(order.zagerij_end_time) : null;
            const duration = endTime ? (endTime - startTime) / (1000 * 60) : 0;
            totalMinutes += duration;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${startTime.toLocaleString()}</td>
                <td>${endTime ? endTime.toLocaleString() : ''}</td>
                <td>${duration.toFixed(2)}</td>
            `;
            zagerijTimelogs.appendChild(row);
        }

        if (order.assemblage_start_time) {
            const startTime = new Date(order.assemblage_start_time);
            const endTime = order.assemblage_end_time ? new Date(order.assemblage_end_time) : null;
            const duration = endTime ? (endTime - startTime) / (1000 * 60) : 0;
            totalMinutes += duration;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${startTime.toLocaleString()}</td>
                <td>${endTime ? endTime.toLocaleString() : ''}</td>
                <td>${duration.toFixed(2)}</td>
            `;
            assemblageTimelogs.appendChild(row);
        }

        totalTimeElement.textContent = formatTime(totalMinutes);
    }

    function formatTime(totalMinutes) {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = Math.floor(totalMinutes % 60);
        return `${hours} uur ${minutes} min`;
    }
});
