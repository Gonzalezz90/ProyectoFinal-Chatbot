const mysql = require('mysql2');

const db = mysql.createConnection(process.env.MYSQL_PUBLIC_URL);

db.connect(err => {
    if (err) {
        console.log("❌ Error DB:", err);
    } else {
        console.log("✅ MySQL conectado (admin)");
    }
});

module.exports = db;