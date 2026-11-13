import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "./api";

// Register page component
export default function Register() {
  // Allows navigation to different routes/pages
  const navigate = useNavigate();

  // State variables for form fields and messages
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");

  // Checks whether the password meets security requirements
  const validatePassword = (password) => {
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{12,}$/;

    return passwordRegex.test(password);
  };

  // Runs when the user submits the registration form
  const handleRegister = async (e) => {
    // Prevents the page from reloading on form submission
    e.preventDefault();

    // Verify that the password and confirmation match
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    // Verify that the password meets complexity requirements
    if (!validatePassword(password)) {
      setMessage(
        "Password must be at least 12 characters and contain an uppercase letter, lowercase letter, number, and special character."
      );
      return;
    }

    try {
      // Send registration request to the backend API
      const data = await apiFetch("/api/auth/register", {
        method: "POST",
        body: { email, password },
      });

      // Display a message based on the role assigned by the server
      setMessage(
        data.role === "admin"
          ? "Account created as the admin (first account). Taking you to sign in..."
          : "Account created with read-only access. An admin can change your role. Taking you to sign in..."
      );

      // Redirect user to the login page after 1.5 seconds
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      // Display any registration errors returned by the API
      setMessage(err.message);
    }
  };

  return (
    <div className="register-container">
      {/* Page title */}
      <h2>Create Account</h2>

      {/* Registration form */}
      <form onSubmit={handleRegister}>
        {/* Email input */}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        {/* Password requirements shown to the user */}
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

        {/* Password input */}
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {/* Confirm password input */}
        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />

        {/* Submit registration form */}
        <button type="submit">
          Create account
        </button>
      </form>

      {/* Success or error message from registration process */}
      <p>{message}</p>

      {/* Link to sign in for existing users */}
      <p className="create-account-text">
        Already have an account?
        <button
          type="button"
          className="create-account-btn"
          onClick={() => navigate("/login")}
        >
          Sign in
        </button>
      </p>
    </div>
  );
}

