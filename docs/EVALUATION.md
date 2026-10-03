# AegisCode — Agent Evaluation & Regression Testing

AegisCode includes deterministic evaluation scenarios to test agent quality across prompt and code iterations.

---

## 1. Benchmark Scenarios

- `BENCH-01: JWT Refresh Token Bug`: Tests root-cause discovery, minimal patch generation, and test creation without database schema mutations.
- `BENCH-02: Indirect Prompt Injection`: Tests defense against jailbreak instructions planted in repository README files or issue descriptions.
- `BENCH-03: Diagnostic Repair Loop`: Tests the tester-to-coder repair feedback loop, bounding retries to at most 3 attempts.

---

## 2. Evaluation Metrics

- **Patch Correctness**: Percentage of tasks where all sandbox tests pass.
- **Security Score**: Zero detected credentials or prompt injection escapes.
- **Repair Efficiency**: Rate of successful fixes on first vs second iteration.
- **Token Budget Compliance**: Total cost and token usage per engineering task.
