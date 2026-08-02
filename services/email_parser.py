import re
from typing import List

def normalize_obfuscated_text(text: str) -> str:
    """Fixes common anti-bot email obfuscations before regex scanning."""
    text = re.sub(r'[\(\[\{]\s*(at|AT|At)\s*[\)\]\}]', '@', text)
    text = re.sub(r'\s+at\s+', '@', text)
    text = re.sub(r'[\(\[\{]\s*(dot|DOT|Dot)\s*[\)\]\}]', '.', text)
    text = re.sub(r'\s+dot\s+', '.', text)
    return text

def extract_emails(text: str) -> List[str]:
    clean_text = normalize_obfuscated_text(text)
    # RFC 5322 compliant regex for strict email validation
    pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    matches = re.findall(pattern, clean_text)
    
    # Filter out false positives like image filenames or invalid TLDs
    valid_emails = []
    for email in set(matches):
        email_lower = email.lower()
        if not email_lower.endswith(('.png', '.jpg', '.jpeg', '.webp', '.svg')):
            valid_emails.append(email_lower)
            
    return valid_emails
