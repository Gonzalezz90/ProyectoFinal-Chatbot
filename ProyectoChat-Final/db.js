const mysql = require('mysql2');

const db = mysql.createConnection({
    host: process.env.MYSQLHOST || 'localhost',
    user: process.env.MYSQLUSER || 'sicos_user',
    password: process.env.MYSQLPASSWORD || '1234',
    database: process.env.MYSQLDATABASE || 'sicos_chat',
    port: process.env.MYSQLPORT || 3306
});

db.connect(err => {
    if (err) {
        console.log("❌ Error DB:", err);
    } else {
        console.log("✅ MySQL conectado");
    }
});

module.exports = db;