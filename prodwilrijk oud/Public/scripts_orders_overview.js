document.addEventListener('DOMContentLoaded', () => {
    // State voor de grafiekdata en instellingen
    const state = {
        chartInstance: null,
        data: {
            openItems: [], // {date: string, count: number}
            packedItems: [], // {date: string, count: number}
            rawData: [] // {date: string, status: string, count: number}
        },
        chartType: 'line', // 'line', 'bar', 'stacked-bar'
        dateRange: 14, // dagen
        dataGrouping: 'day', // 'day', 'week', 'month'
        lastUpdated: null,
        timePeriod: '30days' // '30days', '90days', '6months', '1year'
    };

    // DOM elementen
    const elements = {
        chartContainer: document.getElementById('order-chart'),
        dateRangeSelector: document.getElementById('date-range'),
        chartTypeSelector: document.getElementById('chart-type'),
        dataGroupSelector: document.getElementById('data-group'),
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
        setupEventListeners();
        await fetchOrderData();
        updateChartData();
        renderChart();
        renderTable();
        updateStats();
    };

    // Event listeners instellen
    const setupEventListeners = () => {
        elements.dateRangeSelector.addEventListener('change', (e) => {
            state.dateRange = parseInt(e.target.value);
            updateChartData();
            renderChart();
            renderTable();
        });

        elements.chartTypeSelector.addEventListener('change', (e) => {
            state.chartType = e.target.value;
            renderChart();
        });

        elements.dataGroupSelector.addEventListener('change', (e) => {
            state.dataGrouping = e.target.value;
            updateChartData();
            renderChart();
            renderTable();
        });
    };

    // Ophalen van orderdata voor de grafiek
    const fetchOrderData = async () => {
        try {
            console.log("Ophalen van orderdata gestart voor standaardpagina...");
            
            // Ophalen van de huidige open items
            const openResponse = await fetch('/api/items_to_pack');
            if (!openResponse.ok) throw new Error('Fout bij ophalen items om te verpakken');
            const openItems = await openResponse.json();
            console.log("Open items opgehaald:", openItems.length);
            
            // Ophalen van de verpakte items
            const packedResponse = await fetch('/api/packed_items');
            if (!packedResponse.ok) throw new Error('Fout bij ophalen verpakte items');
            const packedItems = await packedResponse.json();
            console.log("Verpakte items opgehaald:", packedItems.length);
            
            // Als er geen items zijn, gebruik testdata
            if ((!openItems || !openItems.length) && (!packedItems || !packedItems.length)) {
                console.warn('Gebruik testdata vanwege ontbrekende API data');
                return useTestData();
            }

            // De huidige items verwerken
            const today = new Date();
            const todayStr = formatDate(today);
            console.log("Huidige datum:", todayStr);
            
            // Log eerste items om structuur te controleren
            if (openItems.length > 0) console.log("Voorbeeld open item:", openItems[0]);
            if (packedItems.length > 0) console.log("Voorbeeld packed item:", packedItems[0]);
            
            // Verwerk de verpakte items per datum
            const itemsPackedByDate = {};
            
            packedItems.forEach(item => {
                const amount = item.amount || 1;
                
                if (item.date_packed) {
                    const dateStr = formatDate(new Date(item.date_packed));
                    
                    // Initialiseer data voor deze datum indien nodig
                    if (!itemsPackedByDate[dateStr]) {
                        itemsPackedByDate[dateStr] = 0;
                    }
                    
                    // Tel aantal verpakte items bij voor deze datum
                    itemsPackedByDate[dateStr] += amount;
                }
            });
            
            console.log("Items verpakt per datum:", itemsPackedByDate);
            
            // Analyseer de huidige open items op basis van date_added
            const openItemsByDateAdded = {};
            
            // Verwerk de open items per datum waarop ze zijn toegevoegd
            openItems.forEach(item => {
                if (item.date_added) {
                    const dateStr = formatDate(new Date(item.date_added));
                    const quantity = item.quantity || 1;
                    
                    if (!openItemsByDateAdded[dateStr]) {
                        openItemsByDateAdded[dateStr] = 0;
                    }
                    
                    openItemsByDateAdded[dateStr] += quantity;
                }
            });
            
            console.log("Open items per datum toegevoegd:", openItemsByDateAdded);
            
            // Verzamel alle datums uit de datasets en voeg de laatste 90 dagen toe
            const allDates = new Set([
                ...Object.keys(itemsPackedByDate),
                ...Object.keys(openItemsByDateAdded)
            ]);
            
            const startDate = new Date(today);
            startDate.setDate(startDate.getDate() - 90);
            
            for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
                const dateStr = formatDate(d);
                allDates.add(dateStr);
            }
            
            // Sorteer de datums
            const sortedDates = Array.from(allDates).sort();
            console.log("Gesorteerde datums:", sortedDates);
            
            // Bereid de data voor
            state.data.rawData = [];
            
            sortedDates.forEach((dateStr) => {
                const isToday = dateStr === todayStr;
                const itemsPackedToday = itemsPackedByDate[dateStr] || 0;
                
                // Voor openstaande items: tel alleen items die vóór deze datum zijn toegevoegd
                // en nog steeds in de openItems lijst staan
                let openItemsCount = 0;
                
                // Bereken openstaande items (uitgesloten van vandaag)
                Object.keys(openItemsByDateAdded).forEach(addedDate => {
                    const addedDateObj = new Date(addedDate);
                    const currentDateObj = new Date(dateStr);
                    
                    // Tel alleen items van voorgaande datums
                    if (addedDateObj < currentDateObj || 
                        (isToday && addedDate !== todayStr)) { // Voor vandaag tellen we alles mee behalve wat vandaag zelf is toegevoegd
                        openItemsCount += openItemsByDateAdded[addedDate];
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
        state.data.openItems = [];
        state.data.packedItems = [];
        
        // Genereer 90 dagen aan testgegevens (3 maanden)
        for (let i = 90; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateStr = formatDate(date);
            
            // Patronen simuleren:
            // - Openstaande items variëren tussen 10-50, met hogere aantallen in het weekend
            // - Verpakte items variëren tussen 5-45, met lagere aantallen in het weekend
            const dayOfWeek = date.getDay(); // 0 = zondag, 6 = zaterdag
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            const baseOpenItems = isWeekend ? 35 : 20;
            const basePackedItems = isWeekend ? 15 : 30;
            
            // Random variatie toevoegen
            const openItems = Math.floor(baseOpenItems + (Math.random() * 15));
            const packedItems = Math.floor(basePackedItems + (Math.random() * 15));
            
            state.data.openItems.push({ date: dateStr, count: openItems });
            state.data.packedItems.push({ date: dateStr, count: packedItems });
        }
        
        state.lastUpdated = new Date();
        updateLastUpdatedText();
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
        
        // Filter data op basis van startdatum
        const filteredData = state.data.rawData.filter(item => 
            new Date(item.date) >= startDate
        );
        
        // Groepeer data op basis van geselecteerde optie
        let groupedOpenItems, groupedPackedItems;
        
        // Splits data in open en packed items
        const openItems = filteredData.filter(item => item.status === 'open');
        const packedItems = filteredData.filter(item => item.status === 'packed');
        
        if (state.dataGrouping === 'day') {
            // Geen additionele groepering nodig voor dagen
            groupedOpenItems = openItems;
            groupedPackedItems = packedItems;
        } else if (state.dataGrouping === 'week') {
            groupedOpenItems = groupByWeek(openItems);
            groupedPackedItems = groupByWeek(packedItems);
        } else if (state.dataGrouping === 'month') {
            groupedOpenItems = groupByMonth(openItems);
            groupedPackedItems = groupByMonth(packedItems);
        }
        
        // Sorteer op datum
        groupedOpenItems.sort((a, b) => new Date(a.date) - new Date(b.date));
        groupedPackedItems.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Zorg ervoor dat we unieke datums hebben
        const allDates = new Set([
            ...groupedOpenItems.map(item => item.date),
            ...groupedPackedItems.map(item => item.date)
        ]);
        const sortedDates = Array.from(allDates).sort((a, b) => new Date(a) - new Date(b));
        
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
        
        renderChart();
    };

    // Groepeer data per week
    const groupByWeek = (items) => {
        const groupedData = {};
        
        items.forEach(item => {
            const date = new Date(item.date);
            // Bereken weeknummer en jaar
            const weekNumber = getWeekNumber(date);
            const year = date.getFullYear();
            const weekKey = `${year}-W${weekNumber}`;
            
            if (!groupedData[weekKey]) {
                groupedData[weekKey] = { date: weekKey, count: 0 };
            }
            groupedData[weekKey].count += item.count;
        });
        
        return Object.values(groupedData);
    };

    // Hulpfunctie om weeknummer te berekenen
    const getWeekNumber = (date) => {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    };

    // Groepeer data per maand
    const groupByMonth = (items) => {
        const groupedData = {};
        
        items.forEach(item => {
            const date = new Date(item.date);
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const monthKey = `${year}-${String(month).padStart(2, '0')}`;
            
            if (!groupedData[monthKey]) {
                groupedData[monthKey] = { date: monthKey, count: 0 };
            }
            groupedData[monthKey].count += item.count;
        });
        
        return Object.values(groupedData);
    };

    // Render de grafiek
    const renderChart = () => {
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
                options: getChartOptions()
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
                options: getChartOptions()
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
                    ...getChartOptions(),
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
        
        state.chartInstance = new Chart(ctx, chartConfig);
    };

    // Stel standaard grafiekopties in
    const getChartOptions = () => {
        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
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
        elements.dataTableBody.innerHTML = '';
        
        state.chartData.combinedData.forEach(item => {
            const row = document.createElement('tr');
            
            // Maak een geformatteerde datum op basis van de groepering
            let displayDate = item.date;
            
            if (state.dataGrouping === 'day') {
                // Formatteer als dd-mm-yyyy
                const date = new Date(item.date);
                displayDate = `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
            }
            
            row.innerHTML = `
                <td>${displayDate}</td>
                <td>${item.open}</td>
                <td>${item.packed}</td>
            `;
            
            elements.dataTableBody.appendChild(row);
        });
    };

    // Update de statistieken bovenaan de pagina
    const updateStats = () => {
        if (!state.chartData || !state.chartData.combinedData.length) return;
        
        // Tel totaal aantal openstaande items (meest recente dag)
        const mostRecentData = state.chartData.combinedData[state.chartData.combinedData.length - 1];
        elements.totalOpenItems.textContent = mostRecentData.open;
        elements.totalPackedItems.textContent = mostRecentData.packed;
        
        // Bereken aantal dagen backlog: 
        // (Als vuistregel: gemiddelde aantal verpakt per dag delen op aantal openstaand)
        const recentDays = Math.min(7, state.chartData.combinedData.length);
        const recentData = state.chartData.combinedData.slice(-recentDays);
        
        const avgPackedPerDay = recentData.reduce((sum, item) => sum + item.packed, 0) / recentDays;
        
        // Voorkom delen door nul
        const backlogDays = avgPackedPerDay > 0 ? 
            Math.ceil(mostRecentData.open / avgPackedPerDay) : 0;
            
        elements.backlogDays.textContent = backlogDays;
    };

    // Start de applicatie
    init();
}); 