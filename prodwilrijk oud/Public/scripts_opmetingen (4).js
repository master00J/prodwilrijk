document.addEventListener('DOMContentLoaded', (event) => {
    console.log('Document loaded');  // Debug-informatie om te bevestigen dat het script wordt uitgevoerd

    const form = document.getElementById('measurement-form');
    const overview = document.getElementById('measurement-overview');
    const currentDate = document.getElementById('current-date');

    // Stel de huidige datum in
    currentDate.textContent = new Date().toLocaleDateString('nl-BE');

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const itemNumber = document.getElementById('item-number').value;
        const itemQuantity = document.getElementById('item-quantity').value;

        const itemDiv = document.createElement('div');
        itemDiv.classList.add('measurement-item');
        itemDiv.innerHTML = `
            <table>
                <tr>
                    <td colspan="2">VERPAKKING LEVERANCIER - detail</td>
                    <td>SAMENSTELLING: detail</td>
                    <td>PE FOLIE - DEKSEL / VOLLEDIG RONDOM</td>
                    <td colspan="2">VPCI</td>
                    <td>BUFFEREN MET ISOMOPLATEN (EPS)</td>
                </tr>
                <tr>
                    <td colspan="2">VETPAPIER</td>
                    <td></td>
                    <td colspan="4" class="item-number">${itemNumber}</td>
                </tr>
                <tr>
                    <td>Ontvangen:</td>
                    <td>${itemQuantity} stuk(s)</td>
                    <td>BO:</td>
                    <td>1</td>
                    <td>Divisie:</td>
                    <td>__</td>
                    <td>Prepack Code:</td>
                </tr>
                <tr>
                    <td>Verpakkingsmethode:</td>
                    <td colspan="6">________________</td>
                </tr>
                <tr>
                    <td>Afmetingen:</td>
                    <td colspan="6">_________ x _________ x _________</td>
                </tr>
                <tr>
                    <td>Netto Gewicht:</td>
                    <td colspan="6">_________ kg</td>
                </tr>
                <tr>
                    <td>Glovia Code:</td>
                    <td colspan="6">________________</td>
                </tr>
                <tr>
                    <td>Prijs:</td>
                    <td colspan="6">_________ €</td>
                </tr>
                <tr>
                    <td>Tarraw Gewicht:</td>
                    <td colspan="6">_________ kg</td>
                </tr>
                <tr>
                    <td>BMT-Code:</td>
                    <td colspan="6">_________ x _________ x _________</td>
                </tr>
            </table>
        `;
        overview.appendChild(itemDiv);

        form.reset();
        console.log('Item toegevoegd aan overzicht');  // Debug-informatie om te bevestigen dat de gegevens zijn toegevoegd
    });

    // Get the modal
    var modal = document.getElementById("kitModal");

    // Get the button that opens the modal
    var btn = document.getElementById("kit-button");

    // Get the <span> element that closes the modal
    var span = document.getElementsByClassName("close")[0];

    // When the user clicks the button, open the modal 
    btn.onclick = function() {
        modal.style.display = "block";
    }

    // When the user clicks on <span> (x), close the modal
    span.onclick = function() {
        modal.style.display = "none";
    }

    // When the user clicks anywhere outside of the modal, close it
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    const kitForm = document.getElementById('kit-form');

    kitForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const datum = document.getElementById('datum').value;
    const stuknrAc = document.getElementById('stuknr-ac').value;
    const stuknrForesco = document.getElementById('stuknr-foresco').value;
    const kisttype = document.getElementById('kisttype').value;
    const binnenL = parseFloat(document.getElementById('binnenafmetingen-l').value);
    const binnenB = parseFloat(document.getElementById('binnenafmetingen-b').value);
    const binnenH = parseFloat(document.getElementById('binnenafmetingen-h').value);
    const tarra = parseFloat(document.getElementById('tarra').value);
    const netto = parseFloat(document.getElementById('netto').value);
    const prijs = parseFloat(document.getElementById('prijs').value);
    const opmerking = document.getElementById('opmerking').value;

    // Calculate Buitenafmetingen
    let buitenL = binnenL;
    let buitenB = binnenB;
    let buitenH = binnenH;

    if (kisttype === 'MPX') {
        buitenL += 30;
        buitenB += 30;
        buitenH += 30;
    }

    const kitDiv = document.createElement('div');
    kitDiv.classList.add('measurement-item');
    kitDiv.innerHTML = `
        <div class="kit-header">Opmeting Prototype KIT</div>
        <table>
            <tr>
                <th>Datum</th>
                <th>Stuknr AC</th>
                <th>Stuknr Foresco</th>
                <th>Kisttype</th>
                <th>Binnenafmetingen (L x B x H) mm</th>
                <th>Buitenafmetingen (L x B x H) mm</th>
                <th>Tarra (kg)</th>
                <th>Netto (kg)</th>
                <th>Prijs (€)</th>
                <th>Opmerking</th>
            </tr>
            <tr>
                <td>${datum}</td>
                <td>${stuknrAc}</td>
                <td>${stuknrForesco}</td>
                <td>${kisttype}</td>
                <td>${binnenL.toFixed(2)} x ${binnenB.toFixed(2)} x ${binnenH.toFixed(2)}</td>
                <td>${buitenL.toFixed(2)} x ${buitenB.toFixed(2)} x ${buitenH.toFixed(2)}</td>
                <td>${tarra.toFixed(2)}</td>
                <td>${netto.toFixed(2)}</td>
                <td>${prijs.toFixed(2)}</td>
                <td>${opmerking}</td>
            </tr>
        </table>
    `;
    overview.appendChild(kitDiv);

    kitForm.reset();
    modal.style.display = "none";
    console.log('Kit toegevoegd aan overzicht');  // Debug-informatie om te bevestigen dat de gegevens zijn toegevoegd
});

    function updateBuitenafmetingen() {
        const kisttype = document.getElementById('kisttype').value;
        const binnenL = parseInt(document.getElementById('binnenafmetingen-l').value) || 0;
        const binnenB = parseInt(document.getElementById('binnenafmetingen-b').value) || 0;
        const binnenH = parseInt(document.getElementById('binnenafmetingen-h').value) || 0;

        let buitenL = binnenL;
        let buitenB = binnenB;
        let buitenH = binnenH;

        if (kisttype === 'MPX') {
            buitenL += 30;
            buitenB += 30;
            buitenH += 30;
        }

        document.getElementById('buitenafmetingen-l').value = buitenL;
        document.getElementById('buitenafmetingen-b').value = buitenB;
        document.getElementById('buitenafmetingen-h').value = buitenH;
    }

    // Update Buitenafmetingen when Kisttype or Binnenafmetingen change
    document.getElementById('kisttype').addEventListener('change', updateBuitenafmetingen);
    document.querySelectorAll('#binnenafmetingen-l, #binnenafmetingen-b, #binnenafmetingen-h').forEach(input => {
        input.addEventListener('input', updateBuitenafmetingen);
    });
});

