document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const checklistId = urlParams.get('id');

    // Haal de checklistgegevens op
    fetch(`/api/get_checklist_details?id=${checklistId}`)
        .then(response => response.json())
        .then(data => {
            const detailsDiv = document.getElementById('checklist-details');

            // Formatteer de datum naar YYYY-MM-DD
            const datumFormatted = new Date(data.datum).toISOString().split('T')[0];

            detailsDiv.innerHTML = `
                <p><strong>WerkOrder:</strong> ${data.werkorder}</p>
                <p><strong>Datum:</strong> ${datumFormatted}</p>
                <p><strong>Verantwoordelijke:</strong> ${data.verantwoordelijke}</p>
                <p><strong>Order Beschrijving:</strong> ${data.order_description}</p>  <!-- Weergeven van de order_description -->
                <p><strong>Stuklijst Conform:</strong> ${data.stuklijst ? 'Ja' : 'Nee'}</p>
                <p><strong>Tekeningen Conform:</strong> ${data.tekening ? 'Ja' : 'Nee'}</p>
                <p><strong>Juiste Nagel Type / Lengte:</strong> ${data.nagel_type_lengte ? 'Ja' : 'Nee'}</p>
                <p><strong>Juiste Nagel Wijze:</strong> ${data.nagel_wijze ? 'Ja' : 'Nee'}</p>
                <p><strong>Uitstekende Nagels:</strong> ${data.uitstekende_nagels ? 'Ja' : 'Nee'}</p>
                <p><strong>Nagelkoppen Verzinken:</strong> ${data.nagelkoppen_verzinken ? 'Ja' : 'Nee'}</p>
                <p><strong>Nagelpunten Gekloken:</strong> ${data.nagelpunten_gekloken ? 'Ja' : 'Nee'}</p>
                <p><strong>Na 1ste Onderdeel:</strong> ${data.na_1ste_onderdeel ? 'Ja' : 'Nee'}</p>
                <p><strong>Kist / Krat Opbouw:</strong> ${data.kist_opbouw ? 'Ja' : 'Nee'}</p>
                <p><strong>Steekproeven:</strong> ${data.steekproeven ? 'Ja' : 'Nee'}</p>
                <p><strong>HT Stempel:</strong> ${data.ht_stempel ? 'Ja' : 'Nee'}</p>
                <p><strong>Afmeting Stempel:</strong> ${data.afmeting_stempel ? 'Ja' : 'Nee'}</p>
                <p><strong>Klantspecifiek Stempel:</strong> ${data.klantspecifiek_stempel ? 'Ja' : 'Nee'}</p>
                <p><strong>Label (Juiste Code):</strong> ${data.label_code ? 'Ja' : 'Nee'}</p>
                <p><strong>Aantal per Stapel / WO:</strong> ${data.aantal_stapel ? 'Ja' : 'Nee'}</p>
                <p><strong>Conform Strapping:</strong> ${data.conform_strapping ? 'Ja' : 'Nee'}</p>
                <p><strong>Eind Steekproeven:</strong> ${data.eind_steekproeven ? 'Ja' : 'Nee'}</p>
                <p><strong>Commentaar:</strong> ${data.commentaar || 'Geen commentaar'}</p>
            `;
        })
        .catch(error => console.error('Error fetching checklist details:', error));
});
