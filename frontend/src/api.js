const API = "http://localhost:8000/api";

async function request(url, options = {}) {
  const res = await fetch(`${API}${url}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Profiles ──
export const getProfilesData = () => request("/profiles");
export const saveProfilesData = (data) =>
  request("/profiles", { method: "PUT", body: JSON.stringify(data) });
export const getActiveProfile = () => request("/profile/active");

// ── Job Search ──
export const searchJobs = (data) =>
  request("/jobs/search", { method: "POST", body: JSON.stringify(data) });

// ── Resume ──
export const getResumeStatus = () => request("/resume/status");
export async function uploadResume(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API}/resume`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Applications ──
export const getApplications = () => request("/applications");
export const addApplication = (data) =>
  request("/applications", { method: "POST", body: JSON.stringify(data) });
export const updateApplication = (id, data) =>
  request(`/applications/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteApplication = (id) =>
  request(`/applications/${id}`, { method: "DELETE" });
export const bulkDelete = (status) =>
  request(`/applications/bulk/${status}`, { method: "DELETE" });

// ── Generation ──
export const generateCold = (data) =>
  request("/generate/cold", { method: "POST", body: JSON.stringify(data) });
export const generateJD = (data) =>
  request("/generate/jd", { method: "POST", body: JSON.stringify(data) });
export async function generatePoster(file, params) {
  const form = new FormData();
  form.append("file", file);
  Object.entries(params).forEach(([k, v]) => form.append(k, v));
  const res = await fetch(`${API}/generate/poster`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}
export const generateFollowUp = (data) =>
  request("/generate/followup", { method: "POST", body: JSON.stringify(data) });
export const generateRewrite = (data) =>
  request("/generate/rewrite", { method: "POST", body: JSON.stringify(data) });

// ── Send ──
export const sendEmail = (data) =>
  request("/send", { method: "POST", body: JSON.stringify(data) });

// ── Status ──
export const getStatus = () => request("/status");
