import React, { useMemo, useState } from 'react';
import { BarChart3, Download, Printer } from 'lucide-react';
import { EmptyState, PageHeader, StatusLabel } from '../components/common/UIPrimitives';
import { useAppData } from '../context/AppDataContext';
import {
  exportToCSV,
  formatDateID,
  formatIDR,
  getJakartaTodayISO,
} from '../utils/formatters';

type ReportTab =
  | 'sales'
  | 'orders'
  | 'customers'
  | 'leads'
  | 'quotations'
  | 'suppliers'
  | 'payments'
  | 'expenses'
  | 'profit'
  | 'installations';

const REPORT_TABS: { key: ReportTab; label: string }[] = [
  { key: 'sales', label: 'Penjualan' },
  { key: 'orders', label: 'Order' },
  { key: 'customers', label: 'Pelanggan' },
  { key: 'leads', label: 'Konversi Lead' },
  { key: 'quotations', label: 'Quotation' },
  { key: 'suppliers', label: 'Pembelian Supplier' },
  { key: 'payments', label: 'Pembayaran' },
  { key: 'expenses', label: 'Pengeluaran' },
  { key: 'profit', label: 'Profit per Order' },
  { key: 'installations', label: 'Pemasangan' },
];

export const ReportsPage: React.FC = () => {
  const {
    orders,
    customers,
    leads,
    quotations,
    purchaseOrders,
    payments,
    expenses,
    installations,
    notify,
  } = useAppData();

  const today = getJakartaTodayISO();
  const [activeTab, setActiveTab] = useState<ReportTab>('sales');
  const [dateFrom, setDateFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [dateTo, setDateTo] = useState(today);

  const inRange = (d?: string) => {
    if (!d) return true;
    const iso = d.slice(0, 10);
    if (dateFrom && iso < dateFrom) return false;
    if (dateTo && iso > dateTo) return false;
    return true;
  };

  const filteredOrders = useMemo(
    () => orders.filter((o) => inRange(o.orderDate)),
    [orders, dateFrom, dateTo]
  );
  const filteredQuotes = useMemo(
    () => quotations.filter((q) => inRange(q.quotationDate)),
    [quotations, dateFrom, dateTo]
  );
  const filteredPOs = useMemo(
    () => purchaseOrders.filter((po) => inRange(po.poDate)),
    [purchaseOrders, dateFrom, dateTo]
  );
  const filteredPayments = useMemo(
    () => payments.filter((p) => inRange(p.paymentDate)),
    [payments, dateFrom, dateTo]
  );
  const filteredExpenses = useMemo(
    () => expenses.filter((e) => inRange(e.expenseDate)),
    [expenses, dateFrom, dateTo]
  );
  const filteredInstalls = useMemo(
    () => installations.filter((i) => inRange(i.scheduledDate)),
    [installations, dateFrom, dateTo]
  );

  const reportPayload = useMemo(() => {
    switch (activeTab) {
      case 'sales': {
        const valid = filteredOrders.filter((o) => o.status !== 'Cancelled');
        const total = valid.reduce((s, o) => s + o.totalAmount, 0);
        return {
          summary: [
            { label: 'Jumlah Order Non-Batal', value: String(valid.length) },
            { label: 'Total Nilai Penjualan', value: formatIDR(total) },
            { label: 'Rata-rata Nilai Order', value: formatIDR(valid.length ? total / valid.length : 0) },
          ],
          headers: ['No. Order', 'Tanggal', 'Pelanggan', 'Proyek', 'Status', 'Nilai Order (IDR)'],
          rows: valid.map((o) => [
            o.orderNumber,
            formatDateID(o.orderDate),
            o.customerName,
            o.projectName,
            o.status,
            o.totalAmount,
          ]),
        };
      }
      case 'orders':
        return {
          summary: [
            { label: 'Total Order', value: String(filteredOrders.length) },
            { label: 'Selesai / Closed', value: String(filteredOrders.filter((o) => ['Completed', 'Closed'].includes(o.status)).length) },
            { label: 'Dibatalkan', value: String(filteredOrders.filter((o) => o.status === 'Cancelled').length) },
          ],
          headers: ['No. Order', 'Tanggal', 'Pelanggan', 'Proyek', 'Target Pasang', 'Status', 'Total'],
          rows: filteredOrders.map((o) => [
            o.orderNumber,
            formatDateID(o.orderDate),
            o.customerName,
            o.projectName,
            formatDateID(o.targetInstallationDate),
            o.status,
            o.totalAmount,
          ]),
        };
      case 'customers':
        return {
          summary: [
            { label: 'Total Pelanggan', value: String(customers.length) },
            { label: 'Pelanggan Bertransaksi', value: String(new Set(orders.map((o) => o.customerId)).size) },
          ],
          headers: ['Kode', 'Nama', 'WhatsApp', 'Kota', 'Properti', 'Sumber', 'Jumlah Order'],
          rows: customers.map((c) => [
            c.customerCode,
            c.name,
            c.whatsapp,
            c.city || '-',
            c.propertyType,
            c.source,
            orders.filter((o) => o.customerId === c.id).length,
          ]),
        };
      case 'leads': {
        const won = leads.filter((l) => l.status === 'Won').length;
        const lost = leads.filter((l) => l.status === 'Lost').length;
        const rate = leads.length ? `${((won / leads.length) * 100).toFixed(1)}%` : '0%';
        return {
          summary: [
            { label: 'Total Leads', value: String(leads.length) },
            { label: 'Won / Konversi', value: `${won} (${rate})` },
            { label: 'Lost', value: String(lost) },
          ],
          headers: ['Nama', 'WhatsApp', 'Sumber', 'Status', 'Estimasi Nilai', 'Alasan Lost'],
          rows: leads.map((l) => [
            l.name,
            l.whatsapp,
            l.source,
            l.status,
            l.estimatedValue || 0,
            l.lostReason || '-',
          ]),
        };
      }
      case 'quotations': {
        const approved = filteredQuotes.filter((q) => q.status === 'Approved').length;
        return {
          summary: [
            { label: 'Total Quotation', value: String(filteredQuotes.length) },
            { label: 'Disetujui (Approved)', value: String(approved) },
            { label: 'Total Nilai Penawaran', value: formatIDR(filteredQuotes.reduce((s, q) => s + q.totalAmount, 0)) },
          ],
          headers: ['No. Quotation', 'Tanggal', 'Pelanggan', 'Proyek', 'Revisi', 'Status', 'Total'],
          rows: filteredQuotes.map((q) => [
            q.quotationNumber,
            formatDateID(q.quotationDate),
            q.customerName,
            q.projectName,
            q.revisionNumber || 1,
            q.status,
            q.totalAmount,
          ]),
        };
      }
      case 'suppliers': {
        const validPO = filteredPOs.filter((po) => po.status !== 'Cancelled');
        const total = validPO.reduce((s, po) => s + po.totalAmount, 0);
        const paid = validPO.reduce((s, po) => s + (po.paidAmount || 0), 0);
        return {
          summary: [
            { label: 'Total PO', value: String(validPO.length) },
            { label: 'Total Pembelian Bahan/Jasa', value: formatIDR(total) },
            { label: 'Sisa Hutang Supplier', value: formatIDR(Math.max(0, total - paid)) },
          ],
          headers: ['No. PO', 'Tanggal', 'Order Ref', 'Supplier', 'Status', 'Total PO', 'Dibayar'],
          rows: validPO.map((po) => [
            po.poNumber,
            formatDateID(po.poDate),
            po.orderNumber,
            po.supplierName,
            po.status,
            po.totalAmount,
            po.paidAmount || 0,
          ]),
        };
      }
      case 'payments': {
        const net = filteredPayments.reduce(
          (s, p) => s + (p.paymentType === 'Refund' ? -p.amount : p.amount),
          0
        );
        return {
          summary: [
            { label: 'Jumlah Transaksi', value: String(filteredPayments.length) },
            { label: 'Total Kas Diterima Bersih', value: formatIDR(net) },
          ],
          headers: ['Tanggal', 'No. Order', 'Pelanggan', 'Jenis', 'Metode', 'Nominal (IDR)'],
          rows: filteredPayments.map((p) => [
            formatDateID(p.paymentDate),
            p.orderNumber,
            p.customerName,
            p.paymentType,
            p.method,
            p.paymentType === 'Refund' ? -p.amount : p.amount,
          ]),
        };
      }
      case 'expenses': {
        const total = filteredExpenses.reduce((s, e) => s + e.amount, 0);
        return {
          summary: [
            { label: 'Jumlah Pengeluaran', value: String(filteredExpenses.length) },
            { label: 'Total Pengeluaran', value: formatIDR(total) },
          ],
          headers: ['Tanggal', 'Kategori', 'Deskripsi', 'Order Ref', 'Metode', 'Nominal (IDR)'],
          rows: filteredExpenses.map((e) => [
            formatDateID(e.expenseDate),
            e.category,
            e.description,
            e.orderNumber || '-',
            e.method,
            e.amount,
          ]),
        };
      }
      case 'profit': {
        const valid = filteredOrders.filter((o) => o.status !== 'Cancelled');
        const rows = valid.map((o) => {
          const cashIn = payments
            .filter((p) => p.orderId === o.id)
            .reduce((s, p) => s + (p.paymentType === 'Refund' ? -p.amount : p.amount), 0);
          const poCost = purchaseOrders
            .filter((po) => po.orderId === o.id && po.status !== 'Cancelled')
            .reduce((s, po) => s + po.totalAmount, 0);
          const expCost = expenses
            .filter((e) => e.orderId === o.id)
            .reduce((s, e) => s + e.amount, 0);
          const actualCost = poCost + expCost;
          const profit = o.totalAmount - (actualCost > 0 ? actualCost : o.estimatedCost || 0);
          return [o.orderNumber, o.customerName, o.totalAmount, cashIn, actualCost, profit];
        });
        const totalProfit = rows.reduce((s, r) => s + Number(r[5]), 0);
        return {
          summary: [
            { label: 'Total Order Dihitung', value: String(valid.length) },
            { label: 'Total Estimasi / Aktual Profit', value: formatIDR(totalProfit) },
          ],
          headers: ['No. Order', 'Pelanggan', 'Nilai Order', 'Kas Diterima', 'Biaya PO + Expense', 'Profit'],
          rows,
        };
      }
      case 'installations': {
        const completed = filteredInstalls.filter((i) => i.status === 'Completed').length;
        return {
          summary: [
            { label: 'Total Jadwal Pemasangan', value: String(filteredInstalls.length) },
            { label: 'Selesai Dipasang', value: String(completed) },
          ],
          headers: ['Kode', 'Tanggal', 'No. Order', 'Pelanggan', 'Petugas', 'Status'],
          rows: filteredInstalls.map((i) => [
            i.installationCode,
            formatDateID(i.scheduledDate),
            i.orderNumber,
            i.customerName,
            i.installerName || '-',
            i.status,
          ]),
        };
      }
    }
  }, [
    activeTab,
    filteredOrders,
    customers,
    orders,
    leads,
    filteredQuotes,
    filteredPOs,
    filteredPayments,
    filteredExpenses,
    filteredInstalls,
    payments,
    purchaseOrders,
    expenses,
  ]);

  const handleExportCSV = () => {
    if (reportPayload.rows.length === 0) {
      notify('info', 'Belum ada data untuk diekspor pada periode ini.');
      return;
    }
    exportToCSV(
      `harmony-laporan-${activeTab}-${dateFrom}-sd-${dateTo}.csv`,
      reportPayload.headers,
      reportPayload.rows
    );
    notify('success', 'Laporan CSV berhasil diunduh.');
  };

  const isCurrencyHeader = (h: string) =>
    /nilai|total|nominal|dibayar|kas|biaya|profit|estimasi/i.test(h);

  return (
    <div>
      <PageHeader
        title="Laporan Bisnis"
        subtitle="Seluruh laporan dihitung langsung dari data aktual database Harmony Interior sesuai rentang tanggal."
        action={
          <>
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E5E2DA] bg-white text-xs font-medium text-[#1F2421] hover:bg-[#F8F7F4] no-print"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1F3D2B] text-white text-xs font-medium hover:bg-[#172F21] no-print"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak / PDF
            </button>
          </>
        }
      />

      {/* Date Range & Report Tabs */}
      <div className="bg-white border border-[#E5E2DA] rounded-xl p-4 mb-5 space-y-3 no-print">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#5A635D]">Dari</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-[#E5E2DA] text-xs"
            />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#5A635D]">Sampai</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-[#E5E2DA] text-xs"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {REPORT_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === t.key ? 'bg-[#1F3D2B] text-white' : 'bg-[#F8F7F4] text-[#5A635D] hover:text-[#1F2421]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        {reportPayload.summary.map((s) => (
          <div key={s.label} className="bg-white border border-[#E5E2DA] rounded-xl p-4">
            <p className="text-xs text-[#5A635D]">{s.label}</p>
            <p className="mt-1 font-mono text-xl font-semibold text-[#1F2421] tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Report Table */}
      {reportPayload.rows.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="w-5 h-5" />}
          title="Belum ada data laporan pada rentang tanggal ini"
          description="Laporan akan otomatis terisi begitu transaksi dimasukkan pada modul terkait."
        />
      ) : (
        <div className="bg-white border border-[#E5E2DA] rounded-xl overflow-x-auto print-sheet">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5E2DA] bg-[#F8F7F4] text-[#5A635D]">
                {reportPayload.headers.map((h) => (
                  <th key={h} className={`py-3 px-4 ${isCurrencyHeader(h) ? 'text-right' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E2DA]">
              {reportPayload.rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-[#F8F7F4]/60">
                  {row.map((cell, cIdx) => {
                    const header = reportPayload.headers[cIdx];
                    const isMoney = isCurrencyHeader(header) && typeof cell === 'number';
                    return (
                      <td
                        key={cIdx}
                        className={`py-3 px-4 ${
                          isMoney ? 'text-right font-mono tabular-nums font-medium text-[#1F2421]' : 'text-[#1F2421]'
                        }`}
                      >
                        {header === 'Status' && typeof cell === 'string' ? (
                          <StatusLabel status={cell} />
                        ) : isMoney ? (
                          formatIDR(cell)
                        ) : (
                          String(cell ?? '-')
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
