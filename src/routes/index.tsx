import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout";
import { DashboardPage } from "../pages/DashboardPage";
import { EmployeesPage } from "../pages/EmployeesPage";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { PendingAccountsPage } from "../pages/PendingAccountsPage";
import { PendingApprovalPage } from "../pages/PendingApprovalPage";
import { RegisterPage } from "../pages/RegisterPage";
import { ResetPasswordPage } from "../pages/ResetPasswordPage";
import { RolesPage } from "../pages/RolesPage";
import { SettingsPage } from "../pages/SettingsPage";
import {
  NotAllowedPage,
  PendingApprovalRoute,
  PermissionRoute,
  ProtectedRoute,
} from "./ProtectedRoute";

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <Navigate replace to="/login" /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/forgot-password", element: <ForgotPasswordPage /> },
      { path: "/reset-password", element: <ResetPasswordPage /> },
      { path: "/register", element: <RegisterPage /> },
      {
        element: <PendingApprovalRoute />,
        children: [
          { path: "/pending-approval", element: <PendingApprovalPage /> },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          { path: "/not-allowed", element: <NotAllowedPage /> },
          {
            element: <PermissionRoute permission="dashboard.view" />,
            children: [{ path: "/dashboard", element: <DashboardPage /> }],
          },
          {
            element: <PermissionRoute permission="accounts.approve" />,
            children: [
              {
                path: "/admin/pending-accounts",
                element: <PendingAccountsPage />,
              },
            ],
          },
          {
            element: <PermissionRoute permission="employees.view" />,
            children: [{ path: "/admin/employees", element: <EmployeesPage /> }],
          },
          {
            element: <PermissionRoute permission="roles.manage" />,
            children: [{ path: "/admin/roles", element: <RolesPage /> }],
          },
          {
            element: <PermissionRoute permission="settings.manage" />,
            children: [
              { path: "/admin/settings", element: <SettingsPage /> },
            ],
          },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
