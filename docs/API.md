# API reference

All routes are under `/api`. Everything except `/api/health` and `/api/auth/*` needs `Authorization: Bearer <token>`.

## Auth

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| POST | `/auth/register` | `{ email, password }` | First account is Admin, then Viewer. Password: 12+ chars, upper, lower, number, symbol |
| POST | `/auth/login` | `{ email, password }` | Returns `{ token, email, role }` |

## Portfolio and platform

| Method | Path | Role | Notes |
| --- | --- | --- | --- |
| GET | `/health` | public | Mode, client count, storage |
| GET | `/clients` | any | Managed tenants |
| GET | `/portfolio` | any | Latest scan summary per client |
| POST | `/scans/all` | Admin, Analyst | Starts a scan of every client |
| GET | `/jobs/:id` | any | Scan job progress |
| GET | `/playbooks` | any | Response playbooks |
| GET | `/actions?clientId=` | any | Activity log |
| GET | `/settings` | any | Mode, schedule, tenants, checks |
| GET | `/team` | Admin | Staff accounts |
| PATCH | `/team/:id` | Admin | `{ role }` |

## Per client: `/clients/:clientId/...`

| Method | Path | Role | Notes |
| --- | --- | --- | --- |
| POST | `scans` | Admin, Analyst | Starts a scan job (202) |
| GET | `scans`, `scans/latest`, `scans/:scanId` | any | Scan history and results |
| GET | `users` | any | Users with MFA and risk |
| POST | `users/:userId/{disable,enable,revoke-sessions}` | Admin, Analyst | `{ reason }` |
| GET | `signins` | any | Sign-ins with flags, impossible travel, password spray |
| GET | `devices` | any | Intune devices with location |
| POST | `devices/:deviceId/{sync,restart,lock,locate,retire,wipe}` | Admin, Analyst | `{ reason }`; wipe also needs `{ confirmName }` |
| GET | `alerts` | any | Defender alerts |
| PATCH | `alerts/:alertId` | Admin, Analyst | `{ status?, assignToMe? }` |
| GET | `phishing` | any | Campaigns and people who clicked |
| GET | `licenses` | any | Seats, unused cost, disabled accounts |
| POST | `playbooks/:playbookId/run` | Admin, Analyst | `{ targetId, reason }` |
| GET | `actions` | any | Activity log for this client |
| GET | `report` | any | Data for the executive report |
| GET | `export/{users,devices,signins,alerts,gaps,controls}` | any | CSV download |
