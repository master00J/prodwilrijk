document.addEventListener('DOMContentLoaded', () => {
    const workordersTableBody = document.getElementById('workorders-table-body');
    const pauseReasonModal = document.getElementById('pauseReasonModal');
    const closeModalButton = document.getElementById('closeModal');
    const pauseReasonSelect = document.getElementById('pause-reason-select');
    const submitPauseReasonButton = document.getElementById('submitPauseReason');
    const workersCountModal = document.getElementById('workersCountModal');
    const closeWorkersCountModalButton = document.getElementById('closeWorkersCountModal');
    const submitWorkersCountButton = document.getElementById('submitWorkersCount');
    const workersCountInput = document.getElementById('workers-count');
    let selectedOrderId, selectedStep, currentAction;

    function fetchWorkorders() {
        fetch('/api/workorders?step=zagerij')
            .then(response => response.json())
            .then(data => {
                updateTable(data);
            })
            .catch(error => {
                console.error('Error fetching zagerij work orders:', error);
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
                <td>${order.status_zagerij}</td>
                <td>
                    <button id="startPauseButton-${order.id}" onclick="showWorkersCountModal(${order.id}, 'zagerij', 'start')">Start</button>
                    <button onclick="endOrder(${order.id}, 'zagerij')">End</button>
                </td>
            `;

            workordersTableBody.appendChild(row);

            const button = document.getElementById(`startPauseButton-${order.id}`);
            setButtonState(button, order.status_zagerij, order.id, 'zagerij');
        });
    }

    function setButtonState(button, status, orderId, step) {
        if (status === 'in_progress') {
            button.textContent = 'Pause';
            button.onclick = () => showPauseReasonModal(orderId, step);
        } else if (status === 'paused') {
            button.textContent = 'Start';
            button.onclick = () => showWorkersCountModal(orderId, step, 'resume');
        } else {
            button.textContent = 'Start';
            button.onclick = () => showWorkersCountModal(orderId, step, 'start');
        }
    }

    window.showWorkersCountModal = function(orderId, step, action) {
        selectedOrderId = orderId;
        selectedStep = step;
        currentAction = action;
        workersCountModal.style.display = 'block';
    };

    submitWorkersCountButton.addEventListener('click', () => {
        const workersCount = workersCountInput.value;
        if (workersCount && workersCount > 0) {
            console.log(`Submitting workers count: ${workersCount} for order: ${selectedOrderId}, action: ${currentAction}`);
            if (currentAction === 'start') {
                startOrder(selectedOrderId, selectedStep, workersCount);
            } else if (currentAction === 'resume') {
                resumeOrder(selectedOrderId, selectedStep, workersCount);
            }
            workersCountModal.style.display = 'none';
        } else {
            alert('Please enter a valid number of workers.');
        }
    });

    window.startOrder = function(orderId, step, workersCount) {
        const button = document.getElementById(`startPauseButton-${orderId}`);

        fetch(`/api/workorders/${orderId}/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ step, workers: workersCount })
        }).then(response => response.json())
          .then(data => {
              if (data.success) {
                  setButtonState(button, 'in_progress', orderId, step);
              } else {
                  console.error('Error starting work order:', data.error);
              }
          })
          .catch(error => console.error('Error starting work order:', error));
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

    window.resumeOrder = function(orderId, step, workersCount) {
        const button = document.getElementById(`startPauseButton-${orderId}`);

        fetch(`/api/workorders/${orderId}/resume`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ step, workers: workersCount })
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

    closeWorkersCountModalButton.onclick = function() {
        workersCountModal.style.display = 'none';
    }

    window.onclick = function(event) {
        if (event.target == pauseReasonModal) {
            pauseReasonModal.style.display = 'none';
        } else if (event.target == workersCountModal) {
            workersCountModal.style.display = 'none';
        }
    }

    fetchWorkorders();
});
