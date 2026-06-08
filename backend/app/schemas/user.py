import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr


VALID_PERMISSIONS = {"viewer", "editor", "can_ingest", "can_download"}


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Literal["admin", "user"] = "user"
    permissions: list[str] = []

    def model_post_init(self, __context):
        invalid = set(self.permissions) - VALID_PERMISSIONS
        if invalid:
            raise ValueError(f"Invalid permissions: {invalid}")


class UserUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    role: Literal["admin", "user"] | None = None
    permissions: list[str] | None = None
    is_active: bool | None = None

    def model_post_init(self, __context):
        if self.permissions is not None:
            invalid = set(self.permissions) - VALID_PERMISSIONS
            if invalid:
                raise ValueError(f"Invalid permissions: {invalid}")


class UserPasswordChange(BaseModel):
    current_password: str
    new_password: str


class UserOut(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    role: str
    permissions: list[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
