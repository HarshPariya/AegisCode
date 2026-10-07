"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getToken } from "@/lib/api";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    if (pathname === "/" || pathname === "/login") return true;
    return !!getToken();
  });

  useEffect(() => {
    const token = getToken();

    // Landing page is public: viewable by everyone (both authenticated and guests)
    if (pathname === "/") {
      setAuthorized(true);
      return;
    }

    // Login page is accessible to unauthenticated users; if already logged in, redirect
    if (pathname === "/login") {
      if (token) {
        router.replace("/dashboard");
      }
      setAuthorized(true);
      return;
    }

    // Protected pages: require authentication token
    if (!token) {
      setAuthorized(false);
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    } else {
      setAuthorized(true);
    }
  }, [pathname, router]);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  // Hide protected content until authentication token is validated
  if (!authorized) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
        <p className="text-xs text-slate-400 font-mono">Verifying developer credentials...</p>
      </div>
    );
  }

  return <>{children}</>;
}
