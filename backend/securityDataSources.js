// Strategy pattern for where the backend gets its Microsoft 365 security data.
//
// SecurityDataSource   = the strategy (base class every source must follow)
// GraphDataSource      = concrete strategy: real data from Microsoft Graph
// MockDataSource       = concrete strategy: fake data for development/testing
// SecurityScoreService = the context: server.js only talks to this class

class SecurityDataSource {
  async getSecureScore() {
    throw new Error("getSecureScore() must be implemented by a data source");
  }

  async getScanHistory() {
    throw new Error("getScanHistory() must be implemented by a data source");
  }
}

class GraphDataSource extends SecurityDataSource {
  constructor(tenantId, clientId, clientSecret) {
    super();
    this.tenantId = tenantId;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  async getToken() {
    const params = new URLSearchParams();
    params.append("client_id", this.clientId);
    params.append("client_secret", this.clientSecret);
    params.append("scope", "https://graph.microsoft.com/.default");
    params.append("grant_type", "client_credentials");

    const response = await fetch(
      `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
      { method: "POST", body: params }
    );
    const data = await response.json();

    if (!data.access_token) {
      throw new Error("Could not get a Microsoft Graph token");
    }
    return data.access_token;
  }

  async fetchSecureScores(top) {
    const token = await this.getToken();
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/security/secureScores?$top=${top}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
      throw new Error(`Graph request failed with status ${response.status}`);
    }
    const data = await response.json();
    return data.value || [];
  }

  async getSecureScore() {
    const scores = await this.fetchSecureScores(1);
    const latest = scores[0];
    if (!latest) {
      throw new Error("No secure score returned from Graph");
    }

    // Add up the control scores for each category (Identity, Data, Device, ...)
    const categoryScores = {};
    for (const control of latest.controlScores || []) {
      const category = (control.controlCategory || "other").toLowerCase();
      categoryScores[category] = (categoryScores[category] || 0) + (control.score || 0);
    }

    return {
      currentScore: latest.currentScore,
      maxScore: latest.maxScore,
      categoryScores,
      lastUpdated: latest.createdDateTime,
    };
  }

  async getScanHistory() {
    const scores = await this.fetchSecureScores(10);
    return scores.map((score) => ({
      scanId: score.id,
      date: score.createdDateTime.slice(0, 10),
      score: score.currentScore,
      maxScore: score.maxScore,
    }));
  }
}

class MockDataSource extends SecurityDataSource {
  async getSecureScore() {
    return {
      currentScore: 68.5,
      maxScore: 100,
      categoryScores: { identity: 35.0, data: 18.5, device: 15.0 },
      lastUpdated: new Date().toISOString(),
    };
  }

  async getScanHistory() {
    return [
      { scanId: "SCN-1001", date: "2026-10-10", score: 62.0, openGaps: 5 },
      { scanId: "SCN-1002", date: "2026-10-14", score: 65.5, openGaps: 4 },
      { scanId: "SCN-1003", date: "2026-10-18", score: 68.5, openGaps: 2 },
    ];
  }
}

class SecurityScoreService {
  constructor(dataSource) {
    this.dataSource = dataSource;
  }

  setDataSource(dataSource) {
    this.dataSource = dataSource;
  }

  async getSecureScore() {
    return this.dataSource.getSecureScore();
  }

  async getScanHistory() {
    return this.dataSource.getScanHistory();
  }
}

module.exports = {
  SecurityDataSource,
  GraphDataSource,
  MockDataSource,
  SecurityScoreService,
};
