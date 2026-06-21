import { useEffect, useState } from "react";
import api from "@/lib/api";
import { EXEC } from "@/constants/testIds";
import { Activity, AlertOctagon, Crosshair, Gauge, MapPin, Sparkles, TrendingDown } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

function KPI({ label, value, sub, icon: Icon, accent = "amber", testid }) {
  const accents = {
    amber: "border-amber-500 text-amber-500",
    red: "border-red-500 text-red-400",
    emerald: "border-emerald-500 text-emerald-400",
    blue: "border-sky-500 text-sky-400",
  };
  return (
    <div className={`glass-panel p-5 border-l-2 ${accents[accent]}`}>
      <div className="flex items-center justify-between">
        <div className="data-label">{label}</div>
        <Icon className="h-4 w-4 opacity-80" strokeWidth={1.5} />
      </div>
      <div data-testid={testid} className="mt-3 text-4xl font-bold font-mono tabular-nums text-white tracking-tighter">{value}</div>
      {sub && <div className="data-label mt-2 text-slate-500">{sub}</div>}
    </div>
  );
}

const num = (n) => (n ?? 0).toLocaleString();

export default function Executive() {
  const [kpi, setKpi] = useState(null);
  const [hourly, setHourly] = useState([]);
  const [stations, setStations] = useState([]);
  const [enf, setEnf] = useState([]);

  useEffect(() => {
    let cancel = false;
    async function load() {
      try {
        const [k, h, s, q] = await Promise.all([
          api.get("/exec/kpi"),
          api.get("/analytics/hourly"),
          api.get("/analytics/police-station"),
          api.get("/enforcement/queue?limit=5"),
        ]);
        if (cancel) return;
        setKpi(k.data);
        setHourly(h.data.data);
        setStations(s.data.data);
        setEnf(q.data.items);
      } catch (e) {
        console.error(e);
      }
    }
    load();
    return () => { cancel = true; };
  }, []);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <div className="data-label text-amber-500">/// EXECUTIVE OVERVIEW · LIVE</div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-2">City-wide parking pressure</h1>
        <p className="text-slate-400 mt-1 text-sm">
          One dataset, one dashboard, one decision per minute.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPI testid={EXEC.totalViolations} label="Total Violations" value={num(kpi?.total_violations)}
             sub={kpi?.date_min ? `${kpi.date_min.slice(0,10)} → ${kpi.date_max?.slice(0,10)}` : ""}
             icon={Activity} accent="amber" />
        <KPI testid={EXEC.activeHotspots} label="Active Hotspots" value={num(kpi?.active_hotspots)}
             sub="DBSCAN · 80m kernel" icon={Crosshair} accent="amber" />
        <KPI testid={EXEC.criticalZones} label="Critical Zones" value={num(kpi?.critical_zones)}
             sub="Score ≥ 70 / 100" icon={AlertOctagon} accent="red" />
        <KPI testid={EXEC.avgScore} label="Avg Impact Score" value={(kpi?.avg_congestion_score ?? 0).toFixed(1)}
             sub="0 – 100 normalised" icon={Gauge} accent="amber" />
        <KPI testid={EXEC.capacityLoss} label="Avg Capacity Loss" value={`${(kpi?.avg_capacity_loss_pct ?? 0).toFixed(1)}%`}
             sub="Lane-metre-hours / 3-lane corridor" icon={TrendingDown} accent="red" />
        <KPI label="Predicted Hot (24h)" value={num(kpi?.predicted_hotspots_next_24h)}
             sub="XGBoost · station × DOW × hour" icon={Sparkles} accent="emerald" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="glass-panel p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="data-label">Hourly Pulse · Violations by Hour-of-Day</div>
            <div className="data-label text-amber-500">UTC+5:30</div>
          </div>
          <div className="h-72 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="hour" stroke="#475569" tick={{ fontFamily: "JetBrains Mono", fontSize: 11 }} />
                <YAxis stroke="#475569" tick={{ fontFamily: "JetBrains Mono", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#0B0B0E", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "JetBrains Mono", fontSize: 12 }} cursor={{ fill: "rgba(245,158,11,0.06)" }} />
                <Bar dataKey="violations" fill="#F59E0B" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass-panel p-5">
          <div className="flex items-center justify-between">
            <div className="data-label">Top Stations</div>
            <MapPin className="h-4 w-4 text-amber-500" strokeWidth={1.5} />
          </div>
          <ul className="mt-4 space-y-2">
            {stations.slice(0, 8).map((s, i) => (
              <li key={s.label} className="flex items-center justify-between text-sm border-b border-white/5 pb-2 last:border-0">
                <span className="flex items-center gap-2">
                  <span className="data-label w-6 text-amber-500">{String(i+1).padStart(2,"0")}</span>
                  <span className="text-slate-200">{s.label}</span>
                </span>
                <span className="font-mono text-amber-400 tabular-nums">{s.violations.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="glass-panel p-5">
        <div className="flex items-center justify-between">
          <div className="data-label">Top 5 enforcement actions queued right now</div>
          <span className="data-label text-amber-500">P0 · P1 · P2</span>
        </div>
        <table className="w-full mt-4 text-sm">
          <thead>
            <tr className="data-label text-left">
              <th className="py-2">Rank</th><th>Severity</th><th>Score</th><th>Cap.Loss</th><th>Junction / Station</th><th>Action</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {enf.map((r) => (
              <tr key={r.rank} className="border-t border-white/5 hover:bg-white/[0.02]">
                <td className="py-2 text-amber-500">#{String(r.rank).padStart(2,"0")}</td>
                <td className={`severity-${r.severity.toLowerCase()}`}>{r.severity.toUpperCase()}</td>
                <td className="tabular-nums">{r.score.toFixed(1)}</td>
                <td className="tabular-nums">{r.capacity_loss_pct.toFixed(1)}%</td>
                <td className="text-slate-200 text-xs">{r.junction || r.police_station || "—"}</td>
                <td className="text-slate-100">{r.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
