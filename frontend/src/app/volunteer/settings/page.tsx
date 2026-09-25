"use client";

import { useRef, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import { useFestivalConfig } from "@/lib/FestivalConfigContext";
import { fileToBase64 } from "@/lib/file";
import type { ConfigEntry, EnabledModules, ModuleKey } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import LoadingIndicator from "@/components/LoadingIndicator";

const MODULE_LABELS: Record<ModuleKey, string> = {
  donations: "Donations",
  sponsorships: "Sponsorships",
  events: "Events",
  meal: "Meal / Community Dinner",
  guests: "Guests",
  volunteers: "Volunteers / Seva",
  expenses: "Expenses",
};

type Field = {
  key: string;
  label: string;
  description: string;
  type?: "text" | "number" | "select";
  options?: { value: string; label: string }[];
};

/** Festival Identity — the fields a Settings page organized around raw
 *  Configuration keys never explained on its own. This is what a new
 *  celebration on this codebase actually needs to set (claude.md §68's
 *  "launch the next festival" runbook). */
const IDENTITY_FIELDS: Field[] = [
  { key: "festival_name", label: "Festival name", description: "Shown as the main Home page title." },
  { key: "community_name", label: "Community name", description: "The society/community name — receipts, Home page, closing messages." },
  { key: "tagline", label: "Tagline", description: "The one-line subtitle under the Home page title." },
  { key: "dates", label: "Dates", description: "Free text, e.g. \"14-20 Sep 2026\" — shown on the More page." },
  { key: "venue", label: "Venue", description: "Shown on the More page." },
  { key: "contact", label: "Contact", description: "Shown on the More page." },
  { key: "id_prefix", label: "ID prefix", description: "Prefix for every generated ID (transactions, receipts, tokens…), e.g. \"GWG\"." },
];

/** Finance-gated — these simply won't be in `config` for a non-Finance
 *  admin (server-filtered, Config.js FINANCE_ONLY_CONFIG_KEYS), so this
 *  section naturally disappears for them rather than needing its own
 *  permission check here. */
const MONEY_FIELDS: Field[] = [
  { key: "donation_goal", label: "Donation goal (₹)", description: "Shown as the collection target on Home.", type: "number" },
  { key: "minimum_donation", label: "Minimum donation (₹)", description: "Enforced server-side on every donation.", type: "number" },
  { key: "maximum_donation", label: "Maximum donation (₹)", description: "Enforced server-side on every donation.", type: "number" },
  { key: "upi_vpa", label: "UPI ID (VPA)", description: "Where donation/dinner payments are collected." },
  { key: "upi_payee_name", label: "UPI payee name", description: "Shown to residents during payment." },
];

/** Finance-gated, same as Money — only shown when the Meal module is on.
 *  A caterer's rate is always subject to negotiation, so these are plain
 *  editable Configuration values, not a code-level constant. */
const MEAL_PRICING_FIELDS: Field[] = [
  {
    key: "meal_pricing_mode",
    label: "Pricing model",
    description: "How Community Dinner charges attendees.",
    type: "select",
    options: [
      { value: "household_free_guest_paid", label: "Household free, guests pay" },
      { value: "everyone_paid", label: "Everyone pays the same rate" },
    ],
  },
  { key: "meal_adult_price", label: "Adult price (₹)", description: "Per-plate rate for adults (12+).", type: "number" },
  { key: "meal_child_price", label: "Child price (₹)", description: "Per-plate rate for children (6-12).", type: "number" },
];

const MAX_HERO_BYTES = 8 * 1024 * 1024; // 8MB — same guard as the Bug Report screenshot upload

function fieldValue(key: string, config: ConfigEntry[] | null, edits: Record<string, string>): string {
  if (key in edits) return edits[key];
  return config?.find((c) => c.key === key)?.value ?? "";
}

export default function SettingsPage() {
  const { idToken } = useVolunteerAuth();
  const { festival, modules, refresh: refreshFestival } = useFestivalConfig();
  const [refreshKey, setRefreshKey] = useState(0);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [togglingWrap, setTogglingWrap] = useState(false);
  const [wrapError, setWrapError] = useState<string | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupResult, setBackupResult] = useState<{ name: string; url: string; created: boolean } | null>(null);
  const [savingModules, setSavingModules] = useState(false);
  const [modulesError, setModulesError] = useState<string | null>(null);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [heroError, setHeroError] = useState<string | null>(null);
  const [heroUploaded, setHeroUploaded] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const heroInputRef = useRef<HTMLInputElement>(null);

  const { data: config, loading, error: loadError } = useAsync(
    () => api.volunteer.listConfig(idToken as string),
    [idToken, refreshKey]
  );

  const { data: festivalInfo } = useAsync(() => api.festival.get(), [refreshKey]);
  const wrappedUp = festivalInfo ? festivalInfo.festival_wrapped_up === "true" : null;

  const handledKeys = new Set([
    ...IDENTITY_FIELDS.map((f) => f.key),
    ...MONEY_FIELDS.map((f) => f.key),
    ...MEAL_PRICING_FIELDS.map((f) => f.key),
    "enabled_modules",
    "hero_image_url",
  ]);
  const advancedConfig = (config ?? []).filter((c) => !handledKeys.has(c.key));

  async function handleToggleModule(key: ModuleKey) {
    setModulesError(null);
    setSavingModules(true);
    try {
      const updates: Partial<EnabledModules> = { [key]: !modules[key] };
      await api.volunteer.updateModules(idToken as string, updates);
      refreshFestival();
    } catch (err) {
      setModulesError(err instanceof ApiClientError ? err.message : "Could not change that module.");
    } finally {
      setSavingModules(false);
    }
  }

  async function handleHeroFileSelected(file: File) {
    setHeroError(null);
    setHeroUploaded(false);
    if (file.size > MAX_HERO_BYTES) {
      setHeroError("Image is too large — please pick one under 8MB.");
      return;
    }
    setUploadingHero(true);
    try {
      const base64 = await fileToBase64(file);
      await api.volunteer.uploadHeroImage(idToken as string, base64, file.type || "image/jpeg");
      refreshFestival();
      setHeroUploaded(true);
    } catch (err) {
      setHeroError(err instanceof ApiClientError ? err.message : "Could not upload this image.");
    } finally {
      setUploadingHero(false);
      if (heroInputRef.current) heroInputRef.current.value = "";
    }
  }

  async function handleToggleWrapUp() {
    const wrapping = !wrappedUp;
    if (
      wrapping &&
      !window.confirm(
        "Mark the festival as wrapped up? Residents will no longer be able to RSVP, register for events, upload songs, or sign up for Seva, and Home will show the thank-you summary. Donations have their own switch. You can reverse this any time."
      )
    ) {
      return;
    }
    setWrapError(null);
    setTogglingWrap(true);
    try {
      await api.volunteer.setFestivalWrappedUp(idToken as string, wrapping);
      setRefreshKey((k) => k + 1);
      refreshFestival();
    } catch (err) {
      setWrapError(err instanceof ApiClientError ? err.message : "Could not change the festival status.");
    } finally {
      setTogglingWrap(false);
    }
  }

  async function handleSave() {
    if (Object.keys(edits).length === 0) return;
    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      await api.volunteer.updateConfig(idToken as string, edits);
      setEdits({});
      setSaved(true);
      setRefreshKey((k) => k + 1);
      refreshFestival();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleBackup() {
    setBackupError(null);
    setBackupResult(null);
    setBackingUp(true);
    try {
      const result = await api.volunteer.runBackup(idToken as string);
      setBackupResult(result);
    } catch (err) {
      setBackupError(err instanceof ApiClientError ? err.message : "Could not run backup.");
    } finally {
      setBackingUp(false);
    }
  }

  function renderField(field: Field) {
    const value = fieldValue(field.key, config, edits);
    return (
      <div key={field.key} className="px-4 py-3 space-y-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">{field.label}</p>
          {field.type === "select" ? (
            <select
              defaultValue={value}
              onChange={(e) => setEdits((prev) => ({ ...prev, [field.key]: e.target.value }))}
              className="w-1/2 rounded-lg border border-border px-2 py-1.5 text-sm"
            >
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.type || "text"}
              defaultValue={value}
              onChange={(e) => setEdits((prev) => ({ ...prev, [field.key]: e.target.value }))}
              className="w-1/2 rounded-lg border border-border px-2 py-1.5 text-sm text-right"
            />
          )}
        </div>
        <p className="text-xs text-muted">{field.description}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader title="Festival Setup" subtitle="Namma Habba configuration" backHref="/volunteer/more" backLabel="← More" />

      {loading && <LoadingIndicator />}
      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      {config && (
        <>
          <div className="space-y-2">
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Festival Identity</h2>
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {IDENTITY_FIELDS.map(renderField)}
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Hero Image</h2>
            <p className="text-xs text-muted">
              Shown at the top of the resident Home page. Leave unset to use the default image.
            </p>
            <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={festival?.hero_image_url || "/images/ganesha-hero.png"}
                alt="Current hero"
                className="h-16 w-auto rounded-lg border border-border"
              />
              <div className="flex-1 space-y-2">
                <input
                  ref={heroInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleHeroFileSelected(file);
                  }}
                  disabled={uploadingHero}
                  className="text-xs"
                />
                {uploadingHero && <LoadingIndicator label="Uploading…" />}
                {heroError && <p className="text-xs text-red-600">{heroError}</p>}
                {heroUploaded && <p className="text-xs text-green-700">Uploaded.</p>}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">
              Modules — Namma Habba
            </h2>
            <p className="text-xs text-muted">
              Which features this festival uses. Turning a module off hides it from residents and
              volunteers and blocks its actions server-side — it doesn&apos;t delete any data already
              recorded.
            </p>
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {(Object.keys(MODULE_LABELS) as ModuleKey[]).map((key) => (
                <label key={key} className="px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-sm">{MODULE_LABELS[key]}</span>
                  <input
                    type="checkbox"
                    checked={modules[key]}
                    disabled={savingModules}
                    onChange={() => handleToggleModule(key)}
                    className="h-5 w-5 accent-maroon"
                  />
                </label>
              ))}
            </div>
            {modulesError && <p className="text-sm text-red-600">{modulesError}</p>}
          </div>

          {MONEY_FIELDS.some((f) => config.some((c) => c.key === f.key)) && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Money</h2>
              <div className="rounded-xl border border-border bg-card divide-y divide-border">
                {MONEY_FIELDS.filter((f) => config.some((c) => c.key === f.key)).map(renderField)}
              </div>
            </div>
          )}

          {modules.meal && MEAL_PRICING_FIELDS.some((f) => config.some((c) => c.key === f.key)) && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Meal Pricing</h2>
              <div className="rounded-xl border border-border bg-card divide-y divide-border">
                {MEAL_PRICING_FIELDS.filter((f) => config.some((c) => c.key === f.key)).map(renderField)}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-xs font-semibold text-maroon"
            >
              {showAdvanced ? "Hide advanced settings ▲" : "Show advanced settings ▼"}
            </button>
            {showAdvanced && advancedConfig.length > 0 && (
              <div className="rounded-xl border border-border bg-card divide-y divide-border">
                {advancedConfig.map((c) => (
                  <div key={c.key} className="px-4 py-3 flex items-center justify-between gap-3">
                    <p className="text-sm text-muted shrink-0">{c.key}</p>
                    <input
                      defaultValue={fieldValue(c.key, config, edits)}
                      onChange={(e) => setEdits((prev) => ({ ...prev, [c.key]: e.target.value }))}
                      className="flex-1 rounded-lg border border-border px-2 py-1.5 text-sm text-right"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-700">Saved.</p>}

      <button
        onClick={handleSave}
        disabled={saving || Object.keys(edits).length === 0}
        className="w-full rounded-xl bg-maroon py-3 text-center text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save Changes"}
      </button>

      {wrappedUp !== null && (
        <div className="space-y-2 border-t border-border pt-6">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Festival Wrap-up</h2>
          <p className="text-xs text-muted">
            {wrappedUp
              ? "The festival is marked as wrapped up. Residents see the thank-you summary on Home, and RSVPs, event registration, song uploads and Seva sign-up are closed."
              : "When the festival is over, this closes RSVPs, event registration, song uploads and Seva sign-up, and shows the thank-you summary on Home. Donations have their own switch on the Donations page."}
          </p>
          <button
            onClick={handleToggleWrapUp}
            disabled={togglingWrap}
            className="w-full rounded-xl border border-border py-3 text-center text-sm font-semibold text-maroon disabled:opacity-60"
          >
            {togglingWrap ? "Saving…" : wrappedUp ? "Reopen festival" : "Mark festival as wrapped up"}
          </button>
          {wrapError && <p className="text-sm text-red-600">{wrapError}</p>}
        </div>
      )}

      <div className="space-y-2 border-t border-border pt-6">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Backup</h2>
        <p className="text-xs text-muted">
          A copy of the whole spreadsheet runs automatically every day around 8 AM IST. Use this to
          run one right now instead of waiting.
        </p>
        <button
          onClick={handleBackup}
          disabled={backingUp}
          className="w-full rounded-xl border border-border py-3 text-center text-sm font-semibold text-maroon disabled:opacity-60"
        >
          {backingUp ? "Backing up…" : "Backup Now"}
        </button>
        {backupError && <p className="text-sm text-red-600">{backupError}</p>}
        {backupResult && (
          <p className="text-sm text-green-700">
            {backupResult.created ? "Backed up: " : "Already backed up today: "}
            <a href={backupResult.url} target="_blank" rel="noopener noreferrer" className="underline">
              {backupResult.name}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
