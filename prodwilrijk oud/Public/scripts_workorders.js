document.addEventListener('DOMContentLoaded', () => {
    const addOrderButton = document.getElementById('add-order-button');
    const workordersTableBody = document.getElementById('workorders-table-body');

    let workorders = [];

    addOrderButton.addEventListener('click', () => {
        const orderNumber = document.getElementById('order-number').value;
        const orderDescription = document.getElementById('order-description').value;
        const step = document.getElementById('step').value;
        
        if (!orderNumber || !orderDescription) {
            alert('Vul alle velden in.');
            return;
        }

        const newOrder = {
            orderNumber,
            orderDescription,
            step,
            startTime: null,
            endTime: null
        };

        workorders.push(newOrder);
        updateTable();
    });

    function updateTable() {
        workordersTableBody.innerHTML = '';

        workorders.forEach((order, index) => {
            const row = document.createElement('tr');

            row.innerHTML = `
                <td>${order.orderNumber}</td>
                <td>${order.orderDescription}</td>
                <td>${order.step}</td>
                <td>${order.startTime ? new Date(order.startTime).toLocaleString() : ''}</td>
                <td>${order.endTime ? new Date(order.endTime).toLocaleString() : ''}</td>
                <td>
                    ${!order.startTime ? `<button onclick="startOrder(${index})">Start</button>` : ''}
                    ${order.startTime && !order.endTime ? `<button onclick="endOrder(${index})">Stop</button>` : ''}
                </td>
            `;

            workordersTableBody.appendChild(row);
        });
    }

    window.startOrder = function(index) {
        workorders[index].startTime = new Date().toISOString();
        updateTable();
    }

    window.endOrder = function(index) {
        workorders[index].endTime = new Date().toISOString();
        updateTable();
    }
});
