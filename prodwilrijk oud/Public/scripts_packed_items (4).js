document.addEventListener('DOMContentLoaded', (event) => {
    let allData = []; // Store all data for calculating the overall average

    // Load the header
    fetch('header.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById('header-placeholder').innerHTML = data;
        });

    const fetchData = (dateFrom, dateTo, search, showOverdue = false) => {
        let url = '/api/packed_items';
        const params = [];
        if (dateFrom) params.push(`date_from=${dateFrom}`);
        if (dateTo) params.push(`date_to=${dateTo}`);
        if (search) params.push(`search=${search}`);
        if (params.length > 0) url += '?' + params.join('&');

        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (!dateFrom && !dateTo && !search) {
                    // Store all data when no filters are applied
                    allData = data;
                }
                const tableBody = document.getElementById('packed-items-table-body');
                const totalPackedElement = document.getElementById('total-packed');
                const averagePackedElement = document.getElementById('average-packed');
                const averageStayDurationElement = document.getElementById('average-stay-duration');
                let totalPacked = 0;
                let totalStayDuration = 0;
                let count = 0;

                tableBody.innerHTML = ''; // Clear existing rows

                data.forEach(item => {
                    // Filter logic
                    const datePacked = new Date(item.date_packed);
                    const dateAdded = new Date(item.date_added);
                    const fromDate = dateFrom ? new Date(dateFrom) : null;
                    const toDate = dateTo ? new Date(dateTo) : null;
                    const stayDuration = (datePacked - dateAdded) / (1000 * 60 * 60 * 24); // Calculate stay duration in days

                    if ((!fromDate || datePacked >= fromDate) && (!toDate || datePacked <= toDate) &&
                        (!search || item.item_number.includes(search) || item.po_number.includes(search)) &&
                        (!showOverdue || stayDuration > 7)) {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>${item.id}</td>
                            <td>${item.item_number}</td>
                            <td>${item.po_number}</td>
                            <td>${item.amount}</td>
                            <td>${dateAdded.toLocaleDateString()}</td>
                            <td>${datePacked.toLocaleDateString()}</td>
                        `;
                        tableBody.appendChild(row);
                        totalPacked += item.amount;
                        totalStayDuration += stayDuration;
                        count++;
                    }
                });

                totalPackedElement.textContent = totalPacked;

                let averagePacked;
                if (dateFrom && dateTo) {
                    const dateFromValue = new Date(dateFrom);
                    const dateToValue = new Date(dateTo);
                    if (dateFromValue <= dateToValue) {
                        const timeDiff = Math.abs(dateToValue - dateFromValue);
                        const dayDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1;
                        averagePacked = totalPacked / dayDiff;
                    } else {
                        averagePacked = 0;
                    }
                } else {
                    // Calculate overall average
                    const totalDays = allData.length > 0 ? Math.ceil((new Date(allData[allData.length - 1].date_packed) - new Date(allData[0].date_packed)) / (1000 * 60 * 60 * 24)) + 1 : 0;
                    const overallTotalPacked = allData.reduce((sum, item) => sum + item.amount, 0);
                    averagePacked = overallTotalPacked / totalDays;
                }

                averagePackedElement.textContent = averagePacked.toFixed(2);
                averageStayDurationElement.textContent = (count > 0 ? (totalStayDuration / count).toFixed(2) : 0);
            })
            .catch(error => {
                console.error('Error fetching packed items:', error);
            });
    };

    // Initial fetch
    fetchData();

    // Add filter functionality
    document.getElementById('filter-button').addEventListener('click', () => {
        const dateFrom = document.getElementById('date-from').value;
        const dateTo = document.getElementById('date-to').value;
        const search = document.getElementById('search-input').value;
        fetchData(dateFrom, dateTo, search);
    });

    // Add real-time search functionality
    document.getElementById('search-input').addEventListener('input', () => {
        const dateFrom = document.getElementById('date-from').value;
        const dateTo = document.getElementById('date-to').value;
        const search = document.getElementById('search-input').value;
        fetchData(dateFrom, dateTo, search);
    });

    // Add overdue items functionality
    document.getElementById('show-overdue-button').addEventListener('click', () => {
        fetchData(null, null, null, true);
    });

    // Function to print the table
    window.printTable = function() {
        const printContents = document.querySelector('.container').innerHTML;
        const originalContents = document.body.innerHTML;
        document.body.innerHTML = printContents;
        window.print();
        document.body.innerHTML = originalContents;
        window.location.reload();
    }

    // Function to download the table as a CSV file
    window.downloadTable = function() {
        const rows = document.querySelectorAll('table tr');
        const csv = [];
        rows.forEach(row => {
            const cols = row.querySelectorAll('td, th');
            const rowCsv = [];
            cols.forEach(col => {
                rowCsv.push(col.innerText);
            });
            csv.push(rowCsv.join(','));
        });
        const csvString = csv.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'packed_items.csv';
        link.click();
    }
});
