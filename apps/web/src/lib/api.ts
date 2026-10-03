/**
 * AegisCode Typed API Client
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

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

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
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

    return res.json() as Promise<T>;
  } catch (err: any) {
    const isNetworkError = err.name === "TypeError" || err.message?.includes("fetch");
    if (isNetworkError) {
      console.warn(`[AegisCode API] Backend server unreachable at ${API_BASE}${endpoint}. Ensure 'python -m uvicorn services.api.main:app --reload --port 8000' is running.`);
      // Return safe empty fallback for query endpoints
      const method = options.method || "GET";
      if (method === "GET") {
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
            average_repair_loops: 0.0,
            tokens_consumed: 0,
            estimated_cost_usd: 0.0,
            data_available: false,
          } as unknown as T;
        }
        if (endpoint.includes("/me")) {
          return null as unknown as T;
        }
        if (endpoint.includes("/status")) {
          return { app_configured: false, connected: false, installations: [], repository_count: 0 } as unknown as T;
        }
      }
      throw new Error("Cannot connect to AegisCode backend API on port 8000. Please start the backend with 'python -m uvicorn services.api.main:app --reload --port 8000'.");
    }
    throw err;
  }
}

export const api = {
  auth: {
    login: async (username_or_email: string, password: string) => {
      const res = await request<{ access_token: string; username: string; email: string; full_name?: string; avatar_url?: string; organization_name?: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username_or_email, password }),
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
