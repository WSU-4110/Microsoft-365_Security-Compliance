import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApi, useApp } from "../hooks";
import { useScanJob } from "../components/useScanJob";
import { PageHeader, Panel, Stat, ScoreRing, SeverityBadge, Chips, Loading, Empty } from "../components/ui";
import TrendChart from "../components/TrendChart";
import { formatTime, timeAgo, money } from "../format";

const STATUS_TEXT = { queued: "Waiting", running: "Checking", pass: "Passed", fail: "Needs attention", error: "Couldn’t check" };

export default function OverviewPage() {
  const { clientId, canAct } = useApp();
  const latest = useApi(`/api/clients/${clientId}/scans/latest`);
  const history = useApi(`/api/clients/${clientId}/scans`);
  const [area, setArea] = useState("all");
  const { job, start } = useScanJob(async () => {
    await Promise.all([latest.reload(), history.reload()]);
  });

  const scan = latest.data;
  const checks = job ? job.checks : scan ? scan.checks : [];
  const done = job ? job.checks.filter((c) => !["queued", "running"].includes(c.status)).length : 0;
  const base = `/c/${clientId}`;

  const areas = useMemo(() => {
    if (!scan) return [];
    const names = [...new Set(scan.gaps.map((g) => g.area))];
    return [{ id: "all", label: "All", count: scan.gaps.length }, ...names.map((n) => ({ id: n, label: n, count: scan.gaps.filter((g) => g.area === n).length }))];
  }, [scan]);
  const gaps = scan ? scan.gaps.filter((g) => area === "all" || g.area === area) : [];

  if (latest.loading && !scan) return <Loading />;

  return (
    <>
      <PageHeader
        title="Security overview"
        subtitle={scan ? `Last scanned ${timeAgo(scan.ranAt).toLowerCase()} (${scan.trigger === "scheduled" ? "scheduled" : `by ${scan.runBy}`})` : "This client hasn't been scanned yet."}
      >
        {scan && <Link className="btn" to={`${base}/report`} target="_blank">Executive report</Link>}
        {canAct && (
          <button type="button" className="btn btn-primary" onClick={() => start(`/api/clients/${clientId}/scans`)} disabled={Boolean(job)}>
            {job ? `Scanning ${done} of ${job.checks.length || 13}...` : "Run scan now"}
          </button>
        )}
      </PageHeader>

      {checks.length > 0 && (
        <Panel className="checks-panel">
          <ul className="check-grid" aria-live="polite">
            {checks.map((c) => (
              <li key={c.id} className={`check check-${c.status}`}>
                <span className="check-bar" aria-hidden="true" />
                <span className="check-area">{c.area}</span>
                <span className="check-name">{c.name}</span>
                <span className="check-status">{STATUS_TEXT[c.status]}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {!scan && !job && (
        <Empty title="No scan yet">
          {canAct ? "Run a scan to check identity, devices, sign-ins, alerts, email, and licenses for this tenant." : "Ask an analyst to run the first scan."}
        </Empty>
      )}

      {scan && !job && (
        <>
          <div className="posture-row">
            <Panel className="rings">
              <ScoreRing value={scan.score ? scan.score.percent : null} label="Secure Score" sub={scan.score ? `${scan.score.current} / ${scan.score.max}` : ""} />
              <ScoreRing value={scan.compliance.percent} label="CIS Controls" sub={`${scan.compliance.passed} of ${scan.compliance.total} met`} />
            </Panel>
            <div className="stats-grid">
              <Stat to={`${base}/identity`} value={scan.users ? scan.users.total : "–"} label="users" note={scan.mfa ? `${scan.mfa.percent}% MFA registered` : ""} />
              <Stat to={`${base}/devices`} value={scan.devices ? scan.devices.total : "–"} label="devices" note={scan.devices ? `${scan.devices.compliantPercent}% compliant` : ""} />
              <Stat to={`${base}/alerts`} value={scan.alerts ? scan.alerts.open : "–"} label="open alerts" tone={scan.alerts && scan.alerts.highOpen ? "bad" : undefined} note={scan.alerts ? `${scan.alerts.highOpen} high severity` : ""} />
              <Stat to={`${base}/signins`} value={scan.signIns ? scan.signIns.total.toLocaleString() : "–"} label="sign-ins this week" note={scan.signIns ? `${scan.signIns.failures} failed, ${scan.signIns.countries} countries` : ""} />
              <Stat to={`${base}/email`} value={scan.phishing ? `${scan.phishing.clickRate}%` : "–"} label="phishing click rate" tone={scan.phishing && scan.phishing.clickRate > 10 ? "warn" : undefined} note={scan.phishing ? `latest: ${scan.phishing.latestName}` : "no simulations"} />
              <Stat to={`${base}/licenses`} value={scan.licenses ? money(scan.licenses.monthlyWaste) : "–"} label="unused licenses / month" note={scan.licenses ? `${scan.licenses.unused} seats unassigned` : ""} />
            </div>
          </div>

          <div className="grid-main-side">
            <Panel title="Security gaps" id="gaps-title" actions={<Chips options={areas} value={area} onChange={setArea} label="Filter by area" />}>
              {gaps.length === 0 ? <p className="muted">No gaps in this area.</p> : (
                <ul className="gaps">
                  {gaps.map((g) => (
                    <li key={g.id} className="gap">
                      <SeverityBadge severity={g.severity} />
                      <div className="gap-body">
                        <h3>{g.title}</h3>
                        <p className="gap-fix"><strong>Fix:</strong> {g.fixInstruction}</p>
                        {g.affected.length > 0 && (
                          <details>
                            <summary>{g.affected.length} affected</summary>
                            <ul className="affected">{g.affected.map((a) => <li key={a}>{a}</li>)}</ul>
                          </details>
                        )}
                      </div>
                      <span className="gap-area">{g.area}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <div className="side">
              <Panel title="Secure Score trend" id="trend-title">
                <TrendChart points={scan.scoreHistory} height={170} />
              </Panel>
              <Panel title="Check results" id="checks-title">
                <dl className="details">
                  {scan.checks.map((c) => (
                    <div key={c.id}>
                      <dt>{c.name}</dt>
                      <dd className={`detail-${c.status}`}>{c.detail}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>
              <Panel title="Scan history" id="history-title">
                {history.data && history.data.length ? (
                  <table className="table compact">
                    <thead><tr><th scope="col">When</th><th scope="col" className="num">Score</th><th scope="col" className="num">CIS</th><th scope="col" className="num">Gaps</th></tr></thead>
                    <tbody>
                      {history.data.slice(0, 8).map((h) => (
                        <tr key={h.id} className={h.id === scan.id ? "is-current" : ""}>
                          <td>{formatTime(h.ranAt)}<span className="cell-sub">{h.trigger === "scheduled" ? "Scheduled" : h.runBy}</span></td>
                          <td className="num">{h.score}</td>
                          <td className="num">{h.compliance}%</td>
                          <td className="num">{h.openGaps}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <p className="muted">No history yet.</p>}
              </Panel>
            </div>
          </div>
        </>
      )}
    </>
  );
}
