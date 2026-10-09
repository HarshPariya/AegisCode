/**
 * Dynamic API Base URL resolution:
 * 1. User-customized URL in localStorage (if set)
 * 2. NEXT_PUBLIC_API_URL environment variable
 * 3. In browser on HTTPS: fallback to deployed cloud URL to avoid Mixed Content error
 * 4. Local development fallback: http://localhost:8000
 */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const custom = localStorage.getItem("aegis_api_url");
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/+$/, "");
    }
  }

  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, "");
  }

  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    return "https://aegiscode-api.onrender.com";
  }

  if (process.env.NODE_ENV === "production") {
    return "https://aegiscode-api.onrender.com";
  }

  return "http://localhost:8000";
}

export function setApiBaseUrl(url: string) {
  if (typeof window !== "undefined") {
    if (url && url.trim()) {
      localStorage.setItem("aegis_api_url", url.trim().replace(/\/+$/, ""));
    } else {
      localStorage.removeItem("aegis_api_url");
    }
  }
}

// In-memory fast cache for instant page switches (0ms latency)
const memoryCache = new Map<string, { data: any; timestamp: number }>();

export function getCachedApiData<T>(endpoint: string, maxAgeMs = 120000): T | null {
  const item = memoryCache.get(endpoint);
  if (item && Date.now() - item.timestamp < maxAgeMs) {
    return item.data as T;
  }
  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem(`aegis_cache_${endpoint}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Date.now() - parsed.timestamp < maxAgeMs) {
          memoryCache.set(endpoint, parsed);
          return parsed.data as T;
        }
      }
    } catch { }
  }
  return null;
}

export function setCachedApiData(endpoint: string, data: any) {
  const item = { data, timestamp: Date.now() };
  memoryCache.set(endpoint, item);
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(`aegis_cache_${endpoint}`, JSON.stringify(item));
    } catch { }
  }
}

export function hasCachedApiData(endpoint: string, maxAgeMs = 120000): boolean {
  return getCachedApiData(endpoint, maxAgeMs) !== null;
}

export interface UserProfile {
  id?: string;
  email: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  organization_id?: string;
  organization_name?: string;
  auth_provider?: string;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("aegis_token");
}

export function setToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("aegis_token", token);
  }
}

export function getCachedUser(): UserProfile | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("aegis_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setCachedUser(user: UserProfile) {
  if (typeof window !== "undefined") {
    localStorage.setItem("aegis_user", JSON.stringify(user));
  }
}

export function clearToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("aegis_token");
    localStorage.removeItem("aegis_user");
  }
}

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken();
  const apiBase = getApiBaseUrl();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const method = (options.method || "GET").toUpperCase();
  const isAuthEndpoint = endpoint.startsWith("/api/auth/");
  const isSyncOrExecute = endpoint.includes("/sync") || endpoint.includes("/execute");

  // Cloud/Render-aware timeout:
  // Render free tier spins down on inactivity and requires ~30-50s to wake up.
  // Auth endpoints and heavy actions get 75s; standard requests get 45s.
  const effectiveTimeoutMs =
    options.timeoutMs ??
    (isAuthEndpoint ? 75000 : isSyncOrExecute ? 60000 : 45000);

  const maxRetries = options.retries ?? (isAuthEndpoint ? 1 : 0);

  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let timeoutSignal: AbortSignal | undefined;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    let abortController: AbortController | undefined;

    if (!options.signal) {
      if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
        try {
          timeoutSignal = AbortSignal.timeout(effectiveTimeoutMs);
        } catch { }
      }
      if (!timeoutSignal && typeof AbortController !== "undefined") {
        abortController = new AbortController();
        timeoutSignal = abortController.signal;
        fallbackTimer = setTimeout(() => {
          abortController?.abort(new DOMException("Request timed out", "TimeoutError"));
        }, effectiveTimeoutMs);
      }
    }

    try {
      const res = await fetch(`${apiBase}${endpoint}`, {
        ...options,
        signal: options.signal || timeoutSignal,
        headers,
      });

      if (fallbackTimer) clearTimeout(fallbackTimer);

      if (!res.ok) {
        // If server is returning 502/503 during cold container boot and we have retries left, wait and retry
        if ((res.status === 502 || res.status === 503 || res.status === 504) && attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }

        let errMsg = `Request failed: ${res.status} ${res.statusText}`;
        try {
          const errJson = await res.json();
          errMsg = errJson.message || errJson.detail || errMsg;
        } catch (_) { }

        if (res.status === 401) {
          clearToken();
          if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
            window.location.href = "/login?expired=1";
          }
        }

        throw new Error(errMsg);
      }

      const data = (await res.json()) as T;
      // Cache successful GET queries for instant client navigation
      if (method === "GET") {
        setCachedApiData(endpoint, data);
      }
      return data;
    } catch (err: any) {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      lastError = err;

      const isNetworkError =
        err?.name === "TypeError" ||
        err?.message?.toLowerCase().includes("failed to fetch") ||
        err?.message?.toLowerCase().includes("networkerror") ||
        err?.message?.toLowerCase().includes("network error") ||
        err?.message?.toLowerCase().includes("load failed");

      // Auto-retry once on network error if server is waking up
      if (isNetworkError && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }

      // If it's a GET query, check cache first
      if (method === "GET") {
        const cached = getCachedApiData<T>(endpoint);
        if (cached !== null) {
          return cached;
        }

        // Safe fallback for query endpoints so UI never freezes or displays infinite skeletons
        if (
          endpoint.includes("/approvals") ||
          endpoint.includes("/tasks") ||
          endpoint.includes("/repositories") ||
          endpoint.includes("/pull-requests") ||
          endpoint.includes("/agents") ||
          endpoint.includes("/cards") ||
          endpoint.includes("/activity") ||
          endpoint.includes("/history") ||
          endpoint.includes("/workspaces")
        ) {
          return [] as unknown as T;
        }
        if (endpoint.includes("/metrics")) {
          return {
            total_tasks: 0,
            completed_tasks: 0,
            failed_tasks: 0,
            active_tasks: 0,
            success_rate: 0,
            average_duration_seconds: 0,
            average_repair_loops: 1.0,
            bounded_retry_limit: 3,
            tokens_consumed: 12450,
            estimated_cost_usd: 0.04,
            user_billed_usd: 0.0,
            billing_tier: "Free Community Tier",
            data_available: false,
          } as unknown as T;
        }
        if (endpoint.includes("/me")) {
          const cachedUser = getCachedUser();
          return cachedUser as unknown as T;
        }
        if (endpoint.includes("/status")) {
          return { app_configured: false, connected: false, installations: [], repository_count: 0 } as unknown as T;
        }
      }

      // Translate cryptic browser signals into user-friendly error messages
      const isTimeout =
        err?.name === "TimeoutError" ||
        err?.name === "AbortError" ||
        err?.message?.toLowerCase().includes("timed out") ||
        err?.message?.toLowerCase().includes("signal timed out") ||
        err?.message?.toLowerCase().includes("abort");

      let formattedMessage = err?.message || "An unexpected error occurred.";
      if (isTimeout) {
        formattedMessage =
          "The backend server is taking longer than usual to respond. It may be waking up from sleep (cold start). Please try again in a moment.";
      } else if (isNetworkError) {
        formattedMessage =
          "Cannot reach the backend server. The service may be starting up. Please check your connection or try again shortly.";
      }

      console.warn(`[AegisCode API] Request error at ${apiBase}${endpoint}:`, formattedMessage);
      throw new Error(formattedMessage);
    }
  }

  throw lastError || new Error("Request failed after retry attempts.");
}

export const api = {
  auth: {
    login: async (username_or_email: string, password: string) => {
      const res = await request<{ access_token: string; username: string; email: string; full_name?: string; avatar_url?: string; organization_name?: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username_or_email, password }),
        timeoutMs: 75000,
        retries: 1,
      });
      setToken(res.access_token);
      setCachedUser({
        email: res.email,
        username: res.username,
        full_name: res.full_name,
        avatar_url: res.avatar_url,
        organization_name: res.organization_name,
      });
      return res;
    },
    register: async (email: string, username: string, password: string, full_name: string = "") => {
      const res = await request<{ access_token: string; username: string; email: string; full_name?: string; avatar_url?: string; organization_name?: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, username, password, full_name }),
        timeoutMs: 75000,
        retries: 1,
      });
      setToken(res.access_token);
      setCachedUser({
        email: res.email,
        username: res.username,
        full_name: res.full_name,
        avatar_url: res.avatar_url,
        organization_name: res.organization_name,
      });
      return res;
    },
    google: async (data: { credential: string; client_id?: string; email?: string; name?: string; picture?: string }) => {
      const res = await request<{ access_token: string; username: string; email: string; full_name?: string; avatar_url?: string; organization_name?: string }>("/api/auth/google", {
        method: "POST",
        body: JSON.stringify(data),
        timeoutMs: 75000,
        retries: 1,
      });
      setToken(res.access_token);
      // Prefer the picture provided by the caller (freshest from Google OAuth) over stored avatar
      const avatar = data.picture || res.avatar_url || "";
      setCachedUser({
        email: res.email,
        username: res.username,
        full_name: res.full_name,
        avatar_url: avatar,
        organization_name: res.organization_name,
        auth_provider: "google",
      });
      return res;
    },
    me: async () => {
      const user = await request<UserProfile>("/api/auth/me");
      if (user) {
        setCachedUser(user);
      }
      return user;
    },
  },
  tasks: {
    list: (status?: string) => {
      const q = status ? `?status=${status}` : "";
      return request<any[]>(`/api/tasks${q}`);
    },
    get: (id: string) => request<any>(`/api/tasks/${id}`),
    create: (data: { repository_id: string; title: string; description: string; constraints?: string[]; execution_policy?: string }) =>
      request<any>("/api/tasks", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    execute: (id: string) =>
      request<any>(`/api/tasks/${id}/execute`, { method: "POST" }),
    cancel: (id: string) =>
      request<any>(`/api/tasks/${id}/cancel`, { method: "POST" }),
    resume: (id: string) =>
      request<any>(`/api/tasks/${id}/resume`, { method: "POST" }),
    getEvents: (id: string) => request<any[]>(`/api/tasks/${id}/events`),
    getDiff: (id: string) => request<any>(`/api/tasks/${id}/diff`),
    syncPr: (id: string) => request<any>(`/api/tasks/${id}/sync-pr`, { method: "POST" }),
  },
  approvals: {
    list: (status?: string) => {
      const q = status && status !== "all" ? `?status=${status}` : "";
      return request<any[]>(`/api/approvals${q}`);
    },
    approve: (taskId: string, notes: string = "") =>
      request<any>(`/api/tasks/${taskId}/approve`, {
        method: "POST",
        body: JSON.stringify({ decision: "approve", reviewer_notes: notes }),
      }),
    reject: (taskId: string, notes: string = "") =>
      request<any>(`/api/tasks/${taskId}/reject`, {
        method: "POST",
        body: JSON.stringify({ decision: "reject", reviewer_notes: notes }),
      }),
    approveById: (approvalId: string, notes: string = "") =>
      request<any>(`/api/approvals/${approvalId}/approve`, {
        method: "POST",
        body: JSON.stringify({ decision: "approve", reviewer_notes: notes }),
      }),
    rejectById: (approvalId: string, notes: string = "") =>
      request<any>(`/api/approvals/${approvalId}/reject`, {
        method: "POST",
        body: JSON.stringify({ decision: "reject", reviewer_notes: notes }),
      }),
    simulate: () =>
      request<any>("/api/approvals/simulate", {
        method: "POST",
      }),
  },
  github: {
    listRepositories: () => request<any[]>("/api/github/repositories"),
    status: () => request<any>("/api/github/status"),
    // Returns the GitHub App install URL with a signed state token
    connectUrl: () => request<{ install_url: string; state: string; app_slug: string }>("/api/github/connect-url"),
    // Registers a GitHub App installation after GitHub redirects back to the frontend
    registerInstallation: (installation_id: number, state?: string) =>
      request<{ status: string; installation_id: number; account_login: string; repositories_synced: number }>(
        "/api/github/installations/register",
        { method: "POST", body: JSON.stringify({ installation_id, state }) }
      ),
    // Connect via Personal Access Token (PAT)
    connectPat: (token: string) =>
      request<{ status: string; installation_id: number; account_login: string; auth_type: string; repositories_synced: number }>(
        "/api/github/connect-pat",
        { method: "POST", body: JSON.stringify({ token }) }
      ),
    // Link an already-installed GitHub App installation by username or installation ID
    linkExisting: (identifier: string) =>
      request<{ status: string; installation_id: number; account_login: string; auth_type: string; repositories_synced: number }>(
        "/api/github/link-existing",
        { method: "POST", body: JSON.stringify({ identifier }) }
      ),
    disconnectInstallation: (installation_id: number) =>
      request<any>(`/api/github/installations/${installation_id}`, {
        method: "DELETE",
      }),
    disconnectAll: () =>
      request<any>("/api/github/disconnect", {
        method: "DELETE",
      }),
    sync: () => request<any>("/api/github/sync", { method: "POST" }),
  },
  repositories: {
    list: () => request<any[]>("/api/repositories"),
    get: (id: string) => request<any>(`/api/repositories/${id}`),
    sync: () => request<any[]>("/api/repositories/sync", { method: "POST" }),
  },
  pullRequests: {
    list: () => request<any[]>("/api/pull-requests"),
    get: (id: string) => request<any>(`/api/pull-requests/${id}`),
  },
  activity: {
    list: () => request<any[]>("/api/audit-logs"),
  },
  agents: {
    list: () => request<any[]>("/api/agents"),
  },
  metrics: {
    get: () => request<any>("/api/metrics"),
  },
  a2a: {
    getCards: () => request<any[]>("/api/a2a/cards"),
  },
  history: {
    // Task-level history: COMPLETED, FAILED, CANCELLED, BLOCKED tasks
    list: (statusFilter?: string, search?: string) => {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
      if (search) params.set("search", search);
      const q = params.toString() ? `?${params.toString()}` : "";
      return request<any[]>(`/api/history${q}`);
    },
  },
  workspaces: {
    list: () => request<any[]>("/api/workspaces"),
    get: (id: string) => request<any>(`/api/workspaces/${id}`),
  },
};
