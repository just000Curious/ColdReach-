"""
ColdReach Backend — FastAPI REST API
=====================================
Thin wrapper around existing services.
Zero changes to db.py, llm_drafter.py, mailer.py, resume_parser.py.
"""

import os
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional
import requests

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Ensure .env is loaded ──
from dotenv import load_dotenv, set_key

_SERVER_DIR = Path(__file__).resolve().parent
_ENV_PATH = _SERVER_DIR / ".env"
if _ENV_PATH.exists():
    load_dotenv(_ENV_PATH, override=True)
load_dotenv(override=True)

# ── Import existing services (unchanged) ──
from services.db import (
    get_applications, add_application, update_application, delete_application,
    save_resume_to_disk, load_resume_from_disk,
    is_valid_email, is_duplicate, bulk_delete_by_status, get_token_usage
)
from services.resume_parser import parse_resume
from services.llm_drafter import (
    generate_cold_email, generate_jd_email, extract_from_jd, extract_from_poster,
    rewrite_email, generate_follow_up, extract_leads, generate_hr_reply
)
from services.mailer import send_email


# ── FastAPI App ──
app = FastAPI(title="ColdReach API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════════════════════════════════════════════════════════════
# REQUEST / RESPONSE MODELS
# ══════════════════════════════════════════════════════════════════

class ProfileData(BaseModel):
    name: str = ""
    github: str = ""
    portfolio: str = ""
    linkedin: str = ""

class ColdMailRequest(BaseModel):
    resume_text: str
    company_info: str = ""
    target_role: str = ""
    sender_name: str
    github_url: str = ""
    portfolio_url: str = ""
    linkedin_url: str = ""
    tone: str = "Professional and direct"

class JDRequest(BaseModel):
    resume_text: str
    jd_text: str
    sender_name: str
    github_url: str = ""
    portfolio_url: str = ""
    linkedin_url: str = ""
    override_email: str = ""
    override_title: str = ""
    tone: str = "Professional and direct"

class PosterRequest(BaseModel):
    resume_text: str
    sender_name: str
    github_url: str = ""
    portfolio_url: str = ""
    linkedin_url: str = ""
    override_email: str = ""
    override_title: str = ""
    tone: str = "Professional and direct"

class FollowUpRequest(BaseModel):
    original_body: str
    company: str
    hr_name: str = "Hiring Manager"
    sender_name: str = ""
    github_url: str = ""
    portfolio_url: str = ""
    linkedin_url: str = ""

class RewriteRequest(BaseModel):
    original_body: str
    app_type: str
    company: str = ""
    resume_text: str = ""
    new_angle: str = ""
    sender_name: str = ""
    github_url: str = ""
    portfolio_url: str = ""
    linkedin_url: str = ""

class ReplyRequest(BaseModel):
    hr_message: str
    user_instructions: str
    previous_email_body: str
    company: str
    resume_text: str = ""
    sender_name: str = ""
    github_url: str = ""
    portfolio_url: str = ""
    linkedin_url: str = ""

class SendEmailRequest(BaseModel):
    to_email: str
    subject: str
    body: str
    attach_resume: bool = True

class UpdateAppRequest(BaseModel):
    email: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    status: Optional[str] = None
    sent_at: Optional[str] = None
    follow_up_count: Optional[int] = None
    follow_up_sent_at: Optional[str] = None


# ══════════════════════════════════════════════════════════════════
# PROFILE ENDPOINTS
# ══════════════════════════════════════════════════════════════════

from services.db import load_profiles_data, save_profiles_data, get_active_profile

@app.get("/api/profiles")
def get_profiles_data():
    return load_profiles_data()

@app.put("/api/profiles")
def put_profiles_data(data: dict):
    save_profiles_data(data)
    return {"ok": True}

@app.get("/api/profile/active")
def get_active_profile_endpoint():
    return get_active_profile()


# ══════════════════════════════════════════════════════════════════
# JOB SEARCH ENDPOINTS
# ══════════════════════════════════════════════════════════════════

# Add parent directory to path to import scraper
import sys
_ROOT_DIR = _SERVER_DIR.parent
if str(_ROOT_DIR) not in sys.path:
    sys.path.append(str(_ROOT_DIR))

try:
    from scraper import fetch_jobs_adzuna, get_sample_jobs, is_adzuna_configured
except ImportError:
    pass

from services.job_scorer import score_job
from services.resume_parser import parse_resume

class JobSearchRequest(BaseModel):
    query: str = ""
    location: str = ""
    country: str = "India"
    results_per_page: int = 15

@app.post("/api/jobs/search")
def search_jobs(req: JobSearchRequest):
    try:
        # 1. Fetch raw jobs
        if is_adzuna_configured():
            jobs = fetch_jobs_adzuna(
                query=req.query,
                location=req.location,
                country=req.country,
                results_per_page=req.results_per_page
            )
            source = "Adzuna API"
        else:
            jobs = get_sample_jobs()
            if req.query:
                q = req.query.lower()
                jobs = [j for j in jobs if q in j["title"].lower() or q in j["description"].lower()]
            if req.location:
                l = req.location.lower()
                jobs = [j for j in jobs if l in j["location"].lower()]
            jobs = jobs[:req.results_per_page]
            source = "Sample Data"

        # 2. Score jobs if resume exists
        resume_bytes = load_resume_from_disk()
        if resume_bytes and jobs:
            try:
                resume_text = parse_resume(resume_bytes)
                for job in jobs:
                    score_data = score_job(resume_text, job)
                    job.update(score_data)
                
                # Sort jobs by match_score descending
                jobs.sort(key=lambda x: x.get("match_score", 0), reverse=True)
            except Exception as e:
                print("Failed to score jobs:", e)
        
        return {"source": source, "jobs": jobs}
    except Exception as e:
        raise HTTPException(500, str(e))


# ══════════════════════════════════════════════════════════════════
# RESUME ENDPOINTS
# ══════════════════════════════════════════════════════════════════

@app.get("/api/resume/status")
def resume_status():
    data = load_resume_from_disk()
    if data:
        text = ""
        try:
            text = parse_resume(data)
        except Exception:
            pass
        return {"exists": True, "text": text, "size": len(data)}
    return {"exists": False, "text": "", "size": 0}

@app.post("/api/resume")
async def upload_resume(file: UploadFile = File(...)):
    name = file.filename.lower()
    if not (name.endswith(".pdf") or name.endswith(".docx") or name.endswith(".doc")):
        raise HTTPException(400, "Only PDF and Word documents (.pdf, .docx, .doc) are accepted.")
    file_bytes = await file.read()
    try:
        text = parse_resume(file_bytes, filename=name)
        if not text.strip():
            raise HTTPException(400, "Could not extract text from document.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Error parsing document: {e}")
    save_resume_to_disk(file_bytes)
    return {"ok": True, "text": text, "size": len(file_bytes)}


# ══════════════════════════════════════════════════════════════════
# HR LEADS AUTO-MAILER ENDPOINT
# ══════════════════════════════════════════════════════════════════

@app.post("/api/leads/parse_document")
async def parse_leads_document(file: UploadFile = File(...)):
    name = file.filename.lower()
    if not (name.endswith(".pdf") or name.endswith(".doc") or name.endswith(".docx")):
        raise HTTPException(400, "Only PDF or Word documents are accepted.")
    file_bytes = await file.read()
    try:
        leads = extract_leads(file_bytes, name)
        if not leads:
            raise HTTPException(400, "Could not extract any leads from this document. Please ensure it contains readable job data.")
        return {"ok": True, "leads": leads}
    except Exception as e:
        raise HTTPException(500, f"Error parsing leads document: {str(e)}")

# ══════════════════════════════════════════════════════════════════
# APPLICATIONS CRUD
# ══════════════════════════════════════════════════════════════════

@app.get("/api/applications")
def list_applications():
    return get_applications()

@app.patch("/api/applications/{app_id}")
def patch_application(app_id: str, data: UpdateAppRequest):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields to update.")
    update_application(app_id, updates)
    return {"ok": True}

@app.delete("/api/applications/{app_id}")
def remove_application(app_id: str):
    delete_application(app_id)
    return {"ok": True}

@app.delete("/api/applications/bulk/{status}")
def bulk_remove(status: str):
    count = bulk_delete_by_status(status)
    return {"ok": True, "deleted": count}


# ══════════════════════════════════════════════════════════════════
# GENERATION ENDPOINTS
# ══════════════════════════════════════════════════════════════════

@app.post("/api/generate/cold")
def gen_cold(req: ColdMailRequest):
    try:
        draft = generate_cold_email(
            resume_text=req.resume_text,
            company_info=req.company_info,
            target_role=req.target_role,
            sender_name=req.sender_name,
            github_url=req.github_url,
            portfolio_url=req.portfolio_url,
            linkedin_url=req.linkedin_url,
            tone=req.tone,
        )
        return {
            "hiring_manager_name": draft.hiring_manager_name,
            "company_name": draft.company_name,
            "subject": draft.subject,
            "body": draft.body,
        }
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/generate/jd")
def gen_jd(req: JDRequest):
    try:
        # Step 1: Extract info from JD
        info = extract_from_jd(req.jd_text)
        extracted_email = req.override_email or info.email
        extracted_title = req.override_title or info.job_title
        extracted_company = info.company_name

        # Step 2: Generate email
        draft = generate_jd_email(
            resume_text=req.resume_text,
            jd_text=req.jd_text,
            job_title=extracted_title,
            company_name=extracted_company,
            sender_name=req.sender_name,
            github_url=req.github_url,
            portfolio_url=req.portfolio_url,
            linkedin_url=req.linkedin_url,
            tone=req.tone,
        )
        return {
            "extracted_email": extracted_email,
            "extracted_title": extracted_title,
            "extracted_company": extracted_company,
            "hiring_manager_name": draft.hiring_manager_name,
            "company_name": draft.company_name,
            "subject": draft.subject,
            "body": draft.body,
        }
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/generate/poster")
async def gen_poster(
    file: UploadFile = File(...),
    resume_text: str = Form(""),
    sender_name: str = Form(""),
    github_url: str = Form(""),
    portfolio_url: str = Form(""),
    linkedin_url: str = Form(""),
    override_email: str = Form(""),
    override_title: str = Form(""),
    tone: str = Form("Professional and direct"),
):
    try:
        img_bytes = await file.read()

        # Step 1: Extract from image
        info = extract_from_poster(img_bytes)
        extracted_email = override_email or info.email
        extracted_title = override_title or info.job_title
        extracted_company = info.company_name
        extracted_jd = info.job_description

        # Step 2: Generate email
        draft = generate_jd_email(
            resume_text=resume_text,
            jd_text=extracted_jd or f"Job: {extracted_title} at {extracted_company}",
            job_title=extracted_title,
            company_name=extracted_company,
            sender_name=sender_name,
            github_url=github_url,
            portfolio_url=portfolio_url,
            linkedin_url=linkedin_url,
            tone=tone,
        )
        return {
            "extracted_email": extracted_email,
            "extracted_title": extracted_title,
            "extracted_company": extracted_company,
            "extracted_jd": extracted_jd,
            "hiring_manager_name": draft.hiring_manager_name,
            "company_name": draft.company_name,
            "subject": draft.subject,
            "body": draft.body,
        }
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/generate/followup")
def gen_followup(req: FollowUpRequest):
    try:
        text = generate_follow_up(
            req.original_body, req.company, req.hr_name,
            req.sender_name, req.github_url, req.portfolio_url, req.linkedin_url
        )
        return {"body": text}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/generate/rewrite")
def gen_rewrite(req: RewriteRequest):
    try:
        text = rewrite_email(
            original_body=req.original_body,
            app_type=req.app_type,
            company=req.company,
            resume_text=req.resume_text,
            new_angle=req.new_angle,
            sender_name=req.sender_name,
            github_url=req.github_url,
            portfolio_url=req.portfolio_url,
            linkedin_url=req.linkedin_url
        )
        return {"body": text}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/api/generate/reply")
def gen_reply(req: ReplyRequest):
    try:
        text = generate_hr_reply(
            hr_message=req.hr_message,
            user_instructions=req.user_instructions,
            previous_email_body=req.previous_email_body,
            company=req.company,
            resume_text=req.resume_text,
            sender_name=req.sender_name,
            github_url=req.github_url,
            portfolio_url=req.portfolio_url,
            linkedin_url=req.linkedin_url
        )
        return {"body": text}
    except Exception as e:
        raise HTTPException(500, str(e))

# ══════════════════════════════════════════════════════════════════
# SEND EMAIL
# ══════════════════════════════════════════════════════════════════

@app.post("/api/send")
def send(req: SendEmailRequest):
    if not is_valid_email(req.to_email):
        raise HTTPException(400, f"Invalid email format: '{req.to_email}'. Please edit the email address before sending.")
        
    pdf_bytes = None
    if req.attach_resume:
        pdf_bytes = load_resume_from_disk()

    try:
        send_email(req.to_email, req.subject, req.body, pdf_bytes)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, str(e))


