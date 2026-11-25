import { Timestamp } from 'firebase/firestore';

export function formatIDR(amount: number | undefined | null): string {
  const safe = Number.isFinite(amount) ? Number(amount) : 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safe);
}

export function getJakartaTodayISO(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now); // YYYY-MM-DD
}

export function addDaysISO(baseISO: string, days: number): string {
  const parts = baseISO.split('-').map(Number);
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDateID(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const cleaned = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
    const [y, m, d] = cleaned.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  return cleaned;
}

export function formatTimestampID(ts?: Timestamp | null): string {
  if (!ts) return '-';
  try {
    const date = ts.toDate();
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return '-';
  }
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const normalized = normalizePhone(phone);
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${normalized}?text=${encoded}`;
}

export function generateCode(prefix: string, existingCount: number): string {
  const year = getJakartaTodayISO().slice(0, 4);
  const seq = String(existingCount + 1).padStart(3, '0');
  return `${prefix}-${year}-${seq}`;
}

export function generateSimpleCode(prefix: string, existingCount: number): string {
  const seq = String(existingCount + 1).padStart(3, '0');
  return `${prefix}-${seq}`;
}

export function isDateOverdue(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  return dateStr.slice(0, 10) < getJakartaTodayISO();
}

export function isDateToday(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  return dateStr.slice(0, 10) === getJakartaTodayISO();
}

export function isDateTomorrow(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  return dateStr.slice(0, 10) === addDaysISO(getJakartaTodayISO(), 1);
}

export function isDateWithinDays(dateStr: string | undefined | null, days: number): boolean {
  if (!dateStr) return false;
  const iso = dateStr.slice(0, 10);
  const today = getJakartaTodayISO();
  const limit = addDaysISO(today, days);
  return iso >= today && iso <= limit;
}

export function getMonthKey(dateStr?: string | null): string {
  if (!dateStr || dateStr.length < 7) return '';
  return dateStr.slice(0, 7); // YYYY-MM
}

export function formatMonthLabel(monthKey: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const [y, m] = monthKey.split('-');
  const idx = Number(m) - 1;
  if (idx < 0 || idx > 11) return monthKey;
  return `${months[idx]} ${y}`;
}

export function exportToCSV(filename: string, headers: string[], rows: (string | number | undefined)[][]): void {
  const escapeCell = (val: string | number | undefined) => {
    const str = val === undefined || val === null ? '' : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csv = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function clampStr(val: string | undefined | null, maxLen: number): string {
  if (!val) return '';
  return val.trim().slice(0, maxLen);
}

export const WA_TEMPLATES = {
  customerGreeting: (name: string, businessName: string) =>
    `Halo Bapak/Ibu ${name},\n\nTerima kasih telah menghubungi ${businessName}. Ada yang dapat kami bantu untuk kebutuhan gorden custom atau window treatment Anda?`,

  leadFollowUp: (name: string, needs: string, businessName: string) =>
    `Halo Bapak/Ibu ${name},\n\nSaya dari ${businessName} ingin menindaklanjuti kebutuhan gorden custom Anda (${needs || 'window treatment'}). Apakah ada jadwal yang nyaman untuk konsultasi atau survey pengukuran lokasi?`,

  sendQuotation: (params: {
    customerName: string;
    quotationNumber: string;
    projectName: string;
    totalAmount: number;
    dpAmount: number;
    validUntil?: string;
    businessName: string;
  }) =>
    `Halo Bapak/Ibu ${params.customerName},\n\nBerikut penawaran harga dari ${params.businessName}:\n• No. Quotation: ${params.quotationNumber}\n• Proyek: ${params.projectName}\n• Total Estimasi: ${formatIDR(params.totalAmount)}\n• DP Awal: ${formatIDR(params.dpAmount)}\n• Berlaku s/d: ${formatDateID(params.validUntil)}\n\nMohon informasi jika ada bagian yang ingin disesuaikan. Terima kasih.`,

  confirmOrder: (params: {
    customerName: string;
    orderNumber: string;
    projectName: string;
    totalAmount: number;
    targetInstallation?: string;
    businessName: string;
  }) =>
    `Halo Bapak/Ibu ${params.customerName},\n\nPesanan Anda di ${params.businessName} telah kami catat:\n• No. Order: ${params.orderNumber}\n• Proyek: ${params.projectName}\n• Nilai Order: ${formatIDR(params.totalAmount)}\n• Estimasi Pemasangan: ${formatDateID(params.targetInstallation)}\n\nKami akan mengabarkan setiap perkembangan pengadaan bahan dan produksi. Terima kasih.`,

  paymentReminder: (params: {
    customerName: string;
    orderNumber: string;
    projectName: string;
    remainingAmount: number;
    bankAccounts?: string;
    businessName: string;
  }) =>
    `Halo Bapak/Ibu ${params.customerName},\n\nMengingatkan tagihan pembayaran untuk pesanan ${params.orderNumber} (${params.projectName}) di ${params.businessName}:\n• Sisa Pembayaran: ${formatIDR(params.remainingAmount)}\n${params.bankAccounts ? `\nRekening Pembayaran:\n${params.bankAccounts}\n` : ''}\nMohon kirimkan bukti transfer setelah pembayaran dilakukan. Terima kasih.`,

  sendPOToSupplier: (params: {
    supplierName: string;
    poNumber: string;
    orderNumber: string;
    targetArrival?: string;
    itemsSummary: string;
    totalAmount: number;
    businessName: string;
  }) =>
    `Halo ${params.supplierName},\n\nKami dari ${params.businessName} mengirimkan Purchase Order berikut:\n• No. PO: ${params.poNumber}\n• Referensi Order: ${params.orderNumber}\n• Target Kedatangan: ${formatDateID(params.targetArrival)}\n\nDetail Barang:\n${params.itemsSummary}\n\nTotal PO: ${formatIDR(params.totalAmount)}\nMohon konfirmasi ketersediaan dan estimasi jadwal kirim. Terima kasih.`,

  installationReminder: (params: {
    customerName: string;
    orderNumber: string;
    date: string;
    time?: string;
    address?: string;
    businessName: string;
  }) =>
    `Halo Bapak/Ibu ${params.customerName},\n\nMengonfirmasi jadwal pemasangan gorden custom dari ${params.businessName}:\n• No. Order: ${params.orderNumber}\n• Tanggal: ${formatDateID(params.date)}\n• Waktu: ${params.time || 'Sesuai kesepakatan'}\n• Lokasi: ${params.address || '-'}\n\nMohon konfirmasi apakah lokasi siap untuk pemasangan. Terima kasih.`,
};
