import smtplib
import os
import re
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from email.utils import formataddr


def _validate_email(email: str) -> bool:
    """Validate email format before attempting SMTP."""
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return bool(re.match(pattern, email.strip()))


def send_email(
    to_email: str,
    subject: str,
    body: str,
    pdf_bytes: bytes = None,
    pdf_name: str = "Resume.pdf",
) -> bool:
    """Send an email via Gmail SMTP with optional PDF attachment.

    Raises ValueError for configuration/validation issues.
    Raises smtplib errors for connection/auth issues.
    """
    # Load and clean credentials
    sender_email = os.environ.get("EMAIL_SENDER_ADDRESS", "").strip('" ')
    app_password = os.environ.get("EMAIL_APP_PASSWORD", "").strip('" ').replace(" ", "")
    sender_name = os.environ.get("EMAIL_SENDER_NAME", "").strip('" ')

    # Validate configuration
    if not sender_email or not app_password:
        raise ValueError(
            "Email not configured. Set EMAIL_SENDER_ADDRESS and EMAIL_APP_PASSWORD in your .env file."
        )

    # Validate recipient
    if not to_email or not _validate_email(to_email):
        raise ValueError(f"Invalid recipient email: '{to_email}'")

    # Validate content
    if not subject.strip():
        raise ValueError("Email subject cannot be empty.")
    if not body.strip():
        raise ValueError("Email body cannot be empty.")

    # Build the email
    msg = MIMEMultipart()
    if sender_name:
        msg["From"] = formataddr((sender_name, sender_email))
    else:
        msg["From"] = sender_email
    msg["To"] = to_email.strip()
    msg["Subject"] = subject.strip()

    msg.attach(MIMEText(body, "plain", "utf-8"))

    # Attach PDF resume if provided
    if pdf_bytes:
        part = MIMEApplication(pdf_bytes, Name=pdf_name)
        part["Content-Disposition"] = f'attachment; filename="{pdf_name}"'
        msg.attach(part)

    # Send via Gmail SMTP with timeout
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as server:
        server.login(sender_email, app_password)
        server.send_message(msg)

    return True
