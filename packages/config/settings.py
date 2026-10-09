"""Strongly typed application configuration settings."""
from functools import lru_cache
from typing import Literal, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Application & Environment
    ENVIRONMENT: Literal["development", "test", "production"] = "development"
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    BACKEND_PORT: int = 8000
    FRONTEND_PORT: int = 3000
    BACKEND_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:3000"
    SECRET_KEY: str = "aegiscode-dev-secret-key-32-chars-minimum-token-protection"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # MongoDB
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DATABASE: str = "aegiscode"
    MONGODB_MIN_POOL_SIZE: int = 5
    MONGODB_MAX_POOL_SIZE: int = 50

    # LLM Provider (primary)
    MODEL_PROVIDER: str = "openai"  # openai | gemini | groq | ollama | mock
    MODEL_NAME: str = "gpt-4o"
    MODEL_API_KEY: str = "mock-api-key"
    MODEL_TEMPERATURE: float = 0.0
    MODEL_MAX_TOKENS: int = 4096
    MODEL_TIMEOUT_SECONDS: int = 60
    MODEL_MAX_RETRIES: int = 3
    MODEL_RETRY_DELAY_SECONDS: float = 2.0  # Exponential backoff base delay

    # LLM Fallback Provider (activated on primary rate-limit or failure)
    MODEL_FALLBACK_PROVIDER: Optional[str] = None  # e.g. 'gemini'
    MODEL_FALLBACK_API_KEY: Optional[str] = None
    MODEL_FALLBACK_NAME: Optional[str] = None

    # Per-task LLM budget tracking
    MODEL_MAX_TOKENS_PER_TASK: int = 50000  # Across all agent calls in one task

    # GitHub App
    GITHUB_APP_ID: Optional[str] = None
    GITHUB_APP_SLUG: str = "aegiscode"
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None
    GITHUB_WEBHOOK_SECRET: Optional[str] = None
    GITHUB_PRIVATE_KEY: Optional[str] = None

    # Google Auth & Cloud
    GOOGLE_API_KEY: Optional[str] = None
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None

    # Sandbox
    SANDBOX_PROVIDER: Literal["local_process", "local_docker", "remote", "e2b"] = "local_process"
    SANDBOX_DOCKER_IMAGE: str = "python:3.12-slim"
    SANDBOX_TIMEOUT_SECONDS: int = 300
    SANDBOX_MAX_MEMORY_MB: int = 2048
    SANDBOX_MAX_CPU_CORES: int = 2
    SANDBOX_ALLOW_INTERNET: bool = True  # Allow internet access inside E2B sandbox (for git clone/push and package install during tests)

    # E2B Cloud Sandbox (https://e2b.dev)
    E2B_API_KEY: Optional[str] = None
    E2B_TEMPLATE: str = "base"  # E2B sandbox template: 'base' = python3 + node + git

    # Policies & Guardrails
    REQUIRE_APPROVAL_FOR_COMMITS: bool = False
    REQUIRE_APPROVAL_FOR_PULL_REQUESTS: bool = False
    REQUIRE_APPROVAL_FOR_COMMANDS: bool = False
    MAX_REPAIR_ATTEMPTS: int = 3
    MAX_TASK_DURATION_SECONDS: int = 1800

    # Observability
    ENABLE_OTEL: bool = False
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://localhost:4317"
    OTEL_SERVICE_NAME: str = "aegiscode-engine"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_test(self) -> bool:
        return self.ENVIRONMENT == "test"

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str, info) -> str:
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long for security.")
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