# ══════════════════════════════════════════════════════════════════
# SYSTEM STATUS
# ══════════════════════════════════════════════════════════════════

@app.get("/api/status")
def system_status():
    used = get_token_usage()
    limit = int(os.environ.get("TOKEN_DAILY_LIMIT", 1000000)) # Gemini free tier: 250K TPM, 1500 RPD
    raw_key = os.environ.get("GEMINI_API_KEY", "").strip('" ')
    masked_key = ""
    if raw_key:
        masked_key = raw_key[:4] + "..." + raw_key[-4:] if len(raw_key) > 8 else "***"

    return {
        "gemini_api": bool(raw_key),
        "masked_gemini_key": masked_key,
        "email_configured": bool(
            os.environ.get("EMAIL_SENDER_ADDRESS", "").strip('" ')
            and os.environ.get("EMAIL_APP_PASSWORD", "").strip('" ')
        ),
        "email_address": os.environ.get("EMAIL_SENDER_ADDRESS", "").strip('" '),
        "resume_exists": load_resume_from_disk() is not None,
        "total_tokens": used,
        "tokens_left": max(0, limit - used),
        "token_limit": limit
    }


# ══════════════════════════════════════════════════════════════════
# SETTINGS / GEMINI KEY CONFIGURATION
# ══════════════════════════════════════════════════════════════════

