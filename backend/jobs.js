// Runs scans as background jobs and on a schedule for every client.

const { runScan } = require("./scanService");

class ScanJobs {
  constructor({ registry, store, intervalHours = 24 }) {
    this.registry = registry;
    this.store = store;
    this.intervalHours = intervalHours;
    this.jobs = new Map();
    this.nextId = 1;
    this.timer = null;
    this.nextRunAt = null;
  }

  // Starts a scan for one client, or returns the one already running
  start(clientId, startedBy, userId = null) {
    const running = [...this.jobs.values()].find((j) => j.clientId === clientId && j.status === "running");
    if (running) return running;

    const client = this.registry.get(clientId);
    if (!client) throw new Error(`Unknown client: ${clientId}`);

    const job = {
      id: this.nextId++,
      clientId,
      clientName: client.profile.name,
      status: "running",
      startedAt: new Date().toISOString(),
      startedBy,
      checks: [],
      scanId: null,
      error: null,
    };
    this.jobs.set(job.id, job);

    job.promise = runScan(client.dataSource, (checks) => { job.checks = checks; })
      .then((result) => this.store.saveScan(clientId, userId, { ...result, trigger: startedBy === "Scheduler" ? "scheduled" : "manual", runBy: startedBy }))
      .then((scan) => {
        job.status = "completed";
        job.scanId = scan.id;
        job.finishedAt = new Date().toISOString();
      })
      .catch((error) => {
        job.status = "failed";
        job.error = error.message;
      });
    return job;
  }

  get(id) {
    const job = this.jobs.get(Number(id));
    if (!job) return null;
    const { promise: _p, ...rest } = job;
    return rest;
  }

  running() {
    return [...this.jobs.values()].filter((j) => j.status === "running").map((j) => this.get(j.id));
  }

  async scanAll(startedBy = "Scheduler") {
    const jobs = this.registry.clients.map((c) => this.start(c.profile.id, startedBy));
    await Promise.all(jobs.map((j) => j.promise));
  }

  startSchedule() {
    const ms = this.intervalHours * 3600000;
    this.nextRunAt = new Date(Date.now() + ms).toISOString();
    this.timer = setInterval(() => {
      this.nextRunAt = new Date(Date.now() + ms).toISOString();
      this.scanAll().catch((e) => console.error("Scheduled scan failed:", e.message));
    }, ms);
    this.timer.unref();
  }
}

module.exports = { ScanJobs };
