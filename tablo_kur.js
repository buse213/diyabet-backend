const mysql = require('mysql');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'diyabet_tez_db'
});

db.connect((err) => {
    if (err) throw err;
    console.log('MySQL bağlantısı başarılı, tablo oluşturuluyor...');

    // Geçmiş kayıtlar tablosunu oluşturan SQL sorgusu (Eğer yoksa oluşturur)
    const query = `
    CREATE TABLE IF NOT EXISTS gecmis_kayitlar (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tarih DATETIME DEFAULT CURRENT_TIMESTAMP,
        yemek_ismi VARCHAR(255),
        tuketilen_gramaj INT,
        alinan_karbonhidrat FLOAT,
        olculen_kan_sekeri INT,
        onerilen_insulin FLOAT
    )`;

    db.query(query, (err, result) => {
        if (err) throw err;
        console.log('Harika! "gecmis_kayitlar" tablosu terminal üzerinden başarıyla oluşturuldu.');
        process.exit();
    });
});