// Response playbooks: a named list of steps run in order against one user or device.
// Every step is logged in the activity log, and the playbook stops at the first failure.

const PLAYBOOKS = [
  {
    id: "compromised-account",
    name: "Compromised account",
    description: "Contain an account that may be in an attacker's hands. Signs the user out of every app and device, then blocks new sign-ins.",
    target: "user",
    severity: "high",
    steps: [
      { action: "revoke-sessions", label: "Sign the user out everywhere" },
      { action: "disable", label: "Disable the account" },
    ],
    followUp: [
      "Reset the password and re-register MFA with the user in person or on a video call.",
      "Check the mailbox for forwarding rules and delete any you didn't create.",
      "Review files accessed in the last 7 days in the audit log.",
      "Re-enable the account from the Identity page once it's clean.",
    ],
  },
  {
    id: "lost-device",
    name: "Lost or stolen device",
    description: "Protect company data on a device that's missing. Locks it, records its last known location, and syncs so the lock arrives fast.",
    target: "device",
    severity: "medium",
    steps: [
      { action: "lock", label: "Lock the device remotely" },
      { action: "locate", label: "Locate the device" },
      { action: "sync", label: "Force a sync" },
    ],
    followUp: [
      "If the device isn't found within 48 hours, run Wipe from the Devices page.",
      "Ask the user to change their password if the device was unlocked when lost.",
    ],
  },
  {
    id: "offboard-employee",
    name: "Offboard an employee",
    description: "Remove a departing employee's access the moment they leave. Signs them out, disables the account, and retires their company devices.",
    target: "user",
    severity: "medium",
    steps: [
      { action: "revoke-sessions", label: "Sign the user out everywhere" },
      { action: "disable", label: "Disable the account" },
      { action: "retire-devices", label: "Retire the user's devices" },
    ],
    followUp: [
      "Convert the mailbox to a shared mailbox and give the manager access.",
      "Transfer OneDrive files to the manager.",
      "Remove the license after 30 days to free up the cost.",
    ],
  },
];

function getPlaybook(id) {
  return PLAYBOOKS.find((p) => p.id === id) || null;
}

module.exports = { PLAYBOOKS, getPlaybook };
