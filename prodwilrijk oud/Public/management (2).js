document.addEventListener('DOMContentLoaded', () => {
    const fetchAndPopulate = (url, table, rowBuilder) => {
        fetch(url)
            .then(response => response.json())
            .then(data => {
                table.innerHTML = '';
                data.forEach(item => {
                    const row = table.insertRow();
                    rowBuilder(row, item);
                });
            })
            .catch(error => console.error(`Error fetching ${url}:`, error));
    };

    const addEntry = (url, data, table, rowBuilder) => {
        axios.post(url, data)
            .then(response => {
                const result = response.data;
                if (result.success) {
                    const row = table.insertRow();
                    rowBuilder(row, result);
                } else {
                    console.error('Error response:', result);
                }
            })
            .catch(error => {
                console.error(`Error adding entry to ${url}:`, error);
                if (error.response) {
                    console.error('Error response:', error.response);
                } else if (error.request) {
                    console.error('Error request:', error.request);
                } else {
                    console.error('Error message:', error.message);
                }
            });
    };

    const showTab = (tabId) => {
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tabs button').forEach(button => button.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
        document.querySelector(`.tabs button[onclick="showTab('${tabId}')"]`).classList.add('active');
    };
    window.showTab = showTab;

    const werknemerForm = document.getElementById('werknemerForm');
    const werknemersTable = document.getElementById('werknemersTable').getElementsByTagName('tbody')[0];

    const machineForm = document.getElementById('machineForm');
    const machinesTable = document.getElementById('machinesTable').getElementsByTagName('tbody')[0];
    const machineSearch = document.getElementById('machineSearch');

    const bekwaamheidForm = document.getElementById('bekwaamheidForm');
    const bekwaamhedenTable = document.getElementById('bekwaamhedenTable').getElementsByTagName('tbody')[0];
    const werknemerSelect = document.getElementById('werknemerSelect');
    const machineSelect = document.getElementById('machineSelect');
    const bekwaamhedenSearch = document.getElementById('bekwaamhedenSearch');

    const handleFormSubmit = (formId, url, table, rowBuilder) => {
        document.getElementById(formId).addEventListener('submit', event => {
            event.preventDefault();
            const formData = new FormData(event.target);
            const data = {};
            formData.forEach((value, key) => {
                data[key] = value;
            });
            console.log('Sending data:', data);
            addEntry(url, data, table, rowBuilder);
        });
    };

    handleFormSubmit('werknemerForm', '/api/werknemers', werknemersTable, (row, data) => {
        row.insertCell(0).innerText = data.werknemerId;
        row.insertCell(1).innerText = data.naam;
    });

    handleFormSubmit('machineForm', '/api/machines', machinesTable, (row, data) => {
        row.insertCell(0).innerText = data.machineId;
        row.insertCell(1).innerText = data.naam;
    });

    fetchAndPopulate('/api/werknemers', werknemersTable, (row, werknemer) => {
        row.insertCell(0).innerText = werknemer.id;
        row.insertCell(1).innerText = werknemer.naam;
    });

    fetchAndPopulate('/api/machines', machinesTable, (row, machine) => {
        row.insertCell(0).innerText = machine.id;
        row.insertCell(1).innerText = machine.naam;
    });

    machineSearch.addEventListener('input', () => {
        const searchValue = machineSearch.value.toLowerCase();
        fetchAndPopulate(`/api/machines?search=${searchValue}`, machinesTable, (row, machine) => {
            row.insertCell(0).innerText = machine.id;
            row.insertCell(1).innerText = machine.naam;
        });
    });

    bekwaamheidForm.addEventListener('submit', event => {
        event.preventDefault();
        const werknemerId = werknemerSelect.value;
        const machineId = machineSelect.value;
        const bekwaamheidsniveau = document.getElementById('bekwaamheidsniveau').value;
        const data = { werknemerId, machineId, bekwaamheidsniveau };
        addEntry('/api/werknemer_bekwaamheden', data, bekwaamhedenTable, (row, data) => {
            row.insertCell(0).innerText = werknemerSelect.options[werknemerSelect.selectedIndex].text;
            row.insertCell(1).innerText = machineSelect.options[machineSelect.selectedIndex].text;
            row.insertCell(2).innerText = bekwaamheidsniveau;
            const actionsCell = row.insertCell(3);
            const updateButton = document.createElement('button');
            updateButton.className = 'update-skill';
            updateButton.innerText = 'Update';
            updateButton.addEventListener('click', () => updateSkill(werknemerId, machineId, bekwaamheidsniveau, row));
            actionsCell.appendChild(updateButton);
        });
    });

    fetchAndPopulate('/api/werknemer_bekwaamheden', bekwaamhedenTable, (row, bekwaamheid) => {
        row.insertCell(0).innerText = bekwaamheid.werknemer;
        row.insertCell(1).innerText = bekwaamheid.machine;
        row.insertCell(2).innerText = bekwaamheid.bekwaamheidsniveau;
        const actionsCell = row.insertCell(3);
        const updateButton = document.createElement('button');
        updateButton.className = 'update-skill';
        updateButton.innerText = 'Update';
        updateButton.addEventListener('click', () => updateSkill(bekwaamheid.werknemer_id, bekwaamheid.machine_id, bekwaamheid.bekwaamheidsniveau, row));
        actionsCell.appendChild(updateButton);
    });

    bekwaamhedenSearch.addEventListener('input', () => {
        const searchValue = bekwaamhedenSearch.value.toLowerCase();
        fetchAndPopulate(`/api/werknemer_bekwaamheden?search=${searchValue}`, bekwaamhedenTable, (row, bekwaamheid) => {
            row.insertCell(0).innerText = bekwaamheid.werknemer;
            row.insertCell(1).innerText = bekwaamheid.machine;
            row.insertCell(2).innerText = bekwaamheid.bekwaamheidsniveau;
            const actionsCell = row.insertCell(3);
            const updateButton = document.createElement('button');
            updateButton.className = 'update-skill';
            updateButton.innerText = 'Update';
            updateButton.addEventListener('click', () => updateSkill(bekwaamheid.werknemer_id, bekwaamheid.machine_id, bekwaamheid.bekwaamheidsniveau, row));
            actionsCell.appendChild(updateButton);
        });
    });
    
    const assignmentForm = document.getElementById('assignmentForm');
    const assignmentsTable = document.getElementById('assignmentsTable').getElementsByTagName('tbody')[0];
    const assignWerknemerSelect = document.getElementById('assignWerknemerSelect');
    const assignMachineSelect = document.getElementById('assignMachineSelect');
    const assignmentDate = document.getElementById('assignmentDate');

    // Function to fetch data and populate select options
    const populateSelectOptions = (url, selectElement) => {
        fetch(url)
            .then(response => response.json())
            .then(data => {
                data.forEach(item => {
                    const option = document.createElement('option');
                    option.value = item.id;
                    option.text = item.naam;
                    selectElement.appendChild(option);
                });
            })
            .catch(error => console.error(`Error fetching ${url}:`, error));
    };

    // Populate select options for employees and machines
    populateSelectOptions('/api/werknemers', assignWerknemerSelect);
    populateSelectOptions('/api/machines', assignMachineSelect);

    assignmentForm.addEventListener('submit', event => {
        event.preventDefault();
        const werknemerId = assignWerknemerSelect.value;
        const machineId = assignMachineSelect.value;
        const date = assignmentDate.value;
        const data = { werknemerId, machineId, date };

        axios.post('/api/assignments', data)
            .then(response => {
                const result = response.data;
                if (result.success) {
                    const row = assignmentsTable.insertRow();
                    row.insertCell(0).innerText = assignWerknemerSelect.options[assignWerknemerSelect.selectedIndex].text;
                    row.insertCell(1).innerText = assignMachineSelect.options[assignMachineSelect.selectedIndex].text;
                    row.insertCell(2).innerText = date;
                } else {
                    console.error('Error response:', result);
                }
            })
            .catch(error => console.error('Error adding assignment:', error));
    });

    const fetchAndPopulateAssignments = () => {
        fetch('/api/assignments')
            .then(response => response.json())
            .then(data => {
                assignmentsTable.innerHTML = '';
                data.forEach(assignment => {
                    const row = assignmentsTable.insertRow();
                    row.insertCell(0).innerText = assignment.werknemer;
                    row.insertCell(1).innerText = assignment.machine;
                    row.insertCell(2).innerText = assignment.date;
                });
            })
            .catch(error => console.error('Error fetching assignments:', error));
    };

    fetchAndPopulateAssignments();
});

    const updateSkill = (werknemerId, machineId, currentLevel, row) => {
        const newSkillLevel = prompt('Enter new skill level:', currentLevel);
        if (newSkillLevel) {
            axios.post('/api/werknemer_bekwaamheden', {
                werknemerId,
                machineId,
                bekwaamheidsniveau: newSkillLevel
            })
            .then(response => {
                if (response.data.success) {
                    row.cells[2].innerText = newSkillLevel;
                } else {
                    console.error('Error response:', response.data);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                if (error.response) {
                    console.error('Error response:', error.response);
                } else if (error.request) {
                    console.error('Error request:', error.request);
                } else {
                    console.error('Error message:', error.message);
                }
            });
        }
    };
});
