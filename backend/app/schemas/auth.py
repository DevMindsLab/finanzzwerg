from pydantic import BaseModel, EmailStr, Field, field_validator


def _validate_email_domain(email: str) -> str:
    """Reject underscores in the domain part of an email address."""
    domain = email.rsplit("@", 1)[-1] if "@" in email else ""
    if "_" in domain:
        raise ValueError("Email domain may not contain underscores")
    return email


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)

    @field_validator("email", mode="after")
    @classmethod
    def email_domain_valid(cls, v: str) -> str:
        return _validate_email_domain(v)


class UserLogin(BaseModel):
    email: str
    password: str


class UserProfileUpdate(BaseModel):
    email: str | None = None
    current_password: str | None = None
    new_password: str | None = Field(None, min_length=8)

    @field_validator("email", mode="after")
    @classmethod
    def email_domain_valid(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return _validate_email_domain(v)


class UserResponse(BaseModel):
    id: int
    email: str
    is_active: bool

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class AccountDeleteRequest(BaseModel):
    password: str
