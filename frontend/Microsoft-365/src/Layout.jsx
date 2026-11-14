import { useEffect, useState } from "react";
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import { apiFetch } from "./api";
import "./northwatch.css";

/*
 * Sidebar navigation configuration.
 *
 * Each group represents a section of the security dashboard.
 * The navigation UI is generated from this data rather than
 * hardcoding links throughout the component.
 */
const CLIENT_NAV = [
  {
    group: "Monitor",
    items: [
      { path: "", label: "Overview" },
      { path: "alerts", label: "Alerts" },
      { path: "signins", label: "Sign-ins" },
    ],
  },
  {
    group: "Protect",
    items: [
      { path: "identity", label: "Identity" },
      { path: "devices", label: "Devices" },
      { path: "email", label: "Email security" },
    ],
  },
  {
    group: "Govern",
    items: [
      { path: "compliance", label: "Compliance" },
      { path: "licenses", label: "Licenses" },
      { path: "reports", label: "Reports" },
    ],
  },
  {
    group: "Respond",
    items: [
      { path: "response", label: "Response playbooks" },
    ],
  },
];

/*
 * Maps backend role values to user-friendly labels.
 */
const ROLE_LABEL = {
  admin: "Admin",
  analyst: "Analyst",
  viewer: "Viewer",
};

/*
 * Main application layout.
 *
 * This component is the shell for the entire authenticated area
 * of the application. It contains:
 *
 * - Sidebar navigation
 * - Client selector
 * - Top navigation bar
 * - Error banner
 * - Current page content (Outlet)
 *
 * All tenant/client-specific pages render inside this layout.
 */
