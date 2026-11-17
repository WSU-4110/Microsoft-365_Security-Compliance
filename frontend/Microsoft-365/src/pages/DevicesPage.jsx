import { useMemo, useState } from "react";
import { useApi, useApp } from "../hooks";
import { downloadFile } from "../api";
import { useAction } from "../components/useAction";
import { PageHeader, Panel, Stat, Badge, Chips, Search, Loading, Notice } from "../components/ui";
import WorldMap from "../components/WorldMap";
import { daysSince, timeAgo, formatDate } from "../format";

const COMPLIANCE = {
  compliant: { label: "Compliant", tone: "good" },
  noncompliant: { label: "Not compliant", tone: "bad" },
  inGracePeriod: { label: "Grace period", tone: "warn" },
  unknown: { label: "Unknown", tone: "neutral" },
};

const FILTERS = [
  { id: "all", label: "All", test: () => true },
  { id: "noncompliant", label: "Not compliant", test: (d) => d.compliance !== "compliant" },
  { id: "unencrypted", label: "Not encrypted", test: (d) => !d.encrypted },
  { id: "outdated", label: "Outdated OS", test: (d) => d.outdated },
  { id: "stale", label: "No check-in 30+ days", test: (d) => daysSince(d.lastSync) >= 30 },
  { id: "personal", label: "Personal (BYOD)", test: (d) => d.ownership === "personal" },
];

const ACTIONS = [
  { id: "sync", label: "Sync", description: "Asks the device to check in with Intune now and pick up policy changes." },
  { id: "restart", label: "Restart", description: "Restarts the device in about 5 minutes. Unsaved work may be lost.", danger: true },
  { id: "lock", label: "Lock", description: "Locks the screen right away. The user unlocks with their PIN or password." },
  { id: "locate", label: "Locate", description: "Asks the device for its current location (supported on supervised iOS and Windows with location services on)." },
  { id: "retire", label: "Retire", description: "Removes company data, apps, and settings. Personal data stays. The device leaves Intune.", danger: true },
  { id: "wipe", label: "Wipe", description: "Resets the device to factory settings and erases all data. This can't be undone.", danger: true, typed: true },
];

