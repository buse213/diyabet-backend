const mysql = require('mysql2');
require('dotenv').config();

const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'diyabet_tez_db',
    port: process.env.DB_PORT || 3306
});

db.connect((err) => {
    if (err) throw err;
    console.log('Canlı veritabanına bağlanıldı, eksik sütun ekleniyor...');

    // gecmis_kayitlar tablosuna email sütununu ekleyen SQL komutu
    const query = "ALTER TABLE gecmis_kayitlar ADD COLUMN email VARCHAR(255);";

    db.query(query, (err) => {
        if (err) {
            console.log("Bir uyarı oluştu (Sütun zaten eklenmiş olabilir):", err.message);
        } else {
            console.log("BAŞARILI! 'email' sütunu canlı veritabanına eklendi.");
        }
        process.exit();
    });
});