function Layout({ session, onLogout }) {
  /*
   * Read the currently selected client from the URL.
   *
   * Example:
   * /c/contoso/alerts
   *
   * clientId = "contoso"
   */
  const { clientId } = useParams();

  // Used for programmatic navigation between routes.
  const navigate = useNavigate();

  // Provides information about the current URL.
  const location = useLocation();

  /*
   * Stores all clients retrieved from the backend.
   *
   * Example:
   * [
   *   { id: "contoso", name: "Contoso" },
   *   { id: "northwind", name: "Northwind" }
   * ]
   */
  const [clients, setClients] = useState([]);

  // Error message displayed in the alert banner.
  const [error, setError] = useState("");

  // Controls mobile sidebar visibility.
  const [navOpen, setNavOpen] = useState(false);

  /*
   * Centralized API error handler.
   *
   * If a user's token expires and the backend returns
   * a 401 Unauthorized response, automatically log them out.
   *
   * All other errors are shown in the UI.
   */
  const handleError = (err) => {
    if (err.status === 401) {
      onLogout();
    } else {
      setError(err.message);
    }
  };

  /*
   * Load available clients from the backend.
   *
   * Runs:
   * - When the component first mounts
   * - Whenever the user's auth token changes
   *
   * Example API request:
   * GET /api/clients
   */
  useEffect(() => {
    apiFetch("/api/clients", {
      token: session.token,
    })
      .then(setClients)
      .catch(handleError);

    // Prevent ESLint from requiring handleError as a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.token]);

  /*
   * Track the last visited path.
   *
   * Used to detect page navigation without requiring a separate effect.
   */
  const [lastPath, setLastPath] = useState(location.pathname);

  /*
   * Whenever the route changes:
   * - Update tracked path
   * - Clear old error messages
   * - Automatically close the mobile sidebar
   */
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setError("");
    setNavOpen(false);
  }

  /*
   * Find the currently selected client using the URL parameter.
   *
   * Example:
   * URL clientId = "contoso"
   *
   * Finds:
   * { id: "contoso", name: "Contoso" }
   */
  const client =
    clients.find((c) => c.id === clientId) || null;

  /*
   * Extract the active section from the URL.
   *
   * Example:
   * /c/contoso/alerts
   *
   * Results:
   * section = "alerts"
   *
   * This allows client switching while staying
   * on the same dashboard section.
   */
  const section = clientId
    ? location.pathname.split("/")[3] || ""
    : "";

  /*
   * Change the current client/tenant.
   *
   * Example:
   * Current:
   * /c/client1/alerts
   *
   * Switch to:
   * client2
   *
   * Result:
   * /c/client2/alerts
   *
   * Users remain on the same section while
   * changing tenants.
   */
  const switchClient = (id) => {
    if (!id) {
      navigate("/");
    } else {
      navigate(`/c/${id}${section ? `/${section}` : ""}`);
    }
  };

  /*
   * Shared application data passed to all child routes.
   *
   * Nested pages can access this using:
   *
   * const context = useOutletContext();
   */
  const context = {
    token: session.token,
    email: session.email,
    role: session.role,

    /*
     * Permission helpers.
     *
     * Admins and Analysts can perform actions.
     * Viewers are read-only.
     */
    canAct:
      session.role === "admin" ||
      session.role === "analyst",

    isAdmin: session.role === "admin",

    clients,
    client,
    clientId,

    handleError,

    // Allows child pages to remove the current error.
    clearError: () => setError(""),
  };

  return (
    <div className={`shell${navOpen ? " nav-open" : ""}`}>
      {/* Sidebar navigation */}
      <aside className="sidebar" aria-label="Main navigation">
        {/* Company branding */}
        <div className="brand">
          <span
            className="brand-mark"
            aria-hidden="true"
          />
          <span className="brand-name">
            Northwatch
          </span>
        </div>

        {/* Client selector dropdown */}
        <label
          className="switcher-label"
          htmlFor="client-switch"
        >
          Client
        </label>

        <select
          id="client-switch"
          className="switcher"
          value={clientId || ""}
          onChange={(e) =>
            switchClient(e.target.value)
          }
        >
          <option value="">
            All clients
          </option>

          {/* Populate available clients dynamically */}
          {clients.map((c) => (
            <option
              key={c.id}
              value={c.id}
            >
              {c.name}
            </option>
          ))}
        </select>

        {/* Sidebar navigation links */}
        <nav className="nav">
          {/* Portfolio overview page */}
          <NavLink
            to="/"
            end
            className="nav-link"
          >
            Portfolio
          </NavLink>

          {/* Render client-specific navigation */}
          {client ? (
            CLIENT_NAV.map((g) => (
              <div
                key={g.group}
                className="nav-group"
              >
                <p className="nav-group-label">
                  {g.group}
                </p>

                {g.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={`/c/${client.id}${
                      item.path
                        ? `/${item.path}`
                        : ""
                    }`}
                    end={!item.path}
                    className="nav-link"
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ))
          ) : (
            <p className="nav-hint">
              Pick a client above to see its tenant.
            </p>
          )}

          {/* Links available regardless of tenant selection */}
          <div className="nav-group nav-bottom">
            <NavLink
              to="/activity"
              className="nav-link"
            >
              Activity log
            </NavLink>

            <NavLink
              to="/settings"
              className="nav-link"
            >
              Settings
            </NavLink>
          </div>
        </nav>
      </aside>

      {/* Main application content area */}
      <div className="main">
        {/* Top navigation bar */}
        <header className="topbar">
          {/* Mobile menu toggle button */}
          <button
            type="button"
            className="menu-btn"
            aria-label="Open navigation"
            onClick={() =>
              setNavOpen(!navOpen)
            }
          >
            Menu
          </button>

          {/* Display selected client information */}
          <div className="topbar-context">
            {client ? (
              <>
                <span className="topbar-client">
                  {client.name}
                </span>

                <span className="topbar-meta">
                  {client.industry}
                  {client.tier
                    ? ` • ${client.tier}`
                    : ""}
                </span>
              </>
            ) : (
              <span className="topbar-client">
                All clients
              </span>
            )}
          </div>

          {/* Authenticated user information */}
          <div className="topbar-user">
            <span className="topbar-email">
              {session.email}
            </span>

            <span
              className={`role role-${session.role}`}
            >
              {ROLE_LABEL[session.role] ||
                session.role}
            </span>

            {/* Logout button */}
            <button
              type="button"
              className="link"
              onClick={onLogout}
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Render page content */}
        <main className="content">
          {/* Error banner shown when API calls fail */}
          {error && (
            <div
              className="alert-banner"
              role="alert"
            >
              <p>{error}</p>

              <button
                type="button"
                className="link"
                onClick={() => setError("")}
              >
                Dismiss
              </button>
            </div>
          )}

          {/*
           * Render the currently active route.
           *
           * Examples:
           * - Overview page
           * - Alerts page
           * - Reports page
           * - Identity page
           *
           * Context object is made available to all child pages.
           */}
          <Outlet context={context} />
        </main>
      </div>
    </div>
  );
}

export default Layout;
