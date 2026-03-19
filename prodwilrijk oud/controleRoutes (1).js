// controleRoutes.js
const express = require('express');
const router = express.Router();
const db = require('./db'); // Je databaseverbinding (enkele connectie)
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises; // Gebruik fs.promises voor asynchrone operaties
const fsSync = require('fs'); // Voor synchrone operaties indien strikt nodig (zoals mkdirSync)

// === BEGIN Helper Functies ===
function queryDb(sqlQuery, params = []) {
    return new Promise((resolve, reject) => {
        db.query(sqlQuery, params, (err, results) => {
            if (err) {
                return reject(err);
            }
            resolve(results);
        });
    });
}

function beginTransaction() {
    return new Promise((resolve, reject) => {
        db.beginTransaction((err) => {
            if (err) { return reject(err); }
            resolve();
        });
    });
}

function commit() {
    return new Promise((resolve, reject) => {
        db.commit((err) => {
            if (err) { return reject(err); }
            resolve();
        });
    });
}

function rollback() {
    return new Promise((resolve, reject) => {
        db.rollback(() => { // rollback's callback heeft geen error argument
            resolve();
        });
    });
}
// === EINDE Helper Functies ===

// Configuratie voor het opslaan van foto's voor de controles
// Plaats uploads bij voorkeur binnen je projectstructuur, bv. in een 'uploads' map op root niveau
const controleFotoDir = path.join(__dirname, '..', 'uploads', 'controle_fotos'); // Gaat één niveau omhoog vanuit routes, dan naar uploads.
// Als controleRoutes.js in de root staat, dan: path.join(__dirname, 'uploads', 'controle_fotos');

// Zorg ervoor dat de uploadmap bestaat
// Asynchroon map aanmaken is complexer met Express startup, dus hier synchroon is acceptabel.
if (!fsSync.existsSync(controleFotoDir)) {
    try {
        fsSync.mkdirSync(controleFotoDir, { recursive: true });
        console.log(`Upload map aangemaakt: ${controleFotoDir}`);
    } catch (err) {
        console.error(`Fout bij aanmaken upload map ${controleFotoDir}:`, err);
        // Overweeg de applicatie niet te starten als de upload map essentieel is en niet aangemaakt kan worden.
    }
}


const controleFotoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, controleFotoDir);
    },
    filename: (req, file, cb) => {
        const uniekeSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniekeSuffix + path.extname(file.originalname));
    }
});

const uploadControleFoto = multer({
    storage: controleFotoStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // Limiet van 10MB per foto
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error("Bestandstype niet toegestaan! Alleen afbeeldingen (jpeg, jpg, png, gif)."));
    }
});

