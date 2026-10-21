const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');

const app = express();
app.use(cors());
app.use(express.json());

// --- MYSQL VERİTABANI BAĞLANTISI ---
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'diyabet_tez_db',
    port: process.env.DB_PORT || 3306
});

db.connect((err) => {
    if (err) console.error('MySQL bağlantı hatası:', err);
    else console.log('MySQL veritabanına başarıyla bağlanıldı!');
});

// ==========================================
// 1. KULLANICI KAYIT İŞLEMİ
// ==========================================
app.post('/kayit', (req, res) => {
    const { ad, email, sifre } = req.body;

    const checkQuery = `SELECT * FROM kullanicilar WHERE email = ?`;
    db.query(checkQuery, [email], (err, results) => {
        if (err) return res.status(500).json({ durum: 'hata', mesaj: 'Veritabanı hatası' });
        
        if (results.length > 0) {
            return res.status(400).json({ durum: 'hata', mesaj: 'Bu e-posta zaten kayıtlı!' });
        }

        const insertQuery = `INSERT INTO kullanicilar (ad, email, sifre) VALUES (?, ?, ?)`;
        db.query(insertQuery, [ad, email, sifre], (err, result) => {
            if (err) return res.status(500).json({ durum: 'hata', mesaj: 'Kayıt yapılamadı' });
            res.json({ durum: 'basarili', mesaj: 'Kayıt başarıyla oluşturuldu' });
        });
    });
});

// ==========================================
// 2. KULLANICI GİRİŞ İŞLEMİ
// ==========================================
app.post('/giris', (req, res) => {
    const { email, sifre } = req.body;

    const query = `SELECT * FROM kullanicilar WHERE email = ? AND sifre = ?`;
    db.query(query, [email, sifre], (err, results) => {
        if (err) return res.status(500).json({ durum: 'hata', mesaj: 'Veritabanı hatası' });

        if (results.length > 0) {
            res.json({ durum: 'basarili', mesaj: 'Giriş başarılı', kullanici: results[0] });
        } else {
            res.status(401).json({ durum: 'hata', mesaj: 'E-posta veya şifre hatalı' });
        }
    });
});

// ==========================================
// 3. GEÇMİŞE KAYDET
// ==========================================
app.post('/kaydet', (req, res) => {
    const { email, yemek_ismi, tuketilen_gramaj, alinan_karbonhidrat, olculen_kan_sekeri, onerilen_insulin } = req.body;
    
    const query = `INSERT INTO gecmis_kayitlar (email, yemek_ismi, tuketilen_gramaj, alinan_karbonhidrat, olculen_kan_sekeri, onerilen_insulin) VALUES (?, ?, ?, ?, ?, ?)`;
    
    db.query(query, [email, yemek_ismi, tuketilen_gramaj, alinan_karbonhidrat, olculen_kan_sekeri, onerilen_insulin], (err, results) => {
        if (err) {
            console.error("Veritabanı kayıt hatası:", err);
            return res.status(500).json({ durum: 'hata', mesaj: 'Kaydedilemedi' });
        }
        console.log(`Geçmişe eklendi: ${yemek_ismi} (Kullanıcı: ${email}) - İnsülin: ${onerilen_insulin} Ünite`);
        res.json({ durum: 'basarili', mesaj: 'Veri geçmişe başarıyla kaydedildi!' });
    });
});

// ==========================================
// 4. GEÇMİŞİ LİSTELE
// ==========================================
app.get('/gecmis', (req, res) => {
    const { email } = req.query; 
    
    if (!email) {
        return res.status(400).json({ durum: 'hata', mesaj: 'Email parametresi eksik' });
    }

    const query = 'SELECT * FROM gecmis_kayitlar WHERE email = ? ORDER BY tarih DESC';
    
    db.query(query, [email], (err, results) => {
        if (err) {
            console.error("Geçmiş çekilirken hata:", err);
            return res.status(500).json({ durum: 'hata', mesaj: 'Veriler getirilemedi' });
        }
        res.json({ durum: 'basarili', veriler: results });
    });
});

