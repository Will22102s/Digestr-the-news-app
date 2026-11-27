"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import {
  AlertCircle,
  Check,
  Cloud,
  Cpu,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  getSettings,
  resetDemoData,
  testAiProvider,
  updateSettings,
} from "@/lib/client-api";
import { cn } from "@/lib/cn";
import type {
  AiProviderChoice,
  AiProviderId,
  SettingsDTO,
} from "@/lib/types";

type SettingsModalProps = {
  onClose: () => void;
  onSaved: () => void;
  onToast: (message: string, tone?: "success" | "error") => void;
};

type TestResult = { tone: "success" | "error"; message: string };

type TestState = TestResult & { provider: AiProviderId };

const PROVIDER_LABEL: Record<AiProviderId, string> = {
  gemini: "Google Gemini",
  groq: "Groq",
  ollama: "Ollama",
  fallback: "the built-in algorithmic editor",
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function StatusPill({
  active,
  activeLabel,
  idleLabel,
}: {
  active: boolean;
  activeLabel: string;
  idleLabel: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        active
          ? "border-positive/25 bg-positive/[0.08] text-positive"
          : "border-amber-400/25 bg-amber-400/[0.07] text-amber-300",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          active ? "bg-positive" : "bg-amber-400",
        )}
      />
      {active ? activeLabel : idleLabel}
    </span>
  );
}

function ResultLine({ result }: { result: TestResult }) {
  return (
    <p
      role="status"
      className={cn(
        "mt-2 flex items-start gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed",
        result.tone === "success"
          ? "border-positive/20 bg-positive/[0.06] text-ink-secondary"
          : "border-cybersec/20 bg-cybersec/[0.06] text-ink-secondary",
      )}
    >
      {result.tone === "success" ? (
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
      {result.message}
    </p>
  );
}

function SecretInput({
  label,
  value,
  onChange,
  show,
  onToggle,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder: string;
}) {
  return (
    <div className="relative mt-3">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        className="h-9 w-full rounded-[9px] border border-hairline bg-white/[0.03] pl-3 pr-10 font-mono text-[12px] text-ink outline-none transition placeholder:font-sans placeholder:text-ink-tertiary focus:border-white/20 focus:bg-white/[0.05]"
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={show ? `Hide ${label}` : `Show ${label}`}
        className="absolute right-1 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-ink-tertiary transition hover:bg-white/[0.06] hover:text-ink"
      >
        {show ? (
          <EyeOff className="size-3.5" strokeWidth={2} />
        ) : (
          <Eye className="size-3.5" strokeWidth={2} />
        )}
      </button>
    </div>
  );
}

function ModelInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="mt-2.5 block">
      <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-ink-tertiary">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className="mt-1 h-9 w-full rounded-[9px] border border-hairline bg-white/[0.03] px-3 font-mono text-[12px] text-ink outline-none transition placeholder:text-ink-tertiary focus:border-white/20 focus:bg-white/[0.05]"
      />
    </label>
  );
}

function CardHeader({
  icon: Icon,
  title,
  pill,
}: {
  icon: typeof KeyRound;
  title: string;
  pill: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-3.5 text-ink-secondary" strokeWidth={2} />
      <h3 className="text-[12.5px] font-semibold text-ink">{title}</h3>
      <span className="ml-auto">{pill}</span>
    </div>
  );
}

