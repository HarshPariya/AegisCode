# AegisCode — System Architecture

## 1. Executive Summary

AegisCode is an enterprise-grade AI Software Engineering Platform that coordinates specialized autonomous agents (Supervisor, Researcher, Coder, Tester, Security, Reviewer) to inspect GitHub repositories, plan modifications, execute edits in isolated execution sandboxes, run regression suites, verify security guardrails, obtain human approvals for high-risk operations, and submit clean GitHub Pull Requests.

---

## 2. High-Level System Architecture

```
                                DEVELOPER
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │   Next.js Frontend   │
                         │    (Vercel Host)     │
                         └──────────┬───────────┘
                                    │ HTTPS / SSE
                                    ▼
                         ┌──────────────────────┐
                         │   FastAPI Backend    │
                         │    (Render Host)     │
                         └──────────┬───────────┘
                                    │
             ┌──────────────────────┼──────────────────────┐
             ▼                      ▼                      ▼
      MongoDB Atlas          Event Broadcaster      Execution Engine
   (Source of Truth)        (SSE Event Stream)      (Sandboxed Runner)
             │                      │                      │
             │                      └──────────┐           │
             │                                 │           ▼
             │                                 │   LangGraph Orchestrator
             │                                 │   (Supervisor Agent)
             │                                 │           │
             │                    ┌────────────┴───────────┼──────────────────────┐
             │                    ▼                        ▼                      ▼
             │             Research Agent             Coding Agent          Testing Agent
             │                    │                        │                      │
             │                    └────────────────────────┼──────────────────────┘
             │                                             ▼
             │                                       Security Agent
             │                                             │
             │                                             ▼
             │                                        Review Agent
             │                                             │
             │                                             ▼
             │                                       Policy Engine
             │                                             │
             │                              ┌──────────────┴──────────────┐
             │                              ▼                             ▼
             │                       Human Approval                 Auto Continue
             │                              │                             │
             └──────────────────────────────┴──────────────┬──────────────┘
                                                           ▼
                                                   GitHub Pull Request
```

---

## 3. Core Component Responsibilities

### 3.1 Frontend Web Application (`apps/web`)

- **Technology**: Next.js 15+ (App Router), React 19, TypeScript, Tailwind CSS.
- **Role**: Responsive, developer-first command center. Provides repository authorization, task drafting with natural language constraints, realtime streaming execution timelines, unified side-by-side diff viewers, human approval center, and observability dashboards.

### 3.2 Backend API Gateway (`services/api`)

- **Technology**: Python 3.14, FastAPI, Pydantic v2, Motor (Async MongoDB).
- **Role**: API routing, authentication (JWT/OAuth), role-based access control (RBAC), multi-tenant organization boundaries, task dispatching, GitHub App webhook verification, and SSE streaming.

### 3.3 Agent Orchestration (`orchestration/`)

- **Technology**: LangGraph state machine with deterministic checkpointer.
- **Role**: State-driven execution. Ensures that tasks transition through verified phases (`PLANNING` -> `RESEARCHING` -> `CODING` -> `TESTING` -> `REPAIRING` -> `SECURITY_REVIEW` -> `CODE_REVIEW` -> `POLICY_CHECK` -> `PR_CREATION`). Prevents infinite loops through bounded iterations.

### 3.4 Execution Sandboxing (`sandbox/`)

- **Technology**: Pluggable `SandboxProvider` (Local Docker Sandbox, Remote Container Provider, and restricted Process Sandbox).
- **Role**: Runs untrusted code, compiles projects, and executes tests in ephemeral containers with strict CPU/memory limits, read-only mounts, network restrictions, and command allowlists.

### 3.5 Interoperability Layer (`mcp/` & `a2a/`)

- **Model Context Protocol (MCP)**: Standardized gateway exposing workspace tools, git actions, terminal commands, and documentation lookups with policy enforcement.
- **Agent-to-Agent (A2A)**: Protocol layer implementing Agent Cards, capability negotiation, and secure delegation with third-party external agents.

---

## 4. End-to-End Task Lifecycle

```text
[User Request] 
      ↓
[Auth & RBAC Check] 
      ↓
[Input Guardrails & Prompt Injection Filter]
      ↓
[Task State Persisted to MongoDB (status: CREATED)]
      ↓
[Supervisor Generates Structured Plan]
      ↓
[Researcher Explores Repository & Analyzes Call Graph]
      ↓
[Coder Generates Minimal AST/Patch in Sandbox]
      ↓
[Tester Runs Test Commands in Sandbox]
      ├─ Failure? → [Diagnostic Analysis] → [Bounded Repair Loop (Max 3)]
      └─ Passed  → Continue
      ↓
[Security Agent Scans for Secrets, Injections, SSRF, & AST Violations]
      ↓
[Review Agent Evaluates Scope, Quality, and Architecture]
      ↓
[Policy Engine Evaluates Risk Matrix]
      ├─ High Risk? → [Pause Task -> WAITING_FOR_APPROVAL -> Human Signs Off]
      └─ Low Risk  → Auto-Approve
      ↓
[Git Engine Creates Branch, Commits Verified Tree, Opens Pull Request]
      ↓
[Task State Persisted as COMPLETED with Audit Log]
```
