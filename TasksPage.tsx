import React, { useMemo, useState } from 'react';
import { CheckSquare, Edit3, Plus, Square, Trash2 } from 'lucide-react';
import {
  ConfirmDialog,
  EmptyState,
  Modal,
  PageHeader,
  StatusLabel,
} from '../components/common/UIPrimitives';
import { useAppData } from '../context/AppDataContext';
import { TaskItem, TaskPriority, TaskStatus } from '../types';
import {
  clampStr,
  formatDateID,
  getJakartaTodayISO,
  isDateOverdue,
  isDateToday,
} from '../utils/formatters';

const PRIORITIES: TaskPriority[] = ['Low', 'Normal', 'High', 'Urgent'];
const TASK_STATUSES: TaskStatus[] = ['To Do', 'In Progress', 'Done', 'Cancelled'];

export const TasksPage: React.FC = () => {
  const {
    tasks,
    orders,
    customers,
    userProfile,
    createRecord,
    updateRecord,
    deleteRecord,
    notify,
  } = useAppData();

  const [tab, setTab] = useState<'all' | 'today' | 'overdue' | 'upcoming' | 'done'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TaskItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskItem | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    dueDate: getJakartaTodayISO(),
    priority: 'Normal' as TaskPriority,
    status: 'To Do' as TaskStatus,
    assignedTo: userProfile?.displayName || 'Pemilik',
    relatedType: '',
    relatedLabel: '',
  });

  const filtered = useMemo(() => {
    const today = getJakartaTodayISO();
    return tasks.filter((t) => {
      if (tab === 'done') return t.status === 'Done';
      if (tab === 'today') return t.status !== 'Done' && t.status !== 'Cancelled' && isDateToday(t.dueDate);
      if (tab === 'overdue') return t.status !== 'Done' && t.status !== 'Cancelled' && isDateOverdue(t.dueDate);
      if (tab === 'upcoming') return t.status !== 'Done' && t.status !== 'Cancelled' && t.dueDate > today;
      return true;
    });
  }, [tasks, tab]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: '',
      description: '',
      dueDate: getJakartaTodayISO(),
      priority: 'Normal',
      status: 'To Do',
      assignedTo: userProfile?.displayName || 'Pemilik',
      relatedType: '',
      relatedLabel: '',
    });
    setModalOpen(true);
  };

  const openEdit = (t: TaskItem) => {
    setEditing(t);
    setForm({
      title: t.title,
      description: t.description || '',
      dueDate: t.dueDate,
      priority: t.priority,
      status: t.status,
      assignedTo: t.assignedTo || '',
      relatedType: t.relatedType || '',
      relatedLabel: t.relatedLabel || '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: clampStr(form.title, 200),
        description: clampStr(form.description, 1500),
        dueDate: form.dueDate,
        priority: form.priority,
        status: form.status,
        assignedTo: clampStr(form.assignedTo, 120),
        relatedType: clampStr(form.relatedType, 40),
        relatedLabel: clampStr(form.relatedLabel, 200),
      };
      if (editing) {
        await updateRecord('tasks', editing.id, payload);
        notify('success', 'Tugas diperbarui.');
      } else {
        await createRecord('tasks', payload, {
          action: 'Tugas dibuat',
          entityType: 'task',
          summary: `Tugas "${payload.title}" (tenggat ${formatDateID(payload.dueDate)}).`,
        });
        notify('success', 'Tugas baru ditambahkan.');
      }
      setModalOpen(false);
    } catch {
      notify('error', 'Gagal menyimpan tugas.');
    } finally {
      setSaving(false);
    }
  };

  const toggleDone = async (t: TaskItem) => {
    const next: TaskStatus = t.status === 'Done' ? 'To Do' : 'Done';
    await updateRecord('tasks', t.id, { status: next });
    notify('info', next === 'Done' ? 'Tugas selesai.' : 'Tugas dibuka kembali.');
  };

  return (
    <div>
      <PageHeader
        title="Tugas & Pengingat"
        subtitle="Catat pengingat follow-up, koordinasi supplier, atau persiapan pemasangan agar tidak ada yang terlewat."
        action={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1F3D2B] text-white text-sm font-medium hover:bg-[#172F21] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Tambah Tugas
          </button>
        }
      />

      <div className="flex items-center gap-1 p-1 bg-white border border-[#E5E2DA] rounded-xl w-fit mb-5 overflow-x-auto max-w-full">
        {[
          { key: 'all' as const, label: `Semua (${tasks.length})` },
          { key: 'today' as const, label: 'Hari Ini' },
          { key: 'overdue' as const, label: 'Terlambat' },
          { key: 'upcoming' as const, label: 'Mendatang' },
          { key: 'done' as const, label: 'Selesai' },
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

      {filtered.length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="w-5 h-5" />}
          title="Tidak ada tugas pada kategori ini"
          description="Tambahkan daftar pekerjaan harian atau pengingat terkait pelanggan, order, dan supplier."
          actionLabel="Buat Tugas Baru"
          onAction={openCreate}
        />
      ) : (
        <div className="bg-white border border-[#E5E2DA] rounded-xl divide-y divide-[#E5E2DA]">
          {filtered.map((t) => {
            const overdue = !['Done', 'Cancelled'].includes(t.status) && isDateOverdue(t.dueDate);
            return (
              <div key={t.id} className="p-4 flex items-start justify-between gap-4 hover:bg-[#F8F7F4]/50">
                <div className="flex items-start gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => toggleDone(t)}
                    className="mt-0.5 text-[#1F3D2B]"
                    aria-label="Ubah status selesai"
                  >
                    {t.status === 'Done' ? (
                      <CheckSquare className="w-4 h-4 text-[#1E7A46]" />
                    ) : (
                      <Square className="w-4 h-4 text-[#7D8580]" />
                    )}
                  </button>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${t.status === 'Done' ? 'line-through text-[#7D8580]' : 'text-[#1F2421]'}`}>
                      {t.title}
                    </p>
                    {t.description && <p className="text-xs text-[#5A635D] mt-0.5">{t.description}</p>}
                    <div className="flex items-center gap-2.5 flex-wrap mt-1.5 text-xs text-[#5A635D]">
                      <StatusLabel status={t.priority} />
                      <span className={`font-mono ${overdue ? 'text-[#B53939] font-semibold' : ''}`}>
                        Tenggat: {formatDateID(t.dueDate)} {overdue ? '(Terlambat)' : ''}
                      </span>
                      {t.relatedLabel && <span>· Terkait: {t.relatedLabel}</span>}
                      {t.assignedTo && <span>· PIC: {t.assignedTo}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => openEdit(t)} className="p-1.5 rounded-lg text-[#5A635D] hover:text-[#1F3D2B]">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(t)} className="p-1.5 rounded-lg text-[#5A635D] hover:text-[#B53939]">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Tugas' : 'Tambah Tugas Baru'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Judul Tugas *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Contoh: Follow-up supplier kain order HI-2026-001"
              className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Deskripsi</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Deadline *</label>
              <input
                type="date"
                required
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Prioritas</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
              >
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
              >
                {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Penanggung Jawab</label>
              <input
                type="text"
                value={form.assignedTo}
                onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Terkait Order / Pelanggan (Opsional)</label>
              <input
                type="text"
                list="task-relations"
                value={form.relatedLabel}
                onChange={(e) => setForm({ ...form, relatedLabel: e.target.value })}
                placeholder="Pilih atau ketik referensi..."
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
              <datalist id="task-relations">
                {orders.map((o) => <option key={o.id} value={`${o.orderNumber} — ${o.customerName}`} />)}
                {customers.map((c) => <option key={c.id} value={`${c.customerCode} — ${c.name}`} />)}
              </datalist>
            </div>
          </div>
          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E5E2DA]">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#E5E2DA] text-sm">Batal</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-[#1F3D2B] text-white text-sm font-medium">
              {saving ? 'Menyimpan...' : 'Simpan Tugas'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Tugas?"
        message={`Hapus tugas "${deleteTarget?.title}"?`}
        confirmLabel="Hapus"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteRecord('tasks', deleteTarget.id);
          notify('success', 'Tugas dihapus.');
          setDeleteTarget(null);
        }}
      />
    </div>
  );
};
