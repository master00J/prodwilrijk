/**
 * Airtec Services - Tijdsregistratie API
 */

const express = require('express');
const router = express.Router();
const mysql = require('mysql');
const fileUpload = require('express-fileupload');
const xlsx = require('xlsx');

console.log('==========================================');
console.log('AIRTEC SERVICE WORDT GELADEN - DEBUG MODE');
console.log('==========================================');

// Gebruik direct de MySQL pool module i.p.v. een cyclische import
let db;

try {
    // Probeer eerst de pool van de parent module te gebruiken
    console.log('Database configuratie controleren...');
    console.log('Globale db object aanwezig?', !!global.db);
    
    // Vermijd cyclische import, probeer de pool direct te laden
    const pool = require('./db');
    console.log('Pool geladen:', !!pool);
    
    db = pool;
    console.log('Database pool wordt gebruikt');
} catch (err) {
    console.log('Fout bij ophalen database pool:', err.message);
    console.log('Maak nieuwe database verbinding...');
    
    // Maak een nieuwe verbinding als er geen bestaande is
    db = mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'airtec_db'
    });

    // Verbind met de database
    db.connect((err) => {
        if (err) {
            console.error('Fout bij verbinden met database:', err);
            // Laat de service doorgaan, zelfs als de database verbinding mislukt
        } else {
            console.log('Verbonden met de database');
        }
    });
}

// Eenvoudige in-memory dataopslag als fallback wanneer de database niet werkt
const memoryStorage = {
    logs: [],
    nextId: 1,
    addLog: function(log) {
        const newLog = { 
            ...log, 
            id: this.nextId++,
            start_time: new Date().toISOString()
        };
        this.logs.push(newLog);
        return newLog;
    },
    getActiveLogs: function() {
        return this.logs.filter(log => !log.end_time);
    },
    stopLog: function(logId) {
        const log = this.logs.find(l => l.id == logId);
        if (log) {
            log.end_time = new Date().toISOString();
            log.duration = Math.floor((new Date(log.end_time) - new Date(log.start_time)) / 1000);
            return log;
        }
        return null;
    }
};

// Helper functie voor veilige database queries
function safeQuery(query, params, callback) {
    try {
        // Check of we een pool of een enkele verbinding hebben
        console.log('Query uitvoeren:', query.substring(0, 50) + '...');
        
        if (db.query) {
            // Direct query uitvoeren als de db.query functie beschikbaar is
            db.query(query, params, (err, results) => {
                if (err) {
                    console.error('Database error:', err);
                    callback(err, null);
                } else {
                    console.log('Query succesvol uitgevoerd');
                    callback(null, results);
                }
            });
        } else if (db.getConnection) {
            // Haal een verbinding uit de pool als het een pool is
            db.getConnection((err, connection) => {
                if (err) {
                    console.error('Pool verbindingsfout:', err);
                    callback(err, null);
                    return;
                }
                
                connection.query(query, params, (err, results) => {
                    connection.release();
                    
                    if (err) {
                        console.error('Database error (pool):', err);
                        callback(err, null);
                    } else {
                        console.log('Query succesvol uitgevoerd (pool)');
                        callback(null, results);
                    }
                });
            });
        } else {
            console.error('Geen geldige database-verbinding beschikbaar');
            callback(new Error('Geen database-verbinding beschikbaar'), null);
        }
    } catch (err) {
        console.error('Kritieke database error:', err);
        callback(err, null);
    }
}

// Probeer de tabel te maken als die nog niet bestaat, maar geef niet om als dit mislukt
try {
    db.query(`
        CREATE TABLE IF NOT EXISTS airtec_timelogs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            start_time DATETIME NOT NULL,
            end_time DATETIME NULL,
            werknemer_ids TEXT NOT NULL,
            duration INT DEFAULT 0,
            type VARCHAR(50) DEFAULT 'Airtec',
            box_type VARCHAR(50) NULL,
            quantity_packed INT DEFAULT 0
        )
    `, (err) => {
        if (err) {
            console.error('Fout bij maken airtec_timelogs tabel (niet kritiek):', err);
        } else {
            console.log('Airtec timelogs tabel bestaat of is aangemaakt');
        }
    });
} catch (err) {
    console.error('Kon airtec_timelogs tabel niet maken (niet kritiek):', err);
}

