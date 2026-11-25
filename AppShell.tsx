import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Briefcase,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Factory,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Hammer,
  LayoutDashboard,
  LogOut,
  Menu,
  Ruler,
  Search,
  Settings,
  ShoppingBag,
  UserPlus,
  Users,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { NavSection } from '../../types';
import {
  BrandWordmark,
  OfflineIndicator,
  PWAInstallButton,
  ToastContainer,
} from '../common/UIPrimitives';

interface NavItemDef {
  id: NavSection;
  label: string;
  icon: React.FC<{ className?: string }>;
  group: 'Utama' | 'Penjualan & Survey' | 'Operasional Order' | 'Keuangan & Arsip' | 'Sistem';
}

export const NAV_ITEMS: NavItemDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Utama' },
  { id: 'tasks', label: 'Tugas & Pengingat', icon: CheckSquare, group: 'Utama' },
  { id: 'leads', label: 'Leads & Follow-up', icon: UserPlus, group: 'Penjualan & Survey' },
  { id: 'customers', label: 'Pelanggan', icon: Users, group: 'Penjualan & Survey' },
  { id: 'surveys', label: 'Survey & Ukur', icon: Ruler, group: 'Penjualan & Survey' },
  { id: 'quotations', label: 'Quotation', icon: FileSpreadsheet, group: 'Penjualan & Survey' },
  { id: 'orders', label: 'Order Pelanggan', icon: ClipboardList, group: 'Operasional Order' },
  { id: 'suppliers', label: 'Supplier', icon: Factory, group: 'Operasional Order' },
  { id: 'procurement', label: 'Purchase Order', icon: ShoppingBag, group: 'Operasional Order' },
  { id: 'production', label: 'Produksi & Jahit', icon: Hammer, group: 'Operasional Order' },
  { id: 'installations', label: 'Pemasangan', icon: Wrench, group: 'Operasional Order' },
  { id: 'finance', label: 'Keuangan', icon: Wallet, group: 'Keuangan & Arsip' },
  { id: 'documents', label: 'Pusat Dokumen', icon: FolderOpen, group: 'Keuangan & Arsip' },
  { id: 'reports', label: 'Laporan', icon: BarChart3, group: 'Keuangan & Arsip' },
  { id: 'activity', label: 'Activity Log', icon: Activity, group: 'Sistem' },
  { id: 'settings', label: 'Pengaturan', icon: Settings, group: 'Sistem' },
];

const NAV_GROUPS: NavItemDef['group'][] = [
  'Utama',
  'Penjualan & Survey',
  'Operasional Order',
  'Keuangan & Arsip',
  'Sistem',
];

