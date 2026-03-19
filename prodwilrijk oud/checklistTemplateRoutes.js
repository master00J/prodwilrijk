// checklistTemplateRoutes.js
const express = require('express');
const router = express.Router();
// 'db' is hier het 'connection' object dat je db.js exporteert
const db = require('./db'); // Zorg dat dit pad correct is naar je db.js

/**
 * Helper functie om de callback-gebaseerde db.query om te zetten naar een Promise,
 * zodat we async/await kunnen gebruiken.
 */
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

/**
 * Helper functies voor transacties met de callback-gebaseerde db connectie.
 */
function beginTransaction() {
    return new Promise((resolve, reject) => {
        db.beginTransaction((err) => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
}

function commit() {
    return new Promise((resolve, reject) => {
        db.commit((err) => {
            if (err) {
                return reject(err);
            }
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

// GET alle checklist templates (actief en optioneel gefilterd op afdeling)
router.get('/templates', async (req, res) => { // Verwijder 'next' als niet gebruikt voor error handling
    const { afdeling, include_item_count } = req.query;
    let queryParams = [];
    let queryText = `
        SELECT 
            ct.id, ct.naam, ct.afdeling, ct.beschrijving, ct.is_actief, ct.aangemaakt_op, ct.laatst_gewijzigd_op
            ${include_item_count === 'true' ? ', COUNT(DISTINCT cti.id) AS items_count' : ''}
        FROM checklist_templates ct
    `;
    if (include_item_count === 'true') {
        queryText += ` LEFT JOIN checklist_template_items cti ON ct.id = cti.template_id `;
    }

    let conditions = [];
    if (afdeling) {
        conditions.push('(ct.afdeling = ? OR ct.afdeling IS NULL)');
        queryParams.push(afdeling);
    }
    if (!afdeling) {
         conditions.push('ct.is_actief = 1');
    }

    if (conditions.length > 0) {
        queryText += ' WHERE ' + conditions.join(' AND ');
    }

    if (include_item_count === 'true') {
        queryText += ' GROUP BY ct.id, ct.naam, ct.afdeling, ct.beschrijving, ct.is_actief, ct.aangemaakt_op, ct.laatst_gewijzigd_op';
    }
    queryText += ' ORDER BY ct.naam';

    try {
        // Gebruik de queryDb helper
        const templates = await queryDb(queryText, queryParams);
        res.json(templates);
    } catch (error) {
        console.error("Fout bij ophalen checklist templates:", error);
        res.status(500).json({ message: "Kon checklist templates niet ophalen.", error: error.message });
    }
    // Geen connection.release() nodig
});

// GET een specifieke checklist template met zijn items
router.get('/templates/:templateId', async (req, res) => {
    const paramTemplateId = parseInt(req.params.templateId, 10);
    if (isNaN(paramTemplateId)) {
        return res.status(400).json({ message: "Ongeldige template ID." });
    }
    try {
        const templateRows = await queryDb('SELECT * FROM checklist_templates WHERE id = ?', [paramTemplateId]);
        if (templateRows.length === 0) {
            return res.status(404).json({ message: "Checklist template niet gevonden." });
        }
        const template = templateRows[0];
        const items = await queryDb(
            'SELECT id, item_beschrijving, item_type, volgorde, is_verplicht, hulptekst FROM checklist_template_items WHERE template_id = ? ORDER BY volgorde, id',
            [paramTemplateId]
        );
        template.items = items;
        res.json(template);
    } catch (error) {
        console.error(`Fout bij ophalen template ${paramTemplateId}:`, error);
        res.status(500).json({ message: "Kon checklist template details niet ophalen.", error: error.message });
    }
    // Geen connection.release() nodig
});

// POST een nieuwe checklist template
router.post('/templates', async (req, res) => {
    console.log('[POST /templates HANDLER] req.body:', req.body);
        console.log('[POST /templates HANDLER] req.headers[content-type]:', req.headers['content-type']);
    const { naam, afdeling, beschrijving, is_actief = true, items = [] } = req.body; // Default items naar lege array

    if (!naam || !naam.trim()) {
        return res.status(400).json({ message: "Naam van de template is verplicht." });
    }
    // Afdeling is optioneel, maar als meegegeven, trim het.
    const afdelingTrimmed = afdeling ? afdeling.trim() : null;
    const beschrijvingTrimmed = beschrijving ? beschrijving.trim() : null;

    // Valideer 'items' als het aanwezig is en niet leeg
    if (!Array.isArray(items)) {
        // Dit zou niet mogen gebeuren als we defaulten naar [], maar voor de zekerheid
        return res.status(400).json({ message: "Items moet een array zijn." });
    }
    if (items.length > 0) {
        for (const item of items) {
            if (!item.item_beschrijving || !item.item_beschrijving.trim()) {
                return res.status(400).json({ message: "Elk template item in de array moet een 'item_beschrijving' bevatten." });
            }
        }
    }

    let transactionStarted = false;
    try {
        console.log(`[POST /templates] Start transactie voor template: ${naam}`);
        await beginTransaction();
        transactionStarted = true;
        console.log(`[POST /templates] Transactie gestart.`);

        const templateResult = await queryDb(
            'INSERT INTO checklist_templates (naam, afdeling, beschrijving, is_actief, aangemaakt_op, laatst_gewijzigd_op) VALUES (?, ?, ?, ?, NOW(), NOW())',
            [naam.trim(), afdelingTrimmed, beschrijvingTrimmed, is_actief]
        );
        const newTemplateId = parseInt(templateResult.insertId, 10);
        console.log(`[POST /templates] Template record aangemaakt met ID: ${newTemplateId}`);

        if (items.length > 0) {
            console.log(`[POST /templates] Bezig met verwerken van ${items.length} items voor template ID: ${newTemplateId}`);
            for (const [index, item] of items.entries()) {
                console.log(`[POST /templates] Item ${index + 1}:`, item);
                await queryDb(
                    'INSERT INTO checklist_template_items (template_id, item_beschrijving, item_type, volgorde, is_verplicht, hulptekst) VALUES (?, ?, ?, ?, ?, ?)',
                    [
                        newTemplateId,
                        item.item_beschrijving.trim(), // Validatie hierboven checkte al of dit bestaat
                        item.item_type || 'ok_nok_nvt',
                        item.volgorde !== undefined ? item.volgorde : index, // Gebruik index als volgorde als niet gespecificeerd
                        item.is_verplicht !== undefined ? item.is_verplicht : false,
                        item.hulptekst ? item.hulptekst.trim() : null
                    ]
                );
            }
            console.log(`[POST /templates] Alle items verwerkt voor template ID: ${newTemplateId}`);
        } else {
            console.log(`[POST /templates] Geen items om te verwerken voor template ID: ${newTemplateId}`);
        }

        await commit();
        transactionStarted = false;
        console.log(`[POST /templates] Transactie succesvol gecommit voor template ID: ${newTemplateId}`);
        res.status(201).json({ message: "Checklist template succesvol aangemaakt.", templateId: newTemplateId });

    } catch (error) {
        console.error("[POST /templates] Fout bij aanmaken checklist template:", error);
        if (transactionStarted) {
            console.log("[POST /templates] Bezig met rollback van transactie...");
            try {
                await rollback();
                console.log("[POST /templates] Transactie succesvol gerollbackt.");
            } catch (rollErr) {
                console.error("[POST /templates] Fout TIJDENS rollback van transactie:", rollErr);
            }
        }
        res.status(500).json({ message: "Kon checklist template niet aanmaken. Server error.", errorDetails: error.message });
    }
    // Geen connection.release() nodig
});

// PUT een bestaande checklist template bijwerken
router.put('/templates/:templateId', async (req, res) => {
    const paramTemplateId = parseInt(req.params.templateId, 10);
    if (isNaN(paramTemplateId)) { 
        return res.status(400).json({ message: "Ongeldige template ID." });
    }

    const { naam, afdeling, beschrijving, is_actief, items } = req.body;

    if (!naam || !naam.trim()) {
        return res.status(400).json({ message: "Naam van de template is verplicht." });
    }
    if (!Array.isArray(items)) {
        return res.status(400).json({ message: "Items moeten een array zijn." });
    }

    let transactionStarted = false;
    try {
        await beginTransaction();
        transactionStarted = true;

        const updateResult = await queryDb(
            'UPDATE checklist_templates SET naam = ?, afdeling = ?, beschrijving = ?, is_actief = ?, laatst_gewijzigd_op = NOW() WHERE id = ?',
            [
                naam.trim(),
                afdeling ? afdeling.trim() : null,
                beschrijving ? beschrijving.trim() : null,
                is_actief !== undefined ? is_actief : true,
                paramTemplateId
            ]
        );

        if (updateResult.affectedRows === 0) {
            await rollback();
            transactionStarted = false; 
            return res.status(404).json({ message: "Template niet gevonden om bij te werken." });
        }

        await queryDb('DELETE FROM checklist_template_items WHERE template_id = ?', [paramTemplateId]);

        if (items && items.length > 0) {
            for (const [index, item] of items.entries()) { 
                if (!item.item_beschrijving || !item.item_beschrijving.trim()) {
                    throw new Error("Elk template item moet een 'item_beschrijving' bevatten.");
                }
                await queryDb(
                    'INSERT INTO checklist_template_items (template_id, item_beschrijving, item_type, volgorde, is_verplicht, hulptekst) VALUES (?, ?, ?, ?, ?, ?)',
                    [
                        paramTemplateId,
                        item.item_beschrijving.trim(),
                        item.item_type || 'ok_nok_nvt',
                        item.volgorde !== undefined ? item.volgorde : index,
                        item.is_verplicht !== undefined ? item.is_verplicht : false,
                        item.hulptekst ? item.hulptekst.trim() : null
                    ]
                );
            }
        }
        await commit();
        transactionStarted = false;
        res.json({ message: "Checklist template succesvol bijgewerkt.", templateId: paramTemplateId });
    } catch (error) {
        if (transactionStarted) {
            await rollback();
        }
        console.error(`Fout bij bijwerken template ${paramTemplateId}:`, error);
        res.status(500).json({ message: "Kon checklist template niet bijwerken.", error: error.message });
    }
    // Geen connection.release() nodig
});

// DELETE een checklist template (wordt feitelijk een deactivatie via PUT)
// De onderstaande hard delete is uit-gecommentarieerd zoals in het origineel.
/*
router.delete('/templates/:templateId', async (req, res) => {
    const { templateId } = req.params;
    try {
        // Voor hard delete met transactie:
        // await beginTransaction();
        // await queryDb('DELETE FROM checklist_template_items WHERE template_id = ?', [templateId]);
        // const result = await queryDb('DELETE FROM checklist_templates WHERE id = ?', [templateId]);
        // if (result.affectedRows === 0) {
        //     await rollback();
        //     return res.status(404).json({ message: "Template niet gevonden om te verwijderen." });
        // }
        // await commit();
        // res.json({ message: "Checklist template succesvol verwijderd." });
        
        // Voor nu, placeholder als het nog steeds een deactivatie route moet zijn:
        res.status(405).json({ message: "Gebruik PUT om een template te deactiveren."})
    } catch (error) {
        // if (transactionStarted_in_delete) await rollback(); // Indien transacties hier worden gebruikt
        console.error(`Fout bij verwijderen template ${templateId}:`, error);
        res.status(500).json({ message: "Kon template niet verwijderen", error: error.message });
    }
});
*/

// DELETE een template
router.delete('/templates/:templateId', async (req, res) => {
    const paramTemplateId = parseInt(req.params.templateId, 10);
    if (isNaN(paramTemplateId)) {
        return res.status(400).json({ message: "Ongeldige template ID." });
    }

    let transactionStarted = false;
    try {
        await beginTransaction();
        transactionStarted = true;

        // Eerst de gerelateerde items verwijderen
        await queryDb('DELETE FROM checklist_template_items WHERE template_id = ?', [paramTemplateId]);
        
        // Dan de template zelf verwijderen
        const result = await queryDb('DELETE FROM checklist_templates WHERE id = ?', [paramTemplateId]);

        if (result.affectedRows === 0) {
            // Als de template niet bestond, is het technisch gezien geen error,
            // maar de items zijn mogelijk wel verwijderd als ze een ongeldige foreign key hadden.
            // We kunnen een 404 sturen of een succes met een notitie.
            // Om consistent te zijn met PUT, rollback als template niet gevonden is.
            await rollback(); // Hoewel er misschien niets te rollbacken is als de items query al succesvol was.
            transactionStarted = false;
            return res.status(404).json({ message: 'Template niet gevonden om te verwijderen.' });
        }

        await commit();
        transactionStarted = false;
        res.json({ message: 'Checklist template en bijbehorende items succesvol verwijderd.' });
    } catch (error) {
        console.error(`Fout bij verwijderen template ${paramTemplateId}:`, error);
        if (transactionStarted) {
            await rollback();
        }
        res.status(500).json({ message: 'Kon checklist template niet verwijderen.', error: error.message });
    }
});

module.exports = router;