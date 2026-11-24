import os
import torch
import torch.nn as nn
import numpy as np
import pandas as pd
import pickle
from flask import Flask, request, jsonify
from flask_cors import CORS

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
        data = request.json
        
        gecmis_veriler = data.get("gecmis_veriler", [])
        anlik_seker = float(data.get("anlik_seker", 100))
        guncel_karb = float(data.get("guncel_karbonhidrat", 0))
        
        # Mobil uygulama ile aynı varsayılan değerler (ICR = 15, ISF = 50)
        icr = float(data.get("icr") or 15.0)
        isf = float(data.get("isf") or 50.0)
        if icr <= 0:
            icr = 15.0
        if isf <= 0:
            isf = 50.0

        # 1. Geçmiş Verileri Zaman Serisi Sekansına Çevir
        sekans = []
        for kayit in gecmis_veriler:
            sekans.append([
                float(kayit.get("alinan_karbonhidrat", 0)),
                float(kayit.get("onerilen_insulin", 0)),
                float(kayit.get("olculen_kan_sekeri", 100))
            ])
        
        # Kişisel ICR değerine göre öğün bolusu
        tahmini_guncel_insulin = guncel_karb / icr
        sekans.append([guncel_karb, tahmini_guncel_insulin, anlik_seker])

        # LSTM 5 adımlık veri beklediği için tamamla
        while len(sekans) < 5:
            if len(sekans) > 0:
                sekans.insert(0, sekans[0])
            else:
                sekans.append([0.0, 0.0, 100.0]) 
        
        sekans = sekans[-5:]

        # 2. Veriyi Ölçeklendir ve PyTorch Tensörüne Çevir
        df_sekans = pd.DataFrame(sekans, columns=['karbonhidrat', 'insulin', 'glikoz'])
        scaled_sekans = scaler.transform(df_sekans)
        X_tensor = torch.tensor([scaled_sekans], dtype=torch.float32)

        # 3. LSTM İleri Besleme Tahmini
        with torch.no_grad():
            scaled_gelecek_seker = model(X_tensor).item()

        dummy_row = np.array([[0, 0, scaled_gelecek_seker]])
        gelecek_seker_mgdl = float(scaler.inverse_transform(dummy_row)[0][2])

        # 4. Mobil ile aynı mantık: Hedef (120) üzerindeki her değer için pürüzsüz düzeltme dozu
        hedef_seker = 120.0
        if gelecek_seker_mgdl > hedef_seker:
            ekstra_doz = (gelecek_seker_mgdl - hedef_seker) / isf
            onerilen_insulin = tahmini_guncel_insulin + ekstra_doz
        else:
            onerilen_insulin = tahmini_guncel_insulin

        return jsonify({
            "gelecekteki_seker": round(gelecek_seker_mgdl, 1),
            "onerilen_insulin": round(max(0, onerilen_insulin), 1),
            "kullanilan_icr": icr,
            "kullanilan_isf": isf
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)