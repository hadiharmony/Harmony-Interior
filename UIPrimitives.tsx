import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Info,
  MessageCircle,
  WifiOff,
  X,
} from 'lucide-react';
import { ToastMessage } from '../../context/AppDataContext';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { buildWhatsAppUrl } from '../../utils/formatters';

export const BrandWordmark: React.FC<{ compact?: boolean; light?: boolean }> = ({
  compact = false,
  light = false,
}) => (
  <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0 select-none">
    <div
      className={`w-8 h-8 rounded-lg flex items-center justify-center font-display font-semibold text-sm tracking-tight shrink-0 ${
        light
          ? 'bg-[#F8F7F4] text-[#1F3D2B]'
          : 'bg-[#1F3D2B] text-[#F8F7F4] border border-[#B5945B]/40'
      }`}
    >
      HI
    </div>
    {!compact && (
      <span
        className={`font-display text-lg font-semibold tracking-tight ${
          light ? 'text-[#F8F7F4]' : 'text-[#1F2421]'
        }`}
      >
        Harmony Interior
      </span>
    )}
  </div>
);

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'gold';

const STATUS_TONE_MAP: Record<string, StatusTone> = {
  // Orders
  'New Order': 'info',
  'Waiting for DP': 'warning',
  Confirmed: 'info',
  'Procurement Needed': 'warning',
  'PO Sent to Supplier': 'info',
  'Material Ordered': 'info',
  'Material Received': 'gold',
  'Production / Sewing': 'gold',
  'Quality Control': 'gold',
  'Ready for Installation': 'success',
  'Installation Scheduled': 'info',
  'Installation in Progress': 'gold',
  Completed: 'success',
  Closed: 'neutral',
  'On Hold': 'warning',
  Cancelled: 'danger',
  // Leads
  'New Lead': 'info',
  Contacted: 'neutral',
  'Survey Scheduled': 'info',
  'Survey Completed': 'gold',
  'Quotation Sent': 'gold',
  Negotiation: 'warning',
  Won: 'success',
  Lost: 'danger',
  // Quotations / PO / Survey / Install / Production
  Draft: 'neutral',
  Sent: 'info',
  Viewed: 'info',
  Revision: 'warning',
  Approved: 'success',
  Rejected: 'danger',
  Expired: 'danger',
  Scheduled: 'info',
  'In Progress': 'gold',
  Rescheduled: 'warning',
  'Confirmed by Supplier': 'info',
  'In Process': 'gold',
  Ready: 'success',
  Shipped: 'info',
  Received: 'success',
  'Partial Received': 'warning',
  'Not Started': 'neutral',
  'Material Preparation': 'info',
  Cutting: 'gold',
  Sewing: 'gold',
  Finishing: 'gold',
  'Quality Check': 'gold',
  Delayed: 'danger',
  'On the Way': 'info',
  // Payments
  Unpaid: 'danger',
  Partial: 'warning',
  Paid: 'success',
  Overpaid: 'info',
  // Tasks
  'To Do': 'neutral',
  Done: 'success',
  Low: 'neutral',
  Normal: 'info',
  High: 'warning',
  Urgent: 'danger',
};

const TONE_CLASSES: Record<StatusTone, { dot: string; text: string }> = {
  neutral: { dot: 'bg-[#7D8580]', text: 'text-[#5A635D]' },
  success: { dot: 'bg-[#1E7A46]', text: 'text-[#186037]' },
  warning: { dot: 'bg-[#C47F17]', text: 'text-[#9A600B]' },
  danger: { dot: 'bg-[#B53939]', text: 'text-[#962B2B]' },
  info: { dot: 'bg-[#2E5E8E]', text: 'text-[#224A72]' },
  gold: { dot: 'bg-[#B5945B]', text: 'text-[#846838]' },
};

