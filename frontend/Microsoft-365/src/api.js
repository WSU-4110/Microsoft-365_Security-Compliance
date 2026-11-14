// Base URL for all API requests.
//
// Development:
// - Vite proxy forwards "/api" requests to http://localhost:5000
//
// Production:
// - Set VITE_API_URL in your .env file
//
// Example:
//   VITE_API_URL=https://api.myapp.com
//
const BASE_URL = import.meta.env.VITE_API_URL || "";

/**
 * Generic helper for making API requests.
 *
 * Features:
 * - Automatically attaches JSON headers
 * - Automatically stringifies request bodies
 * - Optionally attaches JWT Bearer authentication tokens
 * - Handles network failures
 * - Parses JSON responses
 * - Converts backend errors into JavaScript Error objects
 *
 * @param {string} path API endpoint path (e.g. "/api/users")
 * @param {Object} options Request options
 * @param {string} options.method HTTP method (GET, POST, PUT, DELETE)
 * @param {Object} options.body Data to send in request body
 * @param {string} options.token JWT authentication token
 * @returns {Promise<Object>} Parsed JSON response data
 */
export async function apiFetch(
  path,
  { method = "GET", body, token } = {}
) {
  // All requests send/receive JSON.
  const headers = {
    "Content-Type": "application/json",
  };

  // Attach authentication token if user is logged in.
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    // Send request to backend.
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,

      // Only include request body when data exists.
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Network/backend connection failure.
    throw new Error(
      "Can't reach the server. Make sure the backend is running on port 5000."
    );
  }

  // Attempt to parse JSON response.
  // If response body is empty, return empty object instead.
  const data = await response.json().catch(() => ({}));

  // Convert HTTP errors into JavaScript errors.
  if (!response.ok) {
    const error = new Error(
      data.error || `Request failed (${response.status})`
    );

    // Store status code for UI error handling.
    error.status = response.status;

    throw error;
  }

  // Return parsed response data.
  return data;
}

/**
 * Downloads a file from the backend.
 *
 * Typically used for:
 * - CSV exports
 * - Audit reports
 * - User data exports
 * - Compliance reports
 *
 * @param {string} path Backend download endpoint
 * @param {string} token JWT authentication token
 */
export async function downloadFile(path, token) {
  // Request file with authentication token.
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  // Stop if server returns an error.
  if (!response.ok) {
    throw new Error(`Export failed (${response.status})`);
  }

  // Convert downloaded data into a Blob (file object).
  const blob = await response.blob();

  // Attempt to get filename from response headers.
  const name = (
    response.headers.get("Content-Disposition") || ""
  ).match(/filename="(.+)"/);

  // Create temporary browser URL for download.
  const url = URL.createObjectURL(blob);

  // Create hidden anchor element.
  const a = document.createElement("a");

  // Point anchor to downloaded file.
  a.href = url;

  // Use server-provided filename or fallback default.
  a.download = name ? name[1] : "export.csv";

  // Add to page, click automatically, then remove.
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Free memory used by Blob URL.
  URL.revokeObjectURL(url);
}
