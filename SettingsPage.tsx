import React, { useEffect, useState } from 'react';
import { Download, Plus, Save, Shield, Trash2, Users } from 'lucide-react';
import { PageHeader, PWAInstallButton } from '../components/common/UIPrimitives';
import { useAppData } from '../context/AppDataContext';
import { ROLE_PERMISSIONS, UserRole } from '../types';
import { clampStr, getJakartaTodayISO } from '../utils/formatters';

const ALL_ROLES: UserRole[] = [
  'owner',
  'admin',
  'sales',
  'surveyor',
  'operations',
  'finance',
  'installer',
];

export const SettingsPage: React.FC = () => {
  const {
    settings,
    saveSettings,
    users,
    customers,
    leads,
    surveys,
    measurementAreas,
    quotations,
    orders,
    suppliers,
    purchaseOrders,
    productionJobs,
    installations,
    payments,
    expenses,
    tasks,
    documents,
    updateRecord,
    notify,
  } = useAppData();

  const [tab, setTab] = useState<'business' | 'categories' | 'users' | 'backup'>('business');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    businessName: settings.businessName || 'Harmony Interior',
    tagline: settings.tagline || '',
    address: settings.address || '',
    whatsapp: settings.whatsapp || '',
    email: settings.email || '',
    bankAccounts: settings.bankAccounts || '',
    paymentTerms: settings.paymentTerms || '',
    defaultDpPercentage: settings.defaultDpPercentage ?? 50,
    quotationValidityDays: settings.quotationValidityDays ?? 14,
    orderPrefix: settings.orderPrefix || 'HI',
    quotationPrefix: settings.quotationPrefix || 'QT',
    poPrefix: settings.poPrefix || 'PO',
  });

  const [productCategories, setProductCategories] = useState<string[]>(settings.productCategories || []);
  const [supplierCategories, setSupplierCategories] = useState<string[]>(settings.supplierCategories || []);
  const [expenseCategories, setExpenseCategories] = useState<string[]>(settings.expenseCategories || []);
  const [newProd, setNewProd] = useState('');
  const [newSup, setNewSup] = useState('');
  const [newExp, setNewExp] = useState('');

  useEffect(() => {
    setForm({
      businessName: settings.businessName || 'Harmony Interior',
      tagline: settings.tagline || '',
      address: settings.address || '',
      whatsapp: settings.whatsapp || '',
      email: settings.email || '',
      bankAccounts: settings.bankAccounts || '',
      paymentTerms: settings.paymentTerms || '',
      defaultDpPercentage: settings.defaultDpPercentage ?? 50,
      quotationValidityDays: settings.quotationValidityDays ?? 14,
      orderPrefix: settings.orderPrefix || 'HI',
      quotationPrefix: settings.quotationPrefix || 'QT',
      poPrefix: settings.poPrefix || 'PO',
    });
    setProductCategories(settings.productCategories || []);
    setSupplierCategories(settings.supplierCategories || []);
    setExpenseCategories(settings.expenseCategories || []);
  }, [settings]);

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveSettings({
        businessName: clampStr(form.businessName, 160) || 'Harmony Interior',
        tagline: clampStr(form.tagline, 200),
        address: clampStr(form.address, 500),
        whatsapp: clampStr(form.whatsapp, 40),
        email: clampStr(form.email, 200),
        bankAccounts: clampStr(form.bankAccounts, 1000),
        paymentTerms: clampStr(form.paymentTerms, 1500),
        defaultDpPercentage: Math.min(100, Math.max(0, Number(form.defaultDpPercentage) || 50)),
        quotationValidityDays: Math.min(365, Math.max(1, Number(form.quotationValidityDays) || 14)),
        orderPrefix: clampStr(form.orderPrefix, 20) || 'HI',
        quotationPrefix: clampStr(form.quotationPrefix, 20) || 'QT',
        poPrefix: clampStr(form.poPrefix, 20) || 'PO',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCategories = async () => {
    setSaving(true);
    try {
      await saveSettings({
        productCategories: productCategories.slice(0, 40),
        supplierCategories: supplierCategories.slice(0, 40),
        expenseCategories: expenseCategories.slice(0, 40),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExportJSONBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      business: settings.businessName,
      data: {
        settings,
        customers,
        leads,
        surveys,
        measurementAreas,
        quotations,
        orders,
        suppliers,
        purchaseOrders,
        productionJobs,
        installations,
        payments,
        expenses,
        tasks,
        documents,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `harmony-interior-backup-${getJakartaTodayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify('success', 'Backup seluruh data bisnis (JSON) berhasil diunduh.');
  };

  const handleChangeRole = async (userId: string, role: UserRole) => {
    try {
      await updateRecord('users', userId, { role }, {
        action: 'Role pengguna diubah',
        entityType: 'user',
        summary: `Role pengguna diubah menjadi ${role}.`,
      });
      notify('success', `Role diperbarui ke ${role}.`);
    } catch {
      notify('error', 'Gagal mengubah role pengguna.');
    }
  };

  return (
    <div>
      <PageHeader
        title="Pengaturan Sistem"
        subtitle="Atur profil bisnis Harmony Interior, rekening pembayaran, penomoran otomatis, kategori produk, peran tim, dan backup data."
      />

      <div className="flex items-center gap-1 p-1 bg-white border border-[#E5E2DA] rounded-xl w-fit mb-6 overflow-x-auto max-w-full">
        {[
          { key: 'business' as const, label: 'Profil & Penomoran' },
          { key: 'categories' as const, label: 'Kategori Produk & Biaya' },
          { key: 'users' as const, label: 'Tim & Hak Akses' },
          { key: 'backup' as const, label: 'Backup & PWA' },
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

      {tab === 'business' && (
        <form onSubmit={handleSaveBusiness} className="bg-white border border-[#E5E2DA] rounded-xl p-6 space-y-5 max-w-3xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Nama Usaha *</label>
              <input
                type="text"
                required
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Tagline / Deskripsi Singkat</label>
              <input
                type="text"
                value={form.tagline}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Nomor WhatsApp Usaha</label>
              <input
                type="text"
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                placeholder="0812xxxxxxxx"
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Email Usaha</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Alamat Studio / Usaha</label>
            <textarea
              rows={2}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Rekening Bank (Tampil di Quotation &amp; Pengingat Tagihan)</label>
            <textarea
              rows={2}
              value={form.bankAccounts}
              onChange={(e) => setForm({ ...form, bankAccounts: e.target.value })}
              placeholder="Contoh: BCA 1234567890 a.n. Harmony Interior"
              className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Syarat Pembayaran Standar</label>
            <textarea
              rows={2}
              value={form.paymentTerms}
              onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-[#E5E2DA]">
            <div>
              <label className="block text-xs text-[#5A635D] mb-1">Default DP (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={form.defaultDpPercentage}
                onChange={(e) => setForm({ ...form, defaultDpPercentage: Number(e.target.value) })}
                className="w-full px-2.5 py-2 rounded-lg border border-[#E5E2DA] text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-[#5A635D] mb-1">Masa Berlaku QT (Hari)</label>
              <input
                type="number"
                min="1"
                max="365"
                value={form.quotationValidityDays}
                onChange={(e) => setForm({ ...form, quotationValidityDays: Number(e.target.value) })}
                className="w-full px-2.5 py-2 rounded-lg border border-[#E5E2DA] text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-[#5A635D] mb-1">Prefix Order</label>
              <input
                type="text"
                value={form.orderPrefix}
                onChange={(e) => setForm({ ...form, orderPrefix: e.target.value })}
                className="w-full px-2.5 py-2 rounded-lg border border-[#E5E2DA] text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-[#5A635D] mb-1">Prefix Quotation</label>
              <input
                type="text"
                value={form.quotationPrefix}
                onChange={(e) => setForm({ ...form, quotationPrefix: e.target.value })}
                className="w-full px-2.5 py-2 rounded-lg border border-[#E5E2DA] text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-[#5A635D] mb-1">Prefix PO</label>
              <input
                type="text"
                value={form.poPrefix}
                onChange={(e) => setForm({ ...form, poPrefix: e.target.value })}
                className="w-full px-2.5 py-2 rounded-lg border border-[#E5E2DA] text-sm font-mono"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1F3D2B] text-white text-sm font-medium hover:bg-[#172F21]"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Menyimpan...' : 'Simpan Pengaturan Bisnis'}
            </button>
          </div>
        </form>
      )}

      {tab === 'categories' && (
        <div className="space-y-5 max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                title: 'Kategori Produk / Gorden',
                items: productCategories,
                setItems: setProductCategories,
                input: newProd,
                setInput: setNewProd,
                placeholder: 'Contoh: Motorized Track',
              },
              {
                title: 'Kategori Supplier',
                items: supplierCategories,
                setItems: setSupplierCategories,
                input: newSup,
                setInput: setNewSup,
                placeholder: 'Contoh: Importir Kain',
              },
              {
                title: 'Kategori Pengeluaran',
                items: expenseCategories,
                setItems: setExpenseCategories,
                input: newExp,
                setInput: setNewExp,
                placeholder: 'Contoh: Sewa Showroom',
              },
            ].map((group) => (
              <div key={group.title} className="bg-white border border-[#E5E2DA] rounded-xl p-5 flex flex-col">
                <h3 className="text-sm font-semibold text-[#1F2421] mb-3">{group.title}</h3>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={group.input}
                    onChange={(e) => group.setInput(e.target.value)}
                    placeholder={group.placeholder}
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-[#E5E2DA] text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const v = group.input.trim();
                      if (!v || group.items.includes(v)) return;
                      group.setItems([...group.items, v]);
                      group.setInput('');
                    }}
                    className="p-2 rounded-lg bg-[#1F3D2B] text-white"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="divide-y divide-[#E5E2DA] text-xs flex-1 max-h-64 overflow-y-auto">
                  {group.items.map((item) => (
                    <div key={item} className="py-2 flex items-center justify-between gap-2">
                      <span className="text-[#1F2421]">{item}</span>
                      <button
                        type="button"
                        onClick={() => group.setItems(group.items.filter((x) => x !== item))}
                        className="text-[#7D8580] hover:text-[#B53939]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveCategories}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1F3D2B] text-white text-sm font-medium hover:bg-[#172F21]"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Menyimpan...' : 'Simpan Semua Kategori'}
          </button>
        </div>
      )}

      {tab === 'users' && (
        <div className="space-y-6 max-w-4xl">
          <div className="bg-white border border-[#E5E2DA] rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-[#1F3D2B]" />
              <h3 className="text-sm font-semibold text-[#1F2421]">Pengguna Terdaftar ({users.length})</h3>
            </div>
            <div className="divide-y divide-[#E5E2DA]">
              {users.map((u) => (
                <div key={u.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#1F2421]">{u.displayName}</p>
                    <p className="text-xs text-[#5A635D]">{u.email}</p>
                  </div>
                  <select
                    value={u.role}
                    onChange={(e) => handleChangeRole(u.id, e.target.value as UserRole)}
                    className="px-3 py-1.5 rounded-lg border border-[#E5E2DA] bg-[#F8F7F4] text-xs font-medium capitalize"
                  >
                    {ALL_ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-[#E5E2DA] rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-[#1F3D2B]" />
              <h3 className="text-sm font-semibold text-[#1F2421]">Matriks Hak Akses Role (RBAC)</h3>
            </div>
            <p className="text-xs text-[#5A635D] mb-4">
              Owner memiliki akses penuh. Role karyawan membatasi akses modul di aplikasi dan dilindungi oleh Firestore Security Rules.
            </p>
            <div className="divide-y divide-[#E5E2DA] text-xs">
              {ALL_ROLES.map((role) => (
                <div key={role} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="font-semibold capitalize text-[#1F2421] w-28">{role}</span>
                  <span className="text-[#5A635D] flex-1">
                    {ROLE_PERMISSIONS[role].join(' · ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'backup' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl">
          <div className="bg-white border border-[#E5E2DA] rounded-xl p-6 space-y-3">
            <h3 className="text-sm font-semibold text-[#1F2421]">Backup Data Bisnis (JSON)</h3>
            <p className="text-xs text-[#5A635D] leading-relaxed">
              Unduh salinan lengkap seluruh data pelanggan, leads, survey, pengukuran, quotation, order, supplier, PO, produksi, pemasangan, pembayaran, pengeluaran, dan dokumen Anda dalam satu berkas JSON.
            </p>
            <button
              type="button"
              onClick={handleExportJSONBackup}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1F3D2B] text-white text-xs font-medium hover:bg-[#172F21]"
            >
              <Download className="w-3.5 h-3.5" />
              Unduh Backup JSON Sekarang
            </button>
          </div>

          <div className="bg-white border border-[#E5E2DA] rounded-xl p-6 space-y-3">
            <h3 className="text-sm font-semibold text-[#1F2421]">Instalasi Aplikasi (PWA) &amp; Sinkronisasi Cloud</h3>
            <p className="text-xs text-[#5A635D] leading-relaxed">
              Aplikasi terhubung langsung ke Cloud Firestore &amp; Firebase Authentication. Login dengan akun Google yang sama di smartphone Android, iPhone, tablet, atau laptop untuk sinkronisasi realtime.
            </p>
            <div className="pt-1">
              <PWAInstallButton />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
