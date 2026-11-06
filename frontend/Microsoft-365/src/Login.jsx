import { useState } from "react";
import useAuth from "/.useAuth";

function Login({ onLogin }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    // Using the useAuth.js
    const { login, error } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();

        const data = await login(username, password);

        if (data?.success) {
            onLogin(data.token);
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
                Don't have an account?
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