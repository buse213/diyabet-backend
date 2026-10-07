const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });
const genAI = new GoogleGenerativeAI('process.env.GEMINI_API_KEY');

app.post('/isleme', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ hata: 'Lütfen bir fotoğraf gönderin.' });

    try {
        console.log("Fotoğraf Gemini Yapay Zekasına gönderiliyor...");
        const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" });
        const imageBase64 = req.file.buffer.toString("base64");
        
        const resimVerisi = {
            inlineData: { data: imageBase64, mimeType: req.file.mimetype }
        };

        const prompt = `Sen uzman bir diyetisyen ve diyabet asistanısın. Bu fotoğraftaki yemeği analiz et. Sadece yemeğin Türkçe adını ve 100 gramındaki ortalama karbonhidrat miktarını tahmin et. Asla ekstra bir metin, selamlama veya açıklama yazma. SADECE VE SADECE geçerli bir JSON objesi döndür. Format tam olarak şöyle olmalı: {"turkce_isim": "Yemek Adı", "karbonhidrat_miktari": 25.5}`;

        const result = await model.generateContent([prompt, resimVerisi]);
        const responseText = result.response.text();
        console.log("Gemini'den gelen ham yanıt:", responseText);

        const temizJsonMetni = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const sonucObjesi = JSON.parse(temizJsonMetni);

        res.json({ durum: 'basarili', sonuc: sonucObjesi });
    } catch (error) {
        console.error("Yapay Zeka Hatası:", error);
        res.status(500).json({ hata: 'Yapay Zeka servisi ile iletişim kurulamadı.', detay: error.message });
    }
});

app.listen(3001, () => console.log('📷 Görüntü Servisi (Gemini) 3001 portunda ayakta.'));