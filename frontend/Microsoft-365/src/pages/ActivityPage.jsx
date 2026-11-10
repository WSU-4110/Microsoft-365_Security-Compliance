import { useState } from "react";
import { useApi, useApp } from "../hooks";
import { PageHeader, Panel, Chips, Loading, Badge } from "../components/ui";
import { ACTION_LABEL, formatTime } from "../format";

export default function ActivityPage() {
  const { clients } = useApp();
  const [clientId, setClientId] = useState("all");
  const { data: actions } = useApi(`/api/actions${clientId !== "all" ? `?clientId=${clientId}` : ""}`);
  const name = (id) => (clients.find((c) => c.id === id) || {}).name || id;

  return (
    <>
      <PageHeader title="Activity log" subtitle="Every action sent to a client tenant, by whom, and why. Kept for audits and client reporting." />
      <Panel className="flush">
        <div className="toolbar">
          <Chips options={[{ id: "all", label: "All clients" }, ...clients.map((c) => ({ id: c.id, label: c.name }))]} value={clientId} onChange={setClientId} label="Filter by client" />
        </div>
        {!actions ? <Loading /> : actions.length === 0 ? (
          <p className="muted pad">No actions yet. Actions taken on the Identity, Devices, Alerts, and Response pages show up here.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th scope="col">When</th><th scope="col">Client</th><th scope="col">Action</th><th scope="col">Target</th><th scope="col">By</th><th scope="col">Reason</th><th scope="col">Result</th></tr></thead>
              <tbody>
                {actions.map((a) => (
                  <tr key={a.id}>
                    <td className="nowrap">{formatTime(a.at)}</td>
                    <td>{name(a.clientId)}</td>
                    <td>{ACTION_LABEL[a.action] || a.action}{a.playbook && <span className="cell-sub">Playbook: {a.playbook}</span>}</td>
                    <td>{a.targetName}</td>
                    <td>{a.performedBy}</td>
                    <td className="reason">{a.reason}</td>
                    <td>{a.result === "success" ? <Badge tone="good">Done</Badge> : <Badge tone="bad">Failed</Badge>}{a.error && <span className="cell-sub">{a.error}</span>}</td>
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
