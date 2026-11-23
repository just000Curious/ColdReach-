import json
import os
import re
import time
import base64
import random
import requests
from typing import List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

from services.db import add_token_usage

# Anchor to project root for additional project details
_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_DETAILS_FILE = os.path.join(os.path.dirname(_DIR), "project_resume_details.md")

def _load_project_details() -> str:
    """Load additional project details (e.g. 7-agent LangGraph RAG platform) if available."""
    if os.path.exists(_PROJECT_DETAILS_FILE):
        try:
            with open(_PROJECT_DETAILS_FILE, "r", encoding="utf-8") as f:
                content = f.read()
                return content[:4000]
        except Exception:
            pass
    return ""



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


def _get_model_name() -> str:
    return os.environ.get("GEMINI_MODEL", "gemini-3.5-flash").strip('" ')


def call_gemini(prompt: str, json_mode: bool = False, temperature: float = 0.2) -> str:
    """Call Gemini text API with automatic retry on transient errors."""
    api_key = _get_api_key()
    model = _get_model_name()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

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
            if "usageMetadata" in data:
                add_token_usage(data["usageMetadata"].get("totalTokenCount", 0))
            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
            return _strip_markdown_fences(raw_text)
        except requests.exceptions.Timeout:
            last_error = "Timeout"
            if attempt < 2:
                time.sleep(2 ** (attempt + 1))
                continue
        except requests.exceptions.HTTPError as e:
            last_error = str(e)
            if attempt < 2:
                time.sleep(2 ** (attempt + 1))
                continue
            raise
    raise ValueError(f"Gemini API failed after 3 retries. Last error: {last_error}")


def call_gemini_vision(prompt: str, image_bytes: bytes, json_mode: bool = False) -> str:
    """Call Gemini with an image (multimodal) for poster/flyer analysis."""
    api_key = _get_api_key()
    model = _get_model_name()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

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
            if "usageMetadata" in data:
                add_token_usage(data["usageMetadata"].get("totalTokenCount", 0))
            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
            return _strip_markdown_fences(raw_text)
        except requests.exceptions.Timeout:
            last_error = "Timeout"
            if attempt < 2:
                time.sleep(2 ** (attempt + 1))
                continue
        except requests.exceptions.HTTPError as e:
            last_error = str(e)
            if attempt < 2:
                time.sleep(2 ** (attempt + 1))
                continue
            raise
    raise ValueError(f"Gemini Vision API failed after 3 retries. Last error: {last_error}")

def call_gemini_pdf(prompt: str, pdf_bytes: bytes, json_mode: bool = False) -> str:
    """Call Gemini with a PDF for robust text extraction."""
    api_key = _get_api_key()
    model = _get_model_name()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    b64_pdf = base64.b64encode(pdf_bytes).decode("utf-8")

    payload = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inline_data": {"mime_type": "application/pdf", "data": b64_pdf}},
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
            response = requests.post(url, json=payload, headers=headers, timeout=120)
            if response.status_code in (503, 429, 500):
                time.sleep(2 ** (attempt + 1))
                last_error = f"{response.status_code}: {response.text[:200]}"
                continue
            response.raise_for_status()
            data = response.json()
            if "usageMetadata" in data:
                add_token_usage(data["usageMetadata"].get("totalTokenCount", 0))
            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
            return _strip_markdown_fences(raw_text)
        except requests.exceptions.Timeout:
            last_error = "Timeout"
            if attempt < 2:
                time.sleep(2 ** (attempt + 1))
                continue
        except requests.exceptions.HTTPError as e:
            last_error = str(e)
            if attempt < 2:
                time.sleep(2 ** (attempt + 1))
                continue
            raise
    raise ValueError(f"Gemini API failed after 3 retries. Last error: {last_error}")


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


