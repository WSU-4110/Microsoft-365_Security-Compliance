// Import React's useState to store form input values
import { useState } from "react";

// Login component receives a function "onLogin" from App.jsx
// When login successfull, call onLogin(token) to tell App.jsx that the user is authenticated
function Login({ onLogin }) {
    
    // Store the username entered by the user
    const [username, setUsername] = useState("");

    // Store the password entered by the user
    const [password, setPassword] = useState("");

    // Store an error message if the login fails
    const[error, setError] = useState("");

    // Function for when the user clicks the Login button
    const handleSubmit = async (e) => {
        e.preventDefault(); // Keeps the page from refreshing

        try {
            // Send login request to backend
            const res = await fetch("http://localhost:5173/login",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },

                // Send username and password to backend
                body: JSON.stringify( { username, password }),
            
            });

            const data = await res.json();

            // Backend returns
            // success: true or false
            // token: "session-token"

            // If PostgreSQL finds a matching user -> success = true
            // Otherwise success = false

            if (data.success) {
                onLogin(data.token); // Tells App.jsx that login succeeded
            }
            else {
                setError("Invalid username or password");
            }
        }
        catch (err) {
            setError("Server error. Try again.")
        }
    };

    return (
        <div className="login-container">
            
            <h1>Microsoft 365 Security & Compliance Dashboard</h1>
            <h2>Login</h2>

            <form onSubmit={handleSubmit}>
                {/* Username input */}
                <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />

                {/* Password input */}
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />

                {/* Login button */}
                <button type="submit">Login</button>
            </form>

            {/* Show error message */}
            {error && (<p className="error">{error}</p>
            )}

            {/* Create Account Option */}
            <p className="create-account-text">
                Don’t have an account?
                <button 
                    type="button" 
                    className="create-account-btn"
                    onClick={() => window.location.href = "/register"}
                >
                    Create Account
                </button>
            </p>

                   {/* Footer */}
            <footer className="footer">
                <p>© 2026 Microsoft 365 Security & Compliance Dashboard</p>
            </footer>
        </div>
    );
}

export default Login;