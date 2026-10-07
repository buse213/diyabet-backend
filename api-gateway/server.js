const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// 1. YAPAY ZEKA İSTEĞİNİ GÖRÜNTÜ SERVİSİNE İLET (3001)
app.post('/analiz', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ hata: 'Dosya yok' });
    try {
        const formData = new FormData();
        formData.append('file', req.file.buffer, { filename: 'food.jpg', contentType: req.file.mimetype });

        const response = await axios.post('http://localhost:3001/isleme', formData, {
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
        const response = await axios.post('http://localhost:3003/kaydet', req.body);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ durum: 'hata', mesaj: 'Raporlama Servisine ulaşılamadı.' });
    }
});

// 3. GEÇMİŞİ GETİRME İŞLEMİNİ RAPORLAMA SERVİSİNE İLET (3003) - DEĞİŞİKLİK BURADA YAPILDI
app.get('/gecmis', async (req, res) => {
    try {
        // Mobilden gelen req.query (içindeki email) parametresini 3003'e paslıyoruz
        const response = await axios.get('http://localhost:3003/gecmis', { params: req.query });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ durum: 'hata', mesaj: 'Raporlama Servisine ulaşılamadı.' });
    }
});

// 4. KULLANICI KAYIT İŞLEMİNİ RAPORLAMA SERVİSİNE İLET (3003)
app.post('/kayit', async (req, res) => {
    try {
        const response = await axios.post('http://localhost:3003/kayit', req.body);
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
        const response = await axios.post('http://localhost:3003/giris', req.body);
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
        const response = await axios.post('http://localhost:3003/profil-guncelle', req.body);
        res.json(response.data);
    } catch (error) {
        if (error.response && error.response.data) {
            return res.status(error.response.status).json(error.response.data);
        }
        res.status(500).json({ durum: 'hata', mesaj: 'Profil güncelleme servisine ulaşılamadı.' });
    }
});

app.listen(3000, () => {
    console.log('🚀 API Gateway 3000 portunda aktif. Tüm istekler buradan yönetiliyor.');
});