def extract_leads(file_bytes: bytes, filename: str) -> List[Dict[str, str]]:
    """Extract a list of roles, companies, HR emails, and skills from a raw PDF or Word file using Gemini."""
    prompt = """Analyze the attached document, which contains a list of jobs, roles, or contacts.
Extract all the leads you can find. For each lead, identify:
- "role": The job title or position.
- "company": The name of the company.
- "hr_email": The email address of the HR person, recruiter, or contact provided. If not found, leave as empty string.
- "skills": A comma-separated list of key skills required. If not found, leave as empty string.

Return ONLY a JSON array of objects, e.g. [{"role": "...", "company": "...", "hr_email": "...", "skills": "..."}]. If none found, return [].
"""

    try:
        if filename.endswith(".doc") or filename.endswith(".docx"):
            import io
            import docx
            doc = docx.Document(io.BytesIO(file_bytes))
            text = "\n".join([p.text for p in doc.paragraphs])
            prompt_with_text = prompt + f"\n\nDOCUMENT CONTENT:\n{text[:20000]}"
            result = call_gemini(prompt_with_text, json_mode=True, temperature=0.1)
        else:
            result = call_gemini_pdf(prompt, file_bytes, json_mode=True)
            
        data = json.loads(result)
        if isinstance(data, list):
            return data
        elif isinstance(data, dict) and "leads" in data:
            return data["leads"]
        return []
    except Exception as e:
        print(f"Error extracting leads from document via Gemini: {e}")
        return []

# ══════════════════════════════════════════════════════════════════
# EMAIL GENERATION FUNCTIONS
# ══════════════════════════════════════════════════════════════════

def generate_cold_email(
    resume_text: str, company_info: str, target_role: str,
    sender_name: str, github_url: str, portfolio_url: str, linkedin_url: str = "", tone: str = "Natural and conversational builder",
) -> EmailDraftResponse:
    """Generate an authentic, substantive, human cold outreach email (zero AI slop)."""
    sender_name = sender_name.strip() if sender_name else "[Your Name]"
    links = []
    if portfolio_url and portfolio_url.strip(): links.append(f"Portfolio: {portfolio_url.strip()}")
    if github_url and github_url.strip(): links.append(f"GitHub: {github_url.strip()}")
    if linkedin_url and linkedin_url.strip(): links.append(f"LinkedIn: {linkedin_url.strip()}")
    links_str = " | ".join(links)
    project_details = _load_project_details()

    prompt = f"""You are {sender_name}, a software engineer / builder reaching out directly to someone at {company_info or "the company"} about the {target_role or "AI Engineer"} role.

Write a genuine, substantive cold outreach email. It must sound like an authentic developer talking about what they actually built—NOT an automated marketing bot, NOT a lazy 2-sentence telegram, and NOT a corporate ChatGPT cover letter.

TARGET LENGTH & STRUCTURE:
- Length: 65 to 95 words total across 3 short, clean paragraphs (separated by literal double newlines \\n\\n).
- Paragraph 1 (1 sentence): Friendly, natural opening acknowledging the role at {company_info or "the team"}. (e.g. "Hi [Name]," followed by "Saw the {target_role or 'AI Engineer'} opening at {company_info or 'your team'} and wanted to drop a quick note.")
- Paragraph 2 (2-3 sentences): Grounded technical meat. Describe ONE real project from your background that proves you can build:
  * For GenAI / LLM / Agentic roles: Highlight building an academic project tracking platform with a 7-agent sequential LangGraph pipeline. Explain what it actually does (converts rough 2-line project ideas into full architecture blueprints, feasibility checks, and 12-week Gantt milestones), and mention your FastAPI backend, Pinecone RAG for document retrieval, and multi-model failover.
  * For ML / Data Science / Forecasting roles: Highlight building a time-series energy forecasting model using XGBoost and Optuna tuning (0.959 R²), containerized with Docker and served via a FastAPI REST endpoint with MLflow tracking.
  * Speak like a builder who wrote the code: mention what it actually does and how it was implemented.
- Paragraph 3 (1-2 sentences): Connect your experience to their work, mention that your CV is attached, and offer a low-friction next step (e.g. "Given your focus on [relevant area], thought this might be relevant. I've attached my resume, and I'd be glad to share the GitHub repo or a quick demo if you're interested.")

STRICT RULES:
1. GREETING:
   - If a person's first name is detected: "Hi [First Name],"
   - If only company name is known: "Hi {company_info} team," or "Hey team,"
   - NEVER use "Dear Hiring Manager," or "Dear Sir/Madam,".
2. ABSOLUTELY BANNED CORPORATE FLUFF & BOT TELEGRAPH PHRASES:
   - "I am writing to express my enthusiastic interest / apply..."
   - "I hope this email finds you well..."
   - "My name is ... and I am reaching out..."
   - "proven track record", "dynamic environment", "innovative team", "esteemed organization"
   - "leverage my skills", "valuable asset", "spearhead", "testament to", "robust", "state-of-the-art"
   - "available for an interview at your earliest convenience"
   - Do NOT write hollow, clipped bot sentences like "You scale complex AI platforms, matching a workflow I shipped."
3. PUNCTUATION:
   - Never use em-dashes (— or --) or semicolons (;). Use standard commas, periods, and question marks.
4. SIGN-OFF:
   - CRITICAL: DO NOT include ANY sign-off, signature, "Best,", "Best regards", or your name at the end of the body. The system appends it automatically. End the body strictly with the final punctuation mark of your last sentence.

Candidate Profile & Target:
- Sender Name: {sender_name}
- Target Role: {target_role if target_role else "AI Engineer"}
- Company / Context: {company_info if company_info else "the team"}
- Tone: {tone}

Return ONLY a JSON object:
- "hiring_manager_name": First name of recipient if detected, else "team"
- "company_name": "{company_info}"
- "subject": natural, lower-friction subject line (e.g. "quick note re: {target_role} at {company_info}")
- "body": the 3-paragraph email body text (DO NOT use HTML tags. Use literal \\n\\n for paragraph breaks).

RESUME & BACKGROUND:
{resume_text[:12000]}
{f"\nPROJECT DETAILS:\n{project_details}" if project_details else ""}"""

    result = call_gemini(prompt, json_mode=True, temperature=0.6)
    data = json.loads(result)
    
    # Programmatically sanitize and append the signature
    body = validate_email_body(data.get("body", "").strip(), sender_name)
    signature = f"\n\nBest,\n{sender_name}"
    if links_str:
        signature += f"\n{links_str}"
    
    data["body"] = body + signature
    return EmailDraftResponse(**data)


