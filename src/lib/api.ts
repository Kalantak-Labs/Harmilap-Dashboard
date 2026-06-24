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
    let msg = err.detail;
    if (Array.isArray(msg)) {
      msg = msg.map((e) => (e?.msg ? e.msg.replace(/^Value error,\s*/, "") : JSON.stringify(e))).join("; ");
    }
    throw new Error(typeof msg === "string" && msg ? msg : "Request failed");
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
    ingestCdslZip: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return request<import("./types").ZipIngestResult>("/beneficiaries/ingest-cdsl-zip", { method: "POST", body: form });
    },
    exportUrl: (params?: Record<string, string | undefined>) => {
      const qs = new URLSearchParams();
      if (params) Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
      const q = qs.toString();
      return `${BASE}/beneficiaries/export${q ? `?${q}` : ""}`;
    },
  },

  reports: {
    downloadBenpos:             (id: string, depository?: string) => `${BASE}/reports/benpos/${id}${depository ? `?depository=${depository}` : ""}`,
    downloadReconciliation:     (id: string, params?: { report_date?: string; ref_prefix?: string }) => {
      const qs = new URLSearchParams();
      if (params?.report_date) qs.set("report_date", params.report_date);
      if (params?.ref_prefix)  qs.set("ref_prefix", params.ref_prefix);
      const q = qs.toString();
      return `${BASE}/reports/reconciliation/${id}${q ? `?${q}` : ""}`;
    },
    downloadBenposBulk:         ()           => `${BASE}/reports/benpos-bulk`,
    downloadReconciliationBulk: (params?: { report_date?: string; ref_prefix?: string }) => {
      const qs = new URLSearchParams();
      if (params?.report_date) qs.set("report_date", params.report_date);
      if (params?.ref_prefix)  qs.set("ref_prefix", params.ref_prefix);
      const q = qs.toString();
      return `${BASE}/reports/reconciliation-bulk${q ? `?${q}` : ""}`;
    },

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

  invoices: {
    getConfig: () =>
      request<import("./types").InvoiceConfig>("/invoices/config"),
    updateConfig: (body: import("./types").InvoiceConfig) =>
      request<{ ok: boolean }>("/invoices/config", { method: "PUT", body: JSON.stringify(body) }),

    listParties: (search?: string) => {
      const q = search ? `?search=${encodeURIComponent(search)}` : "";
      return request<import("./types").PartyListItem[]>(`/invoices/parties${q}`);
    },
    getInvoice: (partyKey: string) =>
      request<import("./types").Invoice>(`/invoices/parties/${encodeURIComponent(partyKey)}`),
    updateInvoice: (partyKey: string, body: import("./types").InvoiceUpdate) =>
      request<import("./types").Invoice>(`/invoices/parties/${encodeURIComponent(partyKey)}`, { method: "PUT", body: JSON.stringify(body) }),
    checkInvoiceNo: (invoiceNo: string, partyKey?: string) => {
      const params = new URLSearchParams({ invoice_no: invoiceNo });
      if (partyKey) params.set("party_key", partyKey);
      return request<import("./types").InvoiceNoCheck>(`/invoices/check-invoice-no?${params}`);
    },
    listArchives: (partyKey: string) =>
      request<import("./types").InvoiceArchive[]>(
        `/invoices/parties/${encodeURIComponent(partyKey)}/archives`,
      ),
    downloadArchive: async (partyKey: string, archiveId: string, filename: string) => {
      const token = localStorage.getItem("access_token");
      const res = await fetch(
        `${BASE}/invoices/parties/${encodeURIComponent(partyKey)}/archives/${archiveId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
    },

    pdfUrl:  (partyKey: string, billed?: number) => `${BASE}/invoices/parties/${encodeURIComponent(partyKey)}/pdf${billed ? `?billed=${billed}` : ""}`,
    bulkUrl: ()                 => `${BASE}/invoices/bulk-pdf`,

    // Authenticated GET blob download (Excel export)
    exportExcel: async () => {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${BASE}/invoices/export`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "Invoices.xlsx";
      a.click();
    },

    // Upload Excel of parties → returns ZIP of generated invoices
    importZip: async (file: File) => {
      const token = localStorage.getItem("access_token");
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${BASE}/invoices/import-zip`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) throw new Error("Import failed");
      const summary = res.headers.get("X-Import-Summary") || "";
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "Invoices.zip";
      a.click();
      return summary;
    },
  },

  emails: {
    getSettings: () => request<import("./types").EmailSettings>("/emails/settings"),
    updateSettings: (body: object) =>
      request<import("./types").EmailSettings>("/emails/settings", { method: "PUT", body: JSON.stringify(body) }),
    testConnection: () =>
      request<{ ok: boolean; message: string }>("/emails/settings/test", { method: "POST" }),

    listTemplates: (emailType?: string) => {
      const q = emailType ? `?email_type=${emailType}` : "";
      return request<import("./types").EmailTemplate[]>(`/emails/templates${q}`);
    },
    createTemplate: (body: object) =>
      request<import("./types").EmailTemplate>("/emails/templates", { method: "POST", body: JSON.stringify(body) }),
    updateTemplate: (id: string, body: object) =>
      request<import("./types").EmailTemplate>(`/emails/templates/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    deleteTemplate: (id: string) =>
      request<void>(`/emails/templates/${id}`, { method: "DELETE" }),

    getVariables: () =>
      request<Record<string, import("./types").TemplateVariable[]>>("/emails/variables"),

    previewTemplate: (
      tid: string,
      companyId: string,
      params?: { report_date?: string; ref_prefix?: string }
    ) => {
      const qs = new URLSearchParams({ company_id: companyId });
      if (params?.report_date) qs.set("report_date", params.report_date);
      if (params?.ref_prefix)  qs.set("ref_prefix", params.ref_prefix);
      return request<{ subject: string; body: string; to: string[] }>(
        `/emails/preview/${tid}?${qs.toString()}`
      );
    },

    send: (body: object) =>
      request<import("./types").SendResponse>("/emails/send", { method: "POST", body: JSON.stringify(body) }),
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
    stats: (id: string) => request<import("./types").CompanyStats>(`/companies/${id}/stats`),
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

  actionLogs: {
    list: (params?: Record<string, string | number | undefined>) => {
      const qs = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== "") qs.set(k, String(v));
        });
      }
      const q = qs.toString();
      return request<import("./types").ActionLogListResponse>(`/action-logs/${q ? `?${q}` : ""}`);
    },
    filters: () => request<import("./types").ActionLogFilters>("/action-logs/filters"),
  },

  billings: {
    getConfig: () => request<import("./types").InvoiceConfig>("/billings/config"),
    updateConfig: (body: object) =>
      request<{ ok: boolean }>("/billings/config", { method: "PUT", body: JSON.stringify(body) }),
    listParties: (params?: { search?: string; filters?: string; skip?: number; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.search) qs.set("search", params.search);
      if (params?.filters) qs.set("filters", params.filters);
      if (params?.skip != null) qs.set("skip", String(params.skip));
      if (params?.limit != null) qs.set("limit", String(params.limit));
      const q = qs.toString();
      return request<import("./types").PartyBillingListResponse>(`/billings/parties${q ? `?${q}` : ""}`);
    },
    getSettings: (partyKey: string) =>
      request<import("./types").PartyBillingSettings>(`/billings/parties/${encodeURIComponent(partyKey)}/settings`),
    updateSettings: (partyKey: string, body: { particulars: import("./types").Particular[] }) =>
      request<import("./types").PartyBillingSettings>(
        `/billings/parties/${encodeURIComponent(partyKey)}/settings`,
        { method: "PUT", body: JSON.stringify(body) },
      ),
    getSummary: (partyKey: string) =>
      request<import("./types").PartyBillingSummary>(`/billings/parties/${encodeURIComponent(partyKey)}/summary`),
    checkInvoiceNo: (invoiceNo: string, partyKey: string, invoiceDate?: string) => {
      const qs = new URLSearchParams({ invoice_no: invoiceNo, party_key: partyKey });
      if (invoiceDate) qs.set("invoice_date", invoiceDate);
      return request<{ available: boolean; default_invoice_no: string | null }>(`/billings/check-invoice-no?${qs}`);
    },
    generateInvoice: (partyKey: string, body: { invoice_no: string; invoice_date: string; billed_isin_count?: number; year_isins?: { fiscal_year: string; isin_count: number }[] }) =>
      request<import("./types").BillingInvoiceRecord>(
        `/billings/parties/${encodeURIComponent(partyKey)}/invoices`,
        { method: "POST", body: JSON.stringify(body) },
      ),
    exportInvoices: async (filters?: string) => {
      const token = localStorage.getItem("access_token");
      const url = `${BASE}/billings/export${filters ? `?filters=${encodeURIComponent(filters)}` : ""}`;
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "Invoices.xlsx";
      a.click();
    },
    addManualInvoice: async (partyKey: string, data: {
      invoice_no: string;
      invoice_date: string;
      amount: number;
      generated_on: string;
      file: File;
    }) => {
      const form = new FormData();
      form.append("invoice_no", data.invoice_no);
      form.append("invoice_date", data.invoice_date);
      form.append("amount", String(data.amount));
      form.append("generated_on", data.generated_on);
      form.append("file", data.file);
      return request<import("./types").BillingInvoiceRecord>(
        `/billings/parties/${encodeURIComponent(partyKey)}/invoices/manual`,
        { method: "POST", body: form },
      );
    },
    deleteInvoice: (invoiceId: string) =>
      request<{ ok: boolean }>(`/billings/invoices/${invoiceId}`, { method: "DELETE" }),
    downloadInvoice: async (invoiceId: string, filename: string) => {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${BASE}/billings/invoices/${invoiceId}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
    },
    recordPayment: (partyKey: string, body: {
      amount: number;
      receiving_bank: "HDFC" | "IDFC";
      reference_number: string;
      received_at: string;
    }) =>
      request<import("./types").BillingPaymentRecord>(
        `/billings/parties/${encodeURIComponent(partyKey)}/payments`,
        { method: "POST", body: JSON.stringify(body) },
      ),
  },
};
