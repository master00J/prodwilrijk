document.addEventListener('DOMContentLoaded', (event) => {
    // Globale variabelen
    let revenueChart = null;
    let hoursChart = null;
    let startDate = null;
    let endDate = null;
    let prepackData = [];
    let priceMap = {}; // Global variable for price map
    let isEditMode = false; // Nieuwe variabele voor bewerkingsmodus
    let originalData = {}; // Om originele data bij te houden voor cancel functionaliteit

    // Load the header
    fetch('header.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById('header-placeholder').innerHTML = data;
        });

    // Initialiseer datepickers
    initializeDatepickers();

    // Initialiseer event listeners
    initializeEventListeners();

    // Laad initiële data (laatste 30 dagen)
    loadData(30);

    // Initialiseer datepickers met flatpickr
    function initializeDatepickers() {
        flatpickr('#start-date', {
            dateFormat: 'Y-m-d',
            maxDate: 'today'
        });

        flatpickr('#end-date', {
            dateFormat: 'Y-m-d',
            maxDate: 'today'
        });

        // Stel standaard datums in
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);

        document.getElementById('start-date').value = formatDate(thirtyDaysAgo);
        document.getElementById('end-date').value = formatDate(today);
    }

    // Initialiseer event listeners
    function initializeEventListeners() {
        console.log('Initializing event listeners...');
        
        // Date range selector
        document.getElementById('date-range').addEventListener('change', function() {
            const value = this.value;
            const customRange = document.getElementById('custom-date-range');

            if (value === 'custom') {
                customRange.style.display = 'flex';
            } else {
                customRange.style.display = 'none';
                loadData(parseInt(value));
            }
        });

        // Apply button for custom date range
        document.getElementById('apply-dates').addEventListener('click', function() {
            const startDateStr = document.getElementById('start-date').value;
            const endDateStr = document.getElementById('end-date').value;

            if (!startDateStr || !endDateStr) {
                alert('Vul beide datums in');
                return;
            }

            startDate = new Date(startDateStr);
            endDate = new Date(endDateStr);

            if (startDate > endDate) {
                alert('Startdatum moet vóór einddatum liggen');
                return;
            }

            loadDataForDateRange(startDateStr, endDateStr);
        });

        // Export data button
        document.getElementById('export-data-btn').addEventListener('click', exportDataAsExcel);
        
        // Edit mode button - check if element exists
        const editBtn = document.getElementById('edit-mode-btn');
        if (editBtn) {
            console.log('Edit button found, adding event listener');
            editBtn.addEventListener('click', toggleEditMode);
        } else {
            console.error('Edit button not found!');
        }
        
        // Save changes button
        const saveBtn = document.getElementById('save-changes-btn');
        if (saveBtn) {
            console.log('Save button found, adding event listener');
            saveBtn.addEventListener('click', saveChanges);
        } else {
            console.error('Save button not found!');
        }
        
        // Cancel changes button
        const cancelBtn = document.getElementById('cancel-changes-btn');
        if (cancelBtn) {
            console.log('Cancel button found, adding event listener');
            cancelBtn.addEventListener('click', cancelChanges);
        } else {
            console.error('Cancel button not found!');
        }
    }

    // Laad data voor een specifiek aantal dagen
    function loadData(days) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);

        loadDataForDateRange(formatDate(startDate), formatDate(endDate));
    }

    // Laad data voor een specifieke periode
    function loadDataForDateRange(startDateStr, endDateStr) {
        const loadingOverlay = createLoadingOverlay();
        document.body.appendChild(loadingOverlay);

        // Toon dat we data aan het laden zijn
        console.log(`Data laden van ${startDateStr} tot ${endDateStr}...`);

        // STAP 1: Eerst alle prijsgegevens ophalen
        fetch('/api/item_prices')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`API fout: ${response.status}`);
                }
                return response.json();
            })
            .then(itemPrices => {
                console.log(`${itemPrices.length} prijsgegevens opgehaald`);
                
                // Check if any have houtkosten/materiaalkosten fields
                const withDetailedCosts = itemPrices.filter(price => 
                    price.houtkosten !== undefined || price.materiaalkosten !== undefined);
                console.log(`${withDetailedCosts.length} prijsgegevens hebben houtkosten/materiaalkosten velden`);
                
                if (withDetailedCosts.length > 0) {
                    console.log('Voorbeeld van een prijs met houtkosten/materiaalkosten:', withDetailedCosts[0]);
                }
                
                // Index maken van item_number naar prijs voor snellere lookup
                priceMap = {}; // Reset the global priceMap
                itemPrices.forEach(price => {
                    const priceData = {
                        selling_price: price.selling_price,
                        material_cost: price.material_cost,
                        labor_cost: price.labor_cost,
                        materials: price.materials,
                        // Add the new fields if they exist
                        houtkosten: typeof price.houtkosten !== 'undefined' ? parseFloat(price.houtkosten) : null,
                        materiaalkosten: typeof price.materiaalkosten !== 'undefined' ? parseFloat(price.materiaalkosten) : null
                    };
                    
                    // Index by item_number (primary key)
                    priceMap[price.item_number] = priceData;
                    console.log(`PriceMap entry created for item_number: ${price.item_number}`, priceData);
                    
                    // Also index by item_naam if it exists and is different from item_number
                    if (price.item_naam && price.item_naam !== price.item_number) {
                        priceMap[price.item_naam] = priceData;
                        console.log(`PriceMap ook geïndexeerd op item_naam: ${price.item_naam}`);
                    }
                });
                
                console.log(`PriceMap completed with ${Object.keys(priceMap).length} entries`);
                console.log('PriceMap keys:', Object.keys(priceMap).slice(0, 10)); // Show first 10 keys
                
                // STAP 2: Gepakte items ophalen
                return fetch(`/api/packed_items?date_from=${startDateStr}&date_to=${endDateStr}`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`API fout: ${response.status}`);
                        }
                        return response.json();
                    })
                    .then(packedItems => {
                        console.log(`${packedItems.length} gepakte items opgehaald`);
                        
                        // Voeg prijsgegevens toe aan gepakte items
                        packedItems.forEach(item => {
                            console.log(`Processing packed item: ${item.item_number || item.item_naam}`, {
                                item_number: item.item_number,
                                item_naam: item.item_naam,
                                item_code: item.item_code
                            });
                            
                            // Als het item al price_data heeft, gebruik het
                            if (!item.price_data) {
                                // Anders, gebruik de prijsgegevens uit de priceMap
                                const priceData = priceMap[item.item_number];
                                if (priceData) {
                                    item.price_data = priceData;
                                    console.log(`Prijsgegevens toegevoegd aan item ${item.item_number}`, priceData);
                                } else {
                                    console.log(`Geen prijsgegevens gevonden in priceMap voor item_number: ${item.item_number}`);
                                    // Try alternative lookups
                                    if (item.item_naam && priceMap[item.item_naam]) {
                                        item.price_data = priceMap[item.item_naam];
                                        console.log(`Prijsgegevens gevonden via item_naam: ${item.item_naam}`);
                                    } else if (item.item_code && priceMap[item.item_code]) {
                                        item.price_data = priceMap[item.item_code];
                                        console.log(`Prijsgegevens gevonden via item_code: ${item.item_code}`);
                                    } else {
                                        console.log(`Geen prijsgegevens gevonden voor item via alle lookup methoden`);
                                    }
                                }
                            } else {
                                console.log(`Item ${item.item_number} heeft al price_data:`, item.price_data);
                            }
                        });
                        
                        // STAP 2.5: Materiaalkosten ophalen voor deze artikelnummers
                        const artikelNummers = new Set();
                        packedItems.forEach(item => {
                            if (item.item_number) {
                                artikelNummers.add(item.item_number);
                            }
                            
                            // Ook controleren op item_code voor compatibiliteit met add_order data
                            if (item.item_code) {
                                artikelNummers.add(item.item_code);
                            }

                            // NIEUW: Voeg item_naam van packedItem toe aan artikelNummers
                            // Dit is de naam die op de nacalculatiepagina wordt weergegeven en moet overeenkomen met prepack_code/item_naam in order_items
                            if (item.item_naam && item.item_naam.trim() !== '') {
                                artikelNummers.add(item.item_naam.trim());
                            }
                            
                            // Als er component_descriptions beschikbaar zijn, gebruik deze ook
                            // Dit is belangrijk voor exacte matching met add_order materialen
                            if (item.components && Array.isArray(item.components)) {
                                item.components.forEach(comp => {
                                    if (comp.description) {
                                        artikelNummers.add(comp.description);
                                    }
                                });
                            }
                        });
                        
                        if (artikelNummers.size > 0) {
                            console.log(`Artikelnummers gevonden: ${Array.from(artikelNummers).slice(0, 10).join(', ')} (en ${Math.max(0, artikelNummers.size - 10)} meer)`);
                            
                            // Alle prijsgegevens zijn al opgehaald uit item_prices, geen extra API call nodig
                            // Voeg materiaalkosten toe aan packed items op basis van al opgehaalde priceMap
                            packedItems.forEach(item => {
                                let priceData = priceMap[item.item_number] || {};
                                
                                // Als niet gevonden via item_number, probeer via item_naam
                                if ((!priceData.houtkosten && !priceData.materiaalkosten) && item.item_naam) {
                                    priceData = priceMap[item.item_naam] || {};
                                }
                                
                                // Als niet gevonden via item_naam, probeer via item_code
                                if ((!priceData.houtkosten && !priceData.materiaalkosten) && item.item_code) {
                                    priceData = priceMap[item.item_code] || {};
                                }
                                
                                if (priceData && (priceData.houtkosten !== null || priceData.materiaalkosten !== null)) {
                                    console.log(`Materiaalkosten gevonden in item_prices voor ${item.item_number || item.item_naam}:`, {
                                        houtkosten: priceData.houtkosten,
                                        materiaalkosten: priceData.materiaalkosten
                                    });
                                    
                                    // Create materiaal_details from item_prices data
                                    item.materiaal_details = {
                                        hout_kost: priceData.houtkosten || 0,
                                        hulpstoffen: priceData.materiaalkosten || 0,
                                        totaal: (priceData.houtkosten || 0) + (priceData.materiaalkosten || 0)
                                    };
                                    
                                    // Update price_data as well
                                    if (!item.price_data) item.price_data = {};
                                    item.price_data.material_cost = item.materiaal_details.totaal;
                                    
                                    console.log(`Toegepaste materiaalkosten uit item_prices voor ${item.item_number || item.item_naam}: `, item.materiaal_details);
                                } else {
                                    console.log(`Geen gedetailleerde materiaalkosten in item_prices voor ${item.item_number || item.item_naam}. PriceData:`, priceData);
                                }
                            });
                            
                            // STAP 3: Tijdsregistraties ophalen
                            return fetch(`/api/prepack_timelogs?date_from=${startDateStr}&date_to=${endDateStr}`)
                                .then(response => {
                                    if (!response.ok) {
                                        throw new Error(`API fout: ${response.status}`);
                                    }
                                    return response.json();
                                })
                                .then(timelogs => {
                                    console.log(`${timelogs.length} tijdsregistraties opgehaald`);
                                    
                                    // Verwerk en combineer de data
                                    processData(packedItems, timelogs, startDateStr, endDateStr);
                                    document.body.removeChild(loadingOverlay);
                                });
                        } else {
                            // STAP 3: Tijdsregistraties ophalen (als er geen artikelnummers zijn)
                            return fetch(`/api/prepack_timelogs?date_from=${startDateStr}&date_to=${endDateStr}`)
                                .then(response => {
                                    if (!response.ok) {
                                        throw new Error(`API fout: ${response.status}`);
                                    }
                                    return response.json();
                                })
                                .then(timelogs => {
                                    console.log(`${timelogs.length} tijdsregistraties opgehaald`);
                                    
                                    // Verwerk en combineer de data
                                    processData(packedItems, timelogs, startDateStr, endDateStr);
                                    document.body.removeChild(loadingOverlay);
                                });
                        }
                    });
            })
            .catch(error => {
                console.error('Fout bij laden data:', error);
                document.body.removeChild(loadingOverlay);
                
                // Toon een aangepaste foutmelding
                const errorMessage = error.message || "Onbekende fout";
                
                // Toon een gebruikersvriendelijke foutmelding
                showErrorMessage(
                    `${errorMessage}<br><br>
                    <strong>Mogelijke oplossingen:</strong><br>
                    1. Controleer of de API-server draait<br>
                    2. Controleer of de prijsgegevens correct zijn ingesteld<br>
                    3. Controleer of de database tabellen bestaan en toegankelijk zijn`
                );
            });
    }

    // Main work function after loading all necessary data
    function processData(packedItems, timelogs, startDateStr, endDateStr) {
        // Check if we found any items with houtkosten/materiaalkosten
        const itemsWithDetailedCosts = packedItems.filter(item => 
            item.materiaal_details && 
            (item.materiaal_details.hout_kost > 0 || item.materiaal_details.hulpstoffen > 0)
        );
        
        if (itemsWithDetailedCosts.length > 0) {
            showSuccessMessage(`${itemsWithDetailedCosts.length} items met gedetailleerde materiaalkosten gevonden.`);
        }
        
        console.log("Verwerking van data gestart...");
        console.log("Aantal gepakte items:", packedItems.length);
        console.log("Aantal tijdsregistraties:", timelogs.length);
        
        // Object om data per dag bij te houden
        const dayData = {};
        
        // Verwerk eerst de tijdsregistraties om arbeidstijd te bepalen
        console.log("Verwerken van tijdsregistraties...");
        timelogs.forEach(log => {
            // Bepaal de datum van de log
            let logDate = '';
            
            if (log.start_time) {
                logDate = typeof log.start_time === 'string' ? log.start_time.split('T')[0] : formatDate(new Date(log.start_time));
            } else if (log.date) { // Compatibiliteit
                logDate = typeof log.date === 'string' ? log.date.split('T')[0] : formatDate(new Date(log.date));
            } else {
                console.warn('Tijdsregistratie zonder datum:', log);
                return;
            }
            
            console.log(`Verwerk tijdsregistratie voor datum ${logDate}`);
            
            if (!dayData[logDate]) {
                console.log(`Nieuwe datum gevonden in tijdsregistratie: ${logDate}, voegen toe aan dagdata`);
                dayData[logDate] = {
                    date: logDate,
                    itemCount: 0,
                    revenue: 0,
                    materialCost: 0,
                    houtKosten: 0,         // Nieuw veld voor houtkosten
                    hulpstoffenKosten: 0,  // Nieuw veld voor hulpstoffen
                    laborCost: 0, // Dit wordt nu berekend op basis van uren
                    totalCost: 0,
                    laborHours: 0,
                    overhead: 0, // Overhead initialiseren
                    profit: 0,
                    margin: 0,
                    items: [],
                    itemsWithoutPrice: 0
                };
            }
            
            let durationMinutes = 0;
            
            if (log.total_employee_minutes !== undefined && log.total_employee_minutes !== null) {
                // Gebruik de nieuwe, correct berekende totale man-minuten
                durationMinutes = parseFloat(log.total_employee_minutes);
                console.log(`Gebruik total_employee_minutes: ${durationMinutes} voor log ID ${log.id || 'N/A'}`);
            } else if (log.duration_minutes) {
                // Fallback naar duration_minutes (voor oudere logs of logs die nog niet gestopt zijn via de nieuwe methode)
                // Idealiter zou hier nog een vermenigvuldiging met aantal werknemers moeten als dat bekend is.
                // Voor nu gebruiken we duration_minutes direct, wat de sessieduur is.
                durationMinutes = parseFloat(log.duration_minutes);
                console.warn(`Fallback naar duration_minutes: ${durationMinutes} voor log ID ${log.id || 'N/A'}. Dit is de sessieduur, niet de totale man-minuten.`);
                // Probeer aantal werknemers te parsen indien aanwezig, voor een betere fallback
                if (log.werknemer_ids) {
                    try {
                        const werknemers = JSON.parse(log.werknemer_ids);
                        if (Array.isArray(werknemers) && werknemers.length > 0) {
                            durationMinutes *= werknemers.length;
                            console.log(`Fallback duration_minutes vermenigvuldigd met ${werknemers.length} werknemers, resulterend in ${durationMinutes} minuten.`);
                        }
                    } catch (e) {
                        console.warn('Kon werknemer_ids niet parsen voor fallback berekening.', e);
                    }
                }
            } else if (log.start_time && log.end_time) {
                const startTime = new Date(log.start_time);
                const endTime = new Date(log.end_time);
                durationMinutes = (endTime - startTime) / (1000 * 60);
                 // Ook hier zou vermenigvuldiging met aantal werknemers nodig zijn.
                console.warn(`Fallback naar berekende duur (start/end): ${durationMinutes} voor log ID ${log.id || 'N/A'}. Sessieduur.`);
                if (log.werknemer_ids) {
                     try {
                        const werknemers = JSON.parse(log.werknemer_ids);
                        if (Array.isArray(werknemers) && werknemers.length > 0) {
                            durationMinutes *= werknemers.length;
                            console.log(`Fallback berekende duur vermenigvuldigd met ${werknemers.length} werknemers, resulterend in ${durationMinutes} minuten.`);
                        }
                    } catch (e) {
                        console.warn('Kon werknemer_ids niet parsen voor fallback berekening.', e);
                    }
                }
            } else if (log.start_time && !log.end_time) {
                const startTime = new Date(log.start_time);
                const now = new Date();
                durationMinutes = (now - startTime) / (1000 * 60); // Actieve log
                console.warn(`Fallback naar actieve log duur: ${durationMinutes} voor log ID ${log.id || 'N/A'}. Sessieduur.`);
                 if (log.werknemer_ids) {
                     try {
                        const werknemers = JSON.parse(log.werknemer_ids);
                        if (Array.isArray(werknemers) && werknemers.length > 0) {
                            durationMinutes *= werknemers.length;
                            console.log(`Fallback actieve log duur vermenigvuldigd met ${werknemers.length} werknemers, resulterend in ${durationMinutes} minuten.`);
                        }
                    } catch (e) {
                        console.warn('Kon werknemer_ids niet parsen voor fallback berekening.', e);
                    }
                }
            }
            
            const hours = durationMinutes / 60;
            dayData[logDate].laborHours += hours;
            
            console.log(`Tijdsregistratie toegevoegd: ${durationMinutes} minuten (${hours.toFixed(2)} uur) voor datum ${logDate}`);
        });
        
        // Bereken de arbeidskosten op basis van gepresteerde uren
        console.log("Berekenen van arbeidskosten op basis van gepresteerde uren...");
        Object.keys(dayData).forEach(date => {
            // Arbeidskosten = gepresteerde uren * 40 euro per uur
            dayData[date].laborCost = dayData[date].laborHours * 40;
            console.log(`Arbeidskosten voor ${date}: ${dayData[date].laborHours.toFixed(2)} uur * €40 = €${dayData[date].laborCost.toFixed(2)}`);
        });

        // Verwerk de gepakte items
        console.log("Verwerken van gepakte items...");
        packedItems.forEach(item => {
            // Bepaal de datum
            const datePacked = item.date_packed ? new Date(item.date_packed) : null;
            if (!datePacked) {
                console.warn('Item zonder verpakkingsdatum overgeslagen:', item.id);
                return;
            }
            
            const dateStr = formatDate(datePacked);
            
            // Controleer of de datum binnen de gekozen range valt
            if (startDateStr && dateStr < startDateStr) return;
            if (endDateStr && dateStr > endDateStr) return;
            
            console.log(`Verwerk item ${item.item_number} verpakt op ${dateStr}`);
            
            // Maak een entry aan voor deze datum als die nog niet bestaat
            if (!dayData[dateStr]) {
                dayData[dateStr] = {
                    date: dateStr,
                    itemCount: 0,
                    revenue: 0,
                    materialCost: 0,
                    houtKosten: 0,         // Nieuw veld voor houtkosten
                    hulpstoffenKosten: 0,  // Nieuw veld voor hulpstoffen
                    laborCost: 0, // Dit wordt nu berekend op basis van uren
                    totalCost: 0,
                    laborHours: 0,
                    overhead: 0, // Overhead initialiseren
                    profit: 0,
                    margin: 0,
                    items: [],
                    itemsWithoutPrice: 0
                };
            }
            
            // Haal de prijsgegevens op, eerst via de price_data en daarna uit de item properties voor compatibiliteit
            let priceData = {
                selling_price: 0,
                material_cost: 0,
                labor_cost: 0 // Deze waarde wordt nu niet meer gebruikt voor berekening
            };
            
            if (item.price_data) {
                priceData = {
                    selling_price: item.price_data.selling_price,
                    material_cost: item.price_data.material_cost,
                    labor_cost: item.price_data.labor_cost // Alleen voor volledigheid, niet gebruikt in berekening
                };
            } else if (item.selling_price !== undefined || item.material_cost !== undefined) {
                // Legacy format support - direct properties
                priceData = {
                    selling_price: item.selling_price,
                    material_cost: item.material_cost,
                    labor_cost: item.labor_cost // Alleen voor volledigheid, niet gebruikt in berekening
                };
            }
            
            // Zorg ervoor dat alle velden numeriek zijn
            const amount = parseInt(item.amount) || 1;
            const sellingPrice = parseFloat(priceData.selling_price) || 0;
            const hasPrice = sellingPrice > 0;
            const revenue = amount * sellingPrice;
            
            // Begin normale materiaalkosten berekening
            let materialCost = amount * (parseFloat(priceData.material_cost) || 0);
            let houtKost = 0;
            let hulpstoffen = 0;
            
            // Haal gedetailleerde materiaalkosten op als beschikbaar
            if (item.materiaal_details) {
                // Use detailed costs from order_items if available
                const unitHoutKost = item.materiaal_details.hout_kost || 0;
                const unitHulpstoffen = item.materiaal_details.hulpstoffen || 0;

                houtKost = unitHoutKost * amount;
                hulpstoffen = unitHulpstoffen * amount;
                
                // The total material cost for the item is the sum of its detailed components
                if (houtKost + hulpstoffen > 0) {
                    materialCost = houtKost + hulpstoffen;
                } else {
                    // No materiaal_details from order_items, check if we have the new fields in item_prices
                    const priceItem = priceMap[item.item_number] || {};
                    
                    if (priceItem && (priceItem.houtkosten !== null || priceItem.materiaalkosten !== null)) {
                        // Use the detailed costs from item_prices table
                        houtKost = (priceItem.houtkosten || 0) * amount;
                        hulpstoffen = (priceItem.materiaalkosten || 0) * amount;
                        materialCost = houtKost + hulpstoffen;
                        console.log(`Using item_prices data for ${item.item_number}: hout=${priceItem.houtkosten}, materiaal=${priceItem.materiaalkosten}`);
                    } else {
                        // Last resort - use the general material_cost from item_prices
                        materialCost = amount * (parseFloat(priceItem.material_cost) || 0);
                        // In this case, no breakdown of costs
                    }
                }
            } else {
                // No materiaal_details from order_items, check if we have the new fields in item_prices
                const priceItem = priceMap[item.item_number] || {};
                
                if (priceItem && (priceItem.houtkosten !== null || priceItem.materiaalkosten !== null)) {
                    // Use the detailed costs from item_prices table
                    houtKost = (priceItem.houtkosten || 0) * amount;
                    hulpstoffen = (priceItem.materiaalkosten || 0) * amount;
                    materialCost = houtKost + hulpstoffen;
                    console.log(`Using item_prices data for ${item.item_number}: hout=${priceItem.houtkosten}, materiaal=${priceItem.materiaalkosten}`);
                } else {
                    // Last resort - use the general material_cost from item_prices
                    materialCost = amount * (parseFloat(priceItem.material_cost) || 0);
                    // In this case, no breakdown of costs
                }
            }
            
            // Bereken overhead (20% van de omzet voor dit item)
            const itemOverhead = revenue * 0.20;
            dayData[dateStr].overhead += itemOverhead;
            
            // Debug logging voor prijsberekening
            if (revenue > 0) {
                console.log(`Item ${item.item_number} berekening:`, {
                    aantal: amount,
                    verkoopprijs: parseFloat(priceData.selling_price),
                    omzet: revenue,
                    materiaalkosten: materialCost,
                    houtkosten: houtKost,
                    hulpstoffen: hulpstoffen
                });
            } else {
                console.warn(`Item ${item.item_number} heeft geen geldige verkoopprijs:`, priceData.selling_price);
            }
            
            dayData[dateStr].itemCount += amount;
            dayData[dateStr].revenue += revenue;
            dayData[dateStr].materialCost += materialCost;
            dayData[dateStr].houtKosten += houtKost;
            dayData[dateStr].hulpstoffenKosten += hulpstoffen;
            // laborCost wordt per dag berekend op basis van uren, niet per item hier direct
            
            // Herbereken totalCost en profit voor de dag
            // totalCost = Materiaalkosten van alle items + Arbeidskosten van de dag
            // De laborCost voor de dag is al berekend en staat in dayData[dateStr].laborCost
            dayData[dateStr].totalCost = dayData[dateStr].materialCost + dayData[dateStr].laborCost;
            dayData[dateStr].profit = dayData[dateStr].revenue - dayData[dateStr].totalCost;
            
            // Bereken marge (als percentage) op basis van (Omzet - Totale Kosten) / Omzet
            // Waarbij Totale Kosten = Materiaal + Arbeid (exclusief overhead)
            if (dayData[dateStr].revenue > 0) {
                dayData[dateStr].margin = (dayData[dateStr].profit / dayData[dateStr].revenue) * 100;
            }
            
            // Bewaar het volledige item voor latere weergave
            dayData[dateStr].items.push({
                ...item,
                hasPrice: hasPrice
            });
            
            // Tel items zonder prijs
            if (!hasPrice) {
                dayData[dateStr].itemsWithoutPrice++;
                console.log(`Item zonder verkoopprijs gedetecteerd: ${item.item_number}, prijs=${sellingPrice}, origineel=${priceData.selling_price}`);
            }
        });

        // Log een samenvatting van de verwerkte gegevens
        console.log("Samenvatting van verwerkte gegevens per dag:", dayData);

        // Converteer naar array en sorteer op datum
        prepackData = Object.values(dayData).sort((a, b) => {
            return new Date(a.date) - new Date(b.date);
        });

        // Log het eindresultaat
        console.log("Eindresultaat voor UI update:", prepackData);

        // Update UI met de nieuwe data
        updateUI(prepackData);
    }

    // Update de UI met de verwerkte data
    function updateUI(data) {
        updateTotals(data);
        updateCharts(data);
        updateDataTable(data);
    }

    // Update totalen
    function updateTotals(data) {
        let totalRevenue = 0;
        let totalCosts = 0;
        let totalProfit = 0;
        let totalHours = 0;
        let totalItemCount = 0; // Totaal aantal verpakte items bijhouden
        let totalOverhead = 0; // Totaal overhead bijhouden

        data.forEach(day => {
            totalRevenue += day.revenue;
            totalCosts += day.totalCost;
            totalProfit += day.profit;
            totalHours += day.laborHours;
            totalItemCount += day.itemCount; // Tel het totaal aantal verpakte items
            totalOverhead += (day.overhead || 0); // Tel de totale overhead op
        });

        document.getElementById('total-revenue').textContent = formatCurrency(totalRevenue);
        document.getElementById('total-costs').textContent = formatCurrency(totalCosts);
        
        const profitElement = document.getElementById('total-profit');
        profitElement.textContent = formatCurrency(totalProfit);
        profitElement.classList.remove('profit', 'loss');
        profitElement.classList.add(totalProfit >= 0 ? 'profit' : 'loss');
        
        document.getElementById('total-hours').textContent = formatHours(totalHours);
        
        // Update of maak de stat-box voor Totaal Verpakte Items
        updateOrCreateStatBox('total-items-stat', 'total-items', totalItemCount, 'Totaal Verpakte Items', document.getElementById('total-hours').closest('.col-lg-3.col-md-6'));

        // Update of maak de stat-box voor Totale Overhead
        // We plaatsen deze naast de Totaal Verpakte Items, of op een nieuwe rij als die er niet is.
        const referenceElementForOverhead = document.getElementById('total-items-stat') || document.getElementById('total-hours').closest('.col-lg-3.col-md-6');
        updateOrCreateStatBox('total-overhead-stat', 'total-overhead', formatCurrency(totalOverhead), 'Totale Overhead (€)', referenceElementForOverhead, true);
    }

    // Helper functie om een stat-box te updaten of te creëren
    function updateOrCreateStatBox(elementId, valueElementId, value, label, referenceElement, placeInNewRow = false) {
        let statBoxContainer = document.getElementById(elementId);
        if (!statBoxContainer) {
            const statsRow = referenceElement.closest('.row');
            let targetRow = statsRow;

            if (placeInNewRow || !statsRow.querySelector('.col-lg-3:nth-child(4)')) { // als we een nieuwe rij nodig hebben of de huidige vol is
                const newRowElement = document.createElement('div');
                newRowElement.className = 'row mt-3'; // mt-3 voor wat ruimte
                statsRow.parentNode.insertBefore(newRowElement, statsRow.nextSibling);
                targetRow = newRowElement;
            }
            
            statBoxContainer = document.createElement('div');
            statBoxContainer.id = elementId;
            statBoxContainer.className = 'col-lg-3 col-md-6'; // Standaardgrootte voor stat boxes

            const newStatBox = document.createElement('div');
            newStatBox.className = 'stat-box';
            newStatBox.innerHTML = `
                <div class="stat-value" id="${valueElementId}">${value}</div>
                <div class="stat-label">${label}</div>
            `;
            statBoxContainer.appendChild(newStatBox);
            targetRow.appendChild(statBoxContainer);
            console.log(`Statistiek voor '${label}' toegevoegd.`);
        } else {
            document.getElementById(valueElementId).textContent = value;
            console.log(`Statistiek voor '${label}' geüpdatet.`);
        }
    }

    // Update grafieken
    function updateCharts(data) {
        updateRevenueChart(data);
        updateHoursChart(data);
    }

    // Update omzet en kosten grafiek
    function updateRevenueChart(data) {
        const ctx = document.getElementById('revenue-chart').getContext('2d');
        
        // Data voorbereiden
        const labels = data.map(day => formatDateShort(day.date));
        const revenueData = data.map(day => day.revenue);
        const costsData = data.map(day => day.totalCost);
        const profitData = data.map(day => day.profit);
        
        // Verwijder oude grafiek als die bestaat
        if (revenueChart) {
            revenueChart.destroy();
        }
        
        // Maak nieuwe grafiek
        revenueChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Omzet',
                        data: revenueData,
                        backgroundColor: 'rgba(54, 162, 235, 0.5)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Kosten',
                        data: costsData,
                        backgroundColor: 'rgba(255, 99, 132, 0.5)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Marge',
                        data: profitData,
                        type: 'line',
                        backgroundColor: 'rgba(75, 192, 192, 0.5)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 2,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Update uren grafiek
    function updateHoursChart(data) {
        const ctx = document.getElementById('hours-chart').getContext('2d');
        
        // Data voorbereiden
        const labels = data.map(day => formatDateShort(day.date));
        const hoursData = data.map(day => day.laborHours);
        
        // Verwijder oude grafiek als die bestaat
        if (hoursChart) {
            hoursChart.destroy();
        }
        
        // Maak nieuwe grafiek
        hoursChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Arbeidsuren',
                        data: hoursData,
                        backgroundColor: 'rgba(153, 102, 255, 0.5)',
                        borderColor: 'rgba(153, 102, 255, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Update data tabel
    function updateDataTable(data) {
        const tableBody = document.getElementById('data-table-body');
        tableBody.innerHTML = '';
        
        // Count how many days have items without prices
        const daysWithMissingPrices = data.filter(day => day.itemsWithoutPrice > 0).length;
        
        // Sort the data to show days with items without prices at the top
        const sortedData = [...data].sort((a, b) => {
            // First sort by whether the day has items without prices (days with items without prices come first)
            if (a.itemsWithoutPrice > 0 && b.itemsWithoutPrice === 0) return -1;
            if (a.itemsWithoutPrice === 0 && b.itemsWithoutPrice > 0) return 1;
            // Then sort by date (newest first)
            return new Date(b.date) - new Date(a.date);
        });
        
        // Add a header for days with missing prices if there are any
        if (daysWithMissingPrices > 0) {
            const headerRow = document.createElement('tr');
            headerRow.classList.add('table-danger', 'section-header');
            headerRow.innerHTML = `<td colspan="10"><strong>Dagen met ontbrekende prijzen (${daysWithMissingPrices})</strong></td>`;
            tableBody.appendChild(headerRow);
        }
        
        // Track if we need to insert a header for days with complete prices
        let hasInsertedCompleteHeader = false;
        
        sortedData.forEach(day => {
            // Add a header row for days with complete pricing when we transition from missing to complete
            if (day.itemsWithoutPrice === 0 && !hasInsertedCompleteHeader && daysWithMissingPrices > 0) {
                const completeHeader = document.createElement('tr');
                completeHeader.classList.add('table-success', 'section-header');
                completeHeader.innerHTML = `<td colspan="10"><strong>Dagen met volledige prijsgegevens (${data.length - daysWithMissingPrices})</strong></td>`;
                tableBody.appendChild(completeHeader);
                hasInsertedCompleteHeader = true;
            }
            
            const row = document.createElement('tr');
            
            // Maak rijen klikbaar
            row.style.cursor = 'pointer';
            row.classList.add('clickable-row');
            
            // Add warning class to rows that have items without price
            if (day.itemsWithoutPrice > 0) {
                row.classList.add('table-warning');
            }
            
            // Voeg data-attributen toe voor de dag
            row.setAttribute('data-date', day.date);
            
            // Format de gegevens
            const formattedDate = formatDateDisplay(day.date);
            const formattedRevenue = formatCurrency(day.revenue);
            const formattedMaterialCost = formatCurrency(day.materialCost);
            const formattedLaborCost = formatCurrency(day.laborCost);
            const formattedTotalCost = formatCurrency(day.totalCost);
            const formattedOverhead = formatCurrency(day.overhead || 0);
            const formattedProfit = formatCurrency(day.profit);
            const formattedMargin = day.margin.toFixed(2) + '%';
            const formattedHours = formatHours(day.laborHours);
            
            // Kleur voor winst/verlies
            const profitClass = day.profit >= 0 ? 'profit' : 'loss';
            
            // Voeg waarschuwingsbadge toe voor items zonder prijs
            let priceWarning = '';
            if (day.itemsWithoutPrice > 0) {
                priceWarning = `<span class="badge bg-warning ms-1" title="${day.itemsWithoutPrice} items zonder prijsgegevens">${day.itemsWithoutPrice} zonder prijs</span>`;
            }
            
            // Maak tooltip voor materialCost met opsplitsing
            const houtKosten = day.houtKosten || 0;
            const hulpstoffenKosten = day.hulpstoffenKosten || 0;
            const materiaalTooltip = `Hout: ${formatCurrency(houtKosten)}, Hulpstoffen: ${formatCurrency(hulpstoffenKosten)}`;
            
            row.innerHTML = `
                <td>${formattedDate}</td>
                <td>${day.itemCount} ${priceWarning}</td>
                <td>${formattedRevenue}</td>
                <td title="${materiaalTooltip}">${formattedMaterialCost}</td>
                <td>${formattedLaborCost}</td>
                <td>${formattedTotalCost}</td>
                <td>${formattedOverhead}</td>
                <td class="editable-hours" data-date="${day.date}" style="${isEditMode ? 'cursor: pointer; background-color: #e3f2fd;' : ''}">${formattedHours}</td>
                <td class="${profitClass}">${formattedProfit}</td>
                <td>${formattedMargin}</td>
            `;
            
            // Voeg click event toe om details te tonen (alleen in view mode)
            if (!isEditMode) {
                row.addEventListener('click', () => {
                    showDayDetails(day);
                });
            } else {
                // In edit mode, maak arbeidsuren bewerkbaar
                const hoursCell = row.querySelector('.editable-hours');
                hoursCell.addEventListener('click', (e) => {
                    e.stopPropagation();
                    makeEditable(hoursCell, day.laborHours, (newValue) => {
                        day.laborHours = newValue;
                        // Herbereken kosten en winst
                        day.laborCost = day.laborHours * 40;
                        day.totalCost = day.materialCost + day.laborCost;
                        day.profit = day.revenue - day.totalCost;
                        if (day.revenue > 0) {
                            day.margin = (day.profit / day.revenue) * 100;
                        }
                        // Update de hele UI
                        updateUI(prepackData);
                    });
                });
            }
            
            tableBody.appendChild(row);
        });
    }

    // Toggle edit mode functionaliteit
    function toggleEditMode() {
        console.log('toggleEditMode called, current isEditMode:', isEditMode);
        
        isEditMode = !isEditMode;
        
        console.log('New isEditMode value:', isEditMode);
        
        if (isEditMode) {
            console.log('Entering edit mode...');
            // Sla originele data op voor cancel functionaliteit
            originalData = JSON.parse(JSON.stringify(prepackData));
            console.log('Original data saved:', originalData.length, 'days');
            
            // Update UI naar edit mode
            const editBtn = document.getElementById('edit-mode-btn');
            const exportBtn = document.getElementById('export-data-btn');
            const saveBtn = document.getElementById('save-changes-btn');
            const cancelBtn = document.getElementById('cancel-changes-btn');
            
            if (editBtn) editBtn.style.display = 'none';
            if (exportBtn) exportBtn.style.display = 'none';
            if (saveBtn) saveBtn.style.display = 'inline-block';
            if (cancelBtn) cancelBtn.style.display = 'inline-block';
            
            console.log('UI updated for edit mode');
            
            showSuccessMessage('Bewerkingsmodus geactiveerd. Klik op cellen om ze te bewerken.');
        } else {
            console.log('Exiting edit mode...');
            // Reset naar view mode
            exitEditMode();
        }
        
        console.log('Updating data table...');
        // Update de tabel
        updateDataTable(prepackData);
        console.log('Data table updated');
    }

    // Exit edit mode
    function exitEditMode() {
        isEditMode = false;
        
        // Update UI terug naar view mode
        document.getElementById('edit-mode-btn').style.display = 'inline-block';
        document.getElementById('export-data-btn').style.display = 'inline-block';
        document.getElementById('save-changes-btn').style.display = 'none';
        document.getElementById('cancel-changes-btn').style.display = 'none';
    }

    // Save changes functionaliteit
    async function saveChanges() {
        const loadingOverlay = createLoadingOverlay();
        document.body.appendChild(loadingOverlay);
        
        try {
            // Verzamel alle wijzigingen
            const changes = [];
            const upsertCostItems = []; // Voor gedetailleerde kosten via upsert_costs endpoint
            
            prepackData.forEach(day => {
                const originalDay = originalData.find(d => d.date === day.date);
                
                // Check voor wijzigingen in arbeidsuren
                if (originalDay && day.laborHours !== originalDay.laborHours) {
                    changes.push({
                        type: 'labor_hours',
                        date: day.date,
                        oldValue: originalDay.laborHours,
                        newValue: day.laborHours
                    });
                }
                
                // Check voor wijzigingen in item prijzen
                day.items.forEach(item => {
                    const originalItem = originalDay.items.find(i => i.id === item.id);
                    if (originalItem && item.price_data && originalItem.price_data) {
                        if (item.price_data.selling_price !== originalItem.price_data.selling_price) {
                            changes.push({
                                type: 'selling_price',
                                itemId: item.id,
                                itemNumber: item.item_number,
                                oldValue: originalItem.price_data.selling_price,
                                newValue: item.price_data.selling_price
                            });
                        }
                        
                        // Voor ALLE material_cost wijzigingen: sla zowel general als detailed costs op
                        if (item.price_data.material_cost !== originalItem.price_data.material_cost) {
                            // 1. Voeg general material_cost change toe
                            changes.push({
                                type: 'material_cost',
                                itemId: item.id,
                                itemNumber: item.item_number,
                                oldValue: originalItem.price_data.material_cost,
                                newValue: item.price_data.material_cost
                            });
                            
                            // 2. Bereken de opsplitsing voor houtkosten en materiaalkosten
                            let houtkosten = 0;
                            let materiaalkosten = 0;
                            
                            if (item.materiaal_details && (item.materiaal_details.hout_kost > 0 || item.materiaal_details.hulpstoffen > 0)) {
                                // Er zijn gedetailleerde kosten, gebruik deze direct
                                houtkosten = item.materiaal_details.hout_kost || 0;
                                materiaalkosten = item.materiaal_details.hulpstoffen || 0;
                            } else {
                                // Geen gedetailleerde kosten, splits 50/50
                                houtkosten = item.price_data.material_cost * 0.5;
                                materiaalkosten = item.price_data.material_cost * 0.5;
                            }
                            
                            // 3. Voeg toe aan upsertCostItems voor detailed costs endpoint
                            upsertCostItems.push({
                                item_number: item.item_naam || item.item_number, // Gebruik item_naam eerst (zoals add_order.js doet)
                                houtkosten: houtkosten,
                                materiaalkosten: materiaalkosten
                            });
                            
                            console.log(`Material cost change for ${item.item_number}: total=${item.price_data.material_cost}, hout=${houtkosten}, materiaal=${materiaalkosten}`);
                        }
                        
                        // Check voor DIRECTE wijzigingen in gedetailleerde kosten (houtkosten en materiaalkosten)
                        const currentHoutkosten = item.materiaal_details?.hout_kost || 0;
                        const currentMaterialkosten = item.materiaal_details?.hulpstoffen || 0;
                        const originalHoutkosten = originalItem.materiaal_details?.hout_kost || 0;
                        const originalMaterialkosten = originalItem.materiaal_details?.hulpstoffen || 0;
                        
                        if (currentHoutkosten !== originalHoutkosten || currentMaterialkosten !== originalMaterialkosten) {
                            // Voeg toe aan upsertCostItems (check of deze item_number er al in staat)
                            const itemKey = item.item_naam || item.item_number; // Gebruik item_naam eerst (zoals add_order.js doet)
                            const existingIndex = upsertCostItems.findIndex(upsertItem => upsertItem.item_number === itemKey);
                            if (existingIndex >= 0) {
                                // Update bestaande entry
                                upsertCostItems[existingIndex].houtkosten = currentHoutkosten;
                                upsertCostItems[existingIndex].materiaalkosten = currentMaterialkosten;
                            } else {
                                // Voeg nieuwe entry toe
                                upsertCostItems.push({
                                    item_number: itemKey,
                                    houtkosten: currentHoutkosten,
                                    materiaalkosten: currentMaterialkosten
                                });
                            }
                            
                            // Update ook de general material_cost
                            const newTotalCost = currentHoutkosten + currentMaterialkosten;
                            if (item.price_data.material_cost !== newTotalCost) {
                                changes.push({
                                    type: 'material_cost',
                                    itemId: item.id,
                                    itemNumber: item.item_number,
                                    oldValue: item.price_data.material_cost,
                                    newValue: newTotalCost
                                });
                            }
                            
                            console.log(`Detailed cost change for ${item.item_number}: hout=${currentHoutkosten}, materiaal=${currentMaterialkosten}, total=${newTotalCost}`);
                        }
                    }
                });
            });
            
            if (changes.length === 0 && upsertCostItems.length === 0) {
                showSuccessMessage('Geen wijzigingen om op te slaan.');
                exitEditMode();
                document.body.removeChild(loadingOverlay);
                return;
            }
            
            // Voer beide API calls parallel uit
            const promises = [];
            
            // 1. Sla general changes op via bestaande endpoint
            if (changes.length > 0) {
                promises.push(
                    fetch('/api/prepack/save_changes', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ changes })
                    }).then(response => {
                        if (!response.ok) {
                            throw new Error(`General changes fout: ${response.status}`);
                        }
                        return response.json();
                    })
                );
            }
            
            // 2. Sla detailed costs op via upsert_costs endpoint
            if (upsertCostItems.length > 0) {
                promises.push(
                    fetch('/api/item_prices/upsert_costs', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ items: upsertCostItems })
                    }).then(response => {
                        if (!response.ok) {
                            throw new Error(`Detailed costs fout: ${response.status}`);
                        }
                        return response.json();
                    })
                );
            }
            
            // Wacht tot beide calls klaar zijn
            const results = await Promise.all(promises);
            
            showSuccessMessage(`${changes.length} general en ${upsertCostItems.length} detailed cost wijzigingen succesvol opgeslagen.`);
            exitEditMode();
            
            // Herlaad data om zeker te zijn dat alles up-to-date is
            const startDateStr = document.getElementById('start-date').value;
            const endDateStr = document.getElementById('end-date').value;
            if (startDateStr && endDateStr) {
                loadDataForDateRange(startDateStr, endDateStr);
            } else {
                const dateRange = document.getElementById('date-range').value;
                loadData(parseInt(dateRange) || 30);
            }
            
        } catch (error) {
            console.error('Fout bij opslaan:', error);
            showErrorMessage(`Fout bij opslaan: ${error.message}`);
        } finally {
            document.body.removeChild(loadingOverlay);
        }
    }

    // Cancel changes functionaliteit
    function cancelChanges() {
        if (originalData && Object.keys(originalData).length > 0) {
            prepackData = JSON.parse(JSON.stringify(originalData));
            updateUI(prepackData);
        }
        
        exitEditMode();
        showSuccessMessage('Wijzigingen geannuleerd.');
    }

    // Helper functie om een cel bewerkbaar te maken
    function makeEditable(element, value, onSave, type = 'number') {
        // Voorkom dubbele bewerking
        if (element.querySelector('input')) {
            return;
        }
        
        const input = document.createElement('input');
        input.type = type;
        input.value = value;
        input.className = 'form-control form-control-sm';
        input.style.width = '100%';
        
        // Bewaar originele content voor fallback
        const originalContent = element.innerHTML;
        
        // Flag om dubbele uitvoering te voorkomen
        let isFinished = false;
        
        // Focus en selecteer de tekst
        setTimeout(() => {
            if (!isFinished && element.contains(input)) {
                input.focus();
                input.select();
            }
        }, 10);
        
        const cleanup = () => {
            if (element.contains(input)) {
                element.removeChild(input);
            }
        };
        
        const save = () => {
            if (isFinished) return;
            isFinished = true;
            
            const newValue = type === 'number' ? parseFloat(input.value) || 0 : input.value;
            
            try {
                cleanup();
                onSave(newValue);
                
                const displayValue = type === 'number' ? 
                    (originalContent.includes('€') ? formatCurrency(newValue) : newValue.toFixed(2)) : 
                    newValue;
                element.innerHTML = displayValue;
                
            } catch (error) {
                console.error('Error in save function:', error);
                element.innerHTML = originalContent;
            }
        };
        
        const cancel = () => {
            if (isFinished) return;
            isFinished = true;
            
            try {
                cleanup();
                element.innerHTML = originalContent;
            } catch (error) {
                console.error('Error in cancel function:', error);
                element.innerHTML = originalContent;
            }
        };
        
        const keyHandler = (e) => {
            if (isFinished) return;
            
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                save();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                cancel();
            }
        };
        
        const blurHandler = () => {
            if (!isFinished) {
                save();
            }
        };
        
        input.addEventListener('blur', blurHandler);
        input.addEventListener('keydown', keyHandler);
        
        element.innerHTML = '';
        element.appendChild(input);
    }

    // Export data naar Excel
    function exportDataAsExcel() {
        if (!prepackData || prepackData.length === 0) {
            alert('Er is geen data om te exporteren');
            return;
        }

        // Definieer de header. We voegen een extra 'Verborgen_Omzet' kolom toe voor de margeberekening
        // om problemen met circulaire verwijzingen te voorkomen als we de geformatteerde omzet direct gebruiken.
        const header = [
            'Datum',                // A
            'Aantal Items',         // B
            'Omzet (€)',            // C
            'Materiaalkosten (€)',  // D
            'Arbeidskosten (€)',    // E
            'Totale Kosten (€)',    // F (D+E)
            'Overhead (€)',         // G (C*0.20)
            'Arbeidsuren (u)',      // H
            'Marge (€)',            // I (C-F)
            'Marge (%)'             // J (I/C)
        ];

        // Creëer data voor het werkblad, beginnend met de header
        const sheetData = [header];

        // Voeg datarijen toe met formules
        prepackData.forEach((day, index) => {
            const rowIndex = index + 2; // Excel rijen zijn 1-based, header is rij 1

            const revenue = parseFloat(day.revenue.toFixed(2));
            const materialCost = parseFloat(day.materialCost.toFixed(2));
            const laborCost = parseFloat(day.laborCost.toFixed(2));
            // totalCost, overhead, profit, margin worden door formules berekend in Excel

            sheetData.push([
                { v: formatDateDisplay(day.date), t: 's' },                                  // Datum (String)
                { v: day.itemCount, t: 'n' },                                                // Aantal Items (Number)
                { v: revenue, t: 'n', z: '"€"#,##0.00' },                                    // Omzet (Number, met valutaformat)
                { v: materialCost, t: 'n', z: '"€"#,##0.00' },                               // Materiaalkosten (Number, met valutaformat)
                { v: laborCost, t: 'n', z: '"€"#,##0.00' },                                  // Arbeidskosten (Number, met valutaformat)
                { f: `D${rowIndex}+E${rowIndex}`, t: 'n', z: '"€"#,##0.00' },                 // Totale Kosten (Formule, D+E)
                { f: `C${rowIndex}*0.20`, t: 'n', z: '"€"#,##0.00' },                         // Overhead (Formule, C*0.20)
                { v: parseFloat(day.laborHours.toFixed(2)), t: 'n', z: '#,##0.00"u"' },     // Arbeidsuren (Number, met "u" format)
                { f: `C${rowIndex}-F${rowIndex}`, t: 'n', z: '"€"#,##0.00' },                 // Marge (€) (Formule, C-F)
                { f: `I${rowIndex}/C${rowIndex}`, t: 'n', z: '0.00%' }                       // Marge (%) (Formule, I/C)
            ]);
        });

        // Creëer worksheet, maar nu vanuit een array van cell-objecten
        const ws = XLSX.utils.aoa_to_sheet(sheetData);

        // Pas kolombreedtes aan
        const colWidths = header.map((h, i) => {
            let maxLength = h.length; // Begin met lengte van header
            sheetData.slice(1).forEach(row => { // Slice(1) om header over te slaan
                const cell = row[i];
                let cellValueString = '';
                if (cell) {
                    if (cell.f) { // Als het een formule is, neem een geschatte lengte of format
                        cellValueString = "###########"; // Placeholder voor formule-resultaat lengte
                         if (cell.z && cell.z.includes('€')) cellValueString = "€ #,##0.00";
                         else if (cell.z && cell.z.includes('%')) cellValueString = "00.00%";
                    } else if (cell.v !== undefined && cell.v !== null) {
                        cellValueString = String(cell.v);
                    }
                }
                if (cellValueString.length > maxLength) {
                    maxLength = cellValueString.length;
                }
            });
             // Zorg voor een minimumbreedte voor valuta en percentages
            if (header[i].includes('(€)') || header[i].includes('(u)')) maxLength = Math.max(maxLength, 12);
            if (header[i].includes('(%)')) maxLength = Math.max(maxLength, 8);
            return { wch: maxLength + 2 };
        });
        ws['!cols'] = colWidths;
        
        // Voeg auto-filter toe aan de header rij
        ws['!autofilter'] = { ref: XLSX.utils.encode_range(XLSX.utils.decode_range(ws['!ref'])) };


        // Creëer workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Nacalculatie Prepack');

        // --- Nieuw tabblad: Verpakte Item Details ---
        const itemsDetailsHeader = [
            'Verpakkingsdatum',
            'Artikelnummer',
            'PO-nummer',
            'Aantal',
            'Verkoopprijs per stuk (€)',
            'Totale Verkoopprijs (€)',
            'Materiaalkost per stuk (€)',
            'Totale Materiaalkost (€)'
        ];

        const itemsDetailsRows = [];
        prepackData.forEach(day => {
            day.items.forEach(item => {
                const amount = parseInt(item.amount) || 1;
                const sellingPrice = parseFloat(item.price_data?.selling_price || item.selling_price || 0);
                const materialCost = parseFloat(item.price_data?.material_cost || item.material_cost || 0);
                
                itemsDetailsRows.push([
                    formatDateDisplay(day.date), // Gebruik de gegroepeerde dag-datum
                    item.item_number,
                    item.po_number || '-',
                    amount,
                    sellingPrice,
                    amount * sellingPrice,
                    materialCost,
                    amount * materialCost
                ]);
            });
        });

        const wsItems = XLSX.utils.aoa_to_sheet([itemsDetailsHeader, ...itemsDetailsRows]);

        // Kolombreedtes voor item details tabblad
        const itemsColWidths = [
            { wch: 18 }, // Verpakkingsdatum
            { wch: 20 }, // Artikelnummer
            { wch: 15 }, // PO-nummer
            { wch: 10 }, // Aantal
            { wch: 25 }, // Verkoopprijs per stuk (€)
            { wch: 25 }, // Totale Verkoopprijs (€)
            { wch: 25 }, // Materiaalkost per stuk (€)
            { wch: 25 }  // Totale Materiaalkost (€)
        ];
        wsItems['!cols'] = itemsColWidths;

        // Valutaformattering toepassen op relevante kolommen
        const currencyItemCols = [4, 5, 6, 7]; // E, F, G, H (0-geïndexeerd)
        for (let R = 1; R < itemsDetailsRows.length + 1; ++R) { // Start vanaf rij 1 (na header)
            currencyItemCols.forEach(C => {
                const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
                if (wsItems[cellRef] && typeof wsItems[cellRef].v === 'number') {
                    wsItems[cellRef].t = 'n';
                    wsItems[cellRef].z = '"€"#,##0.00';
                }
            });
        }
        
        // Auto-filter toevoegen aan de header rij van het item details tabblad
        wsItems['!autofilter'] = { ref: XLSX.utils.encode_range(XLSX.utils.decode_range(wsItems['!ref'])) };


        XLSX.utils.book_append_sheet(wb, wsItems, 'Verpakte Item Details');
        // --- Einde nieuw tabblad ---

        // Genereer en download het Excel bestand
        const fileName = `prepack_analyse_${formatDate(new Date())}.xlsx`;
        XLSX.writeFile(wb, fileName);
    }

    // Verwijder de generateDummyData functie en vervang door een gebruikersvriendelijke foutmelding
    function showErrorMessage(errorMsg) {
        // Verwijder bestaande foutmeldingen
        const existingAlerts = document.querySelectorAll('.alert-danger');
        existingAlerts.forEach(alert => alert.remove());
        
        // Toon foutmelding boven de grafieken
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-danger';
        alertDiv.innerHTML = `
            <h4 class="alert-heading">Fout bij laden data</h4>
            <p>${errorMsg}</p>
        `;
        
        // Plaats de melding bovenaan de pagina
        const container = document.querySelector('.container-fluid');
        container.insertBefore(alertDiv, container.querySelector('.row'));
        
        // Leeg de tabellen en grafieken
        document.getElementById('total-revenue').textContent = '€0,00';
        document.getElementById('total-costs').textContent = '€0,00';
        document.getElementById('total-profit').textContent = '€0,00';
        document.getElementById('total-hours').textContent = '0u';
        
        // Leeg de tabel
        document.getElementById('data-table-body').innerHTML = '';
        
        // Toon lege grafieken
        updateRevenueChart([]);
        updateHoursChart([]);
    }

    // Show a success message
    function showSuccessMessage(message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-success alert-dismissible fade show';
        alertDiv.role = 'alert';
        alertDiv.innerHTML = `
            <strong>Succes!</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        // Insert the alert at the top of the container
        const container = document.querySelector('.container-fluid');
        container.insertBefore(alertDiv, container.firstChild);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                const bsAlert = new bootstrap.Alert(alertDiv);
                bsAlert.close();
            }
        }, 5000);
    }

    // Helper functie voor het formatteren van datum naar YYYY-MM-DD
    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Helper functie voor het formatteren van datum naar DD-MM-YYYY
    function formatDateDisplay(dateStr) {
        const parts = dateStr.split('-');
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    // Helper functie voor het formatteren van datum naar DD MMM
    function formatDateShort(dateStr) {
        const date = new Date(dateStr);
        const day = String(date.getDate()).padStart(2, '0');
        const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
        const month = months[date.getMonth()];
        return `${day} ${month}`;
    }

    // Helper functie voor het formatteren van valuta
    function formatCurrency(value) {
        return '€' + value.toFixed(2).replace('.', ',');
    }

    // Helper functie voor het formatteren van uren
    function formatHours(hours) {
        return hours.toFixed(2).replace('.', ',') + 'u';
    }

    // Helper functie om een laadscherm te maken
    function createLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = 0;
        overlay.style.left = 0;
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.zIndex = 9999;
        
        const spinner = document.createElement('div');
        spinner.className = 'spinner-border text-primary';
        spinner.setAttribute('role', 'status');
        
        const text = document.createElement('span');
        text.className = 'ms-2';
        text.textContent = 'Data laden...';
        
        overlay.appendChild(spinner);
        overlay.appendChild(text);
        
        return overlay;
    }

    // Functie om details van een dag te tonen
    function showDayDetails(day) {
        // Creëer een modal voor de details
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'dayDetailsModal';
        modal.setAttribute('tabindex', '-1');
        modal.setAttribute('aria-labelledby', 'dayDetailsModalLabel');
        modal.setAttribute('aria-hidden', 'true');
        
        // Datum formatteren voor weergave
        const formattedDate = formatDateDisplay(day.date);
        
        // Tabel met items maken
        let itemsTableHTML = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Artikel Nr.</th>
                            <th>PO nummer</th>
                            <th>Aantal</th>
                            <th>Verkoopprijs</th>
                            <th>Houtkosten</th>
                            <th>Hulpstoffen</th>
                            <th>Materiaalkosten</th>
                            <th>Arbeidskosten</th>
                            <th>Totaal</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Sorteer items: eerst die zonder prijs, dan op artikelnummer
        const sortedItems = [...day.items].sort((a, b) => {
            // Check if selling price is 0 or missing
            const aHasPrice = parseFloat(a.price_data?.selling_price || a.selling_price || 0) > 0;
            const bHasPrice = parseFloat(b.price_data?.selling_price || b.selling_price || 0) > 0;
            
            // Eerst op prijs status (items zonder prijs eerst)
            if (aHasPrice !== bHasPrice) {
                return aHasPrice ? 1 : -1;
            }
            // Dan op artikelnummer
            return a.item_number.localeCompare(b.item_number);
        });
        
        // Create a status header row if there are items without price
        if (day.itemsWithoutPrice > 0) {
            itemsTableHTML += `
                <tr class="table-danger section-header">
                    <td colspan="10">
                        <strong>Items zonder verkoopprijs (${day.itemsWithoutPrice})</strong>
                    </td>
                </tr>
            `;
        }

        // Track if we've inserted the header for items with price
        let hasInsertedPricedItemsHeader = false;
        
        // Items toevoegen aan tabel
        sortedItems.forEach(item => {
            const priceData = item.price_data || {
                selling_price: item.selling_price || 0,
                material_cost: item.material_cost || 0,
                labor_cost: 0 // We gebruiken labor_cost niet meer per item
            };
            
            const amount = parseInt(item.amount) || 1;
            const sellingPrice = parseFloat(priceData.selling_price) || 0;
            const hasPrice = sellingPrice > 0; // Check if price is greater than zero
            
            // Initial material cost per unit from item_prices or item's direct properties
            const initialUnitMaterialCostFromPriceData = parseFloat(priceData.material_cost) || 0; 
            
            let houtKostForDisplay = 0;
            let hulpstoffenForDisplay = 0;
            let finalTotalItemMaterialCost = 0; // This will be the total material cost for all units of the item

            if (item.materiaal_details) {
                // Use detailed costs from order_items if available
                const unitHoutKost = item.materiaal_details.hout_kost || 0;
                const unitHulpstoffen = item.materiaal_details.hulpstoffen || 0;

                houtKostForDisplay = unitHoutKost * amount;
                hulpstoffenForDisplay = unitHulpstoffen * amount;
                
                // The total material cost for the item is the sum of its detailed components
                if (houtKostForDisplay + hulpstoffenForDisplay > 0) {
                    finalTotalItemMaterialCost = houtKostForDisplay + hulpstoffenForDisplay;
                } else {
                    // Fallback if detailed costs are zero (e.g. if an item has materiaal_details but all costs are 0)
                    finalTotalItemMaterialCost = initialUnitMaterialCostFromPriceData * amount;
                }
            } else {
                // No materiaal_details from order_items, check if we have the new fields in item_prices
                const priceItem = priceMap[item.item_number] || {};
                
                if (priceItem && (priceItem.houtkosten !== null || priceItem.materiaalkosten !== null)) {
                    // Use the detailed costs from item_prices table
                    houtKostForDisplay = (priceItem.houtkosten || 0) * amount;
                    hulpstoffenForDisplay = (priceItem.materiaalkosten || 0) * amount;
                    finalTotalItemMaterialCost = houtKostForDisplay + hulpstoffenForDisplay;
                    console.log(`Using item_prices data for ${item.item_number}: hout=${priceItem.houtkosten}, materiaal=${priceItem.materiaalkosten}`);
                } else {
                    // Last resort - use the general material_cost from item_prices
                    finalTotalItemMaterialCost = initialUnitMaterialCostFromPriceData * amount;
                    // In this case, no breakdown of costs
                }
            }
            
            // "Totaal" in the modal for this item refers to its total material cost
            const totalItemCostInModal = finalTotalItemMaterialCost; 
            
            // Add section header for items with prices when we switch from items without price to items with price
            if (hasPrice && !hasInsertedPricedItemsHeader && day.itemsWithoutPrice > 0) {
                itemsTableHTML += `
                    <tr class="table-success section-header">
                        <td colspan="10">
                            <strong>Items met verkoopprijs (${day.itemCount - day.itemsWithoutPrice})</strong>
                        </td>
                    </tr>
                `;
                hasInsertedPricedItemsHeader = true;
            }
            
            const rowClass = hasPrice ? '' : 'table-warning';
            
            itemsTableHTML += `
                <tr class="${rowClass}">
                    <td>${item.item_number}</td>
                    <td>${item.po_number || '-'}</td>
                    <td>${amount}</td>
                    <td class="editable-selling-price" data-item-id="${item.id}">${hasPrice ? formatCurrency(sellingPrice) : '<span class="badge bg-danger">€0,00 - GEEN PRIJS</span>'}</td>
                    <td class="editable-hout-cost" data-item-id="${item.id}">${formatCurrency(houtKostForDisplay)}</td>
                    <td class="editable-hulpstoffen-cost" data-item-id="${item.id}">${formatCurrency(hulpstoffenForDisplay)}</td>
                    <td class="editable-material-cost" data-item-id="${item.id}">${formatCurrency(finalTotalItemMaterialCost)}</td>
                    <td>-</td> <!-- Geen arbeidskosten meer per item -->
                    <td>${formatCurrency(totalItemCostInModal)}</td>
                    <td>${hasPrice ? 'Compleet' : '<span class="badge bg-warning">Geen prijsdata</span>'}</td>
                </tr>
            `;
        });
        
        itemsTableHTML += `
                    </tbody>
                </table>
            </div>
        `;
        
        // Summary toevoegen boven de tabel met inclusief hout/hulpstoffen informatie
        const summaryHTML = `
            <div class="row mb-4">
                <div class="col-md-3">
                    <div class="card ${day.itemsWithoutPrice > 0 ? 'border-warning' : ''}">
                        <div class="card-body text-center">
                            <h3>${day.itemCount}</h3>
                            <p class="mb-0">Totaal Artikelen</p>
                            ${day.itemsWithoutPrice > 0 ? `<div class="mt-2 badge bg-warning">${day.itemsWithoutPrice} zonder prijs</div>` : ''}
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card">
                        <div class="card-body text-center">
                            <h3>${formatCurrency(day.revenue)}</h3>
                            <p class="mb-0">Omzet</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card">
                        <div class="card-body text-center">
                            <h3>${formatHours(day.laborHours)}</h3>
                            <p class="mb-0">Arbeidsuren</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card">
                        <div class="card-body text-center ${day.profit >= 0 ? 'profit' : 'loss'}">
                            <h3>${formatCurrency(day.profit)}</h3>
                            <p class="mb-0">Marge</p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="row mb-4">
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-body text-center">
                            <h3>${formatCurrency(day.houtKosten || 0)}</h3>
                            <p class="mb-0">Houtkosten</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-body text-center">
                            <h3>${formatCurrency(day.hulpstoffenKosten || 0)}</h3>
                            <p class="mb-0">Hulpstoffen</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-body text-center">
                            <h3>${formatCurrency(day.materialCost)}</h3>
                            <p class="mb-0">Totaal Materiaalkosten</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Statistieken voor items zonder prijs
        let noPriceStatsHTML = '';
        if (day.itemsWithoutPrice > 0) {
            noPriceStatsHTML = `
                <div class="alert alert-warning mb-3">
                    <h5>Items zonder prijsgegevens</h5>
                    <p>Er zijn ${day.itemsWithoutPrice} items zonder prijsgegevens. Deze worden gemarkeerd in geel.</p>
                    <p>Gebruik de 'Prijzen' pagina om prijzen in te stellen voor deze items.</p>
                </div>
            `;
        }
        
        // Volledige modal content
        modal.innerHTML = `
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header ${day.itemsWithoutPrice > 0 ? 'bg-warning text-dark' : ''}">
                        <h5 class="modal-title" id="dayDetailsModalLabel">Details voor ${formattedDate}</h5>
                        <div class="d-flex align-items-center">
                            <button class="btn btn-sm btn-primary me-2" id="modal-edit-btn">
                                <i class="fas fa-edit me-1"></i> Bewerken
                            </button>
                            <button class="btn btn-sm btn-success me-2" id="modal-save-btn" style="display: none;">
                                <i class="fas fa-save me-1"></i> Opslaan
                            </button>
                            <button class="btn btn-sm btn-secondary me-2" id="modal-cancel-btn" style="display: none;">
                                <i class="fas fa-times me-1"></i> Annuleren
                            </button>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                    </div>
                    <div class="modal-body">
                        ${summaryHTML}
                        ${noPriceStatsHTML}
                        ${itemsTableHTML}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Sluiten</button>
                    </div>
                </div>
            </div>
        `;
        
        // Modal toevoegen en tonen
        document.body.appendChild(modal);
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();
        
        // Modal bewerkingsfunctionaliteit
        let modalEditMode = false;
        let modalOriginalData = JSON.parse(JSON.stringify(day));
        
        const modalEditBtn = modal.querySelector('#modal-edit-btn');
        const modalSaveBtn = modal.querySelector('#modal-save-btn');
        const modalCancelBtn = modal.querySelector('#modal-cancel-btn');
        
        // Toggle modal edit mode
        const toggleModalEditMode = () => {
            console.log('toggleModalEditMode called, current modalEditMode:', modalEditMode);
            modalEditMode = !modalEditMode;
            
            if (modalEditMode) {
                console.log('Entering modal edit mode...');
                modalOriginalData = JSON.parse(JSON.stringify(day));
                
                modalEditBtn.style.display = 'none';
                modalSaveBtn.style.display = 'inline-block';
                modalCancelBtn.style.display = 'inline-block';
                
                // Activeer bewerkbare cellen
                activateModalEditableCells();
                
                showSuccessMessage('Modal bewerkingsmodus geactiveerd. Klik op verkoopprijzen en materiaalkosten om te bewerken.');
            } else {
                console.log('Exiting modal edit mode...');
                modalEditBtn.style.display = 'inline-block';
                modalSaveBtn.style.display = 'none';
                modalCancelBtn.style.display = 'none';
                
                // Deactiveer bewerkbare cellen
                deactivateModalEditableCells();
            }
        };
        
        // Activeer bewerkbare cellen in modal
        const activateModalEditableCells = () => {
            console.log('Activating modal editable cells...');
            
            // Maak verkoopprijzen bewerkbaar
            modal.querySelectorAll('.editable-selling-price').forEach(cell => {
                const itemId = cell.getAttribute('data-item-id');
                const item = day.items.find(i => i.id == itemId);
                
                if (item) {
                    cell.style.cursor = 'pointer';
                    cell.style.backgroundColor = '#e3f2fd';
                    cell.title = 'Klik om te bewerken';
                    
                    // Voeg click handler toe als die er nog niet is
                    if (!cell.hasEditHandler) {
                        cell.hasEditHandler = true;
                        cell.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const currentPrice = parseFloat(item.price_data?.selling_price || item.selling_price || 0);
                            console.log('Editing selling price for item:', item.item_number, 'current:', currentPrice);
                            
                            makeEditable(cell, currentPrice, (newValue) => {
                                console.log('New selling price value:', newValue);
                                // Update item data
                                if (!item.price_data) item.price_data = {};
                                item.price_data.selling_price = newValue;
                                
                                // Update de corresponderende data in prepackData
                                const dataDay = prepackData.find(d => d.date === day.date);
                                if (dataDay) {
                                    const dataItem = dataDay.items.find(i => i.id == itemId);
                                    if (dataItem) {
                                        if (!dataItem.price_data) dataItem.price_data = {};
                                        dataItem.price_data.selling_price = newValue;
                                    }
                                    // Herbereken dag totalen
                                    recalculateDayTotals(dataDay);
                                    
                                    // Update modal summary
                                    updateModalSummary(dataDay);
                                }
                                
                                // Update de cell display
                                const hasPrice = newValue > 0;
                                cell.innerHTML = hasPrice ? formatCurrency(newValue) : '<span class="badge bg-danger">€0,00 - GEEN PRIJS</span>';
                                cell.style.backgroundColor = '#e3f2fd';
                                
                                // NIEUWE FUNCTIONALITEIT: Automatische synchronisatie naar alle items met hetzelfde item_number
                                syncPriceToAllItems(item.item_number, 'selling_price', newValue);
                            });
                        });
                    }
                }
            });
            
            // Maak materiaalkosten bewerkbaar
            modal.querySelectorAll('.editable-material-cost').forEach(cell => {
                const itemId = cell.getAttribute('data-item-id');
                const item = day.items.find(i => i.id == itemId);
                
                if (item) {
                    cell.style.cursor = 'pointer';
                    cell.style.backgroundColor = '#e3f2fd';
                    cell.title = 'Klik om te bewerken';
                    
                    if (!cell.hasEditHandler) {
                        cell.hasEditHandler = true;
                        cell.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const amount = parseInt(item.amount) || 1;
                            const currentMaterialCost = parseFloat(item.price_data?.material_cost || item.material_cost || 0);
                            const currentTotalCost = currentMaterialCost * amount;
                            console.log('Editing material cost for item:', item.item_number, 'current total:', currentTotalCost);
                            
                            makeEditable(cell, currentTotalCost, (newTotalValue) => {
                                console.log('New material cost total value:', newTotalValue);
                                // Bereken de nieuwe unit cost
                                const newUnitCost = newTotalValue / amount;

                                // Update de gedetailleerde kosten: alles naar "hulpstoffen" (materiaalkosten in DB)
                                // en houtkosten op 0. Dit is per de wens van de gebruiker om de totale
                                // materiaalkost aan te passen en op te slaan in de 'materiaalkosten' kolom.
                                const newHoutkosten = 0;
                                const newHulpstoffen = newUnitCost;

                                // Update de cell displays voor de onderdelen
                                const houtCell = cell.closest('tr').querySelector('.editable-hout-cost');
                                if (houtCell) houtCell.innerHTML = formatCurrency(newHoutkosten * amount);
                                
                                const hulpstoffenCell = cell.closest('tr').querySelector('.editable-hulpstoffen-cost');
                                if (hulpstoffenCell) hulpstoffenCell.innerHTML = formatCurrency(newHulpstoffen * amount);

                                // Update de cell display voor het totaal
                                cell.innerHTML = formatCurrency(newTotalValue);
                                cell.style.backgroundColor = '#e3f2fd';

                                // Roep de synchronisatie-functie aan die ook de DB update
                                syncMaterialDetailsToAllItems(item.item_naam || item.item_number, newHoutkosten, newHulpstoffen);
                            });
                        });
                    }
                }
            });
            
            // Maak houtkosten bewerkbaar
            modal.querySelectorAll('.editable-hout-cost').forEach(cell => {
                const itemId = cell.getAttribute('data-item-id');
                const item = day.items.find(i => i.id == itemId);
                
                if (item) {
                    cell.style.cursor = 'pointer';
                    cell.style.backgroundColor = '#e3f2fd';
                    cell.title = 'Klik om te bewerken (totaal voor alle stuks)';
                    
                    if (!cell.hasEditHandler) {
                        cell.hasEditHandler = true;
                        cell.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const amount = parseInt(item.amount) || 1;
                            
                            // Haal huidige houtkosten op
                            let currentHoutKost = 0;
                            if (item.materiaal_details && item.materiaal_details.hout_kost) {
                                currentHoutKost = item.materiaal_details.hout_kost * amount;
                            }
                            
                            console.log('Editing hout cost for item:', item.item_number, 'current total:', currentHoutKost);
                            
                            makeEditable(cell, currentHoutKost, (newTotalValue) => {
                                console.log('New hout cost total value:', newTotalValue);
                                
                                // Bereken nieuwe unit cost
                                const newUnitCost = newTotalValue / amount;
                                
                                // Update item materiaal_details
                                if (!item.materiaal_details) item.materiaal_details = {};
                                item.materiaal_details.hout_kost = newUnitCost;
                                
                                // Update de corresponderende data in prepackData
                                const dataDay = prepackData.find(d => d.date === day.date);
                                if (dataDay) {
                                    const dataItem = dataDay.items.find(i => i.id == itemId);
                                    if (dataItem) {
                                        if (!dataItem.materiaal_details) dataItem.materiaal_details = {};
                                        dataItem.materiaal_details.hout_kost = newUnitCost;
                                    }
                                    // Herbereken dag totalen
                                    recalculateDayTotals(dataDay);
                                    
                                    // Update modal summary
                                    updateModalSummary(dataDay);
                                }
                                
                                // Update de cell display
                                cell.innerHTML = formatCurrency(newTotalValue);
                                cell.style.backgroundColor = '#e3f2fd';
                                
                                // Update ook de totale materiaalkosten cel
                                const materialCostCell = modal.querySelector(`[data-item-id="${itemId}"].editable-material-cost`);
                                if (materialCostCell) {
                                    const hulpstoffenValue = item.materiaal_details?.hulpstoffen || 0;
                                    const newTotalMaterialCost = (newUnitCost + hulpstoffenValue) * amount;
                                    materialCostCell.innerHTML = formatCurrency(newTotalMaterialCost);
                                }
                                
                                // NIEUWE FUNCTIONALITEIT: Automatische synchronisatie van materiaaldetails naar alle items met hetzelfde item_number
                                const currentHoutkosten = item.materiaal_details?.hout_kost || 0;
                                syncMaterialDetailsToAllItems(item.item_naam || item.item_number, currentHoutkosten, newUnitCost);
                            });
                        });
                    }
                }
            });
            
            // Maak hulpstoffen bewerkbaar
            modal.querySelectorAll('.editable-hulpstoffen-cost').forEach(cell => {
                const itemId = cell.getAttribute('data-item-id');
                const item = day.items.find(i => i.id == itemId);
                
                if (item) {
                    cell.style.cursor = 'pointer';
                    cell.style.backgroundColor = '#e3f2fd';
                    cell.title = 'Klik om te bewerken (totaal voor alle stuks)';
                    
                    if (!cell.hasEditHandler) {
                        cell.hasEditHandler = true;
                        cell.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const amount = parseInt(item.amount) || 1;
                            
                            // Haal huidige hulpstoffen op
                            let currentHulpstoffen = 0;
                            if (item.materiaal_details && item.materiaal_details.hulpstoffen) {
                                currentHulpstoffen = item.materiaal_details.hulpstoffen * amount;
                            }
                            
                            console.log('Editing hulpstoffen cost for item:', item.item_number, 'current total:', currentHulpstoffen);
                            
                            makeEditable(cell, currentHulpstoffen, (newTotalValue) => {
                                console.log('New hulpstoffen cost total value:', newTotalValue);
                                
                                // Bereken nieuwe unit cost
                                const newUnitCost = newTotalValue / amount;
                                
                                // Update item materiaal_details
                                if (!item.materiaal_details) item.materiaal_details = {};
                                item.materiaal_details.hulpstoffen = newUnitCost;
                                
                                // Update de corresponderende data in prepackData
                                const dataDay = prepackData.find(d => d.date === day.date);
                                if (dataDay) {
                                    const dataItem = dataDay.items.find(i => i.id == itemId);
                                    if (dataItem) {
                                        if (!dataItem.materiaal_details) dataItem.materiaal_details = {};
                                        dataItem.materiaal_details.hulpstoffen = newUnitCost;
                                    }
                                    // Herbereken dag totalen
                                    recalculateDayTotals(dataDay);
                                    
                                    // Update modal summary
                                    updateModalSummary(dataDay);
                                }
                                
                                // Update de cell display
                                cell.innerHTML = formatCurrency(newTotalValue);
                                cell.style.backgroundColor = '#e3f2fd';
                                
                                // Update ook de totale materiaalkosten cel
                                const materialCostCell = modal.querySelector(`[data-item-id="${itemId}"].editable-material-cost`);
                                if (materialCostCell) {
                                    const houtValue = item.materiaal_details?.hout_kost || 0;
                                    const newTotalMaterialCost = (houtValue + newUnitCost) * amount;
                                    materialCostCell.innerHTML = formatCurrency(newTotalMaterialCost);
                                }
                                
                                // NIEUWE FUNCTIONALITEIT: Automatische synchronisatie van materiaaldetails naar alle items met hetzelfde item_number
                                const currentHulpstoffen = item.materiaal_details?.hulpstoffen || 0;
                                syncMaterialDetailsToAllItems(item.item_naam || item.item_number, newUnitCost, currentHulpstoffen);
                            });
                        });
                    }
                }
            });
        };
        
        // Deactiveer bewerkbare cellen
        const deactivateModalEditableCells = () => {
            modal.querySelectorAll('.editable-selling-price, .editable-material-cost, .editable-hout-cost, .editable-hulpstoffen-cost').forEach(cell => {
                cell.style.cursor = '';
                cell.style.backgroundColor = '';
                cell.title = '';
            });
        };
        
        // Modal save functionaliteit
        const saveModalChanges = async () => {
            console.log('Saving modal changes...');
            
            // Verzamel wijzigingen zoals in de hoofdfunctie
            const changes = [];
            
            day.items.forEach(item => {
                const originalItem = modalOriginalData.items.find(i => i.id === item.id);
                if (originalItem && item.price_data && originalItem.price_data) {
                    if (item.price_data.selling_price !== originalItem.price_data.selling_price) {
                        changes.push({
                            type: 'selling_price',
                            itemId: item.id,
                            itemNumber: item.item_number,
                            oldValue: originalItem.price_data.selling_price,
                            newValue: item.price_data.selling_price
                        });
                    }
                    if (item.price_data.material_cost !== originalItem.price_data.material_cost) {
                        changes.push({
                            type: 'material_cost',
                            itemId: item.id,
                            itemNumber: item.item_number,
                            oldValue: originalItem.price_data.material_cost,
                            newValue: item.price_data.material_cost
                        });
                    }
                }
            });
            
            if (changes.length === 0) {
                showSuccessMessage('Geen wijzigingen om op te slaan.');
                toggleModalEditMode();
                return;
            }
            
            try {
                const response = await fetch('/api/prepack/save_changes', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ changes })
                });
                
                if (!response.ok) {
                    throw new Error(`Server fout: ${response.status}`);
                }
                
                showSuccessMessage(`${changes.length} wijzigingen succesvol opgeslagen.`);
                toggleModalEditMode();
                
                // Update de hoofdtabel
                updateUI(prepackData);
                
            } catch (error) {
                console.error('Fout bij opslaan modal wijzigingen:', error);
                showErrorMessage(`Fout bij opslaan: ${error.message}`);
            }
        };
        
        // Modal cancel functionaliteit
        const cancelModalChanges = () => {
            console.log('Cancelling modal changes...');
            
            // Restore original data
            Object.assign(day, JSON.parse(JSON.stringify(modalOriginalData)));
            
            // Update de corresponderende data in prepackData
            const dataDay = prepackData.find(d => d.date === day.date);
            if (dataDay) {
                Object.assign(dataDay, JSON.parse(JSON.stringify(modalOriginalData)));
            }
            
            toggleModalEditMode();
            showSuccessMessage('Modal wijzigingen geannuleerd.');
            
            // Refresh modal content
            modalInstance.hide();
            setTimeout(() => showDayDetails(day), 100);
        };
        
        // Event listeners voor modal knoppen
        modalEditBtn.addEventListener('click', toggleModalEditMode);
        modalSaveBtn.addEventListener('click', saveModalChanges);
        modalCancelBtn.addEventListener('click', cancelModalChanges);
        
        // Verwijder de oude bewerkingsfunctionaliteit code die alleen werkte in globale edit mode
        
        // Cleanup na sluiten
        modal.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modal);
        });
    }

    // Helper functie om modal samenvatting bij te werken
    function updateModalSummary(day) {
        const modal = document.getElementById('dayDetailsModal');
        if (!modal) return;
        
        // Update de summary cards in de modal
        const summaryCards = {
            itemCount: modal.querySelector('.card-body h3'),
            revenue: modal.querySelectorAll('.card-body h3')[1],
            hours: modal.querySelectorAll('.card-body h3')[2],
            profit: modal.querySelectorAll('.card-body h3')[3],
            houtKosten: modal.querySelectorAll('.card-body h3')[4],
            hulpstoffen: modal.querySelectorAll('.card-body h3')[5],
            materialCost: modal.querySelectorAll('.card-body h3')[6]
        };
        
        if (summaryCards.itemCount) summaryCards.itemCount.textContent = day.itemCount;
        if (summaryCards.revenue) summaryCards.revenue.textContent = formatCurrency(day.revenue);
        if (summaryCards.hours) summaryCards.hours.textContent = formatHours(day.laborHours);
        if (summaryCards.profit) {
            summaryCards.profit.textContent = formatCurrency(day.profit);
            // Update profit color
            const profitCard = summaryCards.profit.closest('.card-body');
            if (profitCard) {
                profitCard.classList.remove('profit', 'loss');
                profitCard.classList.add(day.profit >= 0 ? 'profit' : 'loss');
            }
        }
        if (summaryCards.houtKosten) summaryCards.houtKosten.textContent = formatCurrency(day.houtKosten || 0);
        if (summaryCards.hulpstoffen) summaryCards.hulpstoffen.textContent = formatCurrency(day.hulpstoffenKosten || 0);
        if (summaryCards.materialCost) summaryCards.materialCost.textContent = formatCurrency(day.materialCost);
        
        console.log('Modal summary updated for day:', day.date);
    }

    // Helper functie om dag totalen opnieuw te berekenen
    function recalculateDayTotals(day) {
        // Reset alle totalen
        day.revenue = 0;
        day.materialCost = 0;
        day.houtKosten = 0;
        day.hulpstoffenKosten = 0;
        day.itemsWithoutPrice = 0;
        
        // Herbereken op basis van items
        day.items.forEach(item => {
            const amount = parseInt(item.amount) || 1;
            const priceData = item.price_data || {
                selling_price: item.selling_price || 0,
                material_cost: item.material_cost || 0
            };
            
            const sellingPrice = parseFloat(priceData.selling_price) || 0;
            const hasPrice = sellingPrice > 0;
            
            if (!hasPrice) {
                day.itemsWithoutPrice++;
            }
            
            // Omzet
            day.revenue += amount * sellingPrice;
            
            // Materiaalkosten berekenen (zoals in de originele processData functie)
            let materialCost = amount * (parseFloat(priceData.material_cost) || 0);
            let houtKost = 0;
            let hulpstoffen = 0;
            
            if (item.materiaal_details) {
                const unitHoutKost = item.materiaal_details.hout_kost || 0;
                const unitHulpstoffen = item.materiaal_details.hulpstoffen || 0;
                houtKost = unitHoutKost * amount;
                hulpstoffen = unitHulpstoffen * amount;
                
                if (houtKost + hulpstoffen > 0) {
                    materialCost = houtKost + hulpstoffen;
                }
            } else {
                // NIEUWE LOGICA: Als er geen materiaal_details zijn, maar wel material_cost in price_data,
                // probeer dan de opsplitsing te krijgen uit item_prices via priceMap
                const priceItem = priceMap[item.item_number] || {};
                
                if (priceItem && (priceItem.houtkosten !== null || priceItem.materiaalkosten !== null)) {
                    // Use the detailed costs from item_prices table
                    const unitHoutFromPrices = priceItem.houtkosten || 0;
                    const unitHulpstoffenFromPrices = priceItem.materiaalkosten || 0;
                    const unitTotalFromPrices = unitHoutFromPrices + unitHulpstoffenFromPrices;
                    const unitMaterialCost = parseFloat(priceData.material_cost) || 0;
                    
                    // Als de material_cost overeenkomt met de opsplitsing uit priceMap, gebruik die opsplitsing
                    if (Math.abs(unitTotalFromPrices - unitMaterialCost) < 0.01 && unitTotalFromPrices > 0) {
                        houtKost = unitHoutFromPrices * amount;
                        hulpstoffen = unitHulpstoffenFromPrices * amount;
                        materialCost = unitTotalFromPrices * amount;
                        console.log(`Using priceMap breakdown for item ${item.item_number}: hout=${houtKost}, hulpstoffen=${hulpstoffen}`);
                    } else {
                        // De opsplitsing komt niet overeen, dus we kunnen het niet opsplitsen
                        // Gebruik de material_cost zoals die is ingesteld, maar geen opsplitsing
                        console.log(`Cannot split material cost for item ${item.item_number}: priceMap total=${unitTotalFromPrices}, actual=${unitMaterialCost}`);
                    }
                }
                // Als er geen opsplitsing mogelijk is, blijven houtKost en hulpstoffen 0, maar materialCost is wel correct
            }
            
            day.materialCost += materialCost;
            day.houtKosten += houtKost;
            day.hulpstoffenKosten += hulpstoffen;
        });
        
        // Herbereken afgeleide waarden
        day.totalCost = day.materialCost + day.laborCost;
        day.overhead = day.revenue * 0.20;
        day.profit = day.revenue - day.totalCost;
        
        if (day.revenue > 0) {
            day.margin = (day.profit / day.revenue) * 100;
        } else {
            day.margin = 0;
        }
        
        console.log(`Day totals recalculated for ${day.date}:`, {
            revenue: day.revenue,
            materialCost: day.materialCost,
            houtKosten: day.houtKosten,
            hulpstoffenKosten: day.hulpstoffenKosten,
            totalCost: day.totalCost,
            profit: day.profit
        });
    }

    // Nieuwe functie voor automatische prijssynchronisatie
    function syncPriceToAllItems(itemNumber, priceType, newValue) {
        console.log(`Synchronizing ${priceType} for item ${itemNumber} to value ${newValue}`);
        
        let changesCount = 0;
        
        // Loop door alle dagen en items om hetzelfde item_number/item_naam te vinden
        prepackData.forEach(day => {
            day.items.forEach(item => {
                // Match op basis van item_naam eerst (zoals add_order.js doet), dan item_number
                const itemKey = item.item_naam || item.item_number;
                if (itemKey === itemNumber) {
                    // Initialiseer price_data als het niet bestaat
                    if (!item.price_data) {
                        item.price_data = {
                            selling_price: 0,
                            material_cost: 0,
                            labor_cost: 0
                        };
                    }
                    
                    // Update de prijs als deze verschilt
                    const currentValue = parseFloat(item.price_data[priceType]) || 0;
                    const newPriceValue = parseFloat(newValue) || 0;
                    
                    if (currentValue !== newPriceValue) {
                        item.price_data[priceType] = newPriceValue;
                        changesCount++;
                        
                        // Update ook de globale priceMap voor alle mogelijke keys
                        const updatePriceMapForKey = (key) => {
                            if (!priceMap[key]) {
                                priceMap[key] = {
                                    selling_price: 0,
                                    material_cost: 0,
                                    labor_cost: 0
                                };
                            }
                            priceMap[key][priceType] = newPriceValue;
                        };
                        
                        // Update priceMap voor alle mogelijke keys (item_naam en item_number)
                        if (item.item_naam) updatePriceMapForKey(item.item_naam);
                        if (item.item_number) updatePriceMapForKey(item.item_number);
                        
                        console.log(`Updated ${priceType} for item ${itemKey} on day ${day.date} to ${newPriceValue}`);
                    }
                }
            });
            
            // Herbereken dag totalen na wijzigingen (check op beide mogelijke keys)
            if (day.items.some(item => (item.item_naam || item.item_number) === itemNumber)) {
                recalculateDayTotals(day);
            }
        });
        
        if (changesCount > 0) {
            console.log(`Synchronized ${priceType} for ${changesCount} items with identifier ${itemNumber}`);
            
            // Update de UI
            updateUI(prepackData);
            
            // Toon feedback aan gebruiker
            showSuccessMessage(`Prijs automatisch gesynchroniseerd: ${changesCount} andere voorkomens van item ${itemNumber} bijgewerkt.`);
            
            // Gebruik de bestaande save_changes endpoint voor prijswijzigingen
            fetch('/api/prepack/save_changes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    changes: [{
                        type: priceType,
                        itemNumber: itemNumber, // Deze is al correct gemapped door de caller
                        newValue: newValue,
                        oldValue: 0 // We don't need the old value for this sync
                    }]
                })
            }).then(response => {
                if (!response.ok) {
                    console.warn('Fout bij synchroniseren naar database:', response.status);
                    showErrorMessage(`Waarschuwing: Prijs werd lokaal bijgewerkt maar kon niet worden opgeslagen in database (status: ${response.status})`);
                } else {
                    console.log('Prijs succesvol gesynchroniseerd naar database');
                    return response.json();
                }
            }).then(result => {
                if (result && result.success) {
                    console.log('Database synchronisatie bevestigd:', result.message);
                }
                
            }).catch(error => {
                console.warn('Fout bij synchroniseren naar database:', error);
                showErrorMessage(`Waarschuwing: Prijs werd lokaal bijgewerkt maar kon niet worden opgeslagen in database: ${error.message}`);
            });
        }
        
        return changesCount;
    }

    // Nieuwe functie om materiaaldetails te synchroniseren (houtkosten en hulpstoffenkosten)
    function syncMaterialDetailsToAllItems(itemNumber, houtkosten, hulpstoffenkosten) {
        console.log(`Synchronizing material details for item ${itemNumber}: hout=${houtkosten}, hulpstoffen=${hulpstoffenkosten}`);
        
        let changesCount = 0;
        
        // Loop door alle dagen en items om hetzelfde item_number/item_naam te vinden
        prepackData.forEach(day => {
            day.items.forEach(item => {
                // Match op basis van item_naam eerst (zoals add_order.js doet), dan item_number
                const itemKey = item.item_naam || item.item_number;
                if (itemKey === itemNumber) {
                    // Initialiseer materiaal_details als het niet bestaat
                    if (!item.materiaal_details) {
                        item.materiaal_details = {
                            hout_kost: 0,
                            hulpstoffen: 0,
                            totaal: 0
                        };
                    }
                    
                    // Update de materiaalkosten per eenheid
                    const unitHoutkosten = parseFloat(houtkosten) || 0;
                    const unitHulpstoffenkosten = parseFloat(hulpstoffenkosten) || 0;
                    
                    if (item.materiaal_details.hout_kost !== unitHoutkosten || 
                        item.materiaal_details.hulpstoffen !== unitHulpstoffenkosten) {
                        
                        item.materiaal_details.hout_kost = unitHoutkosten;
                        item.materiaal_details.hulpstoffen = unitHulpstoffenkosten;
                        item.materiaal_details.totaal = unitHoutkosten + unitHulpstoffenkosten;
                        
                        // Update ook de material_cost in price_data
                        if (!item.price_data) {
                            item.price_data = {
                                selling_price: 0,
                                material_cost: 0,
                                labor_cost: 0
                            };
                        }
                        item.price_data.material_cost = item.materiaal_details.totaal;
                        
                        // Update globale priceMap met alle mogelijke keys
                        const updatePriceMapForKey = (key) => {
                            if (!priceMap[key]) {
                                priceMap[key] = {
                                    selling_price: 0,
                                    material_cost: 0,
                                    labor_cost: 0
                                };
                            }
                            priceMap[key].material_cost = item.materiaal_details.totaal;
                            priceMap[key].houtkosten = unitHoutkosten;
                            priceMap[key].materiaalkosten = unitHulpstoffenkosten;
                        };
                        
                        // Update priceMap voor alle mogelijke keys (item_naam en item_number)
                        if (item.item_naam) updatePriceMapForKey(item.item_naam);
                        if (item.item_number) updatePriceMapForKey(item.item_number);
                        
                        changesCount++;
                        
                        console.log(`Updated material details for item ${itemKey} on day ${day.date}`);
                    }
                }
            });
            
            // Herbereken dag totalen na wijzigingen (check op beide mogelijke keys)
            if (day.items.some(item => (item.item_naam || item.item_number) === itemNumber)) {
                recalculateDayTotals(day);
            }
        });
        
        if (changesCount > 0) {
            console.log(`Synchronized material details for ${changesCount} items with identifier ${itemNumber}`);
            
            // Update de UI
            updateUI(prepackData);
            
            // Toon feedback aan gebruiker
            showSuccessMessage(`Materiaalkosten automatisch gesynchroniseerd: ${changesCount} andere voorkomens van item ${itemNumber} bijgewerkt.`);
            
            // Gebruik dezelfde endpoint als add_order.js voor het opslaan van gedetailleerde kosten
            // BELANGRIJK: gebruik itemNumber zoals doorgegeven (dit zou item_naam moeten zijn als add_order.js het heeft opgeslagen)
            fetch('/api/item_prices/upsert_costs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    items: [{
                        item_number: itemNumber, // Deze is al correct gemapped door de caller
                        houtkosten: houtkosten,
                        materiaalkosten: hulpstoffenkosten
                    }]
                })
            }).then(response => {
                if (!response.ok) {
                    console.warn('Fout bij synchroniseren materiaaldetails naar database:', response.status);
                    showErrorMessage(`Waarschuwing: Materiaalkosten werden lokaal bijgewerkt maar konden niet worden opgeslagen in database (status: ${response.status})`);
                } else {
                    console.log('Materiaaldetails succesvol gesynchroniseerd naar database via upsert_costs');
                    return response.json();
                }
            }).then(result => {
                if (result && result.success) {
                    console.log('Database synchronisatie van materiaaldetails bevestigd:', result.message);
                }
            }).catch(error => {
                console.warn('Fout bij synchroniseren materiaaldetails naar database:', error);
                showErrorMessage(`Waarschuwing: Materiaalkosten werden lokaal bijgewerkt maar konden niet worden opgeslagen in database: ${error.message}`);
            });
        }
        
        return changesCount;
    }

    // Voeg wat CSS toe voor klikbare rijen
    function addCustomCSS() {
        const style = document.createElement('style');
        style.innerHTML = `
            .clickable-row {
                cursor: pointer;
                transition: background-color 0.2s;
            }
            .clickable-row:hover {
                background-color: rgba(0, 123, 255, 0.1);
            }
            .profit {
                color: #28a745;
            }
            .loss {
                color: #dc3545;
            }
            .table-warning {
                background-color: #fff3cd !important;
                border-left: 4px solid #ffc107 !important;
            }
            .table-warning:hover {
                background-color: #ffe8b1 !important;
            }
            .table-warning td:first-child {
                font-weight: bold;
            }
            .section-header {
                font-weight: bold;
            }
            .section-header td {
                padding: 10px 8px !important;
            }
            .table-danger.section-header {
                background-color: #f8d7da !important;
                border-left: 4px solid #dc3545 !important;
            }
            .table-success.section-header {
                background-color: #d1e7dd !important;
                border-left: 4px solid #198754 !important;
            }
            .border-warning {
                border: 2px solid #ffc107 !important;
            }
            .table th {
                position: sticky;
                top: 0;
                background-color: #f8f9fa;
                z-index: 10;
            }
            .editable-hours, .editable-selling-price, .editable-material-cost, .editable-hout-cost, .editable-hulpstoffen-cost {
                position: relative;
                transition: background-color 0.2s;
            }
            .editable-hours:hover, .editable-selling-price:hover, .editable-material-cost:hover, .editable-hout-cost:hover, .editable-hulpstoffen-cost:hover {
                background-color: #e1f5fe !important;
            }
            .editable-hours::after, .editable-selling-price::after, .editable-material-cost::after, .editable-hout-cost::after, .editable-hulpstoffen-cost::after {
                content: "✏️";
                position: absolute;
                top: 2px;
                right: 2px;
                font-size: 10px;
                opacity: 0.6;
            }
            .edit-mode-info {
                background-color: #e3f2fd;
                border: 1px solid #1976d2;
                border-radius: 4px;
                padding: 8px 12px;
                margin-bottom: 15px;
                font-size: 14px;
                color: #1976d2;
            }
        `;
        document.head.appendChild(style);
    }

    // Voeg de CSS toe
    addCustomCSS();
}); 