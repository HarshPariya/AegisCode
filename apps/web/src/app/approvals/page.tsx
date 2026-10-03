"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  RefreshCw,
  Search,
  Filter,
  ShieldCheck,
  Bot,
  Terminal,
  Code2,
  ChevronDown,
  ChevronUp,
  FileCode,
  Sparkles,
  Send,
  Ban,
  Check,
  Plus,
} from "lucide-react";
import { api } from "@/lib/api";

type StatusTab = "ALL" | "PENDING" | "APPROVED" | "REJECTED";
type RiskFilter = "ALL" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

const RISK_CONFIG: Record<string, { label: string; text: string; bg: string; border: string; glow: string }> = {
  CRITICAL: {
    label: "Critical Risk",
    text: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/40",
    glow: "shadow-rose-500/10",
  },
  HIGH: {
    label: "High Risk",
    text: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/40",
    glow: "shadow-amber-500/10",
  },
  MEDIUM: {
    label: "Medium Risk",
    text: "text-brand-400",
    bg: "bg-brand-500/10",
    border: "border-brand-500/40",
    glow: "shadow-brand-500/10",
  },
  LOW: {
    label: "Low Risk",
    text: "text-slate-400",
    bg: "bg-slate-500/10",
    border: "border-slate-500/40",
    glow: "shadow-slate-500/10",
  },
};

