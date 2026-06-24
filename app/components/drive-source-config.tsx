"use client";

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
    Promise.resolve().then(()=>{
      setSources(getConfiguredDriveSources());
    });
  }, []);

  const handleChange = (key: keyof DriveSourceMap) => (event: ChangeEvent<HTMLInputElement>) => {
    setSources((current) => ({ ...current, [key]: event.target.value }));
  };

  const handleSave = () => {
    saveDriveSourceConfig(sources);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  };

  const handleLoadDemo = () => {
    const demoSources: DriveSourceMap = {
      aesMetrics: "https://drive.google.com/file/d/10wE7WmEiEw9rhcF4FFz-KO8JaRtrquRk/view?usp=sharing",
      rsaMetrics: "https://drive.google.com/file/d/10PyWMgywTfCNRfkqPgHgBya4ZrVyrXRq/view?usp=sharing",
      md5Metrics: "https://drive.google.com/file/d/1fuvVguuDdaGzl5gd8JmcyEZraLWIim8d/view?usp=sharing",
      shaMetrics: "https://drive.google.com/file/d/1JPqFnnAgIJhGKqZY91wjzkOqbW3WBTdY/view?usp=sharing",
      vulnerability: "https://drive.google.com/file/d/1h4lLUnFpqTcS9TPRpMJVETJv31UbJvkG/view?usp=sharing",
      aesBenchmark: "https://drive.google.com/file/d/1I88HI2tv0qOqxbfLC_5BYTHt1NBywWMw/view?usp=sharing",
      rsaBenchmark: "https://drive.google.com/file/d/1Pr0mlJUtQbacIIgL61rgo3L9ryNIfgHf/view?usp=sharing",
      hashesBenchmark: "https://drive.google.com/file/d/1qE7bV1P71sno5q8NzZt3nxP-0IiNI8UL/view?usp=sharing",
    };
    setSources(demoSources);
  };

  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Fuentes CSV</p>
          <p className="mt-2 text-sm leading-7 text-slate-400">
            Guarda aquí los enlaces públicos de tus CSV para alimentar las visualizaciones automáticamente.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleLoadDemo}
            className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-400/10"
          >
            Cargar Demo
          </button>
          <button
            onClick={handleSave}
            className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-400/20"
          >
            {saved ? "Guardado" : "Guardar fuentes"}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        {sourceFields.map((field) => {
          const hasUrl = Boolean(sources[field.key]?.trim());
          const isValidDrive = sources[field.key]?.includes("drive.google.com");

          return (
            <label key={field.key} className="flex flex-col gap-2 text-sm text-slate-300">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-200">{field.label}</span>
                {hasUrl ? (
                  isValidDrive ? (
                    <span className="text-xs text-emerald-400 flex items-center gap-1">● Conectado (Drive)</span>
                  ) : (
                    <span className="text-xs text-amber-400 flex items-center gap-1">▲ Enlace no reconocido</span>
                  )
                ) : (
                  <span className="text-xs text-slate-500">○ Vacío</span>
                )}
              </div>
              <input
                value={sources[field.key] ?? ""}
                onChange={handleChange(field.key)}
                placeholder={field.placeholder}
                className={`rounded-2xl border bg-slate-950/70 px-4 py-3 text-sm text-slate-200 outline-none ring-0 transition-colors ${
                  hasUrl ? (isValidDrive ? "border-emerald-500/20" : "border-amber-500/20") : "border-white/10"
                }`}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}