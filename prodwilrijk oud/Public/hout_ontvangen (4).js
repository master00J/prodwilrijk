$(document).ready(function() {
    // Controleer of de QR-code bibliotheek beschikbaar is
    console.log('QR-code bibliotheek check:', typeof Html5Qrcode !== 'undefined' ? 'Beschikbaar' : 'Niet beschikbaar');

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
    // In de renderOntvangenItems functie, voeg een extra kolom toe aan elke rij
function renderOntvangenItems(items) {
    const tbody = $('#ontvangenTable tbody');
    tbody.empty();

    items.forEach(item => {
        tbody.append(`
            <tr>
                <td>
                    <input type="text" class="input-field houtsoort-input" 
                        value="${item.houtsoort || ''}" data-id="${item.id}" 
                        placeholder="Houtsoort" />
                </td>
                <td>
                    <input type="number" class="input-field lengte-input" 
                        value="${item.lengte || ''}" data-id="${item.id}" 
                        placeholder="Lengte" />
                </td>
                <td>${item.dikte}</td>
                <td>${item.breedte}</td>
                <td>
                    <input type="number" class="input-field aantal-pakken-input" 
                        value="${item.aantal_pakken || ''}" data-id="${item.id}" 
                        placeholder="Aantal pakken" />
                </td>
                <td>
                    <input type="number" class="input-field planken-per-pak-input" 
                        value="${item.planken_per_pak || ''}" data-id="${item.id}" 
                        placeholder="Planken per pak" />
                </td>
                <td>
                    <input type="text" class="input-field locatie-input" 
                        value="${item.locatie || ''}" data-id="${item.id}" 
                        placeholder="Locatie" />
                </td>
                <td>${item.opmerkingen || 'Geen opmerkingen'}</td>
                <td>${new Date(item.ontvangen_op).toLocaleDateString()}</td>
                <td>
                    <div class="btn-group">
                        <button class="add-to-stock btn btn-success btn-sm" data-id="${item.id}">
                            <i class="fas fa-plus me-1"></i>Toevoegen
                        </button>
                        <button class="delete-item btn btn-danger btn-sm ms-1" data-id="${item.id}">
                            <i class="fas fa-trash me-1"></i>Verwijder
                        </button>
                    </div>
                </td>
            </tr>
        `);
    });
}

// Voeg de delete handler toe aan je bestaande event handlers
$(document).on('click', '.delete-item', function() {
    const id = $(this).data('id');
    
    if (confirm('Weet je zeker dat je dit item wilt verwijderen?')) {
        $.ajax({
            url: `/api/hout_ontvangen/${id}`,
            method: 'DELETE',
            success: function() {
                // Toon een succesmelding
                const notification = $('<div>')
                    .addClass('alert alert-success position-fixed')
                    .css({
                        top: '20px',
                        right: '20px',
                        zIndex: 9999,
                        padding: '10px 20px',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                    })
                    .text('Item succesvol verwijderd');

                $('body').append(notification);
                
                setTimeout(() => {
                    notification.fadeOut(500, function() {
                        $(this).remove();
                    });
                }, 3000);

                // Herlaad de items
                loadOntvangenItems();
            },
            error: function(err) {
                console.error('Error deleting item:', err);
                alert('Kon het item niet verwijderen. Probeer het opnieuw.');
            }
        });
    }
});

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
    
    // Update houtsoort
    $(document).on('input', '.houtsoort-input', debounce(function() {
        const id = $(this).data('id');
        const nieuweHoutsoort = $(this).val();

        $.ajax({
            url: `/api/hout_ontvangen/update_houtsoort/${id}`,
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({ houtsoort: nieuweHoutsoort }),
            success: function() {
                console.log('Houtsoort bijgewerkt');
            },
            error: function(err) {
                console.error('Error bijwerken houtsoort:', err);
                alert('Kon de houtsoort niet bijwerken.');
            }
        });
    }, 500));

    // Update lengte
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

    // Variables for modal
    let itemData = {};

    // Add item to stock click handler
    $(document).on('click', '.add-to-stock', function() {
        const id = $(this).data('id');
        const row = $(this).closest('tr');
        
        // Get current values
        itemData = {
            id: id,
            houtsoort: row.find('.houtsoort-input').val(),
            dikte: row.find('td:eq(2)').text(),
            breedte: row.find('td:eq(3)').text()
        };

        // Open the modal dialog
        openAddToStockModal(itemData);
    });

    function openAddToStockModal(itemData) {
        // Populate item details
        $('#itemDetails').html(`
            <p><strong>Houtsoort:</strong> ${itemData.houtsoort || ''}</p>
            <p><strong>Dikte:</strong> ${itemData.dikte} mm</p>
            <p><strong>Breedte:</strong> ${itemData.breedte} mm</p>
        `);

        // Clear any existing pack inputs
        $('#packInputs').empty();

        // Add the first pack input
        addPackInput();

        // Show the modal
        $('#addToStockModal').show();
    }

    function addPackInput() {
        const packNumber = $('#packInputs .pack-input').length + 1;
        const packInputHtml = `
            <div class="pack-input">
                <h3>Pak ${packNumber}</h3>
                <label>Lengte (mm):
                    <input type="number" class="input-field lengte-input-modal" placeholder="Lengte" />
                </label>
                <label>Aantal pakken:
                    <input type="number" class="input-field aantal-pakken-input-modal" placeholder="Aantal pakken" />
                </label>
                <label>Planken per pak:
                    <input type="number" class="input-field planken-per-pak-input-modal" placeholder="Planken per pak" />
                </label>
                <label>Locatie:
                    <input type="text" class="input-field locatie-input-modal" placeholder="Locatie" />
                </label>
                <button class="remove-pack-button"><i class="fas fa-trash-alt"></i> Verwijder pak</button>
            </div>
        `;
        $('#packInputs').append(packInputHtml);
    }

    // Add Pack button handler
    $('#addPackButton').click(function() {
        addPackInput();
    });

    // Remove Pack button handler
    $(document).on('click', '.remove-pack-button', function() {
        $(this).closest('.pack-input').remove();
        // Re-number the pack inputs
        $('#packInputs .pack-input').each(function(index) {
            $(this).find('h3').text('Pak ' + (index + 1));
        });
    });

    // Submit Packs button handler
    $('#submitPacksButton').click(function() {
        const packs = [];
        let valid = true;
        $('#packInputs .pack-input').each(function() {
            const lengte = $(this).find('.lengte-input-modal').val();
            const aantal_pakken = $(this).find('.aantal-pakken-input-modal').val();
            const planken_per_pak = $(this).find('.planken-per-pak-input-modal').val();
            const locatie = $(this).find('.locatie-input-modal').val();

            if (!lengte || !aantal_pakken || !planken_per_pak || !locatie) {
                alert('Vul alle velden in voor alle pakken.');
                valid = false;
                return false; // Break out of each loop
            }

            packs.push({
                lengte: lengte,
                aantal_pakken: aantal_pakken,
                planken_per_pak: planken_per_pak,
                locatie: locatie
            });
        });

        if (!valid) {
            return;
        }

        // Prepare data to send to the server
        const dataToSend = {
            id: itemData.id,
            houtsoort: itemData.houtsoort,
            dikte: itemData.dikte,
            breedte: itemData.breedte,
            packs: packs
        };

        // Send data to the server
        $.ajax({
            url: '/api/hout_ontvangen/toevoegen_aan_voorraad_meerdere_pakken/' + itemData.id,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(dataToSend),
            success: function() {
                alert('Pakken succesvol toegevoegd aan de voorraad!');
                $('#addToStockModal').hide();
                loadOntvangenItems();
            },
            error: function(err) {
                console.error('Error adding items to stock:', err);
                alert('Er is een fout opgetreden bij het toevoegen aan de voorraad.');
                $('#addToStockModal').hide();
                loadOntvangenItems();
            }
        });
    });

    // Close modal handler
    $('.close-button').click(function() {
        $('#addToStockModal').hide();
    });

    // Close modal when clicking outside of it
    $(window).on('click', function(event) {
        if ($(event.target).is('#addToStockModal')) {
            $('#addToStockModal').hide();
        }
    });

    // --- Nieuwe Logica --- 

    const $pakketnummerInput = $('#pakketnummerInput');
    const $zoekPakketBtn = $('#zoekPakketBtn');
    const $zoekStatus = $('#zoekStatus');
    const $pakketDetailsCard = $('#pakketDetailsCard');
    const $locatieInput = $('#locatieInput');
    const $registreerOntvangstBtn = $('#registreerOntvangstBtn');
    const $registreerStatus = $('#registreerStatus');
    const $wachtendeTbody = $('#wachtendePakkettenTable tbody');
    const $startScanBtn = $('#startScanBtn');
    const $qrReaderDiv = $('#qr-reader');
    const $qrReaderResults = $('#qr-reader-results');

    // ----- QR Scanner Variabele -----
    let html5QrCode = null; // Houd de scanner instantie bij

    // ----- Hulpfuncties -----

    // Functie om feedback te tonen
    function showStatus(element, message, type = 'danger') {
        element.removeClass('alert-danger alert-success alert-info').addClass(`alert alert-${type}`).html(message).show();
    }

    // Functie om pakket te zoeken
    function zoekPakket(pakketnummerToSearch = null) {
        // Gebruik meegegeven nummer of de waarde uit het input veld
        const pakketnummer = pakketnummerToSearch || $pakketnummerInput.val().trim();
        if (!pakketnummer) {
            showStatus($zoekStatus, 'Voer een pakketnummer in of scan een QR code.', 'warning');
            $pakketDetailsCard.slideUp(); // Verberg details als zoekveld leeg is
            return;
        }

        // Toon laadindicator en verberg oude details/statussen
        showStatus($zoekStatus, `<i class="fas fa-spinner fa-spin"></i> Pakket '${pakketnummer}' zoeken...`, 'info');
        $pakketDetailsCard.hide();
        $registreerStatus.hide();

        $.ajax({
            url: `/api/zoek_ontvangst_pakket/${encodeURIComponent(pakketnummer)}`,
            method: 'GET',
            success: function(response) {
                if (response.success && response.data) {
                    const data = response.data;
                    // Hernoem eventueel voor consistentie met eerdere code/andere delen
                    // Let op: response.data.opmerking moet uit backend komen als 'opmerkingen'
                    const pakketDetails = {
                        id: data.id, // ID uit hout_ontvangen tabel!
                        pakketnummer: data.pakketnummer,
                        houtsoort: data.houtsoort,
                        exacte_dikte: data.dikte,   // Hernoemd vanuit DB 'dikte'
                        exacte_breedte: data.breedte, // Hernoemd vanuit DB 'breedte'
                        exacte_lengte: data.lengte, // Hernoemd vanuit DB 'lengte'
                        planken_per_pak: data.planken_per_pak,
                        opmerking: data.opmerkingen, // Hernoemd vanuit DB 'opmerkingen'
                        bestelling_id: data.bestelling_id,
                        aangemeld_op: data.aangemeld_op
                    };

                    // Vul de detail card
                    $('#aangemeldPakketId').val(pakketDetails.id); // ZEER BELANGRIJK: Gebruik het ID uit de data!
                    $('#detailPakketnummer').text(pakketDetails.pakketnummer || 'N/B');
                    $('#detailHoutsoort').text(pakketDetails.houtsoort || 'N/B');
                    $('#detailMaten').text(`${pakketDetails.exacte_dikte || '?'}mm x ${pakketDetails.exacte_breedte || '?'}mm x ${pakketDetails.exacte_lengte || '?'}mm`);
                    $('#detailOpmerking').text(pakketDetails.opmerking || '-'); // Gebruik hernoemd veld
                    
                    $locatieInput.val(''); // Maak locatie leeg
                    $registreerStatus.hide(); // Verberg oude status
                    $pakketDetailsCard.slideDown(); // Toon details met animatie
                    $zoekStatus.hide();
                    $locatieInput.focus(); // Focus op locatieveld
                } else {
                    showStatus($zoekStatus, response.message || 'Pakket niet gevonden of al ontvangen.');
                    $pakketDetailsCard.hide();
                }
            },
            error: function(err) {
                console.error('Error zoeken pakket:', err);
                showStatus($zoekStatus, err.responseJSON?.message || 'Serverfout bij het zoeken naar het pakket.');
                $pakketDetailsCard.hide();
            }
        });
    }

    // Event listeners voor zoeken
    $zoekPakketBtn.on('click', () => zoekPakket()); // Roep aan zonder argument

    // Handmatig zoeken met Enter in input veld
    $pakketnummerInput.on('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault(); // Voorkom evt. form submission
            zoekPakket(); // Roep aan zonder argument
        }
    });

    // Functie om ontvangst te registreren
    function registreerOntvangst() {
        // Haal het ID op uit het verborgen veld (ingevuld door zoekPakket)
        const houtOntvangenId = $('#aangemeldPakketId').val();
        const locatie = $locatieInput.val().trim();

        // Validatie
        if (!houtOntvangenId) {
             showStatus($registreerStatus, 'Geen pakket geselecteerd. Zoek eerst een pakket.', 'warning');
             return;
        }
        if (!locatie) {
            showStatus($registreerStatus, 'Locatie is verplicht.', 'warning');
            $locatieInput.focus();
            return;
        }

        // Toon laadindicator en disable knop
        showStatus($registreerStatus, `<i class="fas fa-spinner fa-spin"></i> Bezig met registreren...`, 'info');
        $registreerOntvangstBtn.prop('disabled', true);

        $.ajax({
            url: '/api/registreer_locatie_en_voorraad',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                hout_ontvangen_id: parseInt(houtOntvangenId, 10), // ID van hout_ontvangen rij
                locatie: locatie
            }),
            dataType: 'json',
            success: function(response) {
                if (response.success) {
                    showStatus($registreerStatus, `<i class="fas fa-check-circle"></i> ${response.message || 'Pakket succesvol verwerkt!'}`, 'success');
                    $pakketDetailsCard.slideUp(); // Verberg de detail card
                    $pakketnummerInput.val('').focus(); // Maak input leeg en zet focus terug
                    $zoekStatus.hide(); // Verberg eventuele oude zoekstatussen
                    loadWachtendePakketten(); // Herlaad de lijst!
                    console.log(`Registratie succesvol voor hout_ontvangen ID: ${houtOntvangenId}`);
                } else {
                    // Fout vanuit de API (bv. pakket al verwerkt)
                    showStatus($registreerStatus, `Fout bij registreren: ${response.message || 'Onbekende API fout'}`, 'danger');
                    console.error("API fout bij registreren:", response.message || response);
                }
            },
            error: function(jqXHR, textStatus, errorThrown) {
                 let errorMsg = `Serverfout (${jqXHR.status}) bij registreren locatie.`;
                 try { if(jqXHR.responseJSON && jqXHR.responseJSON.message) errorMsg = jqXHR.responseJSON.message; } catch(e){}
                 showStatus($registreerStatus, errorMsg, 'danger');
                 console.error("Serverfout bij registreren:", textStatus, errorThrown, jqXHR.responseText);
            },
            complete: function() {
                // Enable knop weer, ongeacht resultaat
                $registreerOntvangstBtn.prop('disabled', false);
            }
        });
    }

    // Event listener voor registreren
    $registreerOntvangstBtn.on('click', registreerOntvangst);
    $locatieInput.on('keypress', function(e) { // Ook registreren met Enter in locatieveld
        if (e.key === 'Enter') {
            registreerOntvangst();
        }
    });

    // Initiele focus op pakketnummer input
    $pakketnummerInput.focus();

    // ----- QR Scanner Functies -----

    // Functie om QR scanner te starten
    function startQrScanner() {
        // Controleer of de library bestaat
        if (typeof Html5Qrcode === 'undefined') {
            showStatus($qrReaderResults, 'QR Scanner library niet geladen. Controleer uw internetverbinding.', 'danger');
            console.error("Html5Qrcode library is not defined. Make sure it's included in the HTML.");
            
            // Probeer de bibliotheek dynamisch te laden als laatste redmiddel
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
            script.type = 'text/javascript';
            script.onload = function() {
                if (typeof Html5Qrcode !== 'undefined') {
                    showStatus($qrReaderResults, 'QR Scanner library succesvol geladen. U kunt nu opnieuw proberen te scannen.', 'success');
                    $startScanBtn.prop('disabled', false);
                }
            };
            script.onerror = function() {
                showStatus($qrReaderResults, 'Kon QR Scanner library niet dynamisch laden. Ververs de pagina of gebruik handmatige invoer.', 'danger');
                $startScanBtn.prop('disabled', true);
            };
            
            // Voeg het script toe aan de pagina
            document.head.appendChild(script);
            
            // Disable de scan knop om verdere fouten te voorkomen totdat de bibliotheek is geladen
            $startScanBtn.prop('disabled', true);
            return;
        }

        // Initialiseer scanner indien nodig
        if (!html5QrCode) {
            try {
                 html5QrCode = new Html5Qrcode("qr-reader"); // Koppel aan de div
            } catch (e) {
                 console.error("Failed to initialize Html5Qrcode:", e);
                 showStatus($qrReaderResults, `Fout bij initialiseren scanner: ${e.message}`, 'danger');
                 return;
            }
        }

        // Callback bij succesvol scannen
        const qrCodeSuccessCallback = (decodedText, decodedResult) => {
            console.log(`Code matched = ${decodedText}`, decodedResult);
            $pakketnummerInput.val(decodedText); // Vul input met gescande code
            showStatus($qrReaderResults, `<i class="fas fa-check"></i> QR Code Gescand: ${decodedText}`, 'success');
            stopQrScanner(); // Stop scanner na succes
            zoekPakket(decodedText); // Zoek direct dit pakket
        };

        // Configuratie voor de scanner
        const config = { fps: 10, qrbox: { width: 250, height: 250 }, rememberedStates: true };

        // Start scanning
        $qrReaderDiv.show();
        $qrReaderResults.empty().hide(); // Maak oude resultaten leeg en verberg
        $startScanBtn.html('<i class="fas fa-stop"></i> Stop Scanner').removeClass('btn-secondary').addClass('btn-danger'); // Verander knop tekst/stijl

        // Gebruik camera aan achterkant (environment)
        html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
            .catch(err => {
                console.error("Error starting QR Scanner", err);
                 // Probeer fallback naar user camera als environment faalt? (Optioneel)
                 showStatus($qrReaderResults, `Kon camera (environment) niet starten: ${err}`, 'warning');
                 $qrReaderDiv.hide();
                 $startScanBtn.html('<i class="fas fa-qrcode"></i> Scan QR').removeClass('btn-danger').addClass('btn-secondary');
            });
    }

    // Functie om QR scanner te stoppen
    function stopQrScanner() {
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.stop()
                .then(ignore => {
                    console.log("QR Code scanning stopped.");
                }).catch(err => {
                    console.error("Error stopping QR scanner", err);
                    // Geen grote ramp, ga door met UI update
                }).finally(() => {
                    $qrReaderDiv.hide();
                    $startScanBtn.html('<i class="fas fa-qrcode"></i> Scan QR').removeClass('btn-danger').addClass('btn-secondary');
                    // Laat resultaat zien of verberg het? Hier verbergen we het niet per se.
                    // $qrReaderResults.empty().hide();
                });
        } else {
             // Zorg dat UI altijd correct is, zelfs als scanner niet actief was
             $qrReaderDiv.hide();
             $startScanBtn.html('<i class="fas fa-qrcode"></i> Scan QR').removeClass('btn-danger').addClass('btn-secondary');
        }
    }

    // Klik op "Scan QR" / "Stop Scanner" knop
    $startScanBtn.on('click', function() {
        // Check camera permissies (basis check, werkt niet overal perfect)
         if (typeof navigator.mediaDevices === 'undefined' || typeof navigator.mediaDevices.getUserMedia === 'undefined') {
             showStatus($qrReaderResults,'Camera niet ondersteund door deze browser.', 'danger');
             return;
         }

        if (html5QrCode && html5QrCode.isScanning) {
            stopQrScanner();
        } else {
            startQrScanner();
        }
    });

    // Stop scanner als de pagina wordt verlaten/gesloten
    $(window).on('beforeunload', stopQrScanner);

    // Functie om wachtende pakketten te laden en weer te geven
    function loadWachtendePakketten() {
        $wachtendeTbody.html('<tr><td colspan="6" class="text-center"><i class="fas fa-spinner fa-spin"></i> Laden...</td></tr>');
        $.ajax({
            url: '/api/wachtende_pakketten',
            method: 'GET',
            dataType: 'json', // Verwacht JSON terug
            success: function(response) {
                $wachtendeTbody.empty(); // Maak tabel leeg
                if (response.success && response.data && response.data.length > 0) {
                    response.data.forEach(pakket => {
                        // Probeer datum te formatteren, vang fouten op
                        let aangemeldDatum = 'N/B';
                        try {
                            if (pakket.aangemeld_op) {
                                aangemeldDatum = new Date(pakket.aangemeld_op).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' });
                            }
                        } catch (e) { console.warn("Kon datum niet formatteren:", pakket.aangemeld_op, e); }

                        const row = $(`
                            <tr id="wachtend-${pakket.id}">
                                <td>${pakket.pakketnummer || 'N/B'}</td>
                                <td>${pakket.houtsoort || 'N/B'}</td>
                                <td>${pakket.dikte || '?'} x ${pakket.breedte || '?'} x ${pakket.lengte || '?'}</td>
                                <td>${pakket.planken_per_pak || 'N/B'}</td>
                                <td>${aangemeldDatum}</td>
                                <td>
                                    <button class="btn btn-sm btn-primary select-pakket-btn"
                                            data-pakketnummer="${pakket.pakketnummer}"
                                            title="Selecteer voor locatie-invoer">
                                        <i class="fas fa-map-marker-alt"></i> Locatie
                                    </button>
                                </td>
                            </tr>
                        `);
                        $wachtendeTbody.append(row);
                    });
                } else if (response.success) {
                    $wachtendeTbody.html('<tr><td colspan="6" class="text-center text-muted">Geen pakketten gevonden die wachten op locatie.</td></tr>');
                } else {
                     showStatus($zoekStatus, `Fout bij laden wachtende pakketten: ${response.message || 'Onbekende fout'}`, 'danger');
                     $wachtendeTbody.html('<tr><td colspan="6" class="text-center text-danger">Fout bij laden.</td></tr>');
                     console.error("Fout bij laden wachtende pakketten:", response.message || response);
                }
            },
            error: function(jqXHR, textStatus, errorThrown) {
                 let errorMsg = `Serverfout (${jqXHR.status}) bij laden wachtende pakketten.`;
                 try { if(jqXHR.responseJSON && jqXHR.responseJSON.message) errorMsg = jqXHR.responseJSON.message; } catch(e){}
                 showStatus($zoekStatus, errorMsg, 'danger');
                 $wachtendeTbody.html('<tr><td colspan="6" class="text-center text-danger">Serverfout bij laden.</td></tr>');
                 console.error("Serverfout bij laden wachtende pakketten:", textStatus, errorThrown, jqXHR.responseText);
            }
        });
    }

    // ----- Initialisatie -----

    // Zet initiele focus op het pakketnummer input veld
    $pakketnummerInput.focus();

    // Laad de lijst met wachtende pakketten bij het starten van de pagina
    loadWachtendePakketten();

    // ----- Event Listeners -----

    // Klik op "Locatie" knop in de wachtende lijst tabel
    $wachtendeTbody.on('click', '.select-pakket-btn', function() {
        const pakketnummer = $(this).data('pakketnummer');
        console.log(`Selecteer knop geklikt voor pakket: ${pakketnummer}`);
        $pakketnummerInput.val(pakketnummer); // Vul input veld
        zoekPakket(pakketnummer); // Zoek direct dit pakket
        // Scroll naar zoekveld voor duidelijkheid
        $('html, body').animate({
             scrollTop: $pakketnummerInput.offset().top - 70 // Beetje ruimte boven het veld
         }, 500); // Animatie duurt 0.5 seconde
    });

    console.log("Hout Ontvangen pagina klaar.");

    // Initialisatie van HTML5QR Scanner script
    if (typeof Html5Qrcode === 'undefined') {
        console.warn("QR-code bibliotheek niet geladen, probeer de inline versie...");
        
        // Voeg de broncode inline toe zodat we niet afhankelijk zijn van externe bibliotheken
        // Dit is een klein deel van de functionaliteit die nodig is om de scanner te laten werken
        window.Html5Qrcode = class Html5Qrcode {
            constructor(elementId) {
                this.elementId = elementId;
                this.isScanning = false;
                console.log("QR-code scanner geïnitialiseerd met elementId:", elementId);
                this.element = document.getElementById(elementId);
                if (!this.element) {
                    throw new Error(`Element met ID ${elementId} niet gevonden`);
                }
            }
            
            start(cameraSettings, config, onSuccess) {
                this.isScanning = true;
                
                // Probeer toegang te krijgen tot de camera 
                navigator.mediaDevices.getUserMedia({
                    video: cameraSettings
                }).then(stream => {
                    // Toon een boodschap dat we een echte QR-bibliotheek nodig hebben
                    const message = document.createElement('div');
                    message.innerHTML = `
                        <div style="color: red; padding: 20px; text-align: center; border: 1px solid #ddd;">
                            <h4>QR Scanner niet beschikbaar</h4>
                            <p>De externe QR-code bibliotheken konden niet worden geladen.</p>
                            <p>Gebruik handmatige invoer of herlaad de pagina om het opnieuw te proberen.</p>
                        </div>
                    `;
                    this.element.innerHTML = '';
                    this.element.appendChild(message);
                    
                    // Stop de stream om privacy-redenen
                    stream.getTracks().forEach(track => track.stop());
                    
                    // Onze nep-implementatie kan geen QR-codes scannen
                    // Geef een fout terug zodat de gebruiker weet dat het niet werkt
                    setTimeout(() => {
                        const error = new Error("QR-code bibliotheek niet beschikbaar voor scannen");
                        throw error;
                    }, 100);
                    
                }).catch(error => {
                    console.error("Camera error:", error);
                    throw error;
                });
                
                return Promise.resolve();
            }
            
            stop() {
                this.isScanning = false;
                this.element.innerHTML = '';
                return Promise.resolve();
            }
        };
        
        console.log("Inline versie van Html5Qrcode geladen (beperkte functionaliteit)");
    } else {
        console.log("Html5Qrcode bibliotheek succesvol geladen van externe bron");
    }
});