const AGENT_LABELS: Record<string, { name: string; color: string }> = {
  supervisor: { name: "Supervisor Agent", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30" },
  researcher: { name: "Research Agent", color: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
  coder: { name: "Coding Agent", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  tester: { name: "Testing Agent", color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30" },
  security: { name: "Security Agent", color: "text-rose-400 bg-rose-500/10 border-rose-500/30" },
  reviewer: { name: "Review Agent", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
};

function formatTimeAgo(isoString: string): string {
  if (!isoString) return "just now";
  const date = new Date(isoString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusTab, setStatusTab] = useState<StatusTab>("PENDING");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [reviewerNotes, setReviewerNotes] = useState<Record<string, string>>({});
  const [expandedDiffs, setExpandedDiffs] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const fetchApprovals = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      // Fetch all approvals so the client can filter and show exact tab badges
      const data = await api.approvals.list("all");
      setApprovals(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error("Failed to fetch approvals:", e);
      setApprovals([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
    const interval = setInterval(() => {
      api.approvals.list("all").then((data) => {
        if (Array.isArray(data)) setApprovals(data);
      }).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (approval: any) => {
    setActionLoadingId(approval.id);
    setFeedback(null);
    try {
      const notes = reviewerNotes[approval.id] || "Approved by developer via Human-in-the-Loop UI";
      if (api.approvals.approveById) {
        await api.approvals.approveById(approval.id, notes);
      } else {
        await api.approvals.approve(approval.task_id, notes);
      }
      setFeedback({
        type: "success",
        message: `Operation approved for task "${approval.task_title || approval.task_id}". Autonomous execution resumed.`,
      });
      await fetchApprovals(true);
    } catch (e: any) {
      setFeedback({
        type: "error",
        message: `Failed to approve operation: ${e.message || "Unknown error"}`,
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (approval: any) => {
    setActionLoadingId(approval.id);
    setFeedback(null);
    try {
      const notes = reviewerNotes[approval.id] || "Rejected by developer via Human-in-the-Loop UI";
      if (api.approvals.rejectById) {
        await api.approvals.rejectById(approval.id, notes);
      } else {
        await api.approvals.reject(approval.task_id, notes);
      }
      setFeedback({
        type: "info",
        message: `Operation rejected for task "${approval.task_title || approval.task_id}". Execution safely halted.`,
      });
      await fetchApprovals(true);
    } catch (e: any) {
      setFeedback({
        type: "error",
        message: `Failed to reject operation: ${e.message || "Unknown error"}`,
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const toggleDiff = (id: string) => {
    setExpandedDiffs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Counts
  const pendingCount = approvals.filter((a) => (a.status || "").toLowerCase() === "pending").length;
  const approvedCount = approvals.filter((a) => (a.status || "").toLowerCase() === "approved").length;
  const rejectedCount = approvals.filter((a) => (a.status || "").toLowerCase() === "rejected").length;

  const filteredApprovals = useMemo(() => {
    return approvals.filter((item) => {
      const itemStatus = (item.status || "").toUpperCase();

      if (statusTab === "PENDING" && itemStatus !== "PENDING") return false;
      if (statusTab === "APPROVED" && itemStatus !== "APPROVED") return false;
      if (statusTab === "REJECTED" && itemStatus !== "REJECTED") return false;

      if (riskFilter !== "ALL") {
        const itemRisk = (item.risk_level || "MEDIUM").toUpperCase();
        if (itemRisk !== riskFilter) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = (item.task_title || "").toLowerCase().includes(q);
        const matchesAction = (item.action || "").toLowerCase().includes(q);
        const matchesReason = (item.reason || "").toLowerCase().includes(q);
        const matchesAgent = (item.requested_by_agent || "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesAction && !matchesReason && !matchesAgent) return false;
      }

      return true;
    });
  }, [approvals, statusTab, riskFilter, searchQuery]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-glow-sm">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Approvals Center</h1>
                {pendingCount > 0 && (
                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-bold animate-pulse">
                    <AlertCircle className="h-3 w-3" />
                    {pendingCount} Pending
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-400">
                Human-in-the-loop governance for high-risk operations, DDL migrations, and security checkpoints.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchApprovals(true)}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-xl border border-surfaceBorder bg-surface px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:border-brand-500/40 transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-brand-400" : "text-slate-400"}`} />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`rounded-xl border p-4 text-xs flex items-center justify-between gap-3 animate-fade-in ${feedback.type === "success"
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            : feedback.type === "error"
              ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
              : "border-brand-500/30 bg-brand-500/10 text-brand-300"
            }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === "success" && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
            {feedback.type === "error" && <XCircle className="h-4 w-4 shrink-0 text-rose-400" />}
            {feedback.type === "info" && <ShieldAlert className="h-4 w-4 shrink-0 text-brand-400" />}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white font-mono text-xs px-2 py-0.5 rounded"
          >
            ✕
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-surfaceBorder bg-surface/70 p-4 sm:p-5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Action Required</span>
            <div className="h-7 w-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-400">{pendingCount}</div>
          <p className="mt-1 text-[11px] text-slate-500">Operations waiting for review</p>
        </div>

        <div className="rounded-2xl border border-surfaceBorder bg-surface/70 p-4 sm:p-5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Approved Operations</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-400">{approvedCount}</div>
          <p className="mt-1 text-[11px] text-slate-500">Executed with user consent</p>
        </div>

        <div className="rounded-2xl border border-surfaceBorder bg-surface/70 p-4 sm:p-5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Rejected & Blocked</span>
            <div className="h-7 w-7 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Ban className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-rose-400">{rejectedCount}</div>
          <p className="mt-1 text-[11px] text-slate-500">Prevented dangerous side effects</p>
        </div>

        <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-4 sm:p-5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-300">Policy Guard</span>
            <div className="h-7 w-7 rounded-lg bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-sm font-bold text-white">Zero-Trust Active</div>
          <p className="mt-1 text-[11px] text-slate-400">Mandatory verification on high-risk actions</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-surface border border-surfaceBorder rounded-2xl p-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {(
            [
              { key: "PENDING", label: "Pending", count: pendingCount, color: "text-amber-400" },
              { key: "ALL", label: "All Records", count: approvals.length, color: "text-slate-300" },
              { key: "APPROVED", label: "Approved", count: approvedCount, color: "text-emerald-400" },
              { key: "REJECTED", label: "Rejected", count: rejectedCount, color: "text-rose-400" },
            ] as const
          ).map((tab) => {
            const active = statusTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setStatusTab(tab.key)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${active
                  ? "bg-brand-500/15 text-brand-400 border border-brand-500/30 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-surfaceBorder/40"
                  }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${active ? "bg-brand-500/30 text-white font-bold" : "bg-surfaceBorder/60 text-slate-400"
                    }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Risk Level Filter */}
        <div className="flex items-center gap-2 self-stretch md:self-auto">
          <div className="relative flex-1 md:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by task, action, agent..."
              className="w-full rounded-xl border border-surfaceBorder/80 bg-background pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-brand-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-500 shrink-0 hidden sm:block" />
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as RiskFilter)}
              aria-label="Filter approvals by risk level"
              className="rounded-xl border border-surfaceBorder/80 bg-background px-2.5 py-1.5 text-xs text-slate-300 focus:border-brand-400 focus:outline-none"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="CRITICAL">Critical Risk</option>
              <option value="HIGH">High Risk</option>
              <option value="MEDIUM">Medium Risk</option>
              <option value="LOW">Low Risk</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Approvals Content List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-surfaceBorder bg-surface p-6 animate-pulse space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-4 bg-surfaceBorder rounded w-1/4" />
                <div className="h-4 bg-surfaceBorder rounded w-20" />
              </div>
              <div className="h-5 bg-surfaceBorder rounded w-3/4" />
              <div className="h-16 bg-surfaceBorder/40 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredApprovals.length === 0 ? (
        /* Empty State */
        <div className="rounded-3xl border border-surfaceBorder bg-surface/40 p-12 text-center space-y-4 shadow-xl backdrop-blur-md">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 border border-brand-500/30 text-brand-400 shadow-glow-sm">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-lg font-bold text-white">No Approvals Found</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {statusTab === "PENDING"
                ? "All clear! There are no operations currently requiring human approval. AegisCode autonomous agents are safely operating within policy bounds."
                : "No approval records match your current filter criteria."}
            </p>
          </div>
          {statusTab === "PENDING" && (
            <div className="pt-2">
              <Link
                href="/tasks?new=true"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-brand-400 shadow-glow transition-all hover:scale-[1.02]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create Engineering Task</span>
              </Link>
            </div>
          )}
        </div>
      ) : (
        /* Approvals Grid / Cards */
        <div className="space-y-4">
          {filteredApprovals.map((item) => {
            const risk = (item.risk_level || "MEDIUM").toUpperCase();
            const riskMeta = RISK_CONFIG[risk] || RISK_CONFIG.MEDIUM;
            const agentKey = (item.requested_by_agent || "supervisor").toLowerCase();
            const agentMeta = AGENT_LABELS[agentKey] || { name: item.requested_by_agent || "Agent", color: "text-slate-300 bg-slate-500/10 border-slate-500/30" };
            const isPending = (item.status || "").toLowerCase() === "pending";
            const isApproved = (item.status || "").toLowerCase() === "approved";
            const isRejected = (item.status || "").toLowerCase() === "rejected";
            const isExpanded = !!expandedDiffs[item.id];
            const isActing = actionLoadingId === item.id;

            return (
              <div
                key={item.id}
                className={`rounded-2xl border bg-surface/80 p-5 sm:p-6 transition-all shadow-xl backdrop-blur-md relative overflow-hidden ${isPending
                  ? `border-l-4 ${riskMeta.border} border-surfaceBorder`
                  : isApproved
                    ? "border-l-4 border-l-emerald-500 border-surfaceBorder opacity-95"
                    : "border-l-4 border-l-rose-500 border-surfaceBorder opacity-80"
                  }`}
              >
                {/* Header Meta Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surfaceBorder/60 pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Risk Badge */}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${riskMeta.text} ${riskMeta.bg} ${riskMeta.border}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${isPending ? "animate-pulse" : ""} ${risk === "CRITICAL" ? "bg-rose-400" : risk === "HIGH" ? "bg-amber-400" : "bg-cyan-400"}`} />
                      {riskMeta.label}
                    </span>

                    {/* Requesting Agent Badge */}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-medium ${agentMeta.color}`}>
                      <Bot className="h-3 w-3 shrink-0" />
                      <span>{agentMeta.name}</span>
                    </span>

                    {/* Status Pill */}
                    {isPending && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[11px] font-bold">
                        <Clock className="h-3 w-3" />
                        Pending Review
                      </span>
                    )}
                    {isApproved && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold">
                        <CheckCircle2 className="h-3 w-3" />
                        Approved
                      </span>
                    )}
                    {isRejected && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[11px] font-bold">
                        <XCircle className="h-3 w-3" />
                        Rejected
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2">
                    <span>{formatTimeAgo(item.created_at)}</span>
                    <span className="text-slate-700">•</span>
                    <span className="truncate max-w-[120px] text-slate-400">ID: {item.id.slice(0, 8)}</span>
                  </div>
                </div>

                {/* Operation Title & Task Link */}
                <div className="mt-3.5 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                    <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                      <Terminal className="h-4 w-4 text-brand-400 shrink-0" />
                      <span>{item.action || "High-Risk Operation Request"}</span>
                    </h3>

                    {item.task_id && (
                      <Link
                        href={`/tasks/${item.task_id}`}
                        className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 font-semibold hover:underline shrink-0"
                      >
                        <span>Task: {item.task_title || item.task_id.slice(0, 8)}</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>

                  {/* Agent Rationale & Justification */}
                  <div className="rounded-xl border border-surfaceBorder/80 bg-background/60 p-3.5 text-xs text-slate-300 leading-relaxed space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-400 font-semibold text-[11px]">
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                      <span>Agent Safety Escalation:</span>
                    </div>
                    <p className="text-slate-300">
                      {item.reason || "This operation alters database schemas or sensitive environment variables and triggers mandatory human verification."}
                    </p>
                  </div>
                </div>

                {/* Code Diff / Operation Payload (if available) */}
                {item.diff && (
                  <div className="mt-3 rounded-xl border border-surfaceBorder/80 bg-[#060A12] overflow-hidden">
                    <button
                      onClick={() => toggleDiff(item.id)}
                      className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-surface/50 border-b border-surfaceBorder/60 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Code2 className="h-3.5 w-3.5 text-brand-400" />
                        <span>Proposed Patch / Payload Preview</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500">
                        <span>{isExpanded ? "Collapse" : "Expand"}</span>
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </div>
                    </button>

                    {(isExpanded || isPending) && (
                      <div className="p-3 overflow-x-auto text-[11.5px] font-mono text-slate-300 max-h-56 leading-relaxed">
                        <pre className="whitespace-pre">
                          {item.diff.split("\n").map((line: string, idx: number) => {
                            let lineClass = "text-slate-400";
                            if (line.startsWith("+") && !line.startsWith("+++")) lineClass = "text-emerald-400 bg-emerald-500/10 px-1 rounded-sm";
                            else if (line.startsWith("-") && !line.startsWith("---")) lineClass = "text-rose-400 bg-rose-500/10 px-1 rounded-sm";
                            else if (line.startsWith("@")) lineClass = "text-cyan-400";
                            return (
                              <div key={idx} className={lineClass}>
                                {line}
                              </div>
                            );
                          })}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {/* Past Decision History if resolved */}
                {!isPending && (
                  <div className="mt-3.5 rounded-xl border border-surfaceBorder/60 bg-surface/40 p-3 text-xs flex items-center justify-between gap-3 text-slate-400">
                    <div className="flex items-center gap-2">
                      {isApproved ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
                      )}
                      <span>
                        {isApproved ? "Approved" : "Rejected"} by Reviewer:{" "}
                        <span className="text-white font-medium">
                          {item.decision_reason || (isApproved ? "Approved via UI" : "Rejected via UI")}
                        </span>
                      </span>
                    </div>
                    {item.decided_at && (
                      <span className="text-[11px] text-slate-500 font-mono shrink-0">
                        {new Date(item.decided_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                )}

                {/* Pending Action Controls */}
                {isPending && (
                  <div className="mt-4 pt-3.5 border-t border-surfaceBorder/60 space-y-3">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                      <input
                        type="text"
                        placeholder="Optional reviewer notes or instructions for the agent..."
                        value={reviewerNotes[item.id] || ""}
                        onChange={(e) =>
                          setReviewerNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        className="flex-1 rounded-xl border border-surfaceBorder/80 bg-background px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-brand-400 focus:outline-none"
                      />

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleReject(item)}
                          disabled={isActing}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-white px-4 py-2 text-xs font-bold transition-all disabled:opacity-50"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          <span>{isActing ? "Processing..." : "Reject & Halt"}</span>
                        </button>

                        <button
                          onClick={() => handleApprove(item)}
                          disabled={isActing}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 text-xs transition-all shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>{isActing ? "Processing..." : "Approve & Resume"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