// Maak tabel voor kistprijzen als deze nog niet bestaat
try {
    db.query(`
        CREATE TABLE IF NOT EXISTS airtec_prices (
            kistnummer VARCHAR(50) PRIMARY KEY,
            erp_code VARCHAR(100) NULL,
            price DECIMAL(10,2) NOT NULL,
            assembly_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
            material_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
            transport_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Fout bij maken airtec_prices tabel (niet kritiek):', err);
        } else {
            console.log('airtec_prices tabel bestaat of is aangemaakt');
        }
    });
} catch (err) {
    console.error('Kon airtec_prices tabel niet maken (niet kritiek):', err);
}

// Maak tabel voor leveringen als deze nog niet bestaat
try {
    db.query(`
        CREATE TABLE IF NOT EXISTS airtec_leveringen (
            id INT AUTO_INCREMENT PRIMARY KEY,
            datum DATE NOT NULL,
            totaal_transportkost DECIMAL(10,2) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Fout bij maken airtec_leveringen tabel (niet kritiek):', err);
        } else {
            console.log('airtec_leveringen tabel bestaat of is aangemaakt');
        }
    });
} catch (err) {
    console.error('Kon airtec_leveringen tabel niet maken (niet kritiek):', err);
}

// Maak tabel voor leveringen details als deze nog niet bestaat
try {
    db.query(`
        CREATE TABLE IF NOT EXISTS airtec_leveringen_details (
            id INT AUTO_INCREMENT PRIMARY KEY,
            levering_id INT,
            kistnummer VARCHAR(50),
            aantal INT,
            transportkost_per_stuk DECIMAL(10,2),
            FOREIGN KEY (levering_id) REFERENCES airtec_leveringen(id)
        )
    `, (err) => {
        if (err) {
            console.error('Fout bij maken airtec_leveringen_details tabel (niet kritiek):', err);
        } else {
            console.log('airtec_leveringen_details tabel bestaat of is aangemaakt');
        }
    });
} catch (err) {
    console.error('Kon airtec_leveringen_details tabel niet maken (niet kritiek):', err);
}

// Voeg body parsing middleware toe
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// Middleware voor file uploads
router.use(fileUpload({
    createParentPath: true,
    limits: { fileSize: 10 * 1024 * 1024 }
}));

// API-route voor het starten van een tijdsregistratie
router.post('/timelog/start', (req, res) => {
    console.log('POST /api/airtec/timelog/start ontvangen');
    console.log('Request body:', JSON.stringify(req.body));
    
    const { werknemers } = req.body;
    const startTime = new Date();
    
    console.log('Start Airtec Tijd Registratie:', { werknemers, startTime });
    
    if (!Array.isArray(werknemers) || werknemers.length === 0) {
        console.warn('Ongeldige invoer:', req.body);
        return res.status(400).json({ success: false, message: 'Geef minstens één werknemer op' });
    }
    
    try {
        // Probeer toe te voegen aan de database
        const insertQuery = `
            INSERT INTO airtec_timelogs (start_time, werknemer_ids, type)
            VALUES (?, ?, ?)
        `;
        
        safeQuery(insertQuery, [startTime, JSON.stringify(werknemers), 'Airtec'], (err, result) => {
            if (err) {
                console.log('Fallback naar memory storage vanwege database error');
                // Fallback: gebruik memory storage als de database niet werkt
                const newLog = memoryStorage.addLog({
                    werknemer_ids: werknemers,
                    type: 'Airtec'
                });
                
                res.json({ success: true, log_id: 'mem_' + newLog.id });
            } else {
                console.log('Airtec tijdsregistratie succesvol gestart in database:', result);
                res.json({ success: true, log_id: result.insertId });
            }
        });
    } catch (err) {
        console.error('Onverwachte fout bij starten tijdsregistratie:', err);
        
        // Fallback: gebruik memory storage bij exceptions
        const newLog = memoryStorage.addLog({
            werknemer_ids: werknemers,
            type: 'Airtec'
        });
        
        res.json({ success: true, log_id: 'mem_' + newLog.id });
    }
});

