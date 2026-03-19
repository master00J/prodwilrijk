document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const elements = {
        headerPlaceholder: document.getElementById('header-placeholder'),
        incomingGoodsForm: document.getElementById('incoming-goods-form'),
        beschrijvingInput: document.getElementById('beschrijving'),
        lotNumberInput: document.getElementById('lot_number'),
        divisieInput: document.getElementById('divisie'),
        uploadExcelForm: document.getElementById('upload-excel-form'),
        uploadButton: document.getElementById('upload-button'),
        fileInput: document.getElementById('file-input'),
        itemNumberInput: document.getElementById('item_number'),
        kistnummerInput: document.getElementById('kistnummer'),
        responseMessage: document.getElementById('response-message'),
        uploadResponseMessage: document.getElementById('upload-response-message'),
        rowCountMessage: document.getElementById('row-count-message'),
        modal: new bootstrap.Modal(document.getElementById('row-count-modal'))
    };

    let uploadInProgress = false;

    // Load the header
    fetch('/header.html')
        .then(response => response.text())
        .then(data => {
            elements.headerPlaceholder.innerHTML = data;
        })
        .catch(error => {
            console.error('Error loading header:', error);
        });

    // Function to show messages
    function showMessage(element, message, type = 'success') {
        if (element) {
            element.className = `alert alert-${type} mt-3`;
            element.textContent = message;
            element.style.display = 'block';
            setTimeout(() => {
                element.style.display = 'none';
            }, 5000);
        }
    }

    // Toggle fields based on beschrijving
    function toggleFields() {
        const beschrijvingValue = elements.beschrijvingInput?.value.toLowerCase();
        if (beschrijvingValue === 'cooler') {
            elements.lotNumberInput.disabled = true;
            elements.lotNumberInput.value = '';
            elements.divisieInput.disabled = true;
            elements.divisieInput.value = '';
        } else {
            elements.lotNumberInput.disabled = false;
            elements.divisieInput.disabled = false;
        }
    }

    // Event Listeners
    if (elements.beschrijvingInput) {
        elements.beschrijvingInput.addEventListener('input', toggleFields);
    }

    // Handle form submission
    if (elements.incomingGoodsForm) {
        elements.incomingGoodsForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            try {
                const formData = new FormData(elements.incomingGoodsForm);
                const data = {
                    beschrijving: formData.get('beschrijving'),
                    item_number: formData.get('item_number'),
                    lot_number: formData.get('lot_number'),
                    datum_opgestuurd: formData.get('datum_opgestuurd'),
                    kistnummer: formData.get('kistnummer'),
                    divisie: formData.get('divisie'),
                    quantity: formData.get('quantity')
                };

                const response = await fetch('/api/incoming_goods_airtec', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify([data])
                });

                const result = await response.json();

                if (result.success) {
                    showMessage(elements.responseMessage, 'Incoming goods recorded successfully!');
                    elements.incomingGoodsForm.reset();
                    toggleFields();
                } else {
                    throw new Error(result.message || 'Failed to record incoming goods');
                }
            } catch (error) {
                console.error('Error:', error);
                showMessage(elements.responseMessage, 'Failed to record incoming goods', 'danger');
            }
        });
    }

    // Fetch kistnummer when item number is entered
    if (elements.itemNumberInput) {
        elements.itemNumberInput.addEventListener('blur', async (event) => {
            try {
                const itemNumber = event.target.value;
                if (!itemNumber) return;

                const response = await fetch(`/api/get_kistnummer?item_number=${itemNumber}`);
                const data = await response.json();

                if (data.kistnummer) {
                    elements.kistnummerInput.value = data.kistnummer;
                }
            } catch (error) {
                console.error('Error fetching kistnummer:', error);
            }
        });
    }

    // Handle Excel file upload
    if (elements.uploadExcelForm) {
        elements.uploadExcelForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            if (uploadInProgress || !elements.fileInput.files.length) {
                return;
            }

            try {
                uploadInProgress = true;
                elements.uploadButton.disabled = true;
                showMessage(elements.uploadResponseMessage, 'Processing file...', 'info');

                const file = elements.fileInput.files[0];
                const arrayBuffer = await file.arrayBuffer();
                const data = new Uint8Array(arrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(sheet, { raw: false });

                console.log('Parsed JSON:', json);

                const goods = json.map(row => ({
                    beschrijving: row['Beschrijving'] || row['Omschrijving'],
                    item_number: row['Item Number'] || row['Artikelnummer'],
                    lot_number: row['Lot Number'] || row['Partijnummer'],
                    datum_opgestuurd: row['Datum opsturen?'] || row['Datum Opgestuurd'],
                    kistnummer: row['Kistnummer'] ? row['Kistnummer'].slice(-3) : '',
                    divisie: row['Divisie'] || '',
                    quantity: row['Aantal'] || 1
                }));

                const response = await fetch('/api/incoming_goods_airtec', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(goods)
                });

                const result = await response.json();

                if (result.success) {
                    elements.rowCountMessage.textContent = `${goods.length} rows inserted successfully.`;
                    elements.modal.show();
                    elements.fileInput.value = '';
                    showMessage(elements.uploadResponseMessage, 'Goods uploaded successfully!');
                } else {
                    throw new Error(result.message || 'Upload failed');
                }
            } catch (error) {
                console.error('Error uploading goods:', error);
                showMessage(elements.uploadResponseMessage, `Failed to upload goods: ${error.message}`, 'danger');
            } finally {
                uploadInProgress = false;
                elements.uploadButton.disabled = false;
            }
        });
    }
});