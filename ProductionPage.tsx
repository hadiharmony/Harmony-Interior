import React, { useMemo, useState } from 'react';
import { AlertTriangle, Edit3, Hammer, Plus, Trash2 } from 'lucide-react';
import {
  ConfirmDialog,
  EmptyState,
  Modal,
  PageHeader,
  StatusLabel,
} from '../components/common/UIPrimitives';
import { useAppData } from '../context/AppDataContext';
import {
  PRODUCTION_STATUSES,
  ProductionJob,
  ProductionStatus,
} from '../types';
import {
  addDaysISO,
  clampStr,
  formatDateID,
  getJakartaTodayISO,
  isDateOverdue,
} from '../utils/formatters';

const STAGE_PROGRESS: Record<ProductionStatus, number> = {
  'Not Started': 5,
  'Material Preparation': 20,
  Cutting: 40,
  Sewing: 65,
  Finishing: 80,
  'Quality Check': 92,
  Ready: 100,
  Delayed: 50,
};

export const ProductionPage: React.FC = () => {
  const {
    productionJobs,
    orders,
    suppliers,
    createRecord,
    updateRecord,
    deleteRecord,
    notify,
  } = useAppData();

  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductionJob | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductionJob | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    orderId: '',
    supplierId: '',
    workshopName: '',
    itemSummary: '',
    specification: '',
    status: 'Material Preparation' as ProductionStatus,
    startDate: getJakartaTodayISO(),
    estimatedFinishDate: addDaysISO(getJakartaTodayISO(), 7),
    actualFinishDate: '',
    notes: '',
  });

  const filtered = useMemo(
    () =>
      productionJobs.filter((j) =>
        statusFilter === 'all' ? true : j.status === statusFilter
      ),
    [productionJobs, statusFilter]
  );

  const openCreate = () => {
    setEditing(null);
    const today = getJakartaTodayISO();
    setForm({
      orderId: orders[0]?.id || '',
      supplierId: '',
      workshopName: '',
      itemSummary: '',
      specification: '',
      status: 'Material Preparation',
      startDate: today,
      estimatedFinishDate: addDaysISO(today, 7),
      actualFinishDate: '',
      notes: '',
    });
    setModalOpen(true);
  };

  const openEdit = (j: ProductionJob) => {
    setEditing(j);
    setForm({
      orderId: j.orderId,
      supplierId: j.supplierId || '',
      workshopName: j.workshopName,
      itemSummary: j.itemSummary,
      specification: j.specification || '',
      status: j.status,
      startDate: j.startDate || '',
      estimatedFinishDate: j.estimatedFinishDate || '',
      actualFinishDate: j.actualFinishDate || '',
      notes: j.notes || '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const ord = orders.find((o) => o.id === form.orderId);
    if (!ord || !form.workshopName.trim() || !form.itemSummary.trim()) {
      notify('error', 'Order, nama workshop/pabrik, dan ringkasan item wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        orderId: ord.id,
        orderNumber: ord.orderNumber,
        customerName: ord.customerName,
        supplierId: form.supplierId || '',
        workshopName: clampStr(form.workshopName, 160),
        itemSummary: clampStr(form.itemSummary, 300),
        specification: clampStr(form.specification, 1000),
        status: form.status,
        startDate: form.startDate,
        estimatedFinishDate: form.estimatedFinishDate,
        actualFinishDate:
          form.status === 'Ready' && !form.actualFinishDate
            ? getJakartaTodayISO()
            : form.actualFinishDate,
        notes: clampStr(form.notes, 2000),
      };

      if (editing) {
        await updateRecord('productionJobs', editing.id, payload, {
          action: 'Status produksi diubah',
          entityType: 'productionJob',
          summary: `Produksi ${ord.orderNumber} (${payload.workshopName}) kini berstatus ${payload.status}.`,
        });
        notify('success', 'Progres produksi diperbarui.');
      } else {
        await createRecord('productionJobs', payload, {
          action: 'Pekerjaan produksi dibuat',
          entityType: 'productionJob',
          summary: `Produksi ${ord.orderNumber} di ${payload.workshopName} dimulai.`,
        });
        notify('success', 'Tracking produksi ditambahkan.');
      }
      setModalOpen(false);
    } catch {
      notify('error', 'Gagal menyimpan data produksi.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStage = async (job: ProductionJob, nextStatus: ProductionStatus) => {
    try {
      await updateRecord(
        'productionJobs',
        job.id,
        {
          status: nextStatus,
          actualFinishDate: nextStatus === 'Ready' ? getJakartaTodayISO() : job.actualFinishDate || '',
        },
        {
          action: 'Status produksi diubah',
          entityType: 'productionJob',
          summary: `${job.orderNumber} (${job.workshopName}) -> ${nextStatus}.`,
        }
      );
      notify('success', `Status produksi diubah ke ${nextStatus}.`);
    } catch {
      notify('error', 'Gagal memperbarui status.');
    }
  };

  return (
    <div>
      <PageHeader
        title="Production & Sewing Tracking"
        subtitle="Pantau tahapan potong, jahit, finishing, dan quality check di workshop atau pabrik rekanan."
        action={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1F3D2B] text-white text-sm font-medium hover:bg-[#172F21] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Tambah Job Produksi
          </button>
        }
      />

      <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-4">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
            statusFilter === 'all' ? 'bg-[#1F3D2B] text-white' : 'bg-white border border-[#E5E2DA] text-[#5A635D]'
          }`}
        >
          Semua ({productionJobs.length})
        </button>
        {PRODUCTION_STATUSES.map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
              statusFilter === st ? 'bg-[#1F3D2B] text-white' : 'bg-white border border-[#E5E2DA] text-[#5A635D]'
            }`}
          >
            {st} ({productionJobs.filter((j) => j.status === st).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Hammer className="w-5 h-5" />}
          title="Belum ada pekerjaan produksi tercatat"
          description="Catat setiap pekerjaan penjahitan atau perakitan blind di workshop agar tenggat selesai selalu terpantau."
          actionLabel="Catat Job Produksi"
          onAction={openCreate}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((job) => {
            const overdue = job.status !== 'Ready' && (job.status === 'Delayed' || isDateOverdue(job.estimatedFinishDate));
            const pct = STAGE_PROGRESS[job.status] || 0;
            return (
              <div key={job.id} className="bg-white border border-[#E5E2DA] rounded-xl p-5 space-y-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-semibold text-[#846838]">{job.orderNumber}</span>
                      <span className="text-[#5A635D]">· {job.customerName}</span>
                    </div>
                    <h3 className="font-semibold text-[#1F2421] mt-0.5">{job.itemSummary}</h3>
                    <p className="text-xs text-[#5A635D]">Workshop: {job.workshopName}</p>
                  </div>
                  <StatusLabel status={job.status} />
                </div>

                {job.specification && <p className="text-xs text-[#5A635D]">{job.specification}</p>}

                {/* Progress Indicator */}
                <div>
                  <div className="flex justify-between text-[11px] text-[#5A635D] mb-1">
                    <span>Progres Produksi</span>
                    <span className="font-mono tabular-nums">{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#F1EFE9] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        overdue ? 'bg-[#B53939]' : job.status === 'Ready' ? 'bg-[#1E7A46]' : 'bg-[#1F3D2B]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5A635D] pt-1">
                  <span>Mulai: <strong className="font-mono text-[#1F2421]">{formatDateID(job.startDate)}</strong></span>
                  <span className={overdue ? 'text-[#B53939] font-semibold inline-flex items-center gap-1' : ''}>
                    {overdue && <AlertTriangle className="w-3.5 h-3.5" />}
                    Target: <span className="font-mono">{formatDateID(job.estimatedFinishDate)}</span>
                  </span>
                </div>

                <div className="pt-3 border-t border-[#E5E2DA] flex items-center justify-between gap-2">
                  <select
                    value={job.status}
                    onChange={(e) => handleQuickStage(job, e.target.value as ProductionStatus)}
                    className="px-2.5 py-1.5 rounded-lg border border-[#E5E2DA] bg-[#F8F7F4] text-xs font-medium text-[#1F2421]"
                  >
                    {PRODUCTION_STATUSES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(job)}
                      className="p-1.5 rounded-lg text-[#5A635D] hover:text-[#1F3D2B] hover:bg-[#F8F7F4]"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(job)}
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Job Produksi' : 'Tambah Job Produksi'}>
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
                  <option key={o.id} value={o.id}>{o.orderNumber} — {o.customerName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Workshop / Pabrik *</label>
              <input
                type="text"
                required
                list="supplier-workshops"
                value={form.workshopName}
                onChange={(e) => setForm({ ...form, workshopName: e.target.value })}
                placeholder="Ketik atau pilih dari daftar supplier"
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
              <datalist id="supplier-workshops">
                {suppliers.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Item yang Diproduksi *</label>
            <input
              type="text"
              required
              value={form.itemSummary}
              onChange={(e) => setForm({ ...form, itemSummary: e.target.value })}
              placeholder="Contoh: Jahit Gorden Blackout & Sheer 6 Bidang (Ruang Tamu + 2 Kamar)"
              className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Spesifikasi Jahit / Finishing</label>
            <textarea
              rows={2}
              value={form.specification}
              onChange={(e) => setForm({ ...form, specification: e.target.value })}
              placeholder="Model wave, pita 10cm, keliman bawah 12cm..."
              className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as ProductionStatus })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
              >
                {PRODUCTION_STATUSES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Tanggal Mulai</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Estimasi Selesai</label>
              <input
                type="date"
                value={form.estimatedFinishDate}
                onChange={(e) => setForm({ ...form, estimatedFinishDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Catatan Progres</label>
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
              {saving ? 'Menyimpan...' : 'Simpan Produksi'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Job Produksi?"
        message={`Hapus tracking produksi untuk "${deleteTarget?.orderNumber}"?`}
        confirmLabel="Hapus"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteRecord('productionJobs', deleteTarget.id);
          notify('success', 'Data produksi dihapus.');
          setDeleteTarget(null);
        }}
      />
    </div>
  );
};
