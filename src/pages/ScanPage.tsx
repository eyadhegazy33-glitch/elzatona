import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  Camera,
  CheckCircle2,
  DoorClosed,
  DoorOpen,
  LoaderCircle,
  ShieldAlert,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { getSupabaseClient } from "../lib/supabase";
import { getResources, type Resource } from "../services/resources";

type ScanReason = "ok" | "blocked" | "expired" | "unknown";

type ScanCustomerPayload = {
  id: string;
  code: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  student_type?: { name: string } | null;
};

type ScanResponse = {
  ok: boolean;
  reason: ScanReason;
  customer?: ScanCustomerPayload;
  checkin?: {
    id: number;
    checked_in_at: string;
    resource_id?: string | null;
    customer_id?: string;
  } | null;
};

type LiveInsideRow = {
  id: number;
  checked_in_at: string;
  customer?: { first_name: string; last_name: string } | null;
  resource?: { id: string; name: string; type: string } | null;
};

type ToastState = { kind: "success" | "error"; message: string } | null;

type LastScanState = {
  value: string;
  at: number;
};

const SCAN_COOLDOWN_MS = 3000;
const RESULT_RESET_MS = 5000;

function formatDateTime(value: string, locale: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatInsideDuration(value: string) {
  const started = new Date(value).getTime();
  const diffMs = Date.now() - started;
  const totalMinutes = Math.max(0, Math.floor(diffMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function playAlert(kind: "success" | "error", muted: boolean) {
  if (muted) return;
  const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return;

  const context = new AudioCtor();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = kind === "success" ? "sine" : "square";
  oscillator.frequency.value = kind === "success" ? 880 : 220;
  gain.gain.value = 0.08;
  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start();
  oscillator.stop(context.currentTime + (kind === "success" ? 0.12 : 0.18));
  void context.close();
}

export function ScanPage() {
  const { i18n, t } = useTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastScanRef = useRef<LastScanState | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [availableResources, setAvailableResources] = useState<Resource[]>([]);
  const [selectedResourceId, setSelectedResourceId] = useState("");
  const [insideNow, setInsideNow] = useState<LiveInsideRow[]>([]);
  const [lastScans, setLastScans] = useState<LastScanState[]>([]);
  const [toast, setToast] = useState<ToastState>(null);
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<"checkin" | "checkout" | null>(null);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  const currentLocale = i18n.language || "en";

  const refreshResources = useCallback(async () => {
    try {
      const data = await getResources();
      const active = data.filter(
        (resource) =>
          resource.active && resource.status === "available" && resource.occupancy < resource.capacity,
      );
      setAvailableResources(active);
      if (!selectedResourceId && active[0]) {
        setSelectedResourceId(active[0].id);
      }
    } catch {
      setAvailableResources([]);
    }
  }, [selectedResourceId]);

  const refreshInsideNow = useCallback(async () => {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("checkins")
      .select(
        "id, checked_in_at, customer_id, resource_id, customer:customers(id, first_name, last_name), resource:resources(id, name, type)",
      )
      .is("checked_out_at", null)
      .order("checked_in_at", { ascending: false })
      .limit(20);

    if (!error) {
      setInsideNow((data ?? []) as unknown as LiveInsideRow[]);
    }
  }, []);

  const loadCustomerMeta = useCallback(async (customerId: string) => {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("customers")
      .select(
        "id, code, first_name, last_name, birth_date, student_type:student_types(name)",
      )
      .eq("id", customerId)
      .single();

    if (!error && data) {
      return {
        ...(data as Record<string, unknown>),
        student_type: (data as any).student_type ?? null,
      } as unknown as ScanCustomerPayload;
    }

    return null;
  }, []);

  const handleScanValue = useCallback(
    async (value: string) => {
      const normalized = value.trim();
      if (!normalized) {
        return;
      }

      const now = Date.now();
      const previous = lastScanRef.current;
      if (previous && previous.value.toLowerCase() === normalized.toLowerCase() && now - previous.at < SCAN_COOLDOWN_MS) {
        return;
      }
      lastScanRef.current = { value: normalized, at: now };
      setLastScans((current) => [{ value: normalized, at: now }, ...current].slice(0, 10));
      setManualCode("");

      try {
        setBusy(true);
        const client = getSupabaseClient();
        const { data, error } = await client.rpc("scan_customer", {
          p_input: normalized,
        });

        if (error) {
          throw error;
        }

        const payload = data as ScanResponse | null;
        const fullData = payload && payload.customer
          ? {
              ...payload,
              customer: {
                ...payload.customer,
                ...(await loadCustomerMeta(payload.customer.id)),
              },
            }
          : payload;

        setResult(fullData ?? null);

        if (fullData?.ok) {
          playAlert("success", muted);
        } else {
          playAlert("error", muted);
        }

        if (fullData?.ok) {
          await refreshResources();
          await refreshInsideNow();
        }
      } catch (error: unknown) {
        const message =
          error && typeof error === "object" && "message" in error
            ? String((error as { message?: string }).message)
            : "";

        setResult({
          ok: false,
          reason: "unknown",
          customer: undefined,
          checkin: null,
        });
        setToast({
          kind: "error",
          message: message || t("scan.errors.general"),
        });
        playAlert("error", muted);
      } finally {
        setBusy(false);
        setTimeout(() => {
          if (inputRef.current) inputRef.current.focus();
        }, 0);
      }
    },
    [loadCustomerMeta, muted, refreshInsideNow, refreshResources, t],
  );

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    void refreshResources();
    void refreshInsideNow();
  }, [refreshInsideNow, refreshResources]);

  useEffect(() => {
    const client = getSupabaseClient();
    const channel = client.channel("scan-checkins-live");

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "checkins" },
      () => {
        void refreshInsideNow();
        void refreshResources();
      },
    );

    void channel.subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [refreshInsideNow, refreshResources]);

  useEffect(() => {
    let cancelled = false;
    let scanner: Html5Qrcode | null = null;
    const startScanner = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) {
          setCameraError(t("scan.camera.unsupported"));
        }
        return;
      }

      try {
        scanner = new Html5Qrcode("scanner-reader");
        await scanner.start(
          { facingMode: { ideal: "environment" } },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          async (decodedText) => {
            await handleScanValue(decodedText);
          },
          () => undefined,
        );

        if (!cancelled) {
          setCameraError("");
        }
      } catch {
        if (!cancelled) {
          setCameraError(t("scan.camera.permissionDenied"));
        }
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      if (scanner) {
        void scanner.stop().catch(() => undefined);
        scanner.clear();
      }
    };
  }, [handleScanValue, t]);

  useEffect(() => {
    if (!result || !result.ok || !result.customer) {
      return;
    }

    const timer = window.setTimeout(() => {
      setResult(null);
      setToast(null);
    }, RESULT_RESET_MS);

    return () => window.clearTimeout(timer);
  }, [result]);

  const handleManualSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!manualCode.trim() || isSubmittingManual) return;
    setIsSubmittingManual(true);
    await handleScanValue(manualCode);
    setIsSubmittingManual(false);
  };

  const handleCheckIn = async () => {
    if (!result?.customer || !selectedResourceId || actionBusy) return;

    setActionBusy("checkin");
    setToast(null);

    try {
      const client = getSupabaseClient();
      const { error } = await client.rpc("check_in", {
        p_customer: result.customer.id,
        p_resource: selectedResourceId,
      });

      if (error) {
        throw error;
      }

      setToast({ kind: "success", message: t("scan.toast.checkedIn") });
      playAlert("success", muted);
      await refreshResources();
      await refreshInsideNow();
      setTimeout(() => setResult(null), 5000);
    } catch (error: unknown) {
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message)
          : "";

      const normalized = message.toLowerCase();
      let friendly = t("scan.errors.general");
      if (normalized.includes("resource is full")) {
        friendly = t("scan.errors.resourceFull");
      } else if (normalized.includes("already checked in")) {
        friendly = t("scan.errors.alreadyCheckedIn");
      } else if (normalized.includes("customer not allowed to enter")) {
        friendly = t("scan.errors.customerNotAllowed");
      }
      setToast({ kind: "error", message: friendly });
      playAlert("error", muted);
    } finally {
      setActionBusy(null);
    }
  };

  const handleCheckOut = async () => {
    if (!result?.checkin || actionBusy) return;

    setActionBusy("checkout");
    setToast(null);

    try {
      const client = getSupabaseClient();
      const { error } = await client.rpc("check_out", {
        p_checkin: result.checkin.id,
      });

      if (error) {
        throw error;
      }

      setToast({ kind: "success", message: t("scan.toast.checkedOut") });
      playAlert("success", muted);
      await refreshResources();
      await refreshInsideNow();
      setTimeout(() => setResult(null), 5000);
    } catch (error: unknown) {
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message)
          : "";

      setToast({ kind: "error", message: message || t("scan.errors.general") });
      playAlert("error", muted);
    } finally {
      setActionBusy(null);
    }
  };

  const resultTitle =
    !result
      ? ""
      : result.ok
        ? t("scan.result.ok")
        : result.reason === "blocked"
          ? t("scan.result.blocked")
          : result.reason === "expired"
            ? t("scan.result.expired")
            : t("scan.result.unknown");

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink dark:text-white">
            {t("pages.scan.title")}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t("pages.scan.description")}
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
          onClick={() => setMuted((current) => !current)}
          type="button"
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          {muted ? t("scan.actions.mute") : t("scan.actions.unmute")}
        </button>
      </div>

      {toast && (
        <div
          className={`mb-5 rounded-lg border px-4 py-3 text-sm ${
            toast.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          }`}
          role={toast.kind === "error" ? "alert" : "status"}
        >
          {toast.message}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.5fr_0.9fr]">
        <section className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                <Camera size={16} />
                {t("scan.camera.title")}
              </div>
              {busy && (
                <div className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <LoaderCircle className="animate-spin" size={14} />
                  {t("scan.camera.scanning")}
                </div>
              )}
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
              <div id="scanner-reader" className="min-h-[290px] w-full bg-black/80" />
            </div>

            {cameraError && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {cameraError}
              </p>
            )}

            <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={handleManualSubmit}>
              <label className="sr-only" htmlFor="manual-code">
                {t("scan.manual.label")}
              </label>
              <input
                id="manual-code"
                ref={inputRef}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none ring-0 focus:border-brand dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleManualSubmit(event as unknown as React.FormEvent);
                  }
                }}
                onChange={(event) => setManualCode(event.target.value)}
                placeholder={t("scan.manual.placeholder")}
                value={manualCode}
              />
              <button
                className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                disabled={isSubmittingManual || !manualCode.trim()}
                type="submit"
              >
                {isSubmittingManual ? t("scan.actions.submitting") : t("scan.actions.submit")}
              </button>
            </form>
          </div>

          {result && (
            <div
              className={`rounded-2xl border p-5 ${
                result.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                  : "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  {result.ok ? (
                    <CheckCircle2 className="shrink-0" size={22} />
                  ) : (
                    <ShieldAlert className="shrink-0" size={22} />
                  )}
                  <div>
                    <h2 className="text-xl font-semibold">{resultTitle}</h2>
                    {!result.ok && (
                      <p className="mt-1 text-sm opacity-80">
                        {t(
                          result.reason === "blocked"
                            ? "scan.messages.blocked"
                            : result.reason === "expired"
                              ? "scan.messages.expired"
                              : "scan.messages.unknown",
                        )}
                      </p>
                    )}
                  </div>
                </div>
                {result.ok && result.customer && (
                  <span className="rounded-full border border-current/30 px-2 py-1 text-xs font-semibold">
                    {t("scan.result.ok")}
                  </span>
                )}
              </div>

              {result.ok && result.customer && (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide opacity-75">
                      {t("scan.fields.name")}
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {`${result.customer.first_name} ${result.customer.last_name}`.trim()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide opacity-75">
                      {t("scan.fields.code")}
                    </p>
                    <p className="mt-1 font-mono text-base font-semibold">
                      {result.customer.code}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide opacity-75">
                      {t("scan.fields.birthDate")}
                    </p>
                    <p className="mt-1 text-base font-medium">
                      {formatDateTime(`${result.customer.birth_date}T00:00:00`, currentLocale)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide opacity-75">
                      {t("scan.fields.studentType")}
                    </p>
                    <p className="mt-1 text-base font-medium">
                      {result.customer.student_type?.name || t("scan.fields.unknownType")}
                    </p>
                  </div>
                </div>
              )}

              {result.ok && result.checkin?.checked_in_at && (
                <div className="mt-4 rounded-lg border border-current/20 bg-black/5 px-3 py-2 text-sm dark:bg-white/5">
                  <span className="font-semibold">{t("scan.status.alreadyInside")}</span>
                  {" "}
                  {formatDateTime(result.checkin.checked_in_at, currentLocale)}
                </div>
              )}

              {result.ok && (
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  {!result.checkin?.id ? (
                    <>
                      <label className="min-w-[220px] flex-1">
                        <span className="mb-1 block text-xs uppercase tracking-wide opacity-75">
                          {t("scan.fields.resource")}
                        </span>
                        <select
                          className="w-full rounded-lg border border-current/25 bg-white/40 px-3 py-2 text-sm text-slate-900 outline-none dark:bg-slate-950/40 dark:text-white"
                          onChange={(event) => setSelectedResourceId(event.target.value)}
                          value={selectedResourceId}
                        >
                          <option value="">{t("scan.fields.selectResource")}</option>
                          {availableResources.map((resource) => (
                            <option key={resource.id} value={resource.id}>
                              {resource.name} ({resource.type})
                            </option>
                          ))}
                        </select>
                      </label>

                      <button
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white disabled:opacity-60"
                        disabled={!selectedResourceId || actionBusy !== null}
                        onClick={() => void handleCheckIn()}
                        type="button"
                      >
                        {actionBusy === "checkin" ? (
                          <LoaderCircle className="animate-spin" size={16} />
                        ) : (
                          <DoorOpen size={16} />
                        )}
                        {t("scan.actions.checkIn")}
                      </button>
                    </>
                  ) : (
                    <button
                      className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 font-semibold text-white disabled:opacity-60"
                      disabled={actionBusy !== null}
                      onClick={() => void handleCheckOut()}
                      type="button"
                    >
                      {actionBusy === "checkout" ? (
                        <LoaderCircle className="animate-spin" size={16} />
                      ) : (
                        <DoorClosed size={16} />
                      )}
                      {t("scan.actions.checkOut")}
                    </button>
                  )}

                  <button
                    className="rounded-lg border border-current/25 px-4 py-2.5 font-semibold opacity-50"
                    disabled
                    type="button"
                  >
                    {t("scan.actions.newOrder")}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-ink dark:text-white">
              {t("scan.sidePanels.insideNow")}
            </h3>
            <div className="mt-4 space-y-3">
              {insideNow.length === 0 ? (
                <p className="text-sm text-slate-500">{t("scan.empty.insideNow")}</p>
              ) : (
                insideNow.map((row) => {
                  const customerName = row.customer
                    ? `${row.customer.first_name} ${row.customer.last_name}`.trim()
                    : t("scan.fields.unknownCustomer");
                  const resourceName = row.resource?.name || t("scan.fields.noResource");
                  return (
                    <div
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950"
                      key={row.id}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-ink dark:text-white">{customerName}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {resourceName} · {formatInsideDuration(row.checked_in_at)}
                          </p>
                        </div>
                        <button
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                          onClick={async () => {
                            const client = getSupabaseClient();
                            await client.rpc("check_out", { p_checkin: Number(row.id) });
                            await refreshInsideNow();
                            await refreshResources();
                          }}
                          type="button"
                        >
                          {t("scan.actions.checkOut")}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-ink dark:text-white">
              {t("scan.sidePanels.lastScans")}
            </h3>
            <div className="mt-4 space-y-2">
              {lastScans.length === 0 ? (
                <p className="text-sm text-slate-500">{t("scan.empty.lastScans")}</p>
              ) : (
                lastScans.map((scan, index) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                    key={`${scan.value}-${index}`}
                  >
                    <span className="font-mono">{scan.value}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(scan.at).toLocaleTimeString(currentLocale)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
