document.addEventListener('DOMContentLoaded', (event) => {
    const uploadExcelForm = document.getElementById('upload-excel-form');
    const uploadButton = document.getElementById('upload-button');
    const fileInput = document.getElementById('file-input');
    let uploadInProgress = false;

    // Handle file upload for artikels
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
            const json = XLSX.utils.sheet_to_json(sheet, { raw: false });

            console.log('Parsed JSON:', json); // Debugging: Check the parsed JSON output

            const artikels = json.map(row => {
                return {
                    volledige_omschrijving: row['Omschrijving'] || row['volledige omschrijving'], // Update this according to the headers in your Excel
                    artikelnummer: row['Artikelnummer'] || row['Artnr BC']
                };
            });

            fetch('/api/upload_artikels', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(artikels)
            })
            .then(response => response.json())
            .then(result => {
                document.getElementById('upload-response-message').textContent = 'Artikels uploaded successfully!';
                document.getElementById('row-count-message').textContent = `${artikels.length} rows inserted successfully.`;
                document.getElementById('row-count-modal').style.display = 'block';
                fileInput.value = '';
            })
            .catch(error => {
                console.error('Error uploading artikels:', error);
                document.getElementById('upload-response-message').textContent = 'Failed to upload artikels.';
            })
            .finally(() => {
                uploadInProgress = false;
                uploadButton.disabled = false;
            });
        };

        reader.readAsArrayBuffer(file);
    });
});