def generate_jd_email(
    resume_text: str, jd_text: str, job_title: str, company_name: str,
    sender_name: str, github_url: str, portfolio_url: str, linkedin_url: str = "", tone: str = "Natural and conversational builder",
) -> EmailDraftResponse:
    """Generate an authentic, substantive application email tailored to a job description (zero AI slop)."""
    sender_name = sender_name.strip() if sender_name else "[Your Name]"
    links = []
    if portfolio_url and portfolio_url.strip(): links.append(f"Portfolio: {portfolio_url.strip()}")
    if github_url and github_url.strip(): links.append(f"GitHub: {github_url.strip()}")
    if linkedin_url and linkedin_url.strip(): links.append(f"LinkedIn: {linkedin_url.strip()}")
    links_str = " | ".join(links)
    project_details = _load_project_details()

    prompt = f"""You are {sender_name}, an engineer/builder reaching out about the '{job_title}' opening at '{company_name}'.

Write a genuine, substantive outreach email tailored to this job description. It must sound like an authentic developer who actually read their requirements—NOT an automated marketing bot, NOT a lazy 2-sentence telegram, and NOT a corporate ChatGPT cover letter.

TARGET LENGTH & STRUCTURE:
- Length: 65 to 95 words total across 3 short, clean paragraphs (separated by literal double newlines \\n\\n).
- Paragraph 1 (1 sentence): Natural, friendly intro acknowledging the specific role at {company_name}. (e.g. "Hi [Name]," followed by "Saw the {job_title} opening at {company_name} and wanted to drop a quick note.")
- Paragraph 2 (2-3 sentences): Grounded technical alignment. Analyze the JD requirements (e.g., Python, LLMs, Agents, REST APIs, RAG, ML, Docker) and highlight YOUR actual matching work with concrete substance:
  * If the JD emphasizes AI/LLMs/Agents/RAG/Python: Highlight building your academic planning platform with a 7-agent sequential LangGraph pipeline. Explain what it does (converts rough 2-line ideas into complete architecture specs, feasibility analyses, and Gantt roadmaps) using FastAPI, Pinecone RAG for doc retrieval, and multi-model failover.
  * If the JD emphasizes ML/Data Science/Forecasting/Pipelines: Highlight your time-series energy forecasting project with XGBoost and Optuna tuning (0.959 R²), containerized with Docker and served via FastAPI with MLflow tracking.
  * Connect your real implementation choices directly to what the JD asks for.
- Paragraph 3 (1-2 sentences): Natural wrap-up mentioning that your CV is attached, and offering a low-friction next step (e.g. "Given your team's focus on [1 specific thing from JD], thought my hands-on experience might be relevant. I've attached my resume, and I'd be glad to share the repo or run through a quick demo if you're interested.")

STRICT RULES:
1. GREETING:
   - If recruiter/HR first name is visible in the JD: "Hi [First Name],"
   - If company name is known: "Hi {company_name} team," or "Hey team,"
   - NEVER use "Dear Hiring Manager," or "Dear Sir/Madam,".
2. ABSOLUTELY BANNED CORPORATE FLUFF & BOT TELEGRAPH PHRASES:
   - "I am writing to express my enthusiastic interest / apply..."
   - "I hope this email finds you well..."
   - "My background directly aligns with your requirements..."
   - "proven track record", "dynamic environment", "innovative team", "esteemed company"
   - "leverage my skills", "valuable asset", "spearhead", "testament to", "robust", "state-of-the-art"
   - "available for an interview at your earliest convenience"
   - Do NOT write hollow, clipped bot sentences like "You scale complex AI platforms, matching a workflow I shipped."
3. PUNCTUATION:
   - Never use em-dashes (— or --) or semicolons (;). Use standard commas, periods, and question marks.
4. SIGN-OFF:
   - CRITICAL: DO NOT include ANY sign-off, signature, "Best,", "Best regards", or your name at the end of the body. The system appends it automatically. End the body strictly with the final punctuation mark of your last sentence.

Candidate Profile & Target:
- Sender Name: {sender_name}
- Job Title: {job_title}
- Company: {company_name}
- Tone: {tone}

Return ONLY a JSON object:
- "hiring_manager_name": First name of recruiter/lead if detected in JD, else "team"
- "company_name": "{company_name}"
- "subject": natural, lower-friction subject line (e.g. "quick note re: {job_title} at {company_name}")
- "body": the 3-paragraph email body text (DO NOT use HTML tags. Use literal \\n\\n for paragraph breaks).

RESUME & BACKGROUND:
{resume_text[:12000]}

JOB DESCRIPTION:
{jd_text[:5000]}
{f"\nPROJECT DETAILS:\n{project_details}" if project_details else ""}"""

    result = call_gemini(prompt, json_mode=True, temperature=0.6)
    data = json.loads(result)
    
    # Programmatically sanitize and append the signature
    body = validate_email_body(data.get("body", "").strip(), sender_name)
    signature = f"\n\nBest,\n{sender_name}"
    if links_str:
        signature += f"\n{links_str}"
    
    data["body"] = body + signature
    return EmailDraftResponse(**data)


