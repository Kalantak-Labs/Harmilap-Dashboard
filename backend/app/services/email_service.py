"""
Email sending service.

Template syntax: {{variable_name}} — replaced with context values.
If the rendered body contains no HTML tags, newlines are auto-converted
to <br> so plain-text templates render correctly in email clients.

Batch sending reuses a single SMTP connection for the entire batch with
a short inter-send delay to stay within provider rate limits (Outlook: 30/min).
"""

import asyncio
import contextlib
import re
import smtplib
import time
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
        {"key": "nsdl_rta_code",                 "label": "NSDL RTA Code"},
        {"key": "cdsl_rta_code",                 "label": "CDSL RTA Code"},
        {"key": "rta_code",                      "label": "RTA Code (legacy → NSDL)"},
        {"key": "authorized_person_name",        "label": "Authorized Person"},
        {"key": "authorized_person_designation", "label": "Designation"},
        {"key": "invoice_no",                    "label": "Invoice Number"},
        {"key": "fiscal_year",                   "label": "Fiscal Year (e.g. 2025-26)"},
        {"key": "today",                         "label": "Today's Date"},
    ],
    "benpos": [
        {"key": "company_name",                  "label": "Company Name"},
        {"key": "isin_code",                     "label": "ISIN Code"},
        {"key": "nsdl_rta_code",                 "label": "NSDL RTA Code"},
        {"key": "cdsl_rta_code",                 "label": "CDSL RTA Code"},
        {"key": "rta_code",                      "label": "RTA Code (legacy → NSDL)"},
        {"key": "authorized_person_name",        "label": "Authorized Person"},
        {"key": "authorized_person_designation", "label": "Designation"},
        {"key": "record_date",                   "label": "Record Date"},
        {"key": "today",                         "label": "Today's Date"},
    ],
    "reconciliation": [
        {"key": "company_name",                  "label": "Company Name"},
        {"key": "isin_code",                     "label": "ISIN Code"},
        {"key": "nsdl_rta_code",                 "label": "NSDL RTA Code"},
        {"key": "cdsl_rta_code",                 "label": "CDSL RTA Code"},
        {"key": "rta_code",                      "label": "RTA Code (legacy → NSDL)"},
        {"key": "authorized_person_name",        "label": "Authorized Person"},
        {"key": "authorized_person_designation", "label": "Designation"},
        {"key": "record_date",                   "label": "Record Date"},
        {"key": "ref_number",                    "label": "Reference Number"},
        {"key": "today",                         "label": "Today's Date"},
    ],
}

EMAIL_TYPES = list(TEMPLATE_VARIABLES.keys())

# Inter-send pause (seconds) — keeps us well under Outlook's 30 msg/min limit
SEND_DELAY = 2.5


# ── Template rendering ────────────────────────────────────────────────────────

def render_template(template: str, context: dict[str, Any]) -> str:
    """Replace {{key}} placeholders; unknown keys are left as [key]."""
    def _replace(m: re.Match) -> str:
        key = m.group(1).strip()
        val = context.get(key)
        return str(val) if val is not None else f"[{key}]"
    return re.sub(r"\{\{(\w+)\}\}", _replace, template)


def _ensure_html(body: str) -> str:
    """If body has no HTML tags, convert newlines to <br> for email clients."""
    if re.search(r"<[a-zA-Z]", body):
        return body
    return body.replace("\n", "<br>\n")


# ── SMTP connection ───────────────────────────────────────────────────────────

def _open_smtp(host: str, port: int, username: str | None, password: str | None,
               use_tls: bool) -> smtplib.SMTP:
    """Open and authenticate an SMTP connection. Caller must call .quit()."""
    if use_tls:
        server = smtplib.SMTP(host, port, timeout=20)
        server.ehlo()
        server.starttls()
        server.ehlo()
    else:
        server = smtplib.SMTP_SSL(host, port, timeout=20)
    if username and password:
        server.login(username, password)
    return server


def _build_msg(settings, to_emails: list[str], subject: str, body: str,
               attachment_bytes: bytes | None, attachment_name: str | None) -> MIMEMultipart:
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
    return msg


# ── Batch send (blocking, runs in thread executor) ────────────────────────────

class EmailJob:
    """All data needed to send one email — assembled before entering the thread."""
    __slots__ = ("company_id", "company_name", "to_emails",
                 "subject", "body", "pdf_bytes", "filename")

    def __init__(self, company_id: str, company_name: str | None, to_emails: list[str],
                 subject: str, body: str, pdf_bytes: bytes, filename: str):
        self.company_id   = company_id
        self.company_name = company_name
        self.to_emails    = to_emails
        self.subject      = subject
        self.body         = body
        self.pdf_bytes    = pdf_bytes
        self.filename     = filename


def batch_send(settings, jobs: list[EmailJob]) -> list[str | None]:
    """
    Blocking: open ONE SMTP connection, send all jobs with a short delay between
    each to avoid rate-limiting, close connection.

    Returns a list of error strings (None = success) aligned with jobs.
    If the connection itself fails, all jobs get the connection error.
    """
    statuses: list[str | None] = []
    server: smtplib.SMTP | None = None
    try:
        server = _open_smtp(
            settings.smtp_host, settings.smtp_port,
            settings.smtp_username, settings.smtp_password,
            settings.smtp_use_tls,
        )
        for i, job in enumerate(jobs):
            if i > 0:
                time.sleep(SEND_DELAY)
            try:
                msg = _build_msg(settings, job.to_emails, job.subject, job.body,
                                 job.pdf_bytes, job.filename)
                server.send_message(msg)
                statuses.append(None)
            except smtplib.SMTPException as exc:
                statuses.append(str(exc))
                # Try to keep the connection alive for remaining jobs
                with contextlib.suppress(Exception):
                    server.rset()
    except Exception as conn_exc:
        # Connection failed — mark all remaining jobs with the error
        remaining = len(jobs) - len(statuses)
        statuses.extend([str(conn_exc)] * remaining)
    finally:
        if server:
            with contextlib.suppress(Exception):
                server.quit()
    return statuses


# ── Test connection (blocking, runs in thread executor) ───────────────────────

def _test_smtp(host: str, port: int, username: str | None, password: str | None,
               use_tls: bool) -> None:
    server = _open_smtp(host, port, username, password, use_tls)
    server.quit()


async def test_connection(settings) -> str | None:
    """Return None on success, or an error message string on failure."""
    try:
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(
            None, _test_smtp,
            settings.smtp_host, settings.smtp_port,
            settings.smtp_username, settings.smtp_password,
            settings.smtp_use_tls,
        )
        return None
    except Exception as exc:
        return str(exc)
