$(document).ready(function() {
    let stockData = [];
    let sortOrder = { key: 'dikte', direction: 'asc' };
    const MIN_STOCK = 5; // Stel hier de minimale voorraad in; pas aan naar wens

    // Laad de voorraadgegevens
    function loadStock() {
        $.ajax({
            url: '/api/hout_stock',
            method: 'GET',
            success: function(data) {
                stockData = data;
                renderTable(stockData);
                checkReorder(stockData);
                
                // Toon het juiste sorteerpijltje bij het laden
                updateSortIndicator();
            },
            error: function(err) {
                console.error('Error fetching stock:', err);
                alert('Kon de voorraad niet laden.');
            }
        });
    }

    // Bereken het volume (in m³) van een item
    function calculateVolume(item) {
        return (Number(item.lengte) / 1000) *
               (Number(item.breedte) / 1000) *
               (Number(item.dikte) / 1000) *
               Number(item.aantal);
    }

    // Render de voorraadtabel inclusief volume en een reorder-indicator
    function renderTable(data) {
        const tbody = $('#stockOverviewTable tbody');
        tbody.empty();

        // Sorteer de data op basis van de gekozen kolom
        const sortedData = data.sort((a, b) => {
            const valueA = a[sortOrder.key];
            const valueB = b[sortOrder.key];

            if (sortOrder.key === 'locatie') {
                return sortOrder.direction === 'asc' ? 
                    String(valueA).localeCompare(String(valueB)) : 
                    String(valueB).localeCompare(String(valueA));
            } else if (typeof valueA === 'string') {
                return sortOrder.direction === 'asc' ? 
                    valueA.localeCompare(valueB) : 
                    valueB.localeCompare(valueA);
            } else {
                return sortOrder.direction === 'asc' ? 
                    valueA - valueB : 
                    valueB - valueA;
            }
        });

        let previousDikte = null;
        let previousBreedte = null;

        sortedData.forEach(item => {
            let rowClass = '';

            if (item.dikte !== previousDikte) {
                rowClass = 'thick-separator';
                previousBreedte = null;
            } else if (item.breedte !== previousBreedte) {
                rowClass = 'fine-separator';
            }

            previousDikte = item.dikte;
            previousBreedte = item.breedte;

            const volume = calculateVolume(item);
            let reorderIndicator = '';
            // Als de voorraad (aantal) onder de drempel zit, geef een visuele indicatie
            if (Number(item.aantal) < MIN_STOCK) {
                reorderIndicator = '<span class="text-danger fw-bold">Bijbestellen</span>';
            }

            tbody.append(`
                <tr class="${rowClass}" data-id="${item.id}">
                    <td>${item.soort}</td>
                    <td>${item.pakketnummer ?? ''}</td>
                    <td>${item.dikte}</td>
                    <td>${item.breedte}</td>
                    <td>${item.lengte}</td>
                    <td>${item.locatie}</td>
                    <td>${item.aantal}</td>
                    <td>${volume.toFixed(3)} m³</td>
                    <td>${reorderIndicator}</td>
                </tr>
            `);
        });
    }

    // Controleer of er items zijn die onder de drempel zitten en toon een waarschuwing
    function checkReorder(data) {
        let itemsToReorder = data.filter(item => Number(item.aantal) < MIN_STOCK);
        if (itemsToReorder.length > 0) {
            let message = '<div class="alert alert-warning mt-3"><strong>Let op:</strong> De volgende items moeten bijbesteld worden:<ul>';
            itemsToReorder.forEach(item => {
                message += `<li>${item.soort} – ${item.dikte} x ${item.breedte} (huidige voorraad: ${item.aantal} stuks)</li>`;
            });
            message += '</ul></div>';
            $('#reorder-alert').html(message).show();
        } else {
            $('#reorder-alert').empty();
        }
    }

    // Nieuwe functie om de sorteringsindicator bij te werken
    function updateSortIndicator() {
        $('.sortable').each(function() {
            $(this).find('i').remove();
            if ($(this).data('sort') === sortOrder.key) {
                $(this).append(`<i class="fas fa-sort-${sortOrder.direction === 'asc' ? 'up' : 'down'} ms-1"></i>`);
            }
        });
    }

    // Sorteerfunctionaliteit
    $('.sortable').on('click', function() {
        const sortKey = $(this).data('sort');
        
        // Reset andere kolommen
        $('.sortable').not(this).find('i').remove();
        
        if (sortOrder.key === sortKey) {
            sortOrder.direction = sortOrder.direction === 'asc' ? 'desc' : 'asc';
        } else {
            sortOrder.key = sortKey;
            sortOrder.direction = 'asc';
        }

        // Update sorteerpijltje
        $(this).find('i').remove();
        $(this).append(`<i class="fas fa-sort-${sortOrder.direction === 'asc' ? 'up' : 'down'} ms-1"></i>`);

        renderTable(stockData);
    });

    // Indien je een zoekbalk hebt
    $('#search-bar').on('input', debounce(function() {
        const searchTerm = $(this).val().toLowerCase();
        const filteredData = stockData.filter(item => {
            return (
                item.soort.toLowerCase().includes(searchTerm) ||
                item.locatie.toLowerCase().includes(searchTerm) ||
                item.lengte.toString().includes(searchTerm) ||
                item.breedte.toString().includes(searchTerm) ||
                item.dikte.toString().includes(searchTerm)
            );
        });
        renderTable(filteredData);
    }, 300));

    // Eenvoudige debounce-functie
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    loadStock();
});