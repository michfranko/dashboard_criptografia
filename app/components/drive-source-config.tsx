/*"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { getConfiguredDriveSources, saveDriveSourceConfig, type DriveSourceMap } from "../lib/csv-analytics";

const sourceFields: Array<{ key: keyof DriveSourceMap; label: string; placeholder: string }> = [
  { key: "aesMetrics", label: "AES metrics", placeholder: "https://drive.google.com/file/d/.../view" },
  { key: "rsaMetrics", label: "RSA metrics", placeholder: "https://drive.google.com/file/d/.../view" },
  { key: "md5Metrics", label: "MD5 metrics", placeholder: "https://drive.google.com/file/d/.../view" },
  { key: "shaMetrics", label: "SHA-256 metrics", placeholder: "https://drive.google.com/file/d/.../view" },
  { key: "vulnerability", label: "Vulnerabilidad", placeholder: "https://drive.google.com/file/d/.../view" },
  { key: "aesBenchmark", label: "Benchmark AES", placeholder: "https://drive.google.com/file/d/.../view" },
  { key: "rsaBenchmark", label: "Benchmark RSA", placeholder: "https://drive.google.com/file/d/.../view" },
  { key: "hashesBenchmark", label: "Benchmark hashes", placeholder: "https://drive.google.com/file/d/.../view" },
];

export default function DriveSourceConfig() {
  const [sources, setSources] = useState<Partial<DriveSourceMap>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSources(getConfiguredDriveSources());
  }, []);

  const handleChange = (key: keyof DriveSourceMap) => (event: ChangeEvent<HTMLInputElement>) => {
    setSources((current) => ({ ...current, [key]: event.target.value }));
  };

  const handleSave = () => {
    saveDriveSourceConfig(sources);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Fuentes CSV</p>
          <p className="mt-2 text-sm leading-7 text-slate-400">
            Guarda aquí los enlaces públicos de tus CSV para que las páginas de algoritmos, fuerza bruta y probabilidad se alimenten automáticamente.
          </p>
        </div>
        <button
          onClick={handleSave}
          className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-400/20"
        >
          {saved ? "Guardado" : "Guardar fuentes"}
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        {sourceFields.map((field) => (
          <label key={field.key} className="flex flex-col gap-2 text-sm text-slate-300">
            <span>{field.label}</span>
            <input
              value={sources[field.key] ?? ""}
              onChange={handleChange(field.key)}
              placeholder={field.placeholder}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200 outline-none ring-0"
            />
          </label>
        ))}
      </div>
    </div>
  );
}*/
