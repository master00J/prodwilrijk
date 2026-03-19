$(document).ready(function() {
    // Laad de header dynamisch
    fetch('header.html')
        .then(response => response.text())
        .then(data => {
            $('#header-placeholder').html(data);
        });

    $('#addHoutForm').submit(function(e) {
        e.preventDefault();
        const formData = {
            soort: $('#soort').val(),
            lengte: $('#lengte').val(),
            breedte: $('#breedte').val(),
            dikte: $('#dikte').val(),
            locatie: $('#locatie').val(),
            aantal: $('#aantal').val()
        };

        $.ajax({
            url: '/api/add_hout',
            method: 'POST',
            data: JSON.stringify(formData),
            contentType: 'application/json',
            success: function() {
                alert('Hout succesvol toegevoegd!');
                $('#addHoutForm')[0].reset();
            },
            error: function(err) {
                console.error('Error adding wood:', err);
                alert('Kon hout niet toevoegen.');
            }
        });
    });
});