class GeminiKeyRequest(BaseModel):
    api_key: str

@app.post("/api/settings/gemini")
def update_gemini_key(req: GeminiKeyRequest):
    key = req.api_key.strip('" \r\n\t')
    if not key:
        raise HTTPException(400, "API key cannot be empty.")

    # Probe Google Generative Language API to verify key and rate limits
    try:
        res = requests.get(
            f"https://generativelanguage.googleapis.com/v1beta/models?key={key}",
            timeout=10
        )
        if res.status_code == 400:
            raise HTTPException(400, "Invalid Gemini API key. Please check your key from Google AI Studio.")
        elif res.status_code == 403:
            raise HTTPException(400, "Gemini API key is forbidden or lacks required permissions.")
        elif res.status_code == 429:
            raise HTTPException(400, "This Gemini API key has exceeded its rate quota. Please try another key.")
        elif res.status_code != 200:
            raise HTTPException(400, f"Gemini API returned status {res.status_code}: {res.text[:150]}")
    except HTTPException:
        raise
    except requests.exceptions.RequestException as e:
        raise HTTPException(500, f"Failed to connect to Google API to verify key: {str(e)}")

    # Update runtime memory immediately (takes effect instantly)
    os.environ["GEMINI_API_KEY"] = key

    # Persist to .env files so it survives restarts
    try:
        if _ENV_PATH.exists():
            set_key(str(_ENV_PATH), "GEMINI_API_KEY", key, quote_mode="always")
        root_env = _SERVER_DIR.parent / ".env"
        if root_env.exists():
            set_key(str(root_env), "GEMINI_API_KEY", key, quote_mode="always")
    except Exception as e:
        print("Warning: failed to persist to .env:", e)

    masked = key[:4] + "..." + key[-4:] if len(key) > 8 else "***"
    return {
        "ok": True,
        "message": "Gemini API key verified and updated successfully!",
        "masked_key": masked
    }


