"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export default function ActivityRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Activity is unified into the History page under the 'Audit Activity' tab
    router.replace("/history?tab=audit");
  }, [router]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 text-center text-slate-400">
      <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-brand-400" />
      <p className="text-xs">Redirecting to History &amp; Audit Activity…</p>
    </div>
  );
}
