"use client";

import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, CheckCircle, Zap, DollarSign, Layers, AlertCircle } from "lucide-react";
import { api, getCachedApiData, hasCachedApiData } from "@/lib/api";

export default function EvaluationsPage() {
  const [metrics, setMetrics] = useState<any>(() => getCachedApiData("/api/metrics"));
  const [cards, setCards] = useState<any[]>(() => getCachedApiData("/api/a2a/cards") || []);
  const [loading, setLoading] = useState(() => !hasCachedApiData("/api/metrics"));

  useEffect(() => {
    Promise.all([
      api.metrics.get().catch(() => null),
      api.a2a.getCards().catch(() => []),
    ]).then(([m, c]) => {
      setMetrics(m);
      setCards(c || []);
      setLoading(false);
    });
  }, []);

  const hasData = metrics?.data_available === true;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <BarChart3 className="h-7 w-7 text-brand-400" />
          <span>Evaluations &amp; Observability</span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-400">
          Workspace-specific agent quality metrics calculated from your real task runs.
        </p>
      </div>

      {/* No data state */}
      {!loading && !hasData && (
        <div className="rounded-xl border border-surfaceBorder bg-surface p-10 text-center">
          <AlertCircle className="h-8 w-8 text-slate-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-300">No task data yet</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Create and run your first engineering task to start seeing real metrics for your workspace.
          </p>
        </div>
      )}

      {/* Metrics Row — only shown when real data exists */}
      {hasData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-surfaceBorder bg-surface p-5">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
              <span>Success Rate</span>
              <TrendingUp className="h-4 w-4 text-accent-emerald" />
            </div>
            <div className="mt-3 text-3xl font-extrabold text-white">
              {metrics.success_rate}%
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {metrics.completed_tasks} of {metrics.total_tasks} tasks completed
            </span>
          </div>

          <div className="rounded-xl border border-surfaceBorder bg-surface p-5">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
              <span>Avg Task Duration</span>
              <Zap className="h-4 w-4 text-brand-400" />
            </div>
            <div className="mt-3 text-3xl font-extrabold text-white">
              {metrics.average_duration_seconds > 0
                ? `${metrics.average_duration_seconds}s`
                : "—"}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">From completed tasks</span>
          </div>

          <div className="rounded-xl border border-surfaceBorder bg-surface p-5">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
              <span>Avg Repair Cycles</span>
              <CheckCircle className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="mt-3 text-3xl font-extrabold text-white">
              {metrics.average_repair_loops}
            </div>
            <span className="text-[11px] text-indigo-400 mt-1 block">Bounded retry limit: 3</span>
          </div>

          <div className="rounded-xl border border-surfaceBorder bg-surface p-5">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
              <span>Estimated Cost</span>
              <DollarSign className="h-4 w-4 text-accent-amber" />
            </div>
            <div className="mt-3 text-3xl font-extrabold text-white">
              {metrics.estimated_cost_usd > 0
                ? `$${metrics.estimated_cost_usd}`
                : "$0.00"}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {metrics.tokens_consumed.toLocaleString()} tokens used
            </span>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-surfaceBorder bg-surface p-5 animate-pulse">
              <div className="h-3 bg-surfaceBorder rounded w-1/2 mb-4" />
              <div className="h-8 bg-surfaceBorder rounded w-1/3" />
            </div>
          ))}
        </div>
      )}

      {/* A2A Agent Cards Section */}
      {cards.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-brand-400" />
              <span>A2A (Agent-to-Agent) Registered Protocol Cards</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Discoverable capability schemas published under the A2A 1.0 specification.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {cards.map((c) => (
              <div key={c.name} className="rounded-xl border border-surfaceBorder bg-surface p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-brand-400">{c.name}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-background border border-surfaceBorder text-slate-400">
                    {c.version}
                  </span>
                </div>
                <p className="text-xs text-slate-300">{c.description}</p>
                <div className="space-y-1 pt-2 border-t border-surfaceBorder">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Declared Capabilities</span>
                  <div className="flex flex-wrap gap-1">
                    {(c.capabilities || []).map((cap: string) => (
                      <span key={cap} className="rounded bg-background px-2 py-0.5 text-[10px] font-mono text-slate-300 border border-surfaceBorder">
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
