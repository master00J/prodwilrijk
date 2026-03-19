document.addEventListener('DOMContentLoaded', () => {
    fetchBeschikbareLengtes();
});

// Define the optimize function
function optimize() {
    const vereisteLengtes = document.getElementById('vereisteLengtes').value
        .split('\n')
        .map(line => {
            const [length, count] = line.split(',').map(Number);
            return { length, count };
        })
        .filter(item => !isNaN(item.length) && !isNaN(item.count));

    fetch('/optimize', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ vereisteLengtes })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.json();
    })
    .then(data => {
        displayResults(data);
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Failed to optimize: ' + error.message);
    });
}

// Fetch available lengths on page load
document.addEventListener('DOMContentLoaded', () => {
    fetchBeschikbareLengtes();
});

function fetchBeschikbareLengtes() {
    fetch('/beschikbare-lengtes')
        .then(response => response.json())
        .then(data => {
            const select = document.getElementById('beschikbareLengtes');
            select.innerHTML = '';
            data.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = `${item.lengte}mm x ${item.dikte}mm x ${item.breedte}mm ${item.soort} (${item.aantal} stuks)`;
                select.appendChild(option);
            });
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to fetch available lengths: ' + error.message);
        });
}

function displayResults(data) {
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = '<h2 class="text-2xl font-bold mb-4">Zaagorders Overzicht</h2>';
    
    data.zaagorders.forEach((order, index) => {
        const orderCard = document.createElement('div');
        orderCard.className = 'order-card mb-4 p-4 bg-gray-100 rounded-lg';
        orderCard.innerHTML = `
            <h3 class="text-xl font-semibold mb-2">Zaagorder #${index + 1}</h3>
            <div class="grid grid-cols-2 gap-2">
                <div><strong>Plank ID:</strong> ${order.plankIds ? order.plankIds.join(', ') : order.plankId}</div>
                <div><strong>Soort:</strong> ${order.soort}</div>
                <div><strong>Originele Lengte:</strong> ${order.origineleLengtes ? order.origineleLengtes.join(', ') : order.origineleLengte} mm</div>
                <div><strong>Dikte:</strong> ${order.dikte} mm</div>
                <div><strong>Breedte:</strong> ${order.breedte} mm</div>
                <div><strong>Aantal planken:</strong> ${order.aantalPlanken}</div>
            </div>
            <p class="mt-2"><strong>Zaagpatroon:</strong></p>
            <ul class="list-disc list-inside">
                ${order.zaagsneden.map(lengte => `<li>${lengte} mm</li>`).join('')}
            </ul>
            <p class="mt-2"><strong>Instructies:</strong> Zaag ${order.aantalPlanken} ${order.aantalPlanken === 1 ? 'plank' : 'planken'} volgens bovenstaand patroon.</p>
        `;
        resultDiv.appendChild(orderCard);
    });

    if (data.afval.length > 0) {
        const afvalDiv = document.createElement('div');
        afvalDiv.innerHTML = `
            <h3 class="text-xl font-semibold mt-6 mb-2">Afval</h3>
            <table class="w-full border-collapse border border-gray-300">
                <tr class="bg-gray-200">
                    <th class="border border-gray-300 p-2">Lengte</th>
                    <th class="border border-gray-300 p-2">Aantal</th>
                    <th class="border border-gray-300 p-2">Soort</th>
                    <th class="border border-gray-300 p-2">Dikte</th>
                    <th class="border border-gray-300 p-2">Breedte</th>
                </tr>
                ${data.afval.map(item => `
                    <tr>
                        <td class="border border-gray-300 p-2">${item.lengte} mm</td>
                        <td class="border border-gray-300 p-2">${item.aantal}</td>
                        <td class="border border-gray-300 p-2">${item.soort}</td>
                        <td class="border border-gray-300 p-2">${item.dikte || 'N/A'} mm</td>
                        <td class="border border-gray-300 p-2">${item.breedte || 'N/A'} mm</td>
                    </tr>
                `).join('')}
            </table>
        `;
        resultDiv.appendChild(afvalDiv);
    }
}







