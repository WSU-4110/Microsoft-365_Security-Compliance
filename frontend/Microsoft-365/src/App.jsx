// Importing React hooks and the CSS file
import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import { useEffect, useState } from "react";
import "./App.css";
import "./index.css"

// Import the Login component
import Login from "./Login";
import Register from "./Register";

// React state variables
// Store data that will apear in the UI
// When they change - it will update
// Adding color themes
function App() {

  // Authentication state
  // Stores login token returned by the backend
  // If token is null - user is not logged in
  // If token has a value - user is logged in
  const [token, setToken] = useState(null);

  // Called when Login.jsx successfully logs in
  const handleLogin = (token) => {
    setToken(token);
  };

  // Dashboard state
  const [secureScore, setSecureScore] = useState(null);
  const [securityGaps, setSecurityGaps] = useState([]);
  const [complianceStatus, setComplianceStatus] = useState("Loading...");
  const [theme, setTheme] = useState("theme-auto");

  // Fetching data from backend
  // useEffect runs once the page loads
  useEffect(() => {

    if (!token) return;

    // Example API calls — replace with backend endpoints later
    fetch("http://localhost:3001/secure-score")
      .then((res) => res.json())
      .then((data) => setSecureScore(data))
      .catch(() => setSecureScore({ current: 0, max: 0 }));

    fetch("http://localhost:3001/security-gaps")
      .then((res) => res.json())
      .then((data) => setSecurityGaps(data))
      .catch(() => setSecurityGaps([]));

    // Simulated compliance status
    setTimeout(() => setComplianceStatus("Compliant"), 1000);
  }, [token]); // Runs again when the token changes

  return (
    <Router>
      <Routes>

        {/* Login Page*/}
        <Route
        path="/login"
        element={<Login onLogin={handleLogin} />}
        />

        {/* Register Page */}
        <Route
        path="/register"
        element={<Register />}
        />

        {/* Dashboard Page */}
        <Route
        path="/"
        element={
          token ? (
          <div className={`dashboard ${theme}`}>


      {/* Buttons to change color theme */}
      <div className="theme-switcher">
        <div className="theme-circle blue" onClick={() => setTheme("theme-blue")}></div>
        <div className="theme-circle green" onClick={() => setTheme("theme-green")}></div>
        <div className="theme-circle purple" onClick={() => setTheme("theme-purple")}></div>
      </div>

      {/* Header section */}
      <header className="header">
        <h1>Microsoft 365 Security & Compliance Dashboard</h1>
        <p>Monitor your organization's security posture and compliance status.</p>
      </header>

      {/* Secure score section */}
      <section className="score-section">
        <h2>Secure Score</h2>
        {secureScore ? (
          <p>
            Current Score: <strong>{secureScore.current}</strong> / {secureScore.max}
          </p>
        ) : (
          <p>Loading Secure Score...</p>
        )}
      </section>
      
      {/* Security gaps section */}
      <section className="gaps-section">
        <h2>Security Gaps</h2>
        {securityGaps.length > 0 ? (
          <ul>
            {securityGaps.map((gap, index) => (
              <li key={index}>
                <strong>{gap.title}</strong> – {gap.description}
              </li>
            ))}
          </ul>
        ) : (
          <p>No security gaps detected.</p>
        )}
      </section>

      {/* Compliance status section */}
      <section className="compliance-section">
        <h2>Compliance Status</h2>
        <p>{complianceStatus}</p>
      </section>
       
                {/* Footer */}
                <footer className="footer">
                  <p>© 2026 Microsoft 365 Security & Compliance Dashboard</p>
                </footer>
              </div>
            ) : (
              <Login onLogin={handleLogin} />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;

