<!DOCTYPE html>
<html lang="nl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>E-Bodems Beheer</title>
    
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css" rel="stylesheet">
    
    <style>
        body {
            background-color: #f7f7f7;
        }

        .table {
            margin-bottom: 0;
        }

        .table th, .table td {
            padding: 0.75rem;
            vertical-align: middle;
        }

        .table thead th {
            background-color: #f8f9fa;
            border-bottom: 2px solid #dee2e6;
            font-weight: 500;
            padding-top: 0.75rem;
            padding-bottom: 0.75rem;
            text-align: left;
            white-space: nowrap;
        }

        .actions-bar {
            padding: 1rem;
            background: white;
            border-radius: 4px;
            margin-bottom: 1rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }

        .form-container {
            background: white;
            padding: 1.5rem;
            border-radius: 4px;
            margin-bottom: 1rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }

        .status-goed {
            background-color: rgba(25, 135, 84, 0.1);
        }

        .status-reparatie {
            background-color: rgba(255, 193, 7, 0.1);
        }

        .status-afval {
            background-color: rgba(220, 53, 69, 0.1);
        }

        .card {
            margin-bottom: 1rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            transition: transform 0.2s;
            border: none;
        }

        .card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }

        .stats-card {
            background: white;
            padding: 1.5rem;
            border-radius: 4px;
            text-align: center;
        }

        .stats-number {
            font-size: 2rem;
            font-weight: bold;
            color: #0d6efd;
            margin: 0.5rem 0;
        }

        .filter-section {
            background: white;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 15px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }

        .nav-tabs .nav-item .nav-link {
            border: none;
            font-weight: 500;
            color: #495057;
            padding: 0.75rem 1rem;
        }

        .nav-tabs .nav-item .nav-link.active {
            color: #0d6efd;
            background-color: #fff;
            border-bottom: 3px solid #0d6efd;
        }

        .location-badge {
            display: inline-block;
            padding: 0.25em 0.5em;
            border-radius: 0.25rem;
            font-size: 0.75em;
            font-weight: 700;
            text-transform: uppercase;
            margin-right: 0.5rem;
        }
        
        .location-wilrijk {
            background-color: #cfe2ff;
            color: #084298;
        }
        
        .location-genk {
            background-color: #d1e7dd;
            color: #0f5132;
        }

        .excel-export-btn {
            background-color: #1d6f42;
            border-color: #1d6f42;
        }

        .excel-export-btn:hover {
            background-color: #18593a;
            border-color: #18593a;
        }

        .transfer-details {
            display: none;
        }

        .transfer-row {
            cursor: pointer;
        }

        .transfer-row:hover {
            background-color: #f8f9fa;
        }

        .transfer-row.active {
            background-color: #e9f2ff;
        }

        @media (max-width: 768px) {
            .actions-bar {
                flex-direction: column;
                gap: 1rem;
                text-align: center;
            }
            
            .container-fluid {
                padding: 0.5rem;
            }
        }
    </style>
