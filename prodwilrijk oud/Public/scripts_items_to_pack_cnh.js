document.addEventListener('DOMContentLoaded', (event) => {
    let itemsData = [];

    // Load the header
    fetch('header.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById('header-placeholder').innerHTML = data;
        });

    const tableBody = document.getElementById('items-to-pack-table-body');

    // Fetch the items to pack data
    function fetchItemsData() {
        fetch('/api/items_to_pack_cnh')
            .then(response => response.json())
            .then(data => {
                itemsData = data;
                updateTable(itemsData);
            })
            .catch(error => console.error('Error fetching items to pack:', error));
    }

    function updateTable(data) {
        tableBody.innerHTML = '';
        data.forEach(item => {
            const datumBinnen = item.datum_binnen ? new Date(item.datum_binnen).toLocaleDateString() : '';
            const datumOntvangen = item.datum_ontvangen ? new Date(item.datum_ontvangen).toLocaleDateString() : '';
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.id}</td>
                <td>${item.motornummer}</td>
                <td>${item.type}</td>
                <td>${item.verzendnota}</td>
                <td>${datumBinnen}</td>
                <td>${datumOntvangen}</td>
                <td><input type="checkbox" data-id="${item.id}"></td>
            `;
            tableBody.appendChild(row);
        });
        document.getElementById('total-items').innerText = data.length;
    }

    // Search functionality
    document.getElementById('search-button').addEventListener('click', () => {
        const searchMotorNumber = document.getElementById('search-motornummer').value.toLowerCase();
        const searchType = document.getElementById('search-type').value.toLowerCase();
        const filteredData = itemsData.filter(item =>
            (!searchMotorNumber || item.motornummer.toLowerCase().includes(searchMotorNumber)) &&
            (!searchType || item.type.toLowerCase().includes(searchType))
        );
        updateTable(filteredData);
    });

    // Combined sort functionality
    document.getElementById('sort-button').addEventListener('click', () => {
        const sortedData = [...itemsData].sort((a, b) => {
            const motorNumberComparison = a.motornummer.localeCompare(b.motornummer);
            if (motorNumberComparison !== 0) {
                return motorNumberComparison;
            }
            return (a.type || '').localeCompare(b.type || '');
        });
        updateTable(sortedData);
    });

    // Handle confirmation of packed items
    document.getElementById('confirm-packed-button').addEventListener('click', () => {
        const checkedBoxes = document.querySelectorAll('input[type="checkbox"]:checked');
        const checkedIds = Array.from(checkedBoxes).map(checkbox => checkbox.getAttribute('data-id'));

        fetch('/pack_items_cnh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ids: checkedIds })
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                fetchItemsData(); // Reload the data to update the list
            } else {
                alert('Failed to pack items.');
            }
        })
        .catch(error => {
            console.error('Error packing items:', error);
        });
    });

    // Initial fetch of items data
    fetchItemsData();
});
