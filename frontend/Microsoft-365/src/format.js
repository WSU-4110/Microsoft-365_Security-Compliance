// Formats a timestamp into a short date/time string
// Example: "Nov 13, 2:30 PM"
export function formatTime(iso) {
  // Return a placeholder if no date was provided
  if (!iso) return "–";

  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Formats a timestamp into a readable date
// Example: "Nov 13, 2025"
export function formatDate(iso) {
  // Return a placeholder if no date exists
  if (!iso) return "–";

  return new Date(iso).toLocaleDateString([], {
    dateStyle: "medium",
  });
}

// Calculates how many full days have passed since a date
// Example: returns 5 if the date was 5 days ago
export function daysSince(iso) {
  if (!iso) return null;

  return Math.floor(
    (Date.now() - new Date(iso).getTime()) / 86400000
  );
}

// Converts a timestamp into a more user-friendly relative time
// Examples:
// "Just now"
// "15 min ago"
// "3 h ago"
// "Yesterday"
// "10 days ago"
export function timeAgo(iso) {
  if (!iso) return "Never";

  const minutes = Math.floor(
    (Date.now() - new Date(iso).getTime()) / 60000
  );

  // Less than one minute ago
  if (minutes < 1) return "Just now";

  // Less than one hour ago
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);

  // Less than one day ago
  if (hours < 24) return `${hours} h ago`;

  const days = Math.floor(hours / 24);

  // Special case for exactly one day ago
  if (days === 1) return "Yesterday";

  // More than one day ago
  return `${days} days ago`;
}

// Formats a number as U.S. currency
// Example: 1500 -> "$1,500"
export function money(n) {
  return `$${Math.round(n).toLocaleString()}`;
}

// Returns a status category based on a percentage
// Used for choosing colors or CSS styles
export function percentColor(p) {
  // No value provided
  if (p === null || p === undefined) return "neutral";

  // Good performance
  if (p >= 75) return "good";

  // Warning range
  if (p >= 50) return "warn";

  // Poor performance
  return "bad";
}

// Human-readable labels for alert severity levels
export const SEVERITY_LABEL = {
  high: "High",
  medium: "Medium",
  low: "Low",
  informational: "Info",
};

// Human-readable labels for alert statuses
export const ALERT_STATUS_LABEL = {
  new: "New",
  inProgress: "In progress",
  resolved: "Resolved",
};

// Human-readable descriptions of system actions
export const ACTION_LABEL = {
  disable: "Disabled account",
  enable: "Enabled account",
  "revoke-sessions": "Signed out everywhere",
  "device-sync": "Synced device",
  "device-restart": "Restarted device",
  "device-lock": "Locked device",
  "device-locate": "Located device",
  "device-retire": "Retired device",
  "device-wipe": "Wiped device",
  "alert-new": "Reopened alert",
  "alert-inProgress": "Started alert",
  "alert-resolved": "Resolved alert",
  "alert-assign": "Assigned alert",
};

// Converts camelCase/PascalCase text into a readable phrase
// Example:
// "InitialAccess" -> "Initial access"
// "DeviceRestart" -> "Device restart"
export function humanize(text) {
  // Return an empty string if no text exists
  if (!text) return "";

  // Insert spaces before capital letters and convert to lowercase
  const spaced = String(text)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();

  // Capitalize the first letter of the result
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
