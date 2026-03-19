$(document).ready(function() {
    let verbruikData = [];

    function loadVerbruik(startDatum, eindDatum, soort) {
        const filters = {
            startDatum: startDatum || '',
            eindDatum: eindDatum || '',
            soort: soort || ''
        };

        $.ajax({
            url: '/api/hout_verbruik',
            method: 'GET',
            data: filters,
            success: function(data) {
                verbruikData = data;
                renderTable(verbruikData);
            },
            error: function(err) {
                console.error('Error fetching verbruik data:', err);
                alert('Kon het verbruikte hout niet laden.');
            }
        });
    }

    function renderTable(data) {
        const tbody = $('#verbruikTable tbody');
        tbody.empty();

        data.forEach(item => {
            const volume = calculateVolume(item);
            tbody.append(`
                <tr>
                    <td>${item.soort}</td>
                    <td>${item.lengte}</td>
                    <td>${item.breedte}</td>
                    <td>${item.dikte}</td>
                    <td>${item.aantal}</td>
                    <td>${volume.toFixed(3)} m³</td>
                    <td>${formatDate(item.datum_verbruik)}</td>
                </tr>
            `);
        });

        updateTotals(data);
    }

    function calculateVolume(item) {
        return (item.lengte / 1000) * (item.breedte / 1000) * (item.dikte / 1000) * item.aantal;
    }

    function formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('nl-NL', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    function updateTotals(data) {
        const totalVolume = data.reduce((sum, item) => sum + calculateVolume(item), 0);
        const totalItems = data.reduce((sum, item) => sum + item.aantal, 0);

        // Voeg totalen toe aan de tabel footer of update een statistieken sectie
        // Hier kun je code toevoegen om totalen weer te geven
    }

    // Event handler voor filter toepassen
    $('#apply-filters').click(function() {
        const startDatum = $('#start-datum').val();
        const eindDatum = $('#eind-datum').val();
        const soort = $('#soort-filter').val();

        if (startDatum && eindDatum && new Date(startDatum) > new Date(eindDatum)) {
            alert('Startdatum moet voor einddatum liggen');
            return;
        }

        loadVerbruik(startDatum, eindDatum, soort);
    });

    // Initiële data laden
    loadVerbruik();
});