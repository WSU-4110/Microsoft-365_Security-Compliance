import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import "./App.css";
import "./index.css";

import Login from "./Login";
import Register from "./Register";
import Layout from "./Layout";
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
  // The session is kept for this browser tab so a refresh doesn't sign you out
  const [session, setSession] = useState(() => {
    const saved = sessionStorage.getItem("session");
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogin = (token, email, role) => {
    const next = { token, email, role };
    sessionStorage.setItem("session", JSON.stringify(next));
    setSession(next);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("session");
    setSession(null);
  };

  const guard = (element) => (session ? element : <Navigate to="/login" replace />);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} />} />
        <Route path="/register" element={<Register />} />
        <Route path="/c/:clientId/report" element={guard(<ReportPrint session={session} />)} />
        <Route element={guard(<Layout session={session} onLogout={handleLogout} />)}>
          <Route index element={<PortfolioPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="c/:clientId">
            <Route index element={<OverviewPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="signins" element={<SignInsPage />} />
            <Route path="identity" element={<IdentityPage />} />
            <Route path="devices" element={<DevicesPage />} />
            <Route path="email" element={<EmailPage />} />
            <Route path="compliance" element={<CompliancePage />} />
            <Route path="licenses" element={<LicensesPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="response" element={<ResponsePage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
