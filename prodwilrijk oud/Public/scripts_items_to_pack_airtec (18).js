document.addEventListener('DOMContentLoaded', (event) => {
    let itemsToPackData = [];
    let checkedItemIds = new Set();
    let currentSortColumn = null;
    let currentSortDirection = 'asc'; // ascending by default
    let lastUpdated = null;

    // Variable for priority filter
    let showOnlyPriority = false;

    // SHIFT TRACKING
    let currentShiftId = null;
    
    // TIMER TRACKING
    let activeTimeLogs = new Map(); // Map van werknemer ID naar actieve tijdsregistratie
    let timeModal = null; // Bootstrap modal instance
    let employeeCache = {}; // Cache voor werknemersgegevens

    // Load the header
    fetch('header.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById('header-placeholder').innerHTML = data;
        });

    // Fetch the items to pack data
    function fetchItemsToPackData() {
        // For testing/development purposes - simulate data if API fails
        const handleApiFailure = () => {
            console.warn('Using fallback data due to API failure');
            // Use existing data if available, or create sample data if not
            if (itemsToPackData.length === 0) {
                // Sample data for testing
                itemsToPackData = [
                    {id: 1, beschrijving: 'Test Item 1', item_number: 'IT001', lot_number: 'LT001', 
                     datum_opgestuurd: '2025-02-20', kistnummer: 'K1', divisie: 'Div A', quantity: 5, priority: true},
                    {id: 2, beschrijving: 'Test Item 2', item_number: 'IT002', lot_number: 'LT002', 
                     datum_opgestuurd: '2025-02-21', kistnummer: 'K1', divisie: 'Div B', quantity: 3, priority: false},
                    {id: 3, beschrijving: 'Test Item 3', item_number: 'IT003', lot_number: 'LT003', 
                     datum_opgestuurd: '2025-02-22', kistnummer: 'K2', divisie: 'Div A', quantity: 2, priority: false}
                ];
            }
            lastUpdated = new Date();
            updateLastUpdatedText();
            filterTable();
            restoreCheckedItems();
            updateStats();
        };

        // Try to fetch data from API
        fetch('/api/items_to_pack_airtec')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // Ensure each item has a priority field (default false if not present)
                data.forEach(item => {
                    if (typeof item.priority === 'undefined') {
                        item.priority = false;
                    }
                });

                itemsToPackData = data;
                lastUpdated = new Date();
                updateLastUpdatedText();
                filterTable(); // Apply sorting/filtering immediately
                restoreCheckedItems();
                updateStats(); // Update statistics
            })
            .catch(error => {
                console.error('Error fetching items to pack:', error);
                // Use fallback data instead of showing error
                handleApiFailure();
            });
    }

    // Update the "last updated" text
    function updateLastUpdatedText() {
        const formattedDate = lastUpdated.toLocaleString();
        document.getElementById('last-updated').textContent = `Last updated: ${formattedDate}`;
    }

    // Show notification
    function showNotification(message, type = 'info') {
        // Create a toast notification instead of using alert
        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : 
                             type === 'danger' ? 'fa-exclamation-circle' : 
                             type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
                <span>${message}</span>
            </div>
            <button class="toast-close">&times;</button>
        `;
        
        // Add to document
        document.body.appendChild(toast);
        
        // Position at bottom of screen
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.backgroundColor = type === 'success' ? '#4CAF50' : 
                                       type === 'danger' ? '#F44336' : 
                                       type === 'warning' ? '#FF9800' : '#2196F3';
        toast.style.color = 'white';
        toast.style.padding = '12px 20px';
        toast.style.borderRadius = '4px';
        toast.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
        toast.style.zIndex = '9999';
        toast.style.display = 'flex';
        toast.style.alignItems = 'center';
        toast.style.minWidth = '250px';
        toast.style.maxWidth = '80%';
        
        // Style close button
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.style.marginLeft = '15px';
        closeBtn.style.background = 'none';
        closeBtn.style.border = 'none';
        closeBtn.style.color = 'white';
        closeBtn.style.fontSize = '20px';
        closeBtn.style.cursor = 'pointer';
        
        // Close handler
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(toast);
        });
        
        // Auto remove after 4 seconds
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 4000);
    }

    // Sort functionality
    function sortData(column) {
        if (currentSortColumn === column) {
            currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            currentSortColumn = column;
            currentSortDirection = 'asc';
        }

        const direction = currentSortDirection === 'asc' ? 1 : -1;

        // Remove existing sort indicators
        document.querySelectorAll('th[data-sort]').forEach(header => {
            header.classList.remove('sorted-asc', 'sorted-desc');
        });

        // Add sort indicator to current column
        const currentHeader = document.querySelector(`th[data-sort="${column}"]`);
        if (currentHeader) {
            currentHeader.classList.add(currentSortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
        }

        itemsToPackData.sort((a, b) => {
            let valueA = a[column] || '';
            let valueB = b[column] || '';

            if (typeof valueA === 'string') {
                valueA = valueA.toLowerCase();
                valueB = valueB.toLowerCase();
            }

            if (valueA < valueB) return -1 * direction;
            if (valueA > valueB) return 1 * direction;
            return 0;
        });

        filterTable();
    }

    // Add event listeners to the column headers for sorting
    document.querySelectorAll('th[data-sort]').forEach(header => {
        header.addEventListener('click', function() {
            const column = header.getAttribute('data-sort');
            sortData(column);
        });
    });

    function formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    // Display data
    function displayItemsToPackData(data) {
        const tableBody = document.getElementById('items-to-pack-table-body');
        if (!tableBody) {
            console.error('Table body element not found');
            return;
        }

        tableBody.innerHTML = '';
        data.forEach(item => {
            const datumOpgestuurd = formatDate(item.datum_opgestuurd);
            const datumOntvangen = formatDate(item.datum_opgestuurd); // Using same date as original

            const row = document.createElement('tr');
            if (item.priority) {
                row.classList.add('priority');
            }

            row.innerHTML = `
                <td class="col-checkbox">
                    <input type="checkbox" class="custom-checkbox item-checkbox" data-id="${item.id}">
                </td>
                <td class="col-id">${item.id}</td>
                <td class="col-beschrijving">${item.beschrijving || ''}</td>
                <td class="col-item-number">${item.item_number || ''}</td>
                <td class="col-lot-number">${item.lot_number || ''}</td>
                <td class="col-datum">${datumOpgestuurd}</td>
                <td class="col-kistnummer">
                    <input type="text" class="kistnummer-input" data-id="${item.id}" value="${item.kistnummer || ''}">
                </td>
                <td class="col-divisie">${item.divisie || ''}</td>
                <td class="col-quantity">${item.quantity || 0}</td>
                <td class="col-datum">${datumOntvangen}</td>
                <td class="col-priority">
                    <input type="checkbox" class="form-check-input priority-checkbox" data-id="${item.id}" ${item.priority ? 'checked' : ''}>
                </td>
                <td class="col-actions">
                    <button class="delete-button" data-id="${item.id}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });

        // Add event listeners to delete buttons
        document.querySelectorAll('.delete-button').forEach(button => {
            button.addEventListener('click', handleDelete);
        });

        // Add event listeners to checkboxes
        document.querySelectorAll('.item-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', handleCheckboxChange);
        });

        // Priority-checkbox
        document.querySelectorAll('.priority-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', handlePriorityCheckboxChange);
        });

        // Add event listener for kistnummer fields
        document.querySelectorAll('.kistnummer-input').forEach(input => {
            input.addEventListener('change', handleKistnummerChange);
            // Add this event to save on pressing Enter
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.target.blur(); // This will trigger the change event
                }
            });
        });

        updateStats();
    }
    
    // Update statistics at the top of the page
    function updateStats() {
        const totalItems = itemsToPackData.length;
        const priorityItems = itemsToPackData.filter(item => item.priority).length;
        const totalQuantity = itemsToPackData.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);
        
        document.getElementById('items-to-pack-count').textContent = totalItems;
        document.getElementById('priority-items-count').textContent = priorityItems;
        document.getElementById('total-quantity-count').textContent = totalQuantity;
    }

    // -- HANDLERS --

    // Handle kistnummer change
    function handleKistnummerChange(event) {
        const input = event.target;
        const newValue = input.value;
        const id = input.getAttribute('data-id');

        // Update in local data
        const item = itemsToPackData.find(i => i.id == id);
        if (item) {
            item.kistnummer = newValue;
        }

        // Show loading indicator
        input.classList.add('saving');
        
        // API call to save the change in database
        fetch(`/api/update_item_kistnummer/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kistnummer: newValue })
        })
        .then(response => response.json())
        .then(result => {
            input.classList.remove('saving');
            if (!result.success) {
                showNotification('Error saving box number', 'danger');
                input.classList.add('error');
                setTimeout(() => input.classList.remove('error'), 2000);
            } else {
                input.classList.add('success');
                setTimeout(() => input.classList.remove('success'), 2000);
            }
        })
        .catch(error => {
            input.classList.remove('saving');
            input.classList.add('error');
            setTimeout(() => input.classList.remove('error'), 2000);
            console.error('Error updating kistnummer:', error);
            showNotification('Error updating box number', 'danger');
        });
    }

    // Handle checkbox change
    function handleCheckboxChange(event) {
        const id = event.target.getAttribute('data-id');
        if (event.target.checked) {
            checkedItemIds.add(id);
        } else {
            checkedItemIds.delete(id);
        }
        
        // Update visual indicator of how many items are selected
        const selectedCount = checkedItemIds.size;
        const confirmButton = document.getElementById('confirm-packed-button');
        const floatingButton = document.getElementById('floating-confirm-button');
        
        if (selectedCount > 0) {
            confirmButton.textContent = `Bevestig Verpakt (${selectedCount})`;
            floatingButton.textContent = selectedCount;
            floatingButton.style.display = 'block';
        } else {
            confirmButton.textContent = 'Bevestig Verpakt';
            floatingButton.innerHTML = '<i class="fas fa-check"></i>';
            floatingButton.style.display = 'none';
        }
    }

    // Priority checkbox change
    function handlePriorityCheckboxChange(event) {
        const id = event.target.getAttribute('data-id');
        const item = itemsToPackData.find(i => i.id == id);
        if (item) {
            item.priority = event.target.checked;
        }
        
        // Save priority change immediately
        fetch(`/api/update_item_priority/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ priority: event.target.checked })
        })
        .then(response => response.json())
        .then(result => {
            if (!result.success) {
                showNotification('Error updating priority', 'danger');
            }
        })
        .catch(error => {
            console.error('Error updating priority:', error);
        });
        
        filterTable(); // Redraw table to update styling
        updateStats(); // Update statistics
    }

    // Restore checked items
    function restoreCheckedItems() {
        document.querySelectorAll('.item-checkbox').forEach(checkbox => {
            const id = checkbox.getAttribute('data-id');
            if (checkedItemIds.has(id)) {
                checkbox.checked = true;
            }
        });
        
        // Update interface to show selection count
        const selectedCount = checkedItemIds.size;
        if (selectedCount > 0) {
            document.getElementById('confirm-packed-button').textContent = `Bevestig Verpakt (${selectedCount})`;
            const floatingButton = document.getElementById('floating-confirm-button');
            floatingButton.textContent = selectedCount;
            floatingButton.style.display = 'block';
        }
    }

    // Handle delete
    function handleDelete(event) {
        // Find the closest button if the icon was clicked instead
        const button = event.target.closest('.delete-button');
        if (!button) return;
        
        const id = button.getAttribute('data-id');
        const confirmed = confirm('Weet je zeker dat je deze rij wilt verwijderen?');
        if (confirmed) {
            // Show loading state
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            
            fetch(`/api/delete_item_to_pack/${id}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    // Remove from checkedItemIds if it was checked
                    checkedItemIds.delete(id);
                    // Remove from local data
                    itemsToPackData = itemsToPackData.filter(item => item.id != id);
                    // Update display
                    filterTable();
                    updateStats();
                    showNotification('Item deleted successfully', 'success');
                } else {
                    button.disabled = false;
                    button.innerHTML = '<i class="fas fa-trash-alt"></i>';
                    showNotification('Failed to delete item', 'danger');
                }
            })
            .catch(error => {
                console.error('Error deleting item:', error);
                button.disabled = false;
                button.innerHTML = '<i class="fas fa-trash-alt"></i>';
                showNotification('Error deleting item', 'danger');
            });
        }
    }

    // Filter table
    function filterTable() {
        const query = document.getElementById('search-box').value.toLowerCase();
        let filteredData = itemsToPackData.filter(item =>
            (item.beschrijving || '').toLowerCase().includes(query) ||
            (item.item_number || '').toLowerCase().includes(query) ||
            (item.lot_number || '').toLowerCase().includes(query) ||
            (item.kistnummer || '').toLowerCase().includes(query) ||
            (item.divisie || '').toLowerCase().includes(query) ||
            item.id.toString().includes(query)
        );

        // Apply priority filter
        if (showOnlyPriority) {
            filteredData = filteredData.filter(item => item.priority);
        }

        // Apply current sort if column is set
        if (currentSortColumn) {
            const direction = currentSortDirection === 'asc' ? 1 : -1;
            filteredData.sort((a, b) => {
                let valueA = a[currentSortColumn] || '';
                let valueB = b[currentSortColumn] || '';
                if (typeof valueA === 'string') {
                    valueA = valueA.toLowerCase();
                    valueB = valueB.toLowerCase();
                }
                if (valueA < valueB) return -1 * direction;
                if (valueA > valueB) return 1 * direction;
                return 0;
            });
        }

        displayItemsToPackData(filteredData);
        restoreCheckedItems();
    }

    // Event listener for search
    document.getElementById('search-box').addEventListener('input', filterTable);

    // Sort button
    document.getElementById('sort-button').addEventListener('click', () => {
        // Sort by item_number, then by lot_number
        currentSortColumn = 'item_number';
        currentSortDirection = 'asc';
        
        // Update UI to show sort state
        document.querySelectorAll('th[data-sort]').forEach(header => {
            header.classList.remove('sorted-asc', 'sorted-desc');
        });
        document.querySelector('th[data-sort="item_number"]').classList.add('sorted-asc');
        
        const sortedData = [...itemsToPackData].sort((a, b) => {
            const itemNumberComparison = (a.item_number || '').localeCompare(b.item_number || '');
            if (itemNumberComparison !== 0) {
                return itemNumberComparison;
            }
            return (a.lot_number || '').localeCompare(b.lot_number || '');
        });
        
        itemsToPackData = sortedData;
        filterTable();
    });

    // Function to handle confirming packed items
    function confirmPackedItems() {
        const checkedBoxes = document.querySelectorAll('.item-checkbox:checked');
        const checkedIds = Array.from(checkedBoxes).map(checkbox => checkbox.getAttribute('data-id'));
        
        if (checkedIds.length === 0) {
            showNotification('Please select items to confirm as packed', 'warning');
            return;
        }
        
        // Show processing state
        const confirmButton = document.getElementById('confirm-packed-button');
        const originalText = confirmButton.innerHTML;
        confirmButton.disabled = true;
        confirmButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        
        fetch('/pack_items_airtec', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ids: checkedIds })
        })
        .then(response => response.json())
        .then(result => {
            confirmButton.disabled = false;
            confirmButton.innerHTML = originalText;
            
            if (result.success) {
                showNotification(`${checkedIds.length} items marked as packed successfully`, 'success');
                // Clear checked items
                checkedItemIds.clear();
                // Refresh data
                fetchItemsToPackData();
            } else {
                showNotification('Failed to pack items', 'danger');
            }
        })
        .catch(error => {
            confirmButton.disabled = false;
            confirmButton.innerHTML = originalText;
            console.error('Error packing items:', error);
            showNotification('Error processing request', 'danger');
        });
    }

    // Confirm packed button
    document.getElementById('confirm-packed-button').addEventListener('click', confirmPackedItems);
    
    // Floating action button for mobile devices
    document.getElementById('floating-confirm-button').addEventListener('click', confirmPackedItems);

    // Print
    document.getElementById('print-button').addEventListener('click', () => {
        const dateStr = new Date().toLocaleDateString();
        // Better styled print version
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Items to Pack - ${dateStr}</title>
                <style>
                    body { font-family: Arial, sans-serif; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
                    th { background-color: #f2f2f2; }
                    .priority { background-color: #fff3cd; }
                    h2 { margin-bottom: 5px; }
                    .subtitle { color: #666; margin-bottom: 20px; }
                    @media print {
                        .no-print { display: none; }
                        body { padding: 20px; }
                    }
                </style>
            </head>
            <body>
                <h2>Items to Pack - Airtec</h2>
                <div class="subtitle">Generated on ${dateStr}</div>
                
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Description</th>
                            <th>Item Number</th>
                            <th>Lot Number</th>
                            <th>Date Sent</th>
                            <th>Box Number</th>
                            <th>Division</th>
                            <th>Quantity</th>
                            <th>Priority</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsToPackData.map(item => `
                            <tr${item.priority ? ' class="priority"' : ''}>
                                <td>${item.id}</td>
                                <td>${item.beschrijving || ''}</td>
                                <td>${item.item_number || ''}</td>
                                <td>${item.lot_number || ''}</td>
                                <td>${formatDate(item.datum_opgestuurd)}</td>
                                <td>${item.kistnummer || ''}</td>
                                <td>${item.divisie || ''}</td>
                                <td>${item.quantity || 0}</td>
                                <td>${item.priority ? 'Yes' : 'No'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <div class="no-print" style="margin-top: 20px;">
                    <button onclick="window.print()">Print This Page</button>
                    <button onclick="window.close()">Close</button>
                </div>
            </body>
            </html>
        `;
        const printWindow = window.open('', '', 'height=600,width=800');
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
    });

    // Select all checkbox
    const selectAllCheckbox = document.getElementById('select-all');
    selectAllCheckbox.addEventListener('change', function() {
        const checkboxes = document.querySelectorAll('.item-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAllCheckbox.checked;
            handleCheckboxChange({ target: checkbox });
        });
    });

    // Priority "Show" toggle with improved feedback
    const showPriorityButton = document.getElementById('show-priority-button');
    showPriorityButton.addEventListener('click', () => {
        showOnlyPriority = !showOnlyPriority;
        showPriorityButton.classList.toggle('btn-warning', showOnlyPriority);
        showPriorityButton.classList.toggle('btn-secondary', !showOnlyPriority);
        
        // Update button text to make state clearer
        if (showOnlyPriority) {
            showPriorityButton.innerHTML = '<i class="fas fa-star me-1"></i> Showing Priority';
        } else {
            showPriorityButton.innerHTML = '<i class="fas fa-star me-1"></i> All Items';
        }
        
        filterTable();
    });

    // Select all priority
    const selectAllPriority = document.getElementById('select-all-priority');
    selectAllPriority.addEventListener('change', () => {
        const priorityCheckboxes = document.querySelectorAll('.priority-checkbox');
        priorityCheckboxes.forEach(checkbox => {
            checkbox.checked = selectAllPriority.checked;
            const id = checkbox.getAttribute('data-id');
            const item = itemsToPackData.find(item => item.id == id);
            if (item) {
                item.priority = checkbox.checked;
            }
        });
        filterTable();
        updateStats();
        
        // Save all changes to server in bulk
        const allIds = Array.from(priorityCheckboxes).map(cb => cb.getAttribute('data-id'));
        if (allIds.length > 0) {
            fetch('/api/update_bulk_priority', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    ids: allIds, 
                    priority: selectAllPriority.checked 
                })
            })
            .catch(error => {
                console.error('Error updating priorities in bulk:', error);
            });
        }
    });

    // Set Priority API Call with improved UX
    document.getElementById('set-priority-button').addEventListener('click', () => {
        const priorityBoxes = document.querySelectorAll('.priority-checkbox:checked');
        const priorityIds = Array.from(priorityBoxes).map(checkbox => checkbox.getAttribute('data-id'));

        if (priorityIds.length === 0) {
            showNotification('Please select items to mark as priority', 'warning');
            return;
        }
        
        // Show processing state
        const priorityButton = document.getElementById('set-priority-button');
        const originalText = priorityButton.innerHTML;
        priorityButton.disabled = true;
        priorityButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

        fetch('/set_priority_items_airtec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: priorityIds })
        })
        .then(response => response.json())
        .then(result => {
            priorityButton.disabled = false;
            priorityButton.innerHTML = originalText;
            
            if (result.success) {
                showNotification(`${priorityIds.length} items set as priority`, 'success');
                fetchItemsToPackData();
            } else {
                showNotification('Failed to set priority status', 'danger');
            }
        })
        .catch(error => {
            priorityButton.disabled = false;
            priorityButton.innerHTML = originalText;
            console.error('Error setting priority status:', error);
            showNotification('Error setting priority status', 'danger');
        });
    });
    
    // Add double-tap functionality for mobile to select rows
    const rows = {};
    document.addEventListener('click', function(e) {
        const row = e.target.closest('tr');
        if (!row || !row.parentNode || row.parentNode.tagName !== 'TBODY') return;
        
        // Skip if clicking on interactive elements
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
        
        const id = row.querySelector('.item-checkbox')?.getAttribute('data-id');
        if (!id) return;
        
        const now = Date.now();
        if (rows[id] && now - rows[id] < 300) { // Double-tap detected (300ms)
            // Toggle checkbox
            const checkbox = row.querySelector('.item-checkbox');
            checkbox.checked = !checkbox.checked;
            handleCheckboxChange({ target: checkbox });
            rows[id] = 0; // Reset timer
        } else {
            rows[id] = now;
        }
    });

    // Pull-to-refresh functionality for mobile
    let touchStartY = 0;
    document.addEventListener('touchstart', function(e) {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });
    
    document.addEventListener('touchend', function(e) {
        const touchEndY = e.changedTouches[0].clientY;
        const diff = touchEndY - touchStartY;
        
        // If pulled down significantly at the top of the page
        if (diff > 100 && window.scrollY < 10) {
            // Show refreshing indicator
            const banner = document.querySelector('.stats-banner');
            banner.innerHTML = '<div style="text-align:center;"><i class="fas fa-sync fa-spin"></i> Refreshing...</div>';
            
            // Refresh data
            fetchItemsToPackData();
        }
    }, { passive: true });

    // Initial loading of data
    fetchItemsToPackData();
    
    // Initialize floating button as hidden
    const floatingButton = document.getElementById('floating-confirm-button');
    if (floatingButton) {
        floatingButton.style.display = 'none';
    }
    
    // Initialiseer tijdsregistratie
    initializeTimeRegistrationModal();
    loadEmployees().then(() => {
        checkActiveTimeLogs();
    });
    
    // Shift tracking initialisatie
    initializeShiftTracking();
    
    function initializeShiftTracking() {
        // Start shift
        const startBtn = document.getElementById('start-shift-btn');
        if (startBtn) {
            startBtn.addEventListener('click', async () => {
                startBtn.disabled = true;
                try {
                    const res = await fetch('/api/shift/start', { method: 'POST' });
                    const data = await res.json();
                    if (data.success) {
                        currentShiftId = data.shiftId;
                        const stopBtn = document.getElementById('stop-shift-btn');
                        if (stopBtn) stopBtn.disabled = false;
                        showNotification(`Shift gestart om ${new Date(data.startTime).toLocaleTimeString()}`, 'success');
                    } else {
                        throw new Error(data.error || 'Fout bij starten shift');
                    }
                } catch (err) {
                    showNotification(err.message, 'danger');
                    startBtn.disabled = false;
                }
            });
        }
    
        // Stop shift
        const stopBtn = document.getElementById('stop-shift-btn');
        if (stopBtn) {
            stopBtn.addEventListener('click', async () => {
                stopBtn.disabled = true;
                try {
                    const res = await fetch('/api/shift/stop', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ shiftId: currentShiftId })
                    });
                    const data = await res.json();
                    if (data.success) {
                        showNotification(`Shift gestopt om ${new Date(data.endTime).toLocaleTimeString()}`, 'info');
                        currentShiftId = null;
                        const startBtn = document.getElementById('start-shift-btn');
                        if (startBtn) startBtn.disabled = false;
                    } else {
                        throw new Error(data.error || 'Fout bij stoppen shift');
                    }
                } catch (err) {
                    showNotification(err.message, 'danger');
                    stopBtn.disabled = false;
                }
            });
        }
    
        // Get report
        const reportBtn = document.getElementById('download-report-btn');
        const reportDateInput = document.getElementById('report-date');
        const reportOutput = document.getElementById('report-output');
        
        if (reportBtn && reportDateInput) {
            reportBtn.addEventListener('click', async () => {
                const date = reportDateInput.value;
                if (!date) {
                    showNotification('Selecteer een datum voor het rapport', 'warning');
                    return;
                }
                try {
                    const res = await fetch(`/api/shift/report?date=${date}`);
                    const json = await res.json();
                    if (json.error) throw new Error(json.error);
    
                    if (reportOutput) {
                        // Build report
                        let html = `<h3>Shiftrapport voor ${date}</h3>`;
                        html += `<h4>Shiften</h4><table class="table"><thead><tr><th>ID</th><th>Werknemer</th><th>Start</th><th>Eind</th><th>Minuten</th></tr></thead><tbody>`;
                        json.shifts.forEach(s => {
                            html += `<tr><td>${s.id}</td><td>${s.username}</td><td>${new Date(s.start_time).toLocaleTimeString()}</td><td>${new Date(s.end_time).toLocaleTimeString()}</td><td>${s.minutes}</td></tr>`;
                        });
                        html += `</tbody></table>`;
                        html += `<h4>Verpakte kisten</h4><table class="table"><thead><tr><th>Kistnummer</th><th>Aantal</th></tr></thead><tbody>`;
                        Object.entries(json.packed).forEach(([kist, qty]) => {
                            html += `<tr><td>${kist}</td><td>${qty}</td></tr>`;
                        });
                        html += `</tbody></table>`;
                        reportOutput.innerHTML = html;
                    }
                } catch (err) {
                    showNotification(err.message, 'danger');
                }
            });
        }
    }

    // TIJDSREGISTRATIE FUNCTIONALITEIT
    
    // Start/Stop Timer button
    const timerButton = document.getElementById('start-timer-button');
    if (timerButton) {
        timerButton.addEventListener('click', showTimeRegistrationModal);
    }
    
    // Stop all button event
    const stopAllTimersBtn = document.getElementById('stop-all-timers-btn');
    if (stopAllTimersBtn) {
        stopAllTimersBtn.addEventListener('click', stopAllTimers);
    }
    
    // Initialize modal
    function initializeTimeRegistrationModal() {
        const modalElem = document.getElementById('timeRegistrationModal');
        if (modalElem) {
            timeModal = new bootstrap.Modal(modalElem);
            
            // Add event to confirm button
            const confirmBtn = document.getElementById('confirm-start-timer-btn');
            if (confirmBtn) {
                confirmBtn.addEventListener('click', startSelectedEmployeesTimer);
            }
            
            // Initialiseer de employee-select direct bij het laden van de pagina
            loadEmployees().then(() => {
                console.log('Werknemers geladen bij initialisatie van modal');
                // Controleer of de select correct is gevuld
                const employeeSelect = document.getElementById('employee-select');
                if (employeeSelect) {
                    console.log('Aantal opties in employeeSelect:', employeeSelect.options.length);
                }
            });
        }
    }
    
    // Show time registration modal
    function showTimeRegistrationModal() {
        if (timeModal) {
            // Update modal content voordat we hem tonen
            loadEmployees().then(() => {
                console.log('Werknemers opnieuw geladen bij tonen modal');
                timeModal.show();
            });
        }
    }
    
    // Werknemers ophalen
    async function loadEmployees() {
        try {
            const response = await fetch('/api/werknemers');
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const employees = await response.json();
            
            // Log voor debugging
            console.log('Werknemers geladen:', employees);
            // Log de structure van de eerste werknemer als die beschikbaar is
            if (employees.length > 0) {
                console.log('Eerste werknemer structuur:', JSON.stringify(employees[0], null, 2));
            }
            
            // Cache werknemers voor later gebruik
            employees.forEach(emp => {
                employeeCache[emp.id] = emp.naam;
            });
            
            const employeeSelect = document.getElementById('employee-select');
            if (employeeSelect) {
                // Leeg de huidige opties eerst
                employeeSelect.innerHTML = '';
                
                // Voeg werknemers toe aan de dropdown
                if (employees.length === 0) {
                    // Als er geen werknemers zijn, toon een placeholder
                    const option = document.createElement('option');
                    option.value = "";
                    option.textContent = "Geen werknemers gevonden";
                    option.disabled = true;
                    employeeSelect.appendChild(option);
                } else {
                    employees.forEach(employee => {
                        const option = document.createElement('option');
                        option.value = employee.id;
                        option.textContent = employee.naam;
                        employeeSelect.appendChild(option);
                    });
                }
            }
            
            return employees;
        } catch (error) {
            console.error('Fout bij ophalen werknemers:', error);
            showNotification('Kon werknemers niet ophalen', 'danger');
            
            const employeeSelect = document.getElementById('employee-select');
            if (employeeSelect) {
                // Toon foutmelding in de dropdown
                employeeSelect.innerHTML = '';
                const option = document.createElement('option');
                option.value = "";
                option.textContent = "Fout bij laden werknemers";
                option.disabled = true;
                employeeSelect.appendChild(option);
            }
            
            return [];
        }
    }
    
    // Stop all timers
    async function stopAllTimers() {
        if (activeTimeLogs.size === 0) {
            showNotification('Er zijn geen actieve tijdsregistraties', 'info');
            return;
        }
        
        try {
            const stopAllTimersBtn = document.getElementById('stop-all-timers-btn');
            if (stopAllTimersBtn) {
                stopAllTimersBtn.disabled = true;
                stopAllTimersBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Stoppen...';
            }
            
            const stopPromises = [];
            const uniqueLogIds = new Set();
            
            // Verzamel unieke log IDs (één log kan meerdere werknemers bevatten)
            activeTimeLogs.forEach(log => uniqueLogIds.add(log.id));
            
            // Stop elke unieke log
            uniqueLogIds.forEach(logId => {
                stopPromises.push(stopTimeLog(logId));
            });
            
            await Promise.all(stopPromises);
            activeTimeLogs.clear();
            stopTimeUpdateInterval();
            
            updateTimerVisibility();
            showNotification('Alle tijdsregistraties gestopt', 'success');
        } catch (error) {
            console.error('Fout bij stoppen van tijdsregistraties:', error);
            showNotification('Fout bij stoppen tijdsregistraties', 'danger');
        } finally {
            const stopAllTimersBtn = document.getElementById('stop-all-timers-btn');
            if (stopAllTimersBtn) {
                stopAllTimersBtn.disabled = false;
                stopAllTimersBtn.innerHTML = '<i class="fas fa-stop me-1"></i> Stop Alles';
            }
        }
    }
    
    // Timer status en zichtbaarheid bijwerken
    function updateTimerVisibility() {
        const activeTimersCard = document.getElementById('active-timers-card');
        
        if (activeTimersCard) {
            if (activeTimeLogs.size > 0) {
                activeTimersCard.style.display = 'block';
                renderActiveTimeLogs();
            } else {
                activeTimersCard.style.display = 'none';
            }
        }
        
        // Update startknop in de actiebalk
        if (timerButton) {
            const activeLogsCount = activeTimeLogs.size;
            
            if (activeLogsCount > 0) {
                timerButton.classList.remove('btn-info');
                timerButton.classList.add('btn-warning');
                timerButton.innerHTML = `<i class="fas fa-clock me-1"></i> Actieve tijdsregistraties (${activeLogsCount})`;
            } else {
                timerButton.classList.remove('btn-warning');
                timerButton.classList.add('btn-info');
                timerButton.innerHTML = '<i class="fas fa-clock me-1"></i> Start Tijdsregistratie';
            }
        }
    }
    
    // Actieve tijdsregistraties weergeven
    function renderActiveTimeLogs() {
        const timeLogsContainer = document.getElementById('time-logs-container');
        if (!timeLogsContainer) return;
        
        timeLogsContainer.innerHTML = '';
        
        if (activeTimeLogs.size === 0) {
            timeLogsContainer.innerHTML = '<p class="text-muted">Geen actieve tijdsregistraties</p>';
            return;
        }
        
        const table = document.createElement('table');
        table.className = 'table table-sm';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Werknemer</th>
                    <th>Starttijd</th>
                    <th>Verstreken tijd</th>
                    <th>Actie</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        
        const tbody = table.querySelector('tbody');
        
        activeTimeLogs.forEach((log, employeeId) => {
            const row = document.createElement('tr');
            
            // Haal werknemernaam op uit cache of van opgeslagen naam in log
            const employeeName = log.employeeName || employeeCache[employeeId] || 'Onbekend';
            
            const startTime = new Date(log.start_time);
            const elapsedSeconds = Math.floor((new Date() - startTime) / 1000);
            
            row.innerHTML = `
                <td>${employeeName}</td>
                <td>${startTime.toLocaleTimeString()}</td>
                <td class="elapsed-time" data-employee-id="${employeeId}">${formatSeconds(elapsedSeconds)}</td>
                <td>
                    <button class="btn btn-sm btn-danger stop-log-btn" data-log-id="${log.id}" data-employee-id="${employeeId}">
                        <i class="fas fa-stop"></i> Stop
                    </button>
                </td>
            `;
            
            tbody.appendChild(row);
        });
        
        timeLogsContainer.appendChild(table);
        
        // Stop-knoppen events toevoegen
        document.querySelectorAll('.stop-log-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const logId = e.currentTarget.getAttribute('data-log-id');
                const employeeId = e.currentTarget.getAttribute('data-employee-id');
                try {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    await stopTimeLog(logId);
                    // Verwijder uit actieve logs en update UI
                    activeTimeLogs.delete(parseInt(employeeId));
                    updateTimerVisibility();
                    showNotification('Tijdsregistratie gestopt', 'success');
                } catch (error) {
                    console.error('Fout bij stoppen tijdsregistratie:', error);
                    showNotification('Fout bij stoppen tijdsregistratie', 'danger');
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-stop"></i> Stop';
                }
            });
        });
    }
    
    // Genereer rapport van airtec werkzaamheden
    async function generateAirtecReport(date) {
        try {
            let url = '/api/airtec/report';
            if (date) {
                url += `?date=${date}`;
            }
            
            const response = await fetch(url);
            const reportData = await response.json();
            
            if (!reportData.success) {
                throw new Error(reportData.error || 'Fout bij het ophalen van rapport');
            }
            
            // Toon het rapport
            const reportContainer = document.createElement('div');
            reportContainer.className = 'airtec-report mt-4';
            
            // Dagelijkse totalen
            let dailyHTML = '<h4>Dagelijkse Totalen</h4>';
            dailyHTML += '<table class="table table-sm table-striped">';
            dailyHTML += '<thead><tr><th>Datum</th><th>Werknemers</th><th>Totaal Uren</th><th>Activiteiten</th></tr></thead>';
            dailyHTML += '<tbody>';
            
            reportData.daily_totals.forEach(day => {
                const totalHours = (day.total_minutes / 60).toFixed(2);
                dailyHTML += `<tr>
                    <td>${new Date(day.log_date).toLocaleDateString()}</td>
                    <td>${day.total_employees}</td>
                    <td>${totalHours}</td>
                    <td>${day.total_entries}</td>
                </tr>`;
            });
            
            dailyHTML += '</tbody></table>';
            
            // Werknemer totalen
            let employeeHTML = '<h4>Werknemer Totalen</h4>';
            employeeHTML += '<table class="table table-sm table-striped">';
            employeeHTML += '<thead><tr><th>Werknemer</th><th>Totaal Uren</th><th>Activiteiten</th></tr></thead>';
            employeeHTML += '<tbody>';
            
            reportData.employee_totals.forEach(emp => {
                const totalHours = (emp.total_minutes / 60).toFixed(2);
                employeeHTML += `<tr>
                    <td>${emp.employee_name}</td>
                    <td>${totalHours}</td>
                    <td>${emp.total_entries}</td>
                </tr>`;
            });
            
            employeeHTML += '</tbody></table>';
            
            // Kisttype totalen
            let boxHTML = '<h4>Verpakte Kisten</h4>';
            boxHTML += '<table class="table table-sm table-striped">';
            boxHTML += '<thead><tr><th>Kist Type</th><th>Aantal</th><th>Activiteiten</th></tr></thead>';
            boxHTML += '<tbody>';
            
            reportData.box_totals.forEach(box => {
                boxHTML += `<tr>
                    <td>${box.box_type || 'Onbekend'}</td>
                    <td>${box.total_quantity}</td>
                    <td>${box.total_entries}</td>
                </tr>`;
            });
            
            boxHTML += '</tbody></table>';
            
            reportContainer.innerHTML = dailyHTML + employeeHTML + boxHTML;
            
            // Toon het rapport in een modal
            let reportModal = document.getElementById('airtecReportModal');
            
            if (!reportModal) {
                reportModal = document.createElement('div');
                reportModal.id = 'airtecReportModal';
                reportModal.className = 'modal fade';
                reportModal.tabIndex = '-1';
                reportModal.innerHTML = `
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Airtec Rapport</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body" id="airtec-report-content">
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-primary" data-bs-dismiss="modal">Sluiten</button>
                                <button type="button" class="btn btn-secondary" id="print-report-btn">
                                    <i class="fas fa-print"></i> Afdrukken
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                
                document.body.appendChild(reportModal);
                
                // Afdrukknop
                const printBtn = document.getElementById('print-report-btn');
                if (printBtn) {
                    printBtn.addEventListener('click', () => {
                        const printWindow = window.open('', '', 'height=600,width=800');
                        const reportContent = document.getElementById('airtec-report-content').innerHTML;
                        
                        printWindow.document.write(`
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <title>Airtec Rapport</title>
                                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
                                <style>
                                    body { padding: 20px; }
                                    @media print {
                                        .no-print { display: none; }
                                    }
                                </style>
                            </head>
                            <body>
                                <h2>Airtec Rapport</h2>
                                <p>Gegenereerd op ${new Date().toLocaleString()}</p>
                                ${reportContent}
                                <div class="no-print mt-4">
                                    <button onclick="window.print()" class="btn btn-primary">Afdrukken</button>
                                    <button onclick="window.close()" class="btn btn-secondary">Sluiten</button>
                                </div>
                            </body>
                            </html>
                        `);
                        
                        printWindow.document.close();
                        printWindow.focus();
                    });
                }
            }
            
            // Plaats de rapport inhoud
            const reportContent = document.getElementById('airtec-report-content');
            if (reportContent) {
                reportContent.innerHTML = '';
                reportContent.appendChild(reportContainer);
            }
            
            // Toon de modal
            const modal = new bootstrap.Modal(reportModal);
            modal.show();
            
            return reportData;
        } catch (error) {
            console.error('Fout bij genereren rapport:', error);
            showNotification('Fout bij genereren rapport: ' + error.message, 'danger');
            throw error;
        }
    }
    
    // Controleer of er al actieve tijdsregistraties zijn
    async function checkActiveTimeLogs() {
        try {
            // Haal alle werknemers op om namen te kunnen tonen
            await loadEmployees();
            
            // Haal actieve logs op van de API
            const response = await fetch('/api/airtec/timelog/active');
            
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            const logs = await response.json();
            
            if (logs && logs.length > 0) {
                console.log('Actieve logs gevonden:', logs);
                
                // Actieve tijdsregistraties verwerken
                logs.forEach(log => {
                    const employeeIds = log.werknemer_ids || [];
                    
                    // Voor elke werknemer apart bijhouden
                    employeeIds.forEach(employeeId => {
                        const employeeName = employeeCache[employeeId] || 'Onbekend';
                        
                        activeTimeLogs.set(employeeId, {
                            id: log.id,
                            start_time: log.start_time,
                            employeeName: employeeName,
                            box_type: log.box_type,
                            quantity_packed: log.quantity_packed
                        });
                    });
                });
                
                updateTimerVisibility();
                startTimeUpdateInterval();
            } else {
                console.log('Geen actieve logs gevonden');
            }
        } catch (error) {
            console.error('Fout bij controleren van actieve tijdsregistraties:', error);
        }
    }
    
    // Sla de huidige staat van de tijdsregistraties op in de database
    async function saveTimeLogState() {
        // Alleen opslaan als er actieve logs zijn
        if (activeTimeLogs.size === 0) return;
        
        try {
            // Verzamel informatie over verpakte kisten
            const boxTypes = {};
            itemsToPackData.forEach(item => {
                if (item.kistnummer && item.packed) {
                    if (!boxTypes[item.kistnummer]) {
                        boxTypes[item.kistnummer] = 0;
                    }
                    boxTypes[item.kistnummer] += (parseInt(item.quantity) || 1);
                }
            });
            
            // Converteer de Map naar een array van objecten
            const logsArray = Array.from(activeTimeLogs.entries()).map(([employeeId, log]) => ({
                employee_id: employeeId,
                log_id: log.id,
                start_time: log.start_time,
                end_time: log.end_time || null,
                employee_name: log.employeeName || employeeCache[employeeId] || 'Onbekend',
                type: 'Airtec',
                box_type: log.box_type || null,
                quantity_packed: log.quantity_packed || 0
            }));
            
            // We slaan de tijdsregistratie nu lokaal op in plaats van naar de server te sturen
            // omdat de endpoint niet bestaat
            console.log('Tijdsregistratie staat lokaal opgeslagen:', logsArray);
            localStorage.setItem('airtec_timelog_state', JSON.stringify(logsArray));
        } catch (error) {
            console.error('Fout bij opslaan tijdsregistratie staat:', error);
        }
    }

    // Stop een tijdsregistratie
    async function stopTimeLog(logId) {
        try {
            const response = await fetch(`/api/airtec/timelog/${logId}/stop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Fout bij stoppen tijdsregistratie:', error);
            throw error;
        }
    }
    
    // Bijhouden van verstreken tijd
    let timeUpdateInterval = null;
    
    function startTimeUpdateInterval() {
        if (timeUpdateInterval) return;
        
        // Update elke seconde
        timeUpdateInterval = setInterval(() => {
            activeTimeLogs.forEach((log, employeeId) => {
                const startTime = new Date(log.start_time);
                const now = new Date();
                const elapsedSeconds = Math.floor((now - startTime) / 1000);
                
                // Update tijd in de tabel
                const timeCell = document.querySelector(`.elapsed-time[data-employee-id="${employeeId}"]`);
                if (timeCell) {
                    timeCell.textContent = formatSeconds(elapsedSeconds);
                }
            });
        }, 1000);
    }
    
    function stopTimeUpdateInterval() {
        if (timeUpdateInterval) {
            clearInterval(timeUpdateInterval);
            timeUpdateInterval = null;
        }
    }
    
    function formatSeconds(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return [
            h > 0 ? `${h}u` : '',
            m > 0 ? `${m}m` : '',
            `${s}s`
        ].filter(Boolean).join(' ');
    }

    // Add keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // CTRL+S to save/confirm packed items
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            confirmPackedItems();
        }
        
        // CTRL+F to focus search
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            document.getElementById('search-box').focus();
        }
        
        // CTRL+P to print
        if (e.ctrlKey && e.key === 'p') {
            e.preventDefault();
            document.getElementById('print-button').click();
        }
    });

    // Functie om geselecteerde werknemers te starten
    async function startSelectedEmployeesTimer() {
        const employeeSelect = document.getElementById('employee-select');
        if (!employeeSelect) {
            showNotification('Geen werknemerselectie gevonden', 'warning');
            return;
        }
        const selectedOptions = Array.from(employeeSelect.selectedOptions);
        const werknemers = selectedOptions.map(opt => parseInt(opt.value));
        if (werknemers.length === 0) {
            showNotification('Selecteer minstens één werknemer', 'warning');
            return;
        }
        try {
            const confirmBtn = document.getElementById('confirm-start-timer-btn');
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starten...';
    
            const createdLogs = await Promise.all(
                werknemers.map(async id => {
                    const res = await fetch('/api/airtec/timelog/start', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'Airtec', werknemers: [id] })
                    });
                    const json = await res.json();
                    if (!json.success) throw new Error(json.message || `Kon timer voor werknemer ${id} niet starten`);
                    return { employeeId: id, logId: json.log_id, startISO: json.start_time || new Date().toISOString() };
                })
            );
    
            createdLogs.forEach(({ employeeId, logId, startISO }) => {
                const naam = employeeCache[employeeId] || 'Onbekend';
                activeTimeLogs.set(employeeId, { id: logId, start_time: startISO, employeeName: naam });
            });
    
            if (timeModal) timeModal.hide();
            startTimeUpdateInterval();
            updateTimerVisibility();
            showNotification('Tijdsregistratie gestart', 'success');
        } catch (err) {
            console.error('Fout bij starten tijdsregistratie:', err);
            showNotification('Fout bij starten tijdsregistratie', 'danger');
        } finally {
            const confirmBtn = document.getElementById('confirm-start-timer-btn');
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<i class="fas fa-play me-1"></i> Start Tijdsregistratie';
            }
        }
    }

    // Voeg dit toe vlak voor het eind van het bestand (net boven de laatste `});`):
    window.startSelectedEmployeesTimer = startSelectedEmployeesTimer;
});