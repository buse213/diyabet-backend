import sys
import json
import onnxruntime as ort
import numpy as np
from PIL import Image

# Modelin yolu
model_path = "diyabet_modeli_resnet18.onnx"
session = ort.InferenceSession(model_path)

def predict(image_path):
    try:
        # Fotoğrafı RGB'ye çevirmeye zorluyoruz (PNG'lerdeki şeffaflık kanalının sistemi çökertmemesi için)
        img = Image.open(image_path).convert('RGB').resize((224, 224))
        img_data = np.array(img).astype(np.float32) / 255.0
        
        # Mean & Std normalizasyonu 
        mean = np.array([0.485, 0.456, 0.406])
        std = np.array([0.229, 0.224, 0.225])
        img_data = (img_data - mean) / std

        img_data = np.transpose(img_data, (2, 0, 1)) # (C, H, W)
        img_data = np.expand_dims(img_data, axis=0)   # (1, C, H, W)

        input_name = session.get_inputs()[0].name
        result = session.run(None, {input_name: img_data.astype(np.float32)})
        
        # --- İŞTE EKSİK OLAN KISIM: SOFTMAX İŞLEMİ ---
        # Ham skorları (logits) 0.0 ile 1.0 arasında bir yüzdelik değere çeviriyoruz
        logits = result[0][0]
        exp_logits = np.exp(logits - np.max(logits)) # Matematiksel hatayı önlemek için max çıkarılır
        probabilities = exp_logits / np.sum(exp_logits)
        
        predicted_class = int(np.argmax(probabilities))
        confidence = float(np.max(probabilities)) # Artık tam olarak 0.95 (%95) gibi bir oran dönecek
        
        return {"class_index": predicted_class, "confidence": confidence}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    img_path = sys.argv[1]
    res = predict(img_path)
    print(json.dumps(res))