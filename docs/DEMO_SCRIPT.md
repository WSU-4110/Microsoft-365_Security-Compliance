# Demo script (about 8 minutes)

Start the backend and frontend (see README), open http://localhost:5173, and create the first account so you're the Admin.

1. **The problem (30 s).** "An MSP looks after many Microsoft 365 tenants, each with its own admin portals. Problems get missed. Northwatch puts every client on one screen and lets you act on it."

2. **Portfolio (1 min).** Five clients, 264 users, 300+ devices. Point out the spread: Lakeside Credit Union at 75% CIS compliance versus Midwest Precision at 8%. Read the "Needs attention" queue: impossible travel at Northgate Logistics.

3. **Client overview (1 min).** Open Northgate Logistics and click **Run scan now**. Narrate the 13 checks running live. Show the two score rings, the totals, and the prioritized gaps with fix steps.

4. **Sign-ins (1 min).** The map shows Northgate's offices in Toledo and Chicago. Switch to **World**: the dashed line to Lagos is Tasha Ward's account signing in from two continents within two hours. Below it, a password spray from Bucharest against many accounts.

5. **Alerts (45 s).** The same incident from Defender: "Impossible travel activity" and "Suspicious inbox forwarding rule." Show the recommended response, click **Start investigation**.

6. **Contain (1 min).** Click **Run response playbook** (or **Contain** on the Identity page). Enter a reason and run it: signed out everywhere, account disabled, follow-up checklist shown.

7. **Devices (1 min).** Map of device locations colored by compliance. Open a device: model, serial, failing settings, Windows 10 flagged as past end of support. Show the remote actions and the typed confirmation required for **Wipe**.

8. **Compliance and licenses (45 s).** CIS Controls v8 safeguards with evidence. Licenses: Midwest Precision is paying for unused seats every month.

9. **Report (45 s).** **Reports > Open report**: the executive report for the client's contact, with the action we just took listed under "Actions taken." Print to PDF.

10. **Accountability (30 s).** Activity log: who did what, when, and why. Settings: roles (Admin, Analyst, Viewer) and the 24-hour scan schedule.

Close: "Same code path in demo and live mode, thanks to the Strategy pattern. Switch `USE_MOCK_DATA` to false and add an app registration to connect a real tenant."
