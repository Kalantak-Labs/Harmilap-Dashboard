"""
Email sending service.

Template syntax: {{variable_name}} — replaced with context values.
If the rendered body contains no HTML tags, newlines are auto-converted
to <br> so plain-text templates render correctly in email clients.
"""

import asyncio
import re
import smtplib
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from typing import Any


# ── Variable catalog ──────────────────────────────────────────────────────────

TEMPLATE_VARIABLES: dict[str, list[dict]] = {
    "invoice": [
        {"key": "company_name",                  "label": "Company Name"},
        {"key": "isin_code",                     "label": "ISIN Code"},
        {"key": "rta_code",                      "label": "RTA Code"},
        {"key": "authorized_person_name",        "label": "Authorized Person"},
        {"key": "authorized_person_designation", "label": "Designation"},
        {"key": "invoice_no",                    "label": "Invoice Number"},
        {"key": "fiscal_year",                   "label": "Fiscal Year (e.g. 2025-26)"},
        {"key": "today",                         "label": "Today's Date"},
    ],
    "benpos": [
        {"key": "company_name",                  "label": "Company Name"},
        {"key": "isin_code",                     "label": "ISIN Code"},
        {"key": "rta_code",                      "label": "RTA Code"},
        {"key": "authorized_person_name",        "label": "Authorized Person"},
        {"key": "authorized_person_designation", "label": "Designation"},
        {"key": "record_date",                   "label": "Record Date"},
        {"key": "today",                         "label": "Today's Date"},
    ],
    "reconciliation": [
        {"key": "company_name",                  "label": "Company Name"},
        {"key": "isin_code",                     "label": "ISIN Code"},
        {"key": "rta_code",                      "label": "RTA Code"},
        {"key": "authorized_person_name",        "label": "Authorized Person"},
        {"key": "authorized_person_designation", "label": "Designation"},
        {"key": "record_date",                   "label": "Record Date"},
        {"key": "ref_number",                    "label": "Reference Number"},
        {"key": "today",                         "label": "Today's Date"},
    ],
}

EMAIL_TYPES = list(TEMPLATE_VARIABLES.keys())


# ── Template rendering ────────────────────────────────────────────────────────

def render_template(template: str, context: dict[str, Any]) -> str:
    """Replace {{key}} placeholders; unknown keys are left as [key]."""
    def _replace(m: re.Match) -> str:
        key = m.group(1).strip()
        val = context.get(key)
        return str(val) if val is not None else f"[{key}]"
    return re.sub(r"\{\{(\w+)\}\}", _replace, template)


def _ensure_html(body: str) -> str:
    """If body has no HTML tags, convert newlines to <br> for correct email rendering."""
    if re.search(r"<[a-zA-Z]", body):
        return body
    return body.replace("\n", "<br>\n")


# ── SMTP helpers ──────────────────────────────────────────────────────────────

def _smtp_send(host: str, port: int, username: str | None, password: str | None,
               use_tls: bool, msg: MIMEMultipart) -> None:
    if use_tls:
        server = smtplib.SMTP(host, port, timeout=20)
        server.ehlo()
        server.starttls()
        server.ehlo()
    else:
        server = smtplib.SMTP_SSL(host, port, timeout=20)
    if username and password:
        server.login(username, password)
    server.send_message(msg)
    server.quit()


def _smtp_test(host: str, port: int, username: str | None, password: str | None,
               use_tls: bool) -> None:
    if use_tls:
        server = smtplib.SMTP(host, port, timeout=10)
        server.ehlo()
        server.starttls()
        server.ehlo()
    else:
        server = smtplib.SMTP_SSL(host, port, timeout=10)
    if username and password:
        server.login(username, password)
    server.quit()


# ── Public API ────────────────────────────────────────────────────────────────

async def send_email(
    settings,
    to_emails: list[str],
    subject: str,
    body: str,
    attachment_bytes: bytes | None = None,
    attachment_name: str | None = None,
) -> None:
    """
    Send an HTML email with optional PDF attachment.
    Runs the blocking SMTP call in a thread executor.
    """
    msg = MIMEMultipart("mixed")
    msg["From"]    = formataddr((settings.sender_name or "", settings.sender_email or ""))
    msg["To"]      = ", ".join(to_emails)
    msg["Subject"] = subject

    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(_ensure_html(body), "html", "utf-8"))
    msg.attach(alt)

    if attachment_bytes and attachment_name:
        part = MIMEApplication(attachment_bytes, Name=attachment_name)
        part["Content-Disposition"] = f'attachment; filename="{attachment_name}"'
        msg.attach(part)

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(
        None, _smtp_send,
        settings.smtp_host, settings.smtp_port,
        settings.smtp_username, settings.smtp_password,
        settings.smtp_use_tls, msg,
    )


async def test_connection(settings) -> str | None:
    """Return None on success, or an error message string on failure."""
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None, _smtp_test,
            settings.smtp_host, settings.smtp_port,
            settings.smtp_username, settings.smtp_password,
            settings.smtp_use_tls,
        )
        return None
    except Exception as exc:
        return str(exc)
