import React, { useEffect, useMemo, useState } from 'react';
import {
  Copy,
  Edit3,
  FileSpreadsheet,
  Plus,
  Printer,
  Ruler,
  Trash2,
} from 'lucide-react';
import {
  ConfirmDialog,
  EmptyState,
  Modal,
  PageHeader,
  StatusLabel,
} from '../components/common/UIPrimitives';
import { useAppData } from '../context/AppDataContext';
import { MeasurementArea, QuotationItem, Survey, SurveyStatus } from '../types';
import {
  addDaysISO,
  clampStr,
  formatDateID,
  generateCode,
  getJakartaTodayISO,
} from '../utils/formatters';

const SURVEY_STATUSES: SurveyStatus[] = ['Scheduled', 'In Progress', 'Completed', 'Rescheduled', 'Cancelled'];

interface SurveyFormState {
  customerId: string;
  projectName: string;
  locationAddress: string;
  surveyDate: string;
  surveyTime: string;
  surveyor: string;
  status: SurveyStatus;
  fieldNotes: string;
}

interface AreaFormState {
  roomName: string;
  windowName: string;
  widthCm: string;
  heightCm: string;
  quantity: string;
  curtainType: string;
  model: string;
  fabricType: string;
  color: string;
  pattern: string;
  railType: string;
  accessories: string;
  notes: string;
  photoUrl: string;
}

const emptyArea = (): AreaFormState => ({
  roomName: '',
  windowName: 'Jendela A',
  widthCm: '',
  heightCm: '',
  quantity: '1',
  curtainType: 'Gorden Kain',
  model: 'Wave / S-Fold',
  fabricType: 'Blackout',
  color: '',
  pattern: 'Polos',
  railType: 'Rel Aluminium',
  accessories: '',
  notes: '',
  photoUrl: '',
});