// Stop Airtec tijdsregistratie
router.post('/timelog/:logId/stop', (req, res) => {
    const logId = req.params.logId;
    const endTime = new Date();

    console.log('Stop Airtec Tijd Registratie voor logId:', logId, 'om', endTime);

    // Memory fallback
    if (logId.toString().startsWith('mem_')) {
        const memId = parseInt(logId.substring(4));
        const updatedLog = memoryStorage.stopLog(memId);
        if (updatedLog) {
            return res.json({ success: true, duration: updatedLog.duration });
        } else {
            return res.status(404).json({ success: false, message: 'Log niet gevonden in memory storage' });
        }
    }

    try {
        safeQuery('SELECT start_time FROM airtec_timelogs WHERE id = ?', [logId], (err, logs) => {
            if (err || logs.length === 0) {
                return res.status(404).json({ success: false, message: 'Log niet gevonden' });
            }
            const startTime = new Date(logs[0].start_time);
            const durationSeconds = Math.floor((endTime - startTime) / 1000);

            // Update alleen end_time en duration
            safeQuery(
                'UPDATE airtec_timelogs SET end_time = ?, duration = ? WHERE id = ?', 
                [endTime, durationSeconds, logId],
                (updateErr) => {
                    if (updateErr) {
                        console.error('Fout bij updaten log:', updateErr);
                        return res.status(500).json({ success: false, message: 'Fout bij stoppen tijdsregistratie' });
                    }
                    res.json({ success: true, duration: durationSeconds });
                }
            );
        });
    } catch (err) {
        console.error('Onverwachte fout bij stoppen tijdsregistratie:', err);
        return res.status(500).json({ success: false, message: 'Onverwachte fout bij stoppen tijdsregistratie' });
    }
});

// Haal actieve Airtec timelogs op
router.get('/timelog/active', (req, res) => {
    console.log('Ophalen actieve tijdsregistraties');
    
    try {
        // Probeer eerst uit de database
        safeQuery('SELECT * FROM airtec_timelogs WHERE end_time IS NULL', [], (err, logs) => {
            if (err) {
                console.log('Fallback naar memory storage voor actieve logs');
                // Fallback naar memory storage bij database fouten
                const memLogs = memoryStorage.getActiveLogs().map(log => ({
                    ...log,
                    id: 'mem_' + log.id
                }));
                
                return res.json(memLogs);
            }
            
            // Parse werknemer_ids terug naar array
            try {
                const parsedLogs = logs.map(log => ({
                    ...log,
                    werknemer_ids: JSON.parse(log.werknemer_ids || '[]')
                }));
                
                // Voeg memory logs toe aan de resultaten
                const memLogs = memoryStorage.getActiveLogs().map(log => ({
                    ...log,
                    id: 'mem_' + log.id
                }));
                
                const allLogs = [...parsedLogs, ...memLogs];
                res.json(allLogs);
            } catch (parseErr) {
                console.error('Fout bij parsen werknemer IDs:', parseErr);
                // Return raw logs if parsing fails
                res.json(logs);
            }
        });
    } catch (err) {
        console.error('Onverwachte fout bij ophalen actieve logs:', err);
        
        // Fallback naar memory storage bij exceptions
        const memLogs = memoryStorage.getActiveLogs().map(log => ({
            ...log,
            id: 'mem_' + log.id
        }));
        
        res.json(memLogs);
    }
});

