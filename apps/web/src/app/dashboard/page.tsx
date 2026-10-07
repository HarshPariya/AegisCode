"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  CheckSquare,
  AlertCircle,
  GitPullRequest,
  Activity,
  ArrowUpRight,
  Plus,
  TrendingUp,
  ShieldAlert,
  Clock,
  Sparkles,
  RefreshCw,
  Mail,
  Building2,
  CheckCircle2,
} from "lucide-react";
import { api, getCachedUser, UserProfile, getCachedApiData, hasCachedApiData } from "@/lib/api";

function DashboardUserAvatar({ user }: { user: UserProfile }) {
  const [hasError, setHasError] = useState(false);
  const initials = (user.full_name || user.username || "U")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (user.avatar_url && !hasError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatar_url}
        alt={user.full_name || user.username}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        className="h-12 w-12 rounded-2xl border border-brand-400/50 object-cover shrink-0 shadow-glow"
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-brand-600 via-cyan-500 to-emerald-400 text-slate-950 font-extrabold text-base flex items-center justify-center border border-brand-400/40 shrink-0 shadow-glow select-none">
      {initials}
    </div>
  );
}

export default function DashboardPage() {
  const [user, setUser] = useState<UserProfile | null>(() => getCachedUser());
  const [tasks, setTasks] = useState<any[]>(() => getCachedApiData("/api/tasks") || []);
  const [approvals, setApprovals] = useState<any[]>(() => getCachedApiData("/api/approvals") || []);
  const [metrics, setMetrics] = useState<any>(() => getCachedApiData("/api/metrics"));
  const [githubStatus, setGithubStatus] = useState<any>(() => getCachedApiData("/api/github/status"));
  const [loading, setLoading] = useState(() => !hasCachedApiData("/api/tasks"));

  const loadData = async (silent = false) => {
    if (!silent && !hasCachedApiData("/api/tasks")) {
      setLoading(true);
    }
    try {
      const cached = getCachedUser();
      if (cached) setUser(cached);

      const [uData, tList, aList, mData, ghStatus] = await Promise.all([
        api.auth.me().catch(() => null),
        api.tasks.list().catch(() => []),
        api.approvals.list().catch(() => []),
        api.metrics.get().catch(() => null),
        api.github.status().catch(() => null),
      ]);
      if (uData) setUser(uData);
      setTasks(tList);
      setApprovals(aList);
      setMetrics(mData);
      setGithubStatus(ghStatus);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(hasCachedApiData("/api/tasks"));
    const interval = setInterval(() => {
      loadData(true);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const activeCount = tasks.filter((t) => ["PLANNING", "RESEARCHING", "CODING", "TESTING"].includes(t.status)).length;
  const completedCount = tasks.filter((t) => t.status === "COMPLETED").length;
  const pendingApprovals = useMemo(
    () => approvals.filter((a) => (a.status || "").toLowerCase() === "pending"),
    [approvals]
  );
  const approvalCount = pendingApprovals.length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Top Welcome / Identity Banner */}
      {user ? (
        <div className="rounded-2xl border border-brand-500/30 bg-gradient-to-r from-brand-950/40 via-surface to-background p-4 sm:p-6 shadow-xl backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <DashboardUserAvatar user={user} />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    Welcome back, {user.full_name || user.username}
                  </h1>
                  {user.auth_provider === "google" && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      Google OAuth
                    </span>
                  )}
                </div>

                {/* Developer Email & Organization */}
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 text-brand-300 font-mono font-medium">
                    <Mail className="h-3.5 w-3.5 text-brand-400" />
                    <span>{user.email}</span>
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                    <span>{user.organization_name || `${user.username}'s Team`}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => loadData(false)}
                title="Sync from Database"
                className="flex items-center gap-1.5 rounded-lg border border-surfaceBorder bg-surface px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-surface/80 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Sync DB</span>
              </button>
              <Link
                href="/tasks"
                prefetch={true}
                className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-brand-400 transition-colors shadow-glow"
              >
                <Plus className="h-4 w-4" />
                <span>New Task</span>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-surfaceBorder bg-surface/70 p-4 sm:p-6 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Engineering Dashboard</h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              Sign in with Google to access your isolated repositories, execution history, and agent policies.
            </p>
          </div>
          <Link
            href="/login"
            prefetch={true}
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-950 hover:bg-brand-400 shadow-glow"
          >
            <span>Sign In with Google</span>
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-surfaceBorder bg-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Active Tasks</span>
            <Activity className="h-4 w-4 text-brand-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{activeCount}</span>
            <span className="text-xs text-brand-400 flex items-center font-medium">In Flight</span>
          </div>
        </div>

        <div className="rounded-xl border border-surfaceBorder bg-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Human Approvals</span>
            <AlertCircle className="h-4 w-4 text-accent-amber" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-accent-amber">{approvalCount}</span>
            <span className="text-xs text-slate-400">Pending Review</span>
          </div>
        </div>

        <div className="rounded-xl border border-surfaceBorder bg-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Completed Tasks</span>
            <GitPullRequest className="h-4 w-4 text-accent-emerald" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{completedCount}</span>
            <span className="text-xs text-accent-emerald flex items-center gap-0.5">
              <TrendingUp className="h-3 w-3" />
              Finished
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-surfaceBorder bg-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Avg Cycle Time</span>
            <Clock className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">
              {metrics?.average_duration_seconds > 0
                ? `${metrics.average_duration_seconds}s`
                : "—"}
            </span>
            <span className="text-xs text-slate-400">
              {metrics?.data_available ? "Sandbox Run" : "No task data"}
            </span>
          </div>
        </div>
      </div>

      {/* GitHub Connection Onboarding Banner — shown when no GitHub account connected */}
      {!loading && (!githubStatus?.connected || githubStatus?.repository_count === 0) && (
        <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-brand-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-white">
                {githubStatus?.connected
                  ? `GitHub Connected — ${githubStatus.repository_count} Repositories Synced`
                  : "Connect GitHub to Start Automating"}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {githubStatus?.connected
                  ? "Your repositories are available for AI-assisted engineering tasks."
                  : "Authorize your repositories and let AegisCode's agents investigate, fix, and PR your code automatically."}
              </p>
            </div>
          </div>
          {!githubStatus?.connected && (
            <Link
              href="/repositories"
              prefetch={true}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-brand-400 transition-colors shadow-glow shrink-0"
            >
              <span>Connect GitHub</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      )}

      {/* Human Approvals Banner only if pending approvals exist */}
      {pendingApprovals.length > 0 && (
        <div className="rounded-xl border border-accent-amber/40 bg-accent-amber/10 p-5 glow-amber">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-6 w-6 text-accent-amber flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-white">
                  Action Required: {pendingApprovals.length} Operation{pendingApprovals.length > 1 ? "s" : ""} Waiting for Human Approval
                </h3>
                <p className="mt-1 text-xs text-slate-300">
                  High-risk operations have been paused by the policy engine to prevent unauthorized modifications.
                </p>
              </div>
            </div>
            <Link
              href="/approvals"
              prefetch={true}
              className="rounded-lg bg-accent-amber px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-colors shrink-0 text-center"
            >
              Open Approvals Center
            </Link>
          </div>
        </div>
      )}

      {/* Database Saved Task History Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-brand-400" />
            <span>Recent Workspace Tasks ({tasks.length})</span>
          </h2>
          <div className="flex items-center gap-4">
            <Link href="/history" prefetch={true} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 font-medium">
              <span>View Full History</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
            <Link href="/tasks" prefetch={true} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-medium">
              <span>Task Board</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {tasks.length === 0 ? (
          <div className="rounded-xl border border-surfaceBorder bg-surface p-12 text-center">
            <Sparkles className="h-8 w-8 text-slate-500 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-300">No tasks created yet in this workspace</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Submit your first software engineering task to launch the multi-agent workforce and save results to MongoDB Atlas.
            </p>
            <Link
              href="/tasks"
              prefetch={true}
              className="inline-flex items-center gap-1.5 mt-4 rounded-lg bg-brand-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-brand-400"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Task</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {tasks.map((t) => (
              <Link
                key={t.id}
                href={`/tasks/${t.id}`}
                prefetch={true}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-surfaceBorder bg-surface p-4 hover:border-brand-500/40 hover:bg-surface/80 transition-all"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white group-hover:text-brand-400 transition-colors">
                      {t.title}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${t.status === "COMPLETED"
                      ? "bg-accent-emerald/10 text-accent-emerald border-accent-emerald/30"
                      : t.status === "WAITING_FOR_APPROVAL"
                        ? "bg-accent-amber/10 text-accent-amber border-accent-amber/30 animate-pulse"
                        : t.status === "FAILED"
                          ? "bg-accent-rose/10 text-accent-rose border-accent-rose/30"
                          : "bg-brand-500/10 text-brand-400 border-brand-500/30"
                      }`}>
                      {t.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-1">{t.description}</p>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-500 shrink-0">
                  <span className="font-mono bg-background px-2 py-0.5 rounded border border-surfaceBorder">
                    {t.repository_name || t.repository_full_name || t.repository_id}
                  </span>
                  {t.pull_request_url && (
                    <span className="text-accent-emerald flex items-center gap-1 font-semibold">
                      <GitPullRequest className="h-3.5 w-3.5" />
                      <span>PR {t.pull_request_number ? `#${t.pull_request_number}` : "Opened"}</span>
                    </span>
                  )}
                  <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
