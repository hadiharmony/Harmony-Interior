import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Plus,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader, StatusLabel } from '../components/common/UIPrimitives';
import { useAppData } from '../context/AppDataContext';
import { NavSection } from '../types';
import {
  formatDateID,
  formatIDR,
  formatMonthLabel,
  getJakartaTodayISO,
  getMonthKey,
  isDateOverdue,
  isDateToday,
  isDateTomorrow,
  isDateWithinDays,
} from '../utils/formatters';

interface ActionItem {
  id: string;
  urgency: 'danger' | 'warning' | 'info';
  title: string;
  detail: string;
  targetSection: NavSection;
  targetId?: string;
}

interface AgendaItem {
  id: string;
  date: string;
  time?: string;
  type: string;
  title: string;
  subtitle: string;
  status: string;
  section: NavSection;
  recordId: string;
}

export const DashboardPage: React.FC = () => {
  const {
    orders,
    quotations,
    leads,
    surveys,
    measurementAreas,
    purchaseOrders,
    productionJobs,
    installations,
    payments,
    expenses,
    tasks,
    navigateTo,
    dataLoading,
  } = useAppData();

  const [agendaFilter, setAgendaFilter] = useState<'today' | 'tomorrow' | 'week' | 'all'>('today');

  const todayISO = getJakartaTodayISO();
  const currentMonth = todayISO.slice(0, 7);

  // Payment net received per order (DP + Termin + Pelunasan + Additional - Refund)
  const paidByOrder = useMemo(() => {
    const map: Record<string, number> = {};
    payments.forEach((p) => {
      const delta = p.paymentType === 'Refund' ? -p.amount : p.amount;
      map[p.orderId] = (map[p.orderId] || 0) + delta;
    });
    return map;
  }, [payments]);

  const poCostByOrder = useMemo(() => {
    const map: Record<string, number> = {};
    purchaseOrders.forEach((po) => {
      if (po.status !== 'Cancelled') {
        map[po.orderId] = (map[po.orderId] || 0) + po.totalAmount;
      }
    });
    return map;
  }, [purchaseOrders]);

  // Business Summary Metrics (Strictly from real Firestore data — zero fake numbers)
  const metrics = useMemo(() => {
    const validOrders = orders.filter((o) => o.status !== 'Cancelled');
    const activeOrders = validOrders.filter((o) => !['Completed', 'Closed'].includes(o.status));
    const newOrders = orders.filter((o) => o.status === 'New Order').length;
    const waitingQuotationConfirm = quotations.filter((q) => ['Sent', 'Viewed', 'Revision'].includes(q.status)).length;
    const waitingDP = orders.filter((o) => o.status === 'Waiting for DP').length;
    const waitingPO = orders.filter((o) => ['Confirmed', 'Procurement Needed'].includes(o.status)).length;
    const inProduction = orders.filter((o) =>
      ['Material Ordered', 'Material Received', 'Production / Sewing', 'Quality Control'].includes(o.status)
    ).length;
    const readyInstall = orders.filter((o) =>
      ['Ready for Installation', 'Installation Scheduled', 'Installation in Progress'].includes(o.status)
    ).length;
    const completedOrders = orders.filter((o) => ['Completed', 'Closed'].includes(o.status)).length;

    const monthlyRevenue = validOrders
      .filter((o) => getMonthKey(o.orderDate) === currentMonth)
      .reduce((acc, o) => acc + (o.totalAmount || 0), 0);

    const monthlyCashIn = payments
      .filter((p) => getMonthKey(p.paymentDate) === currentMonth)
      .reduce((acc, p) => acc + (p.paymentType === 'Refund' ? -p.amount : p.amount), 0);

    const totalReceivables = validOrders.reduce((acc, o) => {
      const paid = paidByOrder[o.id] || 0;
      const rem = Math.max(0, (o.totalAmount || 0) - paid);
      return acc + rem;
    }, 0);

    const estimatedProfit = validOrders.reduce((acc, o) => {
      const poCost = poCostByOrder[o.id] || 0;
      const cost = poCost > 0 ? poCost : o.estimatedCost || 0;
      return acc + ((o.totalAmount || 0) - cost);
    }, 0);

    return {
      activeOrders: activeOrders.length,
      newOrders,
      waitingQuotationConfirm,
      waitingDP,
      waitingPO,
      inProduction,
      readyInstall,
      completedOrders,
      monthlyRevenue,
      monthlyCashIn,
      totalReceivables,
      estimatedProfit,
    };
  }, [orders, quotations, payments, paidByOrder, poCostByOrder, currentMonth]);

  // Action Center ("APA YANG HARUS SAYA KERJAKAN?")
  const actionItems = useMemo<ActionItem[]>(() => {
    const items: ActionItem[] = [];

    // 1. Overdue production jobs
    productionJobs.forEach((job) => {
      if (job.status !== 'Ready' && (job.status === 'Delayed' || isDateOverdue(job.estimatedFinishDate))) {
        items.push({
          id: `prod-${job.id}`,
          urgency: 'danger',
          title: `Produksi terlambat — Order ${job.orderNumber}`,
          detail: `${job.workshopName} · Target selesai ${formatDateID(job.estimatedFinishDate)}`,
          targetSection: 'production',
          targetId: job.id,
        });
      }
    });

    // 2. Overdue POs
    purchaseOrders.forEach((po) => {
      if (!['Received', 'Cancelled'].includes(po.status) && isDateOverdue(po.targetArrivalDate)) {
        items.push({
          id: `po-${po.id}`,
          urgency: 'danger',
          title: `Hubungi supplier ${po.supplierName} (${po.poNumber})`,
          detail: `Bahan order ${po.orderNumber} melewati target tiba ${formatDateID(po.targetArrivalDate)}`,
          targetSection: 'procurement',
          targetId: po.id,
        });
      }
    });

    // 3. Completed orders with unpaid balance
    orders.forEach((o) => {
      const paid = paidByOrder[o.id] || 0;
      const rem = (o.totalAmount || 0) - paid;
      if (['Completed', 'Closed'].includes(o.status) && rem > 0) {
        items.push({
          id: `pay-${o.id}`,
          urgency: 'danger',
          title: `Tagih pelunasan ${o.customerName} (${o.orderNumber})`,
          detail: `Order selesai · Sisa piutang ${formatIDR(rem)}`,
          targetSection: 'finance',
          targetId: o.id,
        });
      }
    });

    // 4. Orders waiting for DP
    orders
      .filter((o) => o.status === 'Waiting for DP')
      .forEach((o) => {
        items.push({
          id: `dp-${o.id}`,
          urgency: 'warning',
          title: `Konfirmasi pembayaran DP — ${o.orderNumber}`,
          detail: `${o.customerName} · Estimasi DP ${formatIDR(o.dpAmount || 0)}`,
          targetSection: 'orders',
          targetId: o.id,
        });
      });

    // 5. Confirmed orders needing Purchase Order
    orders
      .filter((o) => ['Confirmed', 'Procurement Needed'].includes(o.status))
      .forEach((o) => {
        const hasPO = purchaseOrders.some((po) => po.orderId === o.id && po.status !== 'Cancelled');
        if (!hasPO) {
          items.push({
            id: `needpo-${o.id}`,
            urgency: 'warning',
            title: `Buat Purchase Order bahan untuk ${o.orderNumber}`,
            detail: `${o.customerName} · ${o.projectName}`,
            targetSection: 'procurement',
            targetId: o.id,
          });
        }
      });

    // 6. Tomorrow's installations to confirm
    installations
      .filter((ins) => ['Scheduled', 'Confirmed'].includes(ins.status) && (isDateToday(ins.scheduledDate) || isDateTomorrow(ins.scheduledDate)))
      .forEach((ins) => {
        items.push({
          id: `ins-${ins.id}`,
          urgency: 'warning',
          title: `Konfirmasi pemasangan ${isDateToday(ins.scheduledDate) ? 'hari ini' : 'besok'} — ${ins.customerName}`,
          detail: `${ins.orderNumber} · ${formatDateID(ins.scheduledDate)} ${ins.scheduledTime || ''}`,
          targetSection: 'installations',
          targetId: ins.id,
        });
      });

    // 7. Quotations awaiting follow-up
    const sentQuotes = quotations.filter((q) => ['Sent', 'Viewed', 'Revision'].includes(q.status));
    if (sentQuotes.length > 0) {
      items.push({
        id: 'quotes-followup',
        urgency: 'info',
        title: `Follow-up ${sentQuotes.length} quotation menunggu keputusan`,
        detail: sentQuotes
          .slice(0, 2)
          .map((q) => `${q.quotationNumber} (${q.customerName})`)
          .join(', '),
        targetSection: 'quotations',
        targetId: sentQuotes[0].id,
      });
    }

    // 8. Surveys completed/scheduled without measurement areas
    surveys
      .filter((s) => s.status !== 'Cancelled')
      .forEach((s) => {
        const count = measurementAreas.filter((m) => m.surveyId === s.id).length;
        if (count === 0) {
          items.push({
            id: `srv-${s.id}`,
            urgency: 'info',
            title: `Lengkapi data pengukuran — ${s.customerName}`,
            detail: `${s.surveyCode} · ${s.projectName} belum memiliki bidang jendela`,
            targetSection: 'surveys',
            targetId: s.id,
          });
        }
      });

    // 9. Leads with due or overdue follow-up
    leads
      .filter((l) => !['Won', 'Lost'].includes(l.status) && (isDateToday(l.nextFollowUpDate) || isDateOverdue(l.nextFollowUpDate)))
      .forEach((l) => {
        items.push({
          id: `lead-${l.id}`,
          urgency: 'info',
          title: `Follow-up calon pelanggan ${l.name}`,
          detail: `Status ${l.status} · Jadwal ${formatDateID(l.nextFollowUpDate)}`,
          targetSection: 'leads',
          targetId: l.id,
        });
      });

    // 10. Overdue or due-today tasks
    tasks
      .filter((t) => !['Done', 'Cancelled'].includes(t.status) && (isDateToday(t.dueDate) || isDateOverdue(t.dueDate)))
      .forEach((t) => {
        items.push({
          id: `task-${t.id}`,
          urgency: isDateOverdue(t.dueDate) ? 'danger' : 'warning',
          title: t.title,
          detail: `Tugas ${t.priority} · Tenggat ${formatDateID(t.dueDate)}`,
          targetSection: 'tasks',
          targetId: t.id,
        });
      });

    return items.slice(0, 10);
  }, [
    productionJobs,
    purchaseOrders,
    orders,
    paidByOrder,
    installations,
    quotations,
    surveys,
    measurementAreas,
    leads,
    tasks,
  ]);

  // Combined Agenda Items (Today & Upcoming 7 Days)
  const agendaItems = useMemo<AgendaItem[]>(() => {
    const list: AgendaItem[] = [];

    surveys
      .filter((s) => !['Completed', 'Cancelled'].includes(s.status) && s.surveyDate)
      .forEach((s) =>
        list.push({
          id: `ag-srv-${s.id}`,
          date: s.surveyDate,
          time: s.surveyTime,
          type: 'Survey & Pengukuran',
          title: `${s.customerName} — ${s.projectName}`,
          subtitle: s.locationAddress || s.surveyor || s.surveyCode,
          status: s.status,
          section: 'surveys',
          recordId: s.id,
        })
      );

    installations
      .filter((i) => !['Completed', 'Cancelled'].includes(i.status) && i.scheduledDate)
      .forEach((i) =>
        list.push({
          id: `ag-ins-${i.id}`,
          date: i.scheduledDate,
          time: i.scheduledTime,
          type: 'Pemasangan',
          title: `${i.customerName} (${i.orderNumber})`,
          subtitle: i.address || i.installerName || i.installationCode,
          status: i.status,
          section: 'installations',
          recordId: i.id,
        })
      );

    leads
      .filter((l) => !['Won', 'Lost'].includes(l.status) && l.nextFollowUpDate)
      .forEach((l) =>
        list.push({
          id: `ag-lead-${l.id}`,
          date: l.nextFollowUpDate!,
          type: 'Follow-up Lead',
          title: l.name,
          subtitle: l.needs || l.whatsapp,
          status: l.status,
          section: 'leads',
          recordId: l.id,
        })
      );

    purchaseOrders
      .filter((po) => !['Received', 'Cancelled'].includes(po.status) && po.targetArrivalDate)
      .forEach((po) =>
        list.push({
          id: `ag-po-${po.id}`,
          date: po.targetArrivalDate!,
          type: 'Target Kedatangan PO',
          title: `${po.poNumber} — ${po.supplierName}`,
          subtitle: `Order ${po.orderNumber}`,
          status: po.status,
          section: 'procurement',
          recordId: po.id,
        })
      );

    tasks
      .filter((t) => !['Done', 'Cancelled'].includes(t.status) && t.dueDate)
      .forEach((t) =>
        list.push({
          id: `ag-task-${t.id}`,
          date: t.dueDate,
          type: 'Tugas',
          title: t.title,
          subtitle: t.relatedLabel || t.assignedTo || t.priority,
          status: t.status,
          section: 'tasks',
          recordId: t.id,
        })
      );

    return list
      .filter((item) => {
        if (agendaFilter === 'today') return isDateToday(item.date);
        if (agendaFilter === 'tomorrow') return isDateTomorrow(item.date);
        if (agendaFilter === 'week') return isDateWithinDays(item.date, 7);
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [surveys, installations, leads, purchaseOrders, tasks, agendaFilter]);

  // Monthly Business Performance Chart (strictly from real Firestore orders, payments, expenses)
  const chartData = useMemo(() => {
    const monthsMap: Record<string, { monthKey: string; omzet: number; kas: number; pengeluaran: number; ordersCount: number }> = {};
    const ensure = (k: string) => {
      if (!k) return null;
      if (!monthsMap[k]) {
        monthsMap[k] = { monthKey: k, omzet: 0, kas: 0, pengeluaran: 0, ordersCount: 0 };
      }
      return monthsMap[k];
    };

    orders
      .filter((o) => o.status !== 'Cancelled')
      .forEach((o) => {
        const m = ensure(getMonthKey(o.orderDate));
        if (m) {
          m.omzet += o.totalAmount || 0;
          m.ordersCount += 1;
        }
      });

    payments.forEach((p) => {
      const m = ensure(getMonthKey(p.paymentDate));
      if (m) {
        m.kas += p.paymentType === 'Refund' ? -p.amount : p.amount;
      }
    });

    expenses.forEach((e) => {
      const m = ensure(getMonthKey(e.expenseDate));
      if (m) {
        m.pengeluaran += e.amount || 0;
      }
    });

    return Object.values(monthsMap)
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
      .slice(-6)
      .map((item) => ({
        bulan: formatMonthLabel(item.monthKey),
        Omzet: item.omzet,
        KasMasuk: item.kas,
        Pengeluaran: item.pengeluaran,
        Order: item.ordersCount,
      }));
  }, [orders, payments, expenses]);

  return (
    <div>
      <PageHeader
        title="Pusat Kontrol Operasional"
        subtitle={`Ringkasan bisnis Harmony Interior per ${formatDateID(todayISO)} · Zona waktu Asia/Jakarta`}
        action={
          <>
            <button
              type="button"
              onClick={() => navigateTo('leads')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E5E2DA] bg-white text-xs font-medium text-[#1F2421] hover:bg-[#F8F7F4] transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Lead Baru
            </button>
            <button
              type="button"
              onClick={() => navigateTo('quotations')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1F3D2B] text-white text-xs font-medium hover:bg-[#172F21] transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Buat Quotation
            </button>
          </>
        }
      />

      {/* Financial KPI Row (4-col) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-[#E5E2DA] rounded-xl p-5">
          <p className="text-xs text-[#5A635D]">Omzet Bulan Ini</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-[#1F2421] tabular-nums">
            {formatIDR(metrics.monthlyRevenue)}
          </p>
          <p className="mt-1.5 text-xs text-[#5A635D]">Nilai order baru non-batal bulan berjalan</p>
        </div>

        <div className="bg-white border border-[#E5E2DA] rounded-xl p-5">
          <p className="text-xs text-[#5A635D]">Uang Diterima Bulan Ini</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-[#186037] tabular-nums">
            {formatIDR(metrics.monthlyCashIn)}
          </p>
          <p className="mt-1.5 text-xs text-[#5A635D]">DP, termin &amp; pelunasan masuk bersih</p>
        </div>

        <div className="bg-white border border-[#E5E2DA] rounded-xl p-5">
          <p className="text-xs text-[#5A635D]">Total Piutang Pelanggan</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-[#9A600B] tabular-nums">
            {formatIDR(metrics.totalReceivables)}
          </p>
          <p className="mt-1.5 text-xs text-[#5A635D]">Sisa tagihan dari seluruh order aktif &amp; selesai</p>
        </div>

        <div className="bg-white border border-[#E5E2DA] rounded-xl p-5">
          <p className="text-xs text-[#5A635D]">Estimasi Keuntungan Order</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-[#1F3D2B] tabular-nums">
            {formatIDR(metrics.estimatedProfit)}
          </p>
          <p className="mt-1.5 text-xs text-[#5A635D]">Nilai order dikurangi total PO / estimasi modal</p>
        </div>
      </section>

      {/* Pipeline Status Counters Strip */}
      <section className="bg-white border border-[#E5E2DA] rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-sm font-semibold text-[#1F2421]">Ringkasan Alur Pesanan</h2>
          <button
            type="button"
            onClick={() => navigateTo('orders')}
            className="text-xs font-medium text-[#1F3D2B] hover:underline whitespace-nowrap"
          >
            Lihat semua order
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 divide-y sm:divide-y-0">
          {[
            { label: 'Order Aktif', val: metrics.activeOrders, section: 'orders' as NavSection },
            { label: 'Order Baru', val: metrics.newOrders, section: 'orders' as NavSection },
            { label: 'Tunggu Konfirmasi', val: metrics.waitingQuotationConfirm, section: 'quotations' as NavSection },
            { label: 'Menunggu DP', val: metrics.waitingDP, section: 'orders' as NavSection },
            { label: 'Perlu PO Bahan', val: metrics.waitingPO, section: 'procurement' as NavSection },
            { label: 'Produksi / Jahit', val: metrics.inProduction, section: 'production' as NavSection },
            { label: 'Siap Dipasang', val: metrics.readyInstall, section: 'installations' as NavSection },
            { label: 'Selesai', val: metrics.completedOrders, section: 'orders' as NavSection },
          ].map((stat) => (
            <button
              key={stat.label}
              type="button"
              onClick={() => navigateTo(stat.section)}
              className="text-left p-3 rounded-lg hover:bg-[#F8F7F4] transition-colors border border-transparent hover:border-[#E5E2DA]"
            >
              <p className="font-mono text-xl font-semibold text-[#1F2421] tabular-nums">{stat.val}</p>
              <p className="mt-1 text-xs text-[#5A635D] leading-snug">{stat.label}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Main 2-Column Split: Action Center & Agenda */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        {/* Action Center */}
        <section className="lg:col-span-7 bg-white border border-[#E5E2DA] rounded-xl p-5 sm:p-6 flex flex-col">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E5E2DA]">
            <div>
              <p className="text-xs font-medium text-[#846838]">Action Center</p>
              <h2 className="font-display text-xl font-semibold text-[#1F2421] mt-0.5">
                Apa yang Harus Saya Kerjakan?
              </h2>
            </div>
            <span className="text-xs font-mono text-[#5A635D] tabular-nums">
              {actionItems.length} prioritas
            </span>
          </div>

          <div className="mt-4 flex-1">
            {dataLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 rounded-lg bg-[#F8F7F4] animate-pulse" />
                ))}
              </div>
            ) : actionItems.length === 0 ? (
              <div className="py-10 text-center">
                <CheckCircle2 className="w-8 h-8 text-[#1E7A46] mx-auto mb-2.5" />
                <p className="text-sm font-medium text-[#1F2421]">Semua pekerjaan prioritas terkendali</p>
                <p className="text-xs text-[#5A635D] mt-1 max-w-sm mx-auto">
                  Daftar prioritas otomatis terisi saat ada quotation perlu di-follow-up, order menunggu DP/PO, produksi terlambat, atau jadwal pemasangan.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#E5E2DA]">
                {actionItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateTo(item.targetSection, item.targetId)}
                    className="w-full py-3.5 first:pt-1 last:pb-1 text-left flex items-center justify-between gap-3 group hover:bg-[#F8F7F4]/70 -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <AlertTriangle
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          item.urgency === 'danger'
                            ? 'text-[#B53939]'
                            : item.urgency === 'warning'
                            ? 'text-[#C47F17]'
                            : 'text-[#2E5E8E]'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#1F2421] group-hover:text-[#1F3D2B] truncate">
                          {item.title}
                        </p>
                        <p className="text-xs text-[#5A635D] mt-0.5 truncate">{item.detail}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#7D8580] group-hover:text-[#1F3D2B] shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Agenda & Upcoming Activity */}
        <section className="lg:col-span-5 bg-white border border-[#E5E2DA] rounded-xl p-5 sm:p-6 flex flex-col">
          <div className="flex flex-col gap-3 pb-4 border-b border-[#E5E2DA]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#5A635D]">Agenda &amp; Jadwal</p>
                <h2 className="font-display text-xl font-semibold text-[#1F2421] mt-0.5">
                  Aktivitas Operasional
                </h2>
              </div>
              <Calendar className="w-4 h-4 text-[#5A635D]" />
            </div>

            <div className="flex items-center gap-1 p-1 bg-[#F8F7F4] rounded-lg border border-[#E5E2DA]">
              {[
                { key: 'today' as const, label: 'Hari Ini' },
                { key: 'tomorrow' as const, label: 'Besok' },
                { key: 'week' as const, label: '7 Hari' },
                { key: 'all' as const, label: 'Semua' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setAgendaFilter(tab.key)}
                  className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    agendaFilter === tab.key
                      ? 'bg-white text-[#1F3D2B] shadow-xs'
                      : 'text-[#5A635D] hover:text-[#1F2421]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex-1">
            {agendaItems.length === 0 ? (
              <div className="py-10 text-center">
                <ClipboardList className="w-7 h-7 text-[#7D8580] mx-auto mb-2" />
                <p className="text-sm font-medium text-[#1F2421]">Belum ada jadwal pada rentang ini</p>
                <p className="text-xs text-[#5A635D] mt-1">
                  Jadwal survey, pemasangan, follow-up lead, target PO, dan tugas akan muncul di sini.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#E5E2DA]">
                {agendaItems.slice(0, 8).map((ag) => (
                  <button
                    key={ag.id}
                    type="button"
                    onClick={() => navigateTo(ag.section, ag.recordId)}
                    className="w-full py-3 first:pt-1 last:pb-1 text-left hover:bg-[#F8F7F4]/70 -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-[#5A635D]">
                      <span className="font-medium text-[#846838]">{ag.type}</span>
                      <span className="font-mono tabular-nums">
                        {formatDateID(ag.date)} {ag.time ? `· ${ag.time}` : ''}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-[#1F2421] mt-0.5 truncate">{ag.title}</p>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="text-xs text-[#5A635D] truncate">{ag.subtitle}</span>
                      <StatusLabel status={ag.status} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Business Performance Chart (Strict Real-Data Policy) */}
      <section className="bg-white border border-[#E5E2DA] rounded-xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#E5E2DA] mb-5">
          <div>
            <h2 className="font-display text-xl font-semibold text-[#1F2421]">
              Performa Bisnis Bulanan
            </h2>
            <p className="text-xs text-[#5A635D] mt-0.5">
              Perbandingan omzet order, kas diterima, dan pengeluaran bisnis berdasarkan data transaksi aktual.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigateTo('reports')}
            className="text-xs font-medium text-[#1F3D2B] hover:underline whitespace-nowrap"
          >
            Buka Laporan Lengkap
          </button>
        </div>

        {chartData.length === 0 ? (
          <div className="py-12 text-center">
            <BarChart3 className="w-8 h-8 text-[#7D8580] mx-auto mb-2.5" />
            <p className="text-sm font-medium text-[#1F2421]">Belum ada data transaksi untuk ditampilkan</p>
            <p className="text-xs text-[#5A635D] mt-1 max-w-md mx-auto">
              Grafik performa bisnis akan terisi otomatis setelah Anda mulai memasukkan order pelanggan, pembayaran, dan pengeluaran bisnis. Tidak ada angka contoh atau data simulasi yang ditampilkan.
            </p>
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DA" vertical={false} />
                <XAxis dataKey="bulan" tick={{ fontSize: 12, fill: '#5A635D' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#5A635D' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}jt` : `${v}`)}
                />
                <Tooltip
                  formatter={(value) => formatIDR(Number(value ?? 0))}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E5E2DA',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="Omzet" name="Omzet Order" fill="#1F3D2B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="KasMasuk" name="Kas Diterima" fill="#B5945B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Pengeluaran" name="Pengeluaran" fill="#B53939" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
};
