"use client";

import { useEffect, useState } from "react";
import { GitPullRequest, ExternalLink, GitBranch, Clock, AlertCircle, ArrowRight } from "lucide-react";
import { api, getCachedApiData, hasCachedApiData } from "@/lib/api";
import Link from "next/link";

export default function PullRequestsPage() {
  const [prs, setPrs] = useState<any[]>(() => getCachedApiData("/api/pull-requests") || []);
  const [loading, setLoading] = useState(() => !hasCachedApiData("/api/pull-requests"));
  const [error, setError] = useState("");

  useEffect(() => {
    api.pullRequests.list()
      .then((data) => {
        if (Array.isArray(data)) setPrs(data);
      })
      .catch((err) => {
        if (!hasCachedApiData("/api/pull-requests")) {
          setError(err.message || "Failed to load pull requests");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const statusColor = (state: string) => {
    if (state === "merged") return "bg-indigo-500/10 text-indigo-400 border-indigo-500/30";
    if (state === "closed") return "bg-slate-500/10 text-slate-400 border-slate-500/30";
    return "bg-accent-emerald/10 text-accent-emerald border-accent-emerald/30";
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <GitPullRequest className="h-7 w-7 text-brand-400" />
          <span>Pull Requests</span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-400">
          AI-generated pull requests from your AegisCode tasks — linked to real GitHub branches.
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-surfaceBorder bg-surface p-5 animate-pulse">
              <div className="h-4 bg-surfaceBorder rounded w-1/3 mb-2" />
              <div className="h-3 bg-surfaceBorder rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-xl border border-accent-rose/30 bg-accent-rose/10 p-5 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-accent-rose shrink-0" />
          <p className="text-sm text-accent-rose">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && prs.length === 0 && (
        <div className="rounded-xl border border-surfaceBorder bg-surface p-12 text-center">
          <GitPullRequest className="h-8 w-8 text-slate-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-300">No pull requests yet</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Complete a task with an approved change — AegisCode will create the GitHub PR and it will appear here.
          </p>
          <Link
            href="/tasks"
            className="inline-flex items-center gap-2 mt-4 rounded-lg bg-brand-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-brand-400"
          >
            <span>Create a Task</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* PR list */}
      {!loading && prs.length > 0 && (
        <div className="grid grid-cols-1 gap-3">
          {prs.map((pr) => (
            <div
              key={pr.id}
              className="rounded-xl border border-surfaceBorder bg-surface p-5 hover:border-brand-500/40 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">
                      {pr.title || `PR #${pr.pr_number}`}
                    </span>
                    {pr.pr_number && (
                      <span className="text-xs font-mono text-slate-500">#{pr.pr_number}</span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor(pr.state)}`}>
                      {(pr.state || "open").toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    {pr.repository_full_name && (
                      <span className="font-mono">{pr.repository_full_name}</span>
                    )}
                    {pr.branch && (
                      <span className="flex items-center gap-1">
                        <GitBranch className="h-3 w-3" />
                        {pr.branch}
                      </span>
                    )}
                    {pr.created_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(pr.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {pr.task_id && (
                    <Link
                      href={`/tasks/${pr.task_id}`}
                      className="flex items-center gap-1.5 rounded-lg border border-surfaceBorder bg-background px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:border-brand-500/40 transition-colors"
                    >
                      View Task
                    </Link>
                  )}
                  {pr.html_url && (
                    <a
                      href={pr.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-1.5 text-xs font-semibold text-brand-400 hover:bg-brand-500/20 transition-colors"
                    >
                      <span>GitHub PR</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
