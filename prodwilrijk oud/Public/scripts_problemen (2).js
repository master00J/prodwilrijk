document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed");

    // State management
    let problemenItems = [];

    // DOM Elements
    const elements = {
        headerPlaceholder: document.getElementById('header-placeholder'),
        tableBody: document.getElementById('problemen-table-body'),
        container: document.querySelector('.container-fluid')
    };

    // API Endpoints
    const API = {
        base: '/api',
        problemen: '/api/problemen',
        moveToPrepack: (id) => `/api/problemen/move_to_pack/${id}`,
        updateStatus: (id) => `/api/problemen/${id}/status`,
        updateItem: (id) => `/api/problemen/${id}`,
        uploadImages: (id) => `/api/problemen/${id}/images`,
        deleteItem: (id) => `/api/problemen/${id}`
    };

    // Initialize
    initializeApp();

    function initializeApp() {
        loadHeader();
        fetchProblemenItems();
        Dropzone.autoDiscover = false;
    }

    function initTooltips() {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }

    function loadHeader() {
        fetch('header.html')
            .then(response => response.text())
            .then(data => {
                if (elements.headerPlaceholder) {
                    elements.headerPlaceholder.innerHTML = data;
                }
            })
            .catch(error => {
                console.error('Error loading header:', error);
                showAlert('Failed to load header', 'danger');
            });
    }

    function showAlert(message, type = 'success') {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
        alertDiv.style.zIndex = '1050';
        alertDiv.role = 'alert';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alertDiv);

        setTimeout(() => {
            alertDiv.remove();
        }, 5000);
    }

    async function fetchProblemenItems() {
    try {
        const response = await fetch(API.problemen, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            credentials: 'include' // Include credentials if needed
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);

        // Log de ruwe response tekst voor debugging
        const rawText = await response.text();
        console.log('Raw response:', rawText);

        let data;
        try {
            // Probeer de tekst als JSON te parsen
            data = JSON.parse(rawText);
        } catch (e) {
            console.error('Failed to parse JSON:', e);
            if (rawText.includes('<!DOCTYPE html>')) {
                throw new Error('Server returned HTML instead of JSON. You might be redirected to a login page.');
            }
            throw new Error('Invalid JSON response from server');
        }

        if (Array.isArray(data)) {
            problemenItems = data;
            renderTable(data);
            initTooltips();
        } else {
            console.warn('Data is not an array:', data);
            renderTable([]);
        }
    } catch (error) {
        console.error('Error fetching problemen items:', error);
        showAlert(error.message || 'Failed to load items. Please try again later.', 'danger');
        if (elements.tableBody) {
            elements.tableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center">
                        <div class="alert alert-warning mb-0">
                            ${error.message || 'Failed to load items. Please try again later.'}
                        </div>
                    </td>
                </tr>
            `;
        }
    }
}

    function renderTable(data) {
        if (!elements.tableBody) return;

        if (!Array.isArray(data) || data.length === 0) {
            elements.tableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center">
                        <div class="alert alert-info mb-0">
                            No problemen items found.
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        elements.tableBody.innerHTML = '';

        data.forEach(item => {
            if (!item) return;
            const row = createTableRow(item);
            elements.tableBody.appendChild(row);
            try {
                initializeDropzone(item.id);
            } catch (e) {
                console.error('Failed to initialize dropzone:', e);
            }
        });

        addEventListeners();
        initTooltips();
    }

    function createTableRow(item) {
        let images = [];
        if (item.image) {
            try {
                images = typeof item.image === 'string' ? JSON.parse(item.image) : item.image;
            } catch (e) {
                console.error("Error parsing image JSON:", e);
            }
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.id}</td>
            <td>${item.item_number || ''}</td>
            <td>${item.amount || 0}</td>
            <td>${item.d_number || ''}</td>
            <td>${item.andere_informatie || ''}</td>
            <td>
                <input type="text" 
                       class="form-control form-control-sm po-number-input" 
                       data-id="${item.id}" 
                       value="${item.po_number || ''}"
                       placeholder="Enter PO number">
            </td>
            <td>
                <select class="form-select form-select-sm status-select" data-id="${item.id}">
                    <option value="Not handled yet" ${item.status === "Not handled yet" ? 'selected' : ''}>
                        Not handled yet
                    </option>
                    <option value="Email sent" ${item.status === "Email sent" ? 'selected' : ''}>
                        Email sent
                    </option>
                    <option value="Retour" ${item.status === "Retour" ? 'selected' : ''}>
                        Retour
                    </option>
                </select>
            </td>
            <td>
                <div class="d-flex flex-column">
                    <div class="mb-2">
                        <button class="btn btn-sm btn-outline-primary view-images-button" 
                                data-id="${item.id}" 
                                ${images.length === 0 ? 'disabled' : ''}>
                            <i class="bi bi-images"></i> View (${images.length})
                        </button>
                    </div>
                    <div class="fancybox-gallery" style="display:none;">
                        ${images.map((imgPath, index) => `
                            <a href="${imgPath}" 
                               data-fancybox="gallery-${item.id}" 
                               data-caption="Image ${index + 1}">
                                <img src="${imgPath}" alt="Image ${index + 1}" style="display:none;">
                            </a>
                        `).join('')}
                    </div>
                    <div class="dropzone" id="dropzone-${item.id}"></div>
                </div>
            </td>
            <td class="action-buttons">
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-success assign-po-button" 
                            data-id="${item.id}"
                            data-bs-toggle="tooltip"
                            title="Assign PO and move to Items to Pack">
                        <i class="bi bi-check-circle"></i>
                    </button>
                    <button class="btn btn-danger delete-item-button" 
                            data-id="${item.id}"
                            data-bs-toggle="tooltip"
                            title="Delete item">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        `;

        return row;
    }

    function initializeDropzone(itemId) {
        try {
            if (!Dropzone) {
                console.error('Dropzone is not loaded');
                return;
            }

            return new Dropzone(`#dropzone-${itemId}`, {
                url: API.uploadImages(itemId),
                paramName: 'images',
                maxFilesize: 2,
                acceptedFiles: 'image/*',
                addRemoveLinks: true,
                dictDefaultMessage: 'Drop images or click here to upload',
                dictRemoveFile: 'Remove',
                headers: {
                    'Accept': 'application/json'
                },
                success: function(file, response) {
                    console.log('Upload successful:', response);
                    fetchProblemenItems();
                    showAlert('Image uploaded successfully');
                },
                error: function(file, error) {
                    console.error('Upload failed:', error);
                    showAlert('Failed to upload image', 'danger');
                    this.removeFile(file);
                }
            });
        } catch (error) {
            console.error(`Failed to initialize Dropzone for item ${itemId}:`, error);
            showAlert(`Failed to initialize image upload for item ${itemId}`, 'warning');
        }
    }

    async function handlePOAssignment(id, poNumber) {
        try {
            const updateResponse = await fetch(API.updateItem(id), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ po_number: poNumber })
            });

            if (!updateResponse.ok) throw new Error('Failed to update PO number');

            const moveResponse = await fetch(API.moveToPrepack(id), {
                method: 'POST'
            });

            if (!moveResponse.ok) throw new Error('Failed to move item');

            showAlert('Item successfully moved to Items to Pack');
            await fetchProblemenItems();
        } catch (error) {
            console.error('Error in PO assignment:', error);
            showAlert(error.message, 'danger');
            throw error;
        }
    }

    async function handleStatusUpdate(id, status) {
        try {
            const response = await fetch(API.updateStatus(id), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status })
            });

            if (!response.ok) throw new Error('Failed to update status');

            showAlert('Status updated successfully');
        } catch (error) {
            console.error('Error updating status:', error);
            showAlert(error.message, 'danger');
            throw error;
        }
    }

    async function handleItemDeletion(id) {
        try {
            const response = await fetch(API.deleteItem(id), {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Failed to delete item');

            showAlert('Item deleted successfully');
            await fetchProblemenItems();
        } catch (error) {
            console.error('Error deleting item:', error);
            showAlert(error.message, 'danger');
            throw error;
        }
    }

    function addEventListeners() {
        // PO Assignment buttons
        document.querySelectorAll('.assign-po-button').forEach(button => {
            button.addEventListener('click', async (event) => {
                const id = button.getAttribute('data-id');
                const poNumberInput = document.querySelector(`.po-number-input[data-id="${id}"]`);
                if (!poNumberInput.value) {
                    showAlert('Please enter a PO number', 'warning');
                    poNumberInput.focus();
                    return;
                }

                try {
                    button.disabled = true;
                    await handlePOAssignment(id, poNumberInput.value);
                } catch (error) {
                    // Error is already handled in handlePOAssignment
                } finally {
                    button.disabled = false;
                }
            });
        });

        // Status select
        document.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', async (event) => {
                const id = select.getAttribute('data-id');
                const originalValue = select.value;
                try {
                    select.disabled = true;
                    await handleStatusUpdate(id, select.value);
                } catch (error) {
                    select.value = originalValue;
                } finally {
                    select.disabled = false;
                }
            });
        });

        // View images buttons
        document.querySelectorAll('.view-images-button').forEach(button => {
            button.addEventListener('click', (event) => {
                const id = button.getAttribute('data-id');
                const lightboxGallery = document.querySelectorAll(
                    `.fancybox-gallery a[data-fancybox="gallery-${id}"]`
                );
                if (lightboxGallery.length > 0) {
                    $.fancybox.open(lightboxGallery);
                } else {
                    showAlert('No images to display', 'info');
                }
            });
        });

        // Delete buttons
        document.querySelectorAll('.delete-item-button').forEach(button => {
            button.addEventListener('click', async (event) => {
                const id = button.getAttribute('data-id');
                if (confirm('Are you sure you want to delete this item?')) {
                    try {
                        button.disabled = true;
                        await handleItemDeletion(id);
                    } catch (error) {
                        // Error is already handled in handleItemDeletion
                    } finally {
                        button.disabled = false;
                    }
                }
            });
        });
    }
});