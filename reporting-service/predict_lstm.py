import os
import torch
import torch.nn as nn
import numpy as np
import pandas as pd
import pickle
from flask import Flask, request, jsonify
from flask_cors import CORS

# Modeli Yüklemek İçin Sınıfı Tekrar Tanımlamalıyız
class DiabetesLSTM(nn.Module):
    def __init__(self):
        super().__init__()
        self.lstm = nn.LSTM(input_size=3, hidden_size=16, batch_first=True)
        self.fc = nn.Linear(16, 1)

    def forward(self, x):
        out, _ = self.lstm(x)
        out = self.fc(out[:, -1, :])
        return out

app = Flask(__name__)
CORS(app)

# KRİTİK DEĞİŞİKLİK: Model ve Scaler sunucu başlarken SADECE BİR KERE RAM'e yüklenir.
# Bu sayede her analizde yeniden yüklenmez ve hafıza şişmez.
print("Yapay Zeka Modeli Yükleniyor...")
model = DiabetesLSTM()
model.load_state_dict(torch.load('lstm_model.pt', map_location=torch.device('cpu')))
model.eval()

with open('scaler.pkl', 'rb') as f:
    scaler = pickle.load(f)
print("Model ve Scaler başarıyla yüklendi, API dinlemeye hazır!")

@app.route('/predict', methods=['POST'])
def predict():
    try:
        # 1. Node.js'ten gelen veriyi HTTP Request içinden al
        data = request.json
        
        gecmis_veriler = data.get("gecmis_veriler", [])
        anlik_seker = data.get("anlik_seker", 100)
        guncel_karb = data.get("guncel_karbonhidrat", 0)

        # 2. Geçmiş Verileri Zaman Serisi Sekansına Çevir
        sekans = []
        for kayit in gecmis_veriler:
            sekans.append([
                float(kayit.get("alinan_karbonhidrat", 0)),
                float(kayit.get("onerilen_insulin", 0)),
                float(kayit.get("olculen_kan_sekeri", 100))
            ])
        
        # Güncel öğünü ekle
        tahmini_guncel_insulin = guncel_karb / 12.0
        sekans.append([float(guncel_karb), tahmini_guncel_insulin, float(anlik_seker)])

        # LSTM 5 adımlık veri beklediği için tamamla
        while len(sekans) < 5:
            if len(sekans) > 0:
                sekans.insert(0, sekans[0])
            else:
                sekans.append([0.0, 0.0, 100.0]) 
        
        sekans = sekans[-5:]

        # 3. Veriyi Ölçeklendir ve PyTorch Tensörüne Çevir
        df_sekans = pd.DataFrame(sekans, columns=['karbonhidrat', 'insulin', 'glikoz'])
        scaled_sekans = scaler.transform(df_sekans)
        X_tensor = torch.tensor([scaled_sekans], dtype=torch.float32)

        # 4. GERÇEK YAPAY ZEKA TAHMİNİ (Forward Pass)
        with torch.no_grad():
            scaled_gelecek_seker = model(X_tensor).item()

        dummy_row = np.array([[0, 0, scaled_gelecek_seker]])
        gelecek_seker_mgdl = float(scaler.inverse_transform(dummy_row)[0][2])

        # 5. Trende Göre İnsülin Dozunu Düzelt
        if gelecek_seker_mgdl > 140:
            ekstra_doz = (gelecek_seker_mgdl - 140) / 40.0
            onerilen_insulin = tahmini_guncel_insulin + ekstra_doz
        else:
            onerilen_insulin = tahmini_guncel_insulin

        # 6. Sonucu JSON formatında Node.js'e geri dön
        return jsonify({
            "gelecekteki_seker": round(gelecek_seker_mgdl, 1),
            "onerilen_insulin": round(max(0, onerilen_insulin), 1)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)