type VisualPanelProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export default function VisualPanel({ title, subtitle, children }: VisualPanelProps) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5 shadow-[0_0_50px_rgba(15,23,42,0.25)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">{title}</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{subtitle}</h3>
        </div>
        <div className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-xs text-slate-400">
          Live
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}
