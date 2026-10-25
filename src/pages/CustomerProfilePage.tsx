import QRCode from "qrcode";
import {
  ArrowLeft,
  CalendarDays,
  LoaderCircle,
  Pencil,
  Printer,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  CustomerCardPrint,
  type PrintableCustomerCard,
} from "../components/CustomerCardPrint";
import { useAuth } from "../hooks/useAuth";
import {
  getCustomer,
  getCustomerQrToken,
  getCustomerVisits,
  reissueQrToken,
  setCustomerStatus,
  softDeleteCustomer,
  type Customer,
  type CustomerStatus,
} from "../services/customers";
import { logCustomerCardPrint } from "../services/customerCards";
import { getRolePermissionKeys as loadRolePermissionKeys } from "../services/roles";

type Visit = { id: number; checked_in_at: string };
type CustomerAction = "block" | "unblock" | "expire" | "reissue" | "delete";
type ConfirmAction = CustomerAction | null;

function customerErrorKey(cause: unknown): string {
  if (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === "42501"
  ) {
    return "customers.errors.permission";
  }
  if (
    typeof cause === "object" &&
    cause !== null &&
    "message" in cause &&
    typeof cause.message === "string" &&
    cause.message.toLowerCase().includes("not allowed")
  ) {
    return "customers.errors.permission";
  }
  return "customers.errors.action";
}

function formatDate(
  value: string | null,
  language: string,
  includeTime = false,
): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  }).format(new Date(value));
}

