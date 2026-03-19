document.addEventListener('DOMContentLoaded', () => {
    // Laad header
    fetch('header.html')
        .then(res => res.text())
        .then(html => document.getElementById('header-placeholder').innerHTML = html);

    // Default datum vandaag
    const dateInput = document.getElementById('delivery-date');
    dateInput.value = new Date().toISOString().split('T')[0];

    let prijzen = [];
    // Haal kistprijzen (incl. prijs per stuk) op
    fetch('/api/airtec/prices')
        .then(res => res.json())
        .then(data => {
            if (data.success && Array.isArray(data.prices)) {
                prijzen = data.prices;
                // Maak priceMap en vul datalist voor autocomplete
                const datalist = document.getElementById('kist-datalist');
                window.priceMap = {};
                prijzen.forEach(p => {
                    window.priceMap[p.kistnummer] = parseFloat(p.price);
                    const opt = document.createElement('option');
                    opt.value = p.kistnummer;
                    datalist.appendChild(opt);
                });
            } else {
                console.warn('Kon kistprijzen niet ophalen', data);
            }
            addRow();
        })
        .catch(err => {
            console.error('Fout bij ophalen kistprijzen:', err);
            addRow();
        });

    // Functie om een nieuwe rij toe te voegen
    function addRow() {
        const tbody = document.querySelector('#delivery-table tbody');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input list="kist-datalist" class="form-control kistnummer-input" placeholder="Selecteer kisttype"></td>
            <td><span class="prijs-cell">0.00</span></td>
            <td><input type="number" class="form-control aantal-input" min="1" value="1"></td>
            <td><span class="waarde-cell">0.00</span></td>
            <td><span class="tps-cell">0.00</span></td>
            <td><button type="button" class="btn btn-danger btn-sm remove-row">Verwijder</button></td>
        `;
        tbody.appendChild(tr);
        tr.querySelector('.remove-row').addEventListener('click', () => tr.remove());
        // Indien Tab in 'aantal' wordt gedrukt op de laatste rij: nieuwe rij en focus
        const aantalInput = tr.querySelector('.aantal-input');
        aantalInput.addEventListener('keydown', (e) => {
            if (e.key === 'Tab' && !e.shiftKey) {
                const rows = Array.from(document.querySelectorAll('#delivery-table tbody tr'));
                if (rows[rows.length - 1] === tr) {
                    e.preventDefault();
                    addRow();
                    const newRow = document.querySelector('#delivery-table tbody tr:last-child');
                    newRow.querySelector('.kistnummer-input').focus();
                }
            }
        });
        // Realtime update bij wijziging in kist of aantal
        tr.querySelector('.kistnummer-input').addEventListener('input', updateTable);
        tr.querySelector('.aantal-input').addEventListener('input', updateTable);
    }

    document.getElementById('add-row').addEventListener('click', addRow);

    document.getElementById('save-delivery').addEventListener('click', () => {
        const datum = document.getElementById('delivery-date').value;
        const totaalTransport = parseFloat(document.getElementById('total-transport-cost').value);
        if (!datum) return alert('Selecteer een datum van levering');
        if (isNaN(totaalTransport) || totaalTransport < 0) return alert('Voer een geldige transportkost in');

        const rows = Array.from(document.querySelectorAll('#delivery-table tbody tr'));
        // Lees distributiemethode
        const method = document.querySelector('input[name="dist-method"]:checked').value;
        // Bouw array met kistnummer, aantal en prijs via priceMap
        let lijnen = rows.map(tr => {
            const inp = tr.querySelector('.kistnummer-input');
            const kist = inp.value;
            const aantal = parseInt(tr.querySelector('.aantal-input').value);
            const prijs = window.priceMap[kist] || 0;
            return { kistnummer: kist, aantal, prijs };
        }).filter(l => l.kistnummer && l.aantal > 0);
        if (lijnen.length === 0) return alert('Voer minstens één kisttype en aantal in');

        // Bereken totalen voor transportverdeling
        const totaalEenheden = lijnen.reduce((s, l) => s + l.aantal, 0);
        const omzetwaarde    = lijnen.reduce((s, l) => s + l.prijs * l.aantal, 0);
        // Bepaal voor elke lijn de transportkost per stuk
        lijnen = lijnen.map(l => {
            let tps;
            if (method === 'equal' || omzetwaarde === 0) {
                tps = totaalTransport / totaalEenheden;
            } else {
                // gewogen naar omzetbijdrage
                const aandeel = (l.prijs * l.aantal) / omzetwaarde;
                tps = (totaalTransport * aandeel) / l.aantal;
            }
            return { ...l, transportkost_per_stuk: parseFloat(tps.toFixed(2)) };
        });

        // Verstuur complete levering naar backend
        fetch('/api/airtec/leveringen', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ datum, totaal_transportkost: totaalTransport, lijnen })
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    alert(`Levering opgeslagen!`);
                    // Reset formulier
                    document.querySelector('#delivery-table tbody').innerHTML = '';
                    addRow();
                    document.getElementById('total-transport-cost').value = '';
                } else {
                    alert('Fout bij opslaan: ' + (data.message || JSON.stringify(data)));
                }
            })
            .catch(err => alert('Request mislukt: ' + err));
    });

    // Recalculate en update prijs, waarde en transportkost per stuk
    function updateTable() {
        const rows = Array.from(document.querySelectorAll('#delivery-table tbody tr'));
        const method = document.querySelector('input[name="dist-method"]:checked').value;
        const tTransport = parseFloat(document.getElementById('total-transport-cost').value) || 0;
        // Verzamel data per rij
        const data = rows.map(tr => {
            const kist = tr.querySelector('.kistnummer-input').value;
            const aantal = parseInt(tr.querySelector('.aantal-input').value) || 0;
            const prijs = window.priceMap[kist] || 0;
            return { tr, aantal, prijs };
        }).filter(d => d.prijs && d.aantal > 0);
        const totaalEenheden = data.reduce((s, d) => s + d.aantal, 0);
        const omzetwaarde = data.reduce((s, d) => s + d.prijs * d.aantal, 0);
        data.forEach(d => {
            const { tr, prijs, aantal } = d;
            tr.querySelector('.prijs-cell').textContent = prijs.toFixed(2);
            tr.querySelector('.waarde-cell').textContent = (prijs * aantal).toFixed(2);
            let tps = 0;
            if (tTransport > 0 && totaalEenheden > 0) {
                if (method === 'equal' || omzetwaarde === 0) {
                    tps = tTransport / totaalEenheden;
                } else {
                    const aandeel = (prijs * aantal) / omzetwaarde;
                    tps = (tTransport * aandeel) / aantal;
                }
            }
            tr.querySelector('.tps-cell').textContent = tps.toFixed(2);
        });
    }

    // Globale listeners voor herberekening
    document.getElementById('total-transport-cost').addEventListener('input', updateTable);
    document.querySelectorAll('input[name="dist-method"]').forEach(r => r.addEventListener('change', updateTable));

    // --- Historiek laden wanneer tab 'Historiek' wordt getoond ---
    function loadHistoriek() {
        fetch('/api/airtec/leveringen/all')
            .then(res => res.json())
            .then(resp => {
                if (!resp.success) return;
                const tbody = document.querySelector('#history-table tbody');
                tbody.innerHTML = '';
                resp.data.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.dataset.leveringId = item.id;
                    const displayDate = new Date(item.datum).toLocaleDateString('nl-NL');
                    // Bereken transport % van waarde
                    const waarde = parseFloat(item.totaalwaarde) || 0;
                    const transport = parseFloat(item.totaaltransport) || 0;
                    const pct = waarde > 0 ? (transport / waarde * 100).toFixed(2) + '%' : '0%';
                    tr.innerHTML = `
                        <td>${item.id}</td>
                        <td>${displayDate}</td>
                        <td>€ ${waarde.toFixed(2)}</td>
                        <td>€ ${transport.toFixed(2)}</td>
                        <td>${pct}</td>
                        <td><button class="btn btn-sm btn-outline-primary view-details">Bekijk</button></td>
                    `;
                    tbody.appendChild(tr);
                });
            });
    }

    // --- Evolutie laden wanneer tab 'Evolutie' wordt getoond ---
    let evolutieChart;
    function loadEvolutie() {
        fetch('/api/airtec/leveringen/all')
            .then(res => res.json())
            .then(resp => {
                if (!resp.success) return;
                const data = resp.data;
                // Basisdata arrays
                const labels = data.map(d => new Date(d.datum).toLocaleDateString('nl-NL'));
                const kistenData = data.map(d => d.totaal_kisten);
                const waardeData = data.map(d => parseFloat(d.totaalwaarde));
                const transportData = data.map(d => parseFloat(d.totaaltransport));
                // Extra KPI's
                const avgTransportData = data.map((d,i) => d.totaal_kisten>0 ? parseFloat((transportData[i]/d.totaal_kisten).toFixed(2)) : 0);
                const avgValueData = data.map((d,i) => d.totaal_kisten>0 ? parseFloat((waardeData[i]/d.totaal_kisten).toFixed(2)) : 0);
                // Transport % van waarde = (transport / waarde) * 100
                const efficiencyData = waardeData.map((v,i) => v>0 ? parseFloat((transportData[i] / v * 100).toFixed(2)) : 0);
                // Chart initialiseren of bijwerken
                const ctx = document.getElementById('evolutieChart').getContext('2d');
                if (evolutieChart) evolutieChart.destroy();
                evolutieChart = new Chart(ctx, {
                    data: {
                        labels,
                        datasets: [
                            { type:'bar', label:'Aantal kisten', data:kistenData, yAxisID:'y', backgroundColor:'rgba(13,110,253,0.5)', borderColor:'#0d6efd', borderWidth:1, toggleKey:'kisten', hidden:!document.querySelector(`.evo-toggle[value="kisten"]`).checked },
                            { type:'line', label:'Totaalwaarde (€)', data:waardeData, yAxisID:'y1', borderColor:'#198754', fill:false, pointRadius:6, toggleKey:'value', hidden:!document.querySelector(`.evo-toggle[value="value"]`).checked },
                            { type:'line', label:'Transport (€)', data:transportData, yAxisID:'y2', borderColor:'#fd7e14', fill:false, pointRadius:6, toggleKey:'transport', hidden:!document.querySelector(`.evo-toggle[value="transport"]`).checked },
                            { type:'line', label:'Gem. transport/stuk (€)', data:avgTransportData, yAxisID:'y2', borderColor:'#0dcaf0', fill:false, pointRadius:6, toggleKey:'transport', hidden:!document.querySelector(`.evo-toggle[value="transport"]`).checked },
                            { type:'line', label:'Gem. waarde/stuk (€)', data:avgValueData, yAxisID:'y1', borderColor:'#6f42c1', fill:false, pointRadius:6, toggleKey:'value', hidden:!document.querySelector(`.evo-toggle[value="value"]`).checked },
                            { type:'line', label:'Transport % van waarde', data:efficiencyData, yAxisID:'y3', borderColor:'#198754', backgroundColor:'#198754', fill:false, pointRadius:8, toggleKey:'efficiency', hidden:!document.querySelector(`.evo-toggle[value="efficiency"]`).checked }
                        ]
                    },
                    options: {
                        responsive: true,
                        plugins:{ title:{ display:true, text:'Evolutie Leveringen' }, legend:{ position:'top' } },
                        scales:{
                            y: { position:'left', title:{ display:true, text:'Aantal kisten' }, beginAtZero:true },
                            y1: { position:'right', title:{ display:true, text:'Waarde (€)' }, grid:{ drawOnChartArea:false }, beginAtZero:true },
                            y2: { position:'right', offset:true, title:{ display:true, text:'Transport (€)' }, grid:{ drawOnChartArea:false }, beginAtZero:true },
                            y3: { position:'right', offset:true, title:{ display:true, text:'Efficiëntie' }, grid:{ drawOnChartArea:false }, beginAtZero:true }
                        }
                    }
                });
                // Toggle handlers
                document.querySelectorAll('.evo-toggle').forEach(cb => {
                    cb.addEventListener('change', () => {
                        const ds = evolutieChart.data.datasets;
                        ds.forEach(set => {
                            if (set.toggleKey === cb.value) set.hidden = !cb.checked;
                        });
                        evolutieChart.update();
                    });
                });
                // Evolutietabel vullen
                const tbodyE = document.querySelector('#evolutie-table tbody');
                tbodyE.innerHTML = '';
                data.forEach((d,i) => {
                    const tr = document.createElement('tr');
                    const dateStr = new Date(d.datum).toLocaleDateString('nl-NL');
                    tr.dataset.leveringId = d.id;
                    tr.innerHTML = `
                        <td>${d.id}</td>
                        <td>${dateStr}</td>
                        <td>${d.totaal_kisten}</td>
                        <td>€ ${waardeData[i].toFixed(2)}</td>
                        <td>€ ${transportData[i].toFixed(2)}</td>
                        <td>€ ${avgTransportData[i].toFixed(2)}</td>
                        <td>€ ${avgValueData[i].toFixed(2)}</td>
                        <td>${efficiencyData[i]}%</td>
                        <td><button class="btn btn-sm btn-outline-primary view-details">Bekijk</button></td>
                    `;
                    tbodyE.appendChild(tr);
                });
            });
    }

    // Event listeners voor tab-switch
    document.getElementById('tab-historiek-tab').addEventListener('shown.bs.tab', loadHistoriek);
    document.getElementById('tab-evolutie-tab').addEventListener('shown.bs.tab', loadEvolutie);

    // Klik op Bekijk-knop opent detail modal
    document.body.addEventListener('click', e => {
        if (e.target.matches('.view-details')) {
            const tr = e.target.closest('tr');
            const id = tr.dataset.leveringId;
            fetch(`/api/airtec/leveringen/${id}`)
                .then(r => r.json())
                .then(resp => {
                    if (!resp.success) return alert('Kan details niet laden');
                    const dlgTitle = document.getElementById('detailModalLabel');
                    dlgTitle.textContent = `Levering #${id} - ${resp.levering.datum}`;
                    const tbody = document.getElementById('detailModalBody');
                    tbody.innerHTML = '';
                    resp.levering.details.forEach(d => {
                        const row = document.createElement('tr');
                        const waarde = (d.prijs_per_stuk * d.aantal).toFixed(2);
                        row.innerHTML = `
                            <td>${d.kistnummer}</td>
                            <td>${d.aantal}</td>
                            <td>€ ${parseFloat(d.prijs_per_stuk).toFixed(2)}</td>
                            <td>€ ${parseFloat(d.transportkost_per_stuk).toFixed(2)}</td>
                            <td>€ ${waarde}</td>
                        `;
                        tbody.appendChild(row);
                    });
                    const modal = new bootstrap.Modal(document.getElementById('detailModal'));
                    modal.show();
                });
        }
    });
}); 