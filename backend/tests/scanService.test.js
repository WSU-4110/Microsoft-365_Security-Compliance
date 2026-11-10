const { runScan, CHECKS } = require("../scanService");
const { MockDataSource, SecurityDataSource } = require("../securityDataSources");
const { CLIENTS } = require("../data/clients");
const { findImpossibleTravel, distanceKm } = require("../geo");

const byId = (id) => CLIENTS.find((c) => c.id === id);

describe("scan across all five clients", () => {
  const results = {};
  beforeAll(async () => {
    for (const c of CLIENTS) results[c.id] = await runScan(new MockDataSource(c));
  });

  test("every check runs without errors", () => {
    for (const scan of Object.values(results)) {
      expect(scan.checks).toHaveLength(CHECKS.length);
      expect(scan.checks.filter((c) => c.status === "error")).toEqual([]);
    }
  });

  test("the strongest client scores higher than the weakest", () => {
    expect(results["lakeside-cu"].compliance.percent).toBeGreaterThan(results["midwest-precision"].compliance.percent);
    expect(results["lakeside-cu"].score.percent).toBeGreaterThan(results["midwest-precision"].score.percent);
  });

  test("Northgate's account takeover is detected", () => {
    const scan = results["northgate-logistics"];
    expect(scan.signIns.impossibleTravel).toBe(1);
    expect(scan.gaps.some((g) => g.title.startsWith("Impossible travel"))).toBe(true);
    expect(scan.gaps.some((g) => g.title.startsWith("Password spray"))).toBe(true);
  });

  test("no false impossible-travel alarms on the other clients", () => {
    for (const id of ["harbor-point", "lakeside-cu", "midwest-precision", "riverside-law"]) {
      expect(results[id].signIns.impossibleTravel).toBe(0);
    }
  });

  test("Windows 10 end of support is flagged", () => {
    expect(results["midwest-precision"].gaps.some((g) => g.title.includes("Windows 10"))).toBe(true);
  });

  test("CIS controls are scored", () => {
    const controls = results["lakeside-cu"].compliance.controls;
    expect(controls.find((c) => c.id === "6.3").status).toBe("pass");
    expect(results["midwest-precision"].compliance.controls.find((c) => c.id === "6.3").status).toBe("fail");
  });
});

test("progress is reported for every check", async () => {
  const updates = [];
  await runScan(new MockDataSource(byId("riverside-law")), (c) => updates.push(c));
  expect(updates).toHaveLength(CHECKS.length * 2);
});

test("a failing data source marks only its checks as errors", async () => {
  class Broken extends MockDataSource {
    async getManagedDevices() { throw new Error("Intune license required"); }
  }
  const scan = await runScan(new Broken(byId("riverside-law")));
  const errors = scan.checks.filter((c) => c.status === "error").map((c) => c.id);
  expect(errors).toEqual(["device-compliance", "device-os"]);
  expect(scan.compliance.controls.find((c) => c.id === "3.6").status).toBe("unknown");
});

test("distance and impossible travel math", () => {
  expect(Math.round(distanceKm({ lat: 42.33, lon: -83.05 }, { lat: 41.88, lon: -87.63 }))).toBeGreaterThan(370);
  const t0 = new Date().toISOString();
  const t1 = new Date(Date.now() + 3600000).toISOString();
  const found = findImpossibleTravel([
    { id: "a", user: "x", status: "success", lat: 42.33, lon: -83.05, time: t0, city: "Detroit" },
    { id: "b", user: "x", status: "success", lat: 51.5, lon: -0.12, time: t1, city: "London" },
  ]);
  expect(found).toHaveLength(1);
});

test("mock device actions change the device", async () => {
  const ds = new MockDataSource(byId("harbor-point"));
  const [device] = await ds.getManagedDevices();
  await ds.deviceAction(device.id, "retire");
  expect((await ds.getManagedDevices()).find((d) => d.id === device.id)).toBeUndefined();
});

test("base class methods must be overridden", async () => {
  await expect(new SecurityDataSource().getSignIns()).rejects.toThrow("not implemented");
});
