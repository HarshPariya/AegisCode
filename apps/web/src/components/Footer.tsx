"use client";

import { useEffect, useState } from "react";

export function Footer() {
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [dbStatus, setDbStatus] = useState<string>("Connecting...");

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/health`,
          { signal: AbortSignal.timeout(4000) }
        );
        if (res.ok) {
          const data = await res.json();
          setBackendOnline(true);
          setDbStatus(data.database || "MongoDB Atlas");
        } else {
          setBackendOnline(false);
          setDbStatus("Disconnected");
        }
      } catch {
        setBackendOnline(false);
        setDbStatus("Unavailable");
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="border-t border-surfaceBorder py-6 text-xs text-slate-500 bg-background/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              backendOnline === null
                ? "bg-slate-500"
                : backendOnline
                ? "bg-accent-emerald animate-pulse"
                : "bg-accent-rose"
            }`}
          />
          <span>
            AegisCode Engine v0.1.0 •{" "}
            {backendOnline === null
              ? "Connecting to backend..."
              : backendOnline
              ? dbStatus !== "Unavailable" && dbStatus !== "Disconnected"
                ? "MongoDB Atlas Connected"
                : "Backend Online"
              : "Backend Offline — Start API server"}
          </span>
        </div>
        <div className="flex items-center gap-4 sm:gap-6">
          <span>LangGraph Orchestration</span>
          <span>Isolated Sandboxing</span>
          <span>MCP &amp; A2A Ready</span>
        </div>
      </div>
    </footer>
  );
}
