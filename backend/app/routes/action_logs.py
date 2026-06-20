from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from app.database import get_db
from app.models.action_log import ActionLog
from app.models.user import User
from app.schemas.action_log import ActionLogListResponse, ActionLogOut
from app.dependencies import require_admin

router = APIRouter(prefix="/action-logs", tags=["action-logs"])


@router.get("/", response_model=ActionLogListResponse)
async def list_action_logs(
    search: str | None = Query(None),
    action: str | None = Query(None),
    resource_type: str | None = Query(None),
    user_id: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(ActionLog)
    count_query = select(func.count()).select_from(ActionLog)

    if action:
        query = query.where(ActionLog.action == action)
        count_query = count_query.where(ActionLog.action == action)
    if resource_type:
        query = query.where(ActionLog.resource_type == resource_type)
        count_query = count_query.where(ActionLog.resource_type == resource_type)
    if user_id:
        query = query.where(ActionLog.user_id == user_id)
        count_query = count_query.where(ActionLog.user_id == user_id)
    if search:
        term = f"%{search}%"
        search_filter = or_(
            ActionLog.user_name.ilike(term),
            ActionLog.user_email.ilike(term),
            ActionLog.action.ilike(term),
            ActionLog.resource_type.ilike(term),
            ActionLog.resource_id.ilike(term),
            ActionLog.resource_label.ilike(term),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(
        query.order_by(ActionLog.created_at.desc()).offset(skip).limit(limit)
    )
    items = result.scalars().all()
    return ActionLogListResponse(items=items, total=total)


@router.get("/filters")
async def action_log_filters(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    actions = (await db.execute(
        select(ActionLog.action).distinct().order_by(ActionLog.action)
    )).scalars().all()
    resource_types = (await db.execute(
        select(ActionLog.resource_type).distinct().order_by(ActionLog.resource_type)
    )).scalars().all()
    return {"actions": actions, "resource_types": resource_types}
