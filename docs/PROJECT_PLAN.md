# Northwatch: Project Plan

**Course:** CSC 4110 Software Engineering, Wayne State University
**Product:** Microsoft 365 Security & Compliance Dashboard ("Northwatch")
**Repository:** https://github.com/WSU-4110/Microsoft-365_Security-Compliance

## 1. Vision

Giving every business high-grade security by making Microsoft 365 safe, simple, and fully documented.

Northwatch continuously checks a client's Microsoft 365 environment against known security benchmarks, flags misconfigurations and threats, and helps fix them step by step, including taking action directly in the tenant.

## 2. The problem

Small and mid-sized businesses run on Microsoft 365 but rarely have security staff. Most outsource IT to a managed service provider (MSP). An MSP technician looking after 5 to 50 clients has to jump between the Entra admin center, Intune, Defender, and the Microsoft 365 admin center separately for every tenant. Problems like an admin without MFA, a Windows 10 laptop past end of support, or an account signing in from two continents in two hours get missed because nobody sees them in one place.

## 3. Users

| Persona | Needs | Northwatch role |
| --- | --- | --- |
| MSP security analyst | Spot and contain threats across many clients quickly | Analyst |
| MSP owner / vCISO | Portfolio health, client reports, service quality | Admin |
| Client stakeholder (practice owner, CFO) | Plain-language proof that their business is protected | Receives the executive report |
| Auditor / insurer | Evidence against a framework | Receives CSV evidence exports |

## 4. Scope

### In scope (built)

| Module | What it does |
| --- | --- |
| Portfolio | All managed tenants on one screen: Secure Score with trend, CIS compliance, MFA, device health, open alerts, and a "Needs attention" queue |
| Security scan engine | 13 automated checks per tenant, run as a background job with live progress, on demand or on a schedule |
| Identity | Users, MFA registration, admin roles, inactive accounts, Identity Protection risk; disable, enable, sign out everywhere |
| Sign-ins | 7-day sign-in log on a map, impossible-travel detection, password-spray detection, legacy-auth usage |
| Devices (Intune) | Compliance, encryption, OS currency (Windows 10 end of support), Defender status, last known location on a map; remote sync, restart, lock, locate, retire, wipe |
| Alerts | Defender XDR alert queue with triage (assign, investigate, resolve) and recommended responses |
| Email security | Attack simulation training results, click and report rates, repeat clickers |
| Compliance | Scoring against CIS Controls v8 safeguards (IG1 and IG2) with evidence |
| Licenses | Seat usage and estimated spend on unused licenses |
| Response playbooks | One-click containment: compromised account, lost device, employee offboarding |
| Reports | Printable executive report per client; CSV exports of every dataset |
| Activity log | Every action sent to a tenant: who, what, when, why, and the result |
| Access control | Admin, Analyst, and Viewer roles; reasons required for every action |

### Out of scope (this semester)

- Writing configuration changes such as creating Conditional Access policies (Northwatch recommends; technicians apply).
- Billing and PSA ticketing integration.
- Non-Microsoft clouds.

## 5. Team and ownership

| Member | Area | Owns |
| --- | --- | --- |
| Katherine Carroll | Frontend (React) | App shell, login and registration, page components, styling |
| Omm Patel | Backend (Express) | API routes, authentication and roles, scan jobs and scheduler |
| Raz Lulgjuraj | Storage & database (PostgreSQL) | Schema (users, scans, actions), store layer, data retention |
| Jad Sammoudi | Testing & integration (Jest, Microsoft Graph) | Graph data source, scan checks, detection logic, test suite |
| Samantak Behera | To be confirmed with the team | Suggested: reports, documentation, and demo preparation |

## 6. Sprint plan

| Sprint | Dates | Goal | Status |
| --- | --- | --- | --- |
| 1 | Through Oct 23 | Repository, React app, Express backend, login and registration, first database draft | Done (see retrospective) |
| 2 | Oct 24 to Nov 13 | Microsoft Graph integration, connect frontend, backend, and database | In progress |
| 3 | Nov 14 to Dec 4 | Multi-tenant portfolio, Intune, sign-in analytics, alerts, playbooks, CIS scoring, reports | Planned |
| 4 | Dec 5 to final demo | Live-tenant testing, PostgreSQL in production mode, polish, presentation | Planned |

Assignment 4 (individual design patterns) applied the Strategy pattern to the data layer, which is what lets every feature run against either a live tenant or the demo tenants.

## 7. Roadmap after the course

1. Sign in with Microsoft (Entra ID single sign-on) for MSP staff.
2. GDAP onboarding so new client tenants connect without a per-client app registration.
3. Scheduled executive reports emailed to client contacts as PDF.
4. Microsoft Teams notifications for high-severity alerts.
5. Guided remediation that applies recommended Conditional Access policies in report-only mode first.
6. Microsoft Sentinel and Defender Advanced Hunting integration.

## 8. Quality plan

- **Unit and API tests (Jest, Supertest):** scan checks across all five demo tenants, impossible-travel and password-spray detection, role enforcement, wipe confirmation, playbooks, CSV export. Run with `npm test` in `backend`.
- **Linting:** ESLint on the frontend.
- **Manual walkthrough:** the demo script in `docs/DEMO_SCRIPT.md` before every sprint review.
- **Definition of done:** code reviewed in a pull request, tests passing, works in demo mode, documented in the README or docs.

## 9. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| No access to a licensed Microsoft 365 tenant | Can't demo live data | Demo mode with five realistic tenants; Strategy pattern keeps the code path identical |
| Licensing gaps (Entra P1/P2, Intune, Defender P2) | Some checks can't run | Each check fails independently and shows "Couldn't check" |
| Destructive actions (wipe, disable) misused | Real harm to a client | Role checks, required reasons, typed confirmation for wipe, full activity log |
| Leaked app secrets | Tenant compromise | `.env` and `clients.json` are git-ignored; rotate any secret that was ever committed |
| Team communication | Missed deadlines | Teams channel, weekly sync, clear ownership above |