def rewrite_email(original_body: str, app_type: str, company: str, resume_text: str, new_angle: str, sender_name: str = "", github_url: str = "", portfolio_url: str = "", linkedin_url: str = "") -> str:
    """Rewrite email with a substantive, authentic builder angle (zero AI slop)."""
    sender_name = sender_name.strip() if sender_name else "[Your Name]"
    links = []
    if portfolio_url and portfolio_url.strip(): links.append(f"Portfolio: {portfolio_url.strip()}")
    if github_url and github_url.strip(): links.append(f"GitHub: {github_url.strip()}")
    if linkedin_url and linkedin_url.strip(): links.append(f"LinkedIn: {linkedin_url.strip()}")
    links_str = " | ".join(links)
    project_details = _load_project_details()
    
    if new_angle:
        angle_instruction = f"The user requested this specific focus/angle: '{new_angle}'. Ensure this is prominently highlighted."
    else:
        angle_instruction = "Make it sound like an authentic builder sharing concrete implementation details."

    prompt = f"""You are {sender_name}. Rewrite this outreach email to {company}.
Angle: {angle_instruction}

TARGET LENGTH & STRUCTURE:
- Length: 65 to 95 words total across 3 short, clean paragraphs (separated by literal double newlines \\n\\n).
- Paragraph 1 (1 sentence): Natural intro acknowledging the role and team at {company}.
- Paragraph 2 (2-3 sentences): Grounded technical meat. Describe real implementation details (e.g. LangGraph 7-agent pipeline with Pinecone RAG and FastAPI, or XGBoost time-series forecasting at 0.959 R²). Explain what it actually does and how you built it.
- Paragraph 3 (1-2 sentences): Mention your CV is attached, and offer a low-friction next step (GitHub repo link or a quick demo walkthrough).

STRICT RULES:
- Never use em-dashes (— or --) or semicolons (;). Use standard commas, periods, and question marks.
- BANNED: "wanted to reach out", "I hope this email finds you well", "proven track record", "dynamic environment", "leverage my skills", "valuable asset", "esteemed company", "available for an interview at your earliest convenience".
- Do NOT write hollow, clipped 2-sentence telegrams. Give real technical substance.
- Start with "Hi [Name]," or "Hi {company} team," (NEVER "Dear Hiring Manager,").
- CRITICAL: DO NOT include ANY sign-off, signature, "Best,", "Best regards", your name, or links at the end. The system appends it automatically. End strictly with the final sentence's punctuation.

Resume Context:
{resume_text[:12000]}
{f"\nProject Details:\n{project_details}" if project_details else ""}

Original Email:
{original_body}

Return ONLY the rewritten email body text. No subject line. No explanations."""

    result_body = call_gemini(prompt, json_mode=False, temperature=0.6).strip()
    result_body = validate_email_body(result_body, sender_name)

    if sender_name:
        signature = f"\n\nBest,\n{sender_name}"
        if links_str:
            signature += f"\n{links_str}"
    elif links_str:
        signature = f"\n\n{links_str}"
    else:
        signature = ""

    return result_body + signature


