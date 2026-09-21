import { splitReceiptUrls } from "@/lib/receipts";

/** Links to every receipt on an expense: "Receipt" for one, "Receipt 1",
 *  "Receipt 2" and so on for several. */
export default function ReceiptLinks({
  value,
  className = "text-xs font-semibold text-maroon",
  singleLabel = "Receipt",
}: {
  value: string | undefined | null;
  className?: string;
  singleLabel?: string;
}) {
  const urls = splitReceiptUrls(value);
  if (urls.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2">
      {urls.map((url, i) => (
        <a key={url} href={url} target="_blank" rel="noopener noreferrer" className={className}>
          {urls.length === 1 ? singleLabel : `Receipt ${i + 1}`}
        </a>
      ))}
    </span>
  );
}