// API Endpoint: Nieuwe controle opslaan
router.post('/controles', uploadControleFoto.array('fotos', 10), async (req, res) => {
    const {
        product_naam,
        order_nummer,
        uitgevoerd_door,
        gecontroleerde_persoon,
        afdeling,
        algemene_opmerkingen,
        status,
        checklist_template_id,
        checklist_items
    } = req.body;

    let parsedChecklistItems;
    try {
        if (checklist_items) {
            parsedChecklistItems = JSON.parse(checklist_items);
            if (!Array.isArray(parsedChecklistItems)) {
                throw new Error("checklist_items moet een array zijn.");
            }
        }
    } catch (error) {
        console.error("Fout bij parsen checklist_items:", error);
        if (req.files) { // Ruim geüploade bestanden op bij parsefout
            for (const file of req.files) {
                try { await fs.unlink(file.path); } catch (e) { console.error("Fout bij opruimen bestand na parse error:", e); }
            }
        }
        return res.status(400).json({ message: "Ongeldig formaat voor checklist_items. Verwacht een JSON array.", error: error.message });
    }

    if (!product_naam || !uitgevoerd_door || !gecontroleerde_persoon) {
        if (req.files) { // Ruim op bij validatiefout
             for (const file of req.files) {
                try { await fs.unlink(file.path); } catch (e) { console.error("Fout bij opruimen bestand na validatie error:", e); }
            }
        }
        return res.status(400).json({ message: "Productnaam, uitvoerder en gecontroleerde persoon zijn verplicht." });
    }

    let transactionStarted = false;
    try {
        await beginTransaction();
        transactionStarted = true;

        const controleResult = await queryDb(
            'INSERT INTO product_controles (product_naam, order_nummer, uitgevoerd_door, gecontroleerde_persoon, afdeling, algemene_opmerkingen, status, checklist_template_id, controle_datum) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
            [product_naam, order_nummer || null, uitgevoerd_door, gecontroleerde_persoon, afdeling || null, algemene_opmerkingen || null, status || 'in behandeling', checklist_template_id || null]
        );
        const controleId = controleResult.insertId;

        if (parsedChecklistItems && parsedChecklistItems.length > 0) {
            for (const item of parsedChecklistItems) {
                if (item.antwoord_waarde === undefined) {
                    throw new Error("Elk checklist item moet een 'antwoord_waarde' bevatten.");
                }
                let beschrijvingVoorOpslag = item.item_beschrijving;
                if (item.template_item_id) {
                    const templateItemRows = await queryDb(
                        'SELECT item_beschrijving FROM checklist_template_items WHERE id = ?',
                        [item.template_item_id]
                    );
                    if (templateItemRows.length > 0) {
                        beschrijvingVoorOpslag = templateItemRows[0].item_beschrijving;
                    } else {
                        console.warn(`Template item ID ${item.template_item_id} niet gevonden voor controle ${controleId}. Fallback naar client beschrijving: '${beschrijvingVoorOpslag}'`);
                        if (!beschrijvingVoorOpslag) {
                             throw new Error(`Beschrijving voor checklist item (template_id: ${item.template_item_id}) kon niet worden bepaald.`);
                        }
                    }
                } else if (!beschrijvingVoorOpslag) {
                    throw new Error("Voor ad-hoc checklist items (zonder template_item_id) is 'item_beschrijving' verplicht.");
                }
                await queryDb(
                    'INSERT INTO controle_checklist_items (controle_id, template_item_id, item_beschrijving, antwoord_waarde, opmerking_bij_antwoord) VALUES (?, ?, ?, ?, ?)',
                    [controleId, item.template_item_id || null, beschrijvingVoorOpslag, item.antwoord_waarde, item.opmerking_bij_antwoord || null]
                );
            }
        }

        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                await queryDb(
                    'INSERT INTO controle_fotos (controle_id, bestandsnaam, upload_datum) VALUES (?, ?, NOW())',
                    [controleId, file.filename]
                );
            }
        }
        await commit();
        transactionStarted = false;
        res.status(201).json({ message: "Controle succesvol opgeslagen.", controleId: controleId });
    } catch (error) {
        if (transactionStarted) {
            await rollback();
        }
        console.error("Fout bij opslaan controle:", error);
        if (req.files) { // Ruim op bij database error
            for (const file of req.files) {
                try { await fs.unlink(file.path); } catch (e) { console.error("Fout bij opruimen bestand na db error:", e); }
            }
        }
        // next(error); // Stuur door naar globale error handler
        // Of een specifieke response:
        res.status(500).json({ message: "Interne serverfout bij opslaan controle.", error: error.message });
    }
});

// API Endpoint: Haal alle controles op
router.get('/controles', async (req, res) => {
    try {
        const queryText = `
            SELECT
                pc.id, pc.product_naam, pc.order_nummer, pc.controle_datum,
                pc.uitgevoerd_door, pc.gecontroleerde_persoon, pc.afdeling, pc.status,
                ct.naam AS checklist_template_naam,
                (SELECT COUNT(*) FROM controle_checklist_items WHERE controle_id = pc.id) AS aantal_checklist_items,
                (SELECT COUNT(*) FROM controle_fotos WHERE controle_id = pc.id) AS aantal_fotos
            FROM product_controles pc
            LEFT JOIN checklist_templates ct ON pc.checklist_template_id = ct.id
            ORDER BY pc.controle_datum DESC`;
        const rows = await queryDb(queryText);
        res.json(rows);
    } catch (error) {
        console.error("Fout bij ophalen controles:", error);
        // next(error);
        res.status(500).json({ message: "Interne serverfout bij ophalen controles.", error: error.message });
    }
});

// API Endpoint: Haal details van een specifieke controle op
router.get('/controles/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const controleDetailsRows = await queryDb(
            `SELECT pc.*, ct.naam AS checklist_template_naam
             FROM product_controles pc
             LEFT JOIN checklist_templates ct ON pc.checklist_template_id = ct.id
             WHERE pc.id = ?`, [id]
        );
        if (controleDetailsRows.length === 0) {
            return res.status(404).json({ message: "Controle niet gevonden." });
        }
        const controleDetails = controleDetailsRows[0];
        const checklistItems = await queryDb(
            `SELECT cci.id, cci.template_item_id, cci.item_beschrijving,
                    cci.antwoord_waarde, cci.opmerking_bij_antwoord,
                    cti.item_type, cti.hulptekst
             FROM controle_checklist_items cci
             LEFT JOIN checklist_template_items cti ON cci.template_item_id = cti.id
             WHERE cci.controle_id = ?
             ORDER BY COALESCE(cti.volgorde, 99999), cci.id`, [id] // Backticks hier zijn correct voor multiline SQL
        );
        const fotos = await queryDb(
            'SELECT id, bestandsnaam, upload_datum FROM controle_fotos WHERE controle_id = ?', [id]
        );
        const fotosMetUrl = fotos.map(foto => ({
            ...foto,
            url: `/uploads/controle_fotos/${foto.bestandsnaam}` // Corrected: Geen onnodige escapes
        }));
        res.json({ details: controleDetails, checklist: checklistItems, fotos: fotosMetUrl });
    } catch (error) {
        console.error(`Fout bij ophalen controle ${id}:`, error); // Corrected: Geen onnodige escapes
        res.status(500).json({ message: `Interne serverfout bij ophalen controle ${id}.`, error: error.message }); // Corrected: Geen onnodige escapes
    }
});

