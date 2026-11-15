// Account creation, login, and the middleware that protects the API.
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{12,}$/;

function getSecret() {
  return process.env.JWT_SECRET || "dev-only-secret-change-me";
}

function createAuthRouter(store) {
  const router = express.Router();

  router.post("/register", async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email.includes("@")) {
      return res.status(400).json({ success: false, error: "Enter a valid email address." });
    }
    if (!PASSWORD_RULE.test(password)) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 12 characters with an uppercase letter, lowercase letter, number, and special character.",
      });
    }
    if (await store.findUserByEmail(email)) {
      return res.status(409).json({ success: false, error: "An account with this email already exists." });
    }

    // The first account becomes the admin; everyone after that is a viewer
    const role = (await store.countUsers()) === 0 ? "admin" : "viewer";
    const passwordHash = await bcrypt.hash(password, 10);
    await store.createUser(email, passwordHash, role);
    res.status(201).json({ success: true, role });
  });

  router.post("/login", async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const user = await store.findUserByEmail(email);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ success: false, error: "Wrong email or password." });
    }

    const role = user.role || "viewer";
    const token = jwt.sign({ userId: user.id, email: user.email, role }, getSecret(), { expiresIn: "8h" });
    res.json({ success: true, token, email: user.email, role });
  });

  return router;
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Sign in to use this endpoint." });
  }
  try {
    req.user = jwt.verify(token, getSecret());
    next();
  } catch {
    res.status(401).json({ error: "Your session expired. Sign in again." });
  }
}

// Roles: admin (everything, including team management), analyst (can take action on
// tenants), viewer (read-only). requireRole("admin", "analyst") allows either.
const ROLES = ["admin", "analyst", "viewer"];

function requireRole(...allowed) {
  return (req, res, next) => {
    if (req.user && allowed.includes(req.user.role)) return next();
    res.status(403).json({ error: `Your role (${req.user ? req.user.role : "none"}) can't do this. Ask an admin.` });
  };
}

module.exports = { createAuthRouter, requireAuth, requireRole, ROLES };
