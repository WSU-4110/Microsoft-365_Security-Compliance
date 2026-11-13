import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../api";
import { useApi, useApp } from "../hooks";
import { PageHeader, Panel, Stat, Meter, Sparkline, Badge, Loading } from "../components/ui";
import { timeAgo, money } from "../format";

function attentionItems(rows) {
  const items = [];
  rows.forEach(({ client, scan }) => {
    if (!scan) return;
    const to = (p) => `/c/${client.id}/${p}`;
    if (scan.signIns && scan.signIns.impossibleTravel) items.push({ tone: "bad", client, text: `Impossible travel on ${scan.signIns.impossibleTravel} account(s)`, to: to("signins") });
    if (scan.risky && scan.risky.high) items.push({ tone: "bad", client, text: `${scan.risky.high} user(s) at high risk`, to: to("identity") });
    if (scan.alerts && scan.alerts.highOpen) items.push({ tone: "bad", client, text: `${scan.alerts.highOpen} high-severity alert(s) open`, to: to("alerts") });
    if (scan.signIns && scan.signIns.sprayIps) items.push({ tone: "bad", client, text: `Password spray from ${scan.signIns.sprayIps} IP address(es)`, to: to("signins") });
    if (scan.mfa && scan.mfa.adminsWithout) items.push({ tone: "warn", client, text: `${scan.mfa.adminsWithout} admin(s) without MFA`, to: to("identity") });
    if (scan.devices && scan.devices.compliantPercent < 70) items.push({ tone: "warn", client, text: `Only ${scan.devices.compliantPercent}% of devices compliant`, to: to("devices") });
  });
  return items.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "bad" ? -1 : 1));
}

export default function PortfolioPage() {
  const { token, canAct, handleError } = useApp();
  const { data, reload } = useApi("/api/portfolio");
  const navigate = useNavigate();
  const scanning = data && data.clients.some((r) => r.scanning);

  // Refresh every two seconds while any client is being scanned
  useEffect(() => {
    if (!scanning) return undefined;
    const t = setInterval(reload, 2000);
    return () => clearInterval(t);
  }, [scanning, reload]);

  const scanAll = async () => {
    try {
      await apiFetch("/api/scans/all", { method: "POST", token });
      reload();
    } catch (err) {
      handleError(err);
    }
  };

  if (!data) return <Loading label="Loading your clients..." />;

  const rows = data.clients;
  const scanned = rows.filter((r) => r.scan);
  const sum = (fn) => scanned.reduce((n, r) => n + (fn(r.scan) || 0), 0);
  const avgCompliance = scanned.length ? Math.round(sum((s) => s.compliance.percent) / scanned.length) : null;
  const attention = attentionItems(rows);

  return (
    <>
      <PageHeader
        title="Portfolio"
        subtitle={`${rows.length} managed Microsoft 365 tenants. Every client is scanned automatically every ${data.intervalHours} hours.`}
      >
        {canAct && (
          <button type="button" className="btn btn-primary" onClick={scanAll} disabled={scanning}>
            {scanning ? "Scanning clients..." : "Scan all clients"}
          </button>
        )}
      </PageHeader>

      <div className="stats-row">
        <Stat value={rows.length} label="clients managed" note={`${scanned.length} scanned`} />
        <Stat value={sum((s) => s.users && s.users.total).toLocaleString()} label="users protected" note={`${sum((s) => s.mfa && s.mfa.registered)} with MFA`} />
        <Stat value={sum((s) => s.devices && s.devices.total).toLocaleString()} label="devices managed" note={`${sum((s) => s.devices && s.devices.compliant)} compliant`} />
        <Stat value={sum((s) => s.alerts && s.alerts.highOpen)} label="high alerts open" tone={sum((s) => s.alerts && s.alerts.highOpen) ? "bad" : "good"} note={`${sum((s) => s.alerts && s.alerts.open)} open in total`} />
        <Stat value={avgCompliance === null ? "–" : `${avgCompliance}%`} label="average CIS compliance" tone={avgCompliance >= 75 ? "good" : avgCompliance >= 50 ? "warn" : "bad"} />
        <Stat value={money(sum((s) => s.licenses && s.licenses.monthlyWaste))} label="unused licenses / month" note="across all clients" />
      </div>

      <div className="portfolio-grid">
        <Panel title="Needs attention" id="attention-title">
          {attention.length === 0 ? (
            <p className="muted">{scanned.length ? "Nothing urgent across your clients." : "Results show up here after the first scans."}</p>
          ) : (
            <ul className="attention-grid">
              {attention.slice(0, 12).map((item, i) => (
                <li key={i} className={`attention-item tone-border-${item.tone}`}>
                  <Link to={item.to}>
                    <span className="attention-text">{item.text}</span>
                    <span className="attention-client">{item.client.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Clients" id="clients-title" className="flush">
          <div className="table-wrap">
            <table className="table table-click">
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col">Secure Score</th>
                  <th scope="col">Compliance</th>
                  <th scope="col" className="num">Users</th>
                  <th scope="col" className="num">MFA</th>
                  <th scope="col" className="num">Devices OK</th>
                  <th scope="col" className="num">Alerts</th>
                  <th scope="col">Last scan</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ client, scan, scanning: busy }) => (
                  <tr key={client.id} onClick={() => navigate(`/c/${client.id}`)}>
                    <td>
                      <Link to={`/c/${client.id}`} className="cell-main" onClick={(e) => e.stopPropagation()}>{client.name}</Link>
                      <span className="cell-sub">{client.industry}</span>
                    </td>
                    {scan ? (
                      <>
                        <td>
                          <span className="score-cell">
                            <strong>{scan.score ? scan.score.percent : "–"}</strong>
                            <Sparkline values={(scan.scoreHistory || []).map((p) => p.score)} />
                          </span>
                        </td>
                        <td>
                          <span className="meter-cell"><Meter value={scan.compliance.percent} /> {scan.compliance.percent}%</span>
                        </td>
                        <td className="num">{scan.users ? scan.users.total : "–"}</td>
                        <td className="num">{scan.mfa ? `${scan.mfa.percent}%` : "–"}</td>
                        <td className="num">{scan.devices ? `${scan.devices.compliantPercent}%` : "–"}</td>
                        <td className="num">
                          {scan.alerts && scan.alerts.highOpen ? <Badge tone="bad">{scan.alerts.highOpen} high</Badge> : scan.alerts ? scan.alerts.open : "–"}
                        </td>
                        <td>{busy ? <Badge tone="info">Scanning</Badge> : <span className="muted">{timeAgo(scan.ranAt)}</span>}</td>
                      </>
                    ) : (
                      <td colSpan={7} className="muted">{busy ? "First scan in progress..." : "Not scanned yet"}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

      </div>
    </>
  );
}
