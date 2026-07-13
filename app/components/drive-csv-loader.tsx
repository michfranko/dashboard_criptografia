/*"use client";

import { useState } from "react";
import { parseCsv } from "../lib/csv-analytics";

export default function DriveCsvLoader() {
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string[]>([]);
  const [stats, setStats] = useState<{ rows: number; columns: number } | null>(null);

  const handleLoad = async () => {
    if (!link.trim()) {
      setError("Pega un enlace compartido de Google Drive para cargar un CSV.");
      return;
    }

    setLoading(true);
    setError(null);
    setPreview([]);
    setStats(null);

    try {
      const response = await fetch(`/api/drive-csv?url=${encodeURIComponent(link)}`);
      const payload = await response.json();

      if (!response.ok || payload?.error) {
        throw new Error(payload?.error ?? "No fue posible cargar el archivo.");
      }

      const csvData = parseCsv(payload?.data ?? "");
      const rows = csvData.rows
        .slice(0, 8)
        .map((row) => Object.values(row).join(" | "));

      setPreview(rows);
      setStats({ rows: csvData.rows.length, columns: csvData.headers.length });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible cargar el archivo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
      <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Cargador de CSV desde Drive</p>
      <p className="mt-3 text-sm leading-7 text-slate-400">
        Puedes pegar aquí un enlace compartido de un archivo CSV de Google Drive para visualizar una vista previa en la plataforma.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <input
          value={link}
          onChange={(event) => setLink(event.target.value)}
          placeholder="https://drive.google.com/file/d/.../view"
          className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200 outline-none ring-0"
        />
        <button
          onClick={handleLoad}
          className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/20"
          disabled={loading}
        >
          {loading ? "Cargando..." : "Cargar CSV"}
        </button>
      </div>

      {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}

      {stats ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-sm text-slate-300">
            Registros: {stats.rows}
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-sm text-slate-300">
            Columnas: {stats.columns}
          </div>
        </div>
      ) : null}

      {preview.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <p className="text-sm text-emerald-300">Vista previa</p>
          <pre className="mt-3 overflow-x-auto text-xs leading-6 text-slate-400">
            {preview.join("\n")}
          </pre>
        </div>
      ) : null}
    </div>
  );
}*/
