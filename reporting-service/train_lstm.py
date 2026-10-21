import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.preprocessing import MinMaxScaler
import pickle

# ==========================================
# 1. AŞAMA: SENTETİK DİYABET VERİSİ ÜRETİMİ
# ==========================================
print("1. Sentetik hasta verileri üretiliyor (90 Günlük Geçmiş)...")
np.random.seed(42)
gun_sayisi = 90
ogun_sayisi = 3
toplam_kayit = gun_sayisi * ogun_sayisi

# Rastgele ama mantıklı sınırlar içinde veriler üretiyoruz
karbonhidratlar = np.random.randint(30, 100, toplam_kayit)
# Karbonhidrat / 12 oranına yakın insülin dozları (ufak sapmalarla)
insulinler = np.round(karbonhidratlar / 12.0 + np.random.normal(0, 0.5, toplam_kayit), 1)

# Kan şekeri simülasyonu (Önceki şeker, karbonhidrat ve vurulan insüline bağlı değişir)
glikoz = np.zeros(toplam_kayit)
glikoz[0] = 110 # Başlangıç şekeri
for i in range(1, toplam_kayit):
    # Formül: Eski şekerin yarısı + Karbonhidratın etkisi - İnsülinin düşürücü etkisi + Doğal sapma
    yeni_seker = (glikoz[i-1] * 0.5) + (karbonhidratlar[i] * 0.8) - (insulinler[i] * 8) + np.random.normal(90, 10)
    glikoz[i] = np.clip(yeni_seker, 70, 250) # Şeker 70 ile 250 arasında tutulur

df = pd.DataFrame({
    'karbonhidrat': karbonhidratlar,
    'insulin': insulinler,
    'glikoz': glikoz
})

# ==========================================
# 2. AŞAMA: VERİLERİ LSTM İÇİN HAZIRLAMA
# ==========================================
print("2. Veriler PyTorch LSTM formatına çevriliyor...")
scaler = MinMaxScaler()
scaled_data = scaler.fit_transform(df)

X, y = [], []
# Modele "Son 5 öğüne bak, bir sonraki şekeri tahmin et" diyeceğiz
for i in range(len(scaled_data) - 5):
    X.append(scaled_data[i:i+5, :]) 
    y.append(scaled_data[i+5, 2]) # 2. indeks glikoz sütunudur

X = torch.tensor(X, dtype=torch.float32)
y = torch.tensor(y, dtype=torch.float32).unsqueeze(1)

# ==========================================
# 3. AŞAMA: PYTORCH LSTM MİMARİSİ
# ==========================================
class DiabetesLSTM(nn.Module):
    def __init__(self):
        super().__init__()
        # 3 özellik giriyor: karb, insulin, glikoz
        self.lstm = nn.LSTM(input_size=3, hidden_size=16, batch_first=True)
        self.fc = nn.Linear(16, 1) # Çıktı tek bir değer: Gelecekteki şeker

    def forward(self, x):
        out, _ = self.lstm(x)
        out = self.fc(out[:, -1, :]) # Sadece en son zaman adımının çıktısını al
        return out

model = DiabetesLSTM()
criterion = nn.MSELoss()
optimizer = torch.optim.Adam(model.parameters(), lr=0.01)

# ==========================================
# 4. AŞAMA: MODEL EĞİTİMİ (TRAINING)
# ==========================================
print("3. Yapay Zeka (LSTM) Eğitimi Başlıyor...")
epochs = 100
for epoch in range(epochs):
    optimizer.zero_grad()
    outputs = model(X)
    loss = criterion(outputs, y)
    loss.backward()
    optimizer.step()
    
    if (epoch+1) % 20 == 0:
        print(f"Epoch [{epoch+1}/{epochs}], Kayıp (Loss): {loss.item():.4f}")

# ==========================================
# 5. AŞAMA: MODELİ KAYDETME
# ==========================================
torch.save(model.state_dict(), 'lstm_model.pt')
with open('scaler.pkl', 'wb') as f:
    pickle.dump(scaler, f)

print("--------------------------------------------------")
print(" BAŞARILI: Model Eğitildi ve Kaydedildi!")
print(" - lstm_model.pt (Yapay Zeka Ağırlıkları)")
print(" - scaler.pkl (Veri Ölçekleyici)")
print("--------------------------------------------------")