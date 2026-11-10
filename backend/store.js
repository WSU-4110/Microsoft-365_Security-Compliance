// Storage for app accounts, scans, and the activity log.
// PostgresStore is used when DATABASE_URL is set; otherwise MemoryStore keeps everything
// in memory (good for demos, but data is lost when the server stops).

function summarize(scan) {
  return {
    id: scan.id,
    clientId: scan.clientId,
    ranAt: scan.ranAt,
    trigger: scan.trigger,
    runBy: scan.runBy,
    dataSource: scan.dataSource,
    score: scan.score ? scan.score.current : null,
    maxScore: scan.score ? scan.score.max : null,
    compliance: scan.compliance ? scan.compliance.percent : null,
    openGaps: scan.gaps.length,
    highGaps: scan.gaps.filter((g) => g.severity === "High").length,
  };
}

class MemoryStore {
  constructor() {
    this.users = [];
    this.scans = [];
    this.actions = [];
  }

  async init() {}

  async countUsers() { return this.users.length; }

  async createUser(email, passwordHash, role) {
    const user = { id: this.users.length + 1, email, passwordHash, role, createdAt: new Date().toISOString() };
    this.users.push(user);
    return user;
  }

  async findUserByEmail(email) { return this.users.find((u) => u.email === email) || null; }

  async listUsers() { return this.users.map(({ passwordHash: _p, ...u }) => u); }

  async setRole(id, role) {
    const user = this.users.find((u) => u.id === Number(id));
    if (user) user.role = role;
    return Boolean(user);
  }

  async saveScan(clientId, userId, result) {
    const scan = { id: this.scans.length + 1, clientId, userId, ...result };
    this.scans.push(scan);
    return scan;
  }

  async listScans(clientId, limit = 20) {
    return this.scans.filter((s) => s.clientId === clientId).slice(-limit).reverse().map(summarize);
  }

  async getLatestScan(clientId) {
    const list = this.scans.filter((s) => s.clientId === clientId);
    return list[list.length - 1] || null;
  }

  async getScan(id) { return this.scans.find((s) => s.id === Number(id)) || null; }

  async logAction(entry) {
    const action = { id: this.actions.length + 1, at: new Date().toISOString(), ...entry };
    this.actions.push(action);
    return action;
  }

  async listActions({ clientId, limit = 200 } = {}) {
    return this.actions.filter((a) => !clientId || a.clientId === clientId).slice(-limit).reverse();
  }
}

class PostgresStore {
  constructor(connectionString) {
    const { Pool } = require("pg");
    this.pool = new Pool({ connectionString });
  }

  async init() {
    const fs = require("fs");
    const path = require("path");
    await this.pool.query(fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8"));
  }

  async countUsers() {
    const { rows } = await this.pool.query("SELECT COUNT(*)::int AS n FROM users");
    return rows[0].n;
  }

  async createUser(email, passwordHash, role) {
    const { rows } = await this.pool.query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role, created_at AS "createdAt"',
      [email, passwordHash, role]);
    return rows[0];
  }

  async findUserByEmail(email) {
    const { rows } = await this.pool.query('SELECT id, email, role, password_hash AS "passwordHash" FROM users WHERE email = $1', [email]);
    return rows[0] || null;
  }

  async listUsers() {
    const { rows } = await this.pool.query('SELECT id, email, role, created_at AS "createdAt" FROM users ORDER BY id');
    return rows;
  }

  async setRole(id, role) {
    const { rowCount } = await this.pool.query("UPDATE users SET role = $2 WHERE id = $1", [id, role]);
    return rowCount > 0;
  }

  async saveScan(clientId, userId, result) {
    const { rows } = await this.pool.query(
      `INSERT INTO scans (client_id, run_by, ran_at, data_source, score, max_score, compliance, open_gaps, high_gaps, result)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [clientId, userId, result.ranAt, result.dataSource,
        result.score ? result.score.current : null, result.score ? result.score.max : null,
        result.compliance ? result.compliance.percent : null, result.gaps.length,
        result.gaps.filter((g) => g.severity === "High").length, JSON.stringify(result)]);
    return { id: rows[0].id, clientId, userId, ...result };
  }

  async listScans(clientId, limit = 20) {
    const { rows } = await this.pool.query("SELECT id, client_id, result FROM scans WHERE client_id = $1 ORDER BY ran_at DESC LIMIT $2", [clientId, limit]);
    return rows.map((r) => summarize({ id: r.id, clientId: r.client_id, ...r.result }));
  }

  async getLatestScan(clientId) {
    const { rows } = await this.pool.query("SELECT id, client_id, result FROM scans WHERE client_id = $1 ORDER BY ran_at DESC LIMIT 1", [clientId]);
    return rows[0] ? { id: rows[0].id, clientId: rows[0].client_id, ...rows[0].result } : null;
  }

  async getScan(id) {
    const { rows } = await this.pool.query("SELECT id, client_id, result FROM scans WHERE id = $1", [id]);
    return rows[0] ? { id: rows[0].id, clientId: rows[0].client_id, ...rows[0].result } : null;
  }

  async logAction(e) {
    const { rows } = await this.pool.query(
      `INSERT INTO actions (client_id, performed_by, action, target_type, target_id, target_name, reason, result, error, playbook)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, at`,
      [e.clientId, e.performedBy, e.action, e.targetType, e.targetId, e.targetName, e.reason, e.result, e.error || null, e.playbook || null]);
    return { id: rows[0].id, at: rows[0].at, ...e };
  }

  async listActions({ clientId, limit = 200 } = {}) {
    const { rows } = await this.pool.query(
      `SELECT id, at, client_id AS "clientId", performed_by AS "performedBy", action, target_type AS "targetType",
              target_id AS "targetId", target_name AS "targetName", reason, result, error, playbook
       FROM actions WHERE ($1::text IS NULL OR client_id = $1) ORDER BY at DESC LIMIT $2`,
      [clientId || null, limit]);
    return rows;
  }
}

function createStore() {
  return process.env.DATABASE_URL ? new PostgresStore(process.env.DATABASE_URL) : new MemoryStore();
}

module.exports = { createStore, MemoryStore, PostgresStore, summarize };
