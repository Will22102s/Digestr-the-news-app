"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import {
  getSettings,
  testGeminiKey,
  updateSettings,
} from "@/lib/client-api";
import { cn } from "@/lib/cn";
import type { SettingsDTO } from "@/lib/types";

type SettingsModalProps = {
  onClose: () => void;
  onSaved: () => void;
  onToast: (message: string, tone?: "success" | "error") => void;
};

type TestResult = { tone: "success" | "error"; message: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function SettingsModal({
  onClose,
  onSaved,
  onToast,
}: SettingsModalProps) {
  const [settings, setSettings] = useState<SettingsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [showKey, setShowKey] = useState(false);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const keyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;

    getSettings()
      .then((response) => {
        if (!active) return;
        setSettings(response);
        setModel(response.gemini.model);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(errorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const timer = window.setTimeout(() => keyInputRef.current?.focus(), 80);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const keyChanged = apiKey.trim().length > 0;
  const modelChanged = model.trim() !== (settings?.gemini.model ?? "");
  const dirty = keyChanged || modelChanged;

  const handleTest = useCallback(async () => {
    if (testing) return;
    setTesting(true);
    setFormError(null);
    setTestResult(null);

    try {
      const result = await testGeminiKey({
        ...(keyChanged ? { geminiApiKey: apiKey.trim() } : {}),
        ...(model.trim() ? { geminiModel: model.trim() } : {}),
      });
      setTestResult({
        tone: "success",
        message: `Connected to ${result.model}. The key works.`,
      });
    } catch (error) {
      setTestResult({ tone: "error", message: errorMessage(error) });
    } finally {
      setTesting(false);
    }
  }, [apiKey, keyChanged, model, testing]);

  const handleSave = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (saving || !dirty) return;

      setSaving(true);
      setFormError(null);

      try {
        const updated = await updateSettings({
          ...(keyChanged ? { geminiApiKey: apiKey.trim() } : {}),
          ...(modelChanged ? { geminiModel: model.trim() || null } : {}),
        });

        setSettings(updated);
        setModel(updated.gemini.model);
        setApiKey("");
        setTestResult(null);
        onSaved();
        onToast("Settings saved.");
      } catch (error) {
        setFormError(errorMessage(error));
      } finally {
        setSaving(false);
      }
    },
    [apiKey, dirty, keyChanged, model, modelChanged, onSaved, onToast, saving],
  );

  const handleClearKey = useCallback(async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const updated = await updateSettings({ geminiApiKey: null });
      setSettings(updated);
      setApiKey("");
      setConfirmClear(false);
      setTestResult(null);
      onSaved();
      onToast("Saved API key removed.");
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }, [confirmClear, onSaved, onToast]);

  const gemini = settings?.gemini;
  const busy = saving || testing;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <button
        type="button"
        aria-label="Close settings"
        onClick={onClose}
        className="absolute inset-0 animate-fade cursor-default bg-black/65 backdrop-blur-md"
      />

      <div className="relative flex max-h-[92dvh] w-full max-w-[560px] animate-rise flex-col overflow-hidden rounded-t-[24px] border border-hairline bg-panel shadow-popover sm:max-h-[85dvh] sm:rounded-[24px]">
        <div className="flex shrink-0 items-center gap-3 border-b border-hairline px-5 py-4">
          <div className="grid size-8 place-items-center rounded-[10px] border border-hairline bg-white/[0.04]">
            <SlidersHorizontal className="size-4 text-ink" strokeWidth={1.9} />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="settings-title"
              className="text-[14.5px] font-semibold tracking-[-0.02em] text-ink"
            >
              Settings
            </h2>
            <p className="text-[10.5px] text-ink-tertiary">
              Local preferences · stored on this device
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-lg text-ink-tertiary transition hover:bg-white/[0.05] hover:text-ink"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {loading ? (
            <div className="space-y-3">
              <div className="skeleton h-3 w-36 rounded-full" />
              <div className="skeleton h-9 w-full rounded-[9px]" />
              <div className="skeleton h-3 w-28 rounded-full" />
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-cybersec/20 bg-cybersec/[0.06] p-3 text-[11.5px] text-ink-secondary">
              <p className="font-medium text-cybersec">
                Could not load settings
              </p>
              <p className="mt-1 leading-relaxed">{loadError}</p>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <section className="rounded-xl border border-hairline bg-white/[0.02] p-3.5">
                <div className="flex items-center gap-2">
                  <KeyRound
                    className="size-3.5 text-ink-secondary"
                    strokeWidth={2}
                  />
                  <h3 className="text-[12.5px] font-semibold text-ink">
                    Gemini API key
                  </h3>
                  <span
                    className={cn(
                      "ml-auto inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      gemini?.configured
                        ? "border-positive/25 bg-positive/[0.08] text-positive"
                        : "border-amber-400/25 bg-amber-400/[0.07] text-amber-300",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "size-1.5 rounded-full",
                        gemini?.configured ? "bg-positive" : "bg-amber-400",
                      )}
                    />
                    {gemini?.configured ? "Configured" : "Not configured"}
                  </span>
                </div>

                <p className="mt-1.5 text-[11px] leading-relaxed text-ink-tertiary">
                  Powers &ldquo;Generate Your Read&rdquo;. Get a key from{" "}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-ink-secondary underline decoration-white/20 underline-offset-2 transition hover:text-ink"
                  >
                    Google AI Studio
                  </a>
                  . It is stored locally in the app database with owner-only
                  permissions and is only sent to Google.
                </p>

                {gemini?.configured ? (
                  <p className="mt-2 flex items-center gap-1.5 font-mono text-[10.5px] text-ink-tertiary">
                    <Lock className="size-3 shrink-0" strokeWidth={2} />
                    {gemini.maskedKey}
                    <span className="font-sans">
                      ·{" "}
                      {gemini.source === "environment"
                        ? "from GEMINI_API_KEY"
                        : "saved in this app"}
                    </span>
                  </p>
                ) : null}

                <div className="relative mt-3">
                  <input
                    ref={keyInputRef}
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(event) => {
                      setApiKey(event.target.value);
                      setTestResult(null);
                      setConfirmClear(false);
                    }}
                    placeholder={
                      gemini?.configured
                        ? "Enter a new key to replace the saved one"
                        : "AIza…"
                    }
                    aria-label="Gemini API key"
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className="h-9 w-full rounded-[9px] border border-hairline bg-white/[0.03] pl-3 pr-10 font-mono text-[12px] text-ink outline-none transition placeholder:font-sans placeholder:text-ink-tertiary focus:border-white/20 focus:bg-white/[0.05]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((previous) => !previous)}
                    aria-label={showKey ? "Hide API key" : "Show API key"}
                    className="absolute right-1 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-ink-tertiary transition hover:bg-white/[0.06] hover:text-ink"
                  >
                    {showKey ? (
                      <EyeOff className="size-3.5" strokeWidth={2} />
                    ) : (
                      <Eye className="size-3.5" strokeWidth={2} />
                    )}
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleTest()}
                    disabled={busy || (!gemini?.configured && !keyChanged)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-ink-secondary transition hover:bg-white/[0.07] hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {testing ? (
                      <Loader2
                        className="size-3 animate-spin"
                        strokeWidth={2.4}
                      />
                    ) : (
                      <KeyRound className="size-3" strokeWidth={2.2} />
                    )}
                    {testing ? "Testing…" : "Test API key"}
                  </button>

                  {gemini?.source === "database" ? (
                    <button
                      type="button"
                      onClick={() => void handleClearKey()}
                      disabled={busy}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition disabled:opacity-60",
                        confirmClear
                          ? "border-cybersec/30 bg-cybersec/15 text-cybersec"
                          : "border-transparent text-ink-tertiary hover:bg-white/[0.04] hover:text-ink-secondary",
                      )}
                    >
                      <Trash2 className="size-3" strokeWidth={2.2} />
                      {confirmClear ? "Confirm removal" : "Remove saved key"}
                    </button>
                  ) : null}
                </div>

                {testResult ? (
                  <p
                    role="status"
                    className={cn(
                      "mt-2 flex items-start gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed",
                      testResult.tone === "success"
                        ? "border-positive/20 bg-positive/[0.06] text-ink-secondary"
                        : "border-cybersec/20 bg-cybersec/[0.06] text-ink-secondary",
                    )}
                  >
                    {testResult.tone === "success" ? (
                      <Check
                        className="mt-0.5 size-3 shrink-0 text-positive"
                        strokeWidth={2.6}
                      />
                    ) : (
                      <AlertCircle
                        className="mt-0.5 size-3 shrink-0 text-cybersec"
                        strokeWidth={2}
                      />
                    )}
                    {testResult.message}
                  </p>
                ) : null}
              </section>

              <section className="rounded-xl border border-hairline bg-white/[0.02] p-3.5">
                <h3 className="text-[12.5px] font-semibold text-ink">
                  Editorial model
                </h3>
                <p className="mt-1.5 text-[11px] leading-relaxed text-ink-tertiary">
                  Leave the default unless you need a different Gemini model
                  available to your key.
                </p>
                <input
                  type="text"
                  value={model}
                  onChange={(event) => {
                    setModel(event.target.value);
                    setTestResult(null);
                  }}
                  placeholder="gemini-3.8-flash"
                  aria-label="Gemini model"
                  spellCheck={false}
                  className="mt-2.5 h-9 w-full rounded-[9px] border border-hairline bg-white/[0.03] px-3 font-mono text-[12px] text-ink outline-none transition placeholder:text-ink-tertiary focus:border-white/20 focus:bg-white/[0.05]"
                />
                <p className="mt-1.5 text-[10.5px] text-ink-tertiary">
                  {gemini?.modelSource === "database"
                    ? "Saved in this app."
                    : gemini?.modelSource === "environment"
                      ? "Inherited from GEMINI_MODEL."
                      : "Using the built-in default."}
                </p>
              </section>

              {formError ? (
                <p className="flex items-start gap-1.5 rounded-lg border border-cybersec/20 bg-cybersec/[0.06] px-2.5 py-2 text-[11px] leading-relaxed text-ink-secondary">
                  <AlertCircle
                    className="mt-0.5 size-3 shrink-0 text-cybersec"
                    strokeWidth={2}
                  />
                  {formError}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2 border-t border-hairline pt-3.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-3 py-2 text-[11.5px] font-medium text-ink-tertiary transition hover:bg-white/[0.04] hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || !dirty}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-[11.5px] font-semibold text-obsidian transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? (
                    <Loader2
                      className="size-3.5 animate-spin"
                      strokeWidth={2.4}
                    />
                  ) : null}
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
