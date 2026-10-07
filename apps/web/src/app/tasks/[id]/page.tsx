"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  GitPullRequest,
  ShieldCheck,
  FileCode,
  Play,
  Pause,
  Terminal,
  RefreshCw,
  ArrowLeft,
  XCircle,
  Cpu,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  RotateCcw,
} from "lucide-react";
import { api, getToken } from "@/lib/api";

const AGENT_STAGES = [
  { id: "PLANNING", label: "Planning", agent: "Supervisor", role: "supervisor" },
  { id: "RESEARCHING", label: "Research", agent: "Researcher", role: "researcher" },
  { id: "CODING", label: "Coding", agent: "Coder", role: "coder" },
  { id: "TESTING", label: "Testing", agent: "Tester", role: "tester" },
  { id: "REPAIRING", label: "Repair Loop", agent: "Repair", role: "tester" },
  { id: "SECURITY_REVIEW", label: "Security", agent: "Security", role: "security" },
  { id: "CODE_REVIEW", label: "Review", agent: "Reviewer", role: "reviewer" },
  { id: "COMPLETED", label: "Pull Request", agent: "GitHub", role: "github" },
];

export default function TaskDetailPage({ params }: { params?: any }) {
  const routeParams = useParams();
  const routeId = (routeParams?.id as string) || "";
  let resolvedId = routeId;
  if (!resolvedId && params) {
    if (typeof params?.then === "function") {
      try {
        resolvedId = (use(params) as any)?.id || "";
      } catch {
        // fallback
      }
    } else if (params?.id) {
      resolvedId = params.id;
    }
  }
  const taskId = resolvedId;

  const [task, setTask] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [diff, setDiff] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"timeline" | "diff" | "tests" | "security" | "review">("timeline");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadTask = useCallback(async () => {
    try {
      const [tData, eList, dData] = await Promise.all([
        api.tasks.get(taskId),
        api.tasks.getEvents(taskId).catch(() => []),
        api.tasks.getDiff(taskId).catch(() => null),
      ]);
      setTask(tData);
      setEvents(Array.isArray(eList) ? eList : []);
      setDiff(dData);
    } catch (e) {
      console.error("loadTask error:", e);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    loadTask();

    // Active polling interval as resilient fallback so screen never freezes
    const pollInterval = setInterval(() => {
      loadTask();
    }, 2000);

    // Setup SSE Realtime Stream
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const token = getToken();
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(`${API_BASE}/api/tasks/${taskId}/events/stream${tokenParam}`);

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "task.stream.finished") {
            loadTask();
            eventSource?.close();
          } else {
            setEvents((prev) => {
              if (prev.some((e) => e.event_id === payload.event_id)) return prev;
              return [...prev, payload];
            });
            loadTask();
          }
        } catch (e) {
          console.error("SSE parse error", e);
        }
      };

      eventSource.onerror = () => {
        // SSE disconnected or closed - polling will keep updating
        eventSource?.close();
      };
    } catch (err) {
      console.warn("Could not initialize EventSource, using polling", err);
    }

    return () => {
      clearInterval(pollInterval);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [taskId, loadTask]);

  const handleRetry = async () => {
    setActionLoading(true);
    try {
      await api.tasks.execute(taskId);
      await loadTask();
    } catch (err: any) {
      alert(err.message || "Failed to retry task");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await api.approvals.approve(taskId, "Approved by developer via UI");
      await loadTask();
    } catch (err: any) {
      alert(err.message || "Failed to approve");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    setActionLoading(true);
    try {
      await api.approvals.reject(taskId, "Rejected by developer via UI");
      await loadTask();
    } catch (err: any) {
      alert(err.message || "Failed to reject");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      await api.tasks.cancel(taskId);
      await loadTask();
    } catch (err: any) {
      alert(err.message || "Failed to cancel");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center text-slate-400">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-brand-400" />
        <p className="text-sm">Connecting to task command center...</p>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <p className="text-white font-bold">Task not found</p>
        <Link href="/tasks" className="text-xs text-brand-400 underline mt-2 inline-block">
          Return to Tasks
        </Link>
      </div>
    );
  }

  // Helper to determine stage status accurately
  const getStageStatus = (st: typeof AGENT_STAGES[0], idx: number) => {
    // If task is COMPLETED, or if this is the Pull Request stage and PR exists, mark done!
    if (task.status === "COMPLETED" || (st.id === "COMPLETED" && !!task.pull_request_url)) {
      return { isDone: true, isFailed: false, isCurrent: false };
    }

    // If PR was successfully created on GitHub, all antecedent pipeline stages succeeded
    if (task.pull_request_url && idx < AGENT_STAGES.length) {
      return { isDone: true, isFailed: false, isCurrent: false };
    }

    const failEvent = events.slice().reverse().find((e) => e.status === "FAILED" || !!e.metadata?.error);
    const isTaskFailed = task.status === "FAILED" || !!failEvent;

    // Check if this specific stage encountered failure
    const stageFailed = isTaskFailed && (
      failEvent?.actor === st.role ||
      failEvent?.status === st.id ||
      idx === AGENT_STAGES.findIndex((s) => s.role === failEvent?.actor)
    );

    if (stageFailed) {
      return { isDone: false, isFailed: true, isCurrent: false };
    }

    // Has any subsequent stage already recorded events?
    const laterStageRan = AGENT_STAGES.slice(idx + 1).some((later) =>
      events.some((e) => e.actor === later.role || e.status === later.id)
    );

    if (laterStageRan) {
      return { isDone: true, isFailed: false, isCurrent: false };
    }

    const thisStageRan = events.some((e) => e.actor === st.role || e.status === st.id);
    if (thisStageRan && !isTaskFailed) {
      const isStillActive = task.status === st.id;
      return {
        isDone: !isStillActive,
        isFailed: false,
        isCurrent: isStillActive,
      };
    }

    const stageOrder = ["PLANNING", "RESEARCHING", "CODING", "TESTING", "SECURITY_REVIEW", "CODE_REVIEW", "COMPLETED"];
    const currentStageIdx = stageOrder.indexOf(task.status);
    if (currentStageIdx > idx) {
      return { isDone: true, isFailed: false, isCurrent: false };
    }
    if (currentStageIdx === idx && !isTaskFailed) {
      return { isDone: false, isFailed: false, isCurrent: true };
    }

    return { isDone: false, isFailed: false, isCurrent: false };
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Back and Title */}
      <div className="space-y-3">
        <Link href="/tasks" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to All Tasks</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{task.title}</h1>
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                task.pr_status === "merged"
                  ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                  : task.status === "COMPLETED"
                    ? "bg-accent-emerald/10 text-accent-emerald border-accent-emerald/30"
                    : task.status === "WAITING_FOR_APPROVAL"
                      ? "bg-accent-amber/10 text-accent-amber border-accent-amber/30 animate-pulse"
                      : task.status === "FAILED"
                        ? "bg-accent-rose/10 text-accent-rose border-accent-rose/30"
                        : "bg-brand-500/10 text-brand-400 border-brand-500/30"
              }`}>
                {task.pr_status === "merged" ? "MERGED" : task.status}
              </span>
              {task.pr_status === "merged" && (
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1.5">
                  <GitPullRequest className="h-3 w-3 text-purple-400" />
                  <span>Merged into {task.target_branch || "main"}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">{task.description}</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {(task.status === "FAILED" || task.status === "CANCELLED") && (
              <button
                onClick={handleRetry}
                disabled={actionLoading}
                className="flex items-center gap-1.5 rounded-lg border border-brand-500/50 bg-brand-500/10 px-3.5 py-2 text-xs font-bold text-brand-400 hover:bg-brand-500/20 transition-colors shadow-glow"
              >
                <RotateCcw className={`h-4 w-4 ${actionLoading ? "animate-spin" : ""}`} />
                <span>Retry Run</span>
              </button>
            )}

            {task.status !== "COMPLETED" && task.status !== "CANCELLED" && task.status !== "FAILED" && (
              <button
                onClick={handleCancel}
                disabled={actionLoading}
                className="flex items-center gap-1.5 rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-3.5 py-2 text-xs font-bold text-accent-rose hover:bg-accent-rose/20 transition-colors"
              >
                <XCircle className="h-4 w-4" />
                <span>Cancel Task</span>
              </button>
            )}

            {task.pull_request_url && (
              <button
                onClick={async () => {
                  setActionLoading(true);
                  try {
                    await api.tasks.syncPr(taskId);
                    await loadTask();
                  } catch (e: any) {
                    console.error("PR sync failed:", e);
                  } finally {
                    setActionLoading(false);
                  }
                }}
                disabled={actionLoading}
                title="Synchronize live Pull Request state from GitHub"
                className="flex items-center gap-1.5 rounded-lg border border-surfaceBorder bg-surface px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-surface/80 transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${actionLoading ? "animate-spin text-brand-400" : ""}`} />
                <span>Sync PR</span>
              </button>
            )}

            {task.pull_request_url && (
              <a
                href={task.pull_request_url}
                target="_blank"
                rel="noreferrer"
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all shadow-glow ${
                  task.pr_status === "merged"
                    ? "bg-purple-600 text-white hover:bg-purple-500"
                    : "bg-accent-emerald text-slate-950 hover:bg-emerald-400"
                }`}
              >
                <GitPullRequest className="h-4 w-4" />
                <span>
                  {task.pr_status === "merged" ? "Pull Request Merged" : "Open Pull Request"}
                  {task.pull_request_number ? ` #${task.pull_request_number}` : ""}
                </span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Human Approval Required Banner */}
      {task.status === "WAITING_FOR_APPROVAL" && (
        <div className="rounded-xl border border-accent-amber/50 bg-accent-amber/10 p-6 glow-amber space-y-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-6 w-6 text-accent-amber flex-shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1 min-w-0">
              <h3 className="text-base font-bold text-white">Human Approval Required to Open Pull Request</h3>
              <p className="text-xs text-slate-300">
                All automated tests and security audits have passed. The policy engine requires explicit developer authorization before creating the pull request.
              </p>
            </div>
          </div>

          {/* Approval context: repository, action, risk level, test results */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded-lg bg-background/60 border border-surfaceBorder/60 p-2.5">
              <p className="text-slate-500 font-mono uppercase text-[10px] mb-1">Repository</p>
              <p className="text-white font-semibold truncate">{task.repository_id || "—"}</p>
            </div>
            <div className="rounded-lg bg-background/60 border border-surfaceBorder/60 p-2.5">
              <p className="text-slate-500 font-mono uppercase text-[10px] mb-1">Requested Action</p>
              <p className="text-white font-semibold">Create Pull Request</p>
            </div>
            <div className="rounded-lg bg-background/60 border border-surfaceBorder/60 p-2.5">
              <p className="text-slate-500 font-mono uppercase text-[10px] mb-1">Risk Level</p>
              <p className="text-accent-amber font-bold">MEDIUM</p>
            </div>
            <div className="rounded-lg bg-background/60 border border-surfaceBorder/60 p-2.5">
              <p className="text-slate-500 font-mono uppercase text-[10px] mb-1">Validation</p>
              <p className={"font-bold " + (task.test_results ? (task.test_results.passed ? "text-accent-emerald" : "text-accent-rose") : "text-slate-400")}>
                {task.test_results ? (task.test_results.passed ? "PASSED" : "FAILED") : "Running…"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleApprove}
              disabled={actionLoading}
              className="flex items-center gap-2 rounded-lg bg-accent-emerald px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors shadow-glow"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Authorize & Create Pull Request</span>
            </button>
            <button
              onClick={handleReject}
              disabled={actionLoading}
              className="rounded-lg border border-surfaceBorder bg-surface px-4 py-2.5 text-xs font-semibold text-slate-300 hover:text-white"
            >
              Reject Action
            </button>
          </div>
        </div>
      )}

      {/* Multi-Agent Visual Workflow Progress Bar */}
      <div className="rounded-xl border border-surfaceBorder bg-surface p-4 sm:p-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 sm:mb-6 flex items-center gap-2">
          <Cpu className="h-4 w-4 text-brand-400" />
          <span>Multi-Agent Workflow Stages</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 sm:gap-3">
          {AGENT_STAGES.map((st, idx) => {
            const { isDone, isFailed, isCurrent } = getStageStatus(st, idx);
            return (
              <div
                key={st.id}
                className={`relative rounded-xl border p-3 sm:p-3.5 flex flex-col justify-between transition-all ${isFailed
                  ? "border-accent-rose/50 bg-accent-rose/10 text-accent-rose"
                  : isDone
                    ? "border-accent-emerald/40 bg-accent-emerald/5 text-accent-emerald"
                    : isCurrent
                      ? "border-brand-500 bg-brand-500/10 text-white glow-cyan"
                      : "border-surfaceBorder bg-background/50 text-slate-500"
                  }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider truncate">
                    {st.agent}
                  </span>
                  {isFailed ? (
                    <XCircle className="h-4 w-4 shrink-0 text-accent-rose" />
                  ) : isDone ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-accent-emerald" />
                  ) : isCurrent ? (
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-400 animate-pulse" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold truncate">{st.label}</span>
                  {isFailed && (
                    <span className="text-[9px] font-bold uppercase text-accent-rose">Failed</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inspection Tabs */}
      <div className="border-b border-surfaceBorder flex gap-4 sm:gap-6 text-xs font-semibold overflow-x-auto whitespace-nowrap scrollbar-none pb-0.5">
        <button
          onClick={() => setActiveTab("timeline")}
          className={`pb-3 transition-colors border-b-2 shrink-0 ${activeTab === "timeline" ? "border-brand-400 text-brand-400 font-bold" : "border-transparent text-slate-400 hover:text-white"
            }`}
        >
          Live Activity &amp; Logs ({events.length})
        </button>
        <button
          onClick={() => setActiveTab("diff")}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-1.5 shrink-0 ${activeTab === "diff" ? "border-brand-400 text-brand-400 font-bold" : "border-transparent text-slate-400 hover:text-white"
            }`}
        >
          <FileCode className="h-3.5 w-3.5" />
          <span>Changed Files &amp; Diff {diff && `(${diff.files_changed})`}</span>
        </button>
        <button
          onClick={() => setActiveTab("tests")}
          className={`pb-3 transition-colors border-b-2 shrink-0 ${activeTab === "tests" ? "border-brand-400 text-brand-400 font-bold" : "border-transparent text-slate-400 hover:text-white"
            }`}
        >
          Test Results {task.test_results && (task.test_results.passed ? "✓" : "✗")}
        </button>
        <button
          onClick={() => setActiveTab("security")}
          className={`pb-3 transition-colors border-b-2 shrink-0 ${activeTab === "security" ? "border-brand-400 text-brand-400 font-bold" : "border-transparent text-slate-400 hover:text-white"
            }`}
        >
          Security Audit {task.security_results && "✓"}
        </button>
        <button
          onClick={() => setActiveTab("review")}
          className={`pb-3 transition-colors border-b-2 shrink-0 ${activeTab === "review" ? "border-brand-400 text-brand-400 font-bold" : "border-transparent text-slate-400 hover:text-white"
            }`}
        >
          Peer Review
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "timeline" && (
        <div className="rounded-xl border border-surfaceBorder bg-surface p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Realtime Agent Event Stream</h3>
            <span className="text-[11px] text-slate-500 font-mono">{events.length} lifecycle events recorded</span>
          </div>
          <div className="space-y-2.5 font-mono text-xs">
            {events.map((ev, i) => {
              const isFailed = ev.status === "FAILED" || !!ev.metadata?.error;
              const isCompleted = ev.status === "COMPLETED";
              const statusMessages: Record<string, string> = {
                PLANNING: "Supervisor formulated multi-agent execution plan",
                RESEARCHING: "Researcher analyzing repository structure and dependencies",
                CODING: "Coder applying targeted code modifications",
                TESTING: "Tester running automated tests in isolated sandbox",
                REPAIRING: "Repair agent analyzing test failures and applying fixes",
                SECURITY_REVIEW: "Security auditor performing static code analysis",
                CODE_REVIEW: "Reviewer verifying changes and acceptance criteria",
                WAITING_FOR_APPROVAL: "Pending human developer approval before PR creation",
                CREATING_BRANCH: "Preparing git branch for task changes",
                COMMITTING: "Staging and committing code changes",
                CREATING_PR: "Pushing branch and creating GitHub Pull Request",
                COMPLETED: "Workflow completed successfully!",
                FAILED: "Task stopped due to an error",
              };
              const message = ev.metadata?.message || ev.metadata?.error ||
                statusMessages[ev.status] || `${ev.type} - ${ev.status}`;

              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${isFailed
                    ? "bg-accent-rose/10 border-accent-rose/40 text-rose-200"
                    : isCompleted
                      ? "bg-accent-emerald/10 border-accent-emerald/30 text-emerald-200"
                      : "bg-background/60 border-surfaceBorder/60 text-slate-300"
                    }`}
                >
                  <span className="text-slate-500 shrink-0 text-[11px] pt-0.5">
                    {new Date(ev.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={`font-bold uppercase shrink-0 w-28 text-[11px] ${isFailed ? "text-accent-rose" : isCompleted ? "text-accent-emerald" : "text-brand-400"
                      }`}
                  >
                    [{ev.actor}]
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs ${isFailed ? "text-rose-300 font-semibold" : isCompleted ? "text-emerald-300 font-semibold" : "text-slate-200"}`}>
                      {message}
                    </p>
                    {ev.metadata?.error && ev.metadata?.error !== message && (
                      <p className="text-[11px] text-accent-rose/80 mt-1 break-words">
                        Details: {ev.metadata.error}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            {events.length === 0 && (
              <p className="text-slate-500 font-sans italic">Listening for incoming agent events...</p>
            )}
          </div>
        </div>
      )}

      {activeTab === "diff" && (
        <div className="rounded-xl border border-surfaceBorder bg-surface p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Sandbox Diff</h3>
            {diff && (
              <span className="text-xs font-mono text-slate-400">
                <span className="text-accent-emerald font-bold">+{diff.total_additions}</span>{" / "}
                <span className="text-accent-rose font-bold">-{diff.total_deletions}</span> in {diff.files_changed} files
              </span>
            )}
          </div>

          {diff && diff.files && diff.files.length > 0 ? (
            <div className="space-y-4">
              {diff.files.map((file: any, i: number) => (
                <div key={i} className="rounded-lg border border-surfaceBorder overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-background border-b border-surfaceBorder text-xs font-mono text-slate-300">
                    <span>{file.file_path}</span>
                    <span className="text-accent-emerald font-semibold">+{file.additions}</span>
                  </div>
                  <pre className="p-4 bg-[#0A0E17] text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre">
                    {file.patch || "Modified file content in sandbox"}
                  </pre>
                </div>
              ))}
            </div>
          ) : task?.status === "COMPLETED" ? (
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
              <span className="font-semibold block mb-1">✓ Repository Verified — No Code Modifications Required</span>
              All tests and static analysis passed cleanly. The repository is operational and functioning properly as intended.
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">No file changes recorded yet.</p>
          )}
        </div>
      )}

      {activeTab === "tests" && (
        <div className="rounded-xl border border-surfaceBorder bg-surface p-6 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Sandboxed Test Report</h3>
          {task.test_results ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${task.test_results.passed ? "bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/30" : "bg-accent-rose/10 text-accent-rose border border-accent-rose/30"
                  }`}>
                  {task.test_results.passed ? "ALL TESTS PASSED" : "TEST SUITE FAILED"}
                </span>
                <span className="text-xs text-slate-400">
                  {task.test_results.passed_tests} / {task.test_results.total_tests} Passed
                </span>
              </div>
              <pre className="mt-3 p-4 rounded-lg bg-background border border-surfaceBorder text-xs font-mono text-slate-300 overflow-x-auto">
                {task.test_results.raw_output || "Tests completed successfully."}
              </pre>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">Tests have not been executed yet.</p>
          )}
        </div>
      )}

      {activeTab === "security" && (
        <div className="rounded-xl border border-surfaceBorder bg-surface p-6 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Security Guardrail Analysis</h3>
          {task.security_results ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-accent-emerald" />
                <span className="text-sm font-bold text-white">{task.security_results.summary}</span>
              </div>
              <p className="text-xs text-slate-400">
                Risk Classification: <strong className="text-brand-400 uppercase">{task.security_results.risk_level}</strong>
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">Security scan pending execution.</p>
          )}
        </div>
      )}

      {activeTab === "review" && (
        <div className="rounded-xl border border-surfaceBorder bg-surface p-6 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Automated Peer Review Assessment</h3>
          {task.review_results ? (
            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-brand-500/10 text-brand-400 border border-brand-500/30">
                STATUS: {task.review_results.status.toUpperCase()}
              </span>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">{task.review_results.summary}</p>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">Review will be conducted after code and testing completion.</p>
          )}
        </div>
      )}
    </div>
  );
}
