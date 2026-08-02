"""
ColdReach — Job Application Email Tool
========================================
3 modes: Cold Mail | From JD | From Poster
Setup once → Use forever → Send in 3 clicks
Built by Abhishek
"""

import streamlit as st
import os
from datetime import datetime, timedelta
from pathlib import Path

from dotenv import load_dotenv

_APP_DIR = Path(__file__).resolve().parent
_ENV_PATH = _APP_DIR.parent / ".env"
if _ENV_PATH.exists():
    load_dotenv(_ENV_PATH, override=True)
load_dotenv(override=True)

from services.db import (
    get_applications, add_application, update_application, delete_application,
    load_profile, save_profile, save_resume_to_disk, load_resume_from_disk,
    is_valid_email, is_duplicate, bulk_delete_by_status,
)
from services.resume_parser import parse_resume
from services.llm_drafter import (
    generate_cold_email, generate_jd_email, extract_from_jd, extract_from_poster,
    rewrite_email, generate_follow_up,
)
from services.mailer import send_email

# ── Page Config ──
st.set_page_config(page_title="ColdReach", page_icon="🚀", layout="wide")

# ══════════════════════════════════════════════════════════════════
# CUSTOM CSS — ColdReach Design System
# ══════════════════════════════════════════════════════════════════
st.markdown("""
<style>
    /* ── Google Fonts ── */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

    /* ── Root Variables ── */
    :root {
        --blue-primary: #2563EB;
        --blue-hover: #1D4ED8;
        --blue-light: #EFF6FF;
        --blue-50: #DBEAFE;
        --grey-50: #F9FAFB;
        --grey-100: #F3F4F6;
        --grey-200: #E5E7EB;
        --grey-300: #D1D5DB;
        --grey-500: #6B7280;
        --grey-700: #374151;
        --grey-900: #111827;
        --green-500: #10B981;
        --green-50: #ECFDF5;
        --red-500: #EF4444;
        --red-50: #FEF2F2;
        --amber-500: #F59E0B;
        --amber-50: #FFFBEB;
        --purple-500: #7C3AED;
        --radius: 12px;
        --shadow-sm: 0 1px 2px 0 rgba(0,0,0,0.05);
        --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05);
        --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04);
    }

    /* ── Global Font ── */
    html, body, [class*="st-"] {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
    }

    /* ── Main background ── */
    .stApp {
        background: linear-gradient(180deg, var(--grey-50) 0%, #FFFFFF 50%) !important;
    }

    /* ── Sidebar Styling ── */
    section[data-testid="stSidebar"] {
        background: #FFFFFF !important;
        border-right: 1px solid var(--grey-200) !important;
    }
    section[data-testid="stSidebar"] .stMarkdown h2 {
        color: var(--grey-900) !important;
        font-weight: 600 !important;
        font-size: 0.95rem !important;
        letter-spacing: -0.01em;
    }

    /* ── Primary Buttons ── */
    .stButton > button[kind="primary"],
    .stButton > button[data-testid="stBaseButton-primary"] {
        background: var(--blue-primary) !important;
        color: white !important;
        border: none !important;
        border-radius: 8px !important;
        font-weight: 500 !important;
        font-size: 0.85rem !important;
        padding: 0.5rem 1.2rem !important;
        transition: all 0.2s ease !important;
        box-shadow: var(--shadow-sm) !important;
    }
    .stButton > button[kind="primary"]:hover,
    .stButton > button[data-testid="stBaseButton-primary"]:hover {
        background: var(--blue-hover) !important;
        box-shadow: var(--shadow-md) !important;
        transform: translateY(-1px) !important;
    }

    /* ── Secondary Buttons ── */
    .stButton > button[kind="secondary"],
    .stButton > button:not([kind="primary"]):not([data-testid="stBaseButton-primary"]) {
        background: white !important;
        color: var(--grey-700) !important;
        border: 1px solid var(--grey-200) !important;
        border-radius: 8px !important;
        font-weight: 500 !important;
        font-size: 0.82rem !important;
        padding: 0.45rem 1rem !important;
        transition: all 0.2s ease !important;
    }
    .stButton > button[kind="secondary"]:hover,
    .stButton > button:not([kind="primary"]):not([data-testid="stBaseButton-primary"]):hover {
        background: var(--grey-50) !important;
        border-color: var(--blue-primary) !important;
        color: var(--blue-primary) !important;
    }

    /* ── Text Inputs ── */
    .stTextInput input, .stTextArea textarea {
        border: 1px solid var(--grey-200) !important;
        border-radius: 8px !important;
        font-size: 0.88rem !important;
        padding: 0.6rem 0.8rem !important;
        transition: border-color 0.2s ease, box-shadow 0.2s ease !important;
    }
    .stTextInput input:focus, .stTextArea textarea:focus {
        border-color: var(--blue-primary) !important;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1) !important;
    }

    /* ── Tabs ── */
    .stTabs [data-baseweb="tab-list"] {
        gap: 0px;
        background: white;
        border-radius: 10px;
        padding: 4px;
        border: 1px solid var(--grey-200);
        box-shadow: var(--shadow-sm);
    }
    .stTabs [data-baseweb="tab"] {
        border-radius: 8px !important;
        padding: 8px 20px !important;
        font-weight: 500 !important;
        font-size: 0.85rem !important;
        color: var(--grey-500) !important;
        transition: all 0.2s ease !important;
    }
    .stTabs [aria-selected="true"] {
        background: var(--blue-primary) !important;
        color: white !important;
        box-shadow: var(--shadow-sm) !important;
    }
    .stTabs [data-baseweb="tab-highlight"] {
        display: none !important;
    }
    .stTabs [data-baseweb="tab-border"] {
        display: none !important;
    }

    /* ── Metrics ── */
    [data-testid="stMetric"] {
        background: white !important;
        border: 1px solid var(--grey-200) !important;
        border-radius: var(--radius) !important;
        padding: 16px 20px !important;
        box-shadow: var(--shadow-sm) !important;
    }
    [data-testid="stMetricLabel"] {
        color: var(--grey-500) !important;
        font-size: 0.78rem !important;
        font-weight: 500 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.05em !important;
    }
    [data-testid="stMetricValue"] {
        color: var(--grey-900) !important;
        font-weight: 700 !important;
        font-size: 1.5rem !important;
    }

    /* ── Expander (Application Cards) ── */
    .streamlit-expanderHeader {
        background: white !important;
        border: 1px solid var(--grey-200) !important;
        border-radius: var(--radius) !important;
        font-weight: 500 !important;
        font-size: 0.88rem !important;
        padding: 12px 16px !important;
        transition: all 0.2s ease !important;
    }
    .streamlit-expanderHeader:hover {
        border-color: var(--blue-primary) !important;
        box-shadow: var(--shadow-sm) !important;
    }
    .streamlit-expanderContent {
        border: 1px solid var(--grey-200) !important;
        border-top: none !important;
        border-radius: 0 0 var(--radius) var(--radius) !important;
        background: white !important;
    }

    /* ── Alerts ── */
    .stAlert {
        border-radius: 8px !important;
        font-size: 0.85rem !important;
    }

    /* ── Dividers ── */
    hr {
        border-color: var(--grey-100) !important;
    }

    /* ── File Uploader ── */
    [data-testid="stFileUploader"] {
        border-radius: 8px !important;
    }

    /* ── Success Callout ── */
    .stSuccess {
        background: var(--green-50) !important;
        border-left: 4px solid var(--green-500) !important;
    }

    /* ── Brand Header ── */
    .brand-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 4px 0 16px 0;
    }
    .brand-header .brand-icon {
        width: 40px;
        height: 40px;
        background: var(--blue-primary);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        color: white;
        box-shadow: var(--shadow-md);
    }
    .brand-header .brand-text {
        font-size: 1.6rem;
        font-weight: 700;
        color: var(--grey-900);
        letter-spacing: -0.03em;
    }
    .brand-header .brand-sub {
        font-size: 0.82rem;
        color: var(--grey-500);
        font-weight: 400;
    }

    /* ── Kanban Column Headers ── */
    .kanban-col-header {
        font-size: 0.78rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        padding: 8px 12px;
        border-radius: 8px;
        margin-bottom: 8px;
        text-align: center;
    }
    .kanban-draft { background: var(--blue-50); color: var(--blue-primary); }
    .kanban-sent { background: var(--amber-50); color: var(--amber-500); }
    .kanban-followup { background: #F3E8FF; color: var(--purple-500); }
    .kanban-replied { background: var(--green-50); color: var(--green-500); }
    .kanban-interview { background: var(--green-50); color: var(--green-500); }
    .kanban-rejected { background: var(--red-50); color: var(--red-500); }
    .kanban-ghosted { background: var(--grey-100); color: var(--grey-500); }

    /* ── Kanban Card ── */
    .kanban-card {
        background: white;
        border: 1px solid var(--grey-200);
        border-radius: 10px;
        padding: 12px 14px;
        margin-bottom: 8px;
        box-shadow: var(--shadow-sm);
        transition: all 0.2s ease;
        font-size: 0.83rem;
    }
    .kanban-card:hover {
        box-shadow: var(--shadow-md);
        border-color: var(--blue-primary);
    }
    .kanban-card .kc-role {
        font-weight: 600;
        color: var(--grey-900);
        margin-bottom: 2px;
    }
    .kanban-card .kc-company {
        color: var(--grey-500);
        font-size: 0.78rem;
    }
    .kanban-card .kc-date {
        color: var(--grey-300);
        font-size: 0.72rem;
        margin-top: 6px;
    }

    /* ── Footer ── */
    .app-footer {
        text-align: center;
        padding: 32px 0 16px 0;
        color: var(--grey-300);
        font-size: 0.75rem;
        letter-spacing: 0.02em;
    }
    .app-footer a {
        color: var(--blue-primary);
        text-decoration: none;
    }

    /* ── Notification Banner ── */
    .notif-banner {
        background: white;
        border: 1px solid var(--grey-200);
        border-left: 4px solid var(--amber-500);
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 8px;
        font-size: 0.84rem;
        box-shadow: var(--shadow-sm);
    }
    .notif-urgent {
        border-left-color: var(--red-500);
    }
</style>
""", unsafe_allow_html=True)