// ==========================================
// 5. PROFİL GÜNCELLEME İŞLEMİ
// ==========================================
app.post('/profil-guncelle', (req, res) => {
    const { email, ad, yas, kilo, diyabet_yili, icr, isf } = req.body;

    const query = `UPDATE kullanicilar SET ad=?, yas=?, kilo=?, diyabet_yili=?, icr=?, isf=? WHERE email=?`;
    
    db.query(query, [ad, yas, kilo, diyabet_yili, icr, isf, email], (err, results) => {
        if (err) {
            console.error("Profil güncelleme hatası:", err);
            return res.status(500).json({ durum: 'hata', mesaj: 'Veritabanı güncellenemedi' });
        }
        res.json({ durum: 'basarili', mesaj: 'Profil veritabanına başarıyla kaydedildi!' });
    });
});

// ==========================================
// 6. SIK TÜKETİLENLERİ GETİR (Kişiye Özel ve Sadece Yemekler)
// ==========================================
app.get('/sik-tuketilenler', (req, res) => {
    const { email } = req.query; 

    if (!email) {
        return res.status(400).json({ durum: 'hata', mesaj: 'Email parametresi eksik' });
    }

    const sql = `
        SELECT 
            yemek_ismi AS turkce_isim, 
            COUNT(*) AS tuketim_sayisi 
        FROM gecmis_kayitlar 
        WHERE email = ? AND yemek_ismi != 'Hızlı Düzeltme / Kontrol'
        GROUP BY yemek_ismi
        ORDER BY tuketim_sayisi DESC 
        LIMIT 5
    `;
    
    db.query(sql, [email], (err, results) => {
        if (err) {
            console.error("Sık tüketilenleri çekerken hata:", err);
            return res.status(500).json({ error: "Veritabanı hatası" });
        }
        res.json(results);
    });
});

// ==========================================
// 7. YAPAY ZEKA İNSÜLİN VE GLİKOZ TAHMİNİ (LSTM İÇİN VERİ HAZIRLIĞI)
// ==========================================
app.post('/insulin-tahmini', (req, res) => {
    const { email, anlik_seker, guncel_karbonhidrat } = req.body;

    if (!email || anlik_seker == null || guncel_karbonhidrat == null) {
        return res.status(400).json({ durum: 'hata', mesaj: 'Eksik veri gönderildi. Lütfen email, anlik_seker ve guncel_karbonhidrat alanlarını doldurun.' });
    }

    // Hastanın son 5 öğünlük geçmişini çekiyoruz ki LSTM modeline trendi verebilelim
    const query = `
        SELECT alinan_karbonhidrat, olculen_kan_sekeri, onerilen_insulin 
        FROM gecmis_kayitlar 
        WHERE email = ? 
        ORDER BY tarih DESC 
        LIMIT 5
    `;

    db.query(query, [email], (err, results) => {
        if (err) {
            console.error("Veritabanı hatası (LSTM için geçmiş çekilirken):", err);
            return res.status(500).json({ durum: 'hata', mesaj: 'Geçmiş veriler alınamadı.' });
        }

        // Zaman serisi doğru aksın diye veriyi eskiden yeniye doğru sıralıyoruz
        const gecmisVeriler = results.reverse(); 

        console.log("1. Aşama: LSTM için kullanıcının geçmiş verileri başarıyla çekildi.");

        // TODO: 2. Adımda buraya Python (predict_lstm.py) scriptini çağıran "exec" kodlarını ekleyeceğiz.
        
        // Şimdilik test edebilmen için sahte (mock) bir yanıt dönüyoruz:
        return res.json({
            durum: 'basarili',
            mesaj: 'Veritabanı aşaması tamam, veri Python için hazır!',
            analiz_sonucu: {
                gelecekteki_seker: 185,        // İkinci adımda burası Python'dan dinamik gelecek
                onerilen_insulin: 4.5          // İkinci adımda burası Python'dan dinamik gelecek
            }
        });
    });
});

// RENDER İÇİN DİNAMİK PORT VE 0.0.0.0 HOST AYARI
const PORT = process.env.PORT || 3003;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`📊 Raporlama Servisi ${PORT} portunda ve 0.0.0.0 hostunda ayakta.`);
});