export function CustomerProfilePage() {
  const { i18n, t } = useTranslation();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { customerId = "" } = useParams();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toastKey, setToastKey] = useState<string | null>(null);
  const [newQrDataUrl, setNewQrDataUrl] = useState<string | null>(null);
  const [printingCard, setPrintingCard] = useState(false);
  const [printableCards, setPrintableCards] = useState<
    PrintableCustomerCard[]
  >([]);

  const canEdit = permissions.includes("customers.edit");
  const canDelete = permissions.includes("customers.delete");
  const canPrint = permissions.includes("customers.cards");
  const dateLocale = i18n.language === "ar" ? "ar" : "en";

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [customerResult, visitsResult] = await Promise.all([
        getCustomer(customerId),
        getCustomerVisits(customerId),
      ]);
      setCustomer(customerResult);
      setVisits(visitsResult);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let mounted = true;
    if (!profile?.role_id) return;
    void loadRolePermissionKeys(profile.role_id)
      .then((keys) => {
        if (mounted) setPermissions(keys);
      })
      .catch(() => {
        if (mounted) setActionError("customers.errors.permission");
      });
    return () => {
      mounted = false;
    };
  }, [profile?.role_id]);

  useEffect(() => {
    if (!printableCards.length) return;
    const frame = window.requestAnimationFrame(() => window.print());
    const clear = () => setPrintableCards([]);
    window.addEventListener("afterprint", clear, { once: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", clear);
    };
  }, [printableCards]);

  const confirm = async () => {
    if (!customer || !confirmAction || actionLoading) return;
    setActionLoading(true);
    setActionError(null);
    setToastKey(null);
    try {
      if (confirmAction === "block") {
        await setCustomerStatus(customer.id, "blocked");
        setToastKey("customers.toast.blocked");
      } else if (confirmAction === "unblock") {
        await setCustomerStatus(customer.id, "active");
        setToastKey("customers.toast.unblocked");
      } else if (confirmAction === "expire") {
        await setCustomerStatus(customer.id, "expired");
        setToastKey("customers.toast.expired");
      } else if (confirmAction === "delete") {
        await softDeleteCustomer(customer.id);
        navigate("/customers", { replace: true });
        return;
      } else {
        const token = await reissueQrToken(customer.id);
        const qrDataUrl = await QRCode.toDataURL(token, {
          errorCorrectionLevel: "M",
          margin: 4,
          width: 256,
        });
        setNewQrDataUrl(qrDataUrl);
        setToastKey("customers.toast.qrReissued");
      }
      setConfirmAction(null);
      if (confirmAction !== "reissue") await refresh();
    } catch (cause) {
      setActionError(customerErrorKey(cause));
    } finally {
      setActionLoading(false);
    }
  };

  const printNewCard = async () => {
    if (!customer || !canPrint || printingCard) return;
    setPrintingCard(true);
    try {
      const token = await getCustomerQrToken(customer.id);
      const qrDataUrl = await QRCode.toDataURL(token, {
        errorCorrectionLevel: "M",
        margin: 4,
        width: 256,
      });
      await logCustomerCardPrint(1);
      const studentType = customer.student_type;
      setPrintableCards([
        {
          customer,
          qrDataUrl,
          studentTypeName:
            studentType == null
              ? ""
              : i18n.dir() === "rtl"
                ? studentType.name_ar
                : studentType.name_en,
        },
      ]);
    } catch {
      setActionError("customers.errors.action");
    } finally {
      setPrintingCard(false);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-64 place-items-center">
        <LoaderCircle
          aria-label={t("customers.loading")}
          className="animate-spin text-brand"
          size={24}
        />
      </div>
    );
  }

  const statusLabel = (status: CustomerStatus) =>
    t(`customers.status.${status}`);
  const dialogTitle =
    confirmAction === "block"
      ? "customers.dialog.blockTitle"
      : confirmAction === "unblock"
        ? "customers.dialog.unblockTitle"
        : confirmAction === "expire"
          ? "customers.dialog.expireTitle"
          : confirmAction === "reissue"
            ? "customers.dialog.reissueTitle"
            : "customers.dialog.deleteTitle";
  const dialogMessage =
    confirmAction === "block"
      ? "customers.dialog.blockMessage"
      : confirmAction === "unblock"
        ? "customers.dialog.unblockMessage"
        : confirmAction === "expire"
          ? "customers.dialog.expireMessage"
          : confirmAction === "reissue"
            ? "customers.dialog.reissueMessage"
            : "customers.dialog.deleteMessage";

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline"
        to="/customers"
      >
        <ArrowLeft aria-hidden="true" size={17} />
        {t("customers.actions.backToList")}
      </Link>

      {loadError && (
        <div
          className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          role="alert"
        >
          {t("customers.errors.load")}
          <button
            className="ms-3 font-semibold underline underline-offset-2"
            onClick={() => void refresh()}
            type="button"
          >
            {t("customers.actions.retry")}
          </button>
        </div>
      )}

      {!loadError && !customer && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-2xl font-semibold text-ink dark:text-white">
            {t("customers.errors.notFound")}
          </h1>
        </div>
      )}

      {customer && (
        <>
          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-tight text-ink dark:text-white">
                  {customer.full_name}
                </h1>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                    customer.status === "active"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : customer.status === "blocked"
                        ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                        : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                  }`}
                >
                  {statusLabel(customer.status)}
                </span>
              </div>
              <p className="mt-2 font-mono text-sm text-slate-500 dark:text-slate-400">
                {customer.code}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canPrint && (
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand px-3 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={actionLoading || printingCard}
                  onClick={() => void printNewCard()}
                  type="button"
                >
                  <Printer aria-hidden="true" size={16} />
                  {printingCard
                    ? t("customerCards.printing")
                    : t("customers.actions.printCard")}
                </button>
              )}
              {canEdit && (
                <Link
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                  to={`/customers/${customer.id}/edit`}
                >
                  <Pencil aria-hidden="true" size={16} />
                  {t("customers.actions.edit")}
                </Link>
              )}
              {canEdit && customer.status !== "blocked" && (
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-300 px-3 text-sm font-semibold text-amber-900 dark:border-amber-900 dark:text-amber-200"
                  onClick={() => setConfirmAction("block")}
                  type="button"
                >
                  <ShieldAlert aria-hidden="true" size={16} />
                  {t("customers.actions.block")}
                </button>
              )}
              {canEdit && customer.status === "blocked" && (
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-emerald-300 px-3 text-sm font-semibold text-emerald-900 dark:border-emerald-900 dark:text-emerald-200"
                  onClick={() => setConfirmAction("unblock")}
                  type="button"
                >
                  <ShieldCheck aria-hidden="true" size={16} />
                  {t("customers.actions.unblock")}
                </button>
              )}
              {canEdit && customer.status !== "expired" && (
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                  onClick={() => setConfirmAction("expire")}
                  type="button"
                >
                  <CalendarDays aria-hidden="true" size={16} />
                  {t("customers.actions.markExpired")}
                </button>
              )}
              {canEdit && (
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                  onClick={() => {
                    setActionError(null);
                    setNewQrDataUrl(null);
                    setConfirmAction("reissue");
                  }}
                  type="button"
                >
                  <RefreshCw aria-hidden="true" size={16} />
                  {t("customers.actions.reissueQr")}
                </button>
              )}
              {canDelete && (
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-300 px-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:text-red-300"
                  onClick={() => setConfirmAction("delete")}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={16} />
                  {t("customers.actions.delete")}
                </button>
              )}
            </div>
          </div>

          {actionError && (
            <p
              className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
              role="alert"
            >
              {t(actionError)}
            </p>
          )}
          {toastKey && (
            <p
              className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
              role="status"
            >
              {t(toastKey)}
            </p>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
              <h2 className="text-lg font-semibold text-ink dark:text-white">
                {t("customers.profile.details")}
              </h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <Detail label={t("customers.fields.birthDate")} value={formatDate(customer.birth_date, dateLocale)} />
                <Detail
                  label={t("customers.fields.studentType")}
                  value={
                    customer.student_type
                      ? i18n.dir() === "rtl"
                        ? customer.student_type.name_ar
                        : customer.student_type.name_en
                      : "—"
                  }
                />
                <Detail label={t("customers.fields.phone")} value={customer.phone ?? "—"} direction="ltr" />
                <Detail
                  label={t("customers.fields.expiry")}
                  value={
                    customer.expiry_date
                      ? formatDate(customer.expiry_date, dateLocale)
                      : t("customers.values.noExpiry")
                  }
                />
                <Detail label={t("customers.fields.created")} value={formatDate(customer.created_at, dateLocale)} />
                <Detail label={t("customers.fields.updated")} value={formatDate(customer.updated_at, dateLocale)} />
              </dl>
              <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {t("customers.fields.notes")}
                </h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                  {customer.notes || t("customers.values.noNotes")}
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
              <h2 className="text-lg font-semibold text-ink dark:text-white">
                {t("customers.profile.visits")}
              </h2>
              {visits.length === 0 ? (
                <p className="mt-4 rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                  {t("customers.profile.noVisits")}
                </p>
              ) : (
                <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="min-w-full divide-y divide-slate-200 text-start text-sm dark:divide-slate-800">
                    <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3 font-medium">
                          {t("customers.profile.visitDate")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {visits.map((visit) => (
                        <tr key={visit.id}>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                            {formatDate(visit.checked_in_at, dateLocale, true)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          {newQrDataUrl && (
            <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30 sm:flex-row sm:items-center">
              <img
                alt={t("customers.print.qrCode")}
                className="size-32 rounded-lg bg-white p-2"
                src={newQrDataUrl}
              />
              <div className="flex-1">
                <h2 className="font-semibold text-emerald-900 dark:text-emerald-200">
                  {t("customers.toast.qrReissued")}
                </h2>
                <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-300">
                  {t("customers.dialog.reissueComplete")}
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {confirmAction && customer && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !actionLoading) {
              setConfirmAction(null);
            }
          }}
        >
          <section
            aria-labelledby="customer-action-title"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
            role="dialog"
          >
            <h2
              className="text-lg font-semibold text-ink dark:text-white"
              id="customer-action-title"
            >
              {t(dialogTitle)}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {t(dialogMessage, { name: customer.full_name })}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
                disabled={actionLoading}
                onClick={() => setConfirmAction(null)}
                type="button"
              >
                {t("customers.actions.cancel")}
              </button>
              <button
                className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60 ${
                  confirmAction === "delete"
                    ? "bg-red-700"
                    : "bg-brand"
                }`}
                disabled={actionLoading}
                onClick={() => void confirm()}
                type="button"
              >
                {actionLoading && (
                  <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
                )}
                {t(
                  actionLoading
                    ? "customers.actions.working"
                    : "customers.actions.confirm",
                )}
              </button>
            </div>
          </section>
        </div>
      )}

      {customer && (
        <CustomerCardPrint
          cards={printableCards}
        />
      )}
    </section>
  );
}

function Detail({
  label,
  value,
  direction,
}: {
  label: string;
  value: string;
  direction?: "ltr";
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd
        className="mt-1 break-words text-sm font-medium text-slate-800 dark:text-slate-100"
        dir={direction}
      >
        {value}
      </dd>
    </div>
  );
}
