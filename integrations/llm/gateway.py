"""Model Gateway — production-grade, provider-agnostic structured LLM invocations.

Features:
- Multiple provider support: openai, groq, gemini
- Exponential backoff retry on rate limits (429) and transient errors
- Fallback to secondary provider on primary failure
- Per-task token budget tracking
- Request timeout
- No credential exposure to frontend
- Structured JSON output with Pydantic schema validation
"""
import json
import os
import asyncio
import time
from typing import Any, Dict, List, Optional, Type, TypeVar
import httpx
from pydantic import BaseModel
from packages.config.settings import get_settings
from packages.shared.errors import ModelExecutionError
from packages.shared.logging import get_logger

logger = get_logger("aegiscode.model_gateway")

T = TypeVar("T", bound=BaseModel)

# Per-task token usage registry (in-memory; persisted as field on task in DB via caller)
_task_token_usage: Dict[str, int] = {}


def record_token_usage(task_id: str, tokens: int) -> int:
    """Record token usage for a task. Returns cumulative total."""
    total = _task_token_usage.get(task_id, 0) + tokens
    _task_token_usage[task_id] = total
    return total


def get_token_usage(task_id: str) -> int:
    """Get current token usage for a task."""
    return _task_token_usage.get(task_id, 0)


def clear_token_usage(task_id: str) -> None:
    """Clear token tracking for completed task."""
    _task_token_usage.pop(task_id, None)


class ProviderConfig:
    """Configuration for a single LLM provider."""

    def __init__(
        self,
        provider: str,
        api_key: str,
        model_name: str,
        temperature: float = 0.0,
        max_tokens: int = 4096,
        timeout_seconds: int = 60,
        max_retries: int = 3,
        retry_delay: float = 2.0,
    ):
        self.provider = provider
        self.api_key = api_key
        self.model_name = model_name
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self.retry_delay = retry_delay

    @property
    def has_real_credentials(self) -> bool:
        return bool(
            self.api_key
            and self.api_key not in ("your-api-key-here", "mock-api-key", "", "sk-placeholder")
        )

    @property
    def base_url(self) -> str:
        if self.provider == "groq":
            return "https://api.groq.com/openai/v1"
        elif self.provider == "openai":
            return "https://api.openai.com/v1"
        return "https://api.openai.com/v1"

    @property
    def effective_model(self) -> str:
        """Resolve effective model name for provider."""
        if self.provider == "groq":
            # If default/OpenAI model names are configured, map to best Groq equivalent
            if not self.model_name:
                return "openai/gpt-oss-120b"  # Default Groq model
            if self.model_name in ("gpt-4o", "gpt-4", "gpt-4-turbo"):
                return "openai/gpt-oss-120b"  # Map OpenAI names to Groq equivalent
            return self.model_name  # Use as-is (e.g. openai/gpt-oss-120b, llama-3.1-8b-instant)
        return self.model_name