# ── Load Profile & Resume from Disk (Once Per Session) ──
if "profile_loaded" not in st.session_state:
    saved = load_profile()
    st.session_state["p_name"] = saved.get("name", "")
    st.session_state["p_github"] = saved.get("github", "")
    st.session_state["p_portfolio"] = saved.get("portfolio", "")
    st.session_state["p_linkedin"] = saved.get("linkedin", "")
    st.session_state["resume_bytes"] = load_resume_from_disk()
    st.session_state["resume_text"] = ""
    if st.session_state["resume_bytes"]:
        try:
            st.session_state["resume_text"] = parse_resume(st.session_state["resume_bytes"])
        except Exception:
            pass
    st.session_state["profile_loaded"] = True

# ── Sidebar: Profile (Setup Once) ──
with st.sidebar:
    st.markdown("### ⚡ ColdReach")
    st.caption("Setup once. Use forever.")
    st.divider()

    st.markdown("##### 👤 Profile")
    name = st.text_input("Full Name", value=st.session_state["p_name"])
    linkedin = st.text_input("LinkedIn", value=st.session_state["p_linkedin"], placeholder="https://linkedin.com/in/you")
    github = st.text_input("GitHub", value=st.session_state["p_github"], placeholder="https://github.com/you")
    portfolio = st.text_input("Portfolio", value=st.session_state["p_portfolio"], placeholder="https://mysite.com")

    profile_changed = (
        name != st.session_state["p_name"]
        or github != st.session_state["p_github"]
        or portfolio != st.session_state["p_portfolio"]
        or linkedin != st.session_state["p_linkedin"]
    )
    if profile_changed:
        save_profile({"name": name, "github": github, "portfolio": portfolio, "linkedin": linkedin})
        st.session_state["p_name"] = name
        st.session_state["p_github"] = github
        st.session_state["p_portfolio"] = portfolio
        st.session_state["p_linkedin"] = linkedin

    st.divider()
    st.markdown("##### 📄 Resume")
    if st.session_state["resume_bytes"]:
        st.success("Resume saved & ready")
        if st.button("🔄 Replace Resume"):
            st.session_state["show_upload"] = True
    else:
        st.session_state["show_upload"] = True

    if st.session_state.get("show_upload") or not st.session_state["resume_bytes"]:
        uploaded = st.file_uploader("Upload PDF", type=["pdf"], key="res_up")
        if uploaded:
            pdf_bytes = uploaded.read()
            try:
                text = parse_resume(pdf_bytes)
                if text.strip():
                    save_resume_to_disk(pdf_bytes)
                    st.session_state["resume_bytes"] = pdf_bytes
                    st.session_state["resume_text"] = text
                    st.session_state["show_upload"] = False
                    st.success("Saved!")
                    st.rerun()
                else:
                    st.error("Could not extract text from PDF.")
            except Exception as e:
                st.error(f"Error: {e}")

    st.divider()
    st.markdown("##### ⚙️ System")
    has_key = bool(os.environ.get("GEMINI_API_KEY", "").strip('" '))
    has_email = bool(os.environ.get("EMAIL_SENDER_ADDRESS", "").strip('" '))
    has_pwd = bool(os.environ.get("EMAIL_APP_PASSWORD", "").strip('" '))
    st.write("✅ Gemini API" if has_key else "❌ Gemini API Key")
    st.write("✅ Email Connected" if has_email and has_pwd else "❌ Email Credentials")
    st.write(f"✅ Resume Loaded" if st.session_state["resume_bytes"] else "❌ Resume Missing")


