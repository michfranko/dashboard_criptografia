"use client";

import DashboardShell from "../components/dashboard-shell";
import DriveCsvLoader from "../components/drive-csv-loader";
import DriveSourceConfig from "../components/drive-source-config";
import MetricCard from "../components/metric-card";
import VisualPanel from "../components/visual-panel";

const columns = [
  "id",
  "algoritmo",
  "longitud_clave",
  "tiempo_cifrado",
  "tiempo_descifrado",
  "tamaño_salida",
  "entropia",
  "nivel_riesgo",
];

export default function DatasetPage() {
  return (
    <DashboardShell
      eyebrow="Módulo académico"
      title="Dataset experimental"
      description="Se muestra la estructura de los datos utilizados para alimentar las visualizaciones y análisis del proyecto."
      badge="Datos históricos"
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        
        <div className="space-y-6">
          <DriveSourceConfig />
          <DriveCsvLoader />
        </div>


        <div className="space-y-6">
            <VisualPanel title="Conexión con Google Drive" subtitle="Cómo obtener los datos">
            <div className="space-y-3 text-sm leading-7 text-slate-400">
              <p>1. Comparte el archivo CSV en Google Drive con acceso para cualquiera que tenga el enlace.</p>
              <p>2. Usa el enlace compartido o el ID del archivo en la ruta interna del proyecto.</p>
              <p>3. El sistema consulta un endpoint propio para descargar el CSV y prepararlo para la visualización.</p>
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-xs text-slate-500 break-all">
                Ejemplo de URL compatible: https://drive.google.com/file/d/ID_DEL_ARCHIVO/view
              </div>
            </div>
          </VisualPanel>

          <VisualPanel title="Estructura" subtitle="Columnas del dataset">
            <div className="grid gap-3 sm:grid-cols-2">
              {columns.map((column) => (
                <div key={column} className="rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-sm text-slate-300">
                  {column}
                </div>
              ))}
            </div>
          </VisualPanel>

          <VisualPanel title="Resumen" subtitle="Uso de los datos">
            <div className="space-y-4 text-sm leading-7 text-slate-400">
              <MetricCard label="Fuente" value="CSV" detail="Almacenados desde Google Drive" accent="text-cyan-200" />
              <MetricCard label="Uso principal" value="Visualización" detail="Análisis estadístico y comparativo" accent="text-emerald-200" />
              <p>Las muestras se agrupan según algoritmo, tamaño de entrada, complejidad de la contraseña y tiempo de ejecución.</p>
            </div>
          </VisualPanel>
        </div>
        
      </div>
    </DashboardShell>
  );
}