class ModelGateway:
    """Production-grade model gateway with retry, fallback, and budget tracking."""

    def __init__(
        self,
        provider: Optional[str] = None,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        task_id: Optional[str] = None,
    ):
        settings = get_settings()

        # Primary provider config
        self.primary = ProviderConfig(
            provider=provider or settings.MODEL_PROVIDER,
            api_key=api_key or settings.MODEL_API_KEY,
            model_name=model_name or settings.MODEL_NAME,
            temperature=settings.MODEL_TEMPERATURE,
            max_tokens=settings.MODEL_MAX_TOKENS,
            timeout_seconds=settings.MODEL_TIMEOUT_SECONDS,
            max_retries=settings.MODEL_MAX_RETRIES,
            retry_delay=settings.MODEL_RETRY_DELAY_SECONDS,
        )

        # Fallback provider config (optional)
        self.fallback: Optional[ProviderConfig] = None
        if settings.MODEL_FALLBACK_PROVIDER and settings.MODEL_FALLBACK_API_KEY:
            self.fallback = ProviderConfig(
                provider=settings.MODEL_FALLBACK_PROVIDER,
                api_key=settings.MODEL_FALLBACK_API_KEY,
                model_name=settings.MODEL_FALLBACK_NAME or settings.MODEL_NAME,
                temperature=settings.MODEL_TEMPERATURE,
                max_tokens=settings.MODEL_MAX_TOKENS,
                timeout_seconds=settings.MODEL_TIMEOUT_SECONDS,
                max_retries=2,
                retry_delay=1.0,
            )

        self.task_id = task_id
        self.max_tokens_per_task = settings.MODEL_MAX_TOKENS_PER_TASK

    @property
    def has_real_credentials(self) -> bool:
        return self.primary.has_real_credentials

    def _check_budget(self) -> None:
        """Check if task token budget is exceeded."""
        if self.task_id:
            used = get_token_usage(self.task_id)
            if used >= self.max_tokens_per_task:
                raise ModelExecutionError(
                    f"Task {self.task_id} has exceeded LLM token budget "
                    f"({used}/{self.max_tokens_per_task} tokens). "
                    "Task will use deterministic fallback for remaining agents."
                )

    async def generate_structured(
        self,
        prompt: str,
        system_prompt: str,
        response_schema: Type[T],
        temperature: Optional[float] = None,
    ) -> T:
        """Generate structured output adhering to a Pydantic schema.

        Retry strategy:
        1. Try primary provider with exponential backoff (up to max_retries)
        2. On rate-limit (429) or timeout: wait and retry
        3. On repeated failure: try fallback provider if configured
        4. Final fallback: deterministic mock (with warning log)
        """
        settings = get_settings()
        if not self.has_real_credentials:
            if settings.is_production:
                raise ModelExecutionError(
                    "Production environment requires valid LLM credentials (MODEL_API_KEY). "
                    "Refusing to use deterministic mock for a production engineering task."
                )
            logger.debug("No real LLM credentials — using deterministic mock")
            return self._generate_deterministic_mock(response_schema, prompt)

        # Check per-task budget before calling LLM
        try:
            self._check_budget()
        except ModelExecutionError as e:
            if settings.is_production:
                raise
            logger.warning(str(e))
            return self._generate_deterministic_mock(response_schema, prompt)

        # Try primary provider
        result = await self._call_with_retry(
            self.primary, prompt, system_prompt, response_schema, temperature
        )
        if result is not None:
            return result

        # Primary failed — try fallback if configured
        if self.fallback and self.fallback.has_real_credentials:
            logger.warning(
                f"Primary LLM provider ({self.primary.provider}) failed. "
                f"Trying fallback ({self.fallback.provider})"
            )
            result = await self._call_with_retry(
                self.fallback, prompt, system_prompt, response_schema, temperature
            )
            if result is not None:
                return result

        # Both failed: In production, FAIL SAFELY. Do NOT return mock for real production task.
        if settings.is_production:
            raise ModelExecutionError(
                f"All configured production LLM providers ({self.primary.provider}"
                f"{', ' + self.fallback.provider if self.fallback else ''}) failed. "
                "Safe failure triggered — refusing to return deterministic mock for a production engineering task."
            )

        logger.warning(
            "All LLM providers failed. Using deterministic mock for this agent call. "
            "Check LLM credentials and rate limits."
        )
        return self._generate_deterministic_mock(response_schema, prompt)

    async def _call_with_retry(
        self,
        config: ProviderConfig,
        prompt: str,
        system_prompt: str,
        response_schema: Type[T],
        temperature: Optional[float],
    ) -> Optional[T]:
        """Call provider with exponential backoff retry on rate limits / transient errors."""
        last_exc = None
        for attempt in range(config.max_retries):
            try:
                if config.provider in ("openai", "groq"):
                    result = await self._call_openai_compatible(
                        config, prompt, system_prompt, response_schema, temperature
                    )
                elif config.provider == "gemini":
                    result = await self._call_gemini(
                        config, prompt, system_prompt, response_schema, temperature
                    )
                else:
                    return None

                if result is not None:
                    return result

            except RateLimitError as e:
                wait = config.retry_delay * (2 ** attempt)
                logger.warning(
                    f"[{config.provider}] Rate limit hit (attempt {attempt + 1}/{config.max_retries}). "
                    f"Waiting {wait:.1f}s before retry. Detail: {e}"
                )
                await asyncio.sleep(wait)
                last_exc = e
            except asyncio.TimeoutError:
                wait = config.retry_delay * (2 ** attempt)
                logger.warning(
                    f"[{config.provider}] Request timed out (attempt {attempt + 1}/{config.max_retries}). "
                    f"Waiting {wait:.1f}s."
                )
                await asyncio.sleep(wait)
            except Exception as exc:
                logger.warning(
                    f"[{config.provider}] Call failed (attempt {attempt + 1}/{config.max_retries}): {exc}"
                )
                last_exc = exc
                if attempt < config.max_retries - 1:
                    await asyncio.sleep(config.retry_delay)

        if last_exc:
            logger.error(f"[{config.provider}] All {config.max_retries} retries exhausted: {last_exc}")
        return None

    async def _call_openai_compatible(
        self,
        config: ProviderConfig,
        prompt: str,
        system_prompt: str,
        response_schema: Type[T],
        temperature: Optional[float],
    ) -> Optional[T]:
        """Call OpenAI-compatible API (works for OpenAI and Groq)."""
        schema_json = json.dumps(response_schema.model_json_schema())
        augmented_system = (
            f"{system_prompt}\n"
            f"You must respond strictly with valid JSON conforming to this schema:\n{schema_json}"
        )
        payload = {
            "model": config.effective_model,
            "messages": [
                {"role": "system", "content": augmented_system},
                {"role": "user", "content": prompt},
            ],
            "temperature": temperature if temperature is not None else config.temperature,
            "max_tokens": config.max_tokens,
            "response_format": {"type": "json_object"},
        }
        headers = {
            "Authorization": f"Bearer {config.api_key}",
            "Content-Type": "application/json",
            "User-Agent": "AegisCode-App/1.0",
        }

        transport = httpx.AsyncHTTPTransport(local_address="0.0.0.0")
        async with httpx.AsyncClient(transport=transport, timeout=float(config.timeout_seconds)) as client:
            resp = await client.post(
                f"{config.base_url}/chat/completions",
                headers=headers,
                json=payload
            )

            if resp.status_code == 429:
                retry_after = resp.headers.get("Retry-After", "")
                raise RateLimitError(
                    f"Rate limit exceeded. Retry-After: {retry_after}. "
                    f"Response: {resp.text[:200]}"
                )
            if resp.status_code == 401:
                logger.error(f"[{config.provider}] Invalid API key (401). Check MODEL_API_KEY.")
                return None
            if resp.status_code == 404:
                logger.error(
                    f"[{config.provider}] Model '{config.effective_model}' not found (404). "
                    f"Check MODEL_NAME in your configuration. Response: {resp.text[:200]}"
                )
                return None  # Don't retry on model-not-found
            if resp.status_code != 200:
                logger.warning(
                    f"[{config.provider}] API returned {resp.status_code}: {resp.text[:200]}"
                )
                return None

            data = resp.json()
            content = data["choices"][0]["message"]["content"]

            # Track token usage for budget enforcement
            usage = data.get("usage", {})
            total_tokens = usage.get("total_tokens", 0)
            if self.task_id and total_tokens:
                cumulative = record_token_usage(self.task_id, total_tokens)
                logger.debug(
                    f"[{config.provider}] tokens used: {total_tokens} "
                    f"(task total: {cumulative}/{self.max_tokens_per_task})"
                )

            parsed = json.loads(content)
            return response_schema.model_validate(parsed)

    async def _call_gemini(
        self,
        config: ProviderConfig,
        prompt: str,
        system_prompt: str,
        response_schema: Type[T],
        temperature: Optional[float],
    ) -> Optional[T]:
        """Call Google Gemini API."""
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{config.model_name}:generateContent?key={config.api_key}"
        )
        schema_dict = response_schema.model_json_schema()
        payload = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": temperature if temperature is not None else config.temperature,
                "maxOutputTokens": config.max_tokens,
            },
        }
        async with httpx.AsyncClient(timeout=float(config.timeout_seconds)) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 429:
                raise RateLimitError(f"Gemini rate limit: {resp.text[:200]}")
            if resp.status_code != 200:
                logger.warning(f"[gemini] API returned {resp.status_code}: {resp.text[:200]}")
                return None
            data = resp.json()
            content = data["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(content)
            return response_schema.model_validate(parsed)

    def _generate_deterministic_mock(self, response_schema: Type[T], prompt: str) -> T:
        """Deterministic mock adhering strictly to Pydantic schemas.
        Used when: no credentials, budget exceeded, or all providers fail.
        """
        schema_name = response_schema.__name__

        if schema_name == "TaskPlan":
            from packages.contracts.models import TaskPlan, PlanStep
            from packages.shared.constants import AgentRole
            return response_schema.model_validate({
                "goal": "Implement requested changes and verify stability",
                "summary": "Investigate repository architecture, modify target source files, run unit tests, and perform security verification.",
                "steps": [
                    {"step_number": 1, "title": "Explore codebase", "description": "Scan AST and dependencies", "assigned_agent": AgentRole.RESEARCHER.value, "status": "pending"},
                    {"step_number": 2, "title": "Apply code fix", "description": "Update logic and add tests", "assigned_agent": AgentRole.CODER.value, "status": "pending"},
                    {"step_number": 3, "title": "Run test suite", "description": "Execute pytest or npm test in sandbox", "assigned_agent": AgentRole.TESTER.value, "status": "pending"},
                    {"step_number": 4, "title": "Security audit", "description": "Scan for secret leaks and injection", "assigned_agent": AgentRole.SECURITY.value, "status": "pending"},
                    {"step_number": 5, "title": "Code review", "description": "Independent peer evaluation", "assigned_agent": AgentRole.REVIEWER.value, "status": "pending"},
                ],
                "estimated_complexity": "medium"
            })

        elif schema_name == "ResearchResult":
            return response_schema.model_validate({
                "summary": "Repository analysis completed. Identified relevant modules and entrypoints.",
                "suspected_root_cause": "Missing token expiration check in refresh-token handling pipeline.",
                "relevant_files": ["services/auth.py", "tests/test_auth.py"],
                "related_tests": ["pytest tests/test_auth.py"],
                "risks": ["Breaking downstream JWT clients if claim structure changes"],
                "confidence": 0.95
            })

        elif schema_name == "CodingResult":
            from packages.contracts.models import DiffSummary, FileDiff
            patch_content = (
                "--- a/services/auth.py\n"
                "+++ b/services/auth.py\n"
                "@@ -10,6 +10,10 @@\n"
                "+    if token_expired(token):\n"
                "+        raise AuthError('Refresh token expired')\n"
            )
            return response_schema.model_validate({
                "summary": "Applied token expiration check and added regression test case.",
                "modified_files": ["services/auth.py"],
                "diff_summary": {
                    "files_changed": 1,
                    "total_additions": 4,
                    "total_deletions": 0,
                    "files": [{"file_path": "services/auth.py", "status": "modified", "additions": 4, "deletions": 0, "patch": patch_content}]
                },
                "warnings": []
            })

        elif schema_name == "TestingResult":
            return response_schema.model_validate({
                "passed": True,
                "total_tests": 12,
                "passed_tests": 12,
                "failed_tests": 0,
                "test_cases": [
                    {"name": "test_token_validity", "status": "passed", "duration_seconds": 0.04},
                    {"name": "test_token_expiration_rejection", "status": "passed", "duration_seconds": 0.02}
                ],
                "raw_output": "================ 12 passed in 0.45s ================",
                "repair_needed": False,
                "repair_analysis": None
            })

        elif schema_name == "SecurityResult":
            from packages.shared.constants import RiskLevel
            return response_schema.model_validate({
                "passed": True,
                "risk_level": RiskLevel.LOW.value,
                "findings": [],
                "summary": "No hardcoded credentials, prompt injection directives, or SSRF risks detected."
            })

        elif schema_name == "ReviewResult":
            return response_schema.model_validate({
                "status": "approved",
                "summary": "Patch is clean, well-tested, adheres to project architecture, and passes all checks.",
                "findings": []
            })

        # Generic fallback
        return response_schema.model_validate({})


class RateLimitError(Exception):
    """Raised when an LLM provider returns a rate limit response (429)."""
    pass


def get_model_gateway(task_id: Optional[str] = None) -> ModelGateway:
    """Get a configured ModelGateway instance, optionally tied to a task for budget tracking."""
    return ModelGateway(task_id=task_id)
