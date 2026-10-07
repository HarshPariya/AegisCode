"use client";

import { useEffect, useState } from "react";
import {
  Settings,
  User,
  Mail,
  Building2,
  Shield,
  FolderGit2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  ExternalLink,
  KeyRound,
  Bell,
  GitPullRequest,
  Key,
  Link2,
  Plus,
  X,
  Lock,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { api, getCachedUser, UserProfile, getCachedApiData, hasCachedApiData } from "@/lib/api";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
    </svg>
  );
}

function GitHubIcon({ className = "h-4 w-4" }: { className?: string }) {
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

type Tab = "profile" | "github" | "policy" | "usage" | "security" | "workspace";

export default function SettingsPage() {
  const [user, setUser] = useState<UserProfile | null>(() => getCachedUser());
  const [githubStatus, setGithubStatus] = useState<any>(() => getCachedApiData("/api/github/status"));
  const [metrics, setMetrics] = useState<any>(() => getCachedApiData("/api/metrics"));
  const [loading, setLoading] = useState(() => !hasCachedApiData("/api/github/status"));
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [disconnecting, setDisconnecting] = useState(false);
  const [showConfirmDisconnect, setShowConfirmDisconnect] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [imgError, setImgError] = useState(false);

  // GitHub Connection State
  const [connectTab, setConnectTab] = useState<"pat" | "link" | "app">("pat");
  const [patToken, setPatToken] = useState("");
  const [patLoading, setPatLoading] = useState(false);
  const [linkIdentifier, setLinkIdentifier] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [syncingRepos, setSyncingRepos] = useState(false);
  const [showConnectOptions, setShowConnectOptions] = useState(false);

  const loadData = async (silent = false) => {
    if (!silent && !hasCachedApiData("/api/github/status")) {
      setLoading(true);
    }
    try {
      const [u, g, m] = await Promise.all([
        api.auth.me().catch(() => null),
        api.github.status().catch(() => null),
        api.metrics.get().catch(() => null),
      ]);
      if (u) setUser(u);
      setGithubStatus(g);
      setMetrics(m);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(hasCachedApiData("/api/github/status"));
  }, []);

  const handleDisconnectGitHub = async (instId: number) => {
    setDisconnecting(true);
    setShowConfirmDisconnect(false);
    try {
      await api.github.disconnectInstallation(instId);
      setMsg({ type: "success", text: "GitHub account disconnected. Workspace repositories removed." });
      await loadData();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to disconnect." });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleConnectPat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const token = patToken.trim();
    if (!token) {
      setMsg({ type: "error", text: "Please enter your GitHub Personal Access Token." });
      return;
    }
    setPatLoading(true);
    setMsg(null);
    try {
      const res = await api.github.connectPat(token);
      setMsg({
        type: "success",
        text: `✓ Connected @${res.account_login} successfully via Personal Token! Synced ${res.repositories_synced} repositories.`,
      });
      setPatToken("");
      setShowConnectOptions(false);
      await loadData();
    } catch (err: any) {
      setMsg({
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
      setMsg({ type: "error", text: "Please enter your GitHub username or installation ID." });
      return;
    }
    setLinkLoading(true);
    setMsg(null);
    try {
      const res = await api.github.linkExisting(id);
      setMsg({
        type: "success",
        text: `✓ Linked GitHub App @${res.account_login} successfully! Synced ${res.repositories_synced} repositories.`,
      });
      setLinkIdentifier("");
      setShowConnectOptions(false);
      await loadData();
    } catch (err: any) {
      setMsg({
        type: "error",
        text: err.message || "Failed to link existing GitHub installation.",
      });
    } finally {
      setLinkLoading(false);
    }
  };

  const handleSyncRepos = async () => {
    setSyncingRepos(true);
    setMsg(null);
    try {
      const repos = await api.repositories.sync();
      setMsg({
        type: "success",
        text: `✓ Repositories synchronized successfully (${repos.length} repos).`,
      });
      await loadData();
    } catch (err: any) {
      setMsg({
        type: "error",
        text: err.message || "Failed to sync repositories.",
      });
    } finally {
      setSyncingRepos(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "profile", label: "Profile", icon: User },
    { id: "github", label: "GitHub", icon: FolderGit2 },
    { id: "policy", label: "Execution Policy", icon: Shield },
    { id: "usage", label: "Usage", icon: Bell },
    { id: "security", label: "Security", icon: Lock },
    { id: "workspace", label: "Workspace", icon: Building2 },
  ];

  const activeInstallation = githubStatus?.installations?.[0];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 border border-brand-500/30 text-brand-400">
          <Settings className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Settings</h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Manage your workspace, GitHub connection, and execution policies
          </p>
        </div>
      </div>

      {msg && (
        <div
          className={`rounded-xl border p-4 text-xs flex items-center justify-between gap-3 ${msg.type === "success"
            ? "border-accent-emerald/30 bg-accent-emerald/10 text-accent-emerald"
            : "border-accent-rose/30 bg-accent-rose/10 text-accent-rose"
            }`}
        >
          <div className="flex items-center gap-2">
            {msg.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
          <button onClick={() => setMsg(null)} className="text-slate-400 hover:text-white px-1">
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-6">
        {/* Sidebar Tabs */}
        <nav className="sm:w-48 flex sm:flex-col gap-1 flex-wrap shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-colors whitespace-nowrap ${activeTab === tab.id
                  ? "bg-brand-500/10 text-brand-400 border border-brand-500/30"
                  : "text-slate-400 hover:text-white hover:bg-surface/50"
                  }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Tab Content */}
        <div className="flex-1 space-y-4 min-w-0">
          {/* PROFILE TAB */}
          {activeTab === "profile" && (
            <div className="rounded-2xl border border-surfaceBorder bg-surface p-6 space-y-5">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <User className="h-4 w-4 text-brand-400" />
                Profile
              </h2>
              {loading ? (
                <div className="space-y-3 animate-pulse">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 bg-surfaceBorder rounded-lg" />
                  ))}
                </div>
              ) : user ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    {user.avatar_url && !imgError ? (
                      <img
                        src={user.avatar_url}
                        alt={user.full_name || user.username}
                        className="h-14 w-14 rounded-2xl border border-brand-400/30 object-cover"
                        referrerPolicy="no-referrer"
                        onError={() => setImgError(true)}
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-600 via-cyan-500 to-emerald-400 text-slate-950 font-bold text-xl flex items-center justify-center border border-brand-400/40 shrink-0">
                        {(user.full_name || user.username || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="text-base font-bold text-white">{user.full_name || user.username}</h3>
                      <p className="text-xs text-slate-400 font-mono">{user.email}</p>
                      {user.auth_provider === "google" && (
                        <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface border border-surfaceBorder text-slate-300">
                          <GoogleIcon className="h-3 w-3" />
                          Google Authenticated
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-surfaceBorder/60">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Username
                      </label>
                      <div className="flex items-center gap-2 rounded-lg border border-surfaceBorder bg-background px-3 py-2 text-xs text-white font-mono">
                        {user.username}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Email</label>
                      <div className="flex items-center gap-2 rounded-lg border border-surfaceBorder bg-background px-3 py-2 text-xs text-white font-mono">
                        <Mail className="h-3 w-3 text-brand-400" />
                        {user.email}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Workspace
                      </label>
                      <div className="flex items-center gap-2 rounded-lg border border-surfaceBorder bg-background px-3 py-2 text-xs text-white">
                        <Building2 className="h-3 w-3 text-slate-400" />
                        {user.organization_name || `${user.username}'s Workspace`}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Auth Provider
                      </label>
                      <div className="flex items-center gap-2 rounded-lg border border-surfaceBorder bg-background px-3 py-2 text-xs text-white capitalize">
                        <KeyRound className="h-3 w-3 text-slate-400" />
                        {user.auth_provider || "email/password"}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Could not load profile. Please refresh.</p>
              )}
            </div>
          )}

          {/* GITHUB TAB */}
          {activeTab === "github" && (
            <div className="rounded-2xl border border-surfaceBorder bg-surface p-6 space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <FolderGit2 className="h-4 w-4 text-brand-400" />
                  GitHub Connection
                </h2>
                {githubStatus?.connected && activeInstallation && (
                  <button
                    onClick={() => setShowConnectOptions(!showConnectOptions)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surfaceBorder bg-surface hover:bg-surface/80 text-xs font-semibold text-slate-300 hover:text-white transition-all"
                  >
                    <Plus className="h-3.5 w-3.5 text-brand-400" />
                    <span>{showConnectOptions ? "Hide Switch Options" : "Switch / Reconnect Account"}</span>
                  </button>
                )}
              </div>

              {loading ? (
                <div className="h-28 bg-surfaceBorder/60 rounded-xl animate-pulse" />
              ) : (
                <div className="space-y-5">
                  {/* STATE: CONNECTED CARD */}
                  {githubStatus?.connected && activeInstallation && (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-accent-emerald/30 bg-accent-emerald/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="h-11 w-11 rounded-xl bg-surface border border-brand-500/30 flex items-center justify-center text-brand-400 shrink-0">
                            <GitHubIcon className="h-6 w-6" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-white">@{activeInstallation.account_login}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/30 flex items-center gap-1">
                                <CheckCircle2 className="h-2.5 w-2.5" />
                                Connected
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-surfaceBorder text-slate-400">
                                {activeInstallation.auth_type === "pat" ? "Personal Token (PAT)" : "GitHub App"}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                              {githubStatus.repository_count} repositor
                              {githubStatus.repository_count === 1 ? "y" : "ies"} authorized for this workspace
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap sm:self-center">
                          <button
                            onClick={handleSyncRepos}
                            disabled={syncingRepos}
                            className="flex items-center gap-1.5 text-xs font-semibold text-white rounded-lg border border-surfaceBorder bg-surface px-3 py-2 hover:bg-surface/80 hover:border-brand-500/40 transition-all disabled:opacity-50"
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${syncingRepos ? "animate-spin text-brand-400" : "text-slate-400"}`} />
                            <span>{syncingRepos ? "Syncing…" : "Sync Repos"}</span>
                          </button>

                          {activeInstallation.auth_type !== "pat" && (
                            <a
                              href={`https://github.com/settings/installations/${activeInstallation.installation_id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white rounded-lg border border-surfaceBorder bg-background px-3 py-2 transition-colors hover:border-brand-500/40"
                            >
                              <Settings className="h-3.5 w-3.5 text-slate-400" />
                              <span>Configure</span>
                              <ExternalLink className="h-3 w-3 text-slate-500" />
                            </a>
                          )}

                          <button
                            onClick={() => setShowConfirmDisconnect(true)}
                            disabled={disconnecting}
                            className="flex items-center gap-1.5 text-xs font-semibold text-accent-rose hover:text-white rounded-lg border border-accent-rose/30 hover:bg-accent-rose/20 px-3 py-2 transition-all disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>{disconnecting ? "Disconnecting…" : "Disconnect"}</span>
                          </button>
                        </div>
                      </div>

                      {showConfirmDisconnect && (
                        <div className="rounded-xl border border-accent-rose/30 bg-accent-rose/5 p-4 space-y-3 animate-in fade-in">
                          <p className="text-xs text-accent-rose font-semibold">
                            Disconnect @{activeInstallation.account_login}?
                          </p>
                          <p className="text-[11px] text-slate-400">
                            This unlinks the account and removes authorized repository listings from your workspace.
                            Your repositories, code, and branches on GitHub remain completely untouched.
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDisconnectGitHub(activeInstallation.installation_id)}
                              className="px-3 py-1.5 text-xs font-bold bg-accent-rose text-white rounded-lg hover:bg-rose-600 transition-colors"
                            >
                              Confirm Disconnect
                            </button>
                            <button
                              onClick={() => setShowConfirmDisconnect(false)}
                              className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white rounded-lg border border-surfaceBorder bg-surface transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CONNECTION BOX: SHOWN IF NOT CONNECTED OR IF USER CLICKS SWITCH ACCOUNT */}
                  {(!githubStatus?.connected || showConnectOptions) && (
                    <div className="rounded-2xl border border-surfaceBorder bg-[#0A0E18] p-5 sm:p-6 space-y-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <GitHubIcon className="h-4 w-4 text-brand-400" />
                            {githubStatus?.connected ? "Connect Another GitHub Account / Token" : "Connect Your GitHub Account"}
                          </h3>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Connect your GitHub account to authorize project repositories for this workspace.
                          </p>
                        </div>
                        {showConnectOptions && (
                          <button
                            onClick={() => setShowConnectOptions(false)}
                            className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-surface"
                          >
                            ✕ Close
                          </button>
                        )}
                      </div>

                      {/* TAB 1: PERSONAL TOKEN (PAT) */}
                      {connectTab === "pat" && (
                        <form onSubmit={handleConnectPat} className="space-y-4">
                          <div className="p-3.5 rounded-xl bg-brand-500/5 border border-brand-500/20 text-xs text-slate-300 space-y-1.5">
                            <p className="font-semibold text-brand-300 flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-brand-400" />
                              Recommended for every developer
                            </p>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                              Connects directly to your personal GitHub account. No administrator rights, mobile verification, or server App credentials required.
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
                              className="w-full rounded-xl border border-surfaceBorder bg-background px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-brand-500/80 focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                            />
                            <p className="text-[10px] text-slate-500">
                              Required scope: <code className="text-brand-300">repo</code> (Full control of private and public repositories).
                            </p>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
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

                  )}
                </div>
              )}
            </div>
          )}

          {/* POLICY TAB */}
          {activeTab === "policy" && (
            <div className="rounded-2xl border border-surfaceBorder bg-surface p-6 space-y-5">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Shield className="h-4 w-4 text-brand-400" />
                Execution Policy
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Execution policies control when the agent workforce requires human approval before performing high-risk operations. These are workspace-wide defaults set by your administrator.
              </p>
              <div className="space-y-3">
                {[
                  {
                    label: "Require Approval for Commits",
                    desc: "Agent must request approval before committing code changes.",
                    key: "REQUIRE_APPROVAL_FOR_COMMITS",
                  },
                  {
                    label: "Require Approval for Pull Requests",
                    desc: "Agent must request approval before opening a GitHub PR.",
                    key: "REQUIRE_APPROVAL_FOR_PULL_REQUESTS",
                  },
                  {
                    label: "Require Approval for Shell Commands",
                    desc: "Agent must request approval before executing system commands.",
                    key: "REQUIRE_APPROVAL_FOR_COMMANDS",
                  },
                ].map((policy) => (
                  <div
                    key={policy.key}
                    className="flex items-start justify-between gap-4 rounded-xl border border-surfaceBorder bg-background/60 p-4"
                  >
                    <div>
                      <p className="text-xs font-bold text-white">{policy.label}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{policy.desc}</p>
                    </div>
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">
                      Configured via .env
                    </span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-3 text-[11px] text-slate-400">
                <span className="text-brand-400 font-bold">Note: </span>
                Execution policies are set via environment variables (
                <code className="text-brand-300 font-mono bg-surface px-1 rounded">
                  REQUIRE_APPROVAL_FOR_*
                </code>
                ) in your deployment configuration. Contact your workspace administrator to modify these settings.
              </div>
            </div>
          )}

          {/* USAGE TAB */}
          {activeTab === "usage" && (
            <div className="rounded-2xl border border-surfaceBorder bg-surface p-6 space-y-5">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Bell className="h-4 w-4 text-brand-400" />
                Workspace Usage
              </h2>
              {loading ? (
                <div className="grid grid-cols-2 gap-3 animate-pulse">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-20 bg-surfaceBorder rounded-xl" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-surfaceBorder bg-background/60 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Repositories</p>
                    <p className="text-3xl font-extrabold text-white mt-2">
                      {githubStatus?.repository_count ?? "—"}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Authorized for workspace</p>
                  </div>
                  <div className="rounded-xl border border-surfaceBorder bg-background/60 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Avg Cycle Time</p>
                    <p className="text-3xl font-extrabold text-white mt-2">
                      {metrics?.average_duration_seconds > 0 ? `${metrics.average_duration_seconds}s` : "—"}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Per sandbox run</p>
                  </div>
                  <div className="rounded-xl border border-surfaceBorder bg-background/60 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">GitHub Connected</p>
                    <p className="text-3xl font-extrabold mt-2">
                      {githubStatus?.connected ? (
                        <span className="text-accent-emerald">Yes</span>
                      ) : (
                        <span className="text-slate-500">No</span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {githubStatus?.connected
                        ? `@${githubStatus?.installations?.[0]?.account_login}`
                        : "Not linked"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-surfaceBorder bg-background/60 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Data Available</p>
                    <p className="text-3xl font-extrabold text-white mt-2">
                      {metrics?.data_available ? <span className="text-accent-emerald">Yes</span> : "—"}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Task history loaded</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECURITY TAB */}
          {activeTab === "security" && (
            <div className="rounded-2xl border border-surfaceBorder bg-surface p-6 space-y-5">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Lock className="h-4 w-4 text-brand-400" />
                Security &amp; Tenant Governance
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Zero-trust session authorization, container isolation policies, and immutable audit logs.
              </p>

              <div className="space-y-3">
                <div className="rounded-xl border border-surfaceBorder bg-background/60 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Active Session Authentication</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      JWT Verified
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Signed cryptographic session tokens stored client-side in browser storage. Expired sessions automatically redirect to secure login.
                  </p>
                </div>

                <div className="rounded-xl border border-surfaceBorder bg-background/60 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Execution Isolation Provider</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                      Sandbox Active
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Customer repository code never runs directly on the host shell or API server. Code runs in ephemeral, non-root sandbox containers with CPU/memory quotas.
                  </p>
                </div>

                <div className="rounded-xl border border-surfaceBorder bg-background/60 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Audit Log Verification</span>
                    <a
                      href="/history?tab=audit"
                      className="text-[11px] font-semibold text-brand-400 hover:underline flex items-center gap-1"
                    >
                      <span>View Full Audit Trail</span>
                      <ArrowRight className="h-3 w-3" />
                    </a>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Every task dispatch, GitHub repository sync, sandbox execution, and approval event is permanently written to MongoDB audit logs.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* WORKSPACE TAB */}
          {activeTab === "workspace" && (
            <div className="rounded-2xl border border-surfaceBorder bg-surface p-6 space-y-5">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="h-4 w-4 text-brand-400" />
                Workspace Organization
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Multi-tenant workspace boundary. Repositories, tasks, agent runs, approvals, and pull requests are strictly scoped to this organization.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-surfaceBorder bg-background/60 p-4 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Workspace Name</span>
                  <p className="text-base font-bold text-white truncate">
                    {user?.organization_name || `${user?.username || "Personal"}'s Workspace`}
                  </p>
                  <p className="text-[11px] text-slate-400">Active engineering team tenant</p>
                </div>

                <div className="rounded-xl border border-surfaceBorder bg-background/60 p-4 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tenant Isolation</span>
                  <p className="text-base font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    Strictly Scoped
                  </p>
                  <p className="text-[11px] text-slate-400">Cross-tenant data access blocked</p>
                </div>
              </div>

              <div className="pt-2">
                <a
                  href="/workspace"
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-500/10 hover:bg-brand-500 text-brand-400 hover:text-slate-950 border border-brand-500/30 px-4 py-2 text-xs font-bold transition-all shadow-sm"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  <span>Open Dedicated Workspace Manager</span>
                  <ArrowRight className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
