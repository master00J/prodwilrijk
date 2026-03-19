<!DOCTYPE html>
<html lang="nl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>XML Generator</title>
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
    <script src="https://cdn.jsdelivr.net/gh/davidshimjs/qrcodejs/qrcode.min.js"></script>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background-color: white;
            padding: 20px;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        h1 {
            text-align: center;
            color: #333;
        }
        .form-group {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        input, select {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
        }
        button {
            background-color: #4CAF50;
            color: white;
            padding: 10px 15px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
        }
        button:hover {
            background-color: #45a049;
        }
        .output {
            margin-top: 20px;
            border: 1px solid #ddd;
            padding: 15px;
            background-color: #f9f9f9;
            border-radius: 4px;
        }
        .output pre {
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .actions {
            display: flex;
            justify-content: space-between;
            margin-top: 20px;
        }
        .auto-field {
            background-color: #f0f0f0;
            color: #555;
            cursor: not-allowed;
        }
        .label-section {
            margin-top: 20px;
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background-color: #f9f9f9;
        }
        
        /* Label styling voor scherm */
        .label-preview {
            width: 800px;
            margin: 20px auto;
            background-color: white;
            font-family: Arial, sans-serif;
            font-size: 10px;
        }
        
        .label-print-page {
            width: 800px;
            height: 560px;
            border: 3px solid #000;
            background-color: white;
            margin-bottom: 20px;
            position: relative;
            overflow: hidden;
        }
        
        .label-table {
            width: 100%;
            height: 100%;
            border-collapse: collapse;
        }
        .label-table td {
            border: 2px solid #000;
            padding: 5px;
            vertical-align: top;
            position: relative;
        }
        
        /* --- Rij 1: Header --- */
        .label-header-left {
            width: 68%;
            font-weight: bold;
            font-size: 10px;
            line-height: 1.3;
        }
        .label-header-right {
            width: 32%;
            text-align: center;
            font-size: 10px;
        }
        .label-destination-text {
            font-size: 9px;
            margin-bottom: 5px;
            text-align: left;
            padding-left: 5px;
        }
        .label-destination-barcode {
            height: 25px;
            margin-bottom: 5px;
        }
        .label-fptd-text {
            font-size: 20px;
            font-weight: bold;
            text-align: right;
            padding-right: 10px;
        }
        
        /* --- Rij 2: PO Line (Volledige breedte) --- */
        .label-po-left {
            text-align: left;
            padding-left: 10px !important;
        }
        .label-po-label {
            font-size: 10px;
            margin-bottom: 5px;
        }
        .label-po-number {
            font-size: 26px;
            font-weight: bold;
            text-align: center;
            margin-top: 5px;
            margin-bottom: 5px;
        }
        .label-po-barcode {
            height: 30px;
            margin-top: 5px;
        }
        
        /* --- Rij 3: Part Nr. (Volledige breedte) --- */
        .label-part-left {
            text-align: left;
            padding-left: 10px !important;
        }
        .label-part-label {
            font-size: 10px;
            margin-bottom: 5px;
        }
        .label-part-number {
            font-size: 22px;
            font-weight: bold;
            text-align: center;
            margin-top: 5px;
            margin-bottom: 5px;
        }
        .label-part-barcode {
            height: 30px;
            margin-top: 5px;
        }
        
        /* --- Overige rijen (Qty, Supplier, Parcel) met rechter info cel --- */
        .label-info-right {
            text-align: left;
            font-size: 9px;
            padding-left: 10px !important;
        }
        .label-info-code {
            margin-bottom: 2px;
        }
        .label-info-number {
            font-size: 16px;
            font-weight: bold;
            text-align: center;
            margin-top: 2px;
            margin-bottom: 2px;
        }
        .label-info-barcode {
            height: 25px;
            margin-top: 2px;
        }
        
        .label-qty-left {
            text-align: left;
            padding-left: 10px !important;
        }
        .label-qty-label {
            font-size: 10px;
            margin-bottom: 0px;
        }
        .label-qty-number {
            font-size: 30px;
            font-weight: bold;
            text-align: center;
            margin-top: 0px;
            margin-bottom: 0px;
        }
        .label-qty-barcode {
            height: 20px;
            margin-top: 0px;
            width: 50%; 
            margin-left: auto;
            margin-right: auto;
        }
        
        .label-supplier-left {
            text-align: left;
            padding-left: 10px !important;
        }
        .label-supplier-label {
            font-size: 10px;
            margin-bottom: 2px;
        }
        .label-supplier-number {
            font-size: 16px;
            font-weight: bold;
            text-align: center;
            margin-top: 2px;
            margin-bottom: 2px;
        }
        .label-supplier-barcode {
            height: 25px;
            margin-top: 2px;
        }
        
        .label-parcel-left {
            text-align: left;
            padding-left: 10px !important;
        }
        .label-parcel-label {
            font-size: 10px;
            margin-bottom: 2px;
        }
        .label-parcel-number {
            font-size: 14px;
            font-weight: bold;
            text-align: center;
            margin-top: 2px;
            margin-bottom: 2px;
        }
        .label-parcel-barcode {
            height: 25px;
            margin-top: 2px;
        }
        .label-date-section {
            font-size: 9px;
            padding-left: 10px !important;
        }
        .label-date-text {
            margin-bottom: 3px;
        }
        .label-qr-code {
            position: absolute;
            right: 5px;
            bottom: 5px;
            width: 90px;
            height: 90px;
        }
        
        /* Print-specifieke styling */
        @media print {
            /* Reset en basisinstellingen */
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            /* Verberg alle niet-print elementen */
            body > *:not(.print-container) {
                display: none !important;
            }
            
            /* Print container styling */
            .print-container {
                display: block !important;
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                background: white;
            }
            
            /* Pagina instellingen */
            @page {
                size: A4 landscape;
                margin: 5mm;
            }
            
            /* Label styling voor print */
            .label-print-page {
                width: 270mm !important;
                height: 180mm !important;
                border: 2px solid #000 !important;
                background-color: white !important;
                margin: 0 auto 5mm auto !important;
                page-break-after: always !important;
                page-break-inside: avoid !important;
                position: relative !important;
                display: block !important;
            }
            
            .label-print-page:last-child {
                page-break-after: avoid !important;
            }
            
            /* Tabel en cellen */
            .label-table {
                width: 100% !important;
                height: 100% !important;
                border-collapse: collapse !important;
                table-layout: fixed !important;
            }
            
            .label-table td {
                border: 2px solid #000 !important;
                padding: 5px !important;
                vertical-align: top !important;
                position: relative !important;
            }
            
            /* Barcode afbeeldingen */
            .label-table img {
                max-width: 100% !important;
                height: auto !important;
                display: block !important;
                margin: 0 auto !important;
            }
            
            /* QR code */
            .label-qr-code {
                position: absolute !important;
                right: 5px !important;
                bottom: 5px !important;
                width: 90px !important;
                height: 90px !important;
            }
            
            .label-qr-code canvas,
            .label-qr-code img {
                width: 90px !important;
                height: 90px !important;
            }
            
            /* Tekst styling behouden */
            .label-header-left,
            .label-header-right,
            .label-po-number,
            .label-part-number,
            .label-qty-number,
            .label-supplier-number,
            .label-parcel-number,
            .label-info-number,
            .label-fptd-text {
                font-size: inherit !important;
                font-weight: inherit !important;
            }
        }
        
        /* Hulpklasse voor print container */
        .print-container {
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>XML Generator</h1>
        <form id="xmlForm">
            <div class="form-group">
                <label for="purchaseOrderNumber">Inkoopordernummer:</label>
                <input type="text" id="purchaseOrderNumber" required>
            </div>
            <div class="form-group">
                <label for="division">Divisie:</label>
                <select id="division" required>
                    <option value="">-- Selecteer een divisie --</option>
                    <option value="3960">Powertools (3960)</option>
                    <option value="AID">KIT (AID)</option>
                    <option value="HERV">Herverpakking AID</option>
                </select>
            </div>
            <div class="form-group">
                <label for="vendorCode">Leverancierscode: (automatisch)</label>
                <input type="text" id="vendorCode" class="auto-field" readonly>
            </div>
            <div class="form-group">
                <label for="itemNumber">Artikelnummer:</label>
                <input type="text" id="itemNumber" required>
            </div>
            <div class="form-group">
                <label for="quantity">Hoeveelheid:</label>
                <input type="number" id="quantity" value="1" required>
            </div>
            <div class="form-group">
                <label for="deliveryDate">Leveringsdatum: (automatisch +3 dagen)</label>
                <input type="date" id="deliveryDate" class="auto-field" readonly>
            </div>
            <div class="form-group">
                <label for="prepackVendorCode">Prepack Leverancierscode: (automatisch)</label>
                <input type="text" id="prepackVendorCode" class="auto-field" readonly>
            </div>
            
            <div class="actions">
                <button type="button" id="generateBtn">Genereer XML</button>
                <button type="button" id="generateLabelBtn" disabled>Genereer Label</button>
                <button type="button" id="downloadBtn" disabled>Download XML</button>
                <button type="button" id="clearBtn">Formulier wissen</button>
            </div>
        </form>
        
        <div class="output">
            <h3>Gegenereerde XML:</h3>
            <pre id="xmlOutput"></pre>
        </div>
        
        <div class="label-section" id="labelSection" style="display: none;">
            <h3>Label Preview (alleen voor Powertools):</h3>
            <div class="label-preview" id="labelPreview">
                <!-- Label content wordt hier gegenereerd -->
            </div>
            <div style="text-align: center; margin-top: 10px;">
                <button type="button" id="printLabelBtn">Print Label</button>
            </div>
        </div>
    </div>

    <!-- Print container (verborgen tot printen) -->
    <div class="print-container" id="printContainer"></div>

    <script>
        // Hulpfunctie om een random nummer van een bepaalde lengte te genereren
        function generateRandomNumberString(length) {
            let result = '';
            const characters = '0123456789';
            for (let i = 0; i < length; i++) {
                result += characters.charAt(Math.floor(Math.random() * characters.length));
            }
            return result;
        }

        document.addEventListener('DOMContentLoaded', function() {
            const generateBtn = document.getElementById('generateBtn');
            const generateLabelBtn = document.getElementById('generateLabelBtn');
            const downloadBtn = document.getElementById('downloadBtn');
            const clearBtn = document.getElementById('clearBtn');
            const printLabelBtn = document.getElementById('printLabelBtn');
            const xmlOutput = document.getElementById('xmlOutput');
            const labelSection = document.getElementById('labelSection');
            const labelPreview = document.getElementById('labelPreview');
            const divisionSelect = document.getElementById('division');
            const vendorCodeInput = document.getElementById('vendorCode');
            const deliveryDateInput = document.getElementById('deliveryDate');
            const prepackVendorCodeInput = document.getElementById('prepackVendorCode');
            
            // Variabele om gegenereerde XMLs op te slaan
            let generatedXmls = [];
            
            // Koppel divisies aan Prepack Vendor Codes
            const divisionPrepackMap = {
                '3960': '3301011799', // Powertools
                'AID': '77779',       // KIT
                'HERV': '77778'        // Herverpakking
            };
            
            // Koppel divisies aan Vendor Codes
            const divisionVendorMap = {
                '3960': '3300009627', // Powertools
                'AID': '25002',       // KIT
                'HERV': '25002'       // Herverpakking
            };
            
            // Koppel de selectie-waarden aan de correcte XML-waarden
            const divisionXmlMap = {
                '3960': '3960',      // Powertools blijft 3960
                'AID': 'AID',        // KIT blijft AID
                'HERV': 'AID'        // Herverpakking moet AID in XML worden
            };
            
            // Stel leveringsdatum in op huidige datum + 3 dagen
            function setDeliveryDate() {
                const today = new Date();
                const deliveryDate = new Date(today);
                deliveryDate.setDate(today.getDate() + 3);
                
                const year = deliveryDate.getFullYear();
                const month = String(deliveryDate.getMonth() + 1).padStart(2, '0');
                const day = String(deliveryDate.getDate()).padStart(2, '0');
                
                deliveryDateInput.value = `${year}-${month}-${day}`;
            }
            
            // Update velden als divisie verandert
            divisionSelect.addEventListener('change', function() {
                const selectedDivision = this.value;
                
                // Update Prepack Vendor Code
                if (divisionPrepackMap[selectedDivision]) {
                    prepackVendorCodeInput.value = divisionPrepackMap[selectedDivision];
                } else {
                    prepackVendorCodeInput.value = '';
                }
                
                // Update Vendor Code
                if (divisionVendorMap[selectedDivision]) {
                    vendorCodeInput.value = divisionVendorMap[selectedDivision];
                } else {
                    vendorCodeInput.value = '';
                }
                
                // Update leveringsdatum
                setDeliveryDate();
                
                // Toon/verberg label functionaliteit voor Powertools
                if (selectedDivision === '3960') {
                    generateLabelBtn.disabled = false;
                } else {
                    generateLabelBtn.disabled = true;
                    labelSection.style.display = 'none';
                }
            });
            
            // Stel initiële leveringsdatum in
            setDeliveryDate();
            
            // Functie om een enkele XML te genereren
            function generateSingleXML(index = 0, totalQuantity = 1) {
                let purchaseOrderNumber = document.getElementById('purchaseOrderNumber').value;
                
                // Als er meer dan 1 stuk is, voeg volgnummer toe
                if (totalQuantity > 1) {
                    const sequenceNumber = String(index + 1).padStart(3, '0');
                    purchaseOrderNumber = `${sequenceNumber}${purchaseOrderNumber}`;
                }
                
                const selectedDivision = document.getElementById('division').value;
                // Gebruik de correcte divisie-waarde voor de XML
                const division = divisionXmlMap[selectedDivision] || selectedDivision;
                const vendorCode = document.getElementById('vendorCode').value;
                const itemNumber = document.getElementById('itemNumber').value;
                const unitOf = "PC  "; // Standaardwaarde met spaties
                const location = "FPTD"; // Standaardwaarde
                const deliveryDate = document.getElementById('deliveryDate').value;
                const deliveryTimeFrameCode = "00   "; // Standaardwaarde met spaties
                const dueDate = deliveryDate; // Zelfde als leveringsdatum
                const dueTimeFrameCode = "00   "; // Standaardwaarde met spaties
                const prepackVendorCode = document.getElementById('prepackVendorCode').value;
                
                // Datum en tijd voor ActionDateTime
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                const seconds = String(now.getSeconds()).padStart(2, '0');
                const milliseconds = String(now.getMilliseconds()).padStart(6, '0');
                const actionDateTime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds.substring(0, 6)}`;
                
                // XML opbouwen
                let xml = '<?xml version="1.0" encoding="utf-8"?>';
                xml += '<BE2NET_PO_PREPACK_START>';
                xml += `<PurchaseOrderNumber>${purchaseOrderNumber}</PurchaseOrderNumber>`;
                xml += `<Division>${division}</Division>`;
                xml += `<VendorCode>${vendorCode}</VendorCode>`;
                xml += `<ItemNumber>${itemNumber}</ItemNumber>`;
                xml += `<Quantity>1</Quantity>`; // Altijd 1, want we maken per stuk
                xml += `<UnitOf>${unitOf}</UnitOf>`;
                xml += `<Location>${location}</Location>`;
                xml += `<DeliveryDate>${deliveryDate}</DeliveryDate>`;
                xml += `<DeliveryTimeFrame><Code>${deliveryTimeFrameCode}</Code><From /><To /></DeliveryTimeFrame>`;
                xml += `<DueDate>${dueDate}</DueDate>`;
                xml += `<DueTimeFrame><Code>${dueTimeFrameCode}</Code><From /><To /></DueTimeFrame>`;
                xml += `<PrepackVendorCode>${prepackVendorCode}</PrepackVendorCode>`;
                xml += `<ActionDateTime>${actionDateTime}</ActionDateTime>`;
                xml += '</BE2NET_PO_PREPACK_START>';
                
                return xml;
            }
            
            // Functie om de XMLs te genereren op basis van hoeveelheid
            function generateXMLs() {
                const quantity = parseInt(document.getElementById('quantity').value, 10);
                generatedXmls = [];
                
                // Genereer een XML voor elk stuk
                for (let i = 0; i < quantity; i++) {
                    generatedXmls.push(generateSingleXML(i, quantity));
                }
                
                return generatedXmls;
            }
            
            // Functie om echte scanbare barcode te genereren
            function generateBarcode(text, width = 2, height = 50) {
                // Maak een tijdelijke canvas voor de barcode
                const canvas = document.createElement('canvas');
                
                try {
                    // Genereer barcode met JsBarcode
                    JsBarcode(canvas, text, {
                        format: "CODE128",
                        width: width,
                        height: height,
                        displayValue: false,
                        margin: 0
                    });
                    
                    // Converteer naar base64 image
                    return `<img src="${canvas.toDataURL()}" style="max-width: 100%; height: auto;" alt="Barcode: ${text}">`;
                } catch (error) {
                    // Fallback als barcode generatie faalt
                    console.warn('Barcode generatie gefaald voor:', text, error);
                    return `<div style="font-family: monospace; font-size: 8px; text-align: center;">|||||||||||||||||||</div>`;
                }
            }
            
            // Functie om barcode met prefix te genereren (voor scanbare data)
            function generateBarcodeWithPrefix(prefix, text, width = 2, height = 50) {
                const barcodeData = `${prefix}${text}`;
                return generateBarcode(barcodeData, width, height);
            }
            
            // Functie om huidige datum te formatteren
            function getCurrentDate() {
                const now = new Date();
                const day = String(now.getDate()).padStart(2, '0');
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const year = now.getFullYear();
                return `${day}/${month}/${year}`;
            }
            
            // Functie om label te genereren voor Powertools
            function generateLabel(parcelIndex = 0) {
                const purchaseOrderNumber = document.getElementById('purchaseOrderNumber').value;
                const itemNumber = document.getElementById('itemNumber').value;
                const prepackVendorCode = document.getElementById('prepackVendorCode').value;
                const labelQuantity = "1"; 
                const currentDate = getCurrentDate();
                
                // Random nummers genereren
                const deliveryNotice = generateRandomNumberString(6);
                const randomParcelSuffix = generateRandomNumberString(3);
                const shopOrder = "000000"; // Blijft placeholder, tenzij anders gespecificeerd

                // Prefixen toevoegen
                const prefixedPO = `K${purchaseOrderNumber}`;
                const prefixedItem = `P${itemNumber}`;
                const prefixedSupplier = `V${prepackVendorCode}`;
                const prefixedQuantity = `Q${labelQuantity}`;

                // Parcel nummer met random deel
                const parcelNumber = `${prepackVendorCode}${randomParcelSuffix}01`;

                // Barcodes
                const poBarcode = generateBarcodeWithPrefix('K', purchaseOrderNumber, 1.8, 30);
                const partBarcode = generateBarcodeWithPrefix('P', itemNumber, 1.8, 30);
                const supplierBarcode = generateBarcodeWithPrefix('V', prepackVendorCode, 1.8, 25);
                const quantityBarcode = generateBarcodeWithPrefix('Q', labelQuantity, 1.5, 20);
                const fptdBarcode = generateBarcodeWithPrefix('2L', 'FPTD', 1.2, 25);
                const deliveryNoticeBarcode = generateBarcodeWithPrefix('H', deliveryNotice, 1.2, 20);
                const shopOrderBarcode = generateBarcodeWithPrefix('2W', shopOrder, 1.2, 20);
                const parcelBarcode = generateBarcodeWithPrefix('S', parcelNumber, 1.8, 25);

                // Data voor QR code
                const qrCodeData = `DPTD/` +
                                 `${encodeURIComponent(prefixedPO)}/` +
                                 `${encodeURIComponent(prefixedItem)}/` +
                                 `${encodeURIComponent(prefixedQuantity)}/` +
                                 `${encodeURIComponent(prefixedSupplier)}/` +
                                 `S${encodeURIComponent(parcelNumber)}/` +
                                 `H${encodeURIComponent(deliveryNotice)}/` +
                                 `2W${encodeURIComponent(shopOrder)}/` +
                                 `2LFPTD`;

                const labelHTML = `
                    <table class="label-table">
                        <tr style="height: 15%;">
                            <td class="label-header-left">
                                RECEIVER<br>
                                <strong>ATLAS COPCO</strong> &nbsp;&nbsp;&nbsp;&nbsp; PTD<br>
                                ATLAS COPCO POWER TOOLS DISTR. NV
                            </td>
                            <td class="label-header-right">
                                <div class="label-destination-text">Destination: (2L)</div>
                                <div class="label-destination-barcode">${fptdBarcode}</div>
                                <div class="label-fptd-text">FPTD</div>
                            </td>
                        </tr>
                        <tr style="height: 20%;">
                            <td class="label-po-left" colspan="2"> 
                                <div class="label-po-label">PO Line: (K)</div>
                                <div class="label-po-number">${prefixedPO}</div>
                                <div class="label-po-barcode">${poBarcode}</div>
                            </td>
                        </tr>
                        <tr style="height: 20%;">
                            <td class="label-part-left" colspan="2"> 
                                <div class="label-part-label">Part nr.: (P)</div>
                                <div class="label-part-number">${prefixedItem}</div>
                                <div class="label-part-barcode">${partBarcode}</div>
                            </td>
                        </tr>
                        <tr style="height: 15%;">
                            <td class="label-qty-left">
                                <div class="label-qty-label">Quantity: (Q)</div>
                                <div class="label-qty-number">${prefixedQuantity}</div>
                                <div class="label-qty-barcode">${quantityBarcode}</div>
                            </td>
                            <td class="label-info-right">
                                <div class="label-info-code">Delivery Notice nr.: (H)</div>
                                <div class="label-info-number">${deliveryNotice}</div>
                                <div class="label-info-barcode">${deliveryNoticeBarcode}</div>
                            </td>
                        </tr>
                        <tr style="height: 15%;">
                            <td class="label-supplier-left">
                                <div class="label-supplier-label">Supplier code: (V)</div>
                                <div class="label-supplier-number">${prefixedSupplier}</div>
                                <div class="label-supplier-barcode">${supplierBarcode}</div>
                            </td>
                            <td class="label-info-right">
                                <div class="label-info-code">Shop order: (2W)</div>
                                 <div class="label-info-number">${shopOrder}</div>
                                <div class="label-info-barcode">${shopOrderBarcode}</div>
                            </td>
                        </tr>
                        <tr style="height: 15%;">
                            <td class="label-parcel-left">
                                <div class="label-parcel-label">Parcel nr.: (S)</div>
                                <div class="label-parcel-number">S${parcelNumber}</div>
                                <div class="label-parcel-barcode">${parcelBarcode}</div>
                            </td>
                            <td class="label-date-section">
                                <div class="label-date-text"><strong>Date</strong><br>D ${currentDate}</div>
                                <div id="qrcode-${parcelIndex}" class="label-qr-code"></div>
                            </td>
                        </tr>
                    </table>
                `;
                
                if (!window.qrCodeTasks) {
                    window.qrCodeTasks = [];
                }
                window.qrCodeTasks.push({ id: `qrcode-${parcelIndex}`, text: qrCodeData });

                return labelHTML;
            }
            
            // Event listeners
            generateBtn.addEventListener('click', function() {
                if (!document.getElementById('xmlForm').checkValidity()) {
                    alert('Vul alle verplichte velden in');
                    return;
                }
                
                const xmls = generateXMLs();
                
                // Toon aantal en eerste XML in de output
                const quantity = xmls.length;
                let outputText = `${quantity} XML(s) gegenereerd.\n\n`;
                outputText += `XML 1 van ${quantity}:\n${xmls[0]}`;
                
                if (quantity > 1) {
                    outputText += `\n\n... ${quantity-1} meer XML(s) worden niet getoond ...`;
                }
                
                xmlOutput.textContent = outputText;
                downloadBtn.disabled = false;
            });
            
            // Event listener voor label generatie
            generateLabelBtn.addEventListener('click', function() {
                if (!document.getElementById('xmlForm').checkValidity()) {
                    alert('Vul alle verplichte velden in');
                    return;
                }
                
                if (document.getElementById('division').value !== '3960') {
                    alert('Labels zijn alleen beschikbaar voor Powertools divisie');
                    return;
                }
                
                const totalQuantity = parseInt(document.getElementById('quantity').value, 10) || 1;
                let allLabelsHTML = '';
                window.qrCodeTasks = []; // Reset QR code taken

                for (let i = 0; i < totalQuantity; i++) {
                    const singleLabelHTML = generateLabel(i);
                    allLabelsHTML += `<div class="label-print-page">${singleLabelHTML}</div>`;
                }
                
                labelPreview.innerHTML = allLabelsHTML;
                labelSection.style.display = 'block';

                // Genereer QR codes nadat HTML is toegevoegd
                setTimeout(() => {
                    if (window.qrCodeTasks && window.qrCodeTasks.length > 0) {
                        window.qrCodeTasks.forEach(task => {
                            const qrElement = document.getElementById(task.id);
                            if (qrElement) {
                                qrElement.innerHTML = ''; 
                                new QRCode(qrElement, {
                                    text: task.text,
                                    width: 90,
                                    height: 90,
                                    colorDark : "#000000",
                                    colorLight : "#ffffff",
                                    correctLevel : QRCode.CorrectLevel.H
                                });
                            }
                        });
                        window.qrCodeTasks = [];
                    }
                }, 100);
            });
            
            // Verbeterde print functie
            printLabelBtn.addEventListener('click', function() {
                const labelPreviewElement = document.getElementById('labelPreview');
                if (!labelPreviewElement || !labelPreviewElement.innerHTML.trim()) {
                    alert('Genereer eerst een label om te printen.');
                    return;
                }

                // Kopieer labels naar print container
                const printContainer = document.getElementById('printContainer');
                printContainer.innerHTML = labelPreviewElement.innerHTML;

                // Wacht even zodat browser de content kan renderen
                setTimeout(() => {
                    window.print();
                    // Leeg de print container na printen
                    setTimeout(() => {
                        printContainer.innerHTML = '';
                    }, 500);
                }, 100);
            });
            
            downloadBtn.addEventListener('click', function() {
                if (generatedXmls.length === 0) return;
                
                const selectedDivision = document.getElementById('division').value;
                const division = divisionXmlMap[selectedDivision] || selectedDivision;
                const prepackVendorCode = document.getElementById('prepackVendorCode').value;
                
                // Maak een .zip bestand als er meerdere XMLs zijn
                if (generatedXmls.length > 1) {
                    // Controleer of JSZip beschikbaar is, zo niet dan laden we het
                    if (typeof JSZip === 'undefined') {
                        const script = document.createElement('script');
                        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
                        script.onload = createAndDownloadZip;
                        document.head.appendChild(script);
                    } else {
                        createAndDownloadZip();
                    }
                } else {
                    // Download enkele XML
                    const xml = generatedXmls[0];
                    const now = new Date();
                    const timestamp = now.getFullYear() +
                        String(now.getMonth() + 1).padStart(2, '0') +
                        String(now.getDate()).padStart(2, '0') +
                        String(now.getHours()).padStart(2, '0') +
                        String(now.getMinutes()).padStart(2, '0') +
                        String(now.getSeconds()).padStart(2, '0') +
                        String(now.getMilliseconds()).padStart(4, '0');
                    
                    const random = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
                    const filename = `PROD_${division}_${prepackVendorCode}_${timestamp}_Z${random}.xml`;
                    
                    downloadFile(xml, filename);
                }
                
                function createAndDownloadZip() {
                    const zip = new JSZip();
                    const now = new Date();
                    
                    // Voeg elke XML toe aan het zip bestand
                    generatedXmls.forEach((xml, index) => {
                        const millisToAdd = index * 10;
                        const fileDate = new Date(now.getTime() + millisToAdd);
                        
                        const timestamp = fileDate.getFullYear() +
                            String(fileDate.getMonth() + 1).padStart(2, '0') +
                            String(fileDate.getDate()).padStart(2, '0') +
                            String(fileDate.getHours()).padStart(2, '0') +
                            String(fileDate.getMinutes()).padStart(2, '0') +
                            String(fileDate.getSeconds()).padStart(2, '0') +
                            String(fileDate.getMilliseconds()).padStart(4, '0');
                        
                        const random = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
                        const filename = `PROD_${division}_${prepackVendorCode}_${timestamp}_Z${random}.xml`;
                        
                        zip.file(filename, xml);
                    });
                    
                    // Genereer het zip-bestand
                    zip.generateAsync({type: 'blob'}).then(function(content) {
                        const zipFilename = `XML_Export_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.zip`;
                        downloadFile(content, zipFilename);
                    });
                }
                
                function downloadFile(content, filename) {
                    const blob = new Blob([content], { type: content instanceof Blob ? content.type : 'text/xml' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = filename;
                    link.click();
                }
            });
            
            clearBtn.addEventListener('click', function() {
                document.getElementById('xmlForm').reset();
                xmlOutput.textContent = '';
                downloadBtn.disabled = true;
                generateLabelBtn.disabled = true;
                labelSection.style.display = 'none';
                labelPreview.innerHTML = '';
                generatedXmls = [];
                
                // Reset automatische velden
                const selectedDivision = divisionSelect.value;
                if (selectedDivision) {
                    if (divisionPrepackMap[selectedDivision]) {
                        prepackVendorCodeInput.value = divisionPrepackMap[selectedDivision];
                    }
                    if (divisionVendorMap[selectedDivision]) {
                        vendorCodeInput.value = divisionVendorMap[selectedDivision];
                    }
                }
                
                // Reset leveringsdatum
                setDeliveryDate();
            });
        });
    </script>
    
    <!-- JSZip voor het maken van .zip bestanden bij meerdere XMLs -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
</body>
</html>