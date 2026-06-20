import uuid
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.action_log import ActionLog
from app.models.user import User


def _serialize_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, (list, tuple)):
        return [_serialize_value(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _serialize_value(v) for k, v in value.items()}
    return str(value)


def model_to_log_dict(
    obj: Any,
    fields: list[str] | None = None,
    ignore: set[str] | frozenset[str] | None = None,
) -> dict[str, Any]:
    data: dict[str, Any] = {}
    ignored = ignore or set()
    keys = fields or [c.key for c in obj.__table__.columns]
    for key in keys:
        if key in ignored:
            continue
        if hasattr(obj, key):
            data[key] = _serialize_value(getattr(obj, key))
    return data


def diff_fields(
    before: dict[str, Any],
    after: dict[str, Any],
    *,
    ignore: set[str] | None = None,
) -> dict[str, dict[str, Any]]:
    ignored = ignore or set()
    changes: dict[str, dict[str, Any]] = {}
    for key in sorted(set(before) | set(after)):
        if key in ignored:
            continue
        old = before.get(key)
        new = after.get(key)
        if old != new:
            changes[key] = {"from": old, "to": new}
    return changes


def company_label(company) -> str:
    return company.company_name or company.isin_code or company.arn_number or str(company.id)


AUDIT_IGNORE_COMMON = frozenset({"created_at", "updated_at"})
COMPANY_AUDIT_IGNORE = AUDIT_IGNORE_COMMON | frozenset({"created_by", "updated_by", "physical_shares", "pan_holder_type", "security_type"})
USER_AUDIT_IGNORE = AUDIT_IGNORE_COMMON | frozenset({"password_hash"})
INVOICE_AUDIT_IGNORE = AUDIT_IGNORE_COMMON | frozenset({"last_generated_at"})


async def log_action(
    db: AsyncSession,
    user: User | None,
    action: str,
    resource_type: str,
    *,
    resource_id: str | None = None,
    resource_label: str | None = None,
    details: dict[str, Any] | None = None,
    request: Request | None = None,
) -> ActionLog:
    entry = ActionLog(
        user_id=user.id if user else None,
        user_name=user.name if user else None,
        user_email=user.email if user else None,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        resource_label=resource_label,
        details=details or {},
        ip_address=request.client.host if request and request.client else None,
        user_agent=request.headers.get("user-agent") if request else None,
    )
    db.add(entry)
    return entry