def generate_follow_up(
    original_body: str, company: str, hr_name: str,
    app_type: str = "Cold Email", role: str = "",
    sender_name: str = "", github_url: str = "", portfolio_url: str = "", linkedin_url: str = ""
) -> str:
    """Generate a quick, polite, natural follow-up email differentiated by outreach type."""
    sender_name = sender_name.strip() if sender_name else "[Your Name]"
    links = []
    if portfolio_url and portfolio_url.strip(): links.append(f"Portfolio: {portfolio_url.strip()}")
    if github_url and github_url.strip(): links.append(f"GitHub: {github_url.strip()}")
    if linkedin_url and linkedin_url.strip(): links.append(f"LinkedIn: {linkedin_url.strip()}")
    links_str = " | ".join(links)

    clean_hr = hr_name.strip() if hr_name and hr_name.lower() not in ["hiring manager", "unknown", "none", "team"] else ""
    greeting = f"Hi {clean_hr}," if clean_hr else (f"Hi {company} team," if company else "Hi there,")

    if app_type == "Cold Email":
        prompt = f"""Write a short, humble, highly human 2-sentence cold outreach bump.
Context: I ({sender_name}) previously cold-emailed {clean_hr or company} about engineering work.
My original email: {original_body[:500]}

STRICT RULES FOR COLD OUTREACH BUMPS:
- NEVER say "following up on my previous email", "per my email", "did you get a chance to see", "touching base", or "circling back".
- NEVER mention "application" or "applying" (this was cold outreach, not a formal job board application).
- Total length: strictly 20-35 words (2 short sentences).
- Start with "{greeting}"
- Acknowledge their busy inbox with empathy and give them a zero-pressure out:
  (e.g., "Quick bump in case this got buried, know your inbox is super busy. No worries if you're not looking right now, but happy to share a quick 2-min demo if you're curious.")
- NEVER use em-dashes (— or --) or semicolons (;).
- CRITICAL: DO NOT include ANY sign-off, signature, "Best", "Best regards", your name, or any links/URLs at the end. The system appends it automatically. End strictly with the final sentence's punctuation.

Return ONLY the follow-up body text."""
    else:
        prompt = f"""Write a short, polite, highly human 2-sentence application status check.
Context: I ({sender_name}) previously applied for the {role or 'engineering'} role at {company}.
My original email: {original_body[:500]}

STRICT RULES FOR APPLICATION CHECK-INS:
- Start with "{greeting}"
- Keep it natural, polite, and brief (25-35 words max).
- Check in on the open role with zero entitlement:
  (e.g., "Quick check-in on the {role or 'engineering'} role at {company}. Just wanted to see if the team is still reviewing profiles. Happy to share a quick demo of my recent projects if helpful.")
- NEVER use em-dashes (— or --) or semicolons (;).
- NEVER use "I hope this email finds you well" or "In reference to my previous correspondence".
- CRITICAL: DO NOT include ANY sign-off, signature, "Best", "Best regards", your name, or any links/URLs at the end. The system appends it automatically. End strictly with the final sentence's punctuation.

Return ONLY the follow-up body text."""

    result_body = call_gemini(prompt, json_mode=False, temperature=0.7).strip()
    result_body = validate_email_body(result_body, sender_name)

    if sender_name:
        signature = f"\n\nBest,\n{sender_name}"
        if links_str:
            signature += f"\n{links_str}"
    elif links_str:
        signature = f"\n\n{links_str}"
    else:
        signature = ""

    return result_body + signature


