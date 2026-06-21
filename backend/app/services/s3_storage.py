import logging

import boto3
from botocore.exceptions import ClientError

from app.config import settings

logger = logging.getLogger(__name__)


def _client():
    if not settings.aws_s3_bucket:
        return None
    kwargs = {"region_name": settings.aws_region}
    if settings.aws_access_key_id and settings.aws_secret_access_key:
        kwargs["aws_access_key_id"] = settings.aws_access_key_id
        kwargs["aws_secret_access_key"] = settings.aws_secret_access_key
    return boto3.client("s3", **kwargs)


def s3_configured() -> bool:
    return bool(settings.aws_s3_bucket)


def upload_pdf(key: str, data: bytes, content_type: str = "application/pdf") -> str:
    client = _client()
    if not client:
        raise RuntimeError(
            "AWS S3 is not configured. Set AWS_S3_BUCKET (and credentials) in the environment."
        )
    client.put_object(
        Bucket=settings.aws_s3_bucket,
        Key=key,
        Body=data,
        ContentType=content_type,
    )
    return key


def download_pdf(key: str) -> bytes:
    client = _client()
    if not client:
        raise RuntimeError("AWS S3 is not configured.")
    try:
        obj = client.get_object(Bucket=settings.aws_s3_bucket, Key=key)
        return obj["Body"].read()
    except ClientError as exc:
        logger.error("S3 download failed for %s: %s", key, exc)
        raise RuntimeError(f"Could not download invoice PDF from storage: {key}") from exc


def invoice_s3_key(invoice_id: str, filename: str) -> str:
    safe_name = filename.replace("/", "_")
    return f"billings/{invoice_id}/{safe_name}"


def delete_pdf(key: str) -> None:
    """Remove a PDF from S3. Ignores missing objects so DB cleanup can proceed."""
    if not key or key == "pending":
        return
    client = _client()
    if not client:
        return
    try:
        client.delete_object(Bucket=settings.aws_s3_bucket, Key=key)
    except ClientError as exc:
        logger.warning("S3 delete failed for %s: %s", key, exc)
