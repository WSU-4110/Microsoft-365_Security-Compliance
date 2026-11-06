// Created for Assignment 4
// Using template design pattern to make a better overall structure
import { useState } from "react";

export default function useAuth() {
    const [error, setError] = useState("");

    const login = async (username, password) => {
        setError("");

        // Demo login
        if (username === "admin" && password === "password") {
            return {
                success: true,
                token: "demo-token"
            };
        }

        try {
            const res = await fetch("http://localhost:5173/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username,
                    password
                })
            });

            const data = await res.json();

            if (!data.success) {
                setError("Invalid username or password");
            }

            return data;
        }
        catch (err) {
            setError("Server error. Try again.");
            return { success: false };
        }
    };

    return {
        login,
        error
    };
}