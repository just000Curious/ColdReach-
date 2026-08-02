import json
import os
import uuid
import re
import csv
import io
from datetime import datetime
from typing import List, Dict, Any, Optional

# Anchor all file paths to THIS script's directory so data never gets lost
_DIR = os.path.dirname(os.path.abspath(__file__))
_DATA_DIR = os.path.join(os.path.dirname(_DIR))  # linkedin-auto-apply/
DB_FILE = os.path.join(_DATA_DIR, "applications.json")
PROFILE_FILE = os.path.join(_DATA_DIR, "profile.json")
RESUME_FILE = os.path.join(_DATA_DIR, "saved_resume.pdf")


def load_profiles_data() -> Dict[str, Any]:
    """Load profiles data. Migrates old single-profile format if necessary."""
    if not os.path.exists(PROFILE_FILE):
        return {"profiles": [], "active_id": None}
    try:
        with open(PROFILE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Migration check: if it's the old flat structure (has 'name' but no 'profiles' list)
            if isinstance(data, dict) and "profiles" not in data:
                new_id = str(uuid.uuid4())[:8]
                data["id"] = new_id
                data["role"] = "Default Profile"
                migrated = {
                    "profiles": [data],
                    "active_id": new_id
                }
                save_profiles_data(migrated)
                return migrated
            return data
    except (json.JSONDecodeError, IOError):
        return {"profiles": [], "active_id": None}


def save_profiles_data(data: Dict[str, Any]) -> None:
    """Save profiles data to disk permanently using atomic write."""
    tmp_file = PROFILE_FILE + ".tmp"
    try:
        with open(tmp_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4)
        os.replace(tmp_file, PROFILE_FILE)
    except Exception as e:
        if os.path.exists(tmp_file):
            os.remove(tmp_file)
        raise e


def get_active_profile() -> Dict[str, str]:
    """Return the currently active profile, or an empty dict if none."""
    data = load_profiles_data()
    active_id = data.get("active_id")
    for p in data.get("profiles", []):
        if p.get("id") == active_id:
            return p
    # Fallback to first profile if active_id is invalid
    if data.get("profiles"):
        return data["profiles"][0]
    return {}


def save_resume_to_disk(pdf_bytes: bytes) -> None:
    """Save the uploaded resume PDF to disk so it persists across sessions."""
    with open(RESUME_FILE, "wb") as f:
        f.write(pdf_bytes)


def load_resume_from_disk() -> Optional[bytes]:
    """Load previously saved resume from disk."""
    if os.path.exists(RESUME_FILE):
        with open(RESUME_FILE, "rb") as f:
            return f.read()
    return None


# ── Applications Database ────────────────────────────────────────

def load_db() -> List[Dict[str, Any]]:
    """Load all applications from the JSON file."""
    if not os.path.exists(DB_FILE):
        return []
    try:
        with open(DB_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return []


def save_db(data: List[Dict[str, Any]]) -> None:
    """Write applications list to the JSON file using atomic write."""
    tmp_file = DB_FILE + ".tmp"
    try:
        with open(tmp_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, default=str)
        os.replace(tmp_file, DB_FILE)
    except Exception as e:
        if os.path.exists(tmp_file):
            os.remove(tmp_file)
        raise e


def add_application(
    app_type: str,
    company: str,
    role: str,
    email: str,
    subject: str,
    body: str,
    follow_up_days: int = 3,
) -> str:
    """Add a new application to the database. Returns the new ID."""
    db = load_db()
    app_id = str(uuid.uuid4())[:8]  # Short IDs for readability
    new_app = {
        "id": app_id,
        "type": app_type,
        "company": company,
        "role": role,
        "email": email,
        "subject": subject,
        "body": body,
        "status": "Draft",
        "follow_up_days": follow_up_days,
        "follow_up_count": 0,
        "created_at": datetime.now().isoformat(),
        "sent_at": None,
        "follow_up_sent_at": None,
    }
    db.append(new_app)
    save_db(db)
    return app_id


def update_application(app_id: str, updates: Dict[str, Any]) -> None:
    """Update fields on an existing application."""
    db = load_db()
    for app in db:
        if app["id"] == app_id:
            app.update(updates)
            break
    save_db(db)


def delete_application(app_id: str) -> None:
    """Delete a single application by ID."""
    db = load_db()
    db = [app for app in db if app["id"] != app_id]
    save_db(db)


def get_applications() -> List[Dict[str, Any]]:
    """Return all applications."""
    return load_db()


def is_duplicate(email: str, role: str) -> bool:
    """Check if an application with same email+role already exists in Draft/Sent."""
    db = load_db()
    for app in db:
        if (
            app["email"].lower() == email.lower()
            and app["role"].lower() == role.lower()
            and app["status"] in ("Draft", "Sent")
        ):
            return True
    return False


def bulk_delete_by_status(status: str) -> int:
    """Delete all applications with a given status. Returns count deleted."""
    db = load_db()
    original_len = len(db)
    db = [app for app in db if app["status"] != status]
    save_db(db)
    return original_len - len(db)


# ── Validation Helpers ───────────────────────────────────────────

def is_valid_email(email: str) -> bool:
    """Basic email format validation."""
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return bool(re.match(pattern, email.strip()))
