// Location helpers for sign-ins and devices.

const EARTH_KM = 6371;

function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

// Flags pairs of successful sign-ins by the same user that would need travel
// faster than an airliner (default 900 km/h) and are more than 500 km apart.
function findImpossibleTravel(signIns, maxKmh = 900) {
  const byUser = new Map();
  signIns
    .filter((s) => s.status === "success" && typeof s.lat === "number")
    .forEach((s) => {
      if (!byUser.has(s.user)) byUser.set(s.user, []);
      byUser.get(s.user).push(s);
    });

  const findings = [];
  for (const [user, list] of byUser) {
    list.sort((a, b) => new Date(a.time) - new Date(b.time));
    for (let i = 1; i < list.length; i++) {
      const from = list[i - 1];
      const to = list[i];
      const km = distanceKm(from, to);
      const hours = Math.max((new Date(to.time) - new Date(from.time)) / 3600000, 0.01);
      if (km > 500 && km / hours > maxKmh) {
        findings.push({
          user,
          userName: to.userName,
          from: { city: from.city, country: from.country, time: from.time, signInId: from.id },
          to: { city: to.city, country: to.country, time: to.time, signInId: to.id },
          km: Math.round(km),
          hours: +hours.toFixed(1),
          speedKmh: Math.round(km / hours),
        });
      }
    }
  }
  // One finding per user: the first impossible jump
  const seen = new Set();
  return findings.filter((f) => (seen.has(f.user) ? false : seen.add(f.user)));
}

module.exports = { distanceKm, findImpossibleTravel };
