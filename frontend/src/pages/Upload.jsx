import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { UPLOAD } from "@/constants/testIds";
import { Upload as UploadIcon, FileCheck2, Loader2 } from "lucide-react";

export default function UploadData() {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(null);
  const [schema, setSchema] = useState(null);

  useEffect(() => {
    api.get("/data/schema").then((r) => setSchema(r.data));
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true); setErr(""); setOk(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post("/data/upload", form, { headers: { "Content-Type": "multipart/form-data" } });
      setOk(data);
      const fresh = await api.get("/data/schema");
      setSchema(fresh.data);
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <div className="data-label text-amber-500">/// DATA INGESTION</div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-2">Replace the dataset, re-run the city</h1>
        <p className="text-slate-400 mt-1 text-sm max-w-2xl">
          ParkPulse auto-detects schema. You only need <span className="font-mono text-amber-400">latitude</span>,{" "}
          <span className="font-mono text-amber-400">longitude</span> and a timestamp column. Everything else is optional.
        </p>
      </div>

      <form onSubmit={submit} className="glass-panel p-6">
        <label className="data-label">CSV File</label>
        <input
          type="file"
          accept=".csv,.tsv"
          data-testid={UPLOAD.fileInput}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="mt-2 block w-full text-sm text-slate-200 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-amber-500 file:text-black file:font-semibold hover:file:bg-amber-600"
        />
        <div className="mt-4 flex gap-3">
          <button
            type="submit"
            data-testid={UPLOAD.submitBtn}
            disabled={busy || !file}
            className="bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded px-5 py-2.5 transition-all disabled:opacity-60 inline-flex items-center gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadIcon className="h-4 w-4" />}
            Ingest & Recompute
          </button>
        </div>
        {err && <div className="mt-4 text-sm text-red-400 font-mono">{err}</div>}
        {ok && (
          <div className="mt-4 border-l-2 border-emerald-500 pl-4 text-sm font-mono text-emerald-300">
            ✓ {ok.rows.toLocaleString()} rows ingested · hotspots {JSON.stringify(ok.hotspots)}
          </div>
        )}
      </form>

      <div className="glass-panel p-6">
        <div className="flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-amber-500" /><div className="data-label">CURRENT SCHEMA</div></div>
        <div className="mt-3 text-xs font-mono text-slate-300 grid md:grid-cols-2 gap-3">
          <div>
            <div className="data-label text-amber-500">REQUIRED</div>
            <ul className="mt-1 space-y-0.5">
              {(schema?.required || []).map((c) => <li key={c}>· {c}</li>)}
            </ul>
          </div>
          <div>
            <div className="data-label text-amber-500">OPTIONAL</div>
            <ul className="mt-1 space-y-0.5">
              {(schema?.optional || []).map((c) => <li key={c}>· {c}</li>)}
            </ul>
          </div>
        </div>
        {schema?.detected_source && (
          <div className="mt-4 text-xs font-mono text-slate-500">CURRENT SOURCE: <span className="text-amber-400">{schema.detected_source}</span></div>
        )}
      </div>
    </div>
  );
}
