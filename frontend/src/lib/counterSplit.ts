/** Splits blocks, in order and kept whole, into `k` consecutive ranges so
 *  plate volume is as even as possible (A-D, E-J, ... are easy for
 *  residents to remember). `weights` are plates per block in block order.
 *  `preloads[j]` is plates already committed to counter j+1 regardless of
 *  block (late registrations), so the ranges are chosen around them.
 *  Returns counter numbers 1..k in block order. */

/** Largest gap between any counter and the average, as a fraction. */
export function maxDeviation(loads: number[]): number {
  const total = loads.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const avg = total / loads.length;
  return Math.max(...loads.map((l) => Math.abs(l - avg))) / avg;
}

export function splitConsecutive(weights: number[], k: number, preloads: number[] = []): number[] {
  const n = weights.length;
  const prefix = [0];
  weights.forEach((w) => prefix.push(prefix[prefix.length - 1] + w));
  const preload = (j: number) => preloads[j - 1] ?? 0;
  const avg = (prefix[n] + preloads.reduce((a, b) => a + b, 0)) / k;

  // best[j][i]: [busiest counter, sum of squared gaps] for the first i blocks on the first j counters.
  type Cost = [number, number];
  const better = (a: Cost, b: Cost) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
  const best: (Cost | null)[][] = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(null));
  const from: number[][] = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(0));
  best[0][0] = [0, 0];
  for (let j = 1; j <= k; j++) {
    for (let i = j; i <= n; i++) {
      for (let m = j - 1; m < i; m++) {
        const prev = best[j - 1][m];
        if (!prev) continue;
        const load = prefix[i] - prefix[m] + preload(j);
        const cost: Cost = [Math.max(prev[0], load), prev[1] + (load - avg) ** 2];
        if (!best[j][i] || better(cost, best[j][i] as Cost)) {
          best[j][i] = cost;
          from[j][i] = m;
        }
      }
    }
  }
  const assignment = new Array(n).fill(1);
  let i = n;
  for (let j = k; j >= 1; j--) {
    const m = from[j][i];
    for (let b = m; b < i; b++) assignment[b] = j;
    i = m;
  }
  return assignment;
}
