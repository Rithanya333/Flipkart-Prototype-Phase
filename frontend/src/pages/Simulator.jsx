import { useState } from "react";
import api from "@/lib/api";
import { SIM } from "@/constants/testIds";
import { useAuth } from "@/contexts/AuthContext";
import { Train, Building2, ShoppingBag, Plus, RotateCw, Loader2 } from "lucide-react";

const EVENTS = [
  { key: "metro", title: "Metro Rush", desc: "Sudden surge near a metro station — scooters and 2W spillover.", lat: 12.9762, lng: 77.6033, color: "amber", icon: Train, testid: SIM.metroBtn, intensity: 250 },
  { key: "stadium", title: "Stadium Event", desc: "Cricket match at Chinnaswamy — illegal cars on MG Rd.", lat: 12.9787, lng: 77.5996, color: "red", icon: Building2, testid: SIM.stadiumBtn, intensity: 320 },
  { key: "market", title: "Market Spillover", desc: "Goods-auto and LGV illegal loading near KR Market.", lat: 12.9667, lng: 77.5773, color: "emerald", icon: ShoppingBag, testid: SIM.marketBtn, intensity: 200 },
];

export default function Simulator() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(null);
  const [last, setLast] = useState(null);
  const [lat, setLat] = useState("12.9716");
  const [lng, setLng] = useState("77.5946");
  const [count, setCount] = useState(50);
  const [vehicle, setVehicle] = useState("CAR");
  const [label, setLabel] = useState("Manual Injection");

  const isAdmin = user?.role === "admin";

  async function fireEvent(e) {
    setBusy(e.key);
    try {
      const { data } = await api.post("/simulator/event", { event_type: e.key, lat: e.lat, lng: e.lng, intensity: e.intensity });
      setLast({ kind: e.title, ...data });
    } finally {
      setBusy(null);
    }
  }

  async function inject() {
    setBusy("manual");
    try {
      const { data } = await api.post("/simulator/inject", {
        lat: parseFloat(lat), lng: parseFloat(lng), count: parseInt(count, 10), vehicle_type: vehicle, label,
      });
      setLast({ kind: "Manual Injection", ...data });
    } finally {
      setBusy(null);
    }
  }

  async function reset() {
    setBusy("reset");
    try {
      const { data } = await api.post("/simulator/reset");
      setLast({ kind: "Reset", ...data });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <div className="data-label text-amber-500">/// DEMO SIMULATOR</div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-2">Inject violations. Watch hotspots evolve.</h1>
        <p className="text-slate-400 mt-1 text-sm max-w-2xl">
          Simulate real-world urban events and re-run the pipeline. Every injection re-clusters,
          re-scores, and re-ranks enforcement actions. Useful for tabletop exercises and demo storytelling.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {EVENTS.map((e) => (
          <button
            key={e.key}
            data-testid={e.testid}
            disabled={busy === e.key}
            onClick={() => fireEvent(e)}
            className="glass-panel p-5 text-left hover:border-amber-500/60 transition-all"
          >
            <e.icon className={`h-5 w-5 text-${e.color}-400`} strokeWidth={1.5} />
            <div className="mt-3 text-lg font-semibold">{e.title}</div>
            <div className="text-sm text-slate-400 mt-1">{e.desc}</div>
            <div className="mt-4 text-xs font-mono text-amber-400 flex items-center gap-2">
              {busy === e.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Trigger · +{e.intensity} violations
            </div>
          </button>
        ))}
      </div>

      <div className="glass-panel p-6">
        <div className="data-label">Manual Injection</div>
        <div className="mt-4 grid md:grid-cols-5 gap-4">
          <div>
            <label className="data-label">Latitude</label>
            <input value={lat} onChange={(e)=>setLat(e.target.value)} className="mt-1 w-full bg-black/40 border border-white/10 rounded px-3 py-2 font-mono text-sm focus:border-amber-500" />
          </div>
          <div>
            <label className="data-label">Longitude</label>
            <input value={lng} onChange={(e)=>setLng(e.target.value)} className="mt-1 w-full bg-black/40 border border-white/10 rounded px-3 py-2 font-mono text-sm focus:border-amber-500" />
          </div>
          <div>
            <label className="data-label">Count</label>
            <input value={count} onChange={(e)=>setCount(e.target.value)} type="number" className="mt-1 w-full bg-black/40 border border-white/10 rounded px-3 py-2 font-mono text-sm focus:border-amber-500" />
          </div>
          <div>
            <label className="data-label">Vehicle</label>
            <select value={vehicle} onChange={(e)=>setVehicle(e.target.value)} className="mt-1 w-full bg-black/40 border border-white/10 rounded px-3 py-2 font-mono text-sm focus:border-amber-500">
              {["CAR","SCOOTER","MOTOR CYCLE","PASSENGER AUTO","GOODS AUTO","LGV","BUS (BMTC/KSRTC)"].map(v=> <option key={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="data-label">Label</label>
            <input value={label} onChange={(e)=>setLabel(e.target.value)} className="mt-1 w-full bg-black/40 border border-white/10 rounded px-3 py-2 font-mono text-sm focus:border-amber-500" />
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button data-testid={SIM.injectBtn} disabled={busy==="manual"} onClick={inject} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded px-5 py-2 transition-all disabled:opacity-60 inline-flex items-center gap-2">
            {busy==="manual" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Inject
          </button>
          {isAdmin && (
            <button data-testid={SIM.resetBtn} disabled={busy==="reset"} onClick={reset} className="border border-white/15 hover:border-red-500/60 hover:text-red-400 rounded px-5 py-2 text-sm font-mono uppercase tracking-widest transition-all disabled:opacity-60 inline-flex items-center gap-2">
              {busy==="reset" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />} Reset to Source
            </button>
          )}
        </div>
        {last && (
          <div className="mt-4 border-l-2 border-emerald-500 pl-4 text-sm font-mono text-emerald-300">
            ✓ {last.kind} applied — {last.added ? `${last.added} synthetic events added.` : last.rows ? `Re-seeded ${last.rows} rows.` : "Pipeline recomputed."}
          </div>
        )}
      </div>
    </div>
  );
}
