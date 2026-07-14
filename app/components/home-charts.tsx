"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type ComparisonData = {
  name: string;
  tiempo: number;
  exito: number;
};

type HomeChartsProps = {
  comparisonData: ComparisonData[];
  totalSuccessful: number;
  totalFailed: number;
};

const COLORS = ["#10b981", "#ef4444"]; // emerald (success), rose (failed)

export default function HomeCharts({ comparisonData, totalSuccessful, totalFailed }: HomeChartsProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="grid gap-6 min-h-[300px] items-center justify-center text-slate-500">
        Cargando gráficos interactivos...
      </div>
    );
  }

  const pieData = [
    { name: "Ataques Exitosos", value: totalSuccessful },
    { name: "Ataques Fallidos", value: totalFailed },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
      {/* Gráfico 1: Comparación de Tiempo vs Tasa de Éxito */}
      <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5 shadow-[0_0_50px_rgba(15,23,42,0.25)] flex flex-col justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Rendimiento vs Seguridad</p>
          <h3 className="mt-2 text-lg font-semibold text-white">Tiempo de Ruptura y Tasa de Éxito</h3>
          <p className="text-xs text-slate-400 mt-1">
            AES presenta el tiempo máximo de resistencia y 0% de éxito, mientras que RSA es quebrado en menos de un segundo con una tasa del 55.56%.
          </p>
        </div>

        <div className="h-[320px] w-full mt-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={comparisonData}
              margin={{ top: 20, right: -5, left: -20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
              
              {/* Eje Izquierdo: Tiempo en segundos */}
              <YAxis
                yAxisId="left"
                orientation="left"
                stroke="#22d3ee"
                fontSize={11}
                tickLine={false}
                label={{
                  value: "Tiempo Promedio (s)",
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "#22d3ee", fontSize: 10, textAnchor: "middle" },
                  offset: 0
                }}
              />
              
              {/* Eje Derecho: Tasa de Éxito % */}
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#a855f7"
                fontSize={11}
                tickLine={false}
                domain={[0, 100]}
                label={{
                  value: "Tasa de Éxito (%)",
                  angle: 90,
                  position: "insideRight",
                  style: { fill: "#a855f7", fontSize: 10, textAnchor: "middle" },
                  offset: 0
                }}
              />

              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderRadius: "16px",
                  borderColor: "rgba(255,255,255,0.1)",
                  color: "#f1f5f9",
                  fontSize: 12,
                }}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              <Legend
                verticalAlign="top"
                height={36}
                iconType="circle"
                wrapperStyle={{ fontSize: 11 }}
              />
              
              <Bar
                yAxisId="left"
                name="Tiempo Promedio de Crackeo (s)"
                dataKey="tiempo"
                fill="#22d3ee"
                radius={[6, 6, 0, 0]}
                barSize={32}
              />
              <Bar
                yAxisId="right"
                name="Tasa de Éxito de Ataques (%)"
                dataKey="exito"
                fill="#a855f7"
                radius={[6, 6, 0, 0]}
                barSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráfico 2: Proporción agregada de ataques */}
      <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5 shadow-[0_0_50px_rgba(15,23,42,0.25)] flex flex-col justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Resumen Global de Rupturas</p>
          <h3 className="mt-2 text-lg font-semibold text-white">Efectividad de Ataques</h3>
          <p className="text-xs text-slate-400 mt-1">
            Distribución agregada de los {totalSuccessful + totalFailed} ataques ejecutados sobre todos los protocolos analizados.
          </p>
        </div>

        <div className="h-[220px] w-full mt-4 relative flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderRadius: "16px",
                  borderColor: "rgba(255,255,255,0.1)",
                  color: "#f1f5f9",
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold text-white">
              {((totalSuccessful / (totalSuccessful + totalFailed)) * 100).toFixed(1)}%
            </span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Éxito Total</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
          <div className="rounded-xl border border-white/5 bg-slate-950/40 p-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 mr-2" />
            <span className="text-slate-400">Exitosos</span>
            <p className="mt-1 text-sm font-semibold text-white">{totalSuccessful}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-slate-950/40 p-2">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500 mr-2" />
            <span className="text-slate-400">Fallidos</span>
            <p className="mt-1 text-sm font-semibold text-white">{totalFailed}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
