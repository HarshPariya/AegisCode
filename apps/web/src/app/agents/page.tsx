"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Bot,
  Cpu,
  ShieldCheck,
  Code2,
  Terminal,
  Activity,
  CheckCircle2,
  AlertCircle,
  Search,
  Sparkles,
  RefreshCw,
  ArrowRight,
  ExternalLink,
  Layers,
  Zap,
  Gauge,
  Sliders,
  FileCode,
  ShieldAlert,
  GitPullRequest,
  CheckSquare,
  Lock,
  Plus,
  X,
  Play,
  Clock,
} from "lucide-react";
import { api, getCachedApiData, hasCachedApiData, getApiBaseUrl } from "@/lib/api";
import { ClientPortal } from "@/components/ClientPortal";

type ViewTab = "WORKFORCE" | "WORKFLOW" | "A2A";

interface AgentItem {
  role: string;
  name: string;
  title?: string;
  category?: string;
  description: string;
  status?: string;
  model?: string;
  temperature?: number;
  capabilities?: string[];
  tools?: string[];
  system_prompt?: string;
  metrics?: {
    success_rate?: number | null;
    avg_latency_s?: number | null;
    tasks_handled?: number;
  } | null;
}

const AGENT_THEMES: Record<
  string,
  {
    icon: any;
    gradient: string;
    border: string;
    glow: string;
    accent: string;
    badge: string;
  }
> = {
  supervisor: {
    icon: Cpu,
    gradient: "from-cyan-500/20 via-cyan-500/5 to-transparent",
    border: "border-cyan-500/40",
    glow: "shadow-cyan-500/10",
    accent: "text-cyan-400",
    badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  },
  researcher: {
    icon: Search,
    gradient: "from-blue-500/20 via-blue-500/5 to-transparent",
    border: "border-blue-500/40",
    glow: "shadow-blue-500/10",
    accent: "text-blue-400",
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  },
  coder: {
    icon: Code2,
    gradient: "from-emerald-500/20 via-emerald-500/5 to-transparent",
    border: "border-emerald-500/40",
    glow: "shadow-emerald-500/10",
    accent: "text-emerald-400",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  },
  tester: {
    icon: Terminal,
    gradient: "from-indigo-500/20 via-indigo-500/5 to-transparent",
    border: "border-indigo-500/40",
    glow: "shadow-indigo-500/10",
    accent: "text-indigo-400",
    badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
  },
  security: {
    icon: ShieldCheck,
    gradient: "from-rose-500/20 via-rose-500/5 to-transparent",
    border: "border-rose-500/40",
    glow: "shadow-rose-500/10",
    accent: "text-rose-400",
    badge: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  },
  reviewer: {
    icon: GitPullRequest,
    gradient: "from-amber-500/20 via-amber-500/5 to-transparent",
    border: "border-amber-500/40",
    glow: "shadow-amber-500/10",
    accent: "text-amber-400",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  },
};

