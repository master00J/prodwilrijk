// Globale variabelen die buiten $(document).ready beschikbaar zijn
let allTargets = [];
let filteredTargets = [];

$(document).ready(function() {
    console.log('=== Document ready - script wordt uitgevoerd ===');
    console.log('XLSX bibliotheek geladen:', typeof XLSX !== 'undefined');
    
    // Laad header
    fetch('header.html')
        .then(response => response.text())
        .then(html => $('#header-placeholder').html(html))
        .catch(err => console.error('Header load error:', err));

    const $tableBody = $('#target-table tbody');
    const $tableStatus = $('#table-status');
    const $formStatus = $('#form-status');
    const $form = $('#target-form');
    
    // Variabelen voor sortering en filtering (gebruik globale variabelen)
    let currentSortColumn = null;
    let currentSortDirection = 'asc';

    function showTableStatus(message, type = 'muted') {
        if (!message) {
            $tableStatus.empty();
            return;
        }
        const alert = $(`
            <div class="text-${type}">
                <small>${message}</small>
            </div>
        `);
        $tableStatus.html(alert);
    }

    function showFormStatus(message, type = 'success') {
        if (!message) {
            $formStatus.empty();
            return;
        }
        $formStatus.removeClass('text-success text-danger text-muted')
            .addClass(`text-${type}`)
            .text(message);
        if (type === 'success') {
            setTimeout(() => $formStatus.fadeOut(200, () => {
                $formStatus.empty().show();
            }), 2000);
        }
    }

    // Parse zoekterm zoals "19x100x5000"
    function parseSearchTerm(term) {
        const parts = term.toLowerCase().trim().split('x');
        if (parts.length >= 2) {
            return {
                dikte: parts[0] ? parseFloat(parts[0]) : null,
                breedte: parts[1] ? parseFloat(parts[1]) : null,
                lengte: parts[2] ? parseFloat(parts[2]) : null
            };
        }
        return null;
    }

    // Filter en zoek functie
    function filterAndSearchData() {
        const searchTerm = $('#search-box').val().toLowerCase().trim();
        const houtsoortFilter = $('#filter-houtsoort').val().toLowerCase();
        
        let filtered = allTargets;
        
        // Filter op houtsoort
        if (houtsoortFilter) {
            filtered = filtered.filter(item => 
                item.houtsoort.toLowerCase() === houtsoortFilter
            );
        }
        
        // Zoeken
        if (searchTerm) {
            const parsedSearch = parseSearchTerm(searchTerm);
            
            if (parsedSearch) {
                // Zoek op dikte x breedte x lengte formaat
                filtered = filtered.filter(item => {
                    const matchDikte = parsedSearch.dikte === null || item.dikte == parsedSearch.dikte;
                    const matchBreedte = parsedSearch.breedte === null || item.breedte == parsedSearch.breedte;
                    const matchLengte = parsedSearch.lengte === null || 
                                       (item.desired_length && item.desired_length == parsedSearch.lengte);
                    return matchDikte && matchBreedte && matchLengte;
                });
            } else {
                // Algemeen zoeken
                filtered = filtered.filter(item => 
                    item.houtsoort.toLowerCase().includes(searchTerm) ||
                    item.dikte.toString().includes(searchTerm) ||
                    item.breedte.toString().includes(searchTerm) ||
                    (item.desired_length && item.desired_length.toString().includes(searchTerm)) ||
                    item.target_packs.toString().includes(searchTerm)
                );
            }
        }
        
        filteredTargets = filtered;
        renderTable(filtered);
    }

    // Update houtsoort filter opties
    function updateHoutsoortFilter() {
        const houtsoorten = [...new Set(allTargets.map(item => item.houtsoort))].sort();
        const $filter = $('#filter-houtsoort');
        const currentValue = $filter.val();
        
        $filter.empty().append('<option value="">Alle houtsoorten</option>');
        houtsoorten.forEach(soort => {
            $filter.append(`<option value="${soort}">${soort}</option>`);
        });
        
        if (currentValue) {
            $filter.val(currentValue);
        }
    }

    // Sorteer functie
    function sortData(column) {
        if (currentSortColumn === column) {
            currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            currentSortColumn = column;
            currentSortDirection = 'asc';
        }
        
        allTargets.sort((a, b) => {
            let valA = a[column];
            let valB = b[column];
            
            // Behandel null/undefined waarden
            if (valA === null || valA === undefined) valA = '';
            if (valB === null || valB === undefined) valB = '';
            
            // Converteer naar juiste type voor vergelijking
            if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }
            
            let comparison = 0;
            if (valA > valB) comparison = 1;
            if (valA < valB) comparison = -1;
            
            return currentSortDirection === 'asc' ? comparison : -comparison;
        });
        
        // Update UI
        $('.sortable').removeClass('asc desc');
        $(`.sortable[data-column="${column}"]`).addClass(currentSortDirection);
        
        filterAndSearchData();
    }

    function renderTable(data) {
        $tableBody.empty();
        if (!Array.isArray(data) || data.length === 0) {
            $tableBody.append('<tr><td colspan="7" class="text-center text-muted">Geen targets gevonden</td></tr>');
            return;
        }

        data.forEach(item => {
            const row = $(`
                <tr data-id="${item.id}">
                    <td>
                        <input type="text" class="form-control form-control-sm table-input houtsoort-input" value="${item.houtsoort}">
                    </td>
                    <td>
                        <input type="number" step="0.1" class="form-control form-control-sm table-input dikte-input" value="${item.dikte}">
                    </td>
                    <td>
                        <input type="number" step="0.1" class="form-control form-control-sm table-input breedte-input" value="${item.breedte}">
                    </td>
                    <td>
                        <input type="number" class="form-control form-control-sm table-input target-input" value="${item.target_packs}" min="0">
                    </td>
                    <td>
                        <input type="number" class="form-control form-control-sm table-input length-input" value="${item.desired_length ?? ''}" min="0" placeholder="n.v.t.">
                    </td>
                    <td><small>${item.updated_at ? new Date(item.updated_at).toLocaleString() : '-'}</small></td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-primary me-2 update-row"><i class="fas fa-save"></i></button>
                        <button class="btn btn-sm btn-danger delete-row"><i class="fas fa-trash-alt"></i></button>
                    </td>
                </tr>
            `);
            $tableBody.append(row);
        });
    }

    async function fetchTargets() {
        showTableStatus('Laden...', 'muted');
        try {
            const response = await $.ajax({ url: '/api/target_stock?v=' + Date.now(), method: 'GET' });
            allTargets = response;
            filteredTargets = response;
            updateHoutsoortFilter();
            filterAndSearchData();
            showTableStatus('');
        } catch (error) {
            console.error('Fout bij laden targets:', error);
            showTableStatus('Kon targetvoorraad niet laden.', 'danger');
        }
    }

    function resetForm() {
        $form[0].reset();
        $formStatus.empty();
    }

    // Excel export functie
    function exportToExcel() {
        console.log('Excel export functie aangeroepen');
        console.log('Aantal gefilterde targets:', filteredTargets.length);
        console.log('XLSX beschikbaar:', typeof XLSX !== 'undefined');
        
        if (!filteredTargets || filteredTargets.length === 0) {
            alert('Geen data om te exporteren.');
            return;
        }

        if (typeof XLSX === 'undefined') {
            alert('Excel bibliotheek is niet geladen. Herlaad de pagina en probeer opnieuw.');
            return;
        }

        try {
            // Bereid data voor Excel
            const excelData = filteredTargets.map(item => ({
                'Houtsoort': item.houtsoort || '',
                'Dikte (mm)': item.dikte || '',
                'Breedte (mm)': item.breedte || '',
                'Gewenste packs': item.target_packs || 0,
                'Lengte (mm)': item.desired_length || '',
                'Laatste update': item.updated_at ? new Date(item.updated_at).toLocaleString('nl-NL') : '-'
            }));

            console.log('Excel data voorbereid:', excelData.length, 'rijen');

            // Maak een nieuwe workbook
            const wb = XLSX.utils.book_new();
            
            // Converteer data naar worksheet
            const ws = XLSX.utils.json_to_sheet(excelData);

            // Stel kolombreedtes in
            const colWidths = [
                { wch: 15 }, // Houtsoort
                { wch: 12 }, // Dikte
                { wch: 15 }, // Breedte
                { wch: 18 }, // Gewenste packs
                { wch: 15 }, // Lengte
                { wch: 22 }  // Laatste update
            ];
            ws['!cols'] = colWidths;

            // Voeg autofilter toe
            if (ws['!ref']) {
                ws['!autofilter'] = { ref: ws['!ref'] };
            }

            // Voeg worksheet toe aan workbook
            XLSX.utils.book_append_sheet(wb, ws, 'Target Voorraad');

            // Genereer bestandsnaam met datum
            const today = new Date();
            const dateStr = today.getFullYear() + 
                           '-' + String(today.getMonth() + 1).padStart(2, '0') + 
                           '-' + String(today.getDate()).padStart(2, '0');
            const filename = `Target_Voorraad_${dateStr}.xlsx`;

            // Download het bestand
            console.log('Bestand wordt gedownload:', filename);
            XLSX.writeFile(wb, filename);
            
            showTableStatus('Excel bestand geëxporteerd.', 'success');
            setTimeout(() => showTableStatus(''), 3000);
        } catch (error) {
            console.error('Fout bij Excel export:', error);
            alert('Er is een fout opgetreden bij het exporteren: ' + error.message);
            showTableStatus('Export mislukt.', 'danger');
        }
    }

    // Event handlers
    $form.on('submit', async function(e) {
        e.preventDefault();
        const houtsoort = $('#form-houtsoort').val().trim();
        const dikte = $('#form-dikte').val();
        const breedte = $('#form-breedte').val();
        const target = $('#form-target').val();
        const lengte = $('#form-lengte').val();

        if (!houtsoort || dikte === '' || breedte === '' || target === '') {
            showFormStatus('Vul alle verplichte velden in.', 'danger');
            return;
        }

        const payload = {
            houtsoort,
            dikte: Number(dikte),
            breedte: Number(breedte),
            target_packs: Number(target),
            desired_length: lengte === '' ? null : Number(lengte)
        };

        showFormStatus('Opslaan...', 'muted');

        try {
            await $.ajax({
                url: '/api/target_stock',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(payload)
            });
            showFormStatus('Target opgeslagen.', 'success');
            resetForm();
            fetchTargets();
        } catch (error) {
            console.error('Fout bij opslaan target:', error);
            showFormStatus('Opslaan mislukt. Controleer de invoer.', 'danger');
        }
    });

    $tableBody.on('click', '.update-row', async function() {
        const $row = $(this).closest('tr');
        const id = $row.data('id');
        const targetValue = $row.find('.target-input').val();
        const lengthValue = $row.find('.length-input').val();

        if (targetValue === '') {
            showTableStatus('Gewenste packs mag niet leeg zijn.', 'danger');
            return;
        }

        const houtsoortValue = $row.find('.houtsoort-input').val().trim();
        const dikteValue = $row.find('.dikte-input').val();
        const breedteValue = $row.find('.breedte-input').val();

        if (!houtsoortValue || dikteValue === '' || breedteValue === '') {
            showTableStatus('Houtsoort, dikte en breedte mogen niet leeg zijn.', 'danger');
            return;
        }

        const payload = {
            houtsoort: houtsoortValue,
            dikte: Number(dikteValue),
            breedte: Number(breedteValue),
            target_packs: Number(targetValue),
            desired_length: lengthValue === '' ? null : Number(lengthValue)
        };

        $(this).prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i>');
        showTableStatus('Opslaan...', 'muted');

        try {
            await $.ajax({
                url: `/api/target_stock/${id}`,
                method: 'PUT',
                contentType: 'application/json',
                data: JSON.stringify(payload)
            });
            showTableStatus('Wijziging opgeslagen.', 'success');
            fetchTargets();
        } catch (error) {
            console.error('Fout bij bijwerken target:', error);
            showTableStatus('Opslaan mislukt.', 'danger');
        } finally {
            $(this).prop('disabled', false).html('<i class="fas fa-save"></i>');
        }
    });

    $tableBody.on('click', '.delete-row', async function() {
        if (!confirm('Weet je zeker dat je deze target wilt verwijderen?')) {
            return;
        }
        const $row = $(this).closest('tr');
        const id = $row.data('id');

        $(this).prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i>');
        showTableStatus('Verwijderen...', 'muted');

        try {
            await $.ajax({ url: `/api/target_stock/${id}` , method: 'DELETE' });
            showTableStatus('Target verwijderd.', 'success');
            fetchTargets();
        } catch (error) {
            console.error('Fout bij verwijderen target:', error);
            showTableStatus('Verwijderen mislukt.', 'danger');
            $(this).prop('disabled', false).html('<i class="fas fa-trash-alt"></i>');
        }
    });

    $('#refresh-targets').on('click', function() {
        fetchTargets();
    });

    $('#search-box').on('input', function() {
        filterAndSearchData();
    });

    $('#filter-houtsoort').on('change', function() {
        filterAndSearchData();
    });

    $('#clear-filters').on('click', function() {
        $('#search-box').val('');
        $('#filter-houtsoort').val('');
        filterAndSearchData();
    });

    // Event handler voor sorteerbare kolommen
    $(document).on('click', '.sortable', function() {
        const column = $(this).data('column');
        sortData(column);
    });

    // Excel export functie - GLOBAAL beschikbaar maken
    window.exportToExcel = function() {
        console.log('=== exportToExcel() aangeroepen ===');
        console.log('Aantal gefilterde targets:', filteredTargets.length);
        console.log('XLSX beschikbaar:', typeof XLSX !== 'undefined');
        
        if (!filteredTargets || filteredTargets.length === 0) {
            alert('Geen data om te exporteren. Wacht tot de data is geladen.');
            return;
        }

        if (typeof XLSX === 'undefined') {
            alert('Excel bibliotheek is niet geladen. Herlaad de pagina en probeer opnieuw.');
            return;
        }

        try {
            // Bereid data voor Excel
            const excelData = filteredTargets.map(item => ({
                'Houtsoort': item.houtsoort || '',
                'Dikte (mm)': item.dikte || '',
                'Breedte (mm)': item.breedte || '',
                'Gewenste packs': item.target_packs || 0,
                'Lengte (mm)': item.desired_length || '',
                'Laatste update': item.updated_at ? new Date(item.updated_at).toLocaleString('nl-NL') : '-'
            }));

            console.log('Excel data voorbereid:', excelData.length, 'rijen');

            // Maak een nieuwe workbook
            const wb = XLSX.utils.book_new();
            
            // Converteer data naar worksheet
            const ws = XLSX.utils.json_to_sheet(excelData);

            // Stel kolombreedtes in
            const colWidths = [
                { wch: 15 }, // Houtsoort
                { wch: 12 }, // Dikte
                { wch: 15 }, // Breedte
                { wch: 18 }, // Gewenste packs
                { wch: 15 }, // Lengte
                { wch: 22 }  // Laatste update
            ];
            ws['!cols'] = colWidths;

            // Voeg autofilter toe
            if (ws['!ref']) {
                ws['!autofilter'] = { ref: ws['!ref'] };
            }

            // Voeg worksheet toe aan workbook
            XLSX.utils.book_append_sheet(wb, ws, 'Target Voorraad');

            // Genereer bestandsnaam met datum
            const today = new Date();
            const dateStr = today.getFullYear() + 
                           '-' + String(today.getMonth() + 1).padStart(2, '0') + 
                           '-' + String(today.getDate()).padStart(2, '0');
            const filename = `Target_Voorraad_${dateStr}.xlsx`;

            // Download het bestand
            console.log('Bestand wordt gedownload:', filename);
            XLSX.writeFile(wb, filename);
            
            showTableStatus('Excel bestand geëxporteerd!', 'success');
            setTimeout(() => showTableStatus(''), 3000);
        } catch (error) {
            console.error('Fout bij Excel export:', error);
            alert('Er is een fout opgetreden bij het exporteren: ' + error.message);
            showTableStatus('Export mislukt.', 'danger');
        }
    };

    // Excel export button handler - MEERDERE METHODES
    // Methode 1: Direct op de knop (als deze al bestaat)
    $('#export-excel').on('click', function(e) {
        e.preventDefault();
        console.log('=== Excel knop geklikt (direct) ===');
        window.exportToExcel();
    });

    // Methode 2: Event delegation (voor dynamisch geladen elementen)
    $(document).on('click', '#export-excel', function(e) {
        e.preventDefault();
        console.log('=== Excel knop geklikt (delegation) ===');
        if (typeof window.exportToExcel === 'function') {
            window.exportToExcel();
        } else {
            console.error('exportToExcel functie niet gevonden');
        }
    });

    // Initialiseer de pagina
    fetchTargets();
});