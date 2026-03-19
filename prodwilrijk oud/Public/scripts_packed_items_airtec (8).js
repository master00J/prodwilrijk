document.addEventListener('DOMContentLoaded', (event) => {
    // Load the header
    fetch('header.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById('header-placeholder').innerHTML = data;
        });

    // Element references
    const filterButton = document.getElementById('filter-button');
    const downloadButton = document.getElementById('download-button');
    const emailButton = document.getElementById('email-button');
    const reportButton = document.getElementById('report-button');
    const downloadReportButton = document.getElementById('download-report-button');
    const emailReportButton = document.getElementById('email-report-button');
    const tableBody = document.getElementById('packed-items-table-body');
    const totalChestsElement = document.getElementById('total-chests-value');
    const totalAmountChestsElement = document.getElementById('total-amount-chests');

    const dailyUsageButton = document.getElementById('daily-usage-button');
    const monthlyUsageButton = document.getElementById('monthly-usage-button');
    const yearlyUsageButton = document.getElementById('yearly-usage-button');
    const averageUsageReportDiv = document.getElementById('average-usage-report');

    const rowsPerPageSelect = document.getElementById('rows-per-page');
    const prevPageButton = document.getElementById('prev-page');
    const nextPageButton = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');

    // Initialization
    let packedItemsData = [];
    let currentPage = 1;
    const MAX_ROWS_PER_PAGE = 2500; // Maximaal 2500 items per pagina
    // Standaard altijd MAX_ROWS_PER_PAGE gebruiken
    let rowsPerPage = MAX_ROWS_PER_PAGE;

    // Initialize Bootstrap modal
    const reportModal = new bootstrap.Modal(document.getElementById('report-modal'));

    // Modal event listeners
    document.querySelectorAll('[data-bs-dismiss="modal"]').forEach(button => {
        button.addEventListener('click', () => {
            reportModal.hide();
        });
    });

    // Pagination event listeners
    rowsPerPageSelect.addEventListener('change', () => {
        const selectedValue = rowsPerPageSelect.value;
        // Als 'all' gekozen wordt, wordt de totale lengte gevraagd,
        // maar we beperken dit met MAX_ROWS_PER_PAGE.
        let value = selectedValue === 'all' ? packedItemsData.length : parseInt(selectedValue);
        rowsPerPage = Math.min(value, MAX_ROWS_PER_PAGE);
        currentPage = 1;
        updateTable(packedItemsData);
    });

    prevPageButton.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            updateTable(packedItemsData);
        }
    });

    nextPageButton.addEventListener('click', () => {
        if (currentPage * rowsPerPage < packedItemsData.length) {
            currentPage++;
            updateTable(packedItemsData);
        }
    });

    // Usage report buttons
    dailyUsageButton.addEventListener('click', () => fetchAverageUsageReport('day'));
    monthlyUsageButton.addEventListener('click', () => fetchAverageUsageReport('month'));
    yearlyUsageButton.addEventListener('click', () => fetchAverageUsageReport('year'));

    // Main button handlers
    filterButton.addEventListener('click', () => {
        const dateFrom = document.getElementById('date-from').value;
        const dateTo = document.getElementById('date-to').value;
        const searchQuery = document.getElementById('search').value.toLowerCase();

        const dateFromStart = new Date(dateFrom);
        dateFromStart.setHours(0, 0, 0, 0);
        const dateToEnd = new Date(dateTo);
        dateToEnd.setHours(23, 59, 59, 999);

        const queryParams = new URLSearchParams({
            date_from: dateFromStart.toISOString(),
            date_to: dateToEnd.toISOString(),
            search: searchQuery
        });

        fetch(`/api/packed_items_airtec?${queryParams.toString()}`)
            .then(response => response.json())
            .then(data => {
                packedItemsData = data;
                filterTable();
            })
            .catch(error => console.error('Error fetching packed items:', error));
    });

    downloadButton.addEventListener('click', () => {
        const dateFrom = document.getElementById('date-from').value;
        const dateTo = document.getElementById('date-to').value;
        const searchQuery = document.getElementById('search').value.toLowerCase();

        const queryParams = new URLSearchParams({
            date_from: dateFrom || '',
            date_to: dateTo || '',
            search: searchQuery
        });

        fetch(`/api/packed_items_airtec/download?${queryParams.toString()}`)
            .then(response => response.blob())
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                const filename = `Coolers & Elementen verpakt ${moment().format('DD-MM-YYYY')}.xlsx`;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
            })
            .catch(error => console.error('Error downloading packed items:', error));
    });

    emailButton.addEventListener('click', () => {
        const dateFrom = document.getElementById('date-from').value;
        const dateTo = document.getElementById('date-to').value;
        const searchQuery = document.getElementById('search').value.toLowerCase();

        const queryParams = new URLSearchParams({
            date_from: dateFrom || '',
            date_to: dateTo || '',
            search: searchQuery
        });

        fetch(`/api/packed_items_airtec/send_email?${queryParams.toString()}`, {
            method: 'POST'
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                alert('Email sent successfully!');
            } else {
                alert('Failed to send email.');
            }
        })
        .catch(error => console.error('Error sending email:', error));
    });

    reportButton.addEventListener('click', () => {
    const dateFrom = document.getElementById('date-from').value;
    const dateTo = document.getElementById('date-to').value;
    const searchQuery = document.getElementById('search').value.toLowerCase();

    const dateFromStart = new Date(dateFrom);
    dateFromStart.setHours(0, 0, 0, 0);
    const dateToEnd = new Date(dateTo);
    dateToEnd.setHours(23, 59, 59, 999);

    const queryParams = new URLSearchParams({
        date_from: dateFromStart.toISOString(),
        date_to: dateToEnd.toISOString(),
        search: searchQuery
    });

    // First, fetch the raw data
    fetch(`/api/packed_items_airtec?${queryParams.toString()}`)
        .then(response => response.json())
        .then(data => {
            // Apply the same duplicate filtering logic used for the main table
            const filteredData = removeDuplicates(data);
            
            // Now calculate the chest usage report based on the filtered data
            const chestReport = {};
            let totalAmount = 0;
            
            filteredData.forEach(item => {
                if (item.kistnummer && item.quantity) {
                    if (!chestReport[item.kistnummer]) {
                        chestReport[item.kistnummer] = 0;
                    }
                    const quantity = parseInt(item.quantity) || 0;
                    chestReport[item.kistnummer] += quantity;
                    totalAmount += quantity;
                }
            });
            
            // Generate the report HTML
            let reportHtml = '<table class="table"><thead><tr><th>Chest Number</th><th>Total Quantity</th></tr></thead><tbody>';
            for (const [kistnummer, total_quantity] of Object.entries(chestReport)) {
                reportHtml += `<tr><td>${kistnummer}</td><td>${total_quantity}</td></tr>`;
            }
            reportHtml += '</tbody></table>';
            
            // Update the modal content
            document.getElementById('report-content').innerHTML = reportHtml;
            document.getElementById('total-amount-chests').textContent = totalAmount;
            reportModal.show();
        })
        .catch(error => console.error('Error fetching data for report:', error));
});

    downloadReportButton.addEventListener('click', () => {
        const dateFrom = document.getElementById('date-from').value;
        const dateTo = document.getElementById('date-to').value;

        const queryParams = new URLSearchParams({
            date_from: dateFrom || '',
            date_to: dateTo || ''
        });

        fetch(`/api/packed_items_airtec/download_report?${queryParams.toString()}`)
            .then(response => response.blob())
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = 'chest_usage_report.xlsx';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
            })
            .catch(error => console.error('Error downloading report:', error));
    });

    emailReportButton.addEventListener('click', () => {
        const dateFrom = document.getElementById('date-from').value;
        const dateTo = document.getElementById('date-to').value;

        const queryParams = new URLSearchParams({
            date_from: dateFrom || '',
            date_to: dateTo || ''
        });

        fetch(`/api/packed_items_airtec/send_report_email?${queryParams.toString()}`, {
            method: 'POST'
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                alert('Report email sent successfully!');
            } else {
                alert('Failed to send report email.');
            }
        })
        .catch(error => console.error('Error sending report email:', error));
    });

    // Search functionality
    document.getElementById('search').addEventListener('input', filterTable);

    // Helper functions
    function fetchAverageUsageReport(period) {
        fetch(`/api/packed_items_airtec/average_usage?period=${period}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => displayAverageUsageReport(data, period))
            .catch(error => console.error('Error fetching average usage report:', error));
    }

    function displayAverageUsageReport(data, period) {
        let reportHtml = '<table class="table"><thead><tr><th>Chest Number</th><th>Period</th><th>Average Quantity</th></tr></thead><tbody>';
        data.forEach(row => {
            reportHtml += `<tr><td>${row.kistnummer}</td><td>${row.period}</td><td>${row.average_quantity}</td></tr>`;
        });
        reportHtml += '</tbody></table>';
        averageUsageReportDiv.innerHTML = reportHtml;
    }

    function removeDuplicates(data) {
        const seen = new Set();
        return data.filter(item => {
            if (item.beschrijving && item.beschrijving.toLowerCase().includes('cooler')) {
                return true;
            }
            const duplicate = seen.has(item.lot_number);
            seen.add(item.lot_number);
            return !duplicate;
        });
    }

    function filterTable() {
        const searchQuery = document.getElementById('search').value.toLowerCase();

        const filteredData = packedItemsData.filter(item => 
            (item.beschrijving && item.beschrijving.toLowerCase().includes(searchQuery)) ||
            (item.item_number && item.item_number.toLowerCase().includes(searchQuery)) ||
            (item.lot_number && item.lot_number.toLowerCase().includes(searchQuery)) ||
            (item.kistnummer && item.kistnummer.toLowerCase().includes(searchQuery)) ||
            (item.divisie && item.divisie.toLowerCase().includes(searchQuery)) ||
            (item.id && item.id.toString().includes(searchQuery))
        );

        updateTable(filteredData);
    }

    function formatDateToBelgian(dateString) {
        return moment(dateString).format('DD/MM/YYYY');
    }

    function updateTable(data) {
        const uniqueData = removeDuplicates(data);
        const paginatedData = paginate(uniqueData, currentPage, rowsPerPage);
        tableBody.innerHTML = '';
        let totalQuantity = 0;

        paginatedData.forEach(item => {
            const row = document.createElement('tr');
            const datumOntvangen = item.datum_opgestuurd;
            row.innerHTML = `
                <td>${item.id || ''}</td>
                <td>${item.beschrijving || ''}</td>
                <td>${item.item_number || ''}</td>
                <td>${item.lot_number || ''}</td>
                <td>${item.datum_opgestuurd ? new Date(item.datum_opgestuurd).toLocaleDateString('nl-BE') : ''}</td>
                <td>${item.kistnummer || ''}</td>
                <td>${item.divisie || ''}</td>
                <td>${item.quantity || 0}</td>
                <td>${datumOntvangen ? new Date(datumOntvangen).toLocaleDateString('nl-BE') : ''}</td>
                <td>${item.date_packed ? new Date(item.date_packed).toLocaleDateString('nl-BE') : ''}</td>
            `;
            tableBody.appendChild(row);
            totalQuantity += parseInt(item.quantity) || 0;
        });

        if (totalChestsElement) {
            totalChestsElement.textContent = totalQuantity;
        }
        pageInfo.textContent = `Pagina ${currentPage} van ${Math.ceil(uniqueData.length / rowsPerPage)}`;
    }

    function paginate(array, page_number, page_size) {
        return array.slice((page_number - 1) * page_size, page_number * page_size);
    }

    // Initial data load
    fetch('/api/packed_items_airtec')
        .then(response => response.json())
        .then(data => {
            packedItemsData = data;
            updateTable(packedItemsData);
        })
        .catch(error => console.error('Error fetching packed items:', error));
});
