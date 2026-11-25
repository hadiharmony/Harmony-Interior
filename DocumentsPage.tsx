import React, { useMemo, useState } from 'react';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  ConfirmDialog,
  EmptyState,
  Modal,
  PageHeader,
} from '../components/common/UIPrimitives';
import { useAppData } from '../context/AppDataContext';
import { storage } from '../firebase/config';
import { DocumentCategory, DocumentRecord } from '../types';
import { clampStr, formatTimestampID } from '../utils/formatters';

const DOC_CATEGORIES: DocumentCategory[] = [
  'Quotation',
  'Purchase Order',
  'Invoice',
  'Bukti Pembayaran',
  'Foto Survey',
  'Foto Produk',
  'Foto Pemasangan',
  'Dokumen Customer',
  'Dokumen Supplier',
  'Lainnya',
];

export const DocumentsPage: React.FC = () => {
  const {
    documents,
    orders,
    customers,
    suppliers,
    workspaceOwnerUid,
    createRecord,
    deleteRecord,
    notify,
  } = useAppData();

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentRecord | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    title: '',
    category: 'Foto Survey' as DocumentCategory,
    relatedLabel: '',
    downloadUrl: '',
    notes: '',
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((d) => {
      if (catFilter !== 'all' && d.category !== catFilter) return false;
      if (!q) return true;
      return `${d.title} ${d.fileName} ${d.category} ${d.relatedLabel || ''}`.toLowerCase().includes(q);
    });
  }, [documents, search, catFilter]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      notify('error', 'Judul dokumen wajib diisi.');
      return;
    }
    if (!selectedFile && !form.downloadUrl.trim()) {
      notify('error', 'Unggah file atau masukkan tautan dokumen yang valid.');
      return;
    }

    setUploading(true);
    try {
      let downloadUrl = form.downloadUrl.trim();
      let fileName = selectedFile?.name || form.title.trim();
      let mimeType = selectedFile?.type || 'application/octet-stream';
      let sizeBytes = selectedFile?.size || 0;
      let storagePath = '';

      if (selectedFile && workspaceOwnerUid) {
        const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        storagePath = `harmony/${workspaceOwnerUid}/${Date.now()}_${safeName}`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, selectedFile);
        downloadUrl = await getDownloadURL(storageRef);
      }

      await createRecord(
        'documents',
        {
          title: clampStr(form.title, 200),
          category: form.category,
          fileName: clampStr(fileName, 255),
          mimeType: clampStr(mimeType, 120),
          sizeBytes,
          storagePath: clampStr(storagePath, 500),
          downloadUrl: clampStr(downloadUrl, 1500),
          relatedLabel: clampStr(form.relatedLabel, 200),
          notes: clampStr(form.notes, 1000),
        },
        {
          action: 'Dokumen diunggah',
          entityType: 'document',
          summary: `Dokumen "${form.title}" (${form.category}) tersimpan di Pusat Dokumen.`,
        }
      );

      notify('success', 'Dokumen berhasil disimpan.');
      setModalOpen(false);
      setSelectedFile(null);
      setForm({ title: '', category: 'Foto Survey', relatedLabel: '', downloadUrl: '', notes: '' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      notify(
        'error',
        msg.includes('storage')
          ? 'Gagal unggah ke Firebase Storage (pastikan Firebase Storage sudah diaktifkan), atau gunakan kolom tautan file.'
          : 'Gagal menyimpan dokumen.'
      );
    } finally {
      setUploading(false);
    }
  };

  const isImage = (d: DocumentRecord) =>
    d.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(d.fileName);

  return (
    <div>
      <PageHeader
        title="Pusat Dokumen (Document Center)"
        subtitle="Simpan foto survey, foto pemasangan, bukti pembayaran, invoice supplier, dan berkas proyek secara terpusat di Firebase Storage."
        action={
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1F3D2B] text-white text-sm font-medium hover:bg-[#172F21] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Unggah Dokumen
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
            placeholder="Cari judul dokumen, nama file, atau referensi order..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E5E2DA] bg-[#F8F7F4] text-sm outline-none focus:border-[#1F3D2B]"
          />
        </div>
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
        >
          <option value="all">Semua Kategori</option>
          {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="w-5 h-5" />}
          title="Belum ada dokumen tersimpan"
          description="Unggah foto ruangan hasil survey, bukti transfer DP, invoice supplier, atau dokumentasi setelah pemasangan."
          actionLabel="Unggah Dokumen Pertama"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((docItem) => (
            <div key={docItem.id} className="bg-white border border-[#E5E2DA] rounded-xl overflow-hidden flex flex-col">
              {isImage(docItem) ? (
                <button
                  type="button"
                  onClick={() => setPreviewDoc(docItem)}
                  className="h-40 w-full bg-[#F8F7F4] overflow-hidden border-b border-[#E5E2DA]"
                >
                  <img
                    src={docItem.downloadUrl}
                    alt={docItem.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </button>
              ) : (
                <div className="h-24 w-full bg-[#F8F7F4] border-b border-[#E5E2DA] flex items-center justify-center text-[#5A635D]">
                  <FileText className="w-8 h-8" />
                </div>
              )}

              <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium text-[#846838]">{docItem.category}</p>
                  <h3 className="font-semibold text-sm text-[#1F2421] mt-0.5 line-clamp-1">{docItem.title}</h3>
                  <p className="text-xs text-[#5A635D] truncate">{docItem.fileName}</p>
                  {docItem.relatedLabel && (
                    <p className="text-xs text-[#5A635D] mt-1">Terkait: {docItem.relatedLabel}</p>
                  )}
                  <p className="text-[11px] font-mono text-[#7D8580] mt-1">{formatTimestampID(docItem.createdAt)}</p>
                </div>

                <div className="pt-3 border-t border-[#E5E2DA] flex items-center justify-between">
                  <a
                    href={docItem.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1F3D2B] hover:underline"
                  >
                    {isImage(docItem) ? <ImageIcon className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                    Buka / Unduh
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(docItem)}
                    className="p-1.5 rounded-lg text-[#5A635D] hover:text-[#B53939]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Unggah Dokumen / Foto">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Judul Dokumen *</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Contoh: Foto Ruang Tamu Ibu Anita"
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Kategori</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as DocumentCategory })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
              >
                {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Hubungkan ke Order / Pelanggan / Supplier</label>
            <input
              type="text"
              list="doc-relations"
              value={form.relatedLabel}
              onChange={(e) => setForm({ ...form, relatedLabel: e.target.value })}
              placeholder="Pilih atau ketik nomor order / nama pelanggan..."
              className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
            />
            <datalist id="doc-relations">
              {orders.map((o) => <option key={o.id} value={`${o.orderNumber} — ${o.customerName}`} />)}
              {customers.map((c) => <option key={c.id} value={`${c.customerCode} — ${c.name}`} />)}
              {suppliers.map((s) => <option key={s.id} value={`${s.supplierCode} — ${s.name}`} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Unggah File (Firebase Storage)</label>
            <label className="flex items-center justify-center gap-2 px-4 py-5 rounded-lg border border-dashed border-[#C9C4B8] bg-[#F8F7F4] cursor-pointer hover:border-[#1F3D2B] text-xs text-[#5A635D]">
              <Upload className="w-4 h-4 text-[#1F3D2B]" />
              <span>{selectedFile ? `${selectedFile.name} (${Math.round(selectedFile.size / 1024)} KB)` : 'Pilih foto, PDF, atau dokumen dari perangkat'}</span>
              <input
                type="file"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Atau Tautan Dokumen (URL Opsional)</label>
            <input
              type="url"
              value={form.downloadUrl}
              onChange={(e) => setForm({ ...form, downloadUrl: e.target.value })}
              placeholder="https://drive.google.com/..."
              className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Catatan</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E5E2DA]">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#E5E2DA] text-sm">Batal</button>
            <button type="submit" disabled={uploading} className="px-4 py-2 rounded-lg bg-[#1F3D2B] text-white text-sm font-medium">
              {uploading ? 'Mengunggah...' : 'Simpan Dokumen'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.title || ''}
        subtitle={previewDoc?.category}
        size="xl"
      >
        {previewDoc && (
          <img
            src={previewDoc.downloadUrl}
            alt={previewDoc.title}
            referrerPolicy="no-referrer"
            className="w-full max-h-[70vh] object-contain rounded-lg bg-[#F8F7F4]"
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Dokumen?"
        message={`Hapus arsip "${deleteTarget?.title}" dari pusat dokumen?`}
        confirmLabel="Hapus"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteRecord('documents', deleteTarget.id);
          notify('success', 'Dokumen dihapus.');
          setDeleteTarget(null);
        }}
      />
    </div>
  );
};
