import React, { useEffect, useMemo, useState } from 'react';
import { Edit3, Eye, Factory, Plus, Search, Trash2 } from 'lucide-react';
import {
  ConfirmDialog,
  EmptyState,
  Modal,
  PageHeader,
  StatusLabel,
  WhatsAppLink,
} from '../components/common/UIPrimitives';
import { useAppData } from '../context/AppDataContext';
import { Supplier } from '../types';
import { clampStr, formatIDR, generateSimpleCode } from '../utils/formatters';

export const SuppliersPage: React.FC = () => {
  const {
    suppliers,
    purchaseOrders,
    settings,
    createRecord,
    updateRecord,
    deleteRecord,
    notify,
    focusedRecordId,
    clearFocusedRecord,
    navigateTo,
  } = useAppData();

  const categories = settings.supplierCategories?.length
    ? settings.supplierCategories
    : ['Produsen Kain', 'Pabrik Gorden', 'Supplier Aksesoris', 'Supplier Rel', 'Workshop Penjahitan', 'Vendor Lainnya'];

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    contactPerson: '',
    whatsapp: '',
    address: '',
    category: categories[0],
    bankInfo: '',
    notes: '',
  });

  useEffect(() => {
    if (focusedRecordId) {
      const found = suppliers.find((s) => s.id === focusedRecordId);
      if (found) setDetailSupplier(found);
      clearFocusedRecord();
    }
  }, [focusedRecordId, suppliers, clearFocusedRecord]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return suppliers.filter((s) => {
      if (catFilter !== 'all' && s.category !== catFilter) return false;
      if (!q) return true;
      return `${s.supplierCode} ${s.name} ${s.contactPerson || ''} ${s.category} ${s.whatsapp}`
        .toLowerCase()
        .includes(q);
    });
  }, [suppliers, search, catFilter]);

  const supplierStats = useMemo(() => {
    const map: Record<string, { count: number; total: number; outstanding: number }> = {};
    purchaseOrders
      .filter((po) => po.status !== 'Cancelled')
      .forEach((po) => {
        if (!map[po.supplierId]) map[po.supplierId] = { count: 0, total: 0, outstanding: 0 };
        map[po.supplierId].count += 1;
        map[po.supplierId].total += po.totalAmount || 0;
        map[po.supplierId].outstanding += Math.max(0, (po.totalAmount || 0) - (po.paidAmount || 0));
      });
    return map;
  }, [purchaseOrders]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      contactPerson: '',
      whatsapp: '',
      address: '',
      category: categories[0],
      bankInfo: '',
      notes: '',
    });
    setModalOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({
      name: s.name,
      contactPerson: s.contactPerson || '',
      whatsapp: s.whatsapp,
      address: s.address || '',
      category: s.category,
      bankInfo: s.bankInfo || '',
      notes: s.notes || '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.whatsapp.trim()) {
      notify('error', 'Nama supplier dan nomor WhatsApp wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: clampStr(form.name, 160),
        contactPerson: clampStr(form.contactPerson, 120),
        whatsapp: clampStr(form.whatsapp, 40),
        address: clampStr(form.address, 500),
        category: clampStr(form.category, 100),
        bankInfo: clampStr(form.bankInfo, 300),
        notes: clampStr(form.notes, 2000),
      };
      if (editing) {
        await updateRecord('suppliers', editing.id, payload, {
          action: 'Supplier diperbarui',
          entityType: 'supplier',
          summary: `Supplier ${payload.name} diperbarui.`,
        });
        notify('success', 'Data supplier diperbarui.');
      } else {
        const supplierCode = generateSimpleCode('SUP', suppliers.length);
        await createRecord(
          'suppliers',
          { ...payload, supplierCode },
          {
            action: 'Supplier ditambahkan',
            entityType: 'supplier',
            summary: `Supplier baru ${payload.name} (${payload.category}) ditambahkan.`,
          }
        );
        notify('success', `Supplier ${payload.name} berhasil ditambahkan.`);
      }
      setModalOpen(false);
    } catch {
      notify('error', 'Gagal menyimpan data supplier.');
    } finally {
      setSaving(false);
    }
  };

  const detailPOs = useMemo(
    () => (detailSupplier ? purchaseOrders.filter((po) => po.supplierId === detailSupplier.id) : []),
    [detailSupplier, purchaseOrders]
  );

  return (
    <div>
      <PageHeader
        title="Manajemen Supplier & Workshop"
        subtitle="Catat produsen kain, pabrik gorden, supplier rel & aksesoris, serta workshop penjahitan beserta riwayat transaksi PO."
        action={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1F3D2B] text-white text-sm font-medium hover:bg-[#172F21] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Tambah Supplier
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
            placeholder="Cari nama supplier, kontak, atau kategori..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E5E2DA] bg-[#F8F7F4] text-sm outline-none focus:border-[#1F3D2B]"
          />
        </div>
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
        >
          <option value="all">Semua Kategori</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Factory className="w-5 h-5" />}
          title="Belum ada data supplier"
          description="Tambahkan supplier kain, rel, aksesoris, atau workshop jahit agar Anda dapat menerbitkan Purchase Order per pesanan pelanggan."
          actionLabel="Tambah Supplier Pertama"
          onAction={openCreate}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((s) => {
            const st = supplierStats[s.id] || { count: 0, total: 0, outstanding: 0 };
            return (
              <div key={s.id} className="bg-white border border-[#E5E2DA] rounded-xl p-5 flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs text-[#846838]">{s.supplierCode} · {s.category}</p>
                      <h3 className="font-semibold text-[#1F2421] mt-0.5">{s.name}</h3>
                    </div>
                  </div>
                  <p className="text-xs text-[#5A635D] mt-2">
                    Kontak: {s.contactPerson || '-'} · <span className="font-mono">{s.whatsapp}</span>
                  </p>
                  {s.address && <p className="text-xs text-[#7D8580] mt-1 line-clamp-2">{s.address}</p>}

                  <div className="mt-4 pt-3 border-t border-[#E5E2DA] grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-[#5A635D]">Total Transaksi ({st.count} PO)</p>
                      <p className="font-mono font-semibold text-[#1F2421] tabular-nums">{formatIDR(st.total)}</p>
                    </div>
                    <div>
                      <p className="text-[#5A635D]">Belum Dibayar</p>
                      <p className="font-mono font-semibold text-[#9A600B] tabular-nums">{formatIDR(st.outstanding)}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E5E2DA] flex items-center justify-between gap-2">
                  <WhatsAppLink
                    phone={s.whatsapp}
                    message={`Halo ${s.name}, saya dari ${settings.businessName} ingin menanyakan ketersediaan bahan dan estimasi pesanan.`}
                    compact
                  />
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setDetailSupplier(s)}
                      className="p-2 rounded-lg text-[#5A635D] hover:text-[#1F3D2B] hover:bg-[#F8F7F4]"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(s)}
                      className="p-2 rounded-lg text-[#5A635D] hover:text-[#1F3D2B] hover:bg-[#F8F7F4]"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(s)}
                      className="p-2 rounded-lg text-[#5A635D] hover:text-[#B53939] hover:bg-[#FDF2F2]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Supplier' : 'Tambah Supplier Baru'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Nama Supplier / Workshop *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Kategori Produk / Layanan *</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Nama Kontak / Sales</label>
              <input
                type="text"
                value={form.contactPerson}
                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">WhatsApp *</label>
              <input
                type="text"
                required
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Alamat</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Informasi Rekening Bank</label>
            <input
              type="text"
              value={form.bankInfo}
              onChange={(e) => setForm({ ...form, bankInfo: e.target.value })}
              placeholder="Contoh: BCA 1234567890 a.n. CV Tekstil Jaya"
              className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Catatan Supplier</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E5E2DA]">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#E5E2DA] text-sm">
              Batal
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-[#1F3D2B] text-white text-sm font-medium">
              {saving ? 'Menyimpan...' : 'Simpan Supplier'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(detailSupplier)}
        onClose={() => setDetailSupplier(null)}
        title={detailSupplier?.name || ''}
        subtitle={detailSupplier ? `${detailSupplier.supplierCode} · ${detailSupplier.category}` : ''}
      >
        {detailSupplier && (
          <div className="space-y-4 text-sm">
            <div className="text-xs text-[#5A635D] space-y-1">
              <p>Kontak: <strong className="text-[#1F2421]">{detailSupplier.contactPerson || '-'}</strong> · WA: <span className="font-mono">{detailSupplier.whatsapp}</span></p>
              <p>Alamat: {detailSupplier.address || '-'}</p>
              <p>Rekening: {detailSupplier.bankInfo || '-'}</p>
              {detailSupplier.notes && <p>Catatan: {detailSupplier.notes}</p>}
            </div>

            <div className="pt-3 border-t border-[#E5E2DA]">
              <h4 className="text-xs font-semibold text-[#1F2421] mb-2">Riwayat Purchase Order ({detailPOs.length})</h4>
              {detailPOs.length === 0 ? (
                <p className="text-xs text-[#5A635D]">Belum ada PO ke supplier ini.</p>
              ) : (
                <div className="divide-y divide-[#E5E2DA] border border-[#E5E2DA] rounded-lg">
                  {detailPOs.map((po) => (
                    <button
                      key={po.id}
                      type="button"
                      onClick={() => {
                        setDetailSupplier(null);
                        navigateTo('procurement', po.id);
                      }}
                      className="w-full p-3 text-left hover:bg-[#F8F7F4] flex items-center justify-between gap-2"
                    >
                      <div>
                        <p className="text-xs font-semibold text-[#1F2421]">{po.poNumber} · Order {po.orderNumber}</p>
                        <p className="text-xs font-mono text-[#5A635D]">
                          Total {formatIDR(po.totalAmount)} · Dibayar {formatIDR(po.paidAmount || 0)}
                        </p>
                      </div>
                      <StatusLabel status={po.status} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Supplier?"
        message={`Hapus supplier "${deleteTarget?.name}"?`}
        confirmLabel="Hapus"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteRecord('suppliers', deleteTarget.id, {
            action: 'Supplier dihapus',
            entityType: 'supplier',
            summary: `Supplier ${deleteTarget.name} dihapus.`,
          });
          notify('success', 'Supplier dihapus.');
          setDeleteTarget(null);
        }}
      />
    </div>
  );
};