# ══════════════════════════════════════════════════════════════════
# ADD APPLICATION (used after generation)
# ══════════════════════════════════════════════════════════════════

class AddAppRequest(BaseModel):
    app_type: str
    company: str
    role: str
    email: str
    subject: str
    body: str

@app.post("/api/applications")
def create_application(req: AddAppRequest):
    if req.email and is_duplicate(req.email, req.role):
        raise HTTPException(409, f"A Draft or Sent application already exists for '{req.role}' at '{req.email}'. Check the Dashboard.")
    app_id = add_application(
        app_type=req.app_type,
        company=req.company,
        role=req.role,
        email=req.email,
        subject=req.subject,
        body=req.body,
    )
    return {"ok": True, "id": app_id}


# ══════════════════════════════════════════════════════════════════
# CSV EXPORT
# ══════════════════════════════════════════════════════════════════

from fastapi.responses import StreamingResponse
import csv
import io

@app.get("/api/applications/export")
def export_applications_csv():
    apps = get_applications()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Role", "Company", "Email", "Type", "Status", "Created", "Sent", "Follow-ups"])
    for a in apps:
        writer.writerow([
            a.get("role", ""),
            a.get("company", ""),
            a.get("email", ""),
            a.get("type", ""),
            a.get("status", ""),
            (a.get("created_at") or "")[:10],
            (a.get("sent_at") or "")[:10],
            a.get("follow_up_count", 0),
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=coldreach_applications.csv"},
    )