// API Endpoint: Status van controle bijwerken
router.patch('/controles/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    // Validatie van status waarden
    const validStatuses = ['in behandeling', 'goedgekeurd', 'afgekeurd'];
    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ 
            success: false,
            message: 'Ongeldige status. Toegestaan: ' + validStatuses.join(', ')
        });
    }

    try {
        // Check of controle bestaat
        const existing = await queryDb('SELECT id FROM product_controles WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Controle niet gevonden'
            });
        }

        // Update status
        await queryDb(
            'UPDATE product_controles SET status = ? WHERE id = ?',
            [status, id]
        );

        res.json({
            success: true,
            message: 'Status bijgewerkt',
            controle_id: parseInt(id),
            new_status: status
        });

    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({
            success: false,
            message: 'Server fout bij bijwerken status',
            error: error.message
        });
    }
});

// API Endpoint: Dashboard statistieken
router.get('/dashboard/stats', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        // Controles vandaag
        const controlesToday = await queryDb(
            'SELECT COUNT(*) as count FROM product_controles WHERE DATE(controle_datum) = ?',
            [today]
        );
        
        // Status statistieken (alle tijd)
        const statusStats = await queryDb(`
            SELECT 
                status,
                COUNT(*) as count
            FROM product_controles 
            GROUP BY status
        `);
        
        // Controles deze week
        const controlesThisWeek = await queryDb(
            'SELECT COUNT(*) as count FROM product_controles WHERE DATE(controle_datum) >= ?',
            [weekAgo]
        );
        
        // Meest actieve gebruikers
        const topUsers = await queryDb(`
            SELECT 
                uitgevoerd_door,
                COUNT(*) as controle_count
            FROM product_controles 
            WHERE DATE(controle_datum) >= ?
            GROUP BY uitgevoerd_door 
            ORDER BY controle_count DESC 
            LIMIT 5
        `, [weekAgo]);
        
        // Format response
        const stats = {
            today: controlesToday[0].count,
            thisWeek: controlesThisWeek[0].count,
            statusBreakdown: {},
            topUsers: topUsers
        };
        
        // Convert status array to object
        statusStats.forEach(stat => {
            stats.statusBreakdown[stat.status] = stat.count;
        });
        
        res.json(stats);
    } catch (error) {
        console.error('Error getting dashboard stats:', error);
        res.status(500).json({ message: 'Fout bij ophalen dashboard statistieken', error: error.message });
    }
});

// API Endpoint: Trends data voor grafieken
router.get('/dashboard/trends', async (req, res) => {
    try {
        const { period = '7d' } = req.query;
        
        let dateCondition = '';
        let groupBy = '';
        
        switch(period) {
            case '7d':
                dateCondition = 'WHERE DATE(controle_datum) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
                groupBy = 'DATE(controle_datum)';
                break;
            case '30d':
                dateCondition = 'WHERE DATE(controle_datum) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
                groupBy = 'DATE(controle_datum)';
                break;
            case '3m':
                dateCondition = 'WHERE DATE(controle_datum) >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)';
                groupBy = 'DATE_FORMAT(controle_datum, "%Y-%u")'; // Week number
                break;
            default:
                dateCondition = 'WHERE DATE(controle_datum) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
                groupBy = 'DATE(controle_datum)';
        }
        
        // Controles per dag/week
        const trendsData = await queryDb(`
            SELECT 
                ${groupBy} as period,
                COUNT(*) as total_controles,
                SUM(CASE WHEN status = 'goedgekeurd' THEN 1 ELSE 0 END) as goedgekeurd,
                SUM(CASE WHEN status = 'afgekeurd' THEN 1 ELSE 0 END) as afgekeurd,
                SUM(CASE WHEN status = 'in behandeling' THEN 1 ELSE 0 END) as in_behandeling
            FROM product_controles 
            ${dateCondition}
            GROUP BY ${groupBy}
            ORDER BY period ASC
        `);
        
        res.json(trendsData);
    } catch (error) {
        console.error('Error getting trends data:', error);
        res.status(500).json({ message: 'Fout bij ophalen trends data', error: error.message });
    }
});

