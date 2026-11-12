import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "./api";

export default function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const validatePassword = (password) => {
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{12,}$/;

    return passwordRegex.test(password);
  };



  const handleRegister = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
    return;
    }

    if (!validatePassword(password)) {
      setMessage(
    "Password must be at least 12 characters and contain an uppercase letter, lowercase letter, number, and special character."
      );
    return;
    }

    try {
      const data = await apiFetch("/api/auth/register", {
        method: "POST",
        body: { email, password },
      });
      setMessage(
        data.role === "admin"
          ? "Account created as the admin (first account). Taking you to sign in..."
          : "Account created with read-only access. An admin can change your role. Taking you to sign in..."
      );
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <div className="register-container">
      <h2>Create Account</h2>

      <form onSubmit={handleRegister}>
        <input 
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <p className="password-requirements">
          Password must contain:
        <br />
        • At least 12 characters
        <br />
        • One uppercase letter
        <br />
        • One lowercase letter
        <br />
        • One number
        <br />
        • One special character
        </p>

        <input 
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />

        <button type="submit">Create account</button>
      </form>

      <p>{message}</p>

      <p className="create-account-text">
        Already have an account?
        <button type="button" className="create-account-btn" onClick={() => navigate("/login")}>
          Sign in
        </button>
      </p>
    </div>
  );
}

