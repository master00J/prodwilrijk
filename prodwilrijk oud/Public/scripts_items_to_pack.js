document.addEventListener('DOMContentLoaded', () => {
    const state = {
        items: [],
        visibleItems: [],
        sort: { column: null, direction: 'asc' },
        filters: {
            search: '',
            date: '',
            priorityOnly: false,
            measurementOnly: false
        },
        expandedGroups: new Set() // For item grouping functionality
    };

    const selectors = {
        headerPlaceholder: '#header-placeholder',
        searchBox: '#search-box',
        dateFilter: '#date-filter',
        showPriorityButton: '#show-priority-button',
        showMeasurementsButton: '#show-measurements-button',
        tableBody: '#items-to-pack-table-body',
        totalItems: '#total-items',
        selectAll: '#select-all',
        selectAllPriority: '#select-all-priority',
        selectAllMeasurements: '#select-all-measurements',
        confirmPackedButton: '#confirm-packed-button',
        setPriorityButton: '#set-priority-button',
        setMeasurementsButton: '#set-measurements-button',
        printMeasurementsButton: '#print-measurements-button',
        priorityItemsCount: '#priority-items-count',
        totalQuantityCount: '#total-quantity-count',
        lastUpdated: '#last-updated',
        backlogItemsCount: '#backlog-items-count',
        showDailyReportBtn: '#show-daily-report-btn',
        dailyReportModal: '#dailyReportModal',
        reportDate: '#report-date',
        generateReportBtn: '#generate-report-btn',
        reportContent: '#report-content',
        emailReportBtn: '#email-report-btn',
        printReportBtn: '#print-report-btn',
        showExcelExportBtn: '#show-excel-export-btn',
        excelExportSection: '#excel-export-section',
        excelDateFrom: '#excel-date-from',
        excelDateTo: '#excel-date-to',
        generateExcelBtn: '#generate-excel-btn'
    };

    const elements = {};
    Object.keys(selectors).forEach(key => {
        elements[key] = document.querySelector(selectors[key]);
    });

    /**
     * Loads the header content asynchronously from 'header.html'.
     */
    const loadHeader = () => {
        if (elements.headerPlaceholder) {
            fetch('header.html')
                .then(response => response.text())
                .then(html => elements.headerPlaceholder.innerHTML = html)
                .catch(error => console.error('Error loading header:', error));
        }
    };

    /**
     * Sets up event listeners for sorting table headers.
     */
    const setupSortHeaders = () => {
        document.querySelectorAll('th[data-sort]').forEach(header => {
            header.addEventListener('click', () => {
                const column = header.getAttribute('data-sort');
                sortTable(column);
            });
        });
    };

    /**
     * Sorts the table based on the clicked column.
     * @param {string} column - The column to sort by.
     */
    const sortTable = (column) => {
        if (state.sort.column === column) {
            state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            state.sort.column = column;
            state.sort.direction = 'asc';
        }

        updateSortIndicators();
        
        state.visibleItems.sort((a, b) => {
            let valueA = a[column];
            let valueB = b[column];

            // Sorting by date
            if (column === 'date_added') {
                valueA = new Date(valueA);
                valueB = new Date(valueB);
            } else if (typeof valueA === 'string') {
                valueA = valueA.toLowerCase();
                valueB = valueB.toLowerCase();
            }

            return state.sort.direction === 'asc'
                ? (valueA < valueB ? -1 : valueA > valueB ? 1 : 0)
                : (valueA > valueB ? -1 : valueA < valueB ? 1 : 0);
        });
        renderTable();
    };

    /**
     * Updates the sort indicators in the UI.
     */
    const updateSortIndicators = () => {
        document.querySelectorAll('th .sort-indicator').forEach(indicator => {
            indicator.textContent = '';
        });
        if (state.sort.column) {
            const indicator = document.querySelector(`th[data-sort="${state.sort.column}"] .sort-indicator`);
            if (indicator) {
                indicator.textContent = state.sort.direction === 'asc' ? ' ↑' : ' ↓';
            }
        }
    };

    /**
     * Fetches items data from the server.
     */
    const fetchItems = async () => {
        try {
            const response = await fetch('/api/items_to_pack');
            state.items = await response.json();
            filterItems();
        } catch (error) {
            handleError(error, 'Failed to load items');
        }
    };

    /**
     * Filters items based on current state filters.
     */
    const filterItems = () => {
        state.visibleItems = state.items.filter(item => {
            const matchesSearch =
                item.item_number?.toString().toLowerCase().includes(state.filters.search) ||
                item.po_number?.toString().toLowerCase().includes(state.filters.search) ||
                item.id?.toString().includes(state.filters.search);

            const matchesDate = state.filters.date
                ? new Date(item.date_added).toISOString().split('T')[0] === state.filters.date
                : true;
            const matchesPriority = state.filters.priorityOnly ? item.priority : true;
            const matchesMeasurement = state.filters.measurementOnly ? item.measurement : true;

            return matchesSearch && matchesDate && matchesPriority && matchesMeasurement;
        });

        updateStats();
        renderTable();
    };

    /**
     * Update statistics display
     */
    const updateStats = () => {
        const totalItems = state.items.length;
        const priorityItems = state.items.filter(item => item.priority).length;
        const totalQuantity = state.items.reduce((sum, item) => sum + (item.amount || 0), 0);
        
        // Calculate backlog (items older than 1 day)
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        const backlogItems = state.items.filter(item => {
            const itemDate = new Date(item.date_added);
            return itemDate < oneDayAgo;
        }).length;

        if (elements.priorityItemsCount) elements.priorityItemsCount.textContent = priorityItems;
        if (elements.totalQuantityCount) elements.totalQuantityCount.textContent = totalQuantity;
        if (elements.backlogItemsCount) elements.backlogItemsCount.textContent = backlogItems;
        if (elements.lastUpdated) {
            elements.lastUpdated.textContent = `Laatst bijgewerkt: ${new Date().toLocaleString('nl-NL')}`;
        }
    };

    /**
     * Renders the items in the table.
     */
    const renderTable = () => {
        if (!elements.tableBody) return;

        let totalItems = 0;
        elements.tableBody.innerHTML = '';
        state.visibleItems.forEach(item => {
            const row = document.createElement('tr');

            // Add priority/measurement classes
            if (item.priority) {
                row.classList.add('priority');
            }
            if (item.measurement) {
                row.classList.add('measurement');
            }
            if (item.packed) {
                row.classList.add('packed');
            }

            row.innerHTML = createRowHTML(item);
            
            elements.tableBody.appendChild(row);
            totalItems += item.amount;
        });

        if (elements.totalItems) elements.totalItems.textContent = totalItems;
        setupEventListeners();
    };

    /**
     * Creates HTML for a table row representing an item.
     */
    const createRowHTML = (item) => {
        return `
            <td>${item.id}</td>
            <td>${item.item_number}</td>
            <td>${item.po_number}</td>
            <td>${item.amount}</td>
            <td>${new Date(item.date_added).toLocaleDateString()}</td>
            <td>
                <input
                    type="checkbox"
                    class="form-check-input item-checkbox"
                    data-id="${item.id}"
                    ${item.packed ? 'checked' : ''}
                >
            </td>
            <td>
                <input
                    type="checkbox"
                    class="form-check-input priority-checkbox"
                    data-id="${item.id}"
                    ${item.priority ? 'checked' : ''}
                >
            </td>
            <td>
                <input
                    type="checkbox"
                    class="form-check-input measurement-checkbox"
                    data-id="${item.id}"
                    ${item.measurement ? 'checked' : ''}
                >
            </td>
            <td>${createImageHTML(item)}</td>
        `;
    };

    /**
     * Generates HTML for the image column.
     */
    const createImageHTML = (item) => `
        <input 
            type="file"
            class="image-upload d-none"
            data-id="${item.id}"
            accept="image/*"
        >
        <label class="btn btn-sm btn-outline-secondary me-2">
            <i class="bi bi-upload"></i>
            <input
                type="file"
                class="image-upload"
                data-id="${item.id}"
                accept="image/*"
                hidden
            >
        </label>
        ${
            item.image
              ? `<img
                  src="${item.image}"
                  alt="Item Image"
                  class="item-image"
                  style="cursor:pointer;">
                `
              : ''
        }
    `;

    /**
     * Sets up event listeners for interactive elements.
     */
    const setupEventListeners = () => {
        // Image uploads
        document.querySelectorAll('.image-upload').forEach(input => {
            input.addEventListener('change', handleImageUpload);
        });

        // Clicking on item images -> open in new tab
        document.querySelectorAll('.item-image').forEach(img => {
            img.addEventListener('click', (e) => window.open(e.target.src, '_blank'));
        });

        // Checkboxes (packed, priority, measurement)
        document.querySelectorAll('.item-checkbox, .priority-checkbox, .measurement-checkbox')
            .forEach(checkbox => {
                checkbox.addEventListener('change', handleCheckboxChange);
            });
    };

    /**
     * Handles image uploads for items.
     */
    const handleImageUpload = async (event) => {
        const input = event.target;
        const file = input.files[0];
        const id = input.getAttribute('data-id');

        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);
        formData.append('id', id);

        try {
            const response = await fetch('/api/upload_image', {
                method: 'POST',
                body: formData
            });
            const { success, imageUrl } = await response.json();
            if (success) {
                const item = state.items.find(item => item.id == id);
                if (item) {
                    item.image = imageUrl;
                    filterItems();
                }
                showNotification('success', 'Image uploaded successfully');
            } else {
                throw new Error('Upload failed');
            }
        } catch (error) {
            handleError(error, 'Failed to upload image');
        }
    };

    /**
     * Handles changes in checkbox state for items.
     */
    const handleCheckboxChange = (event) => {
        const checkbox = event.target;
        const id = checkbox.getAttribute('data-id');
        const item = state.items.find(item => item.id == id);
        if (item) {
            if (checkbox.classList.contains('item-checkbox')) {
                item.packed = checkbox.checked;
            }
            if (checkbox.classList.contains('priority-checkbox')) {
                item.priority = checkbox.checked;
            }
            if (checkbox.classList.contains('measurement-checkbox')) {
                item.measurement = checkbox.checked;
            }
            filterItems();
        }
    };

    /**
     * Shows a notification to the user.
     */
    const showNotification = (type, message) => {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} position-fixed`;
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999;';
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    };

    /**
     * Handles errors by logging them and showing a notification.
     */
    const handleError = (error, message) => {
        console.error(error);
        showNotification('error', message);
    };

    /**
     * Updates the status of items (priority, measurements, etc.).
     */
    const updateItemStatus = async (endpoint, ids) => {
        if (ids.length === 0) {
            showNotification('error', 'Please select items first');
            return;
        }
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });
            if (!response.ok) throw new Error('Server error');
            const { success, message } = await response.json();
            if (success) {
                showNotification('success', message || 'Update successful');
                await fetchItems();
            } else {
                throw new Error(message || 'Update failed');
            }
        } catch (error) {
            handleError(error);
        }
    };

    /**
     * Enhanced confirmation modal function for verifying items before packing
     */
    const showEnhancedConfirmationModal = (selectedItems, ids) => {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Bevestig Verpakking</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-info">
                            <h6><i class="fas fa-info-circle me-2"></i>Overzicht</h6>
                            <p>Je staat op het punt om <strong>${selectedItems.length}</strong> items als verpakt te markeren.</p>
                        </div>
                        
                        <div class="table-responsive">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Item Number</th>
                                        <th>PO Number</th>
                                        <th>Amount</th>
                                        <th>Date Added</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${selectedItems.map(item => `
                                        <tr>
                                            <td>${item.id}</td>
                                            <td>${item.item_number}</td>
                                            <td>${item.po_number}</td>
                                            <td>${item.amount}</td>
                                            <td>${new Date(item.date_added).toLocaleDateString()}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuleren</button>
                        <button type="button" class="btn btn-success" id="final-confirm-btn">
                            <i class="fas fa-check me-1"></i>
                            Bevestig Verpakking
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();

        // Handle final confirmation
        modal.querySelector('#final-confirm-btn').addEventListener('click', async () => {
            try {
                const confirmBtn = modal.querySelector('#final-confirm-btn');
                confirmBtn.disabled = true;
                confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Verwerken...';

                await updateItemStatus('/api/items_to_pack/packed', ids);
                
                modalInstance.hide();
                showNotification('success', `${selectedItems.length} items succesvol als verpakt gemarkeerd`);
                
                // Clear selections
                document.querySelectorAll('.item-checkbox:checked').forEach(checkbox => {
                    checkbox.checked = false;
                });
                
                await fetchItems();
            } catch (error) {
                console.error('Error confirming packed status:', error);
                showNotification('error', 'Fout bij bevestigen verpakking');
            }
        });

        // Cleanup
        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
        });
    };

    /**
     * Tablet-optimized scanning interface for barcode scanning
     */
    const showTabletScannerInterface = () => {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-fullscreen-md-down">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="bi bi-upc-scan me-2"></i>Scan Items
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-info">
                            <p class="mb-1"><strong>Instructions:</strong></p>
                            <p class="mb-0">Scan the barcode or QR code on each packed item. 
                               Items will be verified and added to the list below.</p>
                        </div>
                        
                        <div class="mb-4 text-center">
                            <div class="input-group input-group-lg mb-2">
                                <span class="input-group-text"><i class="bi bi-upc"></i></span>
                                <input type="text" class="form-control form-control-lg" id="scan-input" 
                                       placeholder="Scan or type item number">
                                <button class="btn btn-primary" id="scan-submit">Add</button>
                            </div>
                            <div class="form-text text-center">
                                Scan or manually enter item/pallet number
                            </div>
                        </div>
                        
                        <div class="scanned-items-container">
                            <h5 class="d-flex justify-content-between align-items-center mb-3">
                                <span>Scanned Items</span>
                                <span class="badge bg-primary rounded-pill" id="scan-count">0</span>
                            </h5>
                            <div class="list-group" id="scanned-items-list">
                                <div class="list-group-item text-center text-muted py-5" id="no-scans-message">
                                    <i class="bi bi-inbox fs-1"></i>
                                    <p class="mt-2">No items scanned yet</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <span class="me-auto">
                            <strong>Total Scanned:</strong> <span id="total-scanned">0</span>
                        </span>
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-success btn-lg" id="confirm-all-scanned" disabled>
                            <i class="bi bi-box-seam me-2"></i>Mark All as Packed
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();
        
        // Store scanned items
        const scannedItems = [];
        const scannedItemsMap = new Map(); // for quick lookup
        
        // Setup element references
        const scanInput = modal.querySelector('#scan-input');
        const scanSubmit = modal.querySelector('#scan-submit');
        const scannedList = modal.querySelector('#scanned-items-list');
        const noScansMessage = modal.querySelector('#no-scans-message');
        const totalScanned = modal.querySelector('#total-scanned');
        const scanCount = modal.querySelector('#scan-count');
        const confirmAllButton = modal.querySelector('#confirm-all-scanned');
        
        // Update the count displays
        const updateCounts = () => {
            const count = scannedItems.length;
            totalScanned.textContent = count;
            scanCount.textContent = count;
            confirmAllButton.disabled = count === 0;
            
            // Show/hide the empty state message
            if (count > 0) {
                noScansMessage.classList.add('d-none');
            } else {
                noScansMessage.classList.remove('d-none');
            }
        };
        
        // Function to add a scanned item to the list
        const addScannedItemToList = (item, isAuto = false) => {
            const listItem = document.createElement('div');
            listItem.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
            
            // Create the content with item details
            listItem.innerHTML = `
                <div>
                    <strong>${item.item_number}</strong> - Pallet: ${item.po_number}
                    <div class="small text-muted">Amount: ${item.amount}</div>
                </div>
                <div class="d-flex gap-2">
                    ${isAuto ? '<span class="badge bg-info">Auto</span>' : ''}
                    <button class="btn btn-sm btn-outline-danger remove-scanned" data-id="${item.id}">
                        <i class="bi bi-x"></i>
                    </button>
                </div>
            `;
            
            // Add to the top of the list for better visibility
            if (scannedList.firstChild && scannedList.firstChild !== noScansMessage) {
                scannedList.insertBefore(listItem, scannedList.firstChild);
            } else {
                scannedList.appendChild(listItem);
            }
            
            // Add event listener for remove button
            listItem.querySelector('.remove-scanned').addEventListener('click', () => {
                // Remove from tracked collections
                const idx = scannedItems.findIndex(i => i.id === item.id);
                if (idx !== -1) {
                    scannedItems.splice(idx, 1);
                }
                scannedItemsMap.delete(item.id);
                
                // Remove from UI
                listItem.remove();
                updateCounts();
            });
            
            // Focus back on the input field
            scanInput.value = '';
            scanInput.focus();
        };
        
        // Function to handle a scanned code
        const handleScanCode = (code) => {
            // Trim and validate the code
            code = code.trim();
            if (!code) return;
            
            // Search for the item in the state
            const foundItem = state.items.find(item => 
                item.item_number.toString() === code || 
                item.po_number.toString() === code ||
                item.id.toString() === code
            );
            
            if (!foundItem) {
                // Item not found, show error
                showNotification('error', `No matching item found for "${code}"`);
                
                // Add visual feedback to the input
                scanInput.classList.add('is-invalid');
                setTimeout(() => {
                    scanInput.classList.remove('is-invalid');
                }, 2000);
                
                return;
            }
            
            // Check if already scanned
            if (scannedItemsMap.has(foundItem.id)) {
                showNotification('warning', `Item ${foundItem.item_number} already scanned`);
                return;
            }
            
            // Add to scanned items collections
            scannedItems.push(foundItem);
            scannedItemsMap.set(foundItem.id, foundItem);
            
            // Update UI
            updateCounts();
            addScannedItemToList(foundItem);
            
            // Add visual feedback for success
            scanInput.classList.add('is-valid');
            setTimeout(() => {
                scanInput.classList.remove('is-valid');
            }, 2000);
        };

        // Handle auto-complete functionality
        const setupAutoCompleteScanning = () => {
            // Check for related items to what was scanned
            const checkForRelatedItems = (item) => {
                // Look for other items with the same pallet number
                const samePalletItems = state.items.filter(i => 
                    i.po_number === item.po_number && 
                    i.id !== item.id && 
                    !scannedItemsMap.has(i.id)
                );
                
                if (samePalletItems.length > 0) {
                    // Create a prompt for adding related items
                    const autoAddPrompt = document.createElement('div');
                    autoAddPrompt.className = 'alert alert-info auto-add-prompt mb-3';
                    autoAddPrompt.innerHTML = `
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <strong>${samePalletItems.length}</strong> other items found on the same pallet.
                            </div>
                            <button class="btn btn-primary auto-add-btn">
                                <i class="bi bi-plus-circle me-1"></i> Add ${samePalletItems.length} Related Items
                            </button>
                        </div>
                    `;
                    
                    // Append to the scan area
                    const scanArea = scanInput.closest('.mb-4');
                    scanArea.after(autoAddPrompt);
                    
                    // Handle auto-add button click
                    autoAddPrompt.querySelector('.auto-add-btn').addEventListener('click', () => {
                        // Add all related items
                        samePalletItems.forEach(relatedItem => {
                            scannedItems.push(relatedItem);
                            scannedItemsMap.set(relatedItem.id, relatedItem);
                            addScannedItemToList(relatedItem, true);
                        });
                        
                        // Update counts and remove prompt
                        updateCounts();
                        autoAddPrompt.remove();
                        
                        showNotification('success', `Added ${samePalletItems.length} related items from the same pallet`);
                    });
                    
                    // Remove prompt after a delay if not clicked
                    setTimeout(() => {
                        if (document.body.contains(autoAddPrompt)) {
                            autoAddPrompt.remove();
                        }
                    }, 10000);
                }
            };
            
            // Add listener for scanning events
            scanInput.addEventListener('input', (e) => {
                // If a barcode scanner is used, it typically enters the entire code at once
                // and often adds a return character
                if (e.inputType === 'insertText' && e.data === null) {
                    const code = scanInput.value.trim();
                    if (code) {
                        handleScanCode(code);
                        
                        // Check for related items for the last scanned item
                        if (scannedItems.length > 0) {
                            checkForRelatedItems(scannedItems[scannedItems.length - 1]);
                        }
                    }
                }
            });
        };
        
        // Handle manual entry
        scanSubmit.addEventListener('click', () => {
            const code = scanInput.value.trim();
            if (code) handleScanCode(code);
        });
        
        scanInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const code = scanInput.value.trim();
                if (code) handleScanCode(code);
            }
        });
        
        // Setup auto-complete scanning
        setupAutoCompleteScanning();
        
        // Focus the input when the modal opens
        modal.addEventListener('shown.bs.modal', () => {
            scanInput.focus();
        });
        
        // Handle the confirm all button
        confirmAllButton.addEventListener('click', async () => {
            if (scannedItems.length === 0) {
                showNotification('warning', 'No items have been scanned');
                return;
            }
            
            // Close this modal first
            modalInstance.hide();
            
            // Get the IDs of all scanned items
            const ids = scannedItems.map(item => item.id);
            
            // Show the enhanced confirmation modal
            showEnhancedConfirmationModal(scannedItems, ids);
        });
        
        // Cleanup when modal is hidden
        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
        });
    };

    /**
     * Add touch-friendly selection tools for tablet use
     */
    const addTouchFriendlyTools = () => {
        // Create touch-friendly action panel
        const actionPanel = document.createElement('div');
        actionPanel.className = 'touch-action-panel d-lg-none';
        actionPanel.innerHTML = `
            <div class="container-fluid">
                <div class="row g-2">
                    <div class="col-6">
                        <button id="select-all-btn" class="btn btn-lg btn-outline-primary touch-btn w-100">
                            <i class="fas fa-check-square"></i><br>
                            Select All
                        </button>
                    </div>
                    <div class="col-6">
                        <button id="clear-selection-btn" class="btn btn-lg btn-outline-secondary touch-btn w-100">
                            <i class="fas fa-times"></i><br>
                            Clear Selection
                        </button>
                    </div>
                    <div class="col-6">
                        <button id="mark-packed-btn" class="btn btn-lg btn-outline-success touch-btn w-100">
                            <i class="fas fa-box"></i><br>
                            Mark as Packed
                        </button>
                    </div>
                    <div class="col-6">
                        <button id="show-scanner-btn" class="btn btn-lg btn-outline-info touch-btn w-100">
                            <i class="fas fa-qrcode"></i><br>
                            Scanner
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add CSS for touch-friendly interface
        const style = document.createElement('style');
        style.textContent = `
            .touch-action-panel {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: white;
                border-top: 2px solid #dee2e6;
                padding: 10px;
                z-index: 1000;
                box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
            }
            
            .touch-btn {
                min-height: 80px;
                font-size: 14px;
                border-radius: 8px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
                padding: 8px;
            }
            
            .touch-btn i {
                font-size: 24px;
                margin-bottom: 4px;
            }
            
            @media (max-width: 991.98px) {
                body {
                    padding-bottom: 120px;
                }
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(actionPanel);

        // Event listeners for touch buttons
        document.getElementById('select-all-btn')?.addEventListener('click', () => {
            document.querySelectorAll('.item-checkbox').forEach(checkbox => {
                checkbox.checked = true;
            });
        });

        document.getElementById('clear-selection-btn')?.addEventListener('click', () => {
            clearSelection();
        });

        document.getElementById('mark-packed-btn')?.addEventListener('click', () => {
            const checkedBoxes = document.querySelectorAll('.item-checkbox:checked');
            if (checkedBoxes.length === 0) {
                showNotification('error', 'Selecteer eerst items om als verpakt te markeren');
                return;
            }
            const ids = Array.from(checkedBoxes).map(cb => cb.getAttribute('data-id'));
            const selectedItems = state.items.filter(item => ids.includes(item.id.toString()));
            showEnhancedConfirmationModal(selectedItems, ids);
        });

        document.getElementById('show-scanner-btn')?.addEventListener('click', () => {
            showTabletScannerInterface();
        });
    };

    /**
     * Helper function to select items with a specific status
     */
    const selectItemsWithStatus = (status) => {
        const checkboxes = document.querySelectorAll('.item-checkbox');
        let selectedCount = 0;
        
        checkboxes.forEach(checkbox => {
            const itemId = checkbox.getAttribute('data-id');
            const item = state.items.find(i => i.id.toString() === itemId);
            
            if (item) {
                if (status === 'packed' && item.packed) {
                    checkbox.checked = true;
                    selectedCount++;
                } else if (status === 'priority' && item.priority) {
                    checkbox.checked = true;
                    selectedCount++;
                } else if (status === 'measurement' && item.measurement) {
                    checkbox.checked = true;
                    selectedCount++;
                } else {
                    checkbox.checked = false;
                }
            }
        });
        
        showNotification('info', `${selectedCount} items geselecteerd`);
    };
    
    /**
     * Function to clear all selected checkboxes
     */
    const clearSelection = () => {
        document.querySelectorAll('.item-checkbox').forEach(checkbox => {
            checkbox.checked = false;
            const id = checkbox.getAttribute('data-id');
            const item = state.items.find(item => item.id == id);
            if (item) item.packed = false;
        });
        
        // Also uncheck the "select all" checkbox
        if (elements.selectAll) {
            elements.selectAll.checked = false;
        }
        
        showNotification('info', 'Selection cleared');
    };

    /**
     * Prints measurements for selected items.
     */
    const printMeasurements = () => {
        const measurementItems = state.items.filter(item => item.measurement);
        if (measurementItems.length === 0) {
            showNotification('error', 'No measurement items to print');
            return;
        }
        const printWindow = window.open('', '_blank', 'height=800,width=800');
        const printContent = createPrintContent(measurementItems);
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.print();
        printWindow.close();
    };

    const createPrintContent = (items) => `
        <html>
            <head>
                <title>Opmetingen ${new Date().toLocaleDateString()}</title>
                <style>
                    /* Print CSS hier indien gewenst */
                </style>
            </head>
            <body>
                <h2 style="text-align:center;">Opmetingen ${new Date().toLocaleDateString()}</h2>
                ${items.map(createPrintItem).join('')}
            </body>
        </html>
    `;

    const createPrintItem = (item) => `
        <div class="measurement-item">
            <table class="measurement-table">
                <tr><td><strong>Item ID:</strong> ${item.id}</td></tr>
                <tr><td><strong>Item Number:</strong> ${item.item_number}</td></tr>
                <tr><td><strong>Pallet Number:</strong> ${item.po_number}</td></tr>
                <tr><td><strong>Amount:</strong> ${item.amount}</td></tr>
            </table>
            <hr>
        </div>
    `;

    /**
     * Add a helper function to detect suspicious packing patterns
     */
    const detectSuspiciousSelections = (selectedItems) => {
        const warnings = [];
        
        // Check for unusually large selections (potential mass selection error)
        if (selectedItems.length > 20) {
            warnings.push({
                type: 'bulk_selection',
                message: `You've selected many items (${selectedItems.length}). Please verify this is correct.`,
                severity: 'medium'
            });
        }
        
        // Check for items that were recently added
        const now = new Date();
        const recentItems = selectedItems.filter(item => {
            const addedDate = new Date(item.date_added);
            const diffTime = Math.abs(now - addedDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays <= 1; // Items added in the last day
        });
        
        if (recentItems.length > 0) {
            warnings.push({
                type: 'recent_items',
                message: `${recentItems.length} items were added very recently (within the last 24 hours)`,
                items: recentItems,
                severity: 'low'
            });
        }
        
        return warnings;
    };

    // Event Listeners for main UI
    elements.searchBox?.addEventListener('input', () => {
        state.filters.search = elements.searchBox.value.toLowerCase();
        filterItems();
    });

    elements.dateFilter?.addEventListener('change', () => {
        state.filters.date = elements.dateFilter.value;
        filterItems();
    });

    elements.showPriorityButton?.addEventListener('click', () => {
        state.filters.priorityOnly = !state.filters.priorityOnly;
        elements.showPriorityButton.classList.toggle('btn-warning', state.filters.priorityOnly);
        elements.showPriorityButton.classList.toggle('btn-secondary', !state.filters.priorityOnly);
        filterItems();
    });

    elements.showMeasurementsButton?.addEventListener('click', () => {
        state.filters.measurementOnly = !state.filters.measurementOnly;
        elements.showMeasurementsButton.classList.toggle('btn-info', state.filters.measurementOnly);
        elements.showMeasurementsButton.classList.toggle('btn-secondary', !state.filters.measurementOnly);
        filterItems();
    });

    elements.selectAll?.addEventListener('change', () => {
        document.querySelectorAll('.item-checkbox').forEach(checkbox => {
            checkbox.checked = elements.selectAll.checked;
            const id = checkbox.getAttribute('data-id');
            const item = state.items.find(item => item.id == id);
            if (item) item.packed = checkbox.checked;
        });
        filterItems();
    });

    elements.selectAllPriority?.addEventListener('change', () => {
        document.querySelectorAll('.priority-checkbox').forEach(checkbox => {
            checkbox.checked = elements.selectAllPriority.checked;
            const id = checkbox.getAttribute('data-id');
            const item = state.items.find(item => item.id == id);
            if (item) item.priority = checkbox.checked;
        });
        filterItems();
    });

    elements.selectAllMeasurements?.addEventListener('change', () => {
        document.querySelectorAll('.measurement-checkbox').forEach(checkbox => {
            checkbox.checked = elements.selectAllMeasurements.checked;
            const id = checkbox.getAttribute('data-id');
            const item = state.items.find(item => item.id == id);
            if (item) item.measurement = checkbox.checked;
        });
        filterItems();
    });

    elements.confirmPackedButton?.addEventListener('click', async () => {
        const checkedBoxes = document.querySelectorAll('.item-checkbox:checked');
        const ids = Array.from(checkedBoxes).map(checkbox => checkbox.getAttribute('data-id'));

        if (ids.length === 0) {
            showNotification('error', 'Please select items to pack');
            return;
        }

        // Get the full item data for all selected IDs
        const selectedItems = ids.map(id => state.items.find(item => item.id == id));
        
        // Show the enhanced confirmation modal
        showEnhancedConfirmationModal(selectedItems, ids);
    });

    elements.setPriorityButton?.addEventListener('click', () => {
        const ids = Array.from(document.querySelectorAll('.priority-checkbox:checked'))
                         .map(cb => cb.getAttribute('data-id'));
        updateItemStatus('/set_priority_items', ids);
    });

    elements.setMeasurementsButton?.addEventListener('click', () => {
        const ids = Array.from(document.querySelectorAll('.measurement-checkbox:checked'))
                         .map(cb => cb.getAttribute('data-id'));
        updateItemStatus('/set_measurement_items', ids);
    });

    elements.printMeasurementsButton?.addEventListener('click', printMeasurements);

    // Function to clear date filter
    window.clearDateFilter = function() {
        if (elements.dateFilter) {
            elements.dateFilter.value = '';
            state.filters.date = '';
            filterItems();
        }
    };

    /**
     * Daily Report Functionality - Moved before initApp to fix reference error
     */
    const initializeDailyReport = () => {
        console.log('Initializing daily report functionality...');
        
        // Set default date to today
        const today = new Date();
        const todayString = today.toISOString().split('T')[0];
        const reportDateInput = document.getElementById('report-date');
        if (reportDateInput) {
            reportDateInput.value = todayString;
        }
        
        // Setup event listeners
        const showReportBtn = document.getElementById('show-daily-report-btn');
        const generateReportBtn = document.getElementById('generate-report-btn');
        const emailReportBtn = document.getElementById('email-report-btn');
        const printReportBtn = document.getElementById('print-report-btn');
        const showExcelExportBtn = document.getElementById('show-excel-export-btn');
        const generateExcelBtn = document.getElementById('generate-excel-btn');
        
        if (showReportBtn) {
            showReportBtn.addEventListener('click', () => {
                const modal = new bootstrap.Modal(document.getElementById('dailyReportModal'));
                modal.show();
            });
        }
        
        if (generateReportBtn) {
            generateReportBtn.addEventListener('click', generateDailyReport);
        }
        
        if (emailReportBtn) {
            emailReportBtn.addEventListener('click', emailDailyReport);
        }
        
        if (printReportBtn) {
            printReportBtn.addEventListener('click', printDailyReport);
        }
        
        if (showExcelExportBtn) {
            showExcelExportBtn.addEventListener('click', toggleExcelExportSection);
        }
        
        if (generateExcelBtn) {
            generateExcelBtn.addEventListener('click', generateExcelExport);
        }
        
        // Set default date range for Excel export (last 7 days)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        const excelDateFrom = document.getElementById('excel-date-from');
        const excelDateTo = document.getElementById('excel-date-to');
        
        if (excelDateFrom) {
            excelDateFrom.value = weekAgo.toISOString().split('T')[0];
        }
        if (excelDateTo) {
            excelDateTo.value = today.toISOString().split('T')[0];
        }
    };

    const generateDailyReport = async () => {
        const reportDate = document.getElementById('report-date').value;
        if (!reportDate) {
            showNotification('error', 'Selecteer een datum voor het rapport');
            return;
        }
        
        try {
            // Call simplified daily report API with GET request and query parameters
            const response = await fetch(`/api/items_to_pack_report?date=${reportDate}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to generate report');
            }
            
            const data = await response.json();
            renderDailyReport(data, reportDate);
            
            // Show action buttons
            document.getElementById('email-report-btn').style.display = 'inline-block';
            document.getElementById('print-report-btn').style.display = 'inline-block';
            
        } catch (error) {
            console.error('Error generating daily report:', error);
            showNotification('error', 'Fout bij genereren rapport: ' + error.message);
        }
    };

    const generateReportFromItems = (reportDate) => {
        const selectedDate = new Date(reportDate);
        const today = new Date();
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        
        // Calculate statistics from current items
        const totalItems = state.items.length;
        const priorityItems = state.items.filter(item => item.priority).length;
        const packedItems = state.items.filter(item => item.packed).length;
        
        // Calculate backlog (items older than 1 day)
        const backlogItems = state.items.filter(item => {
            const itemDate = new Date(item.date_added);
            return itemDate < oneDayAgo && !item.packed;
        }).length;
        
        // Calculate items packed on selected date (if it's today)
        const isToday = selectedDate.toDateString() === today.toDateString();
        const itemsPackedToday = isToday ? packedItems : 0;
        
        // Generate backlog breakdown
        const backlogBreakdown = generateBacklogBreakdown();
        
        // Generate simple recommendations
        const recommendations = generateRecommendations(totalItems, backlogItems, priorityItems);
        
        return {
            total_items_to_pack: totalItems - packedItems,
            backlog_items: backlogItems,
            priority_items: priorityItems,
            items_packed_today: itemsPackedToday,
            backlog_breakdown: backlogBreakdown,
            active_packers: 0, // No longer applicable
            avg_packing_time: 'N/A', // No longer applicable
            efficiency_score: calculateEfficiencyScore(totalItems, packedItems, backlogItems),
            recommendations: recommendations
        };
    };

    const generateBacklogBreakdown = () => {
        const now = new Date();
        const breakdown = [
            { age_category: '1-2 dagen', count: 0, percentage: 0 },
            { age_category: '3-7 dagen', count: 0, percentage: 0 },
            { age_category: '1-2 weken', count: 0, percentage: 0 },
            { age_category: '>2 weken', count: 0, percentage: 0 }
        ];
        
        const unpackedItems = state.items.filter(item => !item.packed);
        
        unpackedItems.forEach(item => {
            const itemDate = new Date(item.date_added);
            const diffTime = Math.abs(now - itemDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays >= 1 && diffDays <= 2) {
                breakdown[0].count++;
            } else if (diffDays >= 3 && diffDays <= 7) {
                breakdown[1].count++;
            } else if (diffDays >= 8 && diffDays <= 14) {
                breakdown[2].count++;
            } else if (diffDays > 14) {
                breakdown[3].count++;
            }
        });
        
        // Calculate percentages
        const totalBacklog = breakdown.reduce((sum, item) => sum + item.count, 0);
        if (totalBacklog > 0) {
            breakdown.forEach(item => {
                item.percentage = Math.round((item.count / totalBacklog) * 100);
            });
        }
        
        return breakdown.filter(item => item.count > 0);
    };

    const calculateEfficiencyScore = (totalItems, packedItems, backlogItems) => {
        if (totalItems === 0) return 100;
        
        const packedPercentage = (packedItems / totalItems) * 100;
        const backlogPenalty = (backlogItems / totalItems) * 50; // Penalty for backlog
        
        return Math.max(0, Math.round(packedPercentage - backlogPenalty));
    };

    const generateRecommendations = (totalItems, backlogItems, priorityItems) => {
        const recommendations = [];
        
        if (backlogItems > totalItems * 0.3) {
            recommendations.push('Achterstand is hoog (>30%). Overweeg extra capaciteit.');
        }
        
        if (priorityItems > 0) {
            recommendations.push(`${priorityItems} prioriteit items vereisen directe aandacht.`);
        }
        
        if (backlogItems === 0) {
            recommendations.push('Uitstekend! Geen achterstand in verpakking.');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('Verpakking verloopt volgens planning.');
        }
        
        return recommendations;
    };

    const renderDailyReport = (data, reportDate) => {
        const reportContent = document.getElementById('report-content');
        const formattedDate = new Date(reportDate).toLocaleDateString('nl-NL', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const html = `
            <div class="report-header mb-4">
                <h4>Dagelijkse Verpakkingsrapportage</h4>
                <p class="text-muted">${formattedDate}</p>
                <div class="alert alert-info">
                    <i class="fas fa-info-circle"></i>
                    Dit rapport toont de historische situatie zoals die was op de geselecteerde datum
                </div>
            </div>
            
            <div class="row mb-4">
                <div class="col-md-3">
                    <div class="card text-center">
                        <div class="card-body">
                            <h5 class="card-title text-primary">${data.totalQuantity || 0}</h5>
                            <p class="card-text">Totaal items te verpakken<br>op deze datum</p>
                            <small class="text-muted">Totale hoeveelheid</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card text-center">
                        <div class="card-body">
                            <h5 class="card-title text-warning">${data.backlogQuantity || 0}</h5>
                            <p class="card-text">Achterstand hoeveelheid<br>op deze datum</p>
                            <small class="text-muted">(items ouder dan 1 dag)</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card text-center">
                        <div class="card-body">
                            <h5 class="card-title text-danger">${data.priorityQuantity || 0}</h5>
                            <p class="card-text">Prioriteit hoeveelheid<br>op deze datum</p>
                            <small class="text-muted">Totale prioriteit items</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card text-center">
                        <div class="card-body">
                            <h5 class="card-title text-success">${data.packedQuantity || 0}</h5>
                            <p class="card-text">Hoeveelheid verpakt<br>op deze datum</p>
                            <small class="text-muted">Totaal verpakt</small>
                        </div>
                    </div>
                </div>
            </div>
            
            ${data.backlogByAge && data.backlogByAge.length > 0 ? `
                <div class="mb-4">
                    <h5>Achterstand Analyse op deze datum</h5>
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>Leeftijd (dagen)</th>
                                    <th>Aantal Items</th>
                                    <th>Percentage van totaal</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.backlogByAge.map(item => `
                                    <tr>
                                        <td>${item.daysOld} dagen oud</td>
                                        <td>${item.count}</td>
                                        <td>${item.percentage.toFixed(1)}%</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}
            
            <div class="row mb-4">
                <div class="col-md-6">
                    <h5>Prestatie Metrics</h5>
                    <ul class="list-group">
                        <li class="list-group-item d-flex justify-content-between">
                            <span>Totale hoeveelheid op deze datum</span>
                            <strong>${data.totalQuantity || 0}</strong>
                        </li>
                        <li class="list-group-item d-flex justify-content-between">
                            <span>Verpakte hoeveelheid op deze datum</span>
                            <strong>${data.packedQuantity || 0}</strong>
                        </li>
                        <li class="list-group-item d-flex justify-content-between">
                            <span>Efficiëntie score</span>
                            <strong>${data.efficiencyScore || 0}%</strong>
                        </li>
                    </ul>
                </div>
                <div class="col-md-6">
                    <h5>Aanbevelingen</h5>
                    ${data.recommendations && data.recommendations.length > 0 ? `
                        <div class="alert alert-info">
                            <ul class="mb-0">
                                ${data.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                            </ul>
                        </div>
                    ` : `
                        <div class="alert alert-success">
                            <i class="fas fa-check-circle"></i>
                            Situatie was goed op deze datum.
                            ${data.priorityQuantity > 0 ? `<br>Er waren ${data.priorityQuantity} prioriteit items op deze datum.` : ''}
                        </div>
                    `}
                </div>
            </div>
        `;
        
        reportContent.innerHTML = html;
    };

    const emailDailyReport = async () => {
        const reportDate = document.getElementById('report-date').value;
        const email = prompt('Voer het email adres in:');
        
        if (!email) return;
        
        try {
            const response = await fetch('/api/email_items_report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    date: reportDate,
                    email: email
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to send email');
            }
            
            showNotification('success', 'Rapport succesvol verzonden naar ' + email);
            
        } catch (error) {
            console.error('Error sending email:', error);
            showNotification('error', 'Fout bij verzenden email: ' + error.message);
        }
    };

    const printDailyReport = () => {
        const reportContent = document.getElementById('report-content').innerHTML;
        const printWindow = window.open('', '_blank');
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Dagelijkse Verpakkingsrapportage</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
                <style>
                    @media print {
                        .no-print { display: none; }
                    }
                    body { font-size: 12px; }
                </style>
            </head>
            <body class="p-3">
                ${reportContent}
            </body>
            </html>
        `);
        
        printWindow.document.close();
        printWindow.print();
    };

    const toggleExcelExportSection = () => {
        const section = document.getElementById('excel-export-section');
        if (section) {
            const isVisible = section.style.display !== 'none';
            section.style.display = isVisible ? 'none' : 'block';
            
            const btn = document.getElementById('show-excel-export-btn');
            if (btn) {
                btn.innerHTML = isVisible 
                    ? '<i class="fas fa-file-excel"></i> Excel Export'
                    : '<i class="fas fa-times"></i> Sluiten';
            }
        }
    };

    const generateExcelExport = async () => {
        const dateFrom = document.getElementById('excel-date-from').value;
        const dateTo = document.getElementById('excel-date-to').value;
        
        if (!dateFrom || !dateTo) {
            showNotification('error', 'Selecteer beide datums voor Excel export');
            return;
        }
        
        if (new Date(dateFrom) > new Date(dateTo)) {
            showNotification('error', 'Van-datum moet voor tot-datum liggen');
            return;
        }
        
        try {
            const btn = document.getElementById('generate-excel-btn');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Genereren...';
            
            // Fetch data from API
            const response = await fetch(`/api/items_to_pack_excel_export?date_from=${dateFrom}&date_to=${dateTo}`);
            
            if (!response.ok) {
                throw new Error('Failed to generate Excel data');
            }
            
            const data = await response.json();
            
            // Generate and download Excel file
            await createAndDownloadExcel(data, dateFrom, dateTo);
            
            showNotification('success', 'Excel bestand succesvol gedownload');
            
            btn.disabled = false;
            btn.innerHTML = originalText;
            
        } catch (error) {
            console.error('Error generating Excel export:', error);
            showNotification('error', 'Fout bij genereren Excel export: ' + error.message);
            
            const btn = document.getElementById('generate-excel-btn');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-download"></i> Download Excel';
        }
    };

    const createAndDownloadExcel = async (data, dateFrom, dateTo) => {
        // Create a new workbook
        const workbook = XLSX.utils.book_new();

        // 1. SAMENVATTING SHEET
        const totalPacked = data.daily_data.reduce((sum, day) => sum + (day.packed_quantity || 0), 0);
        const totalAdded = data.daily_data.reduce((sum, day) => sum + (day.added_quantity || 0), 0);
        const avgPackedPerDay = data.daily_data.length > 0 ? Math.round(totalPacked / data.daily_data.length) : 0;
        
        const summaryData = [
            ['VERPAKKINGSRAPPORT EXPORT'],
            [''],
            ['Periode:', `${dateFrom} tot ${dateTo}`],
            ['Gegenereerd op:', new Date().toLocaleString('nl-NL')],
            [''],
            ['HUIDIGE STATUS:'],
            ['Totaal stuks te verpakken:', data.summary.current_status.current_total_quantity || 0],
            ['Achterstand stuks:', data.summary.current_status.current_backlog_quantity || 0],
            [''],
            ['PERIODE TOTALEN:'],
            ['Totaal verpakte stuks:', totalPacked],
            ['Totaal binnengekomen stuks:', totalAdded],
            ['Aantal dagen met activiteit:', data.daily_data.length],
            [''],
            ['GEMIDDELDEN:'],
            ['Gem. verpakte stuks per dag:', avgPackedPerDay],
            ['Gem. binnengekomen stuks per dag:', data.daily_data.length > 0 ? Math.round(totalAdded / data.daily_data.length) : 0]
        ];

        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        
        // Style the summary sheet
        summarySheet['!cols'] = [
            { width: 30 }, // Column A
            { width: 20 }  // Column B
        ];

        // Merge cells for title
        summarySheet['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }
        ];

        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Samenvatting');

        // 2. DAGELIJKSE OVERZICHT SHEET
        const dailyOverviewData = [
            ['Datum', 'Te Verpakken Stuks', 'Verpakte Stuks', 'Binnengekomen Stuks', 'Achterstand Stuks'],
            ...data.daily_data.map(day => [
                day.date,
                day.total_to_pack || 0,
                day.packed_quantity || 0,
                day.added_quantity || 0,
                day.backlog_quantity || 0
            ])
        ];

        const dailyOverviewSheet = XLSX.utils.aoa_to_sheet(dailyOverviewData);
        
        // Style the daily overview sheet
        dailyOverviewSheet['!cols'] = [
            { width: 12 }, // Datum
            { width: 18 }, // Te Verpakken Stuks
            { width: 15 }, // Verpakte Stuks
            { width: 18 }, // Binnengekomen Stuks
            { width: 18 }  // Achterstand Stuks
        ];

        XLSX.utils.book_append_sheet(workbook, dailyOverviewSheet, 'Dagelijks Overzicht');

        // 3. VERPAKTE ITEMS DETAIL SHEET
        const packedItemsData = [
            ['Verpakt Datum', 'Item Nummer', 'Pallet Nummer', 'Aantal Stuks', 'Toegevoegd Datum', 'Verpakt Tijdstip', 'Dagen in Systeem'],
            ...data.packed_items.map(item => {
                const addedDate = new Date(item.date_added);
                const packedDate = new Date(item.date_packed);
                const daysInSystem = Math.ceil((packedDate - addedDate) / (1000 * 60 * 60 * 24));
                
                return [
                    item.packed_date,
                    item.item_number,
                    item.po_number,
                    item.amount,
                    item.date_added,
                    new Date(item.date_packed).toLocaleString('nl-NL'),
                    daysInSystem
                ];
            })
        ];

        const packedItemsSheet = XLSX.utils.aoa_to_sheet(packedItemsData);
        
        // Style the packed items sheet
        packedItemsSheet['!cols'] = [
            { width: 12 }, // Verpakt Datum
            { width: 15 }, // Item Nummer
            { width: 15 }, // Pallet Nummer
            { width: 12 }, // Aantal Stuks
            { width: 15 }, // Toegevoegd Datum
            { width: 20 }, // Verpakt Tijdstip
            { width: 15 }  // Dagen in Systeem
        ];

        XLSX.utils.book_append_sheet(workbook, packedItemsSheet, 'Verpakte Items Detail');

        // 4. ANALYSE SHEET (aangepast voor stuks)
        const analysisData = [
            ['ANALYSE & INSIGHTS'],
            [''],
            ['TOP 5 MEEST VERPAKTE ITEMS (op aantal stuks):'],
            ['Item Nummer', 'Totaal Stuks', 'Aantal Keer Verpakt']
        ];

        // Calculate top items by quantity (stuks)
        const itemStats = {};
        data.packed_items.forEach(item => {
            if (!itemStats[item.item_number]) {
                itemStats[item.item_number] = { quantity: 0, count: 0 };
            }
            itemStats[item.item_number].quantity += item.amount;
            itemStats[item.item_number].count += 1;
        });

        const topItems = Object.entries(itemStats)
            .sort((a, b) => b[1].quantity - a[1].quantity)
            .slice(0, 5)
            .map(([itemNumber, stats]) => [itemNumber, stats.quantity, stats.count]);

        analysisData.push(...topItems);
        
        analysisData.push([''], ['SNELSTE VERWERKING (minste dagen in systeem):']);
        
        // Find fastest processed items
        const fastestItems = data.packed_items
            .map(item => {
                const addedDate = new Date(item.date_added);
                const packedDate = new Date(item.date_packed);
                const daysInSystem = Math.ceil((packedDate - addedDate) / (1000 * 60 * 60 * 24));
                return { ...item, daysInSystem };
            })
            .sort((a, b) => a.daysInSystem - b.daysInSystem)
            .slice(0, 5)
            .map(item => [item.item_number, item.po_number, `${item.daysInSystem} dagen`, `${item.amount} stuks`]);

        analysisData.push(['Item Nummer', 'Pallet Nummer', 'Dagen in Systeem', 'Aantal Stuks']);
        analysisData.push(...fastestItems);

        // Add daily performance analysis
        analysisData.push([''], ['BESTE DAGEN (meeste stuks verpakt):']);
        const bestDays = data.daily_data
            .filter(day => day.packed_quantity > 0)
            .sort((a, b) => (b.packed_quantity || 0) - (a.packed_quantity || 0))
            .slice(0, 5)
            .map(day => [day.date, `${day.packed_quantity || 0} stuks`, `${day.backlog_quantity || 0} achterstand`]);

        analysisData.push(['Datum', 'Verpakte Stuks', 'Achterstand']);
        analysisData.push(...bestDays);

        const analysisSheet = XLSX.utils.aoa_to_sheet(analysisData);
        
        // Style the analysis sheet
        analysisSheet['!cols'] = [
            { width: 20 }, // Item/Label
            { width: 20 }, // Value 1
            { width: 20 }, // Value 2
            { width: 15 }  // Value 3
        ];

        // Merge cells for titles
        analysisSheet['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } }
        ];

        XLSX.utils.book_append_sheet(workbook, analysisSheet, 'Analyse');

        // Generate filename with current timestamp
        const timestamp = new Date().toISOString().slice(0, 16).replace(/[:-]/g, '');
        const filename = `Verpakkingsrapport_${dateFrom}_tot_${dateTo}_${timestamp}.xlsx`;

        // Write and download the file
        XLSX.writeFile(workbook, filename);
    };

    // TIMER TRACKING FUNCTIONALITEIT
    // Variabelen voor timer tracking
    const timerState = {
        activeTimeLogs: new Map(), // Map van werknemer ID naar actieve tijdsregistratie
        timeModal: null, // Bootstrap modal instance
        employeeCache: {}, // Cache voor werknemersgegevens
        timeUpdateInterval: null
    };

    /**
     * Initialiseert de tijdsregistratie modal en laadt werknemers
     */
    const initializeTimeRegistrationModal = () => {
        const modalElem = document.getElementById('timeRegistrationModal');
        if (modalElem) {
            timerState.timeModal = new bootstrap.Modal(modalElem);
            
            // Add event to confirm button
            const confirmBtn = document.getElementById('confirm-start-timer-btn');
            if (confirmBtn) {
                confirmBtn.addEventListener('click', startSelectedEmployeesTimer);
            }
            
            // Initialiseer de employee-select direct bij het laden van de pagina
            loadEmployees().then(() => {
                console.log('Werknemers geladen bij initialisatie van modal');
            });
        }
    };
    
    /**
     * Toont de tijdsregistratie modal
     */
    const showTimeRegistrationModal = () => {
        if (timerState.timeModal) {
            // Update modal content voordat we hem tonen
            loadEmployees().then(() => {
                console.log('Werknemers opnieuw geladen bij tonen modal');
                timerState.timeModal.show();
            });
        }
    };
    
    /**
     * Laadt werknemers van de API en vult de dropdown
     */
    const loadEmployees = async () => {
        try {
            const response = await fetch('/api/werknemers');
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const employees = await response.json();
            
            // Cache werknemers voor later gebruik
            employees.forEach(emp => {
                timerState.employeeCache[emp.id] = emp.naam;
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
            showNotification('danger', 'Kon werknemers niet ophalen');
            return [];
        }
    };

    /**
     * Stopt alle actieve timers
     */
    const stopAllTimers = async () => {
        if (timerState.activeTimeLogs.size === 0) {
            showNotification('info', 'Er zijn geen actieve tijdsregistraties');
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
            timerState.activeTimeLogs.forEach(log => uniqueLogIds.add(log.id));
            
            // Stop elke unieke log
            uniqueLogIds.forEach(logId => {
                stopPromises.push(stopTimeLog(logId));
            });
            
            await Promise.all(stopPromises);
            timerState.activeTimeLogs.clear();
            stopTimeUpdateInterval();
            
            updateTimerVisibility();
            showNotification('success', 'Alle tijdsregistraties gestopt');
        } catch (error) {
            console.error('Fout bij stoppen van tijdsregistraties:', error);
            showNotification('danger', 'Fout bij stoppen tijdsregistraties');
        } finally {
            const stopAllTimersBtn = document.getElementById('stop-all-timers-btn');
            if (stopAllTimersBtn) {
                stopAllTimersBtn.disabled = false;
                stopAllTimersBtn.innerHTML = '<i class="fas fa-stop me-1"></i> Stop Alles';
            }
        }
    };
    
    /**
     * Update de zichtbaarheid van timer elementen
     */
    const updateTimerVisibility = () => {
        const activeTimersCard = document.getElementById('active-timers-card');
        const timerButton = document.getElementById('start-timer-button');
        
        console.log('updateTimerVisibility aangeroepen');
        console.log('Aantal actieve logs:', timerState.activeTimeLogs.size);
        console.log('activeTimersCard element:', activeTimersCard);
        console.log('timerButton element:', timerButton);
        
        if (activeTimersCard) {
            if (timerState.activeTimeLogs.size > 0) {
                console.log('Tonen van actieve timers card');
                activeTimersCard.style.display = 'block';
                renderActiveTimeLogs();
            } else {
                console.log('Verbergen van actieve timers card');
                activeTimersCard.style.display = 'none';
            }
        } else {
            console.error('activeTimersCard element niet gevonden!');
        }
        
        // Update startknop in de actiebalk
        if (timerButton) {
            const activeLogsCount = timerState.activeTimeLogs.size;
            
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
    };
    
    /**
     * Toont actieve tijdsregistraties in de UI
     */
    const renderActiveTimeLogs = () => {
        const timeLogsContainer = document.getElementById('time-logs-container');
        console.log('renderActiveTimeLogs aangeroepen');
        console.log('timeLogsContainer element:', timeLogsContainer);
        
        if (!timeLogsContainer) {
            console.error('timeLogsContainer niet gevonden!');
            return;
        }
        
        timeLogsContainer.innerHTML = '';
        
        if (timerState.activeTimeLogs.size === 0) {
            console.log('Geen actieve logs om te tonen');
            timeLogsContainer.innerHTML = '<p class="text-muted">Geen actieve tijdsregistraties</p>';
            return;
        }
        
        console.log(`Renderen van ${timerState.activeTimeLogs.size} actieve logs`);
        
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
        
        // Groepeer logs per log ID om elke registratie afzonderlijk te tonen
        const logGroups = new Map();
        timerState.activeTimeLogs.forEach((log, employeeId) => {
            if (!logGroups.has(log.id)) {
                logGroups.set(log.id, {
                    id: log.id,
                    start_time: log.start_time,
                    employees: []
                });
            }
            logGroups.get(log.id).employees.push({
                id: employeeId,
                name: log.employeeName || timerState.employeeCache[employeeId] || 'Onbekend'
            });
        });
        
        // Render elke log groep als aparte rijen
        logGroups.forEach((logGroup) => {
            console.log(`Toevoegen log groep ${logGroup.id} met ${logGroup.employees.length} werknemers`);
            
            logGroup.employees.forEach((employee, index) => {
                const row = document.createElement('tr');
                
                // Zorg ervoor dat we de server tijd correct interpreteren
                // Server tijd is waarschijnlijk in UTC, dus we moeten dit converteren naar lokale tijd
                let startTime;
                if (logGroup.start_time.includes('Z') || logGroup.start_time.includes('+')) {
                    // Als de tijd al timezone info heeft, gebruik het direct
                    startTime = new Date(logGroup.start_time);
                } else {
                    // Als er geen timezone info is, behandel het als UTC en converteer naar lokale tijd
                    startTime = new Date(logGroup.start_time + 'Z'); // Voeg 'Z' toe om aan te geven dat het UTC is
                }
                
                const now = new Date();
                const elapsedSeconds = Math.floor((now - startTime) / 1000);
                
                console.log(`Originele server tijd: ${logGroup.start_time}, Geconverteerde lokale tijd: ${startTime.toLocaleTimeString('nl-NL')}`);
                
                row.innerHTML = `
                    <td>${employee.name}</td>
                    <td>${startTime.toLocaleTimeString('nl-NL')}</td>
                    <td class="elapsed-time" data-employee-id="${employee.id}">${formatSeconds(elapsedSeconds)}</td>
                    <td>
                        <button class="btn btn-sm btn-danger stop-log-btn" data-log-id="${logGroup.id}" data-employee-id="${employee.id}">
                            <i class="fas fa-stop"></i> Stop
                        </button>
                    </td>
                `;
                
                tbody.appendChild(row);
            });
        });
        
        timeLogsContainer.appendChild(table);
        console.log('Tabel toegevoegd aan timeLogsContainer');
        
        // Stop-knoppen events toevoegen
        document.querySelectorAll('.stop-log-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const logId = e.currentTarget.getAttribute('data-log-id');
                const employeeId = e.currentTarget.getAttribute('data-employee-id');
                console.log(`Stop knop geklikt voor log ${logId}, werknemer ${employeeId}`);
                
                try {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    
                    // Stop de specifieke werknemer uit deze log
                    await fetch(`/api/prepack_timelog/${logId}/stop`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ employeeId: parseInt(employeeId) })
                    });
                    
                    // Verwijder uit actieve logs en update UI
                    timerState.activeTimeLogs.delete(parseInt(employeeId));
                    updateTimerVisibility();
                    showNotification('success', 'Tijdsregistratie gestopt');
                } catch (error) {
                    console.error('Fout bij stoppen tijdsregistratie:', error);
                    showNotification('danger', 'Fout bij stoppen tijdsregistratie');
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-stop"></i> Stop';
                }
            });
        });
        
        console.log(`${document.querySelectorAll('.stop-log-btn').length} stop knoppen event listeners toegevoegd`);
    };

    /**
     * Controleert of er actieve tijdsregistraties zijn bij het laden van de pagina
     */
    const checkActiveTimeLogs = async () => {
        try {
            console.log('Controleren van actieve tijdsregistraties...');
            
            // Haal alle werknemers op om namen te kunnen tonen
            await loadEmployees();
            
            // Haal actieve logs op van de API
            const response = await fetch('/api/prepack_timelog/active');
            
            if (!response.ok) {
                console.error(`API fout bij ophalen actieve logs: ${response.status}`);
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Response van actieve logs API:', data);
            
            if (data.success && data.data && data.data.length > 0) {
                console.log('Actieve logs gevonden:', data.data);
                
                // Actieve tijdsregistraties verwerken
                data.data.forEach(log => {
                    let employeeIds = [];
                    try {
                        if (typeof log.werknemer_ids === 'string') {
                            employeeIds = JSON.parse(log.werknemer_ids);
                        } else if (Array.isArray(log.werknemer_ids)) {
                            employeeIds = log.werknemer_ids;
                        }
                        console.log(`Log ${log.id} heeft werknemers:`, employeeIds);
                    } catch (error) {
                        console.error('Fout bij het parsen van werknemer_ids:', error);
                    }
                    
                    // Voor elke werknemer apart bijhouden
                    employeeIds.forEach(employeeId => {
                        const employeeName = timerState.employeeCache[employeeId] || 'Onbekend';
                        console.log(`Toevoegen werknemer ${employeeId} (${employeeName}) aan actieve logs`);
                        
                        timerState.activeTimeLogs.set(employeeId, {
                            id: log.id,
                            start_time: log.start_time,
                            employeeName: employeeName
                        });
                    });
                });
                
                console.log('Totaal actieve logs in state:', timerState.activeTimeLogs.size);
                updateTimerVisibility();
                startTimeUpdateInterval();
            } else {
                console.log('Geen actieve logs gevonden of data.success is false');
            }
        } catch (error) {
            console.error('Fout bij controleren van actieve tijdsregistraties:', error);
        }
    };
    
    /**
     * Stopt een specifieke tijdsregistratie
     */
    const stopTimeLog = async (logId) => {
        try {
            const response = await fetch(`/api/prepack_timelog/${logId}/stop`, {
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
    };
    
    /**
     * Start het interval voor het bijwerken van de verstreken tijd
     */
    const startTimeUpdateInterval = () => {
        if (timerState.timeUpdateInterval) return;
        
        // Update elke seconde
        timerState.timeUpdateInterval = setInterval(() => {
            timerState.activeTimeLogs.forEach((log, employeeId) => {
                // Zorg ervoor dat we de server tijd correct interpreteren
                // Server tijd is waarschijnlijk in UTC, dus we moeten dit converteren naar lokale tijd
                let startTime;
                if (log.start_time.includes('Z') || log.start_time.includes('+')) {
                    // Als de tijd al timezone info heeft, gebruik het direct
                    startTime = new Date(log.start_time);
                } else {
                    // Als er geen timezone info is, behandel het als UTC en converteer naar lokale tijd
                    startTime = new Date(log.start_time + 'Z'); // Voeg 'Z' toe om aan te geven dat het UTC is
                }
                
                const now = new Date();
                
                // Bereken verstreken tijd in seconden
                const elapsedSeconds = Math.floor((now - startTime) / 1000);
                
                // Update tijd in de tabel
                const timeCell = document.querySelector(`.elapsed-time[data-employee-id="${employeeId}"]`);
                if (timeCell) {
                    timeCell.textContent = formatSeconds(elapsedSeconds);
                }
            });
        }, 1000);
    };
    
    /**
     * Stopt het interval voor het bijwerken van de verstreken tijd
     */
    const stopTimeUpdateInterval = () => {
        if (timerState.timeUpdateInterval) {
            clearInterval(timerState.timeUpdateInterval);
            timerState.timeUpdateInterval = null;
        }
    };
    
    /**
     * Formatteert seconden naar een leesbaar formaat
     */
    const formatSeconds = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return [
            h > 0 ? `${h}u` : '',
            m > 0 ? `${m}m` : '',
            `${s}s`
        ].filter(Boolean).join(' ');
    };

    /**
     * Start de timer voor geselecteerde werknemers
     */
    const startSelectedEmployeesTimer = async () => {
        const employeeSelect = document.getElementById('employee-select');
        if (!employeeSelect) {
            showNotification('warning', 'Geen werknemerselectie gevonden');
            return;
        }
        const selectedOptions = Array.from(employeeSelect.selectedOptions);
        const werknemers = selectedOptions.map(opt => parseInt(opt.value));
        if (werknemers.length === 0) {
            showNotification('warning', 'Selecteer minstens één werknemer');
            return;
        }
        try {
            const confirmBtn = document.getElementById('confirm-start-timer-btn');
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starten...';

            const createdLogs = await Promise.all(
                werknemers.map(async id => {
                    const res = await fetch('/api/prepack_timelog/start', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'Prepack', werknemers: [id] })
                    });
                    const json = await res.json();
                    if (!json.success) throw new Error(json.message || `Kon timer voor werknemer ${id} niet starten`);
                    return { employeeId: id, logId: json.log_id, startISO: json.start_time || new Date().toISOString() };
                })
            );

            createdLogs.forEach(({ employeeId, logId, startISO }) => {
                const naam = timerState.employeeCache[employeeId] || 'Onbekend';
                timerState.activeTimeLogs.set(employeeId, { id: logId, start_time: startISO, employeeName: naam });
            });

            if (timerState.timeModal) timerState.timeModal.hide();
            startTimeUpdateInterval();
            updateTimerVisibility();
            showNotification('success', `Tijdsregistratie gestart voor ${werknemers.length} werknemer(s)`);
        } catch (error) {
            console.error('Fout bij starten tijdsregistratie:', error);
            showNotification('danger', `Fout bij starten tijdsregistratie: ${error.message}`);
        } finally {
            const confirmBtn = document.getElementById('confirm-start-timer-btn');
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = 'Start Timer';
            }
        }
    };

    /**
     * Voegt event listeners toe voor timer functionaliteit
     */
    const setupTimerEventListeners = () => {
        // Start/Stop Timer button
        const timerButton = document.getElementById('start-timer-button');
        if (timerButton) {
            console.log('Timer button gevonden, event listener toegevoegd');
            timerButton.addEventListener('click', showTimeRegistrationModal);
        } else {
            console.error('Timer button niet gevonden!');
        }
        
        // Stop all button event
        const stopAllTimersBtn = document.getElementById('stop-all-timers-btn');
        if (stopAllTimersBtn) {
            console.log('Stop all timers button gevonden, event listener toegevoegd');
            stopAllTimersBtn.addEventListener('click', stopAllTimers);
        } else {
            console.log('Stop all timers button niet gevonden (dit is normaal als er geen actieve timers zijn)');
        }
    };

    // Initialize the application
    const initApp = async () => {
        loadHeader();
        setupSortHeaders();
        setupEventListeners();
        initializeDailyReport();
        initializeTimeRegistrationModal();
        setupTimerEventListeners();
        
        await fetchItems();
        checkActiveTimeLogs();
    };
    
    // Start initialization
    initApp();
});