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

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      await api.volunteer.attachExpenseReceipt(idToken, expenseId, await fileToBase64(file), file.type || "image/jpeg");
      onUploaded();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not upload the receipt.");
    } finally {
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
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
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