const DEFAULT_AGENTS: AgentItem[] = [
  {
    role: "supervisor",
    name: "Supervisor Agent",
    title: "Lead Orchestrator & Task Decomposer",
    category: "Orchestration",
    description: "Decomposes complex engineering goals into directed acyclic dependency graphs, orchestrates worker handoffs, and enforces policy checkpoints.",
    status: "READY",
    model: "Aegis DeepReason v4 (Extended Architecture Reasoning)",
    temperature: 0.2,
    capabilities: ["Goal Decomposition", "DAG Workflow Routing", "Human Checkpoint Escalation", "Policy Guardrails"],
    tools: ["dispatch_agent", "generate_plan", "request_approval", "read_repo_tree"],
    system_prompt: "You are the AegisCode Lead Supervisor. Decompose engineering tasks into precise, verifiable steps. Ensure strict quality, dependency tracking, and policy adherence at every stage.",
    metrics: null,
  },
  {
    role: "researcher",
    name: "Research Agent",
    title: "Codebase Intelligence & Dependency Mapper",
    category: "Analysis",
    description: "Traverses repository ASTs, generates function call graphs, locates relevant symbols and files, and discovers architectural dependencies.",
    status: "READY",
    model: "Aegis CodeIntel v3 (Semantic AST Codebase Intelligence)",
    temperature: 0.1,
    capabilities: ["AST Exploration", "Call Graph Generation", "Symbol Definition Tracing", "Semantic Code Search"],
    tools: ["ripgrep_search", "ast_tree_sitter", "read_file", "find_references", "list_directory"],
    system_prompt: "You are the AegisCode Repository Researcher. Traverse codebases systematically, isolate relevant modules, and supply the Coding Agent with exact context without noise.",
    metrics: null,
  },
  {
    role: "coder",
    name: "Coding Agent",
    title: "Targeted Patch Synthesizer & Refactorer",
    category: "Implementation",
    description: "Synthesizes minimal, idiomatic code patches, preserves code style, implements features, and generates clean unified diffs with surgical precision.",
    status: "READY",
    model: "Aegis PatchSynthesizer Pro (Deterministic Code Generation)",
    temperature: 0.1,
    capabilities: ["Atomic Patching", "Idiomatic Refactoring", "Regression Prevention", "Type Preservation"],
    tools: ["write_file", "apply_unified_diff", "replace_code_block", "format_code"],
    system_prompt: "You are the AegisCode Senior Engineer. Generate clean, bug-free, and production-tested code patches. Do not alter unrelated functions or remove existing comments.",
    metrics: null,
  },
  {
    role: "tester",
    name: "Testing Agent",
    title: "Sandboxed Test Verification & Auto-Repair",
    category: "Verification",
    description: "Executes test suites inside isolated Docker/container sandboxes, parses failure traces, identifies root causes, and drives autonomous repair loops.",
    status: "READY",
    model: "Aegis TestHarness Engine (Sandboxed Test Runner & Loop)",
    temperature: 0.2,
    capabilities: ["Sandboxed Test Execution", "Traceback Diagnostic Parsing", "Autonomous Repair Loop", "Regression Verification"],
    tools: ["docker_exec", "run_pytest", "run_jest", "inspect_sandbox_logs"],
    system_prompt: "You are the AegisCode Testing & QA Guardian. Execute tests inside sandboxed environments, capture stderr/stdout, and trigger repair loops until all suites pass green.",
    metrics: null,
  },
  {
    role: "security",
    name: "Security Agent",
    title: "AST Security Auditor & OWASP Guard",
    category: "Security",
    description: "Scans proposed code modifications for hardcoded secrets, injection vulnerabilities (SQLi, command injection), unsafe deserialization, and prompt injection.",
    status: "READY",
    model: "Aegis SecAudit Guardian (SAST & Vulnerability Scanner)",
    temperature: 0.0,
    capabilities: ["Secret Detection", "AST Static Analysis", "OWASP Top 10 Audit", "Prompt Injection Defense"],
    tools: ["semgrep_scan", "trufflehog_regex", "bandit_security", "ast_taint_analysis"],
    system_prompt: "You are the AegisCode Security Sentinel. Block unsafe system commands, leaks of API keys, and vulnerabilities. Enforce zero-trust across all generated code.",
    metrics: null,
  },
  {
    role: "reviewer",
    name: "Review Agent",
    title: "Peer Review & Pull Request Sign-Off",
    category: "Quality",
    description: "Evaluates diffs against the initial user request, ensures architectural style consistency, drafts descriptive PR summaries, and grants final pull request sign-off.",
    status: "READY",
    model: "Aegis ReviewPolicy Neural Core (Architectural Verification)",
    temperature: 0.2,
    capabilities: ["Scope Conformance Verification", "Style & Quality Audit", "PR Narrative Generation", "Final Sign-Off Gate"],
    tools: ["git_diff_summary", "create_pull_request", "add_pr_comment", "audit_log_write"],
    system_prompt: "You are the AegisCode Principal Reviewer. Verify that code fulfills the user's requirements without scope creep. Generate comprehensive, professional GitHub PR descriptions.",
    metrics: null,
  },
];

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentItem[]>(() => getCachedApiData("/api/agents") || DEFAULT_AGENTS);
  const [a2aCards, setA2aCards] = useState<any[]>(() => getCachedApiData("/api/a2a/cards") || []);
  const [loading, setLoading] = useState(() => !hasCachedApiData("/api/agents"));
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewTab>("WORKFORCE");
  const [selectedAgent, setSelectedAgent] = useState<AgentItem | null>(null);

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else if (!hasCachedApiData("/api/agents")) setLoading(true);

    try {
      const [agentList, cards] = await Promise.all([
        api.agents.list().catch(() => []),
        api.a2a.getCards().catch(() => []),
      ]);

      if (Array.isArray(agentList) && agentList.length > 0) {
        setAgents(agentList);
      } else {
        setAgents(DEFAULT_AGENTS);
      }

      setA2aCards(Array.isArray(cards) ? cards : []);
    } catch (e) {
      console.error("Failed to load agents data:", e);
      setAgents(DEFAULT_AGENTS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(hasCachedApiData("/api/agents"));
  }, []);

  const openInspector = (agent: AgentItem) => {
    setSelectedAgent(agent);
  };

  // Derive honest workforce statistics from actual agent data
  const readyCount = agents.filter((a) => (a.status || "").toUpperCase() === "READY").length;
  const busyCount = agents.filter((a) => (a.status || "").toUpperCase() === "BUSY").length;
  const operationalCount = readyCount + busyCount;

  const renderStatusBadge = (statusStr?: string) => {
    const s = (statusStr || "READY").toUpperCase();
    if (s === "BUSY") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold shrink-0 animate-pulse">
          <Clock className="h-2.5 w-2.5" />
          BUSY
        </span>
      );
    }
    if (s === "DEGRADED" || s === "FAILED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px] font-bold shrink-0">
          <AlertCircle className="h-2.5 w-2.5" />
          {s}
        </span>
      );
    }
    if (s === "NOT_CONFIGURED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/30 text-[10px] font-bold shrink-0">
          NOT CONFIGURED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold shrink-0">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        READY
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Top Hero Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 border border-brand-500/30 text-brand-400 shadow-glow-sm">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Autonomous Agent Workforce
                </h1>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {operationalCount} of {agents.length} Online
                  {busyCount > 0 && ` (${busyCount} Active)`}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400">
                Specialized multi-agent system collaborating through LangGraph state machines and A2A interop protocols.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-xl border border-surfaceBorder bg-surface px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:border-brand-500/40 transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-brand-400" : "text-slate-400"}`} />
            <span>{refreshing ? "Refreshing..." : "Refresh Status"}</span>
          </button>

          <Link
            href="/tasks?new=true"
            className="flex items-center gap-2 rounded-xl bg-brand-500 hover:bg-brand-400 px-4 py-2 text-xs font-bold text-slate-950 transition-all shadow-glow hover:scale-[1.02] active:scale-[0.98]"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>Dispatch Agent Task</span>
          </Link>
        </div>
      </div>

      {/* Fleet Telemetry Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-surfaceBorder bg-surface/70 p-4 sm:p-5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Active Workforce</span>
            <div className="h-7 w-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Bot className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-white">{agents.length} Agents</div>
          <p className="mt-1 text-[11px] text-slate-400">Dedicated cognitive roles</p>
        </div>

        <div className="rounded-2xl border border-surfaceBorder bg-surface/70 p-4 sm:p-5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Orchestrator Graph</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-base sm:text-lg font-black text-emerald-400">LangGraph Dynamic</div>
          <p className="mt-1 text-[11px] text-slate-400">Cyclic feedback repair loops</p>
        </div>

        <div className="rounded-2xl border border-surfaceBorder bg-surface/70 p-4 sm:p-5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Interoperability</span>
            <div className="h-7 w-7 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-base sm:text-lg font-black text-indigo-400">A2A Beta Spec</div>
          <p className="mt-1 text-[11px] text-slate-400">Agent Cards discovery standard</p>
        </div>

        <div className="rounded-2xl border border-surfaceBorder bg-surface/70 p-4 sm:p-5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Execution Safety</span>
            <div className="h-7 w-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-base sm:text-lg font-black text-amber-400">Isolated Sandbox</div>
          <p className="mt-1 text-[11px] text-slate-400">Zero host contamination</p>
        </div>
      </div>

      {/* Navigation View Switcher */}
      <div className="flex items-center gap-1.5 border-b border-surfaceBorder pb-3">
        {(
          [
            { key: "WORKFORCE", label: "Agent Workforce Fleet", count: agents.length },
            { key: "WORKFLOW", label: "Multi-Agent Collaboration Graph", count: "Pipeline" },
            { key: "A2A", label: "A2A Beta (Protocol Cards)", count: a2aCards.length || 6 },
          ] as const
        ).map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${active
                ? "bg-brand-500/15 text-brand-400 border border-brand-500/30 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-surfaceBorder/40"
                }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${active ? "bg-brand-500/30 text-white font-bold" : "bg-surfaceBorder/60 text-slate-400"
                  }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* VIEW 1: FLEET GRID */}
      {activeTab === "WORKFORCE" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {agents.map((agent) => {
            const theme = AGENT_THEMES[agent.role] || AGENT_THEMES.supervisor;
            const Icon = theme.icon;
            const hasTelemetry = Boolean(agent.metrics && (agent.metrics.tasks_handled ?? 0) > 0);

            return (
              <div
                key={agent.role}
                className={`rounded-2xl border ${theme.border} bg-surface/80 p-5 sm:p-6 transition-all hover:border-brand-500/60 shadow-xl backdrop-blur-md flex flex-col justify-between relative overflow-hidden group`}
              >
                {/* Glow backdrop */}
                <div
                  className={`absolute -top-16 -right-16 h-36 w-36 rounded-full bg-gradient-to-br ${theme.gradient} blur-2xl pointer-events-none group-hover:scale-150 transition-transform duration-500`}
                />

                <div className="space-y-4 relative z-10">
                  {/* Top Role & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-surface border ${theme.border} ${theme.accent} shadow-md`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white tracking-tight leading-tight">
                          {agent.name}
                        </h3>
                        <span className="text-[11px] font-mono text-slate-400">{agent.title || agent.role}</span>
                      </div>
                    </div>

                    {renderStatusBadge(agent.status)}
                  </div>

                  {/* Model & Category Pill */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-lg bg-surface border border-surfaceBorder text-slate-300">
                      ⚡ {agent.model || "Aegis Neural Engine"}
                    </span>
                    {agent.category && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${theme.badge}`}>
                        {agent.category}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-300 leading-relaxed min-h-[48px]">{agent.description}</p>

                  {/* Capabilities */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Core Specializations
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {(agent.capabilities || []).slice(0, 4).map((cap, i) => (
                        <span
                          key={i}
                          className="text-[10.5px] px-2 py-0.5 rounded-md bg-background/80 border border-surfaceBorder/80 text-slate-300 font-mono"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Tool Permissions */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Assigned Tools
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {(agent.tools || []).slice(0, 4).map((tool, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-surfaceBorder text-slate-400 font-mono"
                        >
                          `{tool}`
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Metrics & Action Button — Truthful runtime numbers */}
                <div className="mt-5 pt-4 border-t border-surfaceBorder/60 flex items-center justify-between gap-3 relative z-10">
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <div>
                      <span className="text-slate-500 block text-[9.5px]">Success</span>
                      <span className="font-bold text-emerald-400">
                        {hasTelemetry && agent.metrics?.success_rate !== null ? `${agent.metrics?.success_rate}%` : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9.5px]">Latency</span>
                      <span className="font-bold text-white">
                        {hasTelemetry && agent.metrics?.avg_latency_s !== null ? `${agent.metrics?.avg_latency_s}s` : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9.5px]">Tasks</span>
                      <span className="font-bold text-slate-300">
                        {hasTelemetry ? agent.metrics?.tasks_handled : "0"}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => openInspector(agent)}
                    className="flex items-center gap-1 text-xs font-semibold text-brand-400 hover:text-brand-300 hover:underline transition-all"
                  >
                    <span>Inspect</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 2: WORKFLOW COLLABORATION GRAPH */}
      {activeTab === "WORKFLOW" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-surfaceBorder bg-surface p-6 sm:p-8 space-y-4">
            <div className="space-y-1">
              <span className="text-xs uppercase font-mono tracking-wider text-brand-400 font-bold">
                Stateful Workflow Engine
              </span>
              <h3 className="text-xl font-bold text-white">LangGraph Execution Topology</h3>
              <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                Deterministic cyclic graph orchestration. Each node executes with isolated state boundaries, bounded
                auto-repair retry budgets (maximum 3 attempts), and cryptographic human policy escalation.
              </p>
            </div>
          </div>

          {/* Sequential Pipeline Nodes */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                step: "01",
                role: "Supervisor",
                name: "Goal Decomposition",
                desc: "Analyzes natural language prompt & extracts file dependencies",
                color: "border-cyan-500/40 text-cyan-400 bg-cyan-500/10",
              },
              {
                step: "02",
                role: "Researcher",
                name: "AST & Symbol Discovery",
                desc: "Traverses tree-sitter AST and builds symbol call graph",
                color: "border-blue-500/40 text-blue-400 bg-blue-500/10",
              },
              {
                step: "03",
                role: "Coder",
                name: "Sandboxed Patch Synthesis",
                desc: "Generates atomic patch & writes changes to isolated sandbox",
                color: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
              },
              {
                step: "04",
                role: "Tester",
                name: "Verification & Auto-Repair",
                desc: "Runs test suite; loops back to Coder on failure (max 3 loops)",
                color: "border-indigo-500/40 text-indigo-400 bg-indigo-500/10",
              },
              {
                step: "05",
                role: "Security",
                name: "OWASP & Injection Scan",
                desc: "Scans diffs for credentials, SQLi, and prompt injections",
                color: "border-rose-500/40 text-rose-400 bg-rose-500/10",
              },
              {
                step: "06",
                role: "Reviewer",
                name: "PR Generation",
                desc: "Verifies scope & opens clean verified GitHub PR",
                color: "border-amber-500/40 text-amber-400 bg-amber-500/10",
              },
            ].map((node, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-surfaceBorder bg-surface p-4 flex flex-col justify-between space-y-3 relative group hover:border-brand-500/50 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-slate-500">STAGE {node.step}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${node.color}`}>
                    {node.role}
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{node.name}</h4>
                  <p className="text-[11px] text-slate-400 mt-1">{node.desc}</p>
                </div>
                <div className="pt-2 border-t border-surfaceBorder/60 flex items-center justify-between text-[10px] text-slate-500">
                  <span>State: Deterministic Graph</span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-brand-400" />
                <span>Deterministic Checkpoint Recovery</span>
              </h4>
              <p className="text-xs text-slate-400">
                All agent execution steps and state variables are serialized into MongoDB. If a container reboots,
                the workflow resumes exactly from the last verified checkpoint.
              </p>
            </div>
            <Link
              href="/tasks?new=true"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-brand-400 shrink-0 shadow-glow"
            >
              <span>Test LangGraph Workflow</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* VIEW 3: A2A PROTOCOL CARDS */}
      {activeTab === "A2A" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-surfaceBorder bg-surface p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs font-semibold mb-1">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Agent-to-Agent (A2A) Beta Protocol</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Registered Agent Cards</h2>
              <p className="text-xs sm:text-sm text-slate-400">
                AegisCode agents publish machine-readable Agent Cards adhering to the emerging A2A interoperability standard,
                allowing external agent networks to discover capabilities, route sub-tasks, and inspect policy boundaries.
              </p>
            </div>

            <a
              href={`${getApiBaseUrl()}/api/a2a/cards`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-xl border border-surfaceBorder bg-background px-4 py-2 text-xs font-bold text-white hover:border-brand-500/50 transition-colors shrink-0"
            >
              <span>View Raw A2A JSON</span>
              <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(a2aCards.length > 0 ? a2aCards : DEFAULT_AGENTS).map((card: any, idx: number) => (
              <div
                key={idx}
                className="rounded-2xl border border-surfaceBorder bg-surface/70 p-5 space-y-3 font-mono text-xs shadow-lg backdrop-blur-md"
              >
                <div className="flex items-center justify-between border-b border-surfaceBorder/60 pb-2">
                  <span className="text-brand-400 font-bold">{card.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-surface border border-surfaceBorder text-slate-400">
                    v{card.version || "0.1.0-beta"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 font-sans leading-relaxed">{card.description}</p>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase text-slate-500 tracking-wider font-sans">
                    A2A Declared Capabilities:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {(card.capabilities || []).map((cap: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-background border border-surfaceBorder text-cyan-300 text-[10px]">
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="pt-2 border-t border-surfaceBorder/40 flex items-center justify-between text-[10px] text-slate-500">
                  <span>Role: {card.role}</span>
                  <span className="text-indigo-400 font-bold">● A2A Beta Spec</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* INSPECTOR MODAL */}
      {selectedAgent && (
        <ClientPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
            <div className="w-full max-w-2xl rounded-3xl border border-brand-500/30 bg-[#0B101B] p-6 sm:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-4 border-b border-surfaceBorder/60 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10 border border-brand-500/30 text-brand-400">
                    <Bot className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{selectedAgent.name}</h3>
                    <p className="text-xs text-slate-400 font-mono">{selectedAgent.title || selectedAgent.role}</p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedAgent(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surfaceBorder/60 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Model & Config Settings */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-surface border border-surfaceBorder/60 space-y-0.5">
                  <span className="text-[10px] text-slate-500 uppercase">Model</span>
                  <p className="font-bold text-white truncate">{selectedAgent.model || "Aegis Neural Engine"}</p>
                </div>
                <div className="p-3 rounded-xl bg-surface border border-surfaceBorder/60 space-y-0.5">
                  <span className="text-[10px] text-slate-500 uppercase">Temperature</span>
                  <p className="font-bold text-cyan-400 font-mono">{selectedAgent.temperature ?? 0.2}</p>
                </div>
                <div className="p-3 rounded-xl bg-surface border border-surfaceBorder/60 space-y-0.5">
                  <span className="text-[10px] text-slate-500 uppercase">Success Rate</span>
                  <p className="font-bold text-emerald-400 font-mono">
                    {selectedAgent.metrics && selectedAgent.metrics.tasks_handled && selectedAgent.metrics.tasks_handled > 0 && selectedAgent.metrics.success_rate !== null
                      ? `${selectedAgent.metrics.success_rate}%`
                      : "—"}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-surface border border-surfaceBorder/60 space-y-0.5">
                  <span className="text-[10px] text-slate-500 uppercase">Status</span>
                  <div className="pt-0.5">
                    {renderStatusBadge(selectedAgent.status)}
                  </div>
                </div>
              </div>

              {/* System Prompt Instruction */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <FileCode className="h-4 w-4 text-brand-400" />
                  <span>Behavioral Directives &amp; System Prompt Excerpt</span>
                </span>
                <div className="p-4 rounded-2xl bg-black/60 border border-surfaceBorder text-xs text-slate-300 font-mono leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {selectedAgent.system_prompt ||
                    "You are an orchestrated AegisCode specialized autonomous agent. Enforce atomic patches and zero-defect execution."}
                </div>
              </div>

              {/* Allowed Tool Call Handlers */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Terminal className="h-4 w-4 text-brand-400" />
                  <span>Permitted Tool Handlers</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedAgent.tools || []).map((tool, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-surface border border-surfaceBorder text-slate-300 text-xs font-mono"
                    >
                      `{tool}`
                    </span>
                  ))}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-2 border-t border-surfaceBorder/60 flex items-center justify-end gap-3">
                <button
                  onClick={() => setSelectedAgent(null)}
                  className="px-4 py-2 rounded-xl border border-surfaceBorder text-xs font-semibold text-slate-300 hover:text-white"
                >
                  Close Inspector
                </button>
                <Link
                  href="/tasks?new=true"
                  className="px-4 py-2 rounded-xl bg-brand-500 text-slate-950 font-bold text-xs hover:bg-brand-400 transition-all shadow-glow"
                >
                  Dispatch Task to this Agent
                </Link>
              </div>
            </div>
          </div>
        </ClientPortal>
      )}
    </div>
  );
}
