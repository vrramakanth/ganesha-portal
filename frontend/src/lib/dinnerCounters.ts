export type CounterMap = Record<string, number>;

/** "K–N" style label for the blocks a counter serves. Blocks are ranged by
 *  their place in the saved map (so I and O, which don't exist, never
 *  break a run). */
export function formatBlockRange(map: CounterMap, counter: number): string {
  const all = Object.keys(map).sort();
  const mine = all.filter((b) => map[b] === counter);
  const ranges: string[] = [];
  let start = 0;
  for (let i = 1; i <= mine.length; i++) {
    const continues = i < mine.length && all.indexOf(mine[i]) === all.indexOf(mine[i - 1]) + 1;
    if (continues) continue;
    ranges.push(mine[start] === mine[i - 1] ? mine[start] : `${mine[start]}–${mine[i - 1]}`);
    start = i;
  }
  return ranges.join(", ");
}

export function counterForBlock(map: CounterMap, block: string): number | null {
  return map[block.trim().toUpperCase()] ?? null;
}
