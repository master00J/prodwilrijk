document.addEventListener('DOMContentLoaded', (event) => {
    // Load the header
    fetch('header.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById('header-placeholder').innerHTML = data;
        });

    const incomingGoodsForm = document.getElementById('incoming-goods-form');
    const uploadExcelForm = document.getElementById('upload-excel-form');
    const uploadButton = document.getElementById('upload-button');
    const fileInput = document.getElementById('file-input');
    let uploadInProgress = false;

    if (incomingGoodsForm) {
        incomingGoodsForm.addEventListener('submit', (event) => {
            event.preventDefault();

            const formData = new FormData(incomingGoodsForm);
            const data = {
                motornummer: formData.get('motornummer'),
                type: formData.get('type'),
                verzendnota: formData.get('verzendnota'),
                datum_binnen: formData.get('datum_binnen')
            };

            fetch('/api/incoming_goods_cnh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify([data])
            })
            .then(response => response.json())
            .then(result => {
                document.getElementById('response-message').textContent = 'Incoming goods recorded successfully!';
                incomingGoodsForm.reset();
            })
            .catch(error => {
                console.error('Error:', error);
                document.getElementById('response-message').textContent = 'Failed to record incoming goods.';
            });
        });

        // Handle file upload for multiple incoming goods
        if (uploadExcelForm) {
            uploadExcelForm.addEventListener('submit', (event) => {
                event.preventDefault();
                if (uploadInProgress) return;
                uploadInProgress = true;
                uploadButton.disabled = true;

                const file = fileInput.files[0];
                const reader = new FileReader();

                reader.onload = (e) => {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(sheet, { raw: true });

                    console.log('Parsed Excel Data:', json);

                    const goods = json.map(row => ({
                        motornummer: row['Motor Number'],
                        type: row['Type'],
                        verzendnota: row['Verzendnota'],
                        datum_binnen: row['Datum Binnen'] || new Date().toISOString().split('T')[0]
                    }));

                    console.log('Parsed Goods:', goods);

                    fetch('/api/incoming_goods_cnh', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(goods)
                    })
                    .then(response => response.json())
                    .then(result => {
                        document.getElementById('upload-response-message').textContent = 'Goods uploaded successfully!';
                        // Show the modal with the number of rows inserted
                        document.getElementById('row-count-message').textContent = `${goods.length} rows inserted successfully.`;
                        document.getElementById('row-count-modal').style.display = 'block';
                        // Reset the file input
                        fileInput.value = '';
                    })
                    .catch(error => {
                        console.error('Error uploading goods:', error);
                        document.getElementById('upload-response-message').textContent = 'Failed to upload goods.';
                    })
                    .finally(() => {
                        uploadInProgress = false;
                        uploadButton.disabled = false;
                    });
                };

                reader.readAsArrayBuffer(file);
            });
        }
    }
});
