import io
from pypdf import PdfReader

def parse_resume(file_bytes: bytes, filename: str = "") -> str:
    """Parse resume text from PDF, DOCX, or DOC formats."""
    lower_name = (filename or "").lower()

    # 1. Try DOCX/DOC via python-docx if indicated or attempted
    if lower_name.endswith(".docx") or lower_name.endswith(".doc"):
        try:
            import docx
            doc = docx.Document(io.BytesIO(file_bytes))
            text = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
            if text.strip():
                return text.strip()
        except Exception:
            pass

    # 2. Try PDF extraction
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        text = ""
        for page in reader.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted + "\n"
        if text.strip():
            return text.strip()
    except Exception:
        pass

    # 3. Fallback: try docx in case filename wasn't provided or didn't match extension
    try:
        import docx
        doc = docx.Document(io.BytesIO(file_bytes))
        text = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
        if text.strip():
            return text.strip()
    except Exception:
        pass

    # 4. Fallback: try plain text
    try:
        text = file_bytes.decode("utf-8", errors="ignore").strip()
        if len(text) > 20:
            return text
    except Exception:
        pass

    return ""

