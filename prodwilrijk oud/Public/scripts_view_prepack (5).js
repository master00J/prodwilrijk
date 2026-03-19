document.addEventListener('DOMContentLoaded', (event) => {
    // State management
    let goodsData = [];
    let filteredData = [];
    let uploadInProgress = false;
    let currentSort = {
    column: null,
    direction: 'asc'
};

    // DOM Elements
    const elements = {
        tableBody: document.getElementById('incoming-goods-table-body'),
        searchInput: document.getElementById('search'),
        selectAllCheckbox: document.getElementById('select-all'),
        confirmButton: document.getElementById('confirm-button'),
        incomingGoodsForm: document.getElementById('incoming-goods-form'),
        problemenForm: document.getElementById('problemen-form'),
        uploadExcelForm: document.getElementById('upload-excel-form'),
        uploadButton: document.getElementById('upload-button'),
        fileInput: document.getElementById('file-input'),
        responseMessage: document.getElementById('response-message'),
        problemenResponseMessage: document.getElementById('problemen-response-message'),
        uploadResponseMessage: document.getElementById('upload-response-message'),
        totalAmountValue: document.getElementById('total-amount-value'),
        headerPlaceholder: document.getElementById('header-placeholder')
    };

    // Initialize application
    initializeApp();

    // Main initialization function
    function initializeApp() {
        loadHeader();
        setupSortHeaders();
        fetchGoodsData();
        setupEventListeners();
    }
    
     // Setup sort headers
    function setupSortHeaders() {
        document.querySelectorAll('th[data-sort]').forEach(header => {
            header.addEventListener('click', () => {
                const column = header.getAttribute('data-sort');
                sortData(column);
            });
        });
    }

    // Sort function
    function sortData(column) {
        if (currentSort.column === column) {
            // Toggle direction if clicking the same column
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            // Set new column and default to ascending
            currentSort.column = column;
            currentSort.direction = 'asc';
        }

        updateSortIndicators();

        // Sort the data
        filteredData.sort((a, b) => {
            let valueA = a[column];
            let valueB = b[column];

            // Handle special cases
            if (column === 'received') {
                valueA = new Date(valueA || 0);
                valueB = new Date(valueB || 0);
            } else if (typeof valueA === 'string') {
                valueA = valueA.toLowerCase();
                valueB = valueB.toLowerCase();
            }

            if (valueA < valueB) return currentSort.direction === 'asc' ? -1 : 1;
            if (valueA > valueB) return currentSort.direction === 'asc' ? 1 : -1;
            return 0;
        });

        renderTable(filteredData);
    }

    // Update sort indicators
    function updateSortIndicators() {
        document.querySelectorAll('th .sort-indicator').forEach(indicator => {
            indicator.textContent = '';
        });

        const currentHeader = document.querySelector(`th[data-sort="${currentSort.column}"] .sort-indicator`);
        if (currentHeader) {
            currentHeader.textContent = currentSort.direction === 'asc' ? ' ↑' : ' ↓';
        }
    }
    
    function filterTable() {
        const query = elements.searchInput.value.toLowerCase();
        filteredData = goodsData.filter(item =>
            item.item_number.toLowerCase().includes(query) ||
            (item.pallet_number && item.pallet_number.toLowerCase().includes(query)) ||
            item.id.toString().includes(query)
        );

        if (currentSort.column) {
            sortData(currentSort.column);
        } else {
            renderTable(filteredData);
        }
    }

    // Header loading
    function loadHeader() {
        if (elements.headerPlaceholder) {
            fetch('header.html')
                .then(response => response.text())
                .then(data => {
                    elements.headerPlaceholder.innerHTML = data;
                })
                .catch(error => console.error('Error loading header:', error));
        }
    }

    // Data fetching
    function fetchGoodsData() {
        fetch('/api/incoming_goods')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                goodsData = data;
                filteredData = data;
                renderTable(filteredData);
            })
            .catch(error => {
                console.error('Error fetching incoming goods:', error);
                showError('Failed to fetch goods data');
            });
    }

    // Table rendering
    function renderTable(data) {
        if (!elements.tableBody) return;
        
        elements.tableBody.innerHTML = '';
        let totalAmount = 0;

        data.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
    <td>
        <input type="checkbox" class="item-checkbox" data-id="${item.id}">
        ${item.received ? new Date(item.received).toLocaleDateString() : ''}
    </td>
    <td>${item.id}</td>
    <td>${item.item_number}</td>
    <td>${item.po_number || 'N/A'}</td>
    <td>${item.amount}</td>
    <td><button class="delete-button btn btn-danger btn-sm" data-id="${item.id}">Delete</button></td>
`;
            elements.tableBody.appendChild(row);
            totalAmount += Number(item.amount);
        });

        if (elements.totalAmountValue) {
            elements.totalAmountValue.textContent = totalAmount;
        }
    }

    // Event listeners setup
    function setupEventListeners() {
        // Search functionality
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', filterTable);
        }

        // Delete button functionality
        document.addEventListener('click', handleDeleteClick);

        // Confirm button functionality
        if (elements.confirmButton) {
            elements.confirmButton.addEventListener('click', handleConfirmClick);
        }

        // Select all functionality
        if (elements.selectAllCheckbox) {
            elements.selectAllCheckbox.addEventListener('change', handleSelectAll);
        }

        // Form submissions
        setupFormListeners();

        // Excel upload
        setupExcelUpload();
    }

    // Table filtering
    function filterTable() {
        const query = elements.searchInput.value.toLowerCase();
        filteredData = goodsData.filter(item =>
            item.item_number.toLowerCase().includes(query) ||
            (item.pallet_number && item.pallet_number.toLowerCase().includes(query)) ||
            item.id.toString().includes(query)
        );
        renderTable(filteredData);
    }

    // Delete functionality
    function handleDeleteClick(event) {
        if (!event.target.classList.contains('delete-button')) return;

        const itemId = event.target.getAttribute('data-id');
        if (!itemId) return;

        deleteItem(itemId);
    }

    async function deleteItem(itemId) {
        try {
            const response = await fetch(`/api/delete_item/${itemId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to delete item');
            }

            const result = await response.json();

            if (result.success) {
                goodsData = goodsData.filter(item => item.id !== parseInt(itemId));
                filteredData = filteredData.filter(item => item.id !== parseInt(itemId));
                renderTable(filteredData);
                showSuccess('Item deleted successfully!');
            } else {
                showError('Failed to delete item');
            }
        } catch (error) {
            console.error('Error deleting item:', error);
            showError('Error deleting item');
        }
    }

    // Confirm functionality
    async function handleConfirmClick() {
        const checkedBoxes = document.querySelectorAll('.item-checkbox:checked');
        const checkedIds = Array.from(checkedBoxes).map(checkbox => checkbox.getAttribute('data-id'));

        if (checkedIds.length === 0) {
            showError('Please select items to confirm');
            return;
        }

        try {
            const response = await fetch('/confirm_items', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ids: checkedIds })
            });

            const result = await response.json();

            if (result.success) {
                showSuccess('Items confirmed successfully!');
                fetchGoodsData();
            } else {
                showError('Failed to confirm items');
            }
        } catch (error) {
            console.error('Error confirming items:', error);
            showError('Error confirming items');
        }
    }

    // Select all functionality
    function handleSelectAll() {
        const checkboxes = document.querySelectorAll('.item-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = elements.selectAllCheckbox.checked;
        });
    }

    // Form handling
    function setupFormListeners() {
        // Incoming goods form
        if (elements.incomingGoodsForm) {
            elements.incomingGoodsForm.addEventListener('submit', handleIncomingGoodsSubmit);
        }

        // Problemen form
        if (elements.problemenForm) {
            elements.problemenForm.addEventListener('submit', handleProblemenSubmit);
        }
    }

    async function handleIncomingGoodsSubmit(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        
        const data = {
            item_number: formData.get('item_number'),
            po_number: formData.get('po_number'),
            amount: formData.get('amount')
        };

        try {
            const response = await fetch('/api/incoming_goods', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify([data])
            });

            const result = await response.json();
            showSuccess('Incoming goods recorded successfully!');
            fetchGoodsData();
            event.target.reset();
        } catch (error) {
            console.error('Error:', error);
            showError('Failed to record incoming goods');
        }
    }

    async function handleProblemenSubmit(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        
        const data = {
            item_number: formData.get('item_number'),
            amount: formData.get('amount'),
            d_number: formData.get('d_number'),
            andere_informatie: formData.get('andere_informatie')
        };

        try {
            const response = await fetch('/api/problemen', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify([data])
            });

            const result = await response.json();
            showSuccess('Problemen item recorded successfully!', 'problemen-response-message');
            event.target.reset();
        } catch (error) {
            console.error('Error recording problemen item:', error);
            showError('Failed to record problemen item', 'problemen-response-message');
        }
    }

    // Excel upload handling
    function setupExcelUpload() {
        if (elements.uploadExcelForm && elements.uploadButton && elements.fileInput) {
            elements.uploadExcelForm.addEventListener('submit', handleExcelUpload);
        }
    }

    async function handleExcelUpload(event) {
        event.preventDefault();
        if (uploadInProgress) return;
        
        uploadInProgress = true;
        elements.uploadButton.disabled = true;

        try {
            const file = elements.fileInput.files[0];
            if (!file) {
                throw new Error('No file selected');
            }

            const data = await readFileAsArrayBuffer(file);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            const newGoods = jsonData.map(row => ({
                item_number: row['Itemnumber'] || row['Item Number'],
                po_number: row['PO Number'],
                amount: row['Amount']
            }));

            const existingGoods = await fetch('/api/incoming_goods').then(res => res.json());
            const uniqueGoods = filterDuplicates(newGoods, existingGoods);

            if (uniqueGoods.length > 0) {
                const response = await fetch('/upload_excel', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(uniqueGoods)
                });

                const result = await response.json();
                showSuccess(`${result.insertedRows} rows inserted successfully!`, 'upload-response-message');
                fetchGoodsData();
                elements.fileInput.value = '';
            } else {
                showInfo('No new unique items to insert', 'upload-response-message');
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            showError(`Error uploading file: ${error.message}`, 'upload-response-message');
        } finally {
            uploadInProgress = false;
            elements.uploadButton.disabled = false;
        }
    }

    // Utility functions
    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });
    }

    function filterDuplicates(newItems, existingItems) {
        const existingItemsMap = new Map(
            existingItems.map(item => [`${item.item_number}-${item.po_number}`, item])
        );
        return newItems.filter(item => 
            !existingItemsMap.has(`${item.item_number}-${item.po_number}`)
        );
    }

    function showSuccess(message, elementId = 'response-message') {
        showMessage(message, elementId, 'success');
    }

    function showError(message, elementId = 'response-message') {
        showMessage(message, elementId, 'error');
    }

    function showInfo(message, elementId = 'response-message') {
        showMessage(message, elementId, 'info');
    }

    function showMessage(message, elementId, type) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = message;
            element.style.display = 'block';
            element.className = `alert alert-${type}`;
            setTimeout(() => {
                element.style.display = 'none';
            }, 5000);
        }
    }

    // Export functions
    window.printTable = function() {
        const printContents = document.querySelector('.container').innerHTML;
        const originalContents = document.body.innerHTML;
        document.body.innerHTML = printContents;
        window.print();
        document.body.innerHTML = originalContents;
        window.location.reload();
    }

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
        link.download = 'incoming_goods.csv';
        link.click();
    }
});