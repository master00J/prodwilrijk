// Interventies pagina JavaScript
document.addEventListener('DOMContentLoaded', function() {
    const API = {
      // Toestellen API calls
      getToestellen: async () => {
        console.log('API.getToestellen called');
        const response = await fetch('/api/toestellen');
        
        // Log response status
        console.log('API.getToestellen status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API error ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('API.getToestellen data:', data);
        
        // Zorg ervoor dat we altijd een array teruggeven
        return Array.isArray(data) ? data : [];
      },
      getToestelById: (id) => fetch(`/api/toestellen/${id}`).then(res => res.json()),
      createToestel: (data) => fetch('/api/toestellen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(res => res.json()),
      updateToestel: (id, data) => fetch(`/api/toestellen/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(res => res.json()),
      deleteToestel: (id) => fetch(`/api/toestellen/${id}`, {
        method: 'DELETE'
      }).then(res => res.json()),
      
      // Interventies API calls
      getInterventiesByToestel: (toestelId) => fetch(`/api/toestellen/${toestelId}/interventies`).then(res => res.json()),
      getInterventieById: (id) => fetch(`/api/interventies/${id}`).then(res => res.json()),
      createInterventie: (data) => fetch('/api/interventies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(res => res.json()),
      updateInterventie: (id, data) => fetch(`/api/interventies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(res => res.json()),
      deleteInterventie: (id) => fetch(`/api/interventies/${id}`, {
        method: 'DELETE'
      }).then(res => res.json()),
      
      // Statistieken API call
      getToestelStatistics: (id) => fetch(`/api/toestellen/${id}/statistics`).then(res => res.json()),
      
      // Rapportage API call
      getRapportageData: async (filters = {}) => {
        console.log("API.getRapportageData aangeroepen met filters:", filters);
        
        const queryParams = new URLSearchParams();
        
        // Voeg filters toe aan query parameters
        if (filters.jaar) {
          console.log("Jaarfilter toegevoegd:", filters.jaar);
          queryParams.append('jaar', filters.jaar);
        }
        if (filters.locatie) queryParams.append('locatie', filters.locatie);
        if (filters.merk) queryParams.append('merk', filters.merk);
        
        const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
        console.log("Volledige query string:", `/api/rapportage${queryString}`);
        
        const response = await fetch(`/api/rapportage${queryString}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API error ${response.status}: ${errorText}`);
        }
        
        return await response.json();
      }
    };
  
    // State voor applicatie
    const AppState = {
      selectedToestel: null,
      allToestellen: [], // Voeg dit toe om alle toestellen in geheugen te houden
      filteredToestellen: [], // Voeg dit toe voor de gefilterde toestellen
      locaties: new Set(), // Voeg dit toe voor unieke locaties
      merken: new Set(), // Voeg dit toe voor unieke merken
      jaren: new Set(), // Voeg dit toe voor unieke jaren in rapportage
      rapportageData: null // Opslag voor rapportage data
    };
  
    const UI = {
      elements: {
        toestellenList: document.getElementById('toestellen-list'),
        toestelDetail: document.getElementById('toestel-detail'),
        interventiesList: document.getElementById('interventies-list'),
        toestelForm: document.getElementById('toestel-form'),
        interventieForm: document.getElementById('interventie-form'),
        backButton: document.getElementById('back-button'),
        nieuwToestelBtn: document.getElementById('nieuw-toestel-btn'),
        nieuwInterventieBtn: document.getElementById('nieuw-interventie-btn'),
        toestelStats: document.getElementById('toestel-stats'),
        searchInput: document.getElementById('search-toestellen'),
        filterLocatie: document.getElementById('filter-locatie'),
        filterMerk: document.getElementById('filter-merk'),
        
        // Rapportage elementen
        rapportSection: document.getElementById('rapportage-section'),
        backToListFromRapportBtn: document.getElementById('back-to-list-from-rapport-btn'),
        exportRapportBtn: document.getElementById('export-rapport-btn'),
        totalDevicesCount: document.getElementById('total-devices-count'),
        totalCosts: document.getElementById('total-costs'),
        averageCosts: document.getElementById('average-costs'),
        totalInterventions: document.getElementById('total-interventions'),
        costsPerDeviceChart: document.getElementById('costs-per-device-chart'),
        costsPerMonthChart: document.getElementById('costs-per-month-chart'),
        filterJaar: document.getElementById('report-jaar'),
        filterRapportLocatie: document.getElementById('report-locatie'),
        filterRapportMerk: document.getElementById('report-merk'),
        applyFiltersBtn: document.getElementById('apply-filters-btn'),
        rapportToestellenTabel: document.getElementById('rapport-toestellen-tabel')
      },
      
      init() {
        this.bindEvents();
        this.loadToestellen();
        this.showSection('toestellen-section');
        
        // Laad Apexcharts library voor grafieken
        this.loadApexChartsLibrary();
      },
      
      // Hulpfunctie om ApexCharts library te laden
      loadApexChartsLibrary() {
        if (!document.getElementById('apexcharts-script')) {
          const script = document.createElement('script');
          script.id = 'apexcharts-script';
          script.src = 'https://cdn.jsdelivr.net/npm/apexcharts';
          script.onload = () => {
            console.log('ApexCharts library loaded');
          };
          document.head.appendChild(script);
          
          // Laad ook de CSS
          if (!document.getElementById('apexcharts-css')) {
            const link = document.createElement('link');
            link.id = 'apexcharts-css';
            link.rel = 'stylesheet';
            link.href = 'https://cdn.jsdelivr.net/npm/apexcharts/dist/apexcharts.css';
            document.head.appendChild(link);
          }
        }
      },
      
      bindEvents() {
        // Toevoegen nieuw toestel
        this.elements.nieuwToestelBtn.addEventListener('click', () => {
          this.elements.toestelForm.reset();
          this.elements.toestelForm.dataset.mode = 'create';
          this.showSection('toestel-form-section');
        });
        
        // Toestel formulier submit
        this.elements.toestelForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.saveToestel();
        });
        
        // Nieuw interventie
        this.elements.nieuwInterventieBtn?.addEventListener('click', () => {
          if (!AppState.selectedToestel) return;
          
          this.elements.interventieForm.reset();
          this.elements.interventieForm.dataset.mode = 'create';
          this.showSection('interventie-form-section');
        });
        
        // Interventie formulier submit
        this.elements.interventieForm?.addEventListener('submit', (e) => {
          e.preventDefault();
          this.saveInterventie();
        });
        
        // Terug knop
        this.elements.backButton?.addEventListener('click', () => {
          this.showSection('toestellen-section');
          AppState.selectedToestel = null;
        });
        
        // Terug knop op toestel formulier
        document.getElementById('back-to-list-btn')?.addEventListener('click', (e) => {
          e.preventDefault();
          if (AppState.selectedToestel) {
            this.viewToestelDetail(AppState.selectedToestel);
          } else {
            this.showSection('toestellen-section');
          }
        });
        
        // Terug knop op interventie formulier
        document.getElementById('back-to-detail-btn')?.addEventListener('click', (e) => {
          e.preventDefault();
          this.viewToestelDetail(AppState.selectedToestel);
        });
        
        // Zoek en filter events
        this.elements.searchInput?.addEventListener('input', () => {
          this.applyFilters();
        });
        
        this.elements.filterLocatie?.addEventListener('change', () => {
          this.applyFilters();
        });
        
        this.elements.filterMerk?.addEventListener('change', () => {
          this.applyFilters();
        });
        
        // Cancel toestel formulier
        document.getElementById('cancel-toestel-btn')?.addEventListener('click', () => {
          if (AppState.selectedToestel) {
            this.viewToestelDetail(AppState.selectedToestel);
          } else {
            this.showSection('toestellen-section');
          }
        });
        
        // Cancel interventie formulier
        document.getElementById('cancel-interventie-btn')?.addEventListener('click', () => {
          this.viewToestelDetail(AppState.selectedToestel);
        });
        
        // Rapportage gerelateerde events
        
        // Voeg knop toe aan de hoofdpagina voor toegang tot rapportage
        const rapportageBtn = document.createElement('button');
        rapportageBtn.className = 'px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-md transition ml-2';
        rapportageBtn.innerHTML = '<i class="fas fa-chart-bar mr-1"></i> Rapportage';
        rapportageBtn.addEventListener('click', () => {
          this.openRapportage();
        });
        
        // Voeg de knop toe aan de hoofdpagina naast de 'Nieuw Toestel' knop
        if (this.elements.nieuwToestelBtn && this.elements.nieuwToestelBtn.parentNode) {
          this.elements.nieuwToestelBtn.parentNode.appendChild(rapportageBtn);
        }
        
        // Terug knop op rapportage
        this.elements.backToListFromRapportBtn?.addEventListener('click', () => {
          this.showSection('toestellen-section');
        });
        
        // Export knop
        this.elements.exportRapportBtn?.addEventListener('click', () => {
          this.exportRapportage();
        });
        
        // Filters toepassen
        this.elements.applyFiltersBtn?.addEventListener('click', () => {
          this.loadRapportageData();
        });
      },
      
      showSection(sectionId) {
        document.querySelectorAll('section').forEach(section => {
          section.classList.remove('active');
        });
        document.getElementById(sectionId).classList.add('active');
        
        // Controleer alleen voor de zichtbaarheid van nieuw-toestel en nieuw-interventie knoppen
        if (sectionId === 'toestellen-section') {
          this.elements.nieuwToestelBtn.classList.remove('hidden');
          this.elements.nieuwInterventieBtn?.classList.add('hidden');
        } else {
          this.elements.nieuwToestelBtn.classList.add('hidden');
          
          if (sectionId === 'toestel-detail-section') {
            this.elements.nieuwInterventieBtn?.classList.remove('hidden');
          } else {
            this.elements.nieuwInterventieBtn?.classList.add('hidden');
          }
        }
      },
      
      async loadToestellen() {
        try {
          console.log('Loading toestellen via API object...');
          const toestellen = await API.getToestellen();
          console.log('Received toestellen array:', toestellen.length);
          
          // Sla alle toestellen op in de AppState
          AppState.allToestellen = toestellen;
          AppState.filteredToestellen = [...toestellen];
          
          // Verzamel unieke locaties en merken voor filters
          this.collectUniqueFilters(toestellen);
          
          // Vul de filter dropdowns in
          this.populateFilterDropdowns();
          
          // Render de toestellen lijst
          this.renderToestellenList(toestellen);
        } catch (error) {
          console.error('Fout bij laden toestellen:', error);
          // Toon een nuttige foutmelding aan de gebruiker
          if (this.elements.toestellenList) {
            this.elements.toestellenList.innerHTML = `
              <div class="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
                <h3 class="font-bold mb-2">Fout bij laden toestellen</h3>
                <p>${error.message}</p>
                <button id="retry-load-toestellen" class="mt-2 px-3 py-1 bg-red-600 text-white rounded-md">
                  Opnieuw proberen
                </button>
              </div>
            `;
            
            // Voeg een retry knop toe
            document.getElementById('retry-load-toestellen')?.addEventListener('click', () => {
              this.loadToestellen();
            });
          }
          
          Notifications.show('error', 'Fout bij het ophalen van toestellen');
        }
      },
      
      // Nieuwe methode voor het renderen van de toestellen lijst
      renderToestellenList(toestellen) {
        if (this.elements.toestellenList) {
          if (toestellen.length === 0) {
            this.elements.toestellenList.innerHTML = '<div class="text-center p-4 bg-gray-50 rounded-lg">Geen toestellen gevonden. Voeg een nieuw toestel toe of pas uw zoekfilters aan.</div>';
            return;
          }
          
          this.elements.toestellenList.innerHTML = toestellen.map(toestel => `
            <div class="bg-white p-4 rounded-lg shadow-md mb-3 cursor-pointer hover:bg-gray-50 transition" 
                 data-toestel-id="${toestel.id}">
              <div class="flex justify-between items-start">
                <h3 class="text-lg font-semibold">${toestel.beschrijving}</h3>
                <span class="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">${toestel.merk || ''} ${toestel.type || ''}</span>
              </div>
              <div class="mt-2 text-sm text-gray-600">
                <p>Intern nummer: ${toestel.intern_nummer || 'Niet gespecificeerd'}</p>
                <p>Serienummer: ${toestel.serienummer || 'Niet gespecificeerd'}</p>
                <p>Locatie: ${toestel.locatie || 'Niet gespecificeerd'}</p>
              </div>
              <div class="mt-2 flex justify-end space-x-2">
                <button class="view-toestel-btn px-3 py-1 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition">
                  Details bekijken
                </button>
              </div>
            </div>
          `).join('');
          
          // Toestel details bekijken
          document.querySelectorAll('.view-toestel-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const toestelId = e.target.closest('[data-toestel-id]').dataset.toestelId;
              this.viewToestelDetail(toestelId);
            });
          });
          
          // Ook op de hele rij klikken om details te bekijken
          document.querySelectorAll('[data-toestel-id]').forEach(row => {
            row.addEventListener('click', (e) => {
              const toestelId = row.dataset.toestelId;
              this.viewToestelDetail(toestelId);
            });
          });
        }
      },
      
      // Nieuwe methode om unieke filterwaarden te verzamelen
      collectUniqueFilters(toestellen) {
        AppState.locaties.clear();
        AppState.merken.clear();
        
        toestellen.forEach(toestel => {
          if (toestel.locatie) AppState.locaties.add(toestel.locatie);
          if (toestel.merk) AppState.merken.add(toestel.merk);
        });
        
        console.log(`Unieke locaties: ${AppState.locaties.size}, Unieke merken: ${AppState.merken.size}`);
      },
      
      // Nieuwe methode om filter dropdowns te vullen
      populateFilterDropdowns() {
        // Locatie filter
        if (this.elements.filterLocatie) {
          const locatieOptions = Array.from(AppState.locaties).sort();
          const locatieHTML = locatieOptions.map(locatie => 
            `<option value="${locatie}">${locatie}</option>`
          ).join('');
          
          this.elements.filterLocatie.innerHTML = `
            <option value="">Alle locaties</option>
            ${locatieHTML}
          `;
        }
        
        // Merk filter
        if (this.elements.filterMerk) {
          const merkOptions = Array.from(AppState.merken).sort();
          const merkHTML = merkOptions.map(merk => 
            `<option value="${merk}">${merk}</option>`
          ).join('');
          
          this.elements.filterMerk.innerHTML = `
            <option value="">Alle merken</option>
            ${merkHTML}
          `;
        }
      },
      
      // Nieuwe methode om filters toe te passen
      applyFilters() {
        const searchTerm = this.elements.searchInput?.value.toLowerCase().trim() || '';
        const selectedLocatie = this.elements.filterLocatie?.value || '';
        const selectedMerk = this.elements.filterMerk?.value || '';
        
        console.log(`Filters toepassen - Zoekterm: "${searchTerm}", Locatie: "${selectedLocatie}", Merk: "${selectedMerk}"`);
        
        // Filter de toestellen op basis van zoekterm en filters
        const filteredToestellen = AppState.allToestellen.filter(toestel => {
          // Zoekterm filteren op meerdere velden
          const matchesSearch = searchTerm === '' || 
            (toestel.beschrijving && toestel.beschrijving.toLowerCase().includes(searchTerm)) ||
            (toestel.serienummer && toestel.serienummer.toLowerCase().includes(searchTerm)) ||
            (toestel.intern_nummer && toestel.intern_nummer.toLowerCase().includes(searchTerm)) ||
            (toestel.merk && toestel.merk.toLowerCase().includes(searchTerm)) ||
            (toestel.type && toestel.type.toLowerCase().includes(searchTerm)) ||
            (toestel.locatie && toestel.locatie.toLowerCase().includes(searchTerm));
          
          // Locatie filter
          const matchesLocatie = selectedLocatie === '' || 
            (toestel.locatie && toestel.locatie === selectedLocatie);
          
          // Merk filter
          const matchesMerk = selectedMerk === '' || 
            (toestel.merk && toestel.merk === selectedMerk);
          
          return matchesSearch && matchesLocatie && matchesMerk;
        });
        
        console.log(`Filter resultaat: ${filteredToestellen.length} toestellen`);
        AppState.filteredToestellen = filteredToestellen;
        
        // Toon gefilterde toestellen
        this.renderToestellenList(filteredToestellen);
      },
      
      async viewToestelDetail(toestelId) {
        try {
          AppState.selectedToestel = toestelId;
          
          const [toestel, interventies, statistics] = await Promise.all([
            API.getToestelById(toestelId),
            API.getInterventiesByToestel(toestelId),
            API.getToestelStatistics(toestelId)
          ]);
          
          // Toon toestel informatie
          this.elements.toestelDetail.innerHTML = `
            <div class="bg-white p-5 rounded-lg shadow-md mb-5">
              <div class="flex justify-between items-start mb-4">
                <h2 class="text-xl font-bold">${toestel.beschrijving}</h2>
                <div class="flex space-x-2">
                  <button id="edit-toestel-btn" class="px-3 py-1 bg-yellow-500 text-white rounded-md text-sm hover:bg-yellow-600 transition">
                    Bewerken
                  </button>
                  <button id="delete-toestel-btn" class="px-3 py-1 bg-red-500 text-white rounded-md text-sm hover:bg-red-600 transition">
                    Verwijderen
                  </button>
                </div>
              </div>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <div>
                  <p class="text-sm text-gray-600 mb-1">Merk: <span class="font-medium text-gray-800">${toestel.merk || 'Niet gespecificeerd'}</span></p>
                  <p class="text-sm text-gray-600 mb-1">Type: <span class="font-medium text-gray-800">${toestel.type || 'Niet gespecificeerd'}</span></p>
                  <p class="text-sm text-gray-600 mb-1">Serienummer: <span class="font-medium text-gray-800">${toestel.serienummer || 'Niet gespecificeerd'}</span></p>
                  <p class="text-sm text-gray-600 mb-1">Intern nummer: <span class="font-medium text-gray-800">${toestel.intern_nummer || 'Niet gespecificeerd'}</span></p>
                  <p class="text-sm text-gray-600 mb-1">Type motor: <span class="font-medium text-gray-800">${toestel.type_motor || 'Niet gespecificeerd'}</span></p>
                </div>
                <div>
                  <p class="text-sm text-gray-600 mb-1">Locatie: <span class="font-medium text-gray-800">${toestel.locatie || 'Niet gespecificeerd'}</span></p>
                  <p class="text-sm text-gray-600 mb-1">Bouwjaar: <span class="font-medium text-gray-800">${toestel.bouwjaar || 'Niet gespecificeerd'}</span></p>
                  <p class="text-sm text-gray-600 mb-1">Extra info:</p>
                  <p class="text-sm bg-gray-50 p-2 rounded-md">${toestel.extra_info || 'Geen extra informatie'}</p>
                </div>
              </div>
            </div>
            
            <div id="toestel-stats" class="bg-white p-5 rounded-lg shadow-md mb-5">
              <h3 class="text-lg font-semibold mb-3">Statistieken</h3>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-blue-50 p-3 rounded-lg">
                  <div class="text-sm text-blue-800">Totale kosten</div>
                  <div class="text-xl font-bold">€${(statistics.totale_kosten || 0).toFixed(2)}</div>
                </div>
                <div class="bg-green-50 p-3 rounded-lg">
                  <div class="text-sm text-green-800">Aantal interventies</div>
                  <div class="text-xl font-bold">${statistics.aantal_interventies || 0}</div>
                </div>
                <div class="bg-purple-50 p-3 rounded-lg">
                  <div class="text-sm text-purple-800">Laatste interventie</div>
                  <div class="text-xl font-bold">${statistics.laatste_interventie ? new Date(statistics.laatste_interventie).toLocaleDateString() : 'Geen'}</div>
                </div>
              </div>
            </div>
            
            <div class="mb-3 flex justify-between items-center">
              <h3 class="text-lg font-semibold">Interventies</h3>
            </div>
            <div id="interventies-list" class="space-y-3">
            </div>
          `;
          
          // Toon interventies
          const interventiesList = document.getElementById('interventies-list');
          if (interventies.length === 0) {
            interventiesList.innerHTML = '<div class="text-center p-4 bg-gray-50 rounded-lg">Geen interventies gevonden. Voeg een nieuwe interventie toe.</div>';
          } else {
            interventiesList.innerHTML = interventies.map(interventie => `
              <div class="bg-white p-4 rounded-lg shadow-md" data-interventie-id="${interventie.id}">
                <div class="flex justify-between items-start mb-2">
                  <div>
                    <h4 class="font-semibold">${new Date(interventie.datum).toLocaleDateString()}</h4>
                    <p class="text-sm text-gray-600">Factuur: ${interventie.factuur_nummer || 'Niet gespecificeerd'}</p>
                  </div>
                  <span class="text-lg font-bold text-green-700">€${parseFloat(interventie.kosten).toFixed(2)}</span>
                </div>
                
                <div class="mt-2">
                  <p class="text-sm text-gray-700 font-semibold">Probleem:</p>
                  <p class="text-sm bg-red-50 p-2 rounded-md mb-2">${interventie.omschrijving_probleem}</p>
                  
                  <p class="text-sm text-gray-700 font-semibold">Uitgevoerde werken:</p>
                  <p class="text-sm bg-green-50 p-2 rounded-md mb-2">${interventie.uitgevoerde_werken}</p>
                  
                  <p class="text-sm text-gray-700 font-semibold">Uitgevoerd door:</p>
                  <p class="text-sm">${interventie.uitgevoerd_door || 'Niet gespecificeerd'}</p>
                  
                  ${interventie.opmerkingen ? `
                  <p class="text-sm text-gray-700 font-semibold mt-2">Opmerkingen:</p>
                  <p class="text-sm bg-gray-50 p-2 rounded-md">${interventie.opmerkingen}</p>
                  ` : ''}
                </div>
                
                <div class="mt-3 flex justify-end space-x-2">
                  <button class="edit-interventie-btn px-3 py-1 bg-yellow-500 text-white rounded-md text-sm hover:bg-yellow-600 transition" data-id="${interventie.id}">
                    Bewerken
                  </button>
                  <button class="delete-interventie-btn px-3 py-1 bg-red-500 text-white rounded-md text-sm hover:bg-red-600 transition" data-id="${interventie.id}">
                    Verwijderen
                  </button>
                </div>
              </div>
            `).join('');
            
            // Voeg event listeners toe aan de interventie knoppen
            document.querySelectorAll('.edit-interventie-btn').forEach(btn => {
              btn.addEventListener('click', (e) => {
                const interventieId = e.target.dataset.id;
                this.editInterventie(interventieId);
              });
            });
            
            document.querySelectorAll('.delete-interventie-btn').forEach(btn => {
              btn.addEventListener('click', (e) => {
                const interventieId = e.target.dataset.id;
                this.deleteInterventie(interventieId);
              });
            });
          }
          
          // Event listeners voor toestel acties
          document.getElementById('edit-toestel-btn').addEventListener('click', () => {
            this.editToestel(toestelId);
          });
          
          document.getElementById('delete-toestel-btn').addEventListener('click', () => {
            this.deleteToestel(toestelId);
          });
          
          this.showSection('toestel-detail-section');
        } catch (error) {
          console.error('Fout bij laden toestel details:', error);
          Notifications.show('error', 'Fout bij het ophalen van toestel details');
        }
      },
      
      async saveToestel() {
        const formMode = this.elements.toestelForm.dataset.mode;
        const toestelId = this.elements.toestelForm.dataset.toestelId;
        
        const formData = {
          beschrijving: document.getElementById('toestel-beschrijving').value,
          serienummer: document.getElementById('toestel-serienummer').value,
          intern_nummer: document.getElementById('toestel-intern-nummer').value,
          merk: document.getElementById('toestel-merk').value,
          type: document.getElementById('toestel-type').value,
          type_motor: document.getElementById('toestel-type-motor').value,
          extra_info: document.getElementById('toestel-extra-info').value,
          locatie: document.getElementById('toestel-locatie').value,
          bouwjaar: document.getElementById('toestel-bouwjaar').value
        };
        
        try {
          if (formMode === 'create') {
            const result = await API.createToestel(formData);
            if (result.id) {
              Notifications.show('success', 'Toestel succesvol toegevoegd');
              await this.loadToestellen(); // Volledige lijst opnieuw laden om filters bij te werken
              this.showSection('toestellen-section');
            }
          } else if (formMode === 'edit') {
            const result = await API.updateToestel(toestelId, formData);
            if (result) {
              Notifications.show('success', 'Toestel succesvol bijgewerkt');
              
              // Update de toestel in de lokale arrays
              const index = AppState.allToestellen.findIndex(t => t.id == toestelId);
              if (index !== -1) {
                const updatedToestel = { ...AppState.allToestellen[index], ...formData, id: toestelId };
                AppState.allToestellen[index] = updatedToestel;
                
                // Update filters en opnieuw rendering
                this.collectUniqueFilters(AppState.allToestellen);
                this.populateFilterDropdowns();
                this.applyFilters();
              } else {
                // Als we het toestel niet kunnen vinden, laad dan de hele lijst opnieuw
                await this.loadToestellen();
              }
              
              this.viewToestelDetail(toestelId);
            }
          }
        } catch (error) {
          console.error('Fout bij opslaan toestel:', error);
          Notifications.show('error', 'Fout bij het opslaan van toestel');
        }
      },
      
      async editToestel(toestelId) {
        try {
          const toestel = await API.getToestelById(toestelId);
          
          // Vul het formulier met toestel gegevens
          document.getElementById('toestel-beschrijving').value = toestel.beschrijving || '';
          document.getElementById('toestel-serienummer').value = toestel.serienummer || '';
          document.getElementById('toestel-intern-nummer').value = toestel.intern_nummer || '';
          document.getElementById('toestel-merk').value = toestel.merk || '';
          document.getElementById('toestel-type').value = toestel.type || '';
          document.getElementById('toestel-type-motor').value = toestel.type_motor || '';
          document.getElementById('toestel-extra-info').value = toestel.extra_info || '';
          document.getElementById('toestel-locatie').value = toestel.locatie || '';
          document.getElementById('toestel-bouwjaar').value = toestel.bouwjaar || '';
          
          // Stel form mode in op edit
          this.elements.toestelForm.dataset.mode = 'edit';
          this.elements.toestelForm.dataset.toestelId = toestelId;
          
          this.showSection('toestel-form-section');
        } catch (error) {
          console.error('Fout bij laden toestel voor bewerken:', error);
          Notifications.show('error', 'Fout bij het ophalen van toestel gegevens');
        }
      },
      
      async deleteToestel(toestelId) {
        if (!confirm('Weet je zeker dat je dit toestel wilt verwijderen? Alle bijbehorende interventies worden ook verwijderd.')) {
          return;
        }
        
        try {
          const result = await API.deleteToestel(toestelId);
          if (result) {
            Notifications.show('success', 'Toestel succesvol verwijderd');
            
            // Verwijder toestel uit lokale arrays
            AppState.allToestellen = AppState.allToestellen.filter(t => t.id != toestelId);
            
            // Update filters en opnieuw rendering
            this.collectUniqueFilters(AppState.allToestellen);
            this.populateFilterDropdowns();
            this.applyFilters();
            
            this.showSection('toestellen-section');
            AppState.selectedToestel = null;
          }
        } catch (error) {
          console.error('Fout bij verwijderen toestel:', error);
          Notifications.show('error', 'Fout bij het verwijderen van toestel');
        }
      },
      
      async saveInterventie() {
        const formMode = this.elements.interventieForm.dataset.mode;
        const interventieId = this.elements.interventieForm.dataset.interventieId;
        
        const formData = {
          toestel_id: AppState.selectedToestel,
          datum: document.getElementById('interventie-datum').value,
          omschrijving_probleem: document.getElementById('interventie-probleem').value,
          uitgevoerde_werken: document.getElementById('interventie-werken').value,
          kosten: parseFloat(document.getElementById('interventie-kosten').value),
          factuur_nummer: document.getElementById('interventie-factuur').value,
          uitgevoerd_door: document.getElementById('interventie-uitvoerder').value,
          opmerkingen: document.getElementById('interventie-opmerkingen').value
        };
        
        try {
          if (formMode === 'create') {
            const result = await API.createInterventie(formData);
            if (result.id) {
              Notifications.show('success', 'Interventie succesvol toegevoegd');
              this.viewToestelDetail(AppState.selectedToestel);
            }
          } else if (formMode === 'edit') {
            const result = await API.updateInterventie(interventieId, formData);
            if (result) {
              Notifications.show('success', 'Interventie succesvol bijgewerkt');
              this.viewToestelDetail(AppState.selectedToestel);
            }
          }
        } catch (error) {
          console.error('Fout bij opslaan interventie:', error);
          Notifications.show('error', 'Fout bij het opslaan van interventie');
        }
      },
      
      async editInterventie(interventieId) {
        try {
          const interventie = await API.getInterventieById(interventieId);
          
          // Vul het formulier met interventie gegevens
          document.getElementById('interventie-datum').value = interventie.datum ? interventie.datum.substr(0, 10) : '';
          document.getElementById('interventie-probleem').value = interventie.omschrijving_probleem || '';
          document.getElementById('interventie-werken').value = interventie.uitgevoerde_werken || '';
          document.getElementById('interventie-kosten').value = interventie.kosten || '';
          document.getElementById('interventie-factuur').value = interventie.factuur_nummer || '';
          document.getElementById('interventie-uitvoerder').value = interventie.uitgevoerd_door || '';
          document.getElementById('interventie-opmerkingen').value = interventie.opmerkingen || '';
          
          // Stel form mode in op edit
          this.elements.interventieForm.dataset.mode = 'edit';
          this.elements.interventieForm.dataset.interventieId = interventieId;
          
          this.showSection('interventie-form-section');
        } catch (error) {
          console.error('Fout bij laden interventie voor bewerken:', error);
          Notifications.show('error', 'Fout bij het ophalen van interventie gegevens');
        }
      },
      
      async deleteInterventie(interventieId) {
        if (!confirm('Weet je zeker dat je deze interventie wilt verwijderen?')) {
          return;
        }
        
        try {
          const result = await API.deleteInterventie(interventieId);
          if (result) {
            Notifications.show('success', 'Interventie succesvol verwijderd');
            this.viewToestelDetail(AppState.selectedToestel);
          }
        } catch (error) {
          console.error('Fout bij verwijderen interventie:', error);
          Notifications.show('error', 'Fout bij het verwijderen van interventie');
        }
      },
      
      // Rapportage gerelateerde functies
      async openRapportage() {
        try {
          // Verzamel unieke jaren voor de jaren dropdown
          await this.collectJaren();
          
          // Vul de filter dropdowns voor de rapportage
          this.populateRapportageFilterDropdowns();
          
          // Laad initiële rapportage data
          await this.loadRapportageData();
          
          // Toon de rapportage sectie
          this.showSection('rapportage-section');
        } catch (error) {
          console.error('Fout bij openen rapportage:', error);
          Notifications.show('error', 'Fout bij het laden van de rapportage');
        }
      },
      
      // Verzamel unieke jaren uit de interventies
      async collectJaren() {
        try {
          // Deze functie zou via API moeten werken, maar voor nu
          // simuleren we dit met de toestellen reeds in het geheugen
          AppState.jaren.clear();
          
          // Voeg huidige jaar toe
          const currentYear = new Date().getFullYear();
          for (let year = currentYear; year >= currentYear - 5; year--) {
            AppState.jaren.add(year.toString());
          }
        } catch (error) {
          console.error('Fout bij verzamelen jaren:', error);
          throw error;
        }
      },
      
      // Vul de filter dropdowns voor de rapportage
      populateRapportageFilterDropdowns() {
        try {
          // Jaren dropdown
          if (this.elements.filterJaar) {
            const jarenOptions = Array.from(AppState.jaren).sort((a, b) => b - a); // Sorteer aflopend
            const jarenHTML = jarenOptions.map(jaar => 
              `<option value="${jaar}">${jaar}</option>`
            ).join('');
            
            this.elements.filterJaar.innerHTML = `
              <option value="">Alle jaren</option>
              ${jarenHTML}
            `;
          }
          
          // Locatie dropdown (gebruik bestaande verzamelde locaties)
          if (this.elements.filterRapportLocatie) {
            const locatieOptions = Array.from(AppState.locaties).sort();
            const locatieHTML = locatieOptions.map(locatie => 
              `<option value="${locatie}">${locatie}</option>`
            ).join('');
            
            this.elements.filterRapportLocatie.innerHTML = `
              <option value="">Alle locaties</option>
              ${locatieHTML}
            `;
          }
          
          // Merk dropdown (gebruik bestaande verzamelde merken)
          if (this.elements.filterRapportMerk) {
            const merkOptions = Array.from(AppState.merken).sort();
            const merkHTML = merkOptions.map(merk => 
              `<option value="${merk}">${merk}</option>`
            ).join('');
            
            this.elements.filterRapportMerk.innerHTML = `
              <option value="">Alle merken</option>
              ${merkHTML}
            `;
          }
        } catch (error) {
          console.error('Fout bij vullen rapportage filters:', error);
          throw error;
        }
      },
      
      // Laad rapportage data op basis van filters
      async loadRapportageData() {
        try {
          const filters = {
            jaar: this.elements.filterJaar?.value || '',
            locatie: this.elements.filterRapportLocatie?.value || '',
            merk: this.elements.filterRapportMerk?.value || ''
          };
          
          console.log("===== DEBUG RAPPORTAGE =====");
          console.log("Toegepaste filters:", filters);
          console.log("Filter jaar element waarde:", this.elements.filterJaar?.value);
          
          // Toon laad indicator in de tabel
          this.elements.rapportToestellenTabel.innerHTML = `
            <tr>
              <td colspan="8" class="px-6 py-4 text-center text-gray-500">
                <i class="fas fa-spinner fa-spin mr-2"></i> Rapportage gegevens laden...
              </td>
            </tr>
          `;
          
          // Haal rapportage data op via de API
          try {
            const response = await API.getRapportageData(filters);
            console.log("API response ontvangen:", response);
            
            // Bewaar in app state
            AppState.rapportageData = response;
            
            // Update de UI
            this.updateRapportageUI(response);
          } catch (apiError) {
            console.error("API fout bij ophalen rapportage:", apiError);
            
            // Als de API niet werkt, val terug op lokale simulatie
            console.log("Terugvallen op lokale gegevens simulatie");
            this.simulateRapportageData(filters);
          }
        } catch (error) {
          console.error('Fout bij laden rapportage data:', error);
          
          // Toon foutmelding
          this.elements.rapportToestellenTabel.innerHTML = `
            <tr>
              <td colspan="8" class="px-6 py-4 text-center text-red-500">
                <i class="fas fa-exclamation-circle mr-2"></i> Fout bij laden rapportage: ${error.message}
              </td>
            </tr>
          `;
          
          Notifications.show('error', 'Fout bij het laden van de rapportage data');
        }
      },
      
      // Simuleer rapportage data voor demo/testing
      async simulateRapportageData(filters) {
        console.log("Simuleren van rapportage data met filters:", filters);
        
        // Verzamel statistieken (dit zou eigenlijk via een API call gaan)
        const rapportageData = {
          toestellen: [],
          stats: {
            totalDevices: 0,
            totalCosts: 0,
            totalInterventions: 0,
            costsPerMonth: [],
            costsPerDevice: []
          }
        };
        
        // Verzamel statistieken van alle toestellen
        for (const toestel of AppState.allToestellen) {
          try {
            // Haal statistieken op voor dit toestel
            const stats = await API.getToestelStatistics(toestel.id);
            
            // Filter toepassen
            if ((filters.locatie && toestel.locatie !== filters.locatie) ||
                (filters.merk && toestel.merk !== filters.merk)) {
              continue;
            }
            
            // Handmatige jaarfilter implementatie - dit zou in de backend moeten gebeuren
            // Als er een jaar filter is, controleer of we interventies hebben in dat jaar
            if (filters.jaar && stats.laatste_interventie) {
              const interventieJaar = new Date(stats.laatste_interventie).getFullYear().toString();
              console.log(`Vergelijken interventie jaar ${interventieJaar} met filter jaar ${filters.jaar} voor toestel ${toestel.id}`);
              
              if (interventieJaar !== filters.jaar) {
                console.log(`Toestel ${toestel.id} uitgefilterd omdat laatste interventie jaar ${interventieJaar} niet overeenkomt met filter jaar ${filters.jaar}`);
                continue;
              }
            }
            
            // Voeg toe aan onze dataset
            rapportageData.toestellen.push({
              ...toestel,
              stats: stats
            });
            
            // Update totalen
            rapportageData.stats.totalDevices++;
            rapportageData.stats.totalCosts += parseFloat(stats.totale_kosten || 0);
            rapportageData.stats.totalInterventions += parseInt(stats.aantal_interventies || 0);
            
            // Voeg toe aan kosten per toestel voor grafiek
            rapportageData.stats.costsPerDevice.push({
              name: toestel.beschrijving,
              value: parseFloat(stats.totale_kosten || 0)
            });
          } catch (error) {
            console.error(`Fout bij laden statistieken voor toestel ${toestel.id}:`, error);
          }
        }
        
        // Sorteer kosten per toestel van hoog naar laag
        rapportageData.stats.costsPerDevice.sort((a, b) => b.value - a.value);
        
        // Limiteer tot top 10 voor grafiek overzichtelijkheid
        rapportageData.stats.costsPerDevice = rapportageData.stats.costsPerDevice.slice(0, 10);
        
        // Simuleer kosten per maand (dit zou normaal via de API komen)
        const currentYear = new Date().getFullYear();
        const year = filters.jaar ? parseInt(filters.jaar) : currentYear;
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
        
        months.forEach((month, index) => {
          // Genereer wat willekeurige data voor de demo
          // In een echt scenario zou dit historische data zijn
          const randomCost = Math.round(Math.random() * 2000) / 100;
          rapportageData.stats.costsPerMonth.push({
            x: month,
            y: randomCost
          });
        });
        
        // Bewaar in app state
        AppState.rapportageData = rapportageData;
        
        // Update de UI
        this.updateRapportageUI(rapportageData);
      },
      
      // Update de UI elementen met rapportage data
      updateRapportageUI(data) {
        try {
          // Update samenvatting kaarten
          this.elements.totalDevicesCount.textContent = data.stats.totalDevices;
          this.elements.totalCosts.textContent = `€${data.stats.totalCosts.toFixed(2)}`;
          this.elements.averageCosts.textContent = data.stats.totalDevices ? 
            `€${(data.stats.totalCosts / data.stats.totalDevices).toFixed(2)}` : '€0,00';
          this.elements.totalInterventions.textContent = data.stats.totalInterventions;
          
          // Teken grafieken (als ApexCharts geladen is)
          if (window.ApexCharts) {
            this.renderCostsPerDeviceChart(data.stats.costsPerDevice);
            this.renderCostsPerMonthChart(data.stats.costsPerMonth);
          } else {
            console.log('ApexCharts is not loaded yet, will retry in 1 second');
            setTimeout(() => {
              if (window.ApexCharts) {
                this.renderCostsPerDeviceChart(data.stats.costsPerDevice);
                this.renderCostsPerMonthChart(data.stats.costsPerMonth);
              } else {
                console.error('ApexCharts could not be loaded');
                this.elements.costsPerDeviceChart.innerHTML = 'Kon grafieken niet laden. Probeer de pagina te verversen.';
                this.elements.costsPerMonthChart.innerHTML = 'Kon grafieken niet laden. Probeer de pagina te verversen.';
              }
            }, 1000);
          }
          
          // Vul de tabel
          this.renderRapportageTable(data.toestellen);
        } catch (error) {
          console.error('Fout bij updaten rapportage UI:', error);
          Notifications.show('error', 'Fout bij het updaten van de rapportage');
        }
      },
      
      // Render kosten per toestel grafiek
      renderCostsPerDeviceChart(data) {
        // Leeg de container
        this.elements.costsPerDeviceChart.innerHTML = '';
        
        if (data.length === 0) {
          this.elements.costsPerDeviceChart.innerHTML = 'Geen data beschikbaar voor grafiek';
          return;
        }
        
        const options = {
          series: [{
            name: 'Kosten',
            data: data.map(item => item.value)
          }],
          chart: {
            type: 'bar',
            height: 250,
            toolbar: {
              show: false
            }
          },
          plotOptions: {
            bar: {
              horizontal: true,
              distributed: true,
              dataLabels: {
                position: 'top'
              },
            }
          },
          colors: ['#4F46E5', '#7C3AED', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16'],
          dataLabels: {
            enabled: true,
            formatter: function (val) {
              return '€' + val.toFixed(2);
            },
            offsetX: 20,
            style: {
              fontSize: '12px',
              colors: ['#304758']
            }
          },
          xaxis: {
            categories: data.map(item => {
              // Beperk lengte van naam voor betere weergave
              return item.name.length > 25 ? item.name.substring(0, 22) + '...' : item.name;
            }),
            labels: {
              formatter: function (val) {
                return '€' + parseFloat(val).toFixed(2);
              }
            }
          },
          yaxis: {
            labels: {
              show: true
            }
          },
          grid: {
            borderColor: '#e7e7e7',
            row: {
              colors: ['#f3f3f3', 'transparent'],
              opacity: 0.5
            },
          },
          tooltip: {
            y: {
              formatter: function (val) {
                return '€' + val.toFixed(2);
              }
            }
          }
        };
        
        const chart = new ApexCharts(this.elements.costsPerDeviceChart, options);
        chart.render();
      },
      
      // Render kosten per maand grafiek
      renderCostsPerMonthChart(data) {
        // Leeg de container
        this.elements.costsPerMonthChart.innerHTML = '';
        
        if (data.length === 0) {
          this.elements.costsPerMonthChart.innerHTML = 'Geen data beschikbaar voor grafiek';
          return;
        }
        
        const options = {
          series: [{
            name: 'Kosten',
            data: data.map(item => item.y)
          }],
          chart: {
            height: 250,
            type: 'line',
            zoom: {
              enabled: false
            },
            toolbar: {
              show: false
            }
          },
          dataLabels: {
            enabled: false
          },
          stroke: {
            curve: 'smooth',
            width: 2
          },
          colors: ['#3B82F6'],
          xaxis: {
            categories: data.map(item => item.x),
          },
          yaxis: {
            labels: {
              formatter: function (val) {
                return '€' + val.toFixed(2);
              }
            }
          },
          markers: {
            size: 5,
          },
          tooltip: {
            y: {
              formatter: function (val) {
                return '€' + val.toFixed(2);
              }
            }
          }
        };
        
        const chart = new ApexCharts(this.elements.costsPerMonthChart, options);
        chart.render();
      },
      
      // Render de rapportage tabel
      renderRapportageTable(toestellen) {
        console.log("Renderen van rapportage tabel met", toestellen.length, "toestellen");
        console.log("Actief jaar filter:", this.elements.filterJaar?.value || 'geen');
        
        if (toestellen.length === 0) {
          this.elements.rapportToestellenTabel.innerHTML = `
            <tr>
              <td colspan="8" class="px-6 py-4 text-center text-gray-500">
                Geen toestellen gevonden die voldoen aan de filterinstellingen.
              </td>
            </tr>
          `;
          return;
        }
        
        // Sorteer toestellen op totale kosten (hoogste eerst)
        toestellen.sort((a, b) => {
          const aKosten = parseFloat(a.stats?.totale_kosten || 0);
          const bKosten = parseFloat(b.stats?.totale_kosten || 0);
          return bKosten - aKosten;
        });
        
        this.elements.rapportToestellenTabel.innerHTML = toestellen.map(toestel => {
          const stats = toestel.stats || { totale_kosten: 0, aantal_interventies: 0, laatste_interventie: null };
          
          // Debug info voor laatste interventie datum
          if (stats.laatste_interventie) {
            const interventieDate = new Date(stats.laatste_interventie);
            console.log(`Toestel ${toestel.id} - ${toestel.beschrijving} - Laatste interventie: ${interventieDate.toLocaleDateString()} (${interventieDate.getFullYear()})`);
          }
          
          return `
            <tr class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap">${toestel.beschrijving}</td>
              <td class="px-6 py-4 whitespace-nowrap">${toestel.locatie || '-'}</td>
              <td class="px-6 py-4 whitespace-nowrap">${toestel.merk || '-'}</td>
              <td class="px-6 py-4 whitespace-nowrap">${toestel.intern_nummer || '-'}</td>
              <td class="px-6 py-4 whitespace-nowrap">${stats.aantal_interventies || 0}</td>
              <td class="px-6 py-4 whitespace-nowrap font-medium ${parseFloat(stats.totale_kosten || 0) > 1000 ? 'text-red-600' : 'text-green-600'}">
                €${parseFloat(stats.totale_kosten || 0).toFixed(2)}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                ${stats.laatste_interventie ? new Date(stats.laatste_interventie).toLocaleDateString() : '-'}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <button class="view-toestel-detail-btn px-3 py-1 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition" data-id="${toestel.id}">
                  Details
                </button>
              </td>
            </tr>
          `;
        }).join('');
        
        // Voeg event listeners toe aan de detail knoppen
        document.querySelectorAll('.view-toestel-detail-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const toestelId = e.target.dataset.id;
            this.viewToestelDetail(toestelId);
          });
        });
      },
      
      // Exporteer rapportage als CSV
      exportRapportage() {
        try {
          if (!AppState.rapportageData || !AppState.rapportageData.toestellen || AppState.rapportageData.toestellen.length === 0) {
            Notifications.show('warning', 'Geen data beschikbaar om te exporteren');
            return;
          }
          
          // Bouw CSV headers
          const headers = [
            'Beschrijving', 'Locatie', 'Merk', 'Type', 
            'Intern Nummer', 'Serienummer', 'Bouwjaar',
            'Aantal Interventies', 'Totale Kosten', 'Laatste Interventie'
          ];
          
          // Bouw CSV rijen
          const rows = AppState.rapportageData.toestellen.map(toestel => {
            const stats = toestel.stats || { totale_kosten: 0, aantal_interventies: 0, laatste_interventie: null };
            
            return [
              `"${toestel.beschrijving || ''}"`,
              `"${toestel.locatie || ''}"`,
              `"${toestel.merk || ''}"`,
              `"${toestel.type || ''}"`,
              `"${toestel.intern_nummer || ''}"`,
              `"${toestel.serienummer || ''}"`,
              `"${toestel.bouwjaar || ''}"`,
              stats.aantal_interventies || 0,
              parseFloat(stats.totale_kosten || 0).toFixed(2),
              stats.laatste_interventie ? new Date(stats.laatste_interventie).toLocaleDateString() : ''
            ].join(',');
          });
          
          // Combineer tot CSV inhoud
          const csvContent = [
            headers.join(','),
            ...rows
          ].join('\n');
          
          // Maak een download link
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.setAttribute('href', url);
          link.setAttribute('download', 'toestellen_rapportage.csv');
          link.style.visibility = 'hidden';
          
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          Notifications.show('success', 'Rapportage succesvol geëxporteerd');
        } catch (error) {
          console.error('Fout bij exporteren rapportage:', error);
          Notifications.show('error', 'Fout bij het exporteren van de rapportage');
        }
      }
    };
  
    // Notificatie voor gebruiker feedback
    const Notifications = {
      show(type, message) {
        const notification = document.createElement('div');
        notification.className = `notification ${type} animate-fade-in`;
        notification.innerHTML = `
          <div class="notification-content">
            <span>${message}</span>
            <button class="notification-close">&times;</button>
          </div>
        `;
        
        document.body.appendChild(notification);
        
        // Sluit notificatie na klikken op de sluit knop
        notification.querySelector('.notification-close').addEventListener('click', () => {
          notification.classList.add('animate-fade-out');
          setTimeout(() => {
            notification.remove();
          }, 300);
        });
        
        // Automatisch sluiten na 5 seconden
        setTimeout(() => {
          if (document.body.contains(notification)) {
            notification.classList.add('animate-fade-out');
            setTimeout(() => {
              if (document.body.contains(notification)) {
                notification.remove();
              }
            }, 300);
          }
        }, 5000);
      }
    };
    
    // Initialiseer de UI
    UI.init();
  }); 