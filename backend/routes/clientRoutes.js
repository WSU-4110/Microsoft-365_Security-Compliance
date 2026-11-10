// Everything under /api/clients/:clientId — data for one managed tenant and the actions on it.
const express = require("express");
const { requireRole } = require("../auth");
const { getPlaybook } = require("../playbooks");
const { toCsv } = require("../csv");
const { findImpossibleTravel } = require("../geo");
const { findPasswordSpray } = require("../scanService");

const asyncRoute = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const canAct = requireRole("admin", "analyst");

const USER_ACTIONS = {
  disable: { label: "Disable account", run: (ds, id) => ds.setAccountEnabled(id, false) },
  enable: { label: "Enable account", run: (ds, id) => ds.setAccountEnabled(id, true) },
  "revoke-sessions": { label: "Sign out everywhere", run: (ds, id) => ds.revokeSessions(id) },
};
const DEVICE_ACTIONS = {
  sync: "Sync", restart: "Restart", lock: "Remote lock", locate: "Locate", retire: "Retire", wipe: "Wipe",
};
const ALERT_STATUSES = ["new", "inProgress", "resolved"];

function createClientRouter({ registry, store, jobs }) {
  const router = express.Router();

  router.param("clientId", (req, res, next, id) => {
    const client = registry.get(id);
    if (!client) return res.status(404).json({ error: "Client not found." });
    req.client = client;
    req.ds = client.dataSource;
    next();
  });

  // Runs one action against the tenant and records it in the activity log
  async function perform(req, { targetType, targetId, targetName, action, reason, playbook, run }) {
    const entry = { clientId: req.client.profile.id, performedBy: req.user.email, action, targetType, targetId, targetName, reason, playbook };
    try {
      const output = await run();
      await store.logAction({ ...entry, result: "success" });
      return { ok: true, output };
    } catch (error) {
      await store.logAction({ ...entry, result: "failed", error: error.message });
      return { ok: false, error: error.message };
    }
  }

  function requireReason(req, res) {
    const reason = String(req.body.reason || "").trim();
    if (reason.length < 5) {
      res.status(400).json({ error: "Write a short reason (at least 5 characters) so the action is recorded." });
      return null;
    }
    return reason;
  }

  /* ---------- Scans ---------- */
  router.post("/:clientId/scans", (req, res) => {
    res.status(202).json(jobs.get(jobs.start(req.client.profile.id, req.user.email, req.user.userId).id));
  });

  router.get("/:clientId/scans/latest", asyncRoute(async (req, res) => {
    const scan = await store.getLatestScan(req.client.profile.id);
    if (!scan) return res.status(404).json({ error: "No scans yet for this client." });
    res.json(scan);
  }));

  router.get("/:clientId/scans", asyncRoute(async (req, res) => {
    res.json(await store.listScans(req.client.profile.id, 30));
  }));

  router.get("/:clientId/scans/:scanId", asyncRoute(async (req, res) => {
    const scan = await store.getScan(req.params.scanId);
    if (!scan || scan.clientId !== req.client.profile.id) return res.status(404).json({ error: "Scan not found." });
    res.json(scan);
  }));

  /* ---------- Identity ---------- */
  router.get("/:clientId/users", asyncRoute(async (req, res) => {
    res.json(await req.ds.getUsers());
  }));

  router.post("/:clientId/users/:userId/:action", canAct, asyncRoute(async (req, res) => {
    const def = USER_ACTIONS[req.params.action];
    if (!def) return res.status(404).json({ error: "Unknown action." });
    const reason = requireReason(req, res);
    if (!reason) return;
    const user = (await req.ds.getUsers()).find((u) => u.id === req.params.userId);
    if (!user) return res.status(404).json({ error: "User not found in this tenant." });

    const result = await perform(req, {
      targetType: "user", targetId: user.id, targetName: user.upn, action: req.params.action, reason,
      run: () => def.run(req.ds, user.id),
    });
    if (!result.ok) return res.status(502).json({ error: `Microsoft 365 rejected the action: ${result.error}` });
    res.json({ success: true, message: `${def.label}: done for ${user.upn}.` });
  }));

  /* ---------- Sign-ins ---------- */
  router.get("/:clientId/signins", asyncRoute(async (req, res) => {
    const signIns = await req.ds.getSignIns();
    const travel = findImpossibleTravel(signIns);
    const spray = findPasswordSpray(signIns);
    const flagged = new Set(travel.map((t) => t.to.signInId));
    const sprayIps = new Set(spray.map((s) => s.ip));
    res.json({
      signIns: signIns.map((s) => ({
        ...s,
        flags: [
          ...(flagged.has(s.id) ? ["Impossible travel"] : []),
          ...(sprayIps.has(s.ip) ? ["Password spray"] : []),
          ...(["Exchange ActiveSync", "Other clients", "IMAP", "POP", "SMTP"].includes(s.clientApp) ? ["Legacy auth"] : []),
        ],
      })),
      impossibleTravel: travel,
      passwordSpray: spray,
    });
  }));

  /* ---------- Devices (Intune) ---------- */
  router.get("/:clientId/devices", asyncRoute(async (req, res) => {
    const devices = await req.ds.getManagedDevices();
    // Devices without a reported location borrow the owner's most recent sign-in location
    if (devices.some((d) => !d.location)) {
      const signIns = await req.ds.getSignIns().catch(() => []);
      const lastByUser = new Map();
      signIns.filter((s) => s.status === "success" && typeof s.lat === "number").forEach((s) => {
        const prev = lastByUser.get(s.user);
        if (!prev || new Date(s.time) > new Date(prev.time)) lastByUser.set(s.user, s);
      });
      devices.forEach((d) => {
        const s = !d.location && lastByUser.get(d.owner);
        if (s) d.location = { city: s.city, region: s.region, country: s.country, lat: s.lat, lon: s.lon, at: s.time, source: "Owner's last sign-in" };
      });
    }
    res.json(devices);
  }));

  router.post("/:clientId/devices/:deviceId/:action", canAct, asyncRoute(async (req, res) => {
    const label = DEVICE_ACTIONS[req.params.action];
    if (!label) return res.status(404).json({ error: "Unknown device action." });
    const reason = requireReason(req, res);
    if (!reason) return;
    const device = (await req.ds.getManagedDevices()).find((d) => d.id === req.params.deviceId);
    if (!device) return res.status(404).json({ error: "Device not found in this tenant." });
    if (req.params.action === "wipe" && req.body.confirmName !== device.name) {
      return res.status(400).json({ error: `Type the device name (${device.name}) to confirm the wipe.` });
    }

    const result = await perform(req, {
      targetType: "device", targetId: device.id, targetName: device.name, action: `device-${req.params.action}`, reason,
      run: () => req.ds.deviceAction(device.id, req.params.action),
    });
    if (!result.ok) return res.status(502).json({ error: `Intune rejected the action: ${result.error}` });
    res.json({ success: true, message: `${label} sent to ${device.name}.`, output: result.output });
  }));

  /* ---------- Alerts ---------- */
  router.get("/:clientId/alerts", asyncRoute(async (req, res) => {
    res.json(await req.ds.getAlerts());
  }));

  router.patch("/:clientId/alerts/:alertId", canAct, asyncRoute(async (req, res) => {
    const alert = (await req.ds.getAlerts()).find((a) => a.id === req.params.alertId);
    if (!alert) return res.status(404).json({ error: "Alert not found." });
    const changes = {};
    if (req.body.status) {
      if (!ALERT_STATUSES.includes(req.body.status)) return res.status(400).json({ error: "Unknown status." });
      changes.status = req.body.status;
    }
    if (req.body.assignToMe) changes.assignedTo = req.user.email;
    const result = await perform(req, {
      targetType: "alert", targetId: alert.id, targetName: alert.title,
      action: changes.status ? `alert-${changes.status}` : "alert-assign",
      reason: String(req.body.reason || "Alert triage").trim(),
      run: () => req.ds.updateAlert(alert.id, changes),
    });
    if (!result.ok) return res.status(502).json({ error: `Defender rejected the update: ${result.error}` });
    res.json({ success: true });
  }));

  /* ---------- Email, licenses ---------- */
  router.get("/:clientId/phishing", asyncRoute(async (req, res) => {
    const sims = await req.ds.getPhishingSimulations();
    const people = new Map();
    const campaigns = sims.sort((a, b) => new Date(b.launched) - new Date(a.launched)).map((sim) => {
      sim.results.filter((r) => r.clicked).forEach((r) => {
        const p = people.get(r.upn) || { name: r.name, upn: r.upn, userId: r.userId, clicks: 0, credentials: 0 };
        p.clicks += 1;
        if (r.submittedCredentials) p.credentials += 1;
        people.set(r.upn, p);
      });
      return {
        id: sim.id, name: sim.name, launched: sim.launched, status: sim.status,
        targeted: sim.results.length,
        clicked: sim.results.filter((r) => r.clicked).length,
        credentials: sim.results.filter((r) => r.submittedCredentials).length,
        reported: sim.results.filter((r) => r.reported).length,
      };
    });
    res.json({ campaigns, riskyUsers: [...people.values()].sort((a, b) => b.clicks - a.clicks || b.credentials - a.credentials) });
  }));

  router.get("/:clientId/licenses", asyncRoute(async (req, res) => {
    const [licenses, users] = await Promise.all([req.ds.getLicenses(), req.ds.getUsers()]);
    res.json({
      licenses: licenses.map((l) => ({ ...l, unused: Math.max(0, l.prepaid - l.consumed), monthlyWaste: Math.max(0, l.prepaid - l.consumed) * (l.pricePerMonth || 0) })),
      disabledAccounts: users.filter((u) => !u.accountEnabled).map((u) => ({ name: u.name, upn: u.upn })),
    });
  }));

  /* ---------- Playbooks ---------- */
  router.post("/:clientId/playbooks/:playbookId/run", canAct, asyncRoute(async (req, res) => {
    const playbook = getPlaybook(req.params.playbookId);
    if (!playbook) return res.status(404).json({ error: "Playbook not found." });
    const reason = requireReason(req, res);
    if (!reason) return;

    let target;
    if (playbook.target === "user") {
      target = (await req.ds.getUsers()).find((u) => u.id === req.body.targetId);
      if (!target) return res.status(404).json({ error: "User not found in this tenant." });
    } else {
      target = (await req.ds.getManagedDevices()).find((d) => d.id === req.body.targetId);
      if (!target) return res.status(404).json({ error: "Device not found in this tenant." });
    }

    const steps = [];
    for (const step of playbook.steps) {
      let result;
      if (step.action === "retire-devices") {
        const owned = (await req.ds.getManagedDevices()).filter((d) => d.owner === target.upn);
        const outputs = [];
        for (const d of owned) {
          outputs.push(await perform(req, { targetType: "device", targetId: d.id, targetName: d.name, action: "device-retire", reason, playbook: playbook.id, run: () => req.ds.deviceAction(d.id, "retire") }));
        }
        result = outputs.every((o) => o.ok) ? { ok: true, output: { devices: owned.map((d) => d.name) } } : { ok: false, error: outputs.find((o) => !o.ok).error };
      } else if (playbook.target === "user") {
        result = await perform(req, { targetType: "user", targetId: target.id, targetName: target.upn, action: step.action, reason, playbook: playbook.id, run: () => USER_ACTIONS[step.action].run(req.ds, target.id) });
      } else {
        result = await perform(req, { targetType: "device", targetId: target.id, targetName: target.name, action: `device-${step.action}`, reason, playbook: playbook.id, run: () => req.ds.deviceAction(target.id, step.action) });
      }
      steps.push({ label: step.label, ok: result.ok, error: result.error || null, output: result.output || null });
      if (!result.ok) break;
    }
    const completed = steps.length === playbook.steps.length && steps.every((s) => s.ok);
    res.status(completed ? 200 : 502).json({ completed, steps, followUp: playbook.followUp });
  }));

  /* ---------- Activity, reports, exports ---------- */
  router.get("/:clientId/actions", asyncRoute(async (req, res) => {
    res.json(await store.listActions({ clientId: req.client.profile.id }));
  }));

  router.get("/:clientId/report", asyncRoute(async (req, res) => {
    const [scan, history, actions, alerts] = await Promise.all([
      store.getLatestScan(req.client.profile.id),
      store.listScans(req.client.profile.id, 30),
      store.listActions({ clientId: req.client.profile.id }),
      req.ds.getAlerts().catch(() => []),
    ]);
    if (!scan) return res.status(404).json({ error: "Run a scan before creating a report." });
    const monthAgo = Date.now() - 30 * 86400000;
    res.json({
      client: registry.list().find((c) => c.id === req.client.profile.id),
      generatedAt: new Date().toISOString(),
      generatedBy: req.user.email,
      scan,
      history,
      actions: actions.filter((a) => new Date(a.at).getTime() > monthAgo),
      alerts: {
        total: alerts.length,
        resolved: alerts.filter((a) => a.status === "resolved").length,
        open: alerts.filter((a) => a.status !== "resolved").length,
        bySeverity: ["high", "medium", "low", "informational"].map((s) => ({ severity: s, count: alerts.filter((a) => a.severity === s).length })),
      },
    });
  }));

  const EXPORTS = {
    users: { load: (ds) => ds.getUsers(), columns: [
      { label: "Name", value: "name" }, { label: "Email", value: "upn" }, { label: "Department", value: "department" },
      { label: "Admin", value: (u) => (u.isAdmin ? "Yes" : "No") }, { label: "MFA registered", value: (u) => (u.mfaRegistered === null ? "Unknown" : u.mfaRegistered ? "Yes" : "No") },
      { label: "Account enabled", value: (u) => (u.accountEnabled ? "Yes" : "No") }, { label: "Risk level", value: "riskLevel" }, { label: "Last sign-in", value: "lastSignIn" }] },
    devices: { load: (ds) => ds.getManagedDevices(), columns: [
      { label: "Device", value: "name" }, { label: "OS", value: "os" }, { label: "OS version", value: "osVersion" }, { label: "Model", value: "model" },
      { label: "Serial", value: "serial" }, { label: "Owner", value: "owner" }, { label: "Compliance", value: "compliance" },
      { label: "Issues", value: "complianceIssues" }, { label: "Encrypted", value: (d) => (d.encrypted ? "Yes" : "No") }, { label: "Last check-in", value: "lastSync" },
      { label: "City", value: (d) => (d.location ? d.location.city : "") }, { label: "Country", value: (d) => (d.location ? d.location.country : "") }] },
    signins: { load: (ds) => ds.getSignIns(), columns: [
      { label: "Time", value: "time" }, { label: "User", value: "user" }, { label: "App", value: "app" }, { label: "Client app", value: "clientApp" },
      { label: "IP", value: "ip" }, { label: "City", value: "city" }, { label: "Country", value: "country" }, { label: "Result", value: "status" },
      { label: "Failure reason", value: "failureReason" }, { label: "Authentication", value: "mfa" }, { label: "Risk", value: "risk" }] },
    alerts: { load: (ds) => ds.getAlerts(), columns: [
      { label: "Created", value: "created" }, { label: "Title", value: "title" }, { label: "Severity", value: "severity" }, { label: "Status", value: "status" },
      { label: "Source", value: "service" }, { label: "User", value: "user" }, { label: "Device", value: "device" }, { label: "Assigned to", value: "assignedTo" }] },
    gaps: { load: async (ds, cid) => ((await store.getLatestScan(cid)) || { gaps: [] }).gaps, columns: [
      { label: "Severity", value: "severity" }, { label: "Area", value: "area" }, { label: "Finding", value: "title" },
      { label: "How to fix", value: "fixInstruction" }, { label: "Affected", value: "affected" }] },
    controls: { load: async (ds, cid) => { const s = await store.getLatestScan(cid); return s ? s.compliance.controls : []; }, columns: [
      { label: "CIS safeguard", value: "id" }, { label: "Implementation group", value: "ig" }, { label: "Title", value: "title" },
      { label: "Status", value: "status" }, { label: "Evidence", value: "evidence" }] },
  };

  router.get("/:clientId/export/:kind", asyncRoute(async (req, res) => {
    const def = EXPORTS[req.params.kind];
    if (!def) return res.status(404).json({ error: "Unknown export." });
    const rows = await def.load(req.ds, req.client.profile.id);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${req.client.profile.id}-${req.params.kind}-${date}.csv"`);
    res.send(toCsv(rows, def.columns));
  }));

  return router;
}

module.exports = { createClientRouter };
