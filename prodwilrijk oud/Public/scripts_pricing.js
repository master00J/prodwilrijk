document.addEventListener('DOMContentLoaded', (event) => {
    // Globale variabelen
    let priceData = {}; // Object om alle prijsinformatie op te slaan
    let currentItemNumber = null; // Bijhouden welk artikelnummer momenteel bewerkt wordt
    let materialModal = null; // Bootstrap modal instance

    // Load the header
    fetch('header.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById('header-placeholder').innerHTML = data;
        });

    // Initialiseer Bootstrap componenten
    initializeComponents();

    // Functie om alle artikelen te laden
    const loadAllItems = () => {
        console.log('Prijsgegevens ophalen van API...');
        
        // Toon een status dat we data ophalen
        showStatus('Prijsgegevens worden geladen...', 'info');
        
        // Haal alleen prijsgegevens op uit de item_prices tabel
        fetch('/api/item_prices')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`API fout: ${response.status}`);
                }
                return response.json();
            })
            .then(prices => {
                console.log(`${prices.length} prijsgegevens ontvangen van API`);
                
                // Reset priceData
                priceData = {};
                
                // Verwerk prijsgegevens
                prices.forEach(price => {
                    if (price.item_number) {
                        priceData[price.item_number] = {
                            description: price.description || '', // Gebruik description als die er is
                            sellingPrice: parseFloat(price.selling_price) || 0,
                            materialCost: parseFloat(price.material_cost) || 0,
                            laborCost: parseFloat(price.labor_cost) || 0,
                            materials: price.materials ? 
                                (typeof price.materials === 'string' ? JSON.parse(price.materials) : price.materials) : []
                        };
                    }
                });
                
                console.log('Prijsgegevens verwerkt, aantal in priceData:', Object.keys(priceData).length);
                
                // Update de statistieken
                updateStats();
                
                // Tabel bijwerken
                renderPriceTable();
                
                // Laatste update tijdstip bijwerken
                document.getElementById('last-updated').textContent = `Laatst bijgewerkt: ${new Date().toLocaleString()}`;
                
                // Toon success status
                showStatus('Prijsgegevens succesvol geladen', 'success');
            })
            .catch(error => {
                console.error('Fout bij laden van gegevens:', error);
                showStatus(`Fout bij laden van prijsgegevens: ${error.message}. Probeer de pagina te verversen of gebruik test artikelen.`, 'error');
                
                // Als de API niet reageert, dummy data gebruiken
                if (Object.keys(priceData).length === 0) {
                    console.log('Geen gegevens ontvangen, dummy data wordt gebruikt');
                    generateDummyData();
                    updateStats();
                    renderPriceTable();
                }
            });
    };

    // Dummy data voor testen zonder API
    const generateDummyData = () => {
        console.log('Genereren van dummy data...');
        
        priceData = {
            "AR001": {
                description: "Voorbeeld Artikel 1",
                sellingPrice: 9.99,
                materialCost: 4.50,
                laborCost: 2.00,
                materials: [
                    { name: "Hout", quantity: 0.5, unitPrice: 5.00 },
                    { name: "Schroeven", quantity: 10, unitPrice: 0.10 }
                ]
            },
            "AR002": {
                description: "Voorbeeld Artikel 2",
                sellingPrice: 14.99,
                materialCost: 6.75,
                laborCost: 3.50,
                materials: [
                    { name: "Metaal", quantity: 0.3, unitPrice: 15.00 },
                    { name: "Verf", quantity: 0.25, unitPrice: 12.00 }
                ]
            },
            "AR003": {
                description: "Voorbeeld Artikel 3",
                sellingPrice: 24.99,
                materialCost: 0,
                laborCost: 0,
                materials: []
            }
        };
        
        showStatus('Test data gegenereerd omdat geen gegevens konden worden geladen', 'warning');
    };

    // Functie om Bootstrap componenten te initialiseren
    function initializeComponents() {
        // Materials Modal initialiseren
        const modalElement = document.getElementById('materialModal');
        if (modalElement) {
            materialModal = new bootstrap.Modal(modalElement);
            
            // Event listener voor materiaal toevoegen
            const addMaterialBtn = document.getElementById('add-material-btn');
            if (addMaterialBtn) {
                addMaterialBtn.addEventListener('click', addMaterial);
            }
            
            // Event listener voor materialen opslaan
            const saveMaterialsBtn = document.getElementById('save-materials-btn');
            if (saveMaterialsBtn) {
                saveMaterialsBtn.addEventListener('click', saveMaterials);
            }
        }
        
        // Upload button event handler
        const uploadPricingBtn = document.getElementById('upload-pricing-btn');
        if (uploadPricingBtn) {
            uploadPricingBtn.addEventListener('click', () => {
                const fileInput = document.getElementById('pricing-upload');
                if (fileInput.files.length > 0) {
                    uploadPricingFile(fileInput.files[0]);
                } else {
                    showStatus('Selecteer eerst een Excel-bestand', 'error');
                }
            });
        }
        
        // Search item handler
        const searchItemBtn = document.getElementById('search-item-btn');
        if (searchItemBtn) {
            searchItemBtn.addEventListener('click', searchItem);
        }

        // Input veld search on enter
        const itemSearchInput = document.getElementById('item-search');
        if (itemSearchInput) {
            itemSearchInput.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') {
                    searchItem();
                }
            });
        }
        
        // Export button handler
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportPriceData);
        }
        
        // Save all handler
        const saveAllBtn = document.getElementById('save-all-btn');
        if (saveAllBtn) {
            saveAllBtn.addEventListener('click', saveAllPriceData);
        }

        // Bulk Save handler (nieuwe manier)
        const bulkSaveBtn = document.getElementById('bulk-save-btn');
        if (bulkSaveBtn) {
            bulkSaveBtn.addEventListener('click', bulkSavePriceData);
        } else {
            // Als de knop niet bestaat, voeg deze toe naast saveAllBtn
            const saveAllBtn = document.getElementById('save-all-btn');
            if (saveAllBtn && saveAllBtn.parentNode) {
                const bulkBtn = document.createElement('button');
                bulkBtn.id = 'bulk-save-btn';
                bulkBtn.className = 'btn btn-success ms-2';
                bulkBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Bulk Opslaan';
                bulkBtn.addEventListener('click', bulkSavePriceData);
                saveAllBtn.parentNode.insertBefore(bulkBtn, saveAllBtn.nextSibling);
                console.log('Bulk save knop toegevoegd');
            }
        }

        // Test items knop
        const testItemsBtn = document.getElementById('test-items-btn');
        if (testItemsBtn) {
            testItemsBtn.addEventListener('click', addTestItems);
        } else {
            // Als de knop niet bestaat, voeg deze toe
            const actionGroup = document.querySelector('.action-buttons');
            if (actionGroup) {
                const btn = document.createElement('button');
                btn.id = 'test-items-btn';
                btn.className = 'btn btn-warning';
                btn.innerHTML = '<i class="fas fa-vial"></i> Test Artikelen';
                btn.addEventListener('click', addTestItems);
                actionGroup.appendChild(btn);
                console.log('Test-artikelen knop toegevoegd');
            }
        }
    }
    
    // Functie om statistieken bij te werken
    function updateStats() {
        const totalItems = Object.keys(priceData).length;
        const itemsWithPrice = Object.values(priceData).filter(item => item.sellingPrice > 0).length;
        const itemsWithCost = Object.values(priceData).filter(item => 
            item.materialCost > 0 || item.laborCost > 0 || (item.materials && item.materials.length > 0)
        ).length;
        
        document.getElementById('total-items-count').textContent = totalItems;
        document.getElementById('total-with-prices-count').textContent = itemsWithPrice;
        document.getElementById('total-with-cost-count').textContent = itemsWithCost;
    }

    // Functie om de prijstabel te renderen
    function renderPriceTable() {
        const tableBody = document.getElementById('price-table-body');
        if (!tableBody) {
            console.error('Tabel body element niet gevonden!');
            return;
        }
        
        // Verbeterde debug logging
        console.log('renderPriceTable aangeroepen');
        console.log('priceData object:', priceData);
        console.log('Aantal items in priceData:', Object.keys(priceData).length);
        
        // Maak de tabel leeg
        tableBody.innerHTML = '';
        
        // Als priceData leeg is, probeer test items toe te voegen om de UI te testen
        if (Object.keys(priceData).length === 0) {
            console.warn('priceData is leeg! Voeg test items toe...');
            addTestItems();
            return; // renderPriceTable wordt opnieuw aangeroepen vanuit addTestItems
        }
        
        // Sorteer de artikelnummers
        const sortedItemNumbers = Object.keys(priceData).sort();
        console.log('Gesorteerde artikelnummers:', sortedItemNumbers.slice(0, 5), '... (totaal:', sortedItemNumbers.length, ')');
        
        // Als geen items beschikbaar zijn, toon een melding
        if (sortedItemNumbers.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = '<td colspan="8" class="text-center">Geen artikelen beschikbaar. Upload een prijslijst of voeg artikelen toe.</td>';
            tableBody.appendChild(emptyRow);
            
            // Voeg een knop toe om test items toe te voegen
            const actionBtns = document.querySelector('.controls');
            if (actionBtns && !document.getElementById('test-items-btn')) {
                const btn = document.createElement('button');
                btn.id = 'test-items-btn';
                btn.className = 'btn btn-warning';
                btn.innerHTML = '<i class="fas fa-vial"></i> Test Artikelen';
                btn.addEventListener('click', addTestItems);
                actionBtns.appendChild(btn);
            }
            return;
        }
        
        // Teller voor items toegevoegd aan tabel
        let addedToTable = 0;
        let errors = 0;
        
        // Probeer eerste 500 items te renderen voor betere performance
        const maxItemsToRender = 500;
        const itemsToRender = sortedItemNumbers.slice(0, maxItemsToRender);
        
        itemsToRender.forEach(itemNumber => {
            const item = priceData[itemNumber];
            if (!item) {
                console.warn(`Item ${itemNumber} bestaat niet in priceData!`);
                errors++;
                return;
            }
            
            try {
                const row = document.createElement('tr');
                
                // Totale kostprijs berekenen
                const totalCost = (parseFloat(item.materialCost) || 0) + (parseFloat(item.laborCost) || 0);
                
                // Marge berekenen
                let margin = 0;
                const sellingPrice = parseFloat(item.sellingPrice) || 0;
                if (sellingPrice > 0 && totalCost > 0) {
                    margin = ((sellingPrice - totalCost) / sellingPrice * 100).toFixed(2);
                }
                
                row.innerHTML = `
                    <td>${itemNumber}</td>
                    <td>${item.description || ''}</td>
                    <td>
                        <div class="input-group">
                            <span class="input-group-text">€</span>
                            <input type="number" class="form-control cost-price-input selling-price" 
                                   data-item="${itemNumber}" value="${sellingPrice.toFixed(2)}" step="0.01">
                        </div>
                    </td>
                    <td>
                        <div class="input-group">
                            <span class="input-group-text">€</span>
                            <input type="number" class="form-control cost-price-input material-cost" 
                                   data-item="${itemNumber}" value="${(parseFloat(item.materialCost) || 0).toFixed(2)}" step="0.01" readonly>
                        </div>
                    </td>
                    <td>
                        <div class="input-group">
                            <span class="input-group-text">€</span>
                            <input type="number" class="form-control cost-price-input labor-cost" 
                                   data-item="${itemNumber}" value="${(parseFloat(item.laborCost) || 0).toFixed(2)}" step="0.01">
                        </div>
                    </td>
                    <td class="total-cost">€${totalCost.toFixed(2)}</td>
                    <td class="margin">${margin}%</td>
                    <td>
                        <button class="btn btn-sm btn-primary edit-materials" data-item="${itemNumber}">
                            <i class="fas fa-tools"></i> Materialen
                        </button>
                        <button class="btn btn-sm btn-success save-item" data-item="${itemNumber}">
                            <i class="fas fa-save"></i>
                        </button>
                    </td>
                `;
                
                tableBody.appendChild(row);
                addedToTable++;
                
                // Log elke 50 items voor performance monitoring
                if (addedToTable % 50 === 0) {
                    console.log(`${addedToTable} items toegevoegd aan tabel...`);
                }
            } catch (error) {
                console.error(`Fout bij renderen van rij voor ${itemNumber}:`, error);
                errors++;
            }
        });
        
        console.log(`Tabel bijgewerkt: ${addedToTable} items weergegeven, ${errors} fouten.`);
        
        // Als we niet alle items hebben weergegeven vanwege de limiet
        if (sortedItemNumbers.length > maxItemsToRender) {
            const infoRow = document.createElement('tr');
            infoRow.classList.add('table-info');
            infoRow.innerHTML = `<td colspan="8" class="text-center">
                Toon ${maxItemsToRender} van ${sortedItemNumbers.length} items. 
                <button class="btn btn-sm btn-info" id="load-more-btn">Alle items laden</button>
            </td>`;
            tableBody.appendChild(infoRow);
            
            // Event listener voor het laden van meer items
            document.getElementById('load-more-btn').addEventListener('click', () => {
                console.log('Alle items worden geladen...');
                renderAllItems();
            });
        }
        
        // Event listeners toevoegen aan de rijen
        addTableEventListeners();
        
        // Indien er items zijn toegevoegd aan de tabel, beschouw dit als success
        if (addedToTable > 0) {
            console.log('Items succesvol weergegeven in tabel');
            document.getElementById('last-updated').textContent = `Laatst bijgewerkt: ${new Date().toLocaleString()}`;
        } else {
            console.error('Geen items weergegeven in tabel!');
            showStatus('Geen items konden worden weergegeven. Probeer de pagina te verversen of voeg test items toe.', 'error');
        }
    }
    
    // Helper functie om alle items te renderen (bij klikken op 'Alle items laden')
    function renderAllItems() {
        const tableBody = document.getElementById('price-table-body');
        if (!tableBody) return;
        
        // Maak de tabel leeg
        tableBody.innerHTML = '';
        
        // Sorteer de artikelnummers
        const sortedItemNumbers = Object.keys(priceData).sort();
        
        // Toon een laad indicator
        const loadingRow = document.createElement('tr');
        loadingRow.innerHTML = `<td colspan="8" class="text-center">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Laden...</span>
            </div>
            <span class="ms-2">Alle items worden geladen...</span>
        </td>`;
        tableBody.appendChild(loadingRow);
        
        // Gebruik setTimeout om de UI te laten bijwerken voordat we alle items renderen
        setTimeout(() => {
            // Verwijder de laad indicator
            tableBody.innerHTML = '';
            
            // Teller voor items toegevoegd aan tabel
            let addedToTable = 0;
            let errors = 0;
            
            sortedItemNumbers.forEach(itemNumber => {
                const item = priceData[itemNumber];
                if (!item) {
                    console.warn(`Item ${itemNumber} bestaat niet in priceData!`);
                    errors++;
                    return;
                }
                
                try {
                    const row = document.createElement('tr');
                    
                    // Totale kostprijs berekenen
                    const totalCost = (parseFloat(item.materialCost) || 0) + (parseFloat(item.laborCost) || 0);
                    
                    // Marge berekenen
                    let margin = 0;
                    const sellingPrice = parseFloat(item.sellingPrice) || 0;
                    if (sellingPrice > 0 && totalCost > 0) {
                        margin = ((sellingPrice - totalCost) / sellingPrice * 100).toFixed(2);
                    }
                    
                    row.innerHTML = `
                        <td>${itemNumber}</td>
                        <td>${item.description || ''}</td>
                        <td>
                            <div class="input-group">
                                <span class="input-group-text">€</span>
                                <input type="number" class="form-control cost-price-input selling-price" 
                                       data-item="${itemNumber}" value="${sellingPrice.toFixed(2)}" step="0.01">
                            </div>
                        </td>
                        <td>
                            <div class="input-group">
                                <span class="input-group-text">€</span>
                                <input type="number" class="form-control cost-price-input material-cost" 
                                   data-item="${itemNumber}" value="${(parseFloat(item.materialCost) || 0).toFixed(2)}" step="0.01" readonly>
                            </div>
                        </td>
                        <td>
                            <div class="input-group">
                                <span class="input-group-text">€</span>
                                <input type="number" class="form-control cost-price-input labor-cost" 
                                       data-item="${itemNumber}" value="${(parseFloat(item.laborCost) || 0).toFixed(2)}" step="0.01">
                            </div>
                        </td>
                        <td class="total-cost">€${totalCost.toFixed(2)}</td>
                        <td class="margin">${margin}%</td>
                        <td>
                            <button class="btn btn-sm btn-primary edit-materials" data-item="${itemNumber}">
                                <i class="fas fa-tools"></i> Materialen
                            </button>
                            <button class="btn btn-sm btn-success save-item" data-item="${itemNumber}">
                                <i class="fas fa-save"></i>
                            </button>
                        </td>
                    `;
                    
                    tableBody.appendChild(row);
                    addedToTable++;
                    
                    // Log elke 100 items voor performance monitoring
                    if (addedToTable % 100 === 0) {
                        console.log(`${addedToTable} items toegevoegd aan tabel...`);
                    }
                } catch (error) {
                    console.error(`Fout bij renderen van rij voor ${itemNumber}:`, error);
                    errors++;
                }
            });
            
            console.log(`Alle ${addedToTable} items weergegeven, ${errors} fouten.`);
            addTableEventListeners();
            
            // Indien er items zijn toegevoegd aan de tabel, beschouw dit als success
            if (addedToTable > 0) {
                console.log('Items succesvol weergegeven in tabel');
                showStatus(`Alle ${addedToTable} items geladen`, 'success');
            } else {
                console.error('Geen items weergegeven in tabel!');
                showStatus('Geen items konden worden weergegeven. Probeer de pagina te verversen of voeg test items toe.', 'error');
            }
        }, 100);
    }
    
    // Functie om event listeners toe te voegen aan de tabel
    function addTableEventListeners() {
        // Verkoopprijs input events
        document.querySelectorAll('.selling-price').forEach(input => {
            input.addEventListener('change', updateItemPrice);
        });
        
        // Arbeidskosten input events
        document.querySelectorAll('.labor-cost').forEach(input => {
            input.addEventListener('change', updateItemPrice);
        });
        
        // Materialen bewerken buttons
        document.querySelectorAll('.edit-materials').forEach(button => {
            button.addEventListener('click', (e) => {
                const itemNumber = e.target.closest('button').getAttribute('data-item');
                openMaterialsModal(itemNumber);
            });
        });
        
        // Opslaan item buttons
        document.querySelectorAll('.save-item').forEach(button => {
            button.addEventListener('click', (e) => {
                const itemNumber = e.target.closest('button').getAttribute('data-item');
                saveItemPrice(itemNumber);
            });
        });
    }
    
    // Functie om een item te zoeken
    function searchItem() {
        const searchInput = document.getElementById('item-search');
        const searchTerm = searchInput.value.trim().toUpperCase();
        
        if (!searchTerm) {
            showStatus('Voer een artikelnummer in om te zoeken', 'error');
            return;
        }
        
        // Zoek in de bestaande items
        const foundItem = Object.keys(priceData).find(itemNumber => 
            itemNumber.toUpperCase().includes(searchTerm)
        );
        
        if (foundItem) {
            // Scroll naar het gevonden item
            const tableRow = document.querySelector(`tr:has(button[data-item="${foundItem}"])`);
            if (tableRow) {
                tableRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                tableRow.classList.add('highlight');
                setTimeout(() => {
                    tableRow.classList.remove('highlight');
                }, 2000);
            }
            showStatus(`Artikelnummer ${foundItem} gevonden`, 'success');
        } else {
            // Voeg nieuw item toe als het niet bestaat
            if (confirm(`Artikelnummer ${searchTerm} niet gevonden. Wil je dit toevoegen?`)) {
                priceData[searchTerm] = {
                    description: '',
                    sellingPrice: 0,
                    materialCost: 0,
                    laborCost: 0,
                    materials: []
                };
                
                updateStats();
                renderPriceTable();
                
                // Scroll naar het nieuwe item
                setTimeout(() => {
                    const newRow = document.querySelector(`tr:has(button[data-item="${searchTerm}"])`);
                    if (newRow) {
                        newRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        newRow.classList.add('highlight');
                        setTimeout(() => {
                            newRow.classList.remove('highlight');
                        }, 2000);
                    }
                }, 100);
                
                showStatus(`Nieuw artikelnummer ${searchTerm} toegevoegd`, 'success');
            }
        }
        
        // Leeg het zoekveld
        searchInput.value = '';
    }
    
    // Functie om prijsgegevens bij te werken
    function updateItemPrice(event) {
        const input = event.target;
        const itemNumber = input.getAttribute('data-item');
        const itemData = priceData[itemNumber];
        
        if (!itemData) return;
        
        // Bepaal welk veld bijgewerkt moet worden
        if (input.classList.contains('selling-price')) {
            itemData.sellingPrice = parseFloat(input.value) || 0;
        } else if (input.classList.contains('labor-cost')) {
            itemData.laborCost = parseFloat(input.value) || 0;
        }
        
        // Totale kostprijs en marge bijwerken
        const row = input.closest('tr');
        const totalCost = (itemData.materialCost || 0) + (itemData.laborCost || 0);
        const margin = itemData.sellingPrice > 0 && totalCost > 0 ? 
            ((itemData.sellingPrice - totalCost) / itemData.sellingPrice * 100).toFixed(2) : 0;
        
        row.querySelector('.total-cost').textContent = `€${totalCost.toFixed(2)}`;
        row.querySelector('.margin').textContent = `${margin}%`;
    }
    
    // Functie om het materiaalmodal te openen
    function openMaterialsModal(itemNumber) {
        if (!materialModal) return;
        
        currentItemNumber = itemNumber;
        const item = priceData[itemNumber];
        
        // Modal titel bijwerken
        document.getElementById('modal-item-number').textContent = itemNumber;
        
        // Materialen tabel vullen
        renderMaterialsTable(item.materials || []);
        
        // Modal tonen
        materialModal.show();
    }
    
    // Functie om de materialentabel te renderen
    function renderMaterialsTable(materials) {
        const tableBody = document.getElementById('materials-table-body');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        let totalMaterialCost = 0;
        
        materials.forEach((material, index) => {
            const materialTotal = material.quantity * material.unitPrice;
            totalMaterialCost += materialTotal;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${material.name}</td>
                <td>${material.quantity}</td>
                <td>€${material.unitPrice.toFixed(2)}</td>
                <td>€${materialTotal.toFixed(2)}</td>
                <td>
                    <button class="btn btn-sm btn-danger delete-material" data-index="${index}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
        
        // Totaal bijwerken
        document.getElementById('total-material-cost').textContent = `€${totalMaterialCost.toFixed(2)}`;
        
        // Delete button event handlers
        document.querySelectorAll('.delete-material').forEach(button => {
            button.addEventListener('click', deleteMaterial);
        });
    }
    
    // Functie om een materiaal toe te voegen
    function addMaterial() {
        if (!currentItemNumber) return;
        
        const nameInput = document.getElementById('material-name');
        const quantityInput = document.getElementById('material-quantity');
        const priceInput = document.getElementById('material-price');
        
        const name = nameInput.value.trim();
        const quantity = parseFloat(quantityInput.value) || 0;
        const unitPrice = parseFloat(priceInput.value) || 0;
        
        if (!name) {
            alert('Voer een materiaalnaam in');
            return;
        }
        
        if (quantity <= 0) {
            alert('Voer een geldige hoeveelheid in');
            return;
        }
        
        if (unitPrice <= 0) {
            alert('Voer een geldige prijs in');
            return;
        }
        
        // Materiaal toevoegen aan het item
        if (!priceData[currentItemNumber].materials) {
            priceData[currentItemNumber].materials = [];
        }
        
        priceData[currentItemNumber].materials.push({
            name,
            quantity,
            unitPrice
        });
        
        // Tabel bijwerken
        renderMaterialsTable(priceData[currentItemNumber].materials);
        
        // Velden legen
        nameInput.value = '';
        quantityInput.value = '';
        priceInput.value = '';
        nameInput.focus();
    }
    
    // Functie om een materiaal te verwijderen
    function deleteMaterial(event) {
        if (!currentItemNumber) return;
        
        const button = event.target.closest('button');
        const index = parseInt(button.getAttribute('data-index'));
        
        if (confirm('Weet je zeker dat je dit materiaal wilt verwijderen?')) {
            priceData[currentItemNumber].materials.splice(index, 1);
            renderMaterialsTable(priceData[currentItemNumber].materials);
        }
    }
    
    // Functie om materialen op te slaan
    function saveMaterials() {
        if (!currentItemNumber) return;
        
        // Totale materiaalkosten berekenen
        let totalMaterialCost = 0;
        if (priceData[currentItemNumber].materials) {
            priceData[currentItemNumber].materials.forEach(material => {
                totalMaterialCost += material.quantity * material.unitPrice;
            });
        }
        
        // Materiaalkosten bijwerken
        priceData[currentItemNumber].materialCost = totalMaterialCost;
        
        // Tabel bijwerken
        renderPriceTable();
        
        // Modal sluiten
        materialModal.hide();
        
        // Opslaan bij API
        saveItemPrice(currentItemNumber);
    }
    
    // Functie om een enkel item op te slaan
    function saveItemPrice(itemNumber) {
        const item = priceData[itemNumber];
        if (!item) return;
        
        // Bereid de materialen voor als JSON string als het een array is
        const materials = Array.isArray(item.materials) ? item.materials : [];
        
        // API call - nu echt uitvoeren naar het correcte endpoint
        fetch(`/api/item_prices/${itemNumber}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                selling_price: item.sellingPrice,
                material_cost: item.materialCost,
                labor_cost: item.laborCost,
                materials: materials
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Fout bij opslaan van prijsgegevens');
            }
            return response.json();
        })
        .then(data => {
            showStatus(`Artikelnummer ${itemNumber} is opgeslagen`, 'success');
            updateStats();
        })
        .catch(error => {
            console.error('Fout bij opslaan:', error);
            showStatus(`Fout bij opslaan: ${error.message}`, 'error');
        });
    }
    
    // Functie om alle prijsgegevens op te slaan
    function saveAllPriceData() {
        console.log('Bulk save aanroepen...', Object.keys(priceData).length, 'items');
        
        // Controleer of er gegevens zijn om op te slaan
        if (Object.keys(priceData).length === 0) {
            showStatus('Geen prijsgegevens om op te slaan', 'warning');
            return;
        }
        
        // Voortgangsindicator tonen
        showStatus('Prijsgegevens worden opgeslagen...', 'info');
        
        // Verzamel alle items om in batches te verwerken
        const allItems = Object.entries(priceData);
        const batchSize = 20; // Aantal items per batch - een redelijke hoeveelheid om overbelasting te voorkomen
        const totalBatches = Math.ceil(allItems.length / batchSize);
        const batchDelayMs = 1000; // Pauzeer 1 seconde tussen batches
        
        let successCount = 0;
        let errorCount = 0;
        let currentBatch = 0;
        
        // Toon voortgangsbalk in de UI
        const statusElem = document.getElementById('pricing-status');
        if (statusElem) {
            statusElem.innerHTML = `
                <div class="progress my-2">
                    <div class="progress-bar" role="progressbar" style="width: 0%;" 
                         aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">0%</div>
                </div>
                <div class="status-message info">
                    Opslaan begonnen: 0 van ${allItems.length} items verwerkt...
                </div>
            `;
        }
        
        // Functie om een batch te verwerken
        function processBatch(batchIndex) {
            // Bereken start en eind index voor deze batch
            const startIdx = batchIndex * batchSize;
            const endIdx = Math.min(startIdx + batchSize, allItems.length);
            const batchItems = allItems.slice(startIdx, endIdx);
            
            console.log(`Verwerken van batch ${batchIndex + 1}/${totalBatches}: items ${startIdx}-${endIdx-1}`);
            
            // Update de voortgangsbalk
            const progressPct = Math.round((startIdx / allItems.length) * 100);
            const progressBar = document.querySelector('#pricing-status .progress-bar');
            if (progressBar) {
                progressBar.style.width = `${progressPct}%`;
                progressBar.setAttribute('aria-valuenow', progressPct);
                progressBar.textContent = `${progressPct}%`;
            }
            
            // Update statusbericht
            const statusMessage = document.querySelector('#pricing-status .status-message');
            if (statusMessage) {
                statusMessage.textContent = 
                    `Opslaan bezig: ${startIdx} van ${allItems.length} items verwerkt... (${successCount} succes, ${errorCount} fouten)`;
            }
            
            // Maak een array van promises voor deze batch
            const batchPromises = batchItems.map(([itemNumber, item]) => {
                // Bereid de materialen voor
                const materials = Array.isArray(item.materials) ? item.materials : [];
                
                // Maak een API call voor dit item - gebruik het correcte item_prices endpoint
                return fetch(`/api/item_prices/${itemNumber}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        selling_price: item.sellingPrice,
                        material_cost: item.materialCost,
                        labor_cost: item.laborCost,
                        materials: materials
                    })
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Fout bij opslaan van ${itemNumber}: ${response.status}`);
                    }
                    successCount++;
                    return response.json();
                })
                .catch(error => {
                    console.error(`Fout bij opslaan van ${itemNumber}:`, error);
                    errorCount++;
                    return null; // Negeer individuele fouten om het proces door te laten gaan
                });
            });
            
            // Wanneer alle items in deze batch zijn verwerkt
            return Promise.all(batchPromises)
                .then(() => {
                    // Controleer of er meer batches zijn om te verwerken
                    if (batchIndex + 1 < totalBatches) {
                        // Update voortgangsinformatie met actuele successen en fouten
                        const processedCount = (batchIndex + 1) * batchSize;
                        const statusMessage = document.querySelector('#pricing-status .status-message');
                        if (statusMessage) {
                            statusMessage.textContent = 
                                `Opslaan bezig: ${Math.min(processedCount, allItems.length)} van ${allItems.length} items verwerkt... (${successCount} succes, ${errorCount} fouten)`;
                        }
                        
                        // Start de volgende batch na een korte pauze om de browser te laten ademen
                        setTimeout(() => {
                            processBatch(batchIndex + 1);
                        }, batchDelayMs);
                    } else {
                        // Alle batches zijn verwerkt, toon eindresultaat
                        const progressBar = document.querySelector('#pricing-status .progress-bar');
                        if (progressBar) {
                            progressBar.style.width = '100%';
                            progressBar.setAttribute('aria-valuenow', 100);
                            progressBar.textContent = '100%';
                        }
                        
                        // Toon eindresultaat
                        const totalCount = successCount + errorCount;
                        if (errorCount === 0) {
                            showStatus(`Alle ${successCount} prijsgegevens zijn succesvol opgeslagen`, 'success');
                        } else {
                            showStatus(`${successCount} van ${totalCount} prijsgegevens opgeslagen, ${errorCount} mislukt. Probeer de mislukte items later opnieuw op te slaan.`, 'warning');
                        }
                    }
                })
                .catch(error => {
                    console.error('Fout bij verwerken van batch:', error);
                    showStatus(`Fout bij opslaan van batch: ${error.message}. Probeer het later opnieuw.`, 'error');
                });
        }
        
        // Start met de eerste batch
        processBatch(0);
    }
    
    // Nieuwe functie om in één keer alle prijsgegevens op te slaan (bulk)
    function bulkSavePriceData() {
        console.log('Bulk save (één verzoek) aanroepen...', Object.keys(priceData).length, 'items');
        
        // Controleer of er gegevens zijn om op te slaan
        if (Object.keys(priceData).length === 0) {
            showStatus('Geen prijsgegevens om op te slaan', 'warning');
            return;
        }
        
        // Toon dat we bezig zijn
        showStatus('Alle prijsgegevens worden in één keer opgeslagen...', 'info');
        
        // Maak één groot dataobject voor alle items
        const bulkData = {};
        
        Object.entries(priceData).forEach(([itemNumber, item]) => {
            // Bereid de materialen voor
            const materials = Array.isArray(item.materials) ? item.materials : [];
            
            // Zorg ervoor dat we de veldnamen gebruiken die de backend verwacht (_snake_case)
            bulkData[itemNumber] = {
                selling_price: item.sellingPrice || 0,
                material_cost: item.materialCost || 0,
                labor_cost: item.laborCost || 0,
                materials: materials
            };
        });
        
        // Maak één API-call naar het bulk endpoint om alles op te slaan
        fetch('/api/item_prices/bulk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bulkData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Fout bij bulk opslaan: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Bulk save resultaat:', data);
            
            if (data.success) {
                showStatus(`Alle ${Object.keys(priceData).length} prijsgegevens zijn succesvol opgeslagen`, 'success');
            } else {
                showStatus(`Bulk opslaan gedeeltelijk succesvol: ${data.saved || 0} opgeslagen, ${data.failed || 0} mislukt`, 'warning');
            }
        })
        .catch(error => {
            console.error('Fout bij bulk opslaan:', error);
            
            // Als bulk methode mislukt, probeer dan de batch methode
            if (confirm('Bulk opslaan mislukt. Wil je de batch-methode proberen? (Dit slaat artikelen in kleine groepen op)')) {
                saveAllPriceData();
            } else {
                showStatus(`Fout bij bulk opslaan: ${error.message}. Probeer de batch-methode of probeer het later opnieuw.`, 'error');
            }
        });
    }
    
    // Functie om prijsgegevens te exporteren
    function exportPriceData() {
        // Data voorbereiden voor export
        const exportData = [];
        
        Object.keys(priceData).forEach(itemNumber => {
            const item = priceData[itemNumber];
            exportData.push({
                'Artikelnummer': itemNumber,
                'Omschrijving': item.description || '',
                'Verkoopprijs': item.sellingPrice || 0,
                'Materiaalkosten': item.materialCost || 0,
                'Arbeidskosten': item.laborCost || 0,
                'Totale Kostprijs': (item.materialCost || 0) + (item.laborCost || 0),
                'Marge (%)': item.sellingPrice > 0 ? 
                    ((item.sellingPrice - (item.materialCost || 0) - (item.laborCost || 0)) / item.sellingPrice * 100).toFixed(2) : 0
            });
        });
        
        // Maak een werkboek met één werkblad
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, 'Prijslijst');
        
        // Download als Excel-bestand
        XLSX.writeFile(wb, `Prijslijst_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
        
        showStatus('Prijslijst geëxporteerd als Excel-bestand', 'success');
    }
    
    // Functie om een Excel-bestand te uploaden en verwerken
    function uploadPricingFile(file) {
        showStatus('Bestand wordt geladen...', 'info');
        console.log('Excel bestand wordt verwerkt:', file.name, file.size, 'bytes');
        
        // Waarschuwing als het bestand heel groot is
        if (file.size > 5 * 1024 * 1024) { // 5MB
            if (!confirm(`Dit bestand is erg groot (${(file.size / (1024 * 1024)).toFixed(2)} MB). Het verwerken kan lang duren en de browser vertragen. Wil je doorgaan?`)) {
                showStatus('Verwerking geannuleerd door gebruiker', 'warning');
                return;
            }
        }
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                showStatus('Bestand wordt verwerkt...', 'info');
                const data = new Uint8Array(e.target.result);
                console.log('Bestand gelezen, data grootte:', data.length, 'bytes');
                
                const workbook = XLSX.read(data, { type: 'array' });
                console.log('Workbook geladen, sheets:', workbook.SheetNames);
                
                // Eerste werkblad pakken
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                console.log('Worksheet range:', worksheet['!ref']);
                
                // Data uitlezen - zonder headerdetectie
                const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 'A', raw: true });
                console.log('Raw data zonder headers:', rawData.length, 'rijen');
                
                // Waarschuwing als er heel veel rijen zijn
                const MAX_ROWS_WARNING = 5000;
                if (rawData.length > MAX_ROWS_WARNING) {
                    if (!confirm(`Dit Excel-bestand bevat ${rawData.length} rijen. Verwerken van zoveel gegevens kan de browser vertragen. Wil je doorgaan?`)) {
                        showStatus('Verwerking geannuleerd door gebruiker', 'warning');
                        return;
                    }
                }
                
                if (rawData.length > 0) {
                    console.log('Eerste rij voorbeeld:', rawData[0]);
                    if (rawData.length > 1) {
                        console.log('Tweede rij voorbeeld:', rawData[1]);
                    }
                }
                
                // Headers controleren
                let jsonData = [];
                let startRow = 0;
                
                // Bepaal of de eerste rij headers bevat
                if (rawData.length > 0) {
                    const firstRow = rawData[0];
                    const values = Object.values(firstRow);
                    const containsStrings = values.some(value => 
                        typeof value === 'string' && isNaN(parseFloat(value))
                    );
                    
                    startRow = containsStrings ? 1 : 0;
                    jsonData = rawData.slice(startRow);
                    console.log('Eerste rij bevat headers:', containsStrings, ', startRow:', startRow);
                }
                
                if (!jsonData || jsonData.length === 0) {
                    showStatus('Geen gegevens gevonden in het Excel-bestand. Controleer het formaat.', 'error');
                    return;
                }
                
                // Detecteren welke kolommen de artikelnummers en prijzen bevatten
                let priceColumnKey = null; 
                let itemColumnKey = null;
                
                // Check headers om kolommen te identificeren
                if (startRow > 0 && rawData[0]) {
                    const headerRow = rawData[0];
                    for (const [key, value] of Object.entries(headerRow)) {
                        if (typeof value === 'string') {
                            const lowerValue = value.toLowerCase();
                            if (lowerValue.includes('prijs') || lowerValue.includes('price') || lowerValue.includes('tarief')) {
                                priceColumnKey = key;
                                console.log(`Kolom ${key} bevat prijzen volgens header: ${value}`);
                            } else if (lowerValue.includes('item') || lowerValue.includes('artikel') || lowerValue.includes('nummer')) {
                                itemColumnKey = key;
                                console.log(`Kolom ${key} bevat artikelnummers volgens header: ${value}`);
                            }
                        }
                    }
                }
                
                // Als we geen kolommen konden detecteren, probeer de eerste twee kolommen
                if (!priceColumnKey && !itemColumnKey) {
                    // Bekijk de eerste rij met data om te raden welke kolom wat is
                    if (jsonData.length > 0) {
                        const firstDataRow = jsonData[0];
                        let columns = Object.keys(firstDataRow);
                        
                        // Voor het geval er maar één kolom is
                        if (columns.length === 1) {
                            showStatus('Onvoldoende kolommen gevonden in het Excel-bestand. We hebben minstens 2 kolommen nodig: artikelnummer en prijs.', 'error');
                            return;
                        }
                        
                        // Standaard: eerste kolom is artikel, tweede is prijs tenzij numerieke analyse anders aangeeft
                        itemColumnKey = columns[0];
                        priceColumnKey = columns[1];
                        
                        // Probeer te detecteren welke kolom numerieke waarden bevat (waarschijnlijk prijzen)
                        for (let i = 0; i < Math.min(5, jsonData.length); i++) {
                            const row = jsonData[i];
                            for (const [key, value] of Object.entries(row)) {
                                if (typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value.replace(',', '.'))))) {
                                    if (key !== itemColumnKey) { // Als de nummerkolom niet de artikelkolom is
                                        priceColumnKey = key;
                                        break;
                                    }
                                }
                            }
                        }
                        
                        console.log(`Automatisch gedetecteerde kolommen: Artikel = ${itemColumnKey}, Prijs = ${priceColumnKey}`);
                    }
                }
                
                if (!priceColumnKey || !itemColumnKey) {
                    showStatus('Kon de kolommen voor artikelnummers en prijzen niet detecteren. Controleer het Excel-bestand.', 'error');
                    return;
                }
                
                console.log(`Gekozen kolommen: Prijs = ${priceColumnKey}, Artikel = ${itemColumnKey}`);
                
                // Verwerken in batches om de browser niet vast te laten lopen
                processBatchExcel(jsonData, 0, priceColumnKey, itemColumnKey);
            } catch (error) {
                console.error('Fout bij verwerken Excel-bestand:', error);
                showStatus('Fout bij verwerken Excel-bestand: ' + error.message, 'error');
            }
        };
        
        reader.onerror = (error) => {
            console.error('Fout bij lezen bestand:', error);
            showStatus('Fout bij lezen bestand', 'error');
        };
        
        reader.readAsArrayBuffer(file);
    }
    
    // Nieuwe functie om Excel data in batches te verwerken
    function processBatchExcel(jsonData, batchIndex, priceColumnKey, itemColumnKey) {
        // Batchgrootte en batchberekening
        const BATCH_SIZE = 1000; // 1000 rijen per batch
        const totalBatches = Math.ceil(jsonData.length / BATCH_SIZE);
        const startIdx = batchIndex * BATCH_SIZE;
        const endIdx = Math.min(startIdx + BATCH_SIZE, jsonData.length);
        const batchData = jsonData.slice(startIdx, endIdx);
        
        console.log(`Verwerken van Excel batch ${batchIndex + 1}/${totalBatches}: rijen ${startIdx}-${endIdx-1}`);
        
        // Voortgang tonen
        const progressPct = Math.round((startIdx / jsonData.length) * 100);
        const statusElem = document.getElementById('pricing-status');
        if (statusElem) {
            statusElem.innerHTML = `
                <div class="progress my-2">
                    <div class="progress-bar" role="progressbar" style="width: ${progressPct}%;" 
                         aria-valuenow="${progressPct}" aria-valuemin="0" aria-valuemax="100">${progressPct}%</div>
                </div>
                <div class="status-message info">
                    Excel verwerking: ${startIdx} van ${jsonData.length} rijen...
                </div>
            `;
        }
        
        // Tijdelijke opslagvariabelen voor deze batch
        let updatedCount = 0;
        let newCount = 0;
        let errorCount = 0;
        let batchItems = {};
        
        // Maak tijdelijke kopie om later te vergelijken
        const oldPriceData = { ...priceData };
        
        // Verwerk deze batch
        batchData.forEach((row, index) => {
            try {
                const rawPrice = row[priceColumnKey];
                const rawItemNumber = row[itemColumnKey];
                
                // Debug info (hou alleen de eerste paar rijen bij)
                if (index < 5 || index % 200 === 0) {
                    console.log(`Verwerking rij ${startIdx + index + 1}:`, row);
                    console.log(`- Raw waarden: Artikel=${rawItemNumber}, Prijs=${rawPrice}`);
                }
                
                // Alleen verwerken als beide waarden bestaan
                if (rawItemNumber !== undefined && rawPrice !== undefined) {
                    // Converteer naar juiste types
                    let itemNumber = typeof rawItemNumber === 'string' ? 
                        rawItemNumber.trim() : String(rawItemNumber).trim();
                    
                    // Prijs kan een getal zijn of een string die we moeten parsen
                    let price;
                    if (typeof rawPrice === 'number') {
                        price = rawPrice;
                    } else {
                        // Vervang komma's door punten voor parseFloat
                        const priceStr = String(rawPrice).replace(',', '.').trim();
                        price = parseFloat(priceStr);
                    }
                    
                    // Voeg alleen toe als we een geldig artikelnummer en prijs hebben
                    if (!isNaN(price) && itemNumber && itemNumber.length > 0) {
                        if (priceData.hasOwnProperty(itemNumber)) {
                            // Update bestaand item in de tijdelijke batch
                            batchItems[itemNumber] = { 
                                ...priceData[itemNumber], 
                                sellingPrice: price 
                            };
                            updatedCount++;
                        } else {
                            // Maak nieuw item in de tijdelijke batch
                            batchItems[itemNumber] = {
                                description: '',
                                sellingPrice: price,
                                materialCost: 0,
                                laborCost: 0,
                                materials: []
                            };
                            newCount++;
                        }
                    } else {
                        console.log(`Ongeldige data in rij ${startIdx + index + 1}: Item=${itemNumber}, Prijs=${price}`);
                        errorCount++;
                    }
                } else {
                    console.log(`Ontbrekende data in rij ${startIdx + index + 1}`);
                    errorCount++;
                }
            } catch (err) {
                console.error(`Fout bij verwerken van rij ${startIdx + index + 1}:`, err);
                errorCount++;
            }
        });
        
        // Nu we de tijdelijke data hebben verwerkt, voegen we het toe aan priceData
        Object.entries(batchItems).forEach(([key, value]) => {
            priceData[key] = value;
        });
        
        // Na de verwerking van deze batch, update statistieken
        const progressBar = document.querySelector('#pricing-status .progress-bar');
        if (progressBar) {
            const pct = Math.round((endIdx / jsonData.length) * 100);
            progressBar.style.width = `${pct}%`;
            progressBar.setAttribute('aria-valuenow', pct);
            progressBar.textContent = `${pct}%`;
        }
        
        // Update statusbericht
        const statusMessage = document.querySelector('#pricing-status .status-message');
        if (statusMessage) {
            statusMessage.textContent = `Excel verwerking: ${endIdx} van ${jsonData.length} rijen verwerkt...`;
        }
        
        // Controleer of er meer batches zijn
        if (batchIndex + 1 < totalBatches) {
            // Geef de browser tijd om te renderen en ga verder met de volgende batch
            setTimeout(() => {
                processBatchExcel(jsonData, batchIndex + 1, priceColumnKey, itemColumnKey);
            }, 100);
        } else {
            // Alle batches zijn verwerkt
            finishExcelProcessing(oldPriceData, jsonData.length, errorCount);
        }
    }
    
    // Functie om de Excel verwerking af te ronden
    function finishExcelProcessing(oldPriceData, totalRows, errorCount) {
        // Controleer hoeveel items zijn toegevoegd/bijgewerkt
        const oldKeys = Object.keys(oldPriceData);
        const newKeys = Object.keys(priceData);
        const addedItems = newKeys.filter(key => !oldKeys.includes(key));
        const updatedCount = newKeys.length - addedItems.length;
        
        console.log('Excel verwerking voltooid:');
        console.log(`- Oorspronkelijk aantal items: ${oldKeys.length}`);
        console.log(`- Nieuw aantal items: ${newKeys.length}`);
        console.log(`- Toegevoegd: ${addedItems.length}, Bijgewerkt: ${updatedCount}, Fouten: ${errorCount}`);
        
        // Lijst enkele nieuwe items als ze er zijn
        if (addedItems.length > 0) {
            console.log(`Toegevoegde items (max 5 getoond): ${addedItems.slice(0, 5).join(', ')}`);
            addedItems.slice(0, 5).forEach(key => {
                console.log(`- ${key}: ${JSON.stringify(priceData[key])}`);
            });
        }
        
        // Update UI
        updateStats();
        renderPriceTable();
        
        // Toon resultaatmelding
        const statusElem = document.getElementById('pricing-status');
        if (statusElem) {
            if (addedItems.length > 0 || updatedCount > 0) {
                statusElem.innerHTML = `
                    <div class="status-message success">
                        Excel verwerking voltooid: ${addedItems.length} artikelen toegevoegd, ${updatedCount} bijgewerkt, ${errorCount} fouten. 
                        <button id="save-excel-data" class="btn btn-sm btn-primary ms-2">Gegevens opslaan</button>
                        <button id="cancel-excel-data" class="btn btn-sm btn-secondary ms-2">Annuleren</button>
                    </div>
                `;
                
                // Voeg event listeners toe aan de knoppen
                document.getElementById('save-excel-data').addEventListener('click', () => {
                    // Vraag de gebruiker welke opslagmethode te gebruiken
                    const batchMode = confirm('Kies een opslagmethode:\n\nOK = Batch-modus (meer betrouwbaar, maar langzamer)\nAnnuleren = Bulk-modus (sneller, maar mogelijk minder betrouwbaar)');
                    
                    if (batchMode) {
                        saveAllPriceData();
                    } else {
                        bulkSavePriceData();
                    }
                });
                
                document.getElementById('cancel-excel-data').addEventListener('click', () => {
                    if (confirm('Weet je zeker dat je de wijzigingen wilt annuleren? Alle wijzigingen worden ongedaan gemaakt.')) {
                        // Herstel de originele data
                        priceData = { ...oldPriceData };
                        updateStats();
                        renderPriceTable();
                        showStatus('Excel-wijzigingen geannuleerd', 'warning');
                    }
                });
            } else {
                showStatus(`Excel bestand verwerkt: Geen wijzigingen gedetecteerd, ${errorCount} fouten`, 'warning');
            }
        }
    }
    
    // Functie om een statusmelding te tonen
    function showStatus(message, type = 'info') {
        const statusElem = document.getElementById('pricing-status');
        if (!statusElem) return;
        
        statusElem.innerHTML = `<div class="status-message ${type}">${message}</div>`;
        
        // Automatisch verwijderen na 5 seconden
        setTimeout(() => {
            statusElem.innerHTML = '';
        }, 5000);
    }
    
    // Extra functie om test-artikelen toe te voegen als Excel niet werkt
    function addTestItems() {
        console.log('Test artikelen toevoegen...');
        
        // Reset de data als gewenst
        if (confirm('Wil je eerst de bestaande data wissen?')) {
            priceData = {};
        }
        
        // Test-artikelen toevoegen
        const testItems = {
            "ART001": { 
                description: "Test artikel 1", 
                sellingPrice: 10.50, 
                materialCost: 5.25, 
                laborCost: 2.00, 
                materials: [] 
            },
            "ART002": { 
                description: "Test artikel 2", 
                sellingPrice: 25.00, 
                materialCost: 12.00, 
                laborCost: 4.50, 
                materials: [] 
            },
            "ART003": { 
                description: "Test artikel 3", 
                sellingPrice: 45.75, 
                materialCost: 20.00, 
                laborCost: 8.00, 
                materials: [] 
            }
        };
        
        // Voeg nog meer test artikelen toe voor een beter gevulde lijst
        for (let i = 4; i <= 20; i++) {
            const itemNumber = `ART${String(i).padStart(3, '0')}`;
            testItems[itemNumber] = {
                description: `Test artikel ${i}`,
                sellingPrice: Math.round(Math.random() * 100) + 5,
                materialCost: Math.round(Math.random() * 50) + 2,
                laborCost: Math.round(Math.random() * 20) + 1,
                materials: []
            };
        }
        
        // Items toevoegen aan priceData
        Object.entries(testItems).forEach(([key, value]) => {
            priceData[key] = value;
        });
        
        // UI bijwerken
        updateStats();
        renderPriceTable();
        
        showStatus(`${Object.keys(testItems).length} test-artikelen toegevoegd`, 'success');
    }
    
    // Initiële data laden
    loadAllItems();
}); 