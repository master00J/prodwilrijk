$(document).ready(function() {
    // Load the header
    fetch('header.html')
        .then(response => response.text())
        .then(data => {
            $('#header-placeholder').html(data);
        })
        .catch(err => console.error('Error loading header:', err));

    // Function to load items from 'hout_ontvangen'
    function loadOntvangenItems() {
        $.ajax({
            url: '/api/hout_ontvangen',
            method: 'GET',
            success: function(data) {
                renderOntvangenItems(data);
            },
            error: function(err) {
                console.error('Error fetching hout ontvangen items:', err);
                alert('Kon de ontvangen hout items niet laden.');
            }
        });
    }

    // Function to render items
    function renderOntvangenItems(items) {
    const tbody = $('#ontvangenTable tbody');
    tbody.empty();

    items.forEach(item => {
        tbody.append(`
            <tr>
                <td>${item.houtsoort || 'N/A'}</td>
                <td><input type="number" class="input-field lengte-input" value="${item.lengte}" data-id="${item.id}" /></td>
                <td>${item.dikte}</td>
                <td>${item.breedte}</td>
                <td><input type="number" class="input-field aantal-pakken-input" value="${item.aantal_pakken}" data-id="${item.id}" /></td>
                <td><input type="number" class="input-field planken-per-pak-input" value="${item.planken_per_pak || ''}" data-id="${item.id}" /></td>
                <td><input type="text" class="input-field locatie-input" value="${item.locatie || ''}" data-id="${item.id}" placeholder="Locatie" /></td>
                <td>${item.opmerkingen || 'Geen opmerkingen'}</td>
                <td>${new Date(item.ontvangen_op).toLocaleDateString()}</td>
                <td><button class="add-to-stock" data-id="${item.id}">Toevoegen aan Voorraad</button></td>
            </tr>
        `);
    });
}


    // Load the items when the page loads
    loadOntvangenItems();

    // Debounce function
    function debounce(fn, delay) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    // Update length when user changes it
    $(document).on('input', '.lengte-input', debounce(function() {
        const id = $(this).data('id');
        const nieuweLengte = $(this).val();

        $.ajax({
            url: `/api/hout_ontvangen/update_lengte/${id}`,
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({ lengte: nieuweLengte }),
            success: function() {
                console.log('Lengte bijgewerkt');
            },
            error: function(err) {
                console.error('Error bijwerken lengte:', err);
                alert('Kon de lengte niet bijwerken.');
            }
        });
    }, 500));

    // Update aantal_pakken
    $(document).on('input', '.aantal-pakken-input', debounce(function() {
        const id = $(this).data('id');
        const nieuweAantal = $(this).val();

        $.ajax({
            url: `/api/hout_ontvangen/update_aantal_pakken/${id}`,
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({ aantal_pakken: nieuweAantal }),
            success: function() {
                console.log('Aantal pakken bijgewerkt');
            },
            error: function(err) {
                console.error('Error bijwerken aantal pakken:', err);
                alert('Kon het aantal pakken niet bijwerken.');
            }
        });
    }, 500));

    // Update planken_per_pak
    $(document).on('input', '.planken-per-pak-input', debounce(function() {
        const id = $(this).data('id');
        const plankenPerPak = $(this).val();

        $.ajax({
            url: `/api/hout_ontvangen/update_planken_per_pak/${id}`,
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({ planken_per_pak: plankenPerPak }),
            success: function() {
                console.log('Planken per pak bijgewerkt');
            },
            error: function(err) {
                console.error('Error bijwerken planken per pak:', err);
                alert('Kon de planken per pak niet bijwerken.');
            }
        });
    }, 500));

    // Update locatie
    $(document).on('input', '.locatie-input', debounce(function() {
        const id = $(this).data('id');
        const locatie = $(this).val();

        $.ajax({
            url: `/api/hout_ontvangen/update_locatie/${id}`,
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({ locatie: locatie }),
            success: function() {
                console.log('Locatie bijgewerkt');
            },
            error: function(err) {
                console.error('Error bijwerken locatie:', err);
                alert('Kon de locatie niet bijwerken.');
            }
        });
    }, 500));

    // Add item to stock
    $(document).on('click', '.add-to-stock', function() {
        const id = $(this).data('id');

        // Get current values
        const row = $(this).closest('tr');
        const lengte = row.find('.lengte-input').val();
        const aantalPakken = row.find('.aantal-pakken-input').val();
        const plankenPerPak = row.find('.planken-per-pak-input').val();
        const locatie = row.find('.locatie-input').val();

        if (!lengte || !aantalPakken || !plankenPerPak || !locatie) {
            alert('Vul alle velden in voordat u het item toevoegt aan de voorraad.');
            return;
        }

        // Add to stock
        $.ajax({
            url: `/api/hout_ontvangen/toevoegen_aan_voorraad/${id}`,
            method: 'POST',
            success: function() {
                alert('Item succesvol toegevoegd aan de voorraad!');
                loadOntvangenItems();  // Reload the list
            },
            error: function(err) {
                console.error('Error adding item to stock:', err);
                alert('Kon het item niet toevoegen aan de voorraad.');
            }
        });
    });
});
