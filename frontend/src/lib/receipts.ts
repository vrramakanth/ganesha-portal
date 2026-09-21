/** An expense's receipts are stored as one comma-separated list of links. */
export function splitReceiptUrls(value: string | undefined | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
}
