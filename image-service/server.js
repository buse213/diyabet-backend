const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 15 Eğitilmiş Sınıfımızın Türkçe Karşılıkları ve Karbonhidrat Değerleri
const YEREL_BESINLER = [
  { ai_etiketi: 'caesar_salad', turkce_isim: 'Sezar Salata', karbonhidrat_miktari: 4 },
  { ai_etiketi: 'chicken_curry', turkce_isim: 'Köri Soslu Tavuk', karbonhidrat_miktari: 6 },
  { ai_etiketi: 'chicken_wings', turkce_isim: 'Tavuk Kanat', karbonhidrat_miktari: 5 },
  { ai_etiketi: 'french_fries', turkce_isim: 'Patates Kızartması', karbonhidrat_miktari: 41 },
  { ai_etiketi: 'fried_rice', turkce_isim: 'Kızarmış Pirinç', karbonhidrat_miktari: 28 },
  { ai_etiketi: 'hamburger', turkce_isim: 'Hamburger', karbonhidrat_miktari: 24 },
  { ai_etiketi: 'hot_dog', turkce_isim: 'Sosisli Sandviç', karbonhidrat_miktari: 18 },
  { ai_etiketi: 'ice_cream', turkce_isim: 'Dondurma', karbonhidrat_miktari: 24 },
  { ai_etiketi: 'macaroni_and_cheese', turkce_isim: 'Mac and Cheese', karbonhidrat_miktari: 23 },
  { ai_etiketi: 'omelette', turkce_isim: 'Omlet', karbonhidrat_miktari: 1 },
  { ai_etiketi: 'pancakes', turkce_isim: 'Pancake', karbonhidrat_miktari: 28 },
  { ai_etiketi: 'pizza', turkce_isim: 'Pizza', karbonhidrat_miktari: 33 },
  { ai_etiketi: 'spaghetti_bolognese', turkce_isim: 'Spagetti Bolonez', karbonhidrat_miktari: 14 },
  { ai_etiketi: 'steak', turkce_isim: 'Biftek', karbonhidrat_miktari: 0 },
  { ai_etiketi: 'waffles', turkce_isim: 'Waffle', karbonhidrat_miktari: 33 }
];

app.post('/isleme', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ hata: 'Lütfen bir fotoğraf gönderin.' });

    const imagePath = path.resolve(req.file.path);

    try {
        console.log("1. Aşama: Fotoğraf yerel eğittiğiniz ResNet18 ONNX modeline gönderiliyor...");
        
        const pythonExecutable = "python3";
        const scriptPath = path.resolve(__dirname, 'predict.py');

        exec(`"${pythonExecutable}" "${scriptPath}" "${imagePath}"`, async (error, stdout, stderr) => {
            if (error) {
                if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
                console.error("Python Çalıştırma Hatası:", error);
                return res.status(500).json({ hata: 'Model analizi sırasında hata oluştu.', detay: error.message });
            }

            try {
                const temizStdout = stdout.trim();
                console.log("Python'dan gelen ham yanıt:", temizStdout);
                
                const yerelSonuc = JSON.parse(temizStdout);
                if (yerelSonuc.error) {
                    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
                    return res.status(500).json({ hata: yerelSonuc.error });
                }

                const predictedIndex = yerelSonuc.class_index;
                const confidence = yerelSonuc.confidence || 0.0; 

                const bizimSinirlerdeMi = (predictedIndex >= 0 && predictedIndex < 15);
               const modelEminMi = (confidence >= 0.85);

                console.log(`Yerel Model Tahmini: İndeks ${predictedIndex}, Güven Oranı: %${(confidence * 100).toFixed(2)}`);

                if (bizimSinirlerdeMi && modelEminMi) {
                    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
                    const bulunanYemek = YEREL_BESINLER[predictedIndex];

                    console.log(`✅ Yerel Model Başarılı: ${bulunanYemek.turkce_isim} (%${(confidence * 100).toFixed(2)} emin)`);
                    return res.json({
                        durum: 'basarili',
                        kaynak: 'Yerel ResNet18 Model',
                        sonuc: {
                            turkce_isim: bulunanYemek.turkce_isim,
                            karbonhidrat_miktari: bulunanYemek.karbonhidrat_miktari
                        }
                    });
                } else {
                    console.log("2. Aşama: Yerel model yeterince emin olamadı, Gemini Bulut Yapay Zekasına bağlanılıyor...");
                    
                    const fileBuffer = fs.readFileSync(imagePath);
                    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);

                    // İŞTE BÜTÜN HATAYI ÇÖZECEK O GÜNCEL SATIR BURADA
                  const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" });
                    
                    const imageBase64 = fileBuffer.toString("base64");
                    
                    const resimVerisi = {
                        inlineData: { data: imageBase64, mimeType: req.file.mimetype }
                    };

                    const prompt = `Sen uzman bir diyetisyen ve diyabet asistanısın. Bu fotoğraftaki yemeği analiz et. Sadece yemeğin Türkçe adını ve 100 gramındaki ortalama karbonhidrat miktarını tahmin et. Asla ekstra bir metin yazma. SADECE geçerli bir JSON objesi döndür: {"turkce_isim": "Yemek Adı", "karbonhidrat_miktari": 25.5}`;

                    const geminiResult = await model.generateContent([prompt, resimVerisi]);
                    const responseText = geminiResult.response.text();
                    const temizJsonMetni = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
                    const sonucObjesi = JSON.parse(temizJsonMetni);

                    console.log("✅ Gemini Analizi Başarılı:", sonucObjesi);
                    return res.json({
                        durum: 'basarili',
                        kaynak: 'Gemini Bulut AI',
                        sonuc: sonucObjesi
                    });
                }

            } catch (parseError) {
                if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
                console.error("İşlem/Parse Hatası:", parseError);
                res.status(500).json({ hata: 'Model çıktısı işlenemedi.', detay: parseError.message });
            }
        });

    } catch (error) {
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        console.error("Sunucu Hatası:", error);
        res.status(500).json({ hata: 'Görüntü işleme servisi ile iletişim kurulamadı.', detay: error.message });
    }
});

app.listen(3001, () => console.log('📷 Akıllı Hibrit Görüntü Servisi 3001 portunda ayakta.'));