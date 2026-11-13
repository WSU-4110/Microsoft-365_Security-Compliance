import { Link } from "react-router-dom";
import { useApi, useApp } from "../hooks";
import { PageHeader, Panel, Stat, Loading, Empty } from "../components/ui";
import { formatDate } from "../format";

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

function OutcomeBar({ c }) {
  const parts = [
    { key: "cred", n: c.credentials, label: "entered a password" },
    { key: "click", n: c.clicked - c.credentials, label: "clicked only" },
    { key: "report", n: c.reported, label: "reported it" },
    { key: "none", n: c.targeted - c.clicked - c.reported, label: "no action" },
  ];
  return (
    <div className="outcome" role="img" aria-label={parts.map((p) => `${p.n} ${p.label}`).join(", ")}>
      {parts.map((p) => p.n > 0 && <span key={p.key} className={`outcome-${p.key}`} style={{ flexGrow: p.n }} title={`${p.n} ${p.label}`} />)}
    </div>
  );
}

export default function EmailPage() {
  const { clientId } = useApp();
  const { data } = useApi(`/api/clients/${clientId}/phishing`);
  if (!data) return <Loading label="Loading simulation results..." />;

  const { campaigns, riskyUsers } = data;
  if (!campaigns.length) {
    return (
      <>
        <PageHeader title="Email security" />
        <Empty title="No phishing simulations yet">Launch one in the Microsoft Defender portal under Email &amp; collaboration, Attack simulation training.</Empty>
      </>
    );
  }
  const latest = campaigns[0];
  const oldest = campaigns[campaigns.length - 1];
  const change = pct(latest.clicked, latest.targeted) - pct(oldest.clicked, oldest.targeted);

  return (
    <>
      <PageHeader title="Email security" subtitle="Phishing simulation results from Attack simulation training in Microsoft Defender for Office 365." />

      <div className="stats-row">
        <Stat value={`${pct(latest.clicked, latest.targeted)}%`} label="clicked the latest test" tone={pct(latest.clicked, latest.targeted) > 10 ? "warn" : "good"} note={`target: under 10%`} />
        <Stat value={latest.credentials} label="entered a password" tone={latest.credentials ? "bad" : "good"} note={latest.name} />
        <Stat value={`${pct(latest.reported, latest.targeted)}%`} label="reported it" note="higher is better" />
        <Stat value={`${change > 0 ? "+" : ""}${change} pts`} label={`click rate change since ${formatDate(oldest.launched)}`} tone={change <= 0 ? "good" : "bad"} />
        <Stat value={riskyUsers.filter((u) => u.clicks >= 2).length} label="repeat clickers" tone={riskyUsers.some((u) => u.clicks >= 2) ? "warn" : "good"} />
      </div>

      <Panel title="Campaigns" id="campaigns-title">
        <ul className="legend" aria-hidden="true">
          <li><span className="outcome-cred" />Entered a password</li>
          <li><span className="outcome-click" />Clicked only</li>
          <li><span className="outcome-report" />Reported it</li>
          <li><span className="outcome-none" />No action</li>
        </ul>
        <ul className="campaigns">
          {campaigns.map((c) => (
            <li key={c.id} className="campaign">
              <div className="campaign-head">
                <h3>{c.name}</h3>
                <span className="muted">Sent {formatDate(c.launched)} to {c.targeted} people</span>
              </div>
              <OutcomeBar c={c} />
              <p className="campaign-numbers">
                <span><strong>{pct(c.clicked, c.targeted)}%</strong> clicked</span>
                <span><strong>{c.credentials}</strong> entered a password</span>
                <span><strong>{pct(c.reported, c.targeted)}%</strong> reported</span>
              </p>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="People who clicked" id="clickers-title" className="flush">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th scope="col">User</th><th scope="col" className="num">Simulations clicked</th><th scope="col" className="num">Passwords entered</th><th scope="col"><span className="sr-only">Open</span></th></tr></thead>
            <tbody>
              {riskyUsers.map((u) => (
                <tr key={u.upn}>
                  <td><span className="cell-main">{u.name}</span><span className="cell-sub">{u.upn}</span></td>
                  <td className={`num ${u.clicks >= 2 ? "tone-bad" : ""}`}>{u.clicks}</td>
                  <td className={`num ${u.credentials ? "tone-bad" : ""}`}>{u.credentials}</td>
                  <td className="row-actions"><Link className="btn btn-small" to={`/c/${clientId}/identity?q=${encodeURIComponent(u.upn)}`}>Open user</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
