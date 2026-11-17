// Turns a list of objects into CSV text that opens cleanly in Excel.

function cell(value) {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join("; ") : String(value);
  // Stop spreadsheet formula injection, then quote if needed
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function toCsv(rows, columns) {
  const header = columns.map((c) => cell(c.label)).join(",");
  const lines = rows.map((row) => columns.map((c) => cell(typeof c.value === "function" ? c.value(row) : row[c.value])).join(","));
  return "\uFEFF" + [header, ...lines].join("\r\n");
}

module.exports = { toCsv };
