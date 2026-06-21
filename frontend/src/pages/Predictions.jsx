import { useEffect, useState } from "react";
import api from "@/lib/api";
import { PRED } from "@/constants/testIds";
import { LineChart, Line, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar } from "recharts";
import { BrainCircuit, Clock } from "lucide-react";

const TABS = [
  { key: "hour", label: "Next Hour", testid: PRED.horizonHour },
  { key: "day", label: "Next 7 Days", testid: PRED.horizonDay },
  { key: "week", label: "Next 4 Weeks", testid: PRED.horizonWeek },
];

export default function Predictions() {
  const [horizon, setHorizon] = useState("hour");
  const [data, setData] = useState(null);
  const [feat, setFeat] = useState(null);

  useEffect(() => {
    api.get(`/predictions?horizon=${horizon}`).then((r) => setData(r.data));
  }, [horizon]);

  useEffect(() => {
    api.get(`/predictions/feature-importance`).then((r) => setFeat(r.data));
  }, []);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="data-label text-amber-500">/// FORECAST · XGBOOST</div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-2">Where the next hotspot will appear</h1>
          <p className="text-slate-400 mt-1 text-sm">
            Probability that a (station × day-of-week × hour) cell will fall in the top quartile of violations.
          </p>
        </div>
        <div className="flex gap-1 bg-black/40 p-1 rounded border border-white/10">
          {TABS.map((t) => (
            <button
              key={t.key}
              data-testid={t.testid}
              onClick={() => setHorizon(t.key)}
              className={`px-4 py-2 text-xs font-mono uppercase tracking-widest rounded transition ${
                horizon === t.key ? "bg-amber-500 text-black" : "text-slate-300 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="glass-panel p-5 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" strokeWidth={1.5} />
            <div className="data-label">Predicted Intensity Curve</div>
          </div>
          <div className="h-72 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.series || []} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="label" stroke="#475569" tick={{ fontFamily: "JetBrains Mono", fontSize: 11 }} />
                <YAxis stroke="#475569" tick={{ fontFamily: "JetBrains Mono", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#0B0B0E", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "JetBrains Mono", fontSize: 12 }} />
                <Line type="monotone" dataKey="intensity" stroke="#F59E0B" strokeWidth={2} dot={{ fill: "#F59E0B", r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass-panel p-5">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-amber-500" strokeWidth={1.5} />
            <div className="data-label">Feature Importance</div>
          </div>
          <div className="mt-4 space-y-3">
            {feat && Object.entries(feat.importance || {}).map(([k, v]) => (
              <div key={k}>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300">{k.replace("_", " ").toUpperCase()}</span>
                  <span className="text-amber-400">{(v * 100).toFixed(1)}%</span>
                </div>
                <div className="mt-1 h-1.5 bg-white/5 rounded">
                  <div className="h-full bg-amber-500 rounded" style={{ width: `${Math.max(2, v * 100)}%` }} />
                </div>
              </div>
            ))}
            {feat?.threshold !== undefined && (
              <div className="pt-3 border-t border-white/5 text-xs font-mono text-slate-500">
                Hot threshold ≥ <span className="text-amber-400">{feat.threshold.toFixed(1)}</span> violations per cell
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="glass-panel p-5">
        <div className="data-label">Top Predicted Risk · Stations</div>
        <div className="h-80 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.rankings || []} layout="vertical" margin={{ top: 4, right: 24, left: 80, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
              <XAxis type="number" stroke="#475569" tick={{ fontFamily: "JetBrains Mono", fontSize: 11 }} domain={[0, 1]} />
              <YAxis type="category" dataKey="police_station" stroke="#475569" tick={{ fontFamily: "JetBrains Mono", fontSize: 11 }} width={120} />
              <Tooltip contentStyle={{ background: "#0B0B0E", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "JetBrains Mono", fontSize: 12 }} />
              <Bar dataKey="probability" fill="#EF4444" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
