const mysql = require('mysql');

// Kendi veritabanı ayarlarına göre kontrol et (Şifre varsa ekle)
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'diyabet_tez_db',
    port: process.env.DB_PORT || 3306
});
db.connect((err) => {
    if (err) throw err;
    console.log('MySQL veritabanına bağlanıldı, güncellemeler başlıyor...');

    // PyTorch modelindeki 15 sınıf[cite: 8] ve 100 gramlarındaki ortalama karbonhidrat değerleri
    const yemekler = [
        { ai: 'caesar_salad', tr: 'Sezar Salata', carb: 4 },
        { ai: 'chicken_curry', tr: 'Köri Soslu Tavuk', carb: 6 },
        { ai: 'chicken_wings', tr: 'Tavuk Kanat', carb: 5 },
        { ai: 'french_fries', tr: 'Patates Kızartması', carb: 41 },
        { ai: 'fried_rice', tr: 'Kızarmış Pirinç', carb: 28 },
        { ai: 'hamburger', tr: 'Hamburger', carb: 24 },
        { ai: 'hot_dog', tr: 'Sosisli Sandviç', carb: 18 },
        { ai: 'ice_cream', tr: 'Dondurma', carb: 24 },
        { ai: 'macaroni_and_cheese', tr: 'Mac and Cheese', carb: 23 },
        { ai: 'omelette', tr: 'Omlet', carb: 1 },
        { ai: 'pancakes', tr: 'Pancake', carb: 28 },
        { ai: 'pizza', tr: 'Pizza', carb: 33 },
        { ai: 'spaghetti_bolognese', tr: 'Spagetti Bolonez', carb: 14 },
        { ai: 'steak', tr: 'Biftek', carb: 0 },
        { ai: 'waffles', tr: 'Waffle', carb: 33 }
    ];

    // Eski çakışmaları önlemek için tabloyu temizliyoruz
    db.query('TRUNCATE TABLE yemekler', (err) => {
        if (err) throw err;
        console.log('Eski veriler temizlendi, yenileri ekleniyor...');

        let eklenen = 0;
        yemekler.forEach((y) => {
            const query = `INSERT INTO yemekler (ai_etiketi, turkce_isim, porsiyon_tipi, karbonhidrat_miktari) VALUES (?, ?, '100g İçin Temel Değer', ?)`;
            db.query(query, [y.ai, y.tr, y.carb], (err) => {
                if (err) throw err;
                eklenen++;
                if (eklenen === yemekler.length) {
                    console.log('Harika! 15 yemeğin tümü 100 gramlık güncel değerleriyle veritabanına eklendi.');
                    process.exit();
                }
            });
        });
    });
});