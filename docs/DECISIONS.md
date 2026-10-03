# AegisCode — Architecture Decision Records (ADRs)

## ADR 001: FastAPI for Backend API and Worker Execution

- **Context**: AegisCode requires high-concurrency async I/O for streaming agent events (SSE), handling webhooks, and coordinating async tasks.
- **Decision**: Python 3.14 + FastAPI + Pydantic v2.
- **Consequences**: Native async support, high performance, automatic OpenAPI schema generation, and seamless integration with Python-based AI orchestration frameworks (LangGraph, PyMongo/Motor).

## ADR 002: MongoDB Atlas as Primary Source of Truth & Vector Store

- **Context**: Need to store multi-tenant organizations, tasks, polymorph dynamic step checkpoints, tool execution logs, and semantic code embeddings.
- **Decision**: MongoDB Atlas with Atlas Vector Search.
- **Consequences**: Avoids managing separate vector and relational databases. Document model fits agent state and AST diffs naturally.

## ADR 003: LangGraph for Multi-Agent Orchestration

- **Context**: Need reliable orchestration across Supervisor, Researcher, Coder, Tester, Security, and Reviewer agents.
- **Decision**: LangGraph state graph.
- **Consequences**: Native checkpointing, cycle control with bounded retries, human-in-the-loop interruption primitives (`interrupt_before`), and explicit state models.

## ADR 004: Next.js 15+ (App Router) with Tailwind CSS for Frontend

- **Context**: Web application requiring developer-centric design, responsive layouts, code diffing, realtime streams, and high aesthetic standards.
- **Decision**: Next.js 15+ App Router, React 19, TypeScript, Tailwind CSS with custom developer dark-mode tokens.
- **Consequences**: Server and client component optimization, zero server secrets exposed, fast hydration, deployable on Vercel.

## ADR 005: Pluggable Sandbox Provider with Fail-Closed Strategy

- **Context**: Untrusted repositories may contain malicious build scripts or exploit tests.
- **Decision**: Abstract `SandboxProvider` supporting Local Docker, restricted Local Process (with command allowlists), and Remote Container providers.
- **Consequences**: Host system is never exposed to uncontained untrusted code execution.

## ADR 006: Open Protocols — MCP and A2A

- **Context**: Long-term extensibility requires tool and agent interoperability beyond proprietary APIs.
- **Decision**: Built-in Model Context Protocol (MCP) gateway and Agent-to-Agent (A2A) server/client with Agent Cards.
- **Consequences**: AegisCode agents can utilize standard MCP servers and collaborate with external A2A agents cleanly.
