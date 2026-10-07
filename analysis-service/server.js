const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// İleride dozaj hesaplamaları mobil uygulamadan buraya taşınabilir (Tez Savunması İçin Hazır)
app.post('/hesapla', (req, res) => {
    res.json({ durum: 'basarili', mesaj: 'Analiz servisi gelecekteki LSTM modelleri için aktiftir.' });
});

app.listen(3002, () => console.log('🧠 Analiz Servisi 3002 portunda ayakta.'));