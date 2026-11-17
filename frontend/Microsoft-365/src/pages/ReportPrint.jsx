import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../api";
import { ScoreRing, Badge } from "../components/ui";
import TrendChart from "../components/TrendChart";
import { ACTION_LABEL, formatDate, formatTime, money } from "../format";
import "../northwatch.css";

function summary(scan) {
  const high = scan.gaps.filter((g) => g.severity === "High").length;
  const trend = scan.scoreHistory.length > 1 ? scan.scoreHistory[scan.scoreHistory.length - 1].score - scan.scoreHistory[0].score : 0;
  const parts = [
    `Microsoft Secure Score is ${scan.score ? `${scan.score.percent}%` : "unavailable"}${trend ? `, ${trend > 0 ? "up" : "down"} ${Math.abs(trend)} points over the last ${scan.scoreHistory.length} weeks` : ""}.`,
    `The tenant meets ${scan.compliance.passed} of ${scan.compliance.total} measured CIS Controls v8 safeguards (${scan.compliance.percent}%).`,
    high ? `${high} high-severity issue${high === 1 ? " needs" : "s need"} attention, listed below in priority order.` : "No high-severity issues were found.",
  ];
  if (scan.signIns && scan.signIns.impossibleTravel) parts.push("An account showed impossible-travel sign-ins this period and was handled as a security incident.");
  return parts.join(" ");
}

export default function ReportPrint({ session }) {
  const { clientId } = useParams();
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(`/api/clients/${clientId}/report`, { token: session.token }).then(setReport).catch((e) => setError(e.message));
  }, [clientId, session.token]);

  if (error) return <div className="report"><p className="tone-bad">{error}</p></div>;
  if (!report) return <div className="report"><p>Preparing the report...</p></div>;

  const { client, scan, actions, alerts } = report;
  const high = scan.gaps.filter((g) => g.severity === "High");
  const medium = scan.gaps.filter((g) => g.severity === "Medium");

  return (
    <div className="report">
      <div className="report-toolbar no-print">
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>Print or save as PDF</button>
      </div>

      <header className="report-cover">
        <div className="brand brand-dark"><span className="brand-mark" aria-hidden="true" /><span className="brand-name">Northwatch</span></div>
        <h1>Microsoft 365 security report</h1>
        <p className="report-client">{client.name}</p>
        <p className="muted">Prepared for {client.contact || client.name}. Generated {formatDate(report.generatedAt)} from the scan on {formatTime(scan.ranAt)}.</p>
      </header>

      <section className="report-section">
        <h2>Summary</h2>
        <div className="report-summary">
          <div className="report-rings">
            <ScoreRing value={scan.score ? scan.score.percent : null} label="Secure Score" size={120} />
            <ScoreRing value={scan.compliance.percent} label="CIS Controls" size={120} />
          </div>
          <p className="report-lead">{summary(scan)}</p>
        </div>
      </section>

      <section className="report-section">
        <h2>Key metrics</h2>
        <table className="table report-table">
          <tbody>
            <tr><th scope="row">Users</th><td>{scan.users ? `${scan.users.total} accounts, ${scan.users.enabled} enabled, ${scan.users.inactive} inactive 90+ days` : "–"}</td></tr>
            <tr><th scope="row">MFA registration</th><td>{scan.mfa ? `${scan.mfa.percent}% (${scan.mfa.registered} of ${scan.mfa.totalUsers})` : "–"}</td></tr>
            <tr><th scope="row">Devices</th><td>{scan.devices ? `${scan.devices.total} managed, ${scan.devices.compliantPercent}% compliant, ${scan.devices.unencrypted} not encrypted` : "–"}</td></tr>
            <tr><th scope="row">Operating systems</th><td>{scan.os ? `${scan.os.percentCurrent}% current, ${scan.os.windows10} PC(s) on Windows 10` : "–"}</td></tr>
            <tr><th scope="row">Sign-ins (7 days)</th><td>{scan.signIns ? `${scan.signIns.total.toLocaleString()} sign-ins, ${scan.signIns.failures} failed, from ${scan.signIns.countries} countries` : "–"}</td></tr>
            <tr><th scope="row">Alerts</th><td>{alerts.total} total, {alerts.resolved} resolved, {alerts.open} open</td></tr>
            <tr><th scope="row">Phishing simulation</th><td>{scan.phishing ? `${scan.phishing.clickRate}% clicked "${scan.phishing.latestName}", ${scan.phishing.reported} reported it` : "No simulations"}</td></tr>
            <tr><th scope="row">Unused licenses</th><td>{scan.licenses ? `${scan.licenses.unused} seats, about ${money(scan.licenses.monthlyWaste)} per month` : "–"}</td></tr>
          </tbody>
        </table>
      </section>

      <section className="report-section">
        <h2>Secure Score trend</h2>
        <TrendChart points={scan.scoreHistory} height={200} />
      </section>

      <section className="report-section">
        <h2>Priority issues</h2>
        {high.length + medium.length === 0 ? <p>No high or medium issues.</p> : (
          <ol className="report-issues">
            {[...high, ...medium].slice(0, 10).map((g) => (
              <li key={g.id}>
                <p><Badge tone={g.severity === "High" ? "bad" : "warn"}>{g.severity}</Badge> <strong>{g.title}</strong></p>
                <p className="muted">{g.fixInstruction}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="report-section">
        <h2>CIS Controls v8</h2>
        <table className="table report-table">
          <thead><tr><th scope="col">Safeguard</th><th scope="col">Requirement</th><th scope="col">Status</th><th scope="col">Evidence</th></tr></thead>
          <tbody>
            {scan.compliance.controls.map((c) => (
              <tr key={c.id}>
                <td>CIS {c.id}</td>
                <td>{c.title}</td>
                <td>{c.status === "pass" ? "Met" : c.status === "fail" ? "Not met" : "No data"}</td>
                <td>{c.evidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="report-section">
        <h2>Actions taken in the last 30 days</h2>
        {actions.length === 0 ? <p>No actions were needed this period.</p> : (
          <table className="table report-table">
            <thead><tr><th scope="col">Date</th><th scope="col">Action</th><th scope="col">Target</th><th scope="col">Reason</th></tr></thead>
            <tbody>
              {actions.slice(0, 25).map((a) => (
                <tr key={a.id}><td>{formatDate(a.at)}</td><td>{ACTION_LABEL[a.action] || a.action}</td><td>{a.targetName}</td><td>{a.reason}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="report-foot muted">
        Northwatch managed security for Microsoft 365. Data source: {scan.dataSource === "MockDataSource" ? "demo tenant (sample data)" : "Microsoft Graph"}. Prepared by {report.generatedBy}.
      </footer>
    </div>
  );
}
