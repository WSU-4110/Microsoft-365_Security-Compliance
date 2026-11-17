// Strategy pattern: where the backend gets a tenant's data and sends its actions.
//
// SecurityDataSource = the strategy (base class every source must follow)
// GraphDataSource    = a real Microsoft 365 tenant through Microsoft Graph
// MockDataSource     = a made-up tenant built from a client profile (demo mode)

const { buildMockTenant } = require("./mockTenant");

const READS = [
  "getSecureScore", "getScoreHistory", "getMfaRegistration", "getGlobalAdmins",
  "getConditionalAccessPolicies", "getSecurityDefaults", "getUsers", "getManagedDevices",
  "getSignIns", "getAlerts", "getPhishingSimulations", "getLicenses",
];

class SecurityDataSource {
  // Actions
  async setAccountEnabled(_userId, _enabled) { throw new Error("setAccountEnabled() not implemented"); }
  async revokeSessions(_userId) { throw new Error("revokeSessions() not implemented"); }
  async deviceAction(_deviceId, _action) { throw new Error("deviceAction() not implemented"); }
  async updateAlert(_alertId, _changes) { throw new Error("updateAlert() not implemented"); }
}
// Every read method must be overridden by a concrete data source
READS.forEach((name) => {
  SecurityDataSource.prototype[name] = async function () {
    throw new Error(`${name}() not implemented`);
  };
});

const GLOBAL_ADMIN_ROLE_TEMPLATE_ID = "62e90394-69f5-4237-9190-012177145e10";
const DEVICE_ACTION_PATHS = {
  sync: { path: "syncDevice" },
  restart: { path: "rebootNow" },
  lock: { path: "remoteLock" },
  locate: { path: "locateDevice", beta: true },
  retire: { path: "retire" },
  wipe: { path: "wipe", body: { keepEnrollmentData: false, keepUserData: false } },
};
// List prices in USD per user per month, used to estimate unused license spend
const SKU_PRICES = {
  SPB: 22, SPE_E3: 36, SPE_E5: 57, ENTERPRISEPACK: 23, ENTERPRISEPREMIUM: 38,
  O365_BUSINESS_PREMIUM: 12.5, O365_BUSINESS_ESSENTIALS: 6, EXCHANGESTANDARD: 4, EXCHANGEENTERPRISE: 8,
};

class GraphDataSource extends SecurityDataSource {
  constructor(tenantId, clientId, clientSecret) {
    super();
    this.tenantId = tenantId;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.token = null;
    this.tokenExpires = 0;
  }

