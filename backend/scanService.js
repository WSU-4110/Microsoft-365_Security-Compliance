// The security scan. Checks run in order and report progress. Problems become
// "gaps", and the collected facts are scored against CIS Controls v8 safeguards.
// If one check fails (for example, a missing license or permission), the rest still run.

const { findImpossibleTravel } = require("./geo");

const SEVERITY_ORDER = { High: 0, Medium: 1, Low: 2 };
const DAY = 86400000;

const CHECKS = [
  { id: "secure-score", name: "Secure Score", area: "Posture" },
  { id: "mfa-registration", name: "MFA registration", area: "Identity" },
  { id: "global-admins", name: "Global Admins", area: "Identity" },
  { id: "mfa-policy", name: "MFA enforcement", area: "Identity" },
  { id: "legacy-auth", name: "Legacy authentication", area: "Identity" },
  { id: "inactive-accounts", name: "Inactive accounts", area: "Identity" },
  { id: "risky-users", name: "Risky users", area: "Identity" },
  { id: "suspicious-signins", name: "Suspicious sign-ins", area: "Threats" },
  { id: "alerts", name: "Open alerts", area: "Threats" },
  { id: "device-compliance", name: "Device compliance", area: "Devices" },
  { id: "device-os", name: "Operating systems", area: "Devices" },
  { id: "phishing", name: "Phishing resilience", area: "Email" },
  { id: "licenses", name: "License hygiene", area: "Cost" },
];

const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

function policyRequiresMfaForAll(p) {
  return p.state === "enabled" && p.includeUsers.includes("All") && (p.grantControls.includes("mfa") || p.requiresAuthStrength);
}
function policyBlocksLegacyAuth(p) {
  return p.state === "enabled" && p.grantControls.includes("block") &&
    (p.clientAppTypes.includes("exchangeActiveSync") || p.clientAppTypes.includes("other"));
}
function policyRequiresMfaForAdmins(p) {
  return p.state === "enabled" && (p.grantControls.includes("mfa") || p.requiresAuthStrength) &&
    (p.includeUsers.includes("All") || (p.includeRoles || []).length > 0);
}

// Finds bursts of failed sign-ins from one IP against several different accounts
function findPasswordSpray(signIns) {
  const byIp = new Map();
  signIns.filter((s) => s.status === "failure" && s.errorCode === 50126).forEach((s) => {
    if (!byIp.has(s.ip)) byIp.set(s.ip, []);
    byIp.get(s.ip).push(s);
  });
  return [...byIp].filter(([, list]) => new Set(list.map((s) => s.user)).size >= 5)
    .map(([ip, list]) => ({ ip, attempts: list.length, accounts: new Set(list.map((s) => s.user)).size, city: list[0].city, country: list[0].country }));
}

function cached(dataSource) {
  const cache = new Map();
  return (method) => {
    if (!cache.has(method)) cache.set(method, dataSource[method]());
    return cache.get(method);
  };
}

function gap(title, severity, fixInstruction, affected = []) {
  return { title, severity, fixInstruction, affected };
}

