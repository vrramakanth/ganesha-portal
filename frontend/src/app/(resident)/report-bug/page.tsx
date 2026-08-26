"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { fileToBase64 } from "@/lib/file";
import { useResidentProfile } from "@/lib/useResidentProfile";
import PageHeader from "@/components/PageHeader";

const WHATSAPP_NUMBER = "919880766321";

type Step = "form" | "done";

export default function ReportBugPage() {
  const { profile } = useResidentProfile();
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pageUrl, setPageUrl] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Best-effort context for whoever triages this — which page they came
  // from, since "Report a Bug" itself is a dead end with no bug in it.
  useEffect(() => {
    setPageUrl(document.referrer || window.location.href);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!description.trim()) {
      setError("Please describe the issue in a line or two.");
      return;
    }
    if (file && file.size > 8 * 1024 * 1024) {
      setError("That screenshot is too large — please choose one under 8MB.");
      return;
    }

    setSubmitting(true);
    try {
      const screenshot = file ? await fileToBase64(file) : undefined;
      const bug = await api.bugs.report({
        description: description.trim(),
        screenshot,
        mimeType: file?.type || undefined,
        reporterName: profile.name || undefined,
        reporterMobile: profile.mobile || undefined,
        pageUrl,
      });

      const lines = [
        `Bug Report ${bug.bug_id}`,
        description.trim(),
        bug.screenshot_url ? `Screenshot: ${bug.screenshot_url}` : "(no screenshot attached)",
      ];
      const waText = encodeURIComponent(lines.join("\n\n"));
      window.location.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`;

      setStep("done");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not submit — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "done") {
    return (
      <div className="flex flex-col gap-4 px-5 pt-8 text-center items-center">
        <PageHeader
          title="Thank you!"
          subtitle="Your report is logged and a WhatsApp message is ready to send."
          backHref="/more"
          backLabel="← More"
        />
        <p className="text-sm text-muted">
          If WhatsApp didn&apos;t open on its own, that&apos;s fine — your report is already saved either way.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader
        title="Report a Bug"
        subtitle="A line or two is enough — a screenshot helps a lot."
        backHref="/more"
        backLabel="← More"
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">What went wrong?</label>
          <textarea
            required
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Couldn't clear the Name field after typing"
            className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-xl border border-border py-3 text-center text-sm font-semibold text-maroon"
          >
            {file ? `📎 ${file.name}` : "Attach a Screenshot (optional)"}
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-saffron py-4 text-center text-lg font-semibold text-white disabled:opacity-60 active:bg-saffron-dark transition-colors"
        >
          {submitting ? "Submitting…" : "Submit & Open WhatsApp"}
        </button>
        <p className="text-xs text-muted text-center">
          This saves your report first, then opens WhatsApp with the details filled in — just tap Send.
        </p>
      </form>
    </div>
  );
}
