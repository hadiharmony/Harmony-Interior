import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Edit3,
  FileSpreadsheet,
  Plus,
  Printer,
  Search,
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
  Quotation,
  QUOTATION_STATUSES,
  QuotationItem,
  QuotationRevisionEntry,
  QuotationStatus,
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

interface QuoteFormState {
  customerId: string;
  surveyId: string;
  projectName: string;
  quotationDate: string;
  validUntil: string;
  status: QuotationStatus;
  items: QuotationItem[];
  discount: number;
  surveyFee: number;
  installationFee: number;
  transportFee: number;
  additionalFee: number;
  dpPercentage: number;
  paymentTerms: string;
  notes: string;
  revisionNote: string;
}

const makeBlankItem = (defaultProduct: string): QuotationItem => ({
  id: `it-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  roomName: '',
  windowName: '',
  productType: defaultProduct,
  specification: '',
  widthCm: undefined,
  heightCm: undefined,
  quantity: 1,
  unit: 'set',
  unitPrice: 0,
  subtotal: 0,
});

export const QuotationsPage: React.FC = () => {
  const {
    quotations,
    customers,
    surveys,
    measurementAreas,
    orders,
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
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Quotation | null>(null);
  const [previewQuote, setPreviewQuote] = useState<Quotation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Quotation | null>(null);
  const [saving, setSaving] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const productOptions = settings.productCategories?.length
    ? settings.productCategories
    : ['Gorden Kain', 'Sheer / Vitrase', 'Blackout', 'Roller Blind', 'Rel / Track', 'Aksesoris'];

  const [form, setForm] = useState<QuoteFormState>({
    customerId: '',
    surveyId: '',
    projectName: '',
    quotationDate: getJakartaTodayISO(),
    validUntil: addDaysISO(getJakartaTodayISO(), 14),
    status: 'Draft',
    items: [makeBlankItem(productOptions[0])],
    discount: 0,
    surveyFee: 0,
    installationFee: 0,
    transportFee: 0,
    additionalFee: 0,
    dpPercentage: 50,
    paymentTerms: '',
    notes: '',
    revisionNote: '',
  });

  useEffect(() => {
    if (focusedRecordId) {
      const found = quotations.find((q) => q.id === focusedRecordId);
      if (found) setPreviewQuote(found);
      clearFocusedRecord();
    }
  }, [focusedRecordId, quotations, clearFocusedRecord]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return quotations.filter((qt) => {
      if (statusFilter !== 'all' && qt.status !== statusFilter) return false;
      if (!q) return true;
      return `${qt.quotationNumber} ${qt.customerName} ${qt.projectName}`.toLowerCase().includes(q);
    });
  }, [quotations, search, statusFilter]);

  const totals = useMemo(() => {
    const subtotal = form.items.reduce((sum, it) => sum + (it.quantity || 0) * (it.unitPrice || 0), 0);
    const totalAmount = Math.max(
      0,
      subtotal -
        (Number(form.discount) || 0) +
        (Number(form.surveyFee) || 0) +
        (Number(form.installationFee) || 0) +
        (Number(form.transportFee) || 0) +
        (Number(form.additionalFee) || 0)
    );
    const dpPct = Math.min(100, Math.max(0, Number(form.dpPercentage) || 0));
    const dpAmount = Math.round((totalAmount * dpPct) / 100);
    const remainingAmount = Math.max(0, totalAmount - dpAmount);
    return { subtotal, totalAmount, dpAmount, remainingAmount };
  }, [form]);

  const openCreate = () => {
    const today = getJakartaTodayISO();
    setEditing(null);
    setForm({
      customerId: customers[0]?.id || '',
      surveyId: '',
      projectName: '',
      quotationDate: today,
      validUntil: addDaysISO(today, settings.quotationValidityDays || 14),
      status: 'Draft',
      items: [makeBlankItem(productOptions[0])],
      discount: 0,
      surveyFee: 0,
      installationFee: 0,
      transportFee: 0,
      additionalFee: 0,
      dpPercentage: settings.defaultDpPercentage || 50,
      paymentTerms: settings.paymentTerms || '',
      notes: '',
      revisionNote: '',
    });
    setModalOpen(true);
  };

  const openEdit = (qt: Quotation) => {
    setEditing(qt);
    setForm({
      customerId: qt.customerId,
      surveyId: qt.surveyId || '',
      projectName: qt.projectName,
      quotationDate: qt.quotationDate,
      validUntil: qt.validUntil || addDaysISO(qt.quotationDate, settings.quotationValidityDays || 14),
      status: qt.status,
      items: qt.items && qt.items.length > 0 ? qt.items : [makeBlankItem(productOptions[0])],
      discount: qt.discount || 0,
      surveyFee: qt.surveyFee || 0,
      installationFee: qt.installationFee || 0,
      transportFee: qt.transportFee || 0,
      additionalFee: qt.additionalFee || 0,
      dpPercentage: qt.dpPercentage ?? settings.defaultDpPercentage ?? 50,
      paymentTerms: qt.paymentTerms || settings.paymentTerms || '',
      notes: qt.notes || '',
      revisionNote: '',
    });
    setModalOpen(true);
  };

  const handleImportFromSurvey = (surveyId: string) => {
    const srv = surveys.find((s) => s.id === surveyId);
    if (!srv) {
      setForm((f) => ({ ...f, surveyId: '' }));
      return;
    }
    const areas = measurementAreas.filter((m) => m.surveyId === surveyId);
    const imported: QuotationItem[] = areas.map((a, idx) => ({
      id: `srv-it-${idx + 1}-${Date.now()}`,
      roomName: a.roomName,
      windowName: a.windowName,
      productType: a.curtainType || productOptions[0],
      specification: [a.model, a.fabricType, a.color, a.railType ? `Rel: ${a.railType}` : '']
        .filter(Boolean)
        .join(', '),
      widthCm: a.widthCm,
      heightCm: a.heightCm,
      quantity: a.quantity,
      unit: 'set',
      unitPrice: 0,
      subtotal: 0,
    }));

    setForm((f) => ({
      ...f,
      surveyId,
      customerId: srv.customerId,
      projectName: srv.projectName || f.projectName,
      items: imported.length > 0 ? imported : f.items,
    }));
    notify('info', `${imported.length} baris pengukuran dari ${srv.surveyCode} dimuat.`);
  };

  const updateItem = (idx: number, patch: Partial<QuotationItem>) => {
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
    const cust = customers.find((c) => c.id === form.customerId);
    if (!cust) {
      notify('error', 'Pilih pelanggan terlebih dahulu.');
      return;
    }
    if (!form.projectName.trim()) {
      notify('error', 'Nama proyek wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      const sanitizedItems: QuotationItem[] = form.items.slice(0, 80).map((it) => ({
        ...it,
        quantity: Math.max(0, Number(it.quantity) || 0),
        unitPrice: Math.max(0, Number(it.unitPrice) || 0),
        subtotal: Math.max(0, (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)),
      }));

      const basePayload = {
        customerId: cust.id,
        customerName: cust.name,
        customerWhatsapp: cust.whatsapp,
        surveyId: form.surveyId || '',
        projectName: clampStr(form.projectName, 200),
        quotationDate: form.quotationDate,
        validUntil: form.validUntil,
        items: sanitizedItems,
        subtotal: totals.subtotal,
        discount: Math.max(0, Number(form.discount) || 0),
        surveyFee: Math.max(0, Number(form.surveyFee) || 0),
        installationFee: Math.max(0, Number(form.installationFee) || 0),
        transportFee: Math.max(0, Number(form.transportFee) || 0),
        additionalFee: Math.max(0, Number(form.additionalFee) || 0),
        totalAmount: totals.totalAmount,
        dpPercentage: Math.min(100, Math.max(0, Number(form.dpPercentage) || 0)),
        dpAmount: totals.dpAmount,
        remainingAmount: totals.remainingAmount,
        paymentTerms: clampStr(form.paymentTerms, 1000),
        notes: clampStr(form.notes, 2000),
        status: form.status,
      };

      if (editing) {
        const isRevision =
          form.status === 'Revision' ||
          editing.totalAmount !== totals.totalAmount ||
          Boolean(form.revisionNote.trim());
        const nextRev = isRevision ? (editing.revisionNumber || 1) + 1 : editing.revisionNumber || 1;
        const history: QuotationRevisionEntry[] = [...(editing.revisionHistory || [])];
        if (isRevision) {
          history.unshift({
            revision: nextRev,
            date: getJakartaTodayISO(),
            totalAmount: totals.totalAmount,
            note: clampStr(form.revisionNote || 'Penyesuaian item/harga quotation', 240),
            by: userProfile?.displayName || 'Pemilik',
          });
        }

        await updateRecord(
          'quotations',
          editing.id,
          { ...basePayload, revisionNumber: nextRev, revisionHistory: history.slice(0, 25) },
          {
            action: isRevision ? 'Quotation direvisi' : 'Quotation diperbarui',
            entityType: 'quotation',
            summary: `${editing.quotationNumber} (Rev ${nextRev}) — ${formatIDR(totals.totalAmount)}`,
          }
        );
        notify('success', `Quotation ${editing.quotationNumber} berhasil diperbarui.`);
      } else {
        const quotationNumber = generateCode(settings.quotationPrefix || 'QT', quotations.length);
        await createRecord(
          'quotations',
          {
            ...basePayload,
            quotationNumber,
            revisionNumber: 1,
            revisionHistory: [],
          },
          {
            action: 'Quotation dibuat',
            entityType: 'quotation',
            summary: `${quotationNumber} untuk ${cust.name} senilai ${formatIDR(totals.totalAmount)}.`,
          }
        );
        notify('success', `Quotation ${quotationNumber} berhasil dibuat.`);
      }
      setModalOpen(false);
    } catch {
      notify('error', 'Gagal menyimpan quotation.');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (qt: Quotation) => {
    const quotationNumber = generateCode(settings.quotationPrefix || 'QT', quotations.length);
    const today = getJakartaTodayISO();
    try {
      await createRecord(
        'quotations',
        {
          quotationNumber,
          customerId: qt.customerId,
          customerName: qt.customerName,
          customerWhatsapp: qt.customerWhatsapp || '',
          surveyId: qt.surveyId || '',
          projectName: `${qt.projectName} (Salinan)`.slice(0, 200),
          quotationDate: today,
          validUntil: addDaysISO(today, settings.quotationValidityDays || 14),
          revisionNumber: 1,
          items: qt.items || [],
          subtotal: qt.subtotal || 0,
          discount: qt.discount || 0,
          surveyFee: qt.surveyFee || 0,
          installationFee: qt.installationFee || 0,
          transportFee: qt.transportFee || 0,
          additionalFee: qt.additionalFee || 0,
          totalAmount: qt.totalAmount,
          dpPercentage: qt.dpPercentage ?? 50,
          dpAmount: qt.dpAmount || 0,
          remainingAmount: qt.remainingAmount || 0,
          paymentTerms: qt.paymentTerms || '',
          notes: qt.notes || '',
          status: 'Draft',
          revisionHistory: [],
        },
        {
          action: 'Quotation diduplikasi',
          entityType: 'quotation',
          summary: `${quotationNumber} diduplikasi dari ${qt.quotationNumber}.`,
        }
      );
      notify('success', `Quotation diduplikasi menjadi ${quotationNumber}.`);
    } catch {
      notify('error', 'Gagal menduplikasi quotation.');
    }
  };

  const handleConvertToOrder = async (qt: Quotation) => {
    if (qt.convertedOrderId) {
      navigateTo('orders', qt.convertedOrderId);
      return;
    }
    setConvertingId(qt.id);
    try {
      const cust = customers.find((c) => c.id === qt.customerId);
      const orderNumber = generateCode(settings.orderPrefix || 'HI', orders.length);
      const today = getJakartaTodayISO();
      const orderId = await createRecord(
        'orders',
        {
          orderNumber,
          customerId: qt.customerId,
          customerName: qt.customerName,
          customerWhatsapp: qt.customerWhatsapp || cust?.whatsapp || '',
          quotationId: qt.id,
          quotationNumber: qt.quotationNumber,
          surveyId: qt.surveyId || '',
          projectName: qt.projectName,
          installationAddress: cust?.installationLocation || cust?.address || '',
          orderDate: today,
          targetCompletionDate: addDaysISO(today, 14),
          targetInstallationDate: addDaysISO(today, 16),
          items: qt.items || [],
          totalAmount: qt.totalAmount,
          dpAmount: qt.dpAmount || 0,
          estimatedCost: Math.round((qt.totalAmount || 0) * 0.55),
          status: 'Waiting for DP',
          timeline: [
            {
              status: 'Waiting for DP',
              date: today,
              note: `Dikonversi dari ${qt.quotationNumber}. Menunggu pembayaran DP sebesar ${formatIDR(qt.dpAmount || 0)}.`,
              by: userProfile?.displayName || 'Pemilik',
            },
          ],
          notes: qt.notes || '',
        },
        {
          action: 'Order dibuat dari Quotation',
          entityType: 'order',
          summary: `Order ${orderNumber} dibuat dari ${qt.quotationNumber} (${qt.customerName}) senilai ${formatIDR(qt.totalAmount)}.`,
        }
      );

      await updateRecord('quotations', qt.id, {
        status: 'Approved',
        convertedOrderId: orderId,
      });

      notify('success', `Quotation dikonversi menjadi Order ${orderNumber}.`);
      setPreviewQuote(null);
      navigateTo('orders', orderId);
    } catch {
      notify('error', 'Gagal mengonversi quotation ke order.');
    } finally {
      setConvertingId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Estimasi & Quotation"
        subtitle="Susun penawaran harga multi-ruangan dan multi-produk, kelola revisi, cetak PDF, dan konversi menjadi Order."
        action={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1F3D2B] text-white text-sm font-medium hover:bg-[#172F21] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Buat Quotation
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
            placeholder="Cari nomor quotation, pelanggan, atau nama proyek..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E5E2DA] bg-[#F8F7F4] text-sm outline-none focus:border-[#1F3D2B]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
        >
          <option value="all">Semua Status ({quotations.length})</option>
          {QUOTATION_STATUSES.map((st) => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FileSpreadsheet className="w-5 h-5" />}
          title="Belum ada quotation"
          description="Buat penawaran harga baru atau impor langsung dari hasil survey pengukuran ruangan pelanggan."
          actionLabel="Buat Quotation Pertama"
          onAction={openCreate}
        />
      ) : (
        <div className="bg-white border border-[#E5E2DA] rounded-xl overflow-hidden">
          <div className="divide-y divide-[#E5E2DA]">
            {filtered.map((qt) => (
              <div
                key={qt.id}
                className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-[#F8F7F4]/50"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-[#846838]">
                      {qt.quotationNumber} {qt.revisionNumber && qt.revisionNumber > 1 ? `(Rev ${qt.revisionNumber})` : ''}
                    </span>
                    <StatusLabel status={qt.status} />
                    <span className="text-xs text-[#7D8580] font-mono">
                      {formatDateID(qt.quotationDate)} · Berlaku s/d {formatDateID(qt.validUntil)}
                    </span>
                  </div>
                  <h3 className="font-semibold text-[#1F2421]">
                    {qt.customerName} — {qt.projectName}
                  </h3>
                  <p className="text-xs text-[#5A635D]">
                    {qt.items?.length || 0} baris produk · Total{' '}
                    <strong className="font-mono text-[#1F2421] tabular-nums">{formatIDR(qt.totalAmount)}</strong> · DP{' '}
                    <span className="font-mono tabular-nums">{formatIDR(qt.dpAmount || 0)}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <WhatsAppLink
                    phone={qt.customerWhatsapp}
                    message={WA_TEMPLATES.sendQuotation({
                      customerName: qt.customerName,
                      quotationNumber: qt.quotationNumber,
                      projectName: qt.projectName,
                      totalAmount: qt.totalAmount,
                      dpAmount: qt.dpAmount || 0,
                      validUntil: qt.validUntil,
                      businessName: settings.businessName,
                    })}
                    label="Kirim WA"
                    compact
                  />
                  <button
                    type="button"
                    onClick={() => setPreviewQuote(qt)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E2DA] text-xs font-medium text-[#1F2421] hover:bg-[#F8F7F4]"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Preview / PDF
                  </button>
                  <button
                    type="button"
                    disabled={convertingId === qt.id}
                    onClick={() => handleConvertToOrder(qt)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1F3D2B] text-white text-xs font-medium hover:bg-[#172F21]"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {qt.convertedOrderId ? 'Lihat Order' : 'Jadikan Order'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(qt)}
                    title="Edit / Revisi"
                    className="p-2 rounded-lg text-[#5A635D] hover:text-[#1F3D2B] hover:bg-[#F8F7F4]"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicate(qt)}
                    title="Duplikasi"
                    className="p-2 rounded-lg text-[#5A635D] hover:text-[#1F3D2B] hover:bg-[#F8F7F4]"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(qt)}
                    title="Hapus"
                    className="p-2 rounded-lg text-[#5A635D] hover:text-[#B53939] hover:bg-[#FDF2F2]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quotation Builder Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit / Revisi ${editing.quotationNumber}` : 'Buat Quotation Baru'}
        subtitle="Tambahkan baris produk sesuai ruangan dan ukuran jendela. Jenis produk dapat dikustomisasi di Pengaturan."
        size="xl"
      >
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Pelanggan *</label>
              <select
                required
                disabled={Boolean(editing)}
                value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
              >
                <option value="">-- Pilih Pelanggan --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Impor dari Survey (Opsional)</label>
              <select
                value={form.surveyId}
                onChange={(e) => handleImportFromSurvey(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
              >
                <option value="">-- Tanpa Impor Survey --</option>
                {surveys.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.surveyCode} — {s.customerName} ({s.projectName})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Status Quotation</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as QuotationStatus })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
              >
                {QUOTATION_STATUSES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Nama Proyek *</label>
              <input
                type="text"
                required
                value={form.projectName}
                onChange={(e) => setForm({ ...form, projectName: e.target.value })}
                placeholder="Contoh: Gorden Rumah Pak Budi"
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Tanggal Quotation</label>
              <input
                type="date"
                value={form.quotationDate}
                onChange={(e) => setForm({ ...form, quotationDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Berlaku Sampai</label>
              <input
                type="date"
                value={form.validUntil}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#1F2421]">Rincian Produk &amp; Ruangan</h3>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, items: [...f.items, makeBlankItem(productOptions[0])] }))
                }
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#1F3D2B] text-[#1F3D2B] text-xs font-medium hover:bg-[#1F3D2B]/5"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Baris Produk
              </button>
            </div>

            <div className="space-y-3">
              {form.items.map((item, idx) => (
                <div key={item.id} className="p-3.5 rounded-lg bg-[#F8F7F4] border border-[#E5E2DA] space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    <input
                      type="text"
                      value={item.roomName}
                      onChange={(e) => updateItem(idx, { roomName: e.target.value })}
                      placeholder="Ruangan (mis. Ruang Tamu)"
                      className="px-2.5 py-1.5 rounded-md border border-[#E5E2DA] bg-white text-xs"
                    />
                    <input
                      type="text"
                      value={item.windowName}
                      onChange={(e) => updateItem(idx, { windowName: e.target.value })}
                      placeholder="Bidang (mis. Jendela A)"
                      className="px-2.5 py-1.5 rounded-md border border-[#E5E2DA] bg-white text-xs"
                    />
                    <select
                      value={item.productType}
                      onChange={(e) => updateItem(idx, { productType: e.target.value })}
                      className="px-2.5 py-1.5 rounded-md border border-[#E5E2DA] bg-white text-xs"
                    >
                      {productOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={item.specification}
                      onChange={(e) => updateItem(idx, { specification: e.target.value })}
                      placeholder="Spesifikasi kain, warna, rel..."
                      className="px-2.5 py-1.5 rounded-md border border-[#E5E2DA] bg-white text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 items-center">
                    <input
                      type="number"
                      min="0"
                      value={item.widthCm ?? ''}
                      onChange={(e) => updateItem(idx, { widthCm: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="Lebar (cm)"
                      className="px-2.5 py-1.5 rounded-md border border-[#E5E2DA] bg-white text-xs font-mono"
                    />
                    <input
                      type="number"
                      min="0"
                      value={item.heightCm ?? ''}
                      onChange={(e) => updateItem(idx, { heightCm: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="Tinggi (cm)"
                      className="px-2.5 py-1.5 rounded-md border border-[#E5E2DA] bg-white text-xs font-mono"
                    />
                    <input
                      type="number"
                      min="0.1"
                      step="any"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                      placeholder="Qty"
                      className="px-2.5 py-1.5 rounded-md border border-[#E5E2DA] bg-white text-xs font-mono"
                    />
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) => updateItem(idx, { unit: e.target.value })}
                      placeholder="Satuan (m / set)"
                      className="px-2.5 py-1.5 rounded-md border border-[#E5E2DA] bg-white text-xs"
                    />
                    <input
                      type="number"
                      min="0"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) })}
                      placeholder="Harga Satuan"
                      className="px-2.5 py-1.5 rounded-md border border-[#E5E2DA] bg-white text-xs font-mono"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-[#1F2421] tabular-nums">
                        {formatIDR(item.subtotal)}
                      </span>
                      {form.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
                          }
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
          </div>

          {/* Fees & Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            <div>
              <label className="block text-xs text-[#5A635D] mb-1">Diskon (IDR)</label>
              <input
                type="number"
                min="0"
                value={form.discount}
                onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[#E5E2DA] text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-[#5A635D] mb-1">Biaya Survey</label>
              <input
                type="number"
                min="0"
                value={form.surveyFee}
                onChange={(e) => setForm({ ...form, surveyFee: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[#E5E2DA] text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-[#5A635D] mb-1">Biaya Pasang</label>
              <input
                type="number"
                min="0"
                value={form.installationFee}
                onChange={(e) => setForm({ ...form, installationFee: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[#E5E2DA] text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-[#5A635D] mb-1">Transportasi</label>
              <input
                type="number"
                min="0"
                value={form.transportFee}
                onChange={(e) => setForm({ ...form, transportFee: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[#E5E2DA] text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-[#5A635D] mb-1">Biaya Tambahan</label>
              <input
                type="number"
                min="0"
                value={form.additionalFee}
                onChange={(e) => setForm({ ...form, additionalFee: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[#E5E2DA] text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-[#5A635D] mb-1">DP (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={form.dpPercentage}
                onChange={(e) => setForm({ ...form, dpPercentage: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[#E5E2DA] text-xs font-mono"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#F3ECE0]/50 border border-[#E5E2DA] grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <p className="text-[#5A635D]">Subtotal Produk</p>
              <p className="font-mono font-semibold text-sm text-[#1F2421] tabular-nums">{formatIDR(totals.subtotal)}</p>
            </div>
            <div>
              <p className="text-[#5A635D]">Total Penawaran</p>
              <p className="font-mono font-semibold text-sm text-[#1F3D2B] tabular-nums">{formatIDR(totals.totalAmount)}</p>
            </div>
            <div>
              <p className="text-[#5A635D]">DP ({form.dpPercentage}%)</p>
              <p className="font-mono font-semibold text-sm text-[#846838] tabular-nums">{formatIDR(totals.dpAmount)}</p>
            </div>
            <div>
              <p className="text-[#5A635D]">Sisa Pembayaran</p>
              <p className="font-mono font-semibold text-sm text-[#1F2421] tabular-nums">{formatIDR(totals.remainingAmount)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Syarat Pembayaran</label>
              <textarea
                rows={2}
                value={form.paymentTerms}
                onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Catatan Penawaran</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-xs"
              />
            </div>
          </div>

          {editing && (
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Catatan Revisi (opsional)</label>
              <input
                type="text"
                value={form.revisionNote}
                onChange={(e) => setForm({ ...form, revisionNote: e.target.value })}
                placeholder="Contoh: Ganti kain kamar utama ke seri Dimout"
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-xs"
              />
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E5E2DA]">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#E5E2DA] text-sm">
              Batal
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-[#1F3D2B] text-white text-sm font-medium">
              {saving ? 'Menyimpan...' : editing ? 'Simpan Revisi' : 'Simpan Quotation'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Printable Professional Quotation Preview */}
      {previewQuote && (
        <div className="fixed inset-0 z-50 bg-[#1F2421]/50 overflow-y-auto p-4">
          <div className="max-w-3xl mx-auto bg-white rounded-xl border border-[#E5E2DA] p-6 sm:p-9 print-sheet">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#E5E2DA] mb-6 no-print">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[#1F2421]">{previewQuote.quotationNumber}</span>
                <StatusLabel status={previewQuote.status} />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <WhatsAppLink
                  phone={previewQuote.customerWhatsapp}
                  message={WA_TEMPLATES.sendQuotation({
                    customerName: previewQuote.customerName,
                    quotationNumber: previewQuote.quotationNumber,
                    projectName: previewQuote.projectName,
                    totalAmount: previewQuote.totalAmount,
                    dpAmount: previewQuote.dpAmount || 0,
                    validUntil: previewQuote.validUntil,
                    businessName: settings.businessName,
                  })}
                  label="Bagikan WhatsApp"
                />
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1F3D2B] text-white text-xs font-medium"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak / Export PDF
                </button>
                <button
                  type="button"
                  onClick={() => handleConvertToOrder(previewQuote)}
                  className="px-3.5 py-2 rounded-lg border border-[#1F3D2B] text-[#1F3D2B] text-xs font-medium"
                >
                  {previewQuote.convertedOrderId ? 'Buka Order' : 'Konversi ke Order'}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewQuote(null)}
                  className="px-3 py-2 rounded-lg border border-[#E5E2DA] text-xs font-medium"
                >
                  Tutup
                </button>
              </div>
            </div>

            {/* Quotation Header */}
            <div className="flex justify-between items-start border-b border-[#E5E2DA] pb-5 mb-6">
              <div>
                <BrandWordmark />
                <p className="text-xs text-[#5A635D] mt-2">{settings.address || 'Custom Curtain & Window Treatment'}</p>
                {(settings.whatsapp || settings.email) && (
                  <p className="text-xs text-[#5A635D]">
                    {[settings.whatsapp ? `WA: ${settings.whatsapp}` : '', settings.email].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="font-display text-2xl font-semibold text-[#1F3D2B]">QUOTATION</p>
                <p className="font-mono text-xs font-semibold text-[#1F2421] mt-1">{previewQuote.quotationNumber}</p>
                <p className="text-xs text-[#5A635D]">Tanggal: {formatDateID(previewQuote.quotationDate)}</p>
                <p className="text-xs text-[#5A635D]">Berlaku s/d: {formatDateID(previewQuote.validUntil)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs mb-6">
              <div>
                <p className="text-[#5A635D]">Kepada Yth.</p>
                <p className="font-semibold text-sm text-[#1F2421] mt-0.5">{previewQuote.customerName}</p>
                <p className="text-[#5A635D] font-mono">{previewQuote.customerWhatsapp || '-'}</p>
              </div>
              <div>
                <p className="text-[#5A635D]">Nama Proyek</p>
                <p className="font-semibold text-sm text-[#1F2421] mt-0.5">{previewQuote.projectName}</p>
                <p className="text-[#5A635D]">Revisi ke-{previewQuote.revisionNumber || 1}</p>
              </div>
            </div>

            <table className="w-full text-left border-collapse text-xs mb-6">
              <thead>
                <tr className="border-y border-[#1F3D2B] text-[#1F3D2B]">
                  <th className="py-2 pr-2">Ruangan / Bidang</th>
                  <th className="py-2 pr-2">Produk &amp; Spesifikasi</th>
                  <th className="py-2 pr-2">Ukuran</th>
                  <th className="py-2 pr-2 text-right">Qty</th>
                  <th className="py-2 pr-2 text-right">Harga Satuan</th>
                  <th className="py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E2DA]">
                {(previewQuote.items || []).map((it) => (
                  <tr key={it.id}>
                    <td className="py-2.5 pr-2 font-medium text-[#1F2421]">
                      {[it.roomName, it.windowName].filter(Boolean).join(' — ') || '-'}
                    </td>
                    <td className="py-2.5 pr-2">
                      <p className="font-medium text-[#1F2421]">{it.productType}</p>
                      {it.specification && <p className="text-[#5A635D]">{it.specification}</p>}
                    </td>
                    <td className="py-2.5 pr-2 font-mono">
                      {it.widthCm && it.heightCm ? `${it.widthCm}×${it.heightCm} cm` : '-'}
                    </td>
                    <td className="py-2.5 pr-2 text-right font-mono tabular-nums">
                      {it.quantity} {it.unit}
                    </td>
                    <td className="py-2.5 pr-2 text-right font-mono tabular-nums">{formatIDR(it.unitPrice)}</td>
                    <td className="py-2.5 text-right font-mono font-medium tabular-nums">{formatIDR(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end mb-6">
              <div className="w-full max-w-xs space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#5A635D]">Subtotal</span>
                  <span className="font-mono tabular-nums">{formatIDR(previewQuote.subtotal)}</span>
                </div>
                {(previewQuote.discount || 0) > 0 && (
                  <div className="flex justify-between text-[#186037]">
                    <span>Diskon</span>
                    <span className="font-mono tabular-nums">- {formatIDR(previewQuote.discount)}</span>
                  </div>
                )}
                {(previewQuote.surveyFee || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#5A635D]">Biaya Survey</span>
                    <span className="font-mono tabular-nums">{formatIDR(previewQuote.surveyFee)}</span>
                  </div>
                )}
                {(previewQuote.installationFee || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#5A635D]">Biaya Pemasangan</span>
                    <span className="font-mono tabular-nums">{formatIDR(previewQuote.installationFee)}</span>
                  </div>
                )}
                {(previewQuote.transportFee || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#5A635D]">Biaya Transportasi</span>
                    <span className="font-mono tabular-nums">{formatIDR(previewQuote.transportFee)}</span>
                  </div>
                )}
                {(previewQuote.additionalFee || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#5A635D]">Biaya Tambahan</span>
                    <span className="font-mono tabular-nums">{formatIDR(previewQuote.additionalFee)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-[#1F3D2B] text-sm font-semibold text-[#1F3D2B]">
                  <span>Total Harga</span>
                  <span className="font-mono tabular-nums">{formatIDR(previewQuote.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-[#846838]">
                  <span>DP ({previewQuote.dpPercentage ?? 50}%)</span>
                  <span className="font-mono font-medium tabular-nums">{formatIDR(previewQuote.dpAmount)}</span>
                </div>
                <div className="flex justify-between text-[#5A635D]">
                  <span>Sisa Pembayaran</span>
                  <span className="font-mono tabular-nums">{formatIDR(previewQuote.remainingAmount)}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#E5E2DA] grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#5A635D]">
              <div>
                <p className="font-semibold text-[#1F2421] mb-1">Syarat Pembayaran</p>
                <p className="whitespace-pre-line">{previewQuote.paymentTerms || settings.paymentTerms}</p>
                {settings.bankAccounts && (
                  <div className="mt-2">
                    <p className="font-semibold text-[#1F2421]">Rekening Pembayaran</p>
                    <p className="whitespace-pre-line">{settings.bankAccounts}</p>
                  </div>
                )}
              </div>
              <div>
                <p className="font-semibold text-[#1F2421] mb-1">Catatan</p>
                <p className="whitespace-pre-line">{previewQuote.notes || '-'}</p>
              </div>
            </div>

            {previewQuote.revisionHistory && previewQuote.revisionHistory.length > 0 && (
              <div className="mt-6 pt-4 border-t border-[#E5E2DA] no-print">
                <p className="text-xs font-semibold text-[#1F2421] mb-2">Riwayat Revisi</p>
                <div className="space-y-1.5 text-xs text-[#5A635D]">
                  {previewQuote.revisionHistory.map((rev, i) => (
                    <div key={i} className="flex justify-between gap-2">
                      <span>Rev {rev.revision} ({formatDateID(rev.date)}) — {rev.note}</span>
                      <span className="font-mono">{formatIDR(rev.totalAmount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Quotation?"
        message={`Hapus quotation "${deleteTarget?.quotationNumber}"?`}
        confirmLabel="Hapus"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteRecord('quotations', deleteTarget.id, {
            action: 'Quotation dihapus',
            entityType: 'quotation',
            summary: `Quotation ${deleteTarget.quotationNumber} dihapus.`,
          });
          notify('success', 'Quotation dihapus.');
          setDeleteTarget(null);
        }}
      />
    </div>
  );
};