function buildChecks(get, facts) {
  return {
    "secure-score": async () => {
      const s = await get("getSecureScore");
      const p = pct(s.currentScore, s.maxScore);
      facts.score = { current: s.currentScore, max: s.maxScore, percent: p };
      facts.scoreHistory = await get("getScoreHistory").catch(() => []);
      return {
        detail: `${s.currentScore} of ${s.maxScore} points (${p}%)`,
        gaps: p < 50 ? [gap("Secure Score is below 50%", "Medium", "Open the Secure Score page in the Microsoft Defender portal and work through the recommended actions with the highest score impact first.")] : [],
      };
    },

    "mfa-registration": async () => {
      const users = await get("getMfaRegistration");
      const registered = users.filter((u) => u.mfaRegistered).length;
      const adminsWithout = users.filter((u) => u.isAdmin && !u.mfaRegistered);
      const usersWithout = users.filter((u) => !u.isAdmin && !u.mfaRegistered);
      facts.mfa = { totalUsers: users.length, registered, percent: pct(registered, users.length), adminsWithout: adminsWithout.length };
      const gaps = [];
      if (adminsWithout.length) gaps.push(gap(`${adminsWithout.length} admin account(s) have not registered MFA`, "High",
        "Ask these admins to register MFA at https://aka.ms/mfasetup today, then require MFA for admin roles with Conditional Access.", adminsWithout.map((u) => u.upn)));
      if (usersWithout.length) gaps.push(gap(`${usersWithout.length} user(s) have not registered MFA`, "Medium",
        "Turn on an MFA registration campaign in the Entra admin center under Authentication methods, or send users to https://aka.ms/mfasetup.", usersWithout.map((u) => u.upn)));
      return { detail: `${registered} of ${users.length} users registered (${pct(registered, users.length)}%)`, gaps };
    },

    "global-admins": async () => {
      const admins = await get("getGlobalAdmins");
      facts.globalAdminCount = admins.length;
      const gaps = [];
      if (admins.length > 4) gaps.push(gap(`Too many Global Administrators (${admins.length})`, "Medium",
        "Keep 2 to 4 Global Admins. Move everyone else to least-privilege roles such as User Administrator or Helpdesk Administrator.", admins.map((a) => a.upn)));
      else if (admins.length < 2) gaps.push(gap("Only one Global Administrator", "Low",
        "Add a second Global Admin or an emergency access account so the organization can't get locked out.", admins.map((a) => a.upn)));
      return { detail: `${admins.length} Global Administrator(s)`, gaps };
    },

    "mfa-policy": async () => {
      const [defaults, policies] = await Promise.all([get("getSecurityDefaults"), get("getConditionalAccessPolicies")]);
      const all = policies.find(policyRequiresMfaForAll);
      const admins = policies.find(policyRequiresMfaForAdmins);
      facts.policies = { securityDefaults: defaults.enabled, mfaAll: Boolean(defaults.enabled || all), mfaAdmins: Boolean(defaults.enabled || all || admins), count: policies.length };
      const gaps = facts.policies.mfaAll ? [] : [gap("MFA is not enforced for all users", "High",
        "Create a Conditional Access policy for All users that requires multifactor authentication (start in report-only mode for a week), or turn on security defaults.")];
      const detail = defaults.enabled ? "Security defaults are on" : all ? `Enforced by "${all.name}"` : admins ? "Enforced for admins only" : "Not enforced";
      return { detail, gaps };
    },

    "legacy-auth": async () => {
      const [defaults, policies, signIns] = await Promise.all([get("getSecurityDefaults"), get("getConditionalAccessPolicies"), get("getSignIns").catch(() => [])]);
      const block = policies.find(policyBlocksLegacyAuth);
      const reportOnly = policies.find((p) => p.state === "enabledForReportingButNotEnforced" && p.grantControls.includes("block"));
      const legacyUses = signIns.filter((s) => ["Exchange ActiveSync", "Other clients", "IMAP", "POP", "SMTP"].includes(s.clientApp));
      facts.policies = { ...(facts.policies || {}), legacyBlocked: Boolean(defaults.enabled || block) };
      const gaps = defaults.enabled || block ? [] : [gap(
        legacyUses.length ? `Legacy authentication is allowed and was used ${legacyUses.length} time(s) this week` : "Legacy authentication is not blocked",
        legacyUses.length ? "High" : "Medium",
        reportOnly ? `The policy "${reportOnly.name}" is in report-only mode. Switch it to On to start blocking legacy sign-ins.`
          : "Create a Conditional Access policy for All users that blocks the client apps Exchange ActiveSync and Other clients.",
        [...new Set(legacyUses.map((s) => s.user))])];
      const detail = defaults.enabled ? "Security defaults are on" : block ? `Blocked by "${block.name}"` : reportOnly ? "Policy in report-only mode" : "Not blocked";
      return { detail, gaps };
    },

    "inactive-accounts": async () => {
      const users = await get("getUsers");
      const cutoff = Date.now() - 90 * DAY;
      const inactive = users.filter((u) => u.accountEnabled && u.lastSignIn && new Date(u.lastSignIn).getTime() < cutoff);
      facts.users = { total: users.length, enabled: users.filter((u) => u.accountEnabled).length, disabled: users.filter((u) => !u.accountEnabled).length, inactive: inactive.length, admins: users.filter((u) => u.isAdmin).length };
      return {
        detail: `${users.length} users scanned, ${inactive.length} inactive 90+ days`,
        gaps: inactive.length ? [gap(`${inactive.length} enabled account(s) haven't signed in for 90+ days`, "Medium",
          "Confirm with each manager whether these accounts are still needed, then disable them from the Identity page or run the Offboard employee playbook.", inactive.map((u) => u.upn))] : [],
      };
    },

    "risky-users": async () => {
      const users = await get("getUsers");
      const risky = users.filter((u) => u.accountEnabled && ["high", "medium"].includes(u.riskLevel));
      const high = risky.filter((u) => u.riskLevel === "high");
      facts.risky = { high: high.length, medium: risky.length - high.length };
      const gaps = [];
      if (high.length) gaps.push(gap(`${high.length} user(s) at high risk of compromise`, "High",
        "Run the Compromised account playbook for each user: sign out everywhere, disable the account, and reset the password before re-enabling.", high.map((u) => u.upn)));
      if (risky.length - high.length) gaps.push(gap(`${risky.length - high.length} user(s) at medium risk`, "Medium",
        "Review the risk detections in Entra ID Protection and confirm the activity with each user.", risky.filter((u) => u.riskLevel === "medium").map((u) => u.upn)));
      return { detail: risky.length ? `${high.length} high, ${risky.length - high.length} medium risk` : "No users at risk", gaps };
    },

    "suspicious-signins": async () => {
      const signIns = await get("getSignIns");
      const travel = findImpossibleTravel(signIns);
      const spray = findPasswordSpray(signIns);
      const failures = signIns.filter((s) => s.status === "failure").length;
      const countries = new Set(signIns.filter((s) => s.status === "success").map((s) => s.country)).size;
      facts.signIns = { total: signIns.length, failures, impossibleTravel: travel.length, sprayIps: spray.length, countries };
      const gaps = [];
      if (travel.length) gaps.push(gap(`Impossible travel detected for ${travel.length} user(s)`, "High",
        "Treat these accounts as compromised: run the Compromised account playbook and review mailbox rules and recent file access.",
        travel.map((t) => `${t.user}: ${t.from.city} to ${t.to.city} in ${t.hours} h (${t.speedKmh.toLocaleString()} km/h)`)));
      if (spray.length) gaps.push(gap(`Password spray from ${spray.length} IP address(es)`, "High",
        "Block the source IPs with a named location in Conditional Access, block legacy authentication, and confirm every targeted account has MFA.",
        spray.map((s) => `${s.ip} (${s.city}, ${s.country}): ${s.attempts} attempts on ${s.accounts} accounts`)));
      return { detail: `${signIns.length} sign-ins in 7 days, ${failures} failed, ${countries} countries`, gaps };
    },

    alerts: async () => {
      const alerts = await get("getAlerts");
      const open = alerts.filter((a) => a.status !== "resolved");
      const highOpen = open.filter((a) => a.severity === "high");
      const untriaged = open.filter((a) => a.status === "new" && Date.now() - new Date(a.created) > DAY);
      facts.alerts = { open: open.length, highOpen: highOpen.length, untriaged: untriaged.length, total: alerts.length };
      const gaps = [];
      if (highOpen.length) gaps.push(gap(`${highOpen.length} high-severity alert(s) are open`, "High",
        "Triage these on the Alerts page now. Each alert includes the recommended response.", highOpen.map((a) => a.title)));
      if (untriaged.length) gaps.push(gap(`${untriaged.length} alert(s) untriaged for over 24 hours`, "Medium",
        "Assign every new alert within 24 hours to meet the service-level agreement.", untriaged.map((a) => a.title)));
      return { detail: `${open.length} open (${highOpen.length} high)`, gaps };
    },

    "device-compliance": async () => {
      const devices = await get("getManagedDevices");
      const compliant = devices.filter((d) => d.compliance === "compliant").length;
      const noncompliant = devices.filter((d) => d.compliance === "noncompliant");
      const unencrypted = devices.filter((d) => !d.encrypted);
      const stale = devices.filter((d) => d.lastSync && Date.now() - new Date(d.lastSync).getTime() > 30 * DAY);
      const defenderDown = devices.filter((d) => d.defenderStatus && d.defenderStatus !== "Active");
      facts.devices = { total: devices.length, compliant, compliantPercent: pct(compliant, devices.length), unencrypted: unencrypted.length, stale: stale.length, defenderDown: defenderDown.length, defenderKnown: devices.some((d) => d.defenderStatus) };
      const label = (d) => `${d.name} (${d.owner})`;
      const gaps = [];
      if (noncompliant.length) gaps.push(gap(`${noncompliant.length} device(s) are not compliant`, "High",
        "Open each device on the Devices page to see which setting fails. Require compliant devices with Conditional Access so noncompliant devices can't reach company data.", noncompliant.map(label)));
      if (unencrypted.length) gaps.push(gap(`${unencrypted.length} device(s) are not encrypted`, "Medium",
        "Deploy an Intune disk encryption policy (BitLocker for Windows, FileVault for macOS) and require encryption in mobile compliance policies.", unencrypted.map(label)));
      if (defenderDown.length) gaps.push(gap(`${defenderDown.length} device(s) have out-of-date antivirus`, "Medium",
        "Sync these devices from the Devices page and check Microsoft Defender updates.", defenderDown.map(label)));
      if (stale.length) gaps.push(gap(`${stale.length} device(s) haven't checked in for 30+ days`, "Low",
        "Confirm the devices are still in use. Retire lost or replaced devices so they lose access to company data.", stale.map(label)));
      return { detail: `${devices.length} devices, ${pct(compliant, devices.length)}% compliant`, gaps };
    },

    "device-os": async () => {
      const devices = await get("getManagedDevices");
      const outdated = devices.filter((d) => d.outdated);
      const win10 = outdated.filter((d) => d.os === "Windows" && /Windows 10|10\.0\.19/.test(d.osVersion));
      facts.os = { outdated: outdated.length, windows10: win10.length, percentCurrent: pct(devices.length - outdated.length, devices.length) };
      const gaps = [];
      if (win10.length) gaps.push(gap(`${win10.length} PC(s) still run Windows 10, which reached end of support in October 2025`, "High",
        "Upgrade these PCs to Windows 11 with an Intune feature update policy, or replace hardware that can't run it. Until then, enroll them in Extended Security Updates.", win10.map((d) => `${d.name} (${d.owner})`)));
      const otherOld = outdated.filter((d) => !win10.includes(d));
      if (otherOld.length) gaps.push(gap(`${otherOld.length} device(s) run an outdated OS version`, "Medium",
        "Set minimum OS versions in Intune compliance policies and push updates with update rings.", otherOld.map((d) => `${d.name}: ${d.os} ${d.osVersion}`)));
      return { detail: `${pct(devices.length - outdated.length, devices.length)}% on a current OS`, gaps };
    },

    phishing: async () => {
      const sims = await get("getPhishingSimulations");
      if (!sims.length) { facts.phishing = null; return { detail: "No simulations found", gaps: [] }; }
      const latest = [...sims].sort((a, b) => new Date(b.launched) - new Date(a.launched))[0];
      const clicked = latest.results.filter((r) => r.clicked);
      const creds = latest.results.filter((r) => r.submittedCredentials);
      const counts = new Map();
      sims.forEach((s) => s.results.filter((r) => r.clicked).forEach((r) => counts.set(r.upn, (counts.get(r.upn) || 0) + 1)));
      const repeat = [...counts].filter(([, n]) => n >= 2).map(([u]) => u);
      const rate = pct(clicked.length, latest.results.length);
      facts.phishing = { latestName: latest.name, targeted: latest.results.length, clicked: clicked.length, clickRate: rate, credentials: creds.length, reported: latest.results.filter((r) => r.reported).length, repeatClickers: repeat.length };
      const gaps = [];
      if (creds.length) gaps.push(gap(`${creds.length} user(s) entered their password on a simulated phishing page`, "High",
        "Make sure these users have MFA, sign them out everywhere, and assign the Credential harvesting training module.", creds.map((r) => r.upn)));
      if (repeat.length) gaps.push(gap(`${repeat.length} repeat clicker(s) across simulations`, "Medium",
        "Assign additional training and include these users in every monthly simulation.", repeat));
      if (rate > 10) gaps.push(gap(`Phishing click rate is ${rate}% (target: under 10%)`, "Low",
        "Keep running monthly simulations with training until the click rate stays under 10%."));
      return { detail: `${rate}% clicked "${latest.name}"`, gaps };
    },

    licenses: async () => {
      const [licenses, users] = await Promise.all([get("getLicenses"), get("getUsers")]);
      const unused = licenses.reduce((n, l) => n + Math.max(0, l.prepaid - l.consumed), 0);
      const waste = licenses.reduce((sum, l) => sum + Math.max(0, l.prepaid - l.consumed) * (l.pricePerMonth || 0), 0);
      const disabled = users.filter((u) => !u.accountEnabled);
      facts.licenses = { total: licenses.reduce((n, l) => n + l.prepaid, 0), unused, monthlyWaste: Math.round(waste), disabledAccounts: disabled.length };
      const gaps = [];
      if (waste >= 50) gaps.push(gap(`${unused} unused license(s), about $${Math.round(waste).toLocaleString()} per month`, "Low",
        "Reduce the license count at the next renewal, or assign them to new hires before buying more."));
      return { detail: `${unused} unused, ~$${Math.round(waste).toLocaleString()}/month`, gaps };
    },
  };
}

