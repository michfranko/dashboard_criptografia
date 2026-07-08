"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navItems = [
  { href: "/", label: "Inicio" },
  { href: "/algoritmos", label: "Algoritmos" },
  { href: "/fuerza-bruta", label: "Fuerza bruta" },
  { href: "/probabilidad", label: "Probabilidad" },
  { href: "/graficas", label: "Gráficas" },
  { href: "/simulacion", label: "Simulación" },
  { href: "/dataset", label: "Dataset" },
];

type DashboardShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  badge?: string;
  children: ReactNode;
};

export default function DashboardShell({
  eyebrow,
  title,
  description,
  badge,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.15),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(192,132,252,0.16),_transparent_24%),linear-gradient(135deg,_#020617_0%,_#0f172a_45%,_#111827_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col lg:flex-row">
        <aside className="w-full border-b border-white/10 bg-slate-950/70 px-5 py-6 backdrop-blur lg:w-72 lg:border-b-0 lg:border-r lg:px-6">
          <div className="rounded-2xl border border-cyan-400/20 bg-slate-900/80 p-4 shadow-[0_0_45px_rgba(34,211,238,0.08)]">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/15 text-xl text-cyan-300">
              🔐
            </div>
            <h2 className="text-lg font-semibold text-white">CryptoLab Research</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Plataforma académica para análisis de criptografía y seguridad.
            </p>
          </div>

          <nav className="mt-6 space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm transition ${
                    isActive
                      ? "bg-cyan-400/15 text-cyan-200"
                      : "bg-slate-900/70 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    {item.href === "/" ? "01" : `0${navItems.findIndex((nav) => nav.href === item.href) + 1}`}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Estado</p>
            <p className="mt-2 text-sm text-slate-200">Datos históricos cargados desde Google Drive.</p>
            <div className="mt-3 h-2 rounded-full bg-slate-800">
              <div className="h-2 w-4/5 rounded-full bg-emerald-400" />
            </div>
          </div>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <header className="mb-6 flex flex-col gap-3 rounded-[28px] border border-white/10 bg-slate-900/70 p-5 shadow-[0_0_60px_rgba(15,23,42,0.35)] sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">{eyebrow}</p>
              <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">{title}</h1>
            </div>
            {badge ? (
              <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
                {badge}
              </div>
            ) : null}
          </header>

          <section className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_0_60px_rgba(15,23,42,0.3)]">
            <p className="max-w-3xl text-sm leading-7 text-slate-400">{description}</p>
          </section>

          <div className="mt-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
