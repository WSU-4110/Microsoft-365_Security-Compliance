import { apiFetch } from "../api";
import { useApi, useApp } from "../hooks";
import { PageHeader, Panel, Badge, Loading } from "../components/ui";
import { formatDate, formatTime } from "../format";

export default function SettingsPage() {
  const { isAdmin, token, email, handleError } = useApp();
  const { data: settings } = useApi("/api/settings");
  const team = useApi(isAdmin ? "/api/team" : null);

  const setRole = async (id, role) => {
    try {
      await apiFetch(`/api/team/${id}`, { method: "PATCH", token, body: { role } });
      team.reload();
    } catch (err) {
      handleError(err);
    }
  };

  if (!settings) return <Loading />;
  const areas = [...new Set(settings.checks.map((c) => c.area))];

  return (
    <>
      <PageHeader title="Settings" subtitle="Connected tenants, scan schedule, and who on the team can do what." />

      <div className="grid-two">
        <Panel title="Platform" id="platform-title">
          <dl className="kv">
            <dt>Mode</dt><dd>{settings.mode === "demo" ? <Badge tone="warn">Demo (sample tenants)</Badge> : <Badge tone="good">Live (Microsoft Graph)</Badge>}</dd>
            <dt>Scan schedule</dt><dd>Every {settings.intervalHours} hours</dd>
            <dt>Next scheduled scan</dt><dd>{formatTime(settings.nextScheduledScan)}</dd>
            <dt>Storage</dt><dd>{settings.storage === "PostgresStore" ? "PostgreSQL" : "In memory (resets on restart)"}</dd>
          </dl>
        </Panel>
        <Panel title="What every scan checks" id="checks-title">
          {areas.map((a) => (
            <p key={a} className="check-list"><strong>{a}:</strong> {settings.checks.filter((c) => c.area === a).map((c) => c.name).join(", ")}</p>
          ))}
        </Panel>
      </div>

      <Panel title="Managed tenants" id="tenants-title" className="flush">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th scope="col">Client</th><th scope="col">Service tier</th><th scope="col">Tenant ID</th><th scope="col">Frameworks</th><th scope="col">Client since</th><th scope="col">Primary contact</th></tr></thead>
            <tbody>
              {settings.clients.map((c) => (
                <tr key={c.id}>
                  <td><span className="cell-main">{c.name}</span><span className="cell-sub">{c.industry}{c.domain ? `, ${c.domain}` : ""}</span></td>
                  <td>{c.tier || "–"}</td>
                  <td className="mono">{c.tenantId}</td>
                  <td>{(c.frameworks || []).join(", ") || "–"}</td>
                  <td>{c.clientSince ? formatDate(c.clientSince) : "–"}</td>
                  <td>{c.contact || "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Team" id="team-title" className="flush">
        {!isAdmin ? (
          <p className="muted pad">Only admins can manage the team. Roles: Admin (everything), Analyst (can act on tenants), Viewer (read-only).</p>
        ) : !team.data ? <Loading /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th scope="col">Email</th><th scope="col">Joined</th><th scope="col">Role</th></tr></thead>
              <tbody>
                {team.data.map((m) => (
                  <tr key={m.id}>
                    <td>{m.email}{m.email === email && <span className="muted"> (you)</span>}</td>
                    <td>{formatDate(m.createdAt)}</td>
                    <td>
                      <select className="select" value={m.role} aria-label={`Role for ${m.email}`} onChange={(e) => setRole(m.id, e.target.value)}>
                        <option value="admin">Admin</option>
                        <option value="analyst">Analyst</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
