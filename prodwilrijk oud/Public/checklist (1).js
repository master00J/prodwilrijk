document.addEventListener('DOMContentLoaded', function() {
    // Haal de lijst met werkorders op zodra de pagina geladen is
    fetch('/api/get_all_workorders')
        .then(response => response.json())
        .then(data => {
            const werkorderSelect = document.getElementById('werkorder');
            data.forEach(werkorder => {
                const option = document.createElement('option');
                option.value = werkorder.order_number;
                option.textContent = werkorder.order_number;
                werkorderSelect.appendChild(option);
            });
        })
        .catch(error => console.error('Error fetching workorders:', error));

    // Laad de order_descriptions (werkorder lijnen) zodra een werkorder is geselecteerd
    document.getElementById('werkorder').addEventListener('change', function() {
        const werkorder = this.value;

        if (werkorder) {
            // Haal de order_descriptions op op basis van het geselecteerde werkorder
            fetch(`/api/get_order_descriptions?werkorder=${werkorder}`)
                .then(response => response.json())
                .then(data => {
                    const descriptionSelect = document.getElementById('order_description');
                    descriptionSelect.innerHTML = '';  // Maak de huidige lijst leeg

                    data.forEach(description => {
                        const option = document.createElement('option');
                        option.value = description.id;  // Gebruik de id van de beschrijving
                        option.textContent = description.order_description;
                        descriptionSelect.appendChild(option);
                    });
                })
                .catch(error => console.error('Error fetching order descriptions:', error));
        }
    });
});

function submitChecklist() {
    const werkorder = document.getElementById('werkorder').value;
    const orderDescription = document.getElementById('order_description').value;
    const datum = document.getElementById('datum').value;
    const verantwoordelijke = document.getElementById('verantwoordelijke').value;
    const stuklijst = document.getElementById('stuklijst').checked;
    const tekening = document.getElementById('tekening').checked;
    const nagel_type_lengte = document.getElementById('nagel_type_lengte').checked;
    const nagel_wijze = document.getElementById('nagel_wijze').checked;
    const uitstekende_nagels = document.getElementById('uitstekende_nagels').checked;
    const nagelkoppen_verzinken = document.getElementById('nagelkoppen_verzinken').checked;
    const nagelpunten_gekloken = document.getElementById('nagelpunten_gekloken').checked;
    const na_1ste_onderdeel = document.getElementById('na_1ste_onderdeel').checked;
    const kist_opbouw = document.getElementById('kist_opbouw').checked;
    const steekproeven = document.getElementById('steekproeven').checked;
    const ht_stempel = document.getElementById('ht_stempel').checked;
    const afmeting_stempel = document.getElementById('afmeting_stempel').checked;
    const klantspecifiek_stempel = document.getElementById('klantspecifiek_stempel').checked;
    const label_code = document.getElementById('label_code').checked;
    const aantal_stapel = document.getElementById('aantal_stapel').checked;
    const conform_strapping = document.getElementById('conform_strapping').checked;
    const eind_steekproeven = document.getElementById('eind_steekproeven').checked;

    if (!werkorder) {
        alert('Selecteer een werkorder.');
        return;
    }

    const checklistData = {
        werkorder,
        orderDescription,
        datum,
        verantwoordelijke,
        stuklijst,
        tekening,
        nagel_type_lengte,
        nagel_wijze,
        uitstekende_nagels,
        nagelkoppen_verzinken,
        nagelpunten_gekloken,
        na_1ste_onderdeel,
        kist_opbouw,
        steekproeven,
        ht_stempel,
        afmeting_stempel,
        klantspecifiek_stempel,
        label_code,
        aantal_stapel,
        conform_strapping,
        eind_steekproeven
    };

    console.log('Checklist data:', checklistData);  // Log de checklistgegevens

    // Verstuur de checklistgegevens naar de server
    fetch('/api/save_checklist', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(checklistData)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(error => { throw new Error(error.error); });
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            alert('Checklist succesvol opgeslagen!');
            
            // Werkorder lijn uit de lijst verwijderen
            const descriptionSelect = document.getElementById('order_description');
            const selectedOption = descriptionSelect.querySelector(`option[value="${orderDescription}"]`);
            if (selectedOption) {
                selectedOption.remove();  // Verwijder de geselecteerde werkorder lijn
            }

            // Werkorder verwijderen als er geen lijnen meer zijn
            if (descriptionSelect.options.length === 0) {
                const werkorderSelect = document.getElementById('werkorder');
                const selectedWerkorder = werkorderSelect.querySelector(`option[value="${werkorder}"]`);
                if (selectedWerkorder) {
                    selectedWerkorder.remove();  // Verwijder de werkorder als er geen lijnen meer zijn
                }
            }

            // Reset de interface: deselecteer alle velden en simuleer een "refresh"
            document.getElementById('werkorder').value = '';
            document.getElementById('order_description').innerHTML = '<option value="">Selecteer een werkorder lijn</option>';
            document.getElementById('datum').value = '';
            document.getElementById('verantwoordelijke').value = '';
            document.getElementById('commentaar').value = '';
            document.getElementById('stuklijst').checked = false;
            document.getElementById('tekening').checked = false;

        } else {
            alert('Fout bij het opslaan van de checklist');
        }
    })
    .catch(error => {
        console.error('Error saving checklist:', error);
        alert('Fout bij het opslaan: ' + error.message);
    });
}
