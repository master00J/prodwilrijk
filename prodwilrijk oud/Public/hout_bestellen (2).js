$(document).ready(function() {
    let orderList = [];

    // Formulier submit handler
    $('#orderForm').submit(function(e) {
        e.preventDefault();

        // Formulierwaarden verzamelen
        const orderItem = {
            houtsoort: $('#houtsoort').val(),
            minLengte: $('#min-lengte').val().trim(),
            dikte: $('#dikte').val().trim(),
            breedte: $('#breedte').val().trim(),
            aantalPakken: $('#aantal-pakken').val().trim(),
            opmerkingen: $('#opmerkingen').val().trim()
        };

        // Validatie
        if (!orderItem.houtsoort || !orderItem.minLengte || !orderItem.dikte || 
            !orderItem.breedte || !orderItem.aantalPakken) {
            alert("Vul alle verplichte velden in voordat je toevoegt.");
            return;
        }

        // Item toevoegen en UI updaten
        orderList.push(orderItem);
        renderOrderList();
        resetForm();
    });

    // Verwijder item handler
    $(document).on('click', '.remove-item', function() {
        const index = $(this).data('index');
        orderList.splice(index, 1);
        renderOrderList();
    });

    // Toevoegen aan openstaande bestellingen
    $('#add-to-open-orders').click(function() {
        if (orderList.length === 0) {
            alert('De bestellijst is leeg. Voeg eerst items toe.');
            return;
        }

        $.ajax({
            url: '/api/plaats_bestelling',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(orderList),
            success: function(response) {
                alert('Bestelling succesvol toegevoegd aan openstaande bestellingen!');
                orderList = [];
                renderOrderList();
            },
            error: function(err) {
                console.error('Error bij plaatsen bestelling:', err);
                alert('Er is een fout opgetreden bij het toevoegen van de bestelling.');
            }
        });
    });

    // Helper functies
    function renderOrderList() {
        const orderListElement = $('#orderList');
        orderListElement.empty();
        $('#total-items').text(orderList.length);

        orderList.forEach((item, index) => {
            orderListElement.append(`
                <div class="order-list-item">
                    <button class="remove-item" data-index="${index}">
                        <i class="fas fa-times"></i>
                    </button>
                    <div class="row">
                        <div class="col-md-6">
                            <strong>Houtsoort:</strong> ${item.houtsoort}
                            <br>
                            <strong>Aantal pakken:</strong> ${item.aantalPakken}
                        </div>
                        <div class="col-md-6">
                            <strong>Afmetingen:</strong> ${item.minLengte} x ${item.breedte} x ${item.dikte} mm
                            ${item.opmerkingen ? `<br><strong>Opmerkingen:</strong> ${item.opmerkingen}` : ''}
                        </div>
                    </div>
                </div>
            `);
        });
    }

    function resetForm() {
        $('#orderForm')[0].reset();
        $('#houtsoort').val('');
    }
});