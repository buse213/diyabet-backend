const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const path = require('path');
const nodemailer = require('nodemailer'); 
const crypto = require('crypto');         

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
// 6. SIK TÜKETİLENLERİ GETİR
// ==========================================
app.get('/sik-tuketilenler', (req, res) => {
    const { email } = req.query; 

    if (!email) {
        return res.status(400).json({ durum: 'hata', mesaj: 'Email parametresi eksik' });
    }

    const sql = `
        SELECT 
            yemek_ismi AS turkce_isim, 
            COUNT(*) AS tuketim_sayisi,
            ROUND(AVG((alinan_karbonhidrat / tuketilen_gramaj) * 100)) AS karbonhidrat_miktari
        FROM gecmis_kayitlar 
        WHERE email = ? AND yemek_ismi != 'Hızlı Düzeltme / Kontrol' AND tuketilen_gramaj > 0
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
// 7. YAPAY ZEKA İNSÜLİN VE GLİKOZ TAHMİNİ
// ==========================================
app.post('/insulin-tahmini', (req, res) => {
    const { email, anlik_seker, guncel_karbonhidrat } = req.body;

    if (!email || anlik_seker == null || guncel_karbonhidrat == null) {
        return res.status(400).json({ durum: 'hata', mesaj: 'Eksik veri gönderildi.' });
    }

    const query = `
        SELECT alinan_karbonhidrat, olculen_kan_sekeri, onerilen_insulin 
        FROM gecmis_kayitlar 
        WHERE email = ? 
        ORDER BY tarih DESC 
        LIMIT 5
    `;

    db.query(query, [email], async (err, results) => {
        if (err) {
            console.error("Veritabanı hatası:", err);
            return res.status(500).json({ durum: 'hata', mesaj: 'Geçmiş veriler alınamadı.' });
        }

        const gecmisVeriler = results.reverse(); 
        const pythonVerisi = {
            gecmis_veriler: gecmisVeriler,
            anlik_seker: parseFloat(anlik_seker),
            guncel_karbonhidrat: parseFloat(guncel_karbonhidrat)
        };

        try {
            const pythonApiLink = 'https://lstm-api-service.onrender.com/predict';
            
            const aiResponse = await fetch(pythonApiLink, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pythonVerisi)
            });

            const responseText = await aiResponse.text();

            if (responseText.includes("<!DOCTYPE") || responseText.includes("<html")) {
                return res.status(503).json({ 
                    durum: 'hata', 
                    mesaj: 'Yapay zeka motoru uyku modundan uyanıyor. Lütfen 30-40 saniye bekleyip tekrar deneyin.' 
                });
            }

            const pythonSonuc = JSON.parse(responseText);

            if (pythonSonuc.error) {
                return res.status(500).json({ durum: 'hata', mesaj: pythonSonuc.error });
            }

            return res.json({
                durum: 'basarili',
                kaynak: 'LSTM Yapay Zeka Modeli',
                analiz_sonucu: pythonSonuc
            });

        } catch (error) {
            console.error("Python API İstek Hatası:", error);
            return res.status(500).json({ durum: 'hata', mesaj: 'Yapay zeka servisine ulaşılamadı.' });
        }
    });
});

// ==========================================
// 8. ŞİFRE SIFIRLAMA İŞLEMLERİ (GÜVENLİ HALE GETİRİLDİ)
// ==========================================

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Ortam değişkeninden güvenli şekilde çekilir
        pass: process.env.EMAIL_PASS  // Ortam değişkeninden güvenli şekilde çekilir
    }
});

app.post('/sifremi-unuttum', (req, res) => {
    const { email } = req.body;

    const checkQuery = `SELECT * FROM kullanicilar WHERE email = ?`;
    db.query(checkQuery, [email], (err, results) => {
        if (err) return res.status(500).json({ durum: 'hata', mesaj: 'Veritabanı hatası' });
        if (results.length === 0) return res.status(404).json({ durum: 'hata', mesaj: 'Bu e-posta sisteme kayıtlı değil.' });

        const resetToken = crypto.randomBytes(32).toString('hex');
        const expireDate = new Date(Date.now() + 3600000); // 1 saat geçerli

        const updateQuery = `UPDATE kullanicilar SET reset_token = ?, reset_token_expires = ? WHERE email = ?`;
        db.query(updateQuery, [resetToken, expireDate, email], (updateErr) => {
            if (updateErr) return res.status(500).json({ durum: 'hata', mesaj: 'Token kaydedilemedi' });

            const resetLink = `https://api-gateway-gq75.onrender.com/sifre-sifirla?token=${resetToken}`;

            const mailOptions = {
                from: `"Akıllı Diyabet Asistanı" <${process.env.EMAIL_USER}>`, // Ortam değişkeninden güvenli şekilde çekilir
                to: email,
                subject: 'Şifre Sıfırlama Talebi',
                html: `
                    <h3>Şifre Sıfırlama Talebi</h3>
                    <p>Yeni şifre belirlemek için aşağıdaki bağlantıya tıklayın. Bu bağlantı 1 saat boyunca geçerlidir.</p>
                    <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #8E24AA; color: white; text-decoration: none; border-radius: 5px;">Şifremi Sıfırla</a>
                `
            };

            transporter.sendMail(mailOptions, (mailErr) => {
                if (mailErr) {
                    console.error("Mail hatası:", mailErr);
                    return res.status(500).json({ durum: 'hata', mesaj: 'Mail gönderilemedi. Sunucu ayarlarınızı kontrol edin.' });
                }
                res.json({ durum: 'basarili', mesaj: 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.' });
            });
        });
    });
});

