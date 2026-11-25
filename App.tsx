import React from 'react';
import { LoginScreen } from './components/auth/LoginScreen';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { BrandWordmark } from './components/common/UIPrimitives';
import { AppShell } from './components/layout/AppShell';
import { AppDataProvider, useAppData } from './context/AppDataContext';
import { ActivityLogPage } from './pages/ActivityLogPage';
import { CustomersPage } from './pages/CustomersPage';
import { DashboardPage } from './pages/DashboardPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { FinancePage } from './pages/FinancePage';
import { InstallationsPage } from './pages/InstallationsPage';
import { LeadsPage } from './pages/LeadsPage';
import { OrdersPage } from './pages/OrdersPage';
import { ProcurementPage } from './pages/ProcurementPage';
import { ProductionPage } from './pages/ProductionPage';
import { QuotationsPage } from './pages/QuotationsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { SurveysPage } from './pages/SurveysPage';
import { TasksPage } from './pages/TasksPage';

const MainWorkspace: React.FC = () => {
  const { user, authLoading, activeSection, allowedSections } = useAppData();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] flex flex-col items-center justify-center gap-4 p-6">
        <BrandWordmark />
        <p className="text-xs text-[#5A635D]">Menghubungkan ruang kerja cloud Harmony Interior...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  const effectiveSection = allowedSections.includes(activeSection) ? activeSection : 'dashboard';

  const renderPage = () => {
    switch (effectiveSection) {
      case 'dashboard':
        return <DashboardPage />;
      case 'customers':
        return <CustomersPage />;
      case 'leads':
        return <LeadsPage />;
      case 'surveys':
        return <SurveysPage />;
      case 'quotations':
        return <QuotationsPage />;
      case 'orders':
        return <OrdersPage />;
      case 'suppliers':
        return <SuppliersPage />;
      case 'procurement':
        return <ProcurementPage />;
      case 'production':
        return <ProductionPage />;
      case 'installations':
        return <InstallationsPage />;
      case 'finance':
        return <FinancePage />;
      case 'tasks':
        return <TasksPage />;
      case 'documents':
        return <DocumentsPage />;
      case 'reports':
        return <ReportsPage />;
      case 'activity':
        return <ActivityLogPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return <AppShell>{renderPage()}</AppShell>;
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppDataProvider>
        <MainWorkspace />
      </AppDataProvider>
    </ErrorBoundary>
  );
}
