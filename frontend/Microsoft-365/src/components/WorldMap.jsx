import { useMemo, useState } from "react";
import { geoNaturalEarth1, geoPath, geoDistance } from "d3-geo";
import { feature } from "topojson-client";
import world from "world-atlas/countries-110m.json";
import us from "us-atlas/states-10m.json";

const COUNTRIES = feature(world, world.objects.countries);
const STATES = feature(us, us.objects.states);
const WIDTH = 960;
const HEIGHT = 440;

// Groups points that sit within about 10 km of each other into one marker
function cluster(points) {
  const groups = new Map();
  points.forEach((p) => {
    const key = `${p.lat.toFixed(1)},${p.lon.toFixed(1)},${p.tone}`;
    if (!groups.has(key)) groups.set(key, { lat: p.lat, lon: p.lon, tone: p.tone, place: p.place, items: [] });
    groups.get(key).items.push(p);
  });
  // Draw the most alarming markers on top
  const order = { bad: 3, warn: 2, info: 1, good: 0 };
  return [...groups.values()].sort((a, b) => (order[a.tone] || 0) - (order[b.tone] || 0));
}

// points: [{ lat, lon, tone, label, place }] arcs: [{ from: {lat, lon}, to: {lat, lon} }]
export default function WorldMap({ points, arcs = [], legend = [], onSelect, title }) {
  const [view, setView] = useState("region");
  const valid = points.filter((p) => typeof p.lat === "number" && typeof p.lon === "number");
  const groups = useMemo(() => cluster(valid), [valid]);

  const projection = useMemo(() => {
    const proj = geoNaturalEarth1();
    if (view === "world" || valid.length === 0) {
      return proj.fitExtent([[8, 8], [WIDTH - 8, HEIGHT - 8]], { type: "Sphere" });
    }
    // Region view: fit the points near the median location, ignoring far-away outliers
    const lats = valid.map((p) => p.lat).sort((a, b) => a - b);
    const lons = valid.map((p) => p.lon).sort((a, b) => a - b);
    const center = [lons[Math.floor(lons.length / 2)], lats[Math.floor(lats.length / 2)]];
    const near = valid.filter((p) => geoDistance(center, [p.lon, p.lat]) < 0.25);
    const coords = (near.length ? near : valid).map((p) => [p.lon, p.lat]);
    const pad = 1.2;
    const box = {
      type: "MultiPoint",
      coordinates: [...coords, ...coords.map(([x, y]) => [x - pad, y - pad]), ...coords.map(([x, y]) => [x + pad, y + pad])],
    };
    return proj.fitExtent([[30, 30], [WIDTH - 30, HEIGHT - 30]], box);
  }, [view, valid]);

  const path = geoPath(projection);
  const outside = view === "region"
    ? valid.filter((p) => { const xy = projection([p.lon, p.lat]); return !xy || xy[0] < 0 || xy[0] > WIDTH || xy[1] < 0 || xy[1] > HEIGHT; }).length
    : 0;

  // Label the busiest places in region view (one label per place)
  const labels = [];
  if (view === "region") {
    const byPlace = new Map();
    groups.forEach((g) => {
      if (!g.place) return;
      const xy = projection([g.lon, g.lat]);
      if (!xy || xy[0] < 0 || xy[0] > WIDTH - 60 || xy[1] < 10 || xy[1] > HEIGHT) return;
      const prev = byPlace.get(g.place);
      const count = (prev ? prev.count : 0) + g.items.length;
      byPlace.set(g.place, { place: g.place, x: xy[0], y: xy[1], r: Math.min(4 + Math.sqrt(count) * 2.2, 18), count });
    });
    labels.push(...[...byPlace.values()].sort((a, b) => b.count - a.count).slice(0, 8));
  }

  return (
    <figure className="map">
      <div className="map-bar">
        {title && <figcaption>{title}</figcaption>}
        <div className="map-toggle" role="group" aria-label="Map view">
          <button type="button" className={view === "region" ? "is-active" : ""} aria-pressed={view === "region"} onClick={() => setView("region")}>Region</button>
          <button type="button" className={view === "world" ? "is-active" : ""} aria-pressed={view === "world"} onClick={() => setView("world")}>World</button>
        </div>
      </div>
      <div className="map-frame">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={title || "Map"}>
          <path d={path({ type: "Sphere" })} className="map-sea" />
          {COUNTRIES.features.map((f) => <path key={f.id || f.properties.name} d={path(f)} className="map-land" />)}
          {view === "region" && STATES.features.map((f) => <path key={`s${f.id}`} d={path(f)} className="map-state" />)}
          {arcs.map((a, i) => (
            <path key={i} d={path({ type: "LineString", coordinates: [[a.from.lon, a.from.lat], [a.to.lon, a.to.lat]] })} className="map-arc" />
          ))}
          {groups.map((g, i) => {
            const xy = projection([g.lon, g.lat]);
            if (!xy) return null;
            const r = Math.min(4 + Math.sqrt(g.items.length) * 2.2, 18);
            const label = g.items.length === 1 ? g.items[0].label : `${g.items.length} items near ${g.items[0].label.split(" — ").pop()}`;
            return (
              <circle key={i} cx={xy[0]} cy={xy[1]} r={r} className={`map-dot dot-${g.tone}`}
                onClick={onSelect ? () => onSelect(g.items) : undefined} style={onSelect ? { cursor: "pointer" } : undefined}>
                <title>{label}</title>
              </circle>
            );
          })}
          {view === "region" && labels.map((l) => (
            <text key={l.place} x={l.x + l.r + 5} y={l.y + 4} className="map-label">{l.place}</text>
          ))}
        </svg>
      </div>
      <div className="map-foot">
        <ul className="map-legend">
          {legend.map((l) => <li key={l.label}><span className={`dot-${l.tone}`} />{l.label}</li>)}
        </ul>
        {outside > 0 && (
          <button type="button" className="link" onClick={() => setView("world")}>
            {outside} location{outside === 1 ? "" : "s"} outside this view. Show world
          </button>
        )}
      </div>
    </figure>
  );
}
