from typing import List
from services.email_parser import extract_emails

try:
    import cv2
    import numpy as np
    import easyocr
    reader = easyocr.Reader(['en'], gpu=False)
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    print("Warning: cv2 or easyocr not installed. Image extraction disabled.")

def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """Applies grayscale and Otsu thresholding for ultra-clear OCR text execution."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # Binarization to eliminate busy backgrounds in flyers
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return thresh

def extract_email_from_image_bytes(image_bytes: bytes) -> List[str]:
    if not OCR_AVAILABLE:
        return []
    try:
        processed_img = preprocess_image(image_bytes)
        results = reader.readtext(processed_img, detail=0)
        extracted_text = " ".join(results)
        return extract_emails(extracted_text)
    except Exception as e:
        print(f"OCR Processing error: {e}")
        return []
