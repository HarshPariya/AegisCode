# AegisCode — Observability & Tracing Architecture

## 1. Structured Logging

All backend and agent events output structured JSON in production with standardized metadata:

```json
{
  "timestamp": "2026-09-21T05:36:16.994030+00:00",
  "level": "INFO",
  "logger": "aegiscode.orchestration.workflow",
  "message": "Task ws-123 transitioned: CODING -> TESTING by tester",
  "task_id": "task-uuid",
  "run_id": "trace-uuid"
}
```

## 2. Automated Secret Redaction

The logging and SSE streaming pipelines implement regex redaction filters for:

- API Keys (`sk-...`)
- Personal Access Tokens & App Tokens (`ghp_...`, `ghs_...`)
- AWS Keys (`AKIA...`)
- Private Keys (`-----BEGIN RSA PRIVATE KEY-----`)
- Database connection strings containing passwords

## 3. Metrics & Benchmarks

Aggregated real-time metrics are accessible via `GET /api/metrics`:

- Task throughput & success rate
- Average sandbox execution duration
- Mean repair iterations
- Token consumption and estimated cloud cost
