document.addEventListener('DOMContentLoaded', () => {
    const workordersTableBody = document.getElementById('workorders-table-body');
    const pauseReasonModal = document.getElementById('pauseReasonModal');
    const closeModalButton = document.getElementById('closeModal');
    const pauseReasonSelect = document.getElementById('pause-reason-select');
    const submitPauseReasonButton = document.getElementById('submitPauseReason');
    let selectedOrderId, selectedStep;

    function fetchWorkorders() {
        fetch('/api/workorders?step=assemblage')
            .then(response => response.json())
            .then(data => {
                updateTable(data);
            })
            .catch(error => {
                console.error('Error fetching assemblage work orders:', error);
            });
    }

    function updateTable(workorders) {
        workordersTableBody.innerHTML = '';

        workorders.forEach(order => {
            const row = document.createElement('tr');

            row.innerHTML = `
                <td>${order.order_number}</td>
                <td>${order.order_description}</td>
                <td>${order.order_quantity}</td>
                <td>${order.status_assemblage}</td>
                <td>
                    <button id="startPauseButton-${order.id}" onclick="startPauseOrder(${order.id}, 'assemblage')">Start</button>
                    <button onclick="endOrder(${order.id}, 'assemblage')">End</button>
                </td>
            `;

            workordersTableBody.appendChild(row);

            const button = document.getElementById(`startPauseButton-${order.id}`);
            setButtonState(button, order.status_assemblage, order.id, 'assemblage');
        });
    }

    function setButtonState(button, status, orderId, step) {
        if (status === 'in_progress') {
            button.textContent = 'Pause';
            button.onclick = () => showPauseReasonModal(orderId, step);
        } else if (status === 'paused') {
            button.textContent = 'Resume';
            button.onclick = () => resumeOrder(orderId, step);
        } else {
            button.textContent = 'Start';
            button.onclick = () => startPauseOrder(orderId, step);
        }
    }

    window.startPauseOrder = function(orderId, step) {
        const button = document.getElementById(`startPauseButton-${orderId}`);

        if (button.textContent === 'Start') {
            fetch(`/api/workorders/${orderId}/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ step })
            }).then(response => response.json())
              .then(data => {
                  if (data.success) {
                      setButtonState(button, 'in_progress', orderId, step);
                  } else {
                      console.error('Error starting work order:', data.error);
                  }
              })
              .catch(error => console.error('Error starting work order:', error));
        } else if (button.textContent === 'Pause') {
            showPauseReasonModal(orderId, step);
        }
    };

    window.showPauseReasonModal = function(orderId, step) {
        selectedOrderId = orderId;
        selectedStep = step;
        pauseReasonModal.style.display = 'block';
    };

    submitPauseReasonButton.addEventListener('click', () => {
        const reason = pauseReasonSelect.value;
        if (reason) {
            pauseOrder(selectedOrderId, selectedStep, reason);
            pauseReasonModal.style.display = 'none';
        } else {
            alert('Please select a reason for the pause.');
        }
    });

    window.pauseOrder = function(orderId, step, reason) {
        const button = document.getElementById(`startPauseButton-${orderId}`);

        fetch(`/api/workorders/${orderId}/pause`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ step, reason })
        }).then(response => response.json())
          .then(data => {
              if (data.success) {
                  setButtonState(button, 'paused', orderId, step);
              } else {
                  console.error('Error pausing work order:', data.error);
              }
          })
          .catch(error => console.error('Error pausing work order:', error));
    };

    window.resumeOrder = function(orderId, step) {
        const button = document.getElementById(`startPauseButton-${orderId}`);

        fetch(`/api/workorders/${orderId}/resume`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ step })
        }).then(response => response.json())
          .then(data => {
              if (data.success) {
                  setButtonState(button, 'in_progress', orderId, step);
              } else {
                  console.error('Error resuming work order:', data.error);
              }
          })
          .catch(error => console.error('Error resuming work order:', error));
    };

    window.endOrder = function(orderId, step) {
        fetch(`/api/workorders/${orderId}/end`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ step })
        }).then(response => response.json())
          .then(data => {
              if (data.success) {
                  const row = document.querySelector(`#startPauseButton-${orderId}`).parentNode.parentNode;
                  row.parentNode.removeChild(row);
              } else {
                  console.error('Error ending work order:', data.error);
              }
          })
          .catch(error => console.error('Error ending work order:', error));
    };

    closeModalButton.onclick = function() {
        pauseReasonModal.style.display = 'none';
    }

    window.onclick = function(event) {
        if (event.target == pauseReasonModal) {
            pauseReasonModal.style.display = 'none';
        }
    }

    fetchWorkorders();
});
