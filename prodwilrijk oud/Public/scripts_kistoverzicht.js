document.addEventListener('DOMContentLoaded', (event) => {
    let kistData = [];
    let lastUpdated = null;
    let completedKisten = {};
    let isSyncing = false;

    // Laad eerder opgeslagen tellingen uit localStorage (fallback als API niet beschikbaar is)
    function loadCompletedKisten() {
        // Probeer eerst van de server te laden
        fetchCompletedKistenFromServer()
            .catch(error => {
                console.error('Fout bij laden van server data:', error);
                // Als de server niet bereikbaar is, gebruik localStorage als fallback
                const saved = localStorage.getItem('airtec_completed_kisten');
                if (saved) {
                    try {
                        completedKisten = JSON.parse(saved);
                        updateTotalCompleted();
                    } catch (e) {
                        console.error('Fout bij laden van opgeslagen kisten:', e);
                        completedKisten = {};
                    }
                }
            });
    }

    // Haal gemaakte kisten op van de server
    function fetchCompletedKistenFromServer() {
        return fetch('/api/get_completed_kisten')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data && data.success) {
                    completedKisten = data.completedKisten || {};
                    // Sla ook op in localStorage als fallback
                    localStorage.setItem('airtec_completed_kisten', JSON.stringify(completedKisten));
                    updateTotalCompleted();
                    return completedKisten;
                } else {
                    throw new Error('Invalid response format');
                }
            });
    }

    // Sla tellingen op (zowel in localStorage als op de server)
    function saveCompletedKisten() {
        // Altijd in localStorage opslaan als fallback
        localStorage.setItem('airtec_completed_kisten', JSON.stringify(completedKisten));
        updateTotalCompleted();
        
        // Voorkom meerdere gelijktijdige API-calls
        if (isSyncing) return;
        
        isSyncing = true;
        
        // Stuur naar de server
        fetch('/api/update_completed_kisten', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ completedKisten })
        })
        .then(response => response.json())
        .then(result => {
            isSyncing = false;
            if (!result.success) {
                console.error('Fout bij opslaan op server:', result.error);
                showNotification('Teller bijgewerkt (alleen lokaal opgeslagen)', 'warning');
            }
        })
        .catch(error => {
            isSyncing = false;
            console.error('Fout bij verbinden met server:', error);
            showNotification('Teller bijgewerkt (alleen lokaal opgeslagen)', 'warning');
        });
    }

    // Update het aantal gemaakte kisten voor een specifieke kist
    function updateSingleKistOnServer(kistId, value) {
        return fetch('/api/update_single_kist', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                kistnummer: kistId, 
                completed: value 
            })
        })
        .then(response => response.json())
        .then(result => {
            if (!result.success) {
                throw new Error(result.error || 'Onbekende fout');
            }
            return result;
        });
    }

    // Werk de totale teller van gemaakte kisten bij
    function updateTotalCompleted() {
        let total = 0;
        Object.values(completedKisten).forEach(value => {
            total += parseInt(value) || 0;
        });
        document.getElementById('total-completed').textContent = total;
    }

    // Luister naar database-wijzigingen (kan worden vervangen door WebSockets indien beschikbaar)
    function startDataSync() {
        // Automatische verversing elke 30 seconden
        setInterval(() => {
            if (!isSyncing && document.visibilityState === 'visible') {
                fetchCompletedKistenFromServer()
                    .then(() => {
                        // Alleen UI bijwerken als de pagina actief is
                        filterKisten();
                    })
                    .catch(error => {
                        console.error('Auto-sync fout:', error);
                    });
            }
        }, 30000);

        // Ook bijwerken als tabblad weer actief wordt
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && !isSyncing) {
                fetchCompletedKistenFromServer()
                    .then(() => filterKisten())
                    .catch(error => console.error('Visibility sync fout:', error));
            }
        });
    }

    // Load the header
    fetch('header.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById('header-placeholder').innerHTML = data;
        });

    // Fetch items data and organize by kist
    function fetchKistData() {
        // Fallback data for testing/development
        const handleApiFailure = () => {
            console.warn('API-fout: Gebruik van fallback gegevens');
            // Voorbeeldgegevens voor testen
            const sampleData = [
                {id: 1, beschrijving: 'Test Item 1', item_number: 'IT001', lot_number: 'LT001', 
                 datum_opgestuurd: '2025-02-20', kistnummer: 'K1', divisie: 'Div A', quantity: 5, priority: true},
                {id: 2, beschrijving: 'Test Item 2', item_number: 'IT002', lot_number: 'LT002', 
                 datum_opgestuurd: '2025-02-21', kistnummer: 'K1', divisie: 'Div B', quantity: 3, priority: false},
                {id: 3, beschrijving: 'Test Item 3', item_number: 'IT003', lot_number: 'LT003', 
                 datum_opgestuurd: '2025-02-22', kistnummer: 'K2', divisie: 'Div A', quantity: 2, priority: false},
                {id: 4, beschrijving: 'Test Item 4', item_number: 'IT004', lot_number: 'LT004', 
                 datum_opgestuurd: '2025-02-23', kistnummer: 'K3', divisie: 'Div C', quantity: 1, priority: true},
                {id: 5, beschrijving: 'Test Item 5', item_number: 'IT005', lot_number: 'LT005', 
                 datum_opgestuurd: '2025-02-24', kistnummer: 'K2', divisie: 'Div B', quantity: 4, priority: false}
            ];
            processItemsData(sampleData);
        };

        // API aanroepen om gegevens op te halen
        fetch('/api/items_to_pack_airtec')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                processItemsData(data);
            })
            .catch(error => {
                console.error('Fout bij ophalen van gegevens:', error);
                handleApiFailure();
            });
    }

    // Verwerk de itemsgegevens tot kistgegevens
    function processItemsData(items) {
        // Groepeer items per kistnummer
        const kistenMap = {};
        let totalItems = 0;
        let totalQuantity = 0;

        // Sorteer en groepeer items per kistnummer
        items.forEach(item => {
            // Skip items zonder kistnummer
            if (!item.kistnummer) return;
            
            // Initialiseer kistenMap voor dit kistnummer als het nog niet bestaat
            if (!kistenMap[item.kistnummer]) {
                kistenMap[item.kistnummer] = {
                    kistnummer: item.kistnummer,
                    items: [],
                    totalCount: 0,
                    totalQuantity: 0,
                    hasPriority: false
                };
            }
            
            // Voeg item toe aan de juiste kist
            kistenMap[item.kistnummer].items.push(item);
            kistenMap[item.kistnummer].totalCount++;
            kistenMap[item.kistnummer].totalQuantity += parseInt(item.quantity || 0);
            
            // Update prioriteit
            if (item.priority) {
                kistenMap[item.kistnummer].hasPriority = true;
            }
            
            // Update totalen
            totalItems++;
            totalQuantity += parseInt(item.quantity || 0);
        });

        // Converteer map naar array voor weergave
        kistData = Object.values(kistenMap);
        
        // Sorteer op kistnummer
        kistData.sort((a, b) => a.kistnummer.localeCompare(b.kistnummer));
        
        // Update statistieken
        document.getElementById('total-kisten').textContent = kistData.length;
        document.getElementById('total-items').textContent = totalItems;
        document.getElementById('total-quantity').textContent = totalQuantity;
        
        // Bijwerk laatst bijgewerkte tijd
        lastUpdated = new Date();
        document.getElementById('last-updated').textContent = `Laatst bijgewerkt: ${lastUpdated.toLocaleString()}`;
        
        // Update UI
        filterKisten();
        updateTotalCompleted();
    }

    // Toon kisten volgens filter
    function filterKisten() {
        const searchQuery = document.getElementById('search-box').value.toLowerCase();
        
        // Filter kisten op basis van zoekopdracht
        const filteredKisten = kistData.filter(kist => 
            kist.kistnummer.toLowerCase().includes(searchQuery)
        );
        
        displayKistData(filteredKisten);
    }

    // Toon de kistgegevens in UI
    function displayKistData(kisten) {
        const container = document.getElementById('kist-container');
        container.innerHTML = '';
        
        if (kisten.length === 0) {
            container.innerHTML = '<div class="alert alert-info">Geen kisten gevonden die overeenkomen met uw zoekopdracht.</div>';
            return;
        }
        
        kisten.forEach(kist => {
            const kistCard = document.createElement('div');
            kistCard.className = `kist-card ${kist.hasPriority ? 'border-warning' : ''}`;
            kistCard.style.borderLeftColor = kist.hasPriority ? '#ffc107' : '#0d6efd';
            
            // Bepaal aantal gemaakte kisten
            const completed = completedKisten[kist.kistnummer] || 0;
            const isComplete = completed > 0;
            
            kistCard.innerHTML = `
                <div class="kist-header">
                    <div class="kist-title">
                        ${kist.hasPriority ? '<i class="fas fa-star text-warning me-2"></i>' : ''}
                        Kist: ${kist.kistnummer}
                    </div>
                    <div class="kist-count">${kist.totalCount} item${kist.totalCount !== 1 ? 's' : ''}</div>
                </div>
                <div class="kist-details">
                    <div><strong>Totale hoeveelheid:</strong> ${kist.totalQuantity}</div>
                </div>
                <div class="d-flex justify-content-between align-items-center">
                    <a href="items_to_pack_airtec.html?kist=${encodeURIComponent(kist.kistnummer)}" class="btn btn-sm btn-outline-primary">
                        <i class="fas fa-search me-1"></i> Bekijk Items
                    </a>
                    <div class="complete-indicator ${isComplete ? 'complete-true' : ''}">
                        ${isComplete ? '<i class="fas fa-check me-1"></i> Gemaakt' : 'Niet gemaakt'}
                    </div>
                </div>
                <div class="kist-counter">
                    <div class="counter-label">Aantal gemaakt:</div>
                    <div class="counter-controls">
                        <button class="counter-btn btn-decrease" data-kist="${kist.kistnummer}">
                            <i class="fas fa-minus"></i>
                        </button>
                        <input type="number" class="counter-input" value="${completed}" 
                            min="0" data-kist="${kist.kistnummer}">
                        <button class="counter-btn btn-increase" data-kist="${kist.kistnummer}">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </div>
            `;
            
            container.appendChild(kistCard);
        });
        
        // Event listeners toevoegen voor de tellers
        addCounterEventListeners();
    }
    
    // Voeg event listeners toe aan de tellers
    function addCounterEventListeners() {
        // Afname-knoppen
        document.querySelectorAll('.btn-decrease').forEach(button => {
            button.addEventListener('click', function() {
                const kistId = this.getAttribute('data-kist');
                const input = document.querySelector(`.counter-input[data-kist="${kistId}"]`);
                let value = parseInt(input.value) || 0;
                if (value > 0) {
                    value--;
                    input.value = value;
                    updateKistCompleted(kistId, value);
                }
            });
        });
        
        // Toename-knoppen
        document.querySelectorAll('.btn-increase').forEach(button => {
            button.addEventListener('click', function() {
                const kistId = this.getAttribute('data-kist');
                const input = document.querySelector(`.counter-input[data-kist="${kistId}"]`);
                let value = parseInt(input.value) || 0;
                value++;
                input.value = value;
                updateKistCompleted(kistId, value);
            });
        });
        
        // Invulvelden
        document.querySelectorAll('.counter-input').forEach(input => {
            input.addEventListener('change', function() {
                const kistId = this.getAttribute('data-kist');
                let value = parseInt(this.value) || 0;
                if (value < 0) {
                    value = 0;
                    this.value = value;
                }
                updateKistCompleted(kistId, value);
            });
        });
    }
    
    // Update het aantal gemaakte kisten
    function updateKistCompleted(kistId, value) {
        // Directe UI feedback
        completedKisten[kistId] = value;
        updateTotalCompleted();
        
        // Update indicator direct
        const indicator = document.querySelector(`.kist-card:has(.counter-input[data-kist="${kistId}"]) .complete-indicator`);
        if (indicator) {
            if (value > 0) {
                indicator.classList.add('complete-true');
                indicator.innerHTML = '<i class="fas fa-check me-1"></i> Gemaakt';
            } else {
                indicator.classList.remove('complete-true');
                indicator.innerHTML = 'Niet gemaakt';
            }
        }
        
        // Toon synchronisatie-indicator
        const input = document.querySelector(`.counter-input[data-kist="${kistId}"]`);
        if (input) input.classList.add('saving');
        
        // Sla lokaal op voor snelle toegang en fallback
        localStorage.setItem('airtec_completed_kisten', JSON.stringify(completedKisten));
        
        // Update naar de server
        updateSingleKistOnServer(kistId, value)
            .then(() => {
                if (input) {
                    input.classList.remove('saving');
                    input.classList.add('success');
                    setTimeout(() => input.classList.remove('success'), 1000);
                }
            })
            .catch(error => {
                console.error('Fout bij updaten van kist:', error);
                if (input) {
                    input.classList.remove('saving');
                    input.classList.add('error');
                    setTimeout(() => input.classList.remove('error'), 2000);
                }
                showNotification('Teller bijgewerkt (alleen lokaal opgeslagen)', 'warning');
                
                // Alternatief: gebruik bulk update methode
                saveCompletedKisten();
            });
    }

    // Notificatiefunctie
    function showNotification(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : 
                            type === 'danger' ? 'fa-exclamation-circle' : 
                            type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
                <span>${message}</span>
            </div>
            <button class="toast-close">&times;</button>
        `;
        
        // Aan document toevoegen
        document.body.appendChild(toast);
        
        // Positie onderaan scherm
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.backgroundColor = type === 'success' ? '#4CAF50' : 
                                    type === 'danger' ? '#F44336' : 
                                    type === 'warning' ? '#FF9800' : '#2196F3';
        toast.style.color = 'white';
        toast.style.padding = '12px 20px';
        toast.style.borderRadius = '4px';
        toast.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
        toast.style.zIndex = '9999';
        toast.style.display = 'flex';
        toast.style.alignItems = 'center';
        toast.style.minWidth = '250px';
        toast.style.maxWidth = '80%';
        
        // Sluitknop styling
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.style.marginLeft = '15px';
        closeBtn.style.background = 'none';
        closeBtn.style.border = 'none';
        closeBtn.style.color = 'white';
        closeBtn.style.fontSize = '20px';
        closeBtn.style.cursor = 'pointer';
        
        // Sluitfunctie
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(toast);
        });
        
        // Automatisch verwijderen na 4 seconden
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 4000);
    }

    // Reset alle tellers
    function resetAllCounters() {
        if (confirm('Weet u zeker dat u alle tellers wilt resetten? Dit kan niet ongedaan worden gemaakt.')) {
            // Toon laad-indicator
            document.getElementById('reset-counters-button').disabled = true;
            document.getElementById('reset-counters-button').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetten...';
            
            // Reset op de server
            fetch('/api/reset_completed_kisten', {
                method: 'POST'
            })
            .then(response => response.json())
            .then(result => {
                document.getElementById('reset-counters-button').disabled = false;
                document.getElementById('reset-counters-button').innerHTML = '<i class="fas fa-undo-alt"></i> Reset Tellers';
                
                if (result.success) {
                    // Reset lokaal
                    completedKisten = {};
                    localStorage.setItem('airtec_completed_kisten', JSON.stringify(completedKisten));
                    updateTotalCompleted();
                    filterKisten(); // Herlaad de kaarten met gereset tellers
                    showNotification('Alle tellers succesvol gereset', 'success');
                } else {
                    showNotification('Fout bij resetten van tellers: ' + (result.error || 'Onbekende fout'), 'danger');
                }
            })
            .catch(error => {
                document.getElementById('reset-counters-button').disabled = false;
                document.getElementById('reset-counters-button').innerHTML = '<i class="fas fa-undo-alt"></i> Reset Tellers';
                console.error('Error resetting counters:', error);
                showNotification('Fout bij verbinden met server. Reset mislukt.', 'danger');
            });
        }
    }

    // Afdrukfunctie
    function printKistoverzicht() {
        const dateStr = new Date().toLocaleDateString();
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Kistoverzicht - ${dateStr}</title>
                <style>
                    body { font-family: Arial, sans-serif; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
                    th { background-color: #f2f2f2; }
                    .priority { background-color: #fff3cd; }
                    h2 { margin-bottom: 5px; }
                    .subtitle { color: #666; margin-bottom: 20px; }
                    .kist-section { margin-bottom: 30px; }
                    .kist-header { font-size: 16px; font-weight: bold; margin-bottom: 5px; padding: 5px; background-color: #f8f9fa; }
                    @media print {
                        .no-print { display: none; }
                        body { padding: 20px; }
                    }
                </style>
            </head>
            <body>
                <h2>Kistoverzicht - Airtec</h2>
                <div class="subtitle">Gegenereerd op ${dateStr}</div>
                
                <table>
                    <thead>
                        <tr>
                            <th>Kistnummer</th>
                            <th>Aantal Items</th>
                            <th>Totale Hoeveelheid</th>
                            <th>Prioriteit</th>
                            <th>Aantal gemaakt</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${kistData.map(kist => {
                            const completed = completedKisten[kist.kistnummer] || 0;
                            const status = completed > 0 ? 'Gemaakt' : 'Niet gemaakt';
                            return `
                                <tr${kist.hasPriority ? ' class="priority"' : ''}>
                                    <td>${kist.kistnummer}</td>
                                    <td>${kist.totalCount}</td>
                                    <td>${kist.totalQuantity}</td>
                                    <td>${kist.hasPriority ? 'Ja' : 'Nee'}</td>
                                    <td>${completed}</td>
                                    <td>${status}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
                
                <div class="no-print" style="margin-top: 20px;">
                    <button onclick="window.print()">Print Deze Pagina</button>
                    <button onclick="window.close()">Sluiten</button>
                </div>
            </body>
            </html>
        `;
        const printWindow = window.open('', '', 'height=600,width=800');
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
    }

    // Pull-to-refresh functionaliteit voor mobiel
    let touchStartY = 0;
    document.addEventListener('touchstart', function(e) {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });
    
    document.addEventListener('touchend', function(e) {
        const touchEndY = e.changedTouches[0].clientY;
        const diff = touchEndY - touchStartY;
        
        // Als voldoende naar beneden getrokken bovenaan pagina
        if (diff > 100 && window.scrollY < 10) {
            // Toon verversingsanimatie
            const banner = document.querySelector('.stats-banner');
            banner.innerHTML = '<div style="text-align:center;"><i class="fas fa-sync fa-spin"></i> Vernieuwen...</div>';
            
            // Ververs gegevens
            setTimeout(() => {
                // Ververs beide datasets
                Promise.all([
                    fetchKistData(),
                    fetchCompletedKistenFromServer().catch(err => console.error('Error refreshing counters:', err))
                ])
                .finally(() => {
                    // Herstel banner na 500ms
                    setTimeout(() => {
                        const banner = document.querySelector('.stats-banner');
                        if (banner.querySelector('.fa-sync')) {
                            // Alleen herstellen als nog steeds in de verversingsmodus
                            banner.innerHTML = '';
                            const row = document.createElement('div');
                            row.className = 'row';
                            banner.appendChild(row);
                            
                            // Herbouw de statistieken-banner
                            const stats = [
                                { id: 'total-kisten', label: 'Unieke kist types' },
                                { id: 'total-items', label: 'Totaal aantal items' },
                                { id: 'total-quantity', label: 'Totale hoeveelheid' },
                                { id: 'total-completed', label: 'Kisten gemaakt' }
                            ];
                            
                            stats.forEach(stat => {
                                const col = document.createElement('div');
                                col.className = 'col-md-3';
                                col.innerHTML = `
                                    <div class="stat-card">
                                        <div class="stat-number" id="${stat.id}">0</div>
                                        <div class="stat-label">${stat.label}</div>
                                    </div>
                                `;
                                row.appendChild(col);
                            });
                            
                            // Update statistieken
                            document.getElementById('total-kisten').textContent = kistData.length;
                            document.getElementById('total-items').textContent = document.getElementById('total-items').textContent;
                            document.getElementById('total-quantity').textContent = document.getElementById('total-quantity').textContent;
                            updateTotalCompleted();
                            
                            // Recreate buttons section
                            const buttonSection = document.createElement('div');
                            buttonSection.className = 'd-flex justify-content-between align-items-center mt-3';
                            buttonSection.innerHTML = `
                                <div id="last-updated">Laatst bijgewerkt: ${new Date().toLocaleString()}</div>
                                <div>
                                    <button id="reset-counters-button" class="btn btn-sm btn-warning me-2">
                                        <i class="fas fa-undo-alt"></i> Reset Tellers
                                    </button>
                                    <button id="refresh-button" class="btn btn-sm btn-primary">
                                        <i class="fas fa-sync-alt"></i> Vernieuwen
                                    </button>
                                    <button id="print-button" class="btn btn-sm btn-secondary ms-2">
                                        <i class="fas fa-print"></i> Afdrukken
                                    </button>
                                </div>
                            `;
                            banner.appendChild(buttonSection);
                            
                            // Voeg event listeners opnieuw toe
                            document.getElementById('refresh-button').addEventListener('click', fetchKistData);
                            document.getElementById('print-button').addEventListener('click', printKistoverzicht);
                            document.getElementById('reset-counters-button').addEventListener('click', resetAllCounters);
                        }
                    }, 500);
                });
            }, 500);
        }
    }, { passive: true });

    // Voeg CSS-stijlen toe voor synchronisatie-statussen
    function addSyncStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .counter-input.saving {
                background-color: #fff3cd;
                border-color: #ffc107;
            }
            .counter-input.success {
                background-color: #d4edda;
                border-color: #28a745;
            }
            .counter-input.error {
                background-color: #f8d7da;
                border-color: #dc3545;
            }
            @keyframes sync-spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            .sync-indicator {
                display: inline-block;
                animation: sync-spin 1s linear infinite;
                margin-left: 8px;
                font-size: 14px;
                color: #6c757d;
            }
        `;
        document.head.appendChild(style);
    }

    // Event listeners
    document.getElementById('search-box').addEventListener('input', filterKisten);
    document.getElementById('refresh-button').addEventListener('click', () => {
        // Ververs beide datasets
        Promise.all([
            fetchKistData(),
            fetchCompletedKistenFromServer().catch(err => console.error('Error refreshing counters:', err))
        ]);
    });
    document.getElementById('print-button').addEventListener('click', printKistoverzicht);
    document.getElementById('reset-counters-button').addEventListener('click', resetAllCounters);

    // Toetsenbordsnelkoppelingen
    document.addEventListener('keydown', function(e) {
        // CTRL+F om zoekfunctie te focussen
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            document.getElementById('search-box').focus();
        }
        
        // CTRL+P om af te drukken
        if (e.ctrlKey && e.key === 'p') {
            e.preventDefault();
            printKistoverzicht();
        }
        
        // F5 of CTRL+R voor verversen
        if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
            e.preventDefault();
            document.getElementById('refresh-button').click();
        }
    });

    // Initialisatie
    addSyncStyles();
    loadCompletedKisten();
    fetchKistData();
    startDataSync();
}); 