/** Normalise un nom : minuscules, sans accents, espaces compactés. */
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Distance de Levenshtein (tolérance aux fautes de frappe). */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d = Array.from({ length: m + 1 }, () => new Array<number>(n + 1));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost,
      );
    }
  }
  return d[m][n];
}

/**
 * Vrai si `query` correspond à `candidate` malgré des fautes de frappe.
 * Tolère sous-chaîne, inversion nom/prénom, et distance proportionnelle.
 */
export function looseNameMatch(query: string, candidate: string): boolean {
  const q = normalizeName(query);
  const c = normalizeName(candidate);
  if (!q || !c) return false;
  if (c.includes(q) || q.includes(c)) return true;

  const dist = levenshtein(q, c);
  const tol = Math.max(2, Math.floor(Math.max(q.length, c.length) * 0.25));
  if (dist <= tol) return true;

  // Comparaison par tokens (gère "Jean Dupont" vs "Dupont Jean")
  const qt = q.split(" ").filter(Boolean).sort();
  const ct = c.split(" ").filter(Boolean).sort();
  if (qt.length && qt.length === ct.length) {
    const ok = qt.every((t, i) => {
      const o = ct[i];
      return o.includes(t) || t.includes(o) || levenshtein(t, o) <= 2;
    });
    if (ok) return true;
  }
  return false;
}
