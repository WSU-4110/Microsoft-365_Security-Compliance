import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useApi, useApp } from "../hooks";
import { downloadFile } from "../api";
import { useAction } from "../components/useAction";
import { PageHeader, Panel, Stat, Badge, Chips, Search, Loading, Notice } from "../components/ui";
import { daysSince, timeAgo } from "../format";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "risk", label: "At risk", test: (u) => u.riskLevel === "high" || u.riskLevel === "medium" },
  { id: "no-mfa", label: "No MFA", test: (u) => u.accountEnabled && u.mfaRegistered === false },
  { id: "admins", label: "Admins", test: (u) => u.isAdmin },
  { id: "inactive", label: "Inactive 90+ days", test: (u) => u.accountEnabled && daysSince(u.lastSignIn) >= 90 },
  { id: "disabled", label: "Disabled", test: (u) => !u.accountEnabled },
];

export default function IdentityPage() {
  const { clientId, canAct, token, handleError } = useApp();
  const [params] = useSearchParams();
  const { data: users, reload } = useApi(`/api/clients/${clientId}/users`);
  const [filter, setFilter] = useState(params.get("filter") || "all");
  const [query, setQuery] = useState(params.get("q") || "");
  const { ask, dialog, notice, setNotice } = useAction(reload);

  const visible = useMemo(() => {
    if (!users) return [];
    const f = FILTERS.find((x) => x.id === filter);
    const q = query.trim().toLowerCase();
    const order = { high: 0, medium: 1, low: 2, none: 3 };
    return users
      .filter((u) => !f.test || f.test(u))
      .filter((u) => !q || `${u.name} ${u.upn} ${u.department}`.toLowerCase().includes(q))
      .sort((a, b) => (order[a.riskLevel] ?? 3) - (order[b.riskLevel] ?? 3) || Number(b.isAdmin) - Number(a.isAdmin));
  }, [users, filter, query]);

  if (!users) return <Loading />;

  const path = (u, action) => `/api/clients/${clientId}/users/${encodeURIComponent(u.id)}/${action}`;
  const contain = (u) => ask({
    title: `Contain ${u.name}?`,
    description: `Runs the Compromised account playbook: signs ${u.upn} out of every app and device, then disables the account. You'll get follow-up steps after it runs.`,
    confirmLabel: "Run playbook",
    danger: true,
    path: `/api/clients/${clientId}/playbooks/compromised-account/run`,
    body: { targetId: u.id },
    doneMessage: `${u.name} is contained: signed out everywhere and disabled. Next: reset the password and check mailbox rules.`,
  });

  const enabled = users.filter((u) => u.accountEnabled);
  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, f.test ? users.filter(f.test).length : users.length]));

  return (
    <>
      <PageHeader title="Identity" subtitle="Accounts in Microsoft Entra ID with MFA status, sign-in activity, and risk from Identity Protection.">
        <button type="button" className="btn" onClick={() => downloadFile(`/api/clients/${clientId}/export/users`, token).catch(handleError)}>Export CSV</button>
      </PageHeader>

      <div className="stats-row">
        <Stat value={users.length} label="accounts" note={`${enabled.length} enabled`} />
        <Stat value={`${Math.round((enabled.filter((u) => u.mfaRegistered).length / (enabled.length || 1)) * 100)}%`} label="MFA registered" note={`${counts["no-mfa"]} without MFA`} />
        <Stat value={counts.risk} label="at risk" tone={counts.risk ? "bad" : "good"} note={`${users.filter((u) => u.riskLevel === "high").length} high risk`} />
        <Stat value={counts.admins} label="admins" tone={counts.admins > 4 ? "warn" : undefined} note="target: 2 to 4" />
        <Stat value={counts.inactive} label="inactive 90+ days" tone={counts.inactive ? "warn" : undefined} />
      </div>

      <Notice onClose={() => setNotice("")}>{notice}</Notice>

      <Panel className="flush">
        <div className="toolbar">
          <Chips options={FILTERS.map((f) => ({ ...f, count: counts[f.id] }))} value={filter} onChange={setFilter} label="Filter users" />
          <Search value={query} onChange={setQuery} placeholder="Search name, email, or department" />
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">User</th>
                <th scope="col">Department</th>
                <th scope="col">MFA</th>
                <th scope="col">Risk</th>
                <th scope="col">Last sign-in</th>
                <th scope="col">Account</th>
                {canAct && <th scope="col"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => (
                <tr key={u.id} className={u.accountEnabled ? "" : "is-disabled"}>
                  <td>
                    <span className="cell-main">{u.name}{u.isAdmin && <Badge tone="info">Admin</Badge>}</span>
                    <span className="cell-sub">{u.upn}</span>
                  </td>
                  <td>{u.department || "–"}</td>
                  <td>{u.mfaRegistered === null ? <span className="muted">Unknown</span> : u.mfaRegistered ? <span className="tone-good">Registered</span> : <span className="tone-bad">Not registered</span>}</td>
                  <td>
                    {u.riskLevel === "high" ? <Badge tone="bad">High</Badge> : u.riskLevel === "medium" ? <Badge tone="warn">Medium</Badge> : <span className="muted">None</span>}
                    {u.riskDetail && <span className="cell-sub">{u.riskDetail}</span>}
                  </td>
                  <td className={u.accountEnabled && daysSince(u.lastSignIn) >= 90 ? "tone-warn" : ""}>{timeAgo(u.lastSignIn)}</td>
                  <td>{u.accountEnabled ? "Enabled" : <span className="tone-bad">Disabled</span>}</td>
                  {canAct && (
                    <td className="row-actions">
                      {u.accountEnabled && u.riskLevel !== "none" && (
                        <button type="button" className="btn btn-small btn-danger-outline" onClick={() => contain(u)}>Contain</button>
                      )}
                      {u.accountEnabled ? (
                        <button type="button" className="btn btn-small" onClick={() => ask({
                          title: `Disable ${u.name}?`, description: `${u.upn} won't be able to sign in until the account is enabled again.`,
                          confirmLabel: "Disable account", danger: true, path: path(u, "disable") })}>Disable</button>
                      ) : (
                        <button type="button" className="btn btn-small" onClick={() => ask({
                          title: `Enable ${u.name}?`, description: `${u.upn} will be able to sign in again.`,
                          confirmLabel: "Enable account", path: path(u, "enable") })}>Enable</button>
                      )}
                      <button type="button" className="btn btn-small" onClick={() => ask({
                        title: `Sign ${u.name} out everywhere?`, description: `Every app and device signed in as ${u.upn} must sign in again. Use this when a password may be stolen.`,
                        confirmLabel: "Sign out everywhere", danger: true, path: path(u, "revoke-sessions") })}>Sign out</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && <p className="muted pad">No users match this filter.</p>}
        </div>
      </Panel>
      {dialog}
    </>
  );
}
