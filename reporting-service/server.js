const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');

const app = express();
app.use(cors());
app.use(express.json());

// --- MYSQL VERİTABANI BAĞLANTISI ---
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'diyabet_tez_db'
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
// 3. GEÇMİŞE KAYDET (GÜNCELLENDİ: Artık 'email' değerini de veritabanına yazıyor)
// ==========================================
app.post('/kaydet', (req, res) => {
    // req.body içinden 'email' bilgisini de alıyoruz
    const { email, yemek_ismi, tuketilen_gramaj, alinan_karbonhidrat, olculen_kan_sekeri, onerilen_insulin } = req.body;
    
    // INSERT sorgusuna 'email' sütununu ekledik
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
// 4. GEÇMİŞİ LİSTELE (GÜNCELLENDİ: Artık sadece o kullanıcıya ait verileri çekiyor)
// ==========================================
app.get('/gecmis', (req, res) => {
    // GET isteklerinde veriler req.query içinden gelir
    const { email } = req.query; 
    
    if (!email) {
        return res.status(400).json({ durum: 'hata', mesaj: 'Email parametresi eksik' });
    }

    // WHERE email = ? şartını ekleyerek sadece giriş yapan kullanıcının verilerini filtreledik
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

app.listen(3003, () => console.log('📊 Raporlama Servisi 3003 portunda ayakta.'));