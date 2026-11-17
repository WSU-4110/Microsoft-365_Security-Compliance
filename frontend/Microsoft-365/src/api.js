// Base URL for all API requests.
//
// DESIGN PATTERN: Facade
// This file serves as a centralized interface for backend communication.
// Frontend components call apiFetch() and downloadFile() rather than
// interacting directly with the browser Fetch API. This hides networking,
// authentication, JSON processing, and error handling complexity behind
// a simpler interface.
//
// DESIGN PATTERN: Proxy (partial implementation)
// This module also acts as an intermediary between frontend components
// and backend services. It automatically attaches JWT authentication
// tokens and controls how requests are forwarded to protected resources.
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
 * DESIGN PATTERN: Facade
 * Provides a simplified interface for components to communicate with
 * backend services without needing to manage fetch(), JSON conversion,
 * headers, or error handling themselves.
 *
 * DESIGN PATTERN: Proxy
 * Acts as an intermediary between the UI and backend APIs by
 * automatically attaching authentication credentials and forwarding
 * requests to the appropriate endpoint.
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

  // Proxy behavior:
  // Authentication is applied automatically before forwarding
  // the request to the backend.
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    // Facade behavior:
    // Components make a simple apiFetch() call while this method
    // handles the low-level Fetch API implementation details.
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,

      // Only include request body when data exists.
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Centralized error handling provided by the Facade.
    throw new Error(
      "Can't reach the server. Make sure the backend is running on port 5000."
    );
  }

  // Attempt to parse JSON response.
  // If response body is empty, return empty object instead.
  const data = await response.json().catch(() => ({}));

  // Facade behavior:
  // HTTP response validation and error conversion are
  // standardized in one location for all application components.
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
 * DESIGN PATTERN: Facade
 * Provides a simple downloadFile() interface while hiding Blob creation,
 * URL generation, browser download operations, and cleanup logic.
 *
 * DESIGN PATTERN: Proxy
 * Automatically forwards authenticated download requests to protected
 * backend endpoints using the user's JWT token.
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
  // Proxy behavior:
  // Authentication is attached before the request reaches the server.
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
