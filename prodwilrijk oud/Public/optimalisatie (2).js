document.getElementById('optimalisatie-form').addEventListener('submit', function (event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    let data;
    try {
        data = {
            sheetWidth: parseInt(formData.get('sheetWidth')),
            sheetHeight: parseInt(formData.get('sheetHeight')),
            pieces: JSON.parse(formData.get('pieces'))
        };
    } catch (e) {
        console.error('Invalid input:', e);
        document.getElementById('result').textContent = `Error: Invalid input format. Please ensure the JSON is correctly formatted.`;
        return;
    }
    
    fetch('/api/optimalisatie', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(errorInfo => Promise.reject(errorInfo));
        }
        return response.json();
    })
    .then(result => {
        document.getElementById('result').textContent = JSON.stringify(result, null, 2);
    })
    .catch(error => {
        console.error('Error:', error);
        document.getElementById('result').textContent = `Error: ${error.error || error.message || 'Unknown error occurred'}`;
    });
});