app.get('/sifre-sifirla', (req, res) => {
    const { token } = req.query;

    if (!token) return res.send('Geçersiz bağlantı.');

    const query = `SELECT * FROM kullanicilar WHERE reset_token = ? AND reset_token_expires > NOW()`;
    db.query(query, [token], (err, results) => {
        if (err || results.length === 0) {
            return res.send('<h2>Bağlantı geçersiz veya süresi dolmuş. Lütfen uygulamadan tekrar talep oluşturun.</h2>');
        }

        const htmlForm = `
            <html>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <body style="font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f4f0f9; margin: 0;">
                    <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); text-align: center; width: 90%; max-width: 400px;">
                        <h2 style="color: #8E24AA;">Yeni Şifre Belirleme</h2>
                        <form action="/sifre-guncelle" method="POST">
                            <input type="hidden" name="token" value="${token}" />
                            <input type="password" name="yeniSifre" placeholder="Yeni Şifreniz" required style="width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ccc; border-radius: 5px; box-sizing: border-box;" />
                            <button type="submit" style="background-color: #8E24AA; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; width: 100%; font-size: 16px;">Şifreyi Kaydet</button>
                        </form>
                    </div>
                </body>
            </html>
        `;
        res.send(htmlForm);
    });
});

app.post('/sifre-guncelle', express.urlencoded({ extended: true }), (req, res) => {
    const { token, yeniSifre } = req.body;

    const query = `UPDATE kullanicilar SET sifre = ?, reset_token = NULL, reset_token_expires = NULL WHERE reset_token = ? AND reset_token_expires > NOW()`;
    
    db.query(query, [yeniSifre, token], (err, result) => {
        if (err || result.affectedRows === 0) {
            return res.send('<h2 style="color: red; text-align: center; margin-top: 50px;">İşlem başarısız. Bağlantı süresi dolmuş olabilir.</h2>');
        }
        res.send('<h2 style="color: green; text-align: center; margin-top: 50px;">Şifreniz başarıyla değiştirildi! Artık mobil uygulamadan yeni şifrenizle giriş yapabilirsiniz.</h2>');
    });
});


// RENDER İÇİN DİNAMİK PORT VE 0.0.0.0 HOST AYARI
const PORT = process.env.PORT || 3003;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`📊 Raporlama Servisi ${PORT} portunda ve 0.0.0.0 hostunda ayakta.`);
});