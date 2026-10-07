const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai'); // YENİ: Gemini Paketi

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Gelen fotoğrafı bellekte tutmak için multer ayarı (Çok hızlıdır!)
const upload = multer({ storage: multer.memoryStorage() });

// --- GEMINI API KURULUMU ---
// DİKKAT: Aşağıdaki tırnak içine az önce aldığın API Anahtarını yapıştır!
const genAI = new GoogleGenerativeAI('process.env.GEMINI_API_KEY');

// --- MYSQL VERİTABANI BAĞLANTISI (Senin kodun, aynen korundu) ---
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

// --- YENİ YÜKSELTİLMİŞ ORKESTRASYON UÇ NOKTASI (Gemini Vision + Veritabanı Uyumlu) ---
app.post('/analiz', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ hata: 'Lütfen bir fotoğraf gönderin.' });
    }

    try {
        console.log("Fotoğraf Gemini Yapay Zekasına gönderiliyor...");

        // 1. Adım: Modeli çağır
    const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" });

        // 2. Adım: RAM'deki (buffer) fotoğrafı Gemini'nin okuyacağı Base64 formatına çevir
        const imageBase64 = req.file.buffer.toString("base64");
        
        const resimVerisi = {
            inlineData: {
                data: imageBase64,
                mimeType: req.file.mimetype
            }
        };

        // 3. Adım: Sistemi zorlayan kesin kurallı Prompt (Mühendislik Harikası)
        const prompt = `Sen uzman bir diyetisyen ve diyabet asistanısın. Bu fotoğraftaki yemeği analiz et. 
        Sadece yemeğin Türkçe adını ve 100 gramındaki ortalama karbonhidrat miktarını tahmin et. 
        Asla ekstra bir metin, selamlama veya açıklama yazma. 
        SADECE VE SADECE geçerli bir JSON objesi döndür. 
        Format tam olarak şöyle olmalı: {"turkce_isim": "Yemek Adı", "karbonhidrat_miktari": 25.5}`;

        // 4. Adım: Gemini'dan yanıtı al
        const result = await model.generateContent([prompt, resimVerisi]);
        const responseText = result.response.text();

        console.log("Gemini'den gelen ham yanıt:", responseText);

        // 5. Adım: Gelen JSON'ı temizle ve objeye çevir
        const temizJsonMetni = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const sonucObjesi = JSON.parse(temizJsonMetni);

        // Uygulamaya doğrudan sonucu gönderiyoruz (Artık MySQL yemekler tablosuna sormamıza gerek kalmadı, Gemini direk Karbonhidratı biliyor!)
        res.json({
            durum: 'basarili',
            sonuc: sonucObjesi
        });

    } catch (error) {
        console.error("Yapay Zeka Hatası:", error);
        res.status(500).json({ 
            hata: 'Yapay Zeka servisi ile iletişim kurulamadı.', 
            detay: error.message 
        });
    }
});

// --- GEÇMİŞE KAYIT VE LİSTELEME API'LERİ (Senin yazdığın kodlar, aynen korundu) ---
app.post('/kaydet', (req, res) => {
    const { yemek_ismi, tuketilen_gramaj, alinan_karbonhidrat, olculen_kan_sekeri, onerilen_insulin } = req.body;
    
    const query = `INSERT INTO gecmis_kayitlar (yemek_ismi, tuketilen_gramaj, alinan_karbonhidrat, olculen_kan_sekeri, onerilen_insulin) VALUES (?, ?, ?, ?, ?)`;
    
    db.query(query, [yemek_ismi, tuketilen_gramaj, alinan_karbonhidrat, olculen_kan_sekeri, onerilen_insulin], (err, results) => {
        if (err) {
            console.error("Veritabanı kayıt hatası:", err);
            return res.status(500).json({ durum: 'hata', mesaj: 'Kaydedilemedi' });
        }
        console.log(`Geçmişe eklendi: ${yemek_ismi} - İnsülin: ${onerilen_insulin} Ünite`);
        res.json({ durum: 'basarili', mesaj: 'Veri geçmişe başarıyla kaydedildi!' });
    });
});

app.get('/gecmis', (req, res) => {
    const query = 'SELECT * FROM gecmis_kayitlar ORDER BY tarih DESC';
    db.query(query, (err, results) => {
        if (err) {
            console.error("Geçmiş çekilirken hata:", err);
            return res.status(500).json({ durum: 'hata', mesaj: 'Veriler getirilemedi' });
        }
        res.json({ durum: 'basarili', veriler: results });
    });
});

app.listen(port, () => {
    console.log(`Node.js Orkestrasyon Sunucusu http://localhost:${port} adresinde çalışıyor`);
});