function printSection() {
    const printContents = document.getElementById('print-section').innerHTML;
    const originalContents = document.body.innerHTML;

    const printWindow = window.open('', '', 'height=800,width=600');
    printWindow.document.write('<html><head><title>Print</title>');
    printWindow.document.write('<style>');
    printWindow.document.write('body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }');
    printWindow.document.write('.container { width: 100%; margin: auto; }');
    printWindow.document.write('.measurement-item { border: 1px solid black; margin-bottom: 20px; padding: 10px; page-break-inside: avoid; }');
    printWindow.document.write('.measurement-item h3 { margin: 0; font-size: 1.2em; text-align: center; }');
    printWindow.document.write('.measurement-item div { margin-bottom: 5px; }');
    printWindow.document.write('.measurement-item span { display: inline-block; width: 150px; }');
    printWindow.document.write('.measurement-item table { width: 100%; border-collapse: collapse; margin-top: 10px; }');
    printWindow.document.write('.measurement-item th, .measurement-item td { border: 1px solid black; padding: 5px; text-align: left; word-break: break-word; }');
    printWindow.document.write('.measurement-item .item-number { font-weight: bold; }');
    printWindow.document.write('.page-header { text-align: center; font-size: 18px; font-weight: bold; padding: 10px 0; }');
    printWindow.document.write('.print-section { page-break-after: always; }');
    printWindow.document.write('@media print { .print-section { width: 100%; margin: auto; } }');
    printWindow.document.write('</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write('<div class="container">');
    printWindow.document.write(printContents);
    printWindow.document.write('</div>');
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
}
