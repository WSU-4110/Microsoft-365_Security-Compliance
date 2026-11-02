const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'Express backend operational', timestamp: new Date() });
});

app.get('/api/security/score', (req, res) => {
  res.status(200).json({
    currentScore: 68.5,
    maxScore: 100,
    categoryScores: { identity: 35.0, data: 18.5, device: 15.0 },
    lastUpdated: new Date().toISOString()
  });
});

app.get('/api/security/gaps', (req, res) => {
  res.status(200).json([
    { id: 1, title: 'Enforce Multi-Factor Authentication for Admins', severity: 'High', status: 'Open', fixInstruction: 'Enable conditional access policy requiring MFA.' },
    { id: 2, title: 'Disable Legacy Authentication Protocols', severity: 'Medium', status: 'Open', fixInstruction: 'Block basic auth protocols in Entra admin center.' },
    { id: 3, title: 'Review Anonymous External File Sharing Links', severity: 'Low', status: 'Resolved', fixInstruction: 'Configure SharePoint link expiration defaults.' }
  ]);
});

app.get('/api/scans/history', (req, res) => {
  res.status(200).json([
    { scanId: 'SCN-1001', date: '2026-10-10', score: 62.0, openGaps: 5 },
    { scanId: 'SCN-1002', date: '2026-10-14', score: 65.5, openGaps: 4 },
    { scanId: 'SCN-1003', date: '2026-10-18', score: 68.5, openGaps: 2 }
  ]);
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
