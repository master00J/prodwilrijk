const nodemailer = require('nodemailer');
const mysql = require('mysql');

// Maak een verbinding met je database
const db = mysql.createConnection({
    host: 'db-fde-02.sparkedhost.us',
    user: 'u118444_muSvnDhPRq',
    password: 'zHJe8oHY2@v1P!C=b+pRGjaD',
    database: 's118444_orders_db'
});

// Instellen van je e-mailtransporter
const transporter = nodemailer.createTransport({
        host: 'mail.prodwilrijk.be',
        port: 465,
        secure: true,
        auth: {
            user: 'jason@prodwilrijk.be',
            pass: 'prodwilrijk147'
        }
});

// Functie om voorraad onder minimum te controleren en een e-mail te versturen
function checkAndSendStockNotifications() {
    const sql = `SELECT kistnummer, quantity, minimum_stock 
                 FROM stock_airtec 
                 WHERE quantity < minimum_stock`;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching stock:', err);
            return;
        }

        if (results.length > 0) {
            // Bouw het e-mailbericht met de kisten onder de minimumvoorraad
            let emailBody = '<h3>De volgende kisten hebben een voorraad onder de minimumwaarde:</h3><ul>';
            results.forEach(item => {
                emailBody += `<li>Kistnummer: ${item.kistnummer} - Huidige voorraad: ${item.quantity} (Minimum: ${item.minimum_stock})</li>`;
            });
            emailBody += '</ul>';

            // Stuur de e-mail
            const mailOptions = {
                from: 'jason@prodwilrijk.be',
                to: 'jasonploegaerts@gmail.com,prodwilrijk@foresco.eu',
                subject: 'Dagelijkse voorraad notificatie',
                html: emailBody
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('Error sending email:', error);
                } else {
                    console.log('Voorraad notificatie e-mail verzonden:', info.response);
                }
            });
        } else {
            console.log('Geen kisten onder de minimumvoorraad.');
        }
    });
}

// Voer de functie uit om de notificaties te controleren en te versturen
checkAndSendStockNotifications();

// Sluit de databaseverbinding na het versturen van de e-mail
db.end();
