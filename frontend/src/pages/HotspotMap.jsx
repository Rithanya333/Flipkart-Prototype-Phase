import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap, LayersControl } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import api from "@/lib/api";
import { MAP } from "@/constants/testIds";
import { Loader2 } from "lucide-react";

const BENGALURU = [12.9716, 77.5946];

function HeatLayer({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points?.length) return;
    const layer = L.heatLayer(
      points.map((p) => [p.lat, p.lng, 0.5]),
      { radius: 22, blur: 22, maxZoom: 17, gradient: { 0.2: "#3B82F6", 0.4: "#F59E0B", 0.7: "#EF4444", 1.0: "#FFFFFF" } }
    ).addTo(map);
    return () => { map.removeLayer(layer); };
  }, [points, map]);
  return null;
}

const colorFor = (sev) => ({ Critical: "#EF4444", High: "#F59E0B", Moderate: "#FACC15", Low: "#10B981" }[sev] || "#94A3B8");

export default function HotspotMap() {
  const [algo, setAlgo] = useState("dbscan");
  const [hotspots, setHotspots] = useState([]);
  const [heat, setHeat] = useState([]);
  const [showHeat, setShowHeat] = useState(true);
  const [showHotspots, setShowHotspots] = useState(true);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    Promise.all([
      api.get(`/hotspots?algorithm=${algo}`),
      api.get(`/heatmap?limit=15000`),
    ]).then(([h, p]) => {
      if (cancel) return;
      setHotspots(h.data.items);
      setHeat(p.data.points);
    }).finally(() => !cancel && setLoading(false));
    return () => { cancel = true; };
  }, [algo]);

  const critical = useMemo(() => hotspots.filter(h => h.severity === "Critical").length, [hotspots]);

  return (
    <div className="relative h-[calc(100vh-3.5rem)]">
      <MapContainer
        data-testid={MAP.container}
        center={BENGALURU}
        zoom={12}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap & CARTO'
        />
        {showHeat && <HeatLayer points={heat} />}
        {showHotspots && hotspots.map((h) => (
          <CircleMarker
            key={`${h.algorithm}-${h.cluster_id}`}
            center={[h.lat, h.lng]}
            radius={Math.min(28, 6 + h.violations / 80)}
            pathOptions={{ color: colorFor(h.severity), fillColor: colorFor(h.severity), fillOpacity: 0.35, weight: 1.5 }}
            eventHandlers={{ click: () => setActive(h) }}
          >
            <Tooltip direction="top" offset={[0, -4]} opacity={1} className="!bg-black !text-white !border-white/10">
              <div className="font-mono text-xs">
                <div className="text-amber-500">#{h.cluster_id} · {h.severity.toUpperCase()}</div>
                <div>score {h.score} · {h.violations} violations</div>
                <div className="text-slate-300">cap.loss {h.capacity_loss_pct}%</div>
              </div>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* Overlay panels */}
      <div className="absolute top-4 left-4 glass-panel p-4 w-72">
        <div className="data-label text-amber-500">/// HOTSPOT MAP</div>
        <div className="mt-2 text-sm text-slate-300">
          {hotspots.length} clusters · <span className="text-red-400">{critical} critical</span>
        </div>
        <div className="mt-4 space-y-3">
          <div>
            <div className="data-label">Algorithm</div>
            <select
              value={algo}
              onChange={(e) => setAlgo(e.target.value)}
              data-testid={MAP.algoSelect}
              className="mt-1 w-full bg-black/60 border border-white/10 rounded px-3 py-2 font-mono text-sm focus:border-amber-500 focus:outline-none"
            >
              <option value="dbscan">DBSCAN (haversine 80m)</option>
              <option value="hdbscan">HDBSCAN (adaptive)</option>
              <option value="kmeans">K-Means (territory)</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm" data-testid={MAP.layerToggle}>
            <input type="checkbox" checked={showHotspots} onChange={(e) => setShowHotspots(e.target.checked)} className="accent-amber-500" />
            <span>Show hotspot circles</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showHeat} onChange={(e) => setShowHeat(e.target.checked)} className="accent-amber-500" />
            <span>Show density heatmap</span>
          </label>
        </div>
        {loading && (
          <div className="mt-4 flex items-center gap-2 text-xs font-mono text-amber-500">
            <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} /> COMPUTING CLUSTERS…
          </div>
        )}
        <div className="mt-4 border-t border-white/5 pt-3 space-y-1.5 text-xs font-mono">
          {["Critical","High","Moderate","Low"].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: colorFor(s) }} />
              <span className="text-slate-300">{s.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </div>

      {active && (
        <div className="absolute top-4 right-4 glass-panel p-5 w-80 max-h-[85vh] overflow-auto">
          <div className="flex items-center justify-between">
            <div className="data-label text-amber-500">/// HOTSPOT #{active.cluster_id}</div>
            <button onClick={() => setActive(null)} className="text-slate-500 hover:text-white text-sm">×</button>
          </div>
          <div className={`mt-2 text-lg font-semibold severity-${active.severity.toLowerCase()}`}>{active.severity} Zone</div>
          <div className="text-xs font-mono text-slate-400">lat {active.lat.toFixed(5)} · lng {active.lng.toFixed(5)}</div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="border-l-2 border-amber-500 pl-2"><div className="data-label">SCORE</div><div className="text-amber-500 text-xl">{active.score.toFixed(1)}</div></div>
            <div className="border-l-2 border-red-500 pl-2"><div className="data-label">CAPACITY LOSS</div><div className="text-red-400 text-xl">{active.capacity_loss_pct}%</div></div>
            <div className="border-l-2 border-white/20 pl-2"><div className="data-label">VIOLATIONS</div><div className="text-white text-xl">{active.violations}</div></div>
            <div className="border-l-2 border-white/20 pl-2"><div className="data-label">REPEAT IDX</div><div className="text-white text-xl">{active.repeat_index}</div></div>
          </div>
          <div className="mt-4">
            <div className="data-label">PEAK HOURS</div>
            <div className="mt-1 flex gap-2">
              {active.peak_hours.map((h) => <span key={h} className="font-mono text-xs bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-1 rounded">{String(h).padStart(2,"0")}:00</span>)}
            </div>
          </div>
          <div className="mt-3">
            <div className="data-label">TOP VEHICLES</div>
            <div className="mt-1 flex gap-2 flex-wrap">
              {active.top_vehicles.map((v) => <span key={v} className="font-mono text-xs bg-white/5 border border-white/10 text-slate-200 px-2 py-1 rounded">{v}</span>)}
            </div>
          </div>
          {active.junction && (
            <div className="mt-3 text-xs"><span className="data-label">JUNCTION</span><div className="font-mono text-slate-200">{active.junction}</div></div>
          )}
          {active.police_station && (
            <div className="mt-3 text-xs"><span className="data-label">POLICE STATION</span><div className="font-mono text-slate-200">{active.police_station}</div></div>
          )}
        </div>
      )}
    </div>
  );
}
