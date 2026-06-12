type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  accent?: string;
};

export default function MetricCard({ label, value, detail, accent = "text-cyan-200" }: MetricCardProps) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-slate-950/70 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${accent}`}>{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}
