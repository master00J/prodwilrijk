$(document).ready(function() {
    // Bestaande code behouden
    fetch('header.html')
        .then((response) => response.text())
        .then((data) => {
            $('#header-placeholder').html(data);
        })
        .catch(err => console.error('Error loading header:', err));

    // Functie om notificaties te tonen (toegevoegd/hersteld)
    function showNotification(type, message) {
        // Maak een Bootstrap alert element
        const notification = $('<div>')
            .addClass(`alert alert-${type} alert-dismissible fade show position-fixed`) // Gebruik Bootstrap klassen
            .attr('role', 'alert')
            .css({
                top: '20px',       // Positie bovenaan
                right: '20px',      // Positie rechts
                zIndex: 1050,       // Zorg dat het boven modals etc. komt
                minWidth: '250px',  // Minimale breedte
                boxShadow: '0 .5rem 1rem rgba(0,0,0,.15)' // Kleine schaduw
            })
            .html(message); // Zet het bericht

        // Voeg een sluitknop toe
        notification.append('<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>');

        // Voeg toe aan de body
        $('body').append(notification);

        // Laat de notificatie automatisch verdwijnen na een paar seconden
        setTimeout(() => {
            // Gebruik Bootstrap's alert close methode indien beschikbaar, anders fadeOut
            const alertInstance = bootstrap.Alert.getInstance(notification[0]);
            if (alertInstance) {
                alertInstance.close();
            } else {
                notification.fadeOut(500, function() {
                    $(this).remove();
                });
            }
        }, 4000); // Verdwijnt na 4 seconden
    }

    // Initialize priority column and load orders
    checkPriorityColumn().then(() => {
        loadBestellingen();
        // Voeg de auto-order knop toe nadat de pagina is geladen
        initAutoOrderSystem();
    });

    // Configuratie voor het auto-order systeem
    const CONFIG = {
        MIN_STOCK_THRESHOLD: 5,
        DAYS_TO_ANALYZE: 30,
        STOCK_BUFFER_DAYS: 14,
        MIN_ORDER_PACKAGES: 2,
        MAX_ORDER_PACKAGES: 10,
        DEFAULT_PLANKS_PER_PACKAGE: 50
    };

    // Haal target stock data uit de database
    async function getTargetStockData() {
        const response = await $.ajax({ url: '/api/target_stock', method: 'GET' });
        return Array.isArray(response) ? response : [];
    }

    // Hulpfunctie: maak key voor maps (ZONDER lengte - alle lengtes tellen mee)
    function keyFor(soort, dikte, breedte) {
        return `${soort}-${dikte}-${breedte}`;
    }

    // Haal voorraad (in pakketten) per soort/dikte/breedte op uit /api/hout_stock
    // ALLE lengtes tellen mee voor dezelfde dikte x breedte
    async function getCurrentPackStock() {
        const response = await $.ajax({ 
            url: '/api/hout_stock', 
            method: 'GET',
            cache: false,
            data: { _t: Date.now() }
        });
        const map = new Map();
        response.forEach(item => {
            // Maak key ZONDER lengte - alle lengtes tellen mee
            const key = keyFor(item.soort, item.dikte, item.breedte);
            map.set(key, (map.get(key) || 0) + 1);
        });
        console.log('Huidige voorraad geladen:', map);
        return map;
    }

    // Haal openstaande bestellingen (in packs) per soort/dikte/breedte
    // ALLE lengtes tellen mee voor dezelfde dikte x breedte
    async function getOpenOrderPacks() {
        // Voeg timestamp toe om caching te voorkomen
        const response = await $.ajax({ 
            url: '/api/openstaande_bestellingen', 
            method: 'GET',
            cache: false,
            data: { _t: Date.now() }
        });
        const map = new Map();
        response.forEach(item => {
            // Filter gearchiveerde bestellingen
            if (item.gearchiveerd) return;
            
            const besteldePakken = Number(item.aantal_pakken || 0);
            const ontvangenPakken = Number(item.ontvangen_pakken || 0);
            // Tel alleen de NOG OPENSTAANDE pakken
            const openPacks = besteldePakken - ontvangenPakken;
            
            if (openPacks > 0) {
                // Maak key ZONDER lengte - alle lengtes tellen mee
                const key = keyFor(item.houtsoort, item.dikte, item.breedte);
                map.set(key, (map.get(key) || 0) + openPacks);
            }
        });
        console.log('Openstaande bestellingen geladen:', map);
        return map;
    }

    // Plaats een bestelling
    async function createPacksOrder(houtsoort, dikte, breedte, packs, desiredLength = null) {
        if (packs <= 0) return;
        
        // Gebruik de gewenste lengte uit target_stock, of fallback naar standaard
        let minLength = desiredLength;
        if (!minLength) {
            // Fallback: bepaal standaard lengte op basis van dikte
            minLength = dikte >= 50 ? 3050 : 2440;
        }
        
        const orderDetails = {
            houtsoort: houtsoort,
            dikte: dikte,
            breedte: breedte,
            min_lengte: minLength,
            aantal_pakken: packs,
            planken_per_pak: CONFIG.DEFAULT_PLANKS_PER_PACKAGE,
            opmerkingen: 'Auto-bestelling doelvoorraad',
            priority: false
        };
        await $.ajax({
            url: '/api/create_bestelling',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(orderDetails)
        });
        
        // Wacht kort zodat de database update zeker verwerkt is
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Hoofdfunctie: vergelijkt doelvoorraad met huidige packs + open orders en bestelt tekort
    async function runFixedTargetAutoOrder() {
        try {
            // Haal target stock data en huidige voorraad op (deze veranderen niet tijdens de run)
            const [packStock, targetStockData] = await Promise.all([
                getCurrentPackStock(),
                getTargetStockData()
            ]);

            // Groepeer target stock items per houtsoort/dikte/breedte
            // Meerdere regels met verschillende lengtes worden samengevoegd
            const groupedTargets = new Map();
            targetStockData.forEach(item => {
                const key = keyFor(item.houtsoort, item.dikte, item.breedte);
                if (!groupedTargets.has(key)) {
                    groupedTargets.set(key, {
                        houtsoort: item.houtsoort,
                        dikte: item.dikte,
                        breedte: item.breedte,
                        totalTarget: 0,
                        desiredLength: item.desired_length // Gebruik lengte van eerste item
                    });
                }
                const group = groupedTargets.get(key);
                group.totalTarget += Number(item.target_packs || 0);
                // Update lengte als deze item een lengte heeft en de groep nog geen lengte heeft
                if (item.desired_length && !group.desiredLength) {
                    group.desiredLength = item.desired_length;
                }
            });

            // Haal openstaande bestellingen één keer op
            let openOrderPacks = await getOpenOrderPacks();

            // Loop door alle gegroepeerde targets
            for (const [key, group] of groupedTargets.entries()) {
                const { houtsoort, dikte, breedte, totalTarget, desiredLength } = group;
                
                // Skip als target 0 is
                if (totalTarget <= 0) continue;
                
                // Gebruik key ZONDER lengte - alle lengtes tellen mee als voorraad
                const currentPacks = Number(packStock.get(key) || 0);
                const openPacks = Number(openOrderPacks.get(key) || 0);
                
                // BELANGRIJKE LOGICA: Als we NHV nodig hebben, tel dan ook SXT mee
                // SXT mag altijd meetellen als NHV, andersom niet
                let total = currentPacks + openPacks;
                if (houtsoort === 'NHV') {
                    const sxtKey = keyFor('SXT', dikte, breedte);
                    const sxtCurrentPacks = Number(packStock.get(sxtKey) || 0);
                    const sxtOpenPacks = Number(openOrderPacks.get(sxtKey) || 0);
                    // Tel SXT mee bij de totale beschikbare voorraad voor NHV
                    total += sxtCurrentPacks + sxtOpenPacks;
                    console.log(`NHV check voor ${dikte}x${breedte} (bestel lengte: ${desiredLength || 'auto'}): NHV voorraad=${currentPacks}, NHV openstaand=${openPacks}, SXT voorraad=${sxtCurrentPacks}, SXT openstaand=${sxtOpenPacks}, totaal=${total}, target=${totalTarget}`);
                } else {
                    console.log(`${houtsoort} check voor ${dikte}x${breedte} (bestel lengte: ${desiredLength || 'auto'}): voorraad=${currentPacks}, openstaand=${openPacks}, totaal=${total}, target=${totalTarget}`);
                }
                
                const shortage = totalTarget - total;
                if (shortage > 0) {
                    // Bestel het tekort in één keer
                    await createPacksOrder(houtsoort, dikte, breedte, shortage, desiredLength);
                    console.log(`✓ Auto-bestel: ${houtsoort} ${dikte}x${breedte}x${desiredLength || 'auto'} +${shortage} pak(ken)`);
                    
                    // Haal openstaande bestellingen opnieuw op voor volgende item
                    openOrderPacks = await getOpenOrderPacks();
                }
            }
        } catch (error) {
            console.error('Error in auto-order system:', error);
            throw error;
        }
    }

    // Variabele om te voorkomen dat de auto-order meerdere keren tegelijk draait
    let autoOrderRunning = false;

    // Functie om de auto-order knop toe te voegen
    function initAutoOrderSystem() {
        // Zoek eerst de juiste container
        const controlsContainer = $('.card-body .d-flex').first();
        if (controlsContainer.length) {
            // Voeg de knop toe aan de bestaande controls
            controlsContainer.append(`
                <button id="run-auto-order" class="btn btn-success ms-2">
                    <i class="fas fa-robot"></i> Auto-bestelling uitvoeren
                </button>
            `);

            // Voeg click handler toe
            $('#run-auto-order').on('click', async function() {
                // Voorkom meerdere gelijktijdige uitvoeringen
                if (autoOrderRunning) {
                    alert('Auto-bestelling is al bezig. Even geduld...');
                    return;
                }

                if (!confirm('Wil je de automatische bestellingen uitvoeren op basis van doelvoorraad?')) {
                    return;
                }

                const $button = $(this);
                autoOrderRunning = true;
                
                try {
                    $button.prop('disabled', true)
                           .html('<i class="fas fa-spinner fa-spin"></i> Bezig...');
                    
                    await runFixedTargetAutoOrder();
                    
                    alert('Automatische bestellingen zijn verwerkt!');
                    // Herlaad de pagina om de nieuwe bestellingen te tonen
                    location.reload();
                } catch (error) {
                    console.error('Error in auto-order system:', error);
                    alert('Er is een fout opgetreden bij het automatisch bestellen.');
                    autoOrderRunning = false; // Reset alleen bij error
                    $button.prop('disabled', false)
                           .html('<i class="fas fa-robot"></i> Auto-bestelling uitvoeren');
                }
                // Bij succes doen we geen finally omdat location.reload() de pagina herlaadt
            });
        } else {
            console.error('Could not find controls container for auto-order button');
        }
    }

    // Function to check/create priority column
    function checkPriorityColumn() {
        return $.ajax({
            url: '/api/check_priority_column',
            method: 'GET'
        }).catch(err => {
            console.error('Error checking priority column:', err);
        });
    }

    // Debounce function to limit requests
    function debounce(fn, delay) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), delay);
        };
    }
    
    function makeEditable(cell, fieldName, itemId) {
        const originalContent = cell.textContent;
        const input = document.createElement('input');
        input.type = fieldName.includes('aantal') ? 'number' : 'text';
        input.value = originalContent;
        input.className = 'form-control form-control-sm';
        
        // Vervang cel inhoud met input
        cell.textContent = '';
        cell.appendChild(input);
        input.focus();

        function saveChanges() {
            const newValue = input.value;
            if (newValue === originalContent) {
                cell.textContent = originalContent;
                return;
            }

            $.ajax({
                url: `/api/update_bestelling/${itemId}`,
                method: 'PUT',
                contentType: 'application/json',
                data: JSON.stringify({
                    field: fieldName,
                    value: newValue
                }),
                success: function(response) {
                    cell.textContent = newValue;
                    // Toon kleine notificatie
                    const notification = $('<div>')
                        .addClass('alert alert-success position-fixed')
                        .css({
                            top: '20px',
                            right: '20px',
                            zIndex: 9999,
                            padding: '10px 20px',
                            animation: 'fadeOut 0.5s ease-in-out 2s forwards'
                        })
                        .text('Wijziging opgeslagen');
                    $('body').append(notification);
                    setTimeout(() => notification.remove(), 2500);
                },
                error: function(err) {
                    console.error('Error updating field:', err);
                    cell.textContent = originalContent;
                    alert('Kon de wijziging niet opslaan');
                }
            });
        }
        
        input.addEventListener('blur', saveChanges);
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                saveChanges();
            }
        });
        input.addEventListener('keyup', function(e) {
            if (e.key === 'Escape') {
                cell.textContent = originalContent;
            }
        });
    }
    
    // Function to fetch BC codes in bulk
    function fetchBcCodes(items) {
        return new Promise((resolve, reject) => {
            const uniqueItems = [];
            const seenKeys = new Set();

            items.forEach(item => {
                const houtsoort = item.houtsoort ? item.houtsoort.toLowerCase() : '';
                const key = `${item.breedte}-${item.dikte}-${houtsoort}`;

                if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    uniqueItems.push({
                        breedte: item.breedte,
                        dikte: item.dikte,
                        houtsoort: item.houtsoort || ''
                    });
                }
            });

            $.ajax({
                url: '/api/get_bc_codes',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ items: uniqueItems }),
                success: function (data) {
                    resolve(data.bc_codes || {});
                },
                error: function (err) {
                    console.error('Error fetching BC codes:', err);
                    resolve({});
                }
            });
        });
    }

    // Load the open orders
    function loadBestellingen() {
        $.ajax({
            url: '/api/openstaande_bestellingen',
            method: 'GET',
            success: function (data) {
                if (typeof data === 'string' && data.includes('<!DOCTYPE html>')) {
                    console.log('Session expired, redirecting to login');
                    window.location.href = '/login.html';
                    return;
                }

                const bestellingen = Array.isArray(data) ? data : [];
                if (!Array.isArray(data)) {
                    console.error('Received data is not an array:', data);
                }
                renderBestellingen(bestellingen);
            },
            error: function (err) {
                if (err.status === 401 || err.status === 403) {
                    window.location.href = '/login.html';
                    return;
                }
                console.error('Error fetching bestellingen:', err);
                alert('Kon de bestellingen niet laden.');
            }
        });
    }

    // Function to render the order list
    function renderBestellingen(bestellingen) {
        const tbody = $('#bestellingenTable tbody');
        tbody.empty();

        if (!Array.isArray(bestellingen)) {
            console.error('bestellingen is not an array:', bestellingen);
            bestellingen = [];
            return;
        }
        
        // Filter gearchiveerde bestellingen
        bestellingen = bestellingen.filter(item => !item.gearchiveerd);
        
        // Filter bestellingen waarvan alle pakken zijn ontvangen
        bestellingen = bestellingen.filter(item => {
            const besteldePakken = parseInt(item.aantal_pakken) || 0;
            const ontvangenPakken = parseInt(item.ontvangen_pakken) || 0;
            // Hou alleen bestellingen bij die nog niet volledig ontvangen zijn
            return ontvangenPakken < besteldePakken;
        });

        if (bestellingen.length === 0) {
            tbody.append('<tr><td colspan="15">Geen bestellingen gevonden</td></tr>');
            return;
        }

        const itemsForBcCode = bestellingen.map(item => ({
            breedte: item.breedte,
            dikte: item.dikte,
            houtsoort: item.houtsoort || ''
        }));

        fetchBcCodes(itemsForBcCode).then(bcCodes => {
            bestellingen.forEach((item) => {
                const houtsoort = item.houtsoort ? item.houtsoort.toLowerCase() : '';
                const key = `${item.breedte}-${item.dikte}-${houtsoort}`;
                const bcCode = bcCodes[key] || '';
                const rowStyle = item.priority ? 'background-color: #ffecb3;' : '';

                const ontvangenPakken = item.ontvangen_pakken || 0;
                const remainingPakken = item.aantal_pakken - ontvangenPakken;

                const row = $(`
                    <tr style="${rowStyle}">
                        <td class="editable" data-field="houtsoort">${item.houtsoort || 'N/A'}</td>
                        <td class="editable" data-field="min_lengte">${item.min_lengte || ''}</td>
                        <td class="editable" data-field="dikte">${item.dikte}</td>
                        <td class="editable" data-field="breedte">${item.breedte}</td>
                        <td class="editable" data-field="aantal_pakken">${item.aantal_pakken || ''}</td>
                        <td>${ontvangenPakken}</td>
                        <td>${remainingPakken}</td>
                        <td class="editable" data-field="planken_per_pak">${item.planken_per_pak || ''}</td>
                        <td class="bc-code-field">${bcCode}</td>
                        <td class="editable" data-field="locatie">${item.locatie || ''}</td>
                        <td class="editable" data-field="opmerkingen">${item.opmerkingen || ''}</td>
                        <td>${new Date(item.besteld_op).toLocaleDateString()}</td>
                        <td><input type="checkbox" class="pdf-checkbox" data-id="${item.id}" /></td>
                        <td>
                            <button class="toggle-priority-btn btn btn-sm ${item.priority ? 'btn-warning' : 'btn-secondary'}" 
                                data-id="${item.id}" 
                                title="Toggle prioriteit">
                                ⭐
                            </button>
                        </td>
                        <td>
                            <button class="aanmelden-pakket-btn btn btn-sm btn-info me-1" 
                                    data-id="${item.id}" 
                                    data-houtsoort="${item.houtsoort || 'N/A'}"
                                    data-dikte="${item.dikte}"
                                    data-breedte="${item.breedte}"
                                    data-lengte="${item.min_lengte || 'Onbekend'}"
                                    data-planken="${item.planken_per_pak || 50}"
                                    ${remainingPakken === 0 ? 'disabled' : ''} 
                                    title="Pakket aanmelden voor ontvangst">
                                <i class="fas fa-box-open"></i> Aanmelden
                            </button>
                            <button class="remove-item btn btn-sm btn-danger" data-id="${item.id}" title="Verwijder bestelregel">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </td>
                    </tr>
                `);

                // Voeg dubbelklik event listeners toe
                row.find('.editable').each(function() {
                    $(this).dblclick(function() {
                        if (!$(this).find('input').length) { // Voorkom dubbele inputs
                            makeEditable(this, $(this).data('field'), item.id);
                        }
                    });
                });

                tbody.append(row);
            });
        });
    }

    // Toggle priority handler
    $(document).on('click', '.toggle-priority-btn', async function(e) {
        e.preventDefault();
        const $button = $(this);
        const id = $button.data('id');
        
        if ($button.prop('disabled')) return;
        
        try {
            $button.prop('disabled', true);
            
            const response = await $.ajax({
                url: `/api/toggle_priority/${id}`,
                method: 'PUT',
                contentType: 'application/json'
            });
            
            if (response.success) {
                await loadBestellingen();
            }
        } catch (err) {
            console.error('Error toggling priority:', err);
            alert('Kon de prioriteit niet wijzigen. Probeer het opnieuw.');
        } finally {
            $button.prop('disabled', false);
        }
    });

    $('#select-all-pdf').click(function() {
        const isChecked = this.checked;
        
        // Update de tekst van de knop
        $(this).html(`
            <i class="far ${isChecked ? 'fa-check-square' : 'fa-square'}"></i>
            ${isChecked ? 'Deselecteer Alles' : 'Selecteer Alles'}
        `);
        
        // Selecteer/deselecteer alle checkboxes
        $('.pdf-checkbox').each(function() {
            $(this).prop('checked', !$(this).prop('checked'));
        });
    });

    // Delete an order
    $(document).on('click', '.remove-item', function () {
        const id = $(this).data('id');

        if (confirm('Weet je zeker dat je deze bestelling wilt verwijderen?')) {
            // Voeg een loader toe aan de knop
            const $button = $(this);
            const originalHtml = $button.html();
            $button.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i>');
            
            // Probeer eerst de primaire endpoint
            $.ajax({
                url: `/api/verwijder_bestelling/${id}`,
                method: 'DELETE',
                success: function (response) {
                    showNotification('success', 'Bestelling succesvol verwijderd.');
                    loadBestellingen();
                },
                error: function (xhr) {
                    // Haal de foutmelding op uit de serverrespons als die beschikbaar is
                    let errorMessage = 'Kon de bestelling niet verwijderen.';
                    
                    try {
                        const responseData = xhr.responseJSON;
                        if (responseData && responseData.message) {
                            errorMessage = responseData.message;
                        }
                    } catch (e) {
                        console.error('Kon foutmelding niet parsen', e);
                    }
                    
                    // Als de foutcode 400 is en het lijkt op een constraint error, toon dan een specifiekere melding
                    if (xhr.status === 400) {
                        console.log('Bad Request (400) - Waarschijnlijk een constraint error');
                        errorMessage = 'Deze bestelling kan niet worden verwijderd omdat er gerelateerde pakketten aan gekoppeld zijn.';
                    }
                    
                    console.error('Error bij verwijderen van bestelling:', xhr);
                    showNotification('danger', errorMessage);
                    
                    // Reset de knop
                    $button.prop('disabled', false).html(originalHtml);
                }
            });
        }
    });

    // Event listener voor 'Aanmelden Pakket' knop in de tabel
    $(document).on('click', '.aanmelden-pakket-btn', function() {
        const bestellingId = $(this).data('id');
        const houtsoort = $(this).data('houtsoort');
        const dikte = $(this).data('dikte');
        const breedte = $(this).data('breedte');
        const lengte = $(this).data('lengte'); // Gebruik 'lengte' zoals doorgegeven
        const plankenPerPak = $(this).data('planken'); // Haal planken per pak op

        // Vul modal velden
        $('#aanmeldenBestellingId').val(bestellingId);
        $('#aanmeldenBestellingInfo').text(`${houtsoort} ${dikte}x${breedte}x${lengte}`);
        
        // Sla houtsoort op in de modal data voor later gebruik
        $('#aanmeldenPakketModal').data('houtsoort', houtsoort);
        
        // Vul ook het planken per pak veld
        $('#aanmeldenPlankenPerPak').val(plankenPerPak);
        
        // Pre-fill exacte maten met bestelde maten (als suggestie)
        $('#aanmeldenExacteDikte').val(dikte);
        $('#aanmeldenExacteBreedte').val(breedte);
        // Voor lengte, als het 'Onbekend' was, laat leeg, anders pre-fill
        $('#aanmeldenExacteLengte').val(lengte !== 'Onbekend' ? lengte : ''); 
        
        $('#aanmeldenPakketnummer').val(''); // Maak pakketnummer leeg
        $('#aanmeldenOpmerking').val('');    // Maak opmerking leeg
        $('#aanmeldenError').hide();         // Verberg eventuele oude foutmeldingen

        // Open de modal
        const modalElement = document.getElementById('aanmeldenPakketModal');
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    });

    // Event listener voor bevestigingsknop in de 'Aanmelden Pakket' modal
    $('#aanmeldenModalConfirm').on('click', function() {
        const bestellingId = $('#aanmeldenBestellingId').val();
        const pakketnummer = $('#aanmeldenPakketnummer').val().trim();
        const exacteDikte = $('#aanmeldenExacteDikte').val();
        const exacteBreedte = $('#aanmeldenExacteBreedte').val();
        const exacteLengte = $('#aanmeldenExacteLengte').val();
        const plankenPerPak = $('#aanmeldenPlankenPerPak').val();
        const opmerking = $('#aanmeldenOpmerking').val().trim();
        const $errorDiv = $('#aanmeldenError');
        
        // Haal opgeslagen houtsoort en andere gegevens op uit de modal data
        const houtsoort = $('#aanmeldenPakketModal').data('houtsoort');

        // Basis validatie
        if (!pakketnummer || !exacteDikte || !exacteBreedte || !exacteLengte || !plankenPerPak) {
            $errorDiv.text('Vul alle verplichte velden (*) in.').show();
            return;
        }
        $errorDiv.hide();

        const $button = $(this);
        $button.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Aanmelden...');

        // Data voor de API call
        const pakketData = {
            bestelling_id: parseInt(bestellingId, 10),
            pakketnummer: pakketnummer,
            houtsoort: houtsoort,
            exacte_dikte: parseFloat(exacteDikte),
            exacte_breedte: parseFloat(exacteBreedte),
            exacte_lengte: parseInt(exacteLengte, 10),
            planken_per_pak: parseInt(plankenPerPak, 10),
            opmerking: opmerking
        };

        // AJAX call naar de nieuwe API endpoint
        $.ajax({
            url: '/api/aanmelden_pakket', 
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(pakketData),
            success: function(response) {
                if (response.success) {
                    // Sluit modal
                    const modalElement = document.getElementById('aanmeldenPakketModal');
                    const modal = bootstrap.Modal.getInstance(modalElement);
                    modal.hide();
                    
                    showNotification('success', 'Pakket succesvol aangemeld voor ontvangst!');
                    
                    // Herlaad de bestellingen om de 'ontvangen' teller bij te werken
                    // (Backend moet dit ondersteunen door aantal_ontvangen te verhogen)
                    loadBestellingen(); 
                } else {
                    $errorDiv.text(response.message || 'Er is een fout opgetreden bij het aanmelden.').show();
                }
            },
            error: function(err) {
                console.error('Error aanmelden pakket:', err);
                $errorDiv.text(err.responseJSON?.message || 'Serverfout bij het aanmelden van het pakket.').show();
            },
            complete: function() {
                $button.prop('disabled', false).html('Pakket Aanmelden');
            }
        });
    });

    // Send the order list as a PDF via email
    $('#send-email').click(function () {
        const selectedItems = [];
        $('.pdf-checkbox:checked').each(function () {
            const id = $(this).data('id');
            selectedItems.push(id);
        });

        if (selectedItems.length === 0) {
            alert('Selecteer minstens één bestelling om te verzenden.');
            return;
        }

        $.ajax({
            url: '/api/openstaande_bestellingen',
            method: 'GET',
            success: function (data) {
                if (!Array.isArray(data)) {
                    alert('Geen geldige bestellingenlijst ontvangen.');
                    return;
                }

                const filteredData = data.filter(item => selectedItems.includes(item.id));

                const itemsForBcCode = filteredData.map(item => ({
                    breedte: item.breedte,
                    dikte: item.dikte,
                    houtsoort: item.houtsoort || ''
                }));

                fetchBcCodes(itemsForBcCode).then(bcCodes => {
                    const updatedData = filteredData.map(item => {
                        const houtsoort = item.houtsoort ? item.houtsoort.toLowerCase() : '';
                        const key = `${item.breedte}-${item.dikte}-${houtsoort}`;
                        item.bc_code = bcCodes[key] || '';
                        return item;
                    });

                    // Sort data: priority first, then normal sorting
                    const sortedData = updatedData.sort((a, b) => {
                        // First sort by priority
                        if (a.priority !== b.priority) {
                            return b.priority ? 1 : -1;
                        }
                        
                        // Then by houtsoort
                        if (a.houtsoort !== b.houtsoort) {
                            return a.houtsoort.localeCompare(b.houtsoort);
                        }
                        
                        // Then by dikte
                        const dikteA = parseFloat(a.dikte);
                        const dikteB = parseFloat(b.dikte);
                        if (dikteA !== dikteB) {
                            return dikteA - dikteB;
                        }
                        
                        // Then by breedte
                        const breedteA = parseFloat(a.breedte);
                        const breedteB = parseFloat(b.breedte);
                        if (breedteA !== breedteB) {
                            return breedteA - breedteB;
                        }
                        
                        // Finally by lengte
                        const lengteA = parseFloat(a.min_lengte || 0);
                        const lengteB = parseFloat(b.min_lengte || 0);
                        return lengteA - lengteB;
                    });

                    // Column order for PDF
                    const pdfColumnOrder = [
                        'dikte',
                        'breedte',
                        'min_lengte',
                        'houtsoort',
                        'aantal_pakken',
                        'bc_code',
                        'opmerkingen',
                        'besteld_op'
                    ];

                    // Column headers for PDF
                    const pdfColumnHeaders = {
                        'dikte': 'Dikte',
                        'breedte': 'Breedte',
                        'min_lengte': 'Lengte',
                        'houtsoort': 'Houtsoort',
                        'aantal_pakken': 'Aantal',
                        'bc_code': 'BC Code',
                        'opmerkingen': 'Opmerkingen',
                        'besteld_op': 'Besteld Op'
                    };

                    $.ajax({
                        url: '/api/send_order_pdf',
                        method: 'POST',
                        contentType: 'application/json',
                        data: JSON.stringify({ 
                            orderList: sortedData,
                            columnOrder: pdfColumnOrder,
                            columnHeaders: pdfColumnHeaders
                        }),
                        success: function () {
                            alert('Bestelling succesvol verzonden als PDF!');
                        },
                        error: function (err) {
                            console.error('Error sending email with PDF:', err);
                            alert('Kon de bestelling niet verzenden.');
                        }
                    });
                });
            },
            error: function (err) {
                console.error('Error fetching bestellingen:', err);
                alert('Kon de bestellingen niet laden.');
            }
        });
    });
});