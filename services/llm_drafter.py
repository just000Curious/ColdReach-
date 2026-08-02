import json
import os
import re
import time
import base64
import requests


class EmailDraftResponse:
    """Container for the LLM's structured email draft."""
    def __init__(self, hiring_manager_name, company_name, subject, body):
        self.hiring_manager_name = hiring_manager_name
        self.company_name = company_name
        self.subject = subject
        self.body = body


class ExtractedInfo:
    """Container for auto-extracted job info from JD or poster."""
    def __init__(self, email="", job_title="", company_name="", job_description=""):
        self.email = email
        self.job_title = job_title
        self.company_name = company_name
        self.job_description = job_description


def _strip_markdown_fences(text: str) -> str:
    """Gemini sometimes wraps JSON in ```json ... ``` fences. Strip them."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```\w*\s*\n?", "", text)
        text = re.sub(r"\n?```\s*$", "", text)
    return text.strip()


def _get_api_key() -> str:
    api_key = os.environ.get("GEMINI_API_KEY", "").strip('" ')
    if not api_key:
        raise ValueError("GEMINI_API_KEY is missing. Please set it in your .env file.")
    return api_key


def call_gemini(prompt: str, json_mode: bool = False, temperature: float = 0.2) -> str:
    """Call Gemini text API with automatic retry on transient errors."""
    api_key = _get_api_key()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": temperature},
    }
    if json_mode:
        payload["generationConfig"]["responseMimeType"] = "application/json"

    headers = {"Content-Type": "application/json"}

    last_error = None
    for attempt in range(3):
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=60)
            if response.status_code in (503, 429, 500):
                time.sleep(2 ** (attempt + 1))
                last_error = f"{response.status_code}: {response.text[:200]}"
                continue
            response.raise_for_status()
            data = response.json()
            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
            return _strip_markdown_fences(raw_text)
        except requests.exceptions.Timeout:
            last_error = "Timeout"
            if attempt < 2:
                time.sleep(2 ** (attempt + 1))
                continue
        except requests.exceptions.HTTPError:
            raise
    raise ValueError(f"Gemini API failed after 3 retries. Last error: {last_error}")


def call_gemini_vision(prompt: str, image_bytes: bytes, json_mode: bool = False) -> str:
    """Call Gemini with an image (multimodal) for poster/flyer analysis."""
    api_key = _get_api_key()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"

    b64_image = base64.b64encode(image_bytes).decode("utf-8")

    payload = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inline_data": {"mime_type": "image/png", "data": b64_image}},
            ]
        }],
        "generationConfig": {"temperature": 0.1},
    }
    if json_mode:
        payload["generationConfig"]["responseMimeType"] = "application/json"

    headers = {"Content-Type": "application/json"}

    last_error = None
    for attempt in range(3):
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=90)
            if response.status_code in (503, 429, 500):
                time.sleep(2 ** (attempt + 1))
                last_error = f"{response.status_code}: {response.text[:200]}"
                continue
            response.raise_for_status()
            data = response.json()
            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
            return _strip_markdown_fences(raw_text)
        except requests.exceptions.Timeout:
            last_error = "Timeout"
            if attempt < 2:
                time.sleep(2 ** (attempt + 1))
                continue
        except requests.exceptions.HTTPError:
            raise
    raise ValueError(f"Gemini Vision API failed after 3 retries. Last error: {last_error}")


# ══════════════════════════════════════════════════════════════════
# EXTRACTION FUNCTIONS (Auto-fill from JD or Poster)
# ══════════════════════════════════════════════════════════════════

def extract_from_jd(jd_text: str) -> ExtractedInfo:
    """Use Gemini to auto-extract email, job title, company from a JD."""
    prompt = f"""Analyze this job description and extract the following information.

Return ONLY a JSON object with these keys:
- "email": the HR/recruiter email address if present, otherwise empty string ""
- "job_title": the exact job title being advertised
- "company_name": the company name
- "job_description": a 2-3 sentence summary of what the job requires

