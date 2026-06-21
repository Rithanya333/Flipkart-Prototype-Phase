import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AUTH, LANDING } from "@/constants/testIds";
import { ShieldCheck, Zap, UserCog } from "lucide-react";

export default function Login() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("admin@parkpulse.ai");
  const [password, setPassword] = useState("ParkPulse@2026");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [demoBusy, setDemoBusy] = useState(null);

  if (user && user !== null && user !== false) {
    const from = location.state?.from || "/app/executive";
    return <Navigate to={from} replace />;
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await login(email, password);
    setBusy(false);
    if (!res.ok) setErr(res.error || "Login failed");
  }

  async function quick(role) {
    setDemoBusy(role);
    setErr("");
    const creds = role === "admin"
      ? { email: "admin@parkpulse.ai", password: "ParkPulse@2026" }
      : { email: "officer@parkpulse.ai", password: "Officer@2026" };
    const res = await login(creds.email, creds.password);
    setDemoBusy(null);
    if (!res.ok) setErr(res.error || "Login failed");
  }

  return (
    <div className="min-h-screen flex bg-[#08080A] text-slate-100">
      <aside className="hidden lg:flex w-1/2 relative grid-bg flex-col justify-between p-12 border-r border-white/5">
        <Link to="/" data-testid={LANDING.loginLink} className="font-semibold tracking-tight text-lg flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-500 pulse-dot text-amber-500" />
          ParkPulse <span className="data-label text-amber-500">AI</span>
        </Link>
        <div>
          <div className="data-label text-amber-500">/// CONTROL ROOM ACCESS</div>
          <h1 className="text-5xl font-bold tracking-tight mt-4 leading-tight">
            Sign in to the<br /> traffic-management<br /> war room.
          </h1>
          <p className="mt-6 text-slate-400 max-w-md leading-relaxed">
            Two demo identities are seeded: an Admin with ingestion + simulator access, and a Field
            Officer with read-only operational views.
          </p>
        </div>
        <div className="font-mono text-xs text-slate-500">
          <div>admin@parkpulse.ai &nbsp;·&nbsp; ParkPulse@2026</div>
          <div className="text-slate-600">officer@parkpulse.ai &nbsp;·&nbsp; Officer@2026</div>
        </div>
      </aside>

      <main className="w-full lg:w-1/2 flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-6">
            <ShieldCheck className="h-5 w-5 text-amber-500" strokeWidth={1.5} />
            <h2 className="text-2xl font-semibold tracking-tight">Officer Sign In</h2>
          </div>

          {/* One-click demo buttons */}
          <div className="mb-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              data-testid="login-quick-admin"
              onClick={() => quick("admin")}
              disabled={demoBusy !== null || busy}
              className="bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-black rounded px-3 py-2.5 text-sm font-semibold transition-all inline-flex items-center justify-center gap-2"
            >
              <Zap className="h-4 w-4" strokeWidth={2} />
              {demoBusy === "admin" ? "Signing in…" : "Demo · Admin"}
            </button>
            <button
              type="button"
              data-testid="login-quick-officer"
              onClick={() => quick("officer")}
              disabled={demoBusy !== null || busy}
              className="border border-amber-500/40 hover:border-amber-500 hover:bg-amber-500/10 disabled:opacity-60 text-amber-300 rounded px-3 py-2.5 text-sm font-semibold transition-all inline-flex items-center justify-center gap-2"
            >
              <UserCog className="h-4 w-4" strokeWidth={1.5} />
              {demoBusy === "officer" ? "Signing in…" : "Demo · Officer"}
            </button>
          </div>
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-white/5" />
            <span className="data-label text-slate-500">OR USE FORM</span>
            <div className="flex-1 h-px bg-white/5" />
          </div>

          <label className="data-label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            data-testid={AUTH.emailInput}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full bg-black/40 border border-white/10 rounded px-4 py-2.5 font-mono text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <label className="data-label mt-5 block" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            data-testid={AUTH.passwordInput}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full bg-black/40 border border-white/10 rounded px-4 py-2.5 font-mono text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          {err && (
            <div data-testid={AUTH.errorMsg} className="mt-4 text-sm text-red-400 font-mono">
              {err}
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            data-testid={AUTH.submitBtn}
            className="mt-6 w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-black font-semibold rounded px-4 py-3 transition-all"
          >
            {busy ? "Authenticating…" : "Sign In"}
          </button>
          <div className="mt-6 text-sm text-slate-400">
            New officer?{" "}
            <Link to="/register" data-testid={AUTH.toggleLink} className="text-amber-400 hover:text-amber-300">
              Request access
            </Link>
          </div>
          <div className="mt-10 text-xs font-mono text-slate-500">
            <Link to="/" className="hover:text-amber-400">← back to dossier</Link>
          </div>
        </form>
      </main>
    </div>
  );
}
