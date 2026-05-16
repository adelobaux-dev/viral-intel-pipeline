import type { AppUser, PerformanceTracking } from "@/lib/types";

export function TeamLeaderboard({
  team,
}: {
  team: (AppUser & { perf?: PerformanceTracking })[];
}) {
  const ranked = [...team].sort(
    (a, b) =>
      Number(b.perf?.average_score ?? 0) - Number(a.perf?.average_score ?? 0),
  );

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Membre</th>
            <th className="px-4 py-3">Rôle</th>
            <th className="px-4 py-3">Appels</th>
            <th className="px-4 py-3">Score moyen</th>
            <th className="px-4 py-3">Conversion</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {ranked.map((u, i) => (
            <tr key={u.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-semibold text-slate-400">
                {i + 1}
              </td>
              <td className="px-4 py-3 font-medium text-slate-800">{u.name}</td>
              <td className="px-4 py-3 capitalize text-slate-600">{u.role}</td>
              <td className="px-4 py-3 text-slate-600">
                {u.perf?.total_calls ?? 0}
              </td>
              <td className="px-4 py-3 font-semibold text-medical-700">
                {Number(u.perf?.average_score ?? 0).toFixed(1)}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {Number(u.perf?.conversion_rate ?? 0).toFixed(0)} %
              </td>
            </tr>
          ))}
          {ranked.length === 0 && (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-6 text-center text-slate-400"
              >
                Aucun membre pour le moment.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
