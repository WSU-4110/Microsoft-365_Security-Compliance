import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiFetch } from "../api";
import { useApi, useApp } from "../hooks";
import { PageHeader, Panel, Badge, Loading } from "../components/ui";

export default function ResponsePage() {
  const { clientId, canAct, token, handleError } = useApp();
  const [params] = useSearchParams();
  const { data: playbooks } = useApi("/api/playbooks");
  const users = useApi(`/api/clients/${clientId}/users`);
  const devices = useApi(`/api/clients/${clientId}/devices`);
  const [playbookId, setPlaybookId] = useState(params.get("playbook") || "compromised-account");
  const [target, setTarget] = useState(params.get("target") || "");
  const [reason, setReason] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const playbook = playbooks ? playbooks.find((p) => p.id === playbookId) : null;
  const options = useMemo(() => {
    if (!playbook) return [];
    if (playbook.target === "user") return (users.data || []).filter((u) => u.accountEnabled).map((u) => ({ id: u.id, key: u.upn, label: `${u.name} (${u.upn})` }));
    return (devices.data || []).map((d) => ({ id: d.id, key: d.name, label: `${d.name} (${d.ownerName})` }));
  }, [playbook, users.data, devices.data]);
  const chosen = options.find((o) => o.key === target || o.label === target) || null;

  if (!playbooks) return <Loading />;

  const run = async (e) => {
    e.preventDefault();
    setRunning(true);
    setResult(null);
    try {
      setResult(await apiFetch(`/api/clients/${clientId}/playbooks/${playbookId}/run`, { method: "POST", token, body: { targetId: chosen.id, reason } }));
      users.reload();
      devices.reload();
    } catch (err) {
      handleError(err);
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <PageHeader title="Response playbooks" subtitle="Run a tested sequence of containment steps in one go. Every step is recorded in the activity log." />

      <div className="playbook-grid">
        {playbooks.map((p) => (
          <button key={p.id} type="button" className={`playbook${p.id === playbookId ? " is-current" : ""}`} onClick={() => { setPlaybookId(p.id); setTarget(""); setResult(null); }}>
            <span className="playbook-head">
              <span className="playbook-name">{p.name}</span>
              <Badge tone={p.severity === "high" ? "bad" : "warn"}>{p.target === "user" ? "User" : "Device"}</Badge>
            </span>
            <span className="playbook-text">{p.description}</span>
            <ol className="playbook-steps">{p.steps.map((s) => <li key={s.action}>{s.label}</li>)}</ol>
          </button>
        ))}
      </div>

      {playbook && (
        <Panel title={`Run: ${playbook.name}`} id="run-title">
          {!canAct ? <p className="muted">Viewers can't run playbooks. Ask an analyst or admin.</p> : (
            <form className="run-form" onSubmit={run}>
              <label htmlFor="pb-target">{playbook.target === "user" ? "User" : "Device"}</label>
              <input id="pb-target" list="pb-targets" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={playbook.target === "user" ? "Start typing a name or email" : "Start typing a device or user name"} autoComplete="off" />
              <datalist id="pb-targets">{options.map((o) => <option key={o.id} value={o.key}>{o.label}</option>)}</datalist>
              {target && !chosen && <p className="tone-warn small">No match yet. Pick one from the list.</p>}
              <label htmlFor="pb-reason">Reason</label>
              <input id="pb-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: impossible travel alert, ticket #4821" />
              <button type="submit" className="btn btn-danger" disabled={running || !chosen || reason.trim().length < 5}>
                {running ? "Running..." : `Run ${playbook.steps.length} steps`}
              </button>
            </form>
          )}

          {result && (
            <div className="run-result">
              <p className={result.completed ? "tone-good" : "tone-bad"}><strong>{result.completed ? "All steps completed." : "The playbook stopped at a failed step."}</strong></p>
              <ol className="step-results">
                {result.steps.map((s, i) => (
                  <li key={i} className={s.ok ? "ok" : "failed"}>
                    {s.label}: {s.ok ? "done" : `failed (${s.error})`}
                    {s.output && s.output.devices && <span className="muted"> ({s.output.devices.length ? s.output.devices.join(", ") : "no devices"})</span>}
                  </li>
                ))}
              </ol>
              <p className="kv-head">Follow-up checklist</p>
              <ul className="checklist">{result.followUp.map((f) => <li key={f}>{f}</li>)}</ul>
            </div>
          )}
        </Panel>
      )}
    </>
  );
}
