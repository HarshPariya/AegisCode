"use client";

import { Suspense } from "react";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import { ShieldCheck, CheckCircle2, ArrowRight, Eye, EyeOff, AlertTriangle, Loader2 } from "lucide-react";
import { api, setToken, getToken, setCachedUser, getApiBaseUrl } from "@/lib/api";

/* ─── Backend health check ─────────────────────────────────── */
async function checkBackend(): Promise<boolean> {
  try {
    const cleanUrl = getApiBaseUrl();
    const res = await fetch(`${cleanUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* ─── Login Form ────────────────────────────────────────────── */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/dashboard";
  const isExpired = searchParams.get("expired") === "1";

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(isExpired ? "Your session has expired. Please sign in again." : "");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  const tokenClientRef = useRef<any>(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  /* Check if already logged in */
  useEffect(() => {
    if (getToken()) router.replace(redirectUrl);
  }, [router, redirectUrl]);

  /* Backend health probe */
  useEffect(() => {
    checkBackend().then(setBackendOnline);
    const interval = setInterval(() => {
      checkBackend().then(setBackendOnline);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  /* ── Google OAuth Token Client init ─────────────────────── */
  const initGoogleAuth = useCallback(() => {
    if (
      typeof window === "undefined" ||
      !(window as any).google?.accounts?.oauth2 ||
      !googleClientId
    ) return;

    try {
      tokenClientRef.current = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: "email profile openid",
        callback: async (tokenResponse: any) => {
          if (!tokenResponse?.access_token) {
            setError("Google sign-in was cancelled or failed. Please try again.");
            setGoogleLoading(false);
            return;
          }

          setGoogleLoading(true);
          setError("");

          try {
            /* Fetch user info from Google */
            const uRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
              signal: AbortSignal.timeout(10000),
            });
            if (!uRes.ok) throw new Error("Could not retrieve your Google account info.");
            const userInfo = await uRes.json();

            if (!userInfo?.email) throw new Error("Google did not return an email address.");

            /* Call AegisCode backend */
            const res = await api.auth.google({
              credential: tokenResponse.access_token,
              client_id: googleClientId,
              email: userInfo.email,
              name: userInfo.name || "",
              picture: userInfo.picture || "",
            });

            setToken(res.access_token);
            setCachedUser({
              email: res.email,
              username: res.username || res.email.split("@")[0],
              full_name: res.full_name || res.username,
              avatar_url: userInfo.picture || res.avatar_url || "",
              organization_name: res.organization_name,
              auth_provider: "google",
            });

            setSuccessMsg(`Welcome, ${res.full_name || res.email}! Redirecting…`);
            setTimeout(() => router.replace(redirectUrl), 800);
          } catch (err: any) {
            const msg = err?.message || "Google authentication failed.";
            setError(
              msg.includes("fetch") || msg.includes("connect")
                ? "Cannot reach the AegisCode backend. Please ensure it is running on port 8000."
                : msg
            );
          } finally {
            setGoogleLoading(false);
          }
        },
        error_callback: (err: any) => {
          if (err?.type !== "popup_closed") {
            setError("Google sign-in failed: " + (err?.message || "Unknown error"));
          }
          setGoogleLoading(false);
        },
      });
    } catch (err) {
      console.warn("Google Token Client init error:", err);
    }
  }, [googleClientId, redirectUrl, router]);

  useEffect(() => {
    initGoogleAuth();
  }, [initGoogleAuth]);

  /* ── Google button handler ───────────────────────────────── */
  const handleContinueWithGoogle = () => {
    setError("");

    if (!googleClientId) {
      setError(
        "Google Sign-In is not currently enabled for this workspace. Please sign in with your email and password below."
      );
      return;
    }

    if (!tokenClientRef.current) {
      initGoogleAuth();
      if (!tokenClientRef.current) {
        setError("Google Sign-In is loading or blocked by your browser. Please allow popups and try again.");
        return;
      }
    }

    try {
      setGoogleLoading(true);
      tokenClientRef.current.requestAccessToken({ prompt: "" });
      /* googleLoading will be reset by the callback */
    } catch (e: any) {
      setGoogleLoading(false);
      setError("Could not open Google sign-in popup. Please allow popups for this site.");
    }
  };

  /* ── Email/Password submit ───────────────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    setLoading(true);
    try {
      if (isRegister) {
        if (!username.trim()) { setError("Username is required."); setLoading(false); return; }
        const res = await api.auth.register(email, username.trim(), password, fullName || username);
        setToken(res.access_token);
        setCachedUser({
          email: res.email,
          username: res.username,
          full_name: res.full_name,
          avatar_url: res.avatar_url || "",
          organization_name: res.organization_name,
          auth_provider: "email",
        });
      } else {
        const res = await api.auth.login(email || username, password);
        setToken(res.access_token);
        setCachedUser({
          email: res.email,
          username: res.username,
          full_name: res.full_name,
          avatar_url: res.avatar_url || "",
          organization_name: res.organization_name,
          auth_provider: "email",
        });
      }
      setSuccessMsg("Signing you in…");
      router.replace(redirectUrl);
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Please check your email/password.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsRegister(!isRegister);
    setError("");
    setSuccessMsg("");
    setEmail("");
    setUsername("");
    setPassword("");
    setFullName("");
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-8">
      {/* Google GSI script — only load when Client ID exists */}
      {googleClientId && (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="lazyOnload"
          onLoad={initGoogleAuth}
          onError={() => console.warn("Failed to load Google Sign-In script")}
        />
      )}

      <div className="w-full max-w-md rounded-2xl border border-surfaceBorder bg-[#0c121e] p-6 sm:p-8 shadow-2xl backdrop-blur-xl animate-fade-in">

        {/* ── Header ── */}
        <div className="mb-6 text-left">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-cyan-400 p-0.5 shadow-glow mb-4">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-background">
              <ShieldCheck className="h-5 w-5 text-brand-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {isRegister ? "Create Account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            {isRegister
              ? "Register to start autonomous multi-agent software engineering"
              : "Sign in to access your private workspace, tasks, and isolated agent workforce."}
          </p>
        </div>

        {/* ── Backend Status Banner ── */}
        {backendOnline === false && (
          <div className="mb-4 rounded-lg border border-accent-amber/30 bg-accent-amber/10 p-3 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-accent-amber shrink-0 mt-0.5" />
            <div className="text-xs text-amber-300">
              <p className="font-semibold">Backend server warming up</p>
              <p className="mt-0.5 opacity-80">Render free tier instances sleep after inactivity and take ~30-50s to wake up on first load.</p>
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="mb-5 rounded-lg border border-accent-rose/30 bg-accent-rose/10 p-3 text-xs text-accent-rose flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Success ── */}
        {successMsg && (
          <div className="mb-5 flex items-center gap-2 rounded-lg border border-accent-emerald/30 bg-accent-emerald/10 p-3 text-xs text-accent-emerald">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Username</label>
                <input
                  id="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="yourname"
                  autoComplete="username"
                  className="w-full rounded-lg border border-surfaceBorder bg-background px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400/30 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Full Name <span className="text-slate-500 font-normal">(optional)</span>
                </label>
                <input
                  id="fullname"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Smith"
                  autoComplete="name"
                  className="w-full rounded-lg border border-surfaceBorder bg-background px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400/30 transition-colors"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {isRegister ? "Email address" : "Email or username"}
            </label>
            <input
              id="email"
              type={isRegister ? "email" : "text"}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isRegister ? "you@company.com" : "you@company.com or username"}
              autoComplete={isRegister ? "email" : "username email"}
              className="w-full rounded-lg border border-surfaceBorder bg-background px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400/30 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={isRegister ? "new-password" : "current-password"}
                className="w-full rounded-lg border border-surfaceBorder bg-background px-3.5 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400/30 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            id="submit-btn"
            type="submit"
            disabled={loading || backendOnline === false}
            className="w-full mt-2 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 py-3 text-sm font-bold text-white transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /><span>Processing…</span></>
            ) : (
              <><span>{isRegister ? "Create Account" : "Sign In"}</span><ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        </form>

        {/* ── Google Sign-In ── */}
        {googleClientId ? (
          <>
            <div className="relative flex items-center justify-center my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-surfaceBorder/60" />
              </div>
              <span className="relative bg-[#0c121e] px-3 text-xs font-medium text-slate-500">or continue with</span>
            </div>

            <button
              id="google-signin-btn"
              type="button"
              onClick={handleContinueWithGoogle}
              disabled={googleLoading || backendOnline === false}
              className="w-full flex items-center justify-center gap-3 rounded-lg bg-white hover:bg-slate-100 py-3 px-4 text-sm font-semibold text-slate-900 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {googleLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin text-slate-600" /><span>Connecting to Google…</span></>
              ) : (
                <>
                  <svg className="h-4 w-4 shrink-0 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>
          </>
        ) : (
          /* Enterprise SSO info badge */
          <div className="mt-6 rounded-xl border border-surfaceBorder/60 bg-surface/50 p-3.5 flex items-center justify-center gap-2 text-slate-400 text-xs">
            <ShieldCheck className="h-4 w-4 text-brand-400 shrink-0" />
            <span>Enterprise workspace secured with zero-trust session tokens</span>
          </div>
        )}

        {/* ── Switch mode ── */}
        <div className="mt-8 pt-4 border-t border-surfaceBorder/40 text-center text-xs text-slate-400">
          <span>{isRegister ? "Already have an account? " : "Don't have an account? "}</span>
          <button
            id="switch-mode-btn"
            type="button"
            onClick={switchMode}
            className="font-semibold text-white hover:text-brand-400 transition-colors"
          >
            {isRegister ? "Sign In" : "Create Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Page wrapper ──────────────────────────────────────────── */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[85vh] flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
