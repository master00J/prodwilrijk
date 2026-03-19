// Prepack Consumption Page Script
// Author: AI assistant

$(document).ready(function () {
    const table = $('#prepack-table').DataTable({
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/nl-NL.json'
        },
        order: [[1, 'asc']],
        columnDefs: [
            { targets: 0, orderable: false, className: 'text-center' },
            { targets: 6, className: 'text-end' }
        ]
    });

    const $filterDate = $('#filter-date');
    $filterDate.val(new Date().toISOString().substring(0, 10));

    loadData();

    $filterDate.on('change', loadData);

    // ---------------------
    // Helpers
    // ---------------------
    function loadData() {
        const selectedDate = $filterDate.val();
        $.getJSON(`/api/prepack/consumption?date=${selectedDate}`, function (data) {
            table.clear();
            data.forEach(line => {
                const checkbox = `<input type="checkbox" data-id="${line.id}" class="form-check-input mark-complete" ${line.completed ? 'checked disabled' : ''}>`;
                table.row.add([
                    checkbox,
                    line.date_marked,
                    line.order_nummer,
                    line.item_code,
                    line.material_code,
                    line.description || '',
                    Number(line.quantity).toLocaleString('nl-BE'),
                    line.unit || ''
                ]);
            });
            table.draw();
        });
    }

    // Event delegation for checkbox clicks
    $('#prepack-table tbody').on('click', 'input.mark-complete', function () {
        const id = $(this).data('id');
        const $checkbox = $(this);
        $.ajax({
            url: `/api/prepack/consumption/${id}/complete`,
            method: 'POST',
            success() {
                $checkbox.prop('disabled', true);
            },
            error(err) {
                console.error(err);
                alert('Kon de lijn niet bijwerken.');
                $checkbox.prop('checked', false);
            }
        });
    });
}); 