"""Generic per-column table filters driven by a JSON query param.

The frontend sends ``filters`` as a JSON array of ``{"col": <key>, "val": <text>}``.
Each table exposes an ``allowed`` map ``{key: (kind, [columns])}`` where ``kind`` is
``"text"`` (case-insensitive contains, OR-ed across the columns) or ``"bool"``.
Unknown keys are ignored, so the param is safe to pass through untrusted.
"""
import json

from sqlalchemy import String, cast, or_

TRUE_TOKENS = {"true", "yes", "1", "y"}
FALSE_TOKENS = {"false", "no", "0", "n"}


def parse_filters(filters_json: str | None) -> list[dict]:
    if not filters_json:
        return []
    try:
        items = json.loads(filters_json)
    except (ValueError, TypeError):
        return []
    return items if isinstance(items, list) else []


def apply_column_filters(query, filters_json: str | None, allowed: dict):
    """Apply whitelisted per-column filters to a SELECT query."""
    for item in parse_filters(filters_json):
        if not isinstance(item, dict):
            continue
        key = item.get("col")
        val = item.get("val")
        if key not in allowed or val is None or str(val).strip() == "":
            continue
        kind, columns = allowed[key]
        if kind == "bool":
            token = str(val).strip().lower()
            if token in TRUE_TOKENS:
                query = query.where(columns[0].is_(True))
            elif token in FALSE_TOKENS:
                query = query.where(columns[0].is_(False))
        else:
            term = f"%{str(val).strip()}%"
            query = query.where(or_(*[cast(c, String).ilike(term) for c in columns]))
    return query