# ══════════════════════════════════════════════════════════════════
# MAIN AREA — Brand Header
# ══════════════════════════════════════════════════════════════════
st.markdown("""
<div class="brand-header">
    <div class="brand-icon">🚀</div>
    <div>
        <div class="brand-text">ColdReach</div>
        <div class="brand-sub">Send personalized job emails in 3 clicks</div>
    </div>
</div>
""", unsafe_allow_html=True)


# ── Notification Panel ──────────────────────────────────────────
FOLLOW_UP_CADENCE = [3, 7, 14]  # Days for each follow-up round

def _get_notifications(apps):
    """Categorize applications by urgency for the notification panel."""
    urgent, due_soon = [], []
    now = datetime.now()
    for app in apps:
        status = app.get("status", "")
        if status in ("Replied", "Interview Scheduled", "Rejected", "Ghosted", "Draft"):
            continue

        ref_date_str = app.get("follow_up_sent_at") or app.get("sent_at")
        if not ref_date_str:
            continue

        ref_date = datetime.fromisoformat(ref_date_str)
        days_since = (now - ref_date).days
        follow_up_count = app.get("follow_up_count", 0)

        if follow_up_count >= len(FOLLOW_UP_CADENCE):
            urgent.append({"app": app, "msg": f"{follow_up_count} follow-ups sent, no reply — consider marking as Ghosted"})
        elif days_since >= FOLLOW_UP_CADENCE[follow_up_count]:
            label = f"Follow-up #{follow_up_count + 1} is due ({days_since}d since last email)"
            if days_since >= FOLLOW_UP_CADENCE[follow_up_count] + 3:
                urgent.append({"app": app, "msg": label + " — OVERDUE"})
            else:
                due_soon.append({"app": app, "msg": label})
    return urgent, due_soon

