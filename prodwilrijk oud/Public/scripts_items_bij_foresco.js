document.addEventListener('DOMContentLoaded', (event) => {
    // Load the header
    fetch('header.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById('header-placeholder').innerHTML = data;
        });

    // Fetch the confirmed items data
    fetch('/api/confirmed_items')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            const tableBody = document.getElementById('foresco-table-body');
            tableBody.innerHTML = ''; // Clear existing rows
            let totalAmount = 0;

            data.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${item.id}</td>
                    <td>${item.item_number}</td>
                    <td>${item.po_number}</td>
                    <td>${item.amount}</td>
                    <td>${new Date(item.date_added).toLocaleDateString()}</td>
                `;
                tableBody.appendChild(row);

                totalAmount += item.amount;
            });

            // Display the total amount
            document.getElementById('total-amount').textContent = `Total Amount: ${totalAmount}`;

            // Add search functionality
            const searchBar = document.getElementById('search-bar');
            searchBar.addEventListener('input', () => {
                const searchTerm = searchBar.value.toLowerCase();
                const rows = tableBody.getElementsByTagName('tr');
                Array.from(rows).forEach(row => {
                    const itemNumber = row.cells[1].textContent.toLowerCase();
                    const poNumber = row.cells[2].textContent.toLowerCase();
                    if (itemNumber.includes(searchTerm) || poNumber.includes(searchTerm)) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                });
            });

            // Add sorting functionality
            const headers = document.querySelectorAll('th');
            headers.forEach((header, index) => {
                header.addEventListener('click', () => {
                    sortTableByColumn(tableBody, index);
                });
            });
        })
        .catch(error => {
            console.error('Error fetching confirmed items:', error);
        });

    // Sort table by column index
    function sortTableByColumn(tableBody, columnIndex) {
        const rows = Array.from(tableBody.querySelectorAll('tr'));
        const sortedRows = rows.sort((a, b) => {
            const aText = a.children[columnIndex].textContent.trim();
            const bText = b.children[columnIndex].textContent.trim();
            if (columnIndex === 4) { // If sorting by Date Added column
                return new Date(aText) - new Date(bText);
            } else if (columnIndex === 3) { // If sorting by Amount column
                return parseFloat(aText) - parseFloat(bText);
            } else {
                return aText.localeCompare(bText);
            }
        });

        // Clear the table body and append sorted rows
        tableBody.innerHTML = '';
        sortedRows.forEach(row => {
            tableBody.appendChild(row);
        });
    }
});
