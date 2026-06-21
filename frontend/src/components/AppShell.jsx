import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { NAV } from "@/constants/testIds";
import {
  Activity, Map, BrainCircuit, Siren, BarChart3, FlaskConical,
  Upload as UploadIcon, LogOut, FileScan
} from "lucide-react";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { to: "/app/executive", label: "Executive", icon: Activity, testid: NAV.executive },
  { to: "/app/map", label: "Hotspot Map", icon: Map, testid: NAV.map },
  { to: "/app/predictions", label: "Prediction", icon: BrainCircuit, testid: NAV.predictions },
  { to: "/app/enforcement", label: "Enforcement", icon: Siren, testid: NAV.enforcement },
  { to: "/app/analytics", label: "Analytics", icon: BarChart3, testid: NAV.analytics },
  { to: "/app/simulator", label: "Simulator", icon: FlaskConical, testid: NAV.simulator },
  { to: "/app/upload", label: "Ingest", icon: UploadIcon, testid: NAV.upload, adminOnly: true },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen flex bg-[#08080A] text-slate-100">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-white/5 bg-black/40 backdrop-blur flex flex-col">
        <div className="px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <FileScan className="h-5 w-5 text-amber-500" strokeWidth={1.5} />
            <span className="font-semibold tracking-tight text-lg">ParkPulse</span>
            <span className="data-label text-amber-500">AI</span>
          </div>
          <div className="data-label mt-2">Control Room v1.0</div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {NAV_ITEMS.filter((n) => !n.adminOnly || user?.role === "admin").map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              data-testid={n.testid}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2 rounded text-sm transition-all border-l-2 ${
                  isActive
                    ? "border-amber-500 bg-amber-500/10 text-white"
                    : "border-transparent text-slate-400 hover:text-white hover:bg-white/5"
                }`
              }
            >
              <n.icon className="h-4 w-4" strokeWidth={1.5} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/5 space-y-2">
          <div className="text-xs text-slate-400">
            <div className="font-mono text-white">{user?.name}</div>
            <div className="font-mono uppercase tracking-widest text-[10px] text-amber-500">{user?.role}</div>
          </div>
          <button
            data-testid={NAV.logout}
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 text-xs font-mono tracking-widest uppercase border border-white/10 hover:border-red-500/60 hover:text-red-400 text-slate-300 rounded py-2 transition-all"
          >
            <LogOut className="h-3 w-3" strokeWidth={1.5} /> Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-white/5 px-6 flex items-center justify-between bg-black/30">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="data-label">PATH</span>
            <span className="font-mono text-slate-200">{location.pathname}</span>
          </div>
          <div className="flex items-center gap-6 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="pulse-dot text-emerald-400 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="data-label">LIVE</span>
            </div>
            <span className="text-slate-200 tabular-nums">{clock.toUTCString().split(" ").slice(0,5).join(" ")}</span>
          </div>
        </header>
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
