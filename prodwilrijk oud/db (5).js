const mysql = require('mysql');

const connection = mysql.createConnection({
    host: 'db-fde-02.sparkedhost.us',
    user: 'u118444_muSvnDhPRq',
    password: 'zHJe8oHY2@v1P!C=b+pRGjaD',
    database: 's118444_orders_db',
    timezone: 'UTC'
    
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err.stack);
        return;
    }
    console.log('Connected to the database.');
});

module.exports = connection;