export default function DevicesPage() {
  const { clientId, canAct, token, handleError } = useApp();
  const { data: devices, reload } = useApi(`/api/clients/${clientId}/devices`);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const { ask, dialog, notice, setNotice } = useAction(async () => {
    await reload();
  });

  const counts = useMemo(() => (devices ? Object.fromEntries(FILTERS.map((f) => [f.id, devices.filter(f.test).length])) : {}), [devices]);
  if (!devices) return <Loading label="Loading Intune devices..." />;

  const active = FILTERS.find((f) => f.id === filter);
  const q = query.trim().toLowerCase();
  const rows = devices.filter(active.test).filter((d) => !q || `${d.name} ${d.owner} ${d.ownerName} ${d.model} ${d.serial}`.toLowerCase().includes(q));
  const selected = devices.find((d) => d.id === selectedId) || null;

  const byOs = Object.entries(devices.reduce((acc, d) => ({ ...acc, [d.os]: (acc[d.os] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  const compliant = devices.filter((d) => d.compliance === "compliant").length;

  const points = devices.filter((d) => d.location).map((d) => ({
    id: d.id, lat: d.location.lat, lon: d.location.lon, tone: (COMPLIANCE[d.compliance] || COMPLIANCE.unknown).tone,
    label: `${d.name} (${d.ownerName}) — ${d.location.city}`,
    place: d.location.city,
  }));

  const runAction = (d, a) => ask({
    title: `${a.label} ${d.name}?`,
    description: a.description,
    confirmLabel: a.label,
    danger: a.danger,
    typeToConfirm: a.typed ? d.name : undefined,
    path: `/api/clients/${clientId}/devices/${encodeURIComponent(d.id)}/${a.id}`,
  });

  return (
    <>
      <PageHeader title="Devices" subtitle="Devices managed by Microsoft Intune, with compliance, encryption, OS currency, and last known location.">
        <button type="button" className="btn" onClick={() => downloadFile(`/api/clients/${clientId}/export/devices`, token).catch(handleError)}>Export CSV</button>
      </PageHeader>

      <div className="stats-row">
        <Stat value={devices.length} label="managed devices" note={byOs.map(([os, n]) => `${n} ${os}`).join(", ")} />
        <Stat value={`${Math.round((compliant / (devices.length || 1)) * 100)}%`} label="compliant" tone={compliant / devices.length >= 0.9 ? "good" : "warn"} note={`${counts.noncompliant} need attention`} />
        <Stat value={counts.unencrypted} label="not encrypted" tone={counts.unencrypted ? "warn" : "good"} />
        <Stat value={counts.outdated} label="outdated OS" tone={counts.outdated ? "warn" : "good"} note="includes Windows 10" />
        <Stat value={counts.stale} label="not seen in 30+ days" />
      </div>

      <Notice onClose={() => setNotice("")}>{notice}</Notice>

      <div className="grid-main-side">
        <Panel>
          <WorldMap
            title="Last known device locations"
            points={points}
            onSelect={(items) => setSelectedId(items[0].id)}
            legend={[{ tone: "good", label: "Compliant" }, { tone: "warn", label: "Grace period" }, { tone: "bad", label: "Not compliant" }]}
          />
        </Panel>

        <Panel title={selected ? selected.name : "Device details"} id="device-title">
          {!selected ? (
            <p className="muted">Pick a device on the map or in the table to see details and remote actions.</p>
          ) : (
            <div className="device-detail">
              <Badge tone={(COMPLIANCE[selected.compliance] || COMPLIANCE.unknown).tone}>{(COMPLIANCE[selected.compliance] || COMPLIANCE.unknown).label}</Badge>
              <dl className="kv">
                <dt>User</dt><dd>{selected.ownerName}<span className="cell-sub">{selected.owner}</span></dd>
                <dt>Model</dt><dd>{selected.model}</dd>
                <dt>Serial</dt><dd className="mono">{selected.serial}</dd>
                <dt>OS</dt><dd>{selected.os} {selected.osVersion}{selected.outdated && <Badge tone="warn">Outdated</Badge>}</dd>
                <dt>Ownership</dt><dd>{selected.ownership === "personal" ? "Personal (BYOD)" : "Company"}</dd>
                <dt>Encrypted</dt><dd>{selected.encrypted ? "Yes" : <span className="tone-bad">No</span>}</dd>
                {selected.defenderStatus && <><dt>Defender</dt><dd className={selected.defenderStatus === "Active" ? "" : "tone-warn"}>{selected.defenderStatus}</dd></>}
                <dt>Last check-in</dt><dd>{timeAgo(selected.lastSync)}</dd>
                <dt>Enrolled</dt><dd>{formatDate(selected.enrolled)}</dd>
                {selected.location && <><dt>Location</dt><dd>{selected.location.city}, {selected.location.country}<span className="cell-sub">{selected.location.source}, {timeAgo(selected.location.at)}</span></dd></>}
              </dl>
              {selected.complianceIssues && selected.complianceIssues.length > 0 && (
                <>
                  <p className="kv-head">Failing settings</p>
                  <ul className="issues">{selected.complianceIssues.map((i) => <li key={i}>{i}</li>)}</ul>
                </>
              )}
              {selected.lastAction && <p className="muted">Last action: {selected.lastAction.action}, {timeAgo(selected.lastAction.at)}</p>}
              {canAct && (
                <div className="action-grid">
                  {ACTIONS.map((a) => (
                    <button key={a.id} type="button" className={`btn btn-small ${a.danger ? "btn-danger-outline" : ""}`} onClick={() => runAction(selected, a)}>{a.label}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>

      <Panel className="flush">
        <div className="toolbar">
          <Chips options={FILTERS.map((f) => ({ ...f, count: counts[f.id] }))} value={filter} onChange={setFilter} label="Filter devices" />
          <Search value={query} onChange={setQuery} placeholder="Search device, user, model, or serial" />
        </div>
        <div className="table-wrap">
          <table className="table table-click">
            <thead>
              <tr><th scope="col">Device</th><th scope="col">User</th><th scope="col">Compliance</th><th scope="col">Encrypted</th><th scope="col">Location</th><th scope="col">Last check-in</th></tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const c = COMPLIANCE[d.compliance] || COMPLIANCE.unknown;
                return (
                  <tr key={d.id} className={d.id === selectedId ? "is-current" : ""} onClick={() => setSelectedId(d.id)}>
                    <td>
                      <button type="button" className="cell-main link-plain" onClick={() => setSelectedId(d.id)}>{d.name}</button>
                      <span className="cell-sub">{d.os} {d.osVersion}{d.outdated ? " (outdated)" : ""}</span>
                    </td>
                    <td>{d.ownerName}<span className="cell-sub">{d.model}</span></td>
                    <td><span className={`tone-${c.tone}`}>{c.label}</span></td>
                    <td>{d.encrypted ? "Yes" : <span className="tone-bad">No</span>}</td>
                    <td>{d.location ? `${d.location.city}, ${d.location.region || d.location.country}` : "–"}</td>
                    <td className={daysSince(d.lastSync) >= 30 ? "tone-warn" : ""}>{timeAgo(d.lastSync)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <p className="muted pad">No devices match this filter.</p>}
        </div>
      </Panel>
      {dialog}
    </>
  );
}
