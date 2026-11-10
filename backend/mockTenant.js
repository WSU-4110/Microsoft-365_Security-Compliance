// Builds a made-up Microsoft 365 tenant from a client profile (see data/clients.js).
// A seeded random generator keeps each client's data the same every time the server starts.

const { PLACES } = require("./data/clients");

const HOUR = 3600000;
const DAY = 24 * HOUR;

function seededRandom(text) {
  let s = [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Alex", "Sam", "Priya", "Jordan", "Maria", "Chris", "Fatima", "Daniel", "Aisha", "Kevin",
  "Lena", "Omar", "Grace", "Marcus", "Sofia", "Ethan", "Nadia", "Tyler", "Yuki", "Carlos", "Hannah",
  "Ibrahim", "Olivia", "Ravi", "Emma", "Jamal", "Chloe", "Victor", "Zoe", "Hassan", "Megan", "Luis",
  "Amira", "Ryan", "Julia", "Mateo", "Leila", "Noah", "Elena", "Samir", "Brian", "Rosa", "Derek",
  "Mei", "Patrick", "Tasha", "Andre", "Ingrid", "Kofi", "Holly", "Diego", "Anya", "Walter", "Nora"];
const LAST = ["Rivera", "Lee", "Shah", "Kim", "Lopez", "Green", "Haddad", "Nguyen", "Khan", "Brown",
  "Fischer", "Saleh", "Owens", "Bell", "Rossi", "Clark", "Mansour", "Reed", "Tanaka", "Diaz", "Weber",
  "Aziz", "Hughes", "Patel", "Novak", "Price", "Martin", "Cruz", "Adams", "Farah", "Hayes", "Ortiz",
  "Nasser", "Cole", "Meyer", "Silva", "Karimi", "Ward", "Popov", "Yousef", "Grant", "Duncan", "Moreau",
  "Lindqvist", "Okafor", "Brennan", "Sato", "Kowalski", "Murphy", "Herrera", "Becker", "Ali", "Foster"];

const DEPARTMENTS = {
  Healthcare: ["Clinical", "Front Desk", "Billing", "Hygiene", "Administration"],
  "Financial services": ["Member Services", "Lending", "Finance", "Compliance", "Operations"],
  Manufacturing: ["Production", "Engineering", "Quality", "Purchasing", "Shipping", "Office"],
  Legal: ["Litigation", "Corporate", "Paralegal", "Billing", "Administration"],
  "Transportation & logistics": ["Dispatch", "Fleet", "Warehouse", "Sales", "Accounting"],
};

const DEVICE_MODELS = {
  Windows: ["Dell Latitude 5440", "Lenovo ThinkPad T14", "HP EliteBook 840 G10", "Surface Laptop 6", "Dell OptiPlex 7010"],
  macOS: ["MacBook Air (M3)", "MacBook Pro 14 (M3)"],
  iOS: ["iPhone 15", "iPhone 14", "iPad (10th gen)"],
  Android: ["Galaxy S24", "Pixel 8", "Zebra TC52"],
};
const OS_VERSIONS = {
  Windows: { current: "10.0.26100 (Windows 11 24H2)", outdated: "10.0.19045 (Windows 10 22H2)" },
  macOS: { current: "15.6", outdated: "13.6" },
  iOS: { current: "18.6", outdated: "16.7" },
  Android: { current: "15", outdated: "12" },
};

const ALERT_TEMPLATES = {
  impossibleTravel: { title: "Impossible travel activity", severity: "high", category: "InitialAccess", service: "Microsoft Defender for Cloud Apps", target: "user" },
  inboxRule: { title: "Suspicious inbox forwarding rule", severity: "high", category: "Exfiltration", service: "Microsoft Defender for Office 365", target: "user" },
  passwordSpray: { title: "Password spray attack", severity: "high", category: "CredentialAccess", service: "Microsoft Entra ID Protection", target: "tenant" },
  maliciousUrlClick: { title: "A potentially malicious URL click was detected", severity: "high", category: "InitialAccess", service: "Microsoft Defender for Office 365", target: "user" },
  emailRemoved: { title: "Email messages containing malicious URL removed after delivery", severity: "informational", category: "InitialAccess", service: "Microsoft Defender for Office 365", target: "user" },
  malware: { title: "Malware detected and quarantined", severity: "medium", category: "Malware", service: "Microsoft Defender for Endpoint", target: "device" },
  anonymousIp: { title: "Sign-in from an anonymous IP address", severity: "medium", category: "InitialAccess", service: "Microsoft Entra ID Protection", target: "user" },
  massDownload: { title: "Mass download by a single user", severity: "medium", category: "Exfiltration", service: "Microsoft Defender for Cloud Apps", target: "user" },
};

const APPS = ["Outlook", "Microsoft Teams", "SharePoint Online", "OneDrive", "Office 365 Exchange Online", "Microsoft 365 Copilot"];

function ago(ms) {
  return new Date(Date.now() - ms).toISOString();
}

function buildMockTenant(profile) {
  const rand = seededRandom(profile.id);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const jitter = (place, km) => ({
    ...place,
    lat: +(place.lat + (rand() - 0.5) * (km / 55)).toFixed(4),
    lon: +(place.lon + (rand() - 0.5) * (km / 40)).toFixed(4),
  });
  const ip = (block) => `${block}.${1 + Math.floor(rand() * 250)}`;
  const officeIp = `192.0.2`;

  /* ---------- Users ---------- */
  const used = new Set();
  const departments = DEPARTMENTS[profile.industry];
  const users = [];
  for (let i = 0; i < profile.userCount; i++) {
    let first, last;
    do { first = pick(FIRST); last = pick(LAST); } while (used.has(first + last));
    used.add(first + last);
    const isAdmin = i < profile.adminCount;
    const office = profile.offices[i % profile.offices.length];
    const remote = rand() < profile.remoteRate;
    users.push({
      id: `${profile.id}-u${String(i + 1).padStart(3, "0")}`,
      name: `${first} ${last}`,
      upn: `${first}.${last}@${profile.domain}`.toLowerCase(),
      department: isAdmin ? "IT" : pick(departments),
      jobTitle: isAdmin ? pick(["IT Manager", "Systems Administrator", "IT Support"]) : "",
      isAdmin,
      accountEnabled: true,
      mfaRegistered: isAdmin ? rand() < Math.min(1, profile.mfaRate + 0.15) : rand() < profile.mfaRate,
      lastSignIn: ago(Math.floor(rand() * 4 * DAY)),
      riskLevel: "none",
      riskDetail: "",
      home: remote ? pick(PLACES.remote) : office,
    });
  }
  // Inactive, disabled, and risky accounts come from the end of the list
  users.slice(-profile.inactive).forEach((u) => { u.lastSignIn = ago((95 + Math.floor(rand() * 150)) * DAY); });
  users.slice(-(profile.inactive + profile.disabled), -profile.inactive || undefined)
    .forEach((u) => { u.accountEnabled = false; u.lastSignIn = ago((30 + Math.floor(rand() * 60)) * DAY); });
  const regular = users.filter((u) => !u.isAdmin && u.accountEnabled);
  const riskyUsers = regular.slice(2, 2 + profile.risky);
  riskyUsers.forEach((u, i) => {
    u.riskLevel = i === 0 && profile.incident ? "high" : "medium";
    u.riskDetail = i === 0 && profile.incident ? "Impossible travel and leaked credentials" : "Unfamiliar sign-in properties";
  });
  // On the incident client, the compromised user has no MFA (that's how it happened)
  const victim = profile.incident ? riskyUsers[0] : null;
  if (victim) victim.mfaRegistered = false;

  /* ---------- Devices (Intune) ---------- */
  const devices = [];
  users.forEach((u, i) => {
    if (!u.accountEnabled) return;
    const count = i % 5 === 0 ? 2 : 1;
    for (let d = 0; d < count; d++) {
      const os = d === 1 ? (rand() < 0.6 ? "iOS" : "Android") : rand() < 0.88 ? "Windows" : "macOS";
      const outdated = rand() < profile.outdatedRate;
      const stale = rand() < profile.staleRate;
      // Most compliance policies set a minimum OS version, so outdated devices usually fail
      const compliant = outdated ? rand() < 0.25 : rand() < Math.min(0.99, profile.compliantRate + profile.outdatedRate * 0.6);
      const where = jitter(u.home, os === "Windows" || os === "macOS" ? 8 : 25);
      const n = devices.length + 1;
      devices.push({
        id: `${profile.id}-d${String(n).padStart(3, "0")}`,
        name:
          os === "Windows" ? `${profile.domain.slice(0, 3).toUpperCase()}-${rand() < 0.2 ? "WS" : "LT"}-${String(1000 + n)}` :
          os === "macOS" ? `${u.name.split(" ")[0]}'s MacBook` :
          `${u.name.split(" ")[0]}'s ${os === "iOS" ? "iPhone" : "Android"}`,
        os,
        osVersion: outdated ? OS_VERSIONS[os].outdated : OS_VERSIONS[os].current,
        outdated,
        model: pick(DEVICE_MODELS[os]),
        serial: Math.floor(rand() * 36 ** 8).toString(36).toUpperCase().padStart(8, "0"),
        ownership: os === "Android" && rand() < 0.5 ? "personal" : "company",
        owner: u.upn,
        ownerName: u.name,
        compliance: compliant ? "compliant" : rand() < 0.2 ? "inGracePeriod" : "noncompliant",
        complianceIssues: compliant ? [] : [
          ...(outdated ? ["Minimum OS version"] : []),
          ...(rand() < 0.5 ? ["BitLocker / disk encryption"] : []),
          ...(rand() < 0.4 ? ["Microsoft Defender real-time protection"] : ["Firewall enabled"]),
        ],
        encrypted: rand() < profile.encryptRate,
        defenderStatus: rand() < 0.93 ? "Active" : "Out of date",
        lastSync: stale ? ago((32 + Math.floor(rand() * 50)) * DAY) : ago(Math.floor(rand() * 20) * HOUR),
        enrolled: ago((60 + Math.floor(rand() * 600)) * DAY),
        location: { city: u.home.city, region: u.home.region, country: u.home.country, lat: where.lat, lon: where.lon, at: ago(Math.floor(rand() * 30) * HOUR), source: "Last sign-in IP" },
        state: "active",
      });
    }
  });
  if (victim) {
    const lost = devices.find((d) => d.owner !== victim.upn && d.os === "iOS");
    if (lost) { lost.lostReported = true; }
  }

  /* ---------- Sign-ins (last 7 days) ---------- */
  const signIns = [];
  const addSignIn = (s) => signIns.push({ id: `${profile.id}-s${signIns.length + 1}`, ...s });
  users.filter((u) => u.accountEnabled && Date.now() - new Date(u.lastSignIn) < 30 * DAY).forEach((u) => {
    const count = 4 + Math.floor(rand() * 7);
    const traveler = rand() < 0.04;
    const trip = traveler ? pick(PLACES.travel) : null;
    for (let k = 0; k < count; k++) {
      // A traveler's trip sign-ins happen together, 5-6 days ago; home sign-ins happen in the last 3 days
      const onTrip = traveler && k < 2;
      const place = onTrip ? trip : u.home;
      const when = onTrip ? 5 * DAY + rand() * DAY : traveler ? rand() * 3 * DAY : rand() * 7 * DAY;
      const failed = rand() < 0.05;
      const legacy = profile.legacySignIns && rand() < 0.04;
      addSignIn({
        time: ago(Math.floor(when)),
        user: u.upn,
        userName: u.name,
        app: legacy ? "Office 365 Exchange Online" : pick(APPS),
        clientApp: legacy ? "Exchange ActiveSync" : rand() < 0.6 ? "Browser" : "Mobile apps and desktop clients",
        ip: place === u.home && u.home === profile.offices[0] ? ip(officeIp) : ip("198.51.100"),
        ...jitter(place, 6),
        status: failed ? "failure" : "success",
        errorCode: failed ? pick([50126, 50074, 50140]) : 0,
        failureReason: failed ? "" : "",
        mfa: legacy ? "single factor" : u.mfaRegistered && rand() < 0.7 ? "multifactor" : "single factor",
        risk: "none",
        conditionalAccess: legacy ? "notApplied" : "success",
      });
    }
  });
  const FAILURE_TEXT = { 50126: "Invalid username or password", 50074: "MFA required but not completed", 50140: "Keep me signed in interrupt" };
  signIns.forEach((s) => { if (s.status === "failure") s.failureReason = FAILURE_TEXT[s.errorCode]; });

  // Northgate: a real-looking account takeover and password spray
  if (victim) {
    addSignIn({ time: ago(26 * HOUR), user: victim.upn, userName: victim.name, app: "Outlook", clientApp: "Browser",
      ip: ip(officeIp), ...victim.home, status: "success", errorCode: 0, failureReason: "", mfa: "single factor", risk: "none", conditionalAccess: "success" });
    const lagos = PLACES.hostile[0];
    addSignIn({ time: ago(24 * HOUR), user: victim.upn, userName: victim.name, app: "Office 365 Exchange Online", clientApp: "Browser",
      ip: ip("203.0.113"), ...jitter(lagos, 5), status: "success", errorCode: 0, failureReason: "", mfa: "single factor", risk: "high", conditionalAccess: "notApplied" });
    addSignIn({ time: ago(23 * HOUR), user: victim.upn, userName: victim.name, app: "OneDrive", clientApp: "Browser",
      ip: ip("203.0.113"), ...jitter(lagos, 5), status: "success", errorCode: 0, failureReason: "", mfa: "single factor", risk: "high", conditionalAccess: "notApplied" });
  }
  if (profile.alerts.includes("passwordSpray")) {
    const bucharest = PLACES.hostile[1];
    const sprayIps = [ip("203.0.113"), ip("203.0.113"), ip("203.0.113")];
    for (let k = 0; k < 28; k++) {
      const u = pick(users);
      addSignIn({ time: ago(40 * HOUR + k * 90000), user: u.upn, userName: u.name, app: "Office 365 Exchange Online", clientApp: "Other clients",
        ip: pick(sprayIps), ...jitter(bucharest, 4), status: "failure", errorCode: 50126, failureReason: "Invalid username or password", mfa: "single factor", risk: "medium", conditionalAccess: "notApplied" });
    }
  }
  signIns.sort((a, b) => new Date(b.time) - new Date(a.time));

  /* ---------- Alerts (Defender XDR) ---------- */
  const alerts = profile.alerts.map((key, i) => {
    const t = ALERT_TEMPLATES[key];
    const user = key === "impossibleTravel" || key === "inboxRule" ? victim || pick(regular) : pick(regular);
    const device = pick(devices);
    const fresh = profile.incident ? i < 3 : i === 0;
    const created = fresh ? ago((2 + i * 3) * HOUR) : ago((3 + i * 4) * DAY);
    const details = {
      impossibleTravel: `${user.name} signed in from Toledo, US and Lagos, NG within 2 hours.`,
      inboxRule: `A rule forwarding all mail to an external address was created on ${user.upn}'s mailbox.`,
      passwordSpray: "28 failed sign-ins against different accounts from 3 IP addresses in Bucharest, RO within 45 minutes.",
      maliciousUrlClick: `${user.name} clicked a link that Safe Links later identified as phishing.`,
      emailRemoved: "Zero-hour auto purge removed 4 messages with a malicious URL after delivery.",
      malware: `Microsoft Defender blocked and quarantined a malicious file on ${device.name}.`,
      anonymousIp: `${user.name} signed in through an anonymizing VPN service.`,
      massDownload: `${user.name} downloaded 1,240 files from SharePoint in 20 minutes.`,
    }[key];
    return {
      id: `${profile.id}-a${i + 1}`,
      title: t.title,
      severity: t.severity,
      category: t.category,
      service: t.service,
      status: fresh ? "new" : i % 2 ? "resolved" : "inProgress",
      created,
      updated: created,
      assignedTo: fresh ? null : "soc@northwatch.io",
      user: t.target === "user" ? user.upn : null,
      device: t.target === "device" ? device.name : null,
      description: details,
      recommendation: {
        impossibleTravel: "Run the Compromised account playbook: sign the user out everywhere, disable the account, and reset the password.",
        inboxRule: "Remove the forwarding rule, check sent items for fraud, and run the Compromised account playbook.",
        passwordSpray: "Block legacy authentication and make sure every account has MFA.",
        maliciousUrlClick: "Sign the user out everywhere and reset the password if they entered credentials.",
        emailRemoved: "No action needed. Review the messages in Explorer if users reported them.",
        malware: "Run a full scan on the device and check where the file came from.",
        anonymousIp: "Confirm with the user. If unexpected, sign them out and reset the password.",
        massDownload: "Confirm the download was for business use. If not, disable the account.",
      }[key],
    };
  });

  /* ---------- Phishing simulations ---------- */
  const simulations = profile.phishing.map((p, i) => ({
    id: `${profile.id}-sim${i + 1}`,
    name: p.name,
    launched: ago(p.daysAgo * DAY),
    status: "completed",
    results: users.filter((u) => u.accountEnabled).map((u) => {
      const clicked = (victim && u === victim) || rand() < p.click;
      const submittedCredentials = clicked && rand() < p.cred;
      return { userId: u.id, name: u.name, upn: u.upn, clicked, submittedCredentials, reported: !clicked && rand() < 0.3 };
    }),
  }));

  /* ---------- Licenses ---------- */
  const enabledCount = users.filter((u) => u.accountEnabled).length;
  const licenses = profile.licenses.map((l, i) => {
    const consumed = i === 0 ? Math.min(l.prepaid, enabledCount - (profile.licenses[1] ? Math.round(l.prepaid * 0.1) : 0)) : Math.max(1, Math.round(l.prepaid * (0.4 + rand() * 0.4)));
    return { sku: l.sku, name: l.name, prepaid: l.prepaid, consumed, pricePerMonth: l.price };
  });
  // Disabled accounts that still hold a license
  const disabledLicensed = users.filter((u) => !u.accountEnabled).map((u) => u.upn);

  /* ---------- Policies, admins, score ---------- */
  const conditionalAccess = [];
  if (profile.ca.mfaAdmins) conditionalAccess.push({ name: "CA001 - Require MFA for admins", state: "enabled", includeUsers: [], includeRoles: ["Global Administrator"], clientAppTypes: ["all"], grantControls: ["mfa"], requiresAuthStrength: false });
  if (profile.ca.mfaAll) conditionalAccess.push({ name: "CA002 - Require MFA for all users", state: "enabled", includeUsers: ["All"], clientAppTypes: ["all"], grantControls: ["mfa"], requiresAuthStrength: false });
  if (profile.ca.blockLegacy !== "off") conditionalAccess.push({ name: "CA003 - Block legacy authentication", state: profile.ca.blockLegacy === "on" ? "enabled" : "enabledForReportingButNotEnforced", includeUsers: ["All"], clientAppTypes: ["exchangeActiveSync", "other"], grantControls: ["block"], requiresAuthStrength: false });
  if (profile.compliantRate > 0.9) conditionalAccess.push({ name: "CA004 - Require compliant device", state: "enabled", includeUsers: ["All"], clientAppTypes: ["all"], grantControls: ["compliantDevice"], requiresAuthStrength: false });

  const scoreHistory = profile.secureScore.map((s, i, all) => ({ date: ago((all.length - 1 - i) * 7 * DAY), score: s, maxScore: 100 }));

  return {
    users: users.map(({ home: _h, ...u }) => u),
    globalAdmins: users.filter((u) => u.isAdmin).map((u) => ({ name: u.name, upn: u.upn })),
    devices,
    signIns,
    alerts,
    simulations,
    licenses,
    disabledLicensed,
    conditionalAccess,
    securityDefaults: profile.securityDefaults,
    scoreHistory,
  };
}

module.exports = { buildMockTenant };