If any field cannot be found, use an empty string "".

JOB DESCRIPTION:
{jd_text[:4000]}"""

    result = call_gemini(prompt, json_mode=True, temperature=0.1)
    data = json.loads(result)
    return ExtractedInfo(
        email=data.get("email", ""),
        job_title=data.get("job_title", ""),
        company_name=data.get("company_name", ""),
        job_description=data.get("job_description", ""),
    )


def extract_from_poster(image_bytes: bytes) -> ExtractedInfo:
    """Use Gemini Vision to scan a poster/flyer and extract job details."""
    prompt = """Analyze this job posting image/flyer/advertisement carefully.

Extract ALL of the following information from the image:
- "email": any email address visible in the image (look carefully for HR/recruiter emails)
- "job_title": the job title or position being advertised
- "company_name": the company or organization name
- "job_description": summarize what the job requires in 2-3 sentences

Return ONLY a JSON object with those 4 keys. If any field cannot be found, use an empty string ""."""

    result = call_gemini_vision(prompt, image_bytes, json_mode=True)
    data = json.loads(result)
    return ExtractedInfo(
        email=data.get("email", ""),
        job_title=data.get("job_title", ""),
        company_name=data.get("company_name", ""),
        job_description=data.get("job_description", ""),
    )


# ══════════════════════════════════════════════════════════════════
# EMAIL GENERATION FUNCTIONS
# ══════════════════════════════════════════════════════════════════

def generate_cold_email(
    resume_text: str, company_info: str, target_role: str,
    sender_name: str, github_url: str, portfolio_url: str, linkedin_url: str = "",
) -> EmailDraftResponse:
    """Generate a cold outreach email (no JD, just reaching out)."""
    links = []
    if portfolio_url: links.append(f"Portfolio: {portfolio_url}")
    if github_url: links.append(f"GitHub: {github_url}")
    if linkedin_url: links.append(f"LinkedIn: {linkedin_url}")
    links_str = " | ".join(links)

    prompt = f"""You are an expert career outreach assistant. Write a cold outreach email to an HR manager.

RULES:
1. NEVER invent experience, projects, or degrees not in the resume.
2. Keep the email under 100 words. Be direct and compelling.
3. The sender's name is: {sender_name}
4. Target Role: {target_role if target_role else "General inquiry"}
5. Company context: {company_info if company_info else "No specific company info provided"}

EMAIL FORMAT:
Start with "Dear [HR Name / Hiring Manager],"
Write the body paragraphs.
End the body text abruptly. DO NOT include a sign-off like "Best regards" or the sender's name.

Return ONLY a JSON object:
- "hiring_manager_name": "Hiring Manager"
- "company_name": company name or "the company"
- "subject": compelling subject line
- "body": the full email body following the format above (use \n for line breaks)

RESUME:
{resume_text[:3000]}"""

    result = call_gemini(prompt, json_mode=True, temperature=0.3)
    data = json.loads(result)
    
    # Programmatically append the signature
    body = data.get("body", "").strip()
    signature = f"\n\nBest regards,\n{sender_name}"
    if links_str:
        signature += f"\n{links_str}"
    
    data["body"] = body + signature
    return EmailDraftResponse(**data)


def generate_jd_email(
    resume_text: str, jd_text: str, job_title: str, company_name: str,
    sender_name: str, github_url: str, portfolio_url: str, linkedin_url: str = "",
) -> EmailDraftResponse:
    """Generate an application email based on a specific job description."""
    links = []
    if portfolio_url: links.append(f"Portfolio: {portfolio_url}")
    if github_url: links.append(f"GitHub: {github_url}")
    if linkedin_url: links.append(f"LinkedIn: {linkedin_url}")
    links_str = " | ".join(links)

    prompt = f"""You are an expert career outreach assistant. Write a job application email.

