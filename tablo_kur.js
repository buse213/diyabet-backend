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
    console.log('MySQL bağlantısı başarılı, eksik tablolar kontrol ediliyor...');

    // 1. Kullanıcılar Tablosu
    const queryKullanicilar = `
    CREATE TABLE IF NOT EXISTS kullanicilar (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ad VARCHAR(255),
        email VARCHAR(255) UNIQUE,
        sifre VARCHAR(255),
        yas INT,
        kilo FLOAT,
        diyabet_yili INT,
        icr FLOAT,
        isf FLOAT
    )`;

    // 2. Yemekler Tablosu
    const queryYemekler = `
    CREATE TABLE IF NOT EXISTS yemekler (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ai_etiketi VARCHAR(255),
        turkce_isim VARCHAR(255),
        porsiyon_tipi VARCHAR(255),
        karbonhidrat_miktari FLOAT
    )`;

    db.query(queryKullanicilar, (err) => {
        if (err) throw err;
        console.log('"kullanicilar" tablosu hazır.');

        db.query(queryYemekler, (err) => {
            if (err) throw err;
            console.log('"yemekler" tablosu hazır.');
            console.log('Tüm yapılandırma tamamlandı!');
            process.exit();
        });
    });
});