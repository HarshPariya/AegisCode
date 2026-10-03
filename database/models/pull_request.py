"""PullRequest model."""
from typing import Optional
from database.models.base import MongoBaseModel


class PullRequest(MongoBaseModel):
    task_id: str
    organization_id: str
    repository_id: str
    repository_full_name: Optional[str] = None
    pr_number: Optional[int] = None
    github_pr_number: Optional[int] = None
    html_url: Optional[str] = None
    github_pr_url: Optional[str] = None
    title: str
    body: str = ""
    branch: Optional[str] = None
    head_branch: str = "main"
    base_branch: str = "main"
    state: str = "open"
    status: str = "open"  # open | merged | closed
    files_changed: list[str] = []
    diff_summary: Optional[str] = None
