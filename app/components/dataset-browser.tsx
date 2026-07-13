/*"use client";

import { useEffect, useState } from "react";

type DatasetFile = {
  name: string;
  path: string;
};

type DatasetPayload = {
  directory: string | null;
  files: DatasetFile[];
  count: number;
  source?: string;
  message?: string | null;
};

export default function DatasetBrowser() {
  const [payload, setPayload] = useState<DatasetPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dataset-files")
      .then((response) => response.json())
      .then((data) => {
        setPayload(data);
        setLoading(false);
      })
      .catch(() => {
        setPayload({ directory: null, files: [], count: 0 });
        setLoading(false);
      });
  }, []);

  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
      <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Explorador de datasets</p>
      <p className="mt-3 text-sm leading-7 text-slate-400">
        La plataforma intenta leer la carpeta compartida de Google Drive que proporcionaste y, si no encuentra archivos, revisa la carpeta local crypto_analysis_output.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Buscando archivos CSV...</p>
      ) : payload?.count ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-emerald-300">Se encontraron {payload.count} archivos CSV.</p>
          {payload.message ? <p className="text-xs text-slate-500">{payload.message}</p> : null}
          <div className="space-y-2">
            {payload.files.map((file) => (
              <div key={file.path} className="rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-sm text-slate-300">
                {file.name}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-slate-950/70 p-4 text-sm text-slate-500">
          <p>Aún no se encontraron archivos CSV automáticamente.</p>
          {payload?.message ? <p className="mt-2 text-xs text-slate-400">{payload.message}</p> : null}
          <p className="mt-2">Si la carpeta de Google Drive es pública, puedes pegar un enlace directo a un archivo CSV en el cargador de abajo para visualizarlo.</p>
        </div>
      )}
    </div>
  );
}*/