// Scores the scan's facts against CIS Controls v8 safeguards (Implementation Group 1 and 2)
function evaluateControls(f) {
  const has = (x) => x !== undefined && x !== null;
  const c = (id, ig, title, pass, evidence) => ({ id, ig, title, status: pass === null ? "unknown" : pass ? "pass" : "fail", evidence });
  return [
    c("1.1", "IG1", "Maintain a detailed enterprise asset inventory", has(f.devices) ? f.devices.stale <= Math.ceil(f.devices.total * 0.05) : null,
      has(f.devices) ? `${f.devices.total} devices managed, ${f.devices.stale} not seen in 30+ days` : "Device data unavailable"),
    c("3.6", "IG1", "Encrypt data on end-user devices", has(f.devices) ? f.devices.unencrypted === 0 : null,
      has(f.devices) ? `${f.devices.unencrypted} unencrypted device(s)` : "Device data unavailable"),
    c("4.1", "IG1", "Establish and maintain a secure configuration process", has(f.devices) ? f.devices.compliantPercent >= 90 : null,
      has(f.devices) ? `${f.devices.compliantPercent}% of devices meet compliance policies` : "Device data unavailable"),
    c("5.3", "IG1", "Disable dormant accounts", has(f.users) ? f.users.inactive === 0 : null,
      has(f.users) ? `${f.users.inactive} enabled account(s) inactive 90+ days` : "User data unavailable"),
    c("5.4", "IG1", "Restrict administrator privileges", has(f.globalAdminCount) ? f.globalAdminCount <= 4 && f.globalAdminCount >= 2 : null,
      has(f.globalAdminCount) ? `${f.globalAdminCount} Global Administrators (target: 2 to 4)` : "Admin data unavailable"),
    c("6.3", "IG1", "Require MFA for externally-exposed applications", has(f.policies) && has(f.policies.mfaAll) ? f.policies.mfaAll : null,
      has(f.policies) ? (f.policies.mfaAll ? "MFA enforced for all users" : "MFA not enforced for all users") : "Policy data unavailable"),
    c("6.5", "IG1", "Require MFA for administrative access", has(f.policies) && has(f.mfa) ? f.policies.mfaAdmins && f.mfa.adminsWithout === 0 : null,
      has(f.mfa) ? `${f.mfa.adminsWithout} admin(s) without MFA` : "MFA data unavailable"),
    c("6.4", "IG2", "Block legacy authentication protocols", has(f.policies) && has(f.policies.legacyBlocked) ? f.policies.legacyBlocked : null,
      has(f.policies) ? (f.policies.legacyBlocked ? "Legacy authentication blocked" : "Legacy authentication allowed") : "Policy data unavailable"),
    c("7.3", "IG1", "Perform automated operating system patch management", has(f.os) ? f.os.percentCurrent >= 95 : null,
      has(f.os) ? `${f.os.percentCurrent}% of devices on a current OS` : "Device data unavailable"),
    c("10.1", "IG1", "Deploy and maintain anti-malware software", has(f.devices) && f.devices.defenderKnown ? f.devices.defenderDown === 0 : null,
      has(f.devices) && f.devices.defenderKnown ? `${f.devices.defenderDown} device(s) with out-of-date antivirus` : "Defender status unavailable"),
    c("13.1", "IG2", "Centralize security event alerting and triage", has(f.alerts) ? f.alerts.untriaged === 0 : null,
      has(f.alerts) ? `${f.alerts.untriaged} alert(s) untriaged for 24+ hours` : "Alert data unavailable"),
    c("14.2", "IG1", "Train workforce to recognize social engineering", has(f.phishing) ? f.phishing.clickRate <= 10 : null,
      has(f.phishing) ? `${f.phishing.clickRate}% click rate in the latest simulation` : "No phishing simulations"),
  ];
}

