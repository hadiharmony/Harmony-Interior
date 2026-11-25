import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Edit3,
  Eye,
  Plus,
  Search,
  Trash2,
  Users,
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
import { Customer, LeadSource, PropertyType } from '../types';
import {
  clampStr,
  formatDateID,
  formatIDR,
  generateCode,
  getJakartaTodayISO,
  normalizePhone,
  WA_TEMPLATES,
} from '../utils/formatters';

const PROPERTY_TYPES: PropertyType[] = ['rumah', 'apartemen', 'kantor', 'hotel', 'lainnya'];
const LEAD_SOURCES: LeadSource[] = ['Instagram', 'WhatsApp', 'Referral', 'Walk-in', 'Lainnya'];

interface CustomerFormState {
  name: string;
  whatsapp: string;
  altPhone: string;
  email: string;
  address: string;
  city: string;
  installationLocation: string;
  propertyType: PropertyType;
  source: LeadSource;
  firstContactDate: string;
  notes: string;
}

const emptyForm = (): CustomerFormState => ({
  name: '',
  whatsapp: '',
  altPhone: '',
  email: '',
  address: '',
  city: '',
  installationLocation: '',
  propertyType: 'rumah',
  source: 'WhatsApp',
  firstContactDate: getJakartaTodayISO(),
  notes: '',
});

