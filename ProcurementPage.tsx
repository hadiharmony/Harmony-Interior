import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  Plus,
  Printer,
  Search,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import {
  BrandWordmark,
  ConfirmDialog,
  EmptyState,
  Modal,
  PageHeader,
  StatusLabel,
  WhatsAppLink,
} from '../components/common/UIPrimitives';
import { useAppData } from '../context/AppDataContext';
import {
  PO_STATUSES,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
} from '../types';
import {
  addDaysISO,
  clampStr,
  formatDateID,
  formatIDR,
  generateCode,
  getJakartaTodayISO,
  isDateOverdue,
  WA_TEMPLATES,
} from '../utils/formatters';

const blankPOItem = (): PurchaseOrderItem => ({
  id: `poi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  itemName: '',
  specification: '',
  color: '',
  size: '',
  quantity: 1,
  unit: 'meter',
  unitPrice: 0,
  subtotal: 0,
});

export const ProcurementPage: React.FC = () => {
  const {
    purchaseOrders,
    orders,
    suppliers,
    settings,
    createRecord,
    updateRecord,
    deleteRecord,
    notify,
    focusedRecordId,
    clearFocusedRecord,
  } = useAppData();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const [previewPO, setPreviewPO] = useState<PurchaseOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    orderId: '',
    supplierId: '',
    poDate: getJakartaTodayISO(),
    targetArrivalDate: addDaysISO(getJakartaTodayISO(), 7),
    status: 'Draft' as PurchaseOrderStatus,
    items: [blankPOItem()],
    shippingCost: 0,
    additionalCost: 0,
    paidAmount: 0,
    delayNotes: '',
    notes: '',
  });

  useEffect(() => {
    if (focusedRecordId) {
      const found = purchaseOrders.find((p) => p.id === focusedRecordId);
      if (found) setPreviewPO(found);
      clearFocusedRecord();
    }
  }, [focusedRecordId, purchaseOrders, clearFocusedRecord]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return purchaseOrders.filter((po) => {
      if (statusFilter !== 'all' && po.status !== statusFilter) return false;
      if (!q) return true;
      return `${po.poNumber} ${po.orderNumber} ${po.supplierName} ${po.customerName || ''}`
        .toLowerCase()
        .includes(q);
    });
  }, [purchaseOrders, search, statusFilter]);

  const totals = useMemo(() => {
    const subtotal = form.items.reduce((sum, it) => sum + (it.quantity || 0) * (it.unitPrice || 0), 0);
    const totalAmount = Math.max(
      0,
      subtotal + (Number(form.shippingCost) || 0) + (Number(form.additionalCost) || 0)
    );
    return { subtotal, totalAmount };
  }, [form]);

  const openCreate = () => {
    const today = getJakartaTodayISO();
    setEditing(null);
    setForm({
      orderId: orders[0]?.id || '',
      supplierId: suppliers[0]?.id || '',
      poDate: today,
      targetArrivalDate: addDaysISO(today, 7),
      status: 'Draft',
      items: [blankPOItem()],
      shippingCost: 0,
      additionalCost: 0,
      paidAmount: 0,
      delayNotes: '',
      notes: '',
    });
    setModalOpen(true);
  };

  const openEdit = (po: PurchaseOrder) => {
    setEditing(po);
    setForm({
      orderId: po.orderId,
      supplierId: po.supplierId,
      poDate: po.poDate,
      targetArrivalDate: po.targetArrivalDate || '',
      status: po.status,
      items: po.items && po.items.length > 0 ? po.items : [blankPOItem()],
      shippingCost: po.shippingCost || 0,
      additionalCost: po.additionalCost || 0,
      paidAmount: po.paidAmount || 0,
      delayNotes: po.delayNotes || '',
      notes: po.notes || '',
    });
    setModalOpen(true);
  };

  const updateItem = (idx: number, patch: Partial<PurchaseOrderItem>) => {
    setForm((prev) => {
      const next = [...prev.items];
      const merged = { ...next[idx], ...patch };
      merged.subtotal = (Number(merged.quantity) || 0) * (Number(merged.unitPrice) || 0);
      next[idx] = merged;
      return { ...prev, items: next };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const ord = orders.find((o) => o.id === form.orderId);
    const sup = suppliers.find((s) => s.id === form.supplierId);
    if (!ord || !sup) {
      notify('error', 'Order pelanggan dan Supplier wajib dipilih.');
      return;
    }

    setSaving(true);
    try {
      const cleanItems = form.items.slice(0, 60).map((it) => ({
        ...it,
        quantity: Math.max(0, Number(it.quantity) || 0),
        unitPrice: Math.max(0, Number(it.unitPrice) || 0),
        subtotal: Math.max(0, (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)),
      }));

      const payload = {
        orderId: ord.id,
        orderNumber: ord.orderNumber,
        customerName: ord.customerName,
        supplierId: sup.id,
        supplierName: sup.name,
        supplierWhatsapp: sup.whatsapp,
        poDate: form.poDate,
        targetArrivalDate: form.targetArrivalDate,
        items: cleanItems,
        subtotal: totals.subtotal,
        shippingCost: Math.max(0, Number(form.shippingCost) || 0),
        additionalCost: Math.max(0, Number(form.additionalCost) || 0),
        totalAmount: totals.totalAmount,
        paidAmount: Math.max(0, Number(form.paidAmount) || 0),
        status: form.status,
        delayNotes: clampStr(form.delayNotes, 1000),
        notes: clampStr(form.notes, 2000),
      };

      if (editing) {
        await updateRecord('purchaseOrders', editing.id, payload, {
          action: 'PO diperbarui',
          entityType: 'purchaseOrder',
          summary: `${editing.poNumber} (${sup.name}) diperbarui ke status ${payload.status}.`,
        });
        notify('success', `PO ${editing.poNumber} berhasil diperbarui.`);
      } else {
        const poNumber = generateCode(settings.poPrefix || 'PO', purchaseOrders.length);
        await createRecord(
          'purchaseOrders',
          { ...payload, poNumber, receivedDate: '' },
          {
            action: 'Purchase Order dibuat',
            entityType: 'purchaseOrder',
            summary: `${poNumber} ke ${sup.name} untuk Order ${ord.orderNumber} senilai ${formatIDR(totals.totalAmount)}.`,
          }
        );
        notify('success', `Purchase Order ${poNumber} berhasil dibuat.`);
      }
      setModalOpen(false);
    } catch {
      notify('error', 'Gagal menyimpan Purchase Order.');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkReceived = async (po: PurchaseOrder) => {
    try {
      const today = getJakartaTodayISO();
      await updateRecord(
        'purchaseOrders',
        po.id,
        { status: 'Received', receivedDate: today },
        {
          action: 'Barang PO diterima untuk Order',
          entityType: 'purchaseOrder',
          summary: `Material ${po.poNumber} dari ${po.supplierName} diterima untuk Order ${po.orderNumber}.`,
        }
      );
      notify('success', `Penerimaan barang ${po.poNumber} untuk Order ${po.orderNumber} tercatat.`);
    } catch {
      notify('error', 'Gagal mencatat penerimaan barang.');
    }
  };

  const buildItemsSummary = (po: PurchaseOrder) =>
    (po.items || [])
      .map((i) => `- ${i.itemName} (${[i.color, i.size, i.specification].filter(Boolean).join(', ')}) x ${i.quantity} ${i.unit}`)
      .join('\n') || '-';

  return (
    <div>
      <PageHeader
        title="Procurement & Purchase Order"
        subtitle="Pengadaan bahan berbasis pesanan pelanggan (made-to-order). Satu order dapat memiliki beberapa PO ke supplier atau workshop berbeda."
        action={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1F3D2B] text-white text-sm font-medium hover:bg-[#172F21] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Buat Purchase Order
          </button>
        }
      />

      <div className="bg-white border border-[#E5E2DA] rounded-xl p-4 mb-5 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#7D8580] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nomor PO, nomor order pelanggan, atau nama supplier..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E5E2DA] bg-[#F8F7F4] text-sm outline-none focus:border-[#1F3D2B]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
        >
          <option value="all">Semua Status PO ({purchaseOrders.length})</option>
          {PO_STATUSES.map((st) => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="w-5 h-5" />}
          title="Belum ada Purchase Order"
          description="Terbitkan PO kain, rel, aksesoris, atau jasa jahit langsung untuk setiap Order pelanggan yang telah dikonfirmasi."
          actionLabel="Buat PO Pertama"
          onAction={openCreate}
        />
      ) : (
        <div className="bg-white border border-[#E5E2DA] rounded-xl overflow-hidden divide-y divide-[#E5E2DA]">
          {filtered.map((po) => {
            const overdue = !['Received', 'Cancelled'].includes(po.status) && isDateOverdue(po.targetArrivalDate);
            const unpaid = Math.max(0, (po.totalAmount || 0) - (po.paidAmount || 0));
            return (
              <div key={po.id} className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-[#F8F7F4]/50">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-[#846838]">{po.poNumber}</span>
                    <StatusLabel status={po.status} />
                    <span className="text-xs text-[#5A635D]">
                      Order <strong className="font-mono text-[#1F2421]">{po.orderNumber}</strong> ({po.customerName})
                    </span>
                  </div>
                  <h3 className="font-semibold text-[#1F2421]">{po.supplierName}</h3>
                  <p className="text-xs text-[#5A635D]">
                    Total <strong className="font-mono text-[#1F2421] tabular-nums">{formatIDR(po.totalAmount)}</strong>
                    {unpaid > 0 && (
                      <> · Sisa bayar supplier <span className="font-mono text-[#9A600B]">{formatIDR(unpaid)}</span></>
                    )}
                    {' · '}Target tiba:{' '}
                    <span className={`font-mono ${overdue ? 'text-[#B53939] font-semibold' : ''}`}>
                      {formatDateID(po.targetArrivalDate)} {overdue ? '(Terlambat)' : ''}
                    </span>
                    {po.receivedDate && ` · Diterima ${formatDateID(po.receivedDate)}`}
                  </p>
                  {po.delayNotes && (
                    <p className="text-xs text-[#962B2B]">Catatan keterlambatan: {po.delayNotes}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <WhatsAppLink
                    phone={po.supplierWhatsapp}
                    message={WA_TEMPLATES.sendPOToSupplier({
                      supplierName: po.supplierName,
                      poNumber: po.poNumber,
                      orderNumber: po.orderNumber,
                      targetArrival: po.targetArrivalDate,
                      itemsSummary: buildItemsSummary(po),
                      totalAmount: po.totalAmount,
                      businessName: settings.businessName,
                    })}
                    label="WA Supplier"
                    compact
                  />
                  {!['Received', 'Cancelled'].includes(po.status) && (
                    <button
                      type="button"
                      onClick={() => handleMarkReceived(po)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1F3D2B] text-white text-xs font-medium hover:bg-[#172F21]"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Terima Barang
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPreviewPO(po)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#E5E2DA] text-xs font-medium text-[#1F2421]"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    PO PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(po)}
                    className="p-2 rounded-lg text-[#5A635D] hover:text-[#1F3D2B] hover:bg-[#F8F7F4]"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(po)}
                    className="p-2 rounded-lg text-[#5A635D] hover:text-[#B53939] hover:bg-[#FDF2F2]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PO Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.poNumber}` : 'Buat Purchase Order (Berbasis Order Pelanggan)'}
        subtitle="Barang yang diterima langsung dicatat untuk order terkait — tidak dimasukkan ke stok gudang."
        size="xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Order Pelanggan *</label>
              <select
                required
                disabled={Boolean(editing)}
                value={form.orderId}
                onChange={(e) => setForm({ ...form, orderId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
              >
                <option value="">-- Pilih Order --</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber} — {o.customerName} ({o.projectName})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Supplier / Workshop *</label>
              <select
                required
                disabled={Boolean(editing)}
                value={form.supplierId}
                onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
              >
                <option value="">-- Pilih Supplier --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.category})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Tanggal PO</label>
              <input
                type="date"
                value={form.poDate}
                onChange={(e) => setForm({ ...form, poDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Target Kedatangan</label>
              <input
                type="date"
                value={form.targetArrivalDate}
                onChange={(e) => setForm({ ...form, targetArrivalDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Status PO</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as PurchaseOrderStatus })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
              >
                {PO_STATUSES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
          </div>

          {/* PO Items */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-[#1F2421]">Detail Bahan / Jasa yang Dipesan</h4>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, items: [...f.items, blankPOItem()] }))}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#1F3D2B] text-[#1F3D2B] text-xs font-medium"
              >
                <Plus className="w-3 h-3" />
                Tambah Baris
              </button>
            </div>

            {form.items.map((it, idx) => (
              <div key={it.id} className="p-3 rounded-lg bg-[#F8F7F4] border border-[#E5E2DA] space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    required
                    value={it.itemName}
                    onChange={(e) => updateItem(idx, { itemName: e.target.value })}
                    placeholder="Nama barang (mis. Kain Blackout)"
                    className="px-2.5 py-1.5 rounded-md border border-[#E5E2DA] bg-white text-xs"
                  />
                  <input
                    type="text"
                    value={it.specification}
                    onChange={(e) => updateItem(idx, { specification: e.target.value })}
                    placeholder="Kode / Seri / Spesifikasi"
                    className="px-2.5 py-1.5 rounded-md border border-[#E5E2DA] bg-white text-xs"
                  />
                  <input
                    type="text"
                    value={it.color}
                    onChange={(e) => updateItem(idx, { color: e.target.value })}
                    placeholder="Warna"
                    className="px-2.5 py-1.5 rounded-md border border-[#E5E2DA] bg-white text-xs"
                  />
                  <input
                    type="text"
                    value={it.size}
                    onChange={(e) => updateItem(idx, { size: e.target.value })}
                    placeholder="Ukuran / Lebar kain"
                    className="px-2.5 py-1.5 rounded-md border border-[#E5E2DA] bg-white text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    value={it.quantity}
                    onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                    placeholder="Qty"
                    className="px-2.5 py-1.5 rounded-md border border-[#E5E2DA] bg-white text-xs font-mono"
                  />
                  <input
                    type="text"
                    value={it.unit}
                    onChange={(e) => updateItem(idx, { unit: e.target.value })}
                    placeholder="Satuan (meter / batang / pcs)"
                    className="px-2.5 py-1.5 rounded-md border border-[#E5E2DA] bg-white text-xs"
                  />
                  <input
                    type="number"
                    min="0"
                    value={it.unitPrice}
                    onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) })}
                    placeholder="Harga Beli Satuan"
                    className="px-2.5 py-1.5 rounded-md border border-[#E5E2DA] bg-white text-xs font-mono"
                  />
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold tabular-nums">{formatIDR(it.subtotal)}</span>
                    {form.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}
                        className="p-1 text-[#B53939]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-[#5A635D] mb-1">Ongkir (IDR)</label>
              <input
                type="number"
                min="0"
                value={form.shippingCost}
                onChange={(e) => setForm({ ...form, shippingCost: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[#E5E2DA] text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-[#5A635D] mb-1">Biaya Tambahan</label>
              <input
                type="number"
                min="0"
                value={form.additionalCost}
                onChange={(e) => setForm({ ...form, additionalCost: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[#E5E2DA] text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-[#5A635D] mb-1">Sudah Dibayar ke Supplier</label>
              <input
                type="number"
                min="0"
                value={form.paidAmount}
                onChange={(e) => setForm({ ...form, paidAmount: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[#E5E2DA] text-xs font-mono"
              />
            </div>
            <div className="p-2.5 rounded-lg bg-[#F3ECE0]/60 border border-[#E5E2DA]">
              <p className="text-[11px] text-[#5A635D]">Total PO</p>
              <p className="font-mono text-sm font-semibold text-[#1F3D2B] tabular-nums">{formatIDR(totals.totalAmount)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Catatan Keterlambatan (jika ada)</label>
              <input
                type="text"
                value={form.delayNotes}
                onChange={(e) => setForm({ ...form, delayNotes: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Catatan PO</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E5E2DA]">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#E5E2DA] text-sm">
              Batal
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-[#1F3D2B] text-white text-sm font-medium">
              {saving ? 'Menyimpan...' : 'Simpan Purchase Order'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Printable PO Preview */}
      {previewPO && (
        <div className="fixed inset-0 z-50 bg-[#1F2421]/50 overflow-y-auto p-4">
          <div className="max-w-3xl mx-auto bg-white rounded-xl border border-[#E5E2DA] p-6 sm:p-8 print-sheet">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#E5E2DA] mb-6 no-print">
              <span className="text-sm font-semibold">{previewPO.poNumber}</span>
              <div className="flex items-center gap-2">
                <WhatsAppLink
                  phone={previewPO.supplierWhatsapp}
                  message={WA_TEMPLATES.sendPOToSupplier({
                    supplierName: previewPO.supplierName,
                    poNumber: previewPO.poNumber,
                    orderNumber: previewPO.orderNumber,
                    targetArrival: previewPO.targetArrivalDate,
                    itemsSummary: buildItemsSummary(previewPO),
                    totalAmount: previewPO.totalAmount,
                    businessName: settings.businessName,
                  })}
                  label="Kirim ke WA Supplier"
                />
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1F3D2B] text-white text-xs font-medium"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak / PDF
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewPO(null)}
                  className="px-3 py-2 rounded-lg border border-[#E5E2DA] text-xs font-medium"
                >
                  Tutup
                </button>
              </div>
            </div>

            <div className="flex justify-between items-start border-b border-[#E5E2DA] pb-4 mb-5">
              <div>
                <BrandWordmark />
                <p className="text-xs text-[#5A635D] mt-1">{settings.address || '-'}</p>
              </div>
              <div className="text-right">
                <p className="font-display text-xl font-semibold text-[#1F3D2B]">PURCHASE ORDER</p>
                <p className="font-mono text-xs font-semibold">{previewPO.poNumber}</p>
                <p className="text-xs text-[#5A635D]">Tgl PO: {formatDateID(previewPO.poDate)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs mb-5">
              <div>
                <p className="text-[#5A635D]">Supplier</p>
                <p className="font-semibold text-sm text-[#1F2421]">{previewPO.supplierName}</p>
                <p className="font-mono text-[#5A635D]">{previewPO.supplierWhatsapp || '-'}</p>
              </div>
              <div>
                <p className="text-[#5A635D]">Referensi Order Pelanggan</p>
                <p className="font-mono font-semibold text-[#1F2421]">{previewPO.orderNumber}</p>
                <p className="text-[#5A635D]">Target Tiba: {formatDateID(previewPO.targetArrivalDate)}</p>
              </div>
            </div>

            <table className="w-full text-left border-collapse text-xs mb-5">
              <thead>
                <tr className="border-y border-[#1F3D2B] text-[#1F3D2B]">
                  <th className="py-2 pr-2">Barang &amp; Spesifikasi</th>
                  <th className="py-2 pr-2">Warna / Ukuran</th>
                  <th className="py-2 pr-2 text-right">Qty</th>
                  <th className="py-2 pr-2 text-right">Harga Beli</th>
                  <th className="py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E2DA]">
                {(previewPO.items || []).map((it) => (
                  <tr key={it.id}>
                    <td className="py-2 pr-2">
                      <p className="font-medium text-[#1F2421]">{it.itemName}</p>
                      {it.specification && <p className="text-[#5A635D]">{it.specification}</p>}
                    </td>
                    <td className="py-2 pr-2">{[it.color, it.size].filter(Boolean).join(' · ') || '-'}</td>
                    <td className="py-2 pr-2 text-right font-mono">{it.quantity} {it.unit}</td>
                    <td className="py-2 pr-2 text-right font-mono">{formatIDR(it.unitPrice)}</td>
                    <td className="py-2 text-right font-mono font-medium">{formatIDR(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end text-xs">
              <div className="w-full max-w-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#5A635D]">Subtotal</span>
                  <span className="font-mono">{formatIDR(previewPO.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5A635D]">Ongkir &amp; Tambahan</span>
                  <span className="font-mono">{formatIDR((previewPO.shippingCost || 0) + (previewPO.additionalCost || 0))}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#1F3D2B] font-semibold text-sm text-[#1F3D2B]">
                  <span>Total PO</span>
                  <span className="font-mono">{formatIDR(previewPO.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Purchase Order?"
        message={`Hapus PO "${deleteTarget?.poNumber}"?`}
        confirmLabel="Hapus PO"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteRecord('purchaseOrders', deleteTarget.id, {
            action: 'PO dihapus',
            entityType: 'purchaseOrder',
            summary: `PO ${deleteTarget.poNumber} dihapus.`,
          });
          notify('success', 'Purchase Order dihapus.');
          setDeleteTarget(null);
        }}
      />
    </div>
  );
};
