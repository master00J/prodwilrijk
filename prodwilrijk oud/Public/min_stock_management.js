$(document).ready(function() {
    // Laad de header dynamisch
    fetch('header.html')
        .then(response => response.text())
        .then(data => {
            $('#header-placeholder').html(data);
        });

    // Globale variabelen
    let minStockData = [];  // Minimale voorraadniveaus
    let stockData = [];     // Actuele voorraad
    let suggestionData = []; // Bestelvoorstellen

    // Notificatie functie
    function showNotification(type, message) {
        const notification = $('<div>')
            .addClass(`alert alert-${type} alert-dismissible fade show position-fixed`)
            .attr('role', 'alert')
            .css({
                top: '20px',
                right: '20px',
                zIndex: 1050,
                minWidth: '250px',
                boxShadow: '0 .5rem 1rem rgba(0,0,0,.15)'
            })
            .html(message);

        notification.append('<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>');
        $('body').append(notification);

        setTimeout(() => {
            const alertInstance = bootstrap.Alert.getInstance(notification[0]);
            if (alertInstance) {
                alertInstance.close();
            } else {
                notification.fadeOut(500, function() {
                    $(this).remove();
                });
            }
        }, 4000);
    }

    // Modal referentie opslaan
    const suggestionsModal = new bootstrap.Modal(document.getElementById('suggestions-modal'));

    // Haal minimale voorraadniveaus op
    function loadMinStockLevels() {
        $.ajax({
            url: '/api/min_stock',
            method: 'GET',
            success: function(data) {
                minStockData = data;
                
                // Haal ook actuele voorraad op
                loadCurrentStock().then(() => {
                    renderMinStockTable();
                });
            },
            error: function(err) {
                console.error('Error fetching min stock levels:', err);
                showNotification('danger', 'Kon de minimale voorraadniveaus niet laden.');
            }
        });
    }

    // Haal actuele voorraad op
    function loadCurrentStock() {
        return $.ajax({
            url: '/api/hout_stock',
            method: 'GET',
            success: function(data) {
                stockData = data;
            },
            error: function(err) {
                console.error('Error fetching stock:', err);
                showNotification('danger', 'Kon de huidige voorraad niet laden.');
            }
        });
    }

    // Bereken de totale voorraad voor een materiaaltype
    function calculateTotalStock(minStock) {
        const matchingStock = stockData.filter(item => 
            item.soort.toLowerCase() === minStock.soort.toLowerCase() &&
            (!minStock.dikte || item.dikte === minStock.dikte) &&
            (!minStock.breedte || item.breedte === minStock.breedte) &&
            // Check ook de minimale lengte als die is ingesteld
            (!minStock.min_lengte || item.lengte >= minStock.min_lengte)
        );
        
        return matchingStock.reduce((sum, item) => sum + item.aantal, 0);
    }

    // Toon de minimale voorraadniveaus in de tabel
    function renderMinStockTable() {
        const tbody = $('#min-stock-table tbody');
        tbody.empty();

        minStockData.forEach(item => {
            const currentStock = calculateTotalStock(item);
            const status = currentStock < item.min_aantal ? 
                '<span class="badge bg-danger">Onder minimum</span>' : 
                '<span class="badge bg-success">OK</span>';
            
            const row = $(`
                <tr data-id="${item.id}">
                    <td>${item.soort}</td>
                    <td>${item.dikte || '<em>Alle</em>'}</td>
                    <td>${item.breedte || '<em>Alle</em>'}</td>
                    <td>${item.min_lengte || '<em>N.v.t.</em>'}</td>
                    <td>${item.min_aantal}</td>
                    <td>${currentStock}</td>
                    <td>${status}</td>
                    <td>
                        <button class="edit-min-stock btn btn-sm btn-primary" data-id="${item.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="delete-min-stock btn btn-sm btn-danger" data-id="${item.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `);
            
            tbody.append(row);
        });
    }

    // Event handlers voor formulier
    $('#min-stock-form').on('submit', function(e) {
        e.preventDefault();
        
        const minStockData = {
            soort: $('#soort').val().trim(),
            dikte: $('#dikte').val() ? parseInt($('#dikte').val()) : null,
            breedte: $('#breedte').val() ? parseInt($('#breedte').val()) : null,
            min_lengte: $('#min_lengte').val() ? parseInt($('#min_lengte').val()) : null,
            min_aantal: parseInt($('#min_aantal').val())
        };
        
        $.ajax({
            url: '/api/min_stock',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(minStockData),
            success: function(response) {
                showNotification('success', 'Minimaal voorraadniveau opgeslagen');
                $('#min-stock-form')[0].reset();
                loadMinStockLevels(); // Herlaad de tabel
            },
            error: function(err) {
                console.error('Error saving min stock level:', err);
                showNotification('danger', 'Kon het minimale voorraadniveau niet opslaan');
            }
        });
    });

    // Event handler voor bewerkknop
    $(document).on('click', '.edit-min-stock', function() {
        const id = $(this).data('id');
        const minStock = minStockData.find(item => item.id === id);
        
        if (minStock) {
            // Vul formulier met huidige waarden
            $('#soort').val(minStock.soort);
            $('#dikte').val(minStock.dikte || '');
            $('#breedte').val(minStock.breedte || '');
            $('#min_lengte').val(minStock.min_lengte || '');
            $('#min_aantal').val(minStock.min_aantal);
            
            // Focus op eerste veld
            $('#soort').focus();
        }
    });

    // Event handler voor verwijderknop
    $(document).on('click', '.delete-min-stock', function() {
        const id = $(this).data('id');
        
        if (confirm('Weet u zeker dat u dit minimale voorraadniveau wilt verwijderen?')) {
            $.ajax({
                url: `/api/min_stock/${id}`,
                method: 'DELETE',
                success: function() {
                    showNotification('success', 'Minimaal voorraadniveau verwijderd');
                    loadMinStockLevels(); // Herlaad de tabel
                },
                error: function(err) {
                    console.error('Error deleting min stock level:', err);
                    showNotification('danger', 'Kon het minimale voorraadniveau niet verwijderen');
                }
            });
        }
    });

    // Event handler voor vernieuwknop
    $('#refresh-btn').on('click', function() {
        loadMinStockLevels();
    });

    // Event handler voor analyse-knop
    $('#run-analysis-btn').on('click', function() {
        const $btn = $(this);
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Bezig...');
        
        $.ajax({
            url: '/api/run_auto_order',
            method: 'POST',
            success: function(response) {
                showNotification('success', response.message);
                $btn.prop('disabled', false).html('<i class="fas fa-robot"></i> Analyse uitvoeren');
                
                // Als er nieuwe voorstellen zijn, open de modal
                if (response.suggestions && response.suggestions.length > 0) {
                    loadSuggestions().then(() => {
                        suggestionsModal.show();
                    });
                }
            },
            error: function(err) {
                console.error('Error running auto-order analysis:', err);
                showNotification('danger', 'Kon de auto-order analyse niet uitvoeren');
                $btn.prop('disabled', false).html('<i class="fas fa-robot"></i> Analyse uitvoeren');
            }
        });
    });

    // Event handler voor voorstellen bekijken
    $('#view-suggestions-btn').on('click', function() {
        loadSuggestions().then(() => {
            suggestionsModal.show();
        });
    });

    // Laad bestellingvoorstellen
    function loadSuggestions() {
        return $.ajax({
            url: '/api/auto_order_suggestions',
            method: 'GET',
            success: function(data) {
                suggestionData = data;
                renderSuggestionsTable();
            },
            error: function(err) {
                console.error('Error loading suggestions:', err);
                showNotification('danger', 'Kon de bestelvoorstellen niet laden');
            }
        });
    }

    // Toon de bestelvoorstellen in de tabel
    function renderSuggestionsTable() {
        const tbody = $('#suggestions-table tbody');
        tbody.empty();

        if (suggestionData.length === 0) {
            tbody.html('<tr><td colspan="6" class="text-center">Geen openstaande bestelvoorstellen</td></tr>');
            return;
        }

        suggestionData.forEach(item => {
            const dimensions = `${item.dikte || '-'} × ${item.breedte || '-'} × ${item.lengte || '-'} mm`;
            const date = new Date(item.created_at).toLocaleString('nl-BE');
            
            const row = $(`
                <tr>
                    <td><input type="checkbox" class="suggestion-checkbox" data-id="${item.id}"></td>
                    <td>${item.soort}</td>
                    <td>${dimensions}</td>
                    <td>${item.aantal}</td>
                    <td>${item.reden}</td>
                    <td>${date}</td>
                </tr>
            `);
            
            tbody.append(row);
        });

        // Update button states
        updateActionButtonStates();
    }

    // Event handler voor "select all" checkbox
    $('#select-all-suggestions').on('change', function() {
        const isChecked = $(this).prop('checked');
        $('.suggestion-checkbox').prop('checked', isChecked);
        updateActionButtonStates();
    });

    // Event handler voor individuele checkboxes
    $(document).on('change', '.suggestion-checkbox', function() {
        updateActionButtonStates();
        
        // Update "select all" checkbox state
        const allChecked = $('.suggestion-checkbox:checked').length === $('.suggestion-checkbox').length;
        $('#select-all-suggestions').prop('checked', allChecked);
    });

    // Update de status van de actie-knoppen
    function updateActionButtonStates() {
        const hasSelections = $('.suggestion-checkbox:checked').length > 0;
        $('#process-suggestions-btn, #reject-suggestions-btn').prop('disabled', !hasSelections);
    }

    // Event handler voor bestellen
    $('#process-suggestions-btn').on('click', function() {
        processSuggestions('bestellen');
    });

    // Event handler voor weigeren
    $('#reject-suggestions-btn').on('click', function() {
        processSuggestions('weigeren');
    });

    // Verwerk de geselecteerde voorstellen
    function processSuggestions(action) {
        const selectedIds = $('.suggestion-checkbox:checked').map(function() {
            return { id: $(this).val() };  // Zorg dat dit een object is met een id-eigenschap
        }).get();  // Zorg dat dit een array is
        
        console.log('Sending suggestions:', selectedIds);
        
        if (selectedIds.length === 0) {
            return;
        }
        
        const actionVerb = action === 'bestellen' ? 'bestellen' : 'weigeren';
        const confirmMsg = `Weet u zeker dat u de geselecteerde items wilt ${actionVerb}?`;
        
        if (confirm(confirmMsg)) {
            const $btn = action === 'bestellen' ? $('#process-suggestions-btn') : $('#reject-suggestions-btn');
            const originalHtml = $btn.html();
            
            $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Bezig...');
            
            $.ajax({
                url: '/api/auto_order_suggestions/process',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    suggestions: selectedIds,
                    action: action
                }),
                success: function(response) {
                    showNotification('success', response.message);
                    
                    // Vernieuw de lijst
                    loadSuggestions();
                    
                    // Als alles besteld/geweigerd is, sluit de modal
                    if ($('.suggestion-checkbox').length === selectedIds.length) {
                        suggestionsModal.hide();
                    }
                    
                    $btn.html(originalHtml);
                    updateActionButtonStates();
                },
                error: function(err) {
                    console.error(`Error ${action} suggestions:`, err);
                    showNotification('danger', `Kon de geselecteerde voorstellen niet ${actionVerb}`);
                    $btn.prop('disabled', false).html(originalHtml);
                }
            });
        }
    }

    // Initialisatie
    loadMinStockLevels();
}); 