export const CustomersPage: React.FC = () => {
  const {
    customers,
    quotations,
    orders,
    payments,
    surveys,
    settings,
    createRecord,
    updateRecord,
    deleteRecord,
    notify,
    focusedRecordId,
    clearFocusedRecord,
    navigateTo,
  } = useAppData();

  const [search, setSearch] = useState('');
  const [filterProperty, setFilterProperty] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerFormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<Customer | null>(null);
  const [allowDuplicateOnce, setAllowDuplicateOnce] = useState(false);

  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (focusedRecordId) {
      const found = customers.find((c) => c.id === focusedRecordId);
      if (found) setDetailCustomer(found);
      clearFocusedRecord();
    }
  }, [focusedRecordId, customers, clearFocusedRecord]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (filterProperty !== 'all' && c.propertyType !== filterProperty) return false;
      if (filterSource !== 'all' && c.source !== filterSource) return false;
      if (!q) return true;
      return `${c.customerCode} ${c.name} ${c.whatsapp} ${c.city || ''} ${c.address || ''}`
        .toLowerCase()
        .includes(q);
    });
  }, [customers, search, filterProperty, filterSource]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDuplicateWarning(null);
    setAllowDuplicateOnce(false);
    setModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      name: c.name,
      whatsapp: c.whatsapp,
      altPhone: c.altPhone || '',
      email: c.email || '',
      address: c.address || '',
      city: c.city || '',
      installationLocation: c.installationLocation || '',
      propertyType: c.propertyType,
      source: c.source,
      firstContactDate: c.firstContactDate || getJakartaTodayISO(),
      notes: c.notes || '',
    });
    setDuplicateWarning(null);
    setAllowDuplicateOnce(false);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.whatsapp.trim()) {
      notify('error', 'Nama pelanggan dan nomor WhatsApp wajib diisi.');
      return;
    }

    // Duplicate detection on WhatsApp / exact name
    const targetPhone = normalizePhone(form.whatsapp);
    const existingDup = customers.find(
      (c) =>
        c.id !== editing?.id &&
        ((targetPhone && normalizePhone(c.whatsapp) === targetPhone) ||
          c.name.trim().toLowerCase() === form.name.trim().toLowerCase())
    );

    if (existingDup && !allowDuplicateOnce) {
      setDuplicateWarning(existingDup);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: clampStr(form.name, 160),
        whatsapp: clampStr(form.whatsapp, 40),
        altPhone: clampStr(form.altPhone, 40),
        email: clampStr(form.email, 200),
        address: clampStr(form.address, 500),
        city: clampStr(form.city, 100),
        installationLocation: clampStr(form.installationLocation, 500),
        propertyType: form.propertyType,
        source: form.source,
        firstContactDate: clampStr(form.firstContactDate, 30),
        notes: clampStr(form.notes, 2000),
      };

      if (editing) {
        await updateRecord('customers', editing.id, payload, {
          action: 'Pelanggan diperbarui',
          entityType: 'customer',
          summary: `Data pelanggan ${payload.name} (${editing.customerCode}) diperbarui.`,
        });
        notify('success', 'Data pelanggan berhasil diperbarui.');
      } else {
        const customerCode = generateCode('CUST', customers.length);
        await createRecord(
          'customers',
          { ...payload, customerCode },
          {
            action: 'Pelanggan dibuat',
            entityType: 'customer',
            summary: `Pelanggan baru ${payload.name} (${customerCode}) ditambahkan.`,
          }
        );
        notify('success', `Pelanggan ${payload.name} berhasil ditambahkan.`);
      }
      setModalOpen(false);
    } catch {
      notify('error', 'Gagal menyimpan data pelanggan.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const hasOrders = orders.some((o) => o.customerId === deleteTarget.id);
    if (hasOrders) {
      notify('error', 'Pelanggan ini memiliki riwayat order. Hapus atau arsipkan order terkait terlebih dahulu.');
      setDeleteTarget(null);
      return;
    }
    setDeleting(true);
    try {
      await deleteRecord('customers', deleteTarget.id, {
        action: 'Pelanggan dihapus',
        entityType: 'customer',
        summary: `Pelanggan ${deleteTarget.name} (${deleteTarget.customerCode}) dihapus.`,
      });
      notify('success', 'Data pelanggan dihapus.');
      if (detailCustomer?.id === deleteTarget.id) setDetailCustomer(null);
      setDeleteTarget(null);
    } catch {
      notify('error', 'Gagal menghapus pelanggan.');
    } finally {
      setDeleting(false);
    }
  };

  // Linked history for selected customer detail
  const detailHistory = useMemo(() => {
    if (!detailCustomer) return null;
    const custOrders = orders.filter((o) => o.customerId === detailCustomer.id);
    const custQuotes = quotations.filter((q) => q.customerId === detailCustomer.id);
    const custSurveys = surveys.filter((s) => s.customerId === detailCustomer.id);
    const custOrderIds = new Set(custOrders.map((o) => o.id));
    const custPayments = payments.filter(
      (p) => p.customerId === detailCustomer.id || custOrderIds.has(p.orderId)
    );
    return { custOrders, custQuotes, custSurveys, custPayments };
  }, [detailCustomer, orders, quotations, surveys, payments]);

  return (
    <div>
      <PageHeader
        title="Manajemen Pelanggan (CRM)"
        subtitle="Kelola profil pelanggan, lokasi pemasangan, sumber prospek, serta riwayat survey, quotation, dan order."
        action={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1F3D2B] text-white text-sm font-medium hover:bg-[#172F21] transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Tambah Pelanggan
          </button>
        }
      />

      {/* Search & Filters */}
      <div className="bg-white border border-[#E5E2DA] rounded-xl p-4 mb-5 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#7D8580] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, nomor WhatsApp, kode pelanggan, atau kota..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E5E2DA] bg-[#F8F7F4] text-sm outline-none focus:border-[#1F3D2B]"
          />
        </div>
        <div className="flex flex-wrap gap-2.5">
          <select
            value={filterProperty}
            onChange={(e) => setFilterProperty(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm text-[#1F2421] outline-none focus:border-[#1F3D2B]"
          >
            <option value="all">Semua Properti</option>
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t} className="capitalize">
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm text-[#1F2421] outline-none focus:border-[#1F3D2B]"
          >
            <option value="all">Semua Sumber</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Customer List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="w-5 h-5" />}
          title={customers.length === 0 ? 'Belum ada data pelanggan' : 'Tidak ada pelanggan yang sesuai filter'}
          description={
            customers.length === 0
              ? 'Mulai tambahkan data pelanggan pertama Anda atau konversi dari calon pelanggan (Leads).'
              : 'Ubah kata kunci pencarian atau filter untuk melihat pelanggan lainnya.'
          }
          actionLabel={customers.length === 0 ? 'Tambah Pelanggan Pertama' : undefined}
          onAction={customers.length === 0 ? openCreate : undefined}
        />
      ) : (
        <div className="bg-white border border-[#E5E2DA] rounded-xl overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5E2DA] bg-[#F8F7F4] text-xs font-medium text-[#5A635D]">
                  <th className="py-3 px-4">Pelanggan</th>
                  <th className="py-3 px-4">WhatsApp &amp; Kota</th>
                  <th className="py-3 px-4">Properti &amp; Sumber</th>
                  <th className="py-3 px-4">Kontak Awal</th>
                  <th className="py-3 px-4 text-right">Total Order</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E2DA] text-sm">
                {filtered.map((c) => {
                  const orderCount = orders.filter((o) => o.customerId === c.id).length;
                  return (
                    <tr key={c.id} className="hover:bg-[#F8F7F4]/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-[#1F2421]">{c.name}</p>
                        <p className="text-xs font-mono text-[#5A635D]">{c.customerCode}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-mono text-xs text-[#1F2421] tabular-nums">{c.whatsapp}</p>
                        <p className="text-xs text-[#5A635D]">{c.city || '-'}</p>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#5A635D]">
                        <span className="capitalize text-[#1F2421]">{c.propertyType}</span>
                        <span className="mx-1.5" aria-hidden="true">·</span>
                        <span>{c.source}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-[#5A635D] tabular-nums">
                        {formatDateID(c.firstContactDate)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-xs font-medium text-[#1F2421] tabular-nums">
                        {orderCount}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <WhatsAppLink
                            phone={c.whatsapp}
                            message={WA_TEMPLATES.customerGreeting(c.name, settings.businessName)}
                            compact
                          />
                          <button
                            type="button"
                            onClick={() => setDetailCustomer(c)}
                            title="Lihat Detail"
                            className="p-2 rounded-lg text-[#5A635D] hover:text-[#1F3D2B] hover:bg-[#F8F7F4]"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(c)}
                            title="Edit"
                            className="p-2 rounded-lg text-[#5A635D] hover:text-[#1F3D2B] hover:bg-[#F8F7F4]"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(c)}
                            title="Hapus"
                            className="p-2 rounded-lg text-[#5A635D] hover:text-[#B53939] hover:bg-[#FDF2F2]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden divide-y divide-[#E5E2DA]">
            {filtered.map((c) => (
              <div key={c.id} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[#1F2421]">{c.name}</p>
                    <p className="text-xs text-[#5A635D] mt-0.5">
                      <span className="font-mono">{c.customerCode}</span> · {c.whatsapp}
                    </p>
                  </div>
                  <span className="text-xs capitalize text-[#5A635D]">{c.propertyType}</span>
                </div>
                <p className="text-xs text-[#5A635D]">{c.installationLocation || c.address || c.city || 'Alamat belum dilengkapi'}</p>
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <WhatsAppLink
                    phone={c.whatsapp}
                    message={WA_TEMPLATES.customerGreeting(c.name, settings.businessName)}
                    compact
                  />
                  <button
                    type="button"
                    onClick={() => setDetailCustomer(c)}
                    className="px-2.5 py-1.5 rounded-lg border border-[#E5E2DA] text-xs font-medium text-[#1F2421]"
                  >
                    Detail
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(c)}
                    className="px-2.5 py-1.5 rounded-lg border border-[#E5E2DA] text-xs font-medium text-[#5A635D]"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Data Pelanggan' : 'Tambah Pelanggan Baru'}
        subtitle="Sistem otomatis memeriksa duplikasi nomor WhatsApp sebelum menyimpan."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {duplicateWarning && (
            <div className="p-4 rounded-lg bg-[#FFF8EB] border border-[#E5C687] text-sm text-[#7A4B08]">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Peringatan Duplikasi Pelanggan</p>
                  <p className="text-xs mt-1">
                    Pelanggan <strong>{duplicateWarning.name}</strong> ({duplicateWarning.customerCode}) dengan nomor{' '}
                    <span className="font-mono">{duplicateWarning.whatsapp}</span> sudah terdaftar.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setModalOpen(false);
                        setDetailCustomer(duplicateWarning);
                      }}
                      className="px-3 py-1.5 rounded-md bg-white border border-[#E5C687] text-xs font-medium text-[#1F2421]"
                    >
                      Buka Data yang Ada
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllowDuplicateOnce(true)}
                      className="px-3 py-1.5 rounded-md bg-[#9A600B] text-white text-xs font-medium"
                    >
                      Tetap Simpan Sebagai Data Baru
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Nama Pelanggan *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value });
                  setDuplicateWarning(null);
                  setAllowDuplicateOnce(false);
                }}
                placeholder="Contoh: Ibu Anita Wijaya"
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm outline-none focus:border-[#1F3D2B]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Nomor WhatsApp *</label>
              <input
                type="text"
                required
                value={form.whatsapp}
                onChange={(e) => {
                  setForm({ ...form, whatsapp: e.target.value });
                  setDuplicateWarning(null);
                  setAllowDuplicateOnce(false);
                }}
                placeholder="0812xxxxxxxx"
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm outline-none focus:border-[#1F3D2B]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Telepon Alternatif</label>
              <input
                type="text"
                value={form.altPhone}
                onChange={(e) => setForm({ ...form, altPhone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm outline-none focus:border-[#1F3D2B]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm outline-none focus:border-[#1F3D2B]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Jenis Properti</label>
              <select
                value={form.propertyType}
                onChange={(e) => setForm({ ...form, propertyType: e.target.value as PropertyType })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm outline-none focus:border-[#1F3D2B] bg-white"
              >
                {PROPERTY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Sumber Pelanggan</label>
              <select
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value as LeadSource })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm outline-none focus:border-[#1F3D2B] bg-white"
              >
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Kota</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Contoh: Surabaya / Jakarta Selatan"
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm outline-none focus:border-[#1F3D2B]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Tanggal Kontak Pertama</label>
              <input
                type="date"
                value={form.firstContactDate}
                onChange={(e) => setForm({ ...form, firstContactDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm outline-none focus:border-[#1F3D2B]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Alamat Lengkap</label>
            <textarea
              rows={2}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm outline-none focus:border-[#1F3D2B]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Lokasi Pemasangan (jika berbeda)</label>
            <input
              type="text"
              value={form.installationLocation}
              onChange={(e) => setForm({ ...form, installationLocation: e.target.value })}
              placeholder="Contoh: Cluster Pakuwon Indah Blok B-12"
              className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm outline-none focus:border-[#1F3D2B]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Catatan Pelanggan</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Preferensi warna, jam kunjungan yang disukai, dll."
              className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm outline-none focus:border-[#1F3D2B]"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E5E2DA]">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-[#E5E2DA] text-sm font-medium text-[#1F2421]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#1F3D2B] text-white text-sm font-medium hover:bg-[#172F21] disabled:opacity-60"
            >
              {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Simpan Pelanggan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Customer Detail Modal */}
      <Modal
        open={Boolean(detailCustomer)}
        onClose={() => setDetailCustomer(null)}
        title={detailCustomer?.name || ''}
        subtitle={detailCustomer ? `${detailCustomer.customerCode} · ${detailCustomer.propertyType} · Sumber ${detailCustomer.source}` : ''}
        size="xl"
      >
        {detailCustomer && detailHistory && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E5E2DA]">
              <div className="text-sm space-y-1">
                <p className="text-[#1F2421]">
                  WhatsApp: <span className="font-mono font-medium">{detailCustomer.whatsapp}</span>
                  {detailCustomer.email ? ` · ${detailCustomer.email}` : ''}
                </p>
                <p className="text-xs text-[#5A635D]">
                  Alamat: {detailCustomer.address || '-'} {detailCustomer.city ? `(${detailCustomer.city})` : ''}
                </p>
                {detailCustomer.installationLocation && (
                  <p className="text-xs text-[#5A635D]">Lokasi Pasang: {detailCustomer.installationLocation}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <WhatsAppLink
                  phone={detailCustomer.whatsapp}
                  message={WA_TEMPLATES.customerGreeting(detailCustomer.name, settings.businessName)}
                  label="WhatsApp Customer"
                />
                <button
                  type="button"
                  onClick={() => {
                    setDetailCustomer(null);
                    navigateTo('surveys');
                  }}
                  className="px-3 py-2 rounded-lg border border-[#E5E2DA] text-xs font-medium text-[#1F2421] hover:bg-[#F8F7F4]"
                >
                  Jadwalkan Survey
                </button>
              </div>
            </div>

            {detailCustomer.notes && (
              <div className="p-3.5 rounded-lg bg-[#F8F7F4] text-xs text-[#1F2421]">
                <span className="font-semibold">Catatan:</span> {detailCustomer.notes}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <h3 className="text-sm font-semibold text-[#1F2421] mb-2">
                  Riwayat Order ({detailHistory.custOrders.length})
                </h3>
                {detailHistory.custOrders.length === 0 ? (
                  <p className="text-xs text-[#5A635D]">Belum ada order.</p>
                ) : (
                  <div className="divide-y divide-[#E5E2DA] border border-[#E5E2DA] rounded-lg">
                    {detailHistory.custOrders.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => {
                          setDetailCustomer(null);
                          navigateTo('orders', o.id);
                        }}
                        className="w-full p-3 text-left hover:bg-[#F8F7F4] flex items-center justify-between gap-2"
                      >
                        <div>
                          <p className="text-xs font-semibold text-[#1F2421]">{o.orderNumber} — {o.projectName}</p>
                          <p className="text-xs text-[#5A635D] font-mono mt-0.5">{formatIDR(o.totalAmount)}</p>
                        </div>
                        <StatusLabel status={o.status} />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-[#1F2421] mb-2">
                  Riwayat Quotation ({detailHistory.custQuotes.length})
                </h3>
                {detailHistory.custQuotes.length === 0 ? (
                  <p className="text-xs text-[#5A635D]">Belum ada quotation.</p>
                ) : (
                  <div className="divide-y divide-[#E5E2DA] border border-[#E5E2DA] rounded-lg">
                    {detailHistory.custQuotes.map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => {
                          setDetailCustomer(null);
                          navigateTo('quotations', q.id);
                        }}
                        className="w-full p-3 text-left hover:bg-[#F8F7F4] flex items-center justify-between gap-2"
                      >
                        <div>
                          <p className="text-xs font-semibold text-[#1F2421]">{q.quotationNumber} — {q.projectName}</p>
                          <p className="text-xs text-[#5A635D] font-mono mt-0.5">{formatIDR(q.totalAmount)}</p>
                        </div>
                        <StatusLabel status={q.status} />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-[#1F2421] mb-2">
                  Riwayat Survey ({detailHistory.custSurveys.length})
                </h3>
                {detailHistory.custSurveys.length === 0 ? (
                  <p className="text-xs text-[#5A635D]">Belum ada survey.</p>
                ) : (
                  <div className="divide-y divide-[#E5E2DA] border border-[#E5E2DA] rounded-lg">
                    {detailHistory.custSurveys.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setDetailCustomer(null);
                          navigateTo('surveys', s.id);
                        }}
                        className="w-full p-3 text-left hover:bg-[#F8F7F4] flex items-center justify-between gap-2"
                      >
                        <div>
                          <p className="text-xs font-semibold text-[#1F2421]">{s.surveyCode} — {s.projectName}</p>
                          <p className="text-xs text-[#5A635D] mt-0.5">{formatDateID(s.surveyDate)}</p>
                        </div>
                        <StatusLabel status={s.status} />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-[#1F2421] mb-2">
                  Riwayat Pembayaran ({detailHistory.custPayments.length})
                </h3>
                {detailHistory.custPayments.length === 0 ? (
                  <p className="text-xs text-[#5A635D]">Belum ada pembayaran tercatat.</p>
                ) : (
                  <div className="divide-y divide-[#E5E2DA] border border-[#E5E2DA] rounded-lg">
                    {detailHistory.custPayments.map((p) => (
                      <div key={p.id} className="p-3 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-[#1F2421]">{p.paymentType} · {p.orderNumber}</p>
                          <p className="text-xs text-[#5A635D]">{formatDateID(p.paymentDate)} · {p.method}</p>
                        </div>
                        <span className="font-mono text-xs font-semibold text-[#186037] tabular-nums">
                          {formatIDR(p.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Data Pelanggan?"
        message={`Anda yakin ingin menghapus pelanggan "${deleteTarget?.name}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus Pelanggan"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};
