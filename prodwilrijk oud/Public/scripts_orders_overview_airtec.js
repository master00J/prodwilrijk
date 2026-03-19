document.addEventListener('DOMContentLoaded', () => {
    // Direct aanpakken van de kolomstructuur - hoogste prioriteit
    console.log("DOM geladen, kolommen aanpassen...");
    
    // Wacht even om zeker te zijn dat alle DOM elementen geladen zijn
    setTimeout(removeColumns, 100);
    
    function removeColumns() {
        console.log("Verwijderen van Divisie en Totaal kolommen...");
        
        // 1. Zoek alle tabellen op de pagina
        const tables = document.querySelectorAll('table');
        console.log("Gevonden tabellen:", tables.length);
        
        // Loop door alle tabellen
        tables.forEach((table, index) => {
            console.log(`Tabel ${index} aanpassen:`, table);
            
            // Verwijder eerst de header kolommen
            const headerRow = table.querySelector('thead tr');
            if (headerRow) {
                const headers = headerRow.querySelectorAll('th');
                console.log(`  Header kolommen:`, headers.length);
                
                // Als er 5 kolommen zijn (Datum, Divisie, Openstaande, Verpakte, Totaal)
                if (headers.length >= 5) {
                    try {
                        // Verwijder kolom 5 (Totaal) en kolom 2 (Divisie) - let op de volgorde!
                        headerRow.removeChild(headers[4]); // Totaal (index 4)
                        headerRow.removeChild(headers[1]); // Divisie (index 1)
                        console.log("  Header kolommen Divisie en Totaal verwijderd");
                    } catch (e) {
                        console.error("  Fout bij verwijderen header kolommen:", e);
                    }
                }
            }
            
            // Verwijder dan de data kolommen in elke rij
            const rows = table.querySelectorAll('tbody tr');
            console.log(`  Rijen in tabel:`, rows.length);
            
            rows.forEach((row, rowIndex) => {
                const cells = row.querySelectorAll('td');
                // Als er 5 cellen zijn (Datum, Divisie, Openstaande, Verpakte, Totaal)
                if (cells.length >= 5) {
                    try {
                        // Verwijder cel 5 (Totaal) en cel 2 (Divisie) - let op de volgorde!
                        row.removeChild(cells[4]); // Totaal (index 4)
                        row.removeChild(cells[1]); // Divisie (index 1)
                    } catch (e) {
                        console.error(`  Fout bij verwijderen cellen in rij ${rowIndex}:`, e);
                    }
                }
            });
        });
        
        // 2. Pas ook de renderTable functie aan om nieuwe rijen correct toe te voegen
        const originalRenderTable = renderTable;
        window.renderTable = function() {
            console.log("Aangepaste renderTable functie uitgevoerd");
            
            const tableBody = document.querySelector('table tbody');
            if (!tableBody) {
                console.error('Tabel body element niet gevonden');
                return;
            }
            
            tableBody.innerHTML = '';
            
            if (!state.chartData || !state.chartData.combinedData) {
                console.warn('Geen data beschikbaar voor tabel');
                return;
            }
            
            state.chartData.combinedData.forEach(item => {
                const row = document.createElement('tr');
                
                // Maak een geformatteerde datum
                let displayDate = item.date;
                if (state.dataGrouping === 'day') {
                    const date = new Date(item.date);
                    displayDate = `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
                }
                
                // Maak een rij met alleen Datum, Openstaande items en Verpakte items (geen Divisie of Totaal)
                row.innerHTML = `
                    <td>${displayDate}</td>
                    <td>${item.open || 0}</td>
                    <td>${item.packed || 0}</td>
                `;
                
                tableBody.appendChild(row);
            });
        };
    }
    
    // State voor de grafiekdata en instellingen
    const state = {
        chartInstance: null,
        data: {
            rawData: [], // Bevat volledige data met divisie-informatie
            divisions: new Set(), // Unieke divisies
        },
        chartType: 'line', // 'line', 'bar', 'stacked-bar'
        dateRange: 14, // dagen
        dataGrouping: 'day', // 'day', 'week', 'month'
        selectedDivision: 'all', // 'all' of specifieke divisie
        lastUpdated: null,
        timePeriod: '30days' // '30days', '90days', '6months', '1year'
    };

    // DOM elementen
    const elements = {
        chartContainer: document.getElementById('order-chart'),
        dateRangeSelector: document.getElementById('date-range'),
        chartTypeSelector: document.getElementById('chart-type'),
        dataGroupSelector: document.getElementById('data-group'),
        divisionSelector: document.getElementById('filter-divisie'),
        totalOpenItems: document.getElementById('total-open-items'),
        totalPackedItems: document.getElementById('total-packed-items'),
        backlogDays: document.getElementById('backlog-days'),
        lastUpdated: document.getElementById('last-updated'),
        dataTableBody: document.getElementById('data-table-body')
    };

    // Laad de header
    fetch('header.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById('header-placeholder').innerHTML = data;
        })
        .catch(error => console.error('Fout bij laden header:', error));

    // Initialisatie
    const init = async () => {
        // Verwijder de Divisie en Totaal kolommen direct bij het laden
        removeUnwantedColumns();
        
        setupEventListeners();
        await fetchOrderData();
        populateDivisionsDropdown();
        updateChartData();
        renderChart();
        renderTable();
        updateStats();
    };

    // Functie om de ongewenste kolommen te verwijderen
    const removeUnwantedColumns = () => {
        // Verwijder kolomheaders
        const headerRow = document.querySelector('table.data-table thead tr');
        if (headerRow) {
            // Behoud alleen de eerste, derde en vierde kolom (Datum, Openstaande items, Verpakte items)
            const headers = headerRow.querySelectorAll('th');
            if (headers.length >= 5) {
                // Verwijder Divisie (index 1) en Totaal (index 4)
                headerRow.removeChild(headers[4]); // Totaal (laatste)
                headerRow.removeChild(headers[1]); // Divisie (tweede)
            }
        }
        
        // Pas ook de renderer aan om geen Divisie en Totaal kolommen meer te renderen
        elements.renderTableOriginal = renderTable;
        elements.renderTable = function() {
            tableBody = document.getElementById('data-table-body');
            if (!tableBody) {
                console.error('Tabel body element niet gevonden');
                return;
            }
            
            tableBody.innerHTML = '';
            
            if (!state.chartData || !state.chartData.combinedData) {
                console.warn('Geen data beschikbaar voor tabel');
                return;
            }
            
            state.chartData.combinedData.forEach(item => {
                const row = document.createElement('tr');
                
                // Maak een geformatteerde datum
                let displayDate = item.date;
                if (state.dataGrouping === 'day') {
                    const date = new Date(item.date);
                    displayDate = `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
                }
                
                // Maak een rij met alleen Datum, Openstaande items en Verpakte items
                row.innerHTML = `
                    <td>${displayDate}</td>
                    <td>${item.open || 0}</td>
                    <td>${item.packed || 0}</td>
                `;
                
                tableBody.appendChild(row);
            });
        };
    };

    // Event listeners instellen
    const setupEventListeners = () => {
        elements.dateRangeSelector.addEventListener('change', (e) => {
            // Zet dateRange om naar het overeenkomstige timePeriod
            const selectedDays = parseInt(e.target.value);
            if (selectedDays <= 30) {
                state.timePeriod = '30days';
            } else if (selectedDays <= 90) {
                state.timePeriod = '90days';
            } else if (selectedDays <= 180) {
                state.timePeriod = '6months';
            } else {
                state.timePeriod = '1year';
            }
            
            updateChartData();
        });

        elements.chartTypeSelector.addEventListener('change', (e) => {
            state.chartType = e.target.value;
            renderChart();
        });

        elements.dataGroupSelector.addEventListener('change', (e) => {
            state.dataGrouping = e.target.value;
            updateChartData();
        });
        
        elements.divisionSelector.addEventListener('change', (e) => {
            state.selectedDivision = e.target.value;
            updateChartData();
        });
    };

    // Ophalen van orderdata voor de grafiek
    const fetchOrderData = async () => {
        try {
            console.log("Ophalen van orderdata gestart voor AIRTEC...");
            
            // Ophalen van de huidige open items
            const openResponse = await fetch('/api/items_to_pack_airtec');
            if (!openResponse.ok) throw new Error('Fout bij ophalen items om te verpakken');
            const openItems = await openResponse.json();
            console.log("AIRTEC: Open items opgehaald:", openItems.length);
            
            // Ophalen van de verpakte items
            const packedResponse = await fetch('/api/packed_items_airtec');
            if (!packedResponse.ok) throw new Error('Fout bij ophalen verpakte items');
            const packedItems = await packedResponse.json();
            console.log("AIRTEC: Verpakte items opgehaald:", packedItems.length);
            
            // Als er geen items zijn, gebruik testdata
            if ((!openItems || !openItems.length) && (!packedItems || !packedItems.length)) {
                console.warn('Gebruik testdata vanwege ontbrekende API data');
                return useTestData();
            }

            // De huidige items verwerken
            const today = new Date();
            const todayStr = formatDate(today);
            console.log("Huidige datum:", todayStr);
            
            // Details van open items analyseren
            const openItemDates = {};
            openItems.forEach(item => {
                if (item.datum_opgestuurd) {
                    const dateStr = formatDate(new Date(item.datum_opgestuurd));
                    if (!openItemDates[dateStr]) {
                        openItemDates[dateStr] = 0;
                    }
                    openItemDates[dateStr]++;
                }
            });
            console.log("Verdeling van open items per datum_opgestuurd:", openItemDates);
            
            // Verwerk de verpakte items per datum
            const itemsPackedByDate = {};
            
            packedItems.forEach(item => {
                const quantity = item.quantity || 1;
                
                // Gebruik date_packed of datum_verpakt als datum
                const datePacked = item.date_packed || item.datum_verpakt;
                if (datePacked) {
                    const dateStr = formatDate(new Date(datePacked));
                    
                    // Initialiseer data voor deze datum indien nodig
                    if (!itemsPackedByDate[dateStr]) {
                        itemsPackedByDate[dateStr] = 0;
                    }
                    
                    // Tel aantal verpakte items bij voor deze datum
                    itemsPackedByDate[dateStr] += quantity;
                }
            });
            
            console.log("Items verpakt per datum:", itemsPackedByDate);
            
            // Analyseer de huidige open items op basis van datum_opgestuurd
            const openItemsByDateSent = {};
            
            // Verwerk de open items per datum waarop ze zijn opgestuurd
            openItems.forEach(item => {
                // Controleer of het item een datum_opgestuurd heeft
                if (item.datum_opgestuurd) {
                    const dateStr = formatDate(new Date(item.datum_opgestuurd));
                    const quantity = item.quantity || 1;
                    
                    if (!openItemsByDateSent[dateStr]) {
                        openItemsByDateSent[dateStr] = 0;
                    }
                    
                    openItemsByDateSent[dateStr] += quantity;
                } else {
                    console.warn("AIRTEC: Item zonder datum_opgestuurd gevonden:", item);
                }
            });
            
            console.log("Open items per datum opgestuurd:", openItemsByDateSent);
            
            // Verzamel alle datums uit de datasets en voeg de laatste 90 dagen toe
            const allDates = new Set([
                ...Object.keys(itemsPackedByDate),
                ...Object.keys(openItemsByDateSent)
            ]);
            
            const startDate = new Date(today);
            startDate.setDate(startDate.getDate() - 90);
            
            for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
                const dateStr = formatDate(d);
                allDates.add(dateStr);
            }
            
            // Sorteer de datums
            const sortedDates = Array.from(allDates).sort();
            
            // Bereid de data voor
            state.data.rawData = [];
            
            // Voor de diagnostiek: houd bij welke datums van openstaande items worden meegeteld
            let countedItemsByDate = {};
            
            sortedDates.forEach((dateStr) => {
                const isToday = dateStr === todayStr;
                const itemsPackedToday = itemsPackedByDate[dateStr] || 0;
                
                // Voor openstaande items: tel alleen items die vóór deze datum zijn opgestuurd
                // en nog steeds in de openItems lijst staan
                let openItemsCount = 0;
                
                countedItemsByDate[dateStr] = [];
                
                // Bereken openstaande items (uitgesloten van vandaag)
                Object.keys(openItemsByDateSent).forEach(sentDate => {
                    const sentDateObj = new Date(sentDate);
                    const currentDateObj = new Date(dateStr);
                    
                    // Tel alleen items van voorgaande datums
                    if (sentDateObj < currentDateObj || 
                        (isToday && sentDate !== todayStr)) { // Voor vandaag tellen we alles mee behalve wat vandaag zelf is binnengekomen
                        openItemsCount += openItemsByDateSent[sentDate];
                        countedItemsByDate[dateStr].push({
                            date: sentDate,
                            count: openItemsByDateSent[sentDate]
                        });
                    }
                });
                
                // Voeg verpakte items toe voor deze dag
                state.data.rawData.push({
                    date: dateStr,
                    status: 'packed',
                    count: itemsPackedToday
                });
                
                // Voeg openstaande items toe
                state.data.rawData.push({
                    date: dateStr,
                    status: 'open',
                    count: openItemsCount
                });
                
                console.log(`Dag ${dateStr}: ` + 
                          `Verpakt: ${itemsPackedToday}, ` + 
                          `Openstaand (van voorgaande dagen): ${openItemsCount}`);
            });
            
            // Toon gedetailleerde informatie over welke datums zijn meegeteld voor een paar willekeurige dagen
            const sampleDates = sortedDates.filter((_, i) => i % 15 === 0); // Kies elke 15e dag
            sampleDates.forEach(date => {
                console.log(`Openstaande items voor ${date} bestaan uit:`, countedItemsByDate[date]);
            });
            
            console.log("Verwerkte data:", state.data.rawData);
            
            state.lastUpdated = new Date();
            updateLastUpdatedText();
        } catch (error) {
            console.error('Fout bij ophalen ordergegevens:', error);
            useTestData();
        }
    };

    // Gebruik testdata als de API niet beschikbaar is
    const useTestData = () => {
        const now = new Date();
        state.data.rawData = [];
        
        // Testdivisies
        const divisions = ['Div A', 'Div B', 'Div C', 'Div D'];
        state.data.divisions = new Set(divisions);
        
        // Genereer 90 dagen aan testgegevens (3 maanden)
        for (let i = 90; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateStr = formatDate(date);
            
            // Voor elke divisie, genereer data voor deze dag
            divisions.forEach(division => {
                // Patronen simuleren:
                // - Openstaande items variëren tussen 5-25, met hogere aantallen in het weekend
                // - Verpakte items variëren tussen 2-20, met lagere aantallen in het weekend
                const dayOfWeek = date.getDay(); // 0 = zondag, 6 = zaterdag
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                
                // Verschillende patronen per divisie
                const divIndex = divisions.indexOf(division);
                const multiplier = (divIndex + 1) * 0.5; // Div A heeft minder items dan Div D
                
                const baseOpenItems = Math.floor((isWeekend ? 15 : 10) * multiplier);
                const basePackedItems = Math.floor((isWeekend ? 8 : 12) * multiplier);
                
                // Random variatie toevoegen
                const openItems = Math.max(1, Math.floor(baseOpenItems + (Math.random() * 10 * multiplier)));
                const packedItems = Math.max(0, Math.floor(basePackedItems + (Math.random() * 8 * multiplier)));
                
                // Voeg toe aan de ruwe data
                state.data.rawData.push({
                    date: dateStr,
                    divisie: division,
                    status: 'open',
                    count: openItems
                });
                
                state.data.rawData.push({
                    date: dateStr,
                    divisie: division,
                    status: 'packed',
                    count: packedItems
                });
            });
        }
        
        state.lastUpdated = new Date();
        updateLastUpdatedText();
    };

    // Vul de divisie-dropdown met de beschikbare divisies
    const populateDivisionsDropdown = () => {
        // Sla de huidige selectie op
        const currentSelection = elements.divisionSelector.value;
        
        // Maak de dropdown leeg (behalve de "alle" optie)
        while (elements.divisionSelector.options.length > 1) {
            elements.divisionSelector.remove(1);
        }
        
        // Voeg divisie-opties toe
        state.data.divisions.forEach(division => {
            const option = document.createElement('option');
            option.value = division;
            option.textContent = division;
            elements.divisionSelector.appendChild(option);
        });
        
        // Herstel de eerdere selectie als deze nog bestaat
        if (currentSelection && Array.from(elements.divisionSelector.options).some(opt => opt.value === currentSelection)) {
            elements.divisionSelector.value = currentSelection;
        }
    };

    // Updatefunctie voor het laatst bijgewerkt-bericht
    const updateLastUpdatedText = () => {
        const formattedDate = state.lastUpdated.toLocaleString('nl-NL');
        elements.lastUpdated.textContent = `Laatst bijgewerkt: ${formattedDate}`;
    };

    // Format een datum naar YYYY-MM-DD string
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Bereid de data voor op basis van geselecteerde instellingen (bereik en groepering)
    const updateChartData = () => {
        console.log("Chart data bijwerken...");
        
        if (!state.data.rawData || state.data.rawData.length === 0) {
            console.warn("Geen ruwe data beschikbaar voor chart update");
            return;
        }
        
        // Bereid de data voor
        prepareChartData();
        
        // Render alle componenten
        renderChart();
        renderTable();
        updateStats();
        
        console.log("Chart data bijgewerkt:", state.chartData);
    };

    // Render de grafiek
    const renderChart = () => {
        // Controleer of er chart data beschikbaar is
        if (!state.chartData || !state.chartData.labels || state.chartData.labels.length === 0) {
            console.warn('Geen chart data beschikbaar voor weergave');
            return;
        }
        
        // Vernietig de bestaande chart als deze bestaat
        if (state.chartInstance) {
            state.chartInstance.destroy();
        }
        
        // Formateer labels op basis van gekozen groepering
        const formattedLabels = state.chartData.labels.map(label => {
            if (state.dataGrouping === 'day') {
                // Formatteer als dd/mm
                const date = new Date(label);
                return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
            } else if (state.dataGrouping === 'week') {
                // Week labels blijven zoals ze zijn (YYYY-Wxx)
                return label;
            } else if (state.dataGrouping === 'month') {
                // Formatteer als mm/yyyy
                const [year, month] = label.split('-');
                return `${month}/${year}`;
            }
            return label;
        });
        
        const ctx = elements.chartContainer.getContext('2d');
        
        // Chart configuratie op basis van geselecteerd chartType
        let chartConfig;
        
        // Bepaal chart titeltekst op basis van geselecteerde divisie
        const divisionTitle = state.selectedDivision === 'all' 
            ? 'Alle Divisies' 
            : `Divisie: ${state.selectedDivision}`;
        
        if (state.chartType === 'line') {
            chartConfig = {
                type: 'line',
                data: {
                    labels: formattedLabels,
                    datasets: [
                        {
                            label: 'Openstaande items',
                            data: state.chartData.openItems,
                            borderColor: 'rgba(255, 99, 132, 1)',
                            backgroundColor: 'rgba(255, 99, 132, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.2
                        },
                        {
                            label: 'Verpakte items',
                            data: state.chartData.packedItems,
                            borderColor: 'rgba(54, 162, 235, 1)',
                            backgroundColor: 'rgba(54, 162, 235, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.2
                        }
                    ]
                },
                options: getChartOptions(divisionTitle)
            };
        } else if (state.chartType === 'bar') {
            chartConfig = {
                type: 'bar',
                data: {
                    labels: formattedLabels,
                    datasets: [
                        {
                            label: 'Openstaande items',
                            data: state.chartData.openItems,
                            backgroundColor: 'rgba(255, 99, 132, 0.7)',
                            borderWidth: 1
                        },
                        {
                            label: 'Verpakte items',
                            data: state.chartData.packedItems,
                            backgroundColor: 'rgba(54, 162, 235, 0.7)',
                            borderWidth: 1
                        }
                    ]
                },
                options: getChartOptions(divisionTitle)
            };
        } else if (state.chartType === 'stacked-bar') {
            chartConfig = {
                type: 'bar',
                data: {
                    labels: formattedLabels,
                    datasets: [
                        {
                            label: 'Openstaande items',
                            data: state.chartData.openItems,
                            backgroundColor: 'rgba(255, 99, 132, 0.7)',
                            borderWidth: 1
                        },
                        {
                            label: 'Verpakte items',
                            data: state.chartData.packedItems,
                            backgroundColor: 'rgba(54, 162, 235, 0.7)',
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    ...getChartOptions(divisionTitle),
                    scales: {
                        x: {
                            stacked: true
                        },
                        y: {
                            stacked: true,
                            beginAtZero: true
                        }
                    }
                }
            };
        }
        
        // Maak de nieuwe chart aan
        try {
            state.chartInstance = new Chart(ctx, chartConfig);
        } catch (error) {
            console.error('Fout bij het aanmaken van de grafiek:', error);
        }
    };

    // Stel standaard grafiekopties in
    const getChartOptions = (titleText) => {
        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                title: {
                    display: true,
                    text: titleText,
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    padding: {
                        top: 10,
                        bottom: 20
                    }
                },
                legend: {
                    position: 'top',
                    labels: {
                        font: {
                            size: 14
                        }
                    }
                },
                tooltip: {
                    padding: 10,
                    bodyFont: {
                        size: 14
                    },
                    titleFont: {
                        size: 16
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Aantal items',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: state.dataGrouping === 'day' ? 'Datum' : 
                              state.dataGrouping === 'week' ? 'Week' : 'Maand',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    }
                }
            }
        };
    };

    // Render de tabeldata
    const renderTable = () => {
        console.log("Rendering table...");
        
        const tableBody = document.getElementById('data-table-body');
        if (!tableBody) {
            console.error('Tabel body element niet gevonden! DOM-structuur:', document.body.innerHTML);
            return;
        }
        
        tableBody.innerHTML = '';
        
        if (!state.chartData || !state.chartData.combinedData) {
            console.warn('Geen data beschikbaar voor tabel:', state.chartData);
            return;
        }
        
        console.log("Tabel data:", state.chartData.combinedData);
        
        state.chartData.combinedData.forEach(item => {
            const row = document.createElement('tr');
            
            // Maak een geformatteerde datum
            let displayDate = item.date;
            if (state.dataGrouping === 'day') {
                const date = new Date(item.date);
                displayDate = `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
            }
            
            // Log de waarden die we gaan renderen
            console.log(`Rij toevoegen: Datum=${displayDate}, Open=${item.open}, Packed=${item.packed}`);
            
            // Maak een rij met alleen Datum, Openstaande items en Verpakte items
            row.innerHTML = `
                <td>${displayDate}</td>
                <td>${item.open !== undefined ? item.open : 'N/A'}</td>
                <td>${item.packed !== undefined ? item.packed : 'N/A'}</td>
            `;
            
            tableBody.appendChild(row);
        });
        
        console.log("Tabel rendering voltooid");
    };

    // Update de statistieken bovenaan de pagina
    const updateStats = () => {
        if (!state.chartData || !state.chartData.combinedData.length) {
            console.warn('Geen data beschikbaar voor statistieken');
            return;
        }
        
        // Tel totaal aantal openstaande items (meest recente dag)
        const mostRecentData = state.chartData.combinedData[state.chartData.combinedData.length - 1];
        
        if (elements.totalOpenItems) elements.totalOpenItems.textContent = mostRecentData.open;
        if (elements.totalPackedItems) elements.totalPackedItems.textContent = mostRecentData.packed;
        
        // Bereken aantal dagen backlog
        const recentDays = Math.min(7, state.chartData.combinedData.length);
        const recentData = state.chartData.combinedData.slice(-recentDays);
        
        const avgPackedPerDay = recentData.reduce((sum, item) => sum + (item.packed || 0), 0) / recentDays;
        
        // Voorkom delen door nul
        const backlogDays = avgPackedPerDay > 0 ? 
            Math.ceil(mostRecentData.open / avgPackedPerDay) : 0;
            
        if (elements.backlogDays) elements.backlogDays.textContent = backlogDays;
    };

    // Voorbereiden van data voor de grafiek
    const prepareChartData = () => {
        // Bereken startdatum op basis van geselecteerde periode
        const today = new Date();
        const startDate = new Date(today);
        
        if (state.timePeriod === '30days') {
            startDate.setDate(today.getDate() - 30);
        } else if (state.timePeriod === '90days') {
            startDate.setDate(today.getDate() - 90);
        } else if (state.timePeriod === '6months') {
            startDate.setMonth(today.getMonth() - 6);
        } else if (state.timePeriod === '1year') {
            startDate.setFullYear(today.getFullYear() - 1);
        }
        
        startDate.setHours(0, 0, 0, 0);
        
        // Controleer of er data beschikbaar is
        if (!state.data.rawData || state.data.rawData.length === 0) {
            console.warn('Geen data beschikbaar voor de grafiek');
            return;
        }
        
        // Filter data op basis van startdatum
        const filteredData = state.data.rawData.filter(item => 
            new Date(item.date) >= startDate
        );
        
        // Als er een divisiefilter is ingesteld, pas dat toe
        const divisieFilteredData = state.selectedDivision === 'all' ? 
            filteredData : 
            filteredData.filter(item => item.divisie === state.selectedDivision);
        
        // Groepeer data op basis van geselecteerde optie
        let groupedOpenItems, groupedPackedItems;
        
        // Splits data in open en packed items
        const openItems = divisieFilteredData.filter(item => item.status === 'open');
        const packedItems = divisieFilteredData.filter(item => item.status === 'packed');
        
        if (state.dataGrouping === 'day') {
            // Geen additionele groepering nodig voor dagen
            groupedOpenItems = openItems;
            groupedPackedItems = packedItems;
        } else if (state.dataGrouping === 'week') {
            groupedOpenItems = groupByPeriod(openItems, 'week');
            groupedPackedItems = groupByPeriod(packedItems, 'week');
        } else if (state.dataGrouping === 'month') {
            groupedOpenItems = groupByPeriod(openItems, 'month');
            groupedPackedItems = groupByPeriod(packedItems, 'month');
        }
        
        // Sorteer op datum
        groupedOpenItems.sort((a, b) => new Date(a.date) - new Date(b.date));
        groupedPackedItems.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Zorg ervoor dat we unieke datums hebben
        const allDates = new Set([
            ...groupedOpenItems.map(item => item.date),
            ...groupedPackedItems.map(item => item.date)
        ]);
        const sortedDates = Array.from(allDates).sort((a, b) => {
            if (state.dataGrouping === 'day') {
                return new Date(a) - new Date(b);
            } else if (state.dataGrouping === 'week') {
                const [yearA, weekA] = a.replace('W', '-').split('-');
                const [yearB, weekB] = b.replace('W', '-').split('-');
                return yearA === yearB ? weekA - weekB : yearA - yearB;
            } else if (state.dataGrouping === 'month') {
                return a.localeCompare(b);
            }
            return 0;
        });
        
        // Bereid data voor met gealigneerde datums
        const openItemsByDate = {};
        const packedItemsByDate = {};
        
        groupedOpenItems.forEach(item => {
            openItemsByDate[item.date] = item.count;
        });
        
        groupedPackedItems.forEach(item => {
            packedItemsByDate[item.date] = item.count;
        });
        
        // Update state met de voorbereide data
        state.chartData = {
            labels: sortedDates,
            openItems: sortedDates.map(date => openItemsByDate[date] || 0),
            packedItems: sortedDates.map(date => packedItemsByDate[date] || 0),
            combinedData: sortedDates.map(date => ({
                date: date,
                open: openItemsByDate[date] || 0,
                packed: packedItemsByDate[date] || 0
            }))
        };
    };

    // Generieke functie voor groeperen per periode (week of maand)
    const groupByPeriod = (items, period) => {
        const grouped = {};
        
        items.forEach(item => {
            const date = new Date(item.date);
            let key;
            
            if (period === 'week') {
                const weekNumber = getWeekNumber(date);
                const year = date.getFullYear();
                key = `${year}-W${weekNumber}`;
            } else if (period === 'month') {
                const year = date.getFullYear();
                const month = date.getMonth() + 1;
                key = `${year}-${String(month).padStart(2, '0')}`;
            }
            
            if (!grouped[key]) {
                grouped[key] = {
                    date: key,
                    count: 0
                };
            }
            
            grouped[key].count += item.count;
        });
        
        return Object.values(grouped);
    };

    // Hulpfunctie om weeknummer te berekenen
    const getWeekNumber = (date) => {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    };

    // Functie om de HTML-structuur te onderzoeken en het juiste tabel element te vinden
    function findTableElement() {
        console.log("Zoeken naar tabel element...");
        
        // Zoek alle tabellen
        const tables = document.querySelectorAll('table');
        console.log(`Aantal tabellen gevonden: ${tables.length}`);
        
        tables.forEach((table, index) => {
            console.log(`Tabel ${index}:`, table);
            console.log(`  Headers:`, table.querySelectorAll('th').length);
            console.log(`  Rijen:`, table.querySelectorAll('tbody tr').length);
        });
        
        // Probeer specifiek het data-table-body element te vinden
        const dataTableBody = document.getElementById('data-table-body');
        console.log("data-table-body element:", dataTableBody);
        
        // Alle tbody elementen
        const tbodyElements = document.querySelectorAll('tbody');
        console.log(`Aantal tbody elementen: ${tbodyElements.length}`);
        tbodyElements.forEach((tbody, index) => {
            console.log(`tbody ${index}:`, tbody);
        });
    }

    // Voeg deze aanroep toe na de DOM is geladen
    setTimeout(findTableElement, 500); // Geef het even de tijd om te laden

    // Start de applicatie
    init();
}); 