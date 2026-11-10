process.env.USE_MOCK_DATA = "true";
process.env.MOCK_DELAY_MS = "0";
delete process.env.DATABASE_URL;

const request = require("supertest");
const { app, jobs } = require("../server");

const admin = { email: "admin@northwatch.io", password: "StrongPass123!" };
const viewer = { email: "viewer@northwatch.io", password: "StrongPass123!" };
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const C = "/api/clients/northgate-logistics";

let adminToken;
let viewerToken;

beforeAll(async () => {
  await request(app).post("/api/auth/register").send(admin).expect(201);
  await request(app).post("/api/auth/register").send(viewer).expect(201);
  adminToken = (await request(app).post("/api/auth/login").send(admin)).body.token;
  viewerToken = (await request(app).post("/api/auth/login").send(viewer)).body.token;
  await jobs.scanAll("Test");
});

test("rejects requests without a token", async () => {
  await request(app).get("/api/portfolio").expect(401);
});

test("portfolio lists five scanned clients", async () => {
  const res = await request(app).get("/api/portfolio").set(auth(viewerToken)).expect(200);
  expect(res.body.clients).toHaveLength(5);
  expect(res.body.clients.every((c) => c.scan && c.scan.compliance.total > 0)).toBe(true);
});

test("per-client data endpoints work", async () => {
  for (const path of ["users", "devices", "alerts", "phishing", "licenses", "signins", "scans/latest", "report"]) {
    await request(app).get(`${C}/${path}`).set(auth(viewerToken)).expect(200);
  }
  const signins = await request(app).get(`${C}/signins`).set(auth(viewerToken));
  expect(signins.body.impossibleTravel).toHaveLength(1);
});

test("unknown client returns 404", async () => {
  await request(app).get("/api/clients/nope/users").set(auth(adminToken)).expect(404);
});

test("viewers can't take actions", async () => {
  await request(app).post(`${C}/users/northgate-logistics-u010/disable`).set(auth(viewerToken)).send({ reason: "testing" }).expect(403);
});

test("an analyst-level action is logged", async () => {
  await request(app).post(`${C}/users/northgate-logistics-u010/disable`).set(auth(adminToken)).send({ reason: "Testing disable" }).expect(200);
  const log = await request(app).get(`${C}/actions`).set(auth(adminToken));
  expect(log.body[0]).toMatchObject({ action: "disable", targetType: "user", result: "success" });
});

test("wipe needs the device name typed", async () => {
  const devices = (await request(app).get(`${C}/devices`).set(auth(adminToken))).body;
  const d = devices[0];
  await request(app).post(`${C}/devices/${d.id}/wipe`).set(auth(adminToken)).send({ reason: "Lost laptop", confirmName: "wrong" }).expect(400);
  await request(app).post(`${C}/devices/${d.id}/wipe`).set(auth(adminToken)).send({ reason: "Lost laptop", confirmName: d.name }).expect(200);
});

test("compromised account playbook runs every step", async () => {
  const users = (await request(app).get(`${C}/users`).set(auth(adminToken))).body;
  const victim = users.find((u) => u.riskLevel === "high");
  const res = await request(app).post(`${C}/playbooks/compromised-account/run`).set(auth(adminToken))
    .send({ targetId: victim.id, reason: "Impossible travel to Lagos" }).expect(200);
  expect(res.body.completed).toBe(true);
  expect(res.body.steps).toHaveLength(2);
});

test("alerts can be triaged", async () => {
  const alerts = (await request(app).get(`${C}/alerts`).set(auth(adminToken))).body;
  await request(app).patch(`${C}/alerts/${alerts[0].id}`).set(auth(adminToken)).send({ status: "inProgress", assignToMe: true }).expect(200);
  const after = (await request(app).get(`${C}/alerts`).set(auth(adminToken))).body;
  expect(after[0]).toMatchObject({ status: "inProgress", assignedTo: admin.email });
});

test("CSV export downloads", async () => {
  const res = await request(app).get(`${C}/export/devices`).set(auth(viewerToken)).expect(200);
  expect(res.headers["content-type"]).toMatch(/text\/csv/);
  expect(res.text).toContain("Device,OS");
});

test("only admins manage the team, and the last admin stays", async () => {
  await request(app).get("/api/team").set(auth(viewerToken)).expect(403);
  const team = (await request(app).get("/api/team").set(auth(adminToken))).body;
  const me = team.find((u) => u.email === admin.email);
  await request(app).patch(`/api/team/${me.id}`).set(auth(adminToken)).send({ role: "viewer" }).expect(400);
  const other = team.find((u) => u.email === viewer.email);
  await request(app).patch(`/api/team/${other.id}`).set(auth(adminToken)).send({ role: "analyst" }).expect(200);
});