all_apps = get_applications()
urgent_list, due_list = _get_notifications(all_apps)

if urgent_list or due_list:
    for item in urgent_list:
        a = item["app"]
        st.markdown(f'<div class="notif-banner notif-urgent">🔴 <strong>{a["role"]} at {a["company"]}</strong> — {item["msg"]}</div>', unsafe_allow_html=True)
    for item in due_list:
        a = item["app"]
        st.markdown(f'<div class="notif-banner">🟡 <strong>{a["role"]} at {a["company"]}</strong> — {item["msg"]}</div>', unsafe_allow_html=True)
    st.write("")  # spacer


# ── Tabs ──
tab_cold, tab_jd, tab_poster, tab_dash = st.tabs([
    "🧊 Cold Mail", "📋 From JD", "🖼️ From Poster", "📊 Dashboard"
])


# ══════════════════════════════════════════════════════════════════
# TAB 1: COLD MAIL
# ══════════════════════════════════════════════════════════════════
with tab_cold:
    st.markdown("#### Cold Mail")
    st.caption("Reach out to companies you're interested in — even without a job posting.")

    c1, c2 = st.columns([1, 1])
    with c1:
        cold_email = st.text_input("HR Email *", placeholder="hr@company.com", key="cold_email")
        cold_role = st.text_input("Role you're targeting", placeholder="e.g. Data Scientist", key="cold_role")
    with c2:
        cold_company_info = st.text_area("Company info (optional)", height=100, key="cold_info",
                                          placeholder="Paste anything about the company — website, LinkedIn about, etc.")

    if st.button("Generate Cold Email →", type="primary", key="cold_btn"):
        errors = []
        if not cold_email.strip():
            errors.append("HR Email is required.")
        elif not is_valid_email(cold_email):
            errors.append(f"'{cold_email}' is not a valid email address.")
        if not st.session_state["resume_text"]:
            errors.append("Upload your resume in the sidebar first.")

        if errors:
            for e in errors:
                st.error(e)
        else:
            with st.spinner("Drafting cold email..."):
                try:
                    draft = generate_cold_email(
                        resume_text=st.session_state["resume_text"],
                        company_info=cold_company_info,
                        target_role=cold_role,
                        sender_name=name, github_url=github, portfolio_url=portfolio,
                        linkedin_url=linkedin,
                    )
                    add_application(
                        app_type="Cold Email", company=draft.company_name,
                        role=cold_role or "General", email=cold_email.strip(),
                        subject=draft.subject, body=draft.body,
                    )
                    st.success("Draft created! Switch to the **Dashboard** tab to review and send.")
                except Exception as e:
                    st.error(f"Failed: {e}")


