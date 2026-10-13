import {
  BriefcaseBusiness,
  ChartNoAxesCombined,
  ClipboardCheck,
  LogOut,
  Menu,
  Settings,
  Shield,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { BrandingIdentity } from "../components/BrandingIdentity";
import { NotificationBell } from "../components/NotificationBell";
import { ThemeToggle } from "../components/ThemeToggle";
import { useAuth } from "../hooks/useAuth";
import { useBranding } from "../hooks/useBranding";
import { getRolePermissionKeys } from "../services/roles";

type NavigationItem = {
  labelKey: string;
  path: string;
  permission: string;
  icon: typeof ChartNoAxesCombined;
};

const navigationItems: NavigationItem[] = [
  {
    labelKey: "layout.navigation.dashboard",
    path: "/dashboard",
    permission: "dashboard.view",
    icon: ChartNoAxesCombined,
  },
  {
    labelKey: "layout.navigation.pendingAccounts",
    path: "/admin/pending-accounts",
    permission: "accounts.approve",
    icon: ClipboardCheck,
  },
  {
    labelKey: "layout.navigation.employees",
    path: "/admin/employees",
    permission: "employees.view",
    icon: BriefcaseBusiness,
  },
  {
    labelKey: "layout.navigation.roles",
    path: "/admin/roles",
    permission: "roles.manage",
    icon: Shield,
  },
  {
    labelKey: "layout.navigation.settings",
    path: "/admin/settings",
    permission: "settings.manage",
    icon: Settings,
  },
];

export function AppLayout() {
  const { i18n, t } = useTranslation();
  const { profile, session, signOut } = useAuth();
  const { settings } = useBranding();
  const location = useLocation();
  const navigate = useNavigate();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsError, setPermissionsError] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isRtl = i18n.dir() === "rtl";
  const isApplicationRoute =
    location.pathname === "/dashboard" ||
    location.pathname.startsWith("/admin/");
  const showApplicationLayout =
    isApplicationRoute && profile?.status === "active" && Boolean(session);

  useEffect(() => {
    let mounted = true;

    if (!showApplicationLayout || !profile?.role_id) {
      setPermissions([]);
      setPermissionsError(false);
      setPermissionsLoading(false);
      return () => {
        mounted = false;
      };
    }

    setPermissionsLoading(true);
    setPermissionsError(false);
    void getRolePermissionKeys(profile.role_id)
      .then((keys) => {
        if (mounted) {
          setPermissions(keys);
        }
      })
      .catch(() => {
        if (mounted) {
          setPermissions([]);
          setPermissionsError(true);
        }
      })
      .finally(() => {
        if (mounted) {
          setPermissionsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [profile?.role_id, showApplicationLayout]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    if (signingOut) {
      return;
    }

    setSigningOut(true);
    setSignOutError(false);
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch {
      setSignOutError(true);
    } finally {
      setSigningOut(false);
    }
  };

  const visibleNavigation = navigationItems.filter((item) =>
    permissions.includes(item.permission),
  );
  const userName = profile
    ? `${profile.first_name} ${profile.last_name}`.trim()
    : "";

  if (!showApplicationLayout) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 sm:px-8">
          <Link
            aria-label={settings.workspaceName}
            to="/"
          >
            <BrandingIdentity />
          </Link>
          <div className="flex items-center gap-2">
            {session && profile?.status === "active" && (
              <NotificationBell userId={session.user.id} />
            )}
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1">
          <Outlet />
        </main>
        <footer className="mx-auto flex w-full max-w-6xl justify-between gap-4 px-6 py-6 text-xs font-medium tracking-widest text-slate-500 dark:text-slate-400 sm:px-8">
          <span>{t("brand.portal")}</span>
          <span>{settings.workspaceName}</span>
        </footer>
      </div>
    );
  }

  const sidebar = (
    <aside className="flex h-full w-72 shrink-0 flex-col border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:h-auto md:min-h-screen md:border-e">
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800">
        <Link
          aria-label={settings.workspaceName}
          to="/dashboard"
        >
          <BrandingIdentity compact />
        </Link>
        <button
          aria-label={t("layout.closeNavigation")}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          type="button"
        >
          <X aria-hidden="true" size={19} />
        </button>
      </div>

      <nav
        aria-label={t("layout.navigation.label")}
        className="flex-1 space-y-1 p-4"
      >
        {permissionsLoading && (
          <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
            {t("layout.permissionsLoading")}
          </p>
        )}
        {permissionsError && (
          <p
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
            role="alert"
          >
            {t("auth.errors.permissionsUnavailable")}
          </p>
        )}
        {!permissionsLoading &&
          !permissionsError &&
          visibleNavigation.map(({ labelKey, path, icon: Icon }) => (
            <NavLink
              key={path}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`
              }
              onClick={() => setMobileSidebarOpen(false)}
              to={path}
            >
              <Icon aria-hidden="true" size={18} />
              <span>{t(labelKey)}</span>
            </NavLink>
          ))}
      </nav>

      <div className="border-t border-slate-200 p-4 dark:border-slate-800">
        <p className="truncate text-sm font-semibold text-ink dark:text-white">
          {userName || session?.user.email}
        </p>
        {profile?.role?.name && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {profile.role.name}
          </p>
        )}
      </div>
    </aside>
  );

  return (
    <div
      className={`min-h-screen md:flex ${
        isRtl ? "md:flex-row-reverse" : "md:flex-row"
      }`}
    >
      <div className="hidden md:block">{sidebar}</div>

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label={t("layout.closeNavigation")}
            className="absolute inset-0 bg-slate-950/50"
            onClick={() => setMobileSidebarOpen(false)}
            type="button"
          />
          <div
            className={`absolute inset-y-0 ${
              isRtl ? "right-0" : "left-0"
            }`}
          >
            {sidebar}
          </div>
        </div>
      )}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              aria-label={
                mobileSidebarOpen
                  ? t("layout.closeNavigation")
                  : t("layout.openNavigation")
              }
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 md:hidden"
              onClick={() => setMobileSidebarOpen((open) => !open)}
              type="button"
            >
              {mobileSidebarOpen ? (
                <X aria-hidden="true" size={19} />
              ) : (
                <Menu aria-hidden="true" size={19} />
              )}
            </button>
            <span className="truncate text-sm font-semibold text-ink dark:text-white md:hidden">
              {settings.workspaceName}
            </span>
            <span className="hidden text-sm text-slate-500 dark:text-slate-400 md:inline">
              {t("layout.workspace")}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {session && <NotificationBell userId={session.user.id} />}
            <LanguageSwitcher />
            <ThemeToggle />
            <div className="hidden min-w-0 text-end lg:block">
              <p className="max-w-44 truncate text-sm font-medium text-ink dark:text-white">
                {userName || session?.user.email}
              </p>
              {profile?.role?.name && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {profile.role.name}
                </p>
              )}
            </div>
            <button
              className="inline-flex size-10 items-center justify-center gap-2 rounded-lg border border-slate-300 text-slate-700 transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 lg:w-auto lg:px-3"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
              type="button"
            >
              <LogOut aria-hidden="true" size={17} />
              <span className="hidden text-sm font-medium lg:inline">
                {signingOut
                  ? t("layout.signingOut")
                  : t("layout.signOut")}
              </span>
            </button>
          </div>
        </header>

        {signOutError && (
          <p
            className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 sm:mx-6"
            role="alert"
          >
            {t("auth.errors.signOutFailed")}
          </p>
        )}

        <main className="flex-1">
          <Outlet />
        </main>
        <footer className="flex justify-between gap-4 border-t border-slate-200 px-5 py-4 text-xs font-medium tracking-widest text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:px-8">
          <span>{t("brand.portal")}</span>
          <span>{settings.workspaceName}</span>
        </footer>
      </div>
    </div>
  );
}
