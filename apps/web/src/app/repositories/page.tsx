"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  FolderGit2,
  GitBranch,
  ExternalLink,
  RefreshCw,
  Database,
  AlertCircle,
  Lock,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Search,
  Trash2,
  ArrowRight,
  Shield,
  Layers,
  Settings,
  Plus,
  Key,
  Link2,
  X,
} from "lucide-react";
import { api, getCachedApiData, hasCachedApiData } from "@/lib/api";
import { ClientPortal } from "@/components/ClientPortal";

function GitHubIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export default function RepositoriesPage() {
  const [repos, setRepos] = useState<any[]>(() => getCachedApiData("/api/repositories") || []);
  const [githubStatus, setGithubStatus] = useState<any>(() => getCachedApiData("/api/github/status"));
  const [loading, setLoading] = useState(() => !hasCachedApiData("/api/repositories"));
  const [syncing, setSyncing] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<number | null>(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState<number | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "public" | "private">("all");

  // Status message
  const [syncMsg, setSyncMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Connect Modal & Methods
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectTab, setConnectTab] = useState<"pat" | "link" | "app">("pat");
  const [patToken, setPatToken] = useState("");
  const [patLoading, setPatLoading] = useState(false);
  const [linkIdentifier, setLinkIdentifier] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);

  const loadData = async (silent = false) => {
    if (!silent && !hasCachedApiData("/api/repositories")) {
      setLoading(true);
    }
    try {
      const [r, g] = await Promise.all([
        api.repositories.list().catch(() => []),
        api.github.status().catch(() => null),
      ]);
      setRepos(Array.isArray(r) ? r : []);
      setGithubStatus(g && typeof g === "object" ? g : null);
    } finally {
      setLoading(false);
    }
  };

  // Intercept callback parameters from GitHub App installation return
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    const installationIdParam = urlParams.get("installation_id");
    const setupAction = urlParams.get("setup_action");
    const stateParam = urlParams.get("state");
    const connectedParam = urlParams.get("connected");

    if (installationIdParam) {
      // GitHub redirected back after app installation — register it via authenticated API
      const idNum = parseInt(installationIdParam, 10);
      window.history.replaceState({}, document.title, window.location.pathname);
      if (!isNaN(idNum)) {
        setSyncMsg({ type: "info", text: `Connecting GitHub account (installation #${idNum})…` });
        api.github.registerInstallation(idNum, stateParam || undefined)
          .then((res) => {
            setSyncMsg({
              type: "success",
              text: `✓ Connected @${res.account_login} successfully! Synced ${res.repositories_synced} repositories.`,
            });
            loadData();
          })
          .catch((err: any) => {
            setSyncMsg({
              type: "error",
              text: `Failed to register GitHub installation: ${err.message || "Unknown error"}`,
            });
            loadData();
          });
        return;
      }
    } else if (connectedParam) {
      setSyncMsg({ type: "success", text: "GitHub account connected! Repositories have been synchronized." });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    loadData(hasCachedApiData("/api/repositories"));
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const synced = await api.repositories.sync();
      setRepos(synced);
      setSyncMsg({
        type: "success",
        text: `Successfully synced ${synced.length} repositories from GitHub.`,
      });
      const g = await api.github.status().catch(() => null);
      if (g) setGithubStatus(g);
    } catch (err: any) {
      setSyncMsg({
        type: "error",
        text: err.message || "Failed to sync repositories from GitHub.",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async (instId?: number | null) => {
    setDisconnectingId(instId || 1);
    setShowDisconnectModal(null);
    setSyncMsg({ type: "info", text: "Disconnecting GitHub account..." });
    try {
      if (instId) {
        await api.github.disconnectInstallation(instId);
      } else {
        await api.github.disconnectAll();
      }
      setSyncMsg({
        type: "success",
        text: "GitHub account disconnected. Workspace repositories have been removed.",
      });
      await loadData();
    } catch (err: any) {
      try {
        await api.github.disconnectAll();
        setSyncMsg({
          type: "success",
          text: "GitHub account disconnected. Workspace repositories have been removed.",
        });
        await loadData();
      } catch (err2: any) {
        setSyncMsg({
          type: "error",
          text: err.message || "Failed to disconnect GitHub account.",
        });
      }
    } finally {
      setDisconnectingId(null);
    }
  };

  const handleConnectGitHub = async () => {
    setSyncMsg({ type: "info", text: "Redirecting to GitHub to install the AegisCode App…" });
    try {
      const { install_url } = await api.github.connectUrl();
      window.location.href = install_url;
    } catch (err: any) {
      setSyncMsg({
        type: "error",
        text: err.message || "Failed to start GitHub connection. Make sure you are signed in.",
      });
    }
  };

  const handleConnectPat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const token = patToken.trim();
    if (!token) {
      setSyncMsg({ type: "error", text: "Please enter your GitHub Personal Access Token." });
      return;
    }
    setPatLoading(true);
    setSyncMsg({ type: "info", text: "Verifying GitHub token and synchronizing repositories…" });
    try {
      const res = await api.github.connectPat(token);
      setSyncMsg({
        type: "success",
        text: `✓ Connected @${res.account_login} successfully via Personal Token! Synced ${res.repositories_synced} repositories.`,
      });
      setPatToken("");
      setShowConnectModal(false);
      await loadData();
    } catch (err: any) {
      setSyncMsg({
        type: "error",
        text: err.message || "Failed to connect with GitHub token. Please verify token has 'repo' scope.",
      });
    } finally {
      setPatLoading(false);
    }
  };

  const handleLinkExisting = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const id = linkIdentifier.trim();
    if (!id) {
      setSyncMsg({ type: "error", text: "Please enter your GitHub username or installation ID." });
      return;
    }
    setLinkLoading(true);
    setSyncMsg({ type: "info", text: `Verifying GitHub App installation for "${id}"…` });
    try {
      const res = await api.github.linkExisting(id);
      setSyncMsg({
        type: "success",
        text: `✓ Linked GitHub App @${res.account_login} successfully! Synced ${res.repositories_synced} repositories.`,
      });
      setLinkIdentifier("");
      setShowConnectModal(false);
      await loadData();
    } catch (err: any) {
      setSyncMsg({
        type: "error",
        text: err.message || "Failed to link existing GitHub installation.",
      });
    } finally {
      setLinkLoading(false);
    }
  };

  const filteredRepos = useMemo(() => {
    const list = Array.isArray(repos) ? repos : [];
    return list.filter((r) => {
      const nameMatch =
        (r.full_name || r.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.owner_login || "").toLowerCase().includes(searchQuery.toLowerCase());
      if (!nameMatch) return false;
      const isPriv = r.is_private ?? r.private ?? false;
      if (filterType === "public" && isPriv) return false;
      if (filterType === "private" && !isPriv) return false;
      return true;
    });
  }, [repos, searchQuery, filterType]);

  const activeInstallation = githubStatus?.installations?.[0];

  const indexingColor = (status: string) => {
    if (status === "indexed") return "text-accent-emerald bg-accent-emerald/10 border-accent-emerald/30";
    if (status === "indexing") return "text-accent-amber bg-accent-amber/10 border-accent-amber/30";
    return "text-slate-400 bg-slate-500/10 border-slate-500/20";
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 border border-brand-500/30 text-brand-400">
              <FolderGit2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Repositories</h1>
              <p className="text-xs sm:text-sm text-slate-400">
                {githubStatus?.connected
                  ? `${repos.length} repository${repos.length === 1 ? "" : "ies"} authorized for this workspace.`
                  : "Connect your GitHub account to authorize project repositories."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {githubStatus?.connected ? (
            <>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-2 rounded-lg border border-surfaceBorder bg-surface px-3.5 py-2 text-xs font-semibold text-white hover:bg-surface/80 hover:border-brand-500/40 disabled:opacity-50 transition-all shadow-sm"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin text-brand-400" : "text-slate-400"}`} />
                {syncing ? "Syncing…" : "Sync Repos"}
              </button>
              <button
                onClick={() => {
                  setConnectTab("pat");
                  setShowConnectModal(true);
                }}
                className="flex items-center gap-2 rounded-lg border border-surfaceBorder bg-surface px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:border-surfaceBorder/80 transition-all"
                title="Connect a different GitHub account or token"
              >
                <Plus className="h-3.5 w-3.5 text-brand-400" />
                <span>Switch / Add Account</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setConnectTab("pat");
                setShowConnectModal(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-brand-400 shadow-lg shadow-brand-500/20 transition-all hover:scale-[1.02]"
            >
              <GitHubIcon className="h-4 w-4" />
              <span>Connect GitHub</span>
            </button>
          )}
        </div>
      </div>

      {/* Notification / Feedback Banner */}
      {syncMsg && (
        <div
          className={`rounded-xl border p-4 text-xs flex items-center justify-between gap-3 ${syncMsg.type === "success"
            ? "border-accent-emerald/30 bg-accent-emerald/10 text-accent-emerald"
            : syncMsg.type === "error"
              ? "border-accent-rose/30 bg-accent-rose/10 text-accent-rose"
              : "border-brand-500/30 bg-brand-500/10 text-brand-300"
            }`}
        >
          <div className="flex items-center gap-2.5">
            {syncMsg.type === "success" && <CheckCircle2 className="h-4 w-4 shrink-0" />}
            {syncMsg.type === "error" && <AlertCircle className="h-4 w-4 shrink-0" />}
            {syncMsg.type === "info" && <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />}
            <span>{syncMsg.text}</span>
          </div>
          <button
            onClick={() => setSyncMsg(null)}
            className="text-slate-400 hover:text-white font-mono text-xs px-2 py-0.5 rounded"
          >
            ✕
          </button>
        </div>
      )}

      {/* GitHub App Not Configured Alert (Only shown if not connected via PAT) */}
      {!loading && githubStatus && !githubStatus.connected && !githubStatus.app_configured && (
        <div className="rounded-2xl border border-accent-amber/30 bg-accent-amber/5 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <AlertCircle className="h-6 w-6 text-accent-amber shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <h2 className="text-sm font-bold text-accent-amber">GitHub App Integration Not Configured</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                GitHub App OAuth is not configured in your environment. You can instantly connect repositories using a{" "}
                <span className="text-white font-semibold">GitHub Personal Access Token (PAT)</span> with no App setup required.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setConnectTab("pat");
              setShowConnectModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 text-xs shrink-0 transition-all shadow-md hover:scale-[1.02] active:scale-[0.98]"
          >
            <Key className="h-3.5 w-3.5" />
            <span>Connect via PAT</span>
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-4">
          <div className="h-24 rounded-2xl border border-surfaceBorder bg-surface/50 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-2xl border border-surfaceBorder bg-surface p-6 animate-pulse space-y-3">
                <div className="h-4 bg-surfaceBorder rounded w-1/2" />
                <div className="h-3 bg-surfaceBorder rounded w-3/4" />
                <div className="h-3 bg-surfaceBorder rounded w-1/3" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STATE 1: CONNECTED ACCOUNT BANNER */}
      {!loading && githubStatus?.connected && activeInstallation && (
        <div className="rounded-2xl border border-surfaceBorder bg-gradient-to-r from-surface to-surface/80 p-5 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-12 w-12 rounded-2xl bg-surfaceBorder/80 border border-brand-500/30 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                <GitHubIcon className="h-6 w-6 text-brand-400" />
              </div>
              <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-accent-emerald border-2 border-background" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-bold text-white tracking-tight">
                  @{activeInstallation.account_login}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/30 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Connected
                </span>
                <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-surface border border-surfaceBorder">
                  ID: {activeInstallation.installation_id}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Workspace access granted for {repos.length} repositor{repos.length === 1 ? "y" : "ies"}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <a
              href={`https://github.com/settings/installations/${activeInstallation.installation_id}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white rounded-lg border border-surfaceBorder bg-surface px-3 py-2 transition-colors hover:border-brand-500/40"
            >
              <Settings className="h-3.5 w-3.5 text-slate-400" />
              <span>Configure on GitHub</span>
              <ExternalLink className="h-3 w-3 ml-0.5 text-slate-500" />
            </a>

            <button
              onClick={() => setShowDisconnectModal(activeInstallation.installation_id)}
              disabled={disconnectingId === activeInstallation.installation_id}
              className="flex items-center gap-1.5 text-xs font-semibold text-accent-rose hover:text-white rounded-lg border border-accent-rose/30 hover:bg-accent-rose/20 px-3 py-2 transition-all disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Disconnect</span>
            </button>
          </div>
        </div>
      )}

      {/* STATE 2: NOT CONNECTED — ONBOARDING HERO & SELECTION */}
      {!loading && !githubStatus?.connected && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-surfaceBorder bg-gradient-to-b from-surface via-surface to-background p-8 sm:p-12 text-center relative overflow-hidden shadow-2xl">
            {/* Background glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-brand-500/10 blur-3xl rounded-full pointer-events-none" />

            <div className="relative z-10 max-w-2xl mx-auto space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-500/30 bg-brand-500/10 text-brand-400 text-xs font-semibold">
                <ShieldCheck className="h-3.5 w-3.5" />
                Multi-Tenant Isolated Workspace
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                  Connect Your GitHub Account
                </h2>
                <p className="text-sm text-slate-400 leading-relaxed max-w-xl mx-auto">
                  Authorize the AegisCode GitHub App to access only the repositories you select. Each workspace is
                  strictly isolated so your team&apos;s code remains confidential.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setConnectTab("pat");
                    setShowConnectModal(true);
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-xl bg-brand-500 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-brand-400 shadow-xl shadow-brand-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <GitHubIcon className="h-4 w-4" />
                  <span>Connect GitHub Account</span>
                  <ArrowRight className="h-4 w-4 ml-1" />
                </button>
              </div>

              {/* Security features */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 border-t border-surfaceBorder/60 text-left">
                <div className="p-3 rounded-xl bg-surface/60 border border-surfaceBorder/50 space-y-1">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <CheckCircle2 className="h-3.5 w-3.5 text-brand-400" />
                    Granular Scope
                  </span>
                  <p className="text-[11px] text-slate-400">Select only specific repositories you want AegisCode to work on.</p>
                </div>
                <div className="p-3 rounded-xl bg-surface/60 border border-surfaceBorder/50 space-y-1">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <Shield className="h-3.5 w-3.5 text-accent-emerald" />
                    Secure Sandboxing
                  </span>
                  <p className="text-[11px] text-slate-400">Code executes within isolated Docker/process containers.</p>
                </div>
                <div className="p-3 rounded-xl bg-surface/60 border border-surfaceBorder/50 space-y-1">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <Sparkles className="h-3.5 w-3.5 text-brand-400" />
                    Autonomous PRs
                  </span>
                  <p className="text-[11px] text-slate-400">Real branches, clean git commits, and verified GitHub PRs.</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* STATE 3: CONNECTED REPOSITORY LIST & FILTERS */}
      {!loading && githubStatus?.connected && (
        <div className="space-y-4">
          {/* Search and Filters Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface border border-surfaceBorder rounded-xl p-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search repositories by name..."
                className="w-full rounded-lg border border-surfaceBorder/60 bg-background pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-brand-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                onClick={() => setFilterType("all")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${filterType === "all"
                  ? "bg-brand-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-white bg-background/50 border border-surfaceBorder/60"
                  }`}
              >
                All ({repos.length})
              </button>
              <button
                onClick={() => setFilterType("public")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${filterType === "public"
                  ? "bg-brand-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-white bg-background/50 border border-surfaceBorder/60"
                  }`}
              >
                Public
              </button>
              <button
                onClick={() => setFilterType("private")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${filterType === "private"
                  ? "bg-brand-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-white bg-background/50 border border-surfaceBorder/60"
                  }`}
              >
                Private
              </button>
            </div>
          </div>

          {/* Repos Grid */}
          {filteredRepos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRepos.map((repo) => {
                const isPriv = repo.is_private ?? repo.private ?? false;
                const repoDisplayName = repo.full_name || repo.name;
                return (
                  <div
                    key={repo.id || repo.full_name}
                    className="rounded-2xl border border-surfaceBorder bg-surface p-5 space-y-4 hover:border-brand-500/40 transition-all flex flex-col justify-between group shadow-sm hover:shadow-lg hover:shadow-brand-500/5"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="h-8 w-8 rounded-lg bg-surfaceBorder/60 flex items-center justify-center shrink-0 mt-0.5 text-brand-400">
                            <FolderGit2 className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <h2 className="text-sm font-bold text-white truncate group-hover:text-brand-400 transition-colors">
                              {repoDisplayName}
                            </h2>
                            {repo.owner_login && (
                              <p className="text-[11px] text-slate-500 font-mono">{repo.owner_login}</p>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isPriv ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">
                              <Lock className="h-2.5 w-2.5" />
                              Private
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20">
                              Public
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1 font-mono text-[11px] bg-background/60 px-2 py-0.5 rounded border border-surfaceBorder/60">
                          <GitBranch className="h-3 w-3 text-slate-500" />
                          <span>{repo.default_branch || "main"}</span>
                        </span>

                        <span
                          className={`flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded border capitalize ${indexingColor(
                            repo.indexing_status || "unindexed"
                          )}`}
                        >
                          <Database className="h-2.5 w-2.5" />
                          <span>{repo.indexing_status || "unindexed"}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-3 border-t border-surfaceBorder/60 mt-2">
                      <a
                        href={repo.html_url || repo.clone_url?.replace(".git", "") || `https://github.com/${repoDisplayName}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-400 hover:text-white flex items-center gap-1 transition-colors font-semibold"
                      >
                        <GitHubIcon className="h-3.5 w-3.5 text-slate-400" />
                        <span>GitHub</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>

                      <Link
                        href={`/tasks?repo=${encodeURIComponent(repo.name || repoDisplayName)}&new=1`}
                        className="flex items-center gap-1.5 rounded-lg bg-brand-500/10 hover:bg-brand-500 text-brand-400 hover:text-slate-950 border border-brand-500/30 px-3 py-1.5 text-xs font-bold transition-all shadow-sm"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Work on Repo</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-surfaceBorder bg-surface p-12 text-center space-y-2">
              <FolderGit2 className="h-8 w-8 text-slate-500 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">No matching repositories found</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Try adjusting your search query or filter, or click &quot;Sync Repos&quot; to refresh from GitHub.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      {showDisconnectModal !== null && (
        <ClientPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl border border-surfaceBorder bg-surface p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-accent-rose/10 border border-accent-rose/30 flex items-center justify-center text-accent-rose">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Disconnect GitHub Account?</h3>
                  <p className="text-xs text-slate-400">This will remove authorized repositories from this workspace.</p>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed bg-background/60 p-3 rounded-xl border border-surfaceBorder/60">
                Disconnecting will un-link installation #{showDisconnectModal} and delete local index metadata for these
                repositories in this workspace. Your actual GitHub repositories, branches, and code will remain completely
                untouched on GitHub.
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setShowDisconnectModal(null)}
                  className="rounded-lg border border-surfaceBorder bg-surface px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDisconnect(showDisconnectModal)}
                  className="rounded-lg bg-accent-rose hover:bg-accent-rose/90 px-4 py-2 text-xs font-bold text-white transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Confirm Disconnect</span>
                </button>
              </div>
            </div>
          </div>
        </ClientPortal>
      )}

      {/* Connect GitHub Account Modal */}
      {showConnectModal && (
        <ClientPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-lg rounded-2xl border border-surfaceBorder bg-[#0D131F] p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-surfaceBorder/70">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400">
                    <GitHubIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Connect GitHub Account</h3>
                    <p className="text-xs text-slate-400">Choose your preferred connection method</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowConnectModal(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-surface/60 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Inline message banner in modal */}
              {syncMsg && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${syncMsg.type === "success"
                    ? "border-accent-emerald/30 bg-accent-emerald/10 text-accent-emerald"
                    : syncMsg.type === "error"
                      ? "border-accent-rose/30 bg-accent-rose/10 text-accent-rose"
                      : "border-brand-500/30 bg-brand-500/10 text-brand-300"
                    }`}
                >
                  {syncMsg.type === "success" && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                  {syncMsg.type === "error" && <AlertCircle className="h-4 w-4 shrink-0" />}
                  {syncMsg.type === "info" && <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />}
                  <span className="flex-1 leading-snug">{syncMsg.text}</span>
                </div>
              )}

              {/* TAB 1: PAT */}
              {connectTab === "pat" && (
                <form onSubmit={handleConnectPat} className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-brand-500/5 border border-brand-500/20 text-xs text-slate-300 space-y-1.5">
                    <p className="font-semibold text-brand-300 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-brand-400" />
                      Recommended for every developer
                    </p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Connects directly to your own personal GitHub account. No administrator rights or mobile verification required.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-200">GitHub Personal Access Token</label>
                      <a
                        href="https://github.com/settings/tokens/new?scopes=repo,read:user&description=AegisCode"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-semibold text-brand-400 hover:underline flex items-center gap-1"
                      >
                        <span>Generate token on GitHub</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <input
                      type="password"
                      value={patToken}
                      onChange={(e) => setPatToken(e.target.value)}
                      placeholder="ghp_... or github_pat_..."
                      className="w-full rounded-xl border border-surfaceBorder bg-background/80 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-brand-500/80 focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                      autoFocus
                    />
                    <p className="text-[10px] text-slate-500">
                      Required scope: <code className="text-brand-300">repo</code> (Full control of private and public repositories).
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowConnectModal(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-lg border border-surfaceBorder bg-surface hover:bg-surface/80 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={patLoading || !patToken.trim()}
                      className="px-5 py-2 text-xs font-bold text-slate-950 bg-brand-500 hover:bg-brand-400 rounded-lg shadow-lg shadow-brand-500/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
                    >
                      {patLoading ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Connecting…</span>
                        </>
                      ) : (
                        <>
                          <Key className="h-3.5 w-3.5" />
                          <span>Connect Token</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </ClientPortal>
      )}
    </div>
  );
}