def generate_hr_reply(hr_message: str, user_instructions: str, previous_email_body: str, company: str, resume_text: str, sender_name: str = "", github_url: str = "", portfolio_url: str = "", linkedin_url: str = "") -> str:
    """Generate a clear, natural reply to an HR's email."""
    sender_name = sender_name.strip() if sender_name else "[Your Name]"
    links = []
    if portfolio_url and portfolio_url.strip(): links.append(f"Portfolio: {portfolio_url.strip()}")
    if github_url and github_url.strip(): links.append(f"GitHub: {github_url.strip()}")
    if linkedin_url and linkedin_url.strip(): links.append(f"LinkedIn: {linkedin_url.strip()}")
    links_str = " | ".join(links)

    prompt = f"""Write a clear, direct, and conversational email reply to a Hiring Manager / HR at {company}.
Sound like a capable, thoughtful human engineer answering their questions directly.

My Previous Email:
{previous_email_body[:2000]}

HR's Email:
{hr_message[:3000]}

My Quick Instructions / Answers for the Reply:
{user_instructions}

My Resume Context (for any additional info if needed):
{resume_text[:12000]}

Task: Draft the email reply body answering their message directly using my instructions. Keep it natural, direct, and concise. Avoid stiff corporate formulas.
DO NOT use HTML tags like <br>. Use literal newline characters for spacing.
NEVER use em-dashes (—) or semicolons (;).
CRITICAL: DO NOT include ANY sign-off, signature, "Best", "Best regards", your name, or any links/URLs at the end. The system appends it automatically. End the email body strictly with the final sentence's punctuation."""
    
    result_body = call_gemini(prompt, json_mode=False, temperature=0.4).strip()
    result_body = validate_email_body(result_body, sender_name)

    if sender_name:
        signature = f"\n\nBest,\n{sender_name}"
        if links_str:
            signature += f"\n{links_str}"
    elif links_str:
        signature = f"\n\n{links_str}"
    else:
        signature = ""

    return result_body + signature


