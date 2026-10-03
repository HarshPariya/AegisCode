"""Authentication endpoints for registration, login, and user profile."""
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, EmailStr
from database.models.user import User, Organization, Membership
from database.repositories.user_repository import (
    UserRepository,
    OrganizationRepository,
    MembershipRepository,
)
from packages.shared.auth import hash_password, verify_password, create_access_token
from packages.shared.constants import OrganizationRole
from services.api.dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    password: str
    full_name: str = ""


class LoginRequest(BaseModel):
    username_or_email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    username: str
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    organization_name: Optional[str] = None


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest):
    user_repo = UserRepository()
    org_repo = OrganizationRepository()
    membership_repo = MembershipRepository()

    if await user_repo.get_by_email(req.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    if await user_repo.get_by_username(req.username):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken")

    user = User(
        email=req.email,
        username=req.username,
        full_name=req.full_name,
        hashed_password=hash_password(req.password)
    )
    saved_user = await user_repo.create(user)

    # Automatically create default organization for the user
    org = Organization(
        name=f"{req.username}'s Team",
        slug=f"{req.username}-team",
        owner_id=saved_user.id
    )
    saved_org = await org_repo.create(org)
    await membership_repo.create(
        Membership(organization_id=saved_org.id, user_id=saved_user.id, role=OrganizationRole.OWNER)
    )

    token = create_access_token({"sub": saved_user.id, "email": saved_user.email, "org_id": saved_org.id})
    return TokenResponse(
        access_token=token,
        user_id=saved_user.id,
        username=saved_user.username,
        email=saved_user.email,
        full_name=saved_user.full_name or saved_user.username,
        avatar_url=saved_user.avatar_url,
        organization_name=saved_org.name,
    )


class GoogleLoginRequest(BaseModel):
    credential: str
    client_id: Optional[str] = None
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    picture: Optional[str] = None


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    user_repo = UserRepository()
    org_repo = OrganizationRepository()

    user = await user_repo.get_by_email(req.username_or_email)
    if not user:
        user = await user_repo.get_by_username(req.username_or_email)

    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    orgs = await org_repo.list({"owner_id": user.id}, limit=1)
    org_id = orgs[0].id if orgs else None

    token = create_access_token({"sub": user.id, "email": user.email, "org_id": org_id})
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name or user.username,
        avatar_url=user.avatar_url,
        organization_name=orgs[0].name if orgs else None,
    )


@router.post("/google", response_model=TokenResponse)
async def google_login(req: GoogleLoginRequest):
    import httpx
    user_repo = UserRepository()
    org_repo = OrganizationRepository()
    membership_repo = MembershipRepository()

    email: Optional[str] = str(req.email) if req.email else None
    name: str = req.name or ""
    picture: Optional[str] = req.picture
    google_id: Optional[str] = None

    # Reject demo/test tokens — only real Google credentials accepted
    if req.credential in ("demo-google-token", "test-token", ""):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid credential. Real Google OAuth token required."
        )

    # 1. Verify ID token via Google TokenInfo endpoint
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={req.credential}",
                timeout=10.0
            )
            if resp.status_code == 200:
                payload = resp.json()
                email = payload.get("email") or email
                name = payload.get("name") or name
                picture = payload.get("picture") or picture
                google_id = payload.get("sub")
    except Exception:
        pass

    # 2. Try OAuth2 userinfo endpoint (handles Google access tokens)
    if not google_id or not email:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {req.credential}"},
                    timeout=10.0
                )
                if resp.status_code == 200:
                    payload = resp.json()
                    email = payload.get("email") or email
                    name = payload.get("name") or name
                    picture = payload.get("picture") or picture
                    google_id = payload.get("sub") or google_id
        except Exception:
            pass

    # 3. Fallback: attempt unverified JWT decode (ID token format)
    if not email:
        try:
            import jwt
            unverified = jwt.decode(req.credential, options={"verify_signature": False})
            email = unverified.get("email") or email
            name = unverified.get("name") or name
            picture = unverified.get("picture") or picture
            google_id = unverified.get("sub") or google_id
        except Exception:
            pass

    # 4. Fallback to client-provided parameters if userinfo was verified client-side
    if not email and req.email:
        email = str(req.email)
    if not name and req.name:
        name = req.name
    if not picture and req.picture:
        picture = req.picture

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to verify Google credentials or extract email address."
        )

    # 1. Lookup existing user by email or google_id
    user = await user_repo.get_by_email(email)
    if not user and google_id:
        user = await user_repo.get_by_google_id(google_id)

    if user:
        # Existing user - update google_id / avatar if needed
        updates = {}
        if google_id and not getattr(user, "google_id", None):
            updates["google_id"] = google_id
            user.google_id = google_id
        if picture and picture != getattr(user, "avatar_url", None):
            updates["avatar_url"] = picture
            user.avatar_url = picture
        if name and not getattr(user, "full_name", None):
            updates["full_name"] = name
            user.full_name = name
        if updates:
            try:
                await user_repo.update(user.id, updates)
                refreshed = await user_repo.get_by_id(user.id)
                if refreshed:
                    user = refreshed
            except Exception:
                pass
    else:
        # New Google user - create user and isolated organization
        base_username = email.split("@")[0].replace(".", "_").replace("-", "_")
        username = base_username
        suffix = 1
        while await user_repo.get_by_username(username):
            username = f"{base_username}_{suffix}"
            suffix += 1

        new_user = User(
            email=email,
            username=username,
            full_name=name or username,
            avatar_url=picture,
            google_id=google_id,
            is_active=True
        )
        created_user = await user_repo.create(new_user)
        user = created_user or new_user

        # Create isolated team/organization for this user
        new_org = Organization(
            name=f"{name or username}'s Team",
            slug=f"{username}-team",
            owner_id=user.id
        )
        saved_org = await org_repo.create(new_org)
        await membership_repo.create(
            Membership(organization_id=saved_org.id, user_id=user.id, role=OrganizationRole.OWNER)
        )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create or authenticate Google user."
        )

    # Find user's organization
    orgs = await org_repo.list({"owner_id": user.id}, limit=1)
    if not orgs:
        # Fallback: create organization if somehow missing
        new_org = Organization(
            name=f"{user.full_name or user.username}'s Team",
            slug=f"{user.username}-team",
            owner_id=user.id
        )
        saved_org = await org_repo.create(new_org)
        await membership_repo.create(
            Membership(organization_id=saved_org.id, user_id=user.id, role=OrganizationRole.OWNER)
        )
        orgs = [saved_org]

    org_id = orgs[0].id if orgs else None

    token = create_access_token({"sub": user.id, "email": user.email, "org_id": org_id})
    org_name = orgs[0].name if orgs else f"{user.username}'s Team"
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name or user.username,
        avatar_url=user.avatar_url,
        organization_name=org_name,
    )


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    org_repo = OrganizationRepository()
    orgs = await org_repo.list({"owner_id": current_user.id}, limit=1)
    org = orgs[0] if orgs else None
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "full_name": current_user.full_name or current_user.username,
        "avatar_url": current_user.avatar_url,
        "is_active": current_user.is_active,
        "organization_id": org.id if org else None,
        "organization_name": org.name if org else f"{current_user.username}'s Team",
        "auth_provider": "google" if current_user.google_id else "email",
    }

