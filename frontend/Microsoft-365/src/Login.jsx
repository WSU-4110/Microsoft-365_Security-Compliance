import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "./api";

// Calls onLogin(token, email) when the backend accepts the email and password
function Login({ onLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      onLogin(data.token, data.email, data.role);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <h1>Northwatch</h1>
      <p className="login-tagline">Microsoft 365 security and compliance for managed service providers</p>
      <h2>Sign in</h2>

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      <p className="create-account-text">
        Don’t have an account?
        <button type="button" className="create-account-btn" onClick={() => navigate("/register")}>
          Create account
        </button>
      </p>

      <footer className="footer">
        <p>© 2026 Northwatch, Microsoft 365 Security &amp; Compliance Dashboard</p>
      </footer>
    </div>
  );
}

export default Login;
