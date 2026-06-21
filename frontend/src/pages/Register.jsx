import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AUTH } from "@/constants/testIds";
import { ShieldCheck } from "lucide-react";

export default function Register() {
  const { user, register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (user && user !== null && user !== false) return <Navigate to="/app/executive" replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await register({ name, email, password, role: "officer" });
    setBusy(false);
    if (!res.ok) setErr(res.error);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#08080A] text-slate-100 p-6">
      <form onSubmit={submit} className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="h-5 w-5 text-amber-500" strokeWidth={1.5} />
          <h2 className="text-2xl font-semibold tracking-tight">Request Officer Access</h2>
        </div>
        <p className="text-slate-400 text-sm mb-6">
          Field-officer credentials are read-only for the demo. Admin access is provisioned manually.
        </p>

        <label className="data-label">Full Name</label>
        <input
          data-testid={AUTH.nameInput}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full bg-black/40 border border-white/10 rounded px-4 py-2.5 font-mono text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
        <label className="data-label mt-4 block">Email</label>
        <input
          data-testid={AUTH.emailInput}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full bg-black/40 border border-white/10 rounded px-4 py-2.5 font-mono text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
        <label className="data-label mt-4 block">Password</label>
        <input
          data-testid={AUTH.passwordInput}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full bg-black/40 border border-white/10 rounded px-4 py-2.5 font-mono text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
        {err && <div data-testid={AUTH.errorMsg} className="mt-4 text-sm text-red-400 font-mono">{err}</div>}
        <button
          type="submit"
          disabled={busy}
          data-testid={AUTH.submitBtn}
          className="mt-6 w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-black font-semibold rounded px-4 py-3 transition-all"
        >
          {busy ? "Provisioning…" : "Create Account"}
        </button>
        <div className="mt-6 text-sm text-slate-400">
          Already onboarded?{" "}
          <Link to="/login" data-testid={AUTH.toggleLink} className="text-amber-400 hover:text-amber-300">Sign in</Link>
        </div>
      </form>
    </div>
  );
}
