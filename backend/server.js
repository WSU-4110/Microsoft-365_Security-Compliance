const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const {
  GraphDataSource,
  MockDataSource,
  SecurityScoreService,
} = require('./securityDataSources');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

/* Pick the data source (Strategy pattern) */
// Set USE_MOCK_DATA=true in .env to use fake data while developing.
const dataSource =
  process.env.USE_MOCK_DATA === "true"
    ? new MockDataSource()
    : new GraphDataSource(
        process.env.TENANT_ID,
        process.env.CLIENT_ID,
        process.env.CLIENT_SECRET
      );

const securityService = new SecurityScoreService(dataSource);

/* Health Check */
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "Express backend operational",
    dataSource: dataSource.constructor.name,
    timestamp: new Date(),
  });
});

/* Secure Score */
app.get("/api/security/score", async (req, res) => {
  try {
    const score = await securityService.getSecureScore();
    res.status(200).json(score);
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

app.get("/api/scans/history", async (req, res) => {
  try {
    const history = await securityService.getScanHistory();
    res.status(200).json(history);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to retrieve scan history",
    });
  }
});

/* Start Server */

app.listen(PORT, () => {
  console.log(
    `Backend server running on http://localhost:${PORT}`
  );
});