</head>
<body>
    <div id="header-placeholder"></div>

    <div class="container-fluid py-3">
        <!-- Stats Dashboard -->
        <div class="row mb-4">
            <div class="col-md-3">
                <div class="card stats-card">
                    <div class="card-body">
                        <h6 class="text-muted">Totale Voorraad Waarde (<span id="current-location">Wilrijk Voorraad</span>)</h6>
                        <div id="total-value" class="stats-number">€0.00</div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card stats-card">
                    <div class="card-body">
                        <h6 class="text-muted">Totaal Aantal Items</h6>
                        <div id="total-items" class="stats-number">0</div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card stats-card">
                    <div class="card-body">
                        <h6 class="text-muted">Unieke Items</h6>
                        <div id="unique-items" class="stats-number">0</div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card stats-card">
                    <div class="card-body">
                        <h6 class="text-muted">Open Transporten</h6>
                        <div id="pending-transports" class="stats-number">0</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Main Tabs -->
        <ul class="nav nav-tabs" id="mainTabs" role="tablist">
            <li class="nav-item" role="presentation">
                <button class="nav-link active" id="voorraad-tab" data-bs-toggle="tab" data-bs-target="#voorraad-content" type="button" role="tab" aria-controls="voorraad-content" aria-selected="true">
                    <i class="fas fa-warehouse me-2"></i>Voorraad
                </button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link" id="transfers-tab" data-bs-toggle="tab" data-bs-target="#transfers-content" type="button" role="tab" aria-controls="transfers-content" aria-selected="false">
                    <i class="fas fa-exchange-alt me-2"></i>Transfers
                </button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link" id="movements-tab" data-bs-toggle="tab" data-bs-target="#movements-content" type="button" role="tab" aria-controls="movements-content" aria-selected="false">
                    <i class="fas fa-history me-2"></i>Bewegingen
                </button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link" id="ontvangst-tab" data-bs-toggle="tab" data-bs-target="#ontvangst-content" type="button" role="tab" aria-controls="ontvangst-content" aria-selected="false">
                    <i class="fas fa-box me-2"></i>Ontvangst
                </button>
            </li>
        </ul>

        <!-- Tab Content -->
        <div class="tab-content" id="mainTabsContent">
            <!-- Voorraad Tab -->
            <div class="tab-pane fade show active" id="voorraad-content" role="tabpanel" aria-labelledby="voorraad-tab">
                <!-- Voorraad Tabs -->
                <ul class="nav nav-pills mt-3 mb-3" id="voorraadTabs" role="tablist">
                    <li class="nav-item" role="presentation">
                        <button class="nav-link active" id="wilrijk-tab" data-bs-toggle="pill" data-bs-target="#wilrijk-voorraad" type="button" role="tab" aria-controls="wilrijk-voorraad" aria-selected="true">
                            Wilrijk Voorraad
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="genk-tab" data-bs-toggle="pill" data-bs-target="#genk-voorraad" type="button" role="tab" aria-controls="genk-voorraad" aria-selected="false">
                            Genk Voorraad
                        </button>
                    </li>
                </ul>
                
                <!-- Voorraad Pill Content -->
                <div class="tab-content" id="voorraadTabsContent">
                    <!-- Wilrijk Voorraad -->
                    <div class="tab-pane fade show active" id="wilrijk-voorraad" role="tabpanel" aria-labelledby="wilrijk-tab">
                        <div class="actions-bar">
                            <div class="d-flex align-items-center">
                                <input type="text" id="search-input-wilrijk" class="form-control me-2" 
                                       placeholder="Zoeken op BC Code of Referentie">
                                <select id="staat-filter-wilrijk" class="form-select">
                                    <option value="">Alle Staten</option>
                                    <option value="goed">Goede staat</option>
                                    <option value="reparatie">Te repareren</option>
                                    <option value="afval">Afval</option>
                                </select>
                            </div>
                            <div>
                                <button class="btn btn-success excel-export-btn me-2" id="export-wilrijk-excel">
                                    <i class="fas fa-file-excel me-1"></i> Excel Export
                                </button>
                                <button class="btn btn-sm btn-primary export-pdf me-2" 
                                        data-location="wilrijk" 
                                        data-bs-toggle="tooltip" 
                                        title="Exporteer Wilrijk voorraad als PDF">
                                    <i class="fas fa-file-pdf me-1"></i> PDF Export
                                </button>
                                <button id="add-stock-button-wilrijk" class="btn btn-primary me-2">
                                    <i class="fas fa-plus me-1"></i>Voorraad Toevoegen
                                </button>
                                <button id="bulk-transfer-button-wilrijk" class="btn btn-info">
                                    <i class="fas fa-exchange-alt me-1"></i>Transfer Geselecteerde
                                </button>
                            </div>
                        </div>

                        <div class="table-responsive mt-3">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th><input type="checkbox" id="select-all-wilrijk"></th>
                                        <th>BC code</th>
                                        <th>Revisie</th>
                                        <th>Referentie</th>
                                        <th>Aantal</th>
                                        <th>Staat</th>
                                        <th>Verkoopprijs</th>
                                        <th>Totale Waarde</th>
                                        <th>Acties</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <!-- Data wordt dynamisch ingevuld -->
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Genk Voorraad -->
                    <div class="tab-pane fade" id="genk-voorraad" role="tabpanel" aria-labelledby="genk-tab">
                        <div class="actions-bar">
                            <div class="d-flex align-items-center">
                                <input type="text" id="search-input-genk" class="form-control me-2" 
                                       placeholder="Zoeken op BC code of Referentie">
                                <select id="staat-filter-genk" class="form-select">
                                    <option value="">Alle Staten</option>
                                    <option value="goed">Goede staat</option>
                                    <option value="reparatie">Te repareren</option>
                                    <option value="afval">Afval</option>
                                </select>
                            </div>
                            <div>
                                <button class="btn btn-success excel-export-btn me-2" id="export-genk-excel">
                                    <i class="fas fa-file-excel me-1"></i> Excel Export
                                </button>
                                <button class="btn btn-sm btn-primary export-pdf me-2" 
                                        data-location="genk" 
                                        data-bs-toggle="tooltip" 
                                        title="Exporteer Genk voorraad als PDF">
                                    <i class="fas fa-file-pdf me-1"></i> PDF Export
                                </button>
                                <button id="add-stock-button-genk" class="btn btn-primary me-2">
                                    <i class="fas fa-plus me-1"></i>Voorraad Toevoegen
                                </button>
                                <button id="bulk-transfer-button-genk" class="btn btn-info">
                                    <i class="fas fa-exchange-alt me-1"></i>Transfer Geselecteerde
                                </button>
                            </div>
                        </div>

                        <div class="table-responsive mt-3">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th><input type="checkbox" id="select-all-genk"></th>
                                        <th>BC Code</th>
                                        <th>Revisie</th>
                                        <th>Referentie</th>
                                        <th>Aantal</th>
                                        <th>Staat</th>
                                        <th>TO Nummer</th>
                                        <th>Verkoopprijs</th>
                                        <th>Totale Waarde</th>
                                        <th>Acties</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <!-- Data wordt dynamisch ingevuld -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Transfers Tab -->
            <div class="tab-pane fade" id="transfers-content" role="tabpanel" aria-labelledby="transfers-tab">
                <div class="card mt-3">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h5 class="mb-0">Transfers Overzicht</h5>
                        <div>
                            <button class="btn btn-success excel-export-btn" id="export-transfers-excel">
                                <i class="fas fa-file-excel me-1"></i> Exporteer naar Excel
                            </button>
                        </div>
                    </div>
                    <div class="card-body">
                        <!-- Filters -->
                        <div class="filter-section">
                            <div class="row g-3">
                                <div class="col-md-3">
                                    <label class="form-label">Van Datum</label>
                                    <input type="date" class="form-control" id="transfer-date-from">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label">Tot Datum</label>
                                    <input type="date" class="form-control" id="transfer-date-to">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">Zoeken (BC Code/Referentie)</label>
                                    <input type="text" class="form-control" id="transfer-search-input" placeholder="Zoeken...">
                                </div>
                                <div class="col-md-2 d-flex align-items-end">
                                    <button class="btn btn-primary w-100" id="transfer-search-button">
                                        <i class="fas fa-search me-2"></i>Zoeken
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Transfers Table -->
                        <div class="row mt-3">
                            <div class="col-md-12">
                                <div class="table-responsive">
                                    <table class="table table-hover" id="transfers-table">
                                        <thead>
                                            <tr>
                                                <th>Datum</th>
                                                <th>BC Code</th>
                                                <th>Referentie</th>
                                                <th>Van</th>
                                                <th>Naar</th>
                                                <th>Aantal</th>
                                                <th>Staat</th>
                                                <th>Stukprijs</th>
                                                <th>Totale Waarde</th>
                                                <th>Acties</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <!-- Transfers worden hier dynamisch ingeladen -->
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Movements Tab -->
            <div class="tab-pane fade" id="movements-content" role="tabpanel" aria-labelledby="movements-tab">
                <div class="card mt-3">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h5 class="mb-0">Bewegingen Overzicht</h5>
                        <div>
                            <button class="btn btn-success excel-export-btn" id="export-movements-excel">
                                <i class="fas fa-file-excel me-1"></i> Exporteer naar Excel
                            </button>
                        </div>
                    </div>
                    <div class="card-body">
                        <!-- Filters -->
                        <div class="filter-section">
                            <div class="row g-3">
                                <div class="col-md-3">
                                    <label class="form-label">Van Datum</label>
                                    <input type="date" class="form-control" id="date-from">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label">Tot Datum</label>
                                    <input type="date" class="form-control" id="date-to">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">Type Beweging</label>
                                    <select class="form-select" id="movement-type-filter">
                                        <option value="">Alle Types</option>
                                        <option value="transfer">Transfer</option>
                                        <option value="state_change">Staat Wijziging</option>
                                        <option value="usage">Verbruik</option>
                                        <option value="addition">Toevoeging</option>
                                    </select>
                                </div>
                                <div class="col-md-2 d-flex align-items-end">
                                    <button class="btn btn-primary w-100" id="apply-movement-filters">
                                        <i class="fas fa-filter me-2"></i>Filter
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Movements Table -->
                        <div class="table-responsive mt-3">
                            <table class="table table-hover" id="movements-table">
                                <thead>
                                    <tr>
                                        <th>Datum</th>
                                        <th>BC Code</th>
                                        <th>Type</th>
                                        <th>Van</th>
                                        <th>Naar</th>
                                        <th>Aantal</th>
                                        <th>Staat</th>
                                        <th>Stukprijs</th>
                                        <th>Totale Waarde</th>
                                        <th>TO Nummer</th>
                                        <th>Opmerkingen</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <!-- Bewegingen worden hier dynamisch ingeladen -->
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colspan="8" class="text-end"><strong>Totale Waarde:</strong></td>
                                        <td id="total-movement-value" colspan="3">€0.00</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Ontvangst Tab -->
            <div class="tab-pane fade" id="ontvangst-content" role="tabpanel" aria-labelledby="ontvangst-tab">
                <div class="row mt-3">
                    <div class="col-md-4">
                        <div class="card">
                            <div class="card-header">
                                <h5 class="mb-0">Nieuwe Ontvangst Registreren</h5>
                            </div>
                            <div class="card-body">
                                <form id="ontvangstForm">
                                    <div class="mb-3">
                                        <label class="form-label">Bodem Type</label>
                                        <select class="form-select" id="bodemType" required>
                                            <option value="">Selecteer bodem...</option>
                                        </select>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Aantal</label>
                                        <input type="number" class="form-control" id="aantal" required min="1">
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Staat</label>
                                        <select class="form-select" id="staat" required>
                                            <option value="goed">Goede staat</option>
                                            <option value="reparatie">Te repareren</option>
                                            <option value="afval">Afval</option>
                                        </select>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Opmerkingen</label>
                                        <textarea class="form-control" id="opmerkingen" rows="2"></textarea>
                                    </div>
                                    <button type="submit" class="btn btn-primary w-100">
                                        <i class="fas fa-save me-2"></i>Registreer Ontvangst
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-8">
                        <div class="card">
                            <div class="card-header d-flex justify-content-between align-items-center">
                                <h5 class="mb-0">Overzicht Ontvangsten</h5>
                                <button class="btn btn-success excel-export-btn" id="export-ontvangsten-excel">
                                    <i class="fas fa-file-excel me-1"></i> Exporteer naar Excel
                                </button>
                            </div>
                            <div class="card-body p-0">
                                <div class="table-responsive">
                                    <table class="table" id="ontvangstTabel">
                                        <thead>
                                            <tr>
                                                <th>Datum</th>
                                                <th>BC Code</th>
                                                <th>Revisie</th>
                                                <th>Referentie</th>
                                                <th>Aantal</th>
                                                <th>Staat</th>
                                                <th>Opmerkingen</th>
                                                <th>Status</th>
                                                <th>Selecteer</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <!-- Data wordt hier dynamisch ingevuld -->
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div class="card mt-3">
                            <div class="card-header">
                                <h5 class="mb-0">Transport Registreren</h5>
                            </div>
                            <div class="card-body">
                                <form id="transportForm">
                                    <div class="row g-3">
                                        <div class="col-md-4">
                                            <label class="form-label">TO Nummer</label>
                                            <input type="text" class="form-control" id="TONummer" required>
                                        </div>
                                        <div class="col-md-8">
                                            <label class="form-label">Opmerkingen</label>
                                            <textarea class="form-control" id="transportOpmerkingen" rows="1"></textarea>
                                        </div>
                                        <div class="col-12">
                                            <button type="submit" class="btn btn-success">
                                                <i class="fas fa-truck me-2"></i>Registreer Transport
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Modals -->

    <!-- Details Modal -->
    <div class="modal fade" id="detailsModal" tabindex="-1" aria-labelledby="detailsModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-xl">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        <i class="fas fa-info-circle me-2"></i>Item Details
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Sluiten"></button>
                </div>
                <div class="modal-body">
                    <!-- Inhoud wordt dynamisch geladen -->
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <i class="fas fa-times me-2"></i>Sluiten
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Transfer Details Modal -->
    <div class="modal fade" id="transferDetailsModal" tabindex="-1" aria-labelledby="transferDetailsModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        <i class="fas fa-exchange-alt me-2"></i>Transfer Details
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Sluiten"></button>
                </div>
                <div class="modal-body">
                    <div class="row mb-3">
                        <div class="col-md-6">
                            <p><strong>Datum:</strong> <span id="transfer-detail-date"></span></p>
                            <p><strong>BC Code:</strong> <span id="transfer-detail-glovia"></span></p>
                            <p><strong>Referentie:</strong> <span id="transfer-detail-referentie"></span></p>
                        </div>
                        <div class="col-md-6">
                            <p><strong>Van:</strong> <span id="transfer-detail-from"></span></p>
                            <p><strong>Naar:</strong> <span id="transfer-detail-to"></span></p>
                            <p><strong>Aantal:</strong> <span id="transfer-detail-amount"></span></p>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-12">
                            <p><strong>Staat:</strong> <span id="transfer-detail-state"></span></p>
                            <p><strong>Verkoopprijs:</strong> <span id="transfer-detail-price"></span></p>
                            <p><strong>Totale Waarde:</strong> <span id="transfer-detail-total"></span></p>
                            <p><strong>Opmerkingen:</strong> <span id="transfer-detail-remarks"></span></p>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <i class="fas fa-times me-2"></i>Sluiten
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Staat Wijzigen Modal -->
    <div class="modal fade" id="staatWijzigenModal" tabindex="-1" aria-labelledby="staatWijzigenModalLabel" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        <i class="fas fa-exchange-alt me-2"></i>Staat Wijzigen
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Sluiten"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label for="aantal-staat-wijzigen" class="form-label">Aantal</label>
                        <input type="number" class="form-control" id="aantal-staat-wijzigen" min="1" required>
                    </div>
                    <div class="mb-3">
                        <label for="nieuwe-staat" class="form-label">Nieuwe Staat</label>
                        <select class="form-select" id="nieuwe-staat" required>
                            <option value="goed">Goede staat</option>
                            <option value="reparatie">Te repareren</option>
                            <option value="afval">Afval</option>
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <i class="fas fa-times me-2"></i>Annuleren
                    </button>
                    <button type="button" class="btn btn-primary" id="bevestig-staat-wijziging">
                        <i class="fas fa-check me-2"></i>Wijzigen
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Add Stock Modal -->
    <div class="modal fade" id="addStockModal" tabindex="-1" aria-labelledby="addStockModalLabel" aria-hidden="true">
        <div class="modal-dialog">
            <form id="add-stock-form">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-plus me-2"></i>Voorraad Toevoegen
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Sluiten"></button>
                    </div>
                    <div class="modal-body">
                        <!-- Formulier velden -->
                        <div class="mb-3">
                            <label for="add-stock-bodem-id" class="form-label">Bodem</label>
                            <select class="form-select" id="add-stock-bodem-id" required>
                                <option value="">Selecteer een bodem</option>
                                <!-- Dynamisch gegenereerde opties -->
                            </select>
                        </div>
                        <div class="mb-3">
                            <label for="add-stock-amount" class="form-label">Aantal</label>
                            <input type="number" class="form-control" id="add-stock-amount" min="1" required>
                        </div>
                        <div class="mb-3">
                            <label for="add-stock-state" class="form-label">Staat</label>
                            <select class="form-select" id="add-stock-state" required>
                                <option value="goed">Goede staat</option>
                                <option value="reparatie">Te repareren</option>
                                <option value="afval">Afval</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label for="add-stock-location" class="form-label">Locatie</label>
                            <select class="form-select" id="add-stock-location" required>
                                <option value="wilrijk">Wilrijk</option>
                                <option value="genk">Genk</option>
                            </select>
                        </div>
                        <div class="mb-3" id="add-stock-TO_nummer-container" style="display: none;">
                            <label for="add-stock-TO_nummer" class="form-label">TO Nummer</label>
                            <input type="text" class="form-control" id="add-stock-TO_nummer">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            <i class="fas fa-times me-2"></i>Annuleren
                        </button>
                        <button type="button" class="btn btn-primary" id="confirm-add-stock">
                            <i class="fas fa-check me-2"></i>Toevoegen
                        </button>
                    </div>
                </div>
            </form>
        </div>
    </div>

    <!-- Bulk Transfer Modal -->
    <div class="modal fade" id="bulkTransferModal" tabindex="-1" aria-labelledby="bulkTransferModalLabel" aria-hidden="true">
        <div class="modal-dialog">
            <form id="bulk-transfer-form">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-exchange-alt me-2"></i>Geselecteerde Items Transfereren
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Sluiten"></button>
                    </div>
                    <div class="modal-body">
                        <p>De volgende items zullen worden getransfereerd:</p>
                        <ul id="bulk-transfer-item-list"></ul>
                        <div class="mb-3">
                            <label for="bulk-transfer-to-location" class="form-label">Naar Locatie</label>
                            <select class="form-select" id="bulk-transfer-to-location" required>
                                <option value="wilrijk">Wilrijk</option>
                                <option value="genk">Genk</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            <i class="fas fa-times me-2"></i>Annuleren
                        </button>
                        <button type="button" class="btn btn-primary" id="confirm-bulk-transfer">
                            <i class="fas fa-check me-2"></i>Transfereren
                        </button>
                    </div>
                </div>
            </form>
        </div>
    </div>

    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
    
    <script>
        $(document).ready(function() {
            // Globale variabelen
            let currentLocation = 'wilrijk';
            let voorraadData = [];
            let filteredData = [];

            // Header laden
            $.get('/header.html', function(data) {
                $('#header-placeholder').html(data);
                
                // Bootstrap componenten initialiseren
                var dropdowns = [].slice.call(document.querySelectorAll('.dropdown-toggle'));
                dropdowns.map(function(dropdownToggleEl) {
                    return new bootstrap.Dropdown(dropdownToggleEl);
                });

                // Navbar toggler initialiseren
                var navbarToggler = document.querySelector('.navbar-toggler');
                if (navbarToggler) {
                    new bootstrap.Collapse(document.querySelector('.navbar-collapse'), {
                        toggle: false
                    });
                }
            }).fail(function(error) {
                console.error('Error loading header:', error);
            });

            // Tooltips initialiseren
            var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
            tooltipTriggerList.map(function (tooltipTriggerEl) {
                return new bootstrap.Tooltip(tooltipTriggerEl);
            });

            // Dashboard statistieken laden
            function loadDashboardStats() {
                $.ajax({
                    url: '/api/e_bodems/stats',
                    method: 'GET',
                    success: function(stats) {
                        $('#total-value').text(formatCurrency(stats.totaleWaarde || 0));
                        $('#unique-items').text(stats.uniqueItems || 0);
                        $('#total-items').text(stats.totalItems || 0);
                        $('#pending-transports').text(stats.pendingTransports || 0);
                    },
                    error: function(err) {
                        console.error('Error loading stats:', err);
                        showNotification('Fout bij laden van statistieken', 'error');
                    }
                });
            }

            // Laad bodem types in de dropdown
            // Laad bodem types in de dropdown (gesorteerd op E-nummer)
function loadBodemTypes() {
    $.ajax({
        url: '/api/e_bodems',
        method: 'GET',
        success: function(data) {
            const select = $('#bodemType');
            select.empty().append('<option value="">Selecteer bodem...</option>');
            
            const addStockSelect = $('#bodemDropdown');
            if(addStockSelect.length > 0) {
                addStockSelect.empty().append('<option value="">Selecteer bodem...</option>');
            }
            
            // Sort by E-number numerically
            data.sort((a, b) => {
                // Extract E-numbers
                const eNumPatternA = a.referentie.match(/E(\d+)/);
                const eNumPatternB = b.referentie.match(/E(\d+)/);
                
                // Get numeric values
                const eNumA = eNumPatternA ? parseInt(eNumPatternA[1]) : 0;
                const eNumB = eNumPatternB ? parseInt(eNumPatternB[1]) : 0;
                
                // Compare numerically
                return eNumA - eNumB;
            });
            
            // Populate sorted dropdown
            data.forEach(bodem => {
                const optionText = `${bodem.glovia_code} - ${bodem.referentie}`;
                select.append(`<option value="${bodem.id}">${optionText}</option>`);
                
                if(addStockSelect.length > 0) {
                    addStockSelect.append(`<option value="${bodem.id}">${optionText}</option>`);
                }
            });
        },
        error: function(err) {
            console.error('Error loading bodem types:', err);
            showNotification('Fout bij laden van bodem types', 'error');
        }
    });
}

            // Voorraad laden
            function loadVoorraad(locatie = 'wilrijk') {
                const url = locatie === 'wilrijk' ? '/api/e_bodems/voorraad' : '/api/e_bodems/voorraad/genk';

                $.ajax({
                    url: url,
                    method: 'GET',
                    success: function(data) {
                        voorraadData = data;
                        filteredData = [...data];
                        renderVoorraadTabel(data, locatie);
                        updateTotalen(data);
                    },
                    error: function(err) {
                        console.error('Error loading voorraad:', err);
                        showNotification('Fout bij laden van voorraad', 'error');
                    }
                });
            }

            // Voorraad tabel renderen met selectievakjes
            function renderVoorraadTabel(data, locatie) {
                const tableId = locatie === 'wilrijk' ? '#wilrijk-voorraad' : '#genk-voorraad';
                const table = $(`${tableId} .table-responsive table tbody`);

                table.empty();

                // Groepeer items op glovia_code en staat
                const groupedData = data.reduce((acc, item) => {
                    const key = `${item.glovia_code}-${item.staat}`;
                    if (!acc[key]) {
                        acc[key] = {
                            ...item,
                            aantal: 0,
                            totale_waarde: 0,
                            ids: [],
                            TO_nummer: item.TO_nummer,
                            bodem_id: item.bodem_id
                        };
                    }
                    acc[key].aantal += parseInt(item.aantal);
                    acc[key].totale_waarde += parseFloat(item.totale_waarde || (item.aantal * item.verkoopprijs));
                    acc[key].ids.push(item.id);
                    if (item.TO_nummer) {
                        acc[key].TO_nummer = item.TO_nummer;
                    }
                    return acc;
                }, {});

                // Converteer terug naar array en render
                Object.values(groupedData).forEach(item => {
                    if (locatie === 'wilrijk') {
                        table.append(`
                            <tr class="status-${item.staat}">
                                <td><input type="checkbox" class="select-item" data-id="${item.ids[0]}" data-bodem-id="${item.bodem_id}" data-max-aantal="${item.aantal}" data-state="${item.staat}"></td>
                                <td>${item.glovia_code}</td>
                                <td>${item.revisie || '-'}</td>
                                <td>${item.referentie || '-'}</td>
                                <td>${item.aantal}</td>
                                <td>${formatStaat(item.staat)}</td>
                                <td>${formatCurrency(item.verkoopprijs)}</td>
                                <td>${formatCurrency(item.totale_waarde)}</td>
                                <td>
                                    <div class="btn-group">
                                        <button class="btn btn-sm btn-info view-details" data-id="${item.ids[0]}">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                        <button class="btn btn-sm btn-warning change-state" 
                                                data-id="${item.ids[0]}" 
                                                data-aantal="${item.aantal}">
                                            <i class="fas fa-exchange-alt"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `);
                    } else {
                        table.append(`
                            <tr class="status-${item.staat}">
                                <td><input type="checkbox" class="select-item" data-id="${item.ids[0]}" data-bodem-id="${item.bodem_id}" data-max-aantal="${item.aantal}" data-state="${item.staat}"></td>
                                <td>${item.glovia_code}</td>
                                <td>${item.revisie || '-'}</td>
                                <td>${item.referentie || '-'}</td>
                                <td>${item.aantal}</td>
                                <td>${formatStaat(item.staat)}</td>
                                <td>${item.TO_nummer || '-'}</td>
                                <td>${formatCurrency(item.verkoopprijs)}</td>
                                <td>${formatCurrency(item.totale_waarde)}</td>
                                <td>
                                    <div class="btn-group">
                                        <button class="btn btn-sm btn-info view-details" data-id="${item.ids[0]}">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                        <button class="btn btn-sm btn-warning change-state" 
                                                data-id="${item.ids[0]}" 
                                                data-aantal="${item.aantal}">
                                            <i class="fas fa-exchange-alt"></i>
                                        </button>
                                        <button class="btn btn-sm btn-danger register-usage" 
                                                data-id="${item.ids[0]}" 
                                                data-aantal="${item.aantal}">
                                            <i class="fas fa-minus"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `);
                    }
                });
            }

            // Totalen bijwerken
            function updateTotalen(data) {
                let totaleWaarde = 0;
                let totaalAantal = 0;

                data.forEach(item => {
                    totaleWaarde += parseFloat(item.totale_waarde || (item.aantal * item.verkoopprijs));
                    totaalAantal += parseInt(item.aantal);
                });

                $('#total-value').text(formatCurrency(totaleWaarde));
                $('#total-items').text(totaalAantal);
                $('#current-location').text(currentLocation === 'wilrijk' ? 'Wilrijk Voorraad' : 'Genk Voorraad');
            }

            // Load transfers met filters
            function loadTransfers() {
                const dateFrom = $('#transfer-date-from').val();
                const dateTo = $('#transfer-date-to').val();
                const searchInput = $('#transfer-search-input').val().toLowerCase();

                const params = new URLSearchParams();
                if (dateFrom) params.append('dateFrom', dateFrom);
                if (dateTo) params.append('dateTo', dateTo);
                if (searchInput) params.append('search', searchInput);

                $.ajax({
                    url: `/api/e_bodems/transfers?${params.toString()}`,
                    method: 'GET',
                    success: function(transfers) {
                        const tbody = $('#transfers-table tbody');
                        tbody.empty();

                        if (!transfers || transfers.length === 0) {
                            tbody.append(`
                                <tr>
                                    <td colspan="10" class="text-center">Geen transfers gevonden</td>
                                </tr>
                            `);
                            return;
                        }

                        transfers.forEach(transfer => {
                            // Bereken totale waarde als prijs beschikbaar is
                            const prijs = parseFloat(transfer.verkoopprijs) || 0;
                            const totaleWaarde = prijs * parseInt(transfer.amount, 10);

                            tbody.append(`
                                <tr class="transfer-row status-${transfer.state}">
                                    <td>${formatDate(transfer.timestamp)}</td>
                                    <td>${transfer.glovia_code}</td>
                                    <td>${transfer.referentie || '-'}</td>
                                    <td>${formatLocation(transfer.from_location)}</td>
                                    <td>${formatLocation(transfer.to_location)}</td>
                                    <td>${transfer.amount}</td>
                                    <td>${formatStaat(transfer.state)}</td>
                                    <td>${formatCurrency(prijs)}</td>
                                    <td>${formatCurrency(totaleWaarde)}</td>
                                    <td>
                                        <button class="btn btn-sm btn-info view-transfer-details" data-id="${transfer.id}">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                    </td>
                                </tr>
                            `);
                        });

                        // Event listeners voor transfer details
                        $('.view-transfer-details').on('click', function() {
                            const transferId = $(this).data('id');
                            const transferData = transfers.find(t => t.id === transferId);
                            
                            if (transferData) {
                                showTransferDetails(transferData);
                            }
                        });
                    },
                    error: function(err) {
                        console.error('Error loading transfers:', err);
                        $('#transfers-table tbody').html(`
                            <tr>
                                <td colspan="10" class="text-center text-danger">
                                    Fout bij laden van transfers: ${err.responseJSON?.message || err.statusText}
                                </td>
                            </tr>
                        `);
                        showNotification('Fout bij laden van transfers', 'error');
                    }
                });
            }

            // Toon transfer details
            function showTransferDetails(transfer) {
                $('#transfer-detail-date').text(formatDate(transfer.timestamp));
                $('#transfer-detail-glovia').text(transfer.glovia_code);
                $('#transfer-detail-referentie').text(transfer.referentie || '-');
                $('#transfer-detail-from').text(formatLocation(transfer.from_location));
                $('#transfer-detail-to').text(formatLocation(transfer.to_location));
                $('#transfer-detail-amount').text(transfer.amount);
                $('#transfer-detail-state').text(formatStaat(transfer.state));
                $('#transfer-detail-price').text(formatCurrency(transfer.verkoopprijs));
                $('#transfer-detail-total').text(formatCurrency(transfer.amount * transfer.verkoopprijs));
                $('#transfer-detail-remarks').text(transfer.remarks || '-');

                const modal = new bootstrap.Modal(document.getElementById('transferDetailsModal'));
                modal.show();
            }

            // Load movements
            function loadMovements() {
                const dateFrom = $('#date-from').val();
                const dateTo = $('#date-to').val();
                const movementType = $('#movement-type-filter').val();

                // Bouw query parameters
                const params = new URLSearchParams();
                if (dateFrom) params.append('dateFrom', dateFrom);
                if (dateTo) params.append('dateTo', dateTo);
                if (movementType) params.append('type', movementType);

                const url = `/api/e_bodems/movements?${params.toString()}`;

                $.ajax({
                    url: url,
                    method: 'GET',
                    success: function(movements) {
                        const tbody = $('#movements-table tbody');
                        tbody.empty();

                        if (!movements || movements.length === 0) {
                            tbody.append(`
                                <tr>
                                    <td colspan="11" class="text-center">Geen bewegingen gevonden</td>
                                </tr>
                            `);
                            $('#total-movement-value').text(formatCurrency(0));
                            return;
                        }

                        let totalValue = 0;

                        movements.forEach(movement => {
                            const movementValue = parseFloat(movement.movement_value) || 0;
                            totalValue += movementValue;

                            tbody.append(`
                                <tr>
                                    <td>${formatDate(movement.timestamp)}</td>
                                    <td>${movement.glovia_code}</td>
                                    <td>${formatMovementType(movement.movement_type)}</td>
                                    <td>${formatLocation(movement.from_location)}</td>
                                    <td>${formatLocation(movement.to_location)}</td>
                                    <td>${movement.amount}</td>
                                    <td>${formatStaat(movement.state)}</td>
                                    <td>${formatCurrency(movement.verkoopprijs)}</td>
                                    <td>${formatCurrency(movementValue)}</td>
                                    <td>${movement.TO_nummer || '-'}</td>
                                    <td>${movement.remarks || '-'}</td>
                                </tr>
                            `);
                        });

                        $('#total-movement-value').text(formatCurrency(totalValue));
                    },
                    error: function(err) {
                        console.error('Error loading movements:', err);
                        const tbody = $('#movements-table tbody');
                        tbody.empty().append(`
                            <tr>
                                <td colspan="11" class="text-center text-danger">
                                    Fout bij laden van bewegingen: ${err.responseJSON?.message || err.statusText}
                                </td>
                            </tr>
                        `);
                        $('#total-movement-value').text(formatCurrency(0));
                        showNotification('Fout bij laden van bewegingen', 'error');
                    }
                });
            }

            // Ontvangst laden
            function loadOntvangst() {
                $.ajax({
                    url: '/api/e_bodems_ontvangst',
                    method: 'GET',
                    success: function(data) {
                        renderOntvangst(data);
                    },
                    error: function(err) {
                        console.error('Error loading ontvangst:', err);
                        showNotification('Fout bij laden van ontvangsten', 'error');
                    }
                });
            }

            // Ontvangst renderen
            function renderOntvangst(data) {
                const table = $('#ontvangstTabel tbody');
                table.empty();

                data.forEach(item => {
                    const beschikbaar = item.aantal - (item.aantal_getransporteerd || 0);
                    table.append(`
                        <tr class="status-${item.staat}">
                            <td>${formatDate(item.datum_ontvangen)}</td>
                            <td>${item.glovia_code}</td>
                            <td>${item.revisie}</td>
                            <td>${item.referentie}</td>
                            <td>${beschikbaar} / ${item.aantal}</td>
                            <td>${formatStaat(item.staat)}</td>
                            <td>${item.opmerkingen || '-'}</td>
                            <td>${beschikbaar > 0 ? 'In voorraad' : 'Getransporteerd'}</td>
                            <td>
                                ${beschikbaar > 0 ? `
                                    <input type="checkbox" 
                                           class="select-for-transport" 
                                           data-id="${item.id}"
                                           data-available="${beschikbaar}"
                                           data-staat="${item.staat}">
                                ` : '-'}
                            </td>
                        </tr>
                    `);
                });
            }

            // Details modal tonen
            function showDetailsModal(id) {
                const item = voorraadData.find(i => i.id === id);

                if (!item) {
                    showNotification('Item niet gevonden', 'error');
                    return;
                }

                const modal = $('#detailsModal');

                modal.find('.modal-body').html(`
                    <div class="row">
                        <div class="col-md-6">
                            <h6>Basis Informatie</h6>
                            <p><strong>BC Code:</strong> ${item.glovia_code}</p>
                            <p><strong>Revisie:</strong> ${item.revisie || '-'}</p>
                            <p><strong>Referentie:</strong> ${item.referentie || '-'}</p>
                            <p><strong>Verkoopprijs:</strong> ${formatCurrency(item.verkoopprijs)}</p>
                        </div>
                        <div class="col-md-6">
                            <h6>Voorraad Status</h6>
                            <p><strong>Huidige Voorraad:</strong> ${item.aantal}</p>
                            <p><strong>Staat:</strong> ${formatStaat(item.staat)}</p>
                            <p><strong>Totale Waarde:</strong> ${formatCurrency(item.aantal * item.verkoopprijs)}</p>
                        </div>
                    </div>
                    <div class="mt-3">
                        <h6>Recente Bewegingen</h6>
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>Datum</th>
                                    <th>Type</th>
                                    <th>Aantal</th>
                                    <th>Van Locatie</th>
                                    <th>Naar Locatie</th>
                                    <th>Opmerkingen</th>
                                </tr>
                            </thead>
                            <tbody id="bewegingen-tbody">
                                <tr>
                                    <td colspan="6" class="text-center">
                                        <div class="spinner-border spinner-border-sm" role="status">
                                            <span class="visually-hidden">Loading...</span>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                `);

                if (!item.bodem_id) {
                    console.error('Geen bodem_id gevonden voor item:', item);
                    $('#bewegingen-tbody').html('<tr><td colspan="6" class="text-center text-danger">Kan bewegingen niet laden: Geen bodem ID gevonden</td></tr>');
                    modal.modal('show');
                    return;
                }

                // Bewegingen laden
                $.ajax({
                    url: `/api/e_bodems/movements/${item.bodem_id}`,
                    method: 'GET',
                    success: function(bewegingen) {
                        const bewegingenHtml = bewegingen.map(b => `
                            <tr>
                                <td>${formatDate(b.timestamp)}</td>
                                <td>${formatMovementType(b.movement_type)}</td>
                                <td>${b.amount}</td>
                                <td>${formatLocation(b.from_location)}</td>
                                <td>${formatLocation(b.to_location)}</td>
                                <td>${b.remarks || '-'}</td>
                            </tr>
                        `).join('');

                        $('#bewegingen-tbody').html(bewegingenHtml || '<tr><td colspan="6" class="text-center">Geen bewegingen gevonden</td></tr>');
                    },
                    error: function(err) {
                        console.error('Error loading bewegingen:', err);
                        $('#bewegingen-tbody').html('<tr><td colspan="6" class="text-center text-danger">Fout bij laden van bewegingen</td></tr>');
                    }
                });

                modal.modal('show');
            }

            // Verbruik registreren functie
            function registerUsage(id) {
                const item = voorraadData.find(i => i.id === id);

                if (!item) {
                    showNotification('Item niet gevonden', 'error');
                    return;
                }

                const maxAantal = item.aantal;
                const aantal = prompt(`Voer het aantal te registreren verbruik in (maximaal ${maxAantal}):`, '1');

                if (aantal === null) {
                    return;
                }

                const aantalInt = parseInt(aantal);

                if (isNaN(aantalInt) || aantalInt < 1 || aantalInt > maxAantal) {
                    showNotification('Ongeldig aantal ingevoerd', 'error');
                    return;
                }

                $.ajax({
                    url: '/api/e_bodems/verbruik',
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({
                        id: id,
                        aantal: aantalInt
                    }),
                    success: function(response) {
                        if (response.success) {
                            showNotification('Verbruik succesvol geregistreerd', 'success');
                            setTimeout(() => {
                                loadVoorraad(currentLocation);
                                loadDashboardStats();
                            }, 100);
                        } else {
                            showNotification(response.message || 'Fout bij registreren van verbruik', 'error');
                        }
                    },
                    error: function(err) {
                        console.error('Error registering usage:', err);
                        const errorMessage = err.responseJSON?.message || 'Fout bij registreren van verbruik';
                        showNotification(errorMessage, 'error');
                    }
                });
            }

            // Voorraad toevoegen functie
            function addStock() {
                const bodem_id = $('#add-stock-bodem-id').val();
                const amount = $('#add-stock-amount').val();
                const state = $('#add-stock-state').val();
                const location = $('#add-stock-location').val();
                const TO_nummer = $('#add-stock-TO_nummer').val();

                if (!bodem_id || !amount || !state) {
                    showNotification('Alle velden zijn verplicht', 'error');
                    return;
                }

                if (location === 'genk' && !TO_nummer) {
                    showNotification('TO nummer is verplicht voor Genk locatie', 'error');
                    return;
                }

                $.ajax({
                    url: '/api/e_bodems/add-stock',
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({
                        bodem_id: bodem_id,
                        amount: parseInt(amount),
                        state: state,
                        location: location,
                        TO_nummer: location === 'genk' ? TO_nummer : null
                    }),
                    success: function(response) {
                        if (response.success) {
                            const modalElement = document.getElementById('addStockModal');
                            const modalInstance = bootstrap.Modal.getInstance(modalElement);
                            if (modalInstance) {
                                modalInstance.hide();
                            }

                            $('#add-stock-form')[0].reset();
                            showNotification('Voorraad succesvol toegevoegd', 'success');

                            setTimeout(() => {
                                loadVoorraad(currentLocation);
                                loadDashboardStats();
                            }, 100);
                        } else {
                            showNotification(response.message || 'Fout bij toevoegen van voorraad', 'error');
                        }
                    },
                    error: function(err) {
                        console.error('Error adding stock:', err);
                        const errorMessage = err.responseJSON?.message || 'Fout bij toevoegen van voorraad';
                        showNotification(errorMessage, 'error');
                    }
                });
            }

            // Bulk transfer functie
            function bulkTransfer(selectedItems) {
                const from_location = currentLocation;
                const to_location = $('#bulk-transfer-to-location').val();

                if (from_location === to_location) {
                    showNotification('Van en naar locatie moeten verschillend zijn', 'error');
                    return;
                }

                console.log('Bulk transfer data:', {
                    items: selectedItems,
                    from_location: from_location,
                    to_location: to_location
                });

                $.ajax({
                    url: '/api/e_bodems/bulk-transfer',
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({
                        items: selectedItems,
                        from_location: from_location,
                        to_location: to_location
                    }),
                    success: function(response) {
                        if (response.success) {
                            const modalElement = document.getElementById('bulkTransferModal');
                            const modalInstance = bootstrap.Modal.getInstance(modalElement);
                            if (modalInstance) {
                                modalInstance.hide();
                            }

                            // Reset selectie
                            $(`#${currentLocation}-voorraad .select-item`).prop('checked', false);
                            $(`#select-all-${currentLocation}`).prop('checked', false);

                            showNotification('Items succesvol getransfereerd', 'success');

                            setTimeout(() => {
                                loadVoorraad(currentLocation);
                                loadDashboardStats();
                                loadTransfers();
                                loadMovements();
                            }, 100);
                        } else {
                            showNotification(response.message || 'Fout bij bulk transfer', 'error');
                        }
                    },
                    error: function(err) {
                        console.error('Error in bulk transfer:', err);
                        const errorMessage = err.responseJSON?.message || 'Fout bij bulk transfer';
                        showNotification(errorMessage, 'error');
                    }
                });
            }

            // Staat wijzigen functie
            function changeState(id, aantal, nieuweStaat) {
                $('#bevestig-staat-wijziging').prop('disabled', true);

                // Vind het item in de voorraadData
                const item = voorraadData.find(i => i.id === id);
                if (!item) {
                    showNotification('Item niet gevonden', 'error');
                    return;
                }

                const data = {
                    id: id,
                    aantal: parseInt(aantal),
                    nieuweStaat: nieuweStaat,
                    location: currentLocation,
                    bodem_id: item.bodem_id,
                    huidigeStaat: item.staat
                };

                $.ajax({
                    url: '/api/e_bodems/staat-wijzigen',
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify(data),
                    timeout: 10000, // 10 seconden timeout
                    success: function(response) {
                        if (response.success) {
                            const modalElement = document.getElementById('staatWijzigenModal');
                            const modalInstance = bootstrap.Modal.getInstance(modalElement);
                            if (modalInstance) {
                                modalInstance.hide();
                            }

                            $('#staatWijzigenModal').removeData();
                            $('#aantal-staat-wijzigen').val('');
                            $('#nieuwe-staat').val('');

                            showNotification('Staat succesvol bijgewerkt', 'success');

                            setTimeout(() => {
                                loadVoorraad(currentLocation);
                                loadDashboardStats();
                                loadMovements();
                            }, 100);
                        } else {
                            showNotification(response.message || 'Fout bij wijzigen van staat', 'error');
                        }
                    },
                    error: function(err) {
                        console.error('Error changing state:', err);
                        let errorMessage = 'Fout bij wijzigen van staat';

                        if (err.responseJSON) {
                            errorMessage = err.responseJSON.message || errorMessage;
                            console.error('Server error details:', err.responseJSON);
                        }

                        showNotification(errorMessage, 'error');
                    },
                    complete: function() {
                        $('#bevestig-staat-wijziging').prop('disabled', false);
                    }
                });
            }

            // Export naar PDF functie
            function exportToPDF(location) {
                const selectedItems = [];
                
                // Verzamel alle geselecteerde items
                $(`#${location}-voorraad .select-item:checked`).each(function() {
                    const row = $(this).closest('tr');
                    const item = {
                        id: $(this).data('id'),
                        glovia_code: row.find('td:nth-child(2)').text().trim(),
                        revisie: row.find('td:nth-child(3)').text().trim(),
                        referentie: row.find('td:nth-child(4)').text().trim(),
                        aantal: parseInt(row.find('td:nth-child(5)').text()),
                        staat: $(this).data('state'),
                        verkoopprijs: row.find('td:nth-child(' + (location === 'wilrijk' ? '7' : '8') + ')').text().trim()
                    };
                    selectedItems.push(item);
                });

                if (selectedItems.length === 0) {
                    showNotification('Selecteer eerst items om te exporteren', 'warning');
                    return;
                }

                const button = $(`.export-pdf[data-location="${location}"]`);
                button.prop('disabled', true);
                const originalText = button.html();
                button.html('<i class="fas fa-spinner fa-spin"></i> Exporteren...');

                $.ajax({
                    url: '/api/e_bodems/send_pdf',
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({ 
                        location: location,
                        selectedItems: selectedItems
                    }),
                    success: function(response) {
                        showNotification('Voorraadlijst succesvol verzonden via email', 'success');
                    },
                    error: function(err) {
                        console.error('Error sending PDF:', err);
                        showNotification('Fout bij versturen van voorraadlijst', 'error');
                    },
                    complete: function() {
                        button.prop('disabled', false);
                        button.html(originalText);
                    }
                });
            }

            // Export naar Excel functie
            function exportToExcel(type) {
                let url = '';
                let params = new URLSearchParams();
                
                switch(type) {
                    case 'wilrijk':
                        url = '/api/e_bodems/voorraad/export';
                        params.append('location', 'wilrijk');
                        break;
                    case 'genk':
                        url = '/api/e_bodems/voorraad/export';
                        params.append('location', 'genk');
                        break;
                    case 'transfers':
                        url = '/api/e_bodems/transfers/export';
                        const transferDateFrom = $('#transfer-date-from').val();
                        const transferDateTo = $('#transfer-date-to').val();
                        const transferSearch = $('#transfer-search-input').val();
                        if (transferDateFrom) params.append('dateFrom', transferDateFrom);
                        if (transferDateTo) params.append('dateTo', transferDateTo);
                        if (transferSearch) params.append('search', transferSearch);
                        break;
                    case 'movements':
                        url = '/api/e_bodems/movements/export';
                        const movementDateFrom = $('#date-from').val();
                        const movementDateTo = $('#date-to').val();
                        const movementType = $('#movement-type-filter').val();
                        if (movementDateFrom) params.append('dateFrom', movementDateFrom);
                        if (movementDateTo) params.append('dateTo', movementDateTo);
                        if (movementType) params.append('type', movementType);
                        break;
                    case 'ontvangsten':
                        url = '/api/e_bodems/ontvangst/export';
                        break;
                    default:
                        showNotification('Ongeldige export type', 'error');
                        return;
                }

                // Voeg een timestamp toe om caching te voorkomen
                params.append('t', new Date().getTime());
                
                // Navigeer naar de export URL
                window.location.href = `${url}?${params.toString()}`;
            }

            // Event handlers
            
            // Tab change event handlers
            $('#mainTabs button[data-bs-toggle="tab"]').on('shown.bs.tab', function (e) {
                const target = $(e.target).attr('id');
                
                switch(target) {
                    case 'voorraad-tab':
                        loadVoorraad(currentLocation);
                        break;
                    case 'transfers-tab':
                        loadTransfers();
                        break;
                    case 'movements-tab':
                        loadMovements();
                        break;
                    case 'ontvangst-tab':
                        loadOntvangst();
                        break;
                }
            });

            // Voorraad tab change event handler
            $('#voorraadTabs button[data-bs-toggle="pill"]').on('shown.bs.tab', function (e) {
                const target = $(e.target).attr('id');
                currentLocation = target === 'wilrijk-tab' ? 'wilrijk' : 'genk';
                loadVoorraad(currentLocation);
            });

            // Ontvangst registreren
            $('#ontvangstForm').submit(function(e) {
                e.preventDefault();
                
                const formData = {
                    bodem_id: $('#bodemType').val(),
                    aantal: $('#aantal').val(),
                    staat: $('#staat').val(),
                    opmerkingen: $('#opmerkingen').val()
                };

                $.ajax({
                    url: '/api/e_bodems_ontvangst',
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify(formData),
                    success: function(response) {
                        showNotification('Ontvangst succesvol geregistreerd', 'success');
                        $('#ontvangstForm')[0].reset();
                        loadOntvangst();
                        loadDashboardStats();
                    },
                    error: function(err) {
                        console.error('Error registering ontvangst:', err);
                        showNotification('Fout bij registreren van ontvangst', 'error');
                    }
                });
            });

            // Transport registreren
            $('#transportForm').submit(function(e) {
                e.preventDefault();
                
                // Verzamel geselecteerde items voor transport
                const selectedItems = [];
                $('.select-for-transport:checked').each(function() {
                    selectedItems.push({
                        ontvangst_id: $(this).data('id'),
                        aantal: parseInt($(this).data('available')),
                        staat: $(this).data('staat')
                    });
                });

                if (selectedItems.length === 0) {
                    showNotification('Selecteer eerst items voor transport', 'warning');
                    return;
                }

                const formData = {
                    ontvangst_ids: selectedItems,
                    TO_nummer: $('#TONummer').val(),
                    opmerkingen: $('#transportOpmerkingen').val()
                };

                $.ajax({
                    url: '/api/e_bodems_transport',
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify(formData),
                    success: function(response) {
                        showNotification('Transport succesvol geregistreerd', 'success');
                        $('#transportForm')[0].reset();
                        loadOntvangst();
                        loadVoorraad(currentLocation);
                        loadDashboardStats();
                    },
                    error: function(err) {
                        console.error('Error registering transport:', err);
                        showNotification('Fout bij registreren van transport', 'error');
                    }
                });
            });

            // Excel export buttons
            $('#export-wilrijk-excel').click(function() {
                exportToExcel('wilrijk');
            });
            
            $('#export-genk-excel').click(function() {
                exportToExcel('genk');
            });
            
            $('#export-transfers-excel').click(function() {
                exportToExcel('transfers');
            });
            
            $('#export-movements-excel').click(function() {
                exportToExcel('movements');
            });
            
            $('#export-ontvangsten-excel').click(function() {
                exportToExcel('ontvangsten');
            });

            // PDF export buttons
            $('.export-pdf').click(function() {
                const location = $(this).data('location');
                exportToPDF(location);
            });

            // Filter toepassen
            $('#apply-movement-filters').click(function() {
                loadMovements();
            });

            // Transfer zoeken
            $('#transfer-search-button').click(function() {
                loadTransfers();
            });

            // Add stock button
            $('[id^=add-stock-button]').click(function() {
                const modal = new bootstrap.Modal(document.getElementById('addStockModal'));
                
                // Reset form
                $('#add-stock-form')[0].reset();
                
                // Set default location based on button ID
                const location = $(this).attr('id').includes('wilrijk') ? 'wilrijk' : 'genk';
                $('#add-stock-location').val(location);
                
                // Show/hide TO nummer field based on location
                updateTONummerVisibility();
                
                modal.show();
            });

            // Bulk transfer button
            $('[id^=bulk-transfer-button]').click(function() {
                const location = $(this).attr('id').includes('wilrijk') ? 'wilrijk' : 'genk';
                currentLocation = location;
                
                const selectedItems = [];
                $(`#${location}-voorraad .select-item:checked`).each(function() {
                    const itemId = $(this).data('id');
                    const bodemId = $(this).data('bodem-id');
                    const maxAantal = $(this).data('max-aantal');
                    const state = $(this).data('state');

                    selectedItems.push({
                        id: itemId,
                        bodem_id: bodemId,
                        aantal: parseInt(maxAantal),
                        state: state
                    });
                });

                if (selectedItems.length === 0) {
                    showNotification('Selecteer eerst items om te transfereren', 'warning');
                    return;
                }

                // Open de bulk transfer modal
                const modal = new bootstrap.Modal(document.getElementById('bulkTransferModal'));
                
                // Set default to_location to the other location
                $('#bulk-transfer-to-location').val(location === 'wilrijk' ? 'genk' : 'wilrijk');
                
                // Update itemlist
                const itemList = selectedItems.map(item => {
                    const itemDetails = voorraadData.find(i => i.id === item.id);
                    return `
                        <li>
                            ${itemDetails ? itemDetails.glovia_code : 'Onbekend'} - Aantal: ${item.aantal} - Staat: ${formatStaat(item.state)}
                        </li>
                    `;
                }).join('');
                
                $('#bulk-transfer-item-list').html(itemList);
                
                // Store selected items in modal data
                $('#bulkTransferModal').data('selectedItems', selectedItems);
                
                modal.show();
            });

            // Confirm bulk transfer
            $('#confirm-bulk-transfer').click(function() {
                const selectedItems = $('#bulkTransferModal').data('selectedItems') || [];
                bulkTransfer(selectedItems);
            });

            // Change state button
            $(document).on('click', '.change-state', function() {
                const id = $(this).data('id');
                const maxAantal = $(this).data('aantal');
                const item = voorraadData.find(i => i.id === id);

                if (!item) {
                    showNotification('Item niet gevonden', 'error');
                    return;
                }

                $('#aantal-staat-wijzigen').val('').attr({
                    'max': maxAantal,
                    'min': 1,
                    'placeholder': `Maximum ${maxAantal}`
                });

                $('#nieuwe-staat option').show();
                $(`#nieuwe-staat option[value="${item.staat}"]`).hide();
                $('#nieuwe-staat').val($('#nieuwe-staat option:visible:first').val());

                const modal = new bootstrap.Modal(document.getElementById('staatWijzigenModal'));
                $('#staatWijzigenModal').data({
                    'itemId': id,
                    'currentStaat': item.staat,
                    'location': currentLocation,
                    'maxAantal': maxAantal
                });
                modal.show();
            });

            // Bevestig staat wijziging
            $('#bevestig-staat-wijziging').click(function() {
                const modal = $('#staatWijzigenModal');
                const id = modal.data('itemId');
                const maxAantal = modal.data('maxAantal');
                const currentStaat = modal.data('currentStaat');

                const aantal = parseInt($('#aantal-staat-wijzigen').val());
                const nieuweStaat = $('#nieuwe-staat').val();

                if (!aantal || isNaN(aantal) || aantal < 1) {
                    showNotification('Vul een geldig aantal in', 'error');
                    return;
                }

                if (aantal > maxAantal) {
                    showNotification(`Maximum aantal is ${maxAantal}`, 'error');
                    return;
                }

                if (!nieuweStaat) {
                    showNotification('Selecteer een nieuwe staat', 'error');
                    return;
                }

                if (nieuweStaat === currentStaat) {
                    showNotification('Kies een andere staat', 'warning');
                    return;
                }

                changeState(id, aantal, nieuweStaat);
            });

            // View details button
            $(document).on('click', '.view-details', function() {
                const id = $(this).data('id');
                showDetailsModal(id);
            });

            // Register usage button
            $(document).on('click', '.register-usage', function() {
                const id = $(this).data('id');
                registerUsage(id);
            });

            // Confirm add stock
            $('#confirm-add-stock').click(function() {
                addStock();
            });

            // Select all checkbox handlers
            $('#select-all-wilrijk').change(function() {
                const isChecked = $(this).prop('checked');
                $('#wilrijk-voorraad .select-item').prop('checked', isChecked);
            });

            $('#select-all-genk').change(function() {
                const isChecked = $(this).prop('checked');
                $('#genk-voorraad .select-item').prop('checked', isChecked);
            });

            // Update TO_nummer visibility based on location
            $('#add-stock-location').change(function() {
                updateTONummerVisibility();
            });

            function updateTONummerVisibility() {
                const location = $('#add-stock-location').val();
                if (location === 'genk') {
                    $('#add-stock-TO_nummer-container').show();
                    $('#add-stock-TO_nummer').prop('required', true);
                } else {
                    $('#add-stock-TO_nummer-container').hide();
                    $('#add-stock-TO_nummer').prop('required', false);
                }
            }

            // Search en filter events
            $('[id^=search-input-]').on('input', function() {
                const location = $(this).attr('id').includes('wilrijk') ? 'wilrijk' : 'genk';
                applyFilters(location);
            });

            $('[id^=staat-filter-]').on('change', function() {
                const location = $(this).attr('id').includes('wilrijk') ? 'wilrijk' : 'genk';
                applyFilters(location);
            });

            // Apply filters function
            function applyFilters(location) {
                const searchInput = $(`#search-input-${location}`).val().toLowerCase();
                const staatFilter = $(`#staat-filter-${location}`).val();
                
                // Filter voorraadData voor de huidige locatie
                filteredData = voorraadData.filter(item => {
                    const matchesSearch = !searchInput || 
                        (item.glovia_code && item.glovia_code.toLowerCase().includes(searchInput)) ||
                        (item.referentie && item.referentie.toLowerCase().includes(searchInput));
                    
                    const matchesStaat = !staatFilter || item.staat === staatFilter;
                    
                    return matchesSearch && matchesStaat;
                });
                
                renderVoorraadTabel(filteredData, location);
                updateTotalen(filteredData);
            }

            // Helper functies
            function formatCurrency(amount) {
                return new Intl.NumberFormat('nl-BE', { 
                    style: 'currency', 
                    currency: 'EUR' 
                }).format(amount || 0);
            }

            function formatNumber(number) {
                return new Intl.NumberFormat('nl-BE').format(number || 0);
            }

            function formatDate(dateString) {
                return new Date(dateString).toLocaleDateString('nl-BE', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }

            function formatStaat(staat) {
                if (!staat) return '-';

                const states = {
                    'goed': 'Goede staat',
                    'goede staat': 'Goede staat',
                    'reparatie': 'Te repareren',
                    'te repareren': 'Te repareren',
                    'afval': 'Afval'
                };
                return states[staat.toLowerCase()] || staat;
            }

            function formatLocation(location) {
                if (!location) return '-';
                
                return `<span class="location-badge location-${location.toLowerCase()}">${location}</span>`;
            }

            function formatMovementType(type) {
                const types = {
                    'transfer': 'Transfer',
                    'state_change': 'Staat Wijziging',
                    'usage': 'Verbruik',
                    'addition': 'Toevoeging'
                };
                return types[type] || type;
            }

            function showNotification(message, type = 'info') {
                const alertClass = {
                    'success': 'alert-success',
                    'error': 'alert-danger',
                    'warning': 'alert-warning',
                    'info': 'alert-info'
                };

                const alert = $(`
                    <div class="alert ${alertClass[type]} alert-dismissible fade show position-fixed top-0 end-0 m-3" 
                         role="alert" style="z-index: 1050;">
                        ${message}
                        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                    </div>
                `);

                $('body').append(alert);
                setTimeout(() => alert.alert('close'), 5000);
            }

            // Initialisatie
            loadDashboardStats();
            loadBodemTypes();
            loadVoorraad('wilrijk');
        });
    </script>
</body>
</html>