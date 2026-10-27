import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Printer, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { CustomerCard, type CustomerCardDetails } from "../components/CustomerCard";
import { useAuth } from "../hooks/useAuth";
import { getCustomerQrToken, reissueQrToken } from "../services/customers";
import {
  getCustomerCardRecords,
  getCustomerImportOptions,
  logCustomerCardPrint,
  type CustomerCardRecord,
  type CustomerImportOption,
} from "../services/customerCards";
import { getActiveStudentTypes, type StudentType } from "../services/customers";
import { getRolePermissionKeys } from "../services/roles";

const cardsPerPage = 10;

function splitIntoRows<T>(items: T[], rowSize: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += rowSize) {
    rows.push(items.slice(index, index + rowSize));
  }
  return rows;
}

function backSideOrder<T>(items: T[]): T[] {
  return splitIntoRows(items, 2).flatMap((row) => row.reverse());
}

function formatDate(value: string, locale: string): string {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function CustomerCardsPrintPage() {
  const { i18n, t } = useTranslation();
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [studentTypeId, setStudentTypeId] = useState("");
  const [createdToday, setCreatedToday] = useState(false);
  const [customers, setCustomers] = useState<CustomerCardRecord[]>([]);
  const [studentTypes, setStudentTypes] = useState<StudentType[]>([]);
  const [imports, setImports] = useState<CustomerImportOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [reissuingId, setReissuingId] = useState("");
  const [includeBack, setIncludeBack] = useState(false);
  const [error, setError] = useState("");
  const importId = searchParams.get("import") ?? "";
  const singleCustomerId = searchParams.get("customer") ?? "";

  const refreshCustomers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [records, types, importOptions] = await Promise.all([
        getCustomerCardRecords({
          search,
          studentTypeId,
          createdToday,
          importId,
        }),
        getActiveStudentTypes(),
        getCustomerImportOptions(),
      ]);
      setCustomers(records);
      setStudentTypes(types);
      setImports(importOptions);
      if (singleCustomerId) {
        setSelectedIds(
          records.some((customer) => customer.id === singleCustomerId)
            ? [singleCustomerId]
            : [],
        );
      }
    } catch {
      setError(t("customerCards.errors.load"));
    } finally {
      setLoading(false);
    }
  }, [
    createdToday,
    importId,
    search,
    singleCustomerId,
    studentTypeId,
    t,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshCustomers(), 250);
    return () => window.clearTimeout(timer);
  }, [refreshCustomers]);

  useEffect(() => {
    let cancelled = false;
    if (!profile?.role_id) {
      setCanManage(false);
      return () => {
        cancelled = true;
      };
    }
    void getRolePermissionKeys(profile.role_id)
      .then((keys) => {
        if (!cancelled) setCanManage(keys.includes("customers.edit"));
      })
      .catch(() => {
        if (!cancelled) {
          setCanManage(false);
          setError(t("customerCards.errors.permission"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.role_id, t]);

  const selectedCustomers = useMemo(
    () => customers.filter((customer) => selectedIds.includes(customer.id)),
    [customers, selectedIds],
  );

  useEffect(() => {
    let cancelled = false;
    const missing = selectedCustomers.filter((customer) => !tokens[customer.id]);

    if (!missing.length) {
      setLoadingTokens(false);
      return () => {
        cancelled = true;
      };
    }

    setLoadingTokens(true);
    setError("");
    void (async () => {
      try {
        const nextTokens: Record<string, string> = {};
        for (let index = 0; index < missing.length; index += 10) {
          const batch = missing.slice(index, index + 10);
          const values = await Promise.all(
            batch.map(async (customer) => [
              customer.id,
              await getCustomerQrToken(customer.id),
            ] as const),
          );
          for (const [id, token] of values) nextTokens[id] = token;
          if (!cancelled) setTokens((current) => ({ ...current, ...nextTokens }));
        }
      } catch {
        if (!cancelled) setError(t("customerCards.errors.load"));
      } finally {
        if (!cancelled) setLoadingTokens(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedCustomers, t, tokens]);

  const cardById = useMemo(() => {
    const entries = selectedCustomers.flatMap((customer) => {
      const token = tokens[customer.id];
      if (!token) return [];
      const studentType = customer.student_type?.name ?? "";
      const card: CustomerCardDetails = {
        fullName: customer.full_name,
        studentType: studentType ?? "",
        birthDate: formatDate(customer.birth_date, i18n.language),
        code: customer.code,
        qrToken: token,
      };
      return [[customer.id, card] as const];
    });
    return new Map(entries);
  }, [i18n.language, selectedCustomers, tokens]);
  const printPages = useMemo(
    () => splitIntoRows(selectedCustomers.filter((customer) => cardById.has(customer.id)), cardsPerPage),
    [cardById, selectedCustomers],
  );

  const toggleCustomer = (customerId: string) => {
    setSelectedIds((current) =>
      current.includes(customerId)
        ? current.filter((id) => id !== customerId)
        : [...current, customerId],
    );
  };

  const selectAllFiltered = () => {
    setSelectedIds(customers.map((customer) => customer.id));
  };

  const printCards = async () => {
    if (printing || !cardById.size || loadingTokens) return;
    setPrinting(true);
    setError("");
    try {
      const deadline = Date.now() + 5000;
      let printImages: HTMLImageElement[] = [];
      while (Date.now() < deadline) {
        printImages = Array.from(
          document.querySelectorAll<HTMLImageElement>(
            ".customer-print-pages .customer-card-qr img",
          ),
        );
        if (
          printImages.length === cardById.size &&
          printImages.every((image) => image.complete && image.naturalWidth > 0)
        ) {
          break;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 50));
      }
      if (
        printImages.length !== cardById.size ||
        printImages.some((image) => !image.complete || image.naturalWidth === 0)
      ) {
        setError(t("customerCards.errors.qr"));
        return;
      }
      await Promise.all(printImages.map((image) => image.decode()));
      await logCustomerCardPrint(cardById.size);
      window.print();
    } catch {
      setError(t("customerCards.errors.print"));
    } finally {
      setPrinting(false);
    }
  };

  const reissueCustomerQr = async (customerId: string) => {
    if (reissuingId) return;
    setReissuingId(customerId);
    setError("");
    try {
      const token = await reissueQrToken(customerId);
      setTokens((current) => ({ ...current, [customerId]: token }));
    } catch {
      setError(t("customerCards.errors.reissue"));
    } finally {
      setReissuingId("");
    }
  };

  const changeImport = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("import", value);
    else next.delete("import");
    setSearchParams(next);
  };

  return (
    <div className="customer-card-print-root mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6">
      <div className="customer-card-screen-controls">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-ink dark:text-white">
              {t("customerCards.title")}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {t("customerCards.description")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700"
              to="/customers"
            >
              {t("customerCards.backToCustomers")}
            </Link>
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-[rgb(var(--color-primary))] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              disabled={!cardById.size || loadingTokens || printing}
              onClick={() => void printCards()}
              type="button"
            >
              <Printer aria-hidden="true" size={17} />
              {printing ? t("customerCards.printing") : t("customerCards.print")}
            </button>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">{t("customerCards.chooseCustomers")}</h2>
              <button
                className="text-sm font-medium text-[rgb(var(--color-primary))] disabled:opacity-50"
                disabled={loading || customers.length === 0}
                onClick={selectAllFiltered}
                type="button"
              >
                {t("customerCards.selectAll", { count: customers.length })}
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span>{t("customerCards.search")}</span>
                <input
                  className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("customerCards.searchPlaceholder")}
                  value={search}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span>{t("customerCards.studentType")}</span>
                <select
                  className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
                  onChange={(event) => setStudentTypeId(event.target.value)}
                  value={studentTypeId}
                >
                  <option value="">{t("customerCards.allStudentTypes")}</option>
                  {studentTypes.map((studentType) => (
                    <option key={studentType.id} value={studentType.id}>
                      {studentType.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm sm:col-span-2">
                <span>{t("customerCards.import")}</span>
                <select
                  className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
                  onChange={(event) => changeImport(event.target.value)}
                  value={importId}
                >
                  <option value="">{t("customerCards.allImports")}</option>
                  {imports.map((item) => (
                    <option key={item.id} value={item.id}>
                      {formatDate(item.created_at.slice(0, 10), i18n.language)} ·{" "}
                      {item.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  checked={createdToday}
                  onChange={(event) => setCreatedToday(event.target.checked)}
                  type="checkbox"
                />
                {t("customerCards.createdToday")}
              </label>
            </div>

            {error && (
              <p
                className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
                role="alert"
              >
                {error}
              </p>
            )}
            <div
              aria-busy={loading}
              className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto"
            >
              {loading ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  {t("customerCards.loading")}
                </p>
              ) : customers.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  {t("customerCards.empty")}
                </p>
              ) : (
                customers.map((customer) => (
                  <label
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800"
                    key={customer.id}
                  >
                    <input
                      checked={selectedIds.includes(customer.id)}
                      onChange={() => toggleCustomer(customer.id)}
                      type="checkbox"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {customer.full_name}
                      </span>
                      <span className="mt-1 block font-mono text-xs text-slate-500">
                        {customer.code}
                      </span>
                    </span>
                    {canManage && selectedIds.includes(customer.id) && (
                      <button
                        aria-label={t("customerCards.reissueFor", {
                          code: customer.code,
                        })}
                        className="inline-flex items-center gap-1 rounded-md p-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
                        disabled={Boolean(reissuingId)}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void reissueCustomerQr(customer.id);
                        }}
                        type="button"
                      >
                        <RefreshCw
                          aria-hidden="true"
                          className={
                            reissuingId === customer.id ? "animate-spin" : ""
                          }
                          size={14}
                        />
                        <span className="sr-only">
                          {t("customerCards.reissue")}
                        </span>
                      </button>
                    )}
                  </label>
                ))
              )}
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              {t("customerCards.selectedCount", { count: cardById.size })}
            </p>
          </section>

          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">{t("customerCards.preview")}</h2>
              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={includeBack}
                  onChange={(event) => setIncludeBack(event.target.checked)}
                  type="checkbox"
                />
                {t("customerCards.printBacks")}
              </label>
            </div>
            {loadingTokens && (
              <p className="mt-3 text-sm text-slate-500" role="status">
                {t("customerCards.loadingQr")}
              </p>
            )}
            {!selectedCustomers.length && !loading && (
              <p className="mt-8 text-center text-sm text-slate-500">
                {t("customerCards.noSelection")}
              </p>
            )}
            <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,21rem),1fr))] gap-4">
              {selectedCustomers.map((customer) => {
                const card = cardById.get(customer.id);
                if (!card) return null;
                return (
                  <div className="min-w-0" key={customer.id}>
                    <CustomerCard customer={card} />
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {customer.full_name}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
      <div className="customer-print-pages" aria-hidden="true">
        {printPages.map((page, index) => (
          <Fragment key={`page-${index}`}>
            <div className="customer-print-sheet">
              <div className="customer-print-grid">
                {page.map((customer) => {
                  const card = cardById.get(customer.id);
                  return card ? (
                    <CustomerCard
                      customer={card}
                      key={`front-${customer.id}`}
                    />
                  ) : null;
                })}
              </div>
            </div>
            {includeBack && (
              <div className="customer-print-sheet">
                <div className="customer-print-grid">
                  {backSideOrder(page).map((customer) => {
                    const card = cardById.get(customer.id);
                    return card ? (
                      <CustomerCard
                        customer={card}
                        face="back"
                        key={`back-${customer.id}`}
                      />
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
