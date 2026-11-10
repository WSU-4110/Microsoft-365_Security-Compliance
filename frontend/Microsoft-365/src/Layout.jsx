import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "./api";
import "./northwatch.css";

const CLIENT_NAV = [
  { group: "Monitor", items: [
    { path: "", label: "Overview" },
    { path: "alerts", label: "Alerts" },
    { path: "signins", label: "Sign-ins" },
  ] },
  { group: "Protect", items: [
    { path: "identity", label: "Identity" },
    { path: "devices", label: "Devices" },
    { path: "email", label: "Email security" },
  ] },
  { group: "Govern", items: [
    { path: "compliance", label: "Compliance" },
    { path: "licenses", label: "Licenses" },
    { path: "reports", label: "Reports" },
  ] },
  { group: "Respond", items: [
    { path: "response", label: "Response playbooks" },
  ] },
];

const ROLE_LABEL = { admin: "Admin", analyst: "Analyst", viewer: "Viewer" };

function Layout({ session, onLogout }) {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [clients, setClients] = useState([]);
  const [error, setError] = useState("");
  const [navOpen, setNavOpen] = useState(false);

  const handleError = (err) => {
    if (err.status === 401) onLogout();
    else setError(err.message);
  };

  useEffect(() => {
    apiFetch("/api/clients", { token: session.token }).then(setClients).catch(handleError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.token]);

  // Clear the error banner and close the mobile menu when the page changes
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setError("");
    setNavOpen(false);
  }

  const client = clients.find((c) => c.id === clientId) || null;
  const section = clientId ? location.pathname.split("/")[3] || "" : "";

  const switchClient = (id) => {
    if (!id) navigate("/");
    else navigate(`/c/${id}${section ? `/${section}` : ""}`);
  };

  const context = {
    token: session.token,
    email: session.email,
    role: session.role,
    canAct: session.role === "admin" || session.role === "analyst",
    isAdmin: session.role === "admin",
    clients,
    client,
    clientId,
    handleError,
    clearError: () => setError(""),
  };

  return (
    <div className={`shell${navOpen ? " nav-open" : ""}`}>
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">Northwatch</span>
        </div>

        <label className="switcher-label" htmlFor="client-switch">Client</label>
        <select id="client-switch" className="switcher" value={clientId || ""} onChange={(e) => switchClient(e.target.value)}>
          <option value="">All clients</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <nav className="nav">
          <NavLink to="/" end className="nav-link">Portfolio</NavLink>
          {client ? CLIENT_NAV.map((g) => (
            <div key={g.group} className="nav-group">
              <p className="nav-group-label">{g.group}</p>
              {g.items.map((item) => (
                <NavLink key={item.path} to={`/c/${client.id}${item.path ? `/${item.path}` : ""}`} end={!item.path} className="nav-link">
                  {item.label}
                </NavLink>
              ))}
            </div>
          )) : (
            <p className="nav-hint">Pick a client above to see its tenant.</p>
          )}
          <div className="nav-group nav-bottom">
            <NavLink to="/activity" className="nav-link">Activity log</NavLink>
            <NavLink to="/settings" className="nav-link">Settings</NavLink>
          </div>
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <button type="button" className="menu-btn" aria-label="Open navigation" onClick={() => setNavOpen(!navOpen)}>Menu</button>
          <div className="topbar-context">
            {client ? (
              <>
                <span className="topbar-client">{client.name}</span>
                <span className="topbar-meta">{client.industry} {client.tier ? `• ${client.tier}` : ""}</span>
              </>
            ) : (
              <span className="topbar-client">All clients</span>
            )}
          </div>
          <div className="topbar-user">
            <span className="topbar-email">{session.email}</span>
            <span className={`role role-${session.role}`}>{ROLE_LABEL[session.role] || session.role}</span>
            <button type="button" className="link" onClick={onLogout}>Sign out</button>
          </div>
        </header>

        <main className="content">
          {error && (
            <div className="alert-banner" role="alert">
              <p>{error}</p>
              <button type="button" className="link" onClick={() => setError("")}>Dismiss</button>
            </div>
          )}
          <Outlet context={context} />
        </main>
      </div>
    </div>
  );
}

export default Layout;
