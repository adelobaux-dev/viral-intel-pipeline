export function StatCard({
  label,
  value,
  accent = "medical",
}: {
  label: string;
  value: string;
  accent?: "medical" | "emerald" | "amber";
}) {
  const bar =
    accent === "emerald"
      ? "bg-emerald-500"
      : accent === "amber"
        ? "bg-amber-500"
        : "bg-medical-500";

  return (
    <div className="card relative overflow-hidden p-5">
      <span className={`absolute inset-x-0 top-0 h-1 ${bar}`} />
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );
}
