"""LangGraph-compatible Multi-Agent Workflow Engine for AegisCode."""
from typing import Optional
from agents.supervisor.agent import SupervisorAgent
from agents.researcher.agent import ResearchAgent
from agents.coder.agent import CodingAgent
from agents.tester.agent import TestingAgent
from agents.security.agent import SecurityAgent
from agents.reviewer.agent import ReviewAgent
from orchestration.graph.state import AgentTaskState
from orchestration.policies.risk_matrix import PolicyEngine
from orchestration.state.lifecycle import TaskStateManager
from sandbox import get_sandbox_provider
from integrations.github.client import GitHubAppClient
from database.repositories.task_repository import TaskRepository
from database.repositories.audit_repository import AuditRepository
from database.repositories.repository_repository import RepositoryRepository, GitHubInstallationRepository
from database.repositories.base import BaseRepository
from database.models.task import Task
from database.models.pull_request import PullRequest
from database.models.approval import Approval
from packages.contracts.models import DiffSummary
from packages.shared.constants import TaskStatus
from packages.shared.logging import get_logger

logger = get_logger("aegiscode.orchestration.workflow")


class AegisWorkflowRunner:
    def __init__(
        self,
        task_repo: Optional[TaskRepository] = None,
        audit_repo: Optional[AuditRepository] = None
    ):
        self.task_repo = task_repo or TaskRepository()
        self.audit_repo = audit_repo or AuditRepository()
        self.gh_install_repo = GitHubInstallationRepository()
        self.state_mgr = TaskStateManager(self.task_repo, self.audit_repo)
        self.supervisor = SupervisorAgent()
        self.researcher = ResearchAgent()
        self.coder = CodingAgent()
        self.tester = TestingAgent()
        self.security = SecurityAgent()
        self.reviewer = ReviewAgent()
        self.policy_engine = PolicyEngine()
        self.sandbox = get_sandbox_provider()
        self.github = GitHubAppClient()

    async def execute_task_workflow(self, task: Task) -> AgentTaskState:
        """Execute the multi-agent engineering lifecycle."""
        logger.info(f"Starting workflow execution for task: {task.id} - '{task.title}'")
        workspace_id = f"ws-{task.id}"

        # Setup initial state
        state = AgentTaskState(
            task_id=task.id,
            organization_id=task.organization_id,
            user_id=task.user_id,
            repository_id=task.repository_id,
            title=task.title,
            description=task.description,
            constraints=task.constraints,
            execution_policy=task.execution_policy,
            workspace_id=workspace_id,
            working_branch=f"aegiscode/task-{task.id[:8]}",
            status=TaskStatus.PLANNING,
        )

        # Resolve target repository from MongoDB
        repo_repo = RepositoryRepository()
        target_repo = None
        if task.repository_id:
            try:
                target_repo = await repo_repo.get_by_id(task.repository_id)
            except Exception as e:
                logger.warning(f"Could not resolve repo by direct ID: {e}")
            if not target_repo:
                all_org_repos = await repo_repo.list_by_org(task.organization_id, limit=200)
                for r in all_org_repos:
                    if r.id == task.repository_id or r.name == task.repository_id or r.full_name == task.repository_id:
                        target_repo = r
                        break
                if not target_repo:
                    for r in all_org_repos:
                        if r.name.lower() == task.repository_id.lower() or r.full_name.lower() == task.repository_id.lower():
                            target_repo = r
                            break
                if not target_repo:
                    all_repos = await repo_repo.list(limit=200)
                    for r in all_repos:
                        if r.id == task.repository_id or r.name.lower() == task.repository_id.lower() or r.full_name.lower() == task.repository_id.lower():
                            target_repo = r
                            break

        try:
            # 1. Workspace Initialization & Real Clone
            await self.sandbox.create_workspace(workspace_id)
            if target_repo:
                try:
                    auth_clone_url = None
                    gh_install = None
                    if getattr(target_repo, "github_installation_id", None):
                        gh_install = await self.gh_install_repo.get_by_installation_id(
                            target_repo.github_installation_id, organization_id=target_repo.organization_id
                        )
                    if not gh_install:
                        insts = await self.gh_install_repo.list_by_org(task.organization_id)
                        for inst in insts:
                            if getattr(inst, "auth_type", "app") == "pat" and inst.access_token:
                                gh_install = inst
                                break
                    if not gh_install:
                        all_insts = await self.gh_install_repo.list(limit=50)
                        for inst in all_insts:
                            if getattr(inst, "auth_type", "app") == "pat" and inst.access_token:
                                gh_install = inst
                                break

                    repo_slug = target_repo.full_name if "/" in target_repo.full_name else f"{getattr(gh_install, 'account_login', 'repo')}/{target_repo.name}"

                    if gh_install and getattr(gh_install, "auth_type", "app") == "pat" and gh_install.access_token:
                        auth_clone_url = f"https://x-access-token:{gh_install.access_token}@github.com/{repo_slug}.git"
                    elif self.github.is_configured and getattr(target_repo, "github_installation_id", None):
                        token = await self.github.get_installation_token(target_repo.github_installation_id)
                        auth_clone_url = f"https://x-access-token:{token}@github.com/{repo_slug}.git"
                    elif target_repo.clone_url:
                        auth_clone_url = target_repo.clone_url

                    if auth_clone_url:
                        branch_to_clone = task.branch or target_repo.default_branch or "main"
                        logger.info(f"Cloning {repo_slug} (branch: {branch_to_clone}) into workspace {workspace_id}...")
                        clone_res = await self.sandbox.execute_command(
                            workspace_id,
                            f"git clone --depth 1 -b {branch_to_clone} {auth_clone_url} ."
                        )
                        if clone_res.exit_code != 0:
                            logger.warning(f"Branch clone failed: {clone_res.stderr}. Retrying default clone...")
                            clone_res2 = await self.sandbox.execute_command(
                                workspace_id,
                                f"git clone --depth 1 {auth_clone_url} ."
                            )
                            if clone_res2.exit_code != 0:
                                logger.info(f"Cloning failed or repo empty. Initializing git workspace for {repo_slug}...")
                                await self.sandbox.execute_command(workspace_id, "git init")
                                await self.sandbox.execute_command(workspace_id, f"git remote add origin {auth_clone_url}")
                except Exception as clone_err:
                    logger.error(f"Failed to clone repository {getattr(target_repo, 'full_name', 'unknown')}: {clone_err}")

            if task.status not in (TaskStatus.CREATING_BRANCH, TaskStatus.COMMITTING, TaskStatus.CREATING_PR):
                # 2. Planning Step
                task = await self.state_mgr.transition_to(
                    task, TaskStatus.PLANNING, actor="supervisor",
                    metadata={"message": f"Formulating multi-agent execution plan for '{state.title}'"}
                )
                state.plan = await self.supervisor.plan_task(state.title, state.description, state.constraints)
                await self.task_repo.update(task.id, {"plan": state.plan.model_dump()})

                # 3. Research Step
                task = await self.state_mgr.transition_to(
                    task, TaskStatus.RESEARCHING, actor="researcher",
                    metadata={"message": "Analyzing repository files, architecture, and dependencies"}
                )
                state.research = await self.researcher.investigate(state.title, state.description, self.sandbox, workspace_id)

                # 4. Coding & Testing Bounded Repair Loop
                while state.repair_count <= state.max_repairs:
                    # Coding
                    task = await self.state_mgr.transition_to(task, TaskStatus.CODING, actor="coder")
                    state.coding = await self.coder.execute_code_changes(
                        task_title=state.title,
                        task_description=state.description,
                        research=state.research,
                        sandbox=self.sandbox,
                        workspace_id=workspace_id,
                        repair_context=state.repair_context
                    )
                    state.diff_summary = state.coding.diff_summary if (state.coding and state.coding.diff_summary) else DiffSummary()
                    await self.task_repo.update(task.id, {"diff": state.diff_summary.model_dump()})

                    # Testing
                    task = await self.state_mgr.transition_to(task, TaskStatus.TESTING, actor="tester")
                    state.testing = await self.tester.run_tests(self.sandbox, workspace_id)
                    await self.task_repo.update(task.id, {"test_results": state.testing.model_dump()})

                    if state.testing.passed:
                        break

                    # Test failed -> trigger repair if attempts remain
                    state.repair_count += 1
                    if state.repair_count <= state.max_repairs:
                        task = await self.state_mgr.transition_to(
                            task,
                            TaskStatus.REPAIRING,
                            actor="tester",
                            metadata={"attempt": state.repair_count, "analysis": state.testing.repair_analysis}
                        )
                        state.repair_context = state.testing.repair_analysis
                    else:
                        logger.warning(f"Task {task.id} exceeded maximum repair attempts ({state.max_repairs})")
                        break

                # 5. Security Step
                task = await self.state_mgr.transition_to(task, TaskStatus.SECURITY_REVIEW, actor="security")
                diff_text = "\n".join(f.patch for f in state.diff_summary.files) if state.diff_summary else ""
                state.security = await self.security.audit_diff(diff_text, state.description)
                await self.task_repo.update(task.id, {"security_results": state.security.model_dump()})

                # 6. Review Step
                task = await self.state_mgr.transition_to(task, TaskStatus.CODE_REVIEW, actor="reviewer")
                state.review = await self.reviewer.review_changes(
                    task_title=state.title,
                    task_description=state.description,
                    diff_text=diff_text,
                    test_passed=state.testing.passed if state.testing else True,
                    security_passed=state.security.passed if state.security else True
                )
                await self.task_repo.update(task.id, {"review_results": state.review.model_dump()})

                # 7. Policy Check
                needs_approval, risk_level, reason = self.policy_engine.evaluate_execution(
                    action="create_pull_request",
                    execution_policy=state.execution_policy
                )
                # Check if this task already has an approved human sign-off
                approval_repo = BaseRepository(Approval, "approvals")
                approved_records = await approval_repo.list(
                    query={"task_id": task.id, "status": "approved"}
                )
                if needs_approval and not approved_records:
                    task = await self.state_mgr.transition_to(
                        task,
                        TaskStatus.WAITING_FOR_APPROVAL,
                        actor="policy_engine",
                        metadata={"reason": reason, "risk_level": risk_level.value}
                    )
                    state.requires_approval = True
                    state.approval_reason = reason
                    return state

            # 8. GitHub PR Flow
            if task.status != TaskStatus.CREATING_BRANCH:
                task = await self.state_mgr.transition_to(task, TaskStatus.CREATING_BRANCH, actor="github")

            pr_body = (
                f"## AegisCode Automated Pull Request\n\n"
                f"### Task: {state.title}\n"
                f"{state.description}\n\n"
                f"### Changes Summary\n"
                f"{state.coding.summary if state.coding else 'Applied required changes.'}\n\n"
                f"### Verification\n"
                f"- Tests: {'PASSED' if state.testing and state.testing.passed else 'FAILED'}\n"
                f"- Security Audit: {'PASSED' if state.security and state.security.passed else 'FAILED'}\n"
                f"- Peer Review: {state.review.status.upper() if state.review else 'N/A'}\n"
            )

            head_commit_hash = None
            gh_install = None
            if target_repo:
                if getattr(target_repo, "github_installation_id", None):
                    gh_install = await self.gh_install_repo.get_by_installation_id(
                        target_repo.github_installation_id, organization_id=target_repo.organization_id
                    )
                if not gh_install:
                    insts = await self.gh_install_repo.list_by_org(task.organization_id)
                    for inst in insts:
                        if getattr(inst, "auth_type", "app") == "pat" and inst.access_token:
                            gh_install = inst
                            break
                if not gh_install:
                    all_insts = await self.gh_install_repo.list(limit=50)
                    for inst in all_insts:
                        if getattr(inst, "auth_type", "app") == "pat" and inst.access_token:
                            gh_install = inst
                            break

            is_pat = bool(gh_install and getattr(gh_install, "auth_type", "app") == "pat" and gh_install.access_token)
            can_push_pr = bool(target_repo and (is_pat or self.github.is_configured))

            if can_push_pr:
                repo_slug = target_repo.full_name if "/" in target_repo.full_name else f"{getattr(gh_install, 'account_login', 'repo')}/{target_repo.name}"
                try:
                    if is_pat and gh_install:
                        auth_push_url = f"https://x-access-token:{gh_install.access_token}@github.com/{repo_slug}.git"
                    else:
                        token = await self.github.get_installation_token(target_repo.github_installation_id)
                        auth_push_url = f"https://x-access-token:{token}@github.com/{repo_slug}.git"

                    # 1. Create and checkout branch
                    await self.sandbox.execute_command(workspace_id, 'git config credential.helper ""')
                    await self.sandbox.execute_command(workspace_id, 'git config user.name "AegisCode[bot]"')
                    await self.sandbox.execute_command(workspace_id, 'git config user.email "bot@aegiscode.ai"')
                    ch_res = await self.sandbox.execute_command(workspace_id, f"git checkout -B {state.working_branch}")
                    if ch_res.exit_code != 0:
                        await self.sandbox.execute_command(workspace_id, f"git branch -M {state.working_branch}")

                    # 2. Stage and commit
                    task = await self.state_mgr.transition_to(
                        task, TaskStatus.COMMITTING, actor="github",
                        metadata={"message": f"Committing changes to branch {state.working_branch}"}
                    )
                    await self.sandbox.execute_command(workspace_id, "git add -A")
                    commit_res = await self.sandbox.execute_command(
                        workspace_id,
                        f'git commit -m "[AegisCode] {state.title}"'
                    )
                    if commit_res.exit_code != 0 and "nothing to commit" in (commit_res.stdout + commit_res.stderr):
                        await self.sandbox.execute_command(
                            workspace_id,
                            f'git commit --allow-empty -m "[AegisCode] {state.title}"'
                        )

                    head_res = await self.sandbox.execute_command(workspace_id, "git rev-parse HEAD")
                    head_commit_hash = None
                    if head_res.exit_code == 0:
                        head_commit_hash = head_res.stdout.strip()
                        logger.info(f"Committed revision: {head_commit_hash}")

                    # 3. Push branch
                    task = await self.state_mgr.transition_to(
                        task, TaskStatus.CREATING_PR, actor="github",
                        metadata={"message": f"Pushing branch {state.working_branch} to GitHub..."}
                    )
                    rem_res = await self.sandbox.execute_command(
                        workspace_id,
                        f"git remote set-url origin {auth_push_url}"
                    )
                    if rem_res.exit_code != 0:
                        await self.sandbox.execute_command(
                            workspace_id,
                            f"git remote add origin {auth_push_url}"
                        )
                    push_res = await self.sandbox.execute_command(
                        workspace_id,
                        f"git push -u origin {state.working_branch}"
                    )
                    if push_res.exit_code != 0 and any(k in (push_res.stderr + push_res.stdout).lower() for k in ("fetch first", "non-fast-forward", "failed to push some refs")):
                        logger.info(f"Retrying push with --force for task branch {state.working_branch}...")
                        push_res = await self.sandbox.execute_command(
                            workspace_id,
                            f"git push -u origin {state.working_branch} --force"
                        )
                    if push_res.exit_code != 0:
                        raw_err = (push_res.stderr.strip() or push_res.stdout.strip() or "remote rejected")
                        err_msg = (
                            f"GitHub push failed: {raw_err}. "
                            f"Please ensure your Personal Access Token (PAT) has 'repo' (full control) write permissions for '{repo_slug}'."
                        )
                        logger.error(err_msg)
                        state.status = TaskStatus.FAILED
                        state.error = err_msg
                        await self.state_mgr.transition_to(
                            task, TaskStatus.FAILED, actor="github",
                            metadata={"error": err_msg, "message": err_msg}
                        )
                        return state

                    # 4. Create Pull Request on GitHub
                    base_branch = task.branch or target_repo.default_branch or "main"
                    try:
                        if is_pat and gh_install:
                            import httpx
                            transport = httpx.AsyncHTTPTransport(local_address="0.0.0.0")
                            async with httpx.AsyncClient(transport=transport, timeout=20.0) as client:
                                pr_headers = {
                                    "Authorization": f"Bearer {gh_install.access_token}",
                                    "Accept": "application/vnd.github.v3+json",
                                    "User-Agent": "AegisCode-App",
                                }
                                pr_resp = await client.post(
                                    f"https://api.github.com/repos/{repo_slug}/pulls",
                                    headers=pr_headers,
                                    json={
                                        "title": f"[AegisCode] {state.title}",
                                        "body": pr_body,
                                        "head": state.working_branch,
                                        "base": base_branch,
                                    },
                                )
                                if pr_resp.status_code == 422:
                                    # If PR already exists for this branch, retrieve existing PR
                                    existing_pr_resp = await client.get(
                                        f"https://api.github.com/repos/{repo_slug}/pulls",
                                        headers=pr_headers,
                                        params={"head": f"{repo_slug.split('/')[0]}:{state.working_branch}", "state": "all"},
                                    )
                                    if existing_pr_resp.status_code == 200 and existing_pr_resp.json():
                                        pr_result = existing_pr_resp.json()[0]
                                    else:
                                        err_text = pr_resp.text
                                        try:
                                            err_json = pr_resp.json()
                                            if "errors" in err_json:
                                                err_text = "; ".join(e.get("message", "") for e in err_json["errors"])
                                            elif "message" in err_json:
                                                err_text = err_json["message"]
                                        except Exception:
                                            pass
                                        raise RuntimeError(f"GitHub PR API error (HTTP {pr_resp.status_code}): {err_text}")
                                elif pr_resp.status_code not in (200, 201):
                                    err_text = pr_resp.text
                                    try:
                                        err_json = pr_resp.json()
                                        if "errors" in err_json:
                                            err_text = "; ".join(e.get("message", "") for e in err_json["errors"])
                                        elif "message" in err_json:
                                            err_text = err_json["message"]
                                    except Exception:
                                        pass
                                    raise RuntimeError(f"GitHub PR API error (HTTP {pr_resp.status_code}): {err_text}")
                                else:
                                    pr_result = pr_resp.json()
                        else:
                            pr_result = await self.github.create_pull_request(
                                installation_id=target_repo.github_installation_id,
                                repo_owner=target_repo.owner_login,
                                repo_name=target_repo.name,
                                title=f"[AegisCode] {state.title}",
                                body=pr_body,
                                head_branch=state.working_branch,
                                base_branch=base_branch
                            )
                        state.pull_request_url = pr_result.get("html_url")
                        state.pull_request_number = pr_result.get("number")
                    except Exception as e:
                        err_msg = f"Pull Request creation failed: {str(e)}"
                        logger.error(err_msg)
                        state.status = TaskStatus.FAILED
                        state.error = err_msg
                        await self.state_mgr.transition_to(
                            task, TaskStatus.FAILED, actor="github",
                            metadata={"error": err_msg, "message": err_msg}
                        )
                        return state

                    # Persist PullRequest document to MongoDB
                    try:
                        pr_repo = BaseRepository(PullRequest, "pull_requests")
                        pr_doc = PullRequest(
                            organization_id=task.organization_id,
                            task_id=task.id,
                            repository_id=target_repo.id,
                            repository_full_name=repo_slug,
                            head_branch=state.working_branch,
                            branch=state.working_branch,
                            base_branch=base_branch,
                            pr_number=state.pull_request_number,
                            github_pr_number=state.pull_request_number,
                            title=f"[AegisCode] {state.title}",
                            body=pr_body,
                            html_url=state.pull_request_url,
                            github_pr_url=state.pull_request_url,
                            state="open",
                            status="open",
                        )
                        await pr_repo.create(pr_doc)
                    except Exception as pr_db_err:
                        logger.warning(f"Could not save PullRequest record to MongoDB: {pr_db_err}")

                except Exception as gh_err:
                    err_msg = f"GitHub workflow error: {str(gh_err)}"
                    logger.error(err_msg)
                    state.status = TaskStatus.FAILED
                    state.error = err_msg
                    await self.state_mgr.transition_to(
                        task, TaskStatus.FAILED, actor="github",
                        metadata={"error": err_msg, "message": err_msg}
                    )
                    return state
            else:
                err_msg = (
                    f"GitHub PR creation failed: No authorized GitHub App or PAT integration available for "
                    f"repository '{getattr(target_repo, 'full_name', task.repository_id)}'. Cannot create pull request."
                )
                logger.error(err_msg)
                state.status = TaskStatus.FAILED
                state.error = err_msg
                await self.state_mgr.transition_to(
                    task, TaskStatus.FAILED, actor="github",
                    metadata={"error": err_msg, "message": err_msg}
                )
                return state

            await self.task_repo.update(
                task.id,
                {
                    "pull_request_url": state.pull_request_url,
                    "pull_request_number": state.pull_request_number,
                    "working_branch": state.working_branch,
                    "base_commit": head_commit_hash or task.base_commit,
                }
            )

            # 9. Complete
            task = await self.state_mgr.transition_to(
                task,
                TaskStatus.COMPLETED,
                actor="supervisor",
                metadata={"pr_url": state.pull_request_url}
            )
            state.status = TaskStatus.COMPLETED

        except Exception as exc:
            logger.error(f"Task workflow failed: {exc}", exc_info=True)
            state.status = TaskStatus.FAILED
            state.error = str(exc)
            await self.state_mgr.transition_to(task, TaskStatus.FAILED, actor="supervisor", metadata={"error": str(exc)})
        finally:
            # Clean up sandbox workspace
            await self.sandbox.destroy_workspace(workspace_id)

        return state
