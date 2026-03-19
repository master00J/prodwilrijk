$(document).ready(function() {
    let stockData = [];
    let sortAscending = true;

    function loadStockWithLocations() {
        $.ajax({
            url: '/api/hout_stock',
            method: 'GET',
            success: function(data) {
                stockData = data;
                renderTable(stockData);
            },
            error: function(err) {
                console.error('Error fetching stock data:', err);
                alert('Kon de voorraad niet laden.');
            }
        });
    }

    function renderTable(data) {
        const tbody = $('#locationTable tbody');
        tbody.empty();

        data.forEach(item => {
            if (item.aantal > 0) {
                tbody.append(`
                    <tr>
                        <td>${item.soort}</td>
                        <td>${item.lengte}</td>
                        <td>${item.breedte}</td>
                        <td>${item.dikte}</td>
                        <td>${item.locatie}</td>
                        <td>
                            <input type="text" 
                                   class="new-location form-control" 
                                   data-id="${item.id}" 
                                   placeholder="Nieuwe locatie">
                        </td>
                        <td>
                            <button class="update-location btn btn-primary" data-id="${item.id}">
                                <i class="fas fa-save me-1"></i>Wijzig
                            </button>
                        </td>
                    </tr>
                `);
            }
        });
    }

    $(document).on('click', '.update-location', function() {
        const id = $(this).data('id');
        const newLocation = $(this).closest('tr').find('.new-location').val();

        if (newLocation) {
            $.ajax({
                url: `/api/update_location/${id}`,
                method: 'PUT',
                data: JSON.stringify({ locatie: newLocation }),
                contentType: 'application/json',
                success: function() {
                    alert('Locatie succesvol gewijzigd!');
                    loadStockWithLocations();
                },
                error: function(err) {
                    console.error('Error updating location:', err);
                    alert('Kon de locatie niet wijzigen.');
                }
            });
        } else {
            alert('Voer een geldige nieuwe locatie in.');
        }
    });

    $('#search-bar').on('input', debounce(function() {
        const searchTerm = $(this).val().toLowerCase();
        const filteredData = stockData.filter(item => {
            return (
                item.aantal > 0 &&
                (item.soort.toLowerCase().includes(searchTerm) ||
                item.locatie.toLowerCase().includes(searchTerm) ||
                item.lengte.toString().includes(searchTerm) ||
                item.breedte.toString().includes(searchTerm) ||
                item.dikte.toString().includes(searchTerm))
            );
        });
        renderTable(filteredData);
    }, 300));

    $('#sort-locatie').click(function() {
        const sortedData = [...stockData].sort((a, b) => {
            if (sortAscending) {
                return a.locatie.localeCompare(b.locatie);
            } else {
                return b.locatie.localeCompare(a.locatie);
            }
        });
        sortAscending = !sortAscending;
        
        // Update sort indicator
        $(this).find('i').remove();
        $(this).append(`<i class="fas fa-sort-${sortAscending ? 'up' : 'down'} ms-1"></i>`);
        
        renderTable(sortedData);
    });

    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    loadStockWithLocations();
});