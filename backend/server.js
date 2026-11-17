const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { TenantRegistry } = require("./tenants");
const { ScanJobs } = require("./jobs");
const { createStore } = require("./store");
const { createAuthRouter, requireAuth, requireRole, ROLES } = require("./auth");
const { createClientRouter } = require("./routes/clientRoutes");
const { PLAYBOOKS } = require("./playbooks");
const { CHECKS } = require("./scanService");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MOCK = process.env.USE_MOCK_DATA === "true";

app.use(cors());
app.use(express.json());

const asyncRoute = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const store = createStore();
const registry = new TenantRegistry({ mock: MOCK, delayMs: Number(process.env.MOCK_DELAY_MS ?? 400) });
const jobs = new ScanJobs({ registry, store, intervalHours: Number(process.env.SCAN_INTERVAL_HOURS || 24) });

/* ---------- Public ---------- */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", mode: MOCK ? "demo" : "live", clients: registry.clients.length, storage: store.constructor.name, timestamp: new Date() });
});
app.use("/api/auth", createAuthRouter(store));

/* ---------- Signed in ---------- */
app.use("/api", requireAuth);

app.get("/api/clients", (req, res) => res.json(registry.list()));

// One row per client with its latest scan, for the portfolio dashboard
app.get("/api/portfolio", asyncRoute(async (req, res) => {
  const running = jobs.running();
  const rows = await Promise.all(registry.list().map(async (client) => {
    const scan = await store.getLatestScan(client.id);
    const job = running.find((j) => j.clientId === client.id);
    if (!scan) return { client, scan: null, scanning: Boolean(job) };
    return {
      client,
      scanning: Boolean(job),
      scan: {
        id: scan.id,
        ranAt: scan.ranAt,
        score: scan.score,
        scoreHistory: scan.scoreHistory,
        compliance: { percent: scan.compliance.percent, passed: scan.compliance.passed, total: scan.compliance.total },
        users: scan.users,
        devices: scan.devices,
        alerts: scan.alerts,
        signIns: scan.signIns,
        risky: scan.risky,
        phishing: scan.phishing,
        licenses: scan.licenses,
        mfa: scan.mfa,
        gaps: { total: scan.gaps.length, high: scan.gaps.filter((g) => g.severity === "High").length },
        topGap: scan.gaps[0] ? scan.gaps[0].title : null,
      },
    };
  }));
  res.json({ clients: rows, nextScheduledScan: jobs.nextRunAt, intervalHours: jobs.intervalHours });
}));

app.post("/api/scans/all", requireRole("admin", "analyst"), (req, res) => {
  const started = registry.clients.map((c) => jobs.get(jobs.start(c.profile.id, req.user.email, req.user.userId).id));
  res.status(202).json(started);
});

app.get("/api/jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found." });
  res.json(job);
});

app.use("/api/clients", createClientRouter({ registry, store, jobs }));

app.get("/api/playbooks", (req, res) => res.json(PLAYBOOKS));

app.get("/api/actions", asyncRoute(async (req, res) => {
  res.json(await store.listActions({ clientId: req.query.clientId || undefined }));
}));

app.get("/api/settings", (req, res) => {
  res.json({
    mode: MOCK ? "demo" : "live",
    intervalHours: jobs.intervalHours,
    nextScheduledScan: jobs.nextRunAt,
    clients: registry.list(),
    checks: CHECKS,
    storage: store.constructor.name,
  });
});

/* ---------- Team (admins only) ---------- */
app.get("/api/team", requireRole("admin"), asyncRoute(async (req, res) => {
  res.json(await store.listUsers());
}));

app.patch("/api/team/:id", requireRole("admin"), asyncRoute(async (req, res) => {
  const role = req.body.role;
  if (!ROLES.includes(role)) return res.status(400).json({ error: "Unknown role." });
  const team = await store.listUsers();
  const target = team.find((u) => u.id === Number(req.params.id));
  if (!target) return res.status(404).json({ error: "Team member not found." });
  if (target.role === "admin" && role !== "admin" && team.filter((u) => u.role === "admin").length === 1) {
    return res.status(400).json({ error: "Keep at least one admin on the team." });
  }
  await store.setRole(target.id, role);
  res.json({ success: true });
}));

/* ---------- Errors ---------- */
app.use((error, req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: error.message || "Something went wrong on the server." });
});

async function start() {
  await store.init();
  app.listen(PORT, () => {
    console.log(`Northwatch API running on http://localhost:${PORT}`);
    console.log(`Mode: ${MOCK ? "demo (5 sample clients)" : "live"}, clients: ${registry.clients.length}, storage: ${store.constructor.name}`);
  });
  jobs.startSchedule();
  if (process.env.SCAN_ON_START !== "false" && registry.clients.length) {
    console.log("Running the first scan of every client...");
    jobs.scanAll().then(() => console.log("First scans finished."));
  }
}

if (require.main === module) {
  start().catch((error) => {
    console.error("Server failed to start:", error.message);
    process.exit(1);
  });
}

module.exports = { app, store, jobs, registry };
