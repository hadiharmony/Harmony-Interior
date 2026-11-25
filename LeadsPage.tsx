import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightCircle,
  Edit3,
  MessageSquarePlus,
  Plus,
  Search,
  Trash2,
  UserPlus,
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
import { FollowUpEntry, Lead, LEAD_STATUSES, LeadSource, LeadStatus } from '../types';
import {
  clampStr,
  formatDateID,
  formatIDR,
  generateCode,
  getJakartaTodayISO,
  isDateOverdue,
  normalizePhone,
  WA_TEMPLATES,
} from '../utils/formatters';

interface LeadFormState {
  name: string;
  whatsapp: string;
  source: string;
  needs: string;
  estimatedValue: string;
  nextFollowUpDate: string;
  status: LeadStatus;
  lostReason: string;
  communicationNotes: string;
}

const emptyLead = (): LeadFormState => ({
  name: '',
  whatsapp: '',
  source: 'Instagram',
  needs: '',
  estimatedValue: '',
  nextFollowUpDate: getJakartaTodayISO(),
  status: 'New Lead',
  lostReason: '',
  communicationNotes: '',
});

export const LeadsPage: React.FC = () => {
  const {
    leads,
    customers,
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
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState<LeadFormState>(emptyLead());
  const [saving, setSaving] = useState(false);

  const [followUpLead, setFollowUpLead] = useState<Lead | null>(null);
  const [fuChannel, setFuChannel] = useState('WhatsApp');
  const [fuNote, setFuNote] = useState('');
  const [fuNextDate, setFuNextDate] = useState('');
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);

  useEffect(() => {
    if (focusedRecordId) {
      const found = leads.find((l) => l.id === focusedRecordId);
      if (found) setFollowUpLead(found);
      clearFocusedRecord();
    }
  }, [focusedRecordId, leads, clearFocusedRecord]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (!q) return true;
      return `${l.name} ${l.whatsapp} ${l.needs || ''} ${l.source}`.toLowerCase().includes(q);
    });
  }, [leads, search, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyLead());
    setModalOpen(true);
  };

  const openEdit = (l: Lead) => {
    setEditing(l);
    setForm({
      name: l.name,
      whatsapp: l.whatsapp,
      source: l.source,
      needs: l.needs || '',
      estimatedValue: l.estimatedValue ? String(l.estimatedValue) : '',
      nextFollowUpDate: l.nextFollowUpDate || '',
      status: l.status,
      lostReason: l.lostReason || '',
      communicationNotes: l.communicationNotes || '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.whatsapp.trim()) {
      notify('error', 'Nama calon pelanggan dan WhatsApp wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: clampStr(form.name, 160),
        whatsapp: clampStr(form.whatsapp, 40),
        source: clampStr(form.source, 60) || 'WhatsApp',
        needs: clampStr(form.needs, 1500),
        estimatedValue: Math.max(0, Number(form.estimatedValue) || 0),
        nextFollowUpDate: clampStr(form.nextFollowUpDate, 30),
        status: form.status,
        lostReason: form.status === 'Lost' ? clampStr(form.lostReason, 500) : '',
        communicationNotes: clampStr(form.communicationNotes, 2000),
      };

      if (editing) {
        await updateRecord('leads', editing.id, payload, {
          action: 'Lead diperbarui',
          entityType: 'lead',
          summary: `Lead ${payload.name} diperbarui ke status ${payload.status}.`,
        });
        notify('success', 'Data lead diperbarui.');
      } else {
        await createRecord(
          'leads',
          { ...payload, followUpHistory: [] },
          {
            action: 'Lead baru dicatat',
            entityType: 'lead',
            summary: `Calon pelanggan ${payload.name} (${payload.source}) ditambahkan.`,
          }
        );
        notify('success', 'Lead baru berhasil disimpan.');
      }
      setModalOpen(false);
    } catch {
      notify('error', 'Gagal menyimpan lead.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpLead || !fuNote.trim()) return;
    setSaving(true);
    try {
      const entry: FollowUpEntry = {
        date: getJakartaTodayISO(),
        channel: fuChannel,
        note: clampStr(fuNote, 400),
        by: userProfile?.displayName || 'Pemilik',
      };
      const updatedHistory = [entry, ...(followUpLead.followUpHistory || [])].slice(0, 45);
      await updateRecord(
        'leads',
        followUpLead.id,
        {
          followUpHistory: updatedHistory,
          nextFollowUpDate: fuNextDate || followUpLead.nextFollowUpDate || '',
          status: followUpLead.status === 'New Lead' ? 'Contacted' : followUpLead.status,
        },
        {
          action: 'Follow-up dicatat',
          entityType: 'lead',
          summary: `Follow-up lead ${followUpLead.name} via ${fuChannel}.`,
        }
      );
      setFollowUpLead({ ...followUpLead, followUpHistory: updatedHistory, nextFollowUpDate: fuNextDate || followUpLead.nextFollowUpDate });
      setFuNote('');
      notify('success', 'Catatan follow-up berhasil disimpan.');
    } catch {
      notify('error', 'Gagal menyimpan catatan follow-up.');
    } finally {
      setSaving(false);
    }
  };

  const handleConvertToCustomer = async (lead: Lead) => {
    setConvertingId(lead.id);
    try {
      // Check if customer already exists by WhatsApp
      const norm = normalizePhone(lead.whatsapp);
      let existing = customers.find((c) => norm && normalizePhone(c.whatsapp) === norm);
      let customerId = existing?.id;

      if (!customerId) {
        const customerCode = generateCode('CUST', customers.length);
        const validSources: LeadSource[] = ['Instagram', 'WhatsApp', 'Referral', 'Walk-in', 'Lainnya'];
        const mappedSource: LeadSource = validSources.includes(lead.source as LeadSource)
          ? (lead.source as LeadSource)
          : 'Lainnya';

        customerId = await createRecord(
          'customers',
          {
            customerCode,
            name: clampStr(lead.name, 160),
            whatsapp: clampStr(lead.whatsapp, 40),
            propertyType: 'rumah',
            source: mappedSource,
            firstContactDate: getJakartaTodayISO(),
            notes: clampStr(`Konversi dari Lead. Kebutuhan: ${lead.needs || '-'}. ${lead.communicationNotes || ''}`, 2000),
          },
          {
            action: 'Lead dikonversi ke Pelanggan',
            entityType: 'customer',
            summary: `Lead ${lead.name} dikonversi menjadi pelanggan ${customerCode}.`,
          }
        );
      }

      await updateRecord('leads', lead.id, {
        status: 'Won',
        convertedCustomerId: customerId,
      });
      notify('success', `Lead ${lead.name} berhasil dikonversi ke data Pelanggan.`);
      navigateTo('customers', customerId);
    } catch {
      notify('error', 'Gagal mengonversi lead menjadi pelanggan.');
    } finally {
      setConvertingId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Leads & Follow-Up"
        subtitle="Pantau calon pelanggan sebelum menjadi order, catat riwayat komunikasi, dan konversi ke pelanggan tanpa ketik ulang."
        action={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1F3D2B] text-white text-sm font-medium hover:bg-[#172F21] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Tambah Lead
          </button>
        }
      />

      {/* Filter Bar */}
      <div className="bg-white border border-[#E5E2DA] rounded-xl p-4 mb-5 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#7D8580] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama prospek, WhatsApp, atau kebutuhan..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E5E2DA] bg-[#F8F7F4] text-sm outline-none focus:border-[#1F3D2B]"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              statusFilter === 'all' ? 'bg-[#1F3D2B] text-white' : 'bg-[#F8F7F4] text-[#5A635D] hover:text-[#1F2421]'
            }`}
          >
            Semua ({leads.length})
          </button>
          {LEAD_STATUSES.map((st) => {
            const cnt = leads.filter((l) => l.status === st).length;
            return (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  statusFilter === st ? 'bg-[#1F3D2B] text-white' : 'bg-[#F8F7F4] text-[#5A635D] hover:text-[#1F2421]'
                }`}
              >
                {st} ({cnt})
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="w-5 h-5" />}
          title="Belum ada calon pelanggan"
          description="Catat setiap pertanyaan masuk dari Instagram, WhatsApp, atau referral agar tidak ada prospek yang terlewat di-follow-up."
          actionLabel="Catat Lead Pertama"
          onAction={openCreate}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((lead) => {
            const overdue = !['Won', 'Lost'].includes(lead.status) && isDateOverdue(lead.nextFollowUpDate);
            return (
              <div
                key={lead.id}
                className="bg-white border border-[#E5E2DA] rounded-xl p-5 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-[#1F2421] truncate">{lead.name}</h3>
                      <p className="text-xs text-[#5A635D] mt-0.5">
                        <span className="font-mono">{lead.whatsapp}</span> · {lead.source}
                      </p>
                    </div>
                    <StatusLabel status={lead.status} />
                  </div>

                  {lead.needs && (
                    <p className="mt-3 text-xs text-[#1F2421] leading-relaxed line-clamp-3">{lead.needs}</p>
                  )}

                  <div className="mt-3 pt-3 border-t border-[#E5E2DA] flex items-center justify-between text-xs">
                    <span className="text-[#5A635D]">Estimasi Nilai</span>
                    <span className="font-mono font-semibold text-[#1F2421] tabular-nums">
                      {lead.estimatedValue ? formatIDR(lead.estimatedValue) : '-'}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-xs">
                    <span className="text-[#5A635D]">Follow-up Berikutnya</span>
                    <span className={`font-mono tabular-nums ${overdue ? 'text-[#B53939] font-semibold' : 'text-[#1F2421]'}`}>
                      {formatDateID(lead.nextFollowUpDate)} {overdue ? '(Terlambat)' : ''}
                    </span>
                  </div>
                  {lead.status === 'Lost' && lead.lostReason && (
                    <p className="mt-2 text-xs text-[#962B2B]">Alasan Lost: {lead.lostReason}</p>
                  )}
                </div>

                <div className="pt-3 border-t border-[#E5E2DA] flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <WhatsAppLink
                      phone={lead.whatsapp}
                      message={WA_TEMPLATES.leadFollowUp(lead.name, lead.needs || '', settings.businessName)}
                      label="Follow-up"
                      compact
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setFollowUpLead(lead);
                        setFuNextDate(lead.nextFollowUpDate || getJakartaTodayISO());
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E5E2DA] text-xs font-medium text-[#1F2421] hover:bg-[#F8F7F4]"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5" />
                      Log ({lead.followUpHistory?.length || 0})
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    {!lead.convertedCustomerId && lead.status !== 'Lost' && (
                      <button
                        type="button"
                        disabled={convertingId === lead.id}
                        onClick={() => handleConvertToCustomer(lead)}
                        title="Konversi menjadi Pelanggan"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1F3D2B] text-white text-xs font-medium hover:bg-[#172F21]"
                      >
                        <ArrowRightCircle className="w-3.5 h-3.5" />
                        Konversi
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEdit(lead)}
                      className="p-1.5 rounded-lg text-[#5A635D] hover:text-[#1F3D2B] hover:bg-[#F8F7F4]"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(lead)}
                      className="p-1.5 rounded-lg text-[#5A635D] hover:text-[#B53939] hover:bg-[#FDF2F2]"
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

      {/* Create / Edit Lead Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Lead' : 'Tambah Calon Pelanggan (Lead)'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Nama *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm outline-none focus:border-[#1F3D2B]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Nomor WhatsApp *</label>
              <input
                type="text"
                required
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm outline-none focus:border-[#1F3D2B]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Sumber Lead</label>
              <select
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm bg-white outline-none focus:border-[#1F3D2B]"
              >
                {['Instagram', 'WhatsApp', 'Referral', 'Walk-in', 'Lainnya'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as LeadStatus })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm bg-white outline-none focus:border-[#1F3D2B]"
              >
                {LEAD_STATUSES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Estimasi Nilai Proyek (IDR)</label>
              <input
                type="number"
                min="0"
                value={form.estimatedValue}
                onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })}
                placeholder="Contoh: 15000000"
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm outline-none focus:border-[#1F3D2B]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Tanggal Follow-up Berikutnya</label>
              <input
                type="date"
                value={form.nextFollowUpDate}
                onChange={(e) => setForm({ ...form, nextFollowUpDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm outline-none focus:border-[#1F3D2B]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Kebutuhan Pelanggan</label>
            <textarea
              rows={2}
              value={form.needs}
              onChange={(e) => setForm({ ...form, needs: e.target.value })}
              placeholder="Contoh: Gorden blackout ruang tamu & 3 kamar tidur rumah baru"
              className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm outline-none focus:border-[#1F3D2B]"
            />
          </div>

          {form.status === 'Lost' && (
            <div>
              <label className="block text-xs font-medium text-[#962B2B] mb-1">Alasan Lead Lost</label>
              <input
                type="text"
                value={form.lostReason}
                onChange={(e) => setForm({ ...form, lostReason: e.target.value })}
                placeholder="Contoh: Budget belum sesuai / menunda renovasi"
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm outline-none focus:border-[#B53939]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Catatan Komunikasi</label>
            <textarea
              rows={2}
              value={form.communicationNotes}
              onChange={(e) => setForm({ ...form, communicationNotes: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm outline-none focus:border-[#1F3D2B]"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E5E2DA]">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#E5E2DA] text-sm">
              Batal
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-[#1F3D2B] text-white text-sm font-medium">
              {saving ? 'Menyimpan...' : 'Simpan Lead'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Follow-up History Modal */}
      <Modal
        open={Boolean(followUpLead)}
        onClose={() => setFollowUpLead(null)}
        title={`Riwayat Follow-up — ${followUpLead?.name || ''}`}
        subtitle="Catat setiap interaksi agar progres pendekatan pelanggan terdokumentasi rapi."
      >
        {followUpLead && (
          <div className="space-y-5">
            <form onSubmit={handleAddFollowUp} className="p-4 rounded-lg bg-[#F8F7F4] border border-[#E5E2DA] space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#1F2421] mb-1">Media Komunikasi</label>
                  <select
                    value={fuChannel}
                    onChange={(e) => setFuChannel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
                  >
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Telepon">Telepon</option>
                    <option value="Kunjungan / Survey">Kunjungan / Survey</option>
                    <option value="Instagram DM">Instagram DM</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#1F2421] mb-1">Jadwal Follow-up Berikutnya</label>
                  <input
                    type="date"
                    value={fuNextDate}
                    onChange={(e) => setFuNextDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#1F2421] mb-1">Ringkasan Komunikasi *</label>
                <textarea
                  rows={2}
                  required
                  value={fuNote}
                  onChange={(e) => setFuNote(e.target.value)}
                  placeholder="Contoh: Sudah kirim katalog warna kain blackout, pelanggan minta survey Sabtu pagi."
                  className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-[#1F3D2B] text-white text-xs font-medium"
              >
                {saving ? 'Menyimpan...' : 'Tambah Catatan Follow-up'}
              </button>
            </form>

            <div className="space-y-2.5">
              <h4 className="text-xs font-semibold text-[#5A635D]">Riwayat Tercatat</h4>
              {!followUpLead.followUpHistory || followUpLead.followUpHistory.length === 0 ? (
                <p className="text-xs text-[#5A635D]">Belum ada riwayat follow-up.</p>
              ) : (
                <div className="divide-y divide-[#E5E2DA] border border-[#E5E2DA] rounded-lg">
                  {followUpLead.followUpHistory.map((item, idx) => (
                    <div key={idx} className="p-3.5 text-sm">
                      <div className="flex items-center justify-between text-xs text-[#5A635D]">
                        <span className="font-medium text-[#1F2421]">{item.channel} · {item.by}</span>
                        <span className="font-mono">{formatDateID(item.date)}</span>
                      </div>
                      <p className="mt-1 text-xs text-[#1F2421]">{item.note}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Lead?"
        message={`Hapus calon pelanggan "${deleteTarget?.name}" dari daftar leads?`}
        confirmLabel="Hapus Lead"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteRecord('leads', deleteTarget.id, {
            action: 'Lead dihapus',
            entityType: 'lead',
            summary: `Lead ${deleteTarget.name} dihapus.`,
          });
          notify('success', 'Lead dihapus.');
          setDeleteTarget(null);
        }}
      />
    </div>
  );
};
