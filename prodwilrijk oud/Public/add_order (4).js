document.addEventListener('DOMContentLoaded', () => {
    // DOM element selecties
    const orderForm = document.getElementById('order-form');
    const addItemBtn = document.getElementById('add-item-btn');
    const itemsTableBody = document.querySelector('#items-table tbody');
    const itemsList = document.getElementById('items-list');
    const itemNaamInput = document.getElementById('item_naam');
    const stuklijstTableBody = document.querySelector('#stuklijst-table tbody');
    const addStuklijstRowBtn = document.getElementById('add-stuklijst-row-btn');
    
    // Import elementen
    const importBtn = document.getElementById('import-btn');
    const xmlImportInput = document.getElementById('xml-import');
    const importAllItemsCheckbox = document.getElementById('import-all-items');
    const woodPriceInput = document.getElementById('wood-price-per-m3');
    const dropArea = document.getElementById('drop-area');
    const prepackToggle = document.getElementById('prepack-toggle');
    const prepackDivisionGroup = document.getElementById('prepack-division-group');
    const prepackDivisionSelect = document.getElementById('prepack-division');
    
    // Print zaaglijst knop toevoegen
    const printZaaglijstBtn = document.createElement('button');
    printZaaglijstBtn.id = 'print-zaaglijst-btn';
    printZaaglijstBtn.className = 'btn btn-outline-secondary ms-2';
    printZaaglijstBtn.innerHTML = '<i class="fas fa-print"></i> Zaaglijst Afdrukken';
    printZaaglijstBtn.type = 'button';
    importBtn.parentNode.insertBefore(printZaaglijstBtn, importBtn.nextSibling);
    
    // Materiaalcategorieën elementen
    const materialCategoriesCard = document.getElementById('material-categories-card');
    const materialsContainer = document.getElementById('materials-container');
    const applyMaterialPricesBtn = document.getElementById('apply-material-prices');
    
    // Data state
    let items = [];
    let databaseItems = {};
    let materialCategories = {}; // Object voor het opslaan van alle unieke materiaalcategorieën
    let materialPrices = {}; // Object voor het opslaan van prijzen per materiaaltype
    
    // Houtprijs per kubieke meter (nu configureerbaar)
    // Gebruik tijdelijk localStorage als fallback tot de API-prijzen zijn geladen
    let woodPricePerM3 = parseFloat(localStorage.getItem('woodPricePerM3')) || 250;
    woodPriceInput.value = woodPricePerM3;

    // Laad alle materiaalprijzen bij het opstarten van de pagina
    loadMaterialPrices();
    
    // Update houtprijs wanneer deze verandert
    woodPriceInput.addEventListener('change', () => {
        woodPricePerM3 = parseFloat(woodPriceInput.value) || 250;
        localStorage.setItem('woodPricePerM3', woodPricePerM3);
        
        // Ook de houtprijs opslaan in de materiaal database
        saveMaterialPrice('WOOD_DEFAULT_PRICE', woodPricePerM3, 'volume');
    });

    // Functie om alle materiaalprijzen te laden van de API
    async function loadMaterialPrices() {
        try {
            const response = await fetch('/api/material-prices');
            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }
            
            const prices = await response.json();
            console.log('Materiaalprijzen geladen van database:', prices.length);
            
            // Reset de prijzenmap
            materialPrices = {};
            
            // Vul de prijzenmap met data van de server
            prices.forEach(item => {
                materialPrices[item.material_description] = item.price;
                
                // Als we de standaard houtprijs vinden, update deze
                if (item.material_description === 'WOOD_DEFAULT_PRICE') {
                    woodPricePerM3 = item.price;
                    woodPriceInput.value = woodPricePerM3;
                }
            });
            
            // Fall back op localStorage voor eventuele ontbrekende prijzen
            const savedMaterialPrices = localStorage.getItem('materialPrices');
            if (savedMaterialPrices) {
                const localPrices = JSON.parse(savedMaterialPrices);
                
                // Voeg alleen ontbrekende prijzen toe (database heeft voorrang)
                for (const key in localPrices) {
                    if (!materialPrices[key]) {
                        materialPrices[key] = localPrices[key];
                    }
                }
            }
            
        } catch (error) {
            console.error('Fout bij het laden van materiaalprijzen:', error);
            
            // Fallback naar localStorage als de API faalt
            try {
                const savedMaterialPrices = localStorage.getItem('materialPrices');
                if (savedMaterialPrices) {
                    materialPrices = JSON.parse(savedMaterialPrices);
                    console.log('Materiaalprijzen geladen uit localStorage (fallback)');
                }
            } catch (e) {
                console.error('Fout bij laden van lokale materiaalprijzen:', e);
            }
        }
    }

    // Functie om één materiaalprijs op te slaan via de API
    async function saveMaterialPrice(description, price, calculationType = 'count') {
        try {
            const response = await fetch(`/api/material-prices/${encodeURIComponent(description)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    price: price,
                    calculation_type: calculationType
                })
            });
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }
            
            const result = await response.json();
            console.log(`Prijs opgeslagen voor ${description}:`, result);
            return result;
            
        } catch (error) {
            console.error(`Fout bij opslaan prijs voor ${description}:`, error);
            
            // Sla op in localStorage als fallback
            materialPrices[description] = price;
            localStorage.setItem('materialPrices', JSON.stringify(materialPrices));
            return { success: false, error: error.message, fallback: true };
        }
    }

    // Functie om alle materiaalprijzen in bulk op te slaan
    async function saveAllMaterialPrices() {
        try {
            // Converteer de materialPrices map naar een array van objecten voor de API
            const pricesArray = Object.entries(materialPrices).map(([material_description, price]) => {
                // Bepaal het calculatietype op basis van de materiaalomschrijving
                let calculation_type = 'count'; // standaard
                
                if (material_description === 'WOOD_DEFAULT_PRICE') {
                    calculation_type = 'volume';
                } else {
                    const category = findCategoryForMaterial(material_description);
                    if (category) {
                        calculation_type = materialCategories[category].calculationType;
                    }
                }
                
                return {
                    material_description,
                    price,
                    calculation_type
                };
            });
            
            const response = await fetch('/api/material-prices', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(pricesArray)
            });
            
            let result;
            const contentType = response.headers.get("content-type");
            
            if (contentType && contentType.indexOf("application/json") !== -1) {
                result = await response.json();
            } else {
                const text = await response.text();
                console.error('Unexpected response:', text);
                throw new Error(`API returned non-JSON response: ${text.substring(0, 200)}`);
            }
            
            if (!response.ok) {
                console.error('API Error details:', result);
                throw new Error(`API Error: ${response.status} - ${result.error || 'Unknown error'}`);
            }
            
            console.log('Alle prijzen opgeslagen:', result);
            return result;
            
        } catch (error) {
            console.error('Fout bij opslaan van alle prijzen:', error);
            
            // Sla op in localStorage als fallback
            localStorage.setItem('materialPrices', JSON.stringify(materialPrices));
            return { success: false, error: error.message, fallback: true };
        }
    }

    // Helper functie om de categorie te vinden voor een materiaal
    function findCategoryForMaterial(materialDescription) {
        for (const categoryId in materialCategories) {
            if (materialCategories[categoryId].materials[materialDescription]) {
                return categoryId;
            }
        }
        return null;
    }

    // ========================
    // DRAG & DROP FUNCTIONALITEIT
    // ========================
    
    // Voorkom standaard browser gedrag (openen bestand)
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    // Highlight drop area wanneer een bestand wordt gesleept
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        dropArea.classList.add('highlight');
    }
    
    function unhighlight() {
        dropArea.classList.remove('highlight');
    }
    
    // Handle dropped files
    dropArea.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            xmlImportInput.files = files; // Update het file input veld
            handleFiles(files);
        }
    }
    
    function handleFiles(files) {
        if (files.length > 0) {
            // Verwerk alle bestanden in plaats van alleen de eerste
            const fileArray = Array.from(files);
            
            // Update de UI om te tonen hoeveel bestanden er zijn geselecteerd
            if (fileArray.length === 1) {
                dropArea.querySelector('p').textContent = `Bestand geselecteerd: ${fileArray[0].name}`;
            } else {
                dropArea.querySelector('p').textContent = `${fileArray.length} bestanden geselecteerd`;
            }
            
            // Als er meer dan één bestand is, vraag bevestiging
            if (fileArray.length > 1) {
                const confirmed = confirm(`Je hebt ${fileArray.length} XML bestanden geselecteerd. Wil je alle bestanden importeren en de materiaalprijzen toepassen?`);
                if (confirmed) {
                    processMultipleFiles(fileArray);
                }
            } else {
                // Voor één bestand, gebruik de oude methode
                parseFile(fileArray[0]);
            }
        }
    }
    
    // Nieuwe functie om meerdere bestanden te verwerken
    async function processMultipleFiles(files) {
        // Toon een voortgangsindicator
        const progressOverlay = createProgressOverlay(files.length);
        document.body.appendChild(progressOverlay);
        
        // Reset de globale state
        items = [];
        materialCategories = {};
        
        let processedCount = 0;
        let allMaterials = {}; // Verzamel alle materialen van alle bestanden
        
        try {
            // Verwerk elk bestand
            for (const file of files) {
                updateProgress(progressOverlay, processedCount, files.length, `Verwerken: ${file.name}`);
                
                // Lees het bestand
                const xmlContent = await readFileAsync(file);
                
                // Parse de XML
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
                
                // Verzamel materialen van dit bestand
                collectMaterialsFromXML(xmlDoc, allMaterials);
                
                processedCount++;
            }
            
            // Update progress
            updateProgress(progressOverlay, processedCount, files.length, 'Materiaalprijzen voorbereiden...');
            
            // Converteer verzamelde materialen naar materialCategories formaat
            convertToMaterialCategories(allMaterials);
            
            // Bouw de UI voor materiaalcategorieën
            buildMaterialCategoriesUI();
            
            // Verberg de progress overlay
            document.body.removeChild(progressOverlay);
            
            // Toon succesbericht
            alert(`${files.length} XML bestanden succesvol verwerkt. Je kunt nu de materiaalprijzen controleren en toepassen.`);
            
            // Scroll naar de materiaal sectie
            materialCategoriesCard.scrollIntoView({ behavior: 'smooth' });
            
        } catch (error) {
            console.error('Fout bij verwerken van bestanden:', error);
            document.body.removeChild(progressOverlay);
            alert(`Fout bij het verwerken van de bestanden: ${error.message}`);
        }
    }
    
    // Helper functie om een bestand asynchroon te lezen
    function readFileAsync(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error(`Kon bestand ${file.name} niet lezen`));
            reader.readAsText(file);
        });
    }
    
    // Helper functie om materialen uit een XML document te verzamelen
    function collectMaterialsFromXML(xmlDoc, allMaterials) {
        const prodOrderLines = xmlDoc.querySelectorAll('DataItem[name="ProdOrderLine"]');
        const importAllItems = importAllItemsCheckbox.checked;
        
        // Bepaal welke items geïmporteerd moeten worden
        const itemsToImport = importAllItems ? 
            Array.from(prodOrderLines) : 
            [prodOrderLines[0]];
            
        // Loop door alle items en verzamel alle materialen
        itemsToImport.forEach(prodOrderLine => {
            const components = prodOrderLine.querySelectorAll('DataItem[name="Component"]');
            
            components.forEach(component => {
                const itemNo = getNestedXmlValue(component, 'Component_Item_No_');
                const description = getNestedXmlValue(component, 'Component_Description');
                const groupCode = getNestedXmlValue(component, 'FSGComponentGroupCode') || 'OVERIGE';
                const groupDesc = getNestedXmlValue(component, 'FSGComponentGroupDescription') || 'Overige Materialen';
                const thickness = parseFloat(getNestedXmlValue(component, 'Component_Thickness')) || 0;
                const width = parseFloat(getNestedXmlValue(component, 'Component_Width')) || 0;
                const length = parseFloat(getNestedXmlValue(component, 'Component_Length')) || 0;
                const units = parseFloat(getNestedXmlValue(component, 'Component_Unit')) || 0;
                
                // Skip lege materialen (als prepack niet is geactiveerd)
                if (!prepackToggle.checked && (thickness === 0 || width === 0 || length === 0)) {
                    return;
                }
                
                // Unieke sleutel voor dit materiaal
                const materialKey = description;
                
                // Als dit materiaal nog niet bestaat, voeg het toe
                if (!allMaterials[materialKey]) {
                    allMaterials[materialKey] = {
                        itemNo: itemNo,
                        description: description,
                        groupCode: groupCode,
                        groupDesc: groupDesc,
                        thickness: thickness,
                        width: width,
                        length: length,
                        totalUnits: 0,
                        totalVolume: 0,
                        totalArea: 0
                    };
                }
                
                // Update de totalen
                allMaterials[materialKey].totalUnits += units;
                
                // Bereken volume of oppervlakte
                if (groupCode === '1HOUT' || description.startsWith('NHV') || description.startsWith('HON')) {
                    // Hout berekening (volumetrisch)
                    const volumeM3 = (thickness / 1000) * (width / 1000) * (length / 1000) * units;
                    allMaterials[materialKey].totalVolume += volumeM3;
                } else if (description.startsWith('HBO') || description.startsWith('MEP')) {
                    // Plaatmateriaal berekening (oppervlakte)
                    const areaM2 = (width / 1000) * (length / 1000) * units;
                    allMaterials[materialKey].totalArea += areaM2;
                }
            });
        });
    }
    
    // Helper functie om verzamelde materialen te converteren naar materialCategories formaat
    function convertToMaterialCategories(allMaterials) {
        materialCategories = {}; // Reset categorieën
        let newMaterialsFound = [];
        
        Object.keys(allMaterials).forEach(materialKey => {
            const material = allMaterials[materialKey];
            
            // Bepaal de categorie
            let categoryId = material.groupCode;
            let categoryName = material.groupDesc;
            let unitType = 'stuk';
            let calculationType = 'count';
            
            // Bepaal calculatietype op basis van eigenschappen
            if (material.groupCode === '1HOUT' || material.description.startsWith('NHV') || material.description.startsWith('HON')) {
                unitType = 'm³';
                calculationType = 'volume';
            } else if (material.description.startsWith('HBO') || material.description.startsWith('MEP')) {
                unitType = 'm²';
                calculationType = 'area';
            }
            
            // Zorg ervoor dat de categorie bestaat
            if (!materialCategories[categoryId]) {
                materialCategories[categoryId] = {
                    name: categoryName,
                    materials: {},
                    unitType: unitType,
                    totalCount: 0,
                    totalVolume: 0,
                    totalArea: 0,
                    calculationType: calculationType
                };
            }
            
            // Voeg het materiaal toe aan de categorie
            materialCategories[categoryId].materials[materialKey] = {
                description: material.description,
                code: material.itemNo,
                count: material.totalUnits,
                volume: material.totalVolume,
                area: material.totalArea,
                dimensions: {
                    thickness: material.thickness,
                    width: material.width,
                    length: material.length
                }
            };
            
            // Update de categorie totalen
            materialCategories[categoryId].totalCount += material.totalUnits;
            materialCategories[categoryId].totalVolume += material.totalVolume;
            materialCategories[categoryId].totalArea += material.totalArea;
            
            // Check of we een opgeslagen prijs hebben voor dit materiaal
            if (!materialPrices[materialKey]) {
                // Als er geen prijs is, gebruik een standaardwaarde en markeer als nieuw
                if (calculationType === 'volume') {
                    materialPrices[materialKey] = woodPricePerM3;
                } else {
                    materialPrices[materialKey] = 0;
                }
                newMaterialsFound.push(materialKey);
            }
        });
        
        // Log nieuwe materialen
        if (newMaterialsFound.length > 0) {
            console.log(`${newMaterialsFound.length} nieuwe materialen gevonden zonder opgeslagen prijzen:`, newMaterialsFound);
        }
        
        console.log('Materiaal categorieën uit meerdere bestanden:', materialCategories);
    }
    
    // Functie om een voortgangsoverlay te maken
    function createProgressOverlay(totalFiles) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        `;
        
        const progressCard = document.createElement('div');
        progressCard.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            min-width: 400px;
        `;
        
        progressCard.innerHTML = `
            <h4>XML Bestanden Verwerken</h4>
            <div class="progress mb-3" style="height: 30px;">
                <div class="progress-bar progress-bar-striped progress-bar-animated" 
                     role="progressbar" 
                     style="width: 0%"
                     aria-valuenow="0" 
                     aria-valuemin="0" 
                     aria-valuemax="${totalFiles}">
                </div>
            </div>
            <p class="progress-status">Voorbereiden...</p>
            <p class="progress-count">0 / ${totalFiles} bestanden verwerkt</p>
        `;
        
        overlay.appendChild(progressCard);
        return overlay;
    }
    
    // Functie om de voortgang bij te werken
    function updateProgress(overlay, current, total, status) {
        const progressBar = overlay.querySelector('.progress-bar');
        const progressStatus = overlay.querySelector('.progress-status');
        const progressCount = overlay.querySelector('.progress-count');
        
        const percentage = (current / total) * 100;
        progressBar.style.width = `${percentage}%`;
        progressBar.setAttribute('aria-valuenow', current);
        progressStatus.textContent = status;
        progressCount.textContent = `${current} / ${total} bestanden verwerkt`;
    }
    
    function parseFile(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const xmlContent = e.target.result;
            parseOrderXML(xmlContent);
        };
        reader.readAsText(file);
    }

    // ========================
    // MATERIAALCATEGORIEËN FUNCTIONALITEIT
    // ========================
    
    // Functie voor het analyseren en categoriseren van materialen
    function analyzeMaterials(xmlDoc) {
        materialCategories = {}; // Reset categorieën
        let newMaterialsFound = []; // Houdt nieuwe materialen bij die nog geen prijs hebben
        
        const prodOrderLines = xmlDoc.querySelectorAll('DataItem[name="ProdOrderLine"]');
        const importAllItems = importAllItemsCheckbox.checked;
        
        // Bepaal welke items geïmporteerd moeten worden
        const itemsToImport = importAllItems ? 
            Array.from(prodOrderLines) : 
            [prodOrderLines[0]];
            
        // Loop door alle items en verzamel alle materialen
        itemsToImport.forEach(prodOrderLine => {
            const components = prodOrderLine.querySelectorAll('DataItem[name="Component"]');
            
            components.forEach(component => {
                const itemNo = getNestedXmlValue(component, 'Component_Item_No_');
                const description = getNestedXmlValue(component, 'Component_Description');
                const groupCode = getNestedXmlValue(component, 'FSGComponentGroupCode') || 'OVERIGE';
                const groupDesc = getNestedXmlValue(component, 'FSGComponentGroupDescription') || 'Overige Materialen';
                const thickness = parseFloat(getNestedXmlValue(component, 'Component_Thickness')) || 0;
                const width = parseFloat(getNestedXmlValue(component, 'Component_Width')) || 0;
                const length = parseFloat(getNestedXmlValue(component, 'Component_Length')) || 0;
                const units = parseFloat(getNestedXmlValue(component, 'Component_Unit')) || 0;
                
                // Skip lege materialen (als prepack niet is geactiveerd)
                if (!prepackToggle.checked && (thickness === 0 || width === 0 || length === 0)) {
                    return;
                }
                
                // Bereken volume of oppervlakte
                let volumeM3 = 0;
                let areaM2 = 0;
                
                // Maak een categorie-id gebaseerd op materiaalcategorie en -omschrijving
                let categoryId = groupCode;
                let categoryName = groupDesc;
                let unitType = 'stuk';
                let calculationType = 'count';
                
                // Bepaal calculatietype op basis van eigenschappen
                if (groupCode === '1HOUT' || description.startsWith('NHV') || description.startsWith('HON')) {
                    // Hout berekening (volumetrisch)
                    volumeM3 = (thickness / 1000) * (width / 1000) * (length / 1000) * units;
                    unitType = 'm³';
                    calculationType = 'volume';
                } else if (description.startsWith('HBO') || description.startsWith('MEP')) {
                    // Plaatmateriaal berekening (oppervlakte)
                    areaM2 = (width / 1000) * (length / 1000) * units;
                    unitType = 'm²';
                    calculationType = 'area';
                }
                
                // Zorg ervoor dat de categorie bestaat in materialCategories
                if (!materialCategories[categoryId]) {
                    materialCategories[categoryId] = {
                        name: categoryName,
                        materials: {},
                        unitType: unitType,
                        totalCount: 0,
                        totalVolume: 0,
                        totalArea: 0,
                        calculationType: calculationType
                    };
                }
                
                // Unieke id voor dit specifieke materiaal
                const materialKey = description;
                
                // Voeg het specifieke materiaal toe onder deze categorie
                if (!materialCategories[categoryId].materials[materialKey]) {
                    materialCategories[categoryId].materials[materialKey] = {
                        description: description,
                        code: itemNo,
                        count: 0,
                        volume: 0,
                        area: 0,
                        dimensions: {
                            thickness: thickness,
                            width: width,
                            length: length
                        }
                    };
                    
                    // Check of we een opgeslagen prijs hebben voor dit materiaal
                    if (!materialPrices[materialKey]) {
                        // Als er geen prijs is, gebruik een standaardwaarde en markeer als nieuw
                        if (calculationType === 'volume') {
                            materialPrices[materialKey] = woodPricePerM3; // Gebruik houtprijs voor hout
                        } else {
                            materialPrices[materialKey] = 0; // Stel in op 0 voor andere materialen
                        }
                        newMaterialsFound.push(materialKey);
                    }
                }
                
                // Update de tellingen en volumes
                materialCategories[categoryId].materials[materialKey].count += units;
                materialCategories[categoryId].materials[materialKey].volume += volumeM3;
                materialCategories[categoryId].materials[materialKey].area += areaM2;
                
                materialCategories[categoryId].totalCount += units;
                materialCategories[categoryId].totalVolume += volumeM3;
                materialCategories[categoryId].totalArea += areaM2;
            });
        });
        
        // Loggen van nieuwe materialen
        if (newMaterialsFound.length > 0) {
            console.log(`${newMaterialsFound.length} nieuwe materialen gevonden zonder opgeslagen prijzen:`, newMaterialsFound);
        }
        
        console.log('Materiaal categorieën:', materialCategories);
        
        // Bouw de UI voor materiaalcategorieën
        buildMaterialCategoriesUI();
    }
    
    // Functie om de UI voor materiaalcategorieën te bouwen
    function buildMaterialCategoriesUI() {
        // Leeg de container voor een schone start
        materialsContainer.innerHTML = '';
        
        if (Object.keys(materialCategories).length === 0) {
            materialsContainer.innerHTML = '<div class="alert alert-info">Geen materialen gevonden in de XML.</div>';
            return;
        }
        
        // Sorteer categorieën (1HOUT eerst, dan anderen op naam)
        const sortedCategories = Object.keys(materialCategories).sort((a, b) => {
            if (a === '1HOUT') return -1;
            if (b === '1HOUT') return 1;
            return materialCategories[a].name.localeCompare(materialCategories[b].name);
        });
        
        // Bouw elke categorie
        sortedCategories.forEach(categoryId => {
            const category = materialCategories[categoryId];
            const materials = category.materials;
            
            // Maak een categorie-groep
            const categoryGroup = document.createElement('div');
            categoryGroup.className = 'material-group';
            
            // Aantal en label op basis van calculatietype
            let quantityText = '';
            let unitLabel = '';
            
            if (category.calculationType === 'volume') {
                quantityText = category.totalVolume.toFixed(4);
                unitLabel = 'm³';
            } else if (category.calculationType === 'area') {
                quantityText = category.totalArea.toFixed(2);
                unitLabel = 'm²';
            } else {
                quantityText = category.totalCount.toString();
                unitLabel = 'stuks';
            }
            
            // Bouw de header voor de categorie
            categoryGroup.innerHTML = `
                <div class="material-header" data-category="${categoryId}">
                    <i class="fas fa-chevron-right material-toggle"></i>
                    <strong>${category.name}</strong>
                    <span class="material-badge">${quantityText} ${unitLabel}</span>
                </div>
                <div class="material-items" id="items-${categoryId}">
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>Materiaal</th>
                                    <th>Afmetingen</th>
                                    <th>Aantal</th>
                                    <th>${unitLabel}</th>
                                    <th>Prijs per ${category.calculationType === 'volume' ? 'm³' : (category.calculationType === 'area' ? 'm²' : 'stuk')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Object.keys(materials).map(materialKey => {
                                    const material = materials[materialKey];
                                    let dimensionText = '';
                                    let quantityValue = '';
                                    
                                    if (category.calculationType === 'volume' || category.calculationType === 'area') {
                                        dimensionText = `${material.dimensions.thickness}×${material.dimensions.width}×${material.dimensions.length} mm`;
                                    }
                                    
                                    if (category.calculationType === 'volume') {
                                        quantityValue = material.volume.toFixed(4);
                                    } else if (category.calculationType === 'area') {
                                        quantityValue = material.area.toFixed(2);
                                    } else {
                                        quantityValue = material.count;
                                    }
                                    
                                    return `
                                        <tr>
                                            <td>${material.description}</td>
                                            <td>${dimensionText}</td>
                                            <td>${material.count}</td>
                                            <td>${quantityValue}</td>
                                            <td>
                                                <div class="input-group input-group-sm" style="max-width: 150px;">
                                                    <span class="input-group-text">€</span>
                                                    <input type="number" class="form-control material-price-input" 
                                                           data-material="${materialKey}" 
                                                           value="${materialPrices[materialKey] || 0}" 
                                                           min="0" step="0.01">
                                                </div>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            
            materialsContainer.appendChild(categoryGroup);
        });
        
        // Toon het materiaalcategorieën kaart
        materialCategoriesCard.style.display = 'block';
        
        // Voeg event listeners toe voor uitklapbare categorieën
        document.querySelectorAll('.material-header').forEach(header => {
            header.addEventListener('click', () => {
                const categoryId = header.getAttribute('data-category');
                const itemsContainer = document.getElementById(`items-${categoryId}`);
                const toggle = header.querySelector('.material-toggle');
                
                // Toggle de zichtbaarheid
                if (itemsContainer.style.display === 'block') {
                    itemsContainer.style.display = 'none';
                    toggle.className = 'fas fa-chevron-right material-toggle';
                } else {
                    itemsContainer.style.display = 'block';
                    toggle.className = 'fas fa-chevron-down material-toggle';
                }
            });
        });
        
        // Voeg event listeners toe voor prijsinvoer
        document.querySelectorAll('.material-price-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const materialKey = e.target.getAttribute('data-material');
                const price = parseFloat(e.target.value) || 0;
                materialPrices[materialKey] = price;
                
                // Sla de nieuwe prijs direct op in database
                const category = findCategoryForMaterial(materialKey);
                if (category) {
                    const calculationType = materialCategories[category].calculationType;
                    saveMaterialPrice(materialKey, price, calculationType);
                } else {
                    saveMaterialPrice(materialKey, price, 'count');
                }
                
                // Houd als fallback bij in localStorage
                localStorage.setItem('materialPrices', JSON.stringify(materialPrices));
            });
        });
    }
    
    // Event handler voor het toepassen van materiaalprijzen
    applyMaterialPricesBtn.addEventListener('click', () => {
        // Bereken de nieuwe kosten op basis van alle materialen
        recalculateMaterialCosts();
        
        // Bereken ook het materiaalverbruik per item
        calculateMaterialUsagePerItem();
        
        // Sla alle prijzen op in de database
        saveAllMaterialPrices().then(result => {
            // Update de UI
            updateItemsTable();
            calculateTotals();
            
            // Update ook de item_prices tabel met de berekende kosten
            updateItemPricesWithCalculatedCosts(items).then(updateResult => {
                let successMessage = result.success 
                    ? 'Materiaalprijzen zijn toegepast op alle items en opgeslagen in de database.' 
                    : 'Materiaalprijzen zijn toegepast. Let op: er was een probleem met het opslaan in de database (als reservekopie opgeslagen in je browser).';
                
                if (updateResult && updateResult.success) {
                    successMessage += '\nItem kosten zijn ook bijgewerkt in de nacalculatie database.';
                }
                
                successMessage += '\n\nJe kunt nu op "Materiaalverbruik per Item" klikken om gedetailleerde informatie per item te bekijken.';
                
                alert(successMessage);
            });
        });
    });
    
    // Functie om materiaalkosten opnieuw te berekenen
    function recalculateMaterialCosts() {
        // Loop door alle items
        items.forEach(item => {
            let totalWoodCost = 0;
            let totalAuxiliaryCost = 0;
            
            // Loop door de stuklijst van het item
            item.stuklijst.forEach(material => {
                const description = material.description;
                
                // Zoek de categorie van dit materiaal
                let categoryId = null;
                let materialCalculationType = 'count';
                
                // Zoek de categorie voor calculatietype
                for (const catId in materialCategories) {
                    if (materialCategories[catId].materials[description]) {
                        categoryId = catId;
                        materialCalculationType = materialCategories[catId].calculationType;
                        break;
                    }
                }
                
                // Gebruik de directe materiaalprijs (niet meer de categorieprijs)
                const price = materialPrices[description] || 0;
                let materialCost = 0;
                
                if (materialCalculationType === 'volume') {
                    // Bereken in kubieke meters
                    const volumeM3 = (material.dikte / 1000) * (material.breedte / 1000) * (material.lengte / 1000) * material.aantal;
                    materialCost = volumeM3 * price;
                } else if (materialCalculationType === 'area') {
                    // Bereken in vierkante meters
                    const areaM2 = (material.breedte / 1000) * (material.lengte / 1000) * material.aantal;
                    materialCost = areaM2 * price;
                } else {
                    // Bereken per stuk
                    materialCost = material.aantal * price;
                }
                
                // Sorteer de kosten in de juiste categorie
                if (categoryId === '1HOUT' || 
                    materialCalculationType === 'volume' || 
                    (description && (description.startsWith('NHV') || description.startsWith('HON')))) {
                    // Dit is hout
                    totalWoodCost += materialCost;
                } else {
                    // Dit is hulpstof materiaal
                    totalAuxiliaryCost += materialCost;
                }
            });
            
            // Update de kosten van het item
            item.hout_kost = totalWoodCost;
            item.hulpstoffen = totalAuxiliaryCost;
        });
    }

    // NIEUWE FUNCTIE: Bereken materiaalverbruik per item
    function calculateMaterialUsagePerItem() {
        items.forEach(item => {
            let materialUsage = {
                hout: [],
                hulpstoffen: [],
                totaalHoutVolume: 0,
                totaalHoutKosten: 0,
                totaalHulpstoffenKosten: 0
            };
            
            // Loop door de stuklijst van het item
            item.stuklijst.forEach(material => {
                const description = material.description;
                
                // Zoek de categorie van dit materiaal
                let categoryId = null;
                let materialCalculationType = 'count';
                
                // Zoek de categorie voor calculatietype
                for (const catId in materialCategories) {
                    if (materialCategories[catId].materials[description]) {
                        categoryId = catId;
                        materialCalculationType = materialCategories[catId].calculationType;
                        break;
                    }
                }
                
                // Bereken volume, oppervlakte of aantal
                let volumeM3 = 0;
                let areaM2 = 0;
                let quantity = material.aantal;
                
                if (materialCalculationType === 'volume') {
                    volumeM3 = (material.dikte / 1000) * (material.breedte / 1000) * (material.lengte / 1000) * material.aantal;
                } else if (materialCalculationType === 'area') {
                    areaM2 = (material.breedte / 1000) * (material.lengte / 1000) * material.aantal;
                }
                
                // Gebruik de directe materiaalprijs
                const price = materialPrices[description] || 0;
                let materialCost = 0;
                
                if (materialCalculationType === 'volume') {
                    materialCost = volumeM3 * price;
                } else if (materialCalculationType === 'area') {
                    materialCost = areaM2 * price;
                } else {
                    materialCost = quantity * price;
                }
                
                // Maak materiaal object
                const materialInfo = {
                    description: description,
                    code: material.materiaal_code,
                    dikte: material.dikte,
                    breedte: material.breedte,
                    lengte: material.lengte,
                    aantal: quantity,
                    volume: volumeM3,
                    area: areaM2,
                    prijsPerEenheid: price,
                    kosten: materialCost,
                    eenheid: materialCalculationType === 'volume' ? 'm³' : (materialCalculationType === 'area' ? 'm²' : 'stuk')
                };
                
                // Sorteer in de juiste categorie
                if (categoryId === '1HOUT' || 
                    materialCalculationType === 'volume' || 
                    (description && (description.startsWith('NHV') || description.startsWith('HON')))) {
                    // Dit is hout
                    materialUsage.hout.push(materialInfo);
                    materialUsage.totaalHoutVolume += volumeM3;
                    materialUsage.totaalHoutKosten += materialCost;
                } else {
                    // Dit is hulpstof materiaal
                    materialUsage.hulpstoffen.push(materialInfo);
                    materialUsage.totaalHulpstoffenKosten += materialCost;
                }
            });
            
            // Sla het materiaalverbruik op in het item
            item.materialUsage = materialUsage;
        });
    }

    // NIEUWE FUNCTIE: Toon materiaalverbruik per item
    function showMaterialUsagePerItem() {
        // Bereken eerst het materiaalverbruik
        calculateMaterialUsagePerItem();
        
        // Maak een modal om het materiaalverbruik te tonen
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'materialUsageModal';
        modal.setAttribute('tabindex', '-1');
        modal.setAttribute('aria-labelledby', 'materialUsageModalLabel');
        modal.setAttribute('aria-hidden', 'true');
        
        modal.innerHTML = `
            <div class="modal-dialog modal-fullscreen">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title" id="materialUsageModalLabel">
                            <i class="fas fa-cube"></i> Materiaalverbruik per Item - Overzicht
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body p-0">
                        <div class="container-fluid">
                            <div class="row">
                                <!-- Linker sidebar met item navigatie -->
                                <div class="col-md-3 bg-light border-end" style="height: 80vh; overflow-y: auto;">
                                    <div class="p-3">
                                        <h6 class="text-muted mb-3">
                                            <i class="fas fa-list"></i> Items (${items.length})
                                        </h6>
                                        <div class="nav flex-column nav-pills" id="item-tabs" role="tablist">
                                            ${items.map((item, index) => `
                                                <button class="nav-link text-start mb-2 ${index === 0 ? 'active' : ''}" 
                                                        id="item-tab-${index}" 
                                                        data-bs-toggle="pill" 
                                                        data-bs-target="#item-content-${index}" 
                                                        type="button" 
                                                        role="tab">
                                                                                                    <div class="d-flex justify-content-between align-items-center">
                                                    <div>
                                                        <strong>${item.item_naam}</strong>
                                                        ${item.description ? `<br><small class="text-muted">${item.description}</small>` : ''}
                                                        <br>
                                                        <small class="text-muted">${item.hoeveelheid}x items</small>
                                                    </div>
                                                        <div class="text-end">
                                                            <span class="badge bg-success">€ ${(item.materialUsage.totaalHoutKosten + item.materialUsage.totaalHulpstoffenKosten).toFixed(2)}</span>
                                                            ${item.is_new ? '<br><span class="badge bg-info mt-1">Nieuw</span>' : ''}
                                                        </div>
                                                    </div>
                                                </button>
                                            `).join('')}
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Rechter content gebied -->
                                <div class="col-md-9">
                                    <div class="tab-content p-3" id="item-tab-content">
                                        ${items.map((item, index) => `
                                            <div class="tab-pane fade ${index === 0 ? 'show active' : ''}" 
                                                 id="item-content-${index}" 
                                                 role="tabpanel">
                                                
                                                <!-- Item header -->
                                                <div class="row mb-4">
                                                    <div class="col-12">
                                                        <div class="card border-0 bg-light">
                                                            <div class="card-body">
                                                                <div class="row align-items-center">
                                                                    <div class="col-md-6">
                                                                        <h4 class="mb-1">
                                                                            <i class="fas fa-box text-primary"></i> 
                                                                            ${item.item_naam}
                                                                        </h4>
                                                                        ${item.description ? `<p class="text-muted mb-1">${item.description}</p>` : ''}
                                                                        <p class="text-muted mb-0">
                                                                            Aantal: <strong>${item.hoeveelheid}</strong> | 
                                                                            ${item.is_new ? '<span class="badge bg-info">Nieuw Item</span>' : 'Bestaand Item'}
                                                                        </p>
                                                                    </div>
                                                                    <div class="col-md-6 text-end">
                                                                        <div class="row">
                                                                            <div class="col-4">
                                                                                <div class="text-center">
                                                                                    <div class="h5 text-success mb-0">€ ${item.materialUsage.totaalHoutKosten.toFixed(2)}</div>
                                                                                    <small class="text-muted">Hout Kosten</small>
                                                                                </div>
                                                                            </div>
                                                                            <div class="col-4">
                                                                                <div class="text-center">
                                                                                    <div class="h5 text-info mb-0">€ ${item.materialUsage.totaalHulpstoffenKosten.toFixed(2)}</div>
                                                                                    <small class="text-muted">Hulpstoffen</small>
                                                                                </div>
                                                                            </div>
                                                                            <div class="col-4">
                                                                                <div class="text-center">
                                                                                    <div class="h4 text-primary mb-0">€ ${(item.materialUsage.totaalHoutKosten + item.materialUsage.totaalHulpstoffenKosten).toFixed(2)}</div>
                                                                                    <small class="text-muted">Totaal</small>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <!-- Materiaal tabs -->
                                                <ul class="nav nav-tabs mb-3" role="tablist">
                                                    <li class="nav-item" role="presentation">
                                                        <button class="nav-link active" id="hout-tab-${index}" data-bs-toggle="tab" data-bs-target="#hout-content-${index}" type="button" role="tab">
                                                            <i class="fas fa-tree text-success"></i> Hout Materialen 
                                                            <span class="badge bg-success ms-1">${item.materialUsage.hout.length}</span>
                                                        </button>
                                                    </li>
                                                    <li class="nav-item" role="presentation">
                                                        <button class="nav-link" id="hulpstoffen-tab-${index}" data-bs-toggle="tab" data-bs-target="#hulpstoffen-content-${index}" type="button" role="tab">
                                                            <i class="fas fa-tools text-info"></i> Hulpstoffen 
                                                            <span class="badge bg-info ms-1">${item.materialUsage.hulpstoffen.length}</span>
                                                        </button>
                                                    </li>
                                                    <li class="nav-item" role="presentation">
                                                        <button class="nav-link" id="samenvatting-tab-${index}" data-bs-toggle="tab" data-bs-target="#samenvatting-content-${index}" type="button" role="tab">
                                                            <i class="fas fa-chart-pie text-warning"></i> Samenvatting
                                                        </button>
                                                    </li>
                                                </ul>
                                                
                                                <div class="tab-content">
                                                    <!-- Hout materialen tab -->
                                                    <div class="tab-pane fade show active" id="hout-content-${index}" role="tabpanel">
                                                        ${item.materialUsage.hout.length > 0 ? `
                                                            <div class="table-responsive">
                                                                <table class="table table-hover">
                                                                    <thead class="table-success">
                                                                        <tr>
                                                                            <th><i class="fas fa-tag"></i> Materiaal</th>
                                                                            <th><i class="fas fa-ruler-combined"></i> Afmetingen</th>
                                                                            <th><i class="fas fa-hashtag"></i> Aantal</th>
                                                                            <th><i class="fas fa-cube"></i> Volume</th>
                                                                            <th><i class="fas fa-euro-sign"></i> Prijs/m³</th>
                                                                            <th><i class="fas fa-calculator"></i> Kosten</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        ${item.materialUsage.hout.map(material => `
                                                                            <tr>
                                                                                <td>
                                                                                    <strong>${material.description}</strong>
                                                                                    ${material.code ? `<br><small class="text-muted">Code: ${material.code}</small>` : ''}
                                                                                </td>
                                                                                <td>
                                                                                    <span class="badge bg-secondary">
                                                                                        ${material.dikte}×${material.breedte}×${material.lengte} mm
                                                                                    </span>
                                                                                </td>
                                                                                <td>
                                                                                    <span class="badge bg-primary">${material.aantal}</span>
                                                                                </td>
                                                                                <td>
                                                                                    <span class="text-success fw-bold">${material.volume.toFixed(4)} m³</span>
                                                                                </td>
                                                                                <td>€ ${material.prijsPerEenheid.toFixed(2)}</td>
                                                                                <td>
                                                                                    <span class="text-success fw-bold">€ ${material.kosten.toFixed(2)}</span>
                                                                                </td>
                                                                            </tr>
                                                                        `).join('')}
                                                                    </tbody>
                                                                    <tfoot class="table-success">
                                                                        <tr>
                                                                            <td colspan="3"><strong>Totaal Hout</strong></td>
                                                                            <td><strong>${item.materialUsage.totaalHoutVolume.toFixed(4)} m³</strong></td>
                                                                            <td></td>
                                                                            <td><strong>€ ${item.materialUsage.totaalHoutKosten.toFixed(2)}</strong></td>
                                                                        </tr>
                                                                    </tfoot>
                                                                </table>
                                                            </div>
                                                        ` : `
                                                            <div class="text-center py-5">
                                                                <i class="fas fa-tree fa-3x text-muted mb-3"></i>
                                                                <h5 class="text-muted">Geen hout materialen</h5>
                                                                <p class="text-muted">Dit item bevat geen hout materialen.</p>
                                                            </div>
                                                        `}
                                                    </div>
                                                    
                                                    <!-- Hulpstoffen tab -->
                                                    <div class="tab-pane fade" id="hulpstoffen-content-${index}" role="tabpanel">
                                                        ${item.materialUsage.hulpstoffen.length > 0 ? `
                                                            <div class="table-responsive">
                                                                <table class="table table-hover">
                                                                    <thead class="table-info">
                                                                        <tr>
                                                                            <th><i class="fas fa-tag"></i> Materiaal</th>
                                                                            <th><i class="fas fa-ruler-combined"></i> Afmetingen</th>
                                                                            <th><i class="fas fa-hashtag"></i> Aantal</th>
                                                                            <th><i class="fas fa-vector-square"></i> Oppervlakte</th>
                                                                            <th><i class="fas fa-euro-sign"></i> Prijs/eenheid</th>
                                                                            <th><i class="fas fa-calculator"></i> Kosten</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        ${item.materialUsage.hulpstoffen.map(material => `
                                                                            <tr>
                                                                                <td>
                                                                                    <strong>${material.description}</strong>
                                                                                    ${material.code ? `<br><small class="text-muted">Code: ${material.code}</small>` : ''}
                                                                                </td>
                                                                                <td>
                                                                                    <span class="badge bg-secondary">
                                                                                        ${material.dikte}×${material.breedte}×${material.lengte} mm
                                                                                    </span>
                                                                                </td>
                                                                                <td>
                                                                                    <span class="badge bg-primary">${material.aantal}</span>
                                                                                </td>
                                                                                <td>
                                                                                    ${material.area > 0 ? 
                                                                                        `<span class="text-info fw-bold">${material.area.toFixed(2)} m²</span>` : 
                                                                                        `<span class="text-info fw-bold">${material.aantal} stuks</span>`
                                                                                    }
                                                                                </td>
                                                                                <td>€ ${material.prijsPerEenheid.toFixed(2)}</td>
                                                                                <td>
                                                                                    <span class="text-info fw-bold">€ ${material.kosten.toFixed(2)}</span>
                                                                                </td>
                                                                            </tr>
                                                                        `).join('')}
                                                                    </tbody>
                                                                    <tfoot class="table-info">
                                                                        <tr>
                                                                            <td colspan="5"><strong>Totaal Hulpstoffen</strong></td>
                                                                            <td><strong>€ ${item.materialUsage.totaalHulpstoffenKosten.toFixed(2)}</strong></td>
                                                                        </tr>
                                                                    </tfoot>
                                                                </table>
                                                            </div>
                                                        ` : `
                                                            <div class="text-center py-5">
                                                                <i class="fas fa-tools fa-3x text-muted mb-3"></i>
                                                                <h5 class="text-muted">Geen hulpstoffen</h5>
                                                                <p class="text-muted">Dit item bevat geen hulpstoffen.</p>
                                                            </div>
                                                        `}
                                                    </div>
                                                    
                                                    <!-- Samenvatting tab -->
                                                    <div class="tab-pane fade" id="samenvatting-content-${index}" role="tabpanel">
                                                        <div class="row">
                                                            <div class="col-md-6">
                                                                <div class="card border-success">
                                                                    <div class="card-header bg-success text-white">
                                                                        <h6 class="mb-0"><i class="fas fa-tree"></i> Hout Samenvatting</h6>
                                                                    </div>
                                                                    <div class="card-body">
                                                                        <div class="row text-center">
                                                                            <div class="col-6">
                                                                                <div class="h4 text-success mb-0">${item.materialUsage.totaalHoutVolume.toFixed(4)}</div>
                                                                                <small class="text-muted">m³ Volume</small>
                                                                            </div>
                                                                            <div class="col-6">
                                                                                <div class="h4 text-success mb-0">€ ${item.materialUsage.totaalHoutKosten.toFixed(2)}</div>
                                                                                <small class="text-muted">Totale Kosten</small>
                                                                            </div>
                                                                        </div>
                                                                        <hr>
                                                                        <div class="text-center">
                                                                            <small class="text-muted">
                                                                                Gemiddelde prijs: € ${item.materialUsage.totaalHoutVolume > 0 ? (item.materialUsage.totaalHoutKosten / item.materialUsage.totaalHoutVolume).toFixed(2) : '0.00'} per m³
                                                                            </small>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div class="col-md-6">
                                                                <div class="card border-info">
                                                                    <div class="card-header bg-info text-white">
                                                                        <h6 class="mb-0"><i class="fas fa-tools"></i> Hulpstoffen Samenvatting</h6>
                                                                    </div>
                                                                    <div class="card-body">
                                                                        <div class="row text-center">
                                                                            <div class="col-6">
                                                                                <div class="h4 text-info mb-0">${item.materialUsage.hulpstoffen.length}</div>
                                                                                <small class="text-muted">Materialen</small>
                                                                            </div>
                                                                            <div class="col-6">
                                                                                <div class="h4 text-info mb-0">€ ${item.materialUsage.totaalHulpstoffenKosten.toFixed(2)}</div>
                                                                                <small class="text-muted">Totale Kosten</small>
                                                                            </div>
                                                                        </div>
                                                                        <hr>
                                                                        <div class="text-center">
                                                                            <small class="text-muted">
                                                                                Gemiddelde prijs: € ${item.materialUsage.hulpstoffen.length > 0 ? (item.materialUsage.totaalHulpstoffenKosten / item.materialUsage.hulpstoffen.length).toFixed(2) : '0.00'} per materiaal
                                                                            </small>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div class="row mt-3">
                                                            <div class="col-12">
                                                                <div class="card border-primary">
                                                                    <div class="card-header bg-primary text-white">
                                                                        <h6 class="mb-0"><i class="fas fa-chart-pie"></i> Item Totaal</h6>
                                                                    </div>
                                                                    <div class="card-body">
                                                                        <div class="row text-center">
                                                                            <div class="col-3">
                                                                                <div class="h5 text-success mb-0">€ ${item.materialUsage.totaalHoutKosten.toFixed(2)}</div>
                                                                                <small class="text-muted">Hout Kosten</small>
                                                                            </div>
                                                                            <div class="col-3">
                                                                                <div class="h5 text-info mb-0">€ ${item.materialUsage.totaalHulpstoffenKosten.toFixed(2)}</div>
                                                                                <small class="text-muted">Hulpstoffen</small>
                                                                            </div>
                                                                            <div class="col-3">
                                                                                <div class="h5 text-warning mb-0">€ ${(item.materialUsage.totaalHoutKosten + item.materialUsage.totaalHulpstoffenKosten).toFixed(2)}</div>
                                                                                <small class="text-muted">Totaal per Item</small>
                                                                            </div>
                                                                            <div class="col-3">
                                                                                <div class="h4 text-primary mb-0">€ ${((item.materialUsage.totaalHoutKosten + item.materialUsage.totaalHulpstoffenKosten) * item.hoeveelheid).toFixed(2)}</div>
                                                                                <small class="text-muted">Totaal Order</small>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            <i class="fas fa-times"></i> Sluiten
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Verwijder bestaande modal als die er is
        const existingModal = document.getElementById('materialUsageModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Voeg de nieuwe modal toe aan de pagina
        document.body.appendChild(modal);
        
        // Toon de modal
        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();
    }

    // ========================
    // XML IMPORT FUNCTIONALITEIT
    // ========================
    
    // Eenvoudige import (niet-modal)
    importBtn.addEventListener('click', () => {
        const file = xmlImportInput.files[0];
        if (!file) {
            alert('Selecteer eerst een XML bestand.');
            return;
        }
        
        parseFile(file);
    });
    
    // XML file input change handler
    xmlImportInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            // Niet automatisch importeren, laat de gebruiker op de knop klikken
            // Dit geeft de mogelijkheid om eerst opties aan te passen
            dropArea.querySelector('p').textContent = `Bestand geselecteerd: ${e.target.files[0].name}`;
        }
    });

    // Toggle Prepack Divisie zichtbaarheid
    prepackToggle.addEventListener('change', () => {
        prepackDivisionGroup.style.display = prepackToggle.checked ? 'block' : 'none';
    });

    // Functie om een XML bestand te parsen en alle items automatisch toe te voegen
    async function parseOrderXML(xmlString) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");
        
        try {
            // Extract order general information
            const orderNo = getXmlValue(xmlDoc, 'No_'); // Dit is het PVO-nummer
            const customerName = getXmlValue(xmlDoc, 'CustomerName') || getXmlValue(xmlDoc, 'CustAddr_1');
            const startDate = formatDate(getXmlValue(xmlDoc, 'Creation_Date'));
            const dueDate = formatDate(getXmlValue(xmlDoc, 'Starting_Date') || getXmlValue(xmlDoc, 'Due_Date'));
            
            // Fill order details
            document.getElementById('order_nummer').value = orderNo;
            document.getElementById('klant').value = customerName;
            document.getElementById('startdatum').value = startDate;
            document.getElementById('einddatum').value = dueDate;
            
            // Analyzeer alle materialen uit de XML
            analyzeMaterials(xmlDoc);
            
            // Find all production order lines
            const prodOrderLines = xmlDoc.querySelectorAll('DataItem[name="ProdOrderLine"]');
            
            if (prodOrderLines.length === 0) {
                throw new Error('Geen items gevonden in de XML');
            }
            
            console.log(`Total items found in XML: ${prodOrderLines.length}`);
            
            // Multi-item import logic
            const importAllItems = document.getElementById('import-all-items').checked;
            const includeAllMaterials = prepackToggle && prepackToggle.checked;
            
            console.log(`Prepack enabled: ${prepackToggle.checked}, Include all materials: ${includeAllMaterials}`);
            
            // Verzamel alle item-beschrijvingen voor in het beschrijvingsveld
            const allItemDescriptions = Array.from(prodOrderLines).map(line => 
                getNestedXmlValue(line, 'Line_Description').trim()
            );
            
            // Als er meerdere items zijn, gebruik dan een gecombineerde beschrijving
            if (allItemDescriptions.length > 1) {
                document.getElementById('beschrijving').value = 
                    importAllItems ? 
                        `Meerdere items: ${allItemDescriptions.join(', ')}` : 
                        allItemDescriptions[0];
            } else {
                document.getElementById('beschrijving').value = allItemDescriptions[0];
            }
            
            // Bepaal welke items geïmporteerd moeten worden
            const itemsToImport = importAllItems ? 
                Array.from(prodOrderLines) : 
                [prodOrderLines[0]];
            
            console.log(`Items to import: ${itemsToImport.length}, Import all: ${importAllItems}, Prepack: ${prepackToggle.checked}`);
            
            // Reset de items array voordat we nieuwe items importeren
            items = [];
            
            // Voeg alle geselecteerde items direct toe aan de items array
            itemsToImport.forEach(prodOrderLine => {
                // Item gegevens ophalen - ALTIJD het GP nummer gebruiken
                let itemIdentifier = getNestedXmlValue(prodOrderLine, 'Line_Item_No_').trim();
                const variantCode = getNestedXmlValue(prodOrderLine, 'Line_Variant_Code').trim();
                const productDescription = getNestedXmlValue(prodOrderLine, 'Line_Description').trim();
                let prepackCode = '';

                // Log de beschikbare waarden voor debugging
                console.log(`Item data for ${productDescription}:`);
                console.log(`  - Line_Item_No_: "${itemIdentifier}"`);
                console.log(`  - Line_Variant_Code: "${variantCode}"`);
                console.log(`  - Line_Description: "${productDescription}"`);

                // ALTIJD het GP nummer (Line_Item_No_) gebruiken als primaire identifier
                // Alleen als Line_Item_No_ leeg is, dan Line_Variant_Code gebruiken
                if (!itemIdentifier || itemIdentifier === '') {
                    if (variantCode && variantCode !== '') {
                        itemIdentifier = variantCode;
                        console.log(`Using variant code as fallback: ${variantCode}`);
                    } else {
                        console.warn(`No valid item identifier found for: ${productDescription}`);
                    }
                }

                // Extract prepack code from description (between parentheses) for reference only
                const descMatch = productDescription.match(/\(([^)]+)\)$/);
                if (descMatch && descMatch[1]) {
                    prepackCode = descMatch[1];
                    console.log(`Prepack code found: ${prepackCode} for item: ${productDescription}`);
                }
                
                const quantity = parseFloat(getNestedXmlValue(prodOrderLine, 'Line_Quantity')) || 0;
                
                // Bereken totaal houtvolume en -kosten voor dit item
                let totalWoodVolume = 0;
                let stuklijstData = [];
                
                // Verzamel alle componenten van dit item
                const components = prodOrderLine.querySelectorAll('DataItem[name="Component"]');
                
                // Verwerk alle componenten
                components.forEach(component => {
                    const itemNo = getNestedXmlValue(component, 'Component_Item_No_');
                    const description = getNestedXmlValue(component, 'Component_Description');
                    const thickness = parseFloat(getNestedXmlValue(component, 'Component_Thickness')) || 0;
                    const width = parseFloat(getNestedXmlValue(component, 'Component_Width')) || 0;
                    const length = parseFloat(getNestedXmlValue(component, 'Component_Length')) || 0;
                    const units = parseFloat(getNestedXmlValue(component, 'Component_Unit')) || 0;
                    
                    // Wanneer Prepack is geactiveerd willen we ook componenten zonder afmetingen tonen.
                    if (!includeAllMaterials && (thickness === 0 || width === 0 || length === 0)) {
                        return;
                    }
                    
                    // Extract only first 3 characters for wood type
                    const houtsoort = description.substring(0, 3);
                    
                    // Voeg de component toe aan de stuklijst
                    stuklijstData.push({
                        houtsoort: houtsoort,
                        dikte: thickness,
                        breedte: width,
                        lengte: length,
                        aantal: units,
                        materiaal_code: itemNo,
                        description: description,
                        afgewerkt: false
                    });
                    
                    // Calculate volume in cubic meters
                    const volumeM3 = (thickness / 1000) * (width / 1000) * (length / 1000) * units;
                    totalWoodVolume += volumeM3;
                });
                
                // Calculate total wood volume for all units
                const totalOrderVolume = totalWoodVolume * quantity;
                
                // Calculate wood cost based on current wood price per m³
                const woodCost = totalOrderVolume * woodPricePerM3;
                
                // Maak een nieuw item object
                const item = {
                    item_naam: itemIdentifier,
                    hoeveelheid: quantity,
                    verkoopprijs: 0, // Default waarde
                    hout_kost: woodCost,
                    hulpstoffen: 0, // Default waarde
                    stuklijst: stuklijstData,
                    is_new: !databaseItems[itemIdentifier], // Gebruik GP nummer in plaats van description
                    wood_m3: totalOrderVolume,
                    prepack_code: prepackCode,
                    description: productDescription // Bewaar de beschrijving voor weergave
                };
                
                // Voeg het item toe aan de items array
                items.push(item);
            });
            
            // Bereken kosten op basis van opgeslagen materiaalprijzen
            recalculateMaterialCosts();
            
            // Bereken ook het materiaalverbruik per item
            calculateMaterialUsagePerItem();
            
            // Update de items tabel en bereken de totalen
            updateItemsTable();
            calculateTotals();
            
            // BELANGRIJKE STAP: Update automatisch de item_prices tabel met de berekende kosten
            // Dit zorgt ervoor dat de kosten direct beschikbaar zijn op de analyze_prepack pagina
            setTimeout(async () => {
                const result = await updateItemPricesWithCalculatedCosts(items);
                if (result.success && result.updated > 0) {
                    console.log(`✅ ${result.updated} items automatisch bijgewerkt in item_prices tabel`);
                }
            }, 1000); // Kleine vertraging om zeker te zijn dat recalculateMaterialCosts klaar is
            
            console.log(`Final items array length: ${items.length} items`);
            
            // Toon een bericht over hoeveel items zijn geïmporteerd
            alert(`XML bestand succesvol geïmporteerd. ${items.length} items zijn toegevoegd aan de order. 
Pas de prijzen aan in het Materialen en Prijzen paneel en klik op "Prijzen Toepassen".`);
            
        } catch (error) {
            console.error('Error parsing XML:', error);
            alert('Er is een fout opgetreden bij het importeren van het XML bestand: ' + error.message);
        }
    }

    // ========================
    // BESTAANDE FUNCTIONALITEIT
    // ========================
    
    // Load existing items from database
    function loadExistingItems() {
        fetch('/api/items')
            .then(response => response.json())
            .then(data => {
                databaseItems = data.reduce((acc, item) => {
                    if (item.stuklijst && typeof item.stuklijst === 'string') {
                        try {
                            item.stuklijst = JSON.parse(item.stuklijst);
                        } catch (e) {
                            console.error('Error parsing stuklijst for item:', item.naam, e);
                            item.stuklijst = [];
                        }
                    }

                    // Als je bestaande stuklijsten ook van een "afgewerkt" veld wilt voorzien:
                    if (Array.isArray(item.stuklijst)) {
                        item.stuklijst.forEach(line => {
                            // Als "afgewerkt" ontbreekt, zet het op false
                            if (typeof line.afgewerkt === 'undefined') {
                                line.afgewerkt = false;
                            }
                        });
                    }

                    acc[item.naam] = item;
                    return acc;
                }, {});
                
                // Populate datalist
                itemsList.innerHTML = Object.keys(databaseItems)
                    .map(naam => `<option value="${naam}">`)
                    .join('');
            })
            .catch(error => {
                console.error('Error loading items:', error);
                alert('Er is een fout opgetreden bij het laden van de items.');
            });
    }

    // NIEUWE FUNCTIE om item_prices te updaten
    async function updateItemPricesWithCalculatedCosts(orderItems) {
        const itemsToUpdate = [];
        
        // Update alle items met materiaalkosten, niet alleen prepack items
        for (const item of orderItems) {
            if (item.item_naam && item.item_naam.trim() !== '') {
                const itemData = {
                    item_number: item.item_naam.trim(), 
                    houtkosten: parseFloat(item.hout_kost || 0), 
                    materiaalkosten: parseFloat(item.hulpstoffen || 0)
                };
                
                // Alleen toevoegen als er daadwerkelijk kosten zijn
                if (itemData.houtkosten > 0 || itemData.materiaalkosten > 0) {
                    itemsToUpdate.push(itemData);
                    console.log(`Item ${itemData.item_number} toegevoegd voor update: hout=${itemData.houtkosten}, materiaal=${itemData.materiaalkosten}`);
                }
            }
        }

        if (itemsToUpdate.length > 0) {
            try {
                console.log('Attempting to update item_prices with calculated costs:', JSON.stringify(itemsToUpdate, null, 2));
                const response = await fetch('/api/item_prices/upsert_costs', { 
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ items: itemsToUpdate })
                });

                if (!response.ok) {
                    const errorData = await response.text();
                    console.error('API Error when updating item_prices:', response.status, errorData);
                    throw new Error(`API Fout ${response.status} bij updaten item_prices: ${errorData}`);
                }
                
                const result = await response.json();
                console.log('Successfully updated item_prices:', result);
                return { success: true, updated: itemsToUpdate.length };
            } catch (error) {
                console.error('Error updating item_prices:', error.message);
                return { success: false, error: error.message };
            }
        } else {
            console.log('No items with calculated costs found to update in item_prices.');
            return { success: true, updated: 0 };
        }
    }

    // Wanneer men een bestaande itemnaam kiest, vullen we de velden + stuklijst
    itemNaamInput.addEventListener('change', () => {
        const selectedItem = databaseItems[itemNaamInput.value];
        if (selectedItem) {
            document.getElementById('verkoopprijs').value = selectedItem.verkoopprijs || 0;
            document.getElementById('hout_kost').value = selectedItem.hout_kost || 0;
            document.getElementById('hulpstoffen').value = selectedItem.hulpstoffen || 0;

            // Clear current stuklijst table
            stuklijstTableBody.innerHTML = '';

            // If the existing item has a stuklijst, populate it
            if (Array.isArray(selectedItem.stuklijst)) {
                selectedItem.stuklijst.forEach(line => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td><input type="text" class="form-control houtsoort-input" value="${line.houtsoort || ''}"></td>
                        <td><input type="number" class="form-control dikte-input" value="${line.dikte || ''}"></td>
                        <td><input type="number" class="form-control breedte-input" value="${line.breedte || ''}"></td>
                        <td><input type="number" class="form-control lengte-input" value="${line.lengte || ''}"></td>
                        <td><input type="number" class="form-control aantal-input" value="${line.aantal || ''}" min="1"></td>
                        <td><button type="button" class="btn btn-danger remove-stuklijst-row-btn">Verwijderen</button></td>
                    `;
                    stuklijstTableBody.appendChild(row);
                });
            }
        }
    });

    // Toevoegen van nieuwe rijen in de stuklijst
    addStuklijstRowBtn.addEventListener('click', () => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="text" class="form-control houtsoort-input" placeholder="Houtsoort"></td>
            <td><input type="number" class="form-control dikte-input" placeholder="Dikte"></td>
            <td><input type="number" class="form-control breedte-input" placeholder="Breedte"></td>
            <td><input type="number" class="form-control lengte-input" placeholder="Lengte"></td>
            <td><input type="number" class="form-control aantal-input" placeholder="Aantal" min="1"></td>
            <td><button type="button" class="btn btn-danger remove-stuklijst-row-btn">Verwijderen</button></td>
        `;
        stuklijstTableBody.appendChild(row);
    });

    stuklijstTableBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-stuklijst-row-btn')) {
            e.target.closest('tr').remove();
        }
    });

    function calculateTotals() {
        let totaalVerkoop = 0;
        let totaalKost = 0;

        items.forEach(item => {
            // Deze berekening is correct: verkoop per stuk × aantal stuks
            const verkoopTotaal = item.hoeveelheid * item.verkoopprijs;
            
            // Correcte berekening: houtkosten bevatten al het aantal
            const kostTotaal = item.hout_kost + item.hulpstoffen;
            
            totaalVerkoop += verkoopTotaal;
            totaalKost += kostTotaal;
        });

        const totaalMarge = totaalVerkoop - totaalKost;

        document.getElementById('totaal-verkoop').textContent = `€ ${totaalVerkoop.toFixed(2)}`;
        document.getElementById('totaal-kost').textContent = `€ ${totaalKost.toFixed(2)}`;
        document.getElementById('totaal-marge').textContent = `€ ${totaalMarge.toFixed(2)}`;
    }

    addItemBtn.addEventListener('click', () => {
        const itemNaam = document.getElementById('item_naam').value.trim();
        const hoeveelheid = parseInt(document.getElementById('hoeveelheid').value);
        const verkoopprijs = parseFloat(document.getElementById('verkoopprijs').value);
        const hout_kost = parseFloat(document.getElementById('hout_kost').value);
        const hulpstoffen = parseFloat(document.getElementById('hulpstoffen').value);

        // Lees stuklijst per item
        const stuklijstRijen = stuklijstTableBody.querySelectorAll('tr');
        let stuklijstData = [];
        let totalVolumeM3 = 0; // Voor de berekening in m³

        stuklijstRijen.forEach(tr => {
            const houtsoort = tr.querySelector('.houtsoort-input').value.trim();
            const dikte = parseFloat(tr.querySelector('.dikte-input').value);
            const breedte = parseFloat(tr.querySelector('.breedte-input').value);
            const lengte = parseFloat(tr.querySelector('.lengte-input').value);
            const aantal = parseInt(tr.querySelector('.aantal-input').value);
            
            // Alleen geldige regels meenemen
            if (
                houtsoort && 
                !isNaN(dikte) && 
                !isNaN(breedte) && 
                !isNaN(lengte) && 
                !isNaN(aantal) && 
                aantal > 0
            ) {
                stuklijstData.push({ 
                    houtsoort, 
                    dikte, 
                    breedte, 
                    lengte, 
                    aantal, 
                    materiaal_code: '',
                    description: '',
                    afgewerkt: false
                });

                // Bereken m³ (per stuklijst-regel)
                // dikte, breedte, lengte zijn in mm => omrekenen naar meter
                const volumePerStuk = (dikte / 1000) * (breedte / 1000) * (lengte / 1000) * aantal;
                totalVolumeM3 += volumePerStuk;
            }
        });

        if (
            itemNaam && 
            hoeveelheid > 0 &&
            !isNaN(verkoopprijs) && 
            !isNaN(hout_kost) && 
            !isNaN(hulpstoffen)
        ) {
            // Het totale volume voor dit item is volume per stuklijst × aantal items
            totalVolumeM3 = totalVolumeM3 * hoeveelheid;

            const item = {
                item_naam: itemNaam,
                hoeveelheid,
                verkoopprijs,
                hout_kost,
                hulpstoffen,
                stuklijst: stuklijstData,
                is_new: !databaseItems[itemNaam],
                wood_m3: totalVolumeM3 
            };
            
            items.push(item);
            updateItemsTable();
            calculateTotals();
            
            // Reset form fields voor volgend item
            document.getElementById('item_naam').value = '';
            document.getElementById('hoeveelheid').value = '';
            document.getElementById('verkoopprijs').value = '';
            document.getElementById('hout_kost').value = '';
            document.getElementById('hulpstoffen').value = '';
            stuklijstTableBody.innerHTML = '';
        } else {
            alert('Vul alstublieft alle velden correct in.');
        }
    });

    function updateItemsTable() {
        itemsTableBody.innerHTML = '';
        items.forEach((item, index) => {
            const verkoopTotaal = item.hoeveelheid * item.verkoopprijs;
            
            // Correctie: Kostprijs in tabel bevat al hoeveelheid, dus niet nogmaals vermenigvuldigen
            const kostTotaal = item.hout_kost + item.hulpstoffen;
            
            const marge = verkoopTotaal - kostTotaal;
            const margePercentage = verkoopTotaal === 0 ? 0 : ((marge / verkoopTotaal) * 100).toFixed(1);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <strong>${item.item_naam}</strong>
                    ${item.description ? `<br><small class="text-muted">${item.description}</small>` : ''}
                    ${item.is_new ? '<span class="badge bg-info ms-1">Nieuw</span>' : ''}
                </td>
                <td>${item.hoeveelheid}</td>
                <td class="editable-cell" data-index="${index}" data-field="verkoopprijs">€ ${item.verkoopprijs.toFixed(2)}</td>
                <td>€ ${item.hout_kost.toFixed(2)}</td>
                <td class="editable-cell" data-index="${index}" data-field="hulpstoffen">€ ${item.hulpstoffen.toFixed(2)}</td>
                <td>€ ${verkoopTotaal.toFixed(2)}</td>
                <td>€ ${kostTotaal.toFixed(2)}</td>
                <td class="${marge >= 0 ? 'text-success' : 'text-danger'}">
                    € ${marge.toFixed(2)} (${margePercentage}%)
                </td>
                <td>
                    <button type="button" class="btn btn-danger btn-sm remove-item-btn" data-index="${index}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            `;
            itemsTableBody.appendChild(row);
        });
        
        // Add click event to editable cells
        document.querySelectorAll('.editable-cell').forEach(cell => {
            cell.style.cursor = 'pointer';
            cell.addEventListener('click', editCell);
        });
    }
    
    // Function to handle cell editing
    function editCell(e) {
        const cell = e.target;
        const index = parseInt(cell.dataset.index);
        const field = cell.dataset.field;
        const currentValue = items[index][field];
        
        // Create input element
        const input = document.createElement('input');
        input.type = 'number';
        input.step = '0.01';
        input.min = '0';
        input.value = currentValue;
        input.className = 'form-control form-control-sm';
        input.style.width = '80px';
        
        // Replace cell content with input
        cell.innerHTML = '';
        cell.appendChild(input);
        input.focus();
        
        // Select all text
        input.select();
        
        // Handle input blur (finished editing)
        input.addEventListener('blur', function() {
            const newValue = parseFloat(this.value) || 0;
            items[index][field] = newValue;
            
            // Update the table
            updateItemsTable();
            calculateTotals();
        });
        
        // Handle enter key
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                this.blur();
            }
        });
        
        // Prevent click event from bubbling (which would create another input)
        input.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }

    itemsTableBody.addEventListener('click', (event) => {
        const target = event.target.closest('.remove-item-btn');
        if (target) {
            const index = parseInt(target.getAttribute('data-index'));
            items.splice(index, 1);
            updateItemsTable();
            calculateTotals();
        }
    });

    // Helper functie voor directe import
    function getXmlValue(xmlDoc, columnName) {
        const element = xmlDoc.querySelector(`Column[name="${columnName}"]`);
        return element ? element.textContent : '';
    }
    
    // Helper functie voor directe import
    function getNestedXmlValue(parentElement, columnName) {
        const element = parentElement.querySelector(`Column[name="${columnName}"]`);
        return element ? element.textContent : '';
    }
    
    // Format date from "DD/MM/YYYY 0:00:00" to "YYYY-MM-DD"
    function formatDate(dateString) {
        if (!dateString) return '';
        
        const parts = dateString.split(' ')[0].split('/');
        if (parts.length !== 3) return '';
        
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    // Bij submmit maken we de `orderData` en sturen die naar /api/orders
    orderForm.addEventListener('submit', (event) => {
        event.preventDefault();
        
        const orderData = {
            order_nummer: document.getElementById('order_nummer').value.trim(),
            klant: document.getElementById('klant').value.trim(),
            beschrijving: document.getElementById('beschrijving').value.trim(),
            startdatum: document.getElementById('startdatum').value,
            einddatum: document.getElementById('einddatum').value,
            prepack: prepackToggle.checked, // Add the prepack boolean value
            prepack_division: prepackToggle.checked ? prepackDivisionSelect.value : null,
            items: items.map(item => ({
                item_naam: item.item_naam,
                hoeveelheid: item.hoeveelheid,
                verkoopprijs: item.verkoopprijs,
                hout_kost: item.hout_kost,
                hulpstoffen: item.hulpstoffen,
                stuklijst: item.stuklijst,
                is_new: item.is_new,
                wood_m3: item.wood_m3,
                prepack_code: item.prepack_code
            }))
        };

        if (
            orderData.order_nummer && 
            orderData.klant && 
            orderData.startdatum && 
            orderData.einddatum && 
            items.length > 0
        ) {
            fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                alert('Order succesvol toegevoegd!');
                orderForm.reset();
                items = [];
                updateItemsTable();
                calculateTotals();
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Er is een fout opgetreden bij het opslaan van de order: ' + error.message);
            });
        } else {
            alert('Vul alle verplichte velden in en voeg ten minste één item toe.');
        }
    });

    // Laad bestaande items + stuklijsten
    loadExistingItems();

    // Event listener voor materiaalverbruik per item knop
    document.getElementById('show-material-usage-btn').addEventListener('click', () => {
        if (items.length === 0) {
            alert('Er zijn geen items om materiaalverbruik voor te tonen. Importeer eerst een order.');
            return;
        }
        showMaterialUsagePerItem();
    });

    // Functie om zaaglijst af te drukken
    printZaaglijstBtn.addEventListener('click', printZaaglijst);
    
    function printZaaglijst() {
        // Alleen doorgaan als er items zijn om af te drukken
        if (items.length === 0) {
            alert('Er zijn geen items om af te drukken. Importeer eerst een order.');
            return;
        }
        
        // Verzamel alle houtstukken uit alle items
        let houtItems = [];
        let orderInfo = {
            orderNummer: document.getElementById('order_nummer').value.trim(),
            klant: document.getElementById('klant').value.trim(),
            beschrijving: document.getElementById('beschrijving').value.trim(),
            datum: new Date().toLocaleDateString('nl-NL')
        };
        
        // Loop door alle items en hun stuklijsten
        items.forEach(item => {
            // Filter stuklijst items op hout voor afkortzaag
            const houtStukken = item.stuklijst.filter(stuk => {
                // Check of het een houtstuk is (houtsoort begint met NHV, HON, of is 1HOUT)
                const isHout = stuk.houtsoort?.startsWith('NHV') || 
                               stuk.houtsoort?.startsWith('HON') || 
                               stuk.description?.startsWith('NHV') || 
                               stuk.description?.startsWith('HON');
                
                // Check of het plaatmateriaal is (dat niet voor de afkortzaag is)
                const isPlaat = stuk.description?.startsWith('HBO') || 
                                stuk.description?.startsWith('MEP') || 
                                stuk.description?.startsWith('OSB');
                
                // Retourneer alleen houtstukken, geen plaatmateriaal
                return isHout && !isPlaat && stuk.dikte > 0 && stuk.breedte > 0 && stuk.lengte > 0;
            });
            
            // Houd bij voor welk item deze stukken zijn
            houtStukken.forEach(stuk => {
                houtItems.push({
                    ...stuk,
                    voor_item: item.item_naam,
                    hoeveelheid_item: item.hoeveelheid,
                    totaal_aantal: stuk.aantal * item.hoeveelheid // Totaal aantal = aantal per item * aantal items
                });
            });
        });
        
        // Sorteer op houtsoort, dan dikte, dan breedte, dan lengte
        houtItems.sort((a, b) => {
            // Sorteer eerst op houtsoort
            const houtsoortA = a.houtsoort || a.description?.substring(0, 3) || '';
            const houtsoortB = b.houtsoort || b.description?.substring(0, 3) || '';
            
            if (houtsoortA !== houtsoortB) {
                return houtsoortA.localeCompare(houtsoortB);
            }
            
            // Dan op dikte
            if (a.dikte !== b.dikte) {
                return a.dikte - b.dikte;
            }
            
            // Dan op breedte
            if (a.breedte !== b.breedte) {
                return a.breedte - b.breedte;
            }
            
            // Ten slotte op lengte
            return a.lengte - b.lengte;
        });
        
        // Combineer identieke houtstukken (zelfde houtsoort, dikte, breedte, lengte)
        let gecombineerdeItems = [];
        houtItems.forEach(item => {
            const bestaandItem = gecombineerdeItems.find(i => 
                (i.houtsoort === item.houtsoort || 
                 (i.description?.substring(0, 3) === item.description?.substring(0, 3))) &&
                i.dikte === item.dikte && 
                i.breedte === item.breedte && 
                i.lengte === item.lengte
            );
            
            if (bestaandItem) {
                // Voeg aantal toe aan bestaand item
                bestaandItem.totaal_aantal += item.totaal_aantal;
                
                // Voeg item reference toe als dat een ander item is
                if (!bestaandItem.voor_items.includes(item.voor_item)) {
                    bestaandItem.voor_items.push(item.voor_item);
                }
            } else {
                // Maak nieuw gecombineerd item
                gecombineerdeItems.push({
                    ...item,
                    voor_items: [item.voor_item]
                });
            }
        });
        
        // Bereken totaal volume
        const totaalVolume = gecombineerdeItems.reduce((sum, item) => {
            const volumeM3 = (item.dikte / 1000) * (item.breedte / 1000) * (item.lengte / 1000) * item.totaal_aantal;
            return sum + volumeM3;
        }, 0);
        
        // Genereer HTML voor de print pagina
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Zaaglijst - ${orderInfo.orderNummer}</title>
                <meta charset="utf-8">
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 0;
                        padding: 10px;
                        font-size: 11px;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        border-bottom: 1px solid #000;
                        padding-bottom: 5px;
                        margin-bottom: 10px;
                    }
                    .title {
                        font-size: 16px;
                        font-weight: bold;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    th, td {
                        border: 1px solid #ddd;
                        padding: 4px;
                        text-align: left;
                    }
                    th {
                        background-color: #f2f2f2;
                    }
                    .footer {
                        margin-top: 10px;
                        border-top: 1px solid #000;
                        padding-top: 5px;
                        display: flex;
                        justify-content: space-between;
                    }
                    .volume-summary {
                        font-weight: bold;
                    }
                    .no-print {
                        margin-top: 20px;
                    }
                    @media print {
                        .no-print {
                            display: none;
                        }
                        body {
                            padding: 0;
                        }
                        button {
                            display: none;
                        }
                    }
                    .material-header {
                        font-weight: bold;
                        background-color: #eee;
                        padding: 4px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <div class="title">Zaaglijst Afkortzaag</div>
                        <div>Order: ${orderInfo.orderNummer}</div>
                    </div>
                    <div>
                        <div>Datum: ${orderInfo.datum}</div>
                    </div>
                </div>
        `);

        // Direct naar tabel gaan, zonder extra informatie
        printWindow.document.write(`
                <table>
                    <thead>
                        <tr>
                            <th>Houts.</th>
                            <th>D</th>
                            <th>B</th>
                            <th>L</th>
                            <th>Aantal</th>
                        </tr>
                    </thead>
                    <tbody>
        `);
        
        // Groepeer per houtsoort voor betere leesbaarheid
        const houtsoortGroepen = {};
        gecombineerdeItems.forEach(item => {
            const houtsoort = item.houtsoort || item.description?.substring(0, 3) || 'Onbekend';
            if (!houtsoortGroepen[houtsoort]) {
                houtsoortGroepen[houtsoort] = [];
            }
            houtsoortGroepen[houtsoort].push(item);
        });
        
        // Voeg elke houtsoortgroep toe
        Object.keys(houtsoortGroepen).sort().forEach(houtsoort => {
            // Voeg een header toe voor elke houtsoort
            printWindow.document.write(`
                <tr>
                    <td colspan="5" class="material-header">${houtsoort}</td>
                </tr>
            `);
            
            // Voeg alle items van deze houtsoort toe, zonder referenties naar items
            houtsoortGroepen[houtsoort].forEach(item => {
                printWindow.document.write(`
                    <tr>
                        <td>${item.houtsoort || item.description?.substring(0, 3) || ''}</td>
                        <td>${item.dikte}</td>
                        <td>${item.breedte}</td>
                        <td>${item.lengte}</td>
                        <td>${item.totaal_aantal}</td>
                    </tr>
                `);
            });
        });
        
        // Voltooi de HTML-pagina
        printWindow.document.write(`
                    </tbody>
                </table>
                
                <div class="footer">
                    <div>Stuks: ${gecombineerdeItems.reduce((sum, item) => sum + item.totaal_aantal, 0)}</div>
                    <div class="volume-summary">Volume: ${totaalVolume.toFixed(4)} m³</div>
                </div>
                
                <div class="no-print">
                    <button onclick="window.print()">Afdrukken</button>
                    <button onclick="window.close()">Sluiten</button>
                </div>
            </body>
            </html>
        `);
        
        printWindow.document.close();
    }
});