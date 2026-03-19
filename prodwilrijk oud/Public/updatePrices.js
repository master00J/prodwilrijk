const mysql = require('mysql');
const cron = require('node-cron');

const connection = mysql.createConnection({
    host: 'db-fde-02.sparkedhost.us',
    user: 'u118444_muSvnDhPRq',
    password: 'zHJe8oHY2@v1P!C=b+pRGjaD',
    database: 's118444_orders_db'
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err.stack);
        return;
    }
    console.log('Connected to the database.');
});

const updatePricesQuery = `
UPDATE admin_items ai1
JOIN (
    SELECT item_number, MAX(price) as price
    FROM admin_items
    GROUP BY item_number
) ai2 ON ai1.item_number = ai2.item_number
SET ai1.price = ai2.price;
`;

const updatePrices = () => {
    connection.query(updatePricesQuery, (error, results) => {
        if (error) {
            console.error('Error executing query:', error.stack);
            return;
        }
        console.log('Prices updated successfully:', results);
    });
};

// Stel een cron job in om het script elke dag om middernacht uit te voeren
cron.schedule('0 0 * * *', () => {
    console.log('Running the updatePrices task...');
    updatePrices();
});

// Zorg ervoor dat de verbinding open blijft
setInterval(() => {}, 1000);
