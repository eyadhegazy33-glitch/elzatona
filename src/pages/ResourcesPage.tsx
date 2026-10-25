import { zodResolver } from "@hookform/resolvers/zod";
import {
  Armchair,
  Building2,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Table2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import {
  bulkCreateResources,
  getResources,
  saveResource,
  setResourceActive,
  type Resource,
  type ResourceStatus,
  type ResourceType,
} from "../services/resources";

type Toast = { kind: "success" | "error"; key: string } | null;

const resourceSchema = z.object({
  type: z.enum(["seat", "room", "table"]),
  name: z
    .string()
    .trim()
    .min(1, "resources.validation.nameRequired")
    .max(80, "resources.validation.nameMax"),
  capacity: z.coerce
    .number()
    .int("resources.validation.capacityInteger")
    .min(1, "resources.validation.capacityMin")
    .max(200, "resources.validation.capacityMax"),
  status: z.enum(["available", "maintenance"]),
});

const bulkSchema = z.object({
  type: z.enum(["seat", "room", "table"]),
  prefix: z
    .string()
    .trim()
    .min(1, "resources.validation.prefixRequired")
    .max(60, "resources.validation.prefixMax"),
  count: z.coerce
    .number()
    .int("resources.validation.countInteger")
    .min(1, "resources.validation.countMin")
    .max(200, "resources.validation.countMax"),
  capacity: z.coerce
    .number()
    .int("resources.validation.capacityInteger")
    .min(1, "resources.validation.capacityMin")
    .max(200, "resources.validation.capacityMax"),
});

type ResourceFormValues = z.output<typeof resourceSchema>;
type BulkFormValues = z.output<typeof bulkSchema>;
type ResourceDialog = { resource: Resource | null } | null;

const inputClassName =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

const typeIcons: Record<ResourceType, typeof Armchair> = {
  seat: Armchair,
  room: Building2,
  table: Table2,
};

function getErrorKey(cause: unknown): string {
  if (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === "23505"
  ) {
    return "resources.errors.duplicate";
  }
  if (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === "42501"
  ) {
    return "resources.errors.permission";
  }
  return "resources.errors.action";
}

export function ResourcesPage() {
  const { t } = useTranslation();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [dialog, setDialog] = useState<ResourceDialog>(null);
  const [saving, setSaving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  const resourceForm = useForm<
    z.input<typeof resourceSchema>,
    unknown,
    ResourceFormValues
  >({
    resolver: zodResolver(resourceSchema),
    defaultValues: {
      type: "seat",
      name: "",
      capacity: 1,
      status: "available",
    },
  });
  const bulkForm = useForm<
    z.input<typeof bulkSchema>,
    unknown,
    BulkFormValues
  >({
    resolver: zodResolver(bulkSchema),
    defaultValues: {
      type: "seat",
      prefix: "Seat",
      count: 10,
      capacity: 1,
    },
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setResources(await getResources());
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let mounted = true;
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void getResources()
        .then((nextResources) => {
          if (mounted) {
            setResources(nextResources);
            setLoadError(false);
          }
        })
        .catch(() => {
          if (mounted) {
            setLoadError(true);
          }
        });
    }, 30_000);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const openCreateDialog = () => {
    setToast(null);
    resourceForm.reset({
      type: "seat",
      name: "",
      capacity: 1,
      status: "available",
    });
    setDialog({ resource: null });
  };

  const openEditDialog = (resource: Resource) => {
    setToast(null);
    resourceForm.reset({
      type: resource.type,
      name: resource.name,
      capacity: resource.capacity,
      status: resource.status,
    });
    setDialog({ resource });
  };

  const submitResource = resourceForm.handleSubmit(async (values) => {
    if (saving) return;
    setSaving(true);
    setToast(null);
    try {
      await saveResource({
        ...values,
        id: dialog?.resource?.id,
      });
      setDialog(null);
      setToast({
        kind: "success",
        key:
          dialog?.resource
            ? "resources.toast.updated"
            : "resources.toast.created",
      });
      await refresh();
    } catch (cause) {
      setToast({ kind: "error", key: getErrorKey(cause) });
    } finally {
      setSaving(false);
    }
  });

  const submitBulk = bulkForm.handleSubmit(async (values) => {
    if (bulkSaving) return;
    setBulkSaving(true);
    setToast(null);
    try {
      const createdCount = await bulkCreateResources(values);
      setToast({
        kind: "success",
        key:
          createdCount === values.count
            ? "resources.toast.bulkCreated"
            : "resources.toast.bulkCreatedWithSkipped",
      });
      await refresh();
    } catch (cause) {
      setToast({ kind: "error", key: getErrorKey(cause) });
    } finally {
      setBulkSaving(false);
    }
  });

  const toggleActive = async (resource: Resource) => {
    setUpdatingId(resource.id);
    setToast(null);
    try {
      await setResourceActive(resource.id, !resource.active);
      setToast({
        kind: "success",
        key: resource.active
          ? "resources.toast.deactivated"
          : "resources.toast.activated",
      });
      await refresh();
    } catch (cause) {
      setToast({ kind: "error", key: getErrorKey(cause) });
    } finally {
      setUpdatingId(null);
    }
  };

  const formError = (message?: string) =>
    message ? (
      <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
        {t(message)}
      </p>
    ) : null;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-ink dark:text-white">
            {t("pages.resources.title")}
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {t("pages.resources.description")}
          </p>
        </div>
        <button
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90"
          onClick={openCreateDialog}
          type="button"
        >
          <Plus aria-hidden="true" size={17} />
          {t("resources.actions.create")}
        </button>
      </div>

      {toast && (
        <p
          className={`mt-5 rounded-lg border px-4 py-3 text-sm ${
            toast.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          }`}
          role={toast.kind === "error" ? "alert" : "status"}
        >
          {t(toast.key)}
        </p>
      )}

      <section className="mt-7 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-brand/10 p-2 text-brand">
            <Plus aria-hidden="true" size={18} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-ink dark:text-white">
              {t("resources.bulk.title")}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {t("resources.bulk.description")}
            </p>
          </div>
        </div>
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
          onSubmit={submitBulk}
        >
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t("resources.fields.type")}
            <select className={inputClassName} {...bulkForm.register("type")}>
              {(["seat", "room", "table"] as const).map((type) => (
                <option key={type} value={type}>
                  {t(`resources.types.${type}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t("resources.fields.prefix")}
            <input className={inputClassName} {...bulkForm.register("prefix")} />
            {formError(bulkForm.formState.errors.prefix?.message)}
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t("resources.fields.count")}
            <input
              className={inputClassName}
              inputMode="numeric"
              type="number"
              {...bulkForm.register("count")}
            />
            {formError(bulkForm.formState.errors.count?.message)}
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t("resources.fields.capacity")}
            <input
              className={inputClassName}
              inputMode="numeric"
              type="number"
              {...bulkForm.register("capacity")}
            />
            {formError(bulkForm.formState.errors.capacity?.message)}
          </label>
          <div className="flex items-end">
            <button
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-brand px-4 py-2.5 text-sm font-semibold text-brand transition hover:bg-brand/5 disabled:opacity-60 dark:hover:bg-brand/10"
              disabled={bulkSaving}
              type="submit"
            >
              {bulkSaving ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="animate-spin"
                  size={17}
                />
              ) : (
                <Plus aria-hidden="true" size={17} />
              )}
              {t(bulkSaving ? "resources.actions.creating" : "resources.actions.bulkCreate")}
            </button>
          </div>
        </form>
      </section>

      <div className="mt-7 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-ink dark:text-white">
          {t("resources.listTitle")}
        </h2>
        <button
          aria-label={t("resources.actions.refresh")}
          className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          disabled={loading}
          onClick={() => void refresh()}
          type="button"
        >
          {loading ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" size={17} />
          ) : (
            <RefreshCw aria-hidden="true" size={17} />
          )}
        </button>
      </div>

      {loadError && (
        <div
          className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          role="alert"
        >
          <span>{t("resources.errors.load")}</span>
          <button
            className="font-semibold underline"
            onClick={() => void refresh()}
            type="button"
          >
            {t("resources.actions.retry")}
          </button>
        </div>
      )}

      {loading ? (
        <div
          className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500 dark:text-slate-400"
          role="status"
        >
          <LoaderCircle aria-hidden="true" className="animate-spin" size={18} />
          {t("resources.loading")}
        </div>
      ) : !loadError && resources.length === 0 ? (
        <p className="mt-5 rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          {t("resources.empty")}
        </p>
      ) : (
        !loadError && (
          <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full min-w-[820px] border-collapse text-start text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                  <th className="px-4 py-3">{t("resources.columns.name")}</th>
                  <th className="px-4 py-3">{t("resources.columns.type")}</th>
                  <th className="px-4 py-3">{t("resources.columns.capacity")}</th>
                  <th className="px-4 py-3">{t("resources.columns.occupancy")}</th>
                  <th className="px-4 py-3">{t("resources.columns.status")}</th>
                  <th className="px-4 py-3">{t("resources.columns.active")}</th>
                  <th className="px-4 py-3">{t("resources.columns.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {resources.map((resource) => {
                  const Icon = typeIcons[resource.type];
                  return (
                    <tr
                      className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                      key={resource.id}
                    >
                      <td className="px-4 py-4 font-medium text-ink dark:text-slate-100">
                        <span className="inline-flex items-center gap-2">
                          <Icon aria-hidden="true" size={17} />
                          {resource.name}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                        {t(`resources.types.${resource.type}`)}
                      </td>
                      <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                        {resource.capacity}
                      </td>
                      <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                        {t("resources.occupancy", {
                          count: resource.occupancy,
                          capacity: resource.capacity,
                        })}
                      </td>
                      <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                        {t(`resources.status.${resource.status}`)}
                      </td>
                      <td className="px-4 py-4">
                        <button
                          aria-pressed={resource.active}
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            resource.active
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                          disabled={updatingId === resource.id}
                          onClick={() => void toggleActive(resource)}
                          type="button"
                        >
                          {t(
                            resource.active
                              ? "resources.status.active"
                              : "resources.status.inactive",
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            aria-label={t("resources.actions.editNamed", {
                              name: resource.name,
                            })}
                            className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            onClick={() => openEditDialog(resource)}
                            type="button"
                          >
                            <Pencil aria-hidden="true" size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {dialog !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setDialog(null);
            }
          }}
        >
          <section
            aria-labelledby="resource-dialog-title"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <h2
                className="text-xl font-semibold text-ink dark:text-white"
                id="resource-dialog-title"
              >
                {t(
                  dialog.resource
                    ? "resources.dialog.editTitle"
                    : "resources.dialog.createTitle",
                )}
              </h2>
              <button
                aria-label={t("resources.actions.close")}
                className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                disabled={saving}
                onClick={() => setDialog(null)}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            <form className="mt-5 space-y-4" onSubmit={submitResource}>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t("resources.fields.type")}
                <select
                  className={inputClassName}
                  {...resourceForm.register("type")}
                >
                  {(["seat", "room", "table"] as const).map((type) => (
                    <option key={type} value={type}>
                      {t(`resources.types.${type}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t("resources.fields.name")}
                <input
                  autoFocus
                  className={inputClassName}
                  {...resourceForm.register("name")}
                />
                {formError(resourceForm.formState.errors.name?.message)}
              </label>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t("resources.fields.capacity")}
                <input
                  className={inputClassName}
                  inputMode="numeric"
                  type="number"
                  {...resourceForm.register("capacity")}
                />
                {formError(resourceForm.formState.errors.capacity?.message)}
              </label>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t("resources.fields.status")}
                <select
                  className={inputClassName}
                  {...resourceForm.register("status")}
                >
                  {(["available", "maintenance"] as const).map(
                    (status: ResourceStatus) => (
                      <option key={status} value={status}>
                        {t(`resources.status.${status}`)}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  className="min-h-10 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  disabled={saving}
                  onClick={() => setDialog(null)}
                  type="button"
                >
                  {t("resources.actions.cancel")}
                </button>
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-60"
                  disabled={saving}
                  type="submit"
                >
                  {saving && (
                    <LoaderCircle
                      aria-hidden="true"
                      className="animate-spin"
                      size={16}
                    />
                  )}
                  {t(
                    saving
                      ? "resources.actions.saving"
                      : "resources.actions.save",
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