# ══════════════════════════════════════════════════════════════════
# TAB 2: FROM JD (Auto-extract)
# ══════════════════════════════════════════════════════════════════
with tab_jd:
    st.markdown("#### From Job Description")
    st.caption("Paste the JD — we auto-extract the email, job title, and company name.")

    jd_text = st.text_area("Paste the full Job Description *", height=250, key="jd_text",
                            placeholder="Paste the entire JD here. We'll extract everything automatically.")

    with st.expander("Override extracted fields (optional)"):
        jd_override_email = st.text_input("Override Email", key="jd_ov_email", placeholder="Leave blank to auto-extract")
        jd_override_title = st.text_input("Override Job Title", key="jd_ov_title", placeholder="Leave blank to auto-extract")

    if st.button("Extract & Generate →", type="primary", key="jd_btn"):
        errors = []
        if not jd_text.strip():
            errors.append("Paste a job description first.")
        if not st.session_state["resume_text"]:
            errors.append("Upload your resume in the sidebar first.")

        if errors:
            for e in errors:
                st.error(e)
        else:
            with st.spinner("Scanning JD..."):
                try:
                    info = extract_from_jd(jd_text)
                    extracted_email = jd_override_email.strip() or info.email
                    extracted_title = jd_override_title.strip() or info.job_title
                    extracted_company = info.company_name

                    st.info(f"**Extracted →** Email: `{extracted_email or 'Not found'}` · Title: `{extracted_title}` · Company: `{extracted_company}`")

                    if not extracted_email:
                        st.warning("No email found in JD. Enter it manually using the override above.")
                    elif not is_valid_email(extracted_email):
                        st.warning(f"Extracted email `{extracted_email}` looks invalid. Fix it using the override.")
                    else:
                        with st.spinner("Generating personalized email..."):
                            draft = generate_jd_email(
                                resume_text=st.session_state["resume_text"],
                                jd_text=jd_text, job_title=extracted_title,
                                company_name=extracted_company,
                                sender_name=name, github_url=github, portfolio_url=portfolio,
                                linkedin_url=linkedin,
                            )
                            add_application(
                                app_type="Job Application", company=extracted_company,
                                role=extracted_title, email=extracted_email,
                                subject=draft.subject, body=draft.body,
                            )
                            st.success("Draft created! Switch to the **Dashboard** tab to review and send.")
                except Exception as e:
                    st.error(f"Failed: {e}")


# ══════════════════════════════════════════════════════════════════
# TAB 3: FROM POSTER (Gemini Vision)
# ══════════════════════════════════════════════════════════════════
with tab_poster:
    st.markdown("#### From Poster")
    st.caption("Upload a LinkedIn job flyer or screenshot — Gemini Vision extracts everything.")

    poster_image = st.file_uploader("Upload job poster / flyer *", type=["png", "jpg", "jpeg"], key="poster_img")

    if poster_image:
        st.image(poster_image, caption="Uploaded Poster", use_container_width=True)

    with st.expander("Override extracted fields (optional)"):
        poster_override_email = st.text_input("Override Email", key="post_ov_email", placeholder="Leave blank to auto-extract")
        poster_override_title = st.text_input("Override Job Title", key="post_ov_title", placeholder="Leave blank to auto-extract")

    if st.button("Scan Poster & Generate →", type="primary", key="poster_btn"):
        errors = []
        if not poster_image:
            errors.append("Upload a poster image first.")
        if not st.session_state["resume_text"]:
            errors.append("Upload your resume in the sidebar first.")

        if errors:
            for e in errors:
                st.error(e)
        else:
            img_bytes = poster_image.read()
            with st.spinner("Scanning poster with Gemini Vision..."):
                try:
                    info = extract_from_poster(img_bytes)
                    extracted_email = poster_override_email.strip() or info.email
                    extracted_title = poster_override_title.strip() or info.job_title
                    extracted_company = info.company_name
                    extracted_jd = info.job_description

                    st.info(f"**Extracted →** Email: `{extracted_email or 'Not found'}` · Title: `{extracted_title}` · Company: `{extracted_company}`")
                    if extracted_jd:
                        st.caption(f"**JD Summary:** {extracted_jd}")

                    if not extracted_email:
                        st.warning("No email found in poster. Enter it manually using the override above.")
                    elif not is_valid_email(extracted_email):
                        st.warning(f"Extracted email `{extracted_email}` looks invalid. Fix it using the override.")
                    else:
                        with st.spinner("Generating personalized email..."):
                            draft = generate_jd_email(
                                resume_text=st.session_state["resume_text"],
                                jd_text=extracted_jd or f"Job: {extracted_title} at {extracted_company}",
                                job_title=extracted_title, company_name=extracted_company,
                                sender_name=name, github_url=github, portfolio_url=portfolio,
                                linkedin_url=linkedin,
                            )
                            add_application(
                                app_type="Job Application", company=extracted_company,
                                role=extracted_title, email=extracted_email,
                                subject=draft.subject, body=draft.body,
                            )
                            st.success("Draft created! Switch to the **Dashboard** tab to review and send.")
                except Exception as e:
                    st.error(f"Failed: {e}")