def validate_email_body(body: str, sender_name: str = "") -> str:
    """Post-generation validation: strip placeholders, HTML tags, duplicate signatures, AI clichés, and sanitize greetings."""
    import re as _re

    # Strip leaked HTML tags
    body = _re.sub(r'<br\s*/?>', '\n', body)
    body = _re.sub(r'</?(?:p|div|span|b|i|u|strong|em)[^>]*>', '', body)

    # Convert stiff/robotic greetings if they slip through
    body = _re.sub(r'(?i)^\s*dear\s+hiring\s+manager\s*,?', 'Hi team,', body)
    body = _re.sub(r'(?i)^\s*dear\s+sir\s*/?\s*madam\s*,?', 'Hi team,', body)
    body = _re.sub(r'(?i)^\s*dear\s+([A-Z][a-z]+)\s*,?', r'Hi \1,', body)
    body = _re.sub(r'(?i)^\s*to\s+whom\s+it\s+may\s+concern\s*,?', 'Hi team,', body)

    # Strip classic AI opening fluff sentences cleanly
    body = _re.sub(r'(?i)\bI\s+hope\s+this\s+(?:email\s+)?finds\s+you\s+well[.,!\s]*', '', body)
    body = _re.sub(r'(?i)\bI\s+am\s+writing\s+to\s+(?:express\s+my\s+(?:enthusiastic\s+)?interest\s+in|apply\s+for)[^.,\n]*[.,\n]*', '', body)

    # Clean up corporate buzzwords without breaking sentence syntax
    ai_phrase_replacements = [
        (r'(?i)\bproven\s+track\s+record\b', 'hands-on experience'),
        (r'(?i)\bdynamic\s+environment\b', 'fast-paced team'),
        (r'(?i)\besteemed\s+(?:company|organization)\b', 'team'),
        (r'(?i)\bleverage\s+my\s+skills\b', 'apply my experience'),
        (r'(?i)\bvaluable\s+asset\b', 'solid contributor'),
        (r'(?i)\bat\s+your\s+earliest\s+convenience\b', 'whenever you have a moment'),
    ]
    for pattern, replacement in ai_phrase_replacements:
        body = _re.sub(pattern, replacement, body)

    # Convert AI em-dashes and semicolons to clean human punctuation
    body = body.replace(' — ', ' - ').replace('—', ' - ').replace(' – ', ' - ').replace('–', ' - ')
    body = body.replace(' ; ', '. ').replace(';', ',')

    # Replace common leftover placeholders
    placeholders = ['[Your Name]', '[your name]', '[HR Name]', '[Hiring Manager Name]',
                    '[Company Name]', '[Your Email]', '[Your Phone]', '[Hiring Manager]']
    for ph in placeholders:
        if ph.lower() == '[your name]' and sender_name:
            body = body.replace(ph, sender_name)
            body = body.replace(ph.title(), sender_name)
        else:
            body = body.replace(ph, '')

    # Remove duplicate signature blocks (keep only the last one)
    parts = _re.split(r'(?i)\n\n\s*(?:best\s+regards|best|warm\s+regards|sincerely)\s*,?\s*\n', body)
    if len(parts) > 2:
        body = parts[0] + '\n\nBest,\n' + parts[-1]

    # Clean up excessive blank lines (3+ newlines -> 2)
    body = _re.sub(r'\n{3,}', '\n\n', body)

    # Clean up double periods or leading whitespace on lines
    body = _re.sub(r'\.{2,}', '.', body)
    body = _re.sub(r'^[ \t]+', '', body, flags=_re.MULTILINE)

    return body.strip()
