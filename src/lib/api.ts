const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getTokens() {
  if (typeof window === "undefined") return { access: null, refresh: null };
  return {
    access: localStorage.getItem("access_token"),
    refresh: localStorage.getItem("refresh_token"),
  };
}

function setTokens(access: string, refresh?: string) {
  localStorage.setItem("access_token", access);
  if (refresh) localStorage.setItem("refresh_token", refresh);
}

function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

async function refreshAccessToken(): Promise<string | null> {
  const { refresh } = getTokens();
  if (!refresh) return null;
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) {
    clearTokens();
    return null;
  }
  const data = await res.json();
  setTokens(data.access_token);
  return data.access_token;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const { access } = getTokens();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (access) headers["Authorization"] = `Bearer ${access}`;
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    if (newToken) return request<T>(path, options, false);
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// Auth
export const api = {
  auth: {
    login: async (email: string, password: string) => {
      const data = await request<{ access_token: string; refresh_token: string }>(
        "/auth/login",
        { method: "POST", body: JSON.stringify({ email, password }) }
      );
      setTokens(data.access_token, data.refresh_token);
      return data;
    },
    logout: async () => {
      const { refresh } = getTokens();
      if (refresh) {
        await request("/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refresh_token: refresh }),
        }).catch(() => {});
      }
      clearTokens();
    },
    me: () => request<{ id: string; name: string; email: string; role: string; permissions: string[] }>("/auth/me"),
  },

  users: {
    list: () => request<import("./types").User[]>("/users/"),
    get: (id: string) => request<import("./types").User>(`/users/${id}`),
    create: (body: object) => request<import("./types").User>("/users/", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: object) =>
      request<import("./types").User>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    delete: (id: string) => request<void>(`/users/${id}`, { method: "DELETE" }),
    changePassword: (body: object) =>
      request<void>("/users/me/password", { method: "PATCH", body: JSON.stringify(body) }),
  },

  beneficiaries: {
    list: (params?: Record<string, string | number | boolean | undefined>) => {
      const qs = new URLSearchParams();
      if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") qs.set(k, String(v)); });
      const q = qs.toString();
      return request<import("./types").BeneficiaryListItem[]>(`/beneficiaries/${q ? `?${q}` : ""}`);
    },
    count: (params?: Record<string, string | number | boolean | undefined>) => {
      const qs = new URLSearchParams();
      if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") qs.set(k, String(v)); });
      const q = qs.toString();
      return request<{ count: number }>(`/beneficiaries/count${q ? `?${q}` : ""}`);
    },
    get: (id: string) => request<import("./types").Beneficiary>(`/beneficiaries/${id}`),
    ingestZip: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return request<import("./types").ZipIngestResult>("/beneficiaries/ingest-zip", { method: "POST", body: form });
    },
    exportUrl: (params?: Record<string, string | undefined>) => {
      const qs = new URLSearchParams();
      if (params) Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
      const q = qs.toString();
      return `${BASE}/beneficiaries/export${q ? `?${q}` : ""}`;
    },
  },

  reports: {
    getInvoiceConfig: () =>
      request<import("./types").InvoiceConfig>("/reports/invoice-config"),
    updateInvoiceConfig: (body: import("./types").InvoiceConfig) =>
      request<{ ok: boolean }>("/reports/invoice-config", { method: "PUT", body: JSON.stringify(body) }),

    _download: async (url: string, filename: string) => {
      const token = localStorage.getItem("access_token");
      const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to generate report");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
    },

    downloadBenpos:             (id: string) => `${BASE}/reports/benpos/${id}`,
    downloadReconciliation:     (id: string) => `${BASE}/reports/reconciliation/${id}`,
    downloadInvoice:            (id: string) => `${BASE}/reports/invoice/${id}`,
    downloadBenposBulk:         ()           => `${BASE}/reports/benpos-bulk`,
    downloadReconciliationBulk: ()           => `${BASE}/reports/reconciliation-bulk`,
    downloadInvoiceBulk:        ()           => `${BASE}/reports/invoice-bulk`,

    generate: async (url: string, filename: string) => {
      const token = localStorage.getItem("access_token");
      const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to generate");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
    },
  },

  companies: {
    list: (params?: Record<string, string | number | boolean | undefined>) => {
      const qs = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== "") qs.set(k, String(v));
        });
      }
      const q = qs.toString();
      return request<import("./types").CompanyListItem[]>(`/companies/${q ? `?${q}` : ""}`);
    },
    count: (params?: Record<string, string | number | boolean | undefined>) => {
      const qs = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== "") qs.set(k, String(v));
        });
      }
      const q = qs.toString();
      return request<{ count: number }>(`/companies/count${q ? `?${q}` : ""}`);
    },
    get: (id: string) => request<import("./types").Company>(`/companies/${id}`),
    create: (body: object) =>
      request<import("./types").Company>("/companies/", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: object) =>
      request<import("./types").Company>(`/companies/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    delete: (id: string) => request<void>(`/companies/${id}`, { method: "DELETE" }),
    ingest: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return request<import("./types").IngestResult>("/companies/ingest", { method: "POST", body: form });
    },
    exportUrl: (params?: Record<string, string | undefined>) => {
      const qs = new URLSearchParams();
      if (params) Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
      const q = qs.toString();
      return `${BASE}/companies/export${q ? `?${q}` : ""}`;
    },
  },
};
