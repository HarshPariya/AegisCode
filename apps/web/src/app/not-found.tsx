import Link from "next/link";
import { ShieldAlert, ArrowLeft, LayoutDashboard, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="h-16 w-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto shadow-glow">
          <ShieldAlert className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono text-brand-400 font-bold uppercase tracking-wider">
            404 — Route Not Found
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Page Does Not Exist
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            The requested AegisCode resource or endpoint could not be found. Check the URL or return to your workspace dashboard.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-brand-400 transition-all shadow-glow hover:scale-[1.02]"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Go to Dashboard</span>
          </Link>
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-surfaceBorder bg-surface px-5 py-2.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-surface/80 transition-colors"
          >
            <Home className="h-4 w-4" />
            <span>Return Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
