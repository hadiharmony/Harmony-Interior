import React, { useEffect, useMemo, useState } from 'react';
import {
  ClipboardList,
  Clock,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  Wallet,
  Wrench,
} from 'lucide-react';
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
  Order,
  ORDER_WORKFLOW_STATUSES,
  OrderStatus,
  OrderTimelineEntry,
} from '../types';
import {
  addDaysISO,
  clampStr,
  formatDateID,
  formatIDR,
  generateCode,
  getJakartaTodayISO,
  WA_TEMPLATES,
} from '../utils/formatters';

export const OrdersPage: React.FC = () => {
  const {
    orders,
    customers,
    purchaseOrders,
    productionJobs,
    installations,
    payments,
    settings,
    userProfile,
    createRecord,
    updateRecord,
    deleteRecord,
    notify,
    focusedRecordId,
    clearFocusedRecord,
    navigateTo,
  } = useAppData();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);

  const [newStatus, setNewStatus] = useState<OrderStatus>('Confirmed');
  const [statusNote, setStatusNote] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [form, setForm] = useState({
    customerId: '',
    projectName: '',
    installationAddress: '',
    orderDate: getJakartaTodayISO(),
    targetCompletionDate: addDaysISO(getJakartaTodayISO(), 14),
    targetInstallationDate: addDaysISO(getJakartaTodayISO(), 16),
    totalAmount: '',
    dpAmount: '',
    estimatedCost: '',
    status: 'New Order' as OrderStatus,
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (focusedRecordId) {
      const found = orders.find((o) => o.id === focusedRecordId);
      if (found) setSelectedOrderId(found.id);
      clearFocusedRecord();
    } else if (!selectedOrderId && orders.length > 0) {
      setSelectedOrderId(orders[0].id);
    }
  }, [focusedRecordId, orders, selectedOrderId, clearFocusedRecord]);

  const activeOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) || null,
    [orders, selectedOrderId]
  );

  useEffect(() => {
    if (activeOrder) {
      setNewStatus(activeOrder.status);
    }
  }, [activeOrder]);

  const paidByOrder = useMemo(() => {
    const map: Record<string, number> = {};
    payments.forEach((p) => {
      map[p.orderId] = (map[p.orderId] || 0) + (p.paymentType === 'Refund' ? -p.amount : p.amount);
    });
    return map;
  }, [payments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (!q) return true;
      return `${o.orderNumber} ${o.customerName} ${o.projectName} ${o.status}`
        .toLowerCase()
        .includes(q);
    });
  }, [orders, search, statusFilter]);

  const activeRelations = useMemo(() => {
    if (!activeOrder) return null;
    const pos = purchaseOrders.filter((po) => po.orderId === activeOrder.id);
    const jobs = productionJobs.filter((j) => j.orderId === activeOrder.id);
    const installs = installations.filter((i) => i.orderId === activeOrder.id);
    const pays = payments.filter((p) => p.orderId === activeOrder.id);
    const totalPaid = paidByOrder[activeOrder.id] || 0;
    const remaining = Math.max(0, (activeOrder.totalAmount || 0) - totalPaid);
    const totalPO = pos
      .filter((po) => po.status !== 'Cancelled')
      .reduce((sum, po) => sum + po.totalAmount, 0);
    return { pos, jobs, installs, pays, totalPaid, remaining, totalPO };
  }, [activeOrder, purchaseOrders, productionJobs, installations, payments, paidByOrder]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find((c) => c.id === form.customerId);
    if (!cust || !form.projectName.trim()) {
      notify('error', 'Pelanggan dan nama proyek wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      const orderNumber = generateCode(settings.orderPrefix || 'HI', orders.length);
      const totalAmount = Math.max(0, Number(form.totalAmount) || 0);
      const dpAmount = Math.max(0, Number(form.dpAmount) || Math.round((totalAmount * (settings.defaultDpPercentage || 50)) / 100));
      const estimatedCost = Math.max(0, Number(form.estimatedCost) || 0);
      const id = await createRecord(
        'orders',
        {
          orderNumber,
          customerId: cust.id,
          customerName: cust.name,
          customerWhatsapp: cust.whatsapp,
          projectName: clampStr(form.projectName, 200),
          installationAddress: clampStr(form.installationAddress || cust.installationLocation || cust.address || '', 500),
          orderDate: form.orderDate,
          targetCompletionDate: form.targetCompletionDate,
          targetInstallationDate: form.targetInstallationDate,
          items: [],
          totalAmount,
          dpAmount,
          estimatedCost,
          status: form.status,
          timeline: [
            {
              status: form.status,
              date: getJakartaTodayISO(),
              note: 'Order dibuat secara langsung.',
              by: userProfile?.displayName || 'Pemilik',
            },
          ],
          notes: clampStr(form.notes, 2000),
        },
        {
          action: 'Order dibuat',
          entityType: 'order',
          summary: `Order ${orderNumber} (${cust.name} — ${form.projectName}) senilai ${formatIDR(totalAmount)}.`,
        }
      );
      setSelectedOrderId(id);
      setCreateOpen(false);
      notify('success', `Order ${orderNumber} berhasil dibuat.`);
    } catch {
      notify('error', 'Gagal membuat order.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder) return;
    setUpdatingStatus(true);
    try {
      const entry: OrderTimelineEntry = {
        status: newStatus,
        date: getJakartaTodayISO(),
        note: clampStr(statusNote || `Status diperbarui ke ${newStatus}`, 300),
        by: userProfile?.displayName || 'Pemilik',
      };
      const timeline = [entry, ...(activeOrder.timeline || [])].slice(0, 55);
      await updateRecord(
        'orders',
        activeOrder.id,
        { status: newStatus, timeline },
        {
          action: 'Status order diubah',
          entityType: 'order',
          summary: `${activeOrder.orderNumber} berpindah ke status "${newStatus}". ${statusNote ? `(${statusNote})` : ''}`,
        }
      );
      setStatusNote('');
      notify('success', `Status ${activeOrder.orderNumber} diubah menjadi ${newStatus}.`);
    } catch {
      notify('error', 'Gagal memperbarui status order.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Order Management"
        subtitle="Pusat kendali seluruh pekerjaan made-to-order mulai dari DP, pengadaan bahan (PO), jahit, hingga pemasangan selesai."
        action={
          <button
            type="button"
            onClick={() => {
              const first = customers[0];
              setForm({
                customerId: first?.id || '',
                projectName: '',
                installationAddress: first?.installationLocation || first?.address || '',
                orderDate: getJakartaTodayISO(),
                targetCompletionDate: addDaysISO(getJakartaTodayISO(), 14),
                targetInstallationDate: addDaysISO(getJakartaTodayISO(), 16),
                totalAmount: '',
                dpAmount: '',
                estimatedCost: '',
                status: 'New Order',
                notes: '',
              });
              setCreateOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1F3D2B] text-white text-sm font-medium hover:bg-[#172F21] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Order Baru
          </button>
        }
      />

      {/* Search & Status Filter */}
      <div className="bg-white border border-[#E5E2DA] rounded-xl p-4 mb-5 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#7D8580] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nomor order (mis. HI-2026-001), pelanggan, atau proyek..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E5E2DA] bg-[#F8F7F4] text-sm outline-none focus:border-[#1F3D2B]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
        >
          <option value="all">Semua Status ({orders.length})</option>
          {ORDER_WORKFLOW_STATUSES.map((st) => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="w-5 h-5" />}
          title="Belum ada order pelanggan"
          description="Konversi Quotation yang disetujui pelanggan menjadi Order atau buat order baru langsung di sini."
          actionLabel="Buat Order Pertama"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Orders List */}
          <div className="lg:col-span-4 bg-white border border-[#E5E2DA] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E5E2DA] bg-[#F8F7F4] text-xs font-semibold text-[#5A635D]">
              Daftar Order ({filtered.length})
            </div>
            <div className="divide-y divide-[#E5E2DA] max-h-[760px] overflow-y-auto">
              {filtered.map((o) => {
                const paid = paidByOrder[o.id] || 0;
                const active = activeOrder?.id === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSelectedOrderId(o.id)}
                    className={`w-full p-4 text-left transition-colors ${
                      active ? 'bg-[#F3ECE0]/55' : 'hover:bg-[#F8F7F4]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-[#846838]">{o.orderNumber}</span>
                      <StatusLabel status={o.status} />
                    </div>
                    <p className="font-semibold text-sm text-[#1F2421] mt-1">{o.customerName}</p>
                    <p className="text-xs text-[#5A635D] truncate">{o.projectName}</p>
                    <div className="mt-2 flex items-center justify-between text-xs font-mono tabular-nums">
                      <span className="text-[#1F2421] font-medium">{formatIDR(o.totalAmount)}</span>
                      <span className="text-[#5A635D]">Masuk: {formatIDR(paid)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Order Command Detail */}
          <div className="lg:col-span-8 space-y-5">
            {activeOrder && activeRelations && (
              <>
                <div className="bg-white border border-[#E5E2DA] rounded-xl p-5 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-[#E5E2DA]">
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-[#846838]">{activeOrder.orderNumber}</span>
                        <StatusLabel status={activeOrder.status} />
                        {activeOrder.quotationNumber && (
                          <span className="text-xs text-[#5A635D]">Ref: {activeOrder.quotationNumber}</span>
                        )}
                      </div>
                      <h2 className="font-display text-2xl font-semibold text-[#1F2421] mt-1">
                        {activeOrder.customerName} — {activeOrder.projectName}
                      </h2>
                      <p className="text-xs text-[#5A635D] mt-1">
                        Lokasi: {activeOrder.installationAddress || '-'} · Tgl Order: {formatDateID(activeOrder.orderDate)} · Target Pasang: {formatDateID(activeOrder.targetInstallationDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <WhatsAppLink
                        phone={activeOrder.customerWhatsapp}
                        message={WA_TEMPLATES.confirmOrder({
                          customerName: activeOrder.customerName,
                          orderNumber: activeOrder.orderNumber,
                          projectName: activeOrder.projectName,
                          totalAmount: activeOrder.totalAmount,
                          targetInstallation: activeOrder.targetInstallationDate,
                          businessName: settings.businessName,
                        })}
                        label="Konfirmasi WA"
                        compact
                      />
                      {activeRelations.remaining > 0 && (
                        <WhatsAppLink
                          phone={activeOrder.customerWhatsapp}
                          message={WA_TEMPLATES.paymentReminder({
                            customerName: activeOrder.customerName,
                            orderNumber: activeOrder.orderNumber,
                            projectName: activeOrder.projectName,
                            remainingAmount: activeRelations.remaining,
                            bankAccounts: settings.bankAccounts,
                            businessName: settings.businessName,
                          })}
                          label="Tagih WA"
                          compact
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(activeOrder)}
                        className="p-2 rounded-lg text-[#5A635D] hover:text-[#B53939] hover:bg-[#FDF2F2]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Financial Summary Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-b border-[#E5E2DA] text-xs">
                    <div>
                      <p className="text-[#5A635D]">Total Order</p>
                      <p className="font-mono font-semibold text-sm text-[#1F2421] tabular-nums mt-0.5">
                        {formatIDR(activeOrder.totalAmount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#5A635D]">Pembayaran Masuk</p>
                      <p className="font-mono font-semibold text-sm text-[#186037] tabular-nums mt-0.5">
                        {formatIDR(activeRelations.totalPaid)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#5A635D]">Sisa Piutang</p>
                      <p className="font-mono font-semibold text-sm text-[#9A600B] tabular-nums mt-0.5">
                        {formatIDR(activeRelations.remaining)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#5A635D]">Total PO Bahan/Vendor</p>
                      <p className="font-mono font-semibold text-sm text-[#1F3D2B] tabular-nums mt-0.5">
                        {formatIDR(activeRelations.totalPO)}
                      </p>
                    </div>
                  </div>

                  {/* Workflow Status Updater */}
                  <form onSubmit={handleUpdateStatus} className="pt-4 space-y-3">
                    <p className="text-xs font-semibold text-[#1F2421]">Perbarui Tahapan Workflow Order</p>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
                        className="sm:col-span-5 px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
                      >
                        {ORDER_WORKFLOW_STATUSES.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={statusNote}
                        onChange={(e) => setStatusNote(e.target.value)}
                        placeholder="Catatan perubahan status (opsional)"
                        className="sm:col-span-5 px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
                      />
                      <button
                        type="submit"
                        disabled={updatingStatus}
                        className="sm:col-span-2 px-3 py-2 rounded-lg bg-[#1F3D2B] text-white text-xs font-medium hover:bg-[#172F21] whitespace-nowrap"
                      >
                        {updatingStatus ? 'Menyimpan...' : 'Update'}
                      </button>
                    </div>
                  </form>

                  {/* Quick Operational Shortcuts */}
                  <div className="mt-4 pt-4 border-t border-[#E5E2DA] flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => navigateTo('procurement')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E2DA] text-xs font-medium text-[#1F2421] hover:bg-[#F8F7F4]"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 text-[#1F3D2B]" />
                      Purchase Order ({activeRelations.pos.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateTo('production')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E2DA] text-xs font-medium text-[#1F2421] hover:bg-[#F8F7F4]"
                    >
                      Produksi / Jahit ({activeRelations.jobs.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateTo('installations')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E2DA] text-xs font-medium text-[#1F2421] hover:bg-[#F8F7F4]"
                    >
                      <Wrench className="w-3.5 h-3.5 text-[#1F3D2B]" />
                      Pemasangan ({activeRelations.installs.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateTo('finance')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E2DA] text-xs font-medium text-[#1F2421] hover:bg-[#F8F7F4]"
                    >
                      <Wallet className="w-3.5 h-3.5 text-[#186037]" />
                      Catat Pembayaran ({activeRelations.pays.length})
                    </button>
                  </div>
                </div>

                {/* Linked POs & Items */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="bg-white border border-[#E5E2DA] rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-[#1F2421] mb-3">
                      Purchase Order Terkait ({activeRelations.pos.length})
                    </h3>
                    {activeRelations.pos.length === 0 ? (
                      <p className="text-xs text-[#5A635D]">
                        Belum ada PO ke supplier/workshop untuk order ini. Satu order dapat memiliki beberapa PO terpisah (kain, rel, jahit).
                      </p>
                    ) : (
                      <div className="divide-y divide-[#E5E2DA]">
                        {activeRelations.pos.map((po) => (
                          <button
                            key={po.id}
                            type="button"
                            onClick={() => navigateTo('procurement', po.id)}
                            className="w-full py-2.5 text-left hover:bg-[#F8F7F4] flex items-center justify-between gap-2"
                          >
                            <div>
                              <p className="text-xs font-semibold text-[#1F2421]">{po.poNumber} · {po.supplierName}</p>
                              <p className="text-xs font-mono text-[#5A635D]">{formatIDR(po.totalAmount)}</p>
                            </div>
                            <StatusLabel status={po.status} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Order Timeline */}
                  <div className="bg-white border border-[#E5E2DA] rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-[#1F2421] mb-3 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-[#846838]" />
                      Timeline Perjalanan Order
                    </h3>
                    {!activeOrder.timeline || activeOrder.timeline.length === 0 ? (
                      <p className="text-xs text-[#5A635D]">Belum ada riwayat perubahan status.</p>
                    ) : (
                      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                        {activeOrder.timeline.map((ev, idx) => (
                          <div key={idx} className="pb-2.5 border-b border-[#E5E2DA] last:border-0 last:pb-0">
                            <div className="flex items-center justify-between gap-2">
                              <StatusLabel status={ev.status} />
                              <span className="font-mono text-[11px] text-[#7D8580]">{formatDateID(ev.date)}</span>
                            </div>
                            <p className="text-xs text-[#1F2421] mt-1">{ev.note}</p>
                            <p className="text-[11px] text-[#7D8580] mt-0.5">Oleh: {ev.by}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Order Items from Quotation */}
                {activeOrder.items && activeOrder.items.length > 0 && (
                  <div className="bg-white border border-[#E5E2DA] rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-[#1F2421] mb-3">Detail Item Pesanan</h3>
                    <div className="divide-y divide-[#E5E2DA] text-xs">
                      {activeOrder.items.map((it) => (
                        <div key={it.id} className="py-2.5 flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-[#1F2421]">
                              {it.productType} {it.roomName ? `· ${it.roomName}` : ''} {it.windowName ? `(${it.windowName})` : ''}
                            </p>
                            <p className="text-[#5A635D]">
                              {it.widthCm && it.heightCm ? `${it.widthCm}×${it.heightCm} cm · ` : ''}
                              {it.specification || '-'}
                            </p>
                          </div>
                          <div className="text-right font-mono tabular-nums shrink-0">
                            <p className="font-semibold text-[#1F2421]">{formatIDR(it.subtotal)}</p>
                            <p className="text-[#5A635D]">{it.quantity} {it.unit}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Create Direct Order Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Buat Order Pelanggan Baru"
        subtitle="Atau konversi langsung dari modul Quotation agar seluruh rincian produk otomatis terbawa."
      >
        <form onSubmit={handleCreateOrder} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Pelanggan *</label>
              <select
                required
                value={form.customerId}
                onChange={(e) => {
                  const cust = customers.find((c) => c.id === e.target.value);
                  setForm({
                    ...form,
                    customerId: e.target.value,
                    installationAddress: cust?.installationLocation || cust?.address || form.installationAddress,
                  });
                }}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
              >
                <option value="">-- Pilih Pelanggan --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Nama Proyek *</label>
              <input
                type="text"
                required
                value={form.projectName}
                onChange={(e) => setForm({ ...form, projectName: e.target.value })}
                placeholder="Contoh: Gorden Apartemen Citraland"
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Total Nilai Order (IDR) *</label>
              <input
                type="number"
                required
                min="0"
                value={form.totalAmount}
                onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Target DP (IDR)</label>
              <input
                type="number"
                min="0"
                value={form.dpAmount}
                onChange={(e) => setForm({ ...form, dpAmount: e.target.value })}
                placeholder="Otomatis sesuai % DP jika kosong"
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Estimasi Modal / HPP (IDR)</label>
              <input
                type="number"
                min="0"
                value={form.estimatedCost}
                onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Status Awal</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as OrderStatus })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
              >
                {ORDER_WORKFLOW_STATUSES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Target Selesai Produksi</label>
              <input
                type="date"
                value={form.targetCompletionDate}
                onChange={(e) => setForm({ ...form, targetCompletionDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Target Pemasangan</label>
              <input
                type="date"
                value={form.targetInstallationDate}
                onChange={(e) => setForm({ ...form, targetInstallationDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Alamat Pemasangan</label>
            <input
              type="text"
              value={form.installationAddress}
              onChange={(e) => setForm({ ...form, installationAddress: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Catatan Order</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E5E2DA]">
            <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 rounded-lg border border-[#E5E2DA] text-sm">
              Batal
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-[#1F3D2B] text-white text-sm font-medium">
              {saving ? 'Menyimpan...' : 'Simpan Order'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Order?"
        message={`Hapus order "${deleteTarget?.orderNumber}"? Pastikan tidak ada PO atau pembayaran aktif yang masih dibutuhkan.`}
        confirmLabel="Hapus Order"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteRecord('orders', deleteTarget.id, {
            action: 'Order dihapus',
            entityType: 'order',
            summary: `Order ${deleteTarget.orderNumber} dihapus.`,
          });
          setSelectedOrderId(null);
          setDeleteTarget(null);
          notify('success', 'Order dihapus.');
        }}
      />
    </div>
  );
};
