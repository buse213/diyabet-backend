const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');

const app = express();
app.use(cors());
app.use(express.json());

// --- HATA TESPİTİ İÇİN LOGLAMA (Gelen her isteği Render terminaline yazar) ---
app.use((req, res, next) => {
    console.log(`📥 Gelen İstek: ${req.method} ${req.url}`);
    next();
});

const upload = multer({ storage: multer.memoryStorage() });

// --- RENDER CANLI LİNKLERİ (Ortam değişkenlerinden alınacak) ---
const IMAGE_SERVICE_URL = process.env.IMAGE_SERVICE_URL || 'http://localhost:3001';
const REPORTING_SERVICE_URL = process.env.REPORTING_SERVICE_URL || 'http://localhost:3003';

// 1. YAPAY ZEKA İSTEĞİNİ GÖRÜNTÜ SERVİSİNE İLET (3001)
app.post('/analiz', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ hata: 'Dosya yok' });
    try {
        const formData = new FormData();
        formData.append('file', req.file.buffer, { filename: 'food.jpg', contentType: req.file.mimetype });

        const response = await axios.post(`${IMAGE_SERVICE_URL}/isleme`, formData, {
            headers: formData.getHeaders()
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ durum: 'hata', mesaj: 'Görüntü Servisine ulaşılamadı.' });
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
        if (error.response && error.response.data) {
            return res.status(error.response.status).json(error.response.data);
        }
        res.status(500).json({ durum: 'hata', mesaj: 'Kayıt servisine ulaşılamadı.' });
    }
});

// 5. KULLANICI GİRİŞ İŞLEMİNİ RAPORLAMA SERVİSİNE İLET (3003)
app.post('/giris', async (req, res) => {
    try {
        const response = await axios.post(`${REPORTING_SERVICE_URL}/giris`, req.body);
        res.json(response.data);
    } catch (error) {
        if (error.response && error.response.data) {
            return res.status(error.response.status).json(error.response.data);
        }
        res.status(500).json({ durum: 'hata', mesaj: 'Giriş servisine ulaşılamadı.' });
    }
});

// 6. PROFİL GÜNCELLEME İŞLEMİNİ RAPORLAMA SERVİSİNE İLET (3003)
app.post('/profil-guncelle', async (req, res) => {
    try {
        const response = await axios.post(`${REPORTING_SERVICE_URL}/profil-guncelle`, req.body);
        res.json(response.data);
    } catch (error) {
        if (error.response && error.response.data) {
            return res.status(error.response.status).json(error.response.data);
        }
        res.status(500).json({ durum: 'hata', mesaj: 'Profil güncelleme servisine ulaşılamadı.' });
    }
});

// RENDER İÇİN DİNAMİK PORT VE 0.0.0.0 HOST AYARI
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 API Gateway ${PORT} portunda aktif. Tüm istekler buradan yönetiliyor.`);
});