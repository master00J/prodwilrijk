document.addEventListener('DOMContentLoaded', () => {
    const workordersTableBody = document.getElementById('workorders-table-body');
    const orderDetailsModal = document.getElementById('orderDetailsModal');
    const closeModalButton = document.querySelector('.close');
    const detailsOrderNumber = document.getElementById('details-order-number');
    const zagerijTimelogs = document.getElementById('zagerij-timelogs');
    const assemblageTimelogs = document.getElementById('assemblage-timelogs');
    const pauseTimelogs = document.getElementById('pause-timelogs');
    const totalTimeElement = document.getElementById('total-time');
    const totalPauseTimeElement = document.getElementById('total-pause-time');
    const totalSawingTimeElement = document.getElementById('total-sawing-time');
    const totalAssemblyTimeElement = document.getElementById('total-assembly-time');
    const searchInput = document.getElementById('search-input');

    let totalPauseMinutesZagerij = 0;
    let totalPauseMinutesAssemblage = 0;

    const showLoading = () => {
        workordersTableBody.innerHTML = '<tr><td colspan="7" class="loading">Laden...</td></tr>';
    };

    const hideLoading = () => {
        workordersTableBody.innerHTML = '';
    };

    const fetchWorkorders = () => {
        showLoading();
        fetch('/api/workorders?status=completed')
            .then(response => response.json())
            .then(data => {
                hideLoading();
                updateTable(data);
            })
            .catch(error => {
                console.error('Error fetching completed work orders:', error);
                showLoadingError();
            });
    };

    const showLoadingError = () => {
        workordersTableBody.innerHTML = '<tr><td colspan="7" class="error">Fout bij het laden van data.</td></tr>';
    };

    fetchWorkorders();

    const updateTable = (workorders) => {
        workordersTableBody.innerHTML = '';
        workorders.forEach(order => {
            const totalWorkTime = calculateTotalWorkTime(order);
            const totalManHours = calculateTotalManHours(order);
            const formattedTime = formatTime(totalWorkTime);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${order.order_number}</td>
                <td>${order.order_description}</td>
                <td>${order.order_quantity}</td>
                <td>Voltooid</td>
                <td>${formattedTime}</td>
                <td>${totalManHours}</td>
                <td><button onclick="viewDetails(${order.id})">Details</button></td>
            `;
            workordersTableBody.appendChild(row);
        });
    };

    window.viewDetails = (id) => {
        fetch(`/api/workorders/${id}`)
            .then(response => response.json())
            .then(order => {
                console.log('Order details:', order);
                detailsOrderNumber.textContent = order.order_number;
                updateTimelogs(order);
                orderDetailsModal.style.display = 'block';
            })
            .catch(error => console.error('Error fetching work order details:', error));
    };

    const updateTimelogs = (order) => {
        zagerijTimelogs.innerHTML = '';
        assemblageTimelogs.innerHTML = '';
        pauseTimelogs.innerHTML = '';
        let totalAssemblyMinutes = 0;
        let totalSawingMinutes = 0;
        let totalPauseMinutes = 0;
        totalPauseMinutesZagerij = 0;
        totalPauseMinutesAssemblage = 0;

        // Handle Zagerij times
        if (order.zagerij_start_time && order.zagerij_end_time) {
            const startTime = new Date(order.zagerij_start_time);
            const endTime = new Date(order.zagerij_end_time);
            const durationSeconds = (endTime - startTime) / 1000; // duration in seconds
            const workers = order.zagerij_workers || 1;
            const manHoursSeconds = durationSeconds * workers; // calculate man-hours in seconds
            totalSawingMinutes += durationSeconds / 60;
            console.log(`Zagerij Timelog: Start: ${startTime}, End: ${endTime}, Duration (sec): ${durationSeconds}, Workers: ${workers}, Manhours: ${manHoursSeconds}`);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${startTime.toLocaleString()}</td>
                <td>${endTime.toLocaleString()}</td>
                <td>${formatMinutes(durationSeconds / 60)}</td>
                <td>${formatMinutes(manHoursSeconds / 60)}</td>
            `;
            zagerijTimelogs.appendChild(row);
        }

        // Handle Assemblage times
        if (order.assemblage_start_time && order.assemblage_end_time) {
            const startTime = new Date(order.assemblage_start_time);
            const endTime = new Date(order.assemblage_end_time);
            const durationSeconds = (endTime - startTime) / 1000; // duration in seconds
            const workers = order.assemblage_workers || 1;
            const manHoursSeconds = durationSeconds * workers; // calculate man-hours in seconds
            totalAssemblyMinutes += durationSeconds / 60;
            console.log(`Assemblage Timelog: Start: ${startTime}, End: ${endTime}, Duration (sec): ${durationSeconds}, Workers: ${workers}, Manhours: ${manHoursSeconds}`);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${startTime.toLocaleString()}</td>
                <td>${endTime.toLocaleString()}</td>
                <td>${formatMinutes(durationSeconds / 60)}</td>
                <td>${formatMinutes(manHoursSeconds / 60)}</td>
            `;
            assemblageTimelogs.appendChild(row);
        }

        fetchPauseLogs(order.id, totalAssemblyMinutes, totalSawingMinutes);
    };

    const fetchPauseLogs = (workorderId, totalAssemblyMinutes, totalSawingMinutes) => {
        let totalPauseMinutes = 0;
        fetch(`/api/workorders/${workorderId}/pauses`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(pauses => {
                pauses.forEach(pause => {
                    const startTime = new Date(pause.pause_start_time);
                    const endTime = pause.pause_end_time ? new Date(pause.pause_end_time) : 'N/A';
                    const duration = endTime !== 'N/A' ? (endTime - startTime) / 1000 / 60 : 0; // duration in minutes
                    totalPauseMinutes += duration;

                    if (pause.step === 'assemblage') {
                        totalPauseMinutesAssemblage += duration;
                    } else if (pause.step === 'zagerij') {
                        totalPauseMinutesZagerij += duration;
                    }

                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${pause.step}</td>
                        <td>${startTime.toLocaleString()}</td>
                        <td>${endTime !== 'N/A' ? endTime.toLocaleString() : endTime}</td>
                        <td>${pause.reason}</td>
                        <td>${formatMinutes(duration)}</td>
                    `;
                    pauseTimelogs.appendChild(row);
                });

                totalPauseTimeElement.textContent = `Totaal Pauzetijd: ${formatMinutes(totalPauseMinutes)}`;
                totalSawingTimeElement.textContent = `Totaal Zaagtijd: ${formatMinutes(totalSawingMinutes - totalPauseMinutesZagerij)}`;
                totalAssemblyTimeElement.textContent = `Totaal Assemblagetijd: ${formatMinutes(totalAssemblyMinutes - totalPauseMinutesAssemblage)}`;
                totalTimeElement.textContent = `Totale Tijd Zagen + Assemblage: ${formatMinutes((totalSawingMinutes - totalPauseMinutesZagerij) + (totalAssemblyMinutes - totalPauseMinutesAssemblage))}`;
            })
            .catch(error => {
                console.error('Error fetching pause logs:', error);
                pauseTimelogs.innerHTML = '<tr><td colspan="5" class="error">Fout bij het laden van pauze logs.</td></tr>';
            });
    };

    const calculateTotalWorkTime = (order) => {
        let totalMinutes = 0;

        if (order.total_elapsed_time_zagerij) {
            totalMinutes += (order.total_elapsed_time_zagerij - totalPauseMinutesZagerij * 60) / 60;
        }

        if (order.total_elapsed_time_assemblage) {
            totalMinutes += (order.total_elapsed_time_assemblage - totalPauseMinutesAssemblage * 60) / 60;
        }

        return totalMinutes;
    };

    const calculateTotalManHours = (order) => {
        let totalManHoursSeconds = 0;

        if (order.total_elapsed_time_zagerij && order.zagerij_workers) {
            const effectiveZagerijTime = order.total_elapsed_time_zagerij - (totalPauseMinutesZagerij * 60); // in seconds
            totalManHoursSeconds += effectiveZagerijTime * order.zagerij_workers;
        }

        if (order.total_elapsed_time_assemblage && order.assemblage_workers) {
            const effectiveAssemblageTime = order.total_elapsed_time_assemblage - (totalPauseMinutesAssemblage * 60); // in seconds
            totalManHoursSeconds += effectiveAssemblageTime * order.assemblage_workers;
        }

        console.log(`Order ${order.order_number}: Total Manhours (seconds): ${totalManHoursSeconds}`);
        return formatMinutes(totalManHoursSeconds / 60);
    };

    const formatTime = (totalMinutes) => {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = Math.floor(totalMinutes % 60);
        return `${hours} uur ${minutes} min`;
    };

    const formatMinutes = (totalMinutes) => {
        const minutes = Math.floor(totalMinutes);
        const seconds = Math.floor((totalMinutes - minutes) * 60);
        return `${minutes} min ${seconds} sec`;
    };

    searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase();
        const rows = workordersTableBody.getElementsByTagName('tr');
        
        Array.from(rows).forEach(row => {
            const descriptionCell = row.cells[1];
            if (descriptionCell) {
                const description = descriptionCell.textContent.toLowerCase();
                if (description.includes(query)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            }
        });
    });

    closeModalButton.onclick = () => {
        orderDetailsModal.style.display = 'none';
    };

    window.onclick = (event) => {
        if (event.target == orderDetailsModal) {
            orderDetailsModal.style.display = 'none';
        }
    };
});