const MOBILE_BOTTOM_IDS: NavSection[] = ['dashboard', 'orders', 'quotations', 'finance'];

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    user,
    userProfile,
    activeSection,
    allowedSections,
    navigateTo,
    logout,
    toasts,
    dismissToast,
    customers,
    leads,
    quotations,
    orders,
    suppliers,
    purchaseOrders,
    settings,
  } = useAppData();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const visibleItems = useMemo(
    () => NAV_ITEMS.filter((item) => allowedSections.includes(item.id)),
    [allowedSections]
  );

  const currentItem = NAV_ITEMS.find((i) => i.id === activeSection) || NAV_ITEMS[0];

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const hits: { section: NavSection; id: string; title: string; meta: string; type: string }[] = [];

    customers.forEach((c) => {
      if (`${c.name} ${c.whatsapp} ${c.customerCode} ${c.city || ''}`.toLowerCase().includes(q)) {
        hits.push({ section: 'customers', id: c.id, title: c.name, meta: `${c.customerCode} · ${c.whatsapp}`, type: 'Pelanggan' });
      }
    });
    leads.forEach((l) => {
      if (`${l.name} ${l.whatsapp} ${l.needs || ''}`.toLowerCase().includes(q)) {
        hits.push({ section: 'leads', id: l.id, title: l.name, meta: `${l.status} · ${l.whatsapp}`, type: 'Lead' });
      }
    });
    quotations.forEach((qt) => {
      if (`${qt.quotationNumber} ${qt.customerName} ${qt.projectName}`.toLowerCase().includes(q)) {
        hits.push({ section: 'quotations', id: qt.id, title: `${qt.quotationNumber} — ${qt.projectName}`, meta: `${qt.customerName} · ${qt.status}`, type: 'Quotation' });
      }
    });
    orders.forEach((o) => {
      if (`${o.orderNumber} ${o.customerName} ${o.projectName}`.toLowerCase().includes(q)) {
        hits.push({ section: 'orders', id: o.id, title: `${o.orderNumber} — ${o.projectName}`, meta: `${o.customerName} · ${o.status}`, type: 'Order' });
      }
    });
    suppliers.forEach((s) => {
      if (`${s.name} ${s.category} ${s.whatsapp}`.toLowerCase().includes(q)) {
        hits.push({ section: 'suppliers', id: s.id, title: s.name, meta: `${s.category} · ${s.whatsapp}`, type: 'Supplier' });
      }
    });
    purchaseOrders.forEach((po) => {
      if (`${po.poNumber} ${po.supplierName} ${po.orderNumber}`.toLowerCase().includes(q)) {
        hits.push({ section: 'procurement', id: po.id, title: `${po.poNumber} — ${po.supplierName}`, meta: `Order ${po.orderNumber} · ${po.status}`, type: 'PO' });
      }
    });
    return hits.slice(0, 12);
  }, [searchQuery, customers, leads, quotations, orders, suppliers, purchaseOrders]);

  const handleSelectNav = (id: NavSection) => {
    navigateTo(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#1F2421] flex">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 bg-white border-r border-[#E5E2DA] sticky top-0 h-screen transition-[width] duration-200 no-print ${
          collapsed ? 'w-[76px]' : 'w-[260px]'
        }`}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-[#E5E2DA] shrink-0">
          <BrandWordmark compact={collapsed} />
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
            className="p-1.5 rounded-lg text-[#5A635D] hover:text-[#1F2421] hover:bg-[#F8F7F4] transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {NAV_GROUPS.map((group) => {
            const items = visibleItems.filter((i) => i.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group}>
                {!collapsed && (
                  <p className="px-2.5 mb-1.5 text-[11px] font-medium text-[#7D8580]">
                    {group}
                  </p>
                )}
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const active = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectNav(item.id)}
                        title={collapsed ? item.label : undefined}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-[#1F3D2B] text-white font-medium'
                            : 'text-[#444D47] hover:bg-[#F8F7F4] hover:text-[#1F2421]'
                        } ${collapsed ? 'justify-center' : ''}`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[#E5E2DA] space-y-2 shrink-0">
          {!collapsed && <PWAInstallButton />}
          <div className={`flex items-center gap-2.5 px-2 py-1.5 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-[#F3ECE0] text-[#846838] font-semibold text-xs flex items-center justify-center shrink-0">
              {(userProfile?.displayName || user?.email || 'H').slice(0, 2).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#1F2421] truncate">
                  {userProfile?.displayName || user?.displayName || 'Pemilik'}
                </p>
                <p className="text-[11px] text-[#5A635D] truncate capitalize">
                  {userProfile?.role || 'owner'}
                </p>
              </div>
            )}
            {!collapsed && (
              <button
                type="button"
                onClick={logout}
                title="Keluar"
                className="p-1.5 rounded-lg text-[#5A635D] hover:text-[#B53939] hover:bg-[#FDF2F2] transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Top Bar (Single Row) */}
        <header className="h-14 lg:h-16 bg-white/95 backdrop-blur-sm border-b border-[#E5E2DA] sticky top-0 z-30 px-4 lg:px-8 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka menu navigasi"
              className="lg:hidden p-2 -ml-1.5 rounded-lg text-[#1F2421] hover:bg-[#F8F7F4]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-[#5A635D] whitespace-nowrap shrink-0">
                {settings.businessName || 'Harmony Interior'}
              </span>
              <span className="hidden sm:inline text-[#C9C4B8]" aria-hidden="true">/</span>
              <span className="font-medium text-[#1F2421] truncate">{currentItem.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E5E2DA] bg-[#F8F7F4] text-xs text-[#5A635D] hover:text-[#1F2421] hover:border-[#C9C4B8] transition-colors whitespace-nowrap shrink-0"
            >
              <Search className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Cari pelanggan, order, PO...</span>
              <span className="sm:hidden">Cari</span>
              <kbd className="hidden md:inline text-[10px] font-mono text-[#7D8580] ml-1">Ctrl K</kbd>
            </button>
            <PWAInstallButton compact />
            <button
              type="button"
              onClick={() => navigateTo('orders')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1F3D2B] text-white text-xs font-medium hover:bg-[#172F21] transition-colors whitespace-nowrap shrink-0"
            >
              <Briefcase className="w-3.5 h-3.5 shrink-0" />
              <span>Order Aktif</span>
            </button>
          </div>
        </header>

        {/* Page Viewport */}
        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7 pb-24 lg:pb-10 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation (Compact <= 56px height) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-[#E5E2DA] h-14 px-2 grid grid-cols-5 items-center no-print">
        {MOBILE_BOTTOM_IDS.map((id) => {
          const item = NAV_ITEMS.find((n) => n.id === id)!;
          const Icon = item.icon;
          const active = activeSection === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleSelectNav(id)}
              className={`flex flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-medium ${
                active ? 'text-[#1F3D2B]' : 'text-[#5A635D]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="truncate max-w-[64px]">{item.label.split(' ')[0]}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-medium text-[#5A635D]"
        >
          <Menu className="w-4 h-4" />
          <span>Menu</span>
        </button>
      </nav>

      {/* Mobile Full Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex no-print">
          <div
            className="fixed inset-0 bg-[#1F2421]/45"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-[280px] max-w-[84vw] bg-white h-full flex flex-col shadow-xl z-10">
            <div className="h-14 px-4 flex items-center justify-between border-b border-[#E5E2DA]">
              <BrandWordmark />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg text-[#5A635D]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {NAV_GROUPS.map((group) => {
                const items = visibleItems.filter((i) => i.group === group);
                if (items.length === 0) return null;
                return (
                  <div key={group}>
                    <p className="px-2.5 mb-1 text-[11px] font-medium text-[#7D8580]">{group}</p>
                    <div className="space-y-0.5">
                      {items.map((item) => {
                        const Icon = item.icon;
                        const active = activeSection === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelectNav(item.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm ${
                              active
                                ? 'bg-[#1F3D2B] text-white font-medium'
                                : 'text-[#1F2421] hover:bg-[#F8F7F4]'
                            }`}
                          >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-3 border-t border-[#E5E2DA] space-y-2">
              <PWAInstallButton />
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#E5E2DA] text-xs font-medium text-[#B53939] hover:bg-[#FDF2F2]"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar ({user?.email})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Search Modal */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#1F2421]/45 flex items-start justify-center pt-16 sm:pt-24 p-4 no-print"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-white border border-[#E5E2DA] rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#E5E2DA]">
              <Search className="w-4 h-4 text-[#5A635D] shrink-0" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ketik nama pelanggan, nomor order, nomor PO, supplier..."
                className="flex-1 text-sm bg-transparent outline-none text-[#1F2421] placeholder:text-[#7D8580]"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="p-1 text-[#5A635D] hover:text-[#1F2421]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {!searchQuery.trim() ? (
                <p className="px-3 py-6 text-center text-xs text-[#5A635D]">
                  Cari cepat di seluruh Pelanggan, Leads, Quotation, Order, Supplier, dan Purchase Order.
                </p>
              ) : searchResults.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-[#5A635D]">
                  Tidak ada hasil untuk &ldquo;{searchQuery}&rdquo;.
                </p>
              ) : (
                <div className="space-y-0.5">
                  {searchResults.map((hit) => (
                    <button
                      key={`${hit.section}-${hit.id}`}
                      type="button"
                      onClick={() => {
                        navigateTo(hit.section, hit.id);
                        setSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-[#F8F7F4] flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#1F2421] truncate">{hit.title}</p>
                        <p className="text-xs text-[#5A635D] truncate">{hit.meta}</p>
                      </div>
                      <span className="text-[11px] font-medium text-[#846838] shrink-0">
                        {hit.type}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <OfflineIndicator />
    </div>
  );
};
