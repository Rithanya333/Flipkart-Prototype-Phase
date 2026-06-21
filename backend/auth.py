"""JWT authentication: bcrypt hashing, token management, route handlers."""
from __future__ import annotations

import os
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional

import bcrypt
import jwt
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field

from db import db

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 12  # 12h for control-room sessions
REFRESH_TOKEN_DAYS = 7
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ---------- Helpers ----------
def _jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)


def _set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    response.set_cookie(
        "access_token", access, httponly=True, secure=False, samesite="lax",
        max_age=ACCESS_TOKEN_MINUTES * 60, path="/",
    )
    response.set_cookie(
        "refresh_token", refresh, httponly=True, secure=False, samesite="lax",
        max_age=REFRESH_TOKEN_DAYS * 24 * 3600, path="/",
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["id"] = str(user.pop("_id"))
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def require_role(*allowed: str):
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in allowed:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return dep


async def _check_lockout(identifier: str) -> None:
    rec = await db.login_attempts.find_one({"identifier": identifier})
    if not rec:
        return
    if rec.get("count", 0) >= MAX_FAILED_ATTEMPTS:
        locked_at = rec.get("locked_at")
        if locked_at:
            elapsed = (datetime.now(timezone.utc) - locked_at).total_seconds()
            if elapsed < LOCKOUT_MINUTES * 60:
                wait = int(LOCKOUT_MINUTES * 60 - elapsed)
                raise HTTPException(status_code=429, detail=f"Account locked. Try again in {wait}s.")
            await db.login_attempts.delete_one({"identifier": identifier})


async def _record_failure(identifier: str) -> None:
    rec = await db.login_attempts.find_one({"identifier": identifier})
    if not rec:
        await db.login_attempts.insert_one({"identifier": identifier, "count": 1})
    else:
        count = rec.get("count", 0) + 1
        upd = {"count": count}
        if count >= MAX_FAILED_ATTEMPTS:
            upd["locked_at"] = datetime.now(timezone.utc)
        await db.login_attempts.update_one({"identifier": identifier}, {"$set": upd})


async def _clear_attempts(identifier: str) -> None:
    await db.login_attempts.delete_one({"identifier": identifier})


# ---------- Pydantic ----------
class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=1, max_length=80)
    role: Optional[str] = Field(default="officer", pattern="^(officer|admin)$")


class LoginBody(BaseModel):
    email: EmailStr
    password: str


def _safe_user(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "email": doc["email"],
        "name": doc.get("name", ""),
        "role": doc.get("role", "officer"),
        "created_at": doc.get("created_at"),
    }


# ---------- Endpoints ----------
@router.post("/register")
async def register(body: RegisterBody, response: Response):
    email = body.email.lower().strip()
    exists = await db.users.find_one({"email": email})
    if exists:
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name.strip(),
        "role": body.role or "officer",
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    user = _safe_user(doc)
    access = create_access_token(user["id"], user["email"], user["role"])
    refresh = create_refresh_token(user["id"])
    _set_auth_cookies(response, access, refresh)
    return user


@router.post("/login")
async def login(body: LoginBody, request: Request, response: Response):
    email = body.email.lower().strip()
    ident = f"{request.client.host if request.client else 'unknown'}:{email}"
    await _check_lockout(ident)
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        await _record_failure(ident)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await _clear_attempts(ident)
    safe = _safe_user(user)
    access = create_access_token(safe["id"], safe["email"], safe["role"])
    refresh = create_refresh_token(safe["id"])
    _set_auth_cookies(response, access, refresh)
    return safe


@router.post("/logout")
async def logout(response: Response, _: dict = Depends(get_current_user)):
    _clear_auth_cookies(response)
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@router.post("/refresh")
async def refresh_token(request: Request, response: Response):
    rt = request.cookies.get("refresh_token")
    if not rt:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(rt, _jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        safe = _safe_user(user)
        access = create_access_token(safe["id"], safe["email"], safe["role"])
        new_refresh = create_refresh_token(safe["id"])
        _set_auth_cookies(response, access, new_refresh)
        return safe
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


async def seed_admin_and_officer():
    """Idempotent seed for the two demo accounts."""
    accounts = [
        {
            "email": os.environ.get("ADMIN_EMAIL", "admin@parkpulse.ai").lower(),
            "password": os.environ.get("ADMIN_PASSWORD", "ParkPulse@2026"),
            "name": "Control Room Admin",
            "role": "admin",
        },
        {
            "email": os.environ.get("OFFICER_EMAIL", "officer@parkpulse.ai").lower(),
            "password": os.environ.get("OFFICER_PASSWORD", "Officer@2026"),
            "name": "Field Enforcement Officer",
            "role": "officer",
        },
    ]
    for acc in accounts:
        existing = await db.users.find_one({"email": acc["email"]})
        if existing is None:
            await db.users.insert_one({
                "email": acc["email"],
                "password_hash": hash_password(acc["password"]),
                "name": acc["name"],
                "role": acc["role"],
                "created_at": datetime.now(timezone.utc),
            })
        elif not verify_password(acc["password"], existing.get("password_hash", "")):
            await db.users.update_one(
                {"email": acc["email"]},
                {"$set": {"password_hash": hash_password(acc["password"]), "role": acc["role"]}},
            )


async def ensure_indexes():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
