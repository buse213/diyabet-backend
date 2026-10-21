import sys
import json
import torch
import torch.nn as nn
import numpy as np
import pandas as pd
import pickle

# Modeli Yüklemek İçin Sınıfı Tekrar Tanımlamalıyız (Eğitimdeki mimarinin birebir aynısı)
class DiabetesLSTM(nn.Module):
    def __init__(self):
        super().__init__()
        self.lstm = nn.LSTM(input_size=3, hidden_size=16, batch_first=True)
        self.fc = nn.Linear(16, 1)

    def forward(self, x):
        out, _ = self.lstm(x)
        out = self.fc(out[:, -1, :])
        return out

def main():
    try:
        # 1. Node.js'ten gelen veriyi al
        input_data = sys.argv[1]
        data = json.loads(input_data)
        
        gecmis_veriler = data.get("gecmis_veriler", [])
        anlik_seker = data.get("anlik_seker", 100)
        guncel_karb = data.get("guncel_karbonhidrat", 0)

        # 2. Eğittiğimiz Modeli ve Scaler'ı Yükle
        model = DiabetesLSTM()
        model.load_state_dict(torch.load('lstm_model.pt', map_location=torch.device('cpu')))
        model.eval()

        with open('scaler.pkl', 'rb') as f:
            scaler = pickle.load(f)

        # 3. Geçmiş Verileri Zaman Serisi Sekansına Çevir (Beklenen format: Karb, İnsülin, Glikoz)
        sekans = []
        for kayit in gecmis_veriler:
            sekans.append([
                float(kayit.get("alinan_karbonhidrat", 0)),
                float(kayit.get("onerilen_insulin", 0)),
                float(kayit.get("olculen_kan_sekeri", 100))
            ])
        
        # Güncel öğünü de ekle (İnsülin henüz önerilmediği için geçici bir başlangıç dozu hesaplıyoruz)
        tahmini_guncel_insulin = guncel_karb / 12.0
        sekans.append([float(guncel_karb), tahmini_guncel_insulin, float(anlik_seker)])

        # LSTM 5 adımlık veri beklediği için, veri azsa ilk veriyi kopyalayarak 5'e tamamlıyoruz
        while len(sekans) < 5:
            if len(sekans) > 0:
                sekans.insert(0, sekans[0])
            else:
                sekans.append([0.0, 0.0, 100.0]) # Hiç geçmiş yoksa varsayılan
        
        # Sadece son 5 adımı alıyoruz
        sekans = sekans[-5:]

        # 4. Veriyi Ölçeklendir (Normalize Et) ve PyTorch Tensörüne Çevir
        df_sekans = pd.DataFrame(sekans, columns=['karbonhidrat', 'insulin', 'glikoz'])
        scaled_sekans = scaler.transform(df_sekans)
        X_tensor = torch.tensor([scaled_sekans], dtype=torch.float32)

        # 5. GERÇEK YAPAY ZEKA TAHMİNİ (Forward Pass)
        with torch.no_grad():
            scaled_gelecek_seker = model(X_tensor).item()

        # Tahmin edilen değeri gerçek mg/dL formatına geri çevir (Inverse Transform)
        dummy_row = np.array([[0, 0, scaled_gelecek_seker]])
        gelecek_seker_mgdl = float(scaler.inverse_transform(dummy_row)[0][2])

        # 6. Trende Göre İnsülin Dozunu Düzelt
        if gelecek_seker_mgdl > 140:
            ekstra_doz = (gelecek_seker_mgdl - 140) / 40.0
            onerilen_insulin = tahmini_guncel_insulin + ekstra_doz
        else:
            onerilen_insulin = tahmini_guncel_insulin

        # 7. Sonucu Node.js'e Fırlat
        sonuc = {
            "gelecekteki_seker": round(gelecek_seker_mgdl, 1),
            "onerilen_insulin": round(max(0, onerilen_insulin), 1)
        }
        
        print(json.dumps(sonuc))

    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()