  async getToken() {
    if (this.token && Date.now() < this.tokenExpires - 60000) return this.token;
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    });
    const response = await fetch(`https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`, { method: "POST", body: params });
    const data = await response.json();
    if (!data.access_token) {
      throw new Error(`Could not get a Graph token: ${data.error_description || data.error || "unknown error"}`);
    }
    this.token = data.access_token;
    this.tokenExpires = Date.now() + data.expires_in * 1000;
    return this.token;
  }

  async graphRequest(method, path, body) {
    const token = await this.getToken();
    const url = path.startsWith("http") ? path : `https://graph.microsoft.com/v1.0${path}`;
    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 204 || response.status === 202) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.error ? data.error.message : `status ${response.status}`;
      throw new Error(`Graph ${method} ${path.split("?")[0]} failed: ${message}`);
    }
    return data;
  }

  async graphGet(path, all = false, maxItems = 5000) {
    if (!all) return this.graphRequest("GET", path);
    const items = [];
    let next = path;
    while (next && items.length < maxItems) {
      const data = await this.graphRequest("GET", next);
      items.push(...(data.value || []));
      next = data["@odata.nextLink"];
    }
    return items;
  }

  async getSecureScore() {
    const data = await this.graphGet("/security/secureScores?$top=1");
    const latest = (data.value || [])[0];
    if (!latest) throw new Error("No secure score returned from Graph");
    const categoryScores = {};
    for (const control of latest.controlScores || []) {
      const category = (control.controlCategory || "other").toLowerCase();
      categoryScores[category] = (categoryScores[category] || 0) + (control.score || 0);
    }
    return { currentScore: latest.currentScore, maxScore: latest.maxScore, categoryScores, lastUpdated: latest.createdDateTime };
  }

  async getScoreHistory() {
    const data = await this.graphGet("/security/secureScores?$top=90");
    return (data.value || [])
      .filter((_, i) => i % 7 === 0)
      .slice(0, 12)
      .reverse()
      .map((s) => ({ date: s.createdDateTime, score: s.currentScore, maxScore: s.maxScore }));
  }

  async getMfaRegistration() {
    const users = await this.graphGet("/reports/authenticationMethods/userRegistrationDetails", true);
    return users.map((u) => ({ id: u.id, name: u.userDisplayName, upn: u.userPrincipalName, isAdmin: Boolean(u.isAdmin), mfaRegistered: Boolean(u.isMfaRegistered) }));
  }

  async getGlobalAdmins() {
    const roles = await this.graphGet(`/directoryRoles?$filter=roleTemplateId eq '${GLOBAL_ADMIN_ROLE_TEMPLATE_ID}'`);
    const role = (roles.value || [])[0];
    if (!role) return [];
    const members = await this.graphGet(`/directoryRoles/${role.id}/members`, true);
    return members.map((m) => ({ name: m.displayName, upn: m.userPrincipalName || m.displayName }));
  }

  async getConditionalAccessPolicies() {
    const policies = await this.graphGet("/identity/conditionalAccess/policies", true);
    return policies.map((p) => ({
      name: p.displayName,
      state: p.state,
      includeUsers: (p.conditions && p.conditions.users && p.conditions.users.includeUsers) || [],
      clientAppTypes: (p.conditions && p.conditions.clientAppTypes) || [],
      grantControls: (p.grantControls && p.grantControls.builtInControls) || [],
      requiresAuthStrength: Boolean(p.grantControls && p.grantControls.authenticationStrength),
    }));
  }

  async getSecurityDefaults() {
    const data = await this.graphGet("/policies/identitySecurityDefaultsEnforcementPolicy");
    return { enabled: Boolean(data.isEnabled) };
  }

  async getUsers() {
    const [users, registration, risky] = await Promise.all([
      this.graphGet("/users?$select=id,displayName,userPrincipalName,accountEnabled,department,jobTitle,signInActivity&$top=999", true),
      this.getMfaRegistration().catch(() => []),
      this.graphGet("/identityProtection/riskyUsers?$filter=riskState eq 'atRisk'", true).catch(() => []),
    ]);
    const reg = new Map(registration.map((r) => [r.id, r]));
    const risk = new Map(risky.map((r) => [r.id, r]));
    return users.map((u) => ({
      id: u.id,
      name: u.displayName,
      upn: u.userPrincipalName,
      department: u.department || "",
      jobTitle: u.jobTitle || "",
      accountEnabled: u.accountEnabled !== false,
      isAdmin: reg.has(u.id) ? reg.get(u.id).isAdmin : false,
      mfaRegistered: reg.has(u.id) ? reg.get(u.id).mfaRegistered : null,
      lastSignIn: u.signInActivity ? u.signInActivity.lastSignInDateTime : null,
      riskLevel: risk.has(u.id) ? risk.get(u.id).riskLevel : "none",
      riskDetail: risk.has(u.id) ? risk.get(u.id).riskDetail : "",
    }));
  }

  async getManagedDevices() {
    const devices = await this.graphGet(
      "/deviceManagement/managedDevices?$select=id,deviceName,operatingSystem,osVersion,complianceState,userPrincipalName,userDisplayName,lastSyncDateTime,isEncrypted,model,serialNumber,managedDeviceOwnerType,enrolledDateTime",
      true
    );
    return devices.map((d) => ({
      id: d.id,
      name: d.deviceName,
      os: d.operatingSystem,
      osVersion: d.osVersion,
      outdated: /^10\.0\.19/.test(d.osVersion || ""),
      model: d.model,
      serial: d.serialNumber,
      ownership: d.managedDeviceOwnerType,
      owner: d.userPrincipalName,
      ownerName: d.userDisplayName,
      compliance: d.complianceState,
      complianceIssues: [],
      encrypted: Boolean(d.isEncrypted),
      defenderStatus: "",
      lastSync: d.lastSyncDateTime,
      enrolled: d.enrolledDateTime,
      location: null,
      state: "active",
    }));
  }

  async getSignIns() {
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const rows = await this.graphGet(`/auditLogs/signIns?$filter=createdDateTime ge ${since}&$top=1000`, true, 3000);
    return rows.map((s) => {
      const geo = (s.location && s.location.geoCoordinates) || {};
      return {
        id: s.id,
        time: s.createdDateTime,
        user: s.userPrincipalName,
        userName: s.userDisplayName,
        app: s.appDisplayName,
        clientApp: s.clientAppUsed,
        ip: s.ipAddress,
        city: s.location ? s.location.city : "",
        region: s.location ? s.location.state : "",
        country: s.location ? s.location.countryOrRegion : "",
        lat: geo.latitude,
        lon: geo.longitude,
        status: s.status && s.status.errorCode === 0 ? "success" : "failure",
        errorCode: s.status ? s.status.errorCode : null,
        failureReason: s.status ? s.status.failureReason : "",
        mfa: s.authenticationRequirement === "multiFactorAuthentication" ? "multifactor" : "single factor",
        risk: s.riskLevelDuringSignIn || "none",
        conditionalAccess: s.conditionalAccessStatus,
      };
    });
  }

  async getAlerts() {
    const rows = await this.graphGet("/security/alerts_v2?$top=100&$orderby=createdDateTime desc");
    return (rows.value || []).map((a) => {
      const evidence = a.evidence || [];
      const userEv = evidence.find((e) => e.userAccount);
      const deviceEv = evidence.find((e) => e.deviceDnsName);
      return {
        id: a.id,
        title: a.title,
        severity: a.severity,
        category: a.category,
        service: a.serviceSource,
        status: a.status,
        created: a.createdDateTime,
        updated: a.lastUpdateDateTime,
        assignedTo: a.assignedTo,
        user: userEv ? userEv.userAccount.userPrincipalName : null,
        device: deviceEv ? deviceEv.deviceDnsName : null,
        description: a.description,
        recommendation: a.recommendedActions,
      };
    });
  }

  async getPhishingSimulations() {
    const sims = await this.graphGet("/security/attackSimulation/simulations?$top=10");
    const recent = (sims.value || []).filter((s) => s.status === "succeeded" || s.status === "running").slice(0, 5);
    return Promise.all(recent.map(async (sim) => {
      const people = await this.graphGet(`/security/attackSimulation/simulations/${sim.id}/report/simulationUsers`, true);
      return {
        id: sim.id,
        name: sim.displayName,
        launched: sim.launchDateTime,
        status: sim.status === "succeeded" ? "completed" : sim.status,
        results: people.map((p) => {
          const events = (p.simulationEvents || []).map((e) => e.eventName || "");
          return {
            userId: p.simulationUser ? p.simulationUser.userId : null,
            name: p.simulationUser ? p.simulationUser.displayName : "Unknown",
            upn: p.simulationUser ? p.simulationUser.email : "",
            clicked: Boolean(p.isCompromised) || events.some((e) => /click/i.test(e)),
            submittedCredentials: events.some((e) => /credential/i.test(e)),
            reported: Boolean(p.reportedPhishDateTime),
          };
        }),
      };
    }));
  }

  async getLicenses() {
    const skus = await this.graphGet("/subscribedSkus", true);
    return skus
      .filter((s) => s.capabilityStatus === "Enabled" && s.prepaidUnits && s.prepaidUnits.enabled > 0)
      .map((s) => ({
        sku: s.skuPartNumber,
        name: s.skuPartNumber,
        prepaid: s.prepaidUnits.enabled,
        consumed: s.consumedUnits,
        pricePerMonth: SKU_PRICES[s.skuPartNumber] ?? null,
      }));
  }

  async setAccountEnabled(userId, enabled) {
    await this.graphRequest("PATCH", `/users/${encodeURIComponent(userId)}`, { accountEnabled: enabled });
  }

  async revokeSessions(userId) {
    await this.graphRequest("POST", `/users/${encodeURIComponent(userId)}/revokeSignInSessions`);
  }

  async deviceAction(deviceId, action) {
    const def = DEVICE_ACTION_PATHS[action];
    if (!def) throw new Error(`Unknown device action: ${action}`);
    const base = def.beta ? "https://graph.microsoft.com/beta" : "https://graph.microsoft.com/v1.0";
    await this.graphRequest("POST", `${base}/deviceManagement/managedDevices/${encodeURIComponent(deviceId)}/${def.path}`, def.body);
    return { queued: true };
  }

  async updateAlert(alertId, changes) {
    const body = {};
    if (changes.status) body.status = changes.status;
    if (changes.assignedTo !== undefined) body.assignedTo = changes.assignedTo;
    await this.graphRequest("PATCH", `/security/alerts_v2/${encodeURIComponent(alertId)}`, body);
  }
}

