"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  History,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  GitPullRequest,
  GitBranch,
  Search,
  RefreshCw,
  ArrowUpRight,
  FolderGit2,
  ShieldCheck,
  Calendar,
  Layers,
  Ban,
  LogIn,
  LogOut,
  CheckSquare,
  Sparkles,
  GitCommit,
} from "lucide-react";
import { api, getCachedApiData, hasCachedApiData } from "@/lib/api";

type StatusFilter = "ALL" | "COMPLETED" | "FAILED" | "CANCELLED" | "BLOCKED" | "WAITING_FOR_APPROVAL";

const EVENT_ICONS: Record<string, any> = {
  LOGIN: LogIn,
  LOGOUT: LogOut,
  TASK_CREATED: CheckSquare,
  TASK_STARTED: CheckSquare,
  TASK_COMPLETED: CheckSquare,
  TASK_CANCELLED: Ban,
  TASK_FAILED: AlertCircle,
  AGENT_STARTED: ShieldCheck,
  TOOL_EXECUTION: Layers,
  SANDBOX_EXECUTION: Layers,
  APPROVAL_REQUESTED: AlertCircle,
  APPROVAL_GRANTED: CheckSquare,
  APPROVAL_REJECTED: XCircle,
  BRANCH_CREATED: GitBranch,
  COMMIT_CREATED: GitCommit,
  PR_CREATED: GitPullRequest,
  GITHUB_CONNECTED: GitBranch,
  GITHUB_DISCONNECTED: Ban,
  REPOSITORY_SYNC: RefreshCw,
};

