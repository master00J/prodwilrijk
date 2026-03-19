$(document).ready(function() {
    // Laad de header dynamisch
    fetch('header.html')
        .then(response => response.text())
        .then(data => {
            $('#header-placeholder').html(data);
        });

    let stockData = [];   // Globale variabele om de volledige voorraad op te slaan
    let pickedData = [];  // Globale variabele om volledig gepickte pakken op te slaan
    let currentSortColumn = '';
    let sortAscending = true;
    let currentViewData = []; // Variabele om de momenteel getoonde data bij te houden

    /**************************************************************
     * 1) Voorraad (HoutStock) ophalen & bewerken
     **************************************************************/

    // Functie om de voorraad op te halen en de tabel bij te werken
    function loadStock() {
        $.ajax({
            url: '/api/hout_stock',
            method: 'GET',
            success: function(data) {
                stockData = data;  // Sla de data op in de globale variabele
                currentViewData = [...stockData]; // Initialiseer de view met alle data
                renderTable(currentViewData); // Render de initiële data
            },
            error: function(err) {
                console.error('Error fetching stock:', err);
                alert('Kon de voorraad niet laden.');
            }
        });
    }

    /***********************************************
     * A) Dubbelklik-bewerken voor voorraad
     ***********************************************/
    function makeFieldEditable(cell, id, fieldName) {
        const originalValue = cell.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalValue;
        input.className = 'form-control form-control-sm';
        
        // Vervang de cell-inhoud met de input
        cell.textContent = '';
        cell.appendChild(input);
        input.focus();

        // Blur of Enter om te saven
        input.addEventListener('blur', function() {
            finishEditing(cell, id, fieldName, input, originalValue);
        });
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                finishEditing(cell, id, fieldName, input, originalValue);
            }
        });
    }

    function finishEditing(cell, id, fieldName, input, originalValue) {
        const newValue = input.value.trim();

        // Eventueel validatie
        let isValid = true;
        if (['dikte', 'breedte', 'lengte'].includes(fieldName)) {
            isValid = !isNaN(newValue) && parseInt(newValue) > 0;
        }

        if (!isValid) {
            alert('Ongeldige waarde ingevoerd');
            cell.textContent = originalValue;
            return;
        }

        // Zet de gewijzigde waarde in een object
        const updateData = {};
        updateData[fieldName] = newValue;

        // Stuur update naar de server (voorraad-route)
        $.ajax({
            url: `/api/hout_stock/${id}`,
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify(updateData),
            success: function() {
                cell.textContent = newValue; // Update cel in de UI
                console.log('Update (stock) successful');
            },
            error: function(err) {
                console.error('Update (stock) failed:', err);
                cell.textContent = originalValue; // Undo UI change
                alert('Update mislukt');
            }
        });
    }

    /***********************************************
     * B) Voorraad-table renderen
     ***********************************************/
    function renderTable(data) {
        const tbody = $('#stockTable tbody');
        tbody.empty();

        data.forEach(item => {
            // Alleen tonen als 'aantal' > 0
            if (item.aantal > 0) {
                const row = $(`
                    <tr data-id="${item.id}">
                        <td data-label="Houtsoort"      class="editable" data-field="soort">${item.soort}</td>
                        <td data-label="Pakketnummer">${item.pakketnummer ?? ''}</td>
                        <td data-label="Dikte (mm)"     class="editable" data-field="dikte">${item.dikte}</td>
                        <td data-label="Breedte (mm)"   class="editable" data-field="breedte">${item.breedte}</td>
                        <td data-label="Lengte (mm)"    class="editable" data-field="lengte">${item.lengte}</td>
                        <td data-label="Locatie"        class="editable" data-field="locatie">${item.locatie}</td>
                        <td data-label="Aantal"         class="stock-amount">${item.aantal}</td>
                        <td data-label="Acties">
                            <button class="pick btn btn-sm btn-primary" data-id="${item.id}">Pick Plank</button>
                            <button class="full-pick btn btn-sm btn-secondary" data-id="${item.id}">Volledig Pak</button>
                        </td>
                    </tr>
                `);

                // Dubbelklik-bewerken activeren
                row.find('.editable').each(function() {
                    $(this).on('dblclick', function() {
                        if (!$(this).find('input').length) {
                            makeFieldEditable(
                                this,          // cell
                                item.id,       // DB ID
                                $(this).data('field') 
                            );
                        }
                    });
                });

                tbody.append(row);
            }
        });
    }

    /***********************************************
     * C) Events: "Pick Plank" & "Volledig Pak"
     ***********************************************/
    // "Pick Plank"
    $(document).on('click', '.pick', function() {
        const id = $(this).data('id');
        const row = $(this).closest('tr');
        const currentStock = parseInt(row.find('.stock-amount').text(), 10);
        const aantal = prompt('Hoeveel planken wil je afnemen?');

        if (aantal && aantal > 0 && aantal <= currentStock) {
            $.ajax({
                url: `/api/pick_hout/${id}`,
                method: 'PUT',
                data: JSON.stringify({ aantal: aantal }),
                contentType: 'application/json',
                success: function(response) {
                    const newStock = currentStock - aantal;
                    if (newStock === 0) {
                        row.remove(); 
                    } else {
                        row.find('.stock-amount').text(newStock);
                    }
                    alert(response.message || 'Pick gedaan!');
                },
                error: function(err) {
                    console.error('Error picking wood:', err);
                    alert('Kon de planken niet afboeken.');
                }
            });
        } else {
            alert('Ongeldig aantal ingevoerd. Probeer het opnieuw.');
        }
    });

    // "Volledig Pak"
    $(document).on('click', '.full-pick', function() {
        const id = $(this).data('id');
        const row = $(this).closest('tr');
        const currentStock = parseInt(row.find('.stock-amount').text(), 10);

        // Haal extra info op uit de row via data-field (onafhankelijk van kolomkop-tekst)
        const houtsoort = row.find('td[data-field="soort"]').text();
        const lengte    = row.find('td[data-field="lengte"]').text();
        const breedte   = row.find('td[data-field="breedte"]').text();
        const dikte     = row.find('td[data-field="dikte"]').text();
        const locatie   = row.find('td[data-field="locatie"]').text();

        const confirmFullPick = confirm('Weet u zeker dat u het volledige pak wilt afboeken?');
        if (confirmFullPick && currentStock > 0) {
            $.ajax({
                url: `/api/pick_hout/${id}`,
                method: 'PUT',
                data: JSON.stringify({ aantal: currentStock }),
                contentType: 'application/json',
                success: function() {
                    alert('Volledig pak succesvol afgeboekt!');
                    row.remove();

                    // Log het volledig gepickte pak
                    $.ajax({
                        url: '/api/log_volledig_gepickt',
                        method: 'POST',
                        data: JSON.stringify({
                            houtsoort: houtsoort,
                            lengte: lengte,
                            breedte: breedte,
                            dikte: dikte,
                            locatie: locatie,
                            datum: new Date().toISOString()
                        }),
                        contentType: 'application/json',
                        success: function() {
                            console.log('Volledig pak succesvol gelogd!');
                        },
                        error: function(err) {
                            console.error('Fout bij het loggen van het volledig pak:', err);
                            console.log('Gegevens die werden verzonden:', {
                                houtsoort, lengte, breedte, dikte, locatie,
                                datum: new Date().toISOString()
                            });
                        }
                    });
                },
                error: function(err) {
                    console.error('Error picking full pack:', err);
                    alert('Kon het volledige pak niet afboeken. Controleer de serververbinding.');
                }
            });
        } else {
            alert('Ongeldig aantal of actie geannuleerd.');
        }
    });

    /**************************************************************
     * 2) Volledig gepickte pakken ophalen & bewerken
     **************************************************************/
    function loadPickedData() {
        $.ajax({
            url: '/api/get_volledig_gepickt',
            method: 'GET',
            success: function(data) {
                pickedData = data; // Sla het op als je wilt
                renderPickedTable(pickedData);
            },
            error: function(err) {
                console.error('Fout bij het ophalen van volledig gepickte pakken:', err);
                alert('Kon de volledig gepickte pakken niet laden.');
            }
        });
    }

    // (a) Functies om dubbelklik-bewerken mogelijk te maken in "Volledig Gepickte Pakken"
    function makeFieldEditablePicked(cell, id, fieldName) {
        const originalValue = cell.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalValue;
        input.className = 'form-control form-control-sm';

        cell.textContent = '';
        cell.appendChild(input);
        input.focus();

        input.addEventListener('blur', function() {
            finishEditingPicked(cell, id, fieldName, input, originalValue);
        });
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                finishEditingPicked(cell, id, fieldName, input, originalValue);
            }
        });
    }

    function finishEditingPicked(cell, id, fieldName, input, originalValue) {
        const newValue = input.value.trim();

        // Eventueel validatie
        let isValid = true;
        if (['dikte','breedte','lengte'].includes(fieldName)) {
            isValid = !isNaN(newValue) && parseInt(newValue) > 0;
        }
        if (!isValid) {
            alert('Ongeldige waarde ingevoerd');
            cell.textContent = originalValue;
            return;
        }

        const updateData = {};
        updateData[fieldName] = newValue;

        // PUT naar bv. /api/volledig_gepickt/:id
        $.ajax({
            url: `/api/volledig_gepickt/${id}`,
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify(updateData),
            success: function() {
                cell.textContent = newValue;
                console.log('Update (volledig_gepickt) success');
            },
            error: function(err) {
                console.error('Update (volledig_gepickt) failed:', err);
                cell.textContent = originalValue;
                alert('Update mislukt');
            }
        });
    }

    // (b) renderPickedTable maakt de cellen editable
    function renderPickedTable(data) {
        const tbody = $('#pickedTable tbody');
        tbody.empty();

        data.forEach(item => {
            // Bepaal item.soort, item.lengte, item.breedte, item.dikte, item.locatie, item.datum
            // Hier maken we 5 kolommen editable (soort, dikte, breedte, lengte, locatie).
            // 'datum' laten we als read-only voorbeeld:
            const row = $(`
                <tr data-id="${item.id}">
                    <td class="editable-picked" data-field="soort">${item.soort}</td>
                    <td class="editable-picked" data-field="dikte">${item.dikte}</td>
                    <td class="editable-picked" data-field="breedte">${item.breedte}</td>
                    <td class="editable-picked" data-field="lengte">${item.lengte}</td>
                    <td class="editable-picked" data-field="locatie">${item.locatie}</td>
                    <td>${new Date(item.datum).toLocaleString()}</td>
                    <td>
                        <button class="delete-picked" data-id="${item.id}">Verwijderen</button>
                        <button class="order-picked" data-id="${item.id}">Bestellen</button>
                    </td>
                </tr>
            `);

            // Dubbelklik-bewerken activeren voor de "Volledig Gepickte" tabel
            row.find('.editable-picked').each(function() {
                $(this).on('dblclick', function() {
                    if (!$(this).find('input').length) {
                        makeFieldEditablePicked(
                            this,           // de td
                            item.id,        // ID
                            $(this).data('field')
                        );
                    }
                });
            });

            tbody.append(row);
        });
    }

    // (c) Verwijderen van een gepicked pak
    $(document).on('click', '.delete-picked', function() {
        const id = $(this).data('id');
        if (confirm('Weet u zeker dat u dit volledig gepickte pak wilt verwijderen?')) {
            $.ajax({
                url: `/api/verwijder_volledig_gepickt/${id}`,
                method: 'DELETE',
                success: function() {
                    alert('Volledig gepickte pak succesvol verwijderd.');
                    loadPickedData(); 
                },
                error: function(err) {
                    console.error('Fout bij het verwijderen van volledig gepickte pakken:', err);
                    alert('Kon het volledig gepickte pak niet verwijderen.');
                }
            });
        }
    });

    // (d) Bestellen van een gepicked pak
    $(document).on('click', '.order-picked', function() {
        const id = $(this).data('id');
        const row = $(this).closest('tr');
        console.log("ID of the selected pack:", id);

        $.ajax({
            url: '/api/voeg_bestelling_toe',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ id: id, aantal_pakken: 1 }),
            success: function() {
                alert('Het gepickte pak is toegevoegd aan de openstaande bestellingen.');
                row.remove();  
            },
            error: function(err) {
                console.error('Fout bij het toevoegen van de bestelling:', err);
                alert('Er is een fout opgetreden bij het toevoegen van de bestelling.');
            }
        });
    });

    /**************************************************************
     * 3) Kolomsortering Voorraad
     **************************************************************/
    $(document).on('click', '.sortable', function() {
        const column = $(this).data('column');
        if (currentSortColumn === column) {
            sortAscending = !sortAscending;
        } else {
            currentSortColumn = column;
            sortAscending = true;
        }
        sortTable(currentSortColumn, sortAscending, currentViewData, renderTable);
    });

    function sortTable(column, ascending, data, renderFunction) {
        const sortedData = [...data];
        sortedData.sort((a, b) => {
            let valA = a[column];
            let valB = b[column];

            if (!isNaN(valA) && !isNaN(valB)) {
                valA = parseFloat(valA);
                valB = parseFloat(valB);
            } else {
                valA = valA.toString().toLowerCase();
                valB = valB.toString().toLowerCase();
            }

            if (valA < valB) return ascending ? -1 : 1;
            if (valA > valB) return ascending ? 1 : -1;
            return 0;
        });
        renderFunction(sortedData);
    }

    /**************************************************************
     * 4) Zoekfunctie Voorraad
     **************************************************************/
    $('#search-bar').on('input', function() {
        const searchTerm = $(this).val().trim();
        const searchTermLower = searchTerm.toLowerCase();

        // Regex om "DxB" formaat te detecteren (met optionele spaties rond 'x')
        const dimensionMatch = searchTerm.match(/^(\d+)\s*[xX]\s*(\d+)$/);

        if (dimensionMatch) {
            const searchDikte = parseInt(dimensionMatch[1], 10);
            const searchBreedte = parseInt(dimensionMatch[2], 10);
            currentViewData = stockData.filter(item =>
                // Controleer DxB en BxD
                (item.dikte === searchDikte && item.breedte === searchBreedte) ||
                (item.dikte === searchBreedte && item.breedte === searchDikte)
            );
        } else if (searchTermLower === "") {
            // Als zoekveld leeg is, toon alles
            currentViewData = [...stockData];
        } else {
            // Algemene zoeklogica: splits op spaties, controleer of alle termen voorkomen
            const searchTerms = searchTermLower.split(/\s+/).filter(t => t.length > 0);
            currentViewData = stockData.filter(item => {
                // Combineer doorzoekbare velden
                const itemText = [
                    item.soort,
                    item.dikte.toString(),
                    item.breedte.toString(),
                    item.lengte.toString(),
                    item.locatie,
                    (item.pakketnummer ?? '').toString(),
                    `${item.dikte}x${item.breedte}` // Behoud combo voor algemene zoekopdrachten
                ].join(' ').toLowerCase();

                // Controleer of elke zoekterm voorkomt in de gecombineerde tekst
                return searchTerms.every(term => itemText.includes(term));
            });
        }

        // Reset sortering bij nieuwe zoekopdracht voor duidelijkheid
        currentSortColumn = '';
        sortAscending = true;
        renderTable(currentViewData); // Render de gefilterde data
    });

    /**************************************************************
     * 5) Styles voor editable cellen
     **************************************************************/
    const style = document.createElement('style');
    style.textContent = `
        .editable, .editable-picked {
            cursor: pointer;
        }
        .editable:hover, .editable-picked:hover {
            background-color: #f8f9fa;
        }
        .editable input, .editable-picked input {
            width: 100%;
            min-width: 60px;
        }
    `;
    document.head.appendChild(style);

    /**************************************************************
     * 6) Init: Voorraad + Gepickte data ophalen
     **************************************************************/
    loadStock();
    loadPickedData();
});
