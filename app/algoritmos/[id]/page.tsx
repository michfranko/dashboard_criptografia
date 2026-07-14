"use client";

import { useParams } from "next/navigation";
import DashboardShell from "../../components/dashboard-shell";

export default function AlgoritmoDetallePage() {
  const params = useParams();
  const algoritmoId =
    typeof params?.id === "string"
      ? params.id.toUpperCase()
      : "DESCONOCIDO";

  return (
    <DashboardShell
      eyebrow="Detalle del algoritmo"
      title={`Detalle de ${algoritmoId}`}
      description={`Vista dinámica para el algoritmo ${algoritmoId}.`}
      badge={algoritmoId}
    >
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-slate-300">
        <p className="text-sm text-slate-400">
          Esta ruta dinámica está funcionando correctamente para el identificador{" "}
          <span className="font-semibold text-white">{algoritmoId}</span>.
        </p>
      </div>
    </DashboardShell>
  );
}
