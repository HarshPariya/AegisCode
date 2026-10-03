"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  FolderGit2,
  CheckSquare,
  GitPullRequest,
  Settings,
  ArrowUpRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Users,
} from "lucide-react";
import { api, getCachedUser, UserProfile } from "@/lib/api";

export default function WorkspacePage() {
  const [user, setUser] = useState<UserProfile | null>(() => getCachedUser());
  const [workspace, setWorkspace] = useState<any>(null);
  const [githubStatus, setGithubStatus] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [me, wsList, ghStatus, mData] = await Promise.all([
        api.auth.me().catch(() => null),
        api.workspaces.list().catch(() => []),
        api.github.status().catch(() => null),
        api.metrics.get().catch(() => null),
      ]);
      if (me) setUser(me);
      if (wsList && wsList.length > 0) setWorkspace(wsList[0]);
      setGithubStatus(ghStatus);
      setMetrics(mData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const wsName = workspace?.name || `${user?.username || "Your"}'s Workspace`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Building2 className="h-7 w-7 text-brand-400" />
            {wsName}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Your isolated AegisCode workspace — all repositories, tasks, and operations are scoped to this environment.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-surfaceBorder bg-surface px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            href="/settings"
            className="flex items-center gap-1.5 rounded-lg border border-surfaceBorder bg-surface px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:border-brand-500/50 transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
            Settings
          </Link>
        </div>
      </div>

      {/* Workspace identity card */}
      <div className="rounded-2xl border border-brand-500/30 bg-gradient-to-r from-brand-950/40 via-surface to-background p-5 sm:p-6 shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1">Workspace Name</p>
            <p className="text-lg font-bold text-white">{wsName}</p>
            {workspace?.slug && (
              <p className="text-xs text-slate-400 font-mono mt-0.5">@{workspace.slug}</p>
            )}
          </div>
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1">Owner</p>
            <p className="text-sm font-semibold text-white">{user?.full_name || user?.username || "—"}</p>
            <p className="text-xs text-slate-400 font-mono">{user?.email || ""}</p>
          </div>
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1">Workspace ID</p>
            <p className="text-xs font-mono text-slate-300 select-all break-all">{workspace?.id || "—"}</p>
          </div>
        </div>
      </div>

      {/* Workspace Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: "Repositories",
            value: githubStatus?.repository_count ?? "—",
            color: "text-brand-400",
            icon: FolderGit2,
            href: "/repositories",
          },
          {
            label: "Total Tasks",
            value: metrics?.total_tasks ?? 0,
            color: "text-white",
            icon: CheckSquare,
            href: "/tasks",
          },
          {
            label: "Completed",
            value: metrics?.completed_tasks ?? 0,
            color: "text-accent-emerald",
            icon: CheckCircle2,
            href: "/history",
          },
          {
            label: "Open PRs",
            value: metrics?.active_tasks ?? 0,
            color: "text-cyan-400",
            icon: GitPullRequest,
            href: "/pull-requests",
          },
        ].map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-xl border border-surfaceBorder bg-surface hover:border-brand-500/40 transition-colors p-4 group"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] text-slate-500 uppercase font-mono">{stat.label}</p>
              <stat.icon className="h-3.5 w-3.5 text-slate-600 group-hover:text-brand-400 transition-colors" />
            </div>
            <p className={`text-2xl font-extrabold ${stat.color}`}>{loading ? "—" : stat.value}</p>
          </Link>
        ))}
      </div>

      {/* GitHub Integration Status */}
      <div className="rounded-xl border border-surfaceBorder bg-surface p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <FolderGit2 className="h-4 w-4 text-brand-400" />
            GitHub Integration
          </h2>
          <Link href="/repositories" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
            <span>Manage</span>
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        {loading ? (
          <div className="h-8 rounded-lg bg-slate-800 animate-pulse w-1/2" />
        ) : githubStatus?.connected ? (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-accent-emerald/5 border border-accent-emerald/20">
            <CheckCircle2 className="h-5 w-5 text-accent-emerald mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-white">
                GitHub Connected
                {githubStatus.installations?.length > 0 && ` — @${githubStatus.installations[0]?.account_login}`}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {githubStatus.repository_count} repositories synced and available for AI engineering tasks.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg bg-brand-500/5 border border-brand-500/30">
            <div className="flex items-start gap-3 flex-1">
              <AlertCircle className="h-5 w-5 text-brand-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white">GitHub Not Connected</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Connect your GitHub account to authorize repositories and start automated engineering tasks.
                </p>
              </div>
            </div>
            <Link
              href="/repositories"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-brand-400 transition-colors shadow-glow shrink-0"
            >
              <span>Connect GitHub</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl border border-surfaceBorder bg-surface p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-400" />
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "New Task", href: "/tasks?new=1", icon: CheckSquare, primary: true },
            { label: "Repositories", href: "/repositories", icon: FolderGit2, primary: false },
            { label: "View History", href: "/history", icon: ArrowUpRight, primary: false },
            { label: "Settings", href: "/settings", icon: Settings, primary: false },
          ].map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all ${action.primary
                  ? "bg-brand-500 text-slate-950 hover:bg-brand-400 shadow-glow"
                  : "border border-surfaceBorder text-slate-300 hover:text-white hover:border-brand-500/40"
                }`}
            >
              <action.icon className="h-3.5 w-3.5 shrink-0" />
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
