import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";

export function DashboardPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const name = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(" ");

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-9">
        <h1 className="text-3xl font-semibold tracking-tight text-ink dark:text-white">
          {t("dashboard.welcome")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
          {name
            ? t("dashboard.descriptionNamed", { name })
            : t("dashboard.description")}
        </p>
      </div>
    </section>
  );
}