// API voor het maken van het Airtec rapport (dagtotalen manuren)
router.get('/report', (req, res) => {
    const date = req.query.date;
    let filter = '';
    const params = [];
    if (date) {
        filter = 'WHERE DATE(start_time) = ?';
        params.push(date);
    }
    const query = `
        SELECT DATE(start_time) AS log_date,
               SUM(duration) / 3600 AS total_hours,
               COUNT(*) AS total_entries
        FROM airtec_timelogs
        ${filter}
        GROUP BY DATE(start_time)
        ORDER BY DATE(start_time) DESC
    `;
    safeQuery(query, params, (err, results) => {
        if (err) {
            console.error('Fout bij ophalen dagtotalen:', err);
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, daily_totals: results });
    });
});

// API om airtec timelogs op te slaan
router.post('/track', (req, res) => {
    // Vereenvoudigde implementatie die altijd succesvol is
    res.json({ success: true });
});

// Endpoint om de tijdsregistratie-status bij te werken
router.post('/timelog/update_state', (req, res) => {
    // Vereenvoudigde implementatie die altijd succesvol is
    res.json({ success: true });
});

// GET endpoint voor timelogs met optionele datumfilters
router.get('/timelog', (req, res) => {
    const { date_from, date_to } = req.query;
    let query = 'SELECT * FROM airtec_timelogs WHERE 1=1';
    const params = [];
    if (date_from) {
        query += ' AND start_time >= ?';
        params.push(date_from);
    }
    if (date_to) {
        query += ' AND start_time <= ?';
        params.push(date_to);
    }
    safeQuery(query, params, (err, logs) => {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
        // Parse werknemer_ids terug naar array
        const parsed = logs.map(log => ({
            ...log,
            werknemer_ids: JSON.parse(log.werknemer_ids || '[]')
        }));
        res.json(parsed);
    });
});

// Endpoint voor ophalen van alle kistprijzen
router.get('/prices', (req, res) => {
    const query = 'SELECT kistnummer, erp_code, price, assembly_cost, material_cost, transport_cost FROM airtec_prices';
    safeQuery(query, [], (err, results) => {
        if (err) {
            console.error('Fout bij ophalen kistprijzen:', err);
            return res.status(500).json({ success: false, message: err.message });
        }
        res.json({ success: true, prices: results });
    });
});

// Endpoint voor aanmaken of updaten van prijs per kistnummer
router.put('/prices/:kistnummer', (req, res) => {
    const { kistnummer } = req.params;
    const { price, erp_code, assembly_cost, material_cost, transport_cost } = req.body;
    if (price == null || isNaN(price)) {
        return res.status(400).json({ success: false, message: 'Ongeldige prijs' });
    }
    if (assembly_cost == null || isNaN(assembly_cost) || material_cost == null || isNaN(material_cost)) {
        return res.status(400).json({ success: false, message: 'Ongeldige kostprijzen' });
    }
    // erp_code kan leeg zijn, transport_cost kan null zijn
    const transport = transport_cost != null && !isNaN(transport_cost) ? transport_cost : 0;
    
    const query = `
        INSERT INTO airtec_prices (kistnummer, erp_code, price, assembly_cost, material_cost, transport_cost)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE erp_code = ?, price = ?, assembly_cost = ?, material_cost = ?, transport_cost = ?
    `;
    const params = [kistnummer, erp_code || null, price, assembly_cost, material_cost, transport,
                    erp_code || null, price, assembly_cost, material_cost, transport];
    safeQuery(query, params, (err) => {
        if (err) {
            console.error('Fout bij updaten kistprijs:', err);
            return res.status(500).json({ success: false, message: err.message });
        }
        res.json({ success: true });
    });
});

