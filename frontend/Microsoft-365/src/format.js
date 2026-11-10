export function formatTime(iso) {
  if (!iso) return "–";
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatDate(iso) {
  if (!iso) return "–";
  return new Date(iso).toLocaleDateString([], { dateStyle: "medium" });
}

export function daysSince(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function timeAgo(iso) {
  if (!iso) return "Never";
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export function money(n) {
  return `$${Math.round(n).toLocaleString()}`;
}

export function percentColor(p) {
  if (p === null || p === undefined) return "neutral";
  return p >= 75 ? "good" : p >= 50 ? "warn" : "bad";
}

export const SEVERITY_LABEL = { high: "High", medium: "Medium", low: "Low", informational: "Info" };
export const ALERT_STATUS_LABEL = { new: "New", inProgress: "In progress", resolved: "Resolved" };
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

// "InitialAccess" -> "Initial access"
export function humanize(text) {
  if (!text) return "";
  const spaced = String(text).replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
