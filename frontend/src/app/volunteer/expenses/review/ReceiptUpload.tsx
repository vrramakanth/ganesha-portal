"use client";

import { useRef, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { fileToBase64 } from "@/lib/file";

/** Uploads a missing receipt for an expense being reviewed. */
export default function ReceiptUpload({
  idToken,
  expenseId,
  onUploaded,
  label = "Upload Receipt",
}: {
  idToken: string;
  expenseId: string;
  onUploaded: () => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    let added = 0;
    try {
      // One request per file keeps each upload small; each is added to the
      // receipts already on the expense.
      for (const file of Array.from(files)) {
        await api.volunteer.attachExpenseReceipt(idToken, expenseId, await fileToBase64(file), file.type || "image/jpeg");
        added += 1;
      }
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Could not upload the receipt.";
      setError(added > 0 ? `${added} uploaded, then: ${message}` : message);
    } finally {
      if (added > 0) onUploaded();
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <span className="inline-flex flex-col">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="text-xs font-semibold text-maroon underline disabled:opacity-60"
      >
        {uploading ? "Uploading…" : label}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
