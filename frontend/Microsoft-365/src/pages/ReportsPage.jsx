import { Link } from "react-router-dom";
import { useApp } from "../hooks";
import { downloadFile } from "../api";
import { PageHeader, Panel } from "../components/ui";

const EXPORTS = [
  { id: "gaps", title: "Security gaps", text: "Every finding from the latest scan with severity, area, fix steps, and affected accounts or devices." },
  { id: "controls", title: "CIS Controls evidence", text: "Each CIS v8 safeguard with its status and the evidence behind it. Hand this to auditors." },
  { id: "users", title: "User inventory", text: "Every account with department, admin role, MFA status, risk level, and last sign-in." },
  { id: "devices", title: "Device inventory", text: "Every Intune device with model, serial, OS, compliance, encryption, owner, and location." },
  { id: "signins", title: "Sign-in log", text: "Seven days of sign-ins with app, IP, location, result, and authentication method." },
  { id: "alerts", title: "Alert history", text: "Every Defender alert with severity, status, source, and who it's assigned to." },
];

export default function ReportsPage() {
  const { clientId, client, token, handleError } = useApp();

  return (
    <>
      <PageHeader title="Reports" subtitle="Client-ready reports and raw exports for audits, QBRs, and insurance questionnaires." />

      <Panel className="report-hero">
        <div>
          <h2>Executive security report</h2>
          <p>A printable summary for {client ? client.contact || client.name : "this client"}: posture scores, trend, top risks, CIS compliance, alerts handled, and the actions we took in the last 30 days. Use your browser’s Print button to save it as a PDF.</p>
        </div>
        <Link className="btn btn-primary" to={`/c/${clientId}/report`} target="_blank">Open report</Link>
      </Panel>

      <div className="export-grid">
        {EXPORTS.map((e) => (
          <Panel key={e.id} className="export-card">
            <h3>{e.title}</h3>
            <p className="muted">{e.text}</p>
            <button type="button" className="btn" onClick={() => downloadFile(`/api/clients/${clientId}/export/${e.id}`, token).catch(handleError)}>Download CSV</button>
          </Panel>
        ))}
      </div>
    </>
  );
}
