"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ShieldCheck,
  LayoutDashboard,
  CheckSquare,
  GitPullRequest,
  FolderGit2,
  Bot,
  BarChart3,
  AlertCircle,
  LogOut,
  ChevronDown,
  Mail,
  Building2,
  History,
  Menu,
  X,
  Settings,
  Plus,
  ArrowRight,
  User as UserIcon,
} from "lucide-react";
import { api, getToken, clearToken, getCachedUser, UserProfile, getApiBaseUrl } from "@/lib/api";

// Google multicolor SVG icon
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

// Avatar: prefers Google picture, falls back to initials
function Avatar({ user, size = 8 }: { user: UserProfile; size?: number }) {
  const [imgError, setImgError] = useState(false);
  const sizeClass = size === 10 ? "h-10 w-10 text-sm" : size === 7 ? "h-7 w-7 text-[11px]" : "h-8 w-8 text-xs";

  if (user.avatar_url && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatar_url}
        alt={user.full_name || user.username}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        className={`${sizeClass} rounded-full object-cover border border-brand-400/40`}
        onError={() => setImgError(true)}
      />
    );
  }
  const initials = (user.full_name || user.username || "?")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-br from-brand-600 via-cyan-500 to-emerald-400 text-slate-950 font-bold flex items-center justify-center border border-brand-400/40 shrink-0 shadow-glow select-none`}
    >
      {initials}
    </div>
  );
}

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [dbHealthy, setDbHealthy] = useState<boolean | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    setMounted(true);
    setIsMobileMenuOpen(false);
    setIsProfileOpen(false);

    const token = getToken();
    if (token) {
      const cached = getCachedUser();
      if (cached) setUser(cached);
    } else {
      setUser(null);
    }
  }, [pathname]);

  // Background health check & approvals polling
  useEffect(() => {
    const checkEngine = () => {
      const apiBase = getApiBaseUrl();
      let signal: AbortSignal | undefined;
      if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
        try { signal = AbortSignal.timeout(15000); } catch { }
      }
      fetch(`${apiBase}/health`, { signal })
        .then((r) => setDbHealthy(r.ok))
        .catch(() => setDbHealthy(false));
    };

    checkEngine();
    const engineInterval = setInterval(checkEngine, 25000);

    const token = getToken();
    let approvalsInterval: any;
    if (token) {
      api.auth.me().then((fresh) => { if (fresh) setUser(fresh); }).catch(() => { });
      const refreshApprovals = () => {
        api.approvals.list().then((apps) => {
          if (Array.isArray(apps)) {
            setPendingApprovals(apps.filter((a) => (a.status || "").toLowerCase() === "pending").length);
          }
        }).catch(() => { });
      };
      refreshApprovals();
      approvalsInterval = setInterval(refreshApprovals, 15000);
    }

    return () => {
      clearInterval(engineInterval);
      if (approvalsInterval) clearInterval(approvalsInterval);
    };
  }, []);

  const handleLogout = () => {
    clearToken();
    setUser(null);
    router.replace("/login");
  };

  // Authenticated navigation items — 9 top-level tabs strictly matching user spec
  const authNavItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Tasks", href: "/tasks", icon: CheckSquare },
    { name: "Repos", href: "/repositories", icon: FolderGit2 },
    { name: "Approvals", href: "/approvals", icon: AlertCircle, badge: pendingApprovals > 0 ? pendingApprovals : undefined },
    { name: "PRs", href: "/pull-requests", icon: GitPullRequest },
    { name: "History", href: "/history", icon: History },
    { name: "Agents", href: "/agents", icon: Bot },
    { name: "Evaluations", href: "/evaluations", icon: BarChart3 },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  // Public navigation items for anonymous visitors
  const publicNavItems = [
    { name: "Home", href: "/" },
    { name: "How It Works", href: "/#how-it-works" },
    { name: "Security", href: "/#security" },
  ];

  // SSR skeleton
  if (!mounted) {
    return (
      <header className="sticky top-0 z-30 w-full border-b border-surfaceBorder bg-background/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl w-full flex h-14 items-center justify-between px-3 sm:px-5 lg:px-7">
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-brand-500/30 bg-surface/70">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10 border border-brand-500/30">
              <ShieldCheck className="h-4 w-4 text-brand-400" />
            </div>
            <span className="text-sm font-bold text-white">Aegis <span className="text-brand-400">Code</span></span>
          </div>
          <div className="h-7 w-24 rounded-lg bg-surface animate-pulse" />
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-30 w-full border-b border-surfaceBorder bg-background/95 backdrop-blur-md">
      <div className="mx-auto max-w-[1440px] w-full flex h-14 items-center justify-between px-3 sm:px-5 lg:px-6 gap-2 sm:gap-3">

        {/* Left: Brand Logo + Navigation Links */}
        <div className="flex items-center gap-2 xl:gap-3 min-w-0 flex-1">
          <Link href={user ? "/dashboard" : "/"} prefetch={true} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-brand-500/30 bg-surface/70 hover:bg-surface hover:border-brand-500/60 transition-all group shrink-0">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-500/10 border border-brand-500/30 group-hover:border-brand-400 shadow-glow">
              <ShieldCheck className="h-3.5 w-3.5 text-brand-400" />
            </div>
            <span className="text-sm font-bold tracking-tight text-white hidden sm:block">
              Aegis <span className="text-brand-400">Code</span>
            </span>
          </Link>

          {/* Desktop Navigation Links — Authenticated vs Anonymous */}
          {user ? (
            <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1 py-0.5 min-w-0">
              {authNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    prefetch={true}
                    className={`relative flex items-center gap-1 xl:gap-1.5 px-2 xl:px-2.5 py-1.5 rounded-lg text-[11px] xl:text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${isActive
                      ? "bg-surface text-brand-400 border border-surfaceBorder shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-surface/50"
                      }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{item.name}</span>
                    {item.badge !== undefined && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent-amber text-[9px] font-bold text-slate-950 animate-pulse">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          ) : (
            <nav className="hidden md:flex items-center gap-1 ml-3">
              {publicNavItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-surface/50 transition-colors"
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          )}
        </div>

        {/* Right: Actions & User State */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto pl-2">
          {user ? (
            <>
              {/* System status pill — Engine Online / Checking */}
              <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface/70 border border-surfaceBorder text-[11px] font-medium text-slate-300 shrink-0">
                <span className={`h-2 w-2 rounded-full ${dbHealthy === true ? "bg-accent-emerald animate-pulse" : dbHealthy === false ? "bg-accent-rose" : "bg-slate-500"}`} />
                <span className="text-slate-400">Engine</span>
                <span className={dbHealthy === true ? "text-accent-emerald font-semibold" : "text-slate-400"}>
                  {dbHealthy === true ? "Online" : "Checking"}
                </span>
              </div>

              {/* Quick Action: New Task */}
              <Link
                href="/tasks?new=true"
                prefetch={true}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs transition-all shadow-glow hover:scale-[1.02] shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">New Task</span>
              </Link>

              {/* Profile dropdown */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center gap-2 hover:bg-surface/60 transition-colors p-1 rounded-xl focus:outline-none border border-transparent hover:border-surfaceBorder"
                  title="Profile & workspace"
                >
                  <div className="hidden 2xl:flex flex-col text-right max-w-[110px]">
                    <span className="font-bold text-white text-xs truncate leading-tight">
                      {user.username || user.full_name || "User"}
                    </span>
                    <span className="text-slate-500 text-[10px] truncate leading-tight font-mono">
                      {(user.email || "").split("@")[0]}
                    </span>
                  </div>
                  <div className="relative shrink-0">
                    <Avatar user={user} size={8} />
                    {user.auth_provider === "google" && (
                      <div className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#0A0E18] border border-slate-700 p-px">
                        <GoogleIcon className="h-full w-full" />
                      </div>
                    )}
                  </div>
                  <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform shrink-0 ${isProfileOpen ? "rotate-180" : ""}`} />
                </button>

                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-surfaceBorder bg-[#0D131F] p-4 shadow-2xl z-50 space-y-3">
                    <div className="flex items-center gap-3 border-b border-surfaceBorder/60 pb-3">
                      <div className="relative shrink-0">
                        <Avatar user={user} size={10} />
                        {user.auth_provider === "google" && (
                          <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#0A0E18] border border-slate-700 p-0.5">
                            <GoogleIcon className="h-full w-full" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] uppercase font-mono tracking-wider text-brand-400 font-bold mb-0.5">
                          {user.auth_provider === "google" ? "Google Authenticated" : "Authenticated Workspace"}
                        </p>
                        <p className="text-sm font-bold text-white truncate">{user.full_name || user.username}</p>
                        <div className="flex items-center gap-1.5 mt-1 p-1.5 rounded-lg bg-background/80 border border-surfaceBorder/80">
                          <Mail className="h-3 w-3 text-brand-400 shrink-0" />
                          <span className="text-[11px] font-mono text-brand-300 truncate select-all">{user.email}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-400">
                          <Building2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                          <span className="truncate text-[11px]">{user.organization_name || `${user.username || "Your"}'s Workspace`}</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick navigation inside profile menu */}
                    <div className="space-y-1 border-b border-surfaceBorder/60 pb-2">
                      <Link
                        href="/settings"
                        onClick={() => setIsProfileOpen(false)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-surface transition-colors"
                      >
                        <Settings className="h-3.5 w-3.5 text-slate-400" />
                        <span>Settings &amp; Policies</span>
                      </Link>
                      <Link
                        href="/workspace"
                        onClick={() => setIsProfileOpen(false)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-surface transition-colors"
                      >
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        <span>Manage Workspace</span>
                      </Link>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${dbHealthy === true ? "bg-accent-emerald animate-pulse" : dbHealthy === false ? "bg-accent-rose" : "bg-slate-500"}`} />
                        {dbHealthy === true ? "Backend Online" : dbHealthy === false ? "Backend Offline" : "Checking..."}
                      </span>
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-1.5 rounded-lg bg-accent-rose/10 hover:bg-accent-rose/20 text-accent-rose border border-accent-rose/30 px-3 py-1.5 text-xs font-bold transition-colors"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile hamburger */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Toggle navigation menu"
                className="flex lg:hidden h-8 w-8 items-center justify-center rounded-xl border border-surfaceBorder bg-surface text-slate-300 hover:text-white hover:border-brand-500/50 transition-colors"
              >
                {isMobileMenuOpen ? <X className="h-4 w-4 text-brand-400" /> : <Menu className="h-4 w-4" />}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" prefetch={true} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-surfaceBorder bg-surface hover:bg-surface/80 text-xs font-semibold text-white transition-colors">
                <GoogleIcon className="h-3.5 w-3.5 shrink-0" />
                <span>Sign In</span>
              </Link>
              <Link href="/login" prefetch={true} className="flex items-center gap-1.5 rounded-xl bg-brand-500 hover:bg-brand-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 transition-all shadow-glow hover:scale-[1.02]">
                <span>Get Started</span>
                <ArrowRight className="h-3 w-3" />
              </Link>

              {/* Mobile hamburger for anonymous visitors */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Toggle navigation menu"
                className="flex md:hidden h-8 w-8 items-center justify-center rounded-xl border border-surfaceBorder bg-surface text-slate-300 hover:text-white transition-colors"
              >
                {isMobileMenuOpen ? <X className="h-4 w-4 text-brand-400" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-surfaceBorder bg-[#0D131F]/98 backdrop-blur-xl px-4 py-4 space-y-3">
          {user ? (
            <>
              <div className="flex items-center justify-between p-3 rounded-xl bg-background/80 border border-surfaceBorder/80">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <Avatar user={user} size={10} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-white text-sm truncate">{user.full_name || user.username}</span>
                    <span className="text-brand-300 font-mono text-xs truncate">{user.email}</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 truncate">{user.organization_name || `${user.username || "Your"}'s Workspace`}</span>
                  </div>
                </div>
                <button onClick={handleLogout} className="p-2 rounded-lg text-slate-400 hover:text-accent-rose hover:bg-accent-rose/10 shrink-0" title="Sign Out">
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {authNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      prefetch={true}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${isActive ? "bg-brand-500/10 text-brand-400 border border-brand-500/30" : "text-slate-300 hover:text-white hover:bg-surfaceBorder/40"}`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{item.name}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-amber text-[10px] font-bold text-slate-950">{item.badge}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              {publicNavItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-surface transition-colors"
                >
                  {item.name}
                </Link>
              ))}
              <div className="pt-2 border-t border-surfaceBorder/60 flex flex-col gap-2">
                <Link
                  href="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-brand-400"
                >
                  <span>Get Started</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-surfaceBorder bg-surface px-4 py-2.5 text-xs font-semibold text-white"
                >
                  <GoogleIcon className="h-3.5 w-3.5 shrink-0" />
                  <span>Sign In</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