// Endpoint voor upload van prijslijst (Excel)
router.post('/prices/upload', (req, res) => {
    if (!req.files || !req.files.file) {
        return res.status(400).json({ success: false, message: 'Geen bestand geüpload' });
    }
    const file = req.files.file;
    try {
        // Lees workbook
        const workbook = xlsx.read(file.data, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        // Verwerk elke rij: kolom D=ERP code, E=kistnummer, K=prijs (0-indexed: 3,4,10)
        const dataRows = rows.slice(1).filter(r => r && r.length);
        if (!dataRows.length) {
            return res.status(400).json({ success: false, message: 'Geen data in prijslijst' });
        }
        let processed = 0, errors = [];
        dataRows.forEach(row => {
            const erp_code = row[3];
            const price = parseFloat(row[10]);
            if (erp_code && !isNaN(price)) {
                safeQuery(
                    'UPDATE airtec_prices SET price = ? WHERE erp_code = ?',
                    [price, erp_code],
                    (err, result) => {
                        if (err) {
                            errors.push({ erp_code, error: err.message });
                        } else if (result.affectedRows === 0) {
                            errors.push({ erp_code, error: 'Geen matchende ERP code' });
                        }
                        processed++;
                        if (processed === dataRows.length) {
                            if (errors.length) {
                                return res.status(207).json({ success: false, processed, errors });
                            }
                            res.json({ success: true, processed });
                        }
                    }
                );
            } else {
                processed++;
                if (processed === dataRows.length) {
                    if (errors.length) {
                        return res.status(207).json({ success: false, processed, errors });
                    }
                    res.json({ success: true, processed });
                }
            }
        });
    } catch (err) {
        console.error('Fout bij import prijslijst:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Endpoint voor registratie van leveringen
router.post('/leveringen', (req, res) => {
    const { datum, totaal_transportkost, lijnen } = req.body;
    if (!datum || totaal_transportkost == null || !Array.isArray(lijnen) || lijnen.length === 0) {
        return res.status(400).json({ success: false, message: 'Ongeldige invoer voor levering' });
    }
    const totalUnits = lijnen.reduce((sum, l) => sum + (parseInt(l.aantal) || 0), 0);
    if (totalUnits <= 0) {
        return res.status(400).json({ success: false, message: 'Totaal aantal moet groter dan 0 zijn' });
    }
    // Uniforme fallback-transportkost per stuk
    const uniformCost = parseFloat((totaal_transportkost / totalUnits).toFixed(2));
    safeQuery(
        'INSERT INTO airtec_leveringen (datum, totaal_transportkost) VALUES (?, ?)',
        [datum, totaal_transportkost],
        (err, result) => {
            if (err) {
                console.error('Fout bij inserten levering:', err);
                return res.status(500).json({ success: false, message: err.message });
            }
            const leveringId = result.insertId;
            let inserted = 0;
            let hasError = false;
            lijnen.forEach(line => {
                // Bepaal transportkost per stuk: gebruik opgegeven, anders uniform
                const tps = line.transportkost_per_stuk != null
                    ? parseFloat(line.transportkost_per_stuk)
                    : uniformCost;
                safeQuery(
                    'INSERT INTO airtec_leveringen_details (levering_id, kistnummer, aantal, transportkost_per_stuk) VALUES (?, ?, ?, ?)',
                    [leveringId, line.kistnummer, line.aantal, tps],
                    (err2) => {
                        inserted++;
                        if (err2) {
                            console.error('Fout bij inserten levering detail:', err2);
                            hasError = true;
                        }
                        if (inserted === lijnen.length) {
                            if (hasError) {
                                return res.status(500).json({ success: false, message: 'Fout bij opslaan van details' });
                            }
                            res.json({ success: true, levering_id: leveringId });
                        }
                    }
                );
            });
        }
    );
});

// Endpoint voor ophalen van leveringen voor historiek/evolutie
router.get('/leveringen', (req, res) => {
    const query = `
        SELECT DATE(l.datum) AS datum,
               COUNT(d.id) AS aantal_rijen,
               SUM(d.aantal * IFNULL(p.price,0)) AS totaalwaarde,
               SUM(l.totaal_transportkost) AS totaaltransport
        FROM airtec_leveringen l
        JOIN airtec_leveringen_details d ON d.levering_id = l.id
        LEFT JOIN airtec_prices p ON p.kistnummer = d.kistnummer
        GROUP BY DATE(l.datum)
        ORDER BY DATE(l.datum)
    `;
    safeQuery(query, [], (err, results) => {
        if (err) {
            console.error('Fout bij ophalen leveringen:', err);
            return res.status(500).json({ success: false, message: err.message });
        }
        res.json({ success: true, data: results });
    });
});

// Endpoint voor ophalen van details van een specifieke levering
router.get('/leveringen/:id/details', (req, res) => {
    const leveringId = req.params.id;
    const query = `
        SELECT d.id,
               d.kistnummer,
               d.aantal,
               d.transportkost_per_stuk,
               IFNULL(p.price, 0) AS prijs_per_stuk,
               IFNULL(p.price * d.aantal, 0) AS waarde,
               IFNULL(d.transportkost_per_stuk * d.aantal, 0) AS transport_totaal
        FROM airtec_leveringen_details d
        LEFT JOIN airtec_prices p ON p.kistnummer = d.kistnummer
        WHERE d.levering_id = ?
    `;
    safeQuery(query, [leveringId], (err, results) => {
        if (err) {
            console.error('Fout bij ophalen levering details:', err);
            return res.status(500).json({ success: false, message: err.message });
        }
        res.json({ success: true, details: results });
    });
});

// Endpoint voor ophalen van alle leveringen (per levering)
router.get('/leveringen/all', (req, res) => {
    const query = `
        SELECT l.id,
               DATE(l.datum) AS datum,
               l.totaal_transportkost AS totaaltransport,
               SUM(d.aantal) AS totaal_kisten,
               SUM(d.aantal * IFNULL(p.price,0)) AS totaalwaarde
        FROM airtec_leveringen l
        JOIN airtec_leveringen_details d ON d.levering_id = l.id
        LEFT JOIN airtec_prices p ON p.kistnummer = d.kistnummer
        GROUP BY l.id
        ORDER BY l.datum DESC
    `;
    safeQuery(query, [], (err, results) => {
        if (err) {
            console.error('Fout bij ophalen alle leveringen:', err);
            return res.status(500).json({ success: false, message: err.message });
        }
        res.json({ success: true, data: results });
    });
});

// Endpoint voor ophalen details van een specifieke levering
router.get('/leveringen/:leveringId', (req, res) => {
    const leveringId = req.params.leveringId;
    // Haal hoofdgegevens op
    safeQuery('SELECT datum, totaal_transportkost FROM airtec_leveringen WHERE id = ?', [leveringId], (err, rows) => {
        if (err) {
            console.error('Fout bij ophalen levering header:', err);
            return res.status(500).json({ success: false, message: err.message });
        }
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Levering niet gevonden' });
        }
        const header = rows[0];
        // Haal detailregels op
        const detailQuery = `
            SELECT d.kistnummer,
                   d.aantal,
                   d.transportkost_per_stuk,
                   IFNULL(p.price, 0) AS prijs_per_stuk
            FROM airtec_leveringen_details d
            LEFT JOIN airtec_prices p ON p.kistnummer = d.kistnummer
            WHERE d.levering_id = ?
        `;
        safeQuery(detailQuery, [leveringId], (err2, details) => {
            if (err2) {
                console.error('Fout bij ophalen levering details:', err2);
                return res.status(500).json({ success: false, message: err2.message });
            }
            res.json({
                success: true,
                levering: {
                    id: leveringId,
                    datum: header.datum,
                    totaaltransport: header.totaal_transportkost,
                    details
                }
            });
        });
    });
});

module.exports = router; 