async function runScan(dataSource, onProgress = () => {}) {
  const facts = {};
  const get = cached(dataSource);
  const runners = buildChecks(get, facts);
  const checks = CHECKS.map((c) => ({ ...c, status: "queued", detail: "", gaps: [] }));
  const report = () => onProgress(checks.map(({ gaps: _g, ...c }) => ({ ...c })));

  for (const check of checks) {
    check.status = "running";
    report();
    try {
      const result = await runners[check.id]();
      check.gaps = result.gaps;
      check.detail = result.detail;
      check.status = result.gaps.length ? "fail" : "pass";
    } catch (error) {
      check.status = "error";
      check.detail = error.message;
    }
    report();
  }

  let n = 0;
  const gaps = checks
    .flatMap((check) => check.gaps.map((g) => ({ ...g, checkId: check.id, area: check.area })))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .map((g) => ({ id: ++n, status: "Open", ...g }));

  const controls = evaluateControls(facts);
  const scored = controls.filter((c) => c.status !== "unknown");
  const compliancePercent = pct(scored.filter((c) => c.status === "pass").length, scored.length);

  return {
    ranAt: new Date().toISOString(),
    dataSource: dataSource.constructor.name,
    score: facts.score || null,
    scoreHistory: facts.scoreHistory || [],
    mfa: facts.mfa || null,
    globalAdminCount: facts.globalAdminCount ?? null,
    users: facts.users || null,
    risky: facts.risky || null,
    signIns: facts.signIns || null,
    alerts: facts.alerts || null,
    devices: facts.devices || null,
    os: facts.os || null,
    phishing: facts.phishing || null,
    licenses: facts.licenses || null,
    policies: facts.policies || null,
    compliance: { percent: compliancePercent, passed: scored.filter((c) => c.status === "pass").length, total: scored.length, controls },
    checks: checks.map(({ gaps: _g, ...c }) => c),
    gaps,
  };
}

module.exports = { runScan, CHECKS, evaluateControls, findPasswordSpray, policyRequiresMfaForAll, policyBlocksLegacyAuth };
