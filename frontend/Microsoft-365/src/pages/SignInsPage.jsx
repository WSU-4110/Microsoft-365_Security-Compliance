import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApi, useApp } from "../hooks";
import { downloadFile } from "../api";
import { PageHeader, Panel, Stat, Badge, Chips, Search, Loading } from "../components/ui";
import WorldMap from "../components/WorldMap";
import { formatTime } from "../format";

const PAGE = 100;

export default function SignInsPage() {
  const { clientId, token, handleError } = useApp();
  const { data } = useApi(`/api/clients/${clientId}/signins`);
  const [filter, setFilter] = useState("flagged");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);

  const homeCountry = useMemo(() => {
    if (!data) return null;
    const counts = {};
    data.signIns.forEach((s) => { counts[s.country] = (counts[s.country] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  }, [data]);

  if (!data) return <Loading label="Loading 7 days of sign-ins..." />;

  const { signIns, impossibleTravel, passwordSpray } = data;
  const FILTERS = [
    { id: "all", label: "All", test: () => true },
    { id: "flagged", label: "Flagged", test: (s) => s.flags.length > 0 },
    { id: "failed", label: "Failed", test: (s) => s.status === "failure" },
    { id: "abroad", label: `Outside ${homeCountry || "home country"}`, test: (s) => s.country && s.country !== homeCountry },
    { id: "single", label: "Without MFA", test: (s) => s.status === "success" && s.mfa !== "multifactor" },
    { id: "risky", label: "Risky", test: (s) => s.risk && s.risk !== "none" },
  ].map((f) => ({ ...f, count: signIns.filter(f.test).length }));

  const active = FILTERS.find((f) => f.id === filter);
  const q = query.trim().toLowerCase();
  const rows = signIns.filter(active.test).filter((s) => !q || `${s.user} ${s.userName} ${s.ip} ${s.city} ${s.country} ${s.app}`.toLowerCase().includes(q));

  const points = signIns.map((s) => ({
    lat: s.lat, lon: s.lon,
    tone: s.flags.some((f) => f !== "Legacy auth") ? "bad" : s.status === "failure" || s.flags.length ? "warn" : "good",
    label: `${s.userName}: ${s.status === "failure" ? "failed" : "signed in"} — ${s.city}, ${s.country}`,
    place: s.city,
  }));
  const travelArcs = impossibleTravel.map((t) => {
    const from = signIns.find((s) => s.id === t.from.signInId);
    const to = signIns.find((s) => s.id === t.to.signInId);
    return from && to ? { from, to } : null;
  }).filter(Boolean);
  const failed = signIns.filter((s) => s.status === "failure").length;
  const countries = new Set(signIns.filter((s) => s.status === "success").map((s) => s.country)).size;

  return (
    <>
      <PageHeader title="Sign-ins" subtitle="The last 7 days of Microsoft Entra sign-ins, with impossible travel and password spray detection.">
        <button type="button" className="btn" onClick={() => downloadFile(`/api/clients/${clientId}/export/signins`, token).catch(handleError)}>Export CSV</button>
      </PageHeader>

      <div className="stats-row">
        <Stat value={signIns.length.toLocaleString()} label="sign-ins" note="last 7 days" />
        <Stat value={failed} label="failed" note={`${Math.round((failed / (signIns.length || 1)) * 100)}% of attempts`} />
        <Stat value={countries} label="countries" note="with successful sign-ins" />
        <Stat value={impossibleTravel.length} label="impossible travel" tone={impossibleTravel.length ? "bad" : "good"} />
        <Stat value={passwordSpray.length} label="password spray sources" tone={passwordSpray.length ? "bad" : "good"} />
      </div>

      <Panel>
        <WorldMap
          title="Where sign-ins came from"
          points={points}
          arcs={travelArcs}
          legend={[{ tone: "good", label: "Successful" }, { tone: "warn", label: "Failed or legacy auth" }, { tone: "bad", label: "Impossible travel or password spray" }]}
        />
      </Panel>

      {(impossibleTravel.length > 0 || passwordSpray.length > 0) && (
        <div className="grid-two">
          {impossibleTravel.length > 0 && (
            <Panel title="Impossible travel" id="travel-title">
              <ul className="findings">
                {impossibleTravel.map((t) => (
                  <li key={t.user} className="finding tone-border-bad">
                    <p className="finding-title">{t.userName}</p>
                    <p>{t.from.city}, {t.from.country} to {t.to.city}, {t.to.country}: {t.km.toLocaleString()} km in {t.hours} h ({t.speedKmh.toLocaleString()} km/h)</p>
                    <p className="muted">{formatTime(t.from.time)} then {formatTime(t.to.time)}</p>
                    <Link className="btn btn-small" to={`/c/${clientId}/identity?q=${encodeURIComponent(t.user)}`}>Open user</Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {passwordSpray.length > 0 && (
            <Panel title="Password spray" id="spray-title">
              <table className="table compact">
                <thead><tr><th scope="col">Source IP</th><th scope="col">Location</th><th scope="col" className="num">Attempts</th><th scope="col" className="num">Accounts</th></tr></thead>
                <tbody>
                  {passwordSpray.map((s) => (
                    <tr key={s.ip}><td className="mono">{s.ip}</td><td>{s.city}, {s.country}</td><td className="num">{s.attempts}</td><td className="num">{s.accounts}</td></tr>
                  ))}
                </tbody>
              </table>
              <p className="muted pad-top">Block these IPs with a named location in Conditional Access and confirm every targeted account has MFA.</p>
            </Panel>
          )}
        </div>
      )}

      <Panel className="flush">
        <div className="toolbar">
          <Chips options={FILTERS} value={filter} onChange={(f) => { setFilter(f); setShown(PAGE); }} label="Filter sign-ins" />
          <Search value={query} onChange={setQuery} placeholder="Search user, IP, city, or app" />
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Time</th><th scope="col">User</th><th scope="col">App</th><th scope="col">Location</th>
                <th scope="col">IP</th><th scope="col">Result</th><th scope="col">Auth</th><th scope="col">Flags</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, shown).map((s) => (
                <tr key={s.id}>
                  <td className="nowrap">{formatTime(s.time)}</td>
                  <td><span className="cell-main">{s.userName}</span><span className="cell-sub">{s.user}</span></td>
                  <td>{s.app}<span className="cell-sub">{s.clientApp}</span></td>
                  <td>{s.city}{s.region ? `, ${s.region}` : ""}<span className="cell-sub">{s.country}</span></td>
                  <td className="mono">{s.ip}</td>
                  <td>{s.status === "success" ? <span className="tone-good">Success</span> : <span className="tone-bad" title={s.failureReason}>Failed</span>}
                    {s.status === "failure" && <span className="cell-sub">{s.failureReason}</span>}</td>
                  <td>{s.mfa === "multifactor" ? "MFA" : <span className="tone-warn">Password only</span>}</td>
                  <td>{s.flags.map((f) => <Badge key={f} tone={f === "Legacy auth" ? "warn" : "bad"}>{f}</Badge>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="muted pad">No sign-ins match this filter.</p>}
          {rows.length > shown && (
            <div className="pad"><button type="button" className="btn" onClick={() => setShown(shown + PAGE)}>Show {Math.min(PAGE, rows.length - shown)} more of {rows.length - shown}</button></div>
          )}
        </div>
      </Panel>
    </>
  );
}
