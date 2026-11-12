
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "./api";

// Login component handles the user sign-in process.
// onLogin is a function passed from the parent component.
// It is called when the backend successfully authenticates the user.
function Login({ onLogin }) {

  // Allows the component to navigate to different pages.
  const navigate = useNavigate();

  // State variables store the values entered by the user.
  const [email, setEmail] = useState(""); 
  const [password, setPassword] = useState("");

  // Stores any error message returned during login.
  const [error, setError] = useState("");

  // Tracks whether the login request is currently processing.
  // This prevents the user from submitting the form multiple times.
  const [loading, setLoading] = useState(false);


  // Function that runs when the user submits the login form.
  const handleSubmit = async (e) => {

    // Prevents the browser from refreshing the page when the form is submitted.
    e.preventDefault();

    // Clear any previous error messages.
    setError("");

    // Set loading to true to indicate that login is being processed.
    setLoading(true);

    try {

      // Send the email and password to the backend login API.
      // The POST method is used because we are submitting login information.
      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });

      // If login is successful, pass the returned information
      // (authentication token, email, and user role) to the onLogin function.
      onLogin(data.token, data.email, data.role);

      // Redirect the user to the home page after successful login.
      navigate("/");

    } catch (err) {

      // If login fails, display the error message returned by the API.
      setError(err.message);

    } finally {

      // Runs whether login succeeds or fails.
      // Reset loading so the user can submit the form again.
      setLoading(false);
    }
  };


  // JSX below defines what is displayed on the login page.
  return (
    <div className="login-container">

      {/* Application name displayed at the top of the login page. */}
      <h1>Northwatch</h1>

      {/* Short description explaining what the application provides. */}
      <p className="login-tagline">
        Microsoft 365 security and compliance for managed service providers
      </p>

      {/* Heading for the login form. */}
      <h2>Sign in</h2>


      {/* Login form calls handleSubmit when the user clicks Sign in. */}
      <form onSubmit={handleSubmit}>

        {/* Email input field.
            value connects the input to the email state variable.
            onChange updates email whenever the user types.
            required prevents submitting an empty email field. */}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        {/* Password input field.
            The password is hidden while the user types.
            onChange updates the password state variable. */}
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {/* Submit button.
            Disabled while the login request is processing.
            Button text changes to show the user that login is in progress. */}
        <button type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>


      {/* Display an error message only when an error exists.
          For example, incorrect email or password. */}
      {error && <p className="error">{error}</p>}


      {/* Section that allows users without an account to register. */}
      <p className="create-account-text">
        Don’t have an account?

        {/* Navigates the user to the registration page when clicked. */}
        <button
          type="button"
          className="create-account-btn"
          onClick={() => navigate("/register")}
        >
          Create account
        </button>
      </p>


      {/* Footer displayed at the bottom of the login page. */}
      <footer className="footer">
        <p>© 2026 Northwatch, Microsoft 365 Security &amp; Compliance Dashboard</p>
      </footer>

    </div>
  );
}

// Makes the Login component available for use in other files.
export default Login;
