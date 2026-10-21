import sys
import json

def main():
    try:
        # 1. Node.js'ten gelen JSON verisini parametre olarak al
        input_data = sys.argv[1]
        data = json.loads(input_data)
        
        # 2. Verileri ayıkla
        gecmis_veriler = data.get("gecmis_veriler", [])
        anlik_seker = data.get("anlik_seker", 0)
        guncel_karb = data.get("guncel_karbonhidrat", 0)

        # 3. TODO: Asıl LSTM modeli buraya gelecek.
        # Şimdilik verilerin Python'a başarıyla ulaştığını test etmek için 
        # gelen karbonhidrata göre dinamik (ama basit) bir hesaplama yapıyoruz:
        tahmini_seker = anlik_seker + (guncel_karb * 0.8)
        hesaplanan_insulin = guncel_karb / 12.0

        # 4. Node.js'e geri göndermek üzere JSON formatında çıktı ver
        sonuc = {
            "gelecekteki_seker": round(tahmini_seker, 1),
            "onerilen_insulin": round(hesaplanan_insulin, 1)
        }
        
        # SADECE JSON basıyoruz ki Node.js bunu parse edebilsin
        print(json.dumps(sonuc))

    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()