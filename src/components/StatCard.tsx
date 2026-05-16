export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-medical-700">{value}</p>
    </div>
  );
}
