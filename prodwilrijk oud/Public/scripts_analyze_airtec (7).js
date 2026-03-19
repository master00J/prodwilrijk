document.addEventListener('DOMContentLoaded', () => {
    // Laad header
    fetch('header.html')
        .then(res => res.text())
        .then(html => document.getElementById('header-placeholder').innerHTML = html);

    const filterButton = document.getElementById('filter-button');
    const downloadButton = document.getElementById('download-button');
    const analyseBody = document.getElementById('analyse-table-body');
    const uploadButton = document.getElementById('upload-button');
    const priceFileInput = document.getElementById('price-file');

    // Toggle voor het minimaliseren/maximaliseren van de prijzen sectie
    const togglePricesBtn = document.getElementById('toggle-prices');
    if (togglePricesBtn) {
        togglePricesBtn.addEventListener('click', function() {
            const priceBody = document.getElementById('price-section-body');
            const isVisible = window.getComputedStyle(priceBody).display !== 'none';
            
            // Toggle zichtbaarheid
            priceBody.style.display = isVisible ? 'none' : 'block';
            
            // Verander icoon
            const icon = this.querySelector('i');
            if (isVisible) {
                icon.classList.remove('fa-minus');
                icon.classList.add('fa-plus');
                this.setAttribute('title', 'Maximaliseren');
            } else {
                icon.classList.remove('fa-plus');
                icon.classList.add('fa-minus');
                this.setAttribute('title', 'Minimaliseren');
            }
        });
    }

    let timelogsData = [];
    let packedData = [];

    // Handler voor uploaden van prijslijst via Excel
    uploadButton.addEventListener('click', () => {
        if (!priceFileInput.files || priceFileInput.files.length === 0) {
            return alert('Selecteer eerst een Excel-bestand.');
        }
        const formData = new FormData();
        formData.append('file', priceFileInput.files[0]);
        fetch('/api/airtec/prices/upload', {
            method: 'POST',
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert(`Prijslijst succesvol geïmporteerd (${data.count} regels).`);
            } else {
                alert('Fout bij import: ' + (data.message || JSON.stringify(data.errors)));
            }
        })
        .catch(err => alert('Upload mislukt: ' + err));
    });

    filterButton.addEventListener('click', () => {
        const from = document.getElementById('date-from').value;
        const to = document.getElementById('date-to').value;
        if(!from || !to) return alert('Selecteer beide datums');

        const dateFrom = new Date(from); dateFrom.setHours(0,0,0,0);
        const dateTo = new Date(to); dateTo.setHours(23,59,59,999);

        const params = new URLSearchParams({ date_from: dateFrom.toISOString(), date_to: dateTo.toISOString() });

        // Haal timelogs en packed items op
        const timelogsPromise = fetch(`/api/airtec/timelog?${params}`).then(r => r.json());
        const packedPromise = fetch(`/api/packed_items_airtec?${params}`).then(r => r.json());

        Promise.all([timelogsPromise, packedPromise]).then(([timelogs, packed]) => {
            // Bewaar data voor later in calc
            timelogsData = timelogs;
            // Filter packed items op datumbereik
            const mf = moment(dateFrom), mt = moment(dateTo);
            packedData = packed.filter(item => {
                const d = moment(item.date_packed);
                return d.isSameOrAfter(mf) && d.isSameOrBefore(mt);
            });

            // Toon prijsinvoer en calc knop
            const priceSection = document.getElementById('price-section');
            const priceInputsContainer = document.getElementById('price-inputs');
            const chestTypes = [...new Set(packedData.map(item => item.kistnummer))];
            priceInputsContainer.innerHTML = '';
            chestTypes.forEach(type => {
                const div = document.createElement('div'); div.className = 'col-md-2';
                div.innerHTML = `
                    <label>${type} Prijs (€)</label>
                    <input type="number" id="price-${type}" class="form-control price-input" value="0" step="0.01">
                    <label>Assemblage kosten (€)</label>
                    <input type="number" id="assembly-${type}" class="form-control cost-input" value="0" step="0.01">
                    <label>Materiaal kosten (€)</label>
                    <input type="number" id="material-${type}" class="form-control cost-input" value="0" step="0.01">
                    <label>Transport kosten (€)</label>
                    <input type="number" id="transport-${type}" class="form-control cost-input" value="0" step="0.01">
                `;
                priceInputsContainer.appendChild(div);
            });
            priceSection.style.display = 'block';
            document.getElementById('calc-row').style.display = 'block';

            // Vul opgeslagen prijzen
            fetch('/api/airtec/prices').then(r=>r.json()).then(data=>{
                if(data.success) data.prices.forEach(p=>{
                    const inp = document.getElementById(`price-${p.kistnummer}`);
                    if(inp) inp.value = p.price;
                    const asmInp = document.getElementById(`assembly-${p.kistnummer}`);
                    if(asmInp) asmInp.value = p.assembly_cost;
                    const matInp = document.getElementById(`material-${p.kistnummer}`);
                    if(matInp) matInp.value = p.material_cost;
                    const transInp = document.getElementById(`transport-${p.kistnummer}`);
                    if(transInp) transInp.value = p.transport_cost || 0;
                });
            });
        });
    });

    // Bereken en toon analyse bij klik op Bereken Omzet
    const calcButton = document.getElementById('calc-button');
    calcButton.addEventListener('click', () => {
        // Clear tabel
        analyseBody.innerHTML = '';
        // Bereken en groepeer data per dag
        const days = {};
        timelogsData.forEach(log => {
            const day = moment(log.start_time).format('YYYY-MM-DD');
            if(!days[day]) days[day] = { hours:0, boxes:0, revenue:0, assemblyWilrijk:0, assemblyGenk:0, materialCost:0, transportCost:0, employeeSet: new Set() };
            // Parse werknemers en voeg toe aan set
            let werknemers = Array.isArray(log.werknemer_ids) ? log.werknemer_ids : [];
            if (!Array.isArray(log.werknemer_ids)) {
                try { werknemers = JSON.parse(log.werknemer_ids || '[]'); }
                catch(e) { console.warn('Fout bij parsen werknemer_ids:', e); }
            }
            werknemers.forEach(id => days[day].employeeSet.add(id));
            const aantal = werknemers.length;
            days[day].hours += ((log.duration||0)/3600) * aantal;
        });
        packedData.forEach(item => {
            const day = moment(item.date_packed).format('YYYY-MM-DD');
            if(!days[day]) days[day] = { hours:0, boxes:0, revenue:0, assemblyWilrijk:0, assemblyGenk:0, materialCost:0, transportCost:0, employeeSet: new Set() };
            const qty = parseInt(item.quantity) || 0;
            days[day].boxes += qty;
            const price = parseFloat(document.getElementById(`price-${item.kistnummer}`).value) || 0;
            days[day].revenue += price * qty;
            const asmCost = parseFloat(document.getElementById(`assembly-${item.kistnummer}`).value) || 0;
            const matCost = parseFloat(document.getElementById(`material-${item.kistnummer}`).value) || 0;
            const transCost = parseFloat(document.getElementById(`transport-${item.kistnummer}`).value) || 0;
            
            // Assemblagekosten gaan naar Wilrijk als er geen transportkosten zijn, anders naar Genk/Aarschot
            if (transCost > 0) {
                days[day].assemblyGenk += asmCost * qty;
            } else {
                days[day].assemblyWilrijk += asmCost * qty;
            }
            
            days[day].materialCost += matCost * qty;
            days[day].transportCost += transCost * qty;
        });

        // Bereken totalen
        const totalHours = Object.values(days).reduce((s,v)=>s+v.hours,0);
        const totalBoxes = Object.values(days).reduce((s,v)=>s+v.boxes,0);
        const totalRevenue = Object.values(days).reduce((s,v)=>s+v.revenue,0);
        const totalAssembly = Object.values(days).reduce((s,v)=>s+v.assemblyWilrijk + v.assemblyGenk,0);
        const totalMaterial = Object.values(days).reduce((s,v)=>s+v.materialCost,0);
        const totalTransport = Object.values(days).reduce((s,v)=>s+v.transportCost,0);
        // Bereken arbeidskosten à €40 per uur
        const laborCost = totalHours * 40;
        // Bereken 20% overhead op verkoopprijs
        const overheadCost = totalRevenue * 0.2;
        // Winst = verkoopprijs - kosten (assemblage, materiaal, arbeid, transport) <= EXCLUSIEF OVERHEAD VOOR MARGE
        const profitForMargin = totalRevenue - totalAssembly - totalMaterial - laborCost - totalTransport;
        // Margepercentage = (winst voor marge) / verkoopprijs
        const profitPct = totalRevenue ? (profitForMargin / totalRevenue * 100) : 0;

        // De totale winst/verlies (inclusief overhead) kan apart berekend worden indien nodig voor een andere weergave.
        const actualTotalProfit = profitForMargin - overheadCost; 

        document.getElementById('total-hours').textContent = decimalHoursToHM(totalHours);
        document.getElementById('total-labor').textContent = `€ ${laborCost.toFixed(2)}`;
        document.getElementById('total-boxes').textContent = totalBoxes;
        document.getElementById('total-revenue').textContent = `€ ${totalRevenue.toFixed(2)}`;
        document.getElementById('total-assembly').textContent = `€ ${totalAssembly.toFixed(2)}`;
        document.getElementById('total-material').textContent = `€ ${totalMaterial.toFixed(2)}`;
        document.getElementById('total-transport').textContent = `€ ${totalTransport.toFixed(2)}`;
        document.getElementById('total-overhead').textContent = `€ ${overheadCost.toFixed(2)}`;
        document.getElementById('total-profit').textContent = `€ ${profitForMargin.toFixed(2)} (${profitPct.toFixed(1)}%)`;
        document.getElementById('summary').style.display = 'flex';
        document.getElementById('summary-extra').style.display = 'flex';
        document.getElementById('profit-row').style.display = 'flex';
        document.getElementById('chart-row').style.display = 'block';

        // Enable download-knop
        document.getElementById('download-button').disabled = false;

        // Bereid data voor grafiek (met Nederlandse datums)
        const originalDates = Object.keys(days).sort();
        const labels = originalDates.map(d => toDutchDate(d));
        const dataHours = originalDates.map(d => parseFloat(days[d].hours.toFixed(2)));
        const dataBoxes = originalDates.map(d => days[d].boxes);
        const dataRevenue = originalDates.map(d => parseFloat(days[d].revenue.toFixed(2)));
        const dataTotalCosts = originalDates.map(d => {
            const labor = days[d].hours * 40; // Arbeidskosten per dag
            const overheadDaily = days[d].revenue * 0.2; // Overhead per dag
            // Kosten voor margeberekening per dag (exclusief overhead)
            const costsForMarginDaily = days[d].assemblyWilrijk + days[d].assemblyGenk + days[d].materialCost + days[d].transportCost + labor;
            const profitForMarginDaily = days[d].revenue - costsForMarginDaily;
            
            // Totale kosten per dag inclusief overhead (voor grafiek 'Kosten')
            const totalDailyCostsInclOverhead = costsForMarginDaily + overheadDaily;
            return parseFloat(totalDailyCostsInclOverhead.toFixed(2));
        });
        const dataProfit = originalDates.map((d, i) => {
            // Winst voor grafiek is Omzet - Totale Kosten (inclusief overhead, zoals berekend voor dataTotalCosts)
            return parseFloat((dataRevenue[i] - dataTotalCosts[i]).toFixed(2));
        });
        const employeeCounts = originalDates.map(d => days[d].employeeSet.size);

        // Bewaar analyse data voor later export
        window.analyzeDays = days;
        window.analyzeDates = originalDates;

        // Verwijder bestaande grafieken als ze bestaan
        if (window.revenueChart) window.revenueChart.destroy();
        if (window.hoursChart) window.hoursChart.destroy();

        // Initialiseer omzet grafiek
        const ctxRevenue = document.getElementById('revenue-chart').getContext('2d');
        window.revenueChart = new Chart(ctxRevenue, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Omzet',
                        data: dataRevenue,
                        backgroundColor: 'rgba(54, 162, 235, 0.5)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Kosten',
                        data: dataTotalCosts,
                        backgroundColor: 'rgba(255, 99, 132, 0.5)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Winst/Verlies',
                        data: dataProfit,
                        type: 'line',
                        backgroundColor: 'rgba(75, 192, 192, 0.5)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: value => `€${value}`
                        }
                    },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: {
                            size: 14,
                            weight: 'bold'
                        },
                        bodyFont: {
                            size: 13
                        },
                        padding: 12,
                        callbacks: {
                            label: function(tooltipItem) {
                                return `${tooltipItem.dataset.label}: €${tooltipItem.raw.toFixed(2)}`;
                            }
                        }
                    },
                    legend: {
                        position: 'top',
                        labels: {
                            padding: 16,
                            boxWidth: 15
                        }
                    }
                }
            }
        });

        // Initialiseer uren grafiek
        const ctxHours = document.getElementById('hours-chart').getContext('2d');
        window.hoursChart = new Chart(ctxHours, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Arbeidsuren',
                        data: dataHours,
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
                    },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: {
                            size: 14,
                            weight: 'bold'
                        },
                        bodyFont: {
                            size: 13
                        },
                        padding: 12,
                        callbacks: {
                            label: function(tooltipItem) {
                                const hours = tooltipItem.raw;
                                const employees = employeeCounts[tooltipItem.dataIndex];
                                return [`Arbeidsuren: ${hours.toFixed(2)}`, `Medewerkers: ${employees}`];
                            }
                        }
                    },
                    legend: {
                        position: 'top',
                        labels: {
                            padding: 16,
                            boxWidth: 15
                        }
                    }
                }
            }
        });

        // Tabel vullen met uitgebreide data
        originalDates.forEach(date => {
            const v = days[date]; // v bevat: hours, boxes, revenue, assemblyWilrijk, assemblyGenk, materialCost, transportCost, employeeSet
            
            const dailyLaborCost = v.hours * 40;
            const dailyOverhead = v.revenue * 0.2;
            const dailyProfitForMargin = v.revenue - v.materialCost - v.assemblyWilrijk - v.assemblyGenk - v.transportCost - dailyLaborCost;
            const dailyMarginPct = v.revenue ? (dailyProfitForMargin / v.revenue * 100) : 0;

            // Helper om valuta te formatteren
            const formatC = (val) => `€ ${val.toFixed(2)}`;

            const row = `<tr>
                            <td>${toDutchDate(date)}</td>
                            <td>${decimalHoursToHM(v.hours)}</td>
                            <td>${v.boxes}</td>
                            <td>${formatC(v.revenue)}</td>
                            <td>${formatC(v.materialCost)}</td>
                            <td>${formatC(v.assemblyWilrijk)}</td>
                            <td>${formatC(v.assemblyGenk)}</td>
                            <td>${formatC(v.transportCost)}</td>
                            <td>${formatC(dailyLaborCost)}</td>
                            <td>${formatC(dailyOverhead)}</td>
                            <td class="${dailyProfitForMargin >= 0 ? 'profit' : 'loss'}">${formatC(dailyProfitForMargin)}</td>
                            <td>${dailyMarginPct.toFixed(1)}%</td>
                         </tr>`;
            analyseBody.insertAdjacentHTML('beforeend', row);
        });

        // Voeg click events toe voor detail-rijen met verpakte kisten
        analyseBody.querySelectorAll('tr').forEach(tr => {
            tr.style.cursor = 'pointer';
            tr.addEventListener('click', () => {
                // Toggle detail-rij onder deze rij
                const next = tr.nextElementSibling;
                if (next && next.classList.contains('detail-row')) {
                    next.remove();
                    return;
                }
                // Verwijder andere open detail-rij
                const existing = analyseBody.querySelector('.detail-row');
                if (existing) existing.remove();
                // Converteer datum
                const dutchDate = tr.cells[0].textContent;
                const [dd, mm, yyyy] = dutchDate.split('-');
                const isoDate = `${yyyy}-${mm}-${dd}`;
                // Haal items voor deze datum
                const items = packedData.filter(item => moment(item.date_packed).format('YYYY-MM-DD') === isoDate);
                if (items.length === 0) return;
                // Groepeer op kistnummer
                const grouped = {};
                items.forEach(item => {
                    const key = item.kistnummer || 'Onbekend';
                    grouped[key] = (grouped[key]||0) + (parseInt(item.quantity)||0);
                });
                // Bouw detail-HTML
                let detailHtml = '<tr class="detail-row"><td colspan="12"><strong>Verpakte kisten:</strong><ul>';
                Object.entries(grouped).forEach(([kist, qty]) => {
                    detailHtml += `<li>${kist}: ${qty}</li>`;
                });
                detailHtml += '</ul></td></tr>';
                // Toon detail-rij
                tr.insertAdjacentHTML('afterend', detailHtml);
            });
        });
    });

    downloadButton.addEventListener('click', () => {
        // Excel-export met SheetJS & FileSaver
        const days = window.analyzeDays || {};
        const dates = window.analyzeDates || [];
        // Bereken totalen over alle dagen
        const totalHours = dates.reduce((sum, d) => sum + (days[d].hours||0), 0);
        const totalAssembly = dates.reduce((sum, d) => sum + (days[d].assemblyWilrijk + days[d].assemblyGenk), 0);
        const totalMaterial = dates.reduce((sum, d) => sum + (days[d].materialCost||0), 0);
        const totalTransport = dates.reduce((sum, d) => sum + (days[d].transportCost||0), 0);
        const laborCost = totalHours * 40;
        const totalBoxes = dates.reduce((sum, d) => sum + (days[d].boxes||0), 0);
        const totalRevenue = dates.reduce((sum, d) => sum + (days[d].revenue||0), 0);
        const profit = totalRevenue - totalAssembly - totalMaterial - laborCost - totalTransport;
        // Bouw worksheet data met formules (Engelse Excel: functie SUM en ; als scheiding)
        const wsData = [];
        const header = ['Datum','Manuren','Wilrijk (Arbeid)','Aantal Kisten','Materiaalkosten (€)','Wilrijk (Assemblage)','Genk/Aarschot','Transportkosten (€)','Verkoopprijs (€)','Overheadkosten (€)','Marge (€)','Marge (%)'];
        console.log('Excel header:', header);
        console.log('Header length:', header.length);
        wsData.push(header);
        const totalRow = [
            'Totaal',
            { f: `SUM(B3:B${dates.length+2})` },        // totaal manuren
            { f: `B2*40` },                              // arbeidskost
            { f: `SUM(D3:D${dates.length+2})` },        // totaal kisten
            { f: `SUM(E3:E${dates.length+2})` },        // materiaalkosten
            { f: `SUM(F3:F${dates.length+2})` },        // Wilrijk assemblage
            { f: `SUM(G3:G${dates.length+2})` },        // Genk/Aarschot assemblage
            { f: `SUM(H3:H${dates.length+2})` },        // transportkosten
            { f: `SUM(I3:I${dates.length+2})` },        // verkoopprijs
            { f: `I2*0.2` },                            // overhead 20%
            { f: `I2-E2-F2-G2-H2-C2` },                 // marge (€) - EXCLUSIEF OVERHEAD
            { f: `K2/I2` }                              // marge (%)
        ];
        wsData.push(totalRow);
        // Detail per dag met formules voor arbeidskost, overhead en marge
        dates.forEach((d, i) => {
            const rec = days[d];
            const rowIdx = i + 3; // eerste datarij is rij 3
            const dataRow = [
                toDutchDate(d),
                parseFloat(rec.hours.toFixed(2)),
                { f: `B${rowIdx}*40` }, // Arbeidskost
                rec.boxes,
                parseFloat(rec.materialCost.toFixed(2)), // Materiaalkosten
                parseFloat(rec.assemblyWilrijk.toFixed(2)), // Assemblagekosten Wilrijk
                parseFloat(rec.assemblyGenk.toFixed(2)), // Assemblagekosten Genk/Aarschot
                parseFloat(rec.transportCost.toFixed(2)), // Transportkosten
                parseFloat(rec.revenue.toFixed(2)), // Verkoopprijs
                { f: `I${rowIdx}*0.2` }, // Overhead = 20% van verkoopprijs (I)
                { f: `I${rowIdx}-E${rowIdx}-F${rowIdx}-G${rowIdx}-H${rowIdx}-C${rowIdx}` }, // Marge (€) = Verkoopprijs (I) - Materiaal (E) - Wilrijk Assemblage (F) - Genk Assemblage (G) - Transport (H) - Arbeid (C)
                { f: `K${rowIdx}/I${rowIdx}` } // Marge (%)
            ];
            if (i === 0) {
                console.log('First data row:', dataRow);
                console.log('Data row length:', dataRow.length);
                console.log('assemblyWilrijk:', rec.assemblyWilrijk);
                console.log('assemblyGenk:', rec.assemblyGenk);
            }
            wsData.push(dataRow);
        });
        // Genereer en download Excel
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(wsData, { raw: false });
        // Style header row (bold & center) and total row (bold, center, grey fill)
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let C = range.s.c; C <= range.e.c; ++C) {
            // Header row (row 0)
            const headerCell = XLSX.utils.encode_cell({ r: 0, c: C });
            if (ws[headerCell]) {
                ws[headerCell].s = ws[headerCell].s || {};
                ws[headerCell].s.font = { bold: true };
                ws[headerCell].s.alignment = { horizontal: 'center' };
            }
            // Total row (row 1)
            const totalCell = XLSX.utils.encode_cell({ r: 1, c: C });
            if (ws[totalCell]) {
                ws[totalCell].s = ws[totalCell].s || {};
                ws[totalCell].s.font = { bold: true };
                ws[totalCell].s.alignment = { horizontal: 'center' };
                ws[totalCell].s.fill = { patternType: 'solid', fgColor: { rgb: 'DDDDDD' } };
            }
        }
        // Currency formatting for € columns and percentage for Marge (%)
        const currencyCols = [2, 4, 5, 6, 7, 8, 9, 10];
        const percentCols = [11];
        for (let R = 1; R <= range.e.r; ++R) {
            currencyCols.forEach(C => {
                const ref = XLSX.utils.encode_cell({ r: R, c: C });
                if (ws[ref]) ws[ref].z = '€#,##0.00';
            });
            percentCols.forEach(C => {
                const ref = XLSX.utils.encode_cell({ r: R, c: C });
                if (ws[ref]) ws[ref].z = '0.00%';
            });
        }
        XLSX.utils.book_append_sheet(wb, ws, 'Analyse');
        
        // Maak nieuw tabblad voor verpakte kisten details
        const boxesData = [];
        // Header voor kisten tabblad
        boxesData.push(['Datum', 'Kistnummer', 'Aantal', 'Verkoopprijs per stuk (€)', 'Transportkosten (€)', 'Totale verkoopprijs (€)']);
        
        // Groepeer verpakte kisten per datum en kistnummer
        const boxesByDate = {};
        packedData.forEach(item => {
            const day = moment(item.date_packed).format('YYYY-MM-DD');
            if (!boxesByDate[day]) boxesByDate[day] = {};
            
            const kistType = item.kistnummer || 'Onbekend';
            if (!boxesByDate[day][kistType]) {
                boxesByDate[day][kistType] = {
                    quantity: 0,
                    price: parseFloat(document.getElementById(`price-${kistType}`)?.value || 0),
                    transportCost: 0
                };
            }
            
            boxesByDate[day][kistType].quantity += parseInt(item.quantity) || 0;
            
            // Haal transportkosten op uit de prijs input sectie (indien beschikbaar)
            const transportInput = document.getElementById(`transport-${kistType}`);
            if (transportInput) {
                boxesByDate[day][kistType].transportCost = parseFloat(transportInput.value || 0);
            }
        });
        
        // Vul transportkosten in uit de database als beschikbaar
        fetch('/api/airtec/prices').then(r=>r.json()).then(data=>{
            if(data.success) {
                data.prices.forEach(p => {
                    Object.values(boxesByDate).forEach(boxesByType => {
                        if (boxesByType[p.kistnummer]) {
                            boxesByType[p.kistnummer].transportCost = parseFloat(p.transport_cost || 0);
                        }
                    });
                });
                
                // Voeg kisten data toe aan worksheet, met visuele groepering per datum
                updateBoxesWorksheet();
            }
        }).catch(() => {
            // Als de fetch mislukt, ga verder zonder transportkosten
            updateBoxesWorksheet();
        });
        
        function updateBoxesWorksheet() {
            let currentRowIdx = 1; // Begin na de header rij
            let totalQuantity = 0;
            let totalValue = 0;
            let totalTransport = 0;
            const groupHeaderRows = []; // Houd rijen bij met datumheaders
            const dataRows = []; // Houd rijen bij met data
            
            Object.keys(boxesByDate).sort().forEach(date => {
                const boxes = boxesByDate[date];
                
                // Voeg datum header toe met lege cellen (voor merge)
                boxesData.push([
                    toDutchDate(date),
                    '',
                    '',
                    '',
                    '',
                    '',
                    ''
                ]);
                groupHeaderRows.push(currentRowIdx);
                currentRowIdx++;
                
                // Subtotalen voor deze datum
                let dateQuantity = 0;
                let dateValue = 0;
                let dateTransport = 0;
                
                // Voeg data rijen toe voor deze datum
                Object.keys(boxes).sort().forEach(kistType => {
                    const { quantity, price, transportCost } = boxes[kistType];
                    const totalTransportCost = quantity * transportCost;
                    const totalPrice = quantity * price;
                    
                    // Bereken subtotalen
                    dateQuantity += quantity;
                    dateValue += totalPrice;
                    dateTransport += totalTransportCost;
                    
                    // Bereken totalen
                    totalQuantity += quantity;
                    totalValue += totalPrice;
                    totalTransport += totalTransportCost;
                    
                    boxesData.push([
                        '',  // Lege datum cel
                        kistType,
                        quantity,
                        price,
                        transportCost,
                        totalPrice
                    ]);
                    dataRows.push(currentRowIdx);
                    currentRowIdx++;
                });
                
                // Voeg subtotaalrij toe voor deze datum
                boxesData.push([
                    '',
                    'Subtotaal',
                    dateQuantity,
                    '',
                    dateTransport,
                    dateValue
                ]);
                currentRowIdx++;
                
                // Voeg lege rij toe voor visuele scheiding
                boxesData.push(['', '', '', '', '', '', '']);
                currentRowIdx++;
            });
            
            // Voeg totaalrij toe
            boxesData.push([
                'Totaal',
                '',
                totalQuantity,
                '',
                totalTransport,
                totalValue
            ]);
            
            // Maak worksheet voor kisten tabblad
            const wsBoxes = XLSX.utils.aoa_to_sheet(boxesData, { raw: false });
            
            // Voeg cell merges toe voor datumheaders
            if (!wsBoxes['!merges']) wsBoxes['!merges'] = [];
            groupHeaderRows.forEach(rowIdx => {
                // Merge alle cellen in de datumheader
                wsBoxes['!merges'].push({ 
                    s: { r: rowIdx, c: 0 }, 
                    e: { r: rowIdx, c: 5 } 
                });
            });
            
            // Style header, datum headers, subtotalen en totaalrij
            const boxesRange = XLSX.utils.decode_range(wsBoxes['!ref']);
            
            // Style voor alle cellen
            for (let R = 0; R <= boxesRange.e.r; ++R) {
                for (let C = 0; C <= boxesRange.e.c; ++C) {
                    const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
                    if (!wsBoxes[cellRef]) continue;
                    
                    // Basisstijl voor alle cellen
                    wsBoxes[cellRef].s = wsBoxes[cellRef].s || {};
                    wsBoxes[cellRef].s.alignment = { vertical: 'center' };
                    
                    // Alternatieve rijkleuren voor data rijen
                    if (dataRows.includes(R) && R % 2 === 1) {
                        wsBoxes[cellRef].s.fill = { 
                            patternType: 'solid', 
                            fgColor: { rgb: 'F5F5F5' } 
                        };
                    }
                }
            }
            
            // Specifieke styling per type rij
            for (let C = 0; C <= boxesRange.e.c; ++C) {
                // Header row (row 0)
                const headerCell = XLSX.utils.encode_cell({ r: 0, c: C });
                if (wsBoxes[headerCell]) {
                    wsBoxes[headerCell].s = wsBoxes[headerCell].s || {};
                    wsBoxes[headerCell].s.font = { bold: true, color: { rgb: 'FFFFFF' } };
                    wsBoxes[headerCell].s.fill = { patternType: 'solid', fgColor: { rgb: '4472C4' } };
                    wsBoxes[headerCell].s.alignment = { horizontal: 'center', vertical: 'center' };
                }
                
                // Datum header rijen
                groupHeaderRows.forEach(rowIdx => {
                    const dateHeaderCell = XLSX.utils.encode_cell({ r: rowIdx, c: C });
                    if (wsBoxes[dateHeaderCell]) {
                        wsBoxes[dateHeaderCell].s = wsBoxes[dateHeaderCell].s || {};
                        wsBoxes[dateHeaderCell].s.font = { bold: true };
                        wsBoxes[dateHeaderCell].s.fill = { patternType: 'solid', fgColor: { rgb: 'E6E6E6' } };
                        wsBoxes[dateHeaderCell].s.alignment = { horizontal: 'center', vertical: 'center' };
                        wsBoxes[dateHeaderCell].s.border = {
                            top: { style: 'thin', color: { rgb: 'CCCCCC' } },
                            bottom: { style: 'thin', color: { rgb: 'CCCCCC' } }
                        };
                    }
                });
                
                // Totaal row (laatste rij)
                const totalRowIdx = boxesData.length - 1;
                const totalCell = XLSX.utils.encode_cell({ r: totalRowIdx, c: C });
                if (wsBoxes[totalCell]) {
                    wsBoxes[totalCell].s = wsBoxes[totalCell].s || {};
                    wsBoxes[totalCell].s.font = { bold: true, color: { rgb: 'FFFFFF' } };
                    wsBoxes[totalCell].s.fill = { patternType: 'solid', fgColor: { rgb: '4472C4' } };
                    wsBoxes[totalCell].s.border = {
                        top: { style: 'medium', color: { rgb: '000000' } },
                        bottom: { style: 'medium', color: { rgb: '000000' } }
                    };
                }
            }
            
            // Valuta opmaak voor prijskolommen
            for (let R = 1; R <= boxesRange.e.r; ++R) {
                // Verkoopprijs per stuk
                const priceCell = XLSX.utils.encode_cell({ r: R, c: 3 });
                if (wsBoxes[priceCell] && wsBoxes[priceCell].v) {
                    wsBoxes[priceCell].z = '€#,##0.00';
                }
                
                // Transportkosten per stuk
                const transportCell = XLSX.utils.encode_cell({ r: R, c: 4 });
                if (wsBoxes[transportCell] && wsBoxes[transportCell].v) {
                    wsBoxes[transportCell].z = '€#,##0.00';
                }
                
                // Totale verkoopprijs
                const totalPriceCell = XLSX.utils.encode_cell({ r: R, c: 5 });
                if (wsBoxes[totalPriceCell] && wsBoxes[totalPriceCell].v) {
                    wsBoxes[totalPriceCell].z = '€#,##0.00';
                    
                    // Extra opmaak voor subtotalen (vetgedrukt)
                    if (wsBoxes[XLSX.utils.encode_cell({ r: R, c: 1 })]?.v === 'Subtotaal') {
                        wsBoxes[totalPriceCell].s = wsBoxes[totalPriceCell].s || {};
                        wsBoxes[totalPriceCell].s.font = { bold: true };
                        wsBoxes[totalPriceCell].s.border = {
                            top: { style: 'thin', color: { rgb: 'CCCCCC' } }
                        };
                        // Ook voor transport subtotalen
                        const transportSubtotalCell = XLSX.utils.encode_cell({ r: R, c: 4 });
                        if (wsBoxes[transportSubtotalCell]) {
                            wsBoxes[transportSubtotalCell].s = wsBoxes[transportSubtotalCell].s || {};
                            wsBoxes[transportSubtotalCell].s.font = { bold: true };
                            wsBoxes[transportSubtotalCell].s.border = {
                                top: { style: 'thin', color: { rgb: 'CCCCCC' } }
                            };
                        }
                    }
                }
            }
            
            // Stel rijhoogtes in
            const rowHeights = {};
            // Header rij hoger maken
            rowHeights[0] = 30;
            // Datum headers iets hoger maken
            groupHeaderRows.forEach(rowIdx => {
                rowHeights[rowIdx] = 25;
            });
            wsBoxes['!rows'] = [];
            for (let i = 0; i <= boxesRange.e.r; i++) {
                wsBoxes['!rows'][i] = { hpt: rowHeights[i] || 20 };
            }
            
            // Stel kolombreedtes in
            wsBoxes['!cols'] = [
                { wch: 12 }, // Datum
                { wch: 25 }, // Kistnummer
                { wch: 10 }, // Aantal
                { wch: 18 }, // Verkoopprijs per stuk
                { wch: 18 }, // Transportkosten per stuk
                { wch: 18 }  // Totale verkoopprijs
            ];
            
            // Autofilter instellen
            wsBoxes['!autofilter'] = { ref: XLSX.utils.encode_range({ 
                s: { r: 0, c: 0 }, 
                e: { r: 0, c: 5 } 
            })};
            
            // Voeg kisten tabblad toe aan workbook
            XLSX.utils.book_append_sheet(wb, wsBoxes, 'Verpakte Kisten');
            
            const wbout = XLSX.write(wb, { bookType:'xlsx', type:'array', cellDates:true });
            saveAs(new Blob([wbout], { type:'application/octet-stream' }), `Airtec Analyse ${moment().format('YYYY-MM-DD')}.xlsx`);
        }
    });

    // Handler voor opslaan van prijzen
    document.getElementById('save-prices').addEventListener('click', () => {
        const chestTypes = [...new Set(packedData.map(item => item.kistnummer))];
        const promises = chestTypes.map(type => {
            const price = document.getElementById(`price-${type}`)?.value || 0;
            const assembly = document.getElementById(`assembly-${type}`)?.value || 0;
            const material = document.getElementById(`material-${type}`)?.value || 0;
            const transport = document.getElementById(`transport-${type}`)?.value || 0;
            return fetch(`/api/airtec/prices/${type}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    price, 
                    assembly_cost: assembly, 
                    material_cost: material,
                    transport_cost: transport
                })
            });
        });
        Promise.all(promises).then(() => {
            alert('Prijzen opgeslagen!');
        });
    });
});

// Helper functies voor datumnotatie en urenweergave
function toDutchDate(dateStr) {
    return moment(dateStr).format('DD-MM-YYYY');
}
function decimalHoursToHM(decimalHours) {
    const totalMinutes = Math.round(decimalHours * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}:${minutes.toString().padStart(2,'0')}`;
} 