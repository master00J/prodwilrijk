$(document).ready(function() {
    // Laad bodem types in de dropdown
    function loadBodemTypes() {
        $.ajax({
            url: '/api/e_bodems',
            method: 'GET',
            success: function(data) {
                const select = $('#bodemType');
                select.empty().append('<option value="">Selecteer bodem...</option>');
                
                data.forEach(bodem => {
                    select.append(`
                        <option value="${bodem.id}">
                            ${bodem.glovia_code} - Rev.${bodem.revisie} - ${bodem.referentie}
                        </option>
                    `);
                });
            },
            error: function(err) {
                console.error('Error loading bodem types:', err);
                showNotification('Fout bij laden van bodem types', 'error');
            }
        });
    }

    // Ontvangst registreren
    $('#ontvangstForm').submit(function(e) {
        e.preventDefault();
        
        const formData = {
            bodem_id: $('#bodemType').val(),
            aantal: $('#aantal').val(),
            staat: $('#staat').val(),
            opmerkingen: $('#opmerkingen').val()
        };

        $.ajax({
            url: '/api/e_bodems_ontvangst',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(formData),
            success: function(response) {
                showNotification('Ontvangst succesvol geregistreerd', 'success');
                $('#ontvangstForm')[0].reset();
                loadOverzicht('ontvangsten');
            },
            error: function(err) {
                console.error('Error registering ontvangst:', err);
                showNotification('Fout bij registreren van ontvangst', 'error');
            }
        });
    });

    // Transport registreren
    $('#transportForm').submit(function(e) {
        e.preventDefault();
        
        // Verzamel geselecteerde items voor transport
        const selectedItems = [];
        $('.select-for-transport:checked').each(function() {
            selectedItems.push({
                ontvangst_id: $(this).data('id'),
                aantal: parseInt($(this).data('available')),
                staat: $(this).data('staat')
            });
        });

        if (selectedItems.length === 0) {
            showNotification('Selecteer eerst items voor transport', 'warning');
            return;
        }

        const formData = {
            ontvangst_ids: selectedItems,
            TO_nummer: $('#TONummer').val(),
            opmerkingen: $('#transportOpmerkingen').val()
        };

        $.ajax({
            url: '/api/e_bodems_transport',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(formData),
            success: function(response) {
                showNotification('Transport succesvol geregistreerd', 'success');
                $('#transportForm')[0].reset();
                loadOverzicht('ontvangsten');
            },
            error: function(err) {
                console.error('Error registering transport:', err);
                showNotification('Fout bij registreren van transport', 'error');
            }
        });
    });
    
    function exportToPDF(location) {
        const button = $(`.export-pdf[data-location="${location}"]`);
        
        // Disable button and show loading state
        button.prop('disabled', true);
        const originalText = button.html();
        button.html('<i class="fas fa-spinner fa-spin"></i> Verzenden...');

        $.ajax({
            url: '/api/e_bodems/send_pdf',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ location: location }),
            success: function(response) {
                showNotification('Voorraadlijst succesvol verzonden via email', 'success');
            },
            error: function(err) {
                console.error('Error sending PDF:', err);
                showNotification('Fout bij versturen van voorraadlijst', 'error');
            },
            complete: function() {
                // Reset button state
                button.prop('disabled', false);
                button.html(originalText);
            }
        });
    }

    // Event listeners (add these to your existing event listeners)
    $('.export-pdf').on('click', function() {
        const location = $(this).data('location');
        exportToPDF(location);
    });

    // Voeg een export-all functie toe die beide locaties exporteert
    $('#export-all-pdf').on('click', function() {
        const button = $(this);
        button.prop('disabled', true);
        const originalText = button.html();
        button.html('<i class="fas fa-spinner fa-spin"></i> Verzenden...');

        // Export beide locaties sequentieel
        Promise.all([
            new Promise((resolve, reject) => {
                $.ajax({
                    url: '/api/e_bodems/send_pdf',
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({ location: 'wilrijk' }),
                    success: resolve,
                    error: reject
                });
            }),
            new Promise((resolve, reject) => {
                $.ajax({
                    url: '/api/e_bodems/send_pdf',
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({ location: 'genk' }),
                    success: resolve,
                    error: reject
                });
            })
        ])
        .then(() => {
            showNotification('Alle voorraadlijsten succesvol verzonden via email', 'success');
        })
        .catch(err => {
            console.error('Error sending PDFs:', err);
            showNotification('Fout bij versturen van voorraadlijsten', 'error');
        })
        .finally(() => {
            button.prop('disabled', false);
            button.html(originalText);
        });
    });

    // Overzicht laden
    function loadOverzicht(type = 'ontvangsten') {
        const url = type === 'ontvangsten' ? '/api/e_bodems_ontvangst' : '/api/e_bodems_transport';
        
        $.ajax({
            url: url,
            method: 'GET',
            success: function(data) {
                renderOverzicht(data, type);
            },
            error: function(err) {
                console.error('Error loading overview:', err);
                showNotification('Fout bij laden van overzicht', 'error');
            }
        });
    }

    // Overzicht renderen
    function renderOverzicht(data, type) {
        const table = $('#overzichtTabel');
        table.empty();

        if (type === 'ontvangsten') {
            table.html(`
                <thead>
                    <tr>
                        <th>Datum</th>
                        <th>Glovia Code</th>
                        <th>Revisie</th>
                        <th>Referentie</th>
                        <th>Aantal</th>
                        <th>Staat</th>
                        <th>Opmerkingen</th>
                        <th>Status</th>
                        <th>Selecteer</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(item => {
                        const beschikbaar = item.aantal - (item.aantal_getransporteerd || 0);
                        return `
                            <tr class="status-${item.staat}">
                                <td>${formatDate(item.datum_ontvangen)}</td>
                                <td>${item.glovia_code}</td>
                                <td>${item.revisie}</td>
                                <td>${item.referentie}</td>
                                <td>${beschikbaar} / ${item.aantal}</td>
                                <td>${formatStaat(item.staat)}</td>
                                <td>${item.opmerkingen || '-'}</td>
                                <td>${beschikbaar > 0 ? 'In voorraad' : 'Getransporteerd'}</td>
                                <td>
                                    ${beschikbaar > 0 ? `
                                        <input type="checkbox" 
                                               class="select-for-transport" 
                                               data-id="${item.id}"
                                               data-available="${beschikbaar}"
                                               data-staat="${item.staat}">
                                    ` : '-'}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            `);
        } else {
            table.html(`
                <thead>
                    <tr>
                        <th>Datum Transport</th>
                        <th>TO Nummer</th>
                        <th>Aantal Items</th>
                        <th>Details</th>
                        <th>Opmerkingen</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(item => `
                        <tr>
                            <td>${formatDate(item.datum_transport)}</td>
                            <td>${item.TO_nummer}</td>
                            <td>${item.totaal_aantal}</td>
                            <td>${item.bodems}</td>
                            <td>${item.opmerkingen || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            `);
        }
    }

    // Helper functies
    function formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('nl-BE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function formatStaat(staat) {
        const states = {
            'goed': '<span class="badge bg-success">Goede staat</span>',
            'reparatie': '<span class="badge bg-warning">Te repareren</span>',
            'afval': '<span class="badge bg-danger">Afval</span>'
        };
        return states[staat] || staat;
    }

    function showNotification(message, type = 'info') {
        const alertClass = {
            'success': 'alert-success',
            'error': 'alert-danger',
            'warning': 'alert-warning',
            'info': 'alert-info'
        };

        const alert = $(`
            <div class="alert ${alertClass[type]} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `);

        $('.container-fluid').prepend(alert);
        setTimeout(() => alert.alert('close'), 5000);
    }

    // Event listeners
    $('#btnOntvangsten').click(() => loadOverzicht('ontvangsten'));
    $('#btnTransporten').click(() => loadOverzicht('transporten'));

    // Initialisatie
    loadBodemTypes();
    loadOverzicht('ontvangsten');
});