import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CheckSquare,
  Edit3,
  Plus,
  Square,
  Trash2,
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
  CHECKLIST_LABELS,
  DEFAULT_CHECKLIST,
  Installation,
  INSTALLATION_STATUSES,
  InstallationChecklist,
  InstallationStatus,
} from '../types';
import {
  addDaysISO,
  clampStr,
  formatDateID,
  generateCode,
  getJakartaTodayISO,
  isDateToday,
  isDateWithinDays,
  WA_TEMPLATES,
} from '../utils/formatters';

export const InstallationsPage: React.FC = () => {
  const {
    installations,
    orders,
    settings,
    createRecord,
    updateRecord,
    deleteRecord,
    notify,
    focusedRecordId,
    clearFocusedRecord,
  } = useAppData();

  const [viewMode, setViewMode] = useState<'list' | 'day' | 'week' | 'month'>('list');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Installation | null>(null);
  const [checklistTarget, setChecklistTarget] = useState<Installation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Installation | null>(null);
  const [saving, setSaving] = useState(false);

  const today = getJakartaTodayISO();

  const [form, setForm] = useState({
    orderId: '',
    address: '',
    scheduledDate: today,
    scheduledTime: '09:00',
    installerName: '',
    transportInfo: '',
    status: 'Scheduled' as InstallationStatus,
    notes: '',
    beforePhotoUrl: '',
    afterPhotoUrl: '',
  });

  useEffect(() => {
    if (focusedRecordId) {
      const found = installations.find((i) => i.id === focusedRecordId);
      if (found) setChecklistTarget(found);
      clearFocusedRecord();
    }
  }, [focusedRecordId, installations, clearFocusedRecord]);

  const filtered = useMemo(() => {
    return installations
      .filter((ins) => {
        if (viewMode === 'day') return isDateToday(ins.scheduledDate);
        if (viewMode === 'week') return isDateWithinDays(ins.scheduledDate, 7);
        if (viewMode === 'month') return ins.scheduledDate.slice(0, 7) === today.slice(0, 7);
        return true;
      })
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  }, [installations, viewMode, today]);

  // Next 7 days calendar columns for Week View
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysISO(today, i)),
    [today]
  );

  const openCreate = () => {
    setEditing(null);
    const first = orders[0];
    setForm({
      orderId: first?.id || '',
      address: first?.installationAddress || '',
      scheduledDate: today,
      scheduledTime: '09:00',
      installerName: '',
      transportInfo: '',
      status: 'Scheduled',
      notes: '',
      beforePhotoUrl: '',
      afterPhotoUrl: '',
    });
    setModalOpen(true);
  };

  const openEdit = (ins: Installation) => {
    setEditing(ins);
    setForm({
      orderId: ins.orderId,
      address: ins.address || '',
      scheduledDate: ins.scheduledDate,
      scheduledTime: ins.scheduledTime || '',
      installerName: ins.installerName || '',
      transportInfo: ins.transportInfo || '',
      status: ins.status,
      notes: ins.notes || '',
      beforePhotoUrl: ins.beforePhotoUrl || '',
      afterPhotoUrl: ins.afterPhotoUrl || '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const ord = orders.find((o) => o.id === form.orderId);
    if (!ord) {
      notify('error', 'Pilih Order pelanggan terlebih dahulu.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        orderId: ord.id,
        orderNumber: ord.orderNumber,
        customerId: ord.customerId,
        customerName: ord.customerName,
        customerWhatsapp: ord.customerWhatsapp || '',
        address: clampStr(form.address || ord.installationAddress || '', 500),
        scheduledDate: form.scheduledDate,
        scheduledTime: clampStr(form.scheduledTime, 20),
        installerName: clampStr(form.installerName, 120),
        transportInfo: clampStr(form.transportInfo, 200),
        status: form.status,
        notes: clampStr(form.notes, 2000),
        beforePhotoUrl: clampStr(form.beforePhotoUrl, 1000),
        afterPhotoUrl: clampStr(form.afterPhotoUrl, 1000),
      };

      if (editing) {
        await updateRecord('installations', editing.id, payload, {
          action: 'Jadwal pemasangan diubah',
          entityType: 'installation',
          summary: `Pemasangan ${editing.installationCode} (${ord.customerName}) dijadwalkan ${formatDateID(payload.scheduledDate)} — ${payload.status}.`,
        });
        notify('success', 'Jadwal pemasangan diperbarui.');
      } else {
        const installationCode = generateCode('INS', installations.length);
        await createRecord(
          'installations',
          { ...payload, installationCode, checklist: DEFAULT_CHECKLIST },
          {
            action: 'Pemasangan dijadwalkan',
            entityType: 'installation',
            summary: `${installationCode} untuk Order ${ord.orderNumber} (${ord.customerName}) tgl ${formatDateID(payload.scheduledDate)}.`,
          }
        );
        notify('success', `Jadwal pemasangan ${installationCode} dibuat.`);
      }
      setModalOpen(false);
    } catch {
      notify('error', 'Gagal menyimpan jadwal pemasangan.');
    } finally {
      setSaving(false);
    }
  };

  const toggleChecklistItem = async (ins: Installation, key: keyof InstallationChecklist) => {
    const current: InstallationChecklist = { ...DEFAULT_CHECKLIST, ...(ins.checklist || {}) };
    const updated = { ...current, [key]: !current[key] };
    try {
      await updateRecord('installations', ins.id, { checklist: updated });
      setChecklistTarget({ ...ins, checklist: updated });
    } catch {
      notify('error', 'Gagal memperbarui checklist.');
    }
  };

  const countDone = (c?: InstallationChecklist) =>
    CHECKLIST_LABELS.filter((item) => Boolean(c?.[item.key])).length;

  return (
    <div>
      <PageHeader
        title="Pemasangan & Penjadwalan Lapangan"
        subtitle="Kelola jadwal pemasangan, petugas lapangan, pengingat WhatsApp, dan 8 poin checklist serah terima."
        action={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1F3D2B] text-white text-sm font-medium hover:bg-[#172F21] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Jadwalkan Pemasangan
          </button>
        }
      />

      {/* Calendar View Switcher */}
      <div className="flex items-center gap-1 p-1 bg-white border border-[#E5E2DA] rounded-xl w-fit mb-5">
        {[
          { key: 'list' as const, label: 'Semua Jadwal' },
          { key: 'day' as const, label: 'Hari Ini' },
          { key: 'week' as const, label: 'Kalender Minggu' },
          { key: 'month' as const, label: 'Bulan Ini' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setViewMode(t.key)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              viewMode === t.key ? 'bg-[#1F3D2B] text-white' : 'text-[#5A635D] hover:text-[#1F2421]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {viewMode === 'week' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {weekDays.map((dayISO) => {
            const dayJobs = installations.filter((i) => i.scheduledDate === dayISO);
            return (
              <div key={dayISO} className="bg-white border border-[#E5E2DA] rounded-xl p-3.5 min-h-[180px]">
                <div className="pb-2 border-b border-[#E5E2DA] mb-2.5 flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-[#1F2421]">{formatDateID(dayISO)}</span>
                  {isDateToday(dayISO) && <span className="text-[10px] font-medium text-[#1F3D2B]">Hari ini</span>}
                </div>
                {dayJobs.length === 0 ? (
                  <p className="text-[11px] text-[#7D8580]">Kosong</p>
                ) : (
                  <div className="space-y-2">
                    {dayJobs.map((job) => (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => setChecklistTarget(job)}
                        className="w-full text-left p-2 rounded-lg bg-[#F8F7F4] hover:bg-[#F3ECE0] border border-[#E5E2DA] transition-colors"
                      >
                        <p className="font-mono text-[10px] text-[#846838]">{job.scheduledTime || '-'} · {job.orderNumber}</p>
                        <p className="text-xs font-semibold text-[#1F2421] truncate">{job.customerName}</p>
                        <StatusLabel status={job.status} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Wrench className="w-5 h-5" />}
          title="Belum ada jadwal pemasangan"
          description="Jadwalkan pemasangan untuk order yang sudah selesai produksi agar tim lapangan dan pelanggan terinformasi."
          actionLabel="Buat Jadwal Pemasangan"
          onAction={openCreate}
        />
      ) : (
        <div className="bg-white border border-[#E5E2DA] rounded-xl divide-y divide-[#E5E2DA]">
          {filtered.map((ins) => {
            const done = countDone(ins.checklist);
            return (
              <div key={ins.id} className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-[#846838]">{ins.installationCode}</span>
                    <StatusLabel status={ins.status} />
                    <span className="inline-flex items-center gap-1 text-xs font-mono text-[#1F2421]">
                      <Calendar className="w-3.5 h-3.5 text-[#5A635D]" />
                      {formatDateID(ins.scheduledDate)} {ins.scheduledTime || ''}
                    </span>
                  </div>
                  <h3 className="font-semibold text-[#1F2421]">
                    {ins.customerName} — Order {ins.orderNumber}
                  </h3>
                  <p className="text-xs text-[#5A635D]">
                    {ins.address || 'Alamat belum diisi'}
                    {ins.installerName ? ` · Petugas: ${ins.installerName}` : ''}
                    {ins.transportInfo ? ` · Transport: ${ins.transportInfo}` : ''}
                  </p>
                  <p className="text-xs text-[#1F3D2B] font-mono">
                    Checklist pemasangan: {done}/{CHECKLIST_LABELS.length} selesai
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <WhatsAppLink
                    phone={ins.customerWhatsapp}
                    message={WA_TEMPLATES.installationReminder({
                      customerName: ins.customerName,
                      orderNumber: ins.orderNumber,
                      date: ins.scheduledDate,
                      time: ins.scheduledTime,
                      address: ins.address,
                      businessName: settings.businessName,
                    })}
                    label="Pengingat WA"
                    compact
                  />
                  <button
                    type="button"
                    onClick={() => setChecklistTarget(ins)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1F3D2B] text-white text-xs font-medium hover:bg-[#172F21]"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    Checklist ({done}/8)
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(ins)}
                    className="p-2 rounded-lg text-[#5A635D] hover:text-[#1F3D2B] hover:bg-[#F8F7F4]"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(ins)}
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

      {/* Create / Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Jadwal Pemasangan' : 'Jadwalkan Pemasangan'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Order Pelanggan *</label>
              <select
                required
                disabled={Boolean(editing)}
                value={form.orderId}
                onChange={(e) => {
                  const ord = orders.find((o) => o.id === e.target.value);
                  setForm({ ...form, orderId: e.target.value, address: ord?.installationAddress || form.address });
                }}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
              >
                <option value="">-- Pilih Order --</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>{o.orderNumber} — {o.customerName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Status Pemasangan</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as InstallationStatus })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
              >
                {INSTALLATION_STATUSES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Tanggal Pasang *</label>
              <input
                type="date"
                required
                value={form.scheduledDate}
                onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Jam</label>
              <input
                type="time"
                value={form.scheduledTime}
                onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Petugas / Teknisi</label>
              <input
                type="text"
                value={form.installerName}
                onChange={(e) => setForm({ ...form, installerName: e.target.value })}
                placeholder="Nama tim pasang"
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Kendaraan / Transport</label>
              <input
                type="text"
                value={form.transportInfo}
                onChange={(e) => setForm({ ...form, transportInfo: e.target.value })}
                placeholder="Mobil operasional / pick-up"
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Alamat Lokasi Pemasangan</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">URL Foto Sebelum Pasang (opsional)</label>
              <input
                type="url"
                value={form.beforePhotoUrl}
                onChange={(e) => setForm({ ...form, beforePhotoUrl: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">URL Foto Sesudah Pasang (opsional)</label>
              <input
                type="url"
                value={form.afterPhotoUrl}
                onChange={(e) => setForm({ ...form, afterPhotoUrl: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Catatan Pemasangan</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Contoh: Bawa tangga 3 meter, koordinasi dengan satpam cluster"
              className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E5E2DA]">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#E5E2DA] text-sm">
              Batal
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-[#1F3D2B] text-white text-sm font-medium">
              {saving ? 'Menyimpan...' : 'Simpan Jadwal'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Interactive 8-Point Installation Checklist Modal */}
      <Modal
        open={Boolean(checklistTarget)}
        onClose={() => setChecklistTarget(null)}
        title={`Checklist Pemasangan — ${checklistTarget?.customerName || ''}`}
        subtitle={checklistTarget ? `${checklistTarget.installationCode} · Order ${checklistTarget.orderNumber}` : ''}
      >
        {checklistTarget && (
          <div className="space-y-4">
            <div className="divide-y divide-[#E5E2DA] border border-[#E5E2DA] rounded-lg">
              {CHECKLIST_LABELS.map((item) => {
                const checked = Boolean(checklistTarget.checklist?.[item.key]);
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => toggleChecklistItem(checklistTarget, item.key)}
                    className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-[#F8F7F4] transition-colors"
                  >
                    {checked ? (
                      <CheckSquare className="w-4 h-4 text-[#1E7A46] shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-[#7D8580] shrink-0" />
                    )}
                    <span className={`text-sm ${checked ? 'text-[#5A635D] line-through' : 'text-[#1F2421]'}`}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {checklistTarget.status !== 'Completed' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    await updateRecord(
                      'installations',
                      checklistTarget.id,
                      { status: 'Completed' },
                      {
                        action: 'Pemasangan selesai',
                        entityType: 'installation',
                        summary: `Pemasangan ${checklistTarget.installationCode} untuk Order ${checklistTarget.orderNumber} selesai.`,
                      }
                    );
                    notify('success', 'Status pemasangan ditandai Selesai.');
                    setChecklistTarget(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-[#1F3D2B] text-white text-xs font-medium hover:bg-[#172F21]"
                >
                  Tandai Pemasangan Selesai
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Jadwal Pemasangan?"
        message={`Hapus jadwal pemasangan "${deleteTarget?.installationCode}"?`}
        confirmLabel="Hapus"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteRecord('installations', deleteTarget.id);
          notify('success', 'Jadwal pemasangan dihapus.');
          setDeleteTarget(null);
        }}
      />
    </div>
  );
};
