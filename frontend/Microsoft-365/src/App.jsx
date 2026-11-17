
// Import React Router components used to manage navigation between pages.
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate
} from "react-router-dom";

// Import useState to manage the user's login session.
import { useState } from "react";

// Import the application's CSS files.
import "./northwatch.css";

// Import components used throughout the application.
import Login from "./Login";
import Register from "./Register";
import Layout from "./Layout";

// Import individual dashboard pages.
import PortfolioPage from "./pages/PortfolioPage";
import OverviewPage from "./pages/OverviewPage";
import IdentityPage from "./pages/IdentityPage";
import SignInsPage from "./pages/SignInsPage";
import DevicesPage from "./pages/DevicesPage";
import AlertsPage from "./pages/AlertsPage";
import EmailPage from "./pages/EmailPage";
import CompliancePage from "./pages/CompliancePage";
import LicensesPage from "./pages/LicensesPage";
import ReportsPage from "./pages/ReportsPage";
import ResponsePage from "./pages/ResponsePage";
import ActivityPage from "./pages/ActivityPage";
import SettingsPage from "./pages/SettingsPage";
import ReportPrint from "./pages/ReportPrint";


function App() {

  // Manage the user's current login session.
  // sessionStorage keeps the session available when the page is refreshed
  // within the same browser tab.
  //
  // useState initializes the session by checking sessionStorage:
  // - If a saved session exists, convert it from JSON into a JavaScript object.
  // - If no session exists, return null (user is not logged in).
  const [session, setSession] = useState(() => {
    const saved = sessionStorage.getItem("session");
    return saved ? JSON.parse(saved) : null;
  });


  // Function called after a successful login.
  // Receives the authentication token, email, and user role from Login.jsx.
  const handleLogin = (token, email, role) => {

    // Create an object containing the user's session information.
    const next = { token, email, role };

    // Save the session in sessionStorage as a JSON string.
    // This allows the session to be restored after a page refresh.
    sessionStorage.setItem("session", JSON.stringify(next));

    // Update React state so the application recognizes the user as logged in.
    setSession(next);
  };


  // Function called when the user logs out.
  const handleLogout = () => {

    // Remove the saved session from the browser's sessionStorage.
    sessionStorage.removeItem("session");

    // Reset the session state to null.
    // This indicates that the user is no longer logged in.
    setSession(null);
  };


  // Route protection function.
  // Checks whether a user has an active session before displaying a page.
  //
  // If a session exists, display the requested page.
  // If no session exists, redirect the user to the login page.
  // replace prevents the protected page from remaining in browser history.
  const guard = (element) =>
    (session ? element : <Navigate to="/login" replace />);


  // JSX below defines the application's routing system.
  return (
    // Router enables navigation between different application pages
    // without requiring a full browser page reload.
    <Router>

      {/* Routes contains all the available application routes. */}
      <Routes>

        {/* LOGIN ROUTE
            If the user already has a session, redirect them to the homepage.
            Otherwise, display the Login component and pass handleLogin
            so Login can update the session after successful authentication. */}
        <Route
          path="/login"
          element={
            session
              ? <Navigate to="/" replace />
              : <Login onLogin={handleLogin} />
          }
        />

        {/* REGISTRATION ROUTE
            Displays the account registration page. */}
        <Route
          path="/register"
          element={<Register />}
        />


        {/* REPORT PRINT ROUTE
            Protects the printable client report page.
            The clientId parameter identifies which client's report to display.
            The current session is passed to ReportPrint. */}
        <Route
          path="/c/:clientId/report"
          element={guard(<ReportPrint session={session} />)}
        />


        {/* PROTECTED APPLICATION LAYOUT
            All routes nested inside this Route require an active session.
            Layout provides the shared dashboard structure, such as navigation
            and other elements displayed across multiple pages.
            
            The session and logout function are passed to Layout as props. */}
        <Route
          element={guard(
            <Layout session={session} onLogout={handleLogout} />
          )}
        >

          {/* PORTFOLIO HOMEPAGE
              The index route is the default page displayed at "/". */}
          <Route index element={<PortfolioPage />} />

          {/* ACTIVITY PAGE
              Displays application activity information. */}
          <Route
            path="activity"
            element={<ActivityPage />}
          />

          {/* SETTINGS PAGE
              Displays the application's settings. */}
          <Route
            path="settings"
            element={<SettingsPage />}
          />


          {/* CLIENT-SPECIFIC ROUTES
              The :clientId parameter represents the selected client's ID.
              All routes nested inside this section belong to that client.
              
              Example URL: /c/123/alerts */}
          <Route path="c/:clientId">

            {/* CLIENT OVERVIEW
                The index route displays the selected client's overview page.
                Example URL: /c/123 */}
            <Route
              index
              element={<OverviewPage />}
            />

            {/* ALERTS PAGE
                Displays security alerts for the selected client. */}
            <Route
              path="alerts"
              element={<AlertsPage />}
            />

            {/* SIGN-INS PAGE
                Displays user sign-in activity for the selected client. */}
            <Route
              path="signins"
              element={<SignInsPage />}
            />

            {/* IDENTITY PAGE
                Displays identity and user-related security information. */}
            <Route
              path="identity"
              element={<IdentityPage />}
            />

            {/* DEVICES PAGE
                Displays device information for the selected client. */}
            <Route
              path="devices"
              element={<DevicesPage />}
            />

            {/* EMAIL PAGE
                Displays email security information. */}
            <Route
              path="email"
              element={<EmailPage />}
            />

            {/* COMPLIANCE PAGE
                Displays compliance information for the selected client. */}
            <Route
              path="compliance"
              element={<CompliancePage />}
            />

            {/* LICENSES PAGE
                Displays license information for the selected client. */}
            <Route
              path="licenses"
              element={<LicensesPage />}
            />

            {/* REPORTS PAGE
                Displays reports associated with the selected client. */}
            <Route
              path="reports"
              element={<ReportsPage />}
            />

            {/* RESPONSE PAGE
                Displays security response and remediation information. */}
            <Route
              path="response"
              element={<ResponsePage />}
            />

          </Route>
        </Route>


        {/* FALLBACK ROUTE
            If the user navigates to a URL that does not match any route,
            redirect them to the homepage.
            
            If they are not logged in, the protected route will then
            redirect them to the login page. */}
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />

      </Routes>
    </Router>
  );
}


// Export App so it can be imported and rendered by the main application.
export default App;

