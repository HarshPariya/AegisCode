# AegisCode — Threat Model & Mitigations (STRIDE)

| Threat ID | Threat Category (STRIDE) | Attack Vector | Potential Impact | AegisCode Defensive Controls |
| --- | --- | --- | --- | --- |
| **THREAT-01** | Spoofing | Malicious actor spoofing GitHub Webhook events | Triggering unauthorized agent workflows on unverified branches | HMAC-SHA256 signature verification on GitHub App webhooks using `X-Hub-Signature-256`. |
| **THREAT-02** | Tampering | Prompt injection via malicious repo files (e.g. `README.md` containing jailbreak directives) | Agent hijacking to steal tokens or alter unauthorized source files | Strict `<UNTRUSTED_REPOSITORY_DATA>` boundary tagging; system prompt hierarchy; tool permission sandboxing. |
| **THREAT-03** | Repudiation | Unaudited high-risk operations (e.g., merging PR or running terminal commands) | Inability to determine who triggered or authorized dangerous changes | Append-only immutable `audit_logs` collection with user ID, IP, timestamp, action, and cryptographic checksum. |
| **THREAT-04** | Information Disclosure | Secret leakage in agent logs, generated diffs, or SSE streams | Accidental exposure of API keys, database credentials, or private source code | Automated regex secret redaction filter on all log outputs, tool arguments, and SSE event payloads. |
| **THREAT-05** | Denial of Service | Runaway agent loops or resource exhaustion via infinite test loops | Excessive LLM token costs, cloud worker exhaustion | Bounded retry counters (`MAX_REPAIR_ATTEMPTS = 3`), execution timeouts (default 1800s), token usage budget gates. |
| **THREAT-06** | Elevation of Privilege | Host filesystem escape via sandbox escape or arbitrary shell execution | Root compromise of the hosting server | Containerized sandbox with non-root UID 1000, read-only rootfs, strict command allowlist, no Docker socket mount. |
| **THREAT-07** | Information Disclosure / SSRF | Outbound HTTP calls via agent tools to AWS metadata (169.254.169.254) or internal services | Cloud credential theft | SSRF filter blocking private RFC1918 IPs, link-local addresses, loopbacks, and cloud metadata endpoints. |
