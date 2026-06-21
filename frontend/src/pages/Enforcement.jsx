import { useEffect, useState } from "react";
import api from "@/lib/api";
import { ENF } from "@/constants/testIds";
import { Siren, Sparkles, Loader2 } from "lucide-react";

const sevClass = {
  Critical: "text-red-400 border-red-500/40 bg-red-500/10",
  High: "text-amber-400 border-amber-500/40 bg-amber-500/10",
  Moderate: "text-yellow-400 border-yellow-500/30 bg-yellow-500/5",
  Low: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5",
};

const priorityClass = {
  P0: "bg-red-500 text-black",
  P1: "bg-amber-500 text-black",
  P2: "bg-yellow-400 text-black",
  P3: "bg-emerald-500 text-black",
};

export default function Enforcement() {
  const [items, setItems] = useState([]);
  const [narrative, setNarrative] = useState({});
  const [busy, setBusy] = useState({});

  useEffect(() => {
    api.get("/enforcement/queue?limit=20").then((r) => setItems(r.data.items));
  }, []);

  async function generate(hot) {
    setBusy((b) => ({ ...b, [hot.hotspot_id]: true }));
    try {
      const { data } = await api.post(`/enforcement/${hot.hotspot_id}/narrative`);
      setNarrative((n) => ({ ...n, [hot.hotspot_id]: data }));
    } catch (e) {
      setNarrative((n) => ({ ...n, [hot.hotspot_id]: { narrative: "Failed to generate brief.", action: hot.action, score: hot.score, expected_reduction_pct: hot.expected_reduction_pct } }));
    } finally {
      setBusy((b) => ({ ...b, [hot.hotspot_id]: false }));
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <div className="data-label text-amber-500">/// ENFORCEMENT QUEUE · LIVE</div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-2 flex items-center gap-3">
          <Siren className="h-7 w-7 text-red-400" strokeWidth={1.5} /> Priority dispatch
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          AI ranks hotspots by impact, recommends an action, and explains why — in two sentences,
          ready to read into the radio.
        </p>
      </div>

      <div className="space-y-3">
        {items.map((it) => (
          <div key={it.hotspot_id} data-testid={ENF.queueRow} className="glass-panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <span className={`font-mono text-xs px-2 py-1 rounded ${priorityClass[it.priority]}`}>{it.priority}</span>
                  <span className={`font-mono text-xs uppercase tracking-widest border px-2 py-1 rounded ${sevClass[it.severity]}`}>{it.severity}</span>
                  <span className="text-slate-300 font-mono text-xs">RANK #{String(it.rank).padStart(2,"0")}</span>
                </div>
                <div className="mt-3 text-lg font-semibold">
                  {it.action}
                </div>
                <div className="text-slate-400 text-sm mt-1 font-mono">
                  {it.junction || it.police_station || "—"} · lat {it.lat.toFixed(4)} · lng {it.lng.toFixed(4)}
                </div>
                <div className="mt-3 flex gap-2 flex-wrap text-xs font-mono">
                  {it.top_vehicles.slice(0,3).map((v) => (
                    <span key={v} className="bg-white/5 border border-white/10 text-slate-300 px-2 py-1 rounded">{v}</span>
                  ))}
                  {it.peak_hours.slice(0,2).map((h) => (
                    <span key={h} className="bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-1 rounded">
                      {String(h).padStart(2,"0")}:00 peak
                    </span>
                  ))}
                </div>
                {narrative[it.hotspot_id] && (
                  <div data-testid={ENF.narrativeBox} className="mt-4 border-l-2 border-amber-500 pl-4 py-2 bg-amber-500/5 rounded-r text-sm text-slate-200 leading-relaxed">
                    <div className="data-label text-amber-500 mb-1">AI BRIEF</div>
                    {narrative[it.hotspot_id].narrative}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3 text-center min-w-[280px]">
                <div>
                  <div className="data-label">SCORE</div>
                  <div className="text-2xl font-bold font-mono text-amber-400">{it.score.toFixed(1)}</div>
                </div>
                <div>
                  <div className="data-label">CAP. LOSS</div>
                  <div className="text-2xl font-bold font-mono text-red-400">{it.capacity_loss_pct.toFixed(0)}%</div>
                </div>
                <div>
                  <div className="data-label">REDUCTION</div>
                  <div className="text-2xl font-bold font-mono text-emerald-400">{it.expected_reduction_pct}%</div>
                </div>
                <button
                  data-testid={ENF.narrativeBtn}
                  onClick={() => generate(it)}
                  disabled={busy[it.hotspot_id]}
                  className="col-span-3 mt-1 inline-flex items-center justify-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded px-3 py-2 text-xs font-mono uppercase tracking-widest transition-all disabled:opacity-60"
                >
                  {busy[it.hotspot_id] ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} /> : <Sparkles className="h-3 w-3" strokeWidth={2} />}
                  Generate AI Brief
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