# ══════════════════════════════════════════════════════════════════
# TAB 4: DASHBOARD — Kanban + Detail View
# ══════════════════════════════════════════════════════════════════
with tab_dash:
    st.markdown("#### Application Tracker")
    apps = get_applications()

    if not apps:
        st.info("No applications yet. Use one of the tabs above to create your first one.")
    else:
        # ── Quick Stats ──
        total = len(apps)
        drafts = sum(1 for a in apps if a["status"] == "Draft")
        sent_count = sum(1 for a in apps if a["status"] == "Sent")
        followed = sum(1 for a in apps if a["status"] == "Follow-up Sent")
        replied = sum(1 for a in apps if a["status"] == "Replied")
        interviews = sum(1 for a in apps if a["status"] == "Interview Scheduled")
        rejected = sum(1 for a in apps if a["status"] == "Rejected")
        ghosted = sum(1 for a in apps if a["status"] == "Ghosted")

        m1, m2, m3, m4, m5, m6 = st.columns(6)
        m1.metric("Total", total)
        m2.metric("Drafts", drafts)
        m3.metric("Sent", sent_count)
        m4.metric("Follow-ups", followed)
        m5.metric("Interviews", interviews)
        m6.metric("Replied", replied)

        st.write("")  # spacer

        # ── Kanban Board ──
        STATUS_ORDER = ["Draft", "Sent", "Follow-up Sent", "Replied", "Interview Scheduled", "Rejected", "Ghosted"]
        STATUS_CSS = {
            "Draft": "kanban-draft", "Sent": "kanban-sent", "Follow-up Sent": "kanban-followup",
            "Replied": "kanban-replied", "Interview Scheduled": "kanban-interview",
            "Rejected": "kanban-rejected", "Ghosted": "kanban-ghosted",
        }
        STATUS_EMOJI = {
            "Draft": "📝", "Sent": "📨", "Follow-up Sent": "🔄",
            "Replied": "✅", "Interview Scheduled": "🎉", "Rejected": "❌", "Ghosted": "👻",
        }

        # Only show columns that have applications
        active_statuses = [s for s in STATUS_ORDER if any(a["status"] == s for a in apps)]

        if active_statuses:
            cols = st.columns(len(active_statuses))
            for col, status in zip(cols, active_statuses):
                with col:
                    css_class = STATUS_CSS.get(status, "kanban-draft")
                    emoji = STATUS_EMOJI.get(status, "❓")
                    count = sum(1 for a in apps if a["status"] == status)
                    st.markdown(f'<div class="kanban-col-header {css_class}">{emoji} {status} ({count})</div>', unsafe_allow_html=True)

                    for app in reversed(apps):
                        if app["status"] != status:
                            continue
                        date_str = app.get("sent_at", app["created_at"])[:10] if app.get("sent_at") else app["created_at"][:10]
                        st.markdown(f"""
                        <div class="kanban-card">
                            <div class="kc-role">{app['role']}</div>
                            <div class="kc-company">{app['company']}</div>
                            <div class="kc-date">{date_str} · {app['email'][:25]}</div>
                        </div>
                        """, unsafe_allow_html=True)

        st.divider()

        # ── Detailed Application Cards ──
        st.markdown("#### Application Details")
        st.caption("Click to expand, edit, and send.")

        resume_data = st.session_state.get("resume_bytes")

        for app in reversed(apps):
            emoji = STATUS_EMOJI.get(app["status"], "❓")

            with st.expander(
                f"{emoji} {app['role']} at {app['company']}  ·  {app['status']}  ·  {app['created_at'][:10]}",
                expanded=(app["status"] == "Draft"),
            ):
                col_e, col_a = st.columns([2, 1])

                with col_e:
                    email_v = st.text_input("To", value=app["email"], key=f"to_{app['id']}")
                    subj_v = st.text_input("Subject", value=app["subject"], key=f"su_{app['id']}")
                    body_v = st.text_area("Body", value=app["body"], height=180, key=f"bo_{app['id']}")

                    if st.button("💾 Save Edits", key=f"sv_{app['id']}"):
                        if not is_valid_email(email_v):
                            st.error("Invalid email format.")
                        elif not body_v.strip():
                            st.error("Body cannot be empty.")
                        else:
                            update_application(app["id"], {"email": email_v, "subject": subj_v, "body": body_v})
                            st.success("Saved!")
                            st.rerun()

                with col_a:
                    st.caption(f"**Type:** {app['type']}")
                    st.caption(f"**Status:** {app['status']}")
                    if app.get("sent_at"):
                        st.caption(f"**Sent:** {app['sent_at'][:10]}")
                    if app.get("follow_up_count", 0) > 0:
                        st.caption(f"**Follow-ups:** {app['follow_up_count']}")

                    if not resume_data:
                        st.warning("⚠️ Resume not loaded")

                    # ── DRAFT ──
                    if app["status"] == "Draft":
                        if st.button("✉️ Send Now", key=f"sn_{app['id']}", type="primary"):
                            if not is_valid_email(email_v):
                                st.error("Fix email first.")
                            elif not body_v.strip():
                                st.error("Body is empty.")
                            else:
                                with st.spinner("Sending..."):
                                    try:
                                        send_email(email_v, subj_v, body_v, resume_data)
                                        update_application(app["id"], {
                                            "status": "Sent", "email": email_v, "subject": subj_v,
                                            "body": body_v, "sent_at": datetime.now().isoformat(),
                                        })
                                        st.success("Sent!")
                                        st.rerun()
                                    except Exception as e:
                                        st.error(f"❌ {e}")

                    # ── SENT ──
                    elif app["status"] == "Sent":
                        sc1, sc2, sc3 = st.columns(3)
                        with sc1:
                            if st.button("✅ Replied", key=f"rp_{app['id']}"):
                                update_application(app["id"], {"status": "Replied"})
                                st.rerun()
                        with sc2:
                            if st.button("📅 Interview", key=f"iv0_{app['id']}"):
                                update_application(app["id"], {"status": "Interview Scheduled"})
                                st.rerun()
                        with sc3:
                            if st.button("❌ Rejected", key=f"rj0_{app['id']}"):
                                update_application(app["id"], {"status": "Rejected"})
                                st.rerun()

                        if app["type"] == "Cold Email":
                            if st.button("🔄 Resend (Rewritten)", key=f"rs_{app['id']}"):
                                with st.spinner("Rewriting..."):
                                    try:
                                        new_body = rewrite_email(body_v, "Professional")
                                        send_email(email_v, subj_v, new_body, resume_data)
                                        update_application(app["id"], {
                                            "body": new_body, "sent_at": datetime.now().isoformat(),
                                        })
                                        st.success("Rewritten & sent!")
                                        st.rerun()
                                    except Exception as e:
                                        st.error(f"❌ {e}")

                        if app.get("sent_at"):
                            days_cfg = app.get("follow_up_days", 3)
                            days_since = (datetime.now() - datetime.fromisoformat(app["sent_at"])).days
                            if days_since >= days_cfg:
                                st.warning(f"⏰ {days_since}d since sent — follow up?")
                                if st.button("📩 Send Follow-up", key=f"fu_{app['id']}"):
                                    with st.spinner("Sending follow-up..."):
                                        try:
                                            fu = generate_follow_up(body_v, app["company"], "Hiring Manager")
                                            send_email(email_v, f"Re: {subj_v}", fu, resume_data)
                                            update_application(app["id"], {
                                                "status": "Follow-up Sent",
                                                "follow_up_count": app.get("follow_up_count", 0) + 1,
                                                "follow_up_sent_at": datetime.now().isoformat(),
                                            })
                                            st.success("Follow-up sent!")
                                            st.rerun()
                                        except Exception as e:
                                            st.error(f"❌ {e}")

                    # ── FOLLOW-UP SENT (3-round cadence) ──
                    elif app["status"] == "Follow-up Sent":
                        follow_count = app.get("follow_up_count", 1)

                        scol1, scol2, scol3 = st.columns(3)
                        with scol1:
                            if st.button("✅ Replied", key=f"rp2_{app['id']}"):
                                update_application(app["id"], {"status": "Replied"})
                                st.rerun()
                        with scol2:
                            if st.button("📅 Interview", key=f"iv_{app['id']}"):
                                update_application(app["id"], {"status": "Interview Scheduled"})
                                st.rerun()
                        with scol3:
                            if st.button("👻 Ghosted", key=f"gh_{app['id']}"):
                                update_application(app["id"], {"status": "Ghosted"})
                                st.rerun()

                        if app.get("follow_up_sent_at") and follow_count < 3:
                            fu_date = datetime.fromisoformat(app["follow_up_sent_at"])
                            days_since = (datetime.now() - fu_date).days
                            next_cadence = FOLLOW_UP_CADENCE[follow_count] if follow_count < len(FOLLOW_UP_CADENCE) else 14
                            if days_since >= next_cadence:
                                st.warning(f"⏰ Follow-up #{follow_count + 1} due ({days_since}d since last)")
                                if st.button(f"📩 Send Follow-up #{follow_count + 1}", key=f"fu2_{app['id']}"):
                                    with st.spinner("Sending..."):
                                        try:
                                            fu = generate_follow_up(body_v, app["company"], "Hiring Manager")
                                            send_email(email_v, f"Re: {subj_v}", fu, resume_data)
                                            update_application(app["id"], {
                                                "follow_up_count": follow_count + 1,
                                                "follow_up_sent_at": datetime.now().isoformat(),
                                            })
                                            st.success(f"Follow-up #{follow_count + 1} sent!")
                                            st.rerun()
                                        except Exception as e:
                                            st.error(f"❌ {e}")
                        elif follow_count >= 3:
                            st.error("3 follow-ups sent with no reply.")
                            if st.button("👻 Mark as Ghosted", key=f"gh2_{app['id']}"):
                                update_application(app["id"], {"status": "Ghosted"})
                                st.rerun()

                    # ── REPLIED ──
                    elif app["status"] == "Replied":
                        scol1, scol2 = st.columns(2)
                        with scol1:
                            if st.button("📅 Interview Scheduled", key=f"iv2_{app['id']}"):
                                update_application(app["id"], {"status": "Interview Scheduled"})
                                st.rerun()
                        with scol2:
                            if st.button("❌ Rejected", key=f"rj_{app['id']}"):
                                update_application(app["id"], {"status": "Rejected"})
                                st.rerun()

                    # ── INTERVIEW SCHEDULED ──
                    elif app["status"] == "Interview Scheduled":
                        st.success("🎉 Interview locked in!")
                        if st.button("❌ Mark Rejected", key=f"rj2_{app['id']}"):
                            update_application(app["id"], {"status": "Rejected"})
                            st.rerun()

                    # ── TERMINAL STATES ──
                    elif app["status"] == "Ghosted":
                        st.caption("👻 No response after 3 follow-ups. Move on.")

                    elif app["status"] == "Rejected":
                        st.caption("❌ Rejected. On to the next one.")

                    st.divider()

                    # ── Two-step Delete ──
                    confirm_key = f"confirm_del_{app['id']}"
                    if st.session_state.get(confirm_key, False):
                        st.warning(f"Delete **{app['role']} at {app['company']}**?")
                        del_c1, del_c2 = st.columns(2)
                        with del_c1:
                            if st.button("Yes, Delete", key=f"yes_dl_{app['id']}", type="primary"):
                                delete_application(app["id"])
                                st.session_state[confirm_key] = False
                                st.rerun()
                        with del_c2:
                            if st.button("Cancel", key=f"no_dl_{app['id']}"):
                                st.session_state[confirm_key] = False
                                st.rerun()
                    else:
                        if st.button("🗑️ Delete", key=f"dl_{app['id']}"):
                            st.session_state[confirm_key] = True
                            st.rerun()

        # ── Bulk Cleanup ──
        st.divider()
        bc1, bc2, bc3, _ = st.columns([1, 1, 1, 2])
        with bc1:
            if drafts > 0 and st.button(f"Clear Drafts ({drafts})"):
                bulk_delete_by_status("Draft")
                st.rerun()
        with bc2:
            if replied > 0 and st.button(f"Clear Replied ({replied})"):
                bulk_delete_by_status("Replied")
                st.rerun()
        with bc3:
            if ghosted > 0 and st.button(f"Clear Ghosted ({ghosted})"):
                bulk_delete_by_status("Ghosted")
                st.rerun()


# ── Footer ──
st.markdown("""
<div class="app-footer">
    Built by Abhishek · ColdReach v1.0
</div>
""", unsafe_allow_html=True)
