"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  Play,
  ArrowRight,
  GitPullRequest,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  X,
  GitBranch
} from "lucide-react";
import { api, getCachedApiData, hasCachedApiData } from "@/lib/api";
import { ClientPortal } from "@/components/ClientPortal";

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<any[]>(() => getCachedApiData("/api/tasks") || []);
  const [repos, setRepos] = useState<any[]>(() => getCachedApiData("/api/repositories") || []);
  const [filter, setFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(() => !hasCachedApiData("/api/tasks"));

  // New task form state
  const [selectedRepo, setSelectedRepo] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [constraintInput, setConstraintInput] = useState("");
  const [constraints, setConstraints] = useState<string[]>([]);
  const [executionPolicy, setExecutionPolicy] = useState("standard");
  const [creating, setCreating] = useState(false);

  const loadData = async (silent = false) => {
    if (!silent && !hasCachedApiData("/api/tasks")) {
      setLoading(true);
    }
    try {
      const [tList, rList] = await Promise.all([
        api.tasks.list().catch(() => []),
        api.repositories.list().catch(() => []),
      ]);
      setTasks(tList);
      setRepos(rList);
      if (rList.length > 0) {
        setSelectedRepo((prev) => prev || rList[0].id || rList[0].name);
      }
      return { tList, rList };
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(hasCachedApiData("/api/tasks")).then((res) => {
      if (typeof window !== "undefined" && res) {
        const params = new URLSearchParams(window.location.search);
        const repoParam = params.get("repo");
        const newParam = params.get("new");
        if (repoParam) {
          setSelectedRepo(repoParam);
          setIsModalOpen(true);
        } else if (newParam === "1" || newParam === "true") {
          setIsModalOpen(true);
        }
      }
    });

    const interval = setInterval(() => {
      api.tasks.list().then((fresh) => {
        if (Array.isArray(fresh)) setTasks(fresh);
      }).catch(() => { });
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleAddConstraint = () => {
    if (constraintInput.trim()) {
      setConstraints([...constraints, constraintInput.trim()]);
      setConstraintInput("");
    }
  };

  const handleRemoveConstraint = (index: number) => {
    setConstraints(constraints.filter((_, i) => i !== index));
  };

  const handleCreateAndExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    const repoToUse = selectedRepo || (repos[0]?.id || repos[0]?.name || "");
    if (!repoToUse) {
      alert("Please connect GitHub and select an authorized repository before creating a task.");
      return;
    }
    setCreating(true);
    try {
      // Backend auto-dispatches the multi-agent workflow immediately on creation.
      // No manual execute() call needed — task survives browser close.
      const newTask = await api.tasks.create({
        repository_id: repoToUse,
        title,
        description,
        constraints,
        execution_policy: executionPolicy,
      });
      setIsModalOpen(false);
      router.push(`/tasks/${newTask.id}`);
    } catch (err: any) {
      alert(err.message || "Failed to create task");
    } finally {
      setCreating(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filter !== "ALL" && t.status !== filter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Engineering Tasks</h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Coordinate specialized AI agents across your repositories.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-brand-400 transition-colors shadow-glow"
        >
          <Plus className="h-4 w-4" />
          <span>New Engineering Task</span>
        </button>
      </div>

      {/* Zero Repositories Banner */}
      {!loading && repos.length === 0 && (
        <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-brand-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-white">No GitHub Repositories Connected</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Connect your GitHub account in Repositories to authorize project code and start running AI software engineering tasks.
              </p>
            </div>
          </div>
          <Link
            href="/repositories"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-brand-400 shrink-0 shadow-sm transition-all"
          >
            <GitBranch className="h-4 w-4" />
            <span>Connect GitHub</span>
          </Link>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-surfaceBorder bg-surface p-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="w-full rounded-lg border border-surfaceBorder bg-background pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-brand-400 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {["ALL", "PLANNING", "CODING", "TESTING", "WAITING_FOR_APPROVAL", "COMPLETED", "FAILED"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${filter === s
                ? "bg-brand-500 text-slate-950 font-bold"
                : "text-slate-400 hover:text-white hover:bg-background/60"
                }`}
            >
              {s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="rounded-xl border border-surfaceBorder bg-surface p-12 text-center">
            <CheckSquare className="h-8 w-8 text-slate-500 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-300">No tasks match your criteria</p>
            <p className="text-xs text-slate-500 mt-1">Create a new task to begin agent execution.</p>
          </div>
        ) : (
          filteredTasks.map((t) => (
            <Link
              key={t.id}
              href={`/tasks/${t.id}`}
              prefetch={true}
              className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-surfaceBorder bg-surface p-5 hover:border-brand-500/40 hover:bg-surface/80 transition-all"
            >
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-sm font-bold text-white group-hover:text-brand-400 transition-colors">
                    {t.title}
                  </h3>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${t.pr_status === "merged"
                    ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                    : t.status === "COMPLETED"
                      ? "bg-accent-emerald/10 text-accent-emerald border-accent-emerald/30"
                      : t.status === "WAITING_FOR_APPROVAL"
                        ? "bg-accent-amber/10 text-accent-amber border-accent-amber/30 animate-pulse"
                        : t.status === "FAILED"
                          ? "bg-accent-rose/10 text-accent-rose border-accent-rose/30"
                          : "bg-brand-500/10 text-brand-400 border-brand-500/30"
                    }`}>
                    {t.pr_status === "merged" ? "MERGED" : t.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-1">{t.description}</p>
              </div>

              <div className="flex items-center gap-6 text-xs text-slate-400">
                <span className="font-mono text-slate-500">{t.repository_id}</span>
                {t.pr_status === "merged" ? (
                  <span className="text-purple-400 flex items-center gap-1 font-semibold">
                    <GitPullRequest className="h-3.5 w-3.5" />
                    <span>Merged</span>
                  </span>
                ) : t.pull_request_url ? (
                  <span className="text-accent-emerald flex items-center gap-1 font-semibold">
                    <GitPullRequest className="h-3.5 w-3.5" />
                    <span>PR Ready</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-slate-500">
                    <Play className="h-3 w-3" />
                    <span>View Run</span>
                  </span>
                )}
                <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-brand-400 group-hover:translate-x-1 transition-all" />
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Task Creation Modal */}
      {isModalOpen && (
        <ClientPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-surfaceBorder bg-[#0D131F] p-4 sm:p-6 shadow-2xl space-y-5 sm:space-y-6">
              <div className="flex items-center justify-between border-b border-surfaceBorder/60 pb-3 sm:pb-4 sticky top-0 bg-[#0D131F] z-10">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-brand-400" />
                  <h2 className="text-lg font-bold text-white">Create New Engineering Task</h2>
                </div>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    if (typeof window !== "undefined") window.history.replaceState({}, "", "/tasks");
                  }}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-surface"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateAndExecute} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Target Repository</label>
                    <select
                      value={selectedRepo || (repos[0]?.id || repos[0]?.name || "")}
                      onChange={(e) => setSelectedRepo(e.target.value)}
                      disabled={repos.length === 0}
                      className="w-full rounded-lg border border-surfaceBorder bg-background px-3 py-2 text-xs text-white focus:border-brand-400 focus:outline-none disabled:opacity-50"
                    >
                      {repos.length === 0 ? (
                        <option value="">No repositories authorized</option>
                      ) : (
                        repos.map((r) => (
                          <option key={r.id || r.name} value={r.id || r.name}>{r.full_name || r.name}</option>
                        ))
                      )}
                    </select>
                    {repos.length === 0 && (
                      <p className="mt-1 text-[11px] text-accent-amber">
                        Connect GitHub in Repositories to authorize project code.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Execution Policy</label>
                    <select
                      value={executionPolicy}
                      onChange={(e) => setExecutionPolicy(e.target.value)}
                      className="w-full rounded-lg border border-surfaceBorder bg-background px-3 py-2 text-xs text-white focus:border-brand-400 focus:outline-none"
                    >
                      <option value="standard">Standard (Human approval for High Risk)</option>
                      <option value="strict">Strict (Approval for Medium & High)</option>
                      <option value="auto_approve_low_risk">Auto-Approve Low Risk</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Task Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Fix JWT refresh-token expiration bug"
                    className="w-full rounded-lg border border-surfaceBorder bg-background px-3 py-2 text-xs text-white focus:border-brand-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Natural Language Instructions</label>
                  <textarea
                    rows={3}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the software engineering goal, expected behavior, and key acceptance criteria..."
                    className="w-full rounded-lg border border-surfaceBorder bg-background px-3 py-2 text-xs text-white focus:border-brand-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Constraints & Guardrails</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={constraintInput}
                      onChange={(e) => setConstraintInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddConstraint();
                        }
                      }}
                      placeholder="e.g. Do not modify database schema"
                      className="flex-1 rounded-lg border border-surfaceBorder bg-background px-3 py-1.5 text-xs text-white focus:border-brand-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddConstraint}
                      className="rounded-lg border border-surfaceBorder bg-surface px-3 py-1.5 text-xs font-semibold text-white hover:bg-surface/80"
                    >
                      Add
                    </button>
                  </div>

                  {constraints.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {constraints.map((c, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 rounded-md bg-background px-2.5 py-1 text-[11px] font-mono text-slate-300 border border-surfaceBorder"
                        >
                          <span>{c}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveConstraint(i)}
                            className="text-slate-500 hover:text-accent-rose"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-surfaceBorder/60">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      if (typeof window !== "undefined") window.history.replaceState({}, "", "/tasks");
                    }}
                    className="rounded-lg border border-surfaceBorder px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white text-center transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-brand-400 transition-colors shadow-glow disabled:opacity-50"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>{creating ? "Launching..." : "Start Run"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ClientPortal>
      )}
    </div>
  );
}