RULES:
1. NEVER invent experience, projects, or degrees not in the resume.
2. Keep the email under 120 words. Be specific about why this candidate fits THIS role.
3. Sender name: {sender_name}
4. Job Title: {job_title}
5. Company: {company_name}

EMAIL FORMAT:
Start with "Dear [HR Name / Hiring Manager],"
Write the body paragraphs highlighting 2-3 specific skills matching the JD.
End the body text abruptly. DO NOT include a sign-off like "Best regards" or the sender's name.

Return ONLY a JSON object:
- "hiring_manager_name": HR name if known, else "Hiring Manager"
- "company_name": "{company_name}"
- "subject": compelling subject line mentioning the role
- "body": the full email body following the format above (use \n for line breaks)

RESUME:
{resume_text[:3000]}

JOB DESCRIPTION:
{jd_text[:3000]}"""

    result = call_gemini(prompt, json_mode=True, temperature=0.2)
    data = json.loads(result)
    
    # Programmatically append the signature
    body = data.get("body", "").strip()
    signature = f"\n\nBest regards,\n{sender_name}"
    if links_str:
        signature += f"\n{links_str}"
    
    data["body"] = body + signature
    return EmailDraftResponse(**data)


def rewrite_email(original_body: str, app_type: str, company: str, resume_text: str, new_angle: str, sender_name: str = "", github_url: str = "", portfolio_url: str = "", linkedin_url: str = "") -> str:
    """Rewrite email with a new angle or phrasing."""
    links = []
    if portfolio_url: links.append(f"Portfolio: {portfolio_url}")
    if github_url: links.append(f"GitHub: {github_url}")
    if linkedin_url: links.append(f"LinkedIn: {linkedin_url}")
    links_str = " | ".join(links)
    
    if new_angle:
        angle_instruction = f"The user requested this specific new angle/focus for the rewrite: '{new_angle}'. Ensure this is central to the new draft."
    else:
        angle_instruction = "Try a completely new angle or emphasize different skills from the resume to make it fresh."

    if app_type == "Cold Email":
        prompt = f"""You are rewriting a Cold Outreach email to {company}. 
{angle_instruction}
Do NOT just swap synonyms. Construct a completely fresh cold outreach email.
Keep it professional, highly personalized, and concise.

Resume Context:
{resume_text[:2000]}

Original Email:
{original_body}

Return ONLY the rewritten email body text. No subject line. No explanations."""
    else:
        prompt = f"""You are rewriting a Job Application email to {company}.
{angle_instruction}
Acknowledge briefly that you applied earlier and are following up, but pivot the focus to this new angle.
Keep it punchy, professional, and short.

Resume Context:
{resume_text[:2000]}

Original Email:
{original_body}

Return ONLY the rewritten email body text. No subject line. No explanations."""

    result_body = call_gemini(prompt, json_mode=False, temperature=0.7).strip()
    
    signature = f"\n\nBest regards,\n{sender_name}" if sender_name else ""
    if links_str:
        signature += f"\n{links_str}"
        
    return result_body + signature


def generate_follow_up(original_body: str, company: str, hr_name: str, sender_name: str = "", github_url: str = "", portfolio_url: str = "", linkedin_url: str = "") -> str:
    """Generate a polite follow-up email."""
    links = []
    if portfolio_url: links.append(f"Portfolio: {portfolio_url}")
    if github_url: links.append(f"GitHub: {github_url}")
    if linkedin_url: links.append(f"LinkedIn: {linkedin_url}")
    links_str = " | ".join(links)
    prompt = f"""Write a short, polite 2-3 sentence follow-up email.
Context: I previously emailed {hr_name} at {company} about a job opportunity.
My original email: {original_body[:500]}

Return ONLY the follow-up text. No placeholders, no subject line. Sound human and genuine."""
    result_body = call_gemini(prompt, json_mode=False, temperature=0.4).strip()
    
    signature = f"\n\nBest regards,\n{sender_name}" if sender_name else ""
    if links_str:
        signature += f"\n{links_str}"
        
    return result_body + signature
