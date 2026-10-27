import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout";
import { DashboardPage } from "../pages/DashboardPage";
import { CustomerFormPage } from "../pages/CustomerFormPage";
import { CustomerCardsPrintPage } from "../pages/CustomerCardsPrintPage";
import { CustomerImportHistoryPage } from "../pages/CustomerImportHistoryPage";
import { CustomerImportPage } from "../pages/CustomerImportPage";
import { CustomerProfilePage } from "../pages/CustomerProfilePage";
import { CustomersPage } from "../pages/CustomersPage";
import { EmployeesPage } from "../pages/EmployeesPage";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { PendingAccountsPage } from "../pages/PendingAccountsPage";
import { PendingApprovalPage } from "../pages/PendingApprovalPage";
import { RegisterPage } from "../pages/RegisterPage";
import { ResetPasswordPage } from "../pages/ResetPasswordPage";
import { ResourcesPage } from "../pages/ResourcesPage";
import { RolesPage } from "../pages/RolesPage";
import { ScanPage } from "../pages/ScanPage";
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
            element: <PermissionRoute permission="scanner.use" />,
            children: [{ path: "/scan", element: <ScanPage /> }],
          },
          {
            element: <PermissionRoute permission="customers.import" />,
            children: [
              { path: "/customers/import", element: <CustomerImportPage /> },
              { path: "/customers/import/history", element: <CustomerImportHistoryPage /> },
            ],
          },
          {
            element: <PermissionRoute permission="customers.cards" />,
            children: [
              {
                path: "/customers/cards/print",
                element: <CustomerCardsPrintPage />,
              },
            ],
          },
          {
            element: <PermissionRoute permission="customers.view" />,
            children: [
              { path: "/customers", element: <CustomersPage /> },
              { path: "/customers/:customerId", element: <CustomerProfilePage /> },
            ],
          },
          {
            element: <PermissionRoute permission="customers.create" />,
            children: [
              { path: "/customers/new", element: <CustomerFormPage /> },
            ],
          },
          {
            element: <PermissionRoute permission="customers.edit" />,
            children: [
              {
                path: "/customers/:customerId/edit",
                element: <CustomerFormPage />,
              },
            ],
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
            element: <PermissionRoute permission="resources.manage" />,
            children: [{ path: "/admin/resources", element: <ResourcesPage /> }],
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
