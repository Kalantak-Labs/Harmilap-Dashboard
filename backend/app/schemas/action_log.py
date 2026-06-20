import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ActionLogOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID | None
    user_name: str | None
    user_email: str | None
    action: str
    resource_type: str
    resource_id: str | None
    resource_label: str | None
    details: dict[str, Any] | None
    ip_address: str | None
    user_agent: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ActionLogListResponse(BaseModel):
    items: list[ActionLogOut]
    total: int
