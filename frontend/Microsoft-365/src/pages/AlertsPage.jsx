import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, downloadFile } from "../api";
import { useApi, useApp } from "../hooks";
import { PageHeader, Panel, Stat, SeverityBadge, Chips, Loading } from "../components/ui";
import { ALERT_STATUS_LABEL, formatTime, humanize, timeAgo } from "../format";

const SEV_ORDER = { high: 0, medium: 1, low: 2, informational: 3 };
const FILTERS = [
  { id: "open", label: "Open", test: (a) => a.status !== "resolved" },
  { id: "new", label: "New", test: (a) => a.status === "new" },
  { id: "inProgress", label: "In progress", test: (a) => a.status === "inProgress" },
  { id: "resolved", label: "Resolved", test: (a) => a.status === "resolved" },
  { id: "all", label: "All", test: () => true },
];

export default function AlertsPage() {
  const { clientId, canAct, token, handleError } = useApp();
  const { data: alerts, reload } = useApi(`/api/clients/${clientId}/alerts`);
  const [filter, setFilter] = useState("open");
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => (alerts ? Object.fromEntries(FILTERS.map((f) => [f.id, alerts.filter(f.test).length])) : {}), [alerts]);
  if (!alerts) return <Loading label="Loading Defender alerts..." />;

  const rows = alerts.filter(FILTERS.find((f) => f.id === filter).test)
    .sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || new Date(b.created) - new Date(a.created));
  const selected = alerts.find((a) => a.id === selectedId) || rows[0] || null;

  const update = async (alert, body) => {
    setBusy(true);
    try {
      await apiFetch(`/api/clients/${clientId}/alerts/${encodeURIComponent(alert.id)}`, { method: "PATCH", token, body });
      await reload();
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  };

  const open = alerts.filter((a) => a.status !== "resolved");

  return (
    <>
      <PageHeader title="Alerts" subtitle="Incidents raised by Microsoft Defender XDR, Entra ID Protection, and Defender for Office 365.">
        <button type="button" className="btn" onClick={() => downloadFile(`/api/clients/${clientId}/export/alerts`, token).catch(handleError)}>Export CSV</button>
      </PageHeader>

      <div className="stats-row">
        <Stat value={open.length} label="open alerts" />
        <Stat value={open.filter((a) => a.severity === "high").length} label="high severity" tone={open.some((a) => a.severity === "high") ? "bad" : "good"} />
        <Stat value={counts.new} label="untriaged" tone={counts.new ? "warn" : "good"} note="target: assign within 24 h" />
        <Stat value={counts.resolved} label="resolved" />
      </div>

      <div className="grid-list-detail">
        <Panel className="flush">
          <div className="toolbar">
            <Chips options={FILTERS.map((f) => ({ ...f, count: counts[f.id] }))} value={filter} onChange={setFilter} label="Filter alerts" />
          </div>
          {rows.length === 0 ? <p className="muted pad">No alerts here.</p> : (
            <ul className="queue">
              {rows.map((a) => (
                <li key={a.id}>
                  <button type="button" className={`queue-item${selected && selected.id === a.id ? " is-current" : ""}`} onClick={() => setSelectedId(a.id)}>
                    <SeverityBadge severity={a.severity} />
                    <span className="queue-body">
                      <span className="queue-title">{a.title}</span>
                      <span className="cell-sub">{a.user || a.device || "Tenant-wide"}, {timeAgo(a.created)}</span>
                    </span>
                    <span className={`status status-${a.status}`}>{ALERT_STATUS_LABEL[a.status] || a.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          {!selected ? <p className="muted">Select an alert.</p> : (
            <article className="alert-detail">
              <div className="alert-head">
                <SeverityBadge severity={selected.severity} />
                <span className={`status status-${selected.status}`}>{ALERT_STATUS_LABEL[selected.status] || selected.status}</span>
              </div>
              <h2>{selected.title}</h2>
              <p>{selected.description}</p>
              <dl className="kv">
                <dt>Source</dt><dd>{selected.service}</dd>
                <dt>Category</dt><dd>{humanize(selected.category)}</dd>
                <dt>Created</dt><dd>{formatTime(selected.created)}</dd>
                {selected.user && <><dt>User</dt><dd><Link to={`/c/${clientId}/identity?q=${encodeURIComponent(selected.user)}`}>{selected.user}</Link></dd></>}
                {selected.device && <><dt>Device</dt><dd>{selected.device}</dd></>}
                <dt>Assigned to</dt><dd>{selected.assignedTo || <span className="muted">Nobody</span>}</dd>
              </dl>
              <div className="recommendation">
                <p className="kv-head">Recommended response</p>
                <p>{selected.recommendation}</p>
              </div>
              {canAct && (
                <div className="action-row">
                  {!selected.assignedTo && <button type="button" className="btn" disabled={busy} onClick={() => update(selected, { assignToMe: true })}>Assign to me</button>}
                  {selected.status === "new" && <button type="button" className="btn" disabled={busy} onClick={() => update(selected, { status: "inProgress", assignToMe: !selected.assignedTo })}>Start investigation</button>}
                  {selected.status !== "resolved" && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => update(selected, { status: "resolved" })}>Resolve</button>}
                  {selected.status === "resolved" && <button type="button" className="btn" disabled={busy} onClick={() => update(selected, { status: "new" })}>Reopen</button>}
                  {selected.user && selected.status !== "resolved" && (
                    <Link className="btn btn-danger-outline" to={`/c/${clientId}/response?playbook=compromised-account&target=${encodeURIComponent(selected.user)}`}>Run response playbook</Link>
                  )}
                </div>
              )}
            </article>
          )}
        </Panel>
      </div>
    </>
  );
}
