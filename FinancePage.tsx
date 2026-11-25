import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Wallet } from 'lucide-react';
import {
  ConfirmDialog,
  EmptyState,
  Modal,
  PageHeader,
  StatusLabel,
  WhatsAppLink,
} from '../components/common/UIPrimitives';
import { useAppData } from '../context/AppDataContext';
import {
  Expense,
  Payment,
  PaymentMethod,
  PaymentSummaryStatus,
  PaymentType,
} from '../types';
import {
  clampStr,
  formatDateID,
  formatIDR,
  getJakartaTodayISO,
  WA_TEMPLATES,
} from '../utils/formatters';

const PAYMENT_TYPES: PaymentType[] = ['DP', 'Termin', 'Pelunasan', 'Additional payment', 'Refund'];
const PAYMENT_METHODS: PaymentMethod[] = ['Transfer bank', 'Cash', 'QRIS', 'Other'];

export const FinancePage: React.FC = () => {
  const {
    orders,
    payments,
    expenses,
    purchaseOrders,
    settings,
    createRecord,
    deleteRecord,
    notify,
  } = useAppData();

  const [tab, setTab] = useState<'overview' | 'payments' | 'expenses'>('overview');
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [expModalOpen, setExpModalOpen] = useState(false);
  const [deletePay, setDeletePay] = useState<Payment | null>(null);
  const [deleteExp, setDeleteExp] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);

  const expenseCategories = settings.expenseCategories?.length
    ? settings.expenseCategories
    : ['Pembelian Bahan', 'Pembayaran Supplier', 'Ongkir', 'Transportasi', 'Pemasangan', 'Operasional', 'Marketing', 'Lainnya'];

  const [payForm, setPayForm] = useState({
    orderId: '',
    paymentDate: getJakartaTodayISO(),
    amount: '',
    paymentType: 'DP' as PaymentType,
    method: 'Transfer bank' as PaymentMethod,
    proofUrl: '',
    notes: '',
  });

  const [expForm, setExpForm] = useState({
    expenseDate: getJakartaTodayISO(),
    category: expenseCategories[0],
    amount: '',
    description: '',
    orderId: '',
    method: 'Transfer bank' as PaymentMethod,
    proofUrl: '',
  });

  // Order-level payment & profit calculations (Zero double-counting between DP & Revenue!)
  const orderFinancials = useMemo(() => {
    return orders
      .filter((o) => o.status !== 'Cancelled')
      .map((o) => {
        const orderPays = payments.filter((p) => p.orderId === o.id);
        const cashReceived = orderPays.reduce(
          (sum, p) => sum + (p.paymentType === 'Refund' ? -p.amount : p.amount),
          0
        );
        const remaining = o.totalAmount - cashReceived;
        let paymentStatus: PaymentSummaryStatus = 'Unpaid';
        if (cashReceived <= 0) paymentStatus = 'Unpaid';
        else if (cashReceived < o.totalAmount) paymentStatus = 'Partial';
        else if (cashReceived === o.totalAmount) paymentStatus = 'Paid';
        else paymentStatus = 'Overpaid';

        const linkedPOs = purchaseOrders.filter((po) => po.orderId === o.id && po.status !== 'Cancelled');
        const poTotal = linkedPOs.reduce((sum, po) => sum + (po.totalAmount || 0), 0);
        const directExpenses = expenses
          .filter((e) => e.orderId === o.id)
          .reduce((sum, e) => sum + (e.amount || 0), 0);

        const actualCost = poTotal + directExpenses;
        const estimatedCost = poTotal > 0 ? poTotal : o.estimatedCost || 0;
        const estimatedProfit = o.totalAmount - estimatedCost;
        const actualProfit = cashReceived - actualCost;

        return {
          order: o,
          cashReceived,
          remaining: Math.max(0, remaining),
          paymentStatus,
          poTotal,
          directExpenses,
          estimatedProfit,
          actualProfit,
        };
      });
  }, [orders, payments, purchaseOrders, expenses]);

  const overview = useMemo(() => {
    const totalRevenue = orderFinancials.reduce((s, x) => s + x.order.totalAmount, 0);
    const totalCashReceived = payments.reduce(
      (s, p) => s + (p.paymentType === 'Refund' ? -p.amount : p.amount),
      0
    );
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const cashflow = totalCashReceived - totalExpenses;
    const outstandingCustomer = orderFinancials.reduce((s, x) => s + x.remaining, 0);
    const outstandingSupplier = purchaseOrders
      .filter((po) => po.status !== 'Cancelled')
      .reduce((s, po) => s + Math.max(0, (po.totalAmount || 0) - (po.paidAmount || 0)), 0);
    const estimatedGrossProfit = orderFinancials.reduce((s, x) => s + x.estimatedProfit, 0);

    return {
      totalRevenue,
      totalCashReceived,
      totalExpenses,
      cashflow,
      outstandingCustomer,
      outstandingSupplier,
      estimatedGrossProfit,
    };
  }, [orderFinancials, payments, expenses, purchaseOrders]);

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const ord = orders.find((o) => o.id === payForm.orderId);
    const amount = Number(payForm.amount);
    if (!ord || !amount || amount <= 0) {
      notify('error', 'Pilih order dan masukkan nominal pembayaran yang valid.');
      return;
    }
    setSaving(true);
    try {
      await createRecord(
        'payments',
        {
          orderId: ord.id,
          orderNumber: ord.orderNumber,
          customerId: ord.customerId,
          customerName: ord.customerName,
          paymentDate: payForm.paymentDate,
          amount,
          paymentType: payForm.paymentType,
          method: payForm.method,
          proofUrl: clampStr(payForm.proofUrl, 1000),
          notes: clampStr(payForm.notes, 1000),
        },
        {
          action: payForm.paymentType === 'DP' ? 'DP diterima' : 'Pembayaran dicatat',
          entityType: 'payment',
          summary: `${payForm.paymentType} ${formatIDR(amount)} untuk ${ord.orderNumber} (${ord.customerName}) via ${payForm.method}.`,
        }
      );
      notify('success', `Pembayaran ${payForm.paymentType} sebesar ${formatIDR(amount)} dicatat.`);
      setPayModalOpen(false);
    } catch {
      notify('error', 'Gagal mencatat pembayaran.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(expForm.amount);
    if (!amount || amount <= 0 || !expForm.description.trim()) {
      notify('error', 'Deskripsi dan nominal pengeluaran wajib diisi.');
      return;
    }
    const ord = orders.find((o) => o.id === expForm.orderId);
    setSaving(true);
    try {
      await createRecord(
        'expenses',
        {
          expenseDate: expForm.expenseDate,
          category: clampStr(expForm.category, 100),
          amount,
          description: clampStr(expForm.description, 500),
          orderId: ord?.id || '',
          orderNumber: ord?.orderNumber || '',
          method: expForm.method,
          proofUrl: clampStr(expForm.proofUrl, 1000),
        },
        {
          action: 'Pengeluaran dicatat',
          entityType: 'expense',
          summary: `Pengeluaran ${expForm.category} ${formatIDR(amount)} — ${expForm.description}.`,
        }
      );
      notify('success', `Pengeluaran ${formatIDR(amount)} dicatat.`);
      setExpModalOpen(false);
    } catch {
      notify('error', 'Gagal mencatat pengeluaran.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Keuangan & Pembayaran"
        subtitle="Pantau omzet order, kas diterima (tanpa double-counting DP), piutang pelanggan, hutang supplier, pengeluaran, dan profit per order."
        action={
          <>
            <button
              type="button"
              onClick={() => {
                setExpForm({
                  expenseDate: getJakartaTodayISO(),
                  category: expenseCategories[0],
                  amount: '',
                  description: '',
                  orderId: '',
                  method: 'Transfer bank',
                  proofUrl: '',
                });
                setExpModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E5E2DA] bg-white text-xs font-medium text-[#1F2421] hover:bg-[#F8F7F4] whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Catat Pengeluaran
            </button>
            <button
              type="button"
              onClick={() => {
                setPayForm({
                  orderId: orders[0]?.id || '',
                  paymentDate: getJakartaTodayISO(),
                  amount: '',
                  paymentType: 'DP',
                  method: 'Transfer bank',
                  proofUrl: '',
                  notes: '',
                });
                setPayModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1F3D2B] text-white text-xs font-medium hover:bg-[#172F21] whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Catat Pembayaran Pelanggan
            </button>
          </>
        }
      />

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-[#E5E2DA] rounded-xl p-5">
          <p className="text-xs text-[#5A635D]">Total Omzet Order (Revenue)</p>
          <p className="mt-1.5 font-mono text-xl font-semibold text-[#1F2421] tabular-nums">
            {formatIDR(overview.totalRevenue)}
          </p>
          <p className="mt-1 text-[11px] text-[#7D8580]">Total nilai jual order aktif &amp; selesai</p>
        </div>
        <div className="bg-white border border-[#E5E2DA] rounded-xl p-5">
          <p className="text-xs text-[#5A635D]">Total Kas Diterima (Cash In)</p>
          <p className="mt-1.5 font-mono text-xl font-semibold text-[#186037] tabular-nums">
            {formatIDR(overview.totalCashReceived)}
          </p>
          <p className="mt-1 text-[11px] text-[#7D8580]">DP + Termin + Pelunasan bersih</p>
        </div>
        <div className="bg-white border border-[#E5E2DA] rounded-xl p-5">
          <p className="text-xs text-[#5A635D]">Total Pengeluaran (Expenses)</p>
          <p className="mt-1.5 font-mono text-xl font-semibold text-[#B53939] tabular-nums">
            {formatIDR(overview.totalExpenses)}
          </p>
          <p className="mt-1 text-[11px] text-[#7D8580]">Cashflow bersih: <span className="font-mono">{formatIDR(overview.cashflow)}</span></p>
        </div>
        <div className="bg-white border border-[#E5E2DA] rounded-xl p-5">
          <p className="text-xs text-[#5A635D]">Piutang / Hutang Supplier</p>
          <p className="mt-1.5 font-mono text-lg font-semibold text-[#9A600B] tabular-nums">
            {formatIDR(overview.outstandingCustomer)}
          </p>
          <p className="mt-1 text-[11px] text-[#7D8580]">
            Hutang supplier PO: <span className="font-mono text-[#1F2421]">{formatIDR(overview.outstandingSupplier)}</span>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-white border border-[#E5E2DA] rounded-xl w-fit mb-5">
        {[
          { key: 'overview' as const, label: `Piutang & Profit Order (${orderFinancials.length})` },
          { key: 'payments' as const, label: `Pembayaran Pelanggan (${payments.length})` },
          { key: 'expenses' as const, label: `Pengeluaran Bisnis (${expenses.length})` },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
              tab === t.key ? 'bg-[#1F3D2B] text-white' : 'text-[#5A635D] hover:text-[#1F2421]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        orderFinancials.length === 0 ? (
          <EmptyState
            icon={<Wallet className="w-5 h-5" />}
            title="Belum ada transaksi keuangan"
            description="Ringkasan status pembayaran, sisa piutang, dan profit aktual per order akan muncul otomatis setelah order dibuat."
          />
        ) : (
          <div className="bg-white border border-[#E5E2DA] rounded-xl overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5E2DA] bg-[#F8F7F4] text-[#5A635D]">
                  <th className="py-3 px-4">Order &amp; Pelanggan</th>
                  <th className="py-3 px-4 text-right">Nilai Order</th>
                  <th className="py-3 px-4 text-right">Diterima</th>
                  <th className="py-3 px-4 text-right">Sisa Piutang</th>
                  <th className="py-3 px-4">Status Bayar</th>
                  <th className="py-3 px-4 text-right">Est. Profit</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E2DA]">
                {orderFinancials.map((row) => (
                  <tr key={row.order.id} className="hover:bg-[#F8F7F4]/60">
                    <td className="py-3 px-4">
                      <p className="font-mono font-semibold text-[#1F2421]">{row.order.orderNumber}</p>
                      <p className="text-[#5A635D]">{row.order.customerName}</p>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{formatIDR(row.order.totalAmount)}</td>
                    <td className="py-3 px-4 text-right font-mono text-[#186037] tabular-nums">{formatIDR(row.cashReceived)}</td>
                    <td className="py-3 px-4 text-right font-mono text-[#9A600B] font-medium tabular-nums">{formatIDR(row.remaining)}</td>
                    <td className="py-3 px-4"><StatusLabel status={row.paymentStatus} /></td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-[#1F3D2B] tabular-nums">{formatIDR(row.estimatedProfit)}</td>
                    <td className="py-3 px-4 text-right">
                      {row.remaining > 0 && (
                        <WhatsAppLink
                          phone={row.order.customerWhatsapp}
                          message={WA_TEMPLATES.paymentReminder({
                            customerName: row.order.customerName,
                            orderNumber: row.order.orderNumber,
                            projectName: row.order.projectName,
                            remainingAmount: row.remaining,
                            bankAccounts: settings.bankAccounts,
                            businessName: settings.businessName,
                          })}
                          label="Tagih WA"
                          compact
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'payments' && (
        payments.length === 0 ? (
          <EmptyState
            icon={<Wallet className="w-5 h-5" />}
            title="Belum ada pembayaran pelanggan tercatat"
            description="Catat DP, termin, atau pelunasan yang masuk agar sisa piutang tiap order selalu akurat."
            actionLabel="Catat Pembayaran Pertama"
            onAction={() => setPayModalOpen(true)}
          />
        ) : (
          <div className="bg-white border border-[#E5E2DA] rounded-xl divide-y divide-[#E5E2DA]">
            {payments.map((p) => (
              <div key={p.id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#1F2421]">
                    {p.paymentType} · {p.customerName} ({p.orderNumber})
                  </p>
                  <p className="text-xs text-[#5A635D]">
                    {formatDateID(p.paymentDate)} · {p.method} {p.notes ? `· ${p.notes}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`font-mono text-sm font-semibold tabular-nums ${p.paymentType === 'Refund' ? 'text-[#B53939]' : 'text-[#186037]'}`}>
                    {p.paymentType === 'Refund' ? '- ' : '+ '}{formatIDR(p.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDeletePay(p)}
                    className="p-1.5 rounded-lg text-[#5A635D] hover:text-[#B53939] hover:bg-[#FDF2F2]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'expenses' && (
        expenses.length === 0 ? (
          <EmptyState
            icon={<Wallet className="w-5 h-5" />}
            title="Belum ada pengeluaran bisnis tercatat"
            description="Catat pembayaran bahan ke supplier, ongkir, transportasi, biaya pemasangan, atau operasional harian."
            actionLabel="Catat Pengeluaran Pertama"
            onAction={() => setExpModalOpen(true)}
          />
        ) : (
          <div className="bg-white border border-[#E5E2DA] rounded-xl divide-y divide-[#E5E2DA]">
            {expenses.map((ex) => (
              <div key={ex.id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#1F2421]">{ex.description}</p>
                  <p className="text-xs text-[#5A635D]">
                    {ex.category} · {formatDateID(ex.expenseDate)} · {ex.method}
                    {ex.orderNumber ? ` · Order ${ex.orderNumber}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-sm font-semibold text-[#B53939] tabular-nums">
                    - {formatIDR(ex.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDeleteExp(ex)}
                    className="p-1.5 rounded-lg text-[#5A635D] hover:text-[#B53939] hover:bg-[#FDF2F2]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Payment Modal */}
      <Modal open={payModalOpen} onClose={() => setPayModalOpen(false)} title="Catat Pembayaran Pelanggan">
        <form onSubmit={handleSavePayment} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Order Pelanggan *</label>
              <select
                required
                value={payForm.orderId}
                onChange={(e) => setPayForm({ ...payForm, orderId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
              >
                <option value="">-- Pilih Order --</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>{o.orderNumber} — {o.customerName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Tanggal Pembayaran *</label>
              <input
                type="date"
                required
                value={payForm.paymentDate}
                onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Jenis Pembayaran</label>
              <select
                value={payForm.paymentType}
                onChange={(e) => setPayForm({ ...payForm, paymentType: e.target.value as PaymentType })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
              >
                {PAYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Metode Pembayaran</label>
              <select
                value={payForm.method}
                onChange={(e) => setPayForm({ ...payForm, method: e.target.value as PaymentMethod })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
              >
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Nominal (IDR) *</label>
            <input
              type="number"
              required
              min="1"
              value={payForm.amount}
              onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Catatan</label>
            <input
              type="text"
              value={payForm.notes}
              onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
              placeholder="Contoh: Transfer BCA a.n. Anita"
              className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E5E2DA]">
            <button type="button" onClick={() => setPayModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#E5E2DA] text-sm">Batal</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-[#1F3D2B] text-white text-sm font-medium">
              {saving ? 'Menyimpan...' : 'Simpan Pembayaran'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Expense Modal */}
      <Modal open={expModalOpen} onClose={() => setExpModalOpen(false)} title="Catat Pengeluaran Bisnis">
        <form onSubmit={handleSaveExpense} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Tanggal *</label>
              <input
                type="date"
                required
                value={expForm.expenseDate}
                onChange={(e) => setExpForm({ ...expForm, expenseDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Kategori Pengeluaran</label>
              <select
                value={expForm.category}
                onChange={(e) => setExpForm({ ...expForm, category: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
              >
                {expenseCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Nominal (IDR) *</label>
              <input
                type="number"
                required
                min="1"
                value={expForm.amount}
                onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Metode</label>
              <select
                value={expForm.method}
                onChange={(e) => setExpForm({ ...expForm, method: e.target.value as PaymentMethod })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
              >
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Order Terkait (Opsional)</label>
            <select
              value={expForm.orderId}
              onChange={(e) => setExpForm({ ...expForm, orderId: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
            >
              <option value="">-- Pengeluaran Umum / Non-Order --</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>{o.orderNumber} — {o.customerName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Deskripsi Pengeluaran *</label>
            <input
              type="text"
              required
              value={expForm.description}
              onChange={(e) => setExpForm({ ...expForm, description: e.target.value })}
              placeholder="Contoh: Pembelian kain blackout supplier Jaya Makmur"
              className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E5E2DA]">
            <button type="button" onClick={() => setExpModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#E5E2DA] text-sm">Batal</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-[#1F3D2B] text-white text-sm font-medium">
              {saving ? 'Menyimpan...' : 'Simpan Pengeluaran'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletePay)}
        title="Hapus Catatan Pembayaran?"
        message={`Hapus pembayaran ${deletePay?.paymentType} sebesar ${formatIDR(deletePay?.amount)}?`}
        confirmLabel="Hapus"
        onCancel={() => setDeletePay(null)}
        onConfirm={async () => {
          if (!deletePay) return;
          await deleteRecord('payments', deletePay.id);
          notify('success', 'Catatan pembayaran dihapus.');
          setDeletePay(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteExp)}
        title="Hapus Pengeluaran?"
        message={`Hapus pengeluaran "${deleteExp?.description}"?`}
        confirmLabel="Hapus"
        onCancel={() => setDeleteExp(null)}
        onConfirm={async () => {
          if (!deleteExp) return;
          await deleteRecord('expenses', deleteExp.id);
          notify('success', 'Pengeluaran dihapus.');
          setDeleteExp(null);
        }}
      />
    </div>
  );
};
