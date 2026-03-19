$(document).ready(function() {
    // Laad de header dynamisch
    fetch('header.html')
        .then(response => response.text())
        .then(data => {
            $('#header-placeholder').html(data);
        })
        .catch(error => {
            console.error('Error loading header:', error);
        });

    // Functie om stock data te laden en de tabel bij te werken
    function loadStock() {
        $.ajax({
            url: '/api/hout_stock',  // Relatieve URL naar de backend API
            method: 'GET',
            success: function(data) {
                const tbody = $('#stockTable tbody');
                tbody.empty();
                data.forEach(item => {
                    tbody.append(`
                        <tr>
                            <td>${item.soort}</td>
                            <td>${item.lengte}</td>
                            <td>${item.breedte}</td>
                            <td>${item.dikte}</td>
                            <td>${item.locatie}</td>
                            <td>${item.aantal}</td>
                            <td><button class="pick btn" data-id="${item.id}">Pick Plank</button></td>
                        </tr>
                    `);
                });
            },
            error: function(err) {
                console.error('Error fetching stock data:', err);
                alert('Kon de voorraad niet laden. Controleer de serververbinding.');
            }
        });
    }

    // Laad de voorraad bij het laden van de pagina
    loadStock();

    // Formulierinzending om nieuw hout toe te voegen
    $('#addHoutForm').submit(function(e) {
        e.preventDefault();
        const formData = {
            soort: $('#soort').val(),
            lengte: $('#lengte').val(),
            breedte: $('#breedte').val(),
            dikte: $('#dikte').val(),
            locatie: $('#locatie').val(),
            aantal: $('#aantal').val()
        };

        $.ajax({
            url: '/api/add_hout',  // Relatieve URL naar de backend API
            method: 'POST',
            data: JSON.stringify(formData),
            contentType: 'application/json',
            success: function() {
                alert('Hout succesvol toegevoegd!');
                $('#addHoutForm')[0].reset();  // Formulier legen
                loadStock();  // Herlaad de voorraad
            },
            error: function(err) {
                console.error('Error adding wood to stock:', err);
                alert('Kon het hout niet toevoegen. Controleer de serververbinding.');
            }
        });
    });

    // Verwerken van plankenpikken
    $(document).on('click', '.pick', function() {
        const id = $(this).data('id');
        const aantal = prompt("Hoeveel planken wil je pikken?");
        
        if (aantal && aantal > 0) {
            $.ajax({
                url: `/api/pick_hout/${id}`,  // Relatieve URL naar de backend API
                method: 'PUT',
                data: JSON.stringify({ aantal: aantal }),
                contentType: 'application/json',
                success: function() {
                    alert('Planken succesvol gepikt!');
                    loadStock();  // Herlaad de voorraad
                },
                error: function(err) {
                    console.error('Error picking planks:', err);
                    alert('Kon de planken niet pikken. Controleer de serververbinding.');
                }
            });
        } else {
            alert('Ongeldig aantal ingevoerd.');
        }
    });
});
