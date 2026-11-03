const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

/* Microsoft Graph Authentication */

async function getGraphToken() {
  const params = new URLSearchParams();

  params.append("client_id", process.env.CLIENT_ID);
  params.append("client_secret", process.env.CLIENT_SECRET);
  params.append(
    "scope",
    "https://graph.microsoft.com/.default"
  );
  params.append("grant_type", "client_credentials");

  const response = await fetch(
    `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      body: params,
    }
  );

  const data = await response.json();

  return data.access_token;
}

/* Microsoft Secure Score */
async function getSecureScore() {
  try {
    const token = await getGraphToken();

    const response = await fetch(
      "https://graph.microsoft.com/v1.0/security/secureScores",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    return data;
  } catch (error) {
    console.error("Graph API Error:", error);

    // Temporary fallback while developing
    return {
      currentScore: 68.5,
      maxScore: 100,
      categoryScores: {
        identity: 35.0,
        data: 18.5,
        device: 15.0,
      },
      lastUpdated: new Date().toISOString(),
    };
  }
}

/* Health Check */
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "Express backend operational",
    timestamp: new Date(),
  });
});

/* Secure Score */
app.get("/api/security/score", async (req, res) => {
  try {
    const graphData = await getSecureScore();

    res.status(200).json(graphData);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to retrieve secure score",
    });
  }
});

/* Security Gaps */

app.get("/api/security/gaps", (req, res) => {
  res.status(200).json([
    {
      id: 1,
      title: "Enforce Multi-Factor Authentication for Admins",
      severity: "High",
      status: "Open",
      fixInstruction:
        "Enable conditional access policy requiring MFA.",
    },
    {
      id: 2,
      title: "Disable Legacy Authentication Protocols",
      severity: "Medium",
      status: "Open",
      fixInstruction:
        "Block basic authentication protocols in Entra Admin Center.",
    },
    {
      id: 3,
      title: "Review Anonymous External File Sharing Links",
      severity: "Low",
      status: "Resolved",
      fixInstruction:
        "Configure SharePoint link expiration defaults.",
    },
  ]);
});

/* Scan History */

app.get("/api/scans/history", (req, res) => {
  res.status(200).json([
    {
      scanId: "SCN-1001",
      date: "2026-10-10",
      score: 62.0,
      openGaps: 5,
    },
    {
      scanId: "SCN-1002",
      date: "2026-10-14",
      score: 65.5,
      openGaps: 4,
    },
    {
      scanId: "SCN-1003",
      date: "2026-10-18",
      score: 68.5,
      openGaps: 2,
    },
  ]);
});

/* Start Server */

app.listen(PORT, () => {
  console.log(
    `Backend server running on http://localhost:${PORT}`
  );
});
