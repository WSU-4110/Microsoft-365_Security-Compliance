// Helpers for calling the backend. In development Vite forwards /api to
// http://localhost:5000 (see vite.config.js). For a deployed backend, set VITE_API_URL.
const BASE_URL = import.meta.env.VITE_API_URL || "";

export async function apiFetch(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error("Can't reach the server. Make sure the backend is running on port 5000.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

// Downloads a CSV export with the login token attached
export async function downloadFile(path, token) {
  const response = await fetch(`${BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Export failed (${response.status})`);
  const blob = await response.blob();
  const name = (response.headers.get("Content-Disposition") || "").match(/filename="(.+)"/);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name ? name[1] : "export.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
