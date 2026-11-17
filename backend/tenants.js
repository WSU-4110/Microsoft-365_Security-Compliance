// The managed clients and the data source for each one.
//
// Demo mode (USE_MOCK_DATA=true): the five made-up clients in data/clients.js.
// Live mode: clients listed in a JSON file (CLIENTS_FILE, default clients.json), each with
// its own Entra app registration:
//   [{ "id": "acme", "name": "Acme Corp", "industry": "Retail", "tenantId": "...",
//      "clientId": "...", "clientSecret": "..." }]
// Single-tenant shortcut: if there's no clients file, TENANT_ID / CLIENT_ID / CLIENT_SECRET
// from .env become one client called "Primary tenant".

const fs = require("fs");
const path = require("path");
const { GraphDataSource, MockDataSource } = require("./securityDataSources");
const { CLIENTS } = require("./data/clients");

const PUBLIC_FIELDS = ["id", "name", "industry", "domain", "tier", "clientSince", "contact", "frameworks", "offices", "userCount"];

function loadLiveClients() {
  const file = path.resolve(__dirname, process.env.CLIENTS_FILE || "clients.json");
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  if (process.env.TENANT_ID) {
    return [{ id: "primary", name: "Primary tenant", industry: "", tenantId: process.env.TENANT_ID, clientId: process.env.CLIENT_ID, clientSecret: process.env.CLIENT_SECRET }];
  }
  return [];
}

class TenantRegistry {
  constructor({ mock, delayMs = 0 }) {
    this.mock = mock;
    const list = mock ? CLIENTS : loadLiveClients();
    this.clients = list.map((profile) => ({
      profile,
      dataSource: mock ? new MockDataSource(profile, { delayMs }) : new GraphDataSource(profile.tenantId, profile.clientId, profile.clientSecret),
    }));
  }

  list() {
    return this.clients.map(({ profile, dataSource }) => ({
      ...Object.fromEntries(PUBLIC_FIELDS.filter((k) => profile[k] !== undefined).map((k) => [k, profile[k]])),
      tenantId: profile.tenantId ? `${profile.tenantId.slice(0, 8)}…` : "demo",
      dataSource: dataSource.constructor.name,
    }));
  }

  get(id) {
    return this.clients.find((c) => c.profile.id === id) || null;
  }
}

module.exports = { TenantRegistry };
