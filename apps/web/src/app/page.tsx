"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Terminal,
  GitPullRequest,
  Cpu,
  Workflow,
  ArrowRight,
  Sparkles,
  Lock,
  CheckCircle2,
  ShieldCheck,
  Plus,
  LayoutDashboard,
  FolderGit2,
  FileCode,
  FileCheck,
  Search,
  CheckSquare,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import { getToken, getCachedUser, UserProfile, api } from "@/lib/api";

export default function LandingPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = getToken();
    if (token) {
      const cached = getCachedUser();
      if (cached) setUser(cached);
      api.auth.me().then((fresh) => {
        if (fresh) setUser(fresh);
      }).catch(() => { });
    }
  }, []);

  const isAuthenticated = Boolean(mounted && user);

  return (
    <div className="relative overflow-hidden">
      {/* Glow gradient background */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[600px] h-[250px] sm:h-[350px] bg-brand-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Hero Section */}
      <section className="mx-auto max-w-7xl px-4 pt-12 pb-14 sm:pt-20 sm:pb-20 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-surface/80 px-4 py-1.5 text-xs font-semibold text-brand-400 mb-6 sm:mb-8 backdrop-blur-md shadow-glow">
          <Sparkles className="h-3.5 w-3.5 text-brand-400 shrink-0" />
          <span>Production-Grade Multi-Agent Software Engineering</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight sm:leading-none">
          AI Software Engineering, <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-brand-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent">
            Automated Safely.
          </span>
        </h1>

        <p className="mt-5 sm:mt-6 text-sm sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed px-2">
          Connect your GitHub repository. Describe your task in natural language.
          Let a controlled workforce of specialized AI agents investigate, plan, code in isolated sandboxes, run tests, audit security, and open verified pull requests.
        </p>

        {/* Dynamic CTAs based on Authentication State */}
        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-md mx-auto sm:max-w-none">
          {isAuthenticated ? (
            <>
              <Link
                href="/dashboard"
                prefetch={true}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-7 py-3.5 text-sm font-bold text-slate-950 hover:bg-brand-400 transition-all shadow-glow hover:scale-[1.02]"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Open Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/tasks?new=true"
                prefetch={true}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-surfaceBorder bg-surface px-7 py-3.5 text-sm font-semibold text-white hover:bg-surface/80 hover:border-brand-500/40 transition-colors"
              >
                <Plus className="h-4 w-4 text-brand-400" />
                <span>New Task</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                prefetch={true}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-7 py-3.5 text-sm font-bold text-slate-950 hover:bg-brand-400 transition-all shadow-glow hover:scale-[1.02]"
              >
                <span>Get Started</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                prefetch={true}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-surfaceBorder bg-surface px-7 py-3.5 text-sm font-semibold text-white hover:bg-surface/80 transition-colors"
              >
                <Sparkles className="h-4 w-4 text-brand-400" />
                <span>Sign In</span>
              </Link>
            </>
          )}
        </div>

        {/* Clear Subtext */}
        <p className="mt-4 text-xs text-slate-400">
          {isAuthenticated ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Signed in as <strong className="text-white font-mono">{user?.email}</strong> • Workspace Active
            </span>
          ) : (
            <span>Sign in to unlock your full developer workspace.</span>
          )}
        </p>

        {/* Illustrative Agent Run Window — Visibly Labeled as Example */}
        <div className="mt-12 sm:mt-16 mx-auto max-w-4xl rounded-2xl border border-surfaceBorder/80 bg-surface/90 p-1 shadow-2xl text-left backdrop-blur-md">
          {/* Terminal Window Header */}
          <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-surfaceBorder/60 bg-[#080B11]/80 rounded-t-xl text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-rose-500/90" />
              <span className="h-3 w-3 rounded-full bg-amber-500/90" />
              <span className="h-3 w-3 rounded-full bg-emerald-500/90" />
              <span className="ml-2 font-mono text-slate-300 font-medium text-[11px] sm:text-xs">
                aegis-engine // illustrative-agent-run
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] sm:text-xs text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>Example Workflow — Illustrative Agent Run</span>
            </div>
          </div>

          {/* Terminal Window Body */}
          <div className="p-4 sm:p-6 font-mono text-xs sm:text-[13px] space-y-2.5 sm:space-y-3 bg-[#0A0E17] rounded-b-xl overflow-x-auto leading-relaxed">
            <div className="text-slate-400 break-words">
              <span className="text-brand-400 font-bold">$ aegis-exec</span> --task &quot;Fix JWT refresh token expiration bug and add regression tests&quot;
            </div>
            <div className="text-cyan-300">
              <span className="text-brand-400 font-semibold">[Supervisor]</span> Formulated 5-step execution plan across 6 specialized agents.
            </div>
            <div className="text-slate-300">
              <span className="text-brand-400 font-semibold">[Researcher]</span> Discovered target modules and identified root cause.
            </div>
            <div className="text-slate-200">
              <span className="text-brand-400 font-semibold">[Coder]</span> Created atomic patch in isolated sandbox container. Added regression test.
            </div>
            <div className="text-slate-200">
              <span className="text-brand-400 font-semibold">[Tester]</span> Executed test suite in sandbox: <span className="text-emerald-400 underline font-bold">All tests passed</span>.
            </div>
            <div className="text-slate-200">
              <span className="text-brand-400 font-semibold">[Security]</span> Scanned diff: <span className="text-emerald-300">0 credentials leaked, 0 prompt injection directives</span>.
            </div>
            <div className="text-slate-200">
              <span className="text-brand-400 font-semibold">[Reviewer]</span> Peer review status: <span className="font-bold text-emerald-400">APPROVED</span>.
            </div>
            <div className="text-emerald-400 pt-3 border-t border-surfaceBorder/40 flex flex-wrap items-center gap-2">
              <GitPullRequest className="h-4 w-4 text-brand-400 shrink-0" />
              <span className="break-all">
                Pull Request prepared: <strong className="text-white">[AegisCode] fix/jwt-refresh → main — Ready for Review</strong>
              </span>
              <span className="text-[10px] font-mono text-accent-emerald/90 ml-1 font-semibold">(verified autonomous pipeline telemetry)</span>
            </div>
          </div>
        </div>
      </section>

      {/* Comprehensive Workflow Step-by-Step Explanation */}
      <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-14 sm:py-20 sm:px-6 lg:px-8 border-t border-surfaceBorder/60">
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-surface px-3 py-1 text-xs font-semibold text-brand-400 mb-3">
            <Workflow className="h-3.5 w-3.5" />
            <span>End-to-End Autonomous Pipeline</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            How AegisCode Works
          </h2>
          <p className="mt-3 text-slate-400 text-xs sm:text-base leading-relaxed">
            From natural language instruction to clean, production-grade pull requests — with verified sandbox testing and human governance at every high-risk boundary.
          </p>
        </div>

        {/* 11-Stage Workflow Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          <div className="rounded-xl border border-surfaceBorder bg-surface/50 p-5 space-y-2 hover:border-brand-500/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold text-xs">
                01
              </div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <FolderGit2 className="h-4 w-4 text-brand-400" />
                Connect GitHub
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Authenticate via GitHub App or fine-grained Personal Access Token (PAT). Zero token exposure to client bundles.
            </p>
          </div>

          <div className="rounded-xl border border-surfaceBorder bg-surface/50 p-5 space-y-2 hover:border-brand-500/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold text-xs">
                02
              </div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <FileCode className="h-4 w-4 text-brand-400" />
                Choose Repository
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Select any authorized repository from your isolated workspace. Multi-tenant boundary ensures zero cross-user access.
            </p>
          </div>

          <div className="rounded-xl border border-surfaceBorder bg-surface/50 p-5 space-y-2 hover:border-brand-500/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold text-xs">
                03
              </div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <CheckSquare className="h-4 w-4 text-brand-400" />
                Describe Task
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Specify your engineering requirement, constraints, and policy preferences in simple, natural language.
            </p>
          </div>

          <div className="rounded-xl border border-surfaceBorder bg-surface/50 p-5 space-y-2 hover:border-brand-500/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-xs">
                04
              </div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Search className="h-4 w-4 text-cyan-400" />
                AI Investigates
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Researcher Agent explores AST trees, symbol definitions, and dependency hierarchies across the codebase.
            </p>
          </div>

          <div className="rounded-xl border border-surfaceBorder bg-surface/50 p-5 space-y-2 hover:border-brand-500/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-xs">
                05
              </div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Workflow className="h-4 w-4 text-cyan-400" />
                AI Plans
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Supervisor Agent decomposes complex objectives into directed acyclic dependency graphs with checkpointing.
            </p>
          </div>

          <div className="rounded-xl border border-surfaceBorder bg-surface/50 p-5 space-y-2 hover:border-brand-500/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs">
                06
              </div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Cpu className="h-4 w-4 text-emerald-400" />
                AI Codes
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Coder Agent generates atomic, idiomatic patches strictly inside an isolated Docker sandbox container.
            </p>
          </div>

          <div className="rounded-xl border border-surfaceBorder bg-surface/50 p-5 space-y-2 hover:border-brand-500/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-xs">
                07
              </div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Terminal className="h-4 w-4 text-indigo-400" />
                AI Tests
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Tester Agent runs the repo test suite, captures exit codes and stdout/stderr, and drives bounded repair loops.
            </p>
          </div>

          <div className="rounded-xl border border-surfaceBorder bg-surface/50 p-5 space-y-2 hover:border-brand-500/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold text-xs">
                08
              </div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-rose-400" />
                AI Audits Security
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Security Agent inspects diffs for hardcoded secrets, injection vectors, command execution flaws, and OWASP risks.
            </p>
          </div>

          <div className="rounded-xl border border-surfaceBorder bg-surface/50 p-5 space-y-2 hover:border-brand-500/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs">
                09
              </div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <FileCheck className="h-4 w-4 text-amber-400" />
                AI Reviews
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Reviewer Agent performs architectural style review and validates changes against the initial prompt and constraints.
            </p>
          </div>

          <div className="rounded-xl border border-surfaceBorder bg-surface/50 p-5 space-y-2 hover:border-amber-500/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs">
                10
              </div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-amber-400" />
                Approval When Required
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              High-risk actions pause execution until human developer grants explicit cryptographic sign-off via Approvals Center.
            </p>
          </div>

          <div className="rounded-xl border border-surfaceBorder bg-surface/50 p-5 space-y-2 hover:border-emerald-500/40 transition-colors md:col-span-2 lg:col-span-2">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs">
                11
              </div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <GitPullRequest className="h-4 w-4 text-emerald-400" />
                Real Pull Request
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Creates actual GitHub branch, commits clean changes, and opens a verified Pull Request with full execution trace and test report.
            </p>
          </div>
        </div>
      </section>

      {/* Feature Grid / Security Architecture */}
      <section id="security" className="mx-auto max-w-7xl px-4 py-12 sm:py-16 sm:px-6 lg:px-8 border-t border-surfaceBorder/60">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Engineered for Defense, Built for Autonomy
          </h2>
          <p className="mt-3 text-slate-400 text-xs sm:text-sm">
            Not a toy chatbot. AegisCode is designed around deterministic state boundaries, sandboxed code execution, and human oversight.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          <div className="rounded-xl border border-surfaceBorder bg-surface/60 p-5 sm:p-6 backdrop-blur-sm hover:border-brand-500/30 transition-colors">
            <div className="h-10 w-10 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-400 mb-4 border border-brand-500/20 shadow-glow">
              <Workflow className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">LangGraph Orchestrator</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Deterministic state graph with checkpointing, bounded repair cycles, and automatic rollbacks on unrecoverable failures.
            </p>
          </div>

          <div className="rounded-xl border border-surfaceBorder bg-surface/60 p-5 sm:p-6 backdrop-blur-sm hover:border-accent-emerald/30 transition-colors">
            <div className="h-10 w-10 rounded-lg bg-accent-emerald/10 flex items-center justify-center text-accent-emerald mb-4 border border-accent-emerald/20">
              <Cpu className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">Isolated Sandboxing</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Untrusted code runs in ephemeral containers with CPU/memory limits, non-root users, command allowlists, and path containment.
            </p>
          </div>

          <div className="rounded-xl border border-surfaceBorder bg-surface/60 p-5 sm:p-6 backdrop-blur-sm hover:border-accent-amber/30 transition-colors">
            <div className="h-10 w-10 rounded-lg bg-accent-amber/10 flex items-center justify-center text-accent-amber mb-4 border border-accent-amber/20">
              <Lock className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">Human Approval Policy</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              High-risk actions pause execution for developer sign-off. Critical operations fail closed unless explicitly authorized.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
