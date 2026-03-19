$(document).ready(function() {
    // Laad eerst de header
    $("#header-placeholder").load("/header.html", function() {
        // Start de applicatie nadat de header is geladen
        initializeApp();
    });

    function initializeApp() {
        const elements = {
            prepackIncoming: document.getElementById('prepack-incoming'),
            prepackToPack: document.getElementById('prepack-to-pack'),
            prepackPacked: document.getElementById('prepack-packed'),
            airtecIncoming: document.getElementById('airtec-incoming'),
            airtecToPack: document.getElementById('airtec-to-pack'),
            airtecPacked: document.getElementById('airtec-packed'),
            analysisResult: document.getElementById('analysis-result'),
            analysisChart: document.getElementById('analysis-chart')
        };

        // Root instance voor React 18
        let root = null;

        async function fetchAllData() {
            try {
                const [
                    prepackIncoming,
                    prepackToPack,
                    prepackPacked,
                    airtecIncoming,
                    airtecToPack,
                    airtecPacked
                ] = await Promise.all([
                    fetch('/api/incoming_goods').then(r => r.json()),
                    fetch('/api/items_to_pack').then(r => r.json()),
                    fetch('/api/packed_items').then(r => r.json()),
                    fetch('/api/incoming_goods_airtec').then(r => r.json()),
                    fetch('/api/items_to_pack_airtec').then(r => r.json()),
                    fetch('/api/packed_items_airtec').then(r => r.json())
                ]);

                updateStat(elements.prepackIncoming, sumItems(prepackIncoming));
                updateStat(elements.prepackToPack, sumItems(prepackToPack));
                updateStat(elements.prepackPacked, sumItems(prepackPacked));
                updateStat(elements.airtecIncoming, sumItems(airtecIncoming));
                updateStat(elements.airtecToPack, sumItems(airtecToPack));
                updateStat(elements.airtecPacked, sumItems(airtecPacked));

            } catch (error) {
                console.error('Error fetching data:', error);
                showError('Failed to fetch real-time data');
            }
        }

        function sumItems(items) {
            if (!Array.isArray(items)) return 0;
            return items.reduce((sum, item) => sum + (parseInt(item.amount || item.quantity) || 0), 0);
        }

        function updateStat(element, value) {
            if (!element) return;
            element.textContent = value;
            element.classList.add('updated');
            setTimeout(() => element.classList.remove('updated'), 1000);
        }

        function showError(message) {
            console.error(message);
        }

        function processAnalysisText(analysisText, prepackAverage, airtecAverage) {
            return `
                <div class="analysis-summary">
                    <div class="department-summary prepack">
                        <h4 class="text-primary">Prepack</h4>
                        <p>Gemiddeld per werkdag: ${prepackAverage} items</p>
                    </div>
                    <div class="department-summary airtec">
                        <h4 class="text-danger">Airtec</h4>
                        <p>Gemiddeld per werkdag: ${airtecAverage} items</p>
                    </div>
                    ${analysisText.split('\n').map(line => {
                        if (line.includes('Prepack Afdeling:')) {
                            return `<h5 class="text-primary mt-4">Prepack Afdeling:</h5>`;
                        }
                        if (line.includes('Airtec Afdeling:')) {
                            return `<h5 class="text-danger mt-4">Airtec Afdeling:</h5>`;
                        }
                        if (line.includes('Opvallend')) {
                            return `<h5 class="text-info mt-4">Analyse & Aanbevelingen:</h5>`;
                        }
                        if (line.trim().startsWith('-')) {
                            return `<p class="analysis-point">${line}</p>`;
                        }
                        return line ? `<p>${line}</p>` : '';
                    }).join('')}
                </div>
            `;
        }

        async function fetchDailyAnalysis() {
    if (!elements.analysisResult) return;

    try {
        elements.analysisResult.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i> Analyse wordt geladen...
            </div>
        `;

        const response = await fetch('/api/daily_analysis');
        if (!response.ok) {
            // Server gaf geen 200 status, gooi een error
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Controleer of de noodzakelijke data aanwezig is
        if (!data.analysisData || !data.analysisData.prepack || !data.analysisData.airtec) {
            throw new Error('Data structuur is onvolledig of ongeldig.');
        }

        const filteredPrepackData = (data.analysisData.prepack.dailyData || []).filter(day => 
            day.total_items > 0
        );
        const filteredAirtecData = (data.analysisData.airtec.dailyData || []).filter(day => 
            day.total_items > 0
        );

        const workingDaysCount = filteredPrepackData.length || 1; // vermijd delen door 0
        const prepackAverage = Math.round(
            filteredPrepackData.reduce((sum, day) => sum + (Number(day.total_items) || 0), 0) / workingDaysCount
        );
        const airtecAverage = Math.round(
            filteredAirtecData.reduce((sum, day) => sum + (Number(day.total_items) || 0), 0) / workingDaysCount
        );

        if (data.analysis) {
            elements.analysisResult.innerHTML = processAnalysisText(data.analysis, prepackAverage, airtecAverage);
        } else {
            elements.analysisResult.innerHTML = '<p>Geen analyse beschikbaar.</p>';
        }

        // Update grafiek indien mogelijk
        if (elements.analysisChart && window.Recharts) {
            const chartData = filteredPrepackData.map((prepackDay) => {
                const matchingAirtecDay = filteredAirtecData.find(
                    aDay => new Date(aDay.pack_date).toDateString() === new Date(prepackDay.pack_date).toDateString()
                ) || { total_items: 0 };

                return {
                    date: new Date(prepackDay.pack_date).toLocaleDateString('nl-NL', {
                        weekday: 'short',
                        day: '2-digit',
                        month: '2-digit'
                    }),
                    Prepack: parseInt(prepackDay.total_items) || 0,
                    Airtec: parseInt(matchingAirtecDay.total_items) || 0,
                    'Prepack Gemiddelde': prepackAverage,
                    'Airtec Gemiddelde': airtecAverage
                };
            });

            try {
                const chartElement = React.createElement(window.Recharts.ResponsiveContainer, 
                    { width: '100%', height: 300 },
                    React.createElement(window.Recharts.LineChart, 
                        { data: chartData },
                        React.createElement(window.Recharts.CartesianGrid, { strokeDasharray: '3 3' }),
                        React.createElement(window.Recharts.XAxis, { 
                            dataKey: 'date',
                            angle: -45,
                            textAnchor: 'end',
                            height: 80
                        }),
                        React.createElement(window.Recharts.YAxis),
                        React.createElement(window.Recharts.Tooltip),
                        React.createElement(window.Recharts.Legend),
                        React.createElement(window.Recharts.Line, {
                            type: 'monotone',
                            dataKey: 'Prepack',
                            stroke: '#2563eb',
                            strokeWidth: 2,
                            dot: { r: 4 }
                        }),
                        React.createElement(window.Recharts.Line, {
                            type: 'monotone',
                            dataKey: 'Airtec',
                            stroke: '#dc2626',
                            strokeWidth: 2,
                            dot: { r: 4 }
                        }),
                        React.createElement(window.Recharts.Line, {
                            type: 'monotone',
                            dataKey: 'Prepack Gemiddelde',
                            stroke: '#2563eb',
                            strokeWidth: 1,
                            strokeDasharray: '5 5',
                            dot: false
                        }),
                        React.createElement(window.Recharts.Line, {
                            type: 'monotone',
                            dataKey: 'Airtec Gemiddelde',
                            stroke: '#dc2626',
                            strokeWidth: 1,
                            strokeDasharray: '5 5',
                            dot: false
                        })
                    )
                );

                if (!root) {
                    elements.analysisChart.innerHTML = '';
                    root = ReactDOM.createRoot(elements.analysisChart);
                }
                root.render(chartElement);

            } catch (renderError) {
                console.error('Chart render error:', renderError);
                elements.analysisChart.innerHTML = `
                    <div class="alert alert-danger">
                        Fout bij het laden van de grafiek: ${renderError.message}
                    </div>
                `;
            }
        }

    } catch (error) {
        console.error('Error in fetchDailyAnalysis:', error);
        elements.analysisResult.innerHTML = `
            <div class="alert alert-danger">
                Er is een fout opgetreden bij het laden van de analyse: ${error.message}
            </div>
        `;
        if (elements.analysisChart) {
            elements.analysisChart.innerHTML = `
                <div class="alert alert-danger">
                    Fout bij het laden van de grafiek. Probeer de pagina te verversen.
                </div>
            `;
        }
    }
}


        // Start de initiële data fetch
        fetchAllData();
        fetchDailyAnalysis();

        // Stel de updates in
        setInterval(fetchAllData, 10000);
        setInterval(fetchDailyAnalysis, 300000);

        // Voeg de ververs knop toe
        if (elements.analysisResult) {
            const refreshButton = $('<button>', {
                class: 'btn btn-primary mt-3',
                html: '<i class="fas fa-sync"></i> Ververs Analyse'
            }).on('click', fetchDailyAnalysis);
            
            $(elements.analysisResult).parent().append(refreshButton);
        }

        // Icoon rotatie bij het openen en sluiten van Dagelijkse Analyse
        $('#analysisContent').on('shown.bs.collapse', function () {
            $('#toggleAnalysis i').removeClass('fa-chevron-down').addClass('fa-chevron-up');
        });

        $('#analysisContent').on('hidden.bs.collapse', function () {
            $('#toggleAnalysis i').removeClass('fa-chevron-up').addClass('fa-chevron-down');
        });

        // Icoon rotatie bij het openen en sluiten van Gedetailleerde Analyse
        $('#analysisResult').on('shown.bs.collapse', function () {
            $('#toggleAnalysisText i').removeClass('fa-chevron-down').addClass('fa-chevron-up');
        });

        $('#analysisResult').on('hidden.bs.collapse', function () {
            $('#toggleAnalysisText i').removeClass('fa-chevron-up').addClass('fa-chevron-down');
        });

        // Cleanup bij page unload
        $(window).on('unload', function() {
            if (root) {
                root.unmount();
            }
        });
    }
});
