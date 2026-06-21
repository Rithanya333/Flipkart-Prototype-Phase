import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Activity, MapPinned, BrainCircuit, ShieldAlert, Building2, Scale, Zap } from "lucide-react";
import { LANDING } from "@/constants/testIds";
import { useAuth } from "@/contexts/AuthContext";

function Counter({ to, suffix = "", duration = 1600 }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    let start = 0;
    const t0 = performance.now();
    let raf;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      setVal(Math.floor(p * to));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => raf && cancelAnimationFrame(raf);
  }, [to, duration]);
  return (
    <span ref={ref} className="data-value tabular-nums">
      {val.toLocaleString()}
      <span className="text-amber-500">{suffix}</span>
    </span>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [demoBusy, setDemoBusy] = useState(null);

  async function demoLogin(role) {
    setDemoBusy(role);
    const creds = role === "admin"
      ? { email: "admin@parkpulse.ai", password: "ParkPulse@2026" }
      : { email: "officer@parkpulse.ai", password: "Officer@2026" };
    const res = await login(creds.email, creds.password);
    setDemoBusy(null);
    if (res.ok) navigate("/app/executive");
  }
  return (
    <div className="min-h-screen bg-[#08080A] text-slate-100">
      {/* TOP BAR */}
      <header className="border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold tracking-tight text-lg">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500 pulse-dot text-amber-500" />
            ParkPulse <span className="data-label text-amber-500">AI</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-300">
            <a href="#problem" className="hover:text-white">The Problem</a>
            <a href="#approach" className="hover:text-white">Approach</a>
            <a href="#impact" className="hover:text-white">Impact Engine</a>
          </nav>
          <Link
            to="/login"
            data-testid={LANDING.loginLink}
            className="text-sm font-mono uppercase tracking-widest border border-white/10 rounded px-4 py-1.5 hover:border-amber-500 hover:text-amber-400 transition-all"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="relative grid-bg">
        <div className="max-w-7xl mx-auto px-6 pt-24 pb-20">
          <div className="data-label text-amber-500 mb-5">
            // PUBLIC-SAFETY DOSSIER · CASE FILE NO. 24-PRK-001
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.02] max-w-5xl">
            Bengaluru's roads don't suffer from <span className="text-slate-500">too many vehicles.</span>
            <br />
            They suffer from vehicles <span className="text-amber-500">parked in the wrong place.</span>
          </h1>
          <p className="mt-8 text-lg text-slate-300 max-w-3xl leading-relaxed">
            On-street illegal parking and spillover at metro stations, markets and event hubs choke
            carriageways. Enforcement today is patrol-based, reactive, and blind to the city-wide pattern.
            <br />
            <span className="text-slate-400">
              ParkPulse AI turns 3 lakh+ violation records into a live, predictive control room.
            </span>
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <button
              data-testid={LANDING.ctaPrimary}
              onClick={() => demoLogin("admin")}
              disabled={demoBusy !== null}
              className="group bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-black font-semibold rounded px-6 py-3 flex items-center gap-2 transition-all"
            >
              <Zap className="h-4 w-4" strokeWidth={2} />
              {demoBusy === "admin" ? "Signing in…" : "One-Click Admin Demo"}
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" strokeWidth={2} />
            </button>
            <button
              data-testid={LANDING.ctaSecondary}
              onClick={() => demoLogin("officer")}
              disabled={demoBusy !== null}
              className="border border-amber-500/40 hover:border-amber-500 hover:bg-amber-500/10 disabled:opacity-60 rounded px-6 py-3 text-sm font-semibold text-amber-300 transition-all flex items-center gap-2"
            >
              {demoBusy === "officer" ? "Signing in…" : "Sign in as Field Officer"}
            </button>
            <Link
              to="/login"
              className="text-sm text-slate-400 hover:text-amber-300 underline-offset-4 hover:underline transition-all px-2"
            >
              Or use the login form →
            </Link>
          </div>
          <div className="mt-3 font-mono text-xs text-slate-500">
            demo · admin@parkpulse.ai / ParkPulse@2026 &nbsp;·&nbsp; officer@parkpulse.ai / Officer@2026
          </div>

          {/* TICKER */}
          <div className="mt-16 overflow-hidden border-y border-white/5 py-3">
            <div className="flex gap-12 whitespace-nowrap ticker-track font-mono text-xs tracking-widest text-slate-400">
              {[...Array(2)].map((_, k) => (
                <div key={k} className="flex gap-12">
                  <span>WRONG PARKING · KORAMANGALA 100ft RD · 14:22 IST</span>
                  <span className="text-amber-500">CRITICAL · BTP051 SAFINA PLAZA JUNCTION</span>
                  <span>SCOOTER · NEAR ROAD CROSSING · MG ROAD</span>
                  <span className="text-red-400">TOW DEPLOYED · UPPARPET</span>
                  <span>NO PARKING · CITY MARKET · 14:24 IST</span>
                  <span className="text-amber-500">PEAK HOUR · 18:00–20:00 IST</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM FRAMING */}
      <section id="problem" className="border-t border-white/5 py-24">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5">
            <div className="data-label text-amber-500">§ 01 · THE PROBLEM</div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mt-3 leading-tight">
              Patrol-based enforcement<br />
              <span className="text-slate-500">cannot scale to a 13-million-person city.</span>
            </h2>
            <p className="mt-6 text-slate-300 leading-relaxed">
              Bengaluru Traffic Police already issues thousands of parking violations every day. But the
              data sits in challan ledgers — never aggregated, never spatially clustered, never used to
              predict the next chokepoint. Carriageways shrink. Junctions seize. Buses stall.
            </p>
            <p className="mt-4 text-slate-400 leading-relaxed">
              The pain is not a lack of enforcement effort. It is a lack of <span className="text-amber-400">visibility</span>.
            </p>
          </div>
          <div className="lg:col-span-7 grid sm:grid-cols-2 gap-4">
            {[
              { k: "298,449", l: "Violations Analysed", sub: "Jan – May 2024" },
              { k: "2.4M", l: "Estimated Vehicle-Hours Lost / yr", sub: "Bengaluru ITS Study (2023)" },
              { k: "18%", l: "Avg Lane Capacity Loss at Hotspots", sub: "ParkPulse Estimator" },
              { k: "P0 / P1 / P2", l: "Reactive Tiers Replaced", sub: "AI Recommendation Engine" },
            ].map((c) => (
              <div key={c.l} className="glass-panel p-6 border-l-2 border-amber-500/70">
                <div className="text-4xl font-bold font-mono tracking-tighter text-amber-500">{c.k}</div>
                <div className="mt-2 text-sm text-slate-200">{c.l}</div>
                <div className="data-label mt-1">{c.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* APPROACH */}
      <section id="approach" className="border-t border-white/5 py-24 bg-[#0A0A0D]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="data-label text-amber-500">§ 02 · OUR APPROACH</div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mt-3 leading-tight max-w-4xl">
            Treat parking violations as <span className="text-amber-500">spatio-temporal signals</span>, not paperwork.
          </h2>
          <div className="mt-12 grid md:grid-cols-3 gap-4">
            {[
              {
                step: "01",
                icon: MapPinned,
                title: "Cluster the Chaos",
                body: "DBSCAN / HDBSCAN over haversine distance identify recurring offence clusters. K-Means provides comparison baselines for territory planning.",
              },
              {
                step: "02",
                icon: BrainCircuit,
                title: "Quantify the Cost",
                body: "A 4-factor Congestion Impact Score blends density, peak-hour frequency, junction criticality and repeat behaviour. Capacity loss is modelled from vehicle footprint × occupancy duration.",
              },
              {
                step: "03",
                icon: ShieldAlert,
                title: "Recommend the Action",
                body: "XGBoost forecasts the next hour / day / week. Rules + Claude Sonnet 4.5 produce a human-readable enforcement brief: tow, patrol, mobile team, or monitor.",
              },
            ].map((s) => (
              <div key={s.step} className="glass-panel p-6">
                <div className="flex items-center justify-between">
                  <div className="data-label text-amber-500">STEP {s.step}</div>
                  <s.icon className="h-5 w-5 text-amber-500" strokeWidth={1.5} />
                </div>
                <div className="mt-4 text-xl font-semibold">{s.title}</div>
                <p className="mt-3 text-sm text-slate-300 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section id="impact" className="border-t border-white/5 py-24">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12">
          <div>
            <div className="data-label text-amber-500">§ 03 · DESIGNED FOR</div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mt-3 leading-tight">
              A control room.<br />
              <span className="text-slate-500">Not a slide deck.</span>
            </h2>
            <p className="mt-6 text-slate-300 leading-relaxed">
              Every panel is built for a duty officer who needs to act in the next 60 seconds: where to
              dispatch the tow, which junction is unravelling, which sub-station is under-resourced.
              We surface the <span className="text-amber-400">decision</span>, not the data table.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => navigate("/login")}
                className="bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded px-6 py-3 transition-all"
              >
                Sign In to Demo
              </button>
              <button
                onClick={() => demoLogin("admin")}
                disabled={demoBusy !== null}
                className="border border-amber-500/40 hover:border-amber-500 hover:bg-amber-500/10 disabled:opacity-60 rounded px-6 py-3 text-sm font-semibold text-amber-300 transition-all"
              >
                One-click Admin
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: Building2, title: "Traffic Police", sub: "Patrol Routing · Tow Dispatch" },
              { icon: Activity, title: "City Mobility Authority", sub: "Junction Health · KPI Reporting" },
              { icon: Scale, title: "Smart City Cells", sub: "Policy & Capex Prioritisation" },
              { icon: BrainCircuit, title: "Research / NGOs", sub: "Open Methodology · Reproducible" },
            ].map((p) => (
              <div key={p.title} className="glass-panel p-5">
                <p.icon className="h-5 w-5 text-amber-500" strokeWidth={1.5} />
                <div className="mt-3 font-semibold">{p.title}</div>
                <div className="data-label mt-1">{p.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS STRIP */}
      <section className="border-t border-white/5 bg-[#0A0A0D] py-14">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { k: 298449, l: "Records Ingested" },
            { k: 60, l: "Police Stations", suffix: "+" },
            { k: 5, l: "Months Analysed" },
            { k: 4, l: "ML Algorithms" },
          ].map((c) => (
            <div key={c.l} className="border-l-2 border-amber-500 pl-4">
              <div className="text-3xl md:text-4xl font-bold">
                <Counter to={c.k} suffix={c.suffix || ""} />
              </div>
              <div className="data-label mt-2">{c.l}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/5 py-10">
        <div className="max-w-7xl mx-auto px-6 text-xs text-slate-500 font-mono">
          // PARKPULSE AI · BUILT FOR INDIAN SMART-CITY CONTROL ROOMS
        </div>
      </footer>
    </div>
  );
}
