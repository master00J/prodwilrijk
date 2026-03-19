document.addEventListener('DOMContentLoaded', () => {
    const handleError = (response) => {
        if (!response.ok) {
            throw Error(response.statusText);
        }
        return response.json();
    };

    // Load the header
    fetch('header.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById('header-placeholder').innerHTML = data;
        });

    const updateStockTable = () => {
        fetch('/api/stock_chests')
            .then(handleError)
            .then(stockData => {
                console.log('Stock Data:', stockData); // Log stock data to check
                fetchItemsToPack(stockData);
            })
            .catch(error => console.error('Error fetching stock chests:', error));
    };

    const fetchItemsToPack = (stockData) => {
        fetch('/api/items_to_pack_airtec')
            .then(handleError)
            .then(itemsToPackData => {
                console.log('Items to Pack Data:', itemsToPackData); // Log items to pack data
                const combinedTableBody = document.querySelector('#combined-stock-table tbody');
                combinedTableBody.innerHTML = ''; // Clear previous entries

                // Combine stockData and itemsToPackData by kistnummer
                const mergedData = {};

                // Helper function to clean and normalize kistnummer
                const cleanKistnummer = (kistnummer) => {
                    return kistnummer ? kistnummer.trim().toUpperCase() : ''; // Normalize case, trim spaces, and ensure no null values
                };

                // Step 1: Process stockData
                stockData.forEach(item => {
                    const cleanedKistnummer = cleanKistnummer(item.kistnummer);
                    if (!cleanedKistnummer) {
                        console.log('Skipping invalid kistnummer in stock data:', item); // Log skipped stock items with invalid kistnummer
                        return;
                    }

                    if (!mergedData[cleanedKistnummer]) {
                        mergedData[cleanedKistnummer] = {
                            kistnummer: cleanedKistnummer,
                            currentStock: item.quantity,
                            totalNeeded: 0 // We'll add this from items_to_pack_airtec
                        };
                    } else {
                        mergedData[cleanedKistnummer].currentStock += item.quantity; // Add quantities for same kistnummer
                    }
                });

                // Step 2: Process itemsToPackData and sum the quantities for each kistnummer
                itemsToPackData.forEach(item => {
                    const cleanedKistnummer = cleanKistnummer(item.kistnummer);
                    if (!cleanedKistnummer) {
                        console.log('Skipping invalid kistnummer in items to pack:', item); // Log skipped items with invalid kistnummer
                        return;
                    }

                    if (!mergedData[cleanedKistnummer]) {
                        mergedData[cleanedKistnummer] = {
                            kistnummer: cleanedKistnummer,
                            currentStock: 0,
                            totalNeeded: item.quantity // Add this quantity from items_to_pack_airtec
                        };
                    } else {
                        mergedData[cleanedKistnummer].totalNeeded += item.quantity; // Sum the quantities
                    }

                    // Log each item being processed to debug why some are skipped
                    console.log('Processing item:', item);
                });

                console.log('Merged Data:', mergedData); // Log merged data to check

                // Step 3: Populate the table with summed quantities
                Object.values(mergedData).forEach(item => {
                    const row = document.createElement('tr');
                    row.innerHTML = `<td>${item.kistnummer}</td><td>${item.currentStock}</td><td>${item.totalNeeded}</td>`;
                    combinedTableBody.appendChild(row);
                });
            })
            .catch(error => console.error('Error fetching items to pack:', error));
    };

    const addStock = (kistnummer, quantity) => {
        fetch('/api/add_stock_chests', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ kistnummer, quantity })
        })
        .then(handleError)
        .then(result => {
            if (result.success) {
                updateStockTable();
            } else {
                alert('Error adding stock');
            }
        })
        .catch(error => console.error('Error adding stock:', error));
    };

    document.getElementById('add-stock-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const kistnummer = formData.get('kistnummer');
        const quantity = formData.get('quantity');

        addStock(kistnummer, quantity);
    });

    // Initial table updates
    updateStockTable();
});
