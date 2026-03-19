document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed");

    // Load the header
    loadHeader();

    // Fetch and display problemen items
    fetchProblemenItems();

    // Function to load the header
    function loadHeader() {
        fetch('header.html')
            .then(response => response.text())
            .then(data => {
                document.getElementById('header-placeholder').innerHTML = data;
            })
            .catch(error => {
                console.error('Error loading header:', error);
            });
    }

    // Function to fetch problemen items
    function fetchProblemenItems() {
        console.log("Fetching problemen items...");
        fetch('http://45.43.163.153:25022/api/problemen')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                console.log("Fetched data:", data); // Check fetched data
                renderTable(data);
            })
            .catch(error => {
                console.error('Error fetching problemen items:', error);
            });
    }

    // Function to render table
    function renderTable(data) {
        const tableBody = document.getElementById('problemen-table-body');
        tableBody.innerHTML = ''; // Clear existing rows

        data.forEach(item => {
            let images = [];
            if (item.image) {
                try {
                    images = JSON.parse(item.image);
                } catch (e) {
                    console.error("Error parsing image JSON:", e);
                }
            }

            const imagesHtml = images.map((imgPath, index) => `
                <a href="${imgPath}" data-lightbox="gallery-${item.id}" data-title="Image ${index + 1}">
                    <img src="${imgPath}" alt="Image ${index + 1}" style="display:none;">
                </a>
            `).join('');

            const row = document.createElement('tr');

            row.innerHTML = `
                <td>${item.id}</td>
                <td>${item.item_number}</td>
                <td>${item.amount}</td>
                <td>${item.d_number}</td>
                <td>${item.andere_informatie}</td>
                <td>
                    <input type="text" class="po-number-input" data-id="${item.id}" value="${item.po_number || ''}">
                </td>
                <td>
                    <select class="status-select" data-id="${item.id}">
                        <option value="Not handled yet" ${item.status === "Not handled yet" ? 'selected' : ''}>Not handled yet</option>
                        <option value="Email sent" ${item.status === "Email sent" ? 'selected' : ''}>Email sent</option>
                        <option value="Retour" ${item.status === "Retour" ? 'selected' : ''}>Retour</option>
                    </select>
                </td>
                <td>
                    <button class="view-images-button" data-id="${item.id}">View Images</button>
                    <div class="lightbox-gallery" style="display:none;">
                        ${imagesHtml}
                    </div>
                    <form action="/api/problemen/${item.id}/images" class="dropzone" id="dropzone-${item.id}"></form>
                </td>
                <td>
                    <button class="assign-po-button" data-id="${item.id}">Assign PO Number</button>
                </td>
            `;
            console.log("Appending row:", row.innerHTML); // Check row HTML
            tableBody.appendChild(row);

            // Initialize Dropzone for each row
            new Dropzone(`#dropzone-${item.id}`, {
                paramName: 'images', // The name that will be used to transfer the file
                maxFilesize: 2, // MB
                acceptedFiles: 'image/*',
                success: function (file, response) {
                    console.log('Successfully uploaded:', file, response);
                    fetchProblemenItems(); // Refresh the table after successful upload
                },
                error: function (file, response) {
                    console.error('Failed to upload:', file, response);
                }
            });
        });

        addEventListeners();
    }

    // Function to add event listeners
    function addEventListeners() {
        // Add event listeners for PO number assignment
        const assignPoButtons = document.querySelectorAll('.assign-po-button');
        assignPoButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                const id = button.getAttribute('data-id');
                const poNumberInput = document.querySelector(`.po-number-input[data-id="${id}"]`);
                const poNumber = poNumberInput.value;

                // Update the PO number in Problemen
                fetch(`http://45.43.163.153:25022/api/problemen/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ po_number: poNumber })
                })
                .then(response => response.json())
                .then(result => {
                    if (result.success) {
                        // Move the item to items_to_pack
                        fetch(`http://45.43.163.153:25022/api/problemen/move_to_pack/${id}`, {
                            method: 'POST',
                        })
                        .then(moveResponse => moveResponse.json())
                        .then(moveResult => {
                            if (moveResult.success) {
                                alert('PO number assigned and item moved to Items to Pack successfully!');
                                fetchProblemenItems(); // Refresh the table after successful update
                            } else {
                                alert('Failed to move item to Items to Pack.');
                            }
                        })
                        .catch(error => {
                            console.error('Error moving item to Items to Pack:', error);
                            alert('Error moving item to Items to Pack.');
                        });
                    } else {
                        alert('Failed to assign PO number.');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('Error assigning PO number.');
                });
            });
        });

        // Add event listeners for status updates
        const statusSelects = document.querySelectorAll('.status-select');
        statusSelects.forEach(select => {
            select.addEventListener('change', (event) => {
                const id = select.getAttribute('data-id');
                const status = select.value;

                fetch(`http://45.43.163.153:25022/api/problemen/${id}/status`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ status })
                })
                .then(response => response.json())
                .then(result => {
                    if (!result.success) {
                        alert('Failed to update status.');
                    }
                })
                .catch(error => {
                    console.error('Error updating status:', error);
                    alert('Error updating status.');
                });
            });
        });

        // Add event listeners for view images buttons
        const viewImagesButtons = document.querySelectorAll('.view-images-button');
        viewImagesButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                const id = button.getAttribute('data-id');
                const lightboxLinks = document.querySelectorAll(`.lightbox-gallery a[data-lightbox="gallery-${id}"]`);
                if (lightboxLinks.length > 0) {
                    lightboxLinks[0].click(); // This will open the first image and allow swiping
                } else {
                    alert('No images to display.');
                }
            });
        });
    }
});
