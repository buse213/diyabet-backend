const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');

const app = express();
app.use(cors());
app.use(express.json());

// --- HATA TESPİTİ İÇİN LOGLAMA ---
app.use((req, res, next) => {
    console.log(`📥 Gelen İstek: ${req.method} ${req.url}`);
    next();
});

const upload = multer({ storage: multer.memoryStorage() });

// --- RENDER CANLI LİNKLERİ ---
const IMAGE_SERVICE_URL = process.env.IMAGE_SERVICE_URL || 'http://localhost:3001';
const REPORTING_SERVICE_URL = process.env.REPORTING_SERVICE_URL || 'http://localhost:3003';

// 1. YAPAY ZEKA İSTEĞİNİ GÖRÜNTÜ SERVİSİNE İLET (3001)
app.post('/isleme', upload.single('file'), async (req, res) => {
    if (!req.file) {
        console.log("❌ HATA: Telefondan dosya gelmedi (req.file boş).");
        return res.status(400).json({ hata: 'Dosya yok' });
    }
    
    try {
        console.log(`⏳ Dosya alındı. Görüntü servisine iletiliyor... Hedef: ${IMAGE_SERVICE_URL}/isleme`);
        const formData = new FormData();
        formData.append('file', req.file.buffer, { filename: 'food.jpg', contentType: req.file.mimetype });

        const response = await axios.post(`${IMAGE_SERVICE_URL}/isleme`, formData, {
            headers: formData.getHeaders()
        });
        
        console.log("✅ Görüntü servisinden başarıyla yanıt alındı.");
        res.json(response.data);
    } catch (error) {
        console.error("❌ GÖRÜNTÜ SERVİSİ BAĞLANTI HATASI:", error.message);
        if (error.response) {
            console.error("❌ HATA DETAYI:", error.response.data);
        }
        res.status(500).json({ durum: 'hata', mesaj: 'Görüntü Servisine ulaşılamadı.', detay: error.message });
    }
});

// 2. YEMEK/DOZ KAYDETME İŞLEMİNİ RAPORLAMA SERVİSİNE İLET (3003)
app.post('/kaydet', async (req, res) => {
    try {
        const response = await axios.post(`${REPORTING_SERVICE_URL}/kaydet`, req.body);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ durum: 'hata', mesaj: 'Raporlama Servisine ulaşılamadı.' });
    }
});

// 3. GEÇMİŞİ GETİRME İŞLEMİNİ RAPORLAMA SERVİSİNE İLET (3003)
app.get('/gecmis', async (req, res) => {
    try {
        const response = await axios.get(`${REPORTING_SERVICE_URL}/gecmis`, { params: req.query });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ durum: 'hata', mesaj: 'Raporlama Servisine ulaşılamadı.' });
    }
});

// 4. KULLANICI KAYIT İŞLEMİNİ RAPORLAMA SERVİSİNE İLET (3003)
app.post('/kayit', async (req, res) => {
    try {
        const response = await axios.post(`${REPORTING_SERVICE_URL}/kayit`, req.body);
        res.json(response.data);
    } catch (error) {
        if (error.response && error.response.data) return res.status(error.response.status).json(error.response.data);
        res.status(500).json({ durum: 'hata', mesaj: 'Kayıt servisine ulaşılamadı.' });
    }
});

// 5. KULLANICI GİRİŞ İŞLEMİNİ RAPORLAMA SERVİSİNE İLET (3003)
app.post('/giris', async (req, res) => {
    try {
        const response = await axios.post(`${REPORTING_SERVICE_URL}/giris`, req.body);
        res.json(response.data);
    } catch (error) {
        if (error.response && error.response.data) return res.status(error.response.status).json(error.response.data);
        res.status(500).json({ durum: 'hata', mesaj: 'Giriş servisine ulaşılamadı.' });
    }
});

// 6. PROFİL GÜNCELLEME İŞLEMİNİ RAPORLAMA SERVİSİNE İLET (3003)
app.post('/profil-guncelle', async (req, res) => {
    try {
        const response = await axios.post(`${REPORTING_SERVICE_URL}/profil-guncelle`, req.body);
        res.json(response.data);
    } catch (error) {
        if (error.response && error.response.data) return res.status(error.response.status).json(error.response.data);
        res.status(500).json({ durum: 'hata', mesaj: 'Profil güncelleme servisine ulaşılamadı.' });
    }
});

// 7. SIK TÜKETİLENLERİ GETİRME İŞLEMİNİ RAPORLAMA SERVİSİNE İLET (3003)
app.get('/api/sik-tuketilenler', async (req, res) => {
    try {
        const response = await axios.get(`${REPORTING_SERVICE_URL}/sik-tuketilenler`, { params: req.query });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ durum: 'hata', mesaj: 'Raporlama Servisine ulaşılamadı.' });
    }
});

// 8. ŞİFRE SIFIRLAMA İŞLEMLERİ
app.post('/sifremi-unuttum', async (req, res) => {
    try {
        const response = await axios.post(`${REPORTING_SERVICE_URL}/sifremi-unuttum`, req.body);
        res.json(response.data);
    } catch (error) {
        if (error.response && error.response.data) return res.status(error.response.status).json(error.response.data);
        res.status(500).json({ durum: 'hata', mesaj: 'Şifre sıfırlama servisine ulaşılamadı.' });
    }
});

app.get('/sifre-sifirla', async (req, res) => {
    try {
        const response = await axios.get(`${REPORTING_SERVICE_URL}/sifre-sifirla`, { params: req.query });
        res.send(response.data);
    } catch (error) {
        res.status(500).send('<h2>Şifre sıfırlama formuna ulaşılamadı. Lütfen daha sonra tekrar deneyin.</h2>');
    }
});

app.post('/sifre-guncelle', express.urlencoded({ extended: true }), async (req, res) => {
    try {
        const response = await axios.post(`${REPORTING_SERVICE_URL}/sifre-guncelle`, req.body, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        res.send(response.data);
    } catch (error) {
        res.status(500).send('<h2 style="color: red; text-align: center;">Şifre güncelleme servisine ulaşılamadı.</h2>');
    }
});

// 9. SESLİ KOMUT ANALİZİ: metni görüntü servisindeki Gemini analizine ilet
app.post('/sesli-analiz', async (req, res) => {
    const komut = req.body && req.body.komut;
    if (!komut || !String(komut).trim()) {
        console.log("❌ HATA: Komut metni gelmedi.");
        return res.status(400).json({ durum: 'hata', mesaj: 'Komut metni yok' });
    }

    try {
        const response = await axios.post(`${IMAGE_SERVICE_URL}/metin-analiz`, { komut }, { timeout: 30000 });
        res.json(response.data);
    } catch (error) {
        console.error("❌ SESLİ ANALİZ HATASI:", error.message);
        res.status(500).json({ durum: 'hata', mesaj: 'Sesli analiz servisine ulaşılamadı.', detay: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 API Gateway ${PORT} portunda aktif. Tüm istekler buradan yönetiliyor.`);
});