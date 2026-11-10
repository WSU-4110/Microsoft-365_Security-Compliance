import { useState } from "react";
import { useApi, useApp } from "../hooks";
import { downloadFile } from "../api";
import { PageHeader, Panel, Badge, Chips, ScoreRing, Loading, Empty } from "../components/ui";
import { timeAgo } from "../format";

const STATUS = { pass: { label: "Met", tone: "good" }, fail: { label: "Not met", tone: "bad" }, unknown: { label: "No data", tone: "neutral" } };

export default function CompliancePage() {
  const { clientId, client, token, handleError } = useApp();
  const { data: scan, loading } = useApi(`/api/clients/${clientId}/scans/latest`);
  const [filter, setFilter] = useState("all");

  if (loading && !scan) return <Loading />;
  if (!scan) return (<><PageHeader title="Compliance" /><Empty title="No scan yet">Run a scan from the Overview page to score this client.</Empty></>);

  const { controls } = scan.compliance;
  const ig1 = controls.filter((c) => c.ig === "IG1" && c.status !== "unknown");
  const ig2 = controls.filter((c) => c.ig === "IG2" && c.status !== "unknown");
  const pct = (list) => (list.length ? Math.round((list.filter((c) => c.status === "pass").length / list.length) * 100) : null);
  const filters = [
    { id: "all", label: "All", count: controls.length },
    { id: "fail", label: "Not met", count: controls.filter((c) => c.status === "fail").length },
    { id: "pass", label: "Met", count: controls.filter((c) => c.status === "pass").length },
    { id: "unknown", label: "No data", count: controls.filter((c) => c.status === "unknown").length },
  ];
  const rows = controls.filter((c) => filter === "all" || c.status === filter);
  const p = scan.policies || {};

  return (
    <>
      <PageHeader title="Compliance" subtitle={`Scored against CIS Controls v8 safeguards from the scan ${timeAgo(scan.ranAt)}.`}>
        <button type="button" className="btn" onClick={() => downloadFile(`/api/clients/${clientId}/export/controls`, token).catch(handleError)}>Export CSV</button>
      </PageHeader>

      <div className="posture-row">
        <Panel className="rings">
          <ScoreRing value={scan.compliance.percent} label="Overall" sub={`${scan.compliance.passed} of ${scan.compliance.total} met`} />
          <ScoreRing value={pct(ig1)} label="IG1 essential" sub={`${ig1.filter((c) => c.status === "pass").length} of ${ig1.length}`} size={100} />
          <ScoreRing value={pct(ig2)} label="IG2" sub={`${ig2.filter((c) => c.status === "pass").length} of ${ig2.length}`} size={100} />
        </Panel>
        <Panel title="Frameworks and policies" id="fw-title">
          <p className="badge-row">{(client?.frameworks || ["CIS Controls v8"]).map((f) => <Badge key={f} tone="info">{f}</Badge>)}</p>
          <dl className="kv">
            <dt>Security defaults</dt><dd>{p.securityDefaults ? "On" : "Off"}</dd>
            <dt>MFA for all users</dt><dd className={p.mfaAll ? "tone-good" : "tone-bad"}>{p.mfaAll ? "Enforced" : "Not enforced"}</dd>
            <dt>MFA for admins</dt><dd className={p.mfaAdmins ? "tone-good" : "tone-bad"}>{p.mfaAdmins ? "Enforced" : "Not enforced"}</dd>
            <dt>Legacy authentication</dt><dd className={p.legacyBlocked ? "tone-good" : "tone-bad"}>{p.legacyBlocked ? "Blocked" : "Allowed"}</dd>
            <dt>Conditional Access policies</dt><dd>{p.count ?? "–"}</dd>
          </dl>
          <p className="muted small">Healthcare, finance, and legal frameworks map to these CIS safeguards. The CIS score is the evidence base for client audits.</p>
        </Panel>
      </div>

      <Panel className="flush">
        <div className="toolbar"><Chips options={filters} value={filter} onChange={setFilter} label="Filter controls" /></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th scope="col">Safeguard</th><th scope="col">Requirement</th><th scope="col">Group</th><th scope="col">Status</th><th scope="col">Evidence</th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="mono">CIS {c.id}</td>
                  <td className="cell-main">{c.title}</td>
                  <td>{c.ig}</td>
                  <td><Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge></td>
                  <td className="muted">{c.evidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
