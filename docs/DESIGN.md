# AegisCode — Engineering Design & Tradeoffs

## 1. Design Principles

1. **Deterministic State over Pure Autonomy**:
   Pure autonomous loops can easily loop indefinitely or exhibit hallucinated workflows. AegisCode enforces deterministic state transitions via a LangGraph state machine where each transition is checked by validation gates.

2. **Least-Privilege Agent Specialization**:
   No single agent has all capabilities:
   - *Supervisor*: Planning and delegation only; cannot touch code or execute terminal commands.
   - *Researcher*: Read-only filesystem and git inspection; cannot write files.
   - *Coder*: Writes code only within the isolated sandbox workspace; cannot execute commands or access host networks.
   - *Tester*: Executes approved test and lint commands inside the container sandbox; cannot push to GitHub.
   - *Security*: Read-only inspection of diffs and configs; blocks unauthorized patterns.
   - *Reviewer*: Read-only analysis of changes; generates objective review summaries.

3. **Untrusted Data Boundary**:
   All repository code, documentation, README files, issue descriptions, and tool outputs are flagged with metadata marking them as `untrusted_context`. The prompt templates strictly instruct models to treat repository instructions as passive data, mitigating indirect prompt injection.

4. **Fail-Closed Execution**:
   If an external sandbox is unavailable or unconfigured, the system fails closed rather than silently executing untrusted code on the host server.

---

## 2. Key Architecture Tradeoffs

### 2.1 Database: MongoDB Atlas vs Relational (PostgreSQL)

- **Decision**: MongoDB Atlas as primary source of truth.
- **Rationale**: Agentic workloads generate highly dynamic, hierarchical data (nested plans, tool call execution trees, variable diff statistics, step checkpoints, and execution traces). MongoDB's flexible document model natively represents these polymorphic structures while Atlas Vector Search allows co-locating semantic code chunk embeddings with repository metadata without maintaining a separate vector database.

### 2.2 Orchestration: LangGraph vs Custom Loop

- **Decision**: LangGraph with explicit typed state models.
- **Rationale**: Provides first-class checkpointing, resumable human-in-the-loop pauses, conditional routing edges, and native state persistence, while avoiding home-grown loop bugs.

### 2.3 Sandbox: Docker vs MicroVM vs In-Process

- **Decision**: Pluggable provider interface with local Docker / container sandbox and remote provider abstraction.
- **Rationale**: Prevents host system compromise. In-process execution is completely prohibited for untrusted repositories.

### 2.4 Interoperability: MCP & A2A Standards

- **Decision**: Native support for Model Context Protocol (MCP) and Agent-to-Agent (A2A).
- **Rationale**: Eliminates vendor lock-in, enabling AegisCode to expose its tools to external agent runtimes and consume external specialized agents seamlessly.