export const StatusLabel: React.FC<{ status: string; tone?: StatusTone }> = ({ status, tone }) => {
  const resolved = tone || STATUS_TONE_MAP[status] || 'neutral';
  const cls = TONE_CLASSES[resolved];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${cls.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cls.dot}`} aria-hidden="true" />
      {status}
    </span>
  );
};

export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}> = ({ title, subtitle, action }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[#E5E2DA] mb-6">
    <div>
      <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#1F2421] tracking-tight">
        {title}
      </h1>
      {subtitle && <p className="mt-1 text-sm text-[#5A635D]">{subtitle}</p>}
    </div>
    {action && <div className="flex items-center gap-2.5 shrink-0 flex-wrap">{action}</div>}
  </div>
);

export const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ icon, title, description, actionLabel, onAction }) => (
  <div className="bg-white border border-[#E5E2DA] rounded-xl px-6 py-12 text-center">
    <div className="w-11 h-11 mx-auto rounded-lg bg-[#F8F7F4] border border-[#E5E2DA] text-[#5A635D] flex items-center justify-center mb-3.5">
      {icon}
    </div>
    <h3 className="text-base font-semibold text-[#1F2421]">{title}</h3>
    <p className="mt-1 text-sm text-[#5A635D] max-w-md mx-auto leading-relaxed">{description}</p>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1F3D2B] text-white text-sm font-medium hover:bg-[#172F21] transition-colors whitespace-nowrap"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}> = ({ open, onClose, title, subtitle, size = 'lg', children }) => {
  if (!open) return null;
  const maxW =
    size === 'md' ? 'max-w-lg' : size === 'xl' ? 'max-w-4xl' : 'max-w-2xl';
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F2421]/45 backdrop-blur-[2px] p-3 sm:p-5 overflow-y-auto no-print"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${maxW} bg-white border border-[#E5E2DA] rounded-xl shadow-xl my-auto max-h-[92vh] flex flex-col`}
      >
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 py-4 border-b border-[#E5E2DA] shrink-0">
          <div>
            <h2 className="font-display text-xl font-semibold text-[#1F2421]">{title}</h2>
            {subtitle && <p className="text-xs text-[#5A635D] mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="p-2 -mr-1.5 rounded-lg text-[#5A635D] hover:text-[#1F2421] hover:bg-[#F8F7F4] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
};

export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({
  open,
  title,
  message,
  confirmLabel = 'Konfirmasi',
  danger = true,
  loading = false,
  onCancel,
  onConfirm,
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1F2421]/50 p-4">
      <div className="w-full max-w-sm bg-white border border-[#E5E2DA] rounded-xl p-6 shadow-xl">
        <h3 className="font-display text-lg font-semibold text-[#1F2421]">{title}</h3>
        <p className="mt-2 text-sm text-[#5A635D] leading-relaxed">{message}</p>
        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-[#E5E2DA] text-sm font-medium text-[#1F2421] hover:bg-[#F8F7F4] transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
              danger
                ? 'bg-[#B53939] hover:bg-[#962B2B]'
                : 'bg-[#1F3D2B] hover:bg-[#172F21]'
            }`}
          >
            {loading ? 'Memproses...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ToastContainer: React.FC<{
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-20 lg:bottom-5 right-4 z-[70] flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] no-print">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-white border border-[#E5E2DA] shadow-lg text-sm text-[#1F2421]"
        >
          {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-[#1E7A46] shrink-0 mt-0.5" />}
          {t.type === 'error' && <AlertCircle className="w-4 h-4 text-[#B53939] shrink-0 mt-0.5" />}
          {t.type === 'info' && <Info className="w-4 h-4 text-[#2E5E8E] shrink-0 mt-0.5" />}
          <span className="flex-1 leading-snug">{t.text}</span>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            className="text-[#5A635D] hover:text-[#1F2421]"
            aria-label="Tutup notifikasi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export const WhatsAppLink: React.FC<{
  phone?: string;
  message: string;
  label?: string;
  compact?: boolean;
}> = ({ phone, message, label = 'WhatsApp', compact = false }) => {
  if (!phone) return null;
  const href = buildWhatsAppUrl(phone, message);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-lg border border-[#1E7A46]/30 bg-[#1E7A46]/5 text-[#186037] hover:bg-[#1E7A46]/12 transition-colors whitespace-nowrap shrink-0 font-medium ${
        compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-xs'
      }`}
    >
      <MessageCircle className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </a>
  );
};

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={`inline-flex items-center gap-2 rounded-lg border border-[#1F3D2B]/25 bg-[#1F3D2B]/5 text-[#1F3D2B] hover:bg-[#1F3D2B]/10 transition-colors font-medium whitespace-nowrap shrink-0 ${
          compact ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-xs w-full justify-center'
        }`}
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>Install Aplikasi</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center gap-2 rounded-lg border border-[#E5E2DA] bg-white text-[#1F2421] hover:bg-[#F8F7F4] transition-colors font-medium whitespace-nowrap shrink-0 ${
            compact ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-xs w-full justify-center'
          }`}
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>Install di iOS</span>
        </button>
        <Modal
          open={showIOSGuide}
          onClose={() => setShowIOSGuide(false)}
          title="Install di iPhone / iPad"
          size="md"
        >
          <ol className="list-decimal list-inside space-y-2 text-sm text-[#1F2421]">
            <li>Ketuk tombol <strong>Bagikan (Share)</strong> di toolbar Safari.</li>
            <li>Gulir ke bawah lalu pilih <strong>Tambahkan ke Layar Utama (Add to Home Screen)</strong>.</li>
            <li>Ketuk <strong>Tambah</strong> untuk menggunakan Harmony Interior seperti aplikasi native.</li>
          </ol>
        </Modal>
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;
  return (
    <div className="fixed bottom-20 lg:bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-[#9A600B] px-3.5 py-2 text-xs font-medium text-white shadow-lg no-print">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Mode Offline — Perubahan akan tersinkronisasi saat koneksi kembali.</span>
    </div>
  );
};
