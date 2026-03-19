// Maak deze functie globaal beschikbaar
window.openFullImage = function(url) {
    window.open(url, '_blank');
};

document.addEventListener('DOMContentLoaded', (event) => {
    // Globale variabelen
    let casesData = [];      // Alle kisten
    let stockData = [];      // Voorraad data 
    let localStockData = []; // Lokale kopie van stock data
    let needsData = {};      // Berekende behoeften
    let ordersData = [];     // Alle bestellingen
    let selectedProductionLocations = {}; // Geselecteerde productielocaties per kisttype
    let pac3plTypes = new Set(); // Track crate types die uit PAC3PL (Willebroek) binnenkwamen
    let lastUpdated = null;
    let csvData = null;
    let csvHeaders = [];
    let forecastData = []; // Houd ingelezen forecastgegevens bij
    let excelFile = null;
    let excelData = null; // Houd ingelezen Excel gegevens bij
    
    /**
     * Functie om de geselecteerde productielocatie bij te houden
     */
    function updateSelectedProductionLocation(caseType, location) {
        if (!selectedProductionLocations) {
            selectedProductionLocations = {};
        }
        
        // Sla de selectie op voor dit kisttype
        selectedProductionLocations[caseType] = location;
        console.log(`Productielocatie voor ${caseType} bijgewerkt naar: ${location}`);
    }
    
    // Bootstrap modals initialiseren
    const csvImportModal = new bootstrap.Modal(document.getElementById('csvImportModal'));
    const caseModal = new bootstrap.Modal(document.getElementById('caseModal'));
    const excelImportModal = new bootstrap.Modal(document.getElementById('excelImportModal'));
    const orderDetailModal = new bootstrap.Modal(document.getElementById('orderDetailModal')); // Voeg deze toe als die er nog niet is
    const casePhotosModal = new bootstrap.Modal(document.getElementById('casePhotosModal')); // Voeg deze toe
    const addExternalArticlesOrderModal = new bootstrap.Modal(document.getElementById('addExternalArticlesOrderModal'));

    // Event listeners voor filter elementen
    document.getElementById('search-box').addEventListener('input', filterCases);
    document.getElementById('location-filter').addEventListener('change', filterCases);
    
    // Event listeners voor knoppen
    document.getElementById('refresh-button').addEventListener('click', loadCases);
    document.getElementById('add-manual-case-button').addEventListener('click', showAddCaseModal);
    document.getElementById('import-csv-button').addEventListener('click', () => csvImportModal.show());
    // Voeg hier de nieuwe listener toe
    const transferButton = document.getElementById('transfer-undelivered-button');
    if (transferButton) {
        transferButton.addEventListener('click', handleTransferUndelivered);
    }
    document.getElementById('import-excel-button').addEventListener('click', () => excelImportModal.show());
    document.getElementById('preview-button').addEventListener('click', previewCSV);
    document.getElementById('import-button').addEventListener('click', performCSVImport);
    document.getElementById('save-case-button').addEventListener('click', saveCase);

    const addExternalArticlesOrderBtn = document.getElementById('addExternalArticlesOrderBtn');
    if (addExternalArticlesOrderBtn) {
        addExternalArticlesOrderBtn.addEventListener('click', () => {
            // Reset formulier en lijst bij openen modal
            document.getElementById('externalArticlesOrderForm').reset();
            currentExternalOrderItems = [];
            renderExternalArticlesTable();
            // Ophalen beschikbare artikelen als dat nog niet gebeurd is of als de lijst leeg is
            if (!availableArticles || availableArticles.length === 0) {
                fetchAvailableArticles();
            }
            addExternalArticlesOrderModal.show();
        });
    }

    // Event listener voor het opslaan van de externe artikelbestelling
    const saveExternalArticlesOrderBtn = document.getElementById('saveExternalArticlesOrderBtn');
    if (saveExternalArticlesOrderBtn) {
        saveExternalArticlesOrderBtn.addEventListener('click', saveExternalArticlesOrder);
    }
    
    // Event listener voor het toevoegen van een artikel aan de lijst in de modal
    const addExternalArticleToListBtn = document.getElementById('addExternalArticleToListBtn');
    if (addExternalArticleToListBtn) {
        addExternalArticleToListBtn.addEventListener('click', addExternalArticleToList);
    }

    // Event listeners en logica voor artikel zoeken in de modal
    const searchExternalArticleInput = document.getElementById('searchExternalArticle');
    const externalArticleSuggestionsDiv = document.getElementById('externalArticleSuggestions');
    
    if (searchExternalArticleInput && externalArticleSuggestionsDiv) {
        searchExternalArticleInput.addEventListener('input', () => {
            const query = searchExternalArticleInput.value.toLowerCase();
            externalArticleSuggestionsDiv.innerHTML = ''; // Maak eerst leeg
            console.log('[Debug] Zoekopdracht:', query);
            console.log('[Debug] Aantal beschikbare artikelen:', availableArticles.length);

            if (query.length < 2) { // Begin met zoeken vanaf 2 karakters
                externalArticleSuggestionsDiv.style.display = 'none';
                // return;
            }

            if (!availableArticles || availableArticles.length === 0) {
                console.log('[Debug] Geen artikelen beschikbaar om te doorzoeken.');
                externalArticleSuggestionsDiv.style.display = 'none';
                // return;
            }

            const filteredArticles = availableArticles.filter(article => 
                (article.artikelnummer && article.artikelnummer.toLowerCase().includes(query)) || 
                (article.volledige_omschrijving && article.volledige_omschrijving.toLowerCase().includes(query)) // Gebruik volledige_omschrijving
            );

            console.log('[Debug] Gefilterde artikelen:', filteredArticles);

            if (filteredArticles.length > 0) {
                filteredArticles.slice(0, 10).forEach(article => {
                    const suggestionItem = document.createElement('a');
                    suggestionItem.classList.add('list-group-item', 'list-group-item-action');
                    suggestionItem.textContent = `${article.artikelnummer} - ${article.volledige_omschrijving}`; // Gebruik volledige_omschrijving
                    suggestionItem.href = '#';
                    suggestionItem.addEventListener('click', (e) => {
                        e.preventDefault();
                        document.getElementById('selectedExternalArticleName').value = article.volledige_omschrijving; // Gebruik volledige_omschrijving
                        document.getElementById('selectedExternalArticleNumber').value = article.artikelnummer;
                        searchExternalArticleInput.value = ''; // Maak zoekveld leeg
                        externalArticleSuggestionsDiv.innerHTML = ''; // Maak suggesties leeg
                        externalArticleSuggestionsDiv.style.display = 'none';
                        document.getElementById('externalArticleQuantity').focus();
                    });
                    externalArticleSuggestionsDiv.appendChild(suggestionItem);
                });
                externalArticleSuggestionsDiv.style.display = 'block'; // Zorg dat de div getoond wordt
            } else {
                externalArticleSuggestionsDiv.style.display = 'none';
            }
        });

        // Verberg suggesties bij klikken buiten het zoekveld/suggestielijst
        document.addEventListener('click', (event) => {
            if (searchExternalArticleInput && externalArticleSuggestionsDiv) { // Check of elementen bestaan
                if (!searchExternalArticleInput.contains(event.target) && !externalArticleSuggestionsDiv.contains(event.target)) {
                    externalArticleSuggestionsDiv.style.display = 'none';
                }
            }
        });
    }
    
    // CSV bestand upload handler
    document.getElementById('csv-file').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            document.getElementById('preview-button').disabled = false;
            document.getElementById('import-button').disabled = true;
            document.getElementById('import-preview').classList.add('d-none');
            
            const reader = new FileReader();
            reader.onload = function(e) {
                csvData = e.target.result;
            };
            reader.readAsText(file);
        }
    });
    
    // Excel bestand upload handler
    document.getElementById('excel-file').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            excelFile = file;
            document.getElementById('excel-preview-button').disabled = false;
            document.getElementById('excel-import-button').disabled = true;
            document.getElementById('excel-preview').classList.add('d-none');
        }
    });
    
    // Nieuwe listener voor Kistbehoefte tab
    document.getElementById('calculate-needs-button').addEventListener('click', calculateNeeds);

    // Stockbeheer listeners (verplaatst van dubbele DOMContentLoaded)
    document.getElementById('stock-tab').addEventListener('click', () => setTimeout(loadStockData, 100)); // Korte vertraging
    document.getElementById('add-stock-form').addEventListener('submit', addNewStock);
    document.getElementById('stock-search-box').addEventListener('input', filterStockItems);
    document.getElementById('stock-location-filter').addEventListener('change', filterStockItems);
    document.getElementById('stock-refresh-button').addEventListener('click', loadStockData);
    // Dynamisch nieuw tabblad 'Forecast' toevoegen
    const tabList = document.getElementById('myTab');
    const forecastTabItem = document.createElement('li');
    forecastTabItem.className = 'nav-item'; forecastTabItem.role = 'presentation';
    forecastTabItem.innerHTML = `<button class="nav-link" id="forecast-tab" data-bs-toggle="tab" data-bs-target="#forecast" type="button" role="tab" aria-controls="forecast" aria-selected="false">Forecast</button>`;
    tabList.appendChild(forecastTabItem);
    const tabContent = document.getElementById('myTabContent');
    const forecastPane = document.createElement('div');
    forecastPane.className = 'tab-pane fade'; forecastPane.id = 'forecast';
    forecastPane.setAttribute('role','tabpanel'); forecastPane.setAttribute('aria-labelledby','forecast-tab');
    forecastPane.innerHTML = `
        <div class="container mt-4">
            <h2>Forecast</h2>
            <div class="d-flex gap-2 mb-3">
                <button id="save-forecast-button" class="btn btn-primary d-none">Opslaan Forecast</button>
                <button id="import-forecast-button" class="btn btn-success"><i class="fas fa-file-import"></i> CSV Forecast Importeren</button>
                <button id="order-forecast-button" class="btn btn-warning d-none"><i class="fas fa-shopping-cart"></i> Bestel Forecast</button>
            </div>
            <input type="file" id="forecast-file" accept=".csv" class="d-none">
            <!-- Zoekbalk -->
            <div class="row mb-3">
                <div class="col-md-6">
                    <label for="forecast-search-box">Zoeken:</label>
                    <div class="input-group">
                        <span class="input-group-text"><i class="fas fa-search"></i></span>
                        <input type="text" id="forecast-search-box" class="form-control" placeholder="Zoek op CaseLabel, CaseType, ERP code...">
                        <button type="button" id="forecast-clear-search" class="btn btn-outline-secondary">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="col-md-6">
                    <label>&nbsp;</label>
                    <div class="d-flex gap-2">
                        <button id="forecast-filter-button" class="btn btn-primary">
                            <i class="fas fa-filter"></i> Filter
                        </button>
                        <button id="forecast-clear-filters" class="btn btn-outline-secondary">
                            <i class="fas fa-eraser"></i> Wis Filters
                        </button>
                        <button id="forecast-refresh-button" class="btn btn-outline-primary">
                            <i class="fas fa-sync-alt"></i> Ververs
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Filter opties -->
            <div class="row mb-3">
                <div class="col-md-3">
                    <label for="forecast-start-date">Startdatum:</label>
                    <input type="date" id="forecast-start-date" class="form-control form-control-sm">
                </div>
                <div class="col-md-3">
                    <label for="forecast-end-date">Einddatum:</label>
                    <input type="date" id="forecast-end-date" class="form-control form-control-sm">
                </div>
                <div class="col-md-3">
                    <label for="forecast-type-filter">Type Kist:</label>
                    <select id="forecast-type-filter" class="form-select form-select-sm" multiple>
                        <option value="">Alle types</option>
                    </select>
                </div>
                <div class="col-md-3">
                    <label for="forecast-erp-filter">ERP Code:</label>
                    <select id="forecast-erp-filter" class="form-select form-select-sm">
                        <option value="">Alle ERP codes</option>
                    </select>
                </div>
            </div>
            
            <!-- Resultaten info -->
            <div class="row mb-2">
                <div class="col-md-6">
                    <small class="text-muted" id="forecast-results-info">Geen data geladen</small>
                </div>
                <div class="col-md-6 text-end">
                    <small class="text-muted" id="forecast-total-count">Totaal: 0 items</small>
                </div>
            </div>
            <div id="forecast-table-container" class="table-responsive d-none mb-3">
                <table class="table table-sm table-hover">
                    <thead>
                        <tr>
                            <th>Datum</th>
                            <th>CaseLabel</th>
                            <th>CaseType</th>
                            <th>ERP Code</th>
                            <th class="text-center">Verschuivingen</th>
                        </tr>
                    </thead>
                    <tbody id="forecast-tbody"></tbody>
                </table>
            </div>
        </div>
    `;
    tabContent.appendChild(forecastPane);
    // Event listeners voor Forecast CSV import
    const importForecastBtn = document.getElementById('import-forecast-button');
    const forecastFileInput = document.getElementById('forecast-file');
    // Klik op knop opent file-dialog
    if (importForecastBtn && forecastFileInput) {
        importForecastBtn.addEventListener('click', () => forecastFileInput.click());
    }
    // Bij file-selectie toon preview
    if (forecastFileInput) {
        forecastFileInput.addEventListener('change', previewForecastCSV);
    }
    // Opslaan-knop voor import
    const saveForecastBtn = document.getElementById('save-forecast-button');
    if (saveForecastBtn) {
        saveForecastBtn.addEventListener('click', importForecast);
    }

    // Event listeners voor forecast zoek- en filterfunctionaliteit
    document.getElementById('forecast-search-box').addEventListener('input', filterForecastEntries);
    document.getElementById('forecast-clear-search').addEventListener('click', clearForecastSearch);
    document.getElementById('forecast-filter-button').addEventListener('click', filterForecastEntries);
    document.getElementById('forecast-clear-filters').addEventListener('click', clearForecastFilters);
    document.getElementById('forecast-refresh-button').addEventListener('click', loadForecastEntries);
    document.getElementById('forecast-start-date').addEventListener('change', filterForecastEntries);
    document.getElementById('forecast-end-date').addEventListener('change', filterForecastEntries);
    document.getElementById('forecast-type-filter').addEventListener('change', filterForecastEntries);
    document.getElementById('forecast-erp-filter').addEventListener('change', filterForecastEntries);
    document.getElementById('order-forecast-button').addEventListener('click', createOrdersFromForecast);

    // Header invoegen
    fetch('header.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById('header-placeholder').innerHTML = data;
        })
        .catch(error => console.error('Fout bij laden header:', error));
    
    // Initiële data laden
    loadCases();
    loadStockData(); // Laad ook stock data bij start
    
    /**
     * Laad alle kisten van de server
     */
    // Functie voor het laden van alle kisten
    function loadCases() {
        showLoading('Kisten ophalen...');
        
        fetch('/api/cases')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                casesData = data;
                
                // Voeg debug log toe voor de eerste paar kisten 
                if (casesData && casesData.length > 0) {
                    console.log('[DEBUG] Eerste paar kisten data na laden:', casesData.slice(0, 5));
                }
                
                updateLocationFilter();
                // Roep loadOrders aan nadat casesData geladen is, zodat we bestelstatus kunnen checken
                loadOrders().finally(() => {
                    filterCases(); // Filtert en toont kisten, nu met ordersData beschikbaar
                    filterPackedCases(); 
                    // hideLoading();
                });
                
                const lastUpdated = new Date().toLocaleString('nl-NL');
                document.getElementById('last-updated').textContent = `Laatst bijgewerkt: ${lastUpdated}`;
            })
            .catch(error => {
                console.error('Fout bij laden kisten:', error);
                showNotification('Fout bij laden kisten: ' + error.message, 'danger');
                // hideLoading();
            });
    }
    
    /**
     * Vul het locatie filter met unieke locaties uit de database
     */
    function updateLocationFilter() {
        const locationFilter = document.getElementById('location-filter');
        const currentValue = locationFilter.value;
        
        // Huidige opties verwijderen (behalve de eerste)
        while (locationFilter.options.length > 1) {
            locationFilter.remove(1);
        }
        
        // Verzamel unieke locaties
        const uniqueLocations = [...new Set(casesData.map(c => c.currentLocation))].sort();
        
        // Voeg opties toe aan filter
        uniqueLocations.forEach(location => {
            if (!location) return; // Sla lege locaties over
            
            const option = document.createElement('option');
            option.value = location;
            option.textContent = location;
            locationFilter.appendChild(option);
        });
        
        // Herstel geselecteerde waarde indien mogelijk
        if (currentValue !== 'all' && uniqueLocations.includes(currentValue)) {
            locationFilter.value = currentValue;
        }
    }
    
    /**
     * Filter kisten op basis van de geselecteerde filters
     */
    function filterCases() {
        const searchTerm = document.getElementById('search-box').value.toLowerCase().trim();
        const locationFilter = document.getElementById('location-filter').value;
        
        // Filter de kisten op basis van zoekterm en locatie
        let filteredCases = casesData.filter(function(item) {
            // Filter op status - alleen beschikbare kisten tonen in de hoofdtab
            if (item.status === 'In gebruik') return false;
            
            // Filter op zoekterm
            const matchesSearch = !searchTerm ||
                (item.caseLabel && item.caseLabel.toLowerCase().includes(searchTerm)) ||
                (item.caseType && item.caseType.toLowerCase().includes(searchTerm)) ||
                (item.serialNumber && item.serialNumber.toLowerCase().includes(searchTerm));
            
            // Filter op locatie
            const matchesLocation = locationFilter === 'all' ||
                (item.currentLocation && item.currentLocation === locationFilter);
            
            return matchesSearch && matchesLocation;
        });
        
        displayCases(filteredCases);
        
        // Toon aantal kisten
        document.getElementById('cases-count').textContent = `Totaal: ${filteredCases.length} kisten`;
    }
    
    /**
     * Toon kisten in de tabel
     */
    function displayCases(cases) {
        const tableBody = document.getElementById('cases-table-body');
        tableBody.innerHTML = ''; // Maak de tabel leeg

        const noResultsElement = document.getElementById('no-results');

        if (!cases || cases.length === 0) {
            noResultsElement.classList.remove('d-none');
            updateSelectedCount(); // Reset selected count
            return;
        }

        noResultsElement.classList.add('d-none');

        // Sorteer kisten op label
        cases.sort((a, b) => {
            return a.caseLabel.localeCompare(b.caseLabel);
        });

        const template = document.getElementById('case-row-template');
        const fragment = document.createDocumentFragment(); // Gebruik een DocumentFragment

        // Voeg elke kist toe aan de tabel
        cases.forEach(item => {
            const row = template ? template.content.cloneNode(true).querySelector('tr') : document.createElement('tr');

            // Bepaal achtergrondkleur
            let rowClass = '';
            
            // Optie 1: Gebruik de statusColor uit het item als het bestaat
            if (item.statusColor) {
                rowClass = `table-${item.statusColor}`; // 'success', 'warning', etc.
                console.log(`[DEBUG] Item ${item.caseLabel} gebruikt statusColor: ${item.statusColor}`);
            } 
            // Optie 2: Traditionele manier
            else if (item.currentLocation === 'Willebroek' && item.status === 'Beschikbaar') {
                rowClass = 'table-success';
                // Zet statusColor zodat het onthouden wordt voor volgende keer
                item.statusColor = 'success';
            } else {
                if (Array.isArray(ordersData)) {
                    const isOrdered = ordersData.some(order => {
                        return Array.isArray(order.items) && order.items.some(orderItem => {
                            return orderItem.pilsCaseLabel === item.caseLabel &&
                                   (order.status === 'open' || order.status === 'partial' || (orderItem.status !== 'delivered' && orderItem.status !== 'completed'));
                        });
                    });
                    if (isOrdered) {
                        rowClass = 'table-warning';
                        // Zet statusColor zodat het onthouden wordt voor volgende keer
                        item.statusColor = 'warning';
                    }
                }
            }
            
            if (rowClass) {
                row.classList.add(rowClass);
            }

            if (!template) {
                // Handmatige rijopbouw (fallback)
                const formattedCreatedAt = item.importDate ? new Date(item.importDate).toLocaleString('nl-NL') : '-';
                const formattedUpdatedAt = item.lastUpdated ? new Date(item.lastUpdated).toLocaleString('nl-NL') : '-';
                row.innerHTML = `
                    <td>
                        <input type="checkbox" class="case-select-checkbox" 
                               data-case-id="${item.id}" 
                               data-case-label="${item.caseLabel}" 
                               data-case-type="${item.caseType}" 
                               data-current-location="${item.currentLocation || ''}">
                    </td>
                    <td>${item.caseLabel || '-'}</td>
                    <td>${item.caseType || '-'}</td>
                    <td>${item.serialNumber || '-'}</td>
                    <td><span class="badge location-${item.currentLocation ? item.currentLocation.toLowerCase() : 'unknown'} text-dark">${item.currentLocation || 'N/A'}</span></td>
                    <td>${formattedCreatedAt}</td>
                    <td>${formattedUpdatedAt}</td>
                    <td>
                        <button class="btn btn-sm btn-info view-case-photos-btn" data-id="${item.id}" title="Foto\'s Bekijken"><i class="fas fa-image"></i></button>
                        <button class="btn btn-sm btn-primary edit-case-btn" data-id="${item.id}" title="Bewerken"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger delete-case-btn" data-id="${item.id}" title="Verwijderen"><i class="fas fa-trash"></i></button>
                        <button class="btn btn-sm btn-success mark-packed-btn" data-id="${item.id}" title="Als verpakt markeren"><i class="fas fa-box"></i></button>
                        <button class="btn btn-sm btn-warning add-to-order-btn" data-id="${item.id}" data-caselabel="${item.caseLabel}" data-casetype="${item.caseType}" title="Aan Bestelling Toevoegen"><i class="fas fa-shopping-cart"></i></button>
                    </td>
                `;
            } else {
                // Vul template velden
                const formattedCreatedAt = item.importDate ? new Date(item.importDate).toLocaleString('nl-NL') : '-';
                const formattedUpdatedAt = item.lastUpdated ? new Date(item.lastUpdated).toLocaleString('nl-NL') : '-';

                // Vul checkbox
                const checkbox = row.querySelector('.case-select-checkbox');
                checkbox.setAttribute('data-case-id', item.id);
                checkbox.setAttribute('data-case-label', item.caseLabel);
                checkbox.setAttribute('data-case-type', item.caseType);
                checkbox.setAttribute('data-current-location', item.currentLocation || '');

                row.querySelector('.case-label').textContent = item.caseLabel || '-';
                row.querySelector('.case-type').textContent = item.caseType || '-';
                row.querySelector('.case-serial').textContent = item.serialNumber || '-';
                
                const locationCell = row.querySelector('.case-location');
                locationCell.innerHTML = `<span class="badge location-${item.currentLocation ? item.currentLocation.toLowerCase() : 'unknown'} text-dark">${item.currentLocation || 'N/A'}</span>`;
                
                row.querySelector('.case-import-date').textContent = formattedCreatedAt;
                row.querySelector('.case-updated').textContent = formattedUpdatedAt;

                row.querySelector('.view-case-photos-btn').setAttribute('data-id', item.id);
                row.querySelector('.edit-case-btn').setAttribute('data-id', item.id);
                row.querySelector('.delete-case-btn').setAttribute('data-id', item.id);
                row.querySelector('.mark-packed-btn').setAttribute('data-id', item.id);
                
                const addToOrderBtn = row.querySelector('.add-to-order-btn');
                if (addToOrderBtn) {
                    addToOrderBtn.setAttribute('data-id', item.id);
                    addToOrderBtn.setAttribute('data-caselabel', item.caseLabel);
                    addToOrderBtn.setAttribute('data-casetype', item.caseType);
                }
            }
            fragment.appendChild(row); // Voeg rij toe aan fragment
        });
        tableBody.appendChild(fragment); // Voeg fragment toe aan DOM

        // Update selected count na het laden van nieuwe data
        updateSelectedCount();

        // De volgende regels zijn niet meer nodig dankzij event delegatie:
        // document.querySelectorAll('.edit-case-btn').forEach(btn => { ... });
        // document.querySelectorAll('.delete-case-btn').forEach(btn => { ... });
        // document.querySelectorAll('.mark-packed-btn').forEach(btn => { ... });
        // document.querySelectorAll('.add-to-order-btn').forEach(btn => { ... });
        // document.querySelectorAll('.view-case-photos-btn').forEach(btn => { ... });
    }
    
    /**
     * Toon modal om een nieuwe kist toe te voegen
     */
    function showAddCaseModal() {
        document.getElementById('case-modal-title').textContent = 'Nieuwe Kist';
        document.getElementById('case-id').value = '';
        document.getElementById('case-form').reset();
        
        // Vul locatie dropdown dynamisch
        updateLocationDropdown();
        
        caseModal.show();
    }
    
    /**
     * Toon modal om een bestaande kist te bewerken
     */
    function showEditCaseModal(id) {
        const caseModal = document.getElementById('caseModal');
        const caseModalTitle = document.getElementById('case-modal-title');
        
        // Reset het formulier
        document.getElementById('case-form').reset();
        
        if (id) {
            // Bestaande kist bewerken
            const caseItem = casesData.find(item => item.id == id);
            if (caseItem) {
                console.log('Bewerken van kist:', caseItem); // Debug log
                document.getElementById('case-id').value = caseItem.id;
                document.getElementById('case-label').value = caseItem.caseLabel || '';
                document.getElementById('case-type').value = caseItem.caseType || '';
                document.getElementById('original-type').value = caseItem.originalCaseType || '';
                document.getElementById('serial-number').value = caseItem.serialNumber || '';
                document.getElementById('location').value = caseItem.currentLocation || 'Onbekend';
                document.getElementById('notes').value = caseItem.notes || '';
                document.getElementById('case-status').value = caseItem.status || 'Beschikbaar';
                
                caseModalTitle.textContent = `Kist Bewerken: ${caseItem.caseLabel}`;
            }
        } else {
            // Nieuwe kist toevoegen
            document.getElementById('case-id').value = '';
            caseModalTitle.textContent = 'Nieuwe Kist';
        }
        
        // Vul locatie dropdown dynamisch
        updateLocationDropdown();
        
        const bsModal = new bootstrap.Modal(caseModal);
        bsModal.show();
    }
    
    /**
     * Sla een nieuwe of bewerkte kist op
     */
    function saveCase() {
        const caseId = document.getElementById('case-id').value;
        const caseLabel = document.getElementById('case-label').value.trim();
        const caseType = document.getElementById('case-type').value.trim();
        const originalType = document.getElementById('original-type').value.trim();
        const serialNumber = document.getElementById('serial-number').value.trim();
        const location = document.getElementById('location').value;
        const notes = document.getElementById('notes').value.trim();
        const status = document.getElementById('case-status').value;
        
        // Validatie
        if (!caseLabel || !caseType || !location) {
            alert('Vul alle verplichte velden in.');
            return;
        }
        
        // Toon laadanimatie
        showLoading(caseId ? 'Kist bijwerken...' : 'Nieuwe kist toevoegen...');
        
        // Bereid de data voor
        const caseData = {
            caseLabel: caseLabel,
            caseType: caseType,
            originalCaseType: originalType,
            serialNumber: serialNumber,
            currentLocation: location,
            notes: notes,
            status: status
        };
        
        // API URL en methode bepalen
        const url = caseId ? `/api/cases/${caseId}` : '/api/cases';
        const method = caseId ? 'PUT' : 'POST';
        
        // Roep de API aan
        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(caseData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(result => {
            if (caseId) {
                // Bestaande kist bijwerken in de lokale array
                const index = casesData.findIndex(item => item.id === caseId);
                if (index !== -1) {
                    casesData[index] = result;
                }
                showNotification(`Kist ${caseLabel} is bijgewerkt.`, 'success');
            } else {
                // Nieuwe kist toevoegen aan de lokale array
                casesData.push(result);
                showNotification(`Nieuwe kist ${caseLabel} is toegevoegd.`, 'success');
            }
            
            // Sluit het modal
            const bsModal = bootstrap.Modal.getInstance(document.getElementById('caseModal'));
            bsModal.hide();
            
            // Vernieuw de weergave
            updateLocationFilter();
            filterCases();
            filterPackedCases();
            
            hideLoading();
        })
        .catch(error => {
            console.error('Fout bij opslaan kist:', error);
            showNotification('Fout bij opslaan kist: ' + error.message, 'danger');
            hideLoading();
        });
    }
    
    /**
     * Vul het locatie dropdown met unieke locaties
     */
    function updateLocationDropdown() {
        const locationSelect = document.getElementById('location');
        
        // Opties behouden
        const currentValue = locationSelect.value;
        
        // Huidige opties verwijderen (behalve standaard opties)
        while (locationSelect.options.length > 0) {
            locationSelect.remove(0);
        }
        
        // Voeg standaard optie toe
        const defaultOption = document.createElement('option');
        defaultOption.value = 'Onbekend';
        defaultOption.textContent = 'Onbekend';
        locationSelect.appendChild(defaultOption);
        
        // Verzamel unieke locaties uit casesData
        const uniqueLocations = [...new Set(casesData.map(c => c.currentLocation))].sort();
        
        // Voeg locatie opties toe
        uniqueLocations.forEach(location => {
            if (!location || location === 'Onbekend') return; // Geen dubbele 'Onbekend' optie
            
            const option = document.createElement('option');
            option.value = location;
            option.textContent = location;
            locationSelect.appendChild(option);
        });
        
        // Stel oorspronkelijke waarde weer in als deze bestaat
        if (currentValue && uniqueLocations.includes(currentValue)) {
            locationSelect.value = currentValue;
        } else {
            locationSelect.value = 'Onbekend';
        }
    }
    
    /**
     * Vraag bevestiging voor het verwijderen van een kist
     */
    function confirmDeleteCase(id) {
        const caseToDelete = casesData.find(c => c.id == id);
        if (!caseToDelete) return;
        
        if (confirm(`Weet u zeker dat u kist "${caseToDelete.caseLabel}" wilt verwijderen?`)) {
            deleteCase(id);
        }
    }
    
    /**
     * Verwijder een kist
     */
    function deleteCase(id) {
        fetch(`/api/cases/${id}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(result => {
            showNotification('Kist succesvol verwijderd', 'success');
            loadCases();
        })
        .catch(error => {
            console.error('Fout bij verwijderen kist:', error);
            showNotification('Fout bij verwijderen van kist', 'error');
        });
    }
    
    /**
     * Toon een voorbeeld van de CSV gegevens voor import
     */
    function previewCSV() {
        if (!csvData) {
            showNotification('Geen CSV-bestand geselecteerd', 'warning');
            return;
        }
        
        try {
            // Parse CSV data met puntkomma's als scheidingsteken (zoals in importCSV)
            const lines = csvData.split('\n').filter(line => line.trim() !== '');
            const headers = lines[0].split(';').map(h => h.trim().replace(/"/g, ''));
            
            console.log('Preview - Alle headers:', headers);
            
            // Zoek kolomindices (zelfde logica als importCSV)
            let packingNumberIndex = headers.findIndex(h => h === 'Packing Number');
            let caseIndex = headers.findIndex(h => h === 'Case');
            let caseTypeIndex = headers.findIndex(h => h === 'Case Type');
            let serialNumberIndex = headers.findIndex(h => 
                h === 'Serial number' || h === 'Serial Number' || h === 'SerialNumber' || 
                h === 'Serial_number' || h === 'Serienummer');
                
            if (serialNumberIndex === -1 && headers.length > 5) {
                serialNumberIndex = 5;
            }
            
            let stockLocationIndex = headers.findIndex(h => h === 'Stock Location');
            let dateIndex = headers.findIndex(h => h.includes('20000000+t01.pccrdt'));
            
            if (dateIndex === -1 && headers.length > 7) {
                dateIndex = 7;
            }
            
            if (caseIndex === -1 || caseTypeIndex === -1) {
                showNotification('Kon "Case" of "Case Type" kolommen niet vinden in CSV', 'error');
                // return;
            }
            
            // Parse de data voor import (zelfde logica als importCSV)
            const casesToImport = [];
            
            for (let i = 1; i < lines.length; i++) {
                if (lines[i].trim() === '') continue;
                
                const values = lines[i].split(';').map(v => v.trim().replace(/"/g, ''));
                if (values.length <= Math.max(caseIndex, caseTypeIndex)) continue;
                
                const caseLabel = values[caseIndex];
                const caseType = values[caseTypeIndex];
                
                if (!caseLabel || !caseType) continue;
                
                // Bepaal locatie
                let currentLocation = 'Onbekend';
                if (stockLocationIndex !== -1 && values[stockLocationIndex]) {
                    const stockLoc = values[stockLocationIndex];
                    if (stockLoc === 'PAC3PL') {
                        currentLocation = 'Willebroek';
                    } else {
                        currentLocation = stockLoc;
                    }
                }
                
                // Parse datum
                let importDate = null;
                if (dateIndex !== -1 && values[dateIndex]) {
                    const dateStr = values[dateIndex];
                    if (dateStr.length === 8) {
                        const year = dateStr.substring(0, 4);
                        const month = dateStr.substring(4, 6);
                        const day = dateStr.substring(6, 8);
                        importDate = `${year}-${month}-${day}`;
                    }
                }
                
                const caseData = {
                    caseLabel: caseLabel,
                    caseType: caseType,
                    serialNumber: serialNumberIndex !== -1 ? values[serialNumberIndex] : '',
                    currentLocation: currentLocation,
                    importDate: importDate,
                    packingNumber: packingNumberIndex !== -1 ? values[packingNumberIndex] : '',
                    status: 'Beschikbaar'
                };
                
                casesToImport.push(caseData);
            }
            
            // Sla data op voor import
            window.casesToImport = casesToImport;
            
            // Toon preview met geparsede data
            displayImportPreview(casesToImport);
            
            // Maak import knop beschikbaar
            document.getElementById('import-button').disabled = false;
            
        } catch (error) {
            console.error('Fout bij verwerken CSV:', error);
            showNotification('Fout bij verwerken van CSV-bestand', 'error');
        }
    }

    // NIEUWE FUNCTIE: Toon import preview
    function displayImportPreview(casesToImport) {
        const previewContainer = document.getElementById('import-preview');
        if (!previewContainer) {
            console.warn('Import preview container niet gevonden');
            return;
        }
        
        // Maak de preview zichtbaar
        previewContainer.classList.remove('d-none');
        
        // Update de bestaande tabel structuur
        const previewThead = document.getElementById('preview-thead');
        const previewTbody = document.getElementById('preview-tbody');
        const importStats = document.getElementById('import-stats');
        
        if (previewThead) {
            previewThead.innerHTML = `
                <tr>
                    <th>Case Label</th>
                    <th>Type</th>
                    <th>Serienummer</th>
                    <th>Locatie</th>
                    <th>Datum</th>
                </tr>
            `;
        }
        
        if (previewTbody) {
            previewTbody.innerHTML = '';
            
            // Toon eerste 20 items
            const itemsToShow = casesToImport.slice(0, 20);
            itemsToShow.forEach(item => {
                const formattedDate = item.importDate ? new Date(item.importDate).toLocaleDateString('nl-BE') : '-';
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${item.caseLabel || '-'}</td>
                    <td>${item.caseType || '-'}</td>
                    <td>${item.serialNumber || '-'}</td>
                    <td>
                        <span class="badge ${item.currentLocation === 'Willebroek' ? 'bg-success' : 'bg-secondary'}">
                            ${item.currentLocation || 'Onbekend'}
                        </span>
                    </td>
                    <td>${formattedDate}</td>
                `;
                previewTbody.appendChild(row);
            });
        }
        
        if (importStats) {
            // Toon statistieken
            const locationStats = {};
            casesToImport.forEach(item => {
                const loc = item.currentLocation || 'Onbekend';
                locationStats[loc] = (locationStats[loc] || 0) + 1;
            });
            
            let statsHTML = `<strong>Totaal: ${casesToImport.length} kisten</strong>`;
            if (casesToImport.length > 20) {
                statsHTML += ` (eerste 20 getoond)`;
            }
            
            statsHTML += `<br><div class="mt-2">`;
            Object.entries(locationStats).forEach(([location, count]) => {
                const badgeClass = location === 'Willebroek' ? 'bg-success' : 'bg-secondary';
                statsHTML += `<span class="badge ${badgeClass} me-2">${location}: ${count}</span>`;
            });
            statsHTML += `</div>`;
            
            importStats.innerHTML = statsHTML;
        }
        
        console.log('Import preview getoond voor', casesToImport.length, 'items');
    }

    function importCSV() {
        // Reset PAC3PL types bij elke import
        pac3plTypes.clear();
        if (!csvData) {
            showNotification('Geen CSV-bestand geselecteerd', 'warning');
            return;
        }
        try {
            // Parse CSV data met puntkomma's als scheidingsteken
            const lines = csvData.split('\n').filter(line => line.trim() !== '');
            const headers = lines[0].split(';').map(h => h.trim().replace(/"/g, ''));
            
            console.log('Alle headers:', headers);
            
            // Zoek kolomindices
            let packingNumberIndex = headers.findIndex(h => h === 'Packing Number');
            let caseIndex = headers.findIndex(h => h === 'Case');
            let caseTypeIndex = headers.findIndex(h => h === 'Case Type');
            // Zoek op verschillende mogelijke namen voor serienummer kolom
            let serialNumberIndex = headers.findIndex(h => 
                h === 'Serial number' || h === 'Serial Number' || h === 'SerialNumber' || 
                h === 'Serial_number' || h === 'Serienummer');
                
            // Als we het niet kunnen vinden, probeer kolom F (index 5)
            if (serialNumberIndex === -1 && headers.length > 5) {
                serialNumberIndex = 5; // Kolom F heeft index 5 (0-based indexing)
                console.log('Specifieke serienummer kolom niet gevonden, gebruik kolom F:', headers[serialNumberIndex]);
            }
            
            let stockLocationIndex = headers.findIndex(h => h === 'Stock Location');
            
            // Zoek specifiek naar de 20000000+t01.pccrdt kolom (kolom H)
            let dateIndex = headers.findIndex(h => h.includes('20000000+t01.pccrdt'));
            
            // Als we die niet vinden, gebruik kolom H (index 7)
            if (dateIndex === -1 && headers.length > 7) {
                dateIndex = 7; // Kolom H heeft index 7 (0-based indexing)
                console.log('Specifieke datum kolom niet gevonden, gebruik kolom H:', headers[dateIndex]);
            }
            
            // Log gevonden indices
            console.log('Kolom indices:', {
                packingNumber: packingNumberIndex, 
                case: caseIndex,
                caseType: caseTypeIndex,
                serialNumber: serialNumberIndex + ' (' + headers[serialNumberIndex] + ')', 
                stockLocation: stockLocationIndex,
                date: dateIndex + ' (' + headers[dateIndex] + ')'
            });
            
            if (caseIndex === -1 || caseTypeIndex === -1) {
                showNotification('Kon "Case" of "Case Type" kolommen niet vinden in CSV', 'error');
                // return;
            }
            
            const casesToImport = [];
            
            // Verwerk data rijen
            for (let i = 1; i < lines.length; i++) {
                if (lines[i].trim() === '') continue;
                
                const values = lines[i].split(';').map(v => v.trim().replace(/"/g, ''));
                if (values.length <= Math.max(caseIndex, caseTypeIndex)) continue;
                
                let caseLabel = values[caseIndex];
                let caseType = values[caseTypeIndex];
                if (!caseLabel || !caseType) continue;
                
                // Haal serienummer op
                let serialNumber = null;
                if (serialNumberIndex !== -1 && serialNumberIndex < values.length) {
                    serialNumber = values[serialNumberIndex];
                }
                
                // Haal locatie op
                let stockLocationRaw = 'Onbekend';
                if (stockLocationIndex !== -1 && stockLocationIndex < values.length) {
                    stockLocationRaw = values[stockLocationIndex];
                }
                let stockLocation = (stockLocationRaw === 'PAC3PL') ? 'Willebroek' : stockLocationRaw;
                if (stockLocation && stockLocation.length > 200) {
                    stockLocation = stockLocation.substring(0, 200);
                }
                
                // Verwerk datum uit kolom H (JJJJMMDD formaat)
                let csvDateString = null;
                let importDate = null;
                if (dateIndex !== -1 && dateIndex < values.length) {
                    csvDateString = values[dateIndex];
                    if (csvDateString && csvDateString.length === 8 && /^\d{8}$/.test(csvDateString)) {
                        // Converteer JJJJMMDD naar ISO datum
                        const year = csvDateString.substring(0, 4);
                        const month = csvDateString.substring(4, 6);
                        const day = csvDateString.substring(6, 8);
                        importDate = `${year}-${month}-${day}T00:00:00.000Z`;
                    }
                }
                
                // Als geen geldige datum uit CSV, gebruik huidige datum
                if (!importDate) {
                    importDate = new Date().toISOString();
                }
                
                // Converteer naar ISO string voor consistentie
                const importDateISO = new Date(importDate).toISOString();
                
                // Haal packing number op
                let packingNumber = null;
                if (packingNumberIndex !== -1 && packingNumberIndex < values.length) {
                    packingNumber = values[packingNumberIndex];
                }
                
                casesToImport.push({
                    caseLabel: caseLabel,
                    caseType: caseType,
                    originalCaseType: caseType,
                    serialNumber: serialNumber,
                    currentLocation: stockLocation,
                    status: 'Beschikbaar',
                    importDate: importDateISO,
                    lastUpdated: new Date().toISOString(), // Hier gebruiken we de CSV datum ook voor lastUpdated
                    csvDateString: csvDateString, // Ook de originele string meesturen voor debugging
                    packingNumber: packingNumber
                });
                
                // Track alleen types uit PAC3PL
                if (stockLocationRaw === 'PAC3PL') {
                    pac3plTypes.add(caseType);
                }
            }
            
            if (casesToImport.length === 0) {
                showNotification('Geen geldige kistgegevens gevonden in CSV', 'warning');
                // return;
            }
            
            // Debug de eerste paar items
            console.log('Te importeren kisten (eerste 3):', casesToImport.slice(0, 3));
            
            // Toon preview
            displayImportPreview(casesToImport);
            
            // Sla de data op voor import
            window.casesToImport = casesToImport;
            
            // Toon import knop
            document.getElementById('import-button').disabled = false;
            
        } catch (error) {
            console.error('Fout bij verwerken CSV:', error);
            showNotification('Fout bij verwerken van CSV-bestand', 'error');
        }
    }

    // NIEUWE FUNCTIE: Importeer CSV data naar database
    async function performCSVImport() {
        const casesToImport = window.casesToImport;
        if (!casesToImport || casesToImport.length === 0) {
            showNotification('Geen data om te importeren', 'warning');
            return;
        }

        showLoading(`${casesToImport.length} kisten importeren...`);

        try {
            // Stuur data naar server
            const response = await fetch('/api/cases/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ cases: casesToImport })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (result.success) {
                showNotification(`${result.imported || casesToImport.length} kisten succesvol geïmporteerd`, 'success');
                
                // Herlaad de kisten data
                await loadCases();
                
                // Reset import data
                window.casesToImport = null;
                csvData = null;
                document.getElementById('csv-file').value = '';
                document.getElementById('import-button').disabled = true;
                
                // Sluit modal
                csvImportModal.hide();
                
                // NIEUWE: Check voor automatische transport planning
                setTimeout(() => {
                    checkAndCreateAutomaticTransportPlanning(casesToImport);
                }, 1000); // Korte delay zodat import eerst afgerond is
                
            } else {
                throw new Error(result.error || 'Import mislukt');
            }

        } catch (error) {
            console.error('Fout bij importeren:', error);
            showNotification('Fout bij importeren: ' + error.message, 'error');
        } finally {
            hideLoading();
        }
    }

    // NIEUWE FUNCTIE: Check en maak automatische transport planning
    async function checkAndCreateAutomaticTransportPlanning(importedCases) {
        console.log('🚛 Controleren transport behoeften voor', importedCases.length, 'geïmporteerde cases');
        
        // Filter cases die transport naar Willebroek nodig hebben
        const casesNeedingTransport = importedCases.filter(c => {
            // Cases die niet al in Willebroek zijn
            const notInWillebroek = c.currentLocation !== 'Willebroek' && c.currentLocation !== 'PAC3PL';
            
            // Cases die nog niet in transport zijn
            const notInTransport = !isAlreadyInTransport(c.caseLabel);
            
            return notInWillebroek && notInTransport;
        });
        
        console.log('Cases die transport nodig hebben:', casesNeedingTransport.length);
        
        if (casesNeedingTransport.length === 0) {
            showNotification('✅ Alle geïmporteerde cases zijn al in Willebroek of al gepland voor transport', 'info');
            return;
        }
        
        // Groepeer cases per kisttype voor preview
        const groupedByType = {};
        casesNeedingTransport.forEach(c => {
            const caseType = c.caseType;
            if (!groupedByType[caseType]) {
                groupedByType[caseType] = {
                    caseType: caseType,
                    cases: [],
                    quantity: 0
                };
            }
            groupedByType[caseType].cases.push(c);
            groupedByType[caseType].quantity++;
        });
        
        // Check beschikbaarheid voor preview
        const availabilityResults = await checkKistenAvailabilityForTransport(groupedByType);
        
        // Maak overzicht voor gebruiker
        const availableTypes = Object.values(availabilityResults).filter(item => item.canTransfer);
        const unavailableTypes = Object.values(availabilityResults).filter(item => !item.canTransfer);
        
        let confirmMessage = `🚛 Er zijn ${casesNeedingTransport.length} nieuwe cases die naar Willebroek moeten.\n\n`;
        
        if (availableTypes.length > 0) {
            confirmMessage += `✅ BESCHIKBAAR VOOR TRANSPORT:\n`;
            availableTypes.forEach(item => {
                confirmMessage += `• ${item.caseType}: ${item.quantity} stuks (${item.totalAvailable} beschikbaar in Genk/Wilrijk)\n`;
            });
            confirmMessage += `\n`;
        }
        
        if (unavailableTypes.length > 0) {
            confirmMessage += `❌ ONVOLDOENDE STOCK:\n`;
            unavailableTypes.forEach(item => {
                confirmMessage += `• ${item.caseType}: ${item.quantity} gevraagd, ${item.totalAvailable} beschikbaar (${item.shortfall} tekort)\n`;
            });
            confirmMessage += `\n`;
        }
        
        if (availableTypes.length === 0) {
            showNotification(
                '❌ Geen kisten beschikbaar voor transport in Genk/Wilrijk.\n\n' +
                'Controleer de voorraad en probeer opnieuw.',
                'error'
            );
            return;
        }
        
        confirmMessage += `Wil je automatisch een transport aanvraag maken voor de beschikbare items?\n\n`;
        confirmMessage += `Dit zal een transport document genereren voor het logistiek team.`;
        
        // Vraag bevestiging van gebruiker
        const confirmed = confirm(confirmMessage);
        
        if (confirmed) {
            await createAutomaticTransportRequest(casesNeedingTransport);
        } else {
            showNotification('Transport planning overgeslagen. Je kunt dit later handmatig doen.', 'info');
        }
    }

    // NIEUWE FUNCTIE: Controleer of case al in transport is
    function isAlreadyInTransport(caseLabel) {
        // Check 1: Bestaande transport orders
        if (Array.isArray(ordersData)) {
            const inTransportOrder = ordersData.some(order => {
                if (order.location !== 'Willebroek') return false;
                
                return Array.isArray(order.items) && order.items.some(item => 
                    item.pilsCaseLabel === caseLabel || 
                    (Array.isArray(item.pilsCaseLabels) && item.pilsCaseLabels.includes(caseLabel))
                );
            });
            
            if (inTransportOrder) {
                console.log(`Case ${caseLabel} al in transport order`);
                return true;
            }
        }
        
        // Check 2: Cases die al in Willebroek zijn (PAC3PL)
        if (Array.isArray(casesData)) {
            const alreadyInWillebroek = casesData.some(c => 
                c.caseLabel === caseLabel && 
                (c.currentLocation === 'Willebroek' || c.currentLocation === 'PAC3PL')
            );
            
            if (alreadyInWillebroek) {
                console.log(`Case ${caseLabel} al in Willebroek`);
                return true;
            }
        }
        
        // Check 3: Cases met transport status (FIX: variabele scope probleem)
        if (Array.isArray(casesData)) {
            const inTransit = casesData.some(c => {
                const hasTransportStatus = c.caseLabel === caseLabel && 
                    (c.transport_status === 'onderweg' || c.transport_status === 'transport_aangevraagd');
                
                if (hasTransportStatus) {
                    console.log(`Case ${caseLabel} heeft transport status: ${c.transport_status}`);
                }
                
                return hasTransportStatus;
            });
            
            if (inTransit) {
                return true;
            }
        }
        
        return false;
    }

    // NIEUWE FUNCTIE: Maak automatische transport aanvraag
    async function createAutomaticTransportRequest(cases) {
        console.log('🚛 Maken automatische transport aanvraag voor', cases.length, 'cases');
        showLoading('Transport aanvraag voorbereiden...');
        
        try {
            // Groepeer cases per kisttype
            const groupedByType = {};
            cases.forEach(c => {
                const caseType = c.caseType;
                if (!groupedByType[caseType]) {
                    groupedByType[caseType] = {
                        caseType: caseType,
                        cases: [],
                        quantity: 0
                    };
                }
                groupedByType[caseType].cases.push(c);
                groupedByType[caseType].quantity++;
            });
            
            // Check beschikbaarheid in Genk/Wilrijk
            const availabilityResults = await checkKistenAvailabilityForTransport(groupedByType);
            
            // VERBETERDE FILTERING: Filter alleen items die daadwerkelijk beschikbaar zijn
            const transferableItems = Object.values(availabilityResults).filter(item => {
                if (item.canTransfer) {
                    console.log(`✅ ${item.caseType}: ${item.quantity} stuks kunnen getransporteerd worden (${item.totalAvailable} beschikbaar)`);
                    return true;
                } else {
                    console.log(`❌ ${item.caseType}: ${item.quantity} stuks gevraagd, maar slechts ${item.totalAvailable} beschikbaar (tekort: ${item.shortfall})`);
                    return false;
                }
            });
            
            const itemsWithShortfall = Object.values(availabilityResults).filter(item => !item.canTransfer);
            
            // Toon waarschuwing als er items zijn die niet getransporteerd kunnen worden
            if (itemsWithShortfall.length > 0) {
                const shortfallMessage = itemsWithShortfall.map(item => 
                    `${item.caseType}: ${item.shortfall} tekort (${item.totalAvailable}/${item.needed})`
                ).join('\n');
                
                showNotification(
                    `⚠️ Sommige kisttypen hebben onvoldoende stock voor transport:\n\n${shortfallMessage}\n\nAlleen beschikbare items worden in transport aanvraag opgenomen.`,
                    'warning'
                );
            }
            
            // Als er geen items zijn die getransporteerd kunnen worden
            if (transferableItems.length === 0) {
                showNotification(
                    '❌ Geen kisten beschikbaar voor transport in Genk/Wilrijk.\n\n' +
                    'Controleer de voorraad en probeer opnieuw.',
                    'error'
                );
                hideLoading();
                return;
            }
            
            // Genereer unieke transport ID
            const transportId = generateTransportRequestId();
            
            // Maak transport aanvraag object
            const transportRequest = {
                id: transportId,
                type: 'automatic_from_csv',
                targetLocation: 'Willebroek',
                requestDate: new Date().toISOString(),
                cases: cases,
                transferableItems: transferableItems,
                status: 'pending_approval',
                totalCases: cases.length,
                totalTypes: transferableItems.length
            };
            
            // Genereer transport document
            await generateAutomaticTransportDocument(transportRequest);
            
            // Probeer order in database aan te maken (niet fataal als dit faalt)
            await createTransportOrderInDatabase(transportRequest);
            
            // Probeer case transport status bij te werken (niet fataal als dit faalt)
            await updateCaseTransportStatus(cases, 'transport_aangevraagd', transportId);
            
            // Toon succesbericht (altijd, ook als database delen faalden)
            showNotification(
                `🚛 Automatische transport aanvraag ${transportId} gemaakt!\n` +
                `${cases.length} cases, ${transferableItems.length} verschillende kisttypen\n` +
                `PDF document gegenereerd voor logistiek team.`,
                'success'
            );
            
            // Herlaad data om nieuwe status te tonen
            await loadCases();
            
        } catch (error) {
            console.error('Fout bij maken transport aanvraag:', error);
            showNotification('Fout bij maken transport aanvraag: ' + error.message, 'error');
        } finally {
            hideLoading();
        }
    }

    // NIEUWE FUNCTIE: Check beschikbaarheid van kisten voor transport
    async function checkKistenAvailabilityForTransport(groupedByType) {
        const availability = {};
        
        for (const [caseType, group] of Object.entries(groupedByType)) {
            // Zoek in stock data voor dit kisttype
            const stockInGenk = stockData.filter(item => 
                item.location === 'Genk' && 
                (item.case_type === caseType || item.caseType === caseType) &&
                (item.quantity || 0) > 0
            );
            
            const stockInWilrijk = stockData.filter(item => 
                item.location === 'Wilrijk' && 
                (item.case_type === caseType || item.caseType === caseType) &&
                (item.quantity || 0) > 0
            );
            
            const availableInGenk = stockInGenk.reduce((sum, item) => sum + (item.quantity || 0), 0);
            const availableInWilrijk = stockInWilrijk.reduce((sum, item) => sum + (item.quantity || 0), 0);
            const totalAvailable = availableInGenk + availableInWilrijk;
            
            // VERBETERDE LOGICA: Controleer werkelijke beschikbaarheid
            const needed = group.quantity;
            const canTransfer = totalAvailable >= needed;
            const shortfall = Math.max(0, needed - totalAvailable);
            
            availability[caseType] = {
                ...group,
                availableInGenk,
                availableInWilrijk,
                totalAvailable,
                needed,
                canTransfer,
                shortfall
            };
            
            console.log(`Beschikbaarheid ${caseType}: nodig=${needed}, Genk=${availableInGenk}, Wilrijk=${availableInWilrijk}, totaal=${totalAvailable}, kan transport=${canTransfer}, tekort=${shortfall}`);
        }
        
        return availability;
    }

    // NIEUWE FUNCTIE: Genereer transport request ID
    function generateTransportRequestId() {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
        const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
        return `TR-${dateStr}-${timeStr}`;
    }

    // NIEUWE FUNCTIE: Genereer automatisch transport document
    async function generateAutomaticTransportDocument(transportRequest) {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Header
            doc.setFontSize(18);
            doc.text('🚛 Automatische Transport Aanvraag', 20, 20);
            
            doc.setFontSize(12);
            doc.text(`Transport ID: ${transportRequest.id}`, 20, 35);
            doc.text(`Datum: ${new Date().toLocaleDateString('nl-BE')}`, 20, 45);
            doc.text(`Bestemming: ${transportRequest.targetLocation}`, 20, 55);
            doc.text(`Status: ${transportRequest.status}`, 20, 65);
            
            // Samenvatting
            doc.setFontSize(14);
            doc.text('📊 Samenvatting', 20, 85);
            doc.setFontSize(11);
            doc.text(`Totaal cases: ${transportRequest.totalCases}`, 25, 95);
            doc.text(`Verschillende kisttypen: ${transportRequest.totalTypes}`, 25, 105);
            doc.text('Bron: Automatisch gegenereerd bij CSV import', 25, 115);
            
            // VERBETERDE TABEL: Toon beschikbaarheid per kisttype met ERP codes
            const tableData = transportRequest.transferableItems.map(item => {
                // Haal ERP codes op voor dit kisttype
                const erpCodes = findERPCodesForCaseType(item.caseType, 'Willebroek');
                const erpCodeString = erpCodes.length > 0 ? erpCodes.join(', ') : 'NG';
                
                return [
                    item.caseType,
                    erpCodeString,
                    item.needed.toString(),
                    item.availableInGenk.toString(),
                    item.availableInWilrijk.toString(),
                    item.totalAvailable.toString(),
                    item.canTransfer ? '✅ Ja' : `❌ Nee (${item.shortfall} tekort)`,
                    item.quantity.toString() // Werkelijk te transporteren aantal
                ];
            });
            
            doc.autoTable({
                startY: 130,
                head: [['Kisttype', 'ERP Code', 'Gevraagd', 'Genk', 'Wilrijk', 'Totaal', 'Beschikbaar', 'Transport']],
                body: tableData,
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [41, 128, 185], textColor: 255 },
                columnStyles: {
                    0: { cellWidth: 25 }, // Kisttype kolom
                    1: { cellWidth: 20 }, // ERP Code kolom
                    2: { cellWidth: 18 }, // Gevraagd kolom
                    3: { cellWidth: 15 }, // Genk kolom
                    4: { cellWidth: 15 }, // Wilrijk kolom
                    5: { cellWidth: 15 }, // Totaal kolom
                    6: { halign: 'center', cellWidth: 25 }, // Beschikbaar kolom
                    7: { halign: 'center', fontStyle: 'bold', cellWidth: 20 } // Transport kolom
                },
                // Kleur rijen op basis van beschikbaarheid
                didParseCell: function(data) {
                    if (data.row.index >= 0) { // Niet de header
                        const item = transportRequest.transferableItems[data.row.index];
                        if (!item.canTransfer && data.column.index === 6) {
                            data.cell.styles.fillColor = [255, 235, 235]; // Licht rood voor niet beschikbaar
                            data.cell.styles.textColor = [200, 0, 0]; // Donker rood tekst
                        } else if (item.canTransfer && data.column.index === 6) {
                            data.cell.styles.fillColor = [235, 255, 235]; // Licht groen voor beschikbaar
                            data.cell.styles.textColor = [0, 150, 0]; // Donker groen tekst
                        }
                    }
                }
            });
            
            // Voeg waarschuwing toe als er items zijn die niet getransporteerd kunnen worden
            const itemsWithShortfall = transportRequest.transferableItems.filter(item => !item.canTransfer);
            if (itemsWithShortfall.length > 0) {
                doc.setFontSize(12);
                doc.setTextColor(200, 0, 0); // Rood
                doc.text('⚠️ Let op: Niet alle gevraagde kisten zijn beschikbaar!', 20, doc.lastAutoTable.finalY + 15);
                doc.setFontSize(10);
                doc.setTextColor(0, 0, 0); // Terug naar zwart
                doc.text('Alleen beschikbare items zijn opgenomen in deze transport aanvraag.', 20, doc.lastAutoTable.finalY + 25);
            }
            
            // Cases detail (eerste 20) met ERP codes
            const casesToShow = transportRequest.cases.slice(0, 20);
            const casesTableData = casesToShow.map(c => {
                // Haal ERP codes op voor dit case type
                const erpCodes = findERPCodesForCaseType(c.caseType, c.currentLocation || 'Willebroek');
                const erpCodeString = erpCodes.length > 0 ? erpCodes.join(', ') : 'NG';
                
                return [
                    c.caseLabel,
                    c.caseType,
                    erpCodeString,
                    c.currentLocation || 'Onbekend',
                    c.serialNumber || '-'
                ];
            });
            
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0); // Zorg dat tekst zwart is
            doc.text('📋 Case Details (eerste 20)', 20, doc.lastAutoTable.finalY + 40);
            
            doc.autoTable({
                startY: doc.lastAutoTable.finalY + 50,
                head: [['Case Label', 'Type', 'ERP Code', 'Huidige Locatie', 'Serienummer']],
                body: casesTableData,
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [52, 152, 219], textColor: 255 },
                columnStyles: {
                    0: { cellWidth: 35 }, // Case Label kolom
                    1: { cellWidth: 30 }, // Type kolom
                    2: { cellWidth: 25 }, // ERP Code kolom
                    3: { cellWidth: 35 }, // Huidige Locatie kolom
                    4: { cellWidth: 35 }  // Serienummer kolom
                }
            });
            
            if (transportRequest.cases.length > 20) {
                doc.setFontSize(10);
                doc.text(`... en ${transportRequest.cases.length - 20} meer cases`, 20, doc.lastAutoTable.finalY + 10);
            }
            
            // Footer
            doc.setFontSize(9);
            doc.text('Gegenereerd door Oilfree Kisten Management Systeem', 20, doc.internal.pageSize.height - 20);
            doc.text(`Tijd: ${new Date().toLocaleString('nl-BE')}`, 20, doc.internal.pageSize.height - 10);
            
            // Download PDF
            const filename = `Transport_Aanvraag_${transportRequest.id}.pdf`;
            doc.save(filename);
            
            console.log('✅ Transport document gegenereerd:', filename);
            
        } catch (error) {
            console.error('Fout bij genereren transport document:', error);
            throw new Error('Kon transport document niet genereren: ' + error.message);
        }
    }

    // NIEUWE FUNCTIE: Maak transport order in database
    async function createTransportOrderInDatabase(transportRequest) {
        try {
            // Maak order header
            const orderData = {
                id: transportRequest.id,
                location: transportRequest.targetLocation,
                date: new Date().toISOString(),
                status: 'open', // Gebruik geldige ENUM waarde
                order_type: 'transport', // Verkort van 'automatic_transport'
                transportPlanning: `Automatische transport aanvraag\n` +
                                 `Gegenereerd: ${new Date().toLocaleString('nl-BE')}\n` +
                                 `Cases: ${transportRequest.totalCases}\n` +
                                 `Kisttypen: ${transportRequest.totalTypes}\n` +
                                 `Bron: CSV import`
            };
            
            // Maak order items
            const orderItems = transportRequest.transferableItems.map(item => ({
                caseType: item.caseType,
                quantity: item.quantity,
                erpCodes: findERPCodesForCaseType(item.caseType, 'Willebroek'),
                pilsCaseLabel: item.cases.map(c => c.caseLabel).join(', '), // Join array naar string
                status: 'pending', // Verkort van 'auto_planned'
                production_location: 'Transport' // Markeer als transport item
            }));
            
            // Stuur naar server
            const response = await fetch('/api/oilfree/orders/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...orderData,
                    items: orderItems
                })
            });
            
            if (!response.ok) {
                // Log de fout maar laat het proces doorgaan
                console.warn(`Transport order database opslag gefaald (HTTP ${response.status}). PDF is wel gegenereerd.`);
                
                // Probeer de response body te lezen voor meer details
                try {
                    const errorText = await response.text();
                    console.warn('Server fout details:', errorText);
                } catch (e) {
                    console.warn('Kon server fout details niet lezen');
                }
                
                // Toon waarschuwing maar stop het proces niet
                showNotification(
                    `Transport aanvraag ${transportRequest.id} is gemaakt en PDF gegenereerd.\n` +
                    `Database opslag gefaald, maar transport document is beschikbaar.`,
                    'warning'
                );
                return; // Ga door zonder fout te gooien
            }
            
            const result = await response.json();
            console.log('✅ Transport order aangemaakt in database:', result);
            
        } catch (error) {
            console.error('Fout bij aanmaken transport order:', error);
            
            // Toon waarschuwing maar stop het proces niet
            showNotification(
                `Transport aanvraag ${transportRequest.id} is gemaakt en PDF gegenereerd.\n` +
                `Database opslag gefaald: ${error.message}`,
                'warning'
            );
            
            // Niet meer een fatale fout - laat het proces doorgaan
            console.warn('Transport proces gaat door ondanks database fout');
        }
    }

    // NIEUWE FUNCTIE: Update case transport status
    async function updateCaseTransportStatus(cases, newStatus, transportRequestId) {
        try {
            let successCount = 0;
            let failCount = 0;
            
            // Update elke case individueel
            for (const caseItem of cases) {
                try {
                    const updateData = {
                        transport_status: newStatus,
                        transport_request_id: transportRequestId
                    };
                    
                    const response = await fetch(`/api/cases/${caseItem.id || caseItem.caseLabel}/transport-status`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updateData)
                    });
                    
                    if (response.ok) {
                        successCount++;
                    } else {
                        failCount++;
                        console.warn(`Kon transport status niet updaten voor ${caseItem.caseLabel}: HTTP ${response.status}`);
                    }
                } catch (error) {
                    failCount++;
                    console.warn(`Fout bij updaten transport status voor ${caseItem.caseLabel}:`, error);
                }
            }
            
            if (successCount > 0) {
                console.log(`✅ Transport status bijgewerkt voor ${successCount} van ${cases.length} cases`);
            }
            
            if (failCount > 0) {
                console.warn(`⚠️ Transport status update gefaald voor ${failCount} van ${cases.length} cases`);
                showNotification(
                    `Transport status kon niet worden bijgewerkt voor ${failCount} van ${cases.length} cases. ` +
                    `Transport aanvraag is wel gemaakt.`,
                    'warning'
                );
            }
            
        } catch (error) {
            console.error('Algemene fout bij updaten transport status:', error);
            showNotification(
                `Transport status update gefaald: ${error.message}. Transport aanvraag is wel gemaakt.`,
                'warning'
            );
        }
    }


    
    /**
     * Toon een notificatie aan de gebruiker
     */
    function showNotification(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = 'toast show';
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        
        let bgColor;
        let icon;
        
        switch (type) {
            case 'success':
                bgColor = 'bg-success';
                icon = 'fa-check-circle';
                break;
            case 'error':
                bgColor = 'bg-danger';
                icon = 'fa-exclamation-circle';
                break;
            case 'warning':
                bgColor = 'bg-warning';
                icon = 'fa-exclamation-triangle';
                break;
            default:
                bgColor = 'bg-info';
                icon = 'fa-info-circle';
        }
        
        toast.innerHTML = `
            <div class="toast-header ${bgColor} text-white">
                <i class="fas ${icon} me-2"></i>
                <strong class="me-auto">${type.charAt(0).toUpperCase() + type.slice(1)}</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        `;
        
        document.querySelector('.toast-container').appendChild(toast);
        
        const bsToast = new bootstrap.Toast(toast, { delay: 5000 });
        bsToast.show();
        
        toast.addEventListener('hidden.bs.toast', function() {
            toast.remove();
        });
    }
    
    /**
     * Toon laad indicator
     */
    function showLoading(message = 'Laden...') {
        console.log(`Loading: ${message}`);
        
        // Maak een loading overlay als deze nog niet bestaat
        let loadingOverlay = document.getElementById('loading-overlay');
        if (!loadingOverlay) {
            loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'loading-overlay';
            loadingOverlay.style.position = 'fixed';
            loadingOverlay.style.top = '0';
            loadingOverlay.style.left = '0';
            loadingOverlay.style.width = '100%';
            loadingOverlay.style.height = '100%';
            loadingOverlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
            loadingOverlay.style.display = 'flex';
            loadingOverlay.style.justifyContent = 'center';
            loadingOverlay.style.alignItems = 'center';
            loadingOverlay.style.zIndex = '9999';
            
            const spinner = document.createElement('div');
            spinner.className = 'spinner-border text-light';
            spinner.setAttribute('role', 'status');
            
            const messageElement = document.createElement('span');
            messageElement.id = 'loading-message';
            messageElement.className = 'text-light ms-3';
            messageElement.textContent = message;
            
            const container = document.createElement('div');
            container.className = 'd-flex flex-column align-items-center';
            container.appendChild(spinner);
            container.appendChild(messageElement);
            
            loadingOverlay.appendChild(container);
            document.body.appendChild(loadingOverlay);
        } else {
            document.getElementById('loading-message').textContent = message;
            loadingOverlay.style.display = 'flex';
        }
    }
    
    function hideLoading() {
        console.log('Loading finished.');
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }
    
    /**
     * Laad voorbeeld gegevens (fallback voor als API niet beschikbaar is)
     */
    function loadSampleData() {
        casesData = [
            {
                id: 1,
                caseLabel: 'OFK-001',
                caseType: 'K10',
                originalCaseType: 'K10',
                serialNumber: 'SN12345',
                currentLocation: 'Genk',
                status: 'Beschikbaar',
                importDate: '2023-01-15T12:00:00',
                lastUpdated: '2023-06-20T15:30:00',
                notes: 'Voorbeeld kist 1'
            },
            {
                id: 2,
                caseLabel: 'OFK-002',
                caseType: 'K20',
                originalCaseType: 'V120',
                serialNumber: 'SN67890',
                currentLocation: 'Wilrijk',
                status: 'In gebruik',
                importDate: '2023-01-15T12:00:00',
                lastUpdated: '2023-06-25T10:15:00',
                notes: 'Voorbeeld kist 2'
            },
            {
                id: 3,
                caseLabel: 'OFK-003',
                caseType: 'K10',
                originalCaseType: 'K10',
                serialNumber: 'SN54321',
                currentLocation: 'Willebroek',
                status: 'Beschadigd',
                importDate: '2023-01-20T09:30:00',
                lastUpdated: '2023-07-01T08:45:00',
                notes: 'Voorbeeld kist 3 - Beschadigd tijdens transport'
            },
            {
                id: 4,
                caseLabel: 'OFK-004',
                caseType: 'K30',
                originalCaseType: 'K30',
                serialNumber: 'SN11223',
                currentLocation: 'Genk',
                status: 'In transit',
                importDate: '2023-02-05T14:20:00',
                lastUpdated: '2023-07-10T16:30:00',
                notes: 'Voorbeeld kist 4 - Onderweg naar Wilrijk'
            },
            {
                id: 5,
                caseLabel: 'OFK-005',
                caseType: 'K20',
                originalCaseType: 'K20',
                serialNumber: 'SN44556',
                currentLocation: 'Onbekend',
                status: 'Beschikbaar',
                importDate: '2023-02-10T11:45:00',
                lastUpdated: '2023-07-15T09:20:00',
                notes: 'Voorbeeld kist 5'
            }
        ];
        
        lastUpdated = new Date();
        document.getElementById('last-updated').textContent = `Laatst bijgewerkt: ${lastUpdated.toLocaleString()} (Test Data)`;
        
        updateLocationFilter();
        filterCases();
        
        showNotification('Gebruikmakend van testgegevens omdat de API niet beschikbaar is', 'warning');
    }

    // === STOCKBEHEER SECTIE ===

    // Functie om stockgegevens op te slaan in localStorage
    function saveLocalStockData(data) {
        localStorage.setItem('oilfree_stock_data', JSON.stringify(data));
        console.log('Stock gegevens opgeslagen in localStorage');
    }

    // Aangepaste loadStockData
    async function loadStockData() {
        showLoading('Stock data laden...');
        console.log('[DEBUG] loadStockData gestart...');
        let success = false;

        try {
            const response = await fetch('/api/oilfree/stock', { credentials: 'include' });
            console.log('[DEBUG] API status:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Fout ${response.status}: ${errorText.substring(0, 150)}`);
            }

            const text = await response.text();
            console.log('[DEBUG] Ruwe API response body:', text);

            if (!text || text.trim() === '') {
                console.log('[DEBUG] Lege response body ontvangen.');
                stockData = [];
                localStockData = [];
                success = true;
            } else if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
                 console.error('[DEBUG] HTML ontvangen, waarschijnlijk login/error pagina.');
                 throw new Error('Ongeldige response (HTML ontvangen)');
            } else {
                try {
                    const parsedData = JSON.parse(text);
                    console.log('[DEBUG] Succesvol JSON geparsed:', parsedData);

                    if (Array.isArray(parsedData)) {
                         stockData = parsedData.filter(item => item && typeof item === 'object');
                         // Map PAC3PL naar Willebroek voor correcte voorraadweergave
                         stockData.forEach(item => {
                             if (item.location === 'PAC3PL') item.location = 'Willebroek';
                         });
                         localStockData = JSON.parse(JSON.stringify(stockData)); // Diepe kopie voor lokaal gebruik
                         localStockData.forEach(item => {
                             if (item.location === 'PAC3PL') item.location = 'Willebroek';
                         });
                         console.log(`[DEBUG] Database data succesvol geladen (${stockData.length} items).`);
                         success = true;
                    } else {
                        console.warn('[DEBUG] Geparsede data is GEEN array, type:', typeof parsedData, 'Data:', parsedData);
                         stockData = [];
                         localStockData = [];
                         showNotification('API gaf onverwacht formaat data terug.', 'warning');
                         // Toch success=true, want API gaf *iets* terug, ook al is het leeg/verkeerd formaat
                         success = true; 
                    }
                } catch (e) {
                    console.error('[DEBUG] Fout bij JSON parsen:', e, text);
                    throw new Error('Kon API response niet parsen');
                }
            }
        } catch (error) {
            console.error('[DEBUG] Fout opgetreden in fetch/verwerking:', error);
            stockData = []; // Reset bij fout
            localStockData = [];
            // Probeer fallback naar localStorage alleen als API faalt
            const storedData = getLocalStockData();
            if (storedData && Array.isArray(storedData) && storedData.length > 0) {
                stockData = storedData; // Gebruik localStorage data
                localStockData = JSON.parse(JSON.stringify(storedData));
                console.log('[DEBUG] Fallback: Stock data geladen van localStorage:', localStockData.slice(0,5));
                showNotification('Stock data geladen van lokale opslag (offline). Server niet bereikbaar.', 'warning');
                success = true; // Succesvol geladen van fallback
            } else {
                showNotification(`Fout bij laden database: ${error.message}. Geen lokale data beschikbaar.`, 'error');
                success = false; // Laden volledig mislukt
            }
        }
        finally {
            hideLoading();
            console.log('[DEBUG] displayStockItems wordt aangeroepen met:', localStockData); // Gebruik localStockData voor weergave
            displayStockItems(localStockData);
        }
        return success; // Geeft terug of data (API of lokaal) geladen is
    }

    // Functie om stockgegevens uit localStorage te halen
    function getLocalStockData() {
        try {
            const data = localStorage.getItem('oilfree_stock_data');
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Fout bij ophalen gegevens uit localStorage:', e);
            return null;
        }
    }

    function displayStockItems(stockItems) {
        const stockTableBody = document.getElementById('stock-table-body');
        stockTableBody.innerHTML = '';
        const noResultsElement = document.getElementById('no-stock-results');

        if (!Array.isArray(stockItems) || stockItems.length === 0) {
            console.log('[DEBUG] displayStockItems: Geen items om weer te geven.');
            noResultsElement.classList.remove('d-none');
            return;
        } 
        
        noResultsElement.classList.add('d-none');
        console.log('[DEBUG] displayStockItems: Items renderen:', stockItems);
        
        // Groepeer items per kisttype en verzamel productielocaties
        const groupedItems = {};
        
        stockItems.forEach(item => {
            const caseType = (item.case_type || item.caseType || 'Onbekend').trim();
            const erpCode = (item.erp_code || item.erpCode || '').trim();
            const location = item.location || 'Onbekend';
            const quantity = parseInt(item.quantity) || 0;
            const productionLocation = item.production_location || '';
            
            const key = `${caseType}_${erpCode}`;
            
            if (!groupedItems[key]) {
                groupedItems[key] = {
                    caseType: caseType,
                    erpCode: erpCode,
                    Genk: 0,
                    Wilrijk: 0,
                    Willebroek: 0,
                    totalQuantity: 0,
                    productionLocations: {}
                };
            }
            
            // Verhoog de hoeveelheid voor deze locatie
            if (location === 'Genk' || location === 'Wilrijk' || location === 'Willebroek') {
                groupedItems[key][location] += quantity;
                groupedItems[key].totalQuantity += quantity;
            }
            
            // Bewaar de productielocatie
            if (productionLocation && !groupedItems[key].productionLocations[location]) {
                groupedItems[key].productionLocations[location] = productionLocation;
            }
        });
        
        // Sorteer op kisttype
        const sortedKeys = Object.keys(groupedItems).sort((a, b) => {
            return groupedItems[a].caseType.localeCompare(groupedItems[b].caseType);
        });
        
        // Verwijder bestaande legenda als die er is
        const existingLegend = document.getElementById('stock-legend');
        if (existingLegend) {
            existingLegend.remove();
        }
        
        // Maak tabelrijen
        sortedKeys.forEach(key => {
            const item = groupedItems[key];
            const row = document.createElement('tr');
            
            // Check of dit kisttype nodig is volgens de behoefteberekening
            const isNeeded = needsData && needsData[item.caseType] && needsData[item.caseType].totalNeeded > 0;
            
            // Bereken of er voldoende op stock is indien nodig
            let insufficientStock = false;
            let orderForGenk = 0;
            let orderForWilrijk = 0;
            
            if (isNeeded && needsData[item.caseType]) {
                const totalNeeded = needsData[item.caseType].totalNeeded;
                insufficientStock = item.totalQuantity < totalNeeded;
                
                if (insufficientStock) {
                    orderForGenk = needsData[item.caseType].orderGenk || 0;
                    orderForWilrijk = needsData[item.caseType].orderWilrijk || 0;
                }
            }
            
            // Als er een tekort is, maak de rij rood
            if (insufficientStock) {
                row.classList.add('table-danger');
            }
            
            // Maak celinhoud voor elke locatie met productielocatie
            function createCellContent(quantity, productionLocation, orderQuantity, currentLocation) {
                let content = `<div>${quantity}</div>`;
                
                // Toon productielocatie alleen als die overeenkomt met de huidige kolom
                if (productionLocation && productionLocation === currentLocation) {
                    content += `<div><small class="text-info"><i class="fas fa-industry"></i> ${productionLocation}</small></div>`;
                }
                
                // Als er items besteld moeten worden op deze locatie, toon dat
                if (orderQuantity > 0) {
                    content += `<div class="mt-1"><small class="text-danger fw-bold"><i class="fas fa-tools"></i> Maak ${orderQuantity}</small></div>`;
                }
                
                return content;
            }
            
            row.innerHTML = `
                <td>${item.caseType}</td>
                <td>${item.erpCode}</td>
                <td>${createCellContent(item.Genk, item.productionLocations.Genk, orderForGenk, 'Genk')}</td>
                <td>${createCellContent(item.Wilrijk, item.productionLocations.Wilrijk, orderForWilrijk, 'Wilrijk')}</td>
                <td>${createCellContent(item.Willebroek, item.productionLocations.Willebroek, 0, 'Willebroek')}</td>
                <td>
                    <button class="btn btn-sm btn-primary edit-stock-btn" 
                        data-case-type="${item.caseType}" 
                        data-erp-code="${item.erpCode}">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            `;
            
            stockTableBody.appendChild(row);
        });
        
        // Event listeners voor actieknoppen
        document.querySelectorAll('.edit-stock-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const caseType = this.getAttribute('data-case-type');
                const erpCode = this.getAttribute('data-erp-code');
                showEditStockModal(caseType, erpCode);
            });
        });
    }

    function filterStockItems() {
        const searchQuery = document.getElementById('stock-search-box').value.toLowerCase();
        const locationFilter = document.getElementById('stock-location-filter').value;
        console.log('[DEBUG] Filteren gestart. Query:', searchQuery, 'Locatie:', locationFilter, 'Basis data:', localStockData);

        // Filter de LOKALE kopie van de data
        const itemsToFilter = Array.isArray(localStockData) ? localStockData : [];

        let filteredItems;
        
        if (locationFilter === 'all') {
            // Als alle locaties: filter op basis van zoekopdracht in case_type en erp_code
            filteredItems = itemsToFilter.filter(item => {
                return searchQuery === '' || 
                    (item.erp_code && item.erp_code.toLowerCase().includes(searchQuery)) ||
                    (item.case_type && item.case_type.toLowerCase().includes(searchQuery)) ||
                    (item.production_location && item.production_location.toLowerCase().includes(searchQuery));
            });
        } else {
            // Als specifieke locatie: filter op locatie en zoekopdracht
            filteredItems = itemsToFilter.filter(item => {
                const matchesSearch = searchQuery === '' || 
                    (item.erp_code && item.erp_code.toLowerCase().includes(searchQuery)) ||
                    (item.case_type && item.case_type.toLowerCase().includes(searchQuery)) ||
                    (item.production_location && item.production_location.toLowerCase().includes(searchQuery));
                const matchesLocation = item.location === locationFilter;
                return matchesSearch && matchesLocation;
            });
        }

        console.log('[DEBUG] Gefilterde items:', filteredItems);
        displayStockItems(filteredItems); // Toon het gefilterde resultaat
    }

    // Update addNewStock functie om localStorage te gebruiken
    function addNewStock(event) {
        event.preventDefault();
        
        // Haal formuliergegevens op
        const location = document.getElementById('new-location').value;
        const erpCode = document.getElementById('new-erp-code').value;
        const caseType = document.getElementById('new-case-type').value;
        const quantity = parseInt(document.getElementById('new-quantity').value) || 0;
        let productionLocation = document.getElementById('new-production-location').value;
        
        // Valideer verplichte velden
        if (!location || !erpCode || quantity <= 0) {
            showNotification('Vul alle verplichte velden in en zorg dat het aantal groter is dan 0.', 'warning');
            return;
        }
        
        // Als productielocatie leeg is, toon een waarschuwing dat het aan Genk wordt toegewezen
        if (!productionLocation) {
            if (confirm('Geen productielocatie opgegeven. Items zonder productielocatie worden standaard aan Genk toegewezen. Wil je doorgaan?')) {
                productionLocation = ''; // Houd leeg, maar nu met expliciete bevestiging
            } else {
                // return; // Annuleer als de gebruiker niet wil doorgaan
            }
        }
        
        // Controle voor duplicaten
        const stockItem = stockData.find(item => 
            (item.location === location && (item.erp_code === erpCode || item.erpCode === erpCode)));
        
        // Als het item bestaat, vraag om bevestiging voor bijwerken
        if (stockItem) {
            const confirmed = confirm(`Er bestaat al een item met ERP code '${erpCode}' op locatie '${location}'. Wil je de hoeveelheid bijwerken?`);
            if (!confirmed) return;
            
            // Update bestaand item
            const oldQuantity = parseInt(stockItem.quantity) || 0;
            stockItem.quantity = oldQuantity + quantity;
            stockItem.case_type = caseType || stockItem.case_type;
            stockItem.production_location = productionLocation;
            
            // Update via API
            updateStockItem(location, erpCode, {
                caseType: caseType || stockItem.case_type,
                quantity: stockItem.quantity,
                productionLocation: productionLocation
            }).then(() => {
                // Reset formulier
                document.getElementById('add-stock-form').reset();
                // Herlaad stockgegevens en toon
                loadStockData();
            }).catch(error => {
                console.error('Fout bij updaten stock:', error);
                showNotification('Fout bij bijwerken stock: ' + error.message, 'danger');
            });
        } else {
            // Nieuw item toevoegen
            const newItem = {
                location: location,
                erp_code: erpCode,
                case_type: caseType,
                quantity: quantity,
                production_location: productionLocation
            };
            
            // Update via API
            fetch('/api/oilfree/stock/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newItem)
            }).then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP Error: ${response.status}`);
                }
                return response.json();
            }).then(data => {
                showNotification('Stock succesvol toegevoegd', 'success');
                // Reset formulier
                document.getElementById('add-stock-form').reset();
                // Herlaad stockgegevens en toon
                loadStockData();
            }).catch(error => {
                console.error('Fout bij toevoegen stock:', error);
                showNotification(`API Fout bij toevoegen: ${error.message}. Item lokaal toegevoegd als fallback.`, 'warning');
                
                // Voeg toe aan localStockData array (als fallback)
                localStockData.push({
                    location: location,
                    erp_code: erpCode,
                    case_type: caseType,
                    quantity: quantity,
                    production_location: productionLocation
                });
                
                saveLocalStockData(localStockData);
                displayStockItems(localStockData); // Update weergave
                
                // Reset formulier
                document.getElementById('add-stock-form').reset();
            });
        }
    }

    // Aangepaste updateStockItem functie
    async function updateStockItem(oldLocation, oldErpCode, updatedData) {
        console.log(`Updating stock item: Locatie=${oldLocation}, ERP=${oldErpCode}`, updatedData);
        showLoading('Stock item bijwerken...');

        // Maak een kopie van de data specifiek voor de API call
        const apiUpdateData = { ...updatedData };
        
        // Hernoem keys indien nodig voor de API
        if ('case_type' in apiUpdateData) { 
            apiUpdateData.caseType = apiUpdateData.case_type;
            delete apiUpdateData.case_type;
        }
        if ('production_location' in apiUpdateData) { 
            apiUpdateData.productionLocation = apiUpdateData.production_location;
            delete apiUpdateData.production_location;
        }
        if ('erp_code' in apiUpdateData) {
            apiUpdateData.erpCode = apiUpdateData.erp_code;
            delete apiUpdateData.erp_code;
        }

        try {
            // Vind het huidige item om de huidige waarden te behouden die niet worden bijgewerkt
            const currentItem = stockData.find(item => 
                item.location === oldLocation && (item.erp_code === oldErpCode || item.erpCode === oldErpCode)
            );
            
            // Zorg ervoor dat alle benodigde velden zijn ingevuld
            const completeData = {
                location: updatedData.location || oldLocation,
                erp_code: updatedData.erp_code || oldErpCode,
                case_type: updatedData.case_type || (currentItem ? (currentItem.case_type || currentItem.caseType) : ''),
                quantity: updatedData.quantity,  // Dit is het nieuwe aantal dat we willen instellen
                production_location: updatedData.production_location || 
                                    (currentItem ? (currentItem.production_location || currentItem.productionLocation) : '')
            };
            
            // Log wat we gaan verzenden
            console.log('API call data:', {
                old_location: oldLocation,
                old_erp_code: oldErpCode,
                new_data: {
                    location: completeData.location,
                    erp_code: completeData.erp_code,
                    case_type: completeData.case_type,
                    quantity: completeData.quantity,
                    production_location: completeData.production_location
                }
            });
            
            const response = await fetch('/api/oilfree/stock/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    old_location: oldLocation,
                    old_erp_code: oldErpCode,
                    new_data: {
                        location: completeData.location,
                        erp_code: completeData.erp_code,
                        case_type: completeData.case_type,
                        quantity: completeData.quantity,
                        production_location: completeData.production_location
                    }
                }),
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(`API error ${response.status}: ${errorData.message || response.statusText}`);
            }
            
            const result = await response.json();
            showNotification(`Stock item ${oldErpCode} bij ${oldLocation} succesvol bijgewerkt via API.`, 'success');
            
            // Update ook de stockData array
            if (currentItem) {
                currentItem.quantity = completeData.quantity;
                if (completeData.location) currentItem.location = completeData.location;
                if (completeData.case_type) currentItem.case_type = completeData.case_type;
                if (completeData.production_location) currentItem.production_location = completeData.production_location;
            }
            
            await loadStockData(); // Herlaad data na succesvolle update
        } catch (error) {
            console.error('Fout bij bijwerken stock item via API:', error);
            showNotification(`API Fout bij bijwerken: ${error.message}. Wijziging lokaal opgeslagen.`, 'warning');
            
            // Update in localStockData array (als fallback)
            const index = localStockData.findIndex(item => 
                item.location === oldLocation && (item.erp_code || item.erpCode) === oldErpCode);
                
            if (index !== -1) {
                 // Zorg ervoor dat de keys in localStockData consistent blijven
                 localStockData[index] = { 
                    ...localStockData[index], // Behoud bestaande keys
                    ...updatedData // Overschrijf met nieuwe data (met keys zoals 'case_type')
                 };
                 // Corrigeer eventueel de hoofdkeys als die ook veranderd zijn
                 localStockData[index].location = updatedData.location || oldLocation;
                 localStockData[index].erp_code = updatedData.erp_code || oldErpCode;

                 saveLocalStockData(localStockData);
                 displayStockItems(localStockData); // Update weergave
             } else {
                 showNotification('Fout: Item niet lokaal gevonden om bij te werken', 'error');
             }
        } finally {
            hideLoading();
        }
    }
    
    // Aangepaste deleteStock functie
    async function deleteStock(location, erpCode) {
        if (!confirm(`Weet je zeker dat je stock item ${erpCode} op locatie ${location} wilt verwijderen?`)) {
            return;
        }
        
        console.log(`Deleting stock item: Locatie=${location}, ERP=${erpCode}`);
        showLoading('Stock item verwijderen...');
        try {
            const response = await fetch('/api/oilfree/stock/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    location: location,
                    erp_code: erpCode
                }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(`API error ${response.status}: ${errorData.message || response.statusText}`);
            }
            showNotification(`Stock item ${erpCode} bij ${location} succesvol verwijderd via API.`, 'success');
            await loadStockData(); // Herlaad data na succesvolle verwijdering
        } catch (error) {
            console.error('Fout bij verwijderen stock item via API:', error);
            showNotification(`API Fout bij verwijderen: ${error.message}. Item lokaal verwijderd.`, 'warning');

            // Verwijder uit localStockData array (als fallback)
            const index = localStockData.findIndex(item => 
                item.location === location && (item.erp_code || item.erpCode) === erpCode);
            
            if (index !== -1) {
                localStockData.splice(index, 1);
                saveLocalStockData(localStockData);
                displayStockItems(localStockData); // Update weergave
            } else {
                showNotification('Fout: Item niet lokaal gevonden om te verwijderen', 'error');
            }
        } finally {
            hideLoading();
        }
    }

    // --- NIEUWE FUNCTIES VOOR KISTBEHOEFTE ---

    /**
     * Berekent de kistbehoefte op basis van casesData en stockData.
     */
    async function calculateNeeds() {
        console.log("Starten berekening kistbehoefte...");
        showLoading('Behoefte berekenen...');

        // Zorg dat stock data up-to-date is
        await loadStockData(); 
        
        // Zorg dat we ook de bestellingsgegevens hebben
        try {
            await loadOrders();
        } catch (error) {
            console.warn("Kon bestellingen niet laden voor behoefte-berekening:", error);
        }
        
        if (!casesData || casesData.length === 0) {
            showNotification('Geen kistgegevens (pils lijst) gevonden om behoefte te berekenen. Importeer eerst een CSV.', 'warning');
            hideLoading();
            return;
        }
        if (!stockData || stockData.length === 0) {
            showNotification('Geen stockgegevens gevonden. Kan behoefte niet berekenen.', 'warning');
            hideLoading();
            return;
        }

        // Houd bij welke kisten al zijn geleverd in eerdere bestellingen
        const alreadyDeliveredItems = {};
        
        // Controleer alle bestellingen om te zien welke items reeds geleverd zijn
        if (Array.isArray(ordersData)) {
            ordersData.forEach(order => {
                if (order.items && Array.isArray(order.items)) {
                    order.items.forEach(item => {
                        // Tel alleen geleverde items
                        if (item.deliveredQuantity && item.deliveredQuantity > 0) {
                            const key = item.caseType;
                            if (!alreadyDeliveredItems[key]) {
                                alreadyDeliveredItems[key] = 0;
                            }
                            alreadyDeliveredItems[key] += item.deliveredQuantity;
                        }
                    });
                }
            });
        }
        
        console.log("Reeds geleverde items:", alreadyDeliveredItems);

        const neededCounts = {};
        casesData.forEach(c => {
            if (c.caseType) { // Alleen tellen als er een type is
                neededCounts[c.caseType] = (neededCounts[c.caseType] || 0) + 1;
            }
        });
        console.log("Benodigde kisten per type:", neededCounts);
        
        // Verminder de behoefte met reeds geleverde items
        Object.keys(neededCounts).forEach(caseType => {
            if (alreadyDeliveredItems[caseType]) {
                neededCounts[caseType] = Math.max(0, neededCounts[caseType] - alreadyDeliveredItems[caseType]);
                console.log(`Behoefte voor ${caseType} verminderd wegens eerdere leveringen. Nieuwe behoefte: ${neededCounts[caseType]}`);
            }
        });

        // Bereid voorbereide stock data voor Genk/Wilrijk/Willebroek
        const availableStock = {
            Genk: {},
            Wilrijk: {},
            Willebroek: {} // Voeg Willebroek toe om deze stock mee te rekenen
        };

        // Helper functie om het alternatieve type te krijgen (V->K of K->V)
        const getAlternativeType = (type) => {
            if (type.toUpperCase().startsWith('V')) {
                return 'K' + type.substring(1);
            } else if (type.toUpperCase().startsWith('K')) {
                return 'V' + type.substring(1);
            }
            return null;
        };

        // Vul de beschikbare stock in
        stockData.forEach(item => {
            if (item.location === 'Genk' || item.location === 'Wilrijk' || item.location === 'Willebroek') {
                const itemCaseType = item.case_type || item.caseType;
                if (itemCaseType && item.quantity > 0) {
                    // Voeg toe aan beschikbare stock met originele type
                    availableStock[item.location][itemCaseType] = 
                        (availableStock[item.location][itemCaseType] || 0) + item.quantity;
                    
                    // Voeg ook toe als alternatief type (voor V/K substitutie)
                    const altType = getAlternativeType(itemCaseType);
                    if (altType) {
                        // Debug info
                        console.log(`Voeg kist ${itemCaseType} (${item.quantity} stuks) ook toe als ${altType} voor locatie ${item.location}`);
                        
                        // Voeg toe aan beschikbare stock met alternatieve type naam
                        availableStock[item.location][altType] = 
                            (availableStock[item.location][altType] || 0) + item.quantity;
                    }
                }
            }
        });
        console.log("Beschikbare stock (inclusief V/K substitutie):", availableStock);

        needsData = {}; // Reset
        let totalToOrderGenk = 0;
        let totalToOrderWilrijk = 0;

        Object.keys(neededCounts).forEach(caseType => {
            const totalNeeded = neededCounts[caseType];
            
            // Check eerst hoeveel er al in Willebroek beschikbaar zijn
            const availableWillebroek = availableStock.Willebroek[caseType] || 0;
            
            // Bereken hoeveel we nog moeten regelen (nodig - al beschikbaar in Willebroek)
            let stillNeeded = Math.max(0, totalNeeded - availableWillebroek);
            
            const availableGenk = availableStock.Genk[caseType] || 0;
            const availableWilrijk = availableStock.Wilrijk[caseType] || 0;
            
            // Hoeveel kan uit Genk komen?
            const fromGenk = Math.min(stillNeeded, availableGenk);
            stillNeeded -= fromGenk;
            
            // Hoeveel kan uit Wilrijk komen?
            const fromWilrijk = Math.min(stillNeeded, availableWilrijk);
            stillNeeded -= fromWilrijk;
            
            // Resterende behoefte (tekort) - Gebruik voorgedefinieerde productielocatie
            let orderGenk = 0;
            let orderWilrijk = 0;
            
            if (stillNeeded > 0) {
                // Zoek de voorgedefinieerde productielocatie voor dit kisttype
                const productionLocation = findPredefinedProductionLocation(caseType);
                
                // Wijs de bestelling toe aan de juiste locatie
                if (productionLocation === 'Wilrijk') {
                    orderWilrijk = stillNeeded;
                } else if (productionLocation === 'Genk') {
                    orderGenk = stillNeeded;
                } else {
                    // Als er geen duidelijke productielocatie is, zet alles in Genk kolom
                    // maar dit is puur voor weergave - de uiteindelijke selectie blijft leeg
                    orderGenk = stillNeeded;
                }
            }

            needsData[caseType] = {
                totalNeeded: totalNeeded,
                availableWillebroek: availableWillebroek, // Voeg dit toe om te tonen in UI
                availableGenk: availableGenk,
                availableWilrijk: availableWilrijk,
                orderGenk: orderGenk,
                orderWilrijk: orderWilrijk
            };

            totalToOrderGenk += orderGenk;
            totalToOrderWilrijk += orderWilrijk;
        });

        console.log("Berekende behoefte (na aftrek Willebroek stock):", needsData);
        displayNeedsSummary();
        
        // Update laatst berekend tijdstip
        const now = new Date();
        document.getElementById('needs-last-updated').textContent = `Laatst berekend: ${now.toLocaleTimeString('nl-BE')}`;

        // Toon bestelgedeelte via displayNeedsSummary en updateOrderButton
        // De oude code voor het tonen van bestelknoppen is verwijderd, dit wordt nu geregeld
        // via displayNeedsSummary die updateOrderButton aanroept

        hideLoading();
        showNotification('Kistbehoefte succesvol berekend.', 'success');
    }

    /**
     * Toont de berekende kistbehoefte in de tabel.
     */
    function displayNeedsSummary() {
        const tableBody = document.getElementById('needs-summary-tbody');
        const noResultsDiv = document.getElementById('no-needs');
        tableBody.innerHTML = '';

        const types = Object.keys(needsData);

        if (types.length === 0) {
            noResultsDiv.classList.remove('d-none');
            document.getElementById('needs-summary-table').classList.add('d-none');
            document.getElementById('order-section').classList.add('d-none');
            return;
        }

        noResultsDiv.classList.add('d-none');
        document.getElementById('needs-summary-table').classList.remove('d-none');

        // Voeg locatie keuze-optie toe aan tabel kop
        const headerRow = document.querySelector('#needs-summary-table thead tr');
        
        // Verwijder productielocatie header als deze bestaat
        const locationHeader = headerRow.querySelector('.production-location-header');
        if (locationHeader) {
            locationHeader.remove();
        }
        
        // Voeg een transfer-selectie kolomkop toe indien nog niet aanwezig
        if (!headerRow.querySelector('.transfer-select-header')) {
            const transferHeader = document.createElement('th');
            transferHeader.textContent = 'Transfer';
            transferHeader.className = 'transfer-select-header';
            transferHeader.style.width = '80px';
            // Voeg de header toe aan het einde
            headerRow.appendChild(transferHeader);
        }

        types.sort().forEach(caseType => {
            const data = needsData[caseType];
            const row = document.createElement('tr');
            
            // Bereken het totaal aantal beschikbare kisten
            const totalAvailable = data.availableWillebroek + data.availableGenk + data.availableWilrijk;
            
            // Bepaal of er voldoende kisten beschikbaar zijn
            const insufficientStock = data.totalNeeded > totalAvailable;
            
            // Voeg class toe voor kleur op basis van beschikbaarheid
            if (insufficientStock) {
                row.classList.add('table-danger'); // Rood voor onvoldoende stock
            } else {
                row.classList.add('table-success'); // Groen voor voldoende stock
            }

            // Basisinformatie over het kisttype
            let rowHTML = `
                <td><strong>${caseType}</strong></td>
                <td>${data.totalNeeded}</td>
                <td>${data.availableWillebroek}</td>
                <td>${data.availableGenk}</td>
                <td>${data.availableWilrijk}</td>
                <td class="${data.orderGenk > 0 ? 'table-warning' : ''}">
                    <input type="number" class="form-control form-control-sm order-quantity-input" 
                           data-case-type="${caseType}" 
                           data-location="Genk" 
                           min="0" 
                           value="${data.orderGenk}">
                </td>
                <td class="${data.orderWilrijk > 0 ? 'table-warning' : ''}">
                    <input type="number" class="form-control form-control-sm order-quantity-input" 
                           data-case-type="${caseType}" 
                           data-location="Wilrijk" 
                           min="0" 
                           value="${data.orderWilrijk}">
                </td>
            `;
            
            // Voeg transfer checkbox toe, alleen als er kisten beschikbaar zijn
            // in Genk of Wilrijk en nodig in Willebroek
            let transferCheckboxCell = '';
            const canTransfer = data.totalNeeded > data.availableWillebroek && 
                               (data.availableGenk > 0 || data.availableWilrijk > 0);
                               
            if (canTransfer) {
                // Bereken hoeveel er maximaal getransfereerd kan worden
                const maxTransfer = Math.min(
                    data.totalNeeded - data.availableWillebroek, // Hoeveel nodig
                    data.availableGenk + data.availableWilrijk // Hoeveel beschikbaar
                );
                
                transferCheckboxCell = `
                    <td class="text-center">
                        <div class="form-check">
                            <input class="form-check-input transfer-checkbox" type="checkbox" 
                                  data-case-type="${caseType}" 
                                  data-max-transfer="${maxTransfer}"
                                  id="transfer-${caseType}">
                        </div>
                    </td>
                `;
            } else {
                transferCheckboxCell = `<td class="text-center">-</td>`;
            }

            // Voeg de cellen toe aan de rij in de juiste volgorde
            row.innerHTML = rowHTML + transferCheckboxCell;
            tableBody.appendChild(row);
        });
        
        // Voeg event listeners toe voor de productielocatie dropdowns
        document.querySelectorAll('.production-location-select').forEach(select => {
            select.addEventListener('change', function() {
                const caseType = this.getAttribute('data-case-type');
                const selectedValue = this.value;
                
                // Direct opslaan voor Genk of Wilrijk
                updateSelectedProductionLocation(caseType, selectedValue);
            });
        });
        
        // Voeg een "Selecteer alles" checkbox toe (bij de eerste uitvoering)
        if (!document.getElementById('select-all-transfers')) {
            const needsLegend = document.getElementById('needs-legend');
            if (needsLegend) {
                const selectAllDiv = document.createElement('div');
                selectAllDiv.className = 'mt-3';
                selectAllDiv.innerHTML = `
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="select-all-transfers">
                        <label class="form-check-label" for="select-all-transfers">
                            Selecteer alle transfers
                        </label>
                    </div>
                `;
                needsLegend.appendChild(selectAllDiv);
                
                // Voeg event listener toe voor "Selecteer alles" checkbox
                document.getElementById('select-all-transfers').addEventListener('change', function() {
                    const isChecked = this.checked;
                    document.querySelectorAll('.transfer-checkbox').forEach(checkbox => {
                        checkbox.checked = isChecked;
                    });
                });
            }
        }
        
        // Voeg legenda toe aan de behoeftetabel
        let legendSection = document.getElementById('needs-legend');
        if (!legendSection) {
            legendSection = document.createElement('div');
            legendSection.id = 'needs-legend';
            legendSection.className = 'mt-3 mb-4';
            legendSection.innerHTML = `
                <p class="mb-2">Legenda:</p>
                <div class="d-flex gap-3">
                    <div>
                        <span class="badge bg-success p-2">&nbsp;&nbsp;&nbsp;</span>
                        <span>Voldoende kisten beschikbaar</span>
                    </div>
                    <div>
                        <span class="badge bg-danger p-2">&nbsp;&nbsp;&nbsp;</span>
                        <span>Onvoldoende kisten beschikbaar</span>
                    </div>
                    <div>
                        <span class="badge bg-warning p-2">&nbsp;&nbsp;&nbsp;</span>
                        <span>Te bestellen kisten</span>
                    </div>
                </div>
            `;
            // Fix: Gebruik appendChild in plaats van insertBefore met een niet-kind node
            const needsSummary = document.getElementById('needs-summary');
            needsSummary.appendChild(legendSection);
        }
        
        // Voeg een knop toe om de bestellingen te maken
        updateOrderButton();
    }
    
    // Helper functie om gesorteerde behoeftetabel te tonen, maak gebruik van dezelfde logica als displayNeedsSummary
    function displaySortedNeeds(sortedTypes) {
        const tableBody = document.getElementById('needs-summary-tbody');
        tableBody.innerHTML = '';
        
        sortedTypes.forEach(caseType => {
            const data = needsData[caseType];
            const row = document.createElement('tr');
            
            // Bereken het totaal aantal beschikbare kisten
            const totalAvailable = data.availableWillebroek + data.availableGenk + data.availableWilrijk;
            
            // Bepaal of er voldoende kisten beschikbaar zijn
            const insufficientStock = data.totalNeeded > totalAvailable;
            
            // Voeg class toe voor kleur op basis van beschikbaarheid
            if (insufficientStock) {
                row.classList.add('table-danger'); // Rood voor onvoldoende stock
            } else {
                row.classList.add('table-success'); // Groen voor voldoende stock
            }

            // Basisinformatie over het kisttype
            let rowHTML = `
                <td><strong>${caseType}</strong></td>
                <td>${data.totalNeeded}</td>
                <td>${data.availableWillebroek}</td>
                <td>${data.availableGenk}</td>
                <td>${data.availableWilrijk}</td>
                <td class="${data.orderGenk > 0 ? 'table-warning' : ''}">
                    <input type="number" class="form-control form-control-sm order-quantity-input" 
                           data-case-type="${caseType}" 
                           data-location="Genk" 
                           min="0" 
                           value="${data.orderGenk}">
                </td>
                <td class="${data.orderWilrijk > 0 ? 'table-warning' : ''}">
                    <input type="number" class="form-control form-control-sm order-quantity-input" 
                           data-case-type="${caseType}" 
                           data-location="Wilrijk" 
                           min="0" 
                           value="${data.orderWilrijk}">
                </td>
            `;
            
            // Voeg transfer checkbox toe, alleen als er kisten beschikbaar zijn
            // in Genk of Wilrijk en nodig in Willebroek
            let transferCheckboxCell = '';
            const canTransfer = data.totalNeeded > data.availableWillebroek && 
                               (data.availableGenk > 0 || data.availableWilrijk > 0);
                               
            if (canTransfer) {
                // Bereken hoeveel er maximaal getransfereerd kan worden
                const maxTransfer = Math.min(
                    data.totalNeeded - data.availableWillebroek, // Hoeveel nodig
                    data.availableGenk + data.availableWilrijk // Hoeveel beschikbaar
                );
                
                transferCheckboxCell = `
                    <td class="text-center">
                        <div class="form-check">
                            <input class="form-check-input transfer-checkbox" type="checkbox" 
                                  data-case-type="${caseType}" 
                                  data-max-transfer="${maxTransfer}"
                                  id="transfer-${caseType}">
                        </div>
                    </td>
                `;
            } else {
                transferCheckboxCell = `<td class="text-center">-</td>`;
            }

            // Voeg de cellen toe aan de rij in de juiste volgorde
            row.innerHTML = rowHTML + transferCheckboxCell;
            tableBody.appendChild(row);
        });
        
        // Voeg event listeners toe aan de invoervelden om de data bij te werken
        document.querySelectorAll('.order-quantity-input').forEach(input => {
            input.addEventListener('change', function() {
                const caseType = this.getAttribute('data-case-type');
                const location = this.getAttribute('data-location');
                const quantity = parseInt(this.value) || 0;
                
                // Update de waarde in het needsData object
                if (needsData[caseType]) {
                    if (location === 'Genk') {
                        needsData[caseType].orderGenk = quantity;
                    } else if (location === 'Wilrijk') {
                        needsData[caseType].orderWilrijk = quantity;
                    }
                }
            });
        });
    }

    // === BESTELLINGEN SECTIE ===
    
    // Globale variabelen voor bestellingen
    // let ordersData = []; // Alle bestellingen - al gedeclareerd aan het begin van het script
    let currentOrderDetails = null; // Details van de huidige geselecteerde bestelling
    
    // Initialiseer bestellingen-gerelateerde event listeners
    document.getElementById('orders-tab').addEventListener('click', () => setTimeout(loadOrders, 100));
    document.getElementById('order-refresh-button').addEventListener('click', loadOrders);
    document.getElementById('order-search-box').addEventListener('input', filterOrders);
    document.getElementById('order-location-filter').addEventListener('change', filterOrders);
    document.getElementById('complete-order-button').addEventListener('click', completeCurrentOrder);
    
    // Event listener voor gedelegeerde events op de order items tabel in de modal
    const orderItemsBody = document.getElementById('order-items-body');
    if (orderItemsBody) {
        orderItemsBody.addEventListener('click', function(event) {
            const target = event.target;
            // De .update-delivery-btn logica wordt nu afgehandeld door de algemene "Wijzigingen Opslaan" knop
            // We houden de listener hier voor eventuele andere toekomstige acties per rij.
            // const updateButton = target.closest('.update-delivery-btn');
            // if (updateButton) {
            //     const itemIndex = parseInt(updateButton.getAttribute('data-index'));
            //     if (!isNaN(itemIndex)) {
            // // Verplaatst naar saveOrderChanges
            //         // updateDeliveryStatus(itemIndex);
            //     }
            // }
        });
    }

    // Functie om bestellingen te laden
    async function loadOrders() {
        showLoading('Bestellingen laden...');
        
        try {
            // Haal bestellingen op via API
            const response = await fetch('/api/oilfree/orders');
            
            if (response.ok) {
                ordersData = await response.json();
                displayOrders(ordersData);
            } else {
                throw new Error(`API fout: ${response.status}`);
            }
        } catch (error) {
            console.error('Fout bij laden bestellingen:', error);
            showNotification('Fout bij laden bestellingen: ' + error.message, 'error');
            ordersData = [];
            displayOrders([]);
        } finally {
            hideLoading();
        }
    }
    
    // Functie om bestelling te genereren en op te slaan
    async function createOrder(location, items) {
        try {
            // Maak bestelling ID met de datum
            const today = new Date();
            // Unieke bestellingID: voeg tijdstempel toe (YYYY-MM-DD-HHMMSS)
            const pad = (num) => String(num).padStart(2, '0');
            const datePart = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
            const timePart = `${pad(today.getHours())}${pad(today.getMinutes())}${pad(today.getSeconds())}`;
            const orderID = `Bestelling-${datePart}-${timePart}`;
            const orderDate = today.toISOString();
            
            const newOrder = {
                id: orderID,
                location: location,
                date: orderDate,
                status: 'open', // open, partial, completed, canceled
                items: items.map(item => ({
                    pilsCaseLabel: item.pilsCaseLabel || null, // Neem pilsCaseLabel over
                    caseType: item.caseType,
                    erpCodes: item.erpCodes || [],
                    quantity: item.quantity,
                    deliveredQuantity: 0,
                    status: 'pending' // pending, partial, delivered
                }))
            };
            
            console.log('Te verzenden besteldata:', JSON.stringify(newOrder, null, 2));
            
            // Probeer eerst de API-methode
            try {
                // Opslaan via API
                const response = await fetch('/api/oilfree/orders/add', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(newOrder)
                });
                    
                if (response.ok) {
                    const result = await response.json();
                    showNotification(`Bestelling ${orderID} succesvol aangemaakt en opgeslagen.`, 'success');
                    return result.id || orderID;
                } else {
                    // Probeer text en json voor betere foutmeldingen
                    let errorMessage = `Status: ${response.status}`;
                    try {
                        const errorData = await response.json();
                        errorMessage = errorData.message || errorData.error || errorMessage;
                    } catch (e) {
                        try {
                            errorMessage = await response.text();
                        } catch (e2) {
                            // Fall back to status
                        }
                    }
                    throw new Error(`API fout: ${errorMessage}`);
                }
            } catch (apiError) {
                console.error('Fout bij API aanroep:', apiError);
                
                // Alternatieve methode: gebruik de email endpoint
                console.log('Proberen met alternatieve email methode...');
                try {
                    const emailResponse = await fetch('/api/needs/simple_email_order', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            location: location,
                            orderItems: items,
                            toEmail: 'jason@prodwilrijk.be' // Standaard ontvanger
                        })
                    });
                    
                    if (emailResponse.ok) {
                        showNotification(`Bestelling verzonden via e-mail als alternatief.`, 'success');
                        return orderID; // Blijf het orderID teruggeven voor consistentie
                    } else {
                        throw new Error(`Ook email methode faalde: ${emailResponse.status}`);
                    }
                } catch (emailError) {
                    console.error('Fout bij email-alternatief:', emailError);
                    // Laat de originele API-fout doorgaan
                    throw apiError;
                }
            }
        } catch (error) {
            console.error('Fout bij aanmaken bestelling:', error);
            showNotification('Fout bij aanmaken bestelling: ' + error.message, 'error');
            return null;
        }
    }
    
    // Functie om bestellingen te filteren
    function filterOrders() {
        const searchQuery = document.getElementById('order-search-box').value.toLowerCase();
        const locationFilter = document.getElementById('order-location-filter').value;
        
        const filteredOrders = ordersData.filter(order => {
            const matchesSearch = searchQuery === '' || 
                order.id.toLowerCase().includes(searchQuery);
            
            const matchesLocation = locationFilter === 'all' || order.location === locationFilter;
            
            return matchesSearch && matchesLocation;
        });
        
        displayOrders(filteredOrders);
    }
    
    // Helper functie om bestelling via API bij te werken met verbeterde foutafhandeling
    async function updateOrderViaAPI(order) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 seconden timeout
            
            const response = await fetch(`/api/oilfree/orders/${order.id}/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(order),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId); // Annuleer de timeout
                
            if (!response.ok) {
                let errorMsg = `API fout: ${response.status}`;
                
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.message || errorData.error || errorMsg;
                } catch (jsonError) {
                    // Als JSON parsen mislukt, probeer tekst te lezen
                    try {
                        const errorText = await response.text();
                        if (errorText && errorText.length > 0) {
                            errorMsg = `API fout: ${errorText.substring(0, 100)}`;
                        }
                    } catch (textError) {
                        // Als beide mislukken, gebruik de oorspronkelijke foutmelding
                    }
                }
                
                throw new Error(errorMsg);
            }
            
            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('API request timed out');
            }
            // Als het een netwerkfout is, voeg dan extra context toe
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                throw new Error('Netwerkfout: kan geen verbinding maken met de server. Controleer uw internetverbinding.');
            }
            // Geef de oorspronkelijke fout door als het geen specifiek geval is
            throw error;
        }
    }
    
    // Functie om bestellingen weer te geven
    function displayOrders(orders) {
        const tableBody = document.getElementById('order-table-body');
        tableBody.innerHTML = '';
        const fragment = document.createDocumentFragment(); // Gebruik DocumentFragment

        const noResultsElement = document.getElementById('no-order-results');

        if (!orders || orders.length === 0) {
            noResultsElement.classList.remove('d-none');
            return;
        }
        
        noResultsElement.classList.add('d-none');
        
        orders.forEach(order => {
            const row = document.createElement('tr');
            
            // Bereken totaal aantal bestelde items
            const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
            
            // Bereken totaal aantal geleverde items
            const deliveredItems = order.items.reduce((sum, item) => sum + (item.deliveredQuantity || 0), 0);
            
            // Status badge class
            let statusClass;
            let statusText;
            
            if (order.status === 'completed') {
                statusClass = 'bg-success';
                statusText = 'Voltooid';
            } else if (order.status === 'canceled') {
                statusClass = 'bg-danger';
                statusText = 'Geannuleerd';
            } else if (deliveredItems > 0 && deliveredItems < totalItems) {
                statusClass = 'bg-warning';
                statusText = 'Deels Geleverd';
            } else if (deliveredItems === totalItems) {
                statusClass = 'bg-success';
                statusText = 'Volledig Geleverd';
            } else {
                statusClass = 'bg-info';
                statusText = 'Open';
            }
            
            // Datum formatteren
            const orderDate = new Date(order.date).toLocaleDateString('nl-BE');
            
            row.innerHTML = `
                <td>${order.id}</td>
                <td>${order.location}</td>
                <td>${orderDate}</td>
                <td>${deliveredItems} / ${totalItems}</td>
                <td><span class="badge ${statusClass}">${statusText}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary view-order-btn" data-id="${order.id}">
                        <i class="fas fa-eye"></i> Details
                    </button>
                </td>
            `;
            
            fragment.appendChild(row);
        });
        tableBody.appendChild(fragment); // Voeg fragment in één keer toe

        // Verwijder de oude, herhaalde event listener toevoegingen:
        // document.querySelectorAll('.view-order-btn').forEach(btn => { ... });
    }
    
    // Functie om besteldetails te bekijken
    async function viewOrderDetails(orderId) {
        currentViewingOrder = ordersData.find(o => o.id === orderId);
        if (!currentViewingOrder) {
            showNotification('Bestelling niet gevonden', 'danger');
            return;
        }

        // Fetch volledige order details (inclusief items) van de server
        try {
            showLoading('Besteldetails laden...');
            const response = await fetch(`/api/oilfree/orders/${orderId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const order = await response.json();
            currentViewingOrder = order; // Update met de volledige data
            hideLoading();

            document.getElementById('order-detail-title').textContent = `Bestelling Details: ${order.id}`;
            document.getElementById('order-id-display').textContent = order.id;
            document.getElementById('order-status-display').textContent = order.status;
            document.getElementById('order-date-display').textContent = new Date(order.date).toLocaleString('nl-BE');
            document.getElementById('order-location-display').textContent = order.location;
            document.getElementById('order-transport-planning').value = order.transportPlanning || '';

            const itemsBody = document.getElementById('order-items-body');
            itemsBody.innerHTML = ''; // Leegmaken voor nieuwe items

            if (order.items && order.items.length > 0) {
                order.items.forEach(item => {
                    const row = itemsBody.insertRow();
                    
                    const cellType = row.insertCell();
                    const cellErp = row.insertCell();
                    const cellLabels = row.insertCell();
                    
                    if (item.item_type === 'artikel') {
                        cellType.textContent = item.artikel_omschrijving || 'Artikel';
                        cellErp.textContent = item.artikel_nummer || '-';
                        cellLabels.textContent = 'N.v.t.';
                    } else {
                        // Kist logica (bestaande of verbeterde weergave)
                        cellType.textContent = item.caseType || 'Onbekend';
                        // Probeer erp_codes te gebruiken als een array, anders val terug op erp_code, anders '-'
                        let erpDisplay = '-';
                        if (item.erpCodes && Array.isArray(item.erpCodes) && item.erpCodes.length > 0) {
                            erpDisplay = item.erpCodes.join(', ');
                        } else if (item.erp_code) {
                            erpDisplay = item.erp_code;
                        }
                        cellErp.textContent = erpDisplay;
                        cellLabels.textContent = item.pilsCaseLabel || 'N/A';
                    }

                    row.insertCell().textContent = item.quantity;
                    
                    const deliveredCell = row.insertCell();
                    const quantityInput = document.createElement('input');
                    quantityInput.type = 'number';
                    quantityInput.classList.add('form-control', 'form-control-sm', 'delivered-quantity-input');
                    quantityInput.value = item.delivered_quantity || 0;
                    quantityInput.min = 0;
                    quantityInput.max = item.quantity - (item.transferred_quantity || 0);
                    quantityInput.dataset.itemId = item.id; 
                    quantityInput.dataset.itemType = item.item_type; // Voorraadlogica
                    // Voorraadlogica: gebruik artikel_nummer voor artikelen, case_type voor kisten
                    quantityInput.dataset.caseType = item.item_type === 'artikel' ? item.artikel_nummer : item.case_type; 
                    quantityInput.dataset.productionLocation = item.production_location; // Voorraadlogica
                    deliveredCell.appendChild(quantityInput);

                    const statusCell = row.insertCell();
                    const statusBadge = document.createElement('span');
                    statusBadge.classList.add('badge');
                    let itemDisplayStatus = item.status || 'onbekend';
                    // Bepaal de display status nauwkeuriger
                    const openQuantity = item.quantity - (item.delivered_quantity || 0) - (item.transferred_quantity || 0);
                    if (openQuantity <= 0 && item.status !== 'geannuleerd') {
                         itemDisplayStatus = 'volledig geleverd/verwerkt';
                    } else if ((item.delivered_quantity || 0) > 0 || (item.transferred_quantity || 0) > 0) {
                        itemDisplayStatus = 'gedeeltelijk verwerkt';
                    }

                    statusBadge.textContent = itemDisplayStatus;
                    // Kleur badge op basis van status
                    if (itemDisplayStatus === 'volledig geleverd/verwerkt') {
                        statusBadge.classList.add('bg-success');
                    } else if (itemDisplayStatus === 'gedeeltelijk verwerkt') {
                        statusBadge.classList.add('bg-warning', 'text-dark');
                    } else if (itemDisplayStatus === 'wachtend' || itemDisplayStatus === 'open' || itemDisplayStatus === 'pending') {
                        statusBadge.classList.add('bg-info', 'text-dark');
                    } else if (itemDisplayStatus === 'geannuleerd') {
                        statusBadge.classList.add('bg-danger');
                    } else {
                        statusBadge.classList.add('bg-secondary');
                    }
                    statusCell.appendChild(statusBadge);

                    const actionsCell = row.insertCell();
                    const updateButton = document.createElement('button');
                    updateButton.classList.add('btn', 'btn-sm', 'btn-success', 'ms-1');
                    updateButton.innerHTML = '<i class="fas fa-check"></i> Bijwerken';
                    updateButton.title = 'Geleverde hoeveelheid bijwerken';
                    updateButton.addEventListener('click', () => {
                        const newDeliveredQuantity = parseInt(quantityInput.value, 10);
                        updateOrderItemDelivery(order.id, item.id, newDeliveredQuantity, 
                                              item.item_type === 'artikel' ? item.artikel_nummer : item.case_type, 
                                              order.location, item.quantity, item.delivered_quantity || 0, 
                                              item.item_type, item.artikel_nummer, item.production_location);
                    });
                    actionsCell.appendChild(updateButton);
                    
                    // Als het item niet volledig geleverd/overgezet is, toon 'Markeer als geleverd' knop
                    if (openQuantity > 0) {
                        const markDeliveredButton = document.createElement('button');
                        markDeliveredButton.classList.add('btn', 'btn-sm', 'btn-primary', 'ms-1');
                        markDeliveredButton.innerHTML = '<i class="fas fa-truck"></i> Alles Leveren';
                        markDeliveredButton.title = 'Markeer resterende hoeveelheid als geleverd';
                        markDeliveredButton.addEventListener('click', () => {
                            const currentDelivered = item.delivered_quantity || 0;
                            updateOrderItemDelivery(order.id, item.id, currentDelivered + openQuantity, 
                                                  item.item_type === 'artikel' ? item.artikel_nummer : item.case_type, 
                                                  order.location, item.quantity, currentDelivered, 
                                                  item.item_type, item.artikel_nummer, item.production_location);
                        });
                        actionsCell.appendChild(markDeliveredButton);
                    }
                });
            } else {
                const row = itemsBody.insertRow();
                const cell = row.insertCell();
                cell.colSpan = 7; // Aangepast naar 7 kolommen
                cell.textContent = 'Geen items in deze bestelling.';
                cell.classList.add('text-center');
            }
            
            // Update de status van de complete order knop
            updateCompleteOrderButtonState(order);

            orderDetailModal.show();

        } catch (error) {
            hideLoading();
            console.error('Fout bij ophalen besteldetails:', error);
            showNotification('Kon besteldetails niet laden.', 'danger');
        }
    }
    
    // Functie om individueel order item delivery status bij te werken
    async function updateOrderItemDelivery(orderId, itemId, newDeliveredQuantity, caseTypeOrArtikelNummer, location, totalQuantity, currentDeliveredQuantity, itemType, artikelNummer, productionLocation) {
        try {
            // Validatie
            if (newDeliveredQuantity < 0 || newDeliveredQuantity > totalQuantity) {
                showNotification(`Ongeldige hoeveelheid: ${newDeliveredQuantity}. Moet tussen 0 en ${totalQuantity} zijn.`, 'warning');
                return;
            }

            showLoading('Item bijwerken...');

            // Bereid de update data voor
            const updateData = {
                delivered_quantity: newDeliveredQuantity,
                status: newDeliveredQuantity === 0 ? 'pending' : 
                       newDeliveredQuantity < totalQuantity ? 'partial' : 'delivered'
            };

            // Update het item via API
            const response = await fetch(`/api/oilfree/orders/${orderId}/items/${itemId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Onbekende serverfout' }));
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }

            const result = await response.json();

            // Update stock als het item geleverd wordt (alleen voor kisten, niet voor artikelen)
            if (itemType !== 'artikel' && newDeliveredQuantity > currentDeliveredQuantity) {
                const quantityDifference = newDeliveredQuantity - currentDeliveredQuantity;
                try {
                    await updateStockWithDelivery(caseTypeOrArtikelNummer, location, quantityDifference);
                } catch (stockError) {
                    console.warn('Stock update gefaald:', stockError);
                    showNotification(`Item bijgewerkt, maar stock update gefaald: ${stockError.message}`, 'warning');
                }
            }

            showNotification(`Item succesvol bijgewerkt: ${newDeliveredQuantity}/${totalQuantity} geleverd`, 'success');
            
            // Herlaad de order details om de UI bij te werken
            await viewOrderDetails(orderId);
            
            // Herlaad ook de orders lijst
            loadOrders();

        } catch (error) {
            console.error('Fout bij bijwerken item delivery:', error);
            showNotification(`Fout bij bijwerken item: ${error.message}`, 'danger');
        } finally {
            hideLoading();
        }
    }
    
    // Functie om leveringsstatus en transportplanning bij te werken
    async function saveOrderChanges() {
        if (!currentOrderDetails) {
            showNotification('Geen bestelling geladen om op te slaan.', 'error');
            return;
        }

        showLoading('Wijzigingen opslaan...');

        // Update transportplanning
        currentOrderDetails.transportPlanning = document.getElementById('order-transport-planning').value.trim();

        // Update geleverde hoeveelheden voor elk item
        currentOrderDetails.items.forEach((item, index) => {
            const deliveredInput = document.querySelector(`.delivered-quantity[data-index="${index}"]`);
            if (deliveredInput) {
                const newQuantity = parseInt(deliveredInput.value, 10);
                if (!isNaN(newQuantity) && newQuantity >= 0 && newQuantity <= item.quantity) {
                    item.deliveredQuantity = newQuantity;
                    // Update item status op basis van nieuwe hoeveelheid
                    if (newQuantity === 0) {
                        item.status = 'pending';
                    } else if (newQuantity < item.quantity) {
                        item.status = 'partial';
                    } else {
                        item.status = 'delivered';
                    }
                } else if (!isNaN(newQuantity)) {
                    // Als het ingevoerde getal ongeldig is (bijv. te hoog), herstel naar vorige waarde of max.
                    deliveredInput.value = item.deliveredQuantity; // Herstel naar vorige correcte waarde
                    showNotification(`Ongeldig aantal voor ${item.caseType} (max ${item.quantity}). Wijziging niet opgeslagen.`, 'warning');
                }
            }
        });

        // Update de algemene order status
        updateOrderStatus(); // Deze functie werkt currentOrderDetails.status bij

        try {
            await updateOrderViaAPI(currentOrderDetails);
            showNotification('Wijzigingen succesvol opgeslagen.', 'success');
            // Herlaad de details in de modal om de UI te verversen met de laatste data (incl. status)
            // en herlaad de orders lijst.
            viewOrderDetails(currentOrderDetails.id); 
            loadOrders();
        } catch (error) {
            showNotification('Fout bij opslaan wijzigingen: ' + error.message, 'danger');
            console.error('Fout bij opslaan wijzigingen:', error);
        } finally {
            hideLoading();
        }
    }

    // Event listener voor de "Wijzigingen Opslaan" knop in de orderDetailModal
    const saveOrderChangesButton = document.getElementById('save-order-changes-button');
    if (saveOrderChangesButton) {
        saveOrderChangesButton.addEventListener('click', saveOrderChanges);
    }

    // Event listener voor de "Bestelling E-mailen" knop
    const emailOrderButton = document.getElementById('email-order-button');
    if (emailOrderButton) {
        emailOrderButton.addEventListener('click', async function() {
            if (!currentViewingOrder || !currentViewingOrder.id) {
                showNotification('Geen bestelling geladen om te e-mailen.', 'error');
                return;
            }
            showLoading('Bestelling e-mailen...');
            try {
                const response = await fetch(`/api/oilfree/orders/${currentViewingOrder.id}/email`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    // Optioneel: body toevoegen als de backend extra info verwacht, bijv. ontvanger
                    // body: JSON.stringify({ recipient: 'extra_email@example.com' })
                });
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: 'Onbekende serverfout' }));
                    throw new Error(errorData.message || `Serverfout: ${response.status}`);
                }
                const result = await response.json();
                showNotification(result.message || 'Bestelling succesvol gemaild!', 'success');
            } catch (error) {
                console.error('Fout bij e-mailen bestelling:', error);
                showNotification('Fout bij e-mailen: ' + error.message, 'danger');
            } finally {
                hideLoading();
            }
        });
    }

    // Functie om bestelling te voltooien
    function completeCurrentOrder() {
        if (!currentOrderDetails) {
            showNotification('Geen bestelling geselecteerd', 'error');
            return;
        }
        
        if (currentOrderDetails.status === 'completed' || currentOrderDetails.status === 'canceled') {
            showNotification('Bestelling is al voltooid of geannuleerd', 'warning');
            return;
        }
        
        // Bevestiging vragen
        if (!confirm(`Wilt u bestelling ${currentOrderDetails.id} als voltooid markeren?\nAlle niet-geleverde items worden geannuleerd.`)) {
            return;
        }
        
        // Toon laadindicator
        showLoading('Bestelling voltooien...');
        
        // Update status
        currentOrderDetails.status = 'completed';
        
        // Maak een timeout om de API call te onderbreken als deze te lang duurt
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout bij bijwerken bestelling')), 10000)
        );
        
        // Stuur update naar API met timeout beveiliging
        Promise.race([
            updateOrderViaAPI(currentOrderDetails),
            timeoutPromise
        ])
            .then(() => {
                // Update UI
                viewOrderDetails(currentOrderDetails.id);
                loadOrders(); // Herlaad bestellingen om lijst bij te werken
                
                showNotification('Bestelling gemarkeerd als voltooid', 'success');
                
                // Sluit modal
                document.querySelector('#orderDetailModal [data-bs-dismiss="modal"]').click();
            })
            .catch(error => {
                showNotification('Fout bij voltooien bestelling: ' + error.message, 'error');
                console.error('Fout bij voltooien bestelling:', error);
                
                // Herstel status omdat de update mislukt is
                currentOrderDetails.status = 'partial';
            })
            .finally(() => {
                // Verberg laadindicator, ongeacht resultaat
                // hideLoading();
            });
    }
    
    // Functie om bestelling status bij te werken
    function updateOrderStatus() {
        if (!currentOrderDetails) return;
        
        const totalItems = currentOrderDetails.items.reduce((sum, item) => sum + item.quantity, 0);
        const deliveredItems = currentOrderDetails.items.reduce((sum, item) => sum + (item.deliveredQuantity || 0), 0);
        
        // Don't change if already completed or canceled
        if (currentOrderDetails.status === 'completed' || currentOrderDetails.status === 'canceled') {
            return;
        }
        
        if (deliveredItems === 0) {
            currentOrderDetails.status = 'open';
        } else if (deliveredItems < totalItems) {
            currentOrderDetails.status = 'partial';
        } else {
            currentOrderDetails.status = 'completed';
        }
    }
    
    // Functie om stock bij te werken met geleverde items
    function updateStockWithDelivery(caseType, location, quantity) {
        // Zoek het item in de stock
        const stockItem = localStockData.find(item => {
            return (item.case_type === caseType || item.caseType === caseType) && 
                   item.location === location;
        });
        
        if (stockItem) {
            // Update bestaand stock item
            stockItem.quantity = (parseInt(stockItem.quantity) || 0) + quantity;
            saveLocalStockData(localStockData);
            showNotification(`Stock bijgewerkt met ${quantity} ${caseType} kisten op locatie ${location}`, 'success');
        } else {
            // Maak nieuw stock item aan
            const newStockItem = {
                location: location,
                case_type: caseType,
                erp_code: '', // Kan later worden bijgewerkt
                quantity: quantity,
                production_location: ''
            };
            
            localStockData.push(newStockItem);
            saveLocalStockData(localStockData);
            showNotification(`Nieuw stock item aangemaakt: ${quantity} ${caseType} kisten op locatie ${location}`, 'success');
        }
    }

    /**
     * Maakt een PDF bestand voor bestellingen voor een specifieke locatie
     * @param {string} location - De locatie waarvoor de bestelling is (Genk/Wilrijk)
     */
    function createOrderPDF(location) {
        if (!needsData || Object.keys(needsData).length === 0) {
            showNotification('Geen kistbehoefte gegevens beschikbaar. Bereken eerst de behoefte.', 'warning');
            return;
        }
        
        try {
            console.log(`Genereren PDF voor ${location} gestart...`);
            showLoading(`Bestelling voor ${location} maken...`);
            
            // Verzamel bestellingsitems voor deze locatie
            const orderItems = [];
            let totalQuantity = 0;
            
            // Voor standaard locaties (Genk/Wilrijk), gebruik de berekende behoeften
            if (location === 'Genk' || location === 'Wilrijk') {
                Object.keys(needsData).forEach(caseType => {
                    const quantity = needsData[caseType][`order${location}`] || 0;
                    if (quantity > 0) {
                        // Zoek bijbehorende ERP codes
                        const erpCodes = findERPCodesForCaseType(caseType, location);
                        
                        // Voeg alle benodigde kisten toe, ongeacht of ze beschikbaar zijn
                        orderItems.push({
                            caseType: caseType,
                            quantity: quantity,
                            erpCodes: erpCodes,
                            // Bepaal of dit item op stock staat
                            inStock: isItemInStock(caseType, location)
                        });
                        totalQuantity += quantity;
                        console.log(`Toegevoegd aan bestelling: ${quantity}x ${caseType} voor ${location}`);
                    }
                });
            } 
            // Voor aangepaste locaties, gebruik alle benodigde items
            else {
                Object.keys(needsData).forEach(caseType => {
                    // Bereken totale behoefte voor dit type kist
                    const totalNeeded = needsData[caseType].totalNeeded || 0;
                    const totalAvailable = needsData[caseType].availableGenk + 
                                          needsData[caseType].availableWilrijk + 
                                          needsData[caseType].availableWillebroek || 0;
                    
                    // Als er meer nodig is dan beschikbaar, voeg toe aan bestelling
                    if (totalNeeded > totalAvailable) {
                        const quantity = totalNeeded - totalAvailable;
                        // Zoek bijbehorende ERP codes (zoek specifiek in de geselecteerde locatie, geen fallback)
                        const erpCodes = findERPCodesForCaseType(caseType, location);
                        
                        orderItems.push({
                            caseType: caseType,
                            quantity: quantity,
                            erpCodes: erpCodes,
                            inStock: false // Bij aangepaste locatie is het per definitie niet op stock
                        });
                        totalQuantity += quantity;
                        console.log(`Toegevoegd aan aangepaste bestelling: ${quantity}x ${caseType} voor ${location}`);
                    }
                });
            }
            
            if (orderItems.length === 0) {
                showNotification(`Geen kisten nodig van ${location}`, 'info');
                // hideLoading();
                // return;
            }
            
            console.log(`Order items verzameld: ${orderItems.length} verschillende types, totaal ${totalQuantity} kisten`);
            
            // Maak eerst het database schema aan (indien nodig)
            setupOrdersTable()
                .then(() => {
                    console.log("Orders tabel aangemaakt of gecontroleerd");
                })
                .catch(error => {
                    console.warn("Kon orders tabel niet aanmaken/controleren:", error);
                })
                .finally(() => {
                    // Genereer PDF
                    generateAndDownloadPDF(location, orderItems, totalQuantity);
                });
            
        } catch (error) {
            console.error('Fout bij maken PDF:', error);
            showNotification('Fout bij maken van PDF: ' + error.message, 'error');
            hideLoading();
        }
    }
    
    // Helper functie om te bepalen of een item op stock staat
    function isItemInStock(caseType, location, isForForecastOrder = false) {
        // Voor forecast bestellingen: altijd true retourneren zodat bestellingen altijd worden gemaakt
        if (isForForecastOrder) {
            console.log(`Forecast bestelling: ${caseType} in ${location} - altijd toestaan (stock controle overgeslagen)`);
            return true;
        }
        
        if (!Array.isArray(stockData)) {
            console.log(`Geen stockData beschikbaar voor stock check van ${caseType} in ${location}`);
            return false;
        }
        
        // Voor forecast bestellingen: converteer V naar K voor stock check
        let searchCaseType = caseType;
        if (isForForecastOrder && caseType && caseType.toUpperCase().startsWith('V')) {
            searchCaseType = convertVTypeToKType(caseType);
            console.log(`Stock check: ${caseType} -> ${searchCaseType} (zoek K-kist stock voor V-type)`);
        }
        
        // Check of er items op stock staan met dit type en deze locatie
        const hasStock = stockData.some(item => {
            const itemCaseType = (item.case_type || item.caseType || '').trim().toLowerCase();
            const itemLocation = item.location;
            const productionLocation = item.production_location || '';
            const quantity = parseInt(item.quantity) || 0;
            
            // Check of dit item overeenkomt met het searchCaseType
            const typeMatches = itemCaseType.toLowerCase() === searchCaseType.toLowerCase();
            
            // Check locatie match
            const locationMatches = itemLocation === location;
            
            // Check of er daadwerkelijk stock is (quantity > 0)
            const hasQuantity = quantity > 0;
            
            // Productielocatie check (optioneel)
            const productionMatches = !productionLocation || 
                                    productionLocation === location || 
                                    productionLocation === '';
            
            const result = typeMatches && locationMatches && hasQuantity && productionMatches;
            
            if (result) {
                console.log(`Stock gevonden: ${searchCaseType} in ${location}, quantity: ${quantity}, production_location: ${productionLocation}`);
            }
            
            return result;
        });
        
        console.log(`Stock check resultaat voor ${caseType} in ${location}: ${hasStock ? 'Op stock' : 'Niet op stock'}`);
        return hasStock;
    }
    
    // Functie om orders tabel aan te maken (indien nodig)
    async function setupOrdersTable() {
        return fetch('/api/setup-orders-table')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Status: ${response.status}`);
                }
                return response.json();
            });
    }
    
    // Functie voor het genereren en downloaden van de PDF
    function generateAndDownloadPDF(location, orderItems, totalQuantity) {
        try {
            // Maak de PDF met jsPDF en autoTable
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Titel en datum
            doc.setFontSize(18);
            doc.text(`Bestelling Oilfree Kisten - ${location}`, 20, 20);
            
            doc.setFontSize(12);
            doc.text(`Datum: ${new Date().toLocaleDateString('nl-BE')}`, 20, 30);
            doc.text(`Aantal kisten: ${totalQuantity}`, 20, 40);
            
            // Genereer bestelling ID met datum
            const today = new Date();
            const orderID = `Bestelling-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            
            // Maak de tabel
            doc.autoTable({
                startY: 50,
                head: [['Type Kist', 'ERP Code(s)', 'Aantal', 'Status']],
                body: orderItems.map(item => [
                    item.caseType,
                    item.erpCodes.length > 0 ? item.erpCodes.join(', ') : 'Geen ERP code',
                    item.quantity,
                    'Te bestellen' // Altijd "Te bestellen" voor forecast bestellingen
                ]),
                styles: { 
                    fontSize: 10,
                    cellPadding: 5,
                    overflow: 'linebreak'
                },
                headStyles: { 
                    fillColor: [41, 128, 185],
                    textColor: 255
                },
                // Voeg rij-specifieke styling toe
                createdRow: function(row, data, index) {
                    // Altijd groen voor forecast bestellingen
                    doc.setFillColor(200, 255, 200); // Lichtgroen
                    // Pas de kleur toe op alle cellen in de rij
                    for (let i = 0; i < data.length; i++) {
                        row.cells[i].styles.fillColor = doc.getFillColor();
                    }
                }
            });
            
            // Voeg opmerking toe dat alle items worden besteld
            doc.setFontSize(10);
            doc.text('Opmerking: Alle items worden besteld, ongeacht stock status', 20, doc.autoTable.previous.finalY + 10);
            
            // Direct opslaan met eenvoudige datum notatie
            doc.save(`Bestelling_${location}_${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}.pdf`);
            
            console.log(`PDF succesvol gegenereerd en opgeslagen!`);
            
            // Maak bestelling aan en sla op in het systeem
            createOrder(location, orderItems).then(orderId => {
                if (orderId) {
                    showNotification(`Bestelling voor ${location} succesvol aangemaakt en opgeslagen (${orderId})`, 'success');
                }
                // hideLoading();
            }).catch(error => {
                console.error('Fout bij aanmaken bestelling:', error);
                showNotification(`PDF is gegenereerd en gedownload. Bestelling kon niet worden opgeslagen in database: ${error.message}`, 'warning');
                // hideLoading();
            });
            
        } catch (error) {
            console.error('Fout bij maken PDF:', error);
            showNotification('Fout bij maken van PDF: ' + error.message, 'error');
            hideLoading();
        }
    }

    /**
     * Zoekt de ERP codes bij een bepaald kisttype voor een specifieke locatie
     * @param {string} caseType - Het type kist
     * @param {string} location - De locatie (Genk/Wilrijk)
     * @returns {string[]} - Array met gevonden ERP codes
     */
    /**
     * Converteer V-type naar K-type voor forecast bestellingen
     * V-codes betekenen: kist + zak
     * - Kist wordt besteld als K-type in Genk
     * - Zak wordt apart voorzien in Willebroek
     * V003 -> K003, V361 -> K361, etc.
     */
    function convertVTypeToKType(caseType) {
        if (caseType && caseType.toUpperCase().startsWith('V')) {
            const kType = 'K' + caseType.substring(1);
            console.log(`V-type geconverteerd voor kistbestelling: ${caseType} -> ${kType} (kist in Genk, zak apart in Willebroek)`);
            return kType;
        }
        return caseType;
    }

    /**
     * Controleert of een case type relevant is voor forecast bestellingen
     * Filtert K006 tot K099 eruit omdat deze niet relevant zijn
     * @param {string} caseType - Het case type om te controleren
     * @returns {boolean} - true als relevant, false als niet relevant
     */
    function isRelevantCaseType(caseType) {
        if (!caseType) return false;
        
        const upperCaseType = caseType.toUpperCase().trim();
        
        // Check voor K006 tot K099 range (niet relevant)
        if (upperCaseType.startsWith('K')) {
            const numberPart = upperCaseType.substring(1);
            const match = numberPart.match(/^(\d{3})/); // Match eerste 3 cijfers
            
            if (match) {
                const number = parseInt(match[1]);
                if (number >= 6 && number <= 99) {
                    console.log(`Case type ${caseType} uitgefilterd: K006-K099 range niet relevant voor forecast`);
                    return false;
                }
            }
        }
        
        // Check voor V006 tot V099 range (ook niet relevant)
        if (upperCaseType.startsWith('V')) {
            const numberPart = upperCaseType.substring(1);
            const match = numberPart.match(/^(\d{3})/); // Match eerste 3 cijfers
            
            if (match) {
                const number = parseInt(match[1]);
                if (number >= 6 && number <= 99) {
                    console.log(`Case type ${caseType} uitgefilterd: V006-V099 range niet relevant voor forecast`);
                    return false;
                }
            }
        }
        
        return true; // Alle andere types zijn relevant
    }

    function findERPCodesForCaseType(caseType, location, isForForecastOrder = false) {
        const erpCodes = [];
        
        // Voor forecast bestellingen: converteer V-types naar K-types voor ERP code matching
        // V-codes = kist + zak, maar ERP codes zijn voor K-kisten (zakken apart voorzien)
        let searchCaseType = caseType;
        if (isForForecastOrder) {
            searchCaseType = convertVTypeToKType(caseType);
            if (searchCaseType !== caseType) {
                console.log(`Forecast ERP zoeken: ${caseType} -> ${searchCaseType} (zoek ERP codes voor K-kist, zak apart)`);
            }
        }
        
        console.log(`Zoeken naar ERP codes voor kisttype ${searchCaseType} in locatie ${location}`);
        
        // Zoek in stock data naar ERP codes voor deze case_type
        if (Array.isArray(stockData)) {
            const uniqueErpCodes = new Set();
            
            stockData.forEach(item => {
                const itemCaseType = (item.case_type || item.caseType || '').trim();
                const itemLocation = item.location;
                
                // Match exact op case_type (gebruik de geconverteerde type voor forecast)
                if (itemCaseType === searchCaseType) {
                    // Als locatie niet meegegeven, match op alle locaties
                    const locationMatches = !location || item.location === location;
                    
                    if (locationMatches) {
                        const code = item.erp_code || item.erpCode;
                        if (code && !uniqueErpCodes.has(code)) {
                            uniqueErpCodes.add(code);
                            console.log(`ERP code gevonden voor ${searchCaseType}: ${code}`);
                        }
                    }
                }
            });
            
            // Converteer Set naar Array
            const foundCodes = Array.from(uniqueErpCodes);
            if (foundCodes.length > 0) {
                console.log(`Gevonden ERP codes voor ${searchCaseType}: ${foundCodes.join(', ')}`);
                return foundCodes;
            }
        }
        
        // Genereer alternatieve kisttype notaties
        let searchTypes = [searchCaseType];
        
        // Voeg basis type toe (zonder suffixen zoals _A1)
        const baseType = searchCaseType.replace(/_A\d+$/, '').replace(/\+$/, '');
        if (baseType !== searchCaseType) {
            searchTypes.push(baseType);
            console.log(`Basis type toegevoegd: ${baseType}`);
        }
        
        // Voor elk type, genereer V/K varianten
        const allTypes = [...searchTypes];
        allTypes.forEach(type => {
            // Als het type met V begint, zoek ook naar de K-variant
            if (type.toUpperCase().startsWith('V')) {
                const kVariant = 'K' + type.substring(1);
                searchTypes.push(kVariant);
                console.log(`Type begint met V, zoek ook naar K-variant: ${kVariant}`);
            }
            // Als het type met K begint, zoek ook naar de V-variant
            else if (type.toUpperCase().startsWith('K')) {
                const vVariant = 'V' + type.substring(1);
                searchTypes.push(vVariant);
                console.log(`Type begint met K, zoek ook naar V-variant: ${vVariant}`);
            }
        });
        
        if (Array.isArray(stockData)) {
            searchTypes.forEach(searchType => {
                const normalizedCaseType = searchType.trim().toLowerCase();
                
                // Zoek in stock data naar overeenkomende kisttypen
                stockData.forEach(item => {
                    const itemCaseType = (item.case_type || item.caseType || '').trim().toLowerCase();
                    const itemLocation = item.location;
                    
                    // Als locatie niet meegegeven, match op alle locaties
                    const locationMatches = !location || item.location === location;
                    
                    // Verschillende manieren om case types te matchen
                    const exactMatch = itemCaseType === normalizedCaseType;
                    const containsMatch = itemCaseType.includes(normalizedCaseType) || 
                                      normalizedCaseType.includes(itemCaseType);
                    
                    if (locationMatches && (exactMatch || containsMatch)) {
                        const code = item.erp_code || item.erpCode;
                        if (code && !erpCodes.includes(code)) {
                            console.log(`Match gevonden in stock data! Type: ${searchType} => ${itemCaseType}, ERP code: ${code}`);
                            erpCodes.push(code);
                        }
                    }
                });
            });
        }
        
        console.log(`Gevonden ERP codes voor ${searchCaseType}: ${erpCodes.join(', ') || 'geen'}`);
        return erpCodes;
    }

    // Sorteer functie toevoegen voor kistbehoefte tabel
    document.addEventListener('DOMContentLoaded', function() {
        // ... existing code ...
        
        // Voeg sorteer functionaliteit toe voor kistbehoefte tabel
        document.getElementById('sort-case-type-btn').addEventListener('click', function() {
            sortNeedsByType();
        });
    });

    // Sorteer de kistbehoefte tabel op Type Kist
    let sortTypeAscending = true;
    function sortNeedsByType() {
        sortTypeAscending = !sortTypeAscending;
        
        // Sorteer de types op naam
        const types = Object.keys(needsData);
        
        // Sorteer op basis van huidige sorteerrichting
        if (sortTypeAscending) {
            types.sort();
        } else {
            types.sort().reverse();
        }
        
        // Toon de gesorteerde data
        displaySortedNeeds(types);
        
        // Toon sorteer indicator
        const btn = document.getElementById('sort-case-type-btn');
        btn.innerHTML = sortTypeAscending ? 
            '<i class="fas fa-sort-up"></i>' : 
            '<i class="fas fa-sort-down"></i>';
    }
    
    // Functie om stockitem-bewerkingsmodal te tonen
    function showEditStockModal(caseType, erpCode) {
        // Zoek alle items met dit kisttype en erp code
        const items = {};
        const locations = ['Genk', 'Wilrijk', 'Willebroek'];
        
        // Zoek originele items in stockData op basis van kisttype en ERP-code
        if (Array.isArray(stockData)) {
            stockData.forEach(item => {
                const itemCaseType = (item.case_type || item.caseType || '').trim();
                const itemErpCode = (item.erp_code || item.erpCode || '').trim();
                const location = item.location || 'Onbekend';
                
                if (itemCaseType === caseType && itemErpCode === erpCode && locations.includes(location)) {
                    items[location] = item;
                }
            });
        }
        
        // Controleer of we al een modal hebben, zo niet, maak er een aan
        let stockModal = document.getElementById('editStockModal');
        if (!stockModal) {
            // Maak nieuwe modal aan
            stockModal = document.createElement('div');
            stockModal.id = 'editStockModal';
            stockModal.className = 'modal fade';
            stockModal.setAttribute('tabindex', '-1');
            stockModal.setAttribute('aria-hidden', 'true');
            
            stockModal.innerHTML = `
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Stock Item Bewerken</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label">Type Kist</label>
                                <input type="text" id="edit-case-type" class="form-control" readonly>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">ERP Code</label>
                                <input type="text" id="edit-erp-code" class="form-control" readonly>
                            </div>
                            <h5 class="mt-4">Hoeveelheid per Locatie</h5>
                            <div id="location-quantities">
                                <div class="row mb-3">
                                    <div class="col-md-4">
                                        <label class="form-label">Genk</label>
                                        <input type="number" id="edit-quantity-Genk" class="form-control" min="0">
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">Productielocatie Genk</label>
                                        <input type="text" id="edit-production-Genk" class="form-control">
                                    </div>
                                </div>
                                <div class="row mb-3">
                                    <div class="col-md-4">
                                        <label class="form-label">Wilrijk</label>
                                        <input type="number" id="edit-quantity-Wilrijk" class="form-control" min="0">
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">Productielocatie Wilrijk</label>
                                        <input type="text" id="edit-production-Wilrijk" class="form-control">
                                    </div>
                                </div>
                                <div class="row mb-3">
                                    <div class="col-md-4">
                                        <label class="form-label">Willebroek</label>
                                        <input type="number" id="edit-quantity-Willebroek" class="form-control" min="0">
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">Productielocatie Willebroek</label>
                                        <input type="text" id="edit-production-Willebroek" class="form-control">
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuleren</button>
                            <button type="button" id="save-stock-changes" class="btn btn-primary">Opslaan</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(stockModal);
        }
        
        // Vul de velden in
        document.getElementById('edit-case-type').value = caseType;
        document.getElementById('edit-erp-code').value = erpCode;
        
        // Vul de hoeveelheden en productielocaties voor elke locatie in
        locations.forEach(location => {
            const quantityInput = document.getElementById(`edit-quantity-${location}`);
            const productionInput = document.getElementById(`edit-production-${location}`);
            
            if (items[location]) {
                quantityInput.value = items[location].quantity || 0;
                productionInput.value = items[location].production_location || '';
            } else {
                quantityInput.value = 0;
                productionInput.value = '';
            }
        });
        
        // Event listener voor de opslaan knop
        document.getElementById('save-stock-changes').onclick = function() {
            saveStockChanges(caseType, erpCode);
        };
        
        // Toon de modal
        const modal = new bootstrap.Modal(stockModal);
        modal.show();
    }

    // Functie om stockveranderingen op te slaan
    async function saveStockChanges(caseType, erpCode) {
        showLoading('Stock bijwerken...');
        
        const locations = ['Genk', 'Wilrijk', 'Willebroek'];
        const updates = [];
        
        try {
            // Verzamel de gegevens voor elke locatie
            for (const location of locations) {
                const quantity = parseInt(document.getElementById(`edit-quantity-${location}`).value) || 0;
                const productionLocation = document.getElementById(`edit-production-${location}`).value;
                
                // Zoek bestaand item
                const existingItem = stockData.find(item => {
                    const itemCaseType = (item.case_type || item.caseType || '').trim();
                    const itemErpCode = (item.erp_code || item.erpCode || '').trim();
                    return itemCaseType === caseType && itemErpCode === erpCode && item.location === location;
                });
                
                if (existingItem) {
                    // Update bestaand item
                    if (quantity === 0) {
                        // Verwijder als hoeveelheid 0 is
                        updates.push(deleteStock(location, erpCode));
                    } else {
                        // Update hoeveelheid en productielocatie
                        updates.push(updateStockItem(location, erpCode, {
                            location: location,
                            erp_code: erpCode,
                            case_type: caseType,
                            quantity: quantity,
                            production_location: productionLocation
                        }));
                    }
                } else if (quantity > 0) {
                    // Voeg nieuw item toe als de hoeveelheid groter is dan 0
                    const newItem = {
                        location: location,
                        erp_code: erpCode,
                        case_type: caseType,
                        quantity: quantity,
                        production_location: productionLocation
                    };
                    
                    // Gebruik bestaande addNewStock functie maar aangepast voor automatisch gebruik
                    updates.push(
                        fetch('/api/oilfree/stock/add', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(newItem)
                        })
                        .then(async response => {
                            if (!response.ok) {
                                const errorText = await response.text();
                                throw new Error(`API Fout ${response.status}: ${errorText}`);
                            }
                            return response.json();
                        })
                        .catch(error => {
                            console.warn('API fout bij toevoegen, gebruik localStorage:', error.message);
                            
                            // Voeg toe aan localStockData array (als fallback)
                            localStockData.push(newItem);
                            saveLocalStockData(localStockData);
                            console.log(`Nieuw stock item toegevoegd: ${quantity} ${caseType} (${erpCode}) op locatie ${location}`);
                        })
                    );
                }
            }
            
            // Wacht tot alle updates klaar zijn
            await Promise.all(updates);
            
            // Herlaad stock data en sluit de modal
            await loadStockData();
            
            // Sluit de modal
            const stockModal = document.getElementById('editStockModal');
            const modal = bootstrap.Modal.getInstance(stockModal);
            if (modal) {
                modal.hide();
            }
            
            showNotification('Stock succesvol bijgewerkt', 'success');
        } catch (error) {
            console.error('Fout bij bijwerken stock:', error);
            showNotification('Fout bij bijwerken stock: ' + error.message, 'error');
        } finally {
            hideLoading();
        }
    }

    // ... existing code ...

    // Functie om verpakte kisten te filteren en weer te geven
    function filterPackedCases() {
        // Check of de benodigde elementen bestaan
        const packedTableBody = document.getElementById('packed-table-body');
        const noPackedResults = document.getElementById('no-packed-results');
        
        if (!packedTableBody || !noPackedResults) {
            console.log('[DEBUG] Verpakte kisten tabel nog niet geladen of beschikbaar');
            return; // Stop als de elementen niet bestaan
        }
        
        const searchTerm = document.getElementById('packed-search-box')?.value.toLowerCase().trim() || '';
        const locationFilter = document.getElementById('packed-location-filter')?.value || 'all';
        
        // Filter de kisten op basis van zoekterm, locatie en status=packed
        let filteredCases = casesData.filter(function(item) {
            // Filter op status - alleen verpakte kisten tonen
            if (item.status !== 'In gebruik') return false;
            
            // Filter op zoekterm
            const matchesSearch = !searchTerm ||
                (item.caseLabel && item.caseLabel.toLowerCase().includes(searchTerm)) ||
                (item.caseType && item.caseType.toLowerCase().includes(searchTerm)) ||
                (item.serialNumber && item.serialNumber.toLowerCase().includes(searchTerm));
            
            // Filter op locatie
            const matchesLocation = locationFilter === 'all' ||
                (item.currentLocation && item.currentLocation === locationFilter);
            
            return matchesSearch && matchesLocation;
        });
        
        console.log(`[DEBUG] Gevonden verpakte kisten: ${filteredCases.length}`);
        displayPackedCases(filteredCases);
    }

    // Voeg deze functies toe vóór document.addEventListener

    // Functie om verpakte kisten weer te geven
    function displayPackedCases(cases) {
        const tableBody = document.getElementById('packed-table-body');
        if (!tableBody) return; // Veiligheidscontrole
        
        tableBody.innerHTML = ''; // Maak de tabel leeg
        
        const noResultsElement = document.getElementById('no-packed-results');
        
        if (!cases || cases.length === 0) {
            noResultsElement.classList.remove('d-none');
            return;
        }
        
        noResultsElement.classList.add('d-none');
        
        // Sorteer kisten op label
        cases.sort((a, b) => {
            // Controleer of caseLabel bestaat voordat localeCompare wordt aangeroepen
            const labelA = a.caseLabel || '';
            const labelB = b.caseLabel || '';
            return labelA.localeCompare(labelB);
        });
        
        const fragment = document.createDocumentFragment(); // Gebruik een DocumentFragment
        
        // Voeg elke kist toe aan de tabel
        cases.forEach(item => {
            const row = document.createElement('tr');
            
            const formattedCreatedAt = item.importDate ? new Date(item.importDate).toLocaleString('nl-NL') : '-';
            const formattedUpdatedAt = item.lastUpdated ? new Date(item.lastUpdated).toLocaleString('nl-NL') : '-';
            const formattedPackedDate = item.packed_date ? new Date(item.packed_date).toLocaleString('nl-NL') : formattedUpdatedAt;
            
            row.innerHTML = `
                <td>${item.caseLabel || '-'}</td>
                <td>${item.caseType || '-'}</td>
                <td>${item.serialNumber || '-'}</td>
                <td>${formattedPackedDate}</td>
                <td>${formattedCreatedAt}</td>
                <td>${formattedUpdatedAt}</td>
                <td>
                    <button class="btn btn-sm btn-primary edit-packed-case-btn" data-id="${item.id}" title="Bewerken">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-warning unpack-case-btn" data-id="${item.id}" title="Uitpakken">
                        <i class="fas fa-box-open"></i>
                    </button>
                    <button class="btn btn-sm btn-info view-photos-btn" data-id="${item.id}" title="Foto\'s Bekijken">
                        <i class="fas fa-image"></i>
                    </button>
                </td>
            `;
            
            fragment.appendChild(row); // Voeg rij toe aan fragment
        });
        
        tableBody.appendChild(fragment); // Voeg fragment toe aan DOM

        // De volgende regels zijn niet meer nodig dankzij event delegatie:
        // document.querySelectorAll('.edit-packed-case-btn').forEach(btn => { ... });
        // document.querySelectorAll('.unpack-case-btn').forEach(btn => { ... });
        // document.querySelectorAll('.view-photos-btn').forEach(btn => { ... });
    }

    /**
     * Markeer een kist als verpakt en werk voorraad Willebroek bij
     */
    async function markCaseAsPacked(id) {
        showLoading('Kist markeren als verpakt en voorraad bijwerken...');

        // Vind de kist in de lokale array om type en huidige status te krijgen
        const caseIndex = casesData.findIndex(item => item.id == id);
        if (caseIndex === -1) {
            showNotification('Kist niet gevonden.', 'danger');
            hideLoading();
            return;
        }

        const kist = casesData[caseIndex];
        const originalStatus = kist.status;
        const caseTypeToUpdate = kist.caseType || kist.type; // Zorg dat je het juiste veld voor kisttype gebruikt

        if (!caseTypeToUpdate) {
            showNotification('Kisttype niet gevonden voor deze kist. Voorraad niet bijgewerkt.', 'warning');
            // Ga verder met alleen status updaten als dat gewenst is, of stop hier
        }

        // Bereid de update data voor kiststatus voor
        const caseUpdateData = {
            status: 'In gebruik',
            packed_date: new Date().toISOString(),
            statusColor: 'warning'
        };

        try {
            // Stap 1: Werk de kiststatus bij via API
            const response = await fetch(`/api/cases/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(caseUpdateData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error ${response.status} bij bijwerken kiststatus.`);
            }

            await response.json(); // Wacht op de JSON response, ook al gebruiken we result niet direct hier

            // Werk de kist lokaal bij
            casesData[caseIndex] = { ...casesData[caseIndex], ...caseUpdateData, lastUpdated: new Date() };
            showNotification(`Kist ${casesData[caseIndex].caseLabel} is gemarkeerd als verpakt.`, 'success');

            // Stap 2: Werk de voorraad in Willebroek bij, alleen als de status daadwerkelijk is veranderd
            // en het kisttype bekend is.
            if (originalStatus !== 'In gebruik' && caseTypeToUpdate) {
                // Zoek het stock item voor Willebroek en het betreffende kisttype.
                // We hebben de ERP code nodig voor updateStockQuantity.
                // stockData moet de meest actuele server-side data bevatten.
                // Als PAC3PL in stockData voorkomt, wordt het als Willebroek beschouwd.
                const stockItemWillebroek = stockData.find(item =>
                    (item.location === 'Willebroek' || item.location === 'PAC3PL') &&
                    (item.case_type === caseTypeToUpdate || item.caseType === caseTypeToUpdate)
                );

                if (stockItemWillebroek && (stockItemWillebroek.erp_code || stockItemWillebroek.erpCode)) {
                    const erpCodeForUpdate = stockItemWillebroek.erp_code || stockItemWillebroek.erpCode;
                    console.log(`Voorraad Willebroek bijwerken voor ${caseTypeToUpdate} (ERP: ${erpCodeForUpdate}). Huidige status: ${originalStatus}`);
                    await updateStockQuantity('Willebroek', erpCodeForUpdate, -1);
                    // De showNotification voor voorraad update zit al in updateStockQuantity of wordt daar afgehandeld.
                    // We kunnen hier een specifieke toevoegen indien gewenst.
                    // showNotification(`Voorraad Willebroek voor ${caseTypeToUpdate} verminderd.`, 'info'); 
                } else {
                    console.warn(`Kon geen stock item of ERP code vinden voor ${caseTypeToUpdate} in Willebroek. Voorraad niet bijgewerkt.`);
                    showNotification(`Kon voorraaditem voor ${caseTypeToUpdate} in Willebroek niet vinden/bijwerken.`, 'warning');
                }
            } else if (originalStatus === 'In gebruik') {
                console.log(`Kist ${casesData[caseIndex].caseLabel} was al 'In gebruik'. Voorraad Willebroek niet opnieuw aangepast.`);
                showNotification(`Kist was al 'In gebruik'. Voorraad Willebroek niet aangepast.`, 'info');
            }

            // Vernieuw relevante UI-elementen
            filterCases(); // Update kistenlijst (waar item nu 'In gebruik' is)
            filterPackedCases(); // Update lijst met verpakte kisten
            await loadStockData(); // Zorgt voor een verse weergave van de voorraad tabel

        } catch (error) {
            console.error('Fout bij markeren als verpakt of bijwerken voorraad:', error);
            showNotification(`Fout: ${error.message}`, 'danger');
        } finally {
            hideLoading();
        }
    }

    /**
     * Kist weer uitpakken (beschikbaar maken)
     */
    function unpackCase(id) {
        // Toon laadanimatie
        showLoading('Kist markeren als beschikbaar...');
        
        // Bereid de update data voor
        const updateData = {
            status: 'Beschikbaar',
            statusColor: null // <-- Reset statusColor
        };
        
        // Roep de API aan om de status bij te werken
        fetch(`/api/cases/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(result => {
            // Vind de bijgewerkte kist in de lokale array en werk deze bij
            const index = casesData.findIndex(item => item.id == id);
            if (index !== -1) {
                casesData[index].status = 'Beschikbaar';
                casesData[index].lastUpdated = new Date();
                casesData[index].statusColor = null; // <-- Reset statusColor
                
                showNotification(`Kist ${casesData[index].caseLabel} is weer beschikbaar gemaakt.`, 'success');
                
                // Vernieuw beide tabellen
                filterCases();
                filterPackedCases();
            }
            hideLoading();
        })
        .catch(error => {
            console.error('Fout bij het beschikbaar maken:', error);
            showNotification('Fout bij het beschikbaar maken: ' + error.message, 'danger');
            hideLoading();
        });
    }

    // Voeg event listeners toe voor verpakte kisten tab
    function setupPackedCasesListeners() {
        // Zoeken in verpakte kisten
        const packedSearchBox = document.getElementById('packed-search-box');
        if (packedSearchBox) {
            packedSearchBox.addEventListener('input', function() {
                filterPackedCases();
            });
        }
        
        // Filteren op locatie in verpakte kisten
        const packedLocationFilter = document.getElementById('packed-location-filter');
        if (packedLocationFilter) {
            packedLocationFilter.addEventListener('change', function() {
                filterPackedCases();
            });
        }
        
        // Vernieuwen van verpakte kisten lijst
        const packedRefreshButton = document.getElementById('packed-refresh-button');
        if (packedRefreshButton) {
            packedRefreshButton.addEventListener('click', function() {
                loadCases();
                filterPackedCases();
            });
        }
    }

    // Helper functie om data op te slaan in localStorage
    function saveLocalStorage(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    // Helper functie om data op te halen uit localStorage
    function getLocalStorage(key, defaultValue = null) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    }

    // Helper functie om een uniek ID te genereren
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
    }

    // ... existing code ...

    // Pas de document.addEventListener aan om verpakte kisten functies te initialiseren
    document.addEventListener('DOMContentLoaded', function() {
        // ... existing code ...
        
        // Event listeners voor verpakte kisten tab
        setupPackedCasesListeners();
        
        // Tab change event listener om verpakte kisten te laden
        const packedTab = document.getElementById('packed-tab');
        if (packedTab) {
            packedTab.addEventListener('shown.bs.tab', function() {
                console.log('[DEBUG] Verpakte kisten tab getoond, vernieuwen van de lijst');
                filterPackedCases();
            });
        }
        
        // Laad kisten bij openen van de pagina
        loadCases();
        
        // Rest van je bestaande code
        // ... existing code ...
    });

    // Functie om foto's van een kist te tonen
    function showCasePhotos(id) {
        // Zoek de kist in de data
        const caseItem = casesData.find(item => item.id == id);
        if (!caseItem) {
            showNotification('Kist niet gevonden', 'danger');
            return;
        }
        
        // Vul de modal met basis info
        document.getElementById('photo-case-label').textContent = caseItem.caseLabel;
        document.getElementById('photo-case-id').value = caseItem.id;
        
        // Laad de huidige foto's
        loadCasePhotos(id);
        
        // Toon de modal
        const photosModal = new bootstrap.Modal(document.getElementById('casePhotosModal'));
        photosModal.show();
        
        // Voeg event listener toe voor de upload knop
        document.getElementById('upload-photo-btn').addEventListener('click', function() {
            uploadCasePhotos(id);
        });
    }

    // Functie om foto's van een verpakte kist te laden
    function loadCasePhotos(id) {
        const photosContainer = document.getElementById('case-photos-container');
        const noPhotosMessage = document.getElementById('no-photos-message');
        const galleryInner = document.getElementById('gallery-inner');
        const galleryIndicators = document.getElementById('gallery-indicators');
        
        // Maak de containers leeg
        photosContainer.innerHTML = '';
        galleryInner.innerHTML = '';
        galleryIndicators.innerHTML = '';
        
        // Toon laadanimatie
        showLoading('Foto\'s laden...');
        
        // Haal foto's op van de API
        fetch(`/api/cases/${id}/photos`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(photos => {
                hideLoading();
                
                if (!photos || photos.length === 0) {
                    noPhotosMessage.classList.remove('d-none');
                    return;
                }
                
                noPhotosMessage.classList.add('d-none');
                
                // Opslaan van foto's in variabele voor later gebruik
                window.casePhotos = photos;
                
                // Toon de foto's in rasterweergave
                photos.forEach((photo, index) => {
                    // Rasterweergave
                    const photoCol = document.createElement('div');
                    photoCol.className = 'col-md-4 mb-3';
                    photoCol.innerHTML = `
                        <div class="card">
                            <img src="${photo.url}" class="card-img-top" alt="Foto van kist" 
                                 style="cursor: pointer; height: 200px; object-fit: cover;"
                                 onclick="openFullImage('${photo.url}')">
                            <div class="card-body">
                                <p class="card-text text-muted small">${new Date(photo.uploadedAt).toLocaleString('nl-NL')}</p>
                                <div class="d-flex justify-content-between">
                                    <button class="btn btn-sm btn-primary download-photo-btn" data-url="${photo.url}" data-filename="${photo.originalName}">
                                        <i class="fas fa-download"></i>
                                    </button>
                                    <button class="btn btn-sm btn-danger delete-photo-btn" data-id="${photo.id}" data-case-id="${id}">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                    photosContainer.appendChild(photoCol);
                    
                    // Galerij-weergave items
                    const carouselItem = document.createElement('div');
                    carouselItem.className = index === 0 ? 'carousel-item active' : 'carousel-item';
                    carouselItem.innerHTML = `
                        <div class="text-center">
                            <img src="${photo.url}" class="d-block mx-auto" alt="Foto van kist"
                                 style="max-height: 70vh; max-width: 100%;">
                            <div class="carousel-caption d-none d-md-block bg-dark bg-opacity-50 rounded p-2">
                                <h5>${photo.originalName}</h5>
                                <p>${new Date(photo.uploadedAt).toLocaleString('nl-NL')}</p>
                                <button class="btn btn-sm btn-primary download-photo-btn-gallery" data-url="${photo.url}" data-filename="${photo.originalName}">
                                    <i class="fas fa-download"></i> Download
                                </button>
                            </div>
                        </div>
                    `;
                    galleryInner.appendChild(carouselItem);
                    
                    // Indicator voor galerij
                    const indicator = document.createElement('button');
                    indicator.setAttribute('type', 'button');
                    indicator.setAttribute('data-bs-target', '#case-photos-gallery');
                    indicator.setAttribute('data-bs-slide-to', index.toString());
                    if (index === 0) {
                        indicator.classList.add('active');
                    }
                    indicator.setAttribute('aria-current', index === 0 ? 'true' : 'false');
                    indicator.setAttribute('aria-label', `Slide ${index + 1}`);
                    galleryIndicators.appendChild(indicator);
                });
                
                // Voeg event listeners toe voor verwijder en download knoppen
                document.querySelectorAll('.delete-photo-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const photoId = this.getAttribute('data-id');
                        const caseId = this.getAttribute('data-case-id');
                        deleteCasePhoto(caseId, photoId);
                    });
                });
                
                document.querySelectorAll('.download-photo-btn, .download-photo-btn-gallery').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const url = this.getAttribute('data-url');
                        const filename = this.getAttribute('data-filename');
                        downloadPhoto(url, filename);
                    });
                });
                
                // Voeg event listener toe voor de 'Alle downloaden' knop
                document.getElementById('download-all-photos-btn').addEventListener('click', function() {
                    downloadAllPhotos(photos);
                });
                
                // Voeg event listeners toe voor de weergaveknoppen
                document.getElementById('view-grid-btn').addEventListener('click', function() {
                    showGridView();
                });
                
                document.getElementById('view-gallery-btn').addEventListener('click', function() {
                    showGalleryView();
                });
            })
            .catch(error => {
                hideLoading();
                console.error('Fout bij laden foto\'s:', error);
                showNotification('Fout bij laden foto\'s: ' + error.message, 'danger');
                noPhotosMessage.classList.remove('d-none');
            });
    }
    
    // Functie om een enkele foto te downloaden
    function downloadPhoto(url, filename) {
        // Creëer een tijdelijke link element
        const link = document.createElement('a');
        link.href = url;
        link.download = filename || 'foto.jpg';
        
        // Voeg link toe aan document
        document.body.appendChild(link);
        
        // Klik op de link om download te starten
        link.click();
        
        // Verwijder link uit document
        document.body.removeChild(link);
    }
    
    // Functie om alle foto's te downloaden als zip (meerdere foto's)
    function downloadAllPhotos(photos) {
        if (!photos || photos.length === 0) {
            showNotification('Geen foto\'s om te downloaden', 'warning');
            return;
        }
        
        // Voor een paar foto's, download ze individueel
        if (photos.length <= 5) {
            photos.forEach(photo => {
                downloadPhoto(photo.url, photo.originalName);
            });
            showNotification(`${photos.length} foto(s) gedownload`, 'success');
            return;
        }
        
        // Toon een waarschuwing als er veel foto's zijn
        if (confirm(`Weet je zeker dat je alle ${photos.length} foto's wilt downloaden?`)) {
            photos.forEach(photo => {
                setTimeout(() => {
                    downloadPhoto(photo.url, photo.originalName);
                }, 300); // Kleine vertraging om browser te helpen
            });
            showNotification(`Download van ${photos.length} foto's gestart`, 'success');
        }
    }
    
    // Functie om een foto in volledig scherm te tonen
    function openFullImage(url) {
        window.open(url, '_blank');
    }
    
    // Schakel naar rasterweergave
    function showGridView() {
        document.getElementById('case-photos-container').classList.remove('d-none');
        document.getElementById('case-photos-gallery').classList.add('d-none');
        document.getElementById('view-grid-btn').classList.add('active');
        document.getElementById('view-gallery-btn').classList.remove('active');
    }
    
    // Schakel naar galerij-weergave
    function showGalleryView() {
        document.getElementById('case-photos-container').classList.add('d-none');
        document.getElementById('case-photos-gallery').classList.remove('d-none');
        document.getElementById('view-grid-btn').classList.remove('active');
        document.getElementById('view-gallery-btn').classList.add('active');
    }

    // Functie om foto's te uploaden
    function uploadCasePhotos(id) {
        const fileInput = document.getElementById('case-photo-input');
        const files = fileInput.files;
        
        if (!files || files.length === 0) {
            showNotification('Selecteer eerst een bestand', 'warning');
            return;
        }
        
        // Toon laadanimatie
        showLoading('Foto\'s uploaden...');
        
        // Maak een FormData object aan voor de bestanden
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            formData.append('photos', files[i]);
        }
        
        // Upload de bestanden naar de API
        fetch(`/api/cases/${id}/photos`, {
            method: 'POST',
            body: formData
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(result => {
                hideLoading();
                showNotification(`${result.count || files.length} foto('s) geüpload`, 'success');
                fileInput.value = ''; // Reset het bestandsinvoerveld
                loadCasePhotos(id); // Herlaad de foto's
            })
            .catch(error => {
                hideLoading();
                console.error('Fout bij uploaden foto\'s:', error);
                showNotification('Fout bij uploaden foto\'s: ' + error.message, 'danger');
            });
    }

    // Functie om een foto te verwijderen
    function deleteCasePhoto(caseId, photoId) {
        if (!confirm('Weet je zeker dat je deze foto wilt verwijderen?')) {
            return;
        }
        
        // Toon laadanimatie
        showLoading('Foto verwijderen...');
        
        // Verwijder de foto via de API
        fetch(`/api/cases/${caseId}/photos/${photoId}`, {
            method: 'DELETE'
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(result => {
                hideLoading();
                showNotification('Foto verwijderd', 'success');
                loadCasePhotos(caseId); // Herlaad de foto's
            })
            .catch(error => {
                hideLoading();
                console.error('Fout bij verwijderen foto:', error);
                showNotification('Fout bij verwijderen foto: ' + error.message, 'danger');
            });
    }

    // ... existing code ...

    // Functie om de bestelknop bij te werken/toe te voegen
    function updateOrderButton() {
        const orderSection = document.getElementById('order-section');
        if (!orderSection) return;
        
        // Tekst aanpassen voor duidelijkheid
        orderSection.innerHTML = `
            <h4>Bestellingen Plaatsen</h4>
            <p>Controleer de aantallen in de tabel hierboven. Klik op de knop hieronder om bestellingen aan te maken voor de ingevulde aantallen per productielocatie (Genk/Wilrijk).</p>
            <button id="create-all-orders-button" class="btn btn-primary">
                <i class="fas fa-shopping-cart me-2"></i> Genereer Bestellingen voor Genk & Wilrijk
            </button>
        `;
        
        // Voeg event listener voor één-knop bestelsysteem
        document.getElementById('create-all-orders-button').addEventListener('click', () => {
            const ordersToCreate = { 'Genk': [], 'Wilrijk': [] };
            
            // Verzamel kisttypes en hun aantallen direct uit de inputvelden
            document.querySelectorAll('.order-quantity-input').forEach(input => {
                const caseType = input.getAttribute('data-case-type');
                const location = input.getAttribute('data-location');
                const quantity = parseInt(input.value) || 0;

                if (quantity > 0) {
                    // We hebben alleen de caseType nodig voor createOrderWithSelectedTypes,
                    // die functie leest de quantity zelf opnieuw uit het inputveld.
                    if (location === 'Genk' && !ordersToCreate['Genk'].includes(caseType)) {
                        ordersToCreate['Genk'].push(caseType);
                    } else if (location === 'Wilrijk' && !ordersToCreate['Wilrijk'].includes(caseType)) {
                        ordersToCreate['Wilrijk'].push(caseType);
                    }
                }
            });

            if (ordersToCreate['Genk'].length === 0 && ordersToCreate['Wilrijk'].length === 0) {
                showNotification('Geen aantallen ingevuld om te bestellen. Vul de gewenste aantallen in de tabel hierboven in.', 'warning');
                // return;
            }

            let ordersInitiated = false;
            if (ordersToCreate['Genk'].length > 0) {
                createOrderWithSelectedTypes('Genk', ordersToCreate['Genk']);
                ordersInitiated = true;
            }
            if (ordersToCreate['Wilrijk'].length > 0) {
                createOrderWithSelectedTypes('Wilrijk', ordersToCreate['Wilrijk']);
                ordersInitiated = true;
            }

            // Notificaties worden afgehandeld door createOrderWithSelectedTypes -> generateAndDownloadPDF -> createOrder
            // if (ordersInitiated) {
            //     showNotification('Bestelprocessen voor Genk en/of Wilrijk zijn gestart.', 'info');
            // }
        });
        
        // Toon de sectie als de needs-summary-table zichtbaar is.
        const needsSummaryTableVisible = !document.getElementById('needs-summary-table').classList.contains('d-none');
        orderSection.classList.toggle('d-none', !needsSummaryTableVisible);
    }
    
    // Functie om kisten te transfereren van Genk/Wilrijk naar Willebroek
    async function requestTransferToWillebroek() {
        // Verzamel de geselecteerde items voor transfer
        const selectedCheckboxes = document.querySelectorAll('.transfer-checkbox:checked');
        
        if (selectedCheckboxes.length === 0) {
            showNotification('Selecteer ten minste één kisttype om te transfereren.', 'warning');
            return;
        }
        
        // Vraag om bevestiging
        if (!confirm(`Wil je een transfer aanvragen voor ${selectedCheckboxes.length} geselecteerde kisttype(s) naar Willebroek?`)) {
            return;
        }
        
        showLoading('Transfer voorbereiden...');
        
        // Loop door alle geselecteerde kisttypen in de behoeftedata
        const transferItems = [];
        let totalTransferCount = 0;
        
        for (const checkbox of selectedCheckboxes) {
            const caseType = checkbox.getAttribute('data-case-type');
            const maxTransfer = parseInt(checkbox.getAttribute('data-max-transfer')) || 0;
            
            if (!caseType || maxTransfer <= 0 || !needsData[caseType]) continue;
            
            const data = needsData[caseType];
            
            // Bereken hoeveel we nodig hebben
            let neededInWillebroek = Math.min(
                data.totalNeeded - data.availableWillebroek,
                maxTransfer
            );
            
            if (neededInWillebroek <= 0) continue; // Ga naar volgende kisttype als er geen behoefte is
            
            // Bepaal hoeveel we uit elke locatie kunnen halen
            const availableInGenk = data.availableGenk;
            const availableInWilrijk = data.availableWilrijk;
            
            // Transfer aanvragen uit Genk en Wilrijk (voorkeur voor Genk als beiden beschikbaar)
            let fromGenk = Math.min(neededInWillebroek, availableInGenk);
            neededInWillebroek -= fromGenk;
            
            let fromWilrijk = Math.min(neededInWillebroek, availableInWilrijk);
            
            // Als we iets kunnen transfereren, voeg het toe aan de lijst
            if (fromGenk > 0) {
                transferItems.push({
                    caseType: caseType,
                    sourceLocation: 'Genk',
                    targetLocation: 'Willebroek',
                    quantity: fromGenk
                });
                totalTransferCount += fromGenk;
            }
            
            if (fromWilrijk > 0) {
                transferItems.push({
                    caseType: caseType,
                    sourceLocation: 'Wilrijk',
                    targetLocation: 'Willebroek',
                    quantity: fromWilrijk
                });
                totalTransferCount += fromWilrijk;
            }
        }
        
        // Als er niets te transfereren is
        if (transferItems.length === 0) {
            hideLoading();
            showNotification('Geen kisten beschikbaar om te transfereren.', 'info');
            return;
        }
        
        try {
            // Log de transfers die we gaan aanvragen
            console.log('Transfer items:', transferItems);
            
            // Maak transfer document (PDF of mail)
            await generateTransferDocument(transferItems);
            
            // Pas voorraad aan in de database en lokaal
            await processTransfers(transferItems);
            
            showNotification(`Transfer aangevraagd voor ${totalTransferCount} kisten naar Willebroek.`, 'success');
            
            // Herbereken behoefte na transfer
            await calculateNeeds();
            
        } catch (error) {
            console.error('Fout bij aanvragen transfer:', error);
            showNotification('Fout bij aanvragen transfer: ' + error.message, 'error');
        } finally {
            hideLoading();
        }
    }
    
    // Helper functie om transfer documenten te genereren
    async function generateTransferDocument(transferItems) {
        // Groepeer items per bronlocatie
        const itemsBySource = {};
        
        transferItems.forEach(item => {
            if (!itemsBySource[item.sourceLocation]) {
                itemsBySource[item.sourceLocation] = [];
            }
            itemsBySource[item.sourceLocation].push(item);
        });
        
        // Probeer een PDF te genereren met alle transfer details
        try {
            const pdf = new jsPDF();
            let yPos = 20;
            
            // Titel
            pdf.setFontSize(16);
            pdf.text('Transfer Aanvraag naar Willebroek', 105, yPos, { align: 'center' });
            yPos += 15;
            
            // Datum
            pdf.setFontSize(12);
            pdf.text(`Datum: ${new Date().toLocaleDateString('nl-BE')}`, 20, yPos);
            yPos += 15;
            
            // Voor elke bronlocatie een apart tabel
            Object.keys(itemsBySource).forEach(sourceLocation => {
                const items = itemsBySource[sourceLocation];
                
                pdf.setFontSize(14);
                pdf.text(`Van ${sourceLocation} naar Willebroek:`, 20, yPos);
                yPos += 10;
                
                // Kolomkoppen
                pdf.setFontSize(12);
                pdf.text('Kisttype', 20, yPos);
                pdf.text('Aantal', 90, yPos);
                pdf.text('ERP Code', 130, yPos);
                yPos += 8;
                
                // Horizontale lijn
                pdf.line(20, yPos - 2, 190, yPos - 2);
                
                // Items
                pdf.setFontSize(11);
                items.forEach(item => {
                    // Zoek de ERP codes voor dit kisttype
                    const erpCodes = findERPCodesForCaseType(item.caseType, sourceLocation);
                    const erpCodeText = erpCodes.length > 0 ? erpCodes.join(', ') : '-';
                    
                    pdf.text(item.caseType, 20, yPos);
                    pdf.text(item.quantity.toString(), 90, yPos);
                    pdf.text(erpCodeText, 130, yPos);
                    yPos += 8;
                    
                    // Voeg een nieuwe pagina toe als we bijna aan het einde zijn
                    if (yPos > 270) {
                        pdf.addPage();
                        yPos = 20;
                    }
                });
                
                // Ruimte tussen tabellen
                yPos += 10;
            });
            
            // Ondertekeningsveld
            yPos += 10;
            pdf.text('Aangevraagd door: ' + (document.getElementById('username')?.textContent || '____________________'), 20, yPos);
            yPos += 15;
            pdf.text('Handtekening: ______________________', 20, yPos);
            
            // Download PDF
            pdf.save('Transfer_Aanvraag_Willebroek.pdf');
            
        } catch (error) {
            console.error('Fout bij genereren transfer PDF:', error);
            
            // Fallback: Stuur email met transfers
            try {
                // Als PDF genereren mislukt, probeer een email te sturen
                await fetch('/api/needs/transfer_request_email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        transfers: transferItems,
                        toEmail: 'logistiek@prodwilrijk.be' // Default ontvanger, pas aan indien nodig
                    })
                });
                
                showNotification('Transfer aanvraag verzonden via e-mail.', 'success');
            } catch (emailError) {
                console.error('Kon geen email versturen:', emailError);
                throw new Error('Kon geen transfer document genereren of email versturen.');
            }
        }
    }
    
    // Helper functie om transfers te verwerken in de database/locaal
    async function processTransfers(transferItems) {
        // Voor elke transfer moeten we:
        // 1. Verlaag stock in bronlocatie
        // 2. Verhoog stock in doellocatie (Willebroek)
        
        for (const item of transferItems) {
            try {
                console.log(`Verwerken transfer: ${item.quantity}x ${item.caseType} van ${item.sourceLocation} naar ${item.targetLocation}`);
                
                // Zoek ERP codes voor dit kisttype
                const erpCodes = findERPCodesForCaseType(item.caseType, item.sourceLocation);
                if (erpCodes.length === 0) {
                    console.warn(`Geen ERP code gevonden voor ${item.caseType} in ${item.sourceLocation}`);
                    continue;
                }
                
                const erpCode = erpCodes[0]; // Neem de eerste ERP code die we vinden
                console.log(`Gevonden ERP code voor transfer: ${erpCode}`);
                
                // Zoek het bronitem om de huidige voorraad te controleren
                const sourceItem = stockData.find(stockItem => 
                    stockItem.location === item.sourceLocation && 
                    (stockItem.erp_code === erpCode || stockItem.erpCode === erpCode)
                );
                
                if (!sourceItem) {
                    console.error(`Kan bronitem niet vinden voor ${item.caseType} in ${item.sourceLocation}`);
                    continue;
                }
                
                // Controleer of er voldoende voorraad is
                const sourceQuantity = parseInt(sourceItem.quantity) || 0;
                if (sourceQuantity < item.quantity) {
                    console.warn(`Onvoldoende voorraad voor ${item.caseType} in ${item.sourceLocation}: ${sourceQuantity} < ${item.quantity}`);
                    // Pas de transferhoeveelheid aan naar wat beschikbaar is
                    item.quantity = sourceQuantity;
                    if (item.quantity <= 0) {
                        console.warn(`Geen voorraad meer, deze transfer wordt overgeslagen`);
                        continue;
                    }
                }
                
                // 1. Verminder stock in bronlocatie
                await updateStockQuantity(item.sourceLocation, erpCode, -item.quantity);
                
                // 2. Voeg toe aan Willebroek
                // Controleer eerst of dit kisttype al bestaat in Willebroek
                const existingItem = stockData.find(stockItem => 
                    stockItem.location === 'Willebroek' && 
                    (stockItem.case_type === item.caseType || stockItem.caseType === item.caseType)
                );
                
                if (existingItem) {
                    // Update bestaande item in Willebroek
                    const willebroekErpCode = existingItem.erp_code || existingItem.erpCode;
                    console.log(`Bijwerken bestaand item in Willebroek met ERP code ${willebroekErpCode}`);
                    await updateStockQuantity('Willebroek', willebroekErpCode, item.quantity);
                } else {
                    // Maak nieuw item in Willebroek
                    console.log(`Nieuw item aanmaken in Willebroek voor ${item.caseType}`);
                    const newItem = {
                        location: 'Willebroek',
                        erp_code: erpCode, // Gebruik dezelfde ERP code
                        case_type: item.caseType,
                        quantity: item.quantity,
                        production_location: '' // Laat leeg omdat het een transfer is
                    };
                    
                    // Update via API
                    try {
                        const response = await fetch('/api/oilfree/stock/add', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(newItem)
                        });
                        
                        if (!response.ok) {
                            throw new Error(`HTTP Error: ${response.status}`);
                        }
                        
                        console.log(`Item succesvol toegevoegd aan Willebroek`);
                    } catch (error) {
                        console.error('Fout bij toevoegen stock in Willebroek:', error);
                        
                        // Fallback naar lokale opslag
                        console.log(`Toevoegen aan lokale opslag als fallback`);
                        localStockData.push(newItem);
                        saveLocalStockData(localStockData);
                    }
                }
                
            } catch (error) {
                console.error(`Fout bij verwerken transfer voor ${item.caseType}:`, error);
                // Ga door met volgende item
            }
        }
        
        // Herlaad stockgegevens om de UI bij te werken
        console.log('Transfers verwerkt, stock data herladen...');
        await loadStockData();
    }
    
    // Helper functie om stockhoeveelheden bij te werken
    async function updateStockQuantity(location, erpCode, quantityChange) {
        // Zoek het huidige stock item
        const stockItem = stockData.find(item => 
            item.location === location && 
            (item.erp_code === erpCode || item.erpCode === erpCode)
        );
        
        if (!stockItem) {
            console.error(`Kan stock item niet vinden voor locatie ${location} en ERP code ${erpCode}`);
            return;
        }
        
        console.log(`Stock bijwerken: ${location}, ${erpCode}, huidige hoeveelheid: ${stockItem.quantity}, wijziging: ${quantityChange}`);
        
        // Bereken nieuwe hoeveelheid
        const currentQuantity = parseInt(stockItem.quantity) || 0;
        const newQuantity = Math.max(0, currentQuantity + quantityChange); // Zorg dat het niet onder 0 komt
        
        console.log(`Nieuwe hoeveelheid: ${newQuantity}`);
        
        // Maak een volledige kopie van het stockItem met alle velden
        const updatedData = {
            location: location,
            erp_code: erpCode,
            case_type: stockItem.case_type || stockItem.caseType,
            quantity: newQuantity,
            production_location: stockItem.production_location || stockItem.productionLocation
        };
        
        // Update via API
        try {
            await updateStockItem(location, erpCode, updatedData);
            
            // Update lokale data ook
            stockItem.quantity = newQuantity;
        } catch (error) {
            console.error(`Fout bij bijwerken stock voor ${erpCode} in ${location}:`, error);
            
            // Fallback naar lokale opslag
            const index = localStockData.findIndex(item => 
                item.location === location && (item.erp_code === erpCode || item.erpCode === erpCode)
            );
            
            if (index !== -1) {
                localStockData[index].quantity = newQuantity;
                saveLocalStockData(localStockData);
            }
        }
    }
    
    // Functie om bestelling te maken met specifieke geselecteerde kisttypes
    function createOrderWithSelectedTypes(location, selectedTypes) {
        try {
            console.log(`Genereren PDF voor ${location} met geselecteerde types: ${selectedTypes.join(', ')}`);
            showLoading(`Bestelling voor ${location} maken...`);
            
            // Verzamel bestellingsitems voor deze locatie en geselecteerde types
            const orderItems = [];
            let totalQuantity = 0;
            
            selectedTypes.forEach(caseType => {
                // Haal de bestelhoeveelheid direct op uit het invoerveld
                const inputField = document.querySelector(`.order-quantity-input[data-case-type="${caseType}"][data-location="${location}"]`);
                const quantity = inputField ? (parseInt(inputField.value) || 0) : 0;
                
                if (quantity > 0) {
                    const erpCodes = findERPCodesForCaseType(caseType, location);
                    const inStockStatus = true; // Altijd true voor forecast bestellingen

                    let pilsLabelsForThisOrder = [];
                    if (Array.isArray(casesData)) {
                        let count = 0;
                        for (const caseItem of casesData) {
                            if (caseItem.caseType === caseType) {
                                // TODO: Voeg hier eventueel een geavanceerdere check toe of dit label al besteld/verwerkt is
                                // Voor nu: selecteer de eerste 'quantity' beschikbare labels.
                                pilsLabelsForThisOrder.push(caseItem.caseLabel);
                                count++;
                                if (count >= quantity) break;
                            }
                        }
                    }

                    if (pilsLabelsForThisOrder.length === quantity) {
                        // Gevonden specifieke pilsCaseLabels, maak individuele order items
                        pilsLabelsForThisOrder.forEach(pilsLabel => {
                            orderItems.push({
                                pilsCaseLabel: pilsLabel,
                                caseType: caseType,
                                quantity: 1, // Altijd 1 voor een specifiek pilsCaseLabel
                                erpCodes: erpCodes, // ERP codes zijn per type
                                inStock: inStockStatus // Stock status is per type
                            });
                        });
                    } else {
                        // Niet genoeg specifieke labels gevonden, maak een geaggregeerd item
                        console.warn(`Kon niet ${quantity} specifieke pilsCaseLabels vinden voor ${caseType} (slechts ${pilsLabelsForThisOrder.length}/${quantity}). Bestelregel wordt gegroepeerd.`);
                        showNotification(`Onvoldoende unieke kistlabels voor ${caseType} (${pilsLabelsForThisOrder.length}/${quantity}). Bestelregel gegroepeerd.`, 'warning');
                        orderItems.push({
                            pilsCaseLabel: null, // Geen specifiek label
                            caseType: caseType,
                            quantity: quantity, // Totale hoeveelheid
                            erpCodes: erpCodes,
                            inStock: inStockStatus
                        });
                    }
                    totalQuantity += quantity; // totalQuantity blijft de som van de oorspronkelijke gevraagde hoeveelheden
                    console.log(`Verwerkt voor bestelling: ${quantity}x ${caseType} voor ${location}`);
                }
            });
            
            if (orderItems.length === 0) {
                showNotification(`Geen kisten geselecteerd voor bestelling in ${location}`, 'info');
                // hideLoading();
                // return;
            }
            
            // Maak eerst het database schema aan (indien nodig)
            setupOrdersTable()
                .then(() => {
                    console.log("Orders tabel aangemaakt of gecontroleerd");
                })
                .catch(error => {
                    console.warn("Kon orders tabel niet aanmaken/controleren:", error);
                })
                .finally(() => {
                    // Genereer PDF
                    generateAndDownloadPDF(location, orderItems, totalQuantity);
                });
            
        } catch (error) {
            console.error('Fout bij maken bestelling:', error);
            showNotification('Fout bij maken van bestelling: ' + error.message, 'error');
            hideLoading();
        }
    }

    /**
     * Vindt de voorgedefinieerde productielocatie voor een bepaald kisttype
     * Kijkt in de stock_oilfree tabel naar de production_location kolom
     * @param {string} caseType - Het type kist (kan V of K zijn)
     * @returns {string|null} - De productielocatie ('Genk', 'Wilrijk') of null als niet gevonden
     */
    function findPredefinedProductionLocation(caseType) {
        if (!Array.isArray(stockData)) {
            console.log(`Geen stockData beschikbaar voor productielocatie zoeken van ${caseType}`);
            return null;
        }
        
        // Voor V-types, zoek ook naar de K-variant voor productielocatie
        const searchTypes = [caseType];
        if (caseType && caseType.toUpperCase().startsWith('V')) {
            const kVariant = 'K' + caseType.substring(1);
            searchTypes.push(kVariant);
            console.log(`Zoek productielocatie voor ${caseType}, inclusief K-variant: ${kVariant}`);
        }
        
        // Zoek items met dit kisttype in stock_oilfree tabel
        let matchingItems = [];
        searchTypes.forEach(searchType => {
            const normalizedCaseType = searchType.trim().toLowerCase();
            
            const items = stockData.filter(item => {
                const itemCaseType = (item.case_type || item.caseType || '').trim().toLowerCase();
                // Exacte match heeft voorkeur
                return itemCaseType === normalizedCaseType;
            });
            
            matchingItems = matchingItems.concat(items);
        });
        
        if (matchingItems.length === 0) {
            console.log(`Geen items gevonden in stock_oilfree voor kisttype ${caseType} (inclusief varianten)`);
            return null;
        }
        
        // Zoek de productielocatie van deze items
        // Probeer eerst een item te vinden met een expliciete productielocatie
        const itemWithLocation = matchingItems.find(item => 
            item.production_location && 
            (item.production_location === 'Genk' || item.production_location === 'Wilrijk')
        );
        
        if (itemWithLocation) {
            console.log(`Productielocatie voor ${caseType} gevonden in stock_oilfree: ${itemWithLocation.production_location} (case_type: ${itemWithLocation.case_type})`);
            return itemWithLocation.production_location;
        }
        
        // Als geen expliciete productielocatie, probeer af te leiden van locatie waar stock is
        const locationsWithStock = [...new Set(matchingItems.map(item => item.location))];
        if (locationsWithStock.includes('Genk')) {
            console.log(`Productielocatie voor ${caseType} afgeleid: Genk (heeft stock in Genk)`);
            return 'Genk';
        } else if (locationsWithStock.includes('Wilrijk')) {
            console.log(`Productielocatie voor ${caseType} afgeleid: Wilrijk (heeft stock in Wilrijk)`);
            return 'Wilrijk';
        }
        
        console.log(`Geen productielocatie gevonden voor kisttype ${caseType} in stock_oilfree tabel`);
        return null;
    }

    // Functie om de geselecteerde productielocatie bij te houden
    function updateSelectedProductionLocation(caseType, location) {
        if (!selectedProductionLocations) {
            selectedProductionLocations = {};
        }
        
        // Sla de selectie op voor dit kisttype
        selectedProductionLocations[caseType] = location;
        console.log(`Productielocatie voor ${caseType} bijgewerkt naar: ${location}`);
    }

    /**
     * Leest en toont Forecast CSV onder Forecast-tab (zonder header)
     */
    function previewForecastCSV() {
        const fileInput = document.getElementById('forecast-file');
        const tbody = document.getElementById('forecast-tbody');
        if (!fileInput || !tbody) {
            showNotification('Forecast-componenten niet gevonden','error');
            return;
        }
        const file = fileInput.files[0];
        if (!file) {
            showNotification('Geen CSV Forecast bestand geselecteerd','warning');
            return;
        }
        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target.result || '';
            // Haal bestaande forecast uit DB voor prevDate vergelijking
            let existingMap = new Map();
            try {
                const resp = await fetch('/api/forecast');
                if (resp.ok) {
                    const existing = await resp.json();
                    existingMap = new Map(existing.map(f => [f.caseLabel, f.date || f.importDate]));
                }
            } catch (err) {
                console.error('Kon bestaande forecast entries niet ophalen:', err);
            }
            const lines = text.split(/\r?\n/).filter(line => line.trim());
            if (lines.length === 0) {
                showNotification('Geen data in CSV','warning');
                // return;
            }
            
            // Detecteer CSV formaat op basis van eerste regel
            const firstLine = lines[0];
            const firstCols = firstLine.split(';').map(v => v.trim().replace(/"/g, ''));
            let csvFormat = 'unknown';
            
            // Detecteer formaat 1: _FORESCO.CSV_ (datum in kolom 0, caseLabel in kolom 4, caseType in kolom 5)
            if (firstCols.length >= 6 && /^[0-9]{8}$/.test(firstCols[0])) {
                csvFormat = 'foresco';
                console.log('Gedetecteerd CSV formaat: FORESCO (datum;...;...;...;caseLabel;caseType;...)');
            }
            // Detecteer formaat 2: _FOR1953.CSV_ (header regel of datum in kolom A, caseNumber in kolom B, caseType in kolom C)
            else if (firstCols.length >= 4) {
                // Check of eerste regel een header is
                if (firstCols[0].toLowerCase().includes('date') || firstCols[0].toLowerCase().includes('sched')) {
                    csvFormat = 'for1953_header';
                    console.log('Gedetecteerd CSV formaat: FOR1953 met header');
                } else if (/^[0-9]{8}$/.test(firstCols[0])) {
                    csvFormat = 'for1953';
                    console.log('Gedetecteerd CSV formaat: FOR1953 zonder header');
                }
            }
            
            if (csvFormat === 'unknown') {
                showNotification('Onbekend CSV formaat. Controleer de bestandsstructuur.','error');
                // return;
            }
            
            tbody.innerHTML = '';
            const forecastObjects = [];
            
            // Start vanaf regel 1 als er een header is, anders vanaf regel 0
            const startIndex = csvFormat === 'for1953_header' ? 1 : 0;
            
            for (let i = startIndex; i < lines.length; i++) {
                const line = lines[i];
                const cols = line.split(';').map(v => v.trim().replace(/"/g, ''));
                
                let date, caseLabel, caseType;
                
                if (csvFormat === 'foresco') {
                    // Origineel FORESCO formaat
                    if (cols.length < 6) continue;
                    const raw = cols[0]; 
                    if (!/^[0-9]{8}$/.test(raw)) continue;
                    date = `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;
                    caseLabel = cols[4]; // CaseLabel staat in kolom 4
                    caseType = cols[5];  // CaseType staat in kolom 5 (V361, K152, etc.)
                } else if (csvFormat === 'for1953' || csvFormat === 'for1953_header') {
                    // Nieuw FOR1953 formaat
                    if (cols.length < 4) continue;
                    const raw = cols[0]; 
                    if (!/^[0-9]{8}$/.test(raw)) continue;
                    date = `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;
                    caseLabel = cols[1]; // Case Number staat in kolom B (1)
                    caseType = cols[2];  // Case Type staat in kolom C (2)
                }
                
                // Valideer dat we alle benodigde data hebben
                if (!date || !caseLabel || !caseType) continue;
                
                // Filter irrelevante case types (K006-K099 en V006-V099)
                if (!isRelevantCaseType(caseType)) {
                    console.log(`Case type ${caseType} overgeslagen: niet relevant voor forecast`);
                    continue;
                }
                
                const erpCodes = findERPCodesForCaseType(caseType, null, true); // true = isForForecastOrder
                const erpText = erpCodes.join(', ');
                const prevDate = existingMap.get(caseLabel) || null;
                forecastObjects.push({ date, caseLabel, caseType, erpCodes, prevDate });
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${date}</td>
                    <td>${caseLabel}</td>
                    <td>${caseType}</td>
                    <td>${erpText}</td>`;
                tbody.appendChild(row);
            }
            // Toon tabel en start import
            const container = document.getElementById('forecast-table-container');
            if (container) container.classList.remove('d-none');
            window._forecastObjects = forecastObjects;
            
            // Toon welk formaat is gedetecteerd
            let formatMessage = '';
            if (csvFormat === 'foresco') {
                formatMessage = 'FORESCO formaat gedetecteerd';
            } else if (csvFormat === 'for1953_header') {
                formatMessage = 'FOR1953 formaat met header gedetecteerd';
            } else if (csvFormat === 'for1953') {
                formatMessage = 'FOR1953 formaat gedetecteerd';
            }
            
            showNotification(`${formatMessage} - ${forecastObjects.length} items ingelezen, opslaan in database...`,'info');
            try {
                await importForecast();
            } catch (err) {
                console.error('ImportForecast faalde:', err);
            }
        };
        reader.readAsText(file);
    }

    /**
     * Stuurt de ingelezen forecast naar de server
     */
    async function importForecast() {
        const forecasts = window._forecastObjects || [];
        if (forecasts.length === 0) {
            showNotification('Geen forecast data om op te slaan', 'warning');
            return;
        }
        try {
            // Zorg dat de tabel bestaat
            await fetch('/api/setup-forecast-table');

            // Haal bestaande forecasts inclusief historie
            const resp = await fetch('/api/forecast');
            const existing = await resp.json();
            
            // Haal lokale historie op (fallback voor server-side problemen)
            const localHistory = getLocalStorage('forecast_history', {});
            
            // Maak een map van bestaande entries voor snelle lookup
            const existingMap = new Map();
            existing.forEach(f => {
                // Combineer database historie met lokale historie
                const dbHistory = Array.isArray(f.history) ? f.history : (f.history ? [f.history] : []);
                const localHist = localHistory[f.caseLabel] || [];
                const combinedHistory = [...new Set([...dbHistory, ...localHist])].sort();
                
                f.history = combinedHistory;
                existingMap.set(f.caseLabel, f);
            });
            
            // Splits nieuwe en bestaande entries
            const newForecasts = [];
            const updatedForecasts = [];
            
            forecasts.forEach(f => {
                if (existingMap.has(f.caseLabel)) {
                    // Bestaande entry - check of datum al in historie staat
                    const existingEntry = existingMap.get(f.caseLabel);
                    const existingHistory = existingEntry.history || [];
                    
                    console.log(`[DEBUG] Bestaande entry ${f.caseLabel}: huidige historie =`, existingHistory, ', nieuwe datum =', f.date);
                    
                    // Voeg nieuwe datum toe aan historie als deze nog niet bestaat
                    if (!existingHistory.includes(f.date)) {
                        const updatedHistory = [...existingHistory, f.date].sort();
                        console.log(`[DEBUG] Nieuwe datum toegevoegd voor ${f.caseLabel}: ${existingHistory} -> ${updatedHistory}`);
                        
                        // Sla lokale historie op
                        localHistory[f.caseLabel] = updatedHistory;
                        saveLocalStorage('forecast_history', localHistory);
                        
                        updatedForecasts.push({
                            caseLabel: f.caseLabel,
                            caseType: f.caseType,
                            date: f.date, // Meest recente datum
                            history: updatedHistory,
                            originalDate: existingHistory[0] // Bewaar oorspronkelijke datum
                        });
                    } else {
                        console.log(`[DEBUG] Datum ${f.date} bestaat al voor ${f.caseLabel}, geen update nodig`);
                    }
                } else {
                    // Nieuwe entry
                    console.log(`[DEBUG] Nieuwe entry ${f.caseLabel} met datum ${f.date}`);
                    
                    // Sla lokale historie op voor nieuwe entries
                    localHistory[f.caseLabel] = [f.date];
                    saveLocalStorage('forecast_history', localHistory);
                    
                    newForecasts.push({
                        ...f,
                        history: [f.date], // Start historie met huidige datum
                        originalDate: f.date // Eerste import is oorspronkelijke datum
                    });
                }
            });
            
            let totalProcessed = 0;
            let messages = [];
            
            // Sla nieuwe entries op
            if (newForecasts.length > 0) {
                const saveResp = await fetch('/api/forecast/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ forecasts: newForecasts })
                });
                const result = await saveResp.json();
                if (result.success) {
                    totalProcessed += result.inserted;
                    messages.push(`${result.inserted} nieuwe entries`);
                } else {
                    throw new Error(`Fout bij opslaan nieuwe entries: ${result.error}`);
                }
            }
            
            // Update bestaande entries met nieuwe datums
            if (updatedForecasts.length > 0) {
                try {
                    // Probeer eerst de nieuwe update-history endpoint
                    const updateResp = await fetch('/api/forecast/update-history', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ forecasts: updatedForecasts })
                    });
                    
                    if (updateResp.ok) {
                        const result = await updateResp.json();
                        if (result.success) {
                            totalProcessed += result.updated;
                            messages.push(`${result.updated} entries bijgewerkt met nieuwe datums`);
                        } else {
                            throw new Error(`Fout bij updaten historie: ${result.error}`);
                        }
                    } else {
                        throw new Error(`HTTP ${updateResp.status}`);
                    }
                } catch (updateError) {
                    console.warn('Update-history endpoint niet beschikbaar, gebruik fallback:', updateError);
                    
                    // Fallback: gebruik de gewone import endpoint voor updates
                    const fallbackResp = await fetch('/api/forecast/import', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            forecasts: updatedForecasts,
                            updateExisting: true // Flag voor server om updates toe te staan
                        })
                    });
                    
                    if (fallbackResp.ok) {
                        const result = await fallbackResp.json();
                        totalProcessed += result.inserted || updatedForecasts.length;
                        messages.push(`${result.inserted || updatedForecasts.length} entries bijgewerkt via fallback`);
                    } else {
                        throw new Error(`Fallback update mislukt: HTTP ${fallbackResp.status}`);
                    }
                }
            }
            
            if (totalProcessed === 0) {
                showNotification('Geen nieuwe data om op te slaan - alle datums bestaan al','info');
            } else {
                showNotification(`Forecast succesvol verwerkt: ${messages.join(', ')}`,'success');
            }
            
            document.getElementById('save-forecast-button').classList.add('d-none');
            // Vernieuw tabel direct met opgeslagen entries
            loadForecastEntries();
            
        } catch (e) {
            showNotification('Fout bij opslaan forecast: '+e.message,'error');
        }
    }

    /**
     * Laad alle forecast entries uit database en toon in tabel
     */
    async function loadForecastEntries() {
        try {
            const response = await fetch('/api/forecast');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            // Haal lokale historie op
            const localHistory = getLocalStorage('forecast_history', {});
            
            // Map forecast entries met historie uit de API
            console.log('[DEBUG] Ruwe data uit database:', data.slice(0, 3)); // Toon eerste 3 entries
            console.log('[DEBUG] Lokale historie:', localHistory);
            
            window._forecastObjects = data.map(entry => {
                // Huidige datum uit CSV (entry.date) - altijd datum formaat
                let date = entry.date;
                if (!date && entry.importDate) {
                    date = new Date(entry.importDate).toISOString().split('T')[0];
                }
                // Zorg ervoor dat datum altijd in YYYY-MM-DD formaat is
                if (date && date.includes('T')) {
                    date = date.split('T')[0];
                }
                const caseType = entry.caseType || '';
                const erpCodes = findERPCodesForCaseType(caseType, null, true); // true = isForForecastOrder
                
                // Combineer database historie met lokale historie
                const dbHistory = Array.isArray(entry.history) ? entry.history : (entry.history ? [entry.history] : []);
                const localHist = localHistory[entry.caseLabel] || [];
                const combinedHistory = [...new Set([...dbHistory, ...localHist])].sort();
                
                // Gebruik gecombineerde historie, of fallback naar huidige datum
                const history = combinedHistory.length > 0 ? combinedHistory : [date];
                
                // Haal oorspronkelijke datum op uit database kolom (betrouwbaar!)
                let originalDate = entry.originalDate;
                // Zorg ervoor dat originalDate ook in YYYY-MM-DD formaat is
                if (originalDate && originalDate.includes('T')) {
                    originalDate = originalDate.split('T')[0];
                }
                
                console.log(`[DEBUG] Entry ${entry.caseLabel}: date=${date}, dbHistory=`, dbHistory, ', localHist=', localHist, ', combined=', history, ', originalDate=', originalDate);
                
                return { date: date || '', caseLabel: entry.caseLabel || '', caseType, erpCodes, history, originalDate };
            });
            // Verwijder dubbele caseLabels (bewaar eerste voorkomen)
            const uniqueMap = new Map();
            window._forecastObjects.forEach(obj => {
                if (!uniqueMap.has(obj.caseLabel)) {
                    uniqueMap.set(obj.caseLabel, obj);
                }
            });
            window._forecastObjects = Array.from(uniqueMap.values());
            // Toon forecasts in tabel
            displayForecastEntries();
            // Hide save button
            document.getElementById('save-forecast-button').classList.add('d-none');
        } catch (error) {
            console.error('Fout bij laden forecast entries:', error);
            showNotification('Fout bij laden opgeslagen forecast', 'error');
        }
    }

    // Bind loadForecastEntries aan tab
    const forecastTabBtn = document.getElementById('forecast-tab');
    if (forecastTabBtn) {
        forecastTabBtn.addEventListener('click', loadForecastEntries);
    }

    // Bind filters en bestel-knop
    document.getElementById('forecast-filter-button').addEventListener('click', displayForecastEntries);
    document.getElementById('order-forecast-button').addEventListener('click', createOrdersFromForecast);

    /**
     * Toon gefilterde forecast entries in de tabel
     */
    function displayForecastEntries() {
        const entries = window._forecastObjects || [];
        
        // Vul filters eenmalig met alle unieke waarden
        populateForecastFilters(entries);
        
        // Filter en toon entries
        filterForecastEntries();
    }

    /**
     * Vul de forecast filters met unieke waarden
     */
    function populateForecastFilters(entries) {
        // Vul caseType-filter
        const typeFilter = document.getElementById('forecast-type-filter');
        const currentTypeValues = Array.from(typeFilter.selectedOptions).map(o => o.value);
        typeFilter.innerHTML = '<option value="">Alle types</option>';
        
        const uniqueTypes = [...new Set(entries.map(e => e.caseType))]
            .filter(type => isRelevantCaseType(type)) // Filter irrelevante types
            .sort();
        uniqueTypes.forEach(type => {
            const opt = document.createElement('option');
            opt.value = type;
            opt.textContent = type;
            if (currentTypeValues.includes(type)) {
                opt.selected = true;
            }
            typeFilter.appendChild(opt);
        });

        // Vul ERP-filter
        const erpFilter = document.getElementById('forecast-erp-filter');
        const currentErpValue = erpFilter.value;
        erpFilter.innerHTML = '<option value="">Alle ERP codes</option>';
        
        const uniqueErpCodes = new Set();
        entries.forEach(e => {
            // Alleen ERP codes van relevante case types
            if (isRelevantCaseType(e.caseType) && Array.isArray(e.erpCodes)) {
                e.erpCodes.forEach(code => uniqueErpCodes.add(code));
            }
        });
        
        [...uniqueErpCodes].sort().forEach(code => {
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = code;
            if (currentErpValue === code) {
                opt.selected = true;
            }
            erpFilter.appendChild(opt);
        });
    }

    /**
     * Filter forecast entries op basis van alle criteria
     */
    function filterForecastEntries() {
        const entries = window._forecastObjects || [];
        if (entries.length === 0) {
            document.getElementById('forecast-results-info').textContent = 'Geen forecast data beschikbaar';
            document.getElementById('forecast-total-count').textContent = 'Totaal: 0 items';
            document.getElementById('forecast-table-container').classList.add('d-none');
            document.getElementById('order-forecast-button').classList.add('d-none');
            return;
        }

        // Haal filterwaarden op
        const searchTerm = document.getElementById('forecast-search-box').value.toLowerCase().trim();
        const startDate = document.getElementById('forecast-start-date').value;
        const endDate = document.getElementById('forecast-end-date').value;
        const typeSelect = document.getElementById('forecast-type-filter');
        const selectedTypes = Array.from(typeSelect.selectedOptions).map(o => o.value).filter(v => v);
        const selectedErpCode = document.getElementById('forecast-erp-filter').value;

        // Filter entries
        const filtered = entries.filter(e => {
            // Filter irrelevante case types eerst
            if (!isRelevantCaseType(e.caseType)) return false;
            
            // Zoekterm filter
            if (searchTerm) {
                const matchesSearch = 
                    (e.caseLabel && e.caseLabel.toLowerCase().includes(searchTerm)) ||
                    (e.caseType && e.caseType.toLowerCase().includes(searchTerm)) ||
                    (Array.isArray(e.erpCodes) && e.erpCodes.some(code => code.toLowerCase().includes(searchTerm)));
                
                if (!matchesSearch) return false;
            }

            // Datum filter
            if (startDate && e.date < startDate) return false;
            if (endDate && e.date > endDate) return false;

            // Type filter
            if (selectedTypes.length > 0 && !selectedTypes.includes(e.caseType)) return false;

            // ERP code filter
            if (selectedErpCode && (!Array.isArray(e.erpCodes) || !e.erpCodes.includes(selectedErpCode))) return false;

            return true;
        });

        // Toon gefilterde resultaten
        displayFilteredForecastEntries(filtered);

        // Update info
        const totalEntries = entries.length;
        const filteredCount = filtered.length;
        document.getElementById('forecast-results-info').textContent = 
            filteredCount === totalEntries ? 
            `Alle ${totalEntries} items getoond` : 
            `${filteredCount} van ${totalEntries} items getoond`;
        document.getElementById('forecast-total-count').textContent = `Totaal: ${filteredCount} items`;

        // Toon/verberg tabel en bestel-knop
        document.getElementById('forecast-table-container').classList.toggle('d-none', filteredCount === 0);
        document.getElementById('order-forecast-button').classList.toggle('d-none', filteredCount === 0);
    }

    /**
     * Toon gefilterde forecast entries in de tabel
     */
    function displayFilteredForecastEntries(filtered) {
        const tbody = document.getElementById('forecast-tbody');
        tbody.innerHTML = '';

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Geen resultaten gevonden</td></tr>';
            return;
        }

        // Voeg rijen toe
        filtered.forEach(e => {
            // Toon ERP codes voor elke regel
            const erpText = Array.isArray(e.erpCodes) && e.erpCodes.length ? 
                e.erpCodes.join(', ') : 
                'Geen ERP codes gevonden';

            // Bereken verschuivings-indicator op basis van oorspronkelijke datum uit database
            const history = Array.isArray(e.history) && e.history.length > 0 ? e.history : [e.date];
            let originalDate = e.originalDate;
            // Zorg ervoor dat originalDate in YYYY-MM-DD formaat is
            if (originalDate && originalDate.includes('T')) {
                originalDate = originalDate.split('T')[0];
            }
            let verschuivingIndicator = '';
            let rowClass = '';
            
            if (history.length > 1) {
                if (originalDate) {
                    const origDate = new Date(originalDate);
                    const currentDate = new Date(e.date);
                    const totalDiff = Math.round((currentDate - origDate) / (1000 * 60 * 60 * 24));
                    
                    if (totalDiff > 0) {
                        verschuivingIndicator = `<span class="badge bg-danger" title="Vertraagd met ${totalDiff} dagen t.o.v. oorspronkelijke datum ${originalDate}">+${totalDiff}d</span>`;
                        rowClass = 'table-warning';
                    } else if (totalDiff < 0) {
                        verschuivingIndicator = `<span class="badge bg-success" title="Vervroegd met ${Math.abs(totalDiff)} dagen t.o.v. oorspronkelijke datum ${originalDate}">${totalDiff}d</span>`;
                        rowClass = 'table-info';
                    } else {
                        verschuivingIndicator = `<span class="badge bg-secondary" title="Datum gewijzigd maar geen netto verschuiving t.o.v. oorspronkelijke datum ${originalDate}">±0d</span>`;
                        rowClass = 'table-light';
                    }
                } else {
                    verschuivingIndicator = `<span class="badge bg-warning" title="Oorspronkelijke datum onbekend - klik voor details">?</span>`;
                    rowClass = 'table-warning';
                }
                
                verschuivingIndicator += ` <small class="text-muted">(${history.length - 1}x)</small>`;
            } else {
                verschuivingIndicator = '<span class="text-muted">-</span>';
            }

            const row = document.createElement('tr');
            row.dataset.caseLabel = e.caseLabel;
            row.style.cursor = 'pointer';
            row.className = rowClass;
            row.innerHTML = `
                <td>${e.date}</td>
                <td>${e.caseLabel}</td>
                <td>${e.caseType}</td>
                <td>${erpText}</td>
                <td class="text-center">${verschuivingIndicator}</td>
            `;
            
            // Klik event voor details
            row.addEventListener('click', () => showForecastDetail(e.caseLabel));
            
            tbody.appendChild(row);
        });
    }

    /**
     * Wis zoekterm
     */
    function clearForecastSearch() {
        document.getElementById('forecast-search-box').value = '';
        filterForecastEntries();
    }

    /**
     * Wis alle filters
     */
    function clearForecastFilters() {
        document.getElementById('forecast-search-box').value = '';
        document.getElementById('forecast-start-date').value = '';
        document.getElementById('forecast-end-date').value = '';
        document.getElementById('forecast-type-filter').selectedIndex = -1;
        document.getElementById('forecast-erp-filter').selectedIndex = 0;
        filterForecastEntries();
    }

    /**
     * Wis lokale forecast historie (voor debugging)
     */
    function clearLocalForecastHistory() {
        if (confirm('Weet je zeker dat je alle lokale forecast historie wilt wissen?')) {
            localStorage.removeItem('forecast_history');
            showNotification('Lokale forecast historie gewist', 'info');
            loadForecastEntries(); // Herlaad data
        }
    }

    // Maak functie beschikbaar in console voor debugging
    window.clearLocalForecastHistory = clearLocalForecastHistory;

    /**
     * Stel oorspronkelijke datum handmatig in voor bestaande data
     */
    window.setOriginalDate = async function(caseLabel) {
        const selectedDate = document.getElementById('select-original-date').value;
        if (!selectedDate) {
            showNotification('Selecteer eerst een datum', 'error');
            return;
        }

        try {
            // Update via API (database)
            const response = await fetch('/api/forecast/set-original-date', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    caseLabel: caseLabel, 
                    originalDate: selectedDate 
                })
            });

            const result = await response.json();
            
            if (result.success) {
                // Update lokaal object
                const obj = window._forecastObjects.find(f => f.caseLabel === caseLabel);
                if (obj) {
                    obj.originalDate = selectedDate;
                }

                showNotification(result.message, 'success');
                
                // Sluit modal en herlaad data
                const modal = bootstrap.Modal.getInstance(document.getElementById('forecastDetailModal'));
                if (modal) modal.hide();
                
                loadForecastEntries(); // Herlaad om wijzigingen te tonen
            } else {
                throw new Error(result.error || 'Onbekende fout');
            }
        } catch (error) {
            console.error('Fout bij instellen oorspronkelijke datum:', error);
            showNotification('Fout bij instellen oorspronkelijke datum: ' + error.message, 'error');
        }
    }

    /**
     * Maak orders aan voor gefilterde forecast entries
     */
    async function createOrdersFromForecast() {
        const entries = window._forecastObjects || [];
        if (entries.length === 0) {
            showNotification('Geen forecast items om te bestellen','warning');
            return;
        }
        
        // Gebruik dezelfde filterlogica als de weergave
        const searchTerm = document.getElementById('forecast-search-box').value.toLowerCase().trim();
        const startDate = document.getElementById('forecast-start-date').value;
        const endDate = document.getElementById('forecast-end-date').value;
        const typeSelect = document.getElementById('forecast-type-filter');
        const selectedTypes = Array.from(typeSelect.selectedOptions).map(o => o.value).filter(v => v);
        const selectedErpCode = document.getElementById('forecast-erp-filter').value;

        // Filter entries met dezelfde logica als filterForecastEntries
        const filtered = entries.filter(e => {
            // Filter irrelevante case types eerst
            if (!isRelevantCaseType(e.caseType)) return false;
            
            // Zoekterm filter
            if (searchTerm) {
                const matchesSearch = 
                    (e.caseLabel && e.caseLabel.toLowerCase().includes(searchTerm)) ||
                    (e.caseType && e.caseType.toLowerCase().includes(searchTerm)) ||
                    (Array.isArray(e.erpCodes) && e.erpCodes.some(code => code.toLowerCase().includes(searchTerm)));
                
                if (!matchesSearch) return false;
            }

            // Datum filter
            if (startDate && e.date < startDate) return false;
            if (endDate && e.date > endDate) return false;

            // Type filter
            if (selectedTypes.length > 0 && !selectedTypes.includes(e.caseType)) return false;

            // ERP code filter
            if (selectedErpCode && (!Array.isArray(e.erpCodes) || !e.erpCodes.includes(selectedErpCode))) return false;

            return true;
        });
        
        if (filtered.length === 0) {
            showNotification('Geen forecast items binnen de geselecteerde filters','warning');
            return;
        }
        // Groepeer per locatie en caseType (converteer V naar K voor kistbestellingen)
        // V-codes = kist + zak: kist wordt besteld als K-type, zakken apart voorzien
        const ordersPerLocation = {};
        filtered.forEach(e => {
            // Converteer V-type naar K-type voor kistbestelling
            const orderCaseType = convertVTypeToKType(e.caseType);
            
            // Zoek productielocatie in stock_oilfree tabel op basis van production_location kolom
            const prodLoc = findPredefinedProductionLocation(orderCaseType) || 'Genk';
            console.log(`Forecast bestelling ${e.caseType} -> ${orderCaseType}: productielocatie = ${prodLoc}`);
            
            if (!ordersPerLocation[prodLoc]) {
                ordersPerLocation[prodLoc] = {};
            }
            if (!ordersPerLocation[prodLoc][orderCaseType]) {
                ordersPerLocation[prodLoc][orderCaseType] = {
                    quantity: 0,
                    cases: []
                };
            }
            
            ordersPerLocation[prodLoc][orderCaseType].quantity += 1;
            ordersPerLocation[prodLoc][orderCaseType].cases.push({
                caseLabel: e.caseLabel,
                originalCaseType: e.caseType,
                date: e.date
            });
            
            // Log voor duidelijkheid
            if (e.caseType !== orderCaseType) {
                console.log(`Forecast bestelling: ${e.caseType} -> ${orderCaseType} kist in ${prodLoc} (zak apart in Willebroek)`);
            }
        });
        
        // Maak bestellingen per locatie
        for (const [loc, typesData] of Object.entries(ordersPerLocation)) {
            const items = Object.entries(typesData).map(([caseType, data]) => ({
                caseType,
                quantity: data.quantity,
                cases: data.cases, // Voeg case informatie toe
                erpCodes: findERPCodesForCaseType(caseType, loc, true), // true = isForForecastOrder
                inStock: true // Altijd true voor forecast bestellingen
            }));
            
            // Genereer PDF voor deze forecast-bestelling
            generateForecastOrderPDF(loc, items);
            
            // Maak de bestelling aan in het systeem (zonder case details)
            const orderItems = items.map(item => ({
                caseType: item.caseType,
                quantity: item.quantity,
                erpCodes: item.erpCodes,
                inStock: item.inStock
            }));
            await createOrder(loc, orderItems);
        }
        showNotification('Bestellingen gestart voor forecast','success');
    }

    /**
     * Genereer PDF voor forecast-bestelling zonder database call
     */
    function generateForecastOrderPDF(location, orderItems) {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Titel en datum
            doc.setFontSize(18);
            doc.text(`Forecast Besteloverzicht - ${location}`, 20, 20);
            doc.setFontSize(12);
            doc.text(`Datum: ${new Date().toLocaleDateString('nl-BE')}`, 20, 30);
            const totalQty = orderItems.reduce((sum, i) => sum + (i.quantity||0), 0);
            doc.text(`Totaal kisten: ${totalQty}`, 20, 40);
            
            // Voeg uitleg toe over V/K codes en bestelling policy
            doc.setFontSize(10);
            doc.text('Opmerking: V-codes in forecast = K-kist + zak. Zakken worden apart voorzien in Willebroek.', 20, 50);
            doc.text('Alle items worden besteld ongeacht stock status.', 20, 58);
            doc.setFontSize(12);
            
            // Maak een rij voor elke case in plaats van groeperen per kisttype
            const pdfRows = [];
            orderItems.forEach(item => {
                if (item.cases && item.cases.length > 0) {
                    // Elke case krijgt een eigen rij
                    item.cases.forEach(caseInfo => {
                        pdfRows.push([
                            caseInfo.caseLabel,                                                    // Case
                            item.caseType,                                                         // Type Kist
                            item.erpCodes.length > 0 ? item.erpCodes.join(', ') : 'Geen',        // ERP Code
                            '1'                                                                     // Aantal (altijd 1 per case)
                        ]);
                    });
                } else {
                    // Fallback voor items zonder case details
                    pdfRows.push([
                        '-',                                                                       // Case
                        item.caseType,                                                            // Type Kist
                        item.erpCodes.length > 0 ? item.erpCodes.join(', ') : 'Geen',           // ERP Code
                        item.quantity.toString()                                                  // Aantal
                    ]);
                }
            });
            
            // Tabel met alleen de gevraagde kolommen: Case, Type Kist, ERP Code, Aantal
            doc.autoTable({
                startY: 68,
                head: [['Case', 'Type Kist', 'ERP Code', 'Aantal']],
                body: pdfRows,
                styles: { fontSize: 9, cellPadding: 3 },
                headStyles: { fillColor: [41,128,185], textColor: 255 }
            });
            
            // Sla op
            const now = new Date();
            const fDate = now.toISOString().split('T')[0];
            doc.save(`Forecast_Bestelling_${location}_${fDate}.pdf`);
            
        } catch (e) {
            console.error('Fout bij genereren forecast PDF:', e);
            showNotification('Fout bij genereren van PDF','error');
        }
    }

    /**
     * Toont detail modal voor een forecast entry
     */
    function showForecastDetail(caseLabel) {
        const obj = (window._forecastObjects || []).find(o => o.caseLabel === caseLabel);
        if (!obj) return;
        let modal = document.getElementById('forecastDetailModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'forecastDetailModal';
            modal.className = 'modal fade';
            modal.tabIndex = -1;
            modal.innerHTML = `
                <div class="modal-dialog modal-lg">
                  <div class="modal-content">
                    <div class="modal-header">
                      <h5 class="modal-title">Forecast Detail: ${caseLabel}</h5>
                      <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body" id="forecastDetailBody"></div>
                    <div class="modal-footer">
                      <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Sluiten</button>
                    </div>
                  </div>
                </div>`;
            document.body.appendChild(modal);
        }
        
        const body = modal.querySelector('#forecastDetailBody');
        
        // Bereid datum historie voor
        const history = Array.isArray(obj.history) && obj.history.length > 0 ? obj.history : [obj.date];
        const sortedHistory = [...history].sort();
        
        console.log(`[DEBUG] showForecastDetail voor ${caseLabel}:`, {
            obj: obj,
            history: history,
            sortedHistory: sortedHistory,
            historyLength: history.length,
            historyType: typeof obj.history,
            rawHistory: obj.history
        });
        
        // Gebruik oorspronkelijke datum uit database kolom (betrouwbaar!)
        let originalDate = obj.originalDate;
        // Zorg ervoor dat originalDate in YYYY-MM-DD formaat is
        if (originalDate && originalDate.includes('T')) {
            originalDate = originalDate.split('T')[0];
        }
        
        // Bereken verschuivingen op basis van import volgorde, niet chronologische volgorde
        let historyHtml = '';
        if (history.length > 1) {
            historyHtml = '<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Datum</th><th>Status</th><th>Verschuiving</th></tr></thead><tbody>';
            
            // Toon historie in import volgorde (niet gesorteerd)
            history.forEach((date, index) => {
                let status = '';
                let verschuiving = '';
                let rowClass = '';
                
                if (originalDate && date === originalDate) {
                    status = 'Oorspronkelijke datum';
                    rowClass = 'table-info';
                } else if (date === obj.date) {
                    status = 'Huidige datum';
                    rowClass = 'table-success';
                } else {
                    status = 'Tussentijdse wijziging';
                    rowClass = 'table-warning';
                }
                
                if (originalDate && date !== originalDate) {
                    const origDate = new Date(originalDate);
                    const currentDate = new Date(date);
                    const diffDays = Math.round((currentDate - origDate) / (1000 * 60 * 60 * 24));
                    
                    if (diffDays > 0) {
                        verschuiving = `+${diffDays} dagen later`;
                    } else if (diffDays < 0) {
                        verschuiving = `${diffDays} dagen eerder`;
                    } else {
                        verschuiving = 'Geen verschuiving';
                    }
                }
                
                historyHtml += `<tr class="${rowClass}"><td>${date}</td><td>${status}</td><td>${verschuiving}</td></tr>`;
            });
            
            historyHtml += '</tbody></table></div>';
            
            // Totale verschuiving berekenen t.o.v. oorspronkelijke datum
            if (history.length > 1 && originalDate) {
                const origDate = new Date(originalDate);
                const lastDate = new Date(obj.date);
                const totalDiff = Math.round((lastDate - origDate) / (1000 * 60 * 60 * 24));
                
                let totalVerschuivingClass = '';
                let totalVerschuivingText = '';
                
                if (totalDiff > 0) {
                    totalVerschuivingClass = 'text-danger';
                    totalVerschuivingText = `${totalDiff} dagen vertraagd`;
                } else if (totalDiff < 0) {
                    totalVerschuivingClass = 'text-success';
                    totalVerschuivingText = `${Math.abs(totalDiff)} dagen vervroegd`;
                } else {
                    totalVerschuivingClass = 'text-muted';
                    totalVerschuivingText = 'Geen netto verschuiving';
                }
                
                historyHtml += `<div class="alert alert-light mt-3"><strong>Totale verschuiving t.o.v. oorspronkelijke datum (${originalDate}):</strong> <span class="${totalVerschuivingClass}">${totalVerschuivingText}</span></div>`;
            }
        } else {
            if (originalDate) {
                historyHtml = `<p class="text-muted">Nog geen datum wijzigingen gedetecteerd.</p><ul class="list-unstyled"><li><span class="badge bg-primary">${originalDate}</span> Oorspronkelijke datum</li></ul>`;
            } else {
                historyHtml = `<p class="text-muted">Nog geen datum wijzigingen gedetecteerd.</p><ul class="list-unstyled"><li><span class="badge bg-primary">${obj.date}</span> Huidige datum</li></ul>`;
            }
        }
        
        // Voeg knop toe om oorspronkelijke datum handmatig in te stellen voor bestaande data
        if (!originalDate && history.length > 1) {
            historyHtml += `
                <div class="alert alert-warning mt-3">
                    <strong>Let op:</strong> Voor deze entry is geen oorspronkelijke datum opgeslagen. 
                    <br>Selecteer hieronder de echte oorspronkelijke datum uit de historie:
                    <div class="mt-2">
                        <select id="select-original-date" class="form-select form-select-sm">
                            ${history.map(date => `<option value="${date}">${date}</option>`).join('')}
                        </select>
                        <button class="btn btn-sm btn-primary mt-2" onclick="setOriginalDate('${obj.caseLabel}')">
                            Oorspronkelijke datum instellen
                        </button>
                    </div>
                </div>
            `;
        }
        
        // ERP codes info
        const erpCodesHtml = Array.isArray(obj.erpCodes) && obj.erpCodes.length > 0 ? 
            obj.erpCodes.map(code => `<span class="badge bg-secondary me-1">${code}</span>`).join('') : 
            '<span class="text-muted">Geen ERP codes gevonden</span>';
        
        body.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h6>Basis Informatie</h6>
                    <p><strong>CaseLabel:</strong> <code>${obj.caseLabel}</code></p>
                    <p><strong>CaseType:</strong> <code>${obj.caseType}</code></p>
                    <p><strong>ERP Codes:</strong><br>${erpCodesHtml}</p>
                </div>
                <div class="col-md-6">
                    <h6>Huidige Status</h6>
                    <p><strong>Huidige Datum:</strong> <span class="badge bg-success">${obj.date}</span></p>
                    <p><strong>Aantal Wijzigingen:</strong> ${sortedHistory.length - 1}</p>
                </div>
            </div>
            <hr>
            <h6>Datum Historie & Verschuivingen</h6>
            ${historyHtml}
        `;
        
        new bootstrap.Modal(modal).show();
    }

    // Excel preview knop handler
    document.getElementById('excel-preview-button').addEventListener('click', function() {
        if (!excelFile) {
            showNotification('Geen Excel bestand geselecteerd', 'warning');
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            excelData = [];
            const previewBody = document.getElementById('excel-preview-body');
            previewBody.innerHTML = '';
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const erp = row[0];
                const qty = row[2];
                if (!erp) continue;
                const qtyNum = Number(qty) || 0;
                excelData.push({ erp, qty: qtyNum });
                if (i <= 5) {
                    const tr = document.createElement('tr');
                    const td1 = document.createElement('td'); td1.textContent = erp; tr.appendChild(td1);
                    const td2 = document.createElement('td'); td2.textContent = qtyNum; tr.appendChild(td2);
                    previewBody.appendChild(tr);
                }
            }
            document.getElementById('excel-preview').classList.remove('d-none');
            document.getElementById('excel-import-button').disabled = false;
        };
        reader.readAsArrayBuffer(excelFile);
    });

    // Excel import knop handler
    document.getElementById('excel-import-button').addEventListener('click', async function() {
        const location = document.getElementById('excel-location').value;
        if (!location) {
            showNotification('Kies een locatie', 'warning');
            return;
        }
        if (!excelData || excelData.length === 0) {
            showNotification('Geen gegevens om te importeren', 'warning');
            return;
        }
        excelImportModal.hide();
        showLoading('Excel importeren...');
        for (const item of excelData) {
            await updateStockItem(location, item.erp, { quantity: item.qty });
        }
        hideLoading();
        showNotification('Excel import voltooid', 'success');
    });

    /**
     * Verwerkt de klik op de 'Aan Bestelling Toevoegen' knop.
     */
    async function handleAddToOrderClick(event) {
        const button = event.target.closest('.add-to-order-btn'); // Gebruik event.target.closest()
        if (!button) {
            console.error('[handleAddToOrderClick] Kon de .add-to-order-btn niet vinden via event.target.closest()');
            showNotification('Fout bij het verwerken van de klik: knop niet gevonden.', 'error');
            return;
        }

        const caseId = button.getAttribute('data-id');
        const pilsCaseLabel = button.getAttribute('data-caselabel');
        const caseType = button.getAttribute('data-casetype');

        const caseItem = casesData.find(c => c.id == caseId);
        if (!caseItem) {
            showNotification('Kist niet gevonden in lokale data.', 'error');
            return;
        }

        const row = button.closest('tr');
        if (row && (row.classList.contains('table-success') || row.classList.contains('table-warning'))) {
            let message = 'Deze kist is al op voorraad in Willebroek.';
            if (row.classList.contains('table-warning')) {
                message = 'Deze kist is al opgenomen in een openstaande bestelling.';
            }
            showNotification(message, 'info');
            return;
        }

        showLoading(`Kist ${pilsCaseLabel} verwerken voor bestelling...`);

        const orderLocation = 'Willebroek'; 
        const erpCodes = findERPCodesForCaseType(caseType, orderLocation);

        const newOrderItem = {
            pilsCaseLabel: pilsCaseLabel,
            caseType: caseType,
            quantity: 1,
            erpCodes: erpCodes,
            deliveredQuantity: 0,
            status: 'pending'
        };

        try {
            // Zoek een bestaande open bestelling voor vandaag en locatie
            const todayString = new Date().toDateString();
            let existingOrder = null;
            if (Array.isArray(ordersData)) {
                existingOrder = ordersData.find(order => 
                    order.location === orderLocation && 
                    (order.status === 'open' || order.status === 'partial') &&
                    new Date(order.date).toDateString() === todayString
                );
            }

            if (existingOrder) {
                // Voeg item toe aan bestaande bestelling
                // Eerst controleren of dit pilsCaseLabel al in de bestelling zit
                const itemAlreadyExists = existingOrder.items.some(item => item.pilsCaseLabel === newOrderItem.pilsCaseLabel);
                if (itemAlreadyExists) {
                    showNotification(`Kist ${pilsCaseLabel} staat al in bestelling ${existingOrder.id}.`, 'info');
                    // hideLoading();
                    // return;
                }

                existingOrder.items.push(newOrderItem);
                // Update de status van de bestelling (kan naar 'open' of 'partial' gaan)
                updateOrderStatusLocal(existingOrder); // Lokale update van de order status

                const updatedOrder = await updateOrderViaAPI(existingOrder);
                showNotification(`Kist ${pilsCaseLabel} toegevoegd aan bestaande bestelling ${updatedOrder.id}.`, 'success');
            } else {
                // Maak nieuwe bestelling aan
                const orderId = await createOrder(orderLocation, [newOrderItem]);
                if (orderId) {
                    showNotification(`Kist ${pilsCaseLabel} succesvol toegevoegd aan nieuwe bestelling ${orderId}.`, 'success');
                }
            }
            // Herlaad orders en refresh de kisten tabel
            await loadOrders();
            filterCases(); 
        } catch (error) {
            console.error('Fout bij verwerken bestelling kist:', error);
            showNotification(`Fout bij bestellen ${pilsCaseLabel}: ${error.message}`, 'error');
        } finally {
            hideLoading();
        }
    }

    // Hulpfunctie om order status lokaal bij te werken (vergelijkbaar met updateOrderStatus maar voor een specifiek order object)
    function updateOrderStatusLocal(order) {
        if (!order || !order.items) return;

        const totalItems = order.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
        const deliveredItems = order.items.reduce((sum, item) => sum + (item.deliveredQuantity || 0), 0);

        if (order.status === 'completed' || order.status === 'canceled') {
            return; // Status niet wijzigen als al voltooid of geannuleerd
        }

        if (deliveredItems === 0 && totalItems > 0) {
            order.status = 'open';
        } else if (deliveredItems < totalItems && totalItems > 0) {
            order.status = 'partial';
        } else if (deliveredItems === totalItems && totalItems > 0) {
            order.status = 'completed';
        }
        // Als totalItems 0 is, blijft de status zoals die was (bv. 'open' als het een lege nieuwe bestelling was)
    }

    /**
     * Toon modal om een nieuwe kist toe te voegen
     */
    function showAddCaseModal() {
        document.getElementById('case-modal-title').textContent = 'Nieuwe Kist';
        document.getElementById('case-id').value = '';
        document.getElementById('case-form').reset();
        
        // Vul locatie dropdown dynamisch
        updateLocationDropdown();
        
        caseModal.show();
    }

    // Event listener voor de 'cases-table-body' voor gedelegeerde events
    const casesTableBody = document.getElementById('cases-table-body');
    if (casesTableBody) {
        casesTableBody.addEventListener('click', function(event) {
            const target = event.target;
            // Gebruik .closest() om te checken of een knop (of een icoon binnen de knop) geklikt is
            const editButton = target.closest('.edit-case-btn');
            const deleteButton = target.closest('.delete-case-btn');
            const markPackedButton = target.closest('.mark-packed-btn');
            const addToOrderButton = target.closest('.add-to-order-btn');
            const viewPhotosButton = target.closest('.view-case-photos-btn');

            if (editButton) {
                const id = editButton.getAttribute('data-id');
                showEditCaseModal(id);
            } else if (deleteButton) {
                const id = deleteButton.getAttribute('data-id');
                confirmDeleteCase(id);
            } else if (markPackedButton) {
                const id = markPackedButton.getAttribute('data-id');
                markCaseAsPacked(id);
            } else if (addToOrderButton) {
                // handleAddToOrderClick verwacht het event object en haalt zelf de data-attributen op
                handleAddToOrderClick(event);
            } else if (viewPhotosButton) {
                const id = viewPhotosButton.getAttribute('data-id');
                showCasePhotos(id);
            }
        });
    }

    // Event listener voor de 'packed-table-body' voor gedelegeerde events
    const packedCasesTableBody = document.getElementById('packed-table-body');
    if (packedCasesTableBody) {
        packedCasesTableBody.addEventListener('click', function(event) {
            const target = event.target;
            const editButton = target.closest('.edit-packed-case-btn');
            const unpackButton = target.closest('.unpack-case-btn');
            const viewPhotosButton = target.closest('.view-photos-btn'); // Gecorrigeerde class selector

            if (editButton) {
                const id = editButton.getAttribute('data-id');
                showEditCaseModal(id);
            } else if (unpackButton) {
                const id = unpackButton.getAttribute('data-id');
                unpackCase(id);
            } else if (viewPhotosButton) {
                const id = viewPhotosButton.getAttribute('data-id');
                showCasePhotos(id);
            }
        });
    }

    // ... existing code ...
    // Event listener voor gedelegeerde events op de hoofdtabel met bestellingen
    const orderTableBody = document.getElementById('order-table-body');
    if (orderTableBody) {
        console.log('[DEBUG] Event listener voor orderTableBody wordt toegevoegd.'); // DEBUG TOEGEVOEGD
        orderTableBody.addEventListener('click', function(event) {
            console.log('[DEBUG] Klik gedetecteerd op orderTableBody. Target:', event.target); // DEBUG TOEGEVOEGD
            const target = event.target;
            const viewButton = target.closest('.view-order-btn');
            console.log('[DEBUG] Gevonden viewButton via target.closest():', viewButton); // DEBUG TOEGEVOEGD
            if (viewButton) {
                const orderId = viewButton.getAttribute('data-id');
                console.log('[DEBUG] orderId uit viewButton:', orderId); // DEBUG TOEGEVOEGD
                if (orderId) {
                    viewOrderDetails(orderId);
                } else {
                    console.warn('[DEBUG] orderId is leeg of null uit viewButton.'); // DEBUG TOEGEVOEGD
                }
            } else {
                console.log('[DEBUG] Geen .view-order-btn gevonden via target.closest(). Event target was:', event.target); // DEBUG TOEGEVOEGD
            }
        });
    } else {
        console.warn('[DEBUG] Element met id="order-table-body" NIET gevonden bij toevoegen listener.'); // DEBUG TOEGEVOEGD
    }

    // Functie om bestellingen te laden
    async function loadOrders() {
        showLoading('Bestellingen laden...');
        
        try {
            // Haal bestellingen op via API
            const response = await fetch('/api/oilfree/orders');
            
            if (response.ok) {
                ordersData = await response.json();
                displayOrders(ordersData);
            } else {
                throw new Error(`API fout: ${response.status}`);
            }
        } catch (error) {
            console.error('Fout bij laden bestellingen:', error);
            showNotification('Fout bij laden bestellingen: ' + error.message, 'error');
            ordersData = [];
            displayOrders([]);
        } finally {
            hideLoading();
        }
    }

    /**
     * Maakt tabellen sorteerbaar door op de headers te klikken
     * Voeg de class 'sortable' toe aan de <table> en 'sortable-header' aan <th> elementen die sorteerbaar moeten zijn
     */
    function setupSortableTables() {
        // Vind alle tabellen met class 'sortable'
        const tables = document.querySelectorAll('table.sortable');
        
        tables.forEach(table => {
            // Haal de body van de tabel op voor sorteren
            const tbody = table.querySelector('tbody');
            if (!tbody) return; // Skip als er geen tbody is
            
            // Vind alle headers die sorteerbaar moeten zijn
            const headers = table.querySelectorAll('th.sortable-header');
            
            headers.forEach(header => {
                // Voeg sorteerpijl icon toe als die nog niet bestaat
                if (!header.querySelector('.sort-icon')) {
                    header.innerHTML += ' <span class="sort-icon">&#8597;</span>';
                }
                
                // Maak de header klikbaar
                header.style.cursor = 'pointer';
                
                // Houd de sorteerstatus bij (none, asc, desc)
                // Zorg dat de datasortstatus wordt ingesteld als die nog niet bestaat
                if (!header.hasAttribute('data-sort-status')) {
                    header.setAttribute('data-sort-status', 'none');
                }
                
                // Verwijder oude event listeners (indien aanwezig) om te voorkomen dat ze zich opstapelen
                header.removeEventListener('click', header._sortHandler);
                
                // Maak een nieuwe handler en bewaar deze referentie voor later verwijdering
                header._sortHandler = () => {
                    // Bepaal de kolom-index
                    const columnIndex = Array.from(header.parentNode.children).indexOf(header);
                    
                    // Haal de huidige sorteerstatus op
                    const currentStatus = header.getAttribute('data-sort-status');
                    console.log('Huidige sorteerstatus:', currentStatus, 'voor kolom', columnIndex);
                    
                    // Reset alle andere headers
                    headers.forEach(h => {
                        if (h !== header) {
                            h.setAttribute('data-sort-status', 'none');
                            const sortIcon = h.querySelector('.sort-icon');
                            if (sortIcon) sortIcon.innerHTML = '&#8597;';
                        }
                    });
                    
                    // Bepaal de nieuwe sorteerstatus - verbeterde logica
                    let newStatus;
                    if (currentStatus === 'asc') {
                        newStatus = 'desc';
                        header.querySelector('.sort-icon').innerHTML = '&#8595;'; // Pijl omlaag
                    } else {
                        // Als status 'none' of 'desc' is, ga naar 'asc'
                        newStatus = 'asc';
                        header.querySelector('.sort-icon').innerHTML = '&#8593;'; // Pijl omhoog
                    }
                    
                    console.log('Nieuwe sorteerstatus:', newStatus);
                    header.setAttribute('data-sort-status', newStatus);
                    
                    // Sorteer de tabelrijen
                    sortTableByColumn(tbody, columnIndex, newStatus === 'asc');
                };
                
                // Voeg de event listener toe
                header.addEventListener('click', header._sortHandler);
            });
        });
    }

    /**
     * Sorteert een tabel op basis van een kolom
     * @param {HTMLElement} tbody - De tbody van de tabel
     * @param {number} columnIndex - De index van de kolom om op te sorteren
     * @param {boolean} ascending - True voor oplopend, false voor aflopend
     */
    function sortTableByColumn(tbody, columnIndex, ascending = true) {
        const rows = Array.from(tbody.querySelectorAll('tr'));
        
        // Sorteer de rijen
        const sortedRows = rows.sort((a, b) => {
            // Haal de tekst van de cellen op
            const aCell = a.cells[columnIndex]?.textContent.trim() || '';
            const bCell = b.cells[columnIndex]?.textContent.trim() || '';
            
            // Controleer of het getallen zijn
            const aNum = parseFloat(aCell.replace(/[^\d.-]/g, ''));
            const bNum = parseFloat(bCell.replace(/[^\d.-]/g, ''));
            
            // Als beide geldige getallen zijn, vergelijk numeriek
            if (!isNaN(aNum) && !isNaN(bNum)) {
                return ascending ? aNum - bNum : bNum - aNum;
            }
            
            // Controleer of het een datum is
            const aDate = new Date(aCell);
            const bDate = new Date(bCell);
            
            if (!isNaN(aDate) && !isNaN(bDate)) {
                return ascending ? aDate - bDate : bDate - aDate;
            }
            
            // Anders vergelijk als tekst
            return ascending 
                ? aCell.localeCompare(bCell, 'nl')
                : bCell.localeCompare(aCell, 'nl');
        });
        
        // Verwijder bestaande rijen
        while (tbody.firstChild) {
            tbody.removeChild(tbody.firstChild);
        }
        
        // Voeg gesorteerde rijen toe
        sortedRows.forEach(row => tbody.appendChild(row));
    }

    // Initialiseer sorteerbare tabellen bij laden pagina
    document.addEventListener('DOMContentLoaded', function() {
        // De bestaande DOMContentLoaded handler wordt al uitgevoerd, dus we voegen deze toe
        setupSortableTables();
    });

    // Voeg setupSortableTables toe aan functies die tabellen bijwerken
    const originalLoadCases = loadCases;
    loadCases = function() {
        originalLoadCases();
        setTimeout(setupSortableTables, 500); // Even wachten tot de tabel is gevuld
    };

    const originalFilterCases = filterCases;
    filterCases = function() {
        originalFilterCases();
        setTimeout(setupSortableTables, 100);
    };

    const originalLoadStockData = loadStockData;
    loadStockData = async function() {
        await originalLoadStockData();
        setTimeout(setupSortableTables, 100);
    };

    const originalDisplayOrders = displayOrders;
    displayOrders = function(orders) {
        originalDisplayOrders(orders);
        setTimeout(setupSortableTables, 100);
    };

    // Roep setupSortableTables aan wanneer gebruiker van tabblad wisselt
    document.querySelectorAll('.nav-link').forEach(tab => {
        tab.addEventListener('shown.bs.tab', function() {
            setupSortableTables();
        });
    });

    // Functie om niet-geleverde items over te zetten
    async function handleTransferUndelivered() {
        if (!currentOrderDetails || !currentOrderDetails.id) {
            showNotification('Geen bestelling geselecteerd of bestel ID ontbreekt.', 'danger');
            return;
        }

        const orderId = currentOrderDetails.id;

        // Bevestiging vragen
        if (!confirm(`Weet je zeker dat je alle niet-geleverde items van bestelling ${orderId} wilt overzetten naar een nieuwe bestelling?`)) {
            return;
        }

        showLoading('Niet-geleverde items overzetten...');

        try {
            const response = await fetch(`/api/oilfree/orders/${orderId}/transfer-undelivered`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();

            if (response.ok && result.success) {
                showNotification(result.message || `Items succesvol overgezet naar nieuwe bestelling: ${result.new_order_id}`, 'success');
                // Sluit de modal
                const orderDetailModalInstance = bootstrap.Modal.getInstance(document.getElementById('orderDetailModal'));
                if (orderDetailModalInstance) {
                    orderDetailModalInstance.hide();
                }
                // Vernieuw de lijst met bestellingen
                loadOrders(); 
            } else {
                showNotification(result.message || 'Fout bij het overzetten van items.', 'danger');
            }
        } catch (error) {
            console.error('Fout bij overzetten niet-geleverde items:', error);
            showNotification('Netwerkfout of serverfout bij het overzetten van items.', 'danger');
        } finally {
            hideLoading();
        }
    }

    /**
     * Haalt beschikbare artikelen op van de server.
     */
    async function fetchAvailableArticles() {
        try {
            const response = await fetch('/api/get_artikels');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            availableArticles = await response.json();
            console.log('Beschikbare artikelen geladen:', availableArticles);
        } catch (error) {
            console.error("Fout bij het ophalen van beschikbare artikelen:", error);
            showNotification("Kon de lijst met artikelen niet laden.", "danger");
            availableArticles = []; // Zorg voor een lege array bij een fout
        }
    }

    /**
     * Rendert de tabel met toegevoegde externe artikelen in de modal.
     */
    function renderExternalArticlesTable() {
        const tableBody = document.getElementById('externalArticlesOrderItemsTableBody');
        if (!tableBody) return;
        tableBody.innerHTML = ''; // Leeg de tabel

        if (currentExternalOrderItems.length === 0) {
            const row = tableBody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 4;
            cell.textContent = 'Nog geen artikelen toegevoegd.';
            cell.classList.add('text-center');
        } else {
            currentExternalOrderItems.forEach((item, index) => {
                const row = tableBody.insertRow();
                row.insertCell().textContent = item.artikel_nummer;
                row.insertCell().textContent = item.artikel_omschrijving;
                row.insertCell().textContent = item.quantity;
                
                const removeBtnCell = row.insertCell();
                const removeBtn = document.createElement('button');
                removeBtn.classList.add('btn', 'btn-sm', 'btn-danger');
                removeBtn.innerHTML = '<i class="fas fa-trash"></i>';
                removeBtn.title = "Verwijder artikel";
                removeBtn.addEventListener('click', () => {
                    currentExternalOrderItems.splice(index, 1); // Verwijder item uit de array
                    renderExternalArticlesTable(); // Her-render de tabel
                });
                removeBtnCell.appendChild(removeBtn);
            });
        }
    }

    /**
     * Voegt een geselecteerd extern artikel toe aan de bestellijst.
     */
    function addExternalArticleToList() {
        const artikelNummerInput = document.getElementById('selectedExternalArticleNumber');
        const artikelOmschrijvingInput = document.getElementById('selectedExternalArticleName');
        const quantityInput = document.getElementById('externalArticleQuantity');

        if (!artikelNummerInput || !artikelOmschrijvingInput || !quantityInput) {
            console.error('Een of meerdere inputvelden voor externe artikelen niet gevonden.');
            return;
        }

        const artikel_nummer = artikelNummerInput.value;
        const artikel_omschrijving = artikelOmschrijvingInput.value;
        const quantity = parseInt(quantityInput.value, 10);

        if (!artikel_nummer) {
            showNotification("Selecteer eerst een artikel.", "warning");
            return;
        }
        if (isNaN(quantity) || quantity <= 0) {
            showNotification("Voer een geldig aantal in.", "warning");
            return;
        }

        // Controleer of het artikel al in de lijst staat
        const existingItemIndex = currentExternalOrderItems.findIndex(item => item.artikel_nummer === artikel_nummer);
        if (existingItemIndex > -1) {
            // Update het aantal als het artikel al bestaat
            currentExternalOrderItems[existingItemIndex].quantity += quantity;
        } else {
            // Voeg nieuw item toe
            currentExternalOrderItems.push({ 
                artikel_nummer, 
                artikel_omschrijving, // Zorg dat deze ook wordt meegenomen
                quantity 
            });
        }
        
        renderExternalArticlesTable();

        // Reset de selectievelden
        artikelNummerInput.value = '';
        artikelOmschrijvingInput.value = '';
        quantityInput.value = '1';
        document.getElementById('searchExternalArticle').value = ''; // Reset ook zoekveld
        document.getElementById('searchExternalArticle').focus();
    }

    /**
     * Slaat de nieuwe bestelling voor externe artikelen op.
     */
    async function saveExternalArticlesOrder() {
        const destinationLocationInput = document.getElementById('externalOrderDestinationLocation');
        const transportPlanningInput = document.getElementById('externalOrderTransportPlanning');

        if (!destinationLocationInput || !transportPlanningInput) {
            console.error('Bestemmingslocatie of transportplanning inputveld niet gevonden.');
            return;
        }

        const destinationLocation = destinationLocationInput.value;
        const transportPlanning = transportPlanningInput.value.trim();

        if (!destinationLocation) {
            showNotification("Selecteer een bestemmingslocatie.", "warning");
            return;
        }
        if (currentExternalOrderItems.length === 0) {
            showNotification("Voeg minstens één artikel toe aan de bestelling.", "warning");
            return;
        }

        const orderData = {
            destinationLocation,
            items: currentExternalOrderItems.map(item => ({ 
                artikel_nummer: item.artikel_nummer, 
                quantity: item.quantity,
                artikel_omschrijving: item.artikel_omschrijving // Stuur omschrijving mee, backend kan dit evt. negeren/valideren
            })),
            transportPlanning: transportPlanning || null // Stuur null als leeg
        };

        try {
            showLoading('Bestelling plaatsen...');
            const response = await fetch('/api/oilfree/orders/add-articles-external', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(orderData),
            });

            hideLoading();
            const result = await response.json();

            if (response.ok) {
                showNotification(`Bestelling ${result.newOrderId} succesvol geplaatst!`, 'success');
                addExternalArticlesOrderModal.hide();
                // Optioneel: refresh de lijst met bestellingen als die zichtbaar is
                if (document.getElementById('orders-tab').classList.contains('active')) {
                    loadOrders(); 
                }
            } else {
                showNotification(`Fout bij plaatsen bestelling: ${result.message || response.statusText}`, 'danger');
            }
        } catch (error) {
            hideLoading();
            console.error("Fout bij het plaatsen van de externe artikelbestelling:", error);
            showNotification("Kon de bestelling niet plaatsen. Controleer de console voor details.", "danger");
        }
    }

    // Initieel laden van beschikbare artikelen wanneer de pagina laadt (of wanneer modal voor het eerst geopend wordt)
    // Dit kan ook verplaatst worden naar de click listener van addExternalArticlesOrderBtn als je het alleen wilt laden bij openen modal.
    fetchAvailableArticles(); 
    // ... existing code ...

    // ... existing code ...

    // Functie om de status van de "Bestelling Voltooien" knop bij te werken
    function updateCompleteOrderButtonState(order) {
        const completeOrderButton = document.getElementById('complete-order-button');
        if (!completeOrderButton) return;

        if (!order || !order.items || order.items.length === 0) {
            completeOrderButton.disabled = true;
            completeOrderButton.title = 'Kan bestelling niet voltooien (geen items of order data)';
            return;
        }

        // Controleer of de bestelling al de status 'completed' of 'geannuleerd' heeft
        if (order.status === 'completed' || order.status === 'geannuleerd') {
            completeOrderButton.disabled = true;
            completeOrderButton.title = `Bestelling is al ${order.status}.`;
            return;
        }

        // Controleer of alle items volledig geleverd of overgedragen zijn
        const allItemsProcessed = order.items.every(item => {
            const openQuantity = (item.quantity || 0) - (item.delivered_quantity || 0) - (item.transferred_quantity || 0);
            return openQuantity <= 0;
        });

        if (allItemsProcessed) {
            completeOrderButton.disabled = false;
            completeOrderButton.title = 'Markeer deze bestelling als voltooid.';
        } else {
            completeOrderButton.disabled = true;
            completeOrderButton.title = 'Nog niet alle items zijn volledig geleverd of overgedragen.';
        }
    }

    // Event listener voor de "Bestelling Voltooien" knop
    document.getElementById('complete-order-button').addEventListener('click', completeCurrentOrder);

    // NIEUWE FUNCTIE: Update het aantal geselecteerde kisten
    function updateSelectedCount() {
        const selectedCheckboxes = document.querySelectorAll('.case-select-checkbox:checked');
        const count = selectedCheckboxes.length;
        
        const selectedCountElement = document.getElementById('selected-count');
        const manualTransportButton = document.getElementById('manual-transport-button');
        
        if (selectedCountElement) {
            selectedCountElement.textContent = count;
        }
        if (manualTransportButton) {
            manualTransportButton.disabled = count === 0;
        }
        
        // Update "select all" checkbox status
        const allCheckboxes = document.querySelectorAll('.case-select-checkbox');
        const selectAllCheckbox = document.getElementById('select-all-cases');
        
        if (selectAllCheckbox) {
            if (allCheckboxes.length === 0) {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
            } else if (count === 0) {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
            } else if (count === allCheckboxes.length) {
                selectAllCheckbox.checked = true;
                selectAllCheckbox.indeterminate = false;
            } else {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = true;
            }
        }
    }

    // NIEUWE FUNCTIE: Toggle alle checkboxes
    function toggleAllCases() {
        const selectAllCheckbox = document.getElementById('select-all-cases');
        const allCheckboxes = document.querySelectorAll('.case-select-checkbox');
        
        if (selectAllCheckbox) {
            allCheckboxes.forEach(checkbox => {
                checkbox.checked = selectAllCheckbox.checked;
            });
            
            updateSelectedCount();
        }
    }

    // NIEUWE FUNCTIE: Maak handmatige transport aanvraag
    async function createManualTransportRequest() {
        const selectedCheckboxes = document.querySelectorAll('.case-select-checkbox:checked');
        
        if (selectedCheckboxes.length === 0) {
            showNotification('Geen kisten geselecteerd voor transport', 'warning');
            return;
        }

        // Verzamel geselecteerde cases
        const selectedCases = Array.from(selectedCheckboxes).map(checkbox => ({
            id: checkbox.getAttribute('data-case-id'),
            caseLabel: checkbox.getAttribute('data-case-label'),
            caseType: checkbox.getAttribute('data-case-type'),
            currentLocation: checkbox.getAttribute('data-current-location'),
            serialNumber: '', // Zou uit casesData gehaald kunnen worden indien nodig
            status: 'Beschikbaar'
        }));

        console.log('🚛 Handmatige transport aanvraag voor', selectedCases.length, 'geselecteerde cases');

        // Groepeer per kisttype voor overzicht
        const groupedByType = {};
        selectedCases.forEach(c => {
            const caseType = c.caseType;
            if (!groupedByType[caseType]) {
                groupedByType[caseType] = {
                    caseType: caseType,
                    cases: [],
                    quantity: 0
                };
            }
            groupedByType[caseType].cases.push(c);
            groupedByType[caseType].quantity++;
        });

        // Maak overzicht voor gebruiker
        let confirmMessage = `🚛 HANDMATIGE TRANSPORT AANVRAAG\n\n`;
        confirmMessage += `Je hebt ${selectedCases.length} kisten geselecteerd:\n\n`;
        
        Object.values(groupedByType).forEach(group => {
            confirmMessage += `• ${group.caseType}: ${group.quantity} stuks\n`;
        });
        
        confirmMessage += `\nLocaties:\n`;
        const locationCounts = {};
        selectedCases.forEach(c => {
            const loc = c.currentLocation || 'Onbekend';
            locationCounts[loc] = (locationCounts[loc] || 0) + 1;
        });
        Object.entries(locationCounts).forEach(([location, count]) => {
            confirmMessage += `• ${location}: ${count} stuks\n`;
        });
        
        confirmMessage += `\n⚠️ BELANGRIJK: Deze kisten worden aangevraagd ongeacht stock beschikbaarheid.\n\n`;
        confirmMessage += `Wil je doorgaan met de transport aanvraag?`;

        // Vraag bevestiging
        const confirmed = confirm(confirmMessage);
        
        if (!confirmed) {
            showNotification('Transport aanvraag geannuleerd', 'info');
            return;
        }

        showLoading('Handmatige transport aanvraag voorbereiden...');

        try {
            // Genereer unieke transport ID
            const transportId = generateTransportRequestId();
            
            // Maak transport aanvraag object (zonder stock checks)
            const transportRequest = {
                id: transportId,
                type: 'manual_selection',
                targetLocation: 'Willebroek',
                requestDate: new Date().toISOString(),
                cases: selectedCases,
                transferableItems: Object.values(groupedByType).map(group => ({
                    ...group,
                    availableInGenk: 'N/A', // Niet van toepassing bij handmatige selectie
                    availableInWilrijk: 'N/A',
                    totalAvailable: 'N/A',
                    needed: group.quantity,
                    canTransfer: true, // Altijd true bij handmatige selectie
                    shortfall: 0
                })),
                status: 'manual_request',
                totalCases: selectedCases.length,
                totalTypes: Object.keys(groupedByType).length
            };
            
            // Genereer transport document
            await generateManualTransportDocument(transportRequest);
            
            // Probeer order in database aan te maken (niet fataal als dit faalt)
            try {
                await createTransportOrderInDatabase(transportRequest);
            } catch (error) {
                console.warn('Database opslag gefaald, maar transport document is wel gegenereerd:', error);
            }
            
            // Probeer case transport status bij te werken (niet fataal als dit faalt)
            try {
                await updateCaseTransportStatus(selectedCases, 'transport_aangevraagd', transportId);
            } catch (error) {
                console.warn('Status update gefaald, maar transport document is wel gegenereerd:', error);
            }
            
            // Toon succesbericht
            showNotification(
                `🚛 Handmatige transport aanvraag ${transportId} gemaakt!\n` +
                `${selectedCases.length} geselecteerde kisten, ${Object.keys(groupedByType).length} verschillende kisttypen\n` +
                `PDF document gegenereerd voor logistiek team.`,
                'success'
            );
            
            // Reset selecties
            document.querySelectorAll('.case-select-checkbox:checked').forEach(checkbox => {
                checkbox.checked = false;
            });
            updateSelectedCount();
            
            // Herlaad data om nieuwe status te tonen
            await loadCases();
            
        } catch (error) {
            console.error('Fout bij maken handmatige transport aanvraag:', error);
            showNotification('Fout bij maken transport aanvraag: ' + error.message, 'error');
        } finally {
            hideLoading();
        }
    }

    // NIEUWE FUNCTIE: Genereer handmatig transport document
    async function generateManualTransportDocument(transportRequest) {
        try {
            // Groepeer cases per productie locatie
            const casesByProductionLocation = {};
            
            transportRequest.cases.forEach(c => {
                // Bepaal productie locatie op basis van case type of gebruik een standaard
                const productionLocation = findPredefinedProductionLocation(c.caseType) || 'Genk';
                
                if (!casesByProductionLocation[productionLocation]) {
                    casesByProductionLocation[productionLocation] = [];
                }
                casesByProductionLocation[productionLocation].push(c);
            });
            
            // Genereer een PDF voor elke productie locatie
            const locations = Object.keys(casesByProductionLocation);
            
            for (const location of locations) {
                const casesForLocation = casesByProductionLocation[location];
                
                // Groepeer per kisttype voor deze locatie
                const typeCountsForLocation = {};
                casesForLocation.forEach(c => {
                    typeCountsForLocation[c.caseType] = (typeCountsForLocation[c.caseType] || 0) + 1;
                });
                
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                
                // === EENVOUDIGE HEADER MET LOGO ===
                try {
                    // Probeer het Foresco logo te laden van de root directory
                    const logoImg = new Image();
                    logoImg.crossOrigin = 'anonymous';
                    
                    await new Promise((resolve, reject) => {
                        logoImg.onload = () => {
                            // Voeg logo toe (linksboven)
                            const canvas = document.createElement('canvas');
                            const ctx = canvas.getContext('2d');
                            canvas.width = logoImg.width;
                            canvas.height = logoImg.height;
                            ctx.drawImage(logoImg, 0, 0);
                            const logoDataURL = canvas.toDataURL('image/png');
                            doc.addImage(logoDataURL, 'PNG', 20, 15, 60, 30);
                            resolve();
                        };
                        logoImg.onerror = () => {
                            console.warn('Kon Foresco logo niet laden van /foresco.png');
                            resolve(); // Ga door zonder logo
                        };
                        logoImg.src = window.location.origin + '/foresco.png';
                    });
                } catch (logoError) {
                    console.warn('Fout bij laden Foresco logo:', logoError);
                }
                
                // Bedrijfsnaam naast logo
                doc.setTextColor(0, 0, 0);
                doc.setFontSize(20);
                doc.setFont('helvetica', 'bold');
                doc.text('FORESCO', 90, 25);
                
                // Datum rechtsboven
                const currentDate = new Date().toLocaleDateString('nl-BE', {
                    year: 'numeric', month: 'long', day: 'numeric'
                });
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.text(currentDate, 145, 20);
                
                // === DOCUMENT TITEL ===
                doc.setTextColor(0, 0, 0);
                doc.setFontSize(18);
                doc.setFont('helvetica', 'bold');
                doc.text('TRANSPORT AANVRAAG', 20, 55);
                
                doc.setFontSize(14);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(100, 100, 100);
                doc.text(`Productie Locatie: ${location}`, 20, 65);
                
                // === SAMENVATTING BOX ===
                doc.setDrawColor(200, 200, 200);
                doc.setFillColor(248, 249, 250);
                doc.roundedRect(20, 75, 170, 25, 3, 3, 'FD');
                
                doc.setTextColor(0, 0, 0);
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.text('SAMENVATTING', 25, 85);
                
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                const totalCases = casesForLocation.length;
                const totalTypes = Object.keys(typeCountsForLocation).length;
                doc.text(`Totaal aantal cases: ${totalCases}`, 25, 92);
                doc.text(`Verschillende kisttypen: ${totalTypes}`, 100, 92);
                
                // === OVERZICHT PER KISTTYPE ===
                doc.setTextColor(0, 0, 0);
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text('OVERZICHT PER KISTTYPE', 20, 115);
                
                const typeTableData = Object.entries(typeCountsForLocation)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([caseType, count]) => {
                        // Verzamel alle case labels voor dit kisttype
                        const caseLabelsForType = casesForLocation
                            .filter(c => c.caseType === caseType)
                            .map(c => c.caseLabel)
                            .sort()
                            .join(', ');
                        
                        // Haal ERP codes op voor dit kisttype
                        const erpCodes = findERPCodesForCaseType(caseType, location);
                        const erpCodeString = erpCodes.length > 0 ? erpCodes.join(', ') : 'NG';
                        
                        return [caseType, erpCodeString, caseLabelsForType, count.toString()];
                    });
                
                doc.autoTable({
                    startY: 125,
                    head: [['Kisttype', 'ERP Code', 'Case Labels', 'Aantal']],
                    body: typeTableData,
                    styles: { 
                        fontSize: 10, 
                        cellPadding: 5,
                        lineColor: [200, 200, 200],
                        lineWidth: 0.5
                    },
                    headStyles: { 
                        fillColor: [52, 73, 94],
                        textColor: 255,
                        fontStyle: 'bold',
                        fontSize: 11
                    },
                    columnStyles: {
                        0: { cellWidth: 25 }, // Kisttype kolom kleiner
                        1: { cellWidth: 25 }, // ERP Code kolom
                        2: { cellWidth: 95 }, // Case labels kolom
                        3: { halign: 'center', cellWidth: 25, fontStyle: 'bold' } // Aantal kolom
                    },
                    alternateRowStyles: {
                        fillColor: [248, 249, 250]
                    },
                    margin: { left: 20, right: 20 }
                });
                
                // Download PDF met locatie in filename
                const filename = `Transport_${location}_${transportRequest.id}.pdf`;
                doc.save(filename);
                
                console.log(`✅ Professioneel transport document gegenereerd voor ${location}:`, filename);
            }
            
            // Toon melding over gegenereerde PDF's
            if (locations.length > 1) {
                showNotification(
                    `${locations.length} PDF's gegenereerd voor verschillende productie locaties:\n${locations.join(', ')}`,
                    'success'
                );
            }
            
        } catch (error) {
            console.error('Fout bij genereren transport document:', error);
            throw new Error('Kon transport document niet genereren: ' + error.message);
        }
    }

    // Event listeners voor handmatige transport selectie
    document.addEventListener('click', function(event) {
        // Select all checkbox
        if (event.target && event.target.id === 'select-all-cases') {
            toggleAllCases();
        }
        
        // Individual case checkboxes
        if (event.target && event.target.classList.contains('case-select-checkbox')) {
            updateSelectedCount();
        }
        
        // Manual transport button
        if (event.target && event.target.id === 'manual-transport-button') {
            createManualTransportRequest();
        }
    });

});