export const SurveysPage: React.FC = () => {
  const {
    surveys,
    customers,
    measurementAreas,
    quotations,
    settings,
    createRecord,
    updateRecord,
    deleteRecord,
    notify,
    focusedRecordId,
    clearFocusedRecord,
    navigateTo,
  } = useAppData();

  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  const [surveyModalOpen, setSurveyModalOpen] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null);
  const [surveyForm, setSurveyForm] = useState<SurveyFormState>({
    customerId: '',
    projectName: '',
    locationAddress: '',
    surveyDate: getJakartaTodayISO(),
    surveyTime: '10:00',
    surveyor: '',
    status: 'Scheduled',
    fieldNotes: '',
  });

  const [areaModalOpen, setAreaModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<MeasurementArea | null>(null);
  const [areaForm, setAreaForm] = useState<AreaFormState>(emptyArea());
  const [printOpen, setPrintOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteSurveyTarget, setDeleteSurveyTarget] = useState<Survey | null>(null);
  const [deleteAreaTarget, setDeleteAreaTarget] = useState<MeasurementArea | null>(null);

  useEffect(() => {
    if (focusedRecordId) {
      const found = surveys.find((s) => s.id === focusedRecordId);
      if (found) setSelectedSurveyId(found.id);
      clearFocusedRecord();
    } else if (!selectedSurveyId && surveys.length > 0) {
      setSelectedSurveyId(surveys[0].id);
    }
  }, [focusedRecordId, surveys, selectedSurveyId, clearFocusedRecord]);

  const activeSurvey = useMemo(
    () => surveys.find((s) => s.id === selectedSurveyId) || null,
    [surveys, selectedSurveyId]
  );

  const activeAreas = useMemo(
    () =>
      activeSurvey
        ? measurementAreas.filter((a) => a.surveyId === activeSurvey.id)
        : [],
    [measurementAreas, activeSurvey]
  );

  const totalPanels = useMemo(
    () => activeAreas.reduce((sum, a) => sum + (a.quantity || 1), 0),
    [activeAreas]
  );

  const openCreateSurvey = () => {
    setEditingSurvey(null);
    const defaultCust = customers[0];
    setSurveyForm({
      customerId: defaultCust?.id || '',
      projectName: '',
      locationAddress: defaultCust?.installationLocation || defaultCust?.address || '',
      surveyDate: getJakartaTodayISO(),
      surveyTime: '10:00',
      surveyor: '',
      status: 'Scheduled',
      fieldNotes: '',
    });
    setSurveyModalOpen(true);
  };

  const openEditSurvey = (s: Survey) => {
    setEditingSurvey(s);
    setSurveyForm({
      customerId: s.customerId,
      projectName: s.projectName,
      locationAddress: s.locationAddress || '',
      surveyDate: s.surveyDate,
      surveyTime: s.surveyTime || '',
      surveyor: s.surveyor || '',
      status: s.status,
      fieldNotes: s.fieldNotes || '',
    });
    setSurveyModalOpen(true);
  };

  const handleSaveSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find((c) => c.id === surveyForm.customerId);
    if (!cust) {
      notify('error', 'Pilih pelanggan terlebih dahulu (atau tambahkan pelanggan di menu Pelanggan).');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        customerId: cust.id,
        customerName: cust.name,
        projectName: clampStr(surveyForm.projectName, 200),
        locationAddress: clampStr(surveyForm.locationAddress, 500),
        surveyDate: clampStr(surveyForm.surveyDate, 30),
        surveyTime: clampStr(surveyForm.surveyTime, 20),
        surveyor: clampStr(surveyForm.surveyor, 120),
        status: surveyForm.status,
        fieldNotes: clampStr(surveyForm.fieldNotes, 2000),
      };
      if (editingSurvey) {
        await updateRecord('surveys', editingSurvey.id, payload, {
          action: 'Survey diperbarui',
          entityType: 'survey',
          summary: `Survey ${editingSurvey.surveyCode} (${cust.name}) diperbarui.`,
        });
        notify('success', 'Data survey diperbarui.');
      } else {
        const surveyCode = generateCode('SRV', surveys.length);
        const id = await createRecord(
          'surveys',
          { ...payload, surveyCode, photoUrls: [] },
          {
            action: 'Survey dijadwalkan',
            entityType: 'survey',
            summary: `Survey ${surveyCode} untuk ${cust.name} — ${payload.projectName}.`,
          }
        );
        setSelectedSurveyId(id);
        notify('success', `Survey ${surveyCode} berhasil dibuat.`);
      }
      setSurveyModalOpen(false);
    } catch {
      notify('error', 'Gagal menyimpan survey.');
    } finally {
      setSaving(false);
    }
  };

  const openAddArea = () => {
    setEditingArea(null);
    setAreaForm(emptyArea());
    setAreaModalOpen(true);
  };

  const openEditArea = (a: MeasurementArea) => {
    setEditingArea(a);
    setAreaForm({
      roomName: a.roomName,
      windowName: a.windowName,
      widthCm: String(a.widthCm),
      heightCm: String(a.heightCm),
      quantity: String(a.quantity),
      curtainType: a.curtainType || '',
      model: a.model || '',
      fabricType: a.fabricType || '',
      color: a.color || '',
      pattern: a.pattern || '',
      railType: a.railType || '',
      accessories: a.accessories || '',
      notes: a.notes || '',
      photoUrl: a.photoUrl || '',
    });
    setAreaModalOpen(true);
  };

  const handleDuplicateArea = async (a: MeasurementArea) => {
    if (!activeSurvey) return;
    try {
      await createRecord(
        'measurementAreas',
        {
          surveyId: activeSurvey.id,
          customerId: activeSurvey.customerId,
          roomName: a.roomName,
          windowName: `${a.windowName} (Salinan)`.slice(0, 120),
          widthCm: a.widthCm,
          heightCm: a.heightCm,
          quantity: a.quantity,
          curtainType: a.curtainType || '',
          model: a.model || '',
          fabricType: a.fabricType || '',
          color: a.color || '',
          pattern: a.pattern || '',
          railType: a.railType || '',
          accessories: a.accessories || '',
          notes: a.notes || '',
          photoUrl: a.photoUrl || '',
        },
        {
          action: 'Bidang pengukuran diduplikasi',
          entityType: 'measurementArea',
          summary: `Bidang ${a.roomName} - ${a.windowName} diduplikasi pada ${activeSurvey.surveyCode}.`,
        }
      );
      notify('success', 'Bidang pengukuran berhasil diduplikasi.');
    } catch {
      notify('error', 'Gagal menduplikasi bidang.');
    }
  };

  const handleSaveArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSurvey) return;
    const widthCm = Number(areaForm.widthCm);
    const heightCm = Number(areaForm.heightCm);
    const quantity = Math.max(1, Number(areaForm.quantity) || 1);
    if (!areaForm.roomName.trim() || !areaForm.windowName.trim() || widthCm <= 0 || heightCm <= 0) {
      notify('error', 'Nama ruangan, bidang/jendela, lebar (cm), dan tinggi (cm) wajib diisi dengan angka valid.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        surveyId: activeSurvey.id,
        customerId: activeSurvey.customerId,
        roomName: clampStr(areaForm.roomName, 120),
        windowName: clampStr(areaForm.windowName, 120),
        widthCm,
        heightCm,
        quantity,
        curtainType: clampStr(areaForm.curtainType, 100),
        model: clampStr(areaForm.model, 100),
        fabricType: clampStr(areaForm.fabricType, 120),
        color: clampStr(areaForm.color, 100),
        pattern: clampStr(areaForm.pattern, 100),
        railType: clampStr(areaForm.railType, 120),
        accessories: clampStr(areaForm.accessories, 300),
        notes: clampStr(areaForm.notes, 1000),
        photoUrl: clampStr(areaForm.photoUrl, 1000),
      };

      if (editingArea) {
        await updateRecord('measurementAreas', editingArea.id, payload);
        notify('success', 'Bidang pengukuran diperbarui.');
      } else {
        await createRecord('measurementAreas', payload, {
          action: 'Bidang pengukuran ditambahkan',
          entityType: 'measurementArea',
          summary: `${payload.roomName} — ${payload.windowName} (${widthCm}×${heightCm} cm) pada ${activeSurvey.surveyCode}.`,
        });
        notify('success', 'Bidang pengukuran ditambahkan.');
      }
      setAreaModalOpen(false);
    } catch {
      notify('error', 'Gagal menyimpan pengukuran.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateQuotationFromSurvey = async () => {
    if (!activeSurvey) return;
    const cust = customers.find((c) => c.id === activeSurvey.customerId);
    const items: QuotationItem[] = activeAreas.map((a, idx) => ({
      id: `item-${idx + 1}`,
      roomName: a.roomName,
      windowName: a.windowName,
      productType: a.curtainType || 'Gorden Kain',
      specification: [
        a.model,
        a.fabricType,
        a.color,
        a.railType ? `Rel: ${a.railType}` : '',
        a.accessories ? `Aksesoris: ${a.accessories}` : '',
      ]
        .filter(Boolean)
        .join(', '),
      widthCm: a.widthCm,
      heightCm: a.heightCm,
      quantity: a.quantity,
      unit: 'set',
      unitPrice: 0,
      subtotal: 0,
    }));

    const qtNumber = generateCode(settings.quotationPrefix || 'QT', quotations.length);
    const today = getJakartaTodayISO();
    const validUntil = addDaysISO(today, settings.quotationValidityDays || 14);

    try {
      const id = await createRecord(
        'quotations',
        {
          quotationNumber: qtNumber,
          customerId: activeSurvey.customerId,
          customerName: activeSurvey.customerName,
          customerWhatsapp: cust?.whatsapp || '',
          surveyId: activeSurvey.id,
          projectName: activeSurvey.projectName,
          quotationDate: today,
          validUntil,
          revisionNumber: 1,
          items,
          subtotal: 0,
          discount: 0,
          surveyFee: 0,
          installationFee: 0,
          transportFee: 0,
          additionalFee: 0,
          totalAmount: 0,
          dpPercentage: settings.defaultDpPercentage || 50,
          dpAmount: 0,
          remainingAmount: 0,
          paymentTerms: settings.paymentTerms || '',
          notes: `Dibuat otomatis dari ${activeSurvey.surveyCode} (${totalPanels} bidang). Silakan lengkapi harga satuan.`,
          status: 'Draft',
          revisionHistory: [],
        },
        {
          action: 'Quotation dibuat dari Survey',
          entityType: 'quotation',
          summary: `Draft ${qtNumber} dibuat dari survey ${activeSurvey.surveyCode} (${items.length} baris bidang).`,
        }
      );
      notify('success', `Draft Quotation ${qtNumber} dibuat dengan ${items.length} baris pengukuran.`);
      navigateTo('quotations', id);
    } catch {
      notify('error', 'Gagal membuat quotation dari survey.');
    }
  };

  return (
    <div>
      <PageHeader
        title="Survey & Pengukuran Lapangan"
        subtitle="Kelola jadwal survey dan lembar ukur multi-ruangan serta multi-bidang jendela tanpa batas."
        action={
          <button
            type="button"
            onClick={openCreateSurvey}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1F3D2B] text-white text-sm font-medium hover:bg-[#172F21] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Jadwalkan Survey
          </button>
        }
      />

      {surveys.length === 0 ? (
        <EmptyState
          icon={<Ruler className="w-5 h-5" />}
          title="Belum ada jadwal survey"
          description="Buat jadwal survey pelanggan lalu masukkan ukuran lebar × tinggi setiap ruangan dan jendela agar siap dikonversi menjadi Quotation."
          actionLabel="Buat Survey Pertama"
          onAction={openCreateSurvey}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Survey List */}
          <div className="lg:col-span-4 bg-white border border-[#E5E2DA] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E5E2DA] bg-[#F8F7F4] text-xs font-semibold text-[#5A635D]">
              Daftar Survey ({surveys.length})
            </div>
            <div className="divide-y divide-[#E5E2DA] max-h-[650px] overflow-y-auto">
              {surveys.map((s) => {
                const count = measurementAreas.filter((m) => m.surveyId === s.id).length;
                const active = activeSurvey?.id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedSurveyId(s.id)}
                    className={`w-full p-4 text-left transition-colors ${
                      active ? 'bg-[#F3ECE0]/55' : 'hover:bg-[#F8F7F4]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-[#846838] font-medium">{s.surveyCode}</span>
                      <StatusLabel status={s.status} />
                    </div>
                    <p className="font-semibold text-sm text-[#1F2421] mt-1">{s.customerName}</p>
                    <p className="text-xs text-[#5A635D] truncate">{s.projectName}</p>
                    <p className="text-xs text-[#7D8580] mt-1.5 font-mono">
                      {formatDateID(s.surveyDate)} {s.surveyTime || ''} · {count} baris ukur
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Measurement Sheet Workspace */}
          <div className="lg:col-span-8 space-y-5">
            {activeSurvey && (
              <>
                <div className="bg-white border border-[#E5E2DA] rounded-xl p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-[#E5E2DA]">
                    <div>
                      <div className="flex items-center gap-2.5 text-xs text-[#5A635D]">
                        <span className="font-mono font-semibold text-[#846838]">{activeSurvey.surveyCode}</span>
                        <span>·</span>
                        <StatusLabel status={activeSurvey.status} />
                      </div>
                      <h2 className="font-display text-2xl font-semibold text-[#1F2421] mt-1">
                        {activeSurvey.customerName} — {activeSurvey.projectName}
                      </h2>
                      <p className="text-xs text-[#5A635D] mt-1">
                        {activeSurvey.locationAddress || 'Alamat belum diisi'} · Jadwal: {formatDateID(activeSurvey.surveyDate)} {activeSurvey.surveyTime || ''} {activeSurvey.surveyor ? `· Surveyor: ${activeSurvey.surveyor}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditSurvey(activeSurvey)}
                        className="px-3 py-1.5 rounded-lg border border-[#E5E2DA] text-xs font-medium text-[#1F2421] hover:bg-[#F8F7F4]"
                      >
                        Edit Survey
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrintOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E2DA] text-xs font-medium text-[#1F2421] hover:bg-[#F8F7F4]"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Cetak Lembar Ukur
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateQuotationFromSurvey}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1F3D2B] text-white text-xs font-medium hover:bg-[#172F21]"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        Buat Quotation
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteSurveyTarget(activeSurvey)}
                        className="p-1.5 rounded-lg text-[#5A635D] hover:text-[#B53939] hover:bg-[#FDF2F2]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {activeSurvey.fieldNotes && (
                    <p className="mt-3 text-xs text-[#5A635D]">
                      <strong className="text-[#1F2421]">Catatan Lapangan:</strong> {activeSurvey.fieldNotes}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-[#5A635D]">
                      Total baris area: <strong className="text-[#1F2421] font-mono">{activeAreas.length}</strong> · Total bidang jendela: <strong className="text-[#1F2421] font-mono">{totalPanels}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={openAddArea}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1F3D2B] text-white text-xs font-medium hover:bg-[#172F21]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah Bidang Pengukuran
                    </button>
                  </div>
                </div>

                {/* Measurement Areas Table / Cards */}
                {activeAreas.length === 0 ? (
                  <EmptyState
                    icon={<Ruler className="w-5 h-5" />}
                    title="Belum ada bidang jendela diukur"
                    description="Tambahkan setiap ruangan dan bidang jendela (mis. Ruang Tamu — Jendela A — 300 × 250 cm). Anda dapat menduplikasi bidang identik dengan satu klik."
                    actionLabel="Tambah Bidang Pertama"
                    onAction={openAddArea}
                  />
                ) : (
                  <div className="bg-white border border-[#E5E2DA] rounded-xl overflow-hidden">
                    <div className="divide-y divide-[#E5E2DA]">
                      {activeAreas.map((a) => (
                        <div key={a.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F8F7F4]/50">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-[#1F2421]">
                                {a.roomName} — {a.windowName}
                              </span>
                              <span className="font-mono text-xs font-semibold text-[#1F3D2B] tabular-nums">
                                {a.widthCm} × {a.heightCm} cm ({a.quantity} bidang)
                              </span>
                            </div>
                            <p className="text-xs text-[#5A635D]">
                              {[a.curtainType, a.model, a.fabricType, a.color, a.pattern]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                            {(a.railType || a.accessories || a.notes) && (
                              <p className="text-xs text-[#7D8580]">
                                {a.railType ? `Rel: ${a.railType}` : ''}
                                {a.accessories ? ` · Aksesoris: ${a.accessories}` : ''}
                                {a.notes ? ` · ${a.notes}` : ''}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleDuplicateArea(a)}
                              title="Duplikasi Bidang"
                              className="p-2 rounded-lg text-[#5A635D] hover:text-[#1F3D2B] hover:bg-[#F8F7F4]"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditArea(a)}
                              title="Edit Bidang"
                              className="p-2 rounded-lg text-[#5A635D] hover:text-[#1F3D2B] hover:bg-[#F8F7F4]"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteAreaTarget(a)}
                              title="Hapus Bidang"
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
              </>
            )}
          </div>
        </div>
      )}

      {/* Survey Create/Edit Modal */}
      <Modal
        open={surveyModalOpen}
        onClose={() => setSurveyModalOpen(false)}
        title={editingSurvey ? 'Edit Survey' : 'Jadwalkan Survey Baru'}
      >
        <form onSubmit={handleSaveSurvey} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Pelanggan *</label>
              <select
                required
                disabled={Boolean(editingSurvey)}
                value={surveyForm.customerId}
                onChange={(e) => {
                  const cust = customers.find((c) => c.id === e.target.value);
                  setSurveyForm({
                    ...surveyForm,
                    customerId: e.target.value,
                    locationAddress: cust?.installationLocation || cust?.address || surveyForm.locationAddress,
                  });
                }}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
              >
                <option value="">-- Pilih Pelanggan --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.customerCode})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Nama Proyek *</label>
              <input
                type="text"
                required
                value={surveyForm.projectName}
                onChange={(e) => setSurveyForm({ ...surveyForm, projectName: e.target.value })}
                placeholder="Contoh: Rumah di Surabaya Barat"
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Tanggal Survey *</label>
              <input
                type="date"
                required
                value={surveyForm.surveyDate}
                onChange={(e) => setSurveyForm({ ...surveyForm, surveyDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Waktu</label>
              <input
                type="time"
                value={surveyForm.surveyTime}
                onChange={(e) => setSurveyForm({ ...surveyForm, surveyTime: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Surveyor</label>
              <input
                type="text"
                value={surveyForm.surveyor}
                onChange={(e) => setSurveyForm({ ...surveyForm, surveyor: e.target.value })}
                placeholder="Nama petugas ukur"
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Status Survey</label>
              <select
                value={surveyForm.status}
                onChange={(e) => setSurveyForm({ ...surveyForm, status: e.target.value as SurveyStatus })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
              >
                {SURVEY_STATUSES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Alamat Lokasi</label>
            <input
              type="text"
              value={surveyForm.locationAddress}
              onChange={(e) => setSurveyForm({ ...surveyForm, locationAddress: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Catatan Lapangan</label>
            <textarea
              rows={2}
              value={surveyForm.fieldNotes}
              onChange={(e) => setSurveyForm({ ...surveyForm, fieldNotes: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E5E2DA]">
            <button type="button" onClick={() => setSurveyModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#E5E2DA] text-sm">
              Batal
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-[#1F3D2B] text-white text-sm font-medium">
              {saving ? 'Menyimpan...' : 'Simpan Survey'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Measurement Area Modal */}
      <Modal
        open={areaModalOpen}
        onClose={() => setAreaModalOpen(false)}
        title={editingArea ? 'Edit Bidang Pengukuran' : 'Tambah Bidang Pengukuran'}
        subtitle={activeSurvey ? `${activeSurvey.customerName} — ${activeSurvey.projectName}` : ''}
      >
        <form onSubmit={handleSaveArea} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Nama Ruangan *</label>
              <input
                type="text"
                required
                value={areaForm.roomName}
                onChange={(e) => setAreaForm({ ...areaForm, roomName: e.target.value })}
                placeholder="Contoh: Ruang Tamu / Kamar Utama"
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Nama Bidang / Jendela *</label>
              <input
                type="text"
                required
                value={areaForm.windowName}
                onChange={(e) => setAreaForm({ ...areaForm, windowName: e.target.value })}
                placeholder="Contoh: Jendela A / Pintu Geser"
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Lebar (cm) *</label>
              <input
                type="number"
                required
                min="1"
                value={areaForm.widthCm}
                onChange={(e) => setAreaForm({ ...areaForm, widthCm: e.target.value })}
                placeholder="300"
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Tinggi (cm) *</label>
              <input
                type="number"
                required
                min="1"
                value={areaForm.heightCm}
                onChange={(e) => setAreaForm({ ...areaForm, heightCm: e.target.value })}
                placeholder="250"
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Jumlah Bidang *</label>
              <input
                type="number"
                required
                min="1"
                value={areaForm.quantity}
                onChange={(e) => setAreaForm({ ...areaForm, quantity: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Jenis Produk / Gorden</label>
              <select
                value={areaForm.curtainType}
                onChange={(e) => setAreaForm({ ...areaForm, curtainType: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
              >
                {(settings.productCategories || []).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Model</label>
              <input
                type="text"
                value={areaForm.model}
                onChange={(e) => setAreaForm({ ...areaForm, model: e.target.value })}
                placeholder="Wave / Smokering / Ploi / Roman"
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Jenis Kain</label>
              <input
                type="text"
                value={areaForm.fabricType}
                onChange={(e) => setAreaForm({ ...areaForm, fabricType: e.target.value })}
                placeholder="Blackout 90% / Linen Sheer"
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Warna &amp; Kode Kain</label>
              <input
                type="text"
                value={areaForm.color}
                onChange={(e) => setAreaForm({ ...areaForm, color: e.target.value })}
                placeholder="Warm Ivory #04"
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Motif</label>
              <input
                type="text"
                value={areaForm.pattern}
                onChange={(e) => setAreaForm({ ...areaForm, pattern: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2421] mb-1">Jenis Rel / Track</label>
              <input
                type="text"
                value={areaForm.railType}
                onChange={(e) => setAreaForm({ ...areaForm, railType: e.target.value })}
                placeholder="Double Track Ceiling / Rollet Champagne"
                className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Aksesoris</label>
            <input
              type="text"
              value={areaForm.accessories}
              onChange={(e) => setAreaForm({ ...areaForm, accessories: e.target.value })}
              placeholder="Tieback, hook, bracket ceiling, dll."
              className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1F2421] mb-1">Catatan Bidang</label>
            <textarea
              rows={2}
              value={areaForm.notes}
              onChange={(e) => setAreaForm({ ...areaForm, notes: e.target.value })}
              placeholder="Contoh: Ada box gypsum 15 cm, pemasangan ceiling mount"
              className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] text-sm"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E5E2DA]">
            <button type="button" onClick={() => setAreaModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#E5E2DA] text-sm">
              Batal
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-[#1F3D2B] text-white text-sm font-medium">
              {saving ? 'Menyimpan...' : 'Simpan Bidang'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Printable Measurement Sheet Modal */}
      {printOpen && activeSurvey && (
        <div className="fixed inset-0 z-50 bg-[#1F2421]/50 overflow-y-auto p-4">
          <div className="max-w-3xl mx-auto bg-white rounded-xl border border-[#E5E2DA] p-8 print-sheet">
            <div className="flex items-center justify-between pb-4 border-b border-[#E5E2DA] mb-6 no-print">
              <span className="text-sm font-semibold text-[#1F2421]">Pratinjau Lembar Pengukuran</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1F3D2B] text-white text-xs font-medium"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak / Simpan PDF
                </button>
                <button
                  type="button"
                  onClick={() => setPrintOpen(false)}
                  className="px-3.5 py-2 rounded-lg border border-[#E5E2DA] text-xs font-medium"
                >
                  Tutup
                </button>
              </div>
            </div>

            <div className="flex justify-between items-start border-b border-[#E5E2DA] pb-4 mb-5">
              <div>
                <h1 className="font-display text-2xl font-semibold text-[#1F3D2B]">{settings.businessName}</h1>
                <p className="text-xs text-[#5A635D]">Measurement Sheet / Lembar Pengukuran Lapangan</p>
              </div>
              <div className="text-right text-xs">
                <p className="font-mono font-semibold">{activeSurvey.surveyCode}</p>
                <p className="text-[#5A635D]">{formatDateID(activeSurvey.surveyDate)} {activeSurvey.surveyTime || ''}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs mb-5">
              <div>
                <p className="text-[#5A635D]">Pelanggan</p>
                <p className="font-semibold text-[#1F2421]">{activeSurvey.customerName}</p>
                <p className="text-[#5A635D] mt-0.5">{activeSurvey.locationAddress || '-'}</p>
              </div>
              <div>
                <p className="text-[#5A635D]">Proyek &amp; Surveyor</p>
                <p className="font-semibold text-[#1F2421]">{activeSurvey.projectName}</p>
                <p className="text-[#5A635D] mt-0.5">Surveyor: {activeSurvey.surveyor || '-'}</p>
              </div>
            </div>

            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-y border-[#1F2421] text-[#1F2421]">
                  <th className="py-2 pr-2">No</th>
                  <th className="py-2 pr-2">Ruangan &amp; Bidang</th>
                  <th className="py-2 pr-2">Ukuran (L×T)</th>
                  <th className="py-2 pr-2">Qty</th>
                  <th className="py-2 pr-2">Spesifikasi &amp; Rel</th>
                  <th className="py-2">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E2DA]">
                {activeAreas.map((a, idx) => (
                  <tr key={a.id}>
                    <td className="py-2 pr-2 font-mono">{idx + 1}</td>
                    <td className="py-2 pr-2 font-medium">{a.roomName} — {a.windowName}</td>
                    <td className="py-2 pr-2 font-mono">{a.widthCm} × {a.heightCm} cm</td>
                    <td className="py-2 pr-2 font-mono">{a.quantity}</td>
                    <td className="py-2 pr-2">
                      {[a.curtainType, a.model, a.fabricType, a.color, a.railType].filter(Boolean).join(', ')}
                    </td>
                    <td className="py-2">{a.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-5 pt-4 border-t border-[#E5E2DA] flex justify-between text-xs">
              <span>Total Bidang Jendela: <strong className="font-mono">{totalPanels}</strong></span>
              <span>Catatan: {activeSurvey.fieldNotes || '-'}</span>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteSurveyTarget)}
        title="Hapus Survey?"
        message={`Hapus survey "${deleteSurveyTarget?.surveyCode}"?`}
        confirmLabel="Hapus Survey"
        onCancel={() => setDeleteSurveyTarget(null)}
        onConfirm={async () => {
          if (!deleteSurveyTarget) return;
          await deleteRecord('surveys', deleteSurveyTarget.id, {
            action: 'Survey dihapus',
            entityType: 'survey',
            summary: `Survey ${deleteSurveyTarget.surveyCode} dihapus.`,
          });
          setSelectedSurveyId(null);
          setDeleteSurveyTarget(null);
          notify('success', 'Survey dihapus.');
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteAreaTarget)}
        title="Hapus Bidang Pengukuran?"
        message={`Hapus "${deleteAreaTarget?.roomName} — ${deleteAreaTarget?.windowName}"?`}
        confirmLabel="Hapus"
        onCancel={() => setDeleteAreaTarget(null)}
        onConfirm={async () => {
          if (!deleteAreaTarget) return;
          await deleteRecord('measurementAreas', deleteAreaTarget.id);
          setDeleteAreaTarget(null);
          notify('success', 'Bidang pengukuran dihapus.');
        }}
      />
    </div>
  );
};
