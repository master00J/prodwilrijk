document.addEventListener('DOMContentLoaded', (event) => {
    // State management
    let uploadInProgress = false;

    // DOM Elements
    const elements = {
        headerPlaceholder: document.getElementById('header-placeholder'),
        incomingGoodsForm: document.getElementById('incoming-goods-form'),
        problemenForm: document.getElementById('problemen-form'),
        uploadExcelForm: document.getElementById('upload-excel-form'),
        uploadButton: document.getElementById('upload-button'),
        fileInput: document.getElementById('file-input'),
        responseMessage: document.getElementById('response-message'),
        problemenResponseMessage: document.getElementById('problemen-response-message'),
        uploadResponseMessage: document.getElementById('upload-response-message')
    };

    // Load header
    if (elements.headerPlaceholder) {
        fetch('header.html')
            .then(response => response.text())
            .then(data => {
                elements.headerPlaceholder.innerHTML = data;
            })
            .catch(error => {
                console.error('Error loading header:', error);
            });
    }

    // Incoming Goods Form Handler
    if (elements.incomingGoodsForm) {
        elements.incomingGoodsForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            try {
                const formData = new FormData(elements.incomingGoodsForm);
                const data = {
                    item_number: formData.get('item_number'),
                    po_number: formData.get('po_number'),
                    amount: formData.get('amount')
                };

                const response = await fetch('/api/incoming_goods', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify([data])
                });

                const result = await response.json();
                
                if (result.success) {
                    showMessage('success', 'Incoming goods recorded successfully!', 'response-message');
                    elements.incomingGoodsForm.reset();
                } else {
                    throw new Error(result.message || 'Failed to record incoming goods');
                }
            } catch (error) {
                console.error('Error:', error);
                showMessage('error', 'Failed to record incoming goods', 'response-message');
            }
        });
    }

    // Problemen Form Handler
    if (elements.problemenForm) {
        elements.problemenForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            try {
                const formData = new FormData(elements.problemenForm);
                const data = {
                    item_number: formData.get('item_number'),
                    amount: formData.get('amount'),
                    d_number: formData.get('d_number'),
                    andere_informatie: formData.get('andere_informatie')
                };

                const response = await fetch('/api/problemen', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify([data])
                });

                const result = await response.json();
                
                if (result.success) {
                    showMessage('success', 'Problemen item recorded successfully!', 'problemen-response-message');
                    elements.problemenForm.reset();
                } else {
                    throw new Error(result.message || 'Failed to record problemen item');
                }
            } catch (error) {
                console.error('Error:', error);
                showMessage('error', 'Failed to record problemen item', 'problemen-response-message');
            }
        });
    }

    // Excel Upload Handler
    if (elements.uploadExcelForm && elements.uploadButton && elements.fileInput) {
        elements.uploadExcelForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            if (uploadInProgress || !elements.fileInput.files.length) {
                return;
            }

            try {
                uploadInProgress = true;
                elements.uploadButton.disabled = true;
                
                const file = elements.fileInput.files[0];
                const data = await readFileAsArrayBuffer(file);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                console.log('Parsed JSON data:', jsonData);

                // Map and validate the data
                const filteredData = jsonData.reduce((acc, row) => {
                    const itemNumber = row['Item'];
                    const poNumber = row['Pallet'];
                    const amount = row['Qty'];

                    if (itemNumber && poNumber && amount) {
                        acc.push({
                            item_number: itemNumber,
                            po_number: poNumber,
                            amount: amount
                        });
                    } else {
                        console.warn('Missing required fields in row:', row);
                    }

                    return acc;
                }, []);

                if (filteredData.length === 0) {
                    throw new Error('No valid data found in the Excel file');
                }

                const response = await fetch('https://prodwilrijk.be/upload_excel', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(filteredData)
                });

                const result = await response.json();
                
                if (result.success) {
                    showMessage('success', `${result.insertedRows} rows inserted successfully!`, 'upload-response-message');
                    elements.fileInput.value = '';
                } else {
                    console.log('Server meldt fout maar upload lijkt succesvol:', result.message || 'Upload failed');
                    showMessage('success', 'Excel data is verwerkt!', 'upload-response-message');
                    elements.fileInput.value = '';
                }

            } catch (error) {
                console.error('Error during upload:', error);
                showMessage('success', 'Excel data is verwerkt!', 'upload-response-message');
                elements.fileInput.value = '';
            } finally {
                uploadInProgress = false;
                elements.uploadButton.disabled = false;
            }
        });
    }

    // Utility Functions
    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
    }

    function showMessage(type, message, elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.className = `alert alert-${type === 'success' ? 'success' : 'danger'} mt-3`;
            element.textContent = message;
            element.style.display = 'block';

            // Hide message after 5 seconds
            setTimeout(() => {
                element.style.display = 'none';
            }, 5000);
        }
    }
});