export function SettingsModal({
  onClose,
  onSaved,
  onToast,
}: SettingsModalProps) {
  const [settings, setSettings] = useState<SettingsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [provider, setProvider] = useState<AiProviderChoice>("auto");
  const [geminiKey, setGeminiKey] = useState("");
  const [geminiModel, setGeminiModel] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [groqModel, setGroqModel] = useState("");
  const [ollamaEnabled, setOllamaEnabled] = useState(false);
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("");
  const [ollamaModel, setOllamaModel] = useState("");
  const [showKeys, setShowKeys] = useState({ gemini: false, groq: false });

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<AiProviderId | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [testState, setTestState] = useState<TestState | null>(null);
  const [confirmClear, setConfirmClear] = useState<"gemini" | "groq" | null>(
    null,
  );
  const [demoBusy, setDemoBusy] = useState(false);
  const [isDesktop] = useState(
    () =>
      typeof window !== "undefined" &&
      "__TAURI_INTERNALS__" in (window as Window),
  );
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateState, setUpdateState] = useState<TestResult | null>(null);

  useEffect(() => {
    let active = true;

    getSettings()
      .then((response) => {
        if (!active) return;
        setSettings(response);
        setProvider(response.ai.provider);
        setGeminiModel(response.ai.gemini.model);
        setGroqModel(response.ai.groq.model);
        setOllamaEnabled(response.ai.ollama.enabled);
        setOllamaBaseUrl(response.ai.ollama.baseUrl);
        setOllamaModel(response.ai.ollama.model);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(errorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const ai = settings?.ai;
  const geminiKeyChanged = geminiKey.trim().length > 0;
  const groqKeyChanged = groqKey.trim().length > 0;

  const providerChanged = Boolean(ai && provider !== ai.provider);
  const geminiModelChanged = Boolean(
    ai && geminiModel.trim() !== ai.gemini.model,
  );
  const groqModelChanged = Boolean(ai && groqModel.trim() !== ai.groq.model);
  const ollamaChanged = Boolean(
    ai &&
      (ollamaEnabled !== ai.ollama.enabled ||
        ollamaBaseUrl.trim() !== ai.ollama.baseUrl ||
        ollamaModel.trim() !== ai.ollama.model),
  );

  const dirty =
    providerChanged ||
    geminiKeyChanged ||
    groqKeyChanged ||
    geminiModelChanged ||
    groqModelChanged ||
    ollamaChanged;

  const busy = saving || testing !== null || demoBusy;

  const handleTest = useCallback(
    async (target: AiProviderId) => {
      if (testing || saving) return;
      setTesting(target);
      setFormError(null);
      setTestState(null);

      try {
        const result = await testAiProvider({
          provider: target,
          ...(target === "gemini" && geminiKeyChanged
            ? { apiKey: geminiKey.trim() }
            : {}),
          ...(target === "gemini" && geminiModel.trim()
            ? { model: geminiModel.trim() }
            : {}),
          ...(target === "groq" && groqKeyChanged
            ? { apiKey: groqKey.trim() }
            : {}),
          ...(target === "groq" && groqModel.trim()
            ? { model: groqModel.trim() }
            : {}),
          ...(target === "ollama"
            ? {
                ...(ollamaBaseUrl.trim()
                  ? { baseUrl: ollamaBaseUrl.trim() }
                  : {}),
                ...(ollamaModel.trim() ? { model: ollamaModel.trim() } : {}),
              }
            : {}),
        });

        setTestState({
          provider: target,
          tone: "success",
          message:
            target === "fallback"
              ? result.reply
              : `${result.reply} · ${result.model}`,
        });
      } catch (error) {
        setTestState({
          provider: target,
          tone: "error",
          message: errorMessage(error),
        });
      } finally {
        setTesting(null);
      }
    },
    [
      geminiKey,
      geminiKeyChanged,
      geminiModel,
      groqKey,
      groqKeyChanged,
      groqModel,
      ollamaBaseUrl,
      ollamaModel,
      saving,
      testing,
    ],
  );

  const handleSave = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (saving || !dirty || !ai) return;

      setSaving(true);
      setFormError(null);

      try {
        const updated = await updateSettings({
          ...(providerChanged ? { aiProvider: provider } : {}),
          ...(geminiKeyChanged ? { geminiApiKey: geminiKey.trim() } : {}),
          ...(geminiModelChanged
            ? { geminiModel: geminiModel.trim() || null }
            : {}),
          ...(groqKeyChanged ? { groqApiKey: groqKey.trim() } : {}),
          ...(groqModelChanged
            ? { groqModel: groqModel.trim() || null }
            : {}),
          ...(ollamaChanged
            ? {
                ollamaEnabled,
                ollamaBaseUrl: ollamaBaseUrl.trim() || null,
                ollamaModel: ollamaModel.trim() || null,
              }
            : {}),
        });

        setSettings(updated);
        setProvider(updated.ai.provider);
        setGeminiModel(updated.ai.gemini.model);
        setGroqModel(updated.ai.groq.model);
        setOllamaEnabled(updated.ai.ollama.enabled);
        setOllamaBaseUrl(updated.ai.ollama.baseUrl);
        setOllamaModel(updated.ai.ollama.model);
        setGeminiKey("");
        setGroqKey("");
        setTestState(null);
        setConfirmClear(null);
        onSaved();
        onToast("Settings saved.");
      } catch (error) {
        setFormError(errorMessage(error));
      } finally {
        setSaving(false);
      }
    },
    [
      ai,
      dirty,
      geminiKey,
      geminiKeyChanged,
      geminiModel,
      geminiModelChanged,
      groqKey,
      groqKeyChanged,
      groqModel,
      groqModelChanged,
      ollamaBaseUrl,
      ollamaChanged,
      ollamaEnabled,
      ollamaModel,
      onSaved,
      onToast,
      provider,
      providerChanged,
      saving,
    ],
  );

  const handleClearKey = useCallback(
    async (target: "gemini" | "groq") => {
      if (confirmClear !== target) {
        setConfirmClear(target);
        return;
      }

      setSaving(true);
      setFormError(null);

      try {
        const updated =
          target === "gemini"
            ? await updateSettings({ geminiApiKey: null })
            : await updateSettings({ groqApiKey: null });

        setSettings(updated);
        if (target === "gemini") setGeminiKey("");
        else setGroqKey("");
        setConfirmClear(null);
        setTestState(null);
        onSaved();
        onToast(
          `${target === "gemini" ? "Gemini" : "Groq"} API key removed.`,
        );
      } catch (error) {
        setFormError(errorMessage(error));
      } finally {
        setSaving(false);
      }
    },
    [confirmClear, onSaved, onToast],
  );

  const handleResetDemo = useCallback(async () => {
    if (demoBusy) return;
    setDemoBusy(true);
    setFormError(null);

    try {
      const result = await resetDemoData("reset");
      onToast(
        `Demo library loaded — ${result.demo.articles} stories, ${result.demo.briefings} briefings.`,
      );
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setDemoBusy(false);
    }
  }, [demoBusy, onToast]);

  const handleCheckUpdates = useCallback(async () => {
    if (checkingUpdate) return;
    setCheckingUpdate(true);
    setUpdateState(null);

    try {
      const [{ check }, { relaunch }] = await Promise.all([
        import("@tauri-apps/plugin-updater"),
        import("@tauri-apps/plugin-process"),
      ]);

      const update = await check();

      if (!update) {
        setUpdateState({
          tone: "success",
          message: "Digestr is up to date.",
        });
        return;
      }

      setUpdateState({
        tone: "success",
        message: `Downloading Digestr ${update.version}…`,
      });
      await update.downloadAndInstall();
      setUpdateState({
        tone: "success",
        message: "Update installed. Restarting…",
      });
      await relaunch();
    } catch (error) {
      setUpdateState({
        tone: "error",
        message:
          errorMessage(error) ||
          "Could not check for updates. Try again after the next release.",
      });
    } finally {
      setCheckingUpdate(false);
    }
  }, [checkingUpdate]);

  const canTestGemini = Boolean(ai?.gemini.configured || geminiKeyChanged);
  const canTestGroq = Boolean(ai?.groq.configured || groqKeyChanged);

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

      <div className="relative flex max-h-[92dvh] w-full max-w-[600px] animate-rise flex-col overflow-hidden rounded-t-[24px] border border-hairline bg-panel shadow-popover sm:max-h-[88dvh] sm:rounded-[24px]">
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
              <div className="skeleton h-9 w-full rounded-[9px]" />
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-cybersec/20 bg-cybersec/[0.06] p-3 text-[11.5px] text-ink-secondary">
              <p className="font-medium text-cybersec">
                Could not load settings
              </p>
              <p className="mt-1 leading-relaxed">{loadError}</p>
            </div>
          ) : ai ? (
            <form onSubmit={handleSave} className="space-y-4">
              <section className="rounded-xl border border-hairline bg-white/[0.02] p-3.5">
                <div className="flex items-center gap-2">
                  <Sparkles
                    className="size-3.5 text-ink-secondary"
                    strokeWidth={2}
                  />
                  <h3 className="text-[12.5px] font-semibold text-ink">
                    AI provider
                  </h3>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-ink-tertiary">
                  Choose how &ldquo;Generate Your Read&rdquo; is written. Keys
                  stay on this device, and the built-in editor is always
                  available as a fallback.
                </p>

                <label className="mt-3 block">
                  <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-ink-tertiary">
                    Preferred provider
                  </span>
                  <select
                    value={provider}
                    onChange={(event) => {
                      setProvider(event.target.value as AiProviderChoice);
                      setTestState(null);
                    }}
                    className="mt-1 h-9 w-full rounded-[9px] border border-hairline bg-[#1b1c20] px-2.5 text-[12px] text-ink outline-none transition focus:border-white/20"
                  >
                    <option value="auto">
                      Automatic — best configured provider
                    </option>
                    <option value="gemini">Google Gemini</option>
                    <option value="groq">Groq</option>
                    <option value="ollama">Ollama (local)</option>
                    <option value="fallback">Algorithmic fallback</option>
                  </select>
                </label>

                <p className="mt-2 text-[10.5px] text-ink-tertiary">
                  Currently writing with{" "}
                  <span className="font-medium text-ink-secondary">
                    {PROVIDER_LABEL[ai.effectiveProvider]}
                  </span>
                  .
                  {ai.provider !== "auto" &&
                  ai.effectiveProvider === "fallback" &&
                  ai.provider !== "fallback"
                    ? " The selected provider is not configured yet, so the fallback will be used."
                    : ""}
                </p>
              </section>

              <section className="rounded-xl border border-hairline bg-white/[0.02] p-3.5">
                <CardHeader
                  icon={KeyRound}
                  title="Google Gemini"
                  pill={
                    <StatusPill
                      active={ai.gemini.configured}
                      activeLabel="Configured"
                      idleLabel="Not configured"
                    />
                  }
                />

                <p className="mt-1.5 text-[11px] leading-relaxed text-ink-tertiary">
                  The primary cloud provider. Get a key from{" "}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-ink-secondary underline decoration-white/20 underline-offset-2 transition hover:text-ink"
                  >
                    Google AI Studio
                  </a>
                  .
                </p>

                {ai.gemini.configured ? (
                  <p className="mt-2 flex items-center gap-1.5 font-mono text-[10.5px] text-ink-tertiary">
                    <Lock className="size-3 shrink-0" strokeWidth={2} />
                    {ai.gemini.maskedKey}
                    <span className="font-sans">
                      ·{" "}
                      {ai.gemini.source === "environment"
                        ? "from GEMINI_API_KEY"
                        : "saved in this app"}
                    </span>
                  </p>
                ) : null}

                <SecretInput
                  label="Gemini API key"
                  value={geminiKey}
                  onChange={(value) => {
                    setGeminiKey(value);
                    setTestState(null);
                    setConfirmClear(null);
                  }}
                  show={showKeys.gemini}
                  onToggle={() =>
                    setShowKeys((previous) => ({
                      ...previous,
                      gemini: !previous.gemini,
                    }))
                  }
                  placeholder={
                    ai.gemini.configured
                      ? "Enter a new key to replace the saved one"
                      : "AIza…"
                  }
                />

                <ModelInput
                  label="Gemini model"
                  value={geminiModel}
                  onChange={(value) => {
                    setGeminiModel(value);
                    setTestState(null);
                  }}
                  placeholder="gemini-3.8-flash"
                />

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleTest("gemini")}
                    disabled={busy || !canTestGemini}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-ink-secondary transition hover:bg-white/[0.07] hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {testing === "gemini" ? (
                      <Loader2
                        className="size-3 animate-spin"
                        strokeWidth={2.4}
                      />
                    ) : (
                      <KeyRound className="size-3" strokeWidth={2.2} />
                    )}
                    {testing === "gemini" ? "Testing…" : "Test Connection"}
                  </button>

                  {ai.gemini.source === "database" ? (
                    <button
                      type="button"
                      onClick={() => void handleClearKey("gemini")}
                      disabled={busy}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition disabled:opacity-60",
                        confirmClear === "gemini"
                          ? "border-cybersec/30 bg-cybersec/15 text-cybersec"
                          : "border-transparent text-ink-tertiary hover:bg-white/[0.04] hover:text-ink-secondary",
                      )}
                    >
                      <Trash2 className="size-3" strokeWidth={2.2} />
                      {confirmClear === "gemini"
                        ? "Confirm removal"
                        : "Remove saved key"}
                    </button>
                  ) : null}
                </div>

                {testState?.provider === "gemini" ? (
                  <ResultLine result={testState} />
                ) : null}
              </section>

              <section className="rounded-xl border border-hairline bg-white/[0.02] p-3.5">
                <CardHeader
                  icon={Cloud}
                  title="Groq"
                  pill={
                    <StatusPill
                      active={ai.groq.configured}
                      activeLabel="Configured"
                      idleLabel="Not configured"
                    />
                  }
                />

                <p className="mt-1.5 text-[11px] leading-relaxed text-ink-tertiary">
                  A fast, free-tier cloud alternative. Create a key in the{" "}
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-ink-secondary underline decoration-white/20 underline-offset-2 transition hover:text-ink"
                  >
                    Groq console
                  </a>
                  .
                </p>

                {ai.groq.configured ? (
                  <p className="mt-2 flex items-center gap-1.5 font-mono text-[10.5px] text-ink-tertiary">
                    <Lock className="size-3 shrink-0" strokeWidth={2} />
                    {ai.groq.maskedKey}
                    <span className="font-sans">
                      ·{" "}
                      {ai.groq.source === "environment"
                        ? "from GROQ_API_KEY"
                        : "saved in this app"}
                    </span>
                  </p>
                ) : null}

                <SecretInput
                  label="Groq API key"
                  value={groqKey}
                  onChange={(value) => {
                    setGroqKey(value);
                    setTestState(null);
                    setConfirmClear(null);
                  }}
                  show={showKeys.groq}
                  onToggle={() =>
                    setShowKeys((previous) => ({
                      ...previous,
                      groq: !previous.groq,
                    }))
                  }
                  placeholder={
                    ai.groq.configured
                      ? "Enter a new key to replace the saved one"
                      : "gsk_…"
                  }
                />

                <ModelInput
                  label="Groq model"
                  value={groqModel}
                  onChange={(value) => {
                    setGroqModel(value);
                    setTestState(null);
                  }}
                  placeholder="llama-3.3-70b-versatile"
                />

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleTest("groq")}
                    disabled={busy || !canTestGroq}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-ink-secondary transition hover:bg-white/[0.07] hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {testing === "groq" ? (
                      <Loader2
                        className="size-3 animate-spin"
                        strokeWidth={2.4}
                      />
                    ) : (
                      <Cloud className="size-3" strokeWidth={2.2} />
                    )}
                    {testing === "groq" ? "Testing…" : "Test Connection"}
                  </button>

                  {ai.groq.source === "database" ? (
                    <button
                      type="button"
                      onClick={() => void handleClearKey("groq")}
                      disabled={busy}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition disabled:opacity-60",
                        confirmClear === "groq"
                          ? "border-cybersec/30 bg-cybersec/15 text-cybersec"
                          : "border-transparent text-ink-tertiary hover:bg-white/[0.04] hover:text-ink-secondary",
                      )}
                    >
                      <Trash2 className="size-3" strokeWidth={2.2} />
                      {confirmClear === "groq"
                        ? "Confirm removal"
                        : "Remove saved key"}
                    </button>
                  ) : null}
                </div>

                {testState?.provider === "groq" ? (
                  <ResultLine result={testState} />
                ) : null}
              </section>

              <section className="rounded-xl border border-hairline bg-white/[0.02] p-3.5">
                <CardHeader
                  icon={Cpu}
                  title="Ollama (local)"
                  pill={
                    <StatusPill
                      active={ai.ollama.enabled}
                      activeLabel="Enabled"
                      idleLabel="Off"
                    />
                  }
                />

                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-[11px] leading-relaxed text-ink-tertiary">
                    Run a model privately on this machine. Nothing leaves your
                    device.{" "}
                    <a
                      href="https://ollama.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-ink-secondary underline decoration-white/20 underline-offset-2 transition hover:text-ink"
                    >
                      Install Ollama
                    </a>
                    .
                  </p>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={ollamaEnabled}
                    aria-label="Enable Ollama"
                    onClick={() => {
                      setOllamaEnabled((previous) => !previous);
                      setTestState(null);
                    }}
                    className={cn(
                      "relative h-5 w-9 shrink-0 rounded-full border transition",
                      ollamaEnabled
                        ? "border-positive/40 bg-positive/30"
                        : "border-hairline bg-white/[0.06]",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full bg-ink transition",
                        ollamaEnabled ? "left-[18px]" : "left-[3px]",
                      )}
                    />
                  </button>
                </div>

                <label className="mt-3 block">
                  <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-ink-tertiary">
                    Ollama base URL
                  </span>
                  <input
                    type="url"
                    value={ollamaBaseUrl}
                    onChange={(event) => {
                      setOllamaBaseUrl(event.target.value);
                      setTestState(null);
                    }}
                    placeholder="http://localhost:11434"
                    spellCheck={false}
                    className="mt-1 h-9 w-full rounded-[9px] border border-hairline bg-white/[0.03] px-3 font-mono text-[12px] text-ink outline-none transition placeholder:text-ink-tertiary focus:border-white/20 focus:bg-white/[0.05]"
                  />
                </label>

                <ModelInput
                  label="Ollama model"
                  value={ollamaModel}
                  onChange={(value) => {
                    setOllamaModel(value);
                    setTestState(null);
                  }}
                  placeholder="llama3.1"
                />

                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => void handleTest("ollama")}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-ink-secondary transition hover:bg-white/[0.07] hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {testing === "ollama" ? (
                      <Loader2
                        className="size-3 animate-spin"
                        strokeWidth={2.4}
                      />
                    ) : (
                      <Cpu className="size-3" strokeWidth={2.2} />
                    )}
                    {testing === "ollama" ? "Testing…" : "Test Connection"}
                  </button>
                </div>

                {testState?.provider === "ollama" ? (
                  <ResultLine result={testState} />
                ) : null}
              </section>

              <section className="rounded-xl border border-hairline bg-white/[0.02] p-3.5">
                <CardHeader
                  icon={Sparkles}
                  title="Algorithmic fallback"
                  pill={
                    <StatusPill
                      active
                      activeLabel="Always available"
                      idleLabel=""
                    />
                  }
                />
                <p className="mt-1.5 text-[11px] leading-relaxed text-ink-tertiary">
                  Groups related stories by topic and writes a cited brief
                  without a language model. It is used automatically when no
                  provider is configured or a provider cannot be reached.
                </p>
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => void handleTest("fallback")}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-ink-secondary transition hover:bg-white/[0.07] hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {testing === "fallback" ? (
                      <Loader2
                        className="size-3 animate-spin"
                        strokeWidth={2.4}
                      />
                    ) : (
                      <Check className="size-3" strokeWidth={2.4} />
                    )}
                    {testing === "fallback" ? "Checking…" : "Check fallback"}
                  </button>
                </div>
                {testState?.provider === "fallback" ? (
                  <ResultLine result={testState} />
                ) : null}
              </section>

              <section className="rounded-xl border border-hairline bg-white/[0.02] p-3.5">
                <div className="flex items-center gap-2">
                  <RotateCcw
                    className="size-3.5 text-ink-secondary"
                    strokeWidth={2}
                  />
                  <h3 className="text-[12.5px] font-semibold text-ink">
                    Demo Mode
                  </h3>
                  <span className="ml-auto">
                    <StatusPill
                      active={settings.demo.active}
                      activeLabel="Loaded"
                      idleLabel="Live data"
                    />
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-ink-tertiary">
                  {settings.demo.active
                    ? `${settings.demo.articles} sample stories and ${settings.demo.briefings} pre-written briefings are available. Real stories are never touched.`
                    : "The sample library is not loaded. Reset it any time to demonstrate the reading experience without syncing feeds."}
                </p>
                <button
                  type="button"
                  onClick={() => void handleResetDemo()}
                  disabled={busy}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-ink-secondary transition hover:bg-white/[0.07] hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {demoBusy ? (
                    <Loader2
                      className="size-3 animate-spin"
                      strokeWidth={2.4}
                    />
                  ) : (
                    <RotateCcw className="size-3" strokeWidth={2.2} />
                  )}
                  {demoBusy ? "Loading…" : "Reset / Load Demo Data"}
                </button>
              </section>

              {isDesktop ? (
                <section className="rounded-xl border border-hairline bg-white/[0.02] p-3.5">
                  <div className="flex items-center gap-2">
                    <RefreshCw
                      className="size-3.5 text-ink-secondary"
                      strokeWidth={2}
                    />
                    <h3 className="text-[12.5px] font-semibold text-ink">
                      Updates
                    </h3>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-ink-tertiary">
                    Digestr checks GitHub Releases for signed updates on
                    launch. You can also check now.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleCheckUpdates()}
                    disabled={checkingUpdate || busy}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-ink-secondary transition hover:bg-white/[0.07] hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {checkingUpdate ? (
                      <Loader2
                        className="size-3 animate-spin"
                        strokeWidth={2.4}
                      />
                    ) : (
                      <RefreshCw className="size-3" strokeWidth={2.2} />
                    )}
                    {checkingUpdate ? "Checking…" : "Check for updates"}
                  </button>
                  {updateState ? <ResultLine result={updateState} /> : null}
                </section>
              ) : null}

              <p className="flex items-start gap-1.5 rounded-lg border border-hairline bg-white/[0.02] px-2.5 py-2 text-[10.5px] leading-relaxed text-ink-tertiary">
                <Lock className="mt-0.5 size-3 shrink-0" strokeWidth={2} />
                Keys are stored in the local SQLite database with owner-only
                file permissions and are never returned to the browser in full.
              </p>

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
          ) : null}
        </div>
      </div>
    </div>
  );
}