// API Endpoint: Export controles naar CSV
router.get('/export/csv', async (req, res) => {
    try {
        const { 
            dateFrom, dateTo, status, uitgevoerdDoor, 
            gecontroleerdePersonn, afdeling, product, ordernummer 
        } = req.query;
        
        let whereConditions = [];
        let whereParams = [];
        
        // Build WHERE clause based on filters
        if (dateFrom) {
            whereConditions.push('DATE(pc.controle_datum) >= ?');
            whereParams.push(dateFrom);
        }
        if (dateTo) {
            whereConditions.push('DATE(pc.controle_datum) <= ?');
            whereParams.push(dateTo);
        }
        if (status) {
            whereConditions.push('pc.status = ?');
            whereParams.push(status);
        }
        if (uitgevoerdDoor) {
            whereConditions.push('pc.uitgevoerd_door LIKE ?');
            whereParams.push(`%${uitgevoerdDoor}%`);
        }
        if (gecontroleerdePersonn) {
            whereConditions.push('pc.gecontroleerde_persoon LIKE ?');
            whereParams.push(`%${gecontroleerdePersonn}%`);
        }
        if (afdeling) {
            whereConditions.push('pc.afdeling = ?');
            whereParams.push(afdeling);
        }
        if (product) {
            whereConditions.push('pc.product_naam LIKE ?');
            whereParams.push(`%${product}%`);
        }
        if (ordernummer) {
            whereConditions.push('pc.order_nummer LIKE ?');
            whereParams.push(`%${ordernummer}%`);
        }
        
        const whereClause = whereConditions.length > 0 
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';
        
        const query = `
            SELECT 
                pc.id,
                pc.product_naam,
                pc.order_nummer,
                pc.controle_datum,
                pc.uitgevoerd_door,
                pc.gecontroleerde_persoon,
                pc.status,
                pc.afdeling,
                pc.algemene_opmerkingen,
                ct.naam as checklist_template_naam,
                (SELECT COUNT(*) FROM checklist_antwoorden WHERE controle_id = pc.id) as aantal_checklist_items,
                (SELECT COUNT(*) FROM controle_fotos WHERE controle_id = pc.id) as aantal_fotos
            FROM product_controles pc
            LEFT JOIN checklist_templates ct ON pc.checklist_template_id = ct.id
            ${whereClause}
            ORDER BY pc.controle_datum DESC
        `;
        
        const controles = await queryDb(query, whereParams);
        
        // Generate CSV content
        const headers = [
            'ID', 'Product Naam', 'Ordernummer', 'Datum', 'Uitgevoerd Door',
            'Gecontroleerde Persoon', 'Status', 'Afdeling', 'Template',
            'Checklist Items', 'Fotos', 'Opmerkingen'
        ];
        
        let csvContent = headers.join(',') + '\n';
        
        controles.forEach(controle => {
            const row = [
                controle.id,
                `"${controle.product_naam}"`,
                `"${controle.order_nummer || ''}"`,
                new Date(controle.controle_datum).toLocaleString('nl-NL'),
                `"${controle.uitgevoerd_door}"`,
                `"${controle.gecontroleerde_persoon || ''}"`,
                `"${controle.status}"`,
                `"${controle.afdeling || ''}"`,
                `"${controle.checklist_template_naam || 'Ad-hoc'}"`,
                controle.aantal_checklist_items || 0,
                controle.aantal_fotos || 0,
                `"${(controle.algemene_opmerkingen || '').replace(/"/g, '""')}"`
            ];
            csvContent += row.join(',') + '\n';
        });
        
        // Set headers for CSV download
        const filename = `controles_export_${new Date().toISOString().split('T')[0]}.csv`;
        res.set({
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-cache'
        });
        
        res.send('\ufeff' + csvContent); // BOM for UTF-8
    } catch (error) {
        console.error('Error exporting CSV:', error);
        res.status(500).json({ message: 'Fout bij exporteren naar CSV', error: error.message });
    }
});

// Health check endpoint voor PWA
router.head('/health-check', (req, res) => {
    res.status(200).end();
});
router.get('/health-check', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Multer error handler
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        console.warn("Multer error:", err);
        return res.status(400).json({ message: `Uploadfout: ${err.message}`, code: err.code }); // Corrected: Geen onnodige escapes
    } else if (err.message.startsWith("Bestandstype niet toegestaan")) {
        console.warn("Filetype error:", err.message);
        return res.status(400).json({ message: err.message });
    }
    next(err);
});

module.exports = router;