const EVENT_COLOR: Record<string, string> = {
  LOGIN: "text-brand-400",
  TASK_COMPLETED: "text-accent-emerald",
  PR_CREATED: "text-accent-emerald",
  APPROVAL_GRANTED: "text-accent-emerald",
  BRANCH_CREATED: "text-cyan-400",
  COMMIT_CREATED: "text-indigo-400",
  TASK_FAILED: "text-accent-rose",
  TASK_CANCELLED: "text-slate-400",
  APPROVAL_REJECTED: "text-accent-rose",
  APPROVAL_REQUESTED: "text-accent-amber",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  MERGED: { label: "Merged", color: "text-purple-300", bg: "bg-purple-500/10", border: "border-purple-500/40", icon: GitPullRequest },
  COMPLETED: { label: "Completed", color: "text-accent-emerald", bg: "bg-accent-emerald/10", border: "border-accent-emerald/40", icon: CheckCircle2 },
  FAILED: { label: "Failed", color: "text-accent-rose", bg: "bg-accent-rose/10", border: "border-accent-rose/40", icon: XCircle },
  CANCELLED: { label: "Cancelled", color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/40", icon: Ban },
  BLOCKED: { label: "Blocked", color: "text-accent-amber", bg: "bg-accent-amber/10", border: "border-accent-amber/40", icon: AlertCircle },
  WAITING_FOR_APPROVAL: { label: "Approval Required", color: "text-accent-amber", bg: "bg-accent-amber/10", border: "border-accent-amber/40", icon: AlertCircle },
  PLANNING: { label: "Planning", color: "text-brand-400", bg: "bg-brand-500/10", border: "border-brand-500/30", icon: Clock },
  CODING: { label: "Coding", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/30", icon: Layers },
  TESTING: { label: "Testing", color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/30", icon: ShieldCheck },
  SECURITY_REVIEW: { label: "Security", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30", icon: ShieldCheck },
  CREATING_PR: { label: "Creating PR", color: "text-brand-400", bg: "bg-brand-500/10", border: "border-brand-500/30", icon: GitPullRequest },
};

function StatusBadge({ status, prStatus }: { status: string; prStatus?: string }) {
  const effectiveStatus = prStatus === "merged" ? "MERGED" : status;
  const cfg = STATUS_CONFIG[effectiveStatus] || { label: effectiveStatus, color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/30", icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      <Icon className="h-3 w-3 shrink-0" />
      {cfg.label}
    </span>
  );
}

function formatDuration(createdAt: string, updatedAt: string): string {
  if (!createdAt || !updatedAt) return "—";
  const diff = Math.abs(new Date(updatedAt).getTime() - new Date(createdAt).getTime());
  const diffSecs = Math.max(1, Math.round(diff / 1000));
  if (diffSecs < 60) return `${diffSecs}s`;
  const mins = Math.floor(diffSecs / 60);
  const secs = diffSecs % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function HistoryContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "audit" ? "audit" : "tasks";
  const [activeTab, setActiveTab] = useState<"tasks" | "audit">(initialTab);

  // Task History State
  const [tasks, setTasks] = useState<any[]>(() => getCachedApiData("/api/history") || getCachedApiData("/api/tasks") || []);
  const [loadingTasks, setLoadingTasks] = useState(() => !hasCachedApiData("/api/history") && !hasCachedApiData("/api/tasks"));
  const [taskSearch, setTaskSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  // Audit Logs State
  const [events, setEvents] = useState<any[]>(() => getCachedApiData("/api/audit-logs") || []);
  const [loadingEvents, setLoadingEvents] = useState(() => !hasCachedApiData("/api/audit-logs"));
  const [auditSearch, setAuditSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else if (!hasCachedApiData("/api/history") && !hasCachedApiData("/api/tasks")) {
      setLoadingTasks(true);
      setLoadingEvents(true);
    }

    try {
      const [taskList, eventList] = await Promise.all([
        (api as any).history?.list
          ? (api as any).history.list()
          : api.tasks.list().catch(() => []),
        api.activity.list().catch(() => []),
      ]);
      setTasks(Array.isArray(taskList) ? taskList : []);
      setEvents(Array.isArray(eventList) ? eventList : []);
    } catch (e) {
      console.error("Failed to load history data:", e);
    } finally {
      setLoadingTasks(false);
      setLoadingEvents(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(hasCachedApiData("/api/history") || hasCachedApiData("/api/tasks"));
  }, []);

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
      if (taskSearch.trim()) {
        const s = taskSearch.toLowerCase();
        return (
          (t.title || "").toLowerCase().includes(s) ||
          (t.repository_id || "").toLowerCase().includes(s) ||
          (t.id || "").toLowerCase().includes(s) ||
          (t.working_branch || "").toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [tasks, taskSearch, statusFilter]);

  // Filtered Audit Events
  const filteredEvents = useMemo(() => {
    if (!auditSearch.trim()) return events;
    const s = auditSearch.toLowerCase();
    return events.filter((e) =>
      (e.action || "").toLowerCase().includes(s) ||
      (e.resource || "").toLowerCase().includes(s) ||
      (e.actor_type || "").toLowerCase().includes(s) ||
      (e.result || "").toLowerCase().includes(s)
    );
  }, [events, auditSearch]);

  const counts = useMemo(() => ({
    ALL: tasks.length,
    COMPLETED: tasks.filter((t) => t.status === "COMPLETED").length,
    FAILED: tasks.filter((t) => t.status === "FAILED").length,
    CANCELLED: tasks.filter((t) => t.status === "CANCELLED").length,
    BLOCKED: tasks.filter((t) => t.status === "BLOCKED").length,
    WAITING_FOR_APPROVAL: tasks.filter((t) => t.status === "WAITING_FOR_APPROVAL").length,
  }), [tasks]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <History className="h-7 w-7 text-brand-400" />
            <span>History &amp; Audit Activity</span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Immutable workspace records of task runs, branch commits, PR outcomes, and security audit logs.
          </p>
        </div>

        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="self-start sm:self-auto flex items-center gap-1.5 rounded-xl border border-surfaceBorder bg-surface px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:border-brand-500/40 transition-all shadow-sm disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-brand-400" : "text-slate-400"}`} />
          <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
        </button>
      </div>

      {/* Two Tabs: Task History vs Audit Activity */}
      <div className="flex items-center gap-2 border-b border-surfaceBorder pb-3">
        <button
          onClick={() => setActiveTab("tasks")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${activeTab === "tasks"
            ? "bg-brand-500/15 text-brand-400 border border-brand-500/40 shadow-sm"
            : "text-slate-400 hover:text-white hover:bg-surface/50 border border-transparent"
            }`}
        >
          <History className="h-4 w-4" />
          <span>Task History ({tasks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${activeTab === "audit"
            ? "bg-brand-500/15 text-brand-400 border border-brand-500/40 shadow-sm"
            : "text-slate-400 hover:text-white hover:bg-surface/50 border border-transparent"
            }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Audit Activity ({events.length})</span>
        </button>
      </div>

      {/* TAB 1: TASK HISTORY */}
      {activeTab === "tasks" && (
        <div className="space-y-5">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search by task title, repository, branch, or task ID..."
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                className="w-full rounded-xl border border-surfaceBorder bg-surface py-2.5 pl-10 pr-4 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(["ALL", "COMPLETED", "FAILED", "CANCELLED", "BLOCKED", "WAITING_FOR_APPROVAL"] as StatusFilter[]).map((filter) => {
                const count = counts[filter] ?? 0;
                return (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${statusFilter === filter
                      ? "bg-brand-500 text-slate-950 font-bold shadow-sm"
                      : "bg-surface border border-surfaceBorder text-slate-400 hover:text-white hover:bg-surface/80"
                      }`}
                  >
                    {filter === "ALL"
                      ? "All"
                      : filter === "WAITING_FOR_APPROVAL"
                        ? "Waiting Approval"
                        : filter.charAt(0) + filter.slice(1).toLowerCase()}
                    <span className="ml-1.5 opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Task Records List */}
          {loadingTasks ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-2xl border border-surfaceBorder bg-surface p-5 animate-pulse flex flex-col sm:flex-row justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-surfaceBorder rounded w-1/3" />
                    <div className="h-3 bg-surfaceBorder rounded w-1/2" />
                  </div>
                  <div className="h-8 w-24 bg-surfaceBorder rounded" />
                </div>
              ))}
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="rounded-2xl border border-surfaceBorder bg-surface p-12 text-center">
              <Sparkles className="h-8 w-8 text-slate-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">No task history yet</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {taskSearch || statusFilter !== "ALL"
                  ? "No tasks match your selected search query or status filter."
                  : "Completed, cancelled, and audited engineering tasks will appear here."}
              </p>
              <Link
                href="/tasks?new=true"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-brand-500 text-slate-950 font-bold text-xs hover:bg-brand-400 transition-colors"
              >
                <span>Create Engineering Task</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className="group rounded-2xl border border-surfaceBorder bg-surface p-4 sm:p-5 hover:border-brand-500/40 hover:bg-surface/90 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
                >
                  <div className="space-y-2.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-sm sm:text-base font-bold text-white group-hover:text-brand-400 transition-colors truncate">
                        {task.title}
                      </span>
                      <StatusBadge status={task.status} prStatus={task.pr_status} />
                    </div>

                    {task.description && (
                      <p className="text-xs text-slate-400 line-clamp-1">{task.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono">
                      <span className="flex items-center gap-1 bg-background px-2 py-0.5 rounded border border-surfaceBorder">
                        <FolderGit2 className="h-3 w-3 text-brand-400" />
                        <span>{task.repository_id}</span>
                      </span>

                      {task.working_branch && (
                        <span className="flex items-center gap-1 bg-background px-2 py-0.5 rounded border border-surfaceBorder text-slate-300">
                          <GitBranch className="h-3 w-3 text-cyan-400" />
                          <span>{task.working_branch}</span>
                        </span>
                      )}

                      {task.commit_sha && (
                        <span className="flex items-center gap-1 bg-background px-2 py-0.5 rounded border border-surfaceBorder text-slate-400">
                          <GitCommit className="h-3 w-3 text-indigo-400" />
                          <span>{task.commit_sha.slice(0, 7)}</span>
                        </span>
                      )}

                      {task.pull_request_url && (
                        <a
                          href={task.pull_request_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-accent-emerald hover:underline font-semibold bg-accent-emerald/10 border border-accent-emerald/30 px-2 py-0.5 rounded"
                        >
                          <GitPullRequest className="h-3 w-3" />
                          <span>PR {task.pull_request_number ? `#${task.pull_request_number}` : "Opened"}</span>
                        </a>
                      )}

                      <span className="flex items-center gap-1 text-slate-400">
                        <Clock className="h-3 w-3 text-slate-500" />
                        <span>{formatDuration(task.created_at, task.updated_at)}</span>
                      </span>

                      <span className="flex items-center gap-1 text-slate-500">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(task.created_at)}</span>
                      </span>
                    </div>
                  </div>

                  <Link
                    href={`/tasks/${task.id}`}
                    className="self-start sm:self-auto flex items-center gap-1.5 px-4 py-2 rounded-xl border border-surfaceBorder bg-background text-xs font-semibold text-slate-300 hover:text-white hover:border-brand-400/50 hover:bg-surface transition-all shrink-0"
                  >
                    <span>View Task Run</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-brand-400 transition-colors" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AUDIT ACTIVITY */}
      {activeTab === "audit" && (
        <div className="space-y-5">
          {/* Search Audit Logs */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search audit activity by action, resource, actor, or result..."
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              className="w-full rounded-xl border border-surfaceBorder bg-surface py-2.5 pl-10 pr-4 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
            />
          </div>

          {loadingEvents ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="rounded-xl border border-surfaceBorder bg-surface p-4 animate-pulse flex gap-3">
                  <div className="h-8 w-8 rounded-lg bg-surfaceBorder shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-surfaceBorder rounded w-1/3" />
                    <div className="h-3 bg-surfaceBorder rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="rounded-2xl border border-surfaceBorder bg-surface p-12 text-center">
              <ShieldCheck className="h-8 w-8 text-slate-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">No audit records yet</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Operational events like user authentication, GitHub connections, task dispatches, sandbox executions, and approval sign-offs will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredEvents.map((event) => {
                const Icon = EVENT_ICONS[event.action] || CheckSquare;
                const color = EVENT_COLOR[event.action] || "text-slate-400";
                return (
                  <div
                    key={event.id || `${event.action}-${event.created_at}`}
                    className="flex items-start gap-3 rounded-2xl border border-surfaceBorder bg-surface p-4 hover:bg-surface/80 transition-all shadow-sm"
                  >
                    <div className={`h-8 w-8 rounded-lg bg-background border border-surfaceBorder flex items-center justify-center shrink-0 ${color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white font-mono">{event.action}</span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 shrink-0 font-mono">
                          <Clock className="h-3 w-3 text-slate-500" />
                          <span>{formatDate(event.created_at || event.timestamp)}</span>
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-xs text-slate-400">
                        {event.resource && (
                          <span className="font-mono text-slate-300 bg-background px-2 py-0.5 rounded border border-surfaceBorder text-[11px]">
                            {event.resource}
                          </span>
                        )}
                        {event.actor_type && (
                          <span className="text-[11px] text-brand-300 font-mono">
                            Actor: {event.actor_type}
                          </span>
                        )}
                        {event.result && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${event.result === "SUCCESS"
                            ? "bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/30"
                            : "bg-accent-rose/10 text-accent-rose border border-accent-rose/30"
                            }`}>
                            {event.result}
                          </span>
                        )}
                        {event.details && typeof event.details === "object" && Object.keys(event.details).length > 0 && (
                          <span className="text-slate-400 text-[11px] truncate max-w-md font-mono bg-background/50 px-2 py-0.5 rounded">
                            {JSON.stringify(event.details)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-16 text-center">
          <RefreshCw className="h-8 w-8 animate-spin rounded-full text-brand-400 mx-auto" />
          <p className="text-xs text-slate-400 mt-2">Loading workspace history...</p>
        </div>
      }
    >
      <HistoryContent />
    </Suspense>
  );
}