class MockDataSource extends SecurityDataSource {
  // profile: a client from data/clients.js. delayMs: pause per call so scans look like real jobs.
  constructor(profile, { delayMs = 0 } = {}) {
    super();
    this.profile = profile;
    this.delayMs = delayMs;
    this.tenant = buildMockTenant(profile);
  }

  async wait() {
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs * (0.6 + Math.random() * 0.8)));
  }

  copy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  async getSecureScore() {
    await this.wait();
    const latest = this.tenant.scoreHistory[this.tenant.scoreHistory.length - 1];
    return { currentScore: latest.score, maxScore: 100, categoryScores: {}, lastUpdated: latest.date };
  }

  async getScoreHistory() { return this.copy(this.tenant.scoreHistory); }

  async getMfaRegistration() {
    await this.wait();
    return this.tenant.users.map(({ id, name, upn, isAdmin, mfaRegistered }) => ({ id, name, upn, isAdmin, mfaRegistered }));
  }

  async getGlobalAdmins() { await this.wait(); return this.copy(this.tenant.globalAdmins); }
  async getConditionalAccessPolicies() { await this.wait(); return this.copy(this.tenant.conditionalAccess); }
  async getSecurityDefaults() { return { enabled: this.tenant.securityDefaults }; }
  async getUsers() { await this.wait(); return this.copy(this.tenant.users); }
  async getManagedDevices() { await this.wait(); return this.copy(this.tenant.devices.filter((d) => d.state === "active")); }
  async getSignIns() { await this.wait(); return this.copy(this.tenant.signIns); }
  async getAlerts() { await this.wait(); return this.copy(this.tenant.alerts); }
  async getPhishingSimulations() { await this.wait(); return this.copy(this.tenant.simulations); }
  async getLicenses() { await this.wait(); return this.copy(this.tenant.licenses); }

  find(list, id, label) {
    const item = list.find((x) => x.id === id);
    if (!item) throw new Error(`${label} ${id} not found`);
    return item;
  }

  async setAccountEnabled(userId, enabled) {
    this.find(this.tenant.users, userId, "User").accountEnabled = enabled;
  }

  async revokeSessions(userId) {
    this.find(this.tenant.users, userId, "User");
  }

  async deviceAction(deviceId, action) {
    const device = this.find(this.tenant.devices, deviceId, "Device");
    const now = new Date().toISOString();
    device.lastAction = { action, at: now };
    if (action === "sync") device.lastSync = now;
    if (action === "locate") {
      device.location = { ...device.location, at: now, source: "Intune Locate device" };
      return { location: device.location };
    }
    if (action === "retire" || action === "wipe") device.state = action === "wipe" ? "wiped" : "retired";
    if (!DEVICE_ACTION_PATHS[action]) throw new Error(`Unknown device action: ${action}`);
    return { queued: true };
  }

  async updateAlert(alertId, changes) {
    const alert = this.find(this.tenant.alerts, alertId, "Alert");
    Object.assign(alert, changes, { updated: new Date().toISOString() });
  }
}

class SecurityScoreService {
  constructor(dataSource) { this.dataSource = dataSource; }
  setDataSource(dataSource) { this.dataSource = dataSource; }
  async getSecureScore() { return this.dataSource.getSecureScore(); }
  async getScanHistory() { return this.dataSource.getScoreHistory(); }
}

module.exports = { SecurityDataSource, GraphDataSource, MockDataSource, SecurityScoreService, DEVICE_ACTION_PATHS };
