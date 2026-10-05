// Importing React hooks and the CSS file
import { useEffect, useState } from "react";
import "./App.css";

// React state variables
// Store data that will apear in the UI
// When they change - it will update
function App() {
  const [secureScore, setSecureScore] = useState(null);
  const [securityGaps, setSecurityGaps] = useState([]);
  const [complianceStatus, setComplianceStatus] = useState("Loading...");

  // Fetching data from backend
  // useEffect runs once the page loads
  useEffect(() => {
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
  }, []);

  // UI layout - what the user sees
  return (
    <div className="dashboard">

      {/* Header section */}
      <header className="header">
        <h1>Microsoft 365 Security & Compliance Dashboard</h1>
        <p>Monitor your organization’s security posture and compliance status.</p>
      </header>

      {/* Secure score section */}
      <section className="score-section">
        <h2>Secure Score</h2>
        {secureScore ? (
          <p>
            Current Score: <strong>{secureScore.current}</strong> / {secureScore.max}
          </p>
        ) : (
          <p>Loading Secure Score...</p>
        )}
      </section>
      
      {/* Security gaps section */}
      <section className="gaps-section">
        <h2>Security Gaps</h2>
        {securityGaps.length > 0 ? (
          <ul>
            {securityGaps.map((gap, index) => (
              <li key={index}>
                <strong>{gap.title}</strong> – {gap.description}
              </li>
            ))}
          </ul>
        ) : (
          <p>No security gaps detected.</p>
        )}
      </section>

      {/* Compliance status section */}
      <section className="compliance-section">
        <h2>Compliance Status</h2>
        <p>{complianceStatus}</p>
      </section>
       
       {/* Footer */}
      <footer className="footer">
        <p>© 2026 Microsoft 365 Security & Compliance Dashboard</p>
      </footer>
    </div>